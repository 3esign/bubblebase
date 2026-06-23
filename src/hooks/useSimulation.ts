import { useState, useRef, useCallback, useEffect } from "react";
import { WorldState, Agent, applyAction } from "../lib/simulation/engine";
import { MathDriver } from "../lib/simulation/drivers/mathDriver";
import { AIDriver } from "../lib/simulation/drivers/aiDriver";

export interface MetricSnapshot {
  tick: number;
  totalNodes: number;
  totalConnections: number;
  rewardPool: number;
  perAgent: Record<string, { spent: number; nodes: number }>;
}

export function useSimulation(initialWorld: WorldState, initialAgents: Agent[]) {
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(1); // ticks per second

  const worldRef = useRef(world);
  const agentsRef = useRef(agents);
  const metricsRef = useRef(metrics);
  const isRunningRef = useRef(isRunning);

  useEffect(() => { worldRef.current = world; }, [world]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const mathDriver = new MathDriver();
  const aiDriver = new AIDriver();

  const recordMetrics = (currentWorld: WorldState, currentAgents: Agent[]) => {
    const snapshot: MetricSnapshot = {
      tick: currentWorld.tick,
      totalNodes: currentWorld.nodes.length,
      totalConnections: currentWorld.totalConnections,
      rewardPool: currentWorld.rewardPerConnection, // Using rewardPerConnection as proxy
      perAgent: {},
    };
    for (const a of currentAgents) {
      snapshot.perAgent[a.id] = {
        spent: a.spent,
        nodes: currentWorld.nodes.filter(n => n.owner === a.walletAddress).length,
      };
    }
    setMetrics(prev => [...prev.slice(-100), snapshot]); // keep last 100 ticks
  };

  const runTick = async () => {
    // Clone world and agents for mutability in this tick
    const nextWorld = { ...worldRef.current, nodes: [...worldRef.current.nodes], connections: [...worldRef.current.connections] };
    const nextAgents = agentsRef.current.map(a => ({ ...a, logs: [...a.logs] }));

    nextWorld.tick += 1;
    nextWorld.timeSeconds += 3600; // 1 hour per tick in simulation time

    // Run each agent
    for (const agent of nextAgents) {
      const driver = agent.driverType === 'ai' ? aiDriver : mathDriver;
      const action = await driver.decide(agent, nextWorld);
      
      agent.logs.push(`Tick ${nextWorld.tick}: ${action.type}`);
      
      const success = applyAction(agent, action, nextWorld);
      if (!success && action.type !== 'HOLD') {
        agent.logs.push(`Failed to execute ${action.type}`);
      }
    }

    setWorld(nextWorld);
    setAgents(nextAgents);
    recordMetrics(nextWorld, nextAgents);
  };

  const runTicks = async (n: number) => {
    for (let i = 0; i < n; i++) {
      await runTick();
    }
  };

  useEffect(() => {
    let timer: any;
    if (isRunning) {
      timer = setInterval(() => {
        runTick();
      }, 1000 / speed);
    }
    return () => clearInterval(timer);
  }, [isRunning, speed]);

  return {
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
    setMetrics
  };
}
