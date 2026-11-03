import { useState } from "react";
import type { components } from "../api/schema";
import { ksh } from "../lib/format";
import ErrorBanner from "./ErrorBanner";

type Transaction = components["schemas"]["Transaction"];

interface TransactionTableProps {
  transactions: Transaction[];
  warnings?: string[];
  onConfirm: (confirmed: Transaction[]) => void;
  onReject: () => void;
  currentCash: number;
  currentFloat: number;
}

export default function TransactionTable({
  transactions: initialTxns,
  warnings = [],
  onConfirm,
  onReject,
  currentCash,
  currentFloat,
}: TransactionTableProps) {
  const [txns, setTxns] = useState<Transaction[]>(initialTxns);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  const handleRemove = (id: string) => {
    setTxns(txns.filter((t) => t.id !== id));
  };

  const handleToggleType = (id: string) => {
    setTxns(
      txns.map((t) => {
        if (t.id !== id) return t;
        const newType: Transaction["type"] = t.type === "withdrawal" ? "deposit" : "withdrawal";
        return {
          ...t,
          type: newType,
          cash_delta_ksh: newType === "withdrawal" ? -t.amount_ksh : t.amount_ksh,
          float_delta_ksh: newType === "withdrawal" ? t.amount_ksh : -t.amount_ksh,
        };
      })
    );
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditAmount(t.amount_ksh);
  };

  const saveEdit = (id: string) => {
    setTxns(
      txns.map((t) => {
        if (t.id !== id) return t;
        const amt = Math.max(0, editAmount);
        return {
          ...t,
          amount_ksh: amt,
          cash_delta_ksh: t.type === "withdrawal" ? -amt : amt,
          float_delta_ksh: t.type === "withdrawal" ? amt : -amt,
          anomaly_warning: undefined, // Cleared after user explicitly confirms/edits
        };
      })
    );
    setEditingId(null);
  };

  // Calculate totals
  const totalCashDelta = txns.reduce((sum, t) => sum + t.cash_delta_ksh, 0);
  const totalFloatDelta = txns.reduce((sum, t) => sum + t.float_delta_ksh, 0);
  const newCashEstimated = currentCash + totalCashDelta;
  const newFloatEstimated = currentFloat + totalFloatDelta;

  return (
    <div className="space-y-4">
      {/* Privacy and verification header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
          <span>🔒</span>
          <span>Privacy Protected: Names and phone numbers stripped from review payload.</span>
        </div>
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          {txns.length} Transactions Pending
        </span>
      </div>

      {/* Warnings & Anomalies Banner */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, idx) => (
            <ErrorBanner
              key={idx}
              title="Attention Needed"
              message={w}
              type="warning"
            />
          ))}
        </div>
      )}

      {/* Transactions List */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Cash Impact</th>
                <th className="px-4 py-3">Float Impact</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {txns.map((t) => (
                <tr
                  key={t.id}
                  className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                    t.anomaly_warning ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {t.source === "voice" ? "🎙️ Voice" : t.source === "ledger" ? "📖 Ledger" : "📱 SMS"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleType(t.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                        t.type === "withdrawal"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                          : "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200"
                      }`}
                      title="Tap to switch withdrawal / deposit"
                    >
                      {t.type === "withdrawal" ? "🔻 Customer Withdrawal" : "🔺 Customer Deposit"}
                      <span className="text-[10px] opacity-60">⇄</span>
                    </button>
                    {t.anomaly_warning && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                        {t.anomaly_warning}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 border-emerald-500 font-bold"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(t.id)}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded font-medium"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(t)}
                        className="cursor-pointer hover:underline decoration-emerald-500 decoration-2"
                        title="Click to edit amount"
                      >
                        {ksh(t.amount_ksh)}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs">
                    <span className={t.cash_delta_ksh < 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {t.cash_delta_ksh < 0 ? `-${ksh(Math.abs(t.cash_delta_ksh))}` : `+${ksh(t.cash_delta_ksh)}`}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs">
                    <span className={t.float_delta_ksh < 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {t.float_delta_ksh < 0 ? `-${ksh(Math.abs(t.float_delta_ksh))}` : `+${ksh(t.float_delta_ksh)}`}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(t.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 p-1 font-semibold"
                      title="Remove transaction"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Projected Impact Drawer Summary */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">Cash in Drawer Preview</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{ksh(currentCash)}</span>
              <span className="text-xs font-semibold text-slate-400">➔</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {ksh(newCashEstimated)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Net: {totalCashDelta >= 0 ? `+${ksh(totalCashDelta)}` : `-${ksh(Math.abs(totalCashDelta))}`}
            </p>
          </div>

          <div className="rounded-lg p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">M-Pesa Float Preview</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{ksh(currentFloat)}</span>
              <span className="text-xs font-semibold text-slate-400">➔</span>
              <span className="text-base font-bold text-teal-600 dark:text-teal-400">
                {ksh(newFloatEstimated)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Net: {totalFloatDelta >= 0 ? `+${ksh(totalFloatDelta)}` : `-${ksh(Math.abs(totalFloatDelta))}`}
            </p>
          </div>
        </div>
      </div>

      {/* Approve / Reject Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onReject}
          className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          Discard Batch
        </button>
        <button
          onClick={() => onConfirm(txns)}
          disabled={txns.length === 0}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <span>✓</span>
          <span>Approve & Apply to Drawer</span>
        </button>
      </div>
    </div>
  );
}
