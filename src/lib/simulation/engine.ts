import { GameNode, GameConnection } from "../../components/GameMap";

export interface AgentConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  strategy?: string;
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  walletAddress: string;
  driverType: "math" | "ai";
  config: AgentConfig; // specific configuration for the driver
  budget: number;
  spent: number;
  logs: string[];
}

export interface EconomyParams {
  actionFee: number;
  connectionLifetime: number;
  distancePremiumMult: number;
  poolContributionConnection: number;
  poolContributionNurtureBoost: number;
}

export interface WorldState {
  tick: number;
  timeSeconds: number; // simulated unix timestamp
  nodes: GameNode[];
  connections: GameConnection[];
  rewardPerConnection: number;
  totalConnections: number;
  nodeRewardDebt: Map<string, number>;
  nodePendingRewards: Map<string, number>;
  params?: EconomyParams;
}

export type AgentAction =
  | { type: "PLACE_NODE"; params: { x: number; y: number }; reasoning?: string }
  | { type: "REQUEST_CONNECTION"; params: { fromId: string; toId: string }; reasoning?: string }
  | { type: "NURTURE_CONNECTION"; params: { fromId: string; toId: string }; reasoning?: string }
  | { type: "BOOST_CONNECTION"; params: { fromId: string; toId: string }; reasoning?: string }
  | { type: "HOLD"; params?: { reason: string }; reasoning?: string };

export interface Driver {
  decide: (agent: Agent, world: WorldState) => Promise<AgentAction>;
}

// Function to apply an action to the world state (returns a mutated world state or applies in place)
export function applyAction(agent: Agent, action: AgentAction, world: WorldState): boolean {
  const params = world.params || {
    actionFee: 0.00001,
    connectionLifetime: 86400,
    distancePremiumMult: 0.000001,
    poolContributionConnection: 0.50,
    poolContributionNurtureBoost: 0.95,
  };

  if (action.type === "PLACE_NODE") {
    const { x, y } = action.params;
    const cost = params.actionFee;
    if (agent.spent + cost > agent.budget) return false;

    // Check collision
    if (world.nodes.some((n) => n.x === x && n.y === y)) return false;

    // We can use a simple string key for demo simulation id
    const nodeId = `${x}_${y}`;
    world.nodes.push({ id: nodeId, x, y, owner: agent.walletAddress, connectionsCount: 0 });
    agent.spent += cost;
    return true;
  }

  if (action.type === "REQUEST_CONNECTION") {
    const { fromId, toId } = action.params;
    const fromNode = world.nodes.find((n) => n.id === fromId);
    const toNode = world.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return false;
    if (fromNode.owner !== agent.walletAddress) return false;

    const exists = world.connections.some(
      (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    if (exists) return false;

    // Calculate dynamic connection fee using parameters
    const dist = Math.abs(toNode.x - fromNode.x) + Math.abs(toNode.y - fromNode.y);
    let connectionPremium = 0;
    if (toNode.connectionsCount > fromNode.connectionsCount) {
      connectionPremium = (toNode.connectionsCount - fromNode.connectionsCount) * 0.000005;
    }
    const cost = params.actionFee + connectionPremium + dist * params.distancePremiumMult;

    if (agent.spent + cost > agent.budget) return false;

    world.connections.push({
      from: fromId,
      to: toId,
      isPending: false,
      lastNurturedAt: world.timeSeconds,
      boostMultiplier: 100,
    });

    // Update connection counts
    fromNode.connectionsCount++;
    toNode.connectionsCount++;
    world.totalConnections += 2;

    // Update rewards pool
    const rewardFee = cost * params.poolContributionConnection;
    if (world.totalConnections > 2) {
      world.rewardPerConnection += rewardFee / world.totalConnections;
    }

    agent.spent += cost;
    return true;
  }

  if (action.type === "NURTURE_CONNECTION") {
    const { fromId, toId } = action.params;
    const conn = world.connections.find(
      (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    if (!conn) return false;

    const fromNode = world.nodes.find((n) => n.id === fromId);
    const toNode = world.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return false;

    // Calculate dynamic nurture fee
    const dist = Math.abs(toNode.x - fromNode.x) + Math.abs(toNode.y - fromNode.y);
    const cost = 0.000002 + dist * 0.0000002;

    if (agent.spent + cost > agent.budget) return false;

    conn.lastNurturedAt = world.timeSeconds;
    
    // Update rewards pool
    const rewardFee = cost * params.poolContributionNurtureBoost;
    if (world.totalConnections > 0) {
      world.rewardPerConnection += rewardFee / world.totalConnections;
    }

    agent.spent += cost;
    return true;
  }

  if (action.type === "BOOST_CONNECTION") {
    const { fromId, toId } = action.params;
    const conn = world.connections.find(
      (c) => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    if (!conn || (conn.boostMultiplier || 100) >= 300) return false;

    const fromNode = world.nodes.find((n) => n.id === fromId);
    const toNode = world.nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return false;

    // Calculate dynamic boost fee
    const dist = Math.abs(toNode.x - fromNode.x) + Math.abs(toNode.y - fromNode.y);
    const cost = 0.000005 + dist * 0.0000005;

    if (agent.spent + cost > agent.budget) return false;

    conn.boostMultiplier = (conn.boostMultiplier || 100) + 50;
    conn.lastNurturedAt = world.timeSeconds;

    // Update rewards pool
    const rewardFee = cost * params.poolContributionNurtureBoost;
    if (world.totalConnections > 0) {
      world.rewardPerConnection += rewardFee / world.totalConnections;
    }

    agent.spent += cost;
    return true;
  }

  return false; // HOLD or unknown
}
