import { Agent, WorldState, AgentAction, Driver } from "../engine";

export class AIDriver implements Driver {
  async decide(agent: Agent, world: WorldState): Promise<AgentAction> {
    const config = agent.config || {};
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider || 'openai',
          apiKey: config.apiKey,
          model: config.model,
          systemPrompt: config.systemPrompt || 'You are an AI playing BubbleBase.',
          gameState: {
            walletAddress: agent.walletAddress,
            nodes: world.nodes,
            connections: world.connections,
          },
          actionHistory: agent.logs.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Agent proxy failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse data into AgentAction
      const action: AgentAction = {
        type: data.action as any,
        params: data.params,
        reasoning: data.reasoning,
      };

      return action;
    } catch (err: any) {
      return {
        type: "HOLD",
        params: { reason: `Error contacting AI: ${err.message}` },
        reasoning: "Fallback to hold due to error."
      };
    }
  }
}
