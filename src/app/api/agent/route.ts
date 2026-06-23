import { NextResponse } from 'next/server';
import { GameNode, GameConnection } from '../../../components/GameMap';

export async function POST(request: Request) {
  try {
    const { provider, model, systemPrompt, gameState, actionHistory, apiKey: clientApiKey } = await request.json();
    const apiKey = clientApiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    
    if (!apiKey) {
      return NextResponse.json({ action: 'HOLD', params: { reason: `Missing API key for ${provider}` }, reasoning: 'Server missing config.' });
    }

    const promptContent = `
Analyze the current game state and select the best action.
Current Wallet Address: ${gameState.walletAddress}

Active Nodes (Total: ${gameState.nodes.length}):
${JSON.stringify(gameState.nodes.slice(0, 30).map((n: GameNode) => ({
  id: n.id,
  owner: n.owner,
  x: n.x,
  y: n.y,
  connectionsCount: n.connectionsCount,
  tier: n.connectionsCount >= 6 ? 3 : (n.connectionsCount >= 4 ? 2 : (n.connectionsCount >= 2 ? 1 : 0))
})), null, 2)}
${gameState.nodes.length > 30 ? `...and ${gameState.nodes.length - 30} more nodes` : ''}

Active Connections:
${JSON.stringify(gameState.connections.slice(0, 30).map((c: GameConnection) => {
  const timeRemainingHours = c.lastNurturedAt ? (c.lastNurturedAt + 86400 - (Date.now() / 1000)) / 3600 : 0;
  return {
    id: `${c.from}-${c.to}`,
    fromId: c.from,
    toId: c.to,
    boostMultiplier: c.boostMultiplier || 100,
    timeRemainingHours,
    active: !c.isPending
  };
}), null, 2)}
${gameState.connections.length > 30 ? `...and ${gameState.connections.length - 30} more connections` : ''}

Action History:
${JSON.stringify(actionHistory || [], null, 2)}

Respond with a JSON object matching this structure EXACTLY:
{
  "action": "PLACE_NODE" | "NURTURE_CONNECTION" | "BOOST_CONNECTION" | "HOLD",
  "params": {
    "x": number,        // required for PLACE_NODE. Pick coords close to other nodes (e.g. within 200px range) to keep connections feasible.
    "y": number,        // required for PLACE_NODE
    "fromId": "string", // required for NURTURE/BOOST
    "toId": "string",   // required for NURTURE/BOOST
    "reason": "string"  // required for HOLD
  },
  "reasoning": "string" // explanation for your choice
}
`;

    let responseText = '';

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptContent },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: `${systemPrompt}\n\n${promptContent}` },
          ],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      responseText = data.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const targetModel = model || 'gemini-1.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemPrompt}\n\n${promptContent}` }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'ollama') {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptContent },
          ],
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      responseText = data.message?.content || '';
    } else {
      throw new Error(`Unsupported AI Provider: ${provider}`);
    }

    // Try to extract JSON from response markdown if any
    let actionJson;
    try {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const cleaned = responseText.substring(jsonStart, jsonEnd + 1);
        actionJson = JSON.parse(cleaned);
      } else {
        actionJson = JSON.parse(responseText);
      }
    } catch {
      console.error('Failed to parse AI action:', responseText);
      actionJson = {
        action: 'HOLD',
        params: { reason: 'Failed to parse JSON response from AI provider.' },
        reasoning: responseText
      };
    }

    return NextResponse.json(actionJson);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json({
      action: 'HOLD',
      params: { reason: `Error: ${err.message}` },
      reasoning: 'Internal API route error during execution.'
    }, { status: 500 });
  }
}
