import { Agent, WorldState, AgentAction, Driver } from "../engine";
import { isConnectionDecayed } from "../economyFormulas";

export class MathDriver implements Driver {
  async decide(agent: Agent, world: WorldState): Promise<AgentAction> {
    const config = agent.config || {};
    const risk = typeof config.risk === 'number' ? config.risk : 50; // 0 to 100
    const strategy = config.strategy || 'expansionist';

    // Current agent nodes
    const userNodes = world.nodes.filter((n) => n.owner === agent.walletAddress);

    if (userNodes.length === 0) {
      // Pick random empty spot
      return {
        type: "PLACE_NODE",
        params: { x: Math.floor(Math.random() * 20) - 10, y: Math.floor(Math.random() * 20) - 10 },
        reasoning: "Seeding origin node."
      };
    }

    if (strategy === 'defensive' || strategy === 'maintainer') {
      const decaying = world.connections.filter(c => {
        if (c.isPending) return false;
        if (!isConnectionDecayed(c.lastNurturedAt || 0, world.timeSeconds + 12 * 3600)) return false; // within 12h of decay
        return world.nodes.find(n => n.id === c.from)?.owner === agent.walletAddress ||
               world.nodes.find(n => n.id === c.to)?.owner === agent.walletAddress;
      });

      if (decaying.length > 0) {
        // sort by most urgent (lowest time left)
        decaying.sort((a, b) => (a.lastNurturedAt || 0) - (b.lastNurturedAt || 0));
        const target = decaying[0];

        if (strategy === 'maintainer' && Math.random() < risk / 100) {
          return { type: "BOOST_CONNECTION", params: { fromId: target.from, toId: target.to }, reasoning: "Boosting decaying connection." };
        } else {
          return { type: "NURTURE_CONNECTION", params: { fromId: target.from, toId: target.to }, reasoning: "Nurturing decaying connection." };
        }
      }
    }

    if (strategy === 'expansionist' || strategy === 'aggressive') {
      const anchorNode = userNodes[Math.floor(Math.random() * userNodes.length)];

      if (world.nodes.length > 1 && Math.random() > 0.5) {
        const potentialTargets = world.nodes.filter(n => n.id !== anchorNode.id && !world.connections.some(c => (c.from === anchorNode.id && c.to === n.id) || (c.from === n.id && c.to === anchorNode.id)));
        if (potentialTargets.length > 0) {
          potentialTargets.sort((a, b) => {
            const distA = Math.abs(a.x - anchorNode.x) + Math.abs(a.y - anchorNode.y);
            const distB = Math.abs(b.x - anchorNode.x) + Math.abs(b.y - anchorNode.y);
            return distA - distB;
          });
          const target = potentialTargets[0];
          return {
            type: "REQUEST_CONNECTION",
            params: { fromId: anchorNode.id, toId: target.id },
            reasoning: `Connecting from anchor to nearby node.`
          };
        }
      }

      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.floor(Math.random() * 3);
      const x = Math.round(anchorNode.x + Math.cos(angle) * distance);
      const y = Math.round(anchorNode.y + Math.sin(angle) * distance);
      
      return {
        type: "PLACE_NODE",
        params: { x, y },
        reasoning: "Expanding territory."
      };
    }

    return { type: "HOLD", params: { reason: "Stable." }, reasoning: "Nothing to do." };
  }
}
