import { useState } from "react";
import { useTranslation } from "react-i18next";
import ScenarioForm from "../components/ScenarioForm";
import AdviceCard from "../components/AdviceCard";
import { useWhatIf, type WhatIfScenario } from "../api/hooks";
import type { Rec } from "../api/adapters";
import { ksh, pct } from "../lib/format";

// Helper function to calculate restock totals
const restockTotal = (r: Rec) =>
  r.restock
    ? r.restock.add_cash_ksh + r.restock.add_float_ksh +
      r.restock.bank_cash_ksh + r.restock.bank_float_ksh
    : 0;

// Helper function to transform backend data into advice card format
const toCard = (r: Rec, lang: "sw" | "en") => ({
  text: lang === "sw" ? r.plain_text_sw : r.plain_text_en,
  stockout_probability: r.stockout_probability,
  restock_amount_ksh: restockTotal(r),
  restock_day: r.restock?.weekday ?? "—",
  restock_kind: (r.restock?.kind ?? "cash") as any,
  verified: true,
  evidence: r.evidence as any,
});

export default function WhatIfPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  // Default scenario state
  const [scenario, setScenario] = useState<WhatIfScenario>({
    horizon_days: 14,
    events: [], // Start with an empty events array
  });

  // Fetch data from the backend using the `useWhatIf` hook
  const { data, isFetching, error } = useWhatIf(scenario);

  // Handle simulation input from the ScenarioForm
  const handleRunSimulation = (input: any) => {
    setScenario({
      market_day: input.market_day ?? input.market_days?.[0],
      demand_multiplier: input.demand_multiplier,
      events: input.events, // Use events dynamically provided by the user
      horizon_days: 14,
    });
  };

  const base = data?.baseline;
  const scen = data?.scenario;
  const delta = data?.delta;

  const riskPts = delta ? Math.round(delta.p_stockout_at_horizon_no_restock * 100) : null;
  const costDelta = delta?.expected_cost_ksh ?? null;
  const amtDelta = base && scen ? restockTotal(scen) - restockTotal(base) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("what_if.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("what_if.subtitle")}
        </p>
      </div>

      {/* Scenario Form */}
      <ScenarioForm onSimulate={handleRunSimulation} isCalculating={isFetching} />

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
          {(error as Error).message}
        </div>
      )}

      {/* Loading State */}
      {isFetching && !data && (
        <p className="text-sm text-slate-500">{t("what_if.loading")}</p>
      )}

      {/* Results */}
      {base && scen && delta && (
        <>
          {/* Assumptions Changed */}
          {data.assumptions_changed.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                {t("what_if.assumptions_changed")}
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300">
                {data.assumptions_changed.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Impact Comparison */}
          <div
            className={`rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 shadow-lg space-y-3 ${
              isFetching ? "opacity-60" : ""
            }`}
          >
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-300">
              {t("what_if.impact_comparison")}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Stockout Risk */}
              <div className="p-3 bg-white/10 rounded-xl border border-white/15">
                <span className="text-xs text-blue-200 block">
                  {t("what_if.stockout_risk")}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono">
                    {pct(scen.p_stockout_by_day_no_restock.at(-1) ?? 0)}
                  </span>
                  {riskPts !== null && (
                    <span
                      className={`text-xs font-semibold ${
                        riskPts > 0 ? "text-rose-300" : "text-emerald-300"
                      }`}
                    >
                      ({riskPts > 0 ? "+" : ""}
                      {riskPts} pts)
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-blue-300 block mt-0.5">
                  {t("what_if.baseline_stockout", {
                    value: pct(base.p_stockout_by_day_no_restock.at(-1) ?? 0),
                  })}
                </span>
              </div>

              {/* Expected Cost */}
              <div className="p-3 bg-white/10 rounded-xl border border-white/15">
                <span className="text-xs text-blue-200 block">
                  {t("what_if.expected_cost")}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono">
                    {ksh(scen.expected_cost_ksh)}
                  </span>
                  {costDelta !== null && costDelta !== 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        costDelta > 0 ? "text-amber-300" : "text-emerald-300"
                      }`}
                    >
                      ({costDelta > 0 ? "+" : "-"}
                      {ksh(Math.abs(costDelta))})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-blue-300 block mt-0.5">
                  {t("what_if.baseline_cost", {
                    value: ksh(base.expected_cost_ksh),
                  })}
                </span>
              </div>

              {/* Restock Timing */}
              <div className="p-3 bg-white/10 rounded-xl border border-white/15">
                <span className="text-xs text-blue-200 block">
                  {t("what_if.restock_timing")}
                </span>
                <div className="text-lg font-bold mt-1 text-yellow-300">
                  {scen.restock
                    ? `${scen.restock.weekday} · ${ksh(restockTotal(scen))}`
                    : t("what_if.no_restock")}
                </div>
                <span className="text-[11px] text-blue-300 block mt-0.5">
                  {t("what_if.baseline_restock", {
                    weekday: base.restock?.weekday ?? t("what_if.no_restock"),
                    amount: base.restock ? ksh(restockTotal(base)) : "",
                  })}
                  {amtDelta
                    ? ` (${amtDelta > 0 ? "+" : "-"}${ksh(Math.abs(amtDelta))})`
                    : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Side-by-Side Advice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("what_if.normal_baseline")}
              </span>
              <AdviceCard advice={toCard(base, lang)} />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {t("what_if.simulated_scenario")}
              </span>
              <AdviceCard advice={toCard(scen, lang)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}