"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";

import { useBubblesGame } from "../hooks/useBubblesGame";
import { useSimulation } from "../hooks/useSimulation";
import { WorldState, Agent } from "../lib/simulation/engine";

import { Header } from "../components/game/Header";
import { MapControlsPanel } from "../components/game/MapControlsPanel";
import { TransactionToast } from "../components/game/TransactionToast";
import { NodeDetailsPanel } from "../components/game/NodeDetailsPanel";
import { SimulationPanel } from "../components/SimulationPanel";
import { MacroSimulationPanel } from "../components/MacroSimulationPanel";
import { MOCK_AGENT_ADDRESSES } from "../lib/mockData";

const GameMap = dynamic(() => import("../components/GameMap"), { ssr: false });

// 1. Initial Static Simulation States defined outside the component to remain pure
const initialWorld: WorldState = {
  tick: 0,
  timeSeconds: 1782176240, // Static baseline epoch timestamp
  nodes: [],
  connections: [],
  rewardPerConnection: 0,
  totalConnections: 0,
  nodeRewardDebt: new Map(),
  nodePendingRewards: new Map(),
};

const initialAgents: Agent[] = MOCK_AGENT_ADDRESSES.map((addr, i) => ({
  id: `Agent-${i+1}`,
  walletAddress: addr,
  driverType: i % 2 === 0 ? "math" : "ai",
  config: { strategy: i % 2 === 0 ? "expansionist" : "defensive" },
  budget: 0.1,
  spent: 0,
  logs: [],
}));

