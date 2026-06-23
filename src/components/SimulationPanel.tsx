import React from "react";
import { WorldState, Agent } from "../lib/simulation/engine";
import { MetricSnapshot } from "../hooks/useSimulation";

interface SimulationPanelProps {
  world: WorldState;
  agents: Agent[];
  metrics: MetricSnapshot[];
  isRunning: boolean;
  setIsRunning: (val: boolean) => void;
  speed: number;
  setSpeed: (val: number) => void;
  runTicks: (n: number) => void;
  setAgents: (agents: Agent[]) => void;
}

export function SimulationPanel({
  world,
  agents,
  metrics,
  isRunning,
  setIsRunning,
  speed,
  setSpeed,
  runTicks,
  setAgents
}: SimulationPanelProps) {
  
  const handleAgentDriverChange = (index: number, type: 'math' | 'ai') => {
    const nextAgents = [...agents];
    nextAgents[index].driverType = type;
    setAgents(nextAgents);
  };

  const handleAgentStrategyChange = (index: number, strategy: string) => {
    const nextAgents = [...agents];
    nextAgents[index].config.strategy = strategy;
    setAgents(nextAgents);
  };

  const latestMetric = metrics[metrics.length - 1];

  return (
    <div className="absolute top-32 left-6 w-80 flex flex-col gap-4 pointer-events-auto max-h-[80vh] overflow-y-auto pr-1">
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border-blue-500/30">
        <div className="flex flex-col">
          <span className="text-xs text-blue-400 uppercase tracking-widest font-bold">
            Simulation Engine
          </span>
          <span className="text-sm font-bold text-white tracking-tight">
            Tick: {world.tick} | Time: {world.timeSeconds}s
          </span>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider glass-button ${isRunning ? 'glass-button-danger' : 'glass-button-success'}`}
          >
            {isRunning ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => runTicks(10)}
            className="flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider glass-button"
            disabled={isRunning}
          >
            +10 Ticks
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Speed (Ticks/sec)</span>
          <div className="flex gap-2">
            {[1, 5, 20].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 py-1 rounded text-xs font-bold ${speed === s ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Agents */}
        <div className="flex flex-col gap-2 mt-2 border-t border-white/10 pt-2">
          <span className="text-xs text-white/50 font-bold uppercase">Agent Population</span>
          {agents.map((agent, i) => (
            <div key={agent.id} className="bg-white/5 p-2 rounded flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center text-white/80 font-mono">
                <span>{agent.id}</span>
                <span className="text-emerald-400">{agent.spent.toFixed(4)} ETH spent</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={agent.driverType}
                  onChange={e => handleAgentDriverChange(i, e.target.value as 'math'|'ai')}
                  className="bg-black/50 text-white border border-white/20 rounded p-1 flex-1"
                >
                  <option value="math">Math Driver</option>
                  <option value="ai">AI Driver</option>
                </select>
                <select
                  value={agent.config.strategy}
                  onChange={e => handleAgentStrategyChange(i, e.target.value)}
                  className="bg-black/50 text-white border border-white/20 rounded p-1 flex-1"
                >
                  <option value="expansionist">Expansionist</option>
                  <option value="defensive">Defensive</option>
                  <option value="maintainer">Maintainer</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Mini Chart / Metrics */}
        {latestMetric && (
          <div className="flex flex-col gap-2 mt-2 border-t border-white/10 pt-2">
            <span className="text-xs text-white/50 font-bold uppercase">Latest Metrics</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 p-2 rounded flex flex-col">
                <span className="text-white/40">Total Nodes</span>
                <span className="font-bold">{latestMetric.totalNodes}</span>
              </div>
              <div className="bg-white/5 p-2 rounded flex flex-col">
                <span className="text-white/40">Total Conns</span>
                <span className="font-bold">{latestMetric.totalConnections}</span>
              </div>
              <div className="bg-white/5 p-2 rounded flex flex-col col-span-2">
                <span className="text-white/40">Reward Pool Proxy</span>
                <span className="font-bold text-yellow-400">{latestMetric.rewardPool.toFixed(6)} ETH</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
