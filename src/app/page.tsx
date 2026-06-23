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
import { MOCK_AGENT_ADDRESSES } from "../lib/mockData";

const GameMap = dynamic(() => import("../components/GameMap"), { ssr: false });

export default function Home() {
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // 1. Core Game Hook (handles live blockchain data and basic local state)
  const game = useBubblesGame(isDemoMode);

  // 2. Initial Simulation State
  const initialWorld: WorldState = useMemo(() => ({
    tick: 0,
    timeSeconds: Math.floor(Date.now() / 1000),
    nodes: [],
    connections: [],
    rewardPerConnection: 0,
    totalConnections: 0,
    nodeRewardDebt: new Map(),
    nodePendingRewards: new Map(),
  }), []);

  const initialAgents: Agent[] = useMemo(() => {
    return MOCK_AGENT_ADDRESSES.map((addr, i) => ({
      id: `Agent-${i+1}`,
      walletAddress: addr,
      driverType: i % 2 === 0 ? "math" : "ai",
      config: { strategy: i % 2 === 0 ? "expansionist" : "defensive" },
      budget: 0.1,
      spent: 0,
      logs: [],
    }));
  }, []);

  // 3. Simulation Engine Hook
  const simulation = useSimulation(initialWorld, initialAgents);

  // Sync simulation world to game display when in demo mode
  useEffect(() => {
    if (isDemoMode) {
      game.setNodes(simulation.world.nodes);
      game.setConnections(simulation.world.connections);
    }
  }, [isDemoMode, simulation.world.tick]);

  // Live network stays empty; pause and reset simulation when leaving demo
  useEffect(() => {
    if (!isDemoMode) {
      simulation.setIsRunning(false);
      simulation.setWorld({ ...initialWorld, timeSeconds: Math.floor(Date.now() / 1000) });
      simulation.setAgents(initialAgents);
    }
  }, [isDemoMode]);

  const agentNodeIds = useMemo(() => {
    if (!isDemoMode) return new Set<string>();
    const ids = new Set<string>();
    simulation.world.nodes.forEach((n) => {
      if (MOCK_AGENT_ADDRESSES.includes(n.owner)) {
        ids.add(n.id);
      }
    });
    return ids;
  }, [isDemoMode, simulation.world.tick]);

  const handleClearGrid = () => {
    game.handleResetGrid();
    if (isDemoMode) {
      simulation.setIsRunning(false);
      simulation.setWorld({ ...initialWorld, timeSeconds: Math.floor(Date.now() / 1000) });
      simulation.setAgents(initialAgents);
    }
  };

  return (
    <main className="w-full h-screen relative overflow-hidden bg-[#050511] select-none text-white font-sans">
      
      {/* 2.5D Interactive Canvas */}
      <GameMap
        isDemoMode={isDemoMode}
        nodes={game.nodes}
        connections={game.connections}
        selectedNodeId={game.selectedNodeId}
        onSelectNode={game.handleSelectNode}
        userAddress={game.activeUserAddress}
        onPlaceNode={game.handlePlaceNodeCoords}
        onConnectNodes={game.handleConnectNodes}
        pendingTx={game.pendingTx}
        agentNodeIds={agentNodeIds}
      />

      {/* Top Header & Settings Menu */}
      <Header
        isDemoMode={isDemoMode}
        setIsDemoMode={setIsDemoMode}
        setShowAboutModal={setShowAboutModal}
      />

      {/* Help Modal (Bottom Left) */}
      <MapControlsPanel />

      {/* Simulation Engine Panel (Demo Mode Only) */}
      {isDemoMode && (
        <SimulationPanel
          world={simulation.world}
          agents={simulation.agents}
          metrics={simulation.metrics}
          isRunning={simulation.isRunning}
          setIsRunning={simulation.setIsRunning}
          speed={simulation.speed}
          setSpeed={simulation.setSpeed}
          runTicks={simulation.runTicks}
          setAgents={simulation.setAgents}
        />
      )}

      {/* Interaction Card (Right Sidebar) */}
      <div className="absolute top-32 right-6 w-96 flex flex-col gap-4 pointer-events-auto max-h-[80vh] overflow-y-auto pr-1 z-40">
        <TransactionToast pendingTx={game.pendingTx} txMessage={game.txMessage} />
        
        <NodeDetailsPanel
          selectedNode={game.selectedNode}
          targetNode={game.targetNode}
          activeUserAddress={game.activeUserAddress}
          pendingNodeRewards={game.pendingNodeRewards}
          nodes={game.nodes}
          selectedNodeConnections={game.selectedNodeConnections}
          pendingRequestsToSelected={game.pendingRequestsToSelected}
          placementCoords={game.placementCoords}
          setPlacementCoords={game.setPlacementCoords}
          calculateDynamicFee={game.calculateDynamicFee}
          executeClaimRewards={game.executeClaimRewards}
          executeRequestConnection={game.executeRequestConnection}
          executeApproveConnection={game.executeApproveConnection}
          executeNurtureConnection={game.executeNurtureConnection}
          executeBoostConnection={game.executeBoostConnection}
          executePlaceNode={game.executePlaceNode}
        />
      </div>

      {/* Network Stats Overlay (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 glass-panel px-8 py-3 rounded-2xl pointer-events-auto">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
            Total Nodes
          </span>
          <span className="text-xl font-black text-white/90 font-mono tracking-tighter">
            {game.nodes.length}
          </span>
        </div>
        <div className="w-px h-8 bg-white/10"></div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
            Active Links
          </span>
          <span className="text-xl font-black text-blue-400 font-mono tracking-tighter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
            {game.connections.filter((c) => !c.isPending).length}
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

      {/* About Modal */}
      {showAboutModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-[#0a0a1a] border border-white/10 p-8 rounded-3xl max-w-xl w-full flex flex-col gap-6 shadow-2xl relative">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-white tracking-tight">About BUBBLES</h2>
            <div className="space-y-4 text-sm text-white/70 leading-relaxed">
              <p>
                BUBBLES is an experimental, fully on-chain civilization simulation game built on Base L2. 
                It explores dynamic economic routing, attention decay, and AI-agent interactions within a shared spatial grid.
              </p>
              <p>
                <strong>The Core Loop:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Players (humans or AI) pay base fees to deploy Nodes.</li>
                <li>Players pay dynamic fees to connect Nodes (based on distance & popularity).</li>
                <li>50% of connection fees go to the connected Node&apos;s owner; 50% funds a global pool.</li>
                <li>Connections naturally decay. Players must burn ETH to &quot;Nurture&quot; them, fueling the global pool.</li>
              </ul>
              <p>
                <strong>The Goal:</strong> Accumulate the most connections and optimally route attention to capture the largest share of the global reward pool.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
