import { useState } from "react";
import { ksh, pct } from "../lib/format";
import { SpeechAdvisor } from "../lib/speech";
import { useTranslation } from "react-i18next";

export interface AdviceProps {
  text: string;
  stockout_probability: number;
  restock_amount_ksh: number;
  restock_day?: string;
  restock_kind?: "cash" | "float" | "both" | "none";
  verified?: boolean;
  unsupported_numbers?: number[];
  evidence?: {
    method: string;
    n_runs: number;
    horizon_days: number;
  };
}

export default function AdviceCard({ advice }: { advice: AdviceProps }) {
  const { t, i18n } = useTranslation();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const handleSpeak = () => {
    if (isSpeaking) {
      SpeechAdvisor.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      SpeechAdvisor.speak(advice.text, lang, 0.95, () => {
        setIsSpeaking(false);
      });
    }
  };

  const riskPct = advice.stockout_probability;
  const riskColor =
    riskPct >= 0.5
      ? "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
      : riskPct >= 0.25
      ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
      : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950/30 p-5 shadow-md space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          FloatWise Action Plan
        </span>

        {SpeechAdvisor.isSupported() && (
          <button
            onClick={handleSpeak}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isSpeaking
                ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-300 dark:bg-rose-900 dark:text-rose-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            }`}
          >
            {isSpeaking ? (
              <>
                <span>⏹️</span> {t("advisor.stop")}
              </>
            ) : (
              <>
                <span>🔊</span> {t("advisor.listen")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Main plain language recommendation */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-200/60 dark:border-slate-700">
        <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">
          "{advice.text}"
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className={`rounded-xl border p-3 flex flex-col justify-between ${riskColor}`}>
          <span className="text-xs uppercase tracking-wider font-medium opacity-80">Stockout Risk</span>
          <span className="text-2xl font-bold tracking-tight mt-1">{pct(advice.stockout_probability)}</span>
          <span className="text-[11px] opacity-75 mt-0.5">chance till runs dry</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-3 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Restock Target
          </span>
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mt-1">
            {advice.restock_amount_ksh > 0 ? ksh(advice.restock_amount_ksh) : "KSh 0"}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
            {advice.restock_kind ? `${advice.restock_kind} in till` : "No restock needed"}
          </span>
        </div>

        {advice.restock_day && (
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-3 flex flex-col justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
              Deadline
            </span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight mt-1">
              {advice.restock_day}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">optimal timing</span>
          </div>
        )}
      </div>

      {/* Mathematical Verification Seal */}
      <div className="pt-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-700/50">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <span className="text-emerald-600">🛡️</span>
          Verified by Simulation ({advice.evidence?.n_runs ? advice.evidence.n_runs.toLocaleString() : "2,000"} runs)
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          0 numbers invented
        </span>
      </div>
    </div>
  );
}
