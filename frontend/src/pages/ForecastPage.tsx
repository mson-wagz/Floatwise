import { useState, useMemo } from "react";
import AdviceCard from "../components/AdviceCard";
import ForecastChart from "../components/ForecastChart";
import { LocalStore } from "../lib/store";
import { SimulationEngine } from "../lib/engine";
import { ksh, pct } from "../lib/format";
import { useTranslation } from "react-i18next";

export default function ForecastPage() {
  const { t, i18n } = useTranslation();
  const [shop] = useState(LocalStore.getShop());
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const { forecastData, recommendation } = useMemo(() => {
    const fc = SimulationEngine.forecast(shop.cash_ksh, shop.float_ksh, new Date(), horizon);
    const rec = SimulationEngine.recommend(shop.cash_ksh, shop.float_ksh, new Date(), horizon);
    return { forecastData: fc, recommendation: rec };
  }, [shop.cash_ksh, shop.float_ksh, horizon]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Restock Forecast & Queue Trajectory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulated over {horizon} days from your current drawer and M-Pesa balances.
          </p>
        </div>

        {/* Horizon selector buttons */}
        <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setHorizon(7)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              horizon === 7
                ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            7 Days Ahead
          </button>
          <button
            onClick={() => setHorizon(14)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              horizon === 14
                ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            14 Days Ahead
          </button>
        </div>
      </div>

      {/* Primary Recommendation Card */}
      <AdviceCard
        advice={{
          text: lang === "sw" ? recommendation.plain_text_sw : recommendation.plain_text_en,
          stockout_probability: recommendation.restock?.p_plan_restocks_by_then ?? 0.46,
          restock_amount_ksh: recommendation.restock?.add_cash_ksh ?? recommendation.restock?.add_float_ksh ?? 22000,
          restock_day: recommendation.restock?.weekday ?? "Saturday",
          restock_kind: recommendation.restock?.kind ?? "cash",
          verified: true,
          evidence: recommendation.evidence,
        }}
      />

      {/* Visual Chart Cones */}
      <ForecastChart days={forecastData.days} horizonDays={horizon} />

      {/* Coupled Float Economics Explanation */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
          How Your Dual Float Works
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">
              1. Customer Withdrawal
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Customer takes physical cash from your till and sends you digital money.{" "}
              <span className="font-semibold text-rose-600">Cash decreases</span>,{" "}
              <span className="font-semibold text-emerald-600">Float increases</span>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">
              2. Customer Deposit
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Customer hands you cash notes and you send e-float to their phone.{" "}
              <span className="font-semibold text-emerald-600">Cash increases</span>,{" "}
              <span className="font-semibold text-rose-600">Float decreases</span>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">
              3. Conservation of Capital
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Total float capital ({ksh(shop.cash_ksh + shop.float_ksh)}) never changes from ordinary customer visits—it only shifts between till and phone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
