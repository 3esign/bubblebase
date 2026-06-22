"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";

import {
  BUBBLES_ABI,
  BUBBLES_CONTRACT_ADDRESS_LOCAL,
  BUBBLES_CONTRACT_ADDRESS_MAINNET,
} from "../constants/contract";
import { encodeCoordinate, decodeCoordinate } from "../utils/coordinates";
import { GameNode, GameConnection } from "../components/GameMap";

// Dynamically import GameMap to avoid SSR issues with PixiJS/Canvas
const GameMap = dynamic(() => import("../components/GameMap"), { ssr: false });

import { AgentDashboard } from "../components/AgentDashboard";
import { useAgentLoop, AgentConfig } from "../hooks/useAgentLoop";

export const MOCK_AGENT_ADDRESSES = [
  "0x111111125434b319222222222222222222222222",
  "0x222222225434b319222222222222222222222222",
  "0x333333335434b319222222222222222222222222",
  "0x444444445434b319222222222222222222222222",
  "0x555555555434b319222222222222222222222222",
  "0x666666665434b319222222222222222222222222"
];

// Mock data generator for Demo Mode (with decayed and boosted connections)
const generateMockData = () => {
  const nodes: GameNode[] = [];
  const connections: GameConnection[] = [];
  const clusterCenters = Array.from({ length: 60 }, () => ({
    x: Math.floor(Math.random() * 80) - 40,
    y: Math.floor(Math.random() * 80) - 40,
  }));

  const ownerAddressMock1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const ownerAddressMock2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const ownerAddressMock3 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  const allAddresses = [
    ownerAddressMock1,
    ownerAddressMock2,
    ownerAddressMock3,
    ...MOCK_AGENT_ADDRESSES
  ];

  clusterCenters.forEach((center, idx) => {
    const numNodes = Math.floor(Math.random() * 8) + 4; // 4 to 11 nodes per cluster (total ~350+ nodes)
    const clusterNodes: GameNode[] = [];

    // Base node for center
    const centerKey = encodeCoordinate(center.x, center.y).toString();
    if (nodes.some((n) => n.id === centerKey)) return;

    // Pick owner from all including agents
    const owner = allAddresses[idx % allAddresses.length];

    const centerNode: GameNode = {
      id: centerKey,
      x: center.x,
      y: center.y,
      owner,
      connectionsCount: 0,
    };
    nodes.push(centerNode);
    clusterNodes.push(centerNode);

    // Nodes around center
    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2;
      const dist = Math.floor(Math.random() * 3) + 1; // 1 to 3 grid distance
      const x = center.x + Math.round(Math.cos(angle) * dist);
      const y = center.y + Math.round(Math.sin(angle) * dist);

      const key = encodeCoordinate(x, y).toString();
      if (nodes.some((n) => n.id === key)) continue;

      const subOwner = allAddresses[Math.floor(Math.random() * allAddresses.length)];

      const node: GameNode = {
        id: key,
        x,
        y,
        owner: subOwner,
        connectionsCount: 0,
      };
      nodes.push(node);
      clusterNodes.push(node);
    }

    // Connect nodes within cluster
    for (let i = 0; i < clusterNodes.length; i++) {
      const fromNode = clusterNodes[i];
      const numConns = Math.floor(Math.random() * 2) + 1;
      for (let j = 0; j < numConns; j++) {
        const targetNode = clusterNodes[Math.floor(Math.random() * clusterNodes.length)];
        if (targetNode.id !== fromNode.id) {
          const exists = connections.some(
            (c) =>
              (c.from === fromNode.id && c.to === targetNode.id) ||
              (c.from === targetNode.id && c.to === fromNode.id)
          );
          if (!exists) {
            connections.push({
              from: fromNode.id,
              to: targetNode.id,
              isPending: false,
              lastNurturedAt: Date.now() / 1000 - Math.random() * 110000, // Some decayed (> 86400s)
              boostMultiplier: Math.random() > 0.6 ? (Math.random() > 0.5 ? 200 : 150) : 100,
            });
            fromNode.connectionsCount++;
            targetNode.connectionsCount++;
          }
        }
      }
    }
  });

  return { nodes, connections };
};

