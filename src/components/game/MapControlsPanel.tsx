import React from "react";

export function MapControlsPanel() {
  return (
    <div className="absolute bottom-6 left-6 w-80 flex flex-col gap-4 pointer-events-auto">
      <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
        <h3 className="text-sm font-bold text-blue-400 tracking-wide uppercase">
          Map Controls
        </h3>
        <ul className="text-xs space-y-2 text-white/70">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Drag background to pan view.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Scroll wheel to zoom.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Click empty grid coordinate to place Node.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Select your node, then click another to connect.
          </li>
        </ul>
        <div className="h-px bg-white/10 my-1"></div>
        <div className="flex flex-col gap-1 text-[10px] text-white/50">
          <div className="flex justify-between">
            <span>Node Cost:</span>
            <span className="text-white font-semibold">0.00001 ETH (~$0.03)</span>
          </div>
          <div className="flex justify-between">
            <span>Approval Reward:</span>
            <span className="text-emerald-400 font-semibold">Pool share (by connections)</span>
          </div>
          <div className="flex justify-between">
            <span>Connection Decay:</span>
            <span className="text-orange-400 font-semibold">24 hour lifetime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
