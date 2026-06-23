import { GameNode, GameConnection } from "../../components/GameMap";
import {
  calculateConnectionFee,
  calculateNurtureFee,
  calculateBoostFee,
  isConnectionDecayed,
  ACTION_FEE,
} from "./economyFormulas";

export interface Agent {
  id: string;
  walletAddress: string;
  driverType: "math" | "ai";
  config: any; // specific configuration for the driver
  budget: number;
  spent: number;
  logs: any[];
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
  if (action.type === "PLACE_NODE") {
    const { x, y } = action.params;
    const cost = ACTION_FEE;
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

    const costInfo = calculateConnectionFee(fromNode, toNode);
    if (agent.spent + costInfo.total > agent.budget) return false;

    // In simulation, we bypass the "request -> approve" flow and instantly approve it for speed.
    // Real chain uses request + approve.
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
    const rewardFee = costInfo.total * 0.50;
    if (world.totalConnections > 2) {
      world.rewardPerConnection += rewardFee / world.totalConnections;
    }

    agent.spent += costInfo.total;
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

    const cost = calculateNurtureFee(fromNode, toNode);
    if (agent.spent + cost > agent.budget) return false;

    conn.lastNurturedAt = world.timeSeconds;
    
    // Update rewards pool
    const rewardFee = cost * 0.95; // 5% creator fee simulated
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

    const cost = calculateBoostFee(fromNode, toNode);
    if (agent.spent + cost > agent.budget) return false;

    conn.boostMultiplier = (conn.boostMultiplier || 100) + 50;
    conn.lastNurturedAt = world.timeSeconds;

    // Update rewards pool
    const rewardFee = cost * 0.95;
    if (world.totalConnections > 0) {
      world.rewardPerConnection += rewardFee / world.totalConnections;
    }

    agent.spent += cost;
    return true;
  }

  return false; // HOLD or unknown
}
