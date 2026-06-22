import React, { useState } from 'react';
import { AgentConfig, LogEntry } from '../hooks/useAgentLoop';

interface AgentDashboardProps {
  isRunning: boolean;
  startAgent: () => void;
  stopAgent: () => void;
  budget: number;
  setBudget: (b: number) => void;
  spent: number;
  logs: LogEntry[];
  clearLogs: () => void;
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}

export function AgentDashboard({
  isRunning,
  startAgent,
  stopAgent,
  budget,
  setBudget,
  spent,
  logs,
  clearLogs,
  config,
  setConfig,
}: AgentDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'config' | 'prompt' | 'budget' | 'logs'>('config');

  const updateConfig = (key: keyof AgentConfig, value: any) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-set common models if provider changes
      if (key === 'provider') {
        if (value === 'openai') updated.model = 'gpt-4o-mini';
        else if (value === 'gemini') updated.model = 'gemini-1.5-flash';
        else if (value === 'anthropic') updated.model = 'claude-3-5-sonnet-20241022';
        else if (value === 'ollama') updated.model = 'llama3';
        else updated.model = 'local-heuristic';
      }
      return updated;
    });
  };

  const budgetProgress = Math.min((spent / budget) * 100, 100);

  return (
    <div className={`fixed left-6 top-24 z-50 transition-all duration-300 ${isOpen ? 'w-[420px]' : 'w-12 h-12'}`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-xl bg-[#0a0b1e]/90 border border-[#8b5cf6]/40 flex items-center justify-center text-white hover:bg-[#8b5cf6]/20 hover:scale-105 transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
          title="Open AI Agent Panel"
          id="agent-dashboard-open-btn"
        >
          <span className="relative flex h-3 w-3">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
          </span>
        </button>
      ) : (
        <div className="bg-[#050511]/90 backdrop-blur-xl border border-[#8b5cf6]/30 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(139,92,246,0.15)] flex flex-col max-h-[600px]">
          {/* Header */}
          <div className="p-4 border-b border-[#8b5cf6]/20 bg-gradient-to-r from-[#0d0a21] to-[#050511] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] animate-pulse" />
              <h2 className="text-sm font-semibold tracking-wider text-white uppercase bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                AI Civilization Agent
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isRunning ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                {isRunning ? 'RUNNING' : 'INACTIVE'}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                id="agent-dashboard-close-btn"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="px-4 py-3 bg-[#0d0a21]/50 border-b border-[#8b5cf6]/10 flex gap-2">
            {!isRunning ? (
              <button
                onClick={startAgent}
                className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#9d76fa] hover:to-[#7579ff] text-white text-xs font-bold tracking-wide shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                id="agent-start-btn"
              >
                DEPLOY AUTONOMOUS LOOP
              </button>
            ) : (
              <button
                onClick={stopAgent}
                className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-xs font-bold tracking-wide shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                id="agent-stop-btn"
              >
                HALT AGENT EXECUTION
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#8b5cf6]/10 bg-[#070716] text-[11px] font-semibold">
            {(['config', 'prompt', 'budget', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-center border-b-2 uppercase tracking-wider transition-all ${
                  activeTab === tab
                    ? 'border-[#8b5cf6] text-[#c084fc] bg-[#8b5cf6]/5'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                {tab === 'config' ? 'Setup' : tab}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="p-4 flex-1 overflow-y-auto text-xs text-gray-300">
            {activeTab === 'config' && (
              <div className="space-y-4">
                {/* Provider Selector */}
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">AI Provider</label>
                  <select
                    value={config.provider}
                    onChange={(e) => updateConfig('provider', e.target.value)}
                    className="w-full bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors"
                  >
                    <option value="demo">Demo Mode (Local Heuristics)</option>
                    <option value="openai">OpenAI (ChatGPT API)</option>
                    <option value="gemini">Google Gemini API</option>
                    <option value="anthropic">Anthropic Claude API</option>
                    <option value="ollama">Ollama (Local LLM)</option>
                  </select>
                </div>

                {/* API Key (if not demo mode) */}
                {config.provider !== 'demo' && (
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">
                      API Key {config.provider === 'ollama' && '(Optional)'}
                    </label>
                    <input
                      type="password"
                      placeholder={config.provider === 'ollama' ? 'e.g. not required' : 'Enter provider API key'}
                      value={config.apiKey}
                      onChange={(e) => updateConfig('apiKey', e.target.value)}
                      className="w-full bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors"
                    />
                  </div>
                )}

                {/* Model Selector */}
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Model Identifier</label>
                  <input
                    type="text"
                    placeholder="Enter model string"
                    value={config.model}
                    onChange={(e) => updateConfig('model', e.target.value)}
                    className="w-full bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Strategy Selector */}
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">Base Strategy</label>
                    <select
                      value={config.strategy}
                      onChange={(e) => updateConfig('strategy', e.target.value)}
                      className="w-full bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors"
                    >
                      <option value="expansionist">Expansionist</option>
                      <option value="maintainer">Maintainer</option>
                      <option value="aggressive">Aggressive</option>
                      <option value="defensive">Defensive</option>
                    </select>
                  </div>

                  {/* Frequency Slider */}
                  <div>
                    <label className="block text-gray-400 mb-1 font-medium">Tick Frequency</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="5"
                        max="120"
                        value={config.frequency}
                        onChange={(e) => updateConfig('frequency', parseInt(e.target.value))}
                        className="w-full accent-[#8b5cf6] cursor-pointer"
                      />
                      <span className="text-[10px] text-white font-mono w-8">{config.frequency}s</span>
                    </div>
                  </div>
                </div>

                {/* Risk Parameter Slider */}
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Risk Appetite ({config.risk}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.risk}
                    onChange={(e) => updateConfig('risk', parseInt(e.target.value))}
                    className="w-full accent-[#8b5cf6] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Conservative (Nurture-only)</span>
                    <span>Aggressive (Overclock Spawns)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Agent System Prompt</label>
                  <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                    Modify the directives dictating the Agent's strategic thinking process, priorities, and grid interactions.
                  </p>
                  <textarea
                    rows={12}
                    value={config.systemPrompt}
                    onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                    className="w-full bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2.5 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors font-mono text-[10px] leading-normal resize-none"
                    placeholder="Describe agent personality and strategy instructions..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'budget' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Wallet Delegation Soft Cap</label>
                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                    Set a safety cap for simulated spending. Since we operate via soft delegation, the agent stops if this threshold is hit. The user signs actual transactions when prompted.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={budget}
                      onChange={(e) => setBudget(parseFloat(e.target.value) || 0.05)}
                      className="bg-[#0a0a20] border border-[#8b5cf6]/20 rounded-lg p-2 text-white outline-none focus:border-[#8b5cf6]/60 transition-colors w-24 text-center font-mono"
                    />
                    <span className="text-white font-bold">ETH</span>
                  </div>
                </div>

                <div className="bg-[#0a0a20]/60 border border-[#8b5cf6]/10 rounded-xl p-3.5 space-y-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Total Spent:</span>
                    <span className="text-white font-mono">{spent.toFixed(4)} / {budget.toFixed(4)} ETH</span>
                  </div>

                  {/* Custom progress bar */}
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${budgetProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                    <span>0% SPENT</span>
                    <span>100% BUDGET CAP</span>
                  </div>
                </div>

                <div className="border border-yellow-600/30 bg-yellow-900/10 rounded-lg p-3 text-[10px] text-yellow-400 leading-normal">
                  ⚠️ <strong>Security Disclaimer:</strong> BubbleBase uses a soft budget cap model. The agent creates transactions, but your connected wallet (e.g. MetaMask / Rabby) will prompt you to confirm each signature.
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="flex flex-col h-[280px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 font-medium">Activity Logs</span>
                  <button
                    onClick={clearLogs}
                    className="text-[10px] text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    Clear History
                  </button>
                </div>

                <div className="flex-1 bg-[#050511] border border-[#8b5cf6]/15 rounded-lg p-2 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin">
                  {logs.length === 0 ? (
                    <div className="text-gray-600 text-center py-12 italic">No actions recorded. Start the agent loop to populate logs.</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="leading-relaxed border-b border-gray-900/40 pb-1">
                        <span className="text-gray-600 mr-1.5">[{log.timestamp}]</span>
                        <span
                          className={
                            log.type === 'success'
                              ? 'text-green-400'
                              : log.type === 'warning'
                              ? 'text-yellow-500 font-semibold'
                              : log.type === 'error'
                              ? 'text-red-400 font-bold'
                              : 'text-blue-300'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
