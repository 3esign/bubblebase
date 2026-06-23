export const BUBBLES_CONTRACT_ADDRESS_LOCAL = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
export const BUBBLES_CONTRACT_ADDRESS_MAINNET = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const BUBBLES_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "ConnectionApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "boostMultiplier",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "lastNurturedAt",
        "type": "uint256"
      }
    ],
    "name": "ConnectionBoosted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "ConnectionDeactivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "lastNurturedAt",
        "type": "uint256"
      }
    ],
    "name": "ConnectionNurtured",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "ConnectionRequestCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "ConnectionRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "nodeKey",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "int32",
        "name": "x",
        "type": "int32"
      },
      {
        "indexed": false,
        "internalType": "int32",
        "name": "y",
        "type": "int32"
      }
    ],
    "name": "NodePlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint64",
        "name": "nodeKey",
        "type": "uint64"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "RewardsClaimed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ACTION_FEE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CONNECTION_LIFETIME",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CREATOR",
    "outputs": [
      {
        "internalType": "address payable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CREATOR_FEE_PERCENT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "REWARD_FEE_PERCENT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "approveConnection",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "boostConnection",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "calculateBoostFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "calculateConnectionFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "calculateNurtureFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "cancelConnectionRequest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64[]",
        "name": "nodeKeys",
        "type": "uint64[]"
      }
    ],
    "name": "claimRewards",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "connectionCounts",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "connections",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "lastNurturedAt",
        "type": "uint64"
      },
      {
        "internalType": "uint16",
        "name": "boostMultiplier",
        "type": "uint16"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "deactivateConnection",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "key",
        "type": "uint64"
      }
    ],
    "name": "decodeCoordinate",
    "outputs": [
      {
        "internalType": "int32",
        "name": "x",
        "type": "int32"
      },
      {
        "internalType": "int32",
        "name": "y",
        "type": "int32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "int32",
        "name": "x",
        "type": "int32"
      },
      {
        "internalType": "int32",
        "name": "y",
        "type": "int32"
      }
    ],
    "name": "encodeCoordinate",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "a",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "b",
        "type": "uint64"
      }
    ],
    "name": "getConnKey",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "isConnectionActive",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "nodePendingRewards",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "nodeRewardDebt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "nodes",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "nurtureConnection",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "pendingRequestFees",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "pendingRequests",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "int32",
        "name": "x",
        "type": "int32"
      },
      {
        "internalType": "int32",
        "name": "y",
        "type": "int32"
      }
    ],
    "name": "placeNode",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "fromNode",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "toNode",
        "type": "uint64"
      }
    ],
    "name": "requestConnection",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "rewardPerConnection",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalConnections",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
