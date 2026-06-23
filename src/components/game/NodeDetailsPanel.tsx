import React, { useState, useEffect } from "react";
import { GameNode, GameConnection } from "../GameMap";

interface NodeDetailsPanelProps {
  selectedNode: GameNode | null;
  targetNode: GameNode | null;
  activeUserAddress: string | null;
  pendingNodeRewards: Map<string, bigint>;
  nodes: GameNode[];
  selectedNodeConnections: GameConnection[];
  pendingRequestsToSelected: GameConnection[];
  placementCoords: { x: number; y: number } | null;
  setPlacementCoords: (coords: { x: number; y: number } | null) => void;
  calculateDynamicFee: (from: GameNode, to: GameNode) => {
    total: number;
    baseFee: number;
    connPremium: number;
    distPremium: number;
    distance: number;
  };
  executeClaimRewards: (nodeKeys: string[]) => void;
  executeRequestConnection: () => void;
  executeApproveConnection: (fromId: string) => void;
  executeNurtureConnection: (fromId: string, toId: string) => void;
  executeBoostConnection: (fromId: string, toId: string) => void;
  executePlaceNode: () => void;
}

export function formatAddress(addr: string) {
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

export function NodeDetailsPanel({
  selectedNode,
  targetNode,
  activeUserAddress,
  pendingNodeRewards,
  nodes,
  selectedNodeConnections,
  pendingRequestsToSelected,
  placementCoords,
  setPlacementCoords,
  calculateDynamicFee,
  executeClaimRewards,
  executeRequestConnection,
  executeApproveConnection,
  executeNurtureConnection,
  executeBoostConnection,
  executePlaceNode,
}: NodeDetailsPanelProps) {
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {selectedNode && (
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs text-white/40 uppercase tracking-widest">
                Selected Node
              </span>
              <span className="text-lg font-bold text-white tracking-tight">
                Coordinate ({selectedNode.x}, {selectedNode.y})
              </span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase()
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}
            >
              {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase()
                ? "You"
                : "Other Player"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/50">Owner Address</span>
              <span className="font-mono text-white/80">
                {formatAddress(selectedNode.owner)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Connections</span>
              <span className="font-bold text-white">
                {selectedNode.connectionsCount}
              </span>
            </div>
            {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() && (() => {
              const pendingWei = pendingNodeRewards.get(selectedNode.id) ?? 0n;
              const pendingEth = Number(pendingWei) / 1e18;
              return (
                <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/10">
                  <div className="flex flex-col">
                    <span className="text-white/50">Unclaimed Rewards</span>
                    <span className="text-[10px] text-white/30">Pool share by connections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${pendingEth > 0 ? 'text-yellow-300' : 'text-white/40'}`}>
                      {pendingEth > 0 ? `${pendingEth.toFixed(6)} ETH` : '—'}
                    </span>
                    {pendingEth > 0 && (
                      <button
                        onClick={() => executeClaimRewards([selectedNode.id])}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 transition-all"
                      >
                        Claim
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() && targetNode && (
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-white/40 uppercase">
                  Requesting connection to:
                </span>
                <span className="text-xs font-bold">
                  Node ({targetNode.x}, {targetNode.y})
                </span>
                <span className="text-[10px] text-white/60">
                  Owner: {formatAddress(targetNode.owner)}
                </span>
                {(() => {
                  const feeInfo = calculateDynamicFee(selectedNode, targetNode);
                  const expectedReward = feeInfo.total * 0.50;
                  return (
                    <div className="mt-2 text-[10px] text-white/50 flex flex-col gap-0.5 border-t border-white/5 pt-2">
                      <div className="flex justify-between">
                        <span>Base Fee:</span>
                        <span>{feeInfo.baseFee.toFixed(6)} ETH</span>
                      </div>
                      {feeInfo.distPremium > 0 && (
                        <div className="flex justify-between text-blue-300">
                          <span>Distance Premium (x{feeInfo.distance}):</span>
                          <span>+{feeInfo.distPremium.toFixed(6)} ETH</span>
                        </div>
                      )}
                      {feeInfo.connPremium > 0 && (
                        <div className="flex justify-between text-emerald-300">
                          <span>Popularity Disparity Premium:</span>
                          <span>+{feeInfo.connPremium.toFixed(6)} ETH</span>
                        </div>
                      )}
                      <div className="flex justify-between text-white font-bold mt-1 border-t border-white/10 pt-1 text-xs">
                        <span>Total Connection Cost:</span>
                        <span className="text-blue-400">{feeInfo.total.toFixed(6)} ETH</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-semibold mt-0.5">
                        <span>Reward Pool Contribution:</span>
                        <span>+{expectedReward.toFixed(6)} ETH (50% → pool)</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={executeRequestConnection}
                className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button glass-button-primary"
              >
                Request Link
              </button>
            </div>
          )}

          {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() &&
            pendingRequestsToSelected.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                  Incoming Request Links
                </span>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {pendingRequestsToSelected.map((req) => {
                    const fromNodeObj = nodes.find((n) => n.id === req.from);
                    if (!fromNodeObj) return null;
                    return (
                      <div
                        key={req.from}
                        className="bg-white/5 border border-white/5 p-3 rounded-xl flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white/80">
                            Node ({fromNodeObj.x}, {fromNodeObj.y})
                          </span>
                          <span className="text-[10px] text-white/40">
                            {formatAddress(fromNodeObj.owner)}
                          </span>
                        </div>
                        <button
                          onClick={() => executeApproveConnection(req.from)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider glass-button glass-button-success"
                        >
                          Approve (+50% Fee)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {selectedNode.owner.toLowerCase() === activeUserAddress?.toLowerCase() &&
            selectedNodeConnections.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                  Active Connections
                </span>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedNodeConnections.map((conn) => {
                    const otherNodeId = conn.from === selectedNode.id ? conn.to : conn.from;
                    const otherNode = nodes.find((n) => n.id === otherNodeId);
                    if (!otherNode) return null;

                    const lastNurtured = conn.lastNurturedAt || 0;
                    const expiryTime = lastNurtured + 86400; // 1 day
                    const timeLeft = expiryTime - currentTime;
                    const isDecayed = timeLeft <= 0;

                    const distance = Math.abs(otherNode.x - selectedNode.x) + Math.abs(otherNode.y - selectedNode.y);
                    const nurtureCost = 0.000002 + distance * 0.0000002;
                    const boostCost = 0.000005 + distance * 0.0000005;

                    return (
                      <div
                        key={otherNodeId}
                        className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                          isDecayed
                            ? "bg-red-950/20 border-red-500/20"
                            : "bg-white/5 border-white/5 hover:border-white/10"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white/80">
                              Node ({otherNode.x}, {otherNode.y})
                            </span>
                            <span className="text-[10px] text-white/40">
                              Distance: {distance} cells • Multiplier: {((conn.boostMultiplier || 100) / 100).toFixed(1)}x
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              isDecayed
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {isDecayed ? "Decayed" : "Active"}
                          </span>
                        </div>

                        <div className="text-[10px] text-white/60">
                          {isDecayed ? (
                            <span className="text-red-400 font-medium">Inactive: nurture to restore data stream flow</span>
                          ) : (
                            <span>
                              Expiry: {Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m {Math.floor(timeLeft % 60)}s
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => executeNurtureConnection(conn.from, conn.to)}
                            className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider glass-button glass-button-success"
                          >
                            Nurture ({nurtureCost.toFixed(6)} ETH)
                          </button>
                          {(conn.boostMultiplier || 100) < 300 && (
                            <button
                              onClick={() => executeBoostConnection(conn.from, conn.to)}
                              className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider glass-button glass-button-primary"
                            >
                              Boost ({boostCost.toFixed(6)} ETH)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      )}

      {placementCoords && (
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border-emerald-500/30 mb-4">
          <div className="flex flex-col">
            <span className="text-xs text-emerald-400 uppercase tracking-widest font-bold">
              Place New Node
            </span>
            <span className="text-lg font-bold text-white tracking-tight">
              Coordinate ({placementCoords.x}, {placementCoords.y})
            </span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Placing a node secures your territory. Once placed, other players can pay you to connect to it.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPlacementCoords(null)}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button"
            >
              Cancel
            </button>
            <button
              onClick={executePlaceNode}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider glass-button glass-button-success"
            >
              Confirm (0.00001 ETH)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
