import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { parseEther } from "viem";

import {
  BUBBLES_ABI,
  BUBBLES_CONTRACT_ADDRESS_LOCAL,
  BUBBLES_CONTRACT_ADDRESS_MAINNET,
} from "../constants/contract";
import { encodeCoordinate } from "../utils/coordinates";
import { GameNode, GameConnection } from "../components/GameMap";

export function useBubblesGame(appMode: "demo" | "simulation" | "live") {
  const isLocalMode = appMode !== "live";
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
  const [pendingNodeRewards, setPendingNodeRewards] = useState<Map<string, bigint>>(new Map());
  const [placementCoords, setPlacementCoords] = useState<{ x: number; y: number } | null>(null);
  const [pendingTx, setPendingTx] = useState(false);
  const [txMessage, setTxMessage] = useState("");
  const [clockTick, setClockTick] = useState(0);

  // Helper to determine active wallet address (mock or real)
  const activeUserAddress = useMemo(() => {
    if (isLocalMode) {
      return "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // First hardhat account default mock
    }
    return userAddress || null;
  }, [isLocalMode, userAddress]);

  // Clock tick trigger state to update decay timers in UI every second
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isLiveChainReady = useMemo(() => {
    return (
      !isLocalMode &&
      isConnected &&
      contractAddress !== "0x0000000000000000000000000000000000000000"
    );
  }, [isLocalMode, isConnected, contractAddress]);

  const loadLiveChainData = useCallback(async () => {
    if (!publicClient || !isConnected) return;
    if (contractAddress === "0x0000000000000000000000000000000000000000") return;
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
          } catch {
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
  }, [publicClient, contractAddress, activeUserAddress, isConnected]);

  // Reset grid when switching modes — demo/simulation are filled separately in page.tsx
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedNodeId(null);
      setTargetNodeId(null);
      setPlacementCoords(null);
      setNodes([]);
      setConnections([]);
      setPendingNodeRewards(new Map());
    }, 0);
    return () => clearTimeout(timer);
  }, [appMode]);

  // Sync from chain only when wallet is connected to a deployed contract
  useEffect(() => {
    if (isLiveChainReady) {
      const timer = setTimeout(() => {
        loadLiveChainData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isLiveChainReady, contractAddress, loadLiveChainData]);

  // Real-time chain event watcher (live mode with connected wallet only)
  useEffect(() => {
    if (!isLiveChainReady || !publicClient) return;

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
  }, [isLiveChainReady, publicClient, contractAddress]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const targetNode = useMemo(() => {
    return nodes.find((n) => n.id === targetNodeId) || null;
  }, [nodes, targetNodeId]);

  const pendingRequestsToSelected = useMemo(() => {
    if (!selectedNodeId) return [];
    return connections.filter((c) => c.to === selectedNodeId && c.isPending);
  }, [connections, selectedNodeId]);

  const selectedNodeConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    return connections.filter(
      (c) => (c.from === selectedNodeId || c.to === selectedNodeId) && !c.isPending
    );
  }, [connections, selectedNodeId]);

  // Actions
  const handleResetGrid = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setPendingNodeRewards(new Map());
    setSelectedNodeId(null);
    setTargetNodeId(null);
    setPlacementCoords(null);
  }, []);

  const handlePlaceNodeCoords = useCallback(async (x: number, y: number) => {
    setPlacementCoords({ x, y });
    setSelectedNodeId(null);
    setTargetNodeId(null);
  }, []);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setTargetNodeId((prev) => (nodeId ? prev : null));
    setPlacementCoords(null);
  }, []);

  const handleConnectNodes = useCallback((fromId: string, toId: string) => {
    setTargetNodeId(toId);
    setPlacementCoords(null);
  }, []);

  const calculateDynamicFee = useCallback((fromNode: GameNode, toNode: GameNode) => {
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
  }, []);

  const executePlaceNode = useCallback(async () => {
    if (!placementCoords) return;
    const { x, y } = placementCoords;
    const key = encodeCoordinate(x, y).toString();

    if (isLocalMode) {
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
        await writeContractAsync({
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
  }, [placementCoords, isLocalMode, activeUserAddress, isConnected, contractAddress, writeContractAsync]);

  const executeRequestConnection = useCallback(async () => {
    if (!selectedNodeId || !targetNodeId) return;

    const fromNode = nodes.find((n) => n.id === selectedNodeId);
    const toNode = nodes.find((n) => n.id === targetNodeId);
    if (!fromNode || !toNode) return;

    if (isLocalMode) {
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
  }, [selectedNodeId, targetNodeId, nodes, isLocalMode, isConnected, publicClient, contractAddress, writeContractAsync]);

  const executeApproveConnection = useCallback(async (fromId: string) => {
    if (!selectedNodeId) return;

    if (isLocalMode) {
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
  }, [selectedNodeId, isLocalMode, isConnected, contractAddress, writeContractAsync]);

  const executeNurtureConnection = useCallback(async (fromId: string, toId: string) => {
    if (isLocalMode) {
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

        setTimeout(() => loadLiveChainData(), 1500);
        return true;
      } catch (e) {
        console.error("Nurturing failed:", e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  }, [isLocalMode, isConnected, publicClient, contractAddress, writeContractAsync, loadLiveChainData]);

  const executeBoostConnection = useCallback(async (fromId: string, toId: string) => {
    if (isLocalMode) {
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

        setTimeout(() => loadLiveChainData(), 1500);
        return true;
      } catch (e) {
        console.error("Boosting failed:", e);
        return false;
      } finally {
        setPendingTx(false);
        setTxMessage("");
      }
    }
  }, [isLocalMode, isConnected, publicClient, contractAddress, writeContractAsync, loadLiveChainData]);

  const executeClaimRewards = useCallback(async (nodeKeys: string[]) => {
    if (isLocalMode) {
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
      setTimeout(() => loadLiveChainData(), 1500);
    } catch (e) {
      console.error("Claim failed:", e);
    } finally {
      setPendingTx(false);
      setTxMessage("");
    }
  }, [isLocalMode, isConnected, contractAddress, writeContractAsync, loadLiveChainData]);

  return {
    nodes,
    setNodes,
    connections,
    setConnections,
    selectedNodeId,
    targetNodeId,
    pendingNodeRewards,
    placementCoords,
    setPlacementCoords,
    pendingTx,
    txMessage,
    clockTick,
    activeUserAddress,

    selectedNode,
    targetNode,
    pendingRequestsToSelected,
    selectedNodeConnections,

    handleResetGrid,
    handlePlaceNodeCoords,
    handleSelectNode,
    handleConnectNodes,
    calculateDynamicFee,

    executePlaceNode,
    executeRequestConnection,
    executeApproveConnection,
    executeNurtureConnection,
    executeBoostConnection,
    executeClaimRewards,
  };
}
