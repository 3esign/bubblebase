import { useState, useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AgentConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'demo';
  apiKey: string;
  model: string;
  systemPrompt: string;
  strategy: 'expansionist' | 'maintainer' | 'aggressive' | 'defensive';
  risk: number; // 0 to 100
  frequency: number; // in seconds
}

interface UseAgentLoopProps {
  nodes: any[];
  connections: any[];
  walletAddress: string;
  executePlaceNode: (x: number, y: number) => Promise<boolean>;
  executeNurtureConnection: (fromId: string, toId: string) => Promise<boolean>;
  executeBoostConnection: (fromId: string, toId: string) => Promise<boolean>;
  config: AgentConfig;
}

export function useAgentLoop({
  nodes,
  connections,
  walletAddress,
  executePlaceNode,
  executeNurtureConnection,
  executeBoostConnection,
  config,
}: UseAgentLoopProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [budget, setBudget] = useState(0.05); // Default soft budget cap in ETH
  const [spent, setSpent] = useState(0.0); // Tracked soft spend in ETH
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentNodeIds, setAgentNodeIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(isRunning);
  const configRef = useRef(config);
  const spentRef = useRef(spent);
  const budgetRef = useRef(budget);
  const actionHistoryRef = useRef<string[]>([]);

  // Update refs to avoid closure stale state
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    spentRef.current = spent;
  }, [spent]);

  useEffect(() => {
    budgetRef.current = budget;
  }, [budget]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 99)]);
  };

  const stopAgent = () => {
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    addLog('Agent execution loop stopped.', 'warning');
  };

  const startAgent = () => {
    if (!walletAddress) {
      addLog('Cannot start agent: Wallet is not connected.', 'error');
      return;
    }
    if (spentRef.current >= budgetRef.current) {
      addLog('Cannot start agent: Soft budget cap reached.', 'warning');
      return;
    }
    setIsRunning(true);
    addLog(`Agent execution loop started. Mode: ${config.provider.toUpperCase()} (${config.strategy} strategy)`, 'success');
  };

  const executeAction = async (actionData: { action: string; params: any; reasoning?: string }) => {
    const { action, params, reasoning } = actionData;

    if (reasoning) {
      addLog(`AI Reasoning: ${reasoning}`, 'info');
    }

    if (action === 'PLACE_NODE') {
      const { x, y } = params;
      const cost = 0.002; // soft cost definition
      if (spentRef.current + cost > budgetRef.current) {
        addLog(`Blocked Action: Place node at (${x}, ${y}) would exceed budget cap.`, 'warning');
        return false;
      }
      addLog(`Agent attempting to place node at (${x}, ${y}). Cost: ${cost} ETH`, 'info');
      const success = await executePlaceNode(x, y);
      if (success) {
        setSpent((prev) => prev + cost);
        addLog(`Placed node successfully at (${x}, ${y})`, 'success');
        actionHistoryRef.current.push(`PLACE_NODE(${x}, ${y})`);
        
        // Find the node that was just placed to add to agentNodeIds
        // (Usually page.tsx updates nodes; we can look for node at these coords)
        setTimeout(() => {
          const found = nodes.find((n) => Math.abs(n.x - x) < 5 && Math.abs(n.y - y) < 5);
          if (found) {
            setAgentNodeIds((prev) => {
              const updated = new Set(prev);
              updated.add(found.id);
              return updated;
            });
          }
        }, 1000);
        return true;
      } else {
        addLog(`Failed to place node at (${x}, ${y})`, 'error');
        return false;
      }
    }

    if (action === 'NURTURE_CONNECTION') {
      const { fromId, toId } = params;
      const cost = 0.0005;
      if (spentRef.current + cost > budgetRef.current) {
        addLog(`Blocked Action: Nurturing connection would exceed budget cap.`, 'warning');
        return false;
      }
      addLog(`Agent nurturing connection between ${fromId} and ${toId}. Cost: ${cost} ETH`, 'info');
      const success = await executeNurtureConnection(fromId, toId);
      if (success) {
        setSpent((prev) => prev + cost);
        addLog(`Nurtured connection ${fromId} <-> ${toId} successfully`, 'success');
        actionHistoryRef.current.push(`NURTURE(${fromId}, ${toId})`);
        return true;
      } else {
        addLog(`Failed to nurture connection ${fromId} <-> ${toId}`, 'error');
        return false;
      }
    }

    if (action === 'BOOST_CONNECTION') {
      const { fromId, toId } = params;
      const cost = 0.001;
      if (spentRef.current + cost > budgetRef.current) {
        addLog(`Blocked Action: Boosting connection would exceed budget cap.`, 'warning');
        return false;
      }
      addLog(`Agent boosting connection between ${fromId} and ${toId}. Cost: ${cost} ETH`, 'info');
      const success = await executeBoostConnection(fromId, toId);
      if (success) {
        setSpent((prev) => prev + cost);
        addLog(`Boosted connection ${fromId} <-> ${toId} successfully`, 'success');
        actionHistoryRef.current.push(`BOOST(${fromId}, ${toId})`);
        return true;
      } else {
        addLog(`Failed to boost connection ${fromId} <-> ${toId}`, 'error');
        return false;
      }
    }

    if (action === 'HOLD') {
      const reason = params?.reason || 'No action needed.';
      addLog(`Agent Decided to HOLD: ${reason}`, 'info');
      actionHistoryRef.current.push(`HOLD: ${reason}`);
      return true;
    }

    addLog(`Unknown action: ${action}`, 'error');
    return false;
  };

  // Local Heuristic Logic for Demo Mode
  const runHeuristicTurn = async () => {
    const currentConfig = configRef.current;
    if (nodes.length === 0) return;

    // Filter connections that are decaying or owned by user
    const userNodes = nodes.filter((n) => n.owner.toLowerCase() === walletAddress.toLowerCase() || agentNodeIds.has(n.id));
    
    if (currentConfig.strategy === 'defensive' || currentConfig.strategy === 'maintainer') {
      // Prioritize nurturing/boosting decaying connections that belong to the user
      const decaying = connections.filter(
        (c) =>
          c.active &&
          c.timeRemainingHours < 12 &&
          (userNodes.some((n) => n.id === c.fromId) || userNodes.some((n) => n.id === c.toId))
      );

      if (decaying.length > 0) {
        // Sort by time remaining
        decaying.sort((a, b) => a.timeRemainingHours - b.timeRemainingHours);
        const target = decaying[0];
        const action = currentConfig.strategy === 'maintainer' && Math.random() < (currentConfig.risk / 100)
          ? 'BOOST_CONNECTION'
          : 'NURTURE_CONNECTION';
        
        await executeAction({
          action,
          params: { fromId: target.fromId, toId: target.toId },
          reasoning: `Decaying connection detected with ${target.timeRemainingHours.toFixed(1)}h remaining. Strategy is ${currentConfig.strategy}.`,
        });
        return;
      }
    }

    if (currentConfig.strategy === 'expansionist' || currentConfig.strategy === 'aggressive' || userNodes.length === 0) {
      // Place a new node relative to a random cluster center or user node
      const anchorNode = userNodes.length > 0
        ? userNodes[Math.floor(Math.random() * userNodes.length)]
        : nodes[Math.floor(Math.random() * nodes.length)];

      const angle = Math.random() * Math.PI * 2;
      // Distance between 80px and 220px to keep them in range of isometric wires
      const distance = 80 + Math.random() * 140;
      const x = Math.round(anchorNode.x + Math.cos(angle) * distance);
      const y = Math.round(anchorNode.y + Math.sin(angle) * distance);

      await executeAction({
        action: 'PLACE_NODE',
        params: { x, y },
        reasoning: `Expanding the node network around anchor node at (${anchorNode.x}, ${anchorNode.y}).`,
      });
      return;
    }

    // Default action: hold
    await executeAction({
      action: 'HOLD',
      params: { reason: 'No urgent decaying connections, and strategy does not require expansion.' },
      reasoning: 'Game state is stable and secure.',
    });
  };

  // Live AI Turn via Proxy Route
  const runLiveAiTurn = async () => {
    const currentConfig = configRef.current;
    try {
      addLog(`Contacting AI Agent Proxy (${currentConfig.provider.toUpperCase()})...`, 'info');
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: currentConfig.provider,
          apiKey: currentConfig.apiKey,
          model: currentConfig.model,
          systemPrompt: currentConfig.systemPrompt,
          gameState: {
            walletAddress,
            nodes,
            connections,
          },
          actionHistory: actionHistoryRef.current.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.statusText}`);
      }

      const actionData = await response.json();
      await executeAction(actionData);
    } catch (err: any) {
      addLog(`AI Loop Execution Error: ${err.message}`, 'error');
      // If error occurs, let's gracefully hold to prevent infinite fast failures
      stopAgent();
    }
  };

  const performAgentTurn = async () => {
    if (!isRunningRef.current) return;
    if (spentRef.current >= budgetRef.current) {
      addLog('Soft budget cap has been reached. Halting agent.', 'warning');
      stopAgent();
      return;
    }

    const currentConfig = configRef.current;
    if (currentConfig.provider === 'demo') {
      await runHeuristicTurn();
    } else {
      await runLiveAiTurn();
    }
  };

  // Agent execution loop
  useEffect(() => {
    if (isRunning) {
      performAgentTurn(); // immediate first turn
      timerRef.current = setInterval(performAgentTurn, config.frequency * 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, config.frequency]);

  return {
    isRunning,
    startAgent,
    stopAgent,
    budget,
    setBudget,
    spent,
    setSpent,
    logs,
    clearLogs: () => setLogs([]),
    agentNodeIds,
    setAgentNodeIds,
  };
}
