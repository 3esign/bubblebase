import React, { useMemo, useState } from "react";
import { WorldState, Agent, EconomyParams } from "../lib/simulation/engine";
import { MetricSnapshot } from "../hooks/useSimulation";

interface MacroSimulationPanelProps {
  world: WorldState;
  agents: Agent[];
  metrics: MetricSnapshot[];
  isRunning: boolean;
  setIsRunning: (val: boolean) => void;
  speed: number;
  setSpeed: (val: number) => void;
  runTicks: (n: number) => void;
  setWorld: React.Dispatch<React.SetStateAction<WorldState>>;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
}

export function MacroSimulationPanel({
  world,
  agents,
  metrics,
  isRunning,
  setIsRunning,
  speed,
  setSpeed,
  runTicks,
  setWorld,
  setAgents,
}: MacroSimulationPanelProps) {
  // Configurable parameter inputs
  const currentParams = useMemo(() => {
    return world.params || {
      actionFee: 0.00001,
      connectionLifetime: 86400,
      distancePremiumMult: 0.000001,
      poolContributionConnection: 0.50,
      poolContributionNurtureBoost: 0.95,
    };
  }, [world.params]);

  const [inputParams, setInputParams] = useState<EconomyParams>({ ...currentParams });

  // Update simulation parameters
  const handleApplyParams = () => {
    setWorld((prev) => ({
      ...prev,
      params: { ...inputParams },
    }));
  };

  // Populate high numbers of agents (e.g., 50 agents)
  const handleSpawnLargePopulation = (count: number) => {
    setIsRunning(false);
    const newAgents: Agent[] = Array.from({ length: count }).map((_, i) => {
      const hex = (i + 1).toString(16).padStart(2, "0");
      const walletAddress = `0x${"a".repeat(38)}${hex}`;
      const strategies = ["expansionist", "defensive", "maintainer"];
      const strategy = strategies[i % strategies.length];
      return {
        id: `Agent-${i + 1}`,
        walletAddress,
        driverType: "math",
        config: { strategy, risk: 30 + (i % 5) * 15 },
        budget: 0.2, // 0.2 ETH budget each
        spent: 0,
        logs: [`Agent initialized with strategy: ${strategy}`],
      };
    });

    // Reset world state along with agents
    setWorld({
      tick: 0,
      timeSeconds: Math.floor(Date.now() / 1000),
      nodes: [],
      connections: [],
      rewardPerConnection: 0,
      totalConnections: 0,
      nodeRewardDebt: new Map(),
      nodePendingRewards: new Map(),
      params: { ...inputParams },
    });

    setAgents(newAgents);
  };

  // Math Metric: Wealth / Spend distribution and Gini coefficient
  const statistics = useMemo(() => {
    if (agents.length === 0) return { gini: 0, avgSpent: 0, maxSpent: 0 };
    const spentList = agents.map((a) => a.spent).sort((a, b) => a - b);
    
    // Gini coefficient calculator
    const n = spentList.length;
    let sumDiff = 0;
    let sumSpent = 0;
    for (let i = 0; i < n; i++) {
      sumSpent += spentList[i];
      for (let j = 0; j < n; j++) {
        sumDiff += Math.abs(spentList[i] - spentList[j]);
      }
    }
    
    const avgSpent = sumSpent / n;
    const gini = sumSpent > 0 ? sumDiff / (2 * n * sumSpent) : 0;
    const maxSpent = Math.max(...spentList);

    return {
      gini,
      avgSpent,
      maxSpent,
    };
  }, [agents, world.tick]);

  const sortedLeaderboard = useMemo(() => {
    return [...agents]
      .map((agent) => {
        const ownedNodes = world.nodes.filter((n) => n.owner === agent.walletAddress).length;
        return {
          id: agent.id,
          strategy: agent.config.strategy || "math",
          spent: agent.spent,
          nodesCount: ownedNodes,
        };
      })
      .sort((a, b) => b.nodesCount - a.nodesCount || b.spent - a.spent)
      .slice(0, 10); // Top 10 agents
  }, [agents, world.nodes, world.tick]);

  return (
    <div className="absolute top-28 left-6 w-96 flex flex-col gap-4 pointer-events-auto max-h-[85vh] overflow-y-auto pr-1 z-40">
      
      {/* Simulation Master Controls */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border-emerald-500/30">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs text-emerald-400 uppercase tracking-widest font-bold">
              Macro Simulation Panel
            </span>
            <span className="text-sm font-bold text-white tracking-tight">
              Tick: {world.tick} | Population: {agents.length} Agents
            </span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
            MATH MODEL MODE
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button ${
              isRunning ? "glass-button-danger" : "glass-button-success"
            }`}
          >
            {isRunning ? "Pause Engine" : "Run Live Simulation"}
          </button>
          <button
            onClick={() => runTicks(25)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button"
            disabled={isRunning}
          >
            +25 Ticks
          </button>
          <button
            onClick={() => runTicks(100)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button"
            disabled={isRunning}
          >
            +100
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSpawnLargePopulation(30)}
            className="flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Spawn 30 Agents
          </button>
          <button
            onClick={() => handleSpawnLargePopulation(60)}
            className="flex-1 py-1.5 rounded-lg text-[10px] uppercase font-bold bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Spawn 60 Agents
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-white/50 uppercase font-bold">Simulation Speed</span>
          <div className="flex gap-2">
            {[1, 5, 20, 50].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 py-1 rounded text-xs font-bold ${
                  speed === s ? "bg-emerald-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/15"
                }`}
              >
                {s} T/s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parametric Math Tuning */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
        <span className="text-xs text-blue-400 uppercase tracking-widest font-bold">
          Parametric Math Models
        </span>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/50 uppercase">Action Fee (ETH)</label>
            <input
              type="number"
              step="0.000001"
              value={inputParams.actionFee}
              onChange={(e) =>
                setInputParams({ ...inputParams, actionFee: parseFloat(e.target.value) || 0 })
              }
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-mono font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/50 uppercase">Distance Prem (Mult)</label>
            <input
              type="number"
              step="0.0000001"
              value={inputParams.distancePremiumMult}
              onChange={(e) =>
                setInputParams({ ...inputParams, distancePremiumMult: parseFloat(e.target.value) || 0 })
              }
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-mono font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/50 uppercase">Conn Pool Split</label>
            <input
              type="number"
              step="0.05"
              max="1.0"
              value={inputParams.poolContributionConnection}
              onChange={(e) =>
                setInputParams({ ...inputParams, poolContributionConnection: parseFloat(e.target.value) || 0 })
              }
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-mono font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/50 uppercase">Decay Fee Split</label>
            <input
              type="number"
              step="0.05"
              max="1.0"
              value={inputParams.poolContributionNurtureBoost}
              onChange={(e) =>
                setInputParams({ ...inputParams, poolContributionNurtureBoost: parseFloat(e.target.value) || 0 })
              }
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-mono font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleApplyParams}
          className="w-full mt-1.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50"
        >
          Apply Formulas Parameters
        </button>
      </div>

      {/* Inequality & System Analytics */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
        <span className="text-xs text-yellow-400 uppercase tracking-widest font-bold">
          System Economic Models
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/5 p-3 rounded-xl flex flex-col">
            <span className="text-white/40 text-[10px] uppercase">Gini (Inequality)</span>
            <span className="text-lg font-black font-mono mt-0.5 text-yellow-400">
              {statistics.gini.toFixed(3)}
            </span>
            <span className="text-[9px] text-white/30">0 = Perfect Equal | 1 = High Inequality</span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl flex flex-col">
            <span className="text-white/40 text-[10px] uppercase">Avg Spent / Cap</span>
            <span className="text-lg font-black font-mono mt-0.5">
              {statistics.avgSpent.toFixed(5)} <span className="text-[10px] text-white/40">ETH</span>
            </span>
            <span className="text-[9px] text-white/30">Total: {(statistics.avgSpent * agents.length).toFixed(3)} ETH</span>
          </div>
        </div>

        {/* Wealth Distribution bar visualization */}
        {agents.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 bg-white/5 p-3 rounded-xl">
            <span className="text-[10px] text-white/50 uppercase font-bold">Capital Spent Distribution</span>
            <div className="flex items-end justify-between h-12 pt-2 gap-0.5">
              {Array.from({ length: 15 }).map((_, idx) => {
                const step = statistics.maxSpent / 15;
                const low = idx * step;
                const high = (idx + 1) * step;
                const count = agents.filter((a) => a.spent >= low && a.spent < high).length;
                const heightPercentage = agents.length > 0 ? (count / agents.length) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="bg-yellow-500/60 rounded-t-sm flex-1"
                    style={{ height: `${Math.max(4, heightPercentage)}%` }}
                    title={`${count} agents`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-2.5">
        <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Top Agent Leaderboard</span>
        <div className="flex flex-col gap-1.5">
          {sortedLeaderboard.map((item, idx) => (
            <div
              key={item.id}
              className="flex justify-between items-center text-xs px-2.5 py-1.5 rounded bg-white/5 border border-white/5 font-mono"
            >
              <div className="flex gap-2 items-center">
                <span className="text-white/40">{idx + 1}.</span>
                <span className="font-bold text-white/90">{item.id}</span>
                <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300">
                  {item.strategy}
                </span>
              </div>
              <div className="flex gap-3 text-right">
                <span>
                  Nodes: <span className="font-bold text-emerald-400">{item.nodesCount}</span>
                </span>
                <span className="text-white/60">
                  {item.spent.toFixed(4)} ETH
                </span>
              </div>
            </div>
          ))}
          {sortedLeaderboard.length === 0 && (
            <span className="text-xs text-white/30 text-center py-2">No agents active. Spawn agents above.</span>
          )}
        </div>
      </div>
    </div>
  );
}
