import React from "react";

interface HeaderProps {
  appMode: "demo" | "simulation" | "live";
  setAppMode: (val: "demo" | "simulation" | "live") => void;
  onExportAboutText: () => void;
}

export function Header({ appMode, setAppMode, onExportAboutText }: HeaderProps) {
  return (
    <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
      {/* Brand */}
      <div className="flex flex-col gap-1 pointer-events-auto bg-[#050511]/45 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 neon-text-blue">
          BUBBLES
        </h1>
        <p className="text-xs text-blue-200/50 uppercase tracking-widest font-semibold">
          Base L2 Civilization Game
        </p>
        <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 w-fit">
          🚧 UNDER CONSTRUCTION
        </div>
      </div>

      {/* Action Controls & Wallet Connect */}
      <div className="flex flex-col items-end gap-3 pointer-events-auto z-50">
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl">
          <a
            href="https://github.com/3esign/bubblebase"
            target="_blank"
            rel="noreferrer"
            className="text-gray-400 hover:text-white transition-colors text-sm font-semibold flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
          <div className="w-px h-4 bg-white/20"></div>
          <button
            onClick={onExportAboutText}
            className="text-gray-400 hover:text-white transition-colors text-sm font-semibold"
          >
            About
          </button>
          <div className="w-px h-4 bg-white/20"></div>
          <button
            onClick={() => setAppMode("demo")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              appMode === "demo"
                ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Demo Mode
          </button>
          <button
            onClick={() => setAppMode("simulation")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              appMode === "simulation"
                ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Simulation Mode
          </button>
          <button
            onClick={() => setAppMode("live")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              appMode === "live"
                ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Live Network
          </button>
        </div>

        {appMode === "live" && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl">
            <button
              disabled
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 cursor-not-allowed bg-white/5"
            >
              Wallet Disabled (Construction)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
