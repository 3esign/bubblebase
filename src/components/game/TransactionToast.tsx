import React from "react";

interface TransactionToastProps {
  pendingTx: boolean;
  txMessage: string;
}

export function TransactionToast({ pendingTx, txMessage }: TransactionToastProps) {
  if (!pendingTx) return null;

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col items-center gap-4 text-center border-orange-500/30 mb-4">
      <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
          Transaction Pending
        </span>
        <span className="text-xs text-white/60">{txMessage}</span>
      </div>
    </div>
  );
}
