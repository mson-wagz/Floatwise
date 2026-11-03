import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdviceCard from "../components/AdviceCard";
import ForecastChart from "../components/ForecastChart";
import { useForecast, useRecommendation } from "../api/hooks";
import { useShop } from "../lib/shop";
import { ksh } from "../lib/format";

export default function ForecastPage() {
  const { i18n } = useTranslation();
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const { data: shop } = useShop();
  const forecast = useForecast(horizon);
  const rec = useRecommendation(horizon);

  const error = (forecast.error ?? rec.error) as Error | null;
  const loading = forecast.isLoading || rec.isLoading || !shop;
  const r = rec.data;

  const horizonButton = (h: 7 | 14) => (
    <button
      onClick={() => setHorizon(h)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        horizon === h
          ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
      }`}
    >
      {h} Days Ahead
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Restock Forecast & Queue Trajectory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulated over {horizon} days from your current drawer and M-Pesa balances.
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
          {horizonButton(7)}
          {horizonButton(14)}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
          {error.message}
        </div>
      )}

      {loading && !error && <p className="text-sm text-slate-500">Running simulation…</p>}

      {!loading && !error && forecast.data && r && shop && (
        <>
          <AdviceCard
            advice={{
              text: lang === "sw" ? r.plain_text_sw : r.plain_text_en,
              stockout_probability: r.stockout_probability,
              restock_amount_ksh: r.restock
                ? r.restock.add_cash_ksh +
                  r.restock.add_float_ksh +
                  r.restock.bank_cash_ksh +
                  r.restock.bank_float_ksh
                : 0,
              restock_day: r.restock?.weekday ?? "—",
              restock_kind: (r.restock?.kind ?? "cash") as any,
              verified: true,
              evidence: r.evidence as any,
            }}
          />

          <ForecastChart days={forecast.data.days as any} horizonDays={horizon} />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stockout means: at least one customer turned away. The forecast assumes no
            restocking, so it shows what happens if you do nothing.
          </p>
        </>
      )}

      {/* Explainer */}
      {shop && (
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
                Total float capital ({ksh(shop.cash_ksh + shop.float_ksh)}) never changes from
                ordinary customer visits. It only shifts between till and phone.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}