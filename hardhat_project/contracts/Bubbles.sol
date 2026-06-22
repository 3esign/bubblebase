// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Bubbles {
    address payable public constant CREATOR = payable(0x525eE261f2E22E14a10C699A9A11BB521Bd8a2C5);
    
    // Scale-down fees: 10x cheaper than original (about 3 cents on Base L2)
    uint256 public constant ACTION_FEE = 0.00001 ether; 
    uint256 public constant CREATOR_FEE_PERCENT = 5;
    uint256 public constant REWARD_FEE_PERCENT = 50;

    // Connection expiry duration: 1 day
    uint256 public constant CONNECTION_LIFETIME = 1 days;

    struct Connection {
        uint64 lastNurturedAt;
        uint16 boostMultiplier; // 100 = 1.0x, 200 = 2.0x, max 300 = 3.0x
        bool active;
    }

    mapping(uint64 => address) public nodes;
    // fromNode => toNode => isPending
    mapping(uint64 => mapping(uint64 => bool)) public pendingRequests;
    mapping(uint64 => mapping(uint64 => uint256)) public pendingRequestFees;
    mapping(uint64 => uint32) public connectionCounts;

    uint256 public totalConnections;
    uint256 public rewardPerConnection; // Scaled by 1e18
    mapping(uint64 => uint256) public nodeRewardDebt;
    mapping(uint64 => uint256) public nodePendingRewards;

    // Undirected connection registry
    mapping(bytes32 => Connection) public connections;

    event NodePlaced(uint64 indexed nodeKey, address indexed owner, int32 x, int32 y);
    event ConnectionRequested(uint64 indexed fromNode, uint64 indexed toNode);
    event ConnectionApproved(uint64 indexed fromNode, uint64 indexed toNode);
    event ConnectionNurtured(uint64 indexed fromNode, uint64 indexed toNode, uint256 lastNurturedAt);
    event ConnectionBoosted(uint64 indexed fromNode, uint64 indexed toNode, uint256 boostMultiplier, uint256 lastNurturedAt);
    event RewardsClaimed(uint64 indexed nodeKey, address indexed owner, uint256 amount);
    event ConnectionDeactivated(uint64 indexed fromNode, uint64 indexed toNode);
    event ConnectionRequestCancelled(uint64 indexed fromNode, uint64 indexed toNode);

    function _updateNodeRewards(uint64 nodeKey) internal {
        if (connectionCounts[nodeKey] > 0) {
            uint256 pending = (connectionCounts[nodeKey] * rewardPerConnection) / 1e18 - nodeRewardDebt[nodeKey];
            if (pending > 0) {
                nodePendingRewards[nodeKey] += pending;
            }
        }
        nodeRewardDebt[nodeKey] = (connectionCounts[nodeKey] * rewardPerConnection) / 1e18;
    }

    function encodeCoordinate(int32 x, int32 y) public pure returns (uint64) {
        return (uint64(uint32(x)) << 32) | uint64(uint32(y));
    }

    function decodeCoordinate(uint64 key) public pure returns (int32 x, int32 y) {
        x = int32(uint32(key >> 32));
        y = int32(uint32(key));
    }

    function abs(int32 x) private pure returns (int32) {
        return x >= 0 ? x : -x;
    }

    // Undirected key generation
    function getConnKey(uint64 a, uint64 b) public pure returns (bytes32) {
        if (a < b) {
            return keccak256(abi.encodePacked(a, b));
        } else {
            return keccak256(abi.encodePacked(b, a));
        }
    }

    function calculateConnectionFee(uint64 fromNode, uint64 toNode) public view returns (uint256) {
        uint256 baseFee = ACTION_FEE;
        
        // 1. Connection Premium
        uint32 fromConns = connectionCounts[fromNode];
        uint32 toConns = connectionCounts[toNode];
        uint256 connectionPremium = 0;
        if (toConns > fromConns) {
            connectionPremium = uint256(toConns - fromConns) * 0.000005 ether; // 10x cheaper premium
        }

        // 2. Distance Premium
        (int32 x1, int32 y1) = decodeCoordinate(fromNode);
        (int32 x2, int32 y2) = decodeCoordinate(toNode);
        uint256 distance = uint256(uint32(abs(x2 - x1) + abs(y2 - y1)));
        uint256 distancePremium = distance * 0.000001 ether; // 10x cheaper premium

        return baseFee + connectionPremium + distancePremium;
    }

    function calculateNurtureFee(uint64 fromNode, uint64 toNode) public pure returns (uint256) {
        // Base nurture fee = 0.000002 ether
        // Distance premium = 0.0000002 ether per unit
        (int32 x1, int32 y1) = decodeCoordinate(fromNode);
        (int32 x2, int32 y2) = decodeCoordinate(toNode);
        uint256 distance = uint256(uint32(abs(x2 - x1) + abs(y2 - y1)));
        return 0.000002 ether + (distance * 0.0000002 ether);
    }

    // Changed to pure since it doesn't read state
    function calculateBoostFee(uint64 fromNode, uint64 toNode) public pure returns (uint256) {
        // Base boost fee = 0.000005 ether
        // Distance premium = 0.0000005 ether per unit
        (int32 x1, int32 y1) = decodeCoordinate(fromNode);
        (int32 x2, int32 y2) = decodeCoordinate(toNode);
        uint256 distance = uint256(uint32(abs(x2 - x1) + abs(y2 - y1)));
        return 0.000005 ether + (distance * 0.0000005 ether);
    }

    function isConnectionActive(uint64 fromNode, uint64 toNode) public view returns (bool) {
        bytes32 key = getConnKey(fromNode, toNode);
        if (!connections[key].active) return false;
        return block.timestamp <= connections[key].lastNurturedAt + CONNECTION_LIFETIME;
    }

    function placeNode(int32 x, int32 y) external payable {
        require(msg.value == ACTION_FEE, "Incorrect fee");
        uint64 nodeKey = encodeCoordinate(x, y);
        require(nodes[nodeKey] == address(0), "Location occupied");

        nodes[nodeKey] = msg.sender;

        // Pay creator
        uint256 creatorFee = (ACTION_FEE * CREATOR_FEE_PERCENT) / 100;
        (bool success, ) = CREATOR.call{value: creatorFee}("");
        require(success, "Fee transfer failed");

        emit NodePlaced(nodeKey, msg.sender, x, y);
    }

    function requestConnection(uint64 fromNode, uint64 toNode) external payable {
        uint256 requiredFee = calculateConnectionFee(fromNode, toNode);
        require(msg.value >= requiredFee, "Insufficient fee");
        require(nodes[fromNode] == msg.sender, "Not fromNode owner");
        require(nodes[toNode] != address(0), "toNode does not exist");
        require(fromNode != toNode, "Self-connection not allowed");
        require(!pendingRequests[fromNode][toNode], "Request already pending");

        pendingRequests[fromNode][toNode] = true;
        pendingRequestFees[fromNode][toNode] = msg.value;

        // Pay creator
        uint256 creatorFee = (msg.value * CREATOR_FEE_PERCENT) / 100;
        (bool success, ) = CREATOR.call{value: creatorFee}("");
        require(success, "Fee transfer failed");

        emit ConnectionRequested(fromNode, toNode);
    }

    function approveConnection(uint64 fromNode, uint64 toNode) external {
        require(nodes[toNode] == msg.sender, "Not toNode owner");
        require(pendingRequests[fromNode][toNode], "No pending request");
        bytes32 key = getConnKey(fromNode, toNode);
        require(!connections[key].active, "Connection already exists");

        pendingRequests[fromNode][toNode] = false;
        
        uint256 feePaid = pendingRequestFees[fromNode][toNode];
        pendingRequestFees[fromNode][toNode] = 0;

        uint256 rewardFee = (feePaid * REWARD_FEE_PERCENT) / 100;

        // 1. Add reward to global pool based on current total connections
        if (totalConnections > 0) {
            rewardPerConnection += (rewardFee * 1e18) / totalConnections;
        } else {
            // First connections on the grid get the initial fee directly
            nodePendingRewards[fromNode] += rewardFee / 2;
            nodePendingRewards[toNode] += rewardFee - (rewardFee / 2);
        }

        // 2. Update node rewards before increasing connections
        _updateNodeRewards(fromNode);
        _updateNodeRewards(toNode);

        // 3. Update connection counts
        connectionCounts[fromNode]++;
        connectionCounts[toNode]++;
        totalConnections += 2;

        // 4. Update debt for the new connection counts
        nodeRewardDebt[fromNode] = (connectionCounts[fromNode] * rewardPerConnection) / 1e18;
        nodeRewardDebt[toNode] = (connectionCounts[toNode] * rewardPerConnection) / 1e18;

        // Register the active connection
        connections[key] = Connection({
            lastNurturedAt: uint64(block.timestamp),
            boostMultiplier: 100, // starting at 1.0x
            active: true
        });

        emit ConnectionApproved(fromNode, toNode);
    }

    function nurtureConnection(uint64 fromNode, uint64 toNode) external payable {
        bytes32 key = getConnKey(fromNode, toNode);
        require(connections[key].active, "Connection does not exist");
        
        uint256 fee = calculateNurtureFee(fromNode, toNode);
        require(msg.value >= fee, "Insufficient nurture fee");
        
        connections[key].lastNurturedAt = uint64(block.timestamp);
        
        // Distribute fee
        uint256 creatorFee = (msg.value * CREATOR_FEE_PERCENT) / 100;
        (bool success, ) = CREATOR.call{value: creatorFee}("");
        require(success, "Fee transfer failed");
        
        uint256 remaining = msg.value - creatorFee;
        if (totalConnections > 0) {
            rewardPerConnection += (remaining * 1e18) / totalConnections;
        }

        emit ConnectionNurtured(fromNode, toNode, block.timestamp);
    }

    function boostConnection(uint64 fromNode, uint64 toNode) external payable {
        bytes32 key = getConnKey(fromNode, toNode);
        require(connections[key].active, "Connection does not exist");
        
        uint256 fee = calculateBoostFee(fromNode, toNode);
        require(msg.value >= fee, "Insufficient boost fee");
        
        Connection storage conn = connections[key];
        
        // Increment multiplier up to 300 (3x)
        if (conn.boostMultiplier < 300) {
            conn.boostMultiplier += 50;
        }
        
        // Reset decay timer upon boosting
        conn.lastNurturedAt = uint64(block.timestamp);
        
        // Distribute fee
        uint256 creatorFee = (msg.value * CREATOR_FEE_PERCENT) / 100;
        (bool success, ) = CREATOR.call{value: creatorFee}("");
        require(success, "Fee transfer failed");
        
        uint256 remaining = msg.value - creatorFee;
        if (totalConnections > 0) {
            rewardPerConnection += (remaining * 1e18) / totalConnections;
        }

        emit ConnectionBoosted(fromNode, toNode, conn.boostMultiplier, block.timestamp);
    }

    function deactivateConnection(uint64 fromNode, uint64 toNode) external {
        bytes32 key = getConnKey(fromNode, toNode);
        require(connections[key].active, "Connection does not exist");
        require(!isConnectionActive(fromNode, toNode), "Connection has not decayed");

        _updateNodeRewards(fromNode);
        _updateNodeRewards(toNode);

        connections[key].active = false;
        connections[key].boostMultiplier = 100;

        if (connectionCounts[fromNode] > 0) connectionCounts[fromNode]--;
        if (connectionCounts[toNode] > 0) connectionCounts[toNode]--;
        if (totalConnections >= 2) totalConnections -= 2;

        nodeRewardDebt[fromNode] = (connectionCounts[fromNode] * rewardPerConnection) / 1e18;
        nodeRewardDebt[toNode] = (connectionCounts[toNode] * rewardPerConnection) / 1e18;

        emit ConnectionDeactivated(fromNode, toNode);
    }

    function cancelConnectionRequest(uint64 fromNode, uint64 toNode) external {
        require(nodes[fromNode] == msg.sender, "Not fromNode owner");
        require(pendingRequests[fromNode][toNode], "No pending request");

        pendingRequests[fromNode][toNode] = false;
        uint256 feePaid = pendingRequestFees[fromNode][toNode];
        pendingRequestFees[fromNode][toNode] = 0;

        (bool success, ) = payable(msg.sender).call{value: feePaid}("");
        require(success, "Refund failed");

        emit ConnectionRequestCancelled(fromNode, toNode);
    }

    function claimRewards(uint64[] calldata nodeKeys) external {
        uint256 totalReward = 0;
        for (uint i = 0; i < nodeKeys.length; i++) {
            uint64 node = nodeKeys[i];
            require(nodes[node] == msg.sender, "Not owner");
            _updateNodeRewards(node);
            uint256 reward = nodePendingRewards[node];
            if (reward > 0) {
                nodePendingRewards[node] = 0;
                totalReward += reward;
                emit RewardsClaimed(node, msg.sender, reward);
            }
        }
            (bool success, ) = payable(msg.sender).call{value: totalReward}("");
            require(success, "Reward transfer failed");
    }
}