export default function Home() {
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Web3 Hooks
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Contract Address determined by Active Chain
  const contractAddress = useMemo(() => {
    if (chainId === 31337) {
      return BUBBLES_CONTRACT_ADDRESS_LOCAL;
    }
    return BUBBLES_CONTRACT_ADDRESS_MAINNET;
  }, [chainId]);

  // Game States
  const [nodes, setNodes] = useState<GameNode[]>([]);
  const [connections, setConnections] = useState<GameConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  // Map of nodeKey => pending ETH rewards (in wei as bigint, simulated in demo)
  const [pendingNodeRewards, setPendingNodeRewards] = useState<Map<string, bigint>>(new Map());

  // Helper to determine active wallet address (mock or real)
  const activeUserAddress = useMemo(() => {
    if (isDemoMode) {
      return "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // First hardhat account default mock
    }
    return userAddress || null;
  }, [isDemoMode, userAddress]);

  // Ghost coordinate state for placing new node
  const [placementCoords, setPlacementCoords] = useState<{ x: number; y: number } | null>(null);

  // Transaction Pending loader state
  const [pendingTx, setPendingTx] = useState(false);
  const [txMessage, setTxMessage] = useState("");

  // Clock tick trigger state to update decay timers in UI every second
  const [clockTick, setClockTick] = useState(0);

  // About Modal state
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Agent System Config state
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    provider: 'demo',
    apiKey: '',
    model: 'local-heuristic',
    systemPrompt: `You are BubbleBase's automated L2 network agent.
Your objective is to maximize resource yield and connect nodes effectively.
Rules:
- Place nodes to secure strategic positions next to other player hubs.
- Nurture connections whose timers have decayed or are close to 0h remaining.
- Boost high-density links to overclock data yields when connection count is large.
- Hold when network is stable to preserve delegate funds.`,
    strategy: 'expansionist',
    risk: 50,
    frequency: 10,
  });

  // Callbacks for useAgentLoop
  const agentPlaceNode = async (x: number, y: number) => {
    const key = encodeCoordinate(x, y).toString();
    if (isDemoMode) {
      const newNode: GameNode = {
        id: key,
        x,
        y,
        owner: activeUserAddress!,
        connectionsCount: 0,
      };
      setNodes((prev) => [...prev, newNode]);
      return true;
    } else {
      if (!isConnected) return false;
      try {
        setTxMessage("[Agent Action] Placing Node...");
        setPendingTx(true);
        const tx = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "placeNode",
          args: [x, y],
          value: parseEther("0.00001"),
        });
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const agentNurtureConnection = async (fromId: string, toId: string) => {
    if (isDemoMode) {
      setConnections((prev) =>
        prev.map((c) =>
          (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
            ? { ...c, lastNurturedAt: Math.floor(Date.now() / 1000) }
            : c
        )
      );
      return true;
    } else {
      if (!isConnected || !publicClient) return false;
      try {
        setTxMessage("[Agent Action] Nurturing Link...");
        setPendingTx(true);
        const fee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateNurtureFee",
          args: [BigInt(fromId), BigInt(toId)],
        }) as bigint;

        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "nurtureConnection",
          args: [BigInt(fromId), BigInt(toId)],
          value: fee,
        });
        setTimeout(() => loadLiveChainData(), 1500);
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const agentBoostConnection = async (fromId: string, toId: string) => {
    if (isDemoMode) {
      setConnections((prev) =>
        prev.map((c) =>
          (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
            ? {
                ...c,
                lastNurturedAt: Math.floor(Date.now() / 1000),
                boostMultiplier: Math.min((c.boostMultiplier || 100) + 50, 300),
              }
            : c
        )
      );
      return true;
    } else {
      if (!isConnected || !publicClient) return false;
      try {
        setTxMessage("[Agent Action] Boosting Link...");
        setPendingTx(true);
        const fee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateBoostFee",
          args: [BigInt(fromId), BigInt(toId)],
        }) as bigint;

        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "boostConnection",
          args: [BigInt(fromId), BigInt(toId)],
          value: fee,
        });
        setTimeout(() => loadLiveChainData(), 1500);
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const agentRequestConnection = async (fromId: string, toId: string) => {
    if (isDemoMode) {
      setConnections((prev) => [
        ...prev,
        {
          from: fromId,
          to: toId,
          isPending: true,
          lastNurturedAt: Math.floor(Date.now() / 1000),
          boostMultiplier: 100,
        },
      ]);
      return true;
    } else {
      if (!isConnected || !publicClient) return false;
      try {
        setTxMessage("[Agent Action] Estimating connection fee...");
        setPendingTx(true);
        const requiredFee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateConnectionFee",
          args: [BigInt(fromId), BigInt(toId)],
        }) as bigint;

        setTxMessage("[Agent Action] Requesting connection...");
        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "requestConnection",
          args: [BigInt(fromId), BigInt(toId)],
          value: requiredFee,
        });
        setTimeout(() => loadLiveChainData(), 1500);
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  // Instantiate useAgentLoop hook
  const {
    isRunning: agentIsRunning,
    startAgent,
    stopAgent,
    budget: agentBudget,
    setBudget: setAgentBudget,
    spent: agentSpent,
    setSpent: setAgentSpent,
    logs: agentLogs,
    clearLogs: clearAgentLogs,
    agentNodeIds,
    setAgentNodeIds,
  } = useAgentLoop({
    nodes,
    connections,
    walletAddress: activeUserAddress || "",
    executePlaceNode: agentPlaceNode,
    executeRequestConnection: agentRequestConnection,
    executeNurtureConnection: agentNurtureConnection,
    executeBoostConnection: agentBoostConnection,
    config: agentConfig,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Initial Data (Demo or Live Chain)
  useEffect(() => {
    setSelectedNodeId(null);
    setTargetNodeId(null);
    setPlacementCoords(null);

    if (isDemoMode) {
      const mockData = generateMockData();
      setNodes(mockData.nodes);
      setConnections(mockData.connections);
      
      // Auto-assign some nodes to agentNodeIds in demo mode
      const ids = new Set<string>();
      mockData.nodes.forEach((n) => {
        if (MOCK_AGENT_ADDRESSES.includes(n.owner)) {
          ids.add(n.id);
        }
      });
      setAgentNodeIds(ids);
    } else {
      loadLiveChainData();
    }
  }, [isDemoMode, contractAddress]);

  // Load and Index historical events directly in frontend, with on-chain connection enrichment
  const loadLiveChainData = async () => {
    if (!publicClient) return;
    try {
      setTxMessage("Querying smart contract events...");
      setPendingTx(true);

      const [placedLogs, requestedLogs, approvedLogs] = await Promise.all([
        publicClient.getContractEvents({
          address: contractAddress,
          abi: BUBBLES_ABI,
          eventName: "NodePlaced",
          fromBlock: 0n,
        }),
        publicClient.getContractEvents({
          address: contractAddress,
          abi: BUBBLES_ABI,
          eventName: "ConnectionRequested",
          fromBlock: 0n,
        }),
        publicClient.getContractEvents({
          address: contractAddress,
          abi: BUBBLES_ABI,
          eventName: "ConnectionApproved",
          fromBlock: 0n,
        }),
      ]);

      const loadedNodes: GameNode[] = [];
      const loadedConns: GameConnection[] = [];
      const nodeMap = new Map<string, GameNode>();

      // 1. Process Node Placement
      placedLogs.forEach((log) => {
        const { nodeKey, owner, x, y } = log.args;
        if (nodeKey && owner && x !== undefined && y !== undefined) {
          const nodeId = nodeKey.toString();
          const node: GameNode = {
            id: nodeId,
            x,
            y,
            owner,
            connectionsCount: 0,
          };
          nodeMap.set(nodeId, node);
          loadedNodes.push(node);
        }
      });

      // 2. Process Connection Requests
      requestedLogs.forEach((log) => {
        const { fromNode, toNode } = log.args;
        if (fromNode && toNode) {
          loadedConns.push({
            from: fromNode.toString(),
            to: toNode.toString(),
            isPending: true,
          });
        }
      });

      // 3. Process Connection Approvals
      approvedLogs.forEach((log) => {
        const { fromNode, toNode } = log.args;
        if (fromNode && toNode) {
          const fromId = fromNode.toString();
          const toId = toNode.toString();

          const conn = loadedConns.find(
            (c) => c.from === fromId && c.to === toId
          );
          if (conn) {
            conn.isPending = false;
          } else {
            loadedConns.push({
              from: fromId,
              to: toId,
              isPending: false,
            });
          }

          const fromNodeObj = nodeMap.get(fromId);
          const toNodeObj = nodeMap.get(toId);
          if (fromNodeObj) fromNodeObj.connectionsCount++;
          if (toNodeObj) toNodeObj.connectionsCount++;
        }
      });

      // 4. Enrich approved connections with real-time on-chain Nurture/Boost states
      setTxMessage("Syncing decay states from Base...");
      
      const enrichmentPromises = loadedConns.map(async (conn) => {
        if (conn.isPending) {
          return conn;
        }
        try {
          const key = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: BUBBLES_ABI,
            functionName: "getConnKey",
            args: [BigInt(conn.from), BigInt(conn.to)],
          });
          const connState = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: BUBBLES_ABI,
            functionName: "connections",
            args: [key],
          }) as unknown as [bigint, number, boolean];

          return {
            ...conn,
            lastNurturedAt: Number(connState[0]),
            boostMultiplier: Number(connState[1]),
          };
        } catch (e) {
          console.error("Error reading connection details", e);
          return conn;
        }
      });
      
      const enrichedConns = await Promise.all(enrichmentPromises);

      // 5. Fetch Pending Rewards for user nodes
      if (activeUserAddress) {
        const userNodeIds = loadedNodes.filter(n => n.owner.toLowerCase() === activeUserAddress.toLowerCase()).map(n => n.id);
        const rewardPromises = userNodeIds.map(async (nodeId) => {
          try {
            const reward = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: BUBBLES_ABI,
              functionName: "nodePendingRewards",
              args: [BigInt(nodeId)]
            }) as bigint;
            return { nodeId, reward };
          } catch (e) {
            return { nodeId, reward: 0n };
          }
        });
        const rewards = await Promise.all(rewardPromises);
        const newRewardMap = new Map<string, bigint>();
        rewards.forEach(r => newRewardMap.set(r.nodeId, r.reward));
        setPendingNodeRewards(newRewardMap);
      }

      setNodes(loadedNodes);
      setConnections(enrichedConns);
    } catch (e) {
      console.error("Error loading on-chain data:", e);
    } finally {
      setPendingTx(false);
      setTxMessage("");
    }
  };

  // Real-time Chain Event Watcher
  useEffect(() => {
    if (isDemoMode || !publicClient) return;

    const unwatchPlaced = publicClient.watchContractEvent({
      address: contractAddress,
      abi: BUBBLES_ABI,
      eventName: "NodePlaced",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const { nodeKey, owner, x, y } = log.args;
          if (nodeKey && owner && x !== undefined && y !== undefined) {
            const nodeId = nodeKey.toString();
            setNodes((prev) => {
              if (prev.some((n) => n.id === nodeId)) return prev;
              return [...prev, { id: nodeId, x, y, owner, connectionsCount: 0 }];
            });
          }
        });
      },
    });

    const unwatchRequested = publicClient.watchContractEvent({
      address: contractAddress,
      abi: BUBBLES_ABI,
      eventName: "ConnectionRequested",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const { fromNode, toNode } = log.args;
          if (fromNode && toNode) {
            const fromId = fromNode.toString();
            const toId = toNode.toString();
            setConnections((prev) => {
              if (prev.some((c) => c.from === fromId && c.to === toId)) return prev;
              return [...prev, { from: fromId, to: toId, isPending: true }];
            });
          }
        });
      },
    });

    const unwatchApproved = publicClient.watchContractEvent({
      address: contractAddress,
      abi: BUBBLES_ABI,
      eventName: "ConnectionApproved",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const { fromNode, toNode } = log.args;
          if (fromNode && toNode) {
            const fromId = fromNode.toString();
            const toId = toNode.toString();
            setConnections((prev) =>
              prev.map((c) =>
                c.from === fromId && c.to === toId
                  ? { ...c, isPending: false, lastNurturedAt: Math.floor(Date.now() / 1000), boostMultiplier: 100 }
                  : c
              )
            );
            setNodes((prev) =>
              prev.map((n) =>
                n.id === fromId || n.id === toId
                  ? { ...n, connectionsCount: n.connectionsCount + 1 }
                  : n
              )
            );
          }
        });
      },
    });

    return () => {
      unwatchPlaced();
      unwatchRequested();
      unwatchApproved();
    };
  }, [isDemoMode, publicClient, contractAddress]);

  // Selected & Target Node objects mapping
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const targetNode = useMemo(() => {
    return nodes.find((n) => n.id === targetNodeId) || null;
  }, [nodes, targetNodeId]);

  // Pending Incoming Connection Requests to the selected node
  const pendingRequestsToSelected = useMemo(() => {
    if (!selectedNodeId) return [];
    return connections.filter((c) => c.to === selectedNodeId && c.isPending);
  }, [connections, selectedNodeId]);

  // All active (approved) connections for the selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    return connections.filter(
      (c) => (c.from === selectedNodeId || c.to === selectedNodeId) && !c.isPending
    );
  }, [connections, selectedNodeId]);

  // Actions
  const handleResetGrid = (empty: boolean) => {
    setNodes([]);
    setConnections([]);
    setSelectedNodeId(null);
    setTargetNodeId(null);
    setPlacementCoords(null);
    setAgentNodeIds(new Set());
    setAgentSpent(0);
  };

  const handlePlaceNode = async (x: number, y: number) => {
    setPlacementCoords({ x, y });
    setSelectedNodeId(null);
    setTargetNodeId(null);
  };

  const executePlaceNode = async () => {
    if (!placementCoords) return;
    const { x, y } = placementCoords;
    const key = encodeCoordinate(x, y).toString();

    if (isDemoMode) {
      const newNode: GameNode = {
        id: key,
        x,
        y,
        owner: activeUserAddress!,
        connectionsCount: 0,
      };
      setNodes((prev) => [...prev, newNode]);
      setPlacementCoords(null);
    } else {
      if (!isConnected) return;
      try {
        setTxMessage("Confirm transaction to place Node...");
        setPendingTx(true);
        const tx = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "placeNode",
          args: [x, y],
          value: parseEther("0.00001"), // 10x cheaper base placement fee
        });
        setTxMessage("Mining transaction...");
        setPlacementCoords(null);
      } catch (e) {
        console.error(e);
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const handleSelectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setTargetNodeId(nodeId ? targetNodeId : null);
    setPlacementCoords(null);
  };

  const handleConnectNodes = (fromId: string, toId: string) => {
    setTargetNodeId(toId);
    setPlacementCoords(null);
  };

  // Upgraded: 10x cheaper transaction fee logic
  const calculateDynamicFee = (fromNode: GameNode, toNode: GameNode) => {
    const baseFee = 0.00001; // ~3 cents base L2 gas cost equivalence
    let connPremium = 0;
    if (toNode.connectionsCount > fromNode.connectionsCount) {
      connPremium = (toNode.connectionsCount - fromNode.connectionsCount) * 0.000005; // scaled down disparity
    }
    const distance = Math.abs(toNode.x - fromNode.x) + Math.abs(toNode.y - fromNode.y);
    const distPremium = distance * 0.000001; // scaled down distance premium
    return {
      total: baseFee + connPremium + distPremium,
      baseFee,
      connPremium,
      distPremium,
      distance,
    };
  };

  const executeRequestConnection = async () => {
    if (!selectedNodeId || !targetNodeId) return;

    const fromNode = nodes.find((n) => n.id === selectedNodeId);
    const toNode = nodes.find((n) => n.id === targetNodeId);
    if (!fromNode || !toNode) return;

    if (isDemoMode) {
      setConnections((prev) => [
        ...prev,
        {
          from: selectedNodeId,
          to: targetNodeId,
          isPending: true,
          lastNurturedAt: Math.floor(Date.now() / 1000),
          boostMultiplier: 100,
        },
      ]);
      setTargetNodeId(null);
    } else {
      if (!isConnected || !publicClient) return;
      try {
        setTxMessage("Estimating connection fee...");
        setPendingTx(true);
        const requiredFee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateConnectionFee",
          args: [BigInt(selectedNodeId), BigInt(targetNodeId)],
        }) as bigint;

        setTxMessage("Confirm transaction to request connection...");
        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "requestConnection",
          args: [BigInt(selectedNodeId), BigInt(targetNodeId)],
          value: requiredFee,
        });
        setTargetNodeId(null);
      } catch (e) {
        console.error(e);
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const executeApproveConnection = async (fromId: string) => {
    if (!selectedNodeId) return;

    if (isDemoMode) {
      setConnections((prev) =>
        prev.map((c) =>
          c.from === fromId && c.to === selectedNodeId
            ? { ...c, isPending: false, lastNurturedAt: Math.floor(Date.now() / 1000), boostMultiplier: 100 }
            : c
        )
      );
      setNodes((prev) =>
        prev.map((n) =>
          n.id === fromId || n.id === selectedNodeId
            ? { ...n, connectionsCount: n.connectionsCount + 1 }
            : n
        )
      );
    } else {
      if (!isConnected) return;
      try {
        setTxMessage("Confirm transaction to approve connection...");
        setPendingTx(true);
        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "approveConnection",
          args: [BigInt(fromId), BigInt(selectedNodeId)],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const executeNurtureConnection = async (fromId: string, toId: string) => {
    if (isDemoMode) {
      setConnections((prev) =>
        prev.map((c) =>
          (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
            ? { ...c, lastNurturedAt: Math.floor(Date.now() / 1000) }
            : c
        )
      );
    } else {
      if (!isConnected || !publicClient) return;
      try {
        setTxMessage("Estimating nurture fee...");
        setPendingTx(true);

        const fee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateNurtureFee",
          args: [BigInt(fromId), BigInt(toId)],
        }) as bigint;

        setTxMessage("Confirm transaction to nurture connection...");
        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "nurtureConnection",
          args: [BigInt(fromId), BigInt(toId)],
          value: fee,
        });

        // Trigger manual refresh
        setTimeout(() => loadLiveChainData(), 1500);
      } catch (e) {
        console.error("Nurturing failed:", e);
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const executeBoostConnection = async (fromId: string, toId: string) => {
    if (isDemoMode) {
      setConnections((prev) =>
        prev.map((c) =>
          (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
            ? {
                ...c,
                lastNurturedAt: Math.floor(Date.now() / 1000),
                boostMultiplier: Math.min((c.boostMultiplier || 100) + 50, 300),
              }
            : c
        )
      );
    } else {
      if (!isConnected || !publicClient) return;
      try {
        setTxMessage("Estimating boost fee...");
        setPendingTx(true);

        const fee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "calculateBoostFee",
          args: [BigInt(fromId), BigInt(toId)],
        }) as bigint;

        setTxMessage("Confirm transaction to boost connection...");
        await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: BUBBLES_ABI,
          functionName: "boostConnection",
          args: [BigInt(fromId), BigInt(toId)],
          value: fee,
        });

        // Trigger manual refresh
        setTimeout(() => loadLiveChainData(), 1500);
      } catch (e) {
        console.error("Boosting failed:", e);
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  };

  const executeClaimRewards = async (nodeKeys: string[]) => {
    if (isDemoMode) {
      // Simulate clearing pending rewards in demo
      setPendingNodeRewards((prev) => {
        const next = new Map(prev);
        nodeKeys.forEach((k) => next.delete(k));
        return next;
      });
      return;
    }
    if (!isConnected) return;
    try {
      setTxMessage("Claiming rewards from all nodes...");
      setPendingTx(true);
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: BUBBLES_ABI,
        functionName: "claimRewards",
        args: [nodeKeys.map(BigInt)],
      });
      // After claim, refresh chain data
      setTimeout(() => loadLiveChainData(), 1500);
    } catch (e) {
      console.error("Claim failed:", e);
    } finally {
      setPendingTx(false);
      setTxMessage("");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <main className="w-full h-screen relative overflow-hidden bg-[#050511] select-none text-white">
      {/* Mainnet Lock Screen */}
      {!isDemoMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center p-8 bg-[#050511] border border-purple-500/50 rounded-2xl shadow-2xl max-w-lg z-50">
            <h2 className="text-3xl font-bold text-white mb-4 neon-text-blue">Mainnet Locked</h2>
            <p className="text-gray-400 mb-6 leading-relaxed">
              The Live Mainnet version of BubbleBase is currently locked while we upgrade the grid infrastructure. Please switch to Demo Mode to experience the autonomous agent simulations and heuristic networking!
            </p>
            <button onClick={() => setIsDemoMode(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              Switch to Demo Mode
            </button>
          </div>
        </div>
      )}

      {/* 2.5D Interactive Canvas */}
      <GameMap
        isDemoMode={isDemoMode}
        nodes={nodes}
        connections={connections}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        userAddress={activeUserAddress}
        onPlaceNode={handlePlaceNode}
        onConnectNodes={handleConnectNodes}
        pendingTx={pendingTx}
        agentNodeIds={agentNodeIds}
      />

      {/* Top Header & Settings Menu */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        {/* Brand */}
        <div className="flex flex-col gap-1 pointer-events-auto bg-[#050511]/45 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 neon-text-blue">
            BUBBLES
          </h1>
          <p className="text-xs text-blue-200/50 uppercase tracking-widest font-semibold">
            Base L2 Civilization Game
          </p>
          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 w-fit">
            🚧 UNDER CONSTRUCTION
          </div>
        </div>

        {/* Action Controls & Wallet Connect */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto z-50">
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl">
            <a href="https://github.com/3esign/bubblebase" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm font-semibold flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </a>
            <div className="w-px h-4 bg-white/20"></div>
            <button onClick={() => setShowAboutModal(true)} className="text-gray-400 hover:text-white transition-colors text-sm font-semibold">
              About
            </button>
            <div className="w-px h-4 bg-white/20"></div>
            <button
              onClick={() => setIsDemoMode(true)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                isDemoMode
                  ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Demo Mode
            </button>
            <button
              onClick={() => setIsDemoMode(false)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                !isDemoMode
                  ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Live Network
            </button>
          </div>

          {!isDemoMode && (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl">
              <button disabled className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 cursor-not-allowed bg-white/5">
                Wallet Disabled (Construction)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal (Bottom Left) */}
      <div className="absolute bottom-6 left-6 w-80 flex flex-col gap-4 pointer-events-auto">
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
          <h3 className="text-sm font-bold text-blue-400 tracking-wide uppercase">
            Map Controls
          </h3>
          <ul className="text-xs space-y-2 text-white/70">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Drag background to pan view.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Scroll wheel to zoom.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Click empty grid coordinate to place Node.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Select your node, then click another to connect.
            </li>
          </ul>
          <div className="h-px bg-white/10 my-1"></div>
          <div className="flex flex-col gap-1 text-[10px] text-white/50">
            <div className="flex justify-between">
              <span>Node Cost:</span>
              <span className="text-white font-semibold">0.00001 ETH (~$0.03)</span>
            </div>
            <div className="flex justify-between">
              <span>Approval Reward:</span>
              <span className="text-emerald-400 font-semibold">Pool share (by connections)</span>
            </div>
            <div className="flex justify-between">
              <span>Connection Decay:</span>
              <span className="text-orange-400 font-semibold">24 hour lifetime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interaction Card (Right Sidebar) */}
      <div className="absolute top-32 right-6 w-96 flex flex-col gap-4 pointer-events-auto max-h-[80vh] overflow-y-auto pr-1">
        {/* Loader Modal for transactions */}
        {pendingTx && (
          <div className="glass-panel p-5 rounded-2xl flex flex-col items-center gap-4 text-center border-orange-500/30">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
                Transaction Pending
              </span>
              <span className="text-xs text-white/60">{txMessage}</span>
            </div>
          </div>
        )}

        {/* Selected Node Details Card */}
        {selectedNode && (
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-xs text-white/40 uppercase tracking-widest">
                  Selected Node
                </span>
                <span className="text-lg font-bold text-white tracking-tight">
                  Coordinate ({selectedNode.x}, {selectedNode.y})
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase()
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                }`}
              >
                {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase()
                  ? "You"
                  : "Other Player"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Owner Address</span>
                <span className="font-mono text-white/80">
                  {formatAddress(selectedNode.owner)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Connections</span>
                <span className="font-bold text-white">
                  {selectedNode.connectionsCount}
                </span>
              </div>
              {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() && (() => {
                const pendingWei = pendingNodeRewards.get(selectedNode.id) ?? 0n;
                const pendingEth = Number(pendingWei) / 1e18;
                return (
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/10">
                    <div className="flex flex-col">
                      <span className="text-white/50">Unclaimed Rewards</span>
                      <span className="text-[10px] text-white/30">Pool share by connections</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${ pendingEth > 0 ? 'text-yellow-300' : 'text-white/40'}`}>
                        {pendingEth > 0 ? `${pendingEth.toFixed(6)} ETH` : '—'}
                      </span>
                      {pendingEth > 0 && (
                        <button
                          onClick={() => executeClaimRewards([selectedNode.id])}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 transition-all"
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* If player clicked their own node, show target node connection prompt */}
            {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() &&
              targetNode && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-white/40 uppercase">
                      Requesting connection to:
                    </span>
                    <span className="text-xs font-bold">
                      Node ({targetNode.x}, {targetNode.y})
                    </span>
                    <span className="text-[10px] text-white/60">
                      Owner: {formatAddress(targetNode.owner)}
                    </span>
                    {(() => {
                      const feeInfo = calculateDynamicFee(selectedNode, targetNode);
                      const expectedReward = feeInfo.total * 0.50;
                      return (
                        <div className="mt-2 text-[10px] text-white/50 flex flex-col gap-0.5 border-t border-white/5 pt-2">
                          <div className="flex justify-between">
                            <span>Base Fee:</span>
                            <span>{feeInfo.baseFee.toFixed(6)} ETH</span>
                          </div>
                          {feeInfo.distPremium > 0 && (
                            <div className="flex justify-between text-blue-300">
                              <span>Distance Premium (x{feeInfo.distance}):</span>
                              <span>+{feeInfo.distPremium.toFixed(6)} ETH</span>
                            </div>
                          )}
                          {feeInfo.connPremium > 0 && (
                            <div className="flex justify-between text-emerald-300">
                              <span>Popularity Disparity Premium:</span>
                              <span>+{feeInfo.connPremium.toFixed(6)} ETH</span>
                            </div>
                          )}
                          <div className="flex justify-between text-white font-bold mt-1 border-t border-white/10 pt-1 text-xs">
                            <span>Total Connection Cost:</span>
                            <span className="text-blue-400">{feeInfo.total.toFixed(6)} ETH</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-semibold mt-0.5">
                            <span>Reward Pool Contribution:</span>
                            <span>+{expectedReward.toFixed(6)} ETH (50% → pool)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={executeRequestConnection}
                    className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button glass-button-primary"
                  >
                    Request Link
                  </button>
                </div>
              )}

            {/* List and Approve Pending Incoming Requests */}
            {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() &&
              pendingRequestsToSelected.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                  <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                    Incoming Request Links
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {pendingRequestsToSelected.map((req) => {
                      const fromNodeObj = nodes.find((n) => n.id === req.from);
                      if (!fromNodeObj) return null;
                      return (
                        <div
                          key={req.from}
                          className="bg-white/5 border border-white/5 p-3 rounded-xl flex justify-between items-center"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white/80">
                              Node ({fromNodeObj.x}, {fromNodeObj.y})
                            </span>
                            <span className="text-[10px] text-white/40">
                              {formatAddress(fromNodeObj.owner)}
                            </span>
                          </div>
                          <button
                            onClick={() => executeApproveConnection(req.from)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider glass-button glass-button-success"
                          >
                            Approve (+50% Fee)
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* UPGRADE: Nurture and Boost connection controls in the details panel */}
            {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() &&
              selectedNodeConnections.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                  <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                    Active Connections
                  </span>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {selectedNodeConnections.map((conn) => {
                      const otherNodeId = conn.from === selectedNodeId ? conn.to : conn.from;
                      const otherNode = nodes.find((n) => n.id === otherNodeId);
                      if (!otherNode) return null;

                      const lastNurtured = conn.lastNurturedAt || 0;
                      const expiryTime = lastNurtured + 86400; // 1 day
                      const timeLeft = expiryTime - Date.now() / 1000;
                      const isDecayed = timeLeft <= 0;

                      const distance = Math.abs(otherNode.x - selectedNode.x) + Math.abs(otherNode.y - selectedNode.y);
                      const nurtureCost = 0.000002 + distance * 0.0000002;
                      const boostCost = 0.000005 + distance * 0.0000005;

                      return (
                        <div
                          key={otherNodeId}
                          className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                            isDecayed
                              ? "bg-red-950/20 border-red-500/20"
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-white/80">
                                Node ({otherNode.x}, {otherNode.y})
                              </span>
                              <span className="text-[10px] text-white/40">
                                Distance: {distance} cells • Multiplier: {((conn.boostMultiplier || 100) / 100).toFixed(1)}x
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                isDecayed
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              {isDecayed ? "Decayed" : "Active"}
                            </span>
                          </div>

                          <div className="text-[10px] text-white/60">
                            {isDecayed ? (
                              <span className="text-red-400 font-medium">Inactive: nurture to restore data stream flow</span>
                            ) : (
                              <span>
                                Expiry: {Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m {Math.floor(timeLeft % 60)}s
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => executeNurtureConnection(conn.from, conn.to)}
                              className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider glass-button glass-button-success"
                            >
                              Nurture ({nurtureCost.toFixed(6)} ETH)
                            </button>
                            {(conn.boostMultiplier || 100) < 300 && (
                              <button
                                onClick={() => executeBoostConnection(conn.from, conn.to)}
                                className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider glass-button glass-button-primary"
                              >
                                Boost ({boostCost.toFixed(6)} ETH)
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Placing Node Modal */}
        {placementCoords && (
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border-emerald-500/30">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-bold">
                Place New Node
              </span>
              <span className="text-lg font-bold text-white tracking-tight">
                Coordinate ({placementCoords.x}, {placementCoords.y})
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              Placing a node secures your territory. Once placed, other players can pay you to connect to it.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPlacementCoords(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button"
              >
                Cancel
              </button>
              <button
                onClick={executePlaceNode}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button glass-button-success"
              >
                Confirm (0.00001 ETH)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Agent Dashboard Glassmorphism Panel */}
      <AgentDashboard
        isRunning={agentIsRunning}
        startAgent={startAgent}
        stopAgent={stopAgent}
        budget={agentBudget}
        setBudget={setAgentBudget}
        spent={agentSpent}
        logs={agentLogs}
        clearLogs={clearAgentLogs}
        config={agentConfig}
        setConfig={setAgentConfig}
        onResetGrid={handleResetGrid}
      />

      {/* Network Stats Overlay (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex gap-6 pointer-events-auto">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-blue-200/50 uppercase tracking-wider font-semibold">
              Total Nodes
            </span>
            <span className="text-sm font-extrabold text-white">
              {nodes.length}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-emerald-200/50 uppercase tracking-wider font-semibold">
              Connections
            </span>
            <span className="text-sm font-extrabold text-white">
              {connections.filter((c) => !c.isPending).length}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-purple-300/60 uppercase tracking-wider font-semibold">
              Rewards 24h
            </span>
            <span className="text-sm font-extrabold text-[#c084fc]">
              {(connections.filter(c => !c.isPending).reduce((acc, c) => acc + (c.boostMultiplier || 100) * 0.00001, 0.024)).toFixed(4)} ETH
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-pink-300/60 uppercase tracking-wider font-semibold">
              Nodes 24h
            </span>
            <span className="text-sm font-extrabold text-pink-400">
              {Math.floor(nodes.length * 0.08) + agentNodeIds.size}
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 my-auto"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-yellow-300/60 uppercase tracking-wider font-semibold">
              Agents Active
            </span>
            <span className="text-sm font-extrabold text-yellow-400">
              {MOCK_AGENT_ADDRESSES.length + (agentIsRunning ? 1 : 0)}
            </span>
          </div>
          {/* Claim All Rewards button — only shown when user has rewards */}
          {(() => {
            const myNodeKeys = nodes
              .filter((n) => n.owner.toLowerCase() === activeUserAddress?.toLowerCase())
              .map((n) => n.id);
            const totalPending = myNodeKeys.reduce((acc, k) => acc + (pendingNodeRewards.get(k) ?? 0n), 0n);
            const totalEth = Number(totalPending) / 1e18;
            if (totalEth <= 0) return null;
            return (
              <>
                <div className="h-6 w-px bg-white/10 my-auto"></div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-yellow-200/70 uppercase tracking-wider font-semibold">
                    My Rewards
                  </span>
                  <button
                    onClick={() => executeClaimRewards(myNodeKeys)}
                    className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-yellow-500/25 text-yellow-300 border border-yellow-400/40 hover:bg-yellow-500/40 transition-all shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                  >
                    Claim {totalEth.toFixed(6)} ETH
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Agent Dashboard Overlay */}
      {isDemoMode && (
        <AgentDashboard
          isRunning={agentIsRunning}
          startAgent={startAgent}
          stopAgent={stopAgent}
          budget={agentBudget}
          setBudget={setAgentBudget}
          spent={agentSpent}
          logs={agentLogs}
          clearLogs={clearAgentLogs}
          config={agentConfig}
          setConfig={setAgentConfig}
          onResetGrid={(empty) => {
            if (empty) {
              setNodes([]);
              setConnections([]);
              setAgentNodeIds(new Set());
            } else {
              const mockData = generateMockData();
              setNodes(mockData.nodes);
              setConnections(mockData.connections);
              const ids = new Set<string>();
              mockData.nodes.forEach((n) => {
                if (MOCK_AGENT_ADDRESSES.includes(n.owner)) {
                  ids.add(n.id);
                }
              });
              setAgentNodeIds(ids);
            }
          }}
        />
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#050511] border border-purple-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">About BubbleBase</h2>
              <button onClick={() => setShowAboutModal(false)} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
            </div>
            <div className="text-gray-300 space-y-4 text-sm leading-relaxed">
              <p>
                <strong>BubbleBase</strong> is an isometric, decentralized civilization game built directly on the Base L2 Ethereum network. In this dystopian, cyberpunk world, raw coordinate grid space is real estate, and survival depends on data bandwidth and network connectivity.
              </p>
              <h3 className="text-lg font-bold text-purple-400 mt-6">Gameplay Mechanics</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Place Nodes:</strong> Deploy a basic infrastructure Node (Pylon). This registers your node permanently on-chain.</li>
                <li><strong>Forge Connections:</strong> Request connections to other players' nodes. As your node accumulates links, it transforms from a humble Pylon into a towering Citadel.</li>
                <li><strong>Earn Passive Yield:</strong> Every time another player connects nearby, nurtures a link, or boosts their network speed, they pay fees into a global reward pool. You can claim your accumulated ETH yield.</li>
                <li><strong>Prevent Grid Decay:</strong> Connections suffer from entropy and decay after 24 hours. Reset the timer by Nurturing the link, or Boost it to overclock your throughput.</li>
              </ul>
              <h3 className="text-lg font-bold text-blue-400 mt-6">Autonomous Agents</h3>
              <p>
                Delegate your grid operations to an AI. Choose a strategy (Expansionist, Defensive, etc.) and a provider (OpenAI, Anthropic, Gemini, Ollama, or Local Heuristic). The agent will evaluate the game state, analyze its surroundings, and autonomously place nodes and maintain your connections based on a predetermined budget.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
