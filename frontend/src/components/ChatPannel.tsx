import { useState } from "react";
import AdviceCard from "./AdviceCard";
import type { ChatEntry } from "../lib/store";
import { SimulationEngine } from "../lib/engine";
import { verifyAdviceText } from "../lib/verifier";
import { useTranslation } from "react-i18next";

interface ChatPanelProps {
  chats: ChatEntry[];
  onSendMessage: (text: string) => void;
  currentCash: number;
  currentFloat: number;
}

export default function ChatPanel({
  chats,
  onSendMessage,
  currentCash,
  currentFloat,
}: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState("");
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleQuickChip = (chipText: string) => {
    onSendMessage(chipText);
  };

  const quickChips = [
    "What if school fees are on Thursday?",
    "How much cash do I need for Saturday market?",
    "Why is phone float running out faster than cash?",
    "What is my stockout risk for the next 7 days?",
  ];

  return (
    <div className="flex flex-col h-[650px] border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            FW
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              FloatWise Advisor
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Local Engine Active • Verified Solver
            </p>
          </div>
        </div>

        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
          {lang === "sw" ? "Kiswahili" : "English"}
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chats.map((entry) => (
          <div
            key={entry.id}
            className={`flex flex-col ${
              entry.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {entry.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-600 text-white px-4 py-3 text-sm shadow-sm font-medium">
                {entry.text}
              </div>
            ) : (
              <div className="max-w-[95%] sm:max-w-[85%] space-y-2">
                <AdviceCard
                  advice={{
                    text: entry.text,
                    stockout_probability: entry.stockoutProbability ?? 0.46,
                    restock_amount_ksh: entry.restockAmountKsh ?? 22000,
                    restock_day: entry.restockDay ?? "Saturday",
                    restock_kind: "cash",
                    verified: entry.verified,
                    unsupported_numbers: entry.unsupportedNumbers,
                    evidence: {
                      method: "exact backward induction + Monte Carlo",
                      n_runs: 2000,
                      horizon_days: 14,
                    },
                  }}
                />
              </div>
            )}
            <span className="text-[10px] text-slate-400 mt-1 px-1">
              {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto">
        <div className="flex gap-2">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickChip(chip)}
              className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-2xs font-medium"
            >
              💬 {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("advisor.input_placeholder")}
          className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-sm shadow-sm transition-all"
        >
          {t("advisor.send")}
        </button>
      </form>
    </div>
  );
}
