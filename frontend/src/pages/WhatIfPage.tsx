import { useState, useMemo } from "react";
import ScenarioForm from "../components/ScenarioForm";
import AdviceCard from "../components/AdviceCard";
import { LocalStore } from "../lib/store";
import { SimulationEngine, type WhatIfScenarioInput } from "../lib/engine";
import { ksh, pct } from "../lib/format";
import { useTranslation } from "react-i18next";

export default function WhatIfPage() {
  const { i18n } = useTranslation();
  const [shop] = useState(LocalStore.getShop());
  const [scenario, setScenario] = useState<WhatIfScenarioInput>({
    events: [
      {
        date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        multiplier: 2.2,
        label: "School Fees Deadline",
      },
    ],
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const baseline = useMemo(() => {
    return SimulationEngine.recommend(shop.cash_ksh, shop.float_ksh, new Date(), 14, {});
  }, [shop.cash_ksh, shop.float_ksh]);

  const simulated = useMemo(() => {
    return SimulationEngine.recommend(shop.cash_ksh, shop.float_ksh, new Date(), 14, scenario);
  }, [shop.cash_ksh, shop.float_ksh, scenario]);

  const handleRunSimulation = (newScenario: WhatIfScenarioInput) => {
    setIsSimulating(true);
    setScenario(newScenario);
    setTimeout(() => {
      setIsSimulating(false);
    }, 300);
  };

  const baseRisk = baseline.restock?.p_plan_restocks_by_then ?? 0.46;
  const scenRisk = simulated.restock?.p_plan_restocks_by_then ?? 0.78;
  const riskDiff = Math.round((scenRisk - baseRisk) * 100);

  const baseAmt = baseline.restock?.add_cash_ksh ?? 22000;
  const scenAmt = simulated.restock?.add_cash_ksh ?? 36000;
  const amtDiff = scenAmt - baseAmt;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          What-If Scenario Simulator
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          "What if school fees are on Thursday?" — Test special events and see your restocking advice adapt in real time.
        </p>
      </div>

      {/* Scenario Input Controls */}
      <ScenarioForm onSimulate={handleRunSimulation} isCalculating={isSimulating} />

      {/* Delta Impact Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 shadow-lg space-y-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-blue-300">
          Impact Comparison: Scenario vs Normal Baseline
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <span className="text-xs text-blue-200 block">Stockout Risk Change</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono">
                {pct(scenRisk)}
              </span>
              <span className={`text-xs font-semibold ${riskDiff >= 0 ? "text-rose-300" : "text-emerald-300"}`}>
                ({riskDiff >= 0 ? `+${riskDiff}% higher` : `${riskDiff}% lower`})
              </span>
            </div>
            <span className="text-[11px] text-blue-300 block mt-0.5">
              Normal baseline was {pct(baseRisk)}
            </span>
          </div>

          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <span className="text-xs text-blue-200 block">Cash Needed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono">
                {ksh(scenAmt)}
              </span>
              {amtDiff !== 0 && (
                <span className={`text-xs font-semibold ${amtDiff > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  ({amtDiff > 0 ? `+${ksh(amtDiff)}` : `-${ksh(Math.abs(amtDiff))}`})
                </span>
              )}
            </div>
            <span className="text-[11px] text-blue-300 block mt-0.5">
              Normal target was {ksh(baseAmt)}
            </span>
          </div>

          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <span className="text-xs text-blue-200 block">Restock Timing</span>
            <div className="text-lg font-bold mt-1 text-yellow-300">
              {simulated.restock?.weekday ? `${simulated.restock.weekday} morning` : "No restock"}
            </div>
            <span className="text-[11px] text-blue-300 block mt-0.5">
              Baseline was {baseline.restock?.weekday ?? "Saturday"}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Normal Baseline (Without Event)
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Current
            </span>
          </div>
          <AdviceCard
            advice={{
              text: lang === "sw" ? baseline.plain_text_sw : baseline.plain_text_en,
              stockout_probability: baseRisk,
              restock_amount_ksh: baseAmt,
              restock_day: baseline.restock?.weekday ?? "Saturday",
              restock_kind: "cash",
              verified: true,
              evidence: baseline.evidence,
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Simulated Scenario Advice
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
              Active What-If
            </span>
          </div>
          <AdviceCard
            advice={{
              text: lang === "sw" ? simulated.plain_text_sw : simulated.plain_text_en,
              stockout_probability: scenRisk,
              restock_amount_ksh: scenAmt,
              restock_day: simulated.restock?.weekday ?? "Thursday",
              restock_kind: "cash",
              verified: true,
              evidence: simulated.evidence,
            }}
          />
        </div>
      </div>
    </div>
  );
}