export default function Home() {
  const [appMode, setAppMode] = useState<"demo" | "simulation" | "live">("demo");
  const [isMacroSimMode, setIsMacroSimMode] = useState(false);

  // 2. Core Game Hook (handles live blockchain data and basic local state)
  const {
    nodes,
    setNodes,
    connections,
    setConnections,
    selectedNodeId,
    handleSelectNode,
    activeUserAddress,
    handlePlaceNodeCoords,
    handleConnectNodes,
    pendingTx,
    handleResetGrid,
    selectedNode,
    targetNode,
    pendingNodeRewards,
    placementCoords,
    setPlacementCoords,
    calculateDynamicFee,
    executeClaimRewards,
    executeRequestConnection,
    executeApproveConnection,
    executeNurtureConnection,
    executeBoostConnection,
    executePlaceNode,
    selectedNodeConnections,
    pendingRequestsToSelected,
    txMessage,
  } = useBubblesGame(appMode);

  // 3. Simulation Engine Hook
  const {
    world: simWorld,
    agents: simAgents,
    metrics: simMetrics,
    isRunning: simIsRunning,
    setIsRunning: setSimIsRunning,
    speed: simSpeed,
    setSpeed: setSimSpeed,
    runTicks,
    setWorld: setSimWorld,
    setAgents: setSimAgents,
  } = useSimulation(initialWorld, initialAgents);

  // Sync simulation world to game display when in simulation mode
  useEffect(() => {
    if (appMode === "simulation") {
      setNodes(simWorld.nodes);
      setConnections(simWorld.connections);
    }
  }, [appMode, simWorld.nodes, simWorld.connections, setNodes, setConnections]);

  // Reset simulation when switching away from simulation mode
  useEffect(() => {
    if (appMode !== "simulation") {
      setSimIsRunning(false);
      setSimWorld({ ...initialWorld, timeSeconds: Math.floor(Date.now() / 1000) });
      setSimAgents(initialAgents);
      if (appMode === "live") {
        setNodes([]);
        setConnections([]);
      }
    }
  }, [appMode, setSimIsRunning, setSimWorld, setSimAgents, setNodes, setConnections]);

  const agentNodeIds = useMemo(() => {
    if (appMode !== "simulation") return new Set<string>();
    const ids = new Set<string>();
    simWorld.nodes.forEach((n) => {
      if (MOCK_AGENT_ADDRESSES.includes(n.owner)) {
        ids.add(n.id);
      }
    });
    return ids;
  }, [appMode, simWorld.nodes]);

  const handleClearGrid = () => {
    handleResetGrid();
    if (appMode === "simulation") {
      setSimIsRunning(false);
      setSimWorld({ ...initialWorld, timeSeconds: Math.floor(Date.now() / 1000) });
      setSimAgents(initialAgents);
    }
  };

  const handleExportAboutText = () => {
    const docText = `========================================================================
BUBBLES: BASE L2 CIVILIZATION GAME - TECHNICAL DOCUMENTATION
========================================================================

BubbleBase is an isometric, decentralized civilization game built directly on the Base L2 Ethereum network. In this dystopian, cyberpunk world, raw coordinate grid space is real estate, and survival depends on data bandwidth and network connectivity.

------------------------------------------------------------------------
1. GAMEPLAY & MECHANICS
------------------------------------------------------------------------
* Claim Your Real Estate (Place Nodes): Click on any empty intersection on the grid to deploy a basic infrastructure Node (Pylon). This registers your node permanently on-chain.
* Expand Your Net worth (Forge Connections): Select your node, then click another player's node to request a connection. Bandwidth is strength - as your node accumulates links, it procedurally transforms from a humble Pylon into a towering Citadel.
* Earn Passive Yield (Collect Rewards): Every time another player connects nearby, nurtures a link, or boosts their network speed, they pay fees into a global reward pool. You can claim your accumulated ETH yield at any time directly through the dApp dashboard.
* Prevent Grid Decay (Nurture & Boost): Connections suffer from entropy and decay after 24 hours, turning into dead grey wires. Reset the timer by Nurturing the link, or Boost it to overclock your throughput and visual power streams.

------------------------------------------------------------------------
2. TECHNICAL ARCHITECTURE & STATE ENGINE
------------------------------------------------------------------------
* Coordinate System: Nodes are indexed using a custom 64-bit coordinate compression scheme mapping 32-bit signed integers (int32 x, int32 y) to a single uint64 key:
    function encodeCoordinate(int32 x, int32 y) returns (uint64) {
        return (uint64(uint32(x)) << 32) | uint64(uint32(y));
    }
  This eliminates nested mapping layouts (mapping(int32 => mapping(int32 => address))) and saves massive gas on-chain by maintaining a flat mapping(uint64 => address) public nodes.
* Undirected Graph Connections: Since connections are undirected, lookup keys are generated deterministically by sorting node coordinate keys before computing a keccak256 hash:
    function getConnKey(uint64 a, uint64 b) returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

------------------------------------------------------------------------
3. PARAMETRIC fee FORMULAS
------------------------------------------------------------------------
* Placement Fee:
    Placement Fee = ACTION_FEE = 0.00001 ETH
* Dynamic Connection Fee:
    Connection Fee = ACTION_FEE + ConnectionPremium + DistancePremium
    ConnectionPremium = max(0, toNodeConnections - fromNodeConnections) * 0.000005 ETH
    DistancePremium = ManhattanDistance * 0.000001 ETH
    ManhattanDistance = |x2 - x1| + |y2 - y1|
* Nurture Fee:
    Nurture Fee = 0.000002 ETH + (ManhattanDistance * 0.0000002 ETH)
* Boost Fee:
    Boost Fee = 0.000005 ETH + (ManhattanDistance * 0.0000005 ETH)

------------------------------------------------------------------------
4. DeFi REWARD ACCUMULATION
------------------------------------------------------------------------
Instead of running expensive, O(n) loops over all nodes, the contract implements an O(1) reward accumulator:
* 5% Creator Fee is routed instantly to the developer treasury.
* 50% of Connection fees and 95% of Nurture/Boost fees go to the global reward pool.
* rewardPerConnection tracks cumulative distributed ETH per unit connection weight, scaled by 10^18:
    delta rewardPerConnection = (FeeContribution * 10^18) / totalConnections
* Pending rewards are calculated lazily when a node state is updated:
    PendingReward(node) += (connectionCounts[node] * rewardPerConnection / 10^18) - nodeRewardDebt[node]
    nodeRewardDebt[node] = connectionCounts[node] * rewardPerConnection / 10^18

------------------------------------------------------------------------
5. AI AGENT SIMULATION ENGINE
------------------------------------------------------------------------
* Tick loop proceeds in hours of simulated time.
* MathDriver decides actions based on heuristic rules (maintainer/expansionist/defensive).
* AIDriver serializes current node clusters and connection states, passing them to Next.js LLM API proxies to make strategic gameplay decisions (supports OpenAI, Anthropic, Gemini, Ollama).

------------------------------------------------------------------------
6. CORE CODE DIRECTORIES
------------------------------------------------------------------------
* /src/app/page.tsx: App entry point, layout, mode controls, simulation orchestrator.
* /src/components/GameMap.tsx: 2.5D Isometric procedurally generated graphics engine powered by PIXI.js.
* /src/hooks/useBubblesGame.ts: On-chain Web3 connection hooks, transaction wrappers, dynamic fee calculations.
* /src/hooks/useSimulation.ts: Simulation agent state hooks, metric snapshots recorder.
* /hardhat_project/contracts/Bubbles.sol: Smart contract state engine.

========================================================================
BubbleBase Civilization Game - 3esign - 2026. All rights reserved.
========================================================================`;

    const blob = new Blob([docText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bubblebase-documentation.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="w-full h-screen relative overflow-hidden bg-[#050511] select-none text-white font-sans">
      
      {/* 2.5D Interactive Canvas */}
      <GameMap
        nodes={nodes}
        connections={connections}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        userAddress={activeUserAddress}
        onPlaceNode={handlePlaceNodeCoords}
        onConnectNodes={handleConnectNodes}
        pendingTx={pendingTx}
        agentNodeIds={agentNodeIds}
      />

      {/* Top Header & Settings Menu */}
      <Header
        appMode={appMode}
        setAppMode={setAppMode}
        onExportAboutText={handleExportAboutText}
      />

      {/* Help Modal (Bottom Left) */}
      <MapControlsPanel />

      {/* Mode Toggle Button for standard vs macro math view */}
      {appMode === "simulation" && (
        <div className="absolute top-20 left-6 flex gap-1.5 pointer-events-auto z-[60] bg-[#070814]/90 border border-white/10 p-1 rounded-xl shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setIsMacroSimMode(false)}
            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 ${
              !isMacroSimMode
                ? "bg-blue-600/80 text-white border border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)] hover:bg-blue-600"
                : "border border-transparent text-white/50 hover:text-white"
            }`}
          >
            Standard View
          </button>
          <button
            onClick={() => setIsMacroSimMode(true)}
            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 ${
              isMacroSimMode
                ? "bg-emerald-600/80 text-white border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] hover:bg-emerald-600"
                : "border border-transparent text-white/50 hover:text-white"
            }`}
          >
            Macro Math Model
          </button>
        </div>
      )}

      {/* Simulation Engine Panel (Simulation Mode Only) */}
      {appMode === "simulation" && (
        isMacroSimMode ? (
          <MacroSimulationPanel
            world={simWorld}
            agents={simAgents}
            metrics={simMetrics}
            isRunning={simIsRunning}
            setIsRunning={setSimIsRunning}
            speed={simSpeed}
            setSpeed={setSimSpeed}
            runTicks={runTicks}
            setWorld={setSimWorld}
            setAgents={setSimAgents}
          />
        ) : (
          <SimulationPanel
            world={simWorld}
            agents={simAgents}
            metrics={simMetrics}
            isRunning={simIsRunning}
            setIsRunning={setSimIsRunning}
            speed={simSpeed}
            setSpeed={setSimSpeed}
            runTicks={runTicks}
            setAgents={setSimAgents}
          />
        )
      )}

      {/* Interaction Card (Right Sidebar) */}
      <div className="absolute top-32 right-6 w-96 flex flex-col gap-4 pointer-events-auto max-h-[80vh] overflow-y-auto pr-1 z-40">
        <TransactionToast pendingTx={pendingTx} txMessage={txMessage} />
        
        <NodeDetailsPanel
          selectedNode={selectedNode}
          targetNode={targetNode}
          activeUserAddress={activeUserAddress}
          pendingNodeRewards={pendingNodeRewards}
          nodes={nodes}
          selectedNodeConnections={selectedNodeConnections}
          pendingRequestsToSelected={pendingRequestsToSelected}
          placementCoords={placementCoords}
          setPlacementCoords={setPlacementCoords}
          calculateDynamicFee={calculateDynamicFee}
          executeClaimRewards={executeClaimRewards}
          executeRequestConnection={executeRequestConnection}
          executeApproveConnection={executeApproveConnection}
          executeNurtureConnection={executeNurtureConnection}
          executeBoostConnection={executeBoostConnection}
          executePlaceNode={executePlaceNode}
        />
      </div>

      {/* Network Stats Overlay (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 glass-panel px-8 py-3 rounded-2xl pointer-events-auto">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
            Total Nodes
          </span>
          <span className="text-xl font-black text-white/90 font-mono tracking-tighter">
            {nodes.length}
          </span>
        </div>
        <div className="w-px h-8 bg-white/10"></div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
            Active Links
          </span>
          <span className="text-xl font-black text-blue-400 font-mono tracking-tighter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            {connections.filter((c) => !c.isPending).length}
          </span>
        </div>
        <div className="w-px h-8 bg-white/10"></div>
        <button
          onClick={handleClearGrid}
          className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider glass-button glass-button-danger hover:scale-105"
        >
          Clear Grid
        </button>
      </div>
    </main>
  );
}
