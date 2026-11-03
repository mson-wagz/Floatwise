import { ksh, pct } from "../lib/format";
import type { DayForecast } from "../lib/engine";

interface ForecastChartProps {
  days: DayForecast[];
  horizonDays?: number;
}

export default function ForecastChart({ days }: ForecastChartProps) {
  if (!days || days.length === 0) return null;

  const maxVal = Math.max(
    ...days.map((d) => Math.max(d.cash_p90_ksh, d.float_p90_ksh, 80000))
  );

  return (
    <div className="space-y-6">
      {/* Visual Day-by-Day Forecast Timeline */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              7-Day Balance & Stockout Risk Trajectory
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Coupled cash in till (green) vs phone float (teal) if no restocking takes place.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
              Cash Drawer
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded bg-teal-500 inline-block"></span>
              M-Pesa Float
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
              Stockout Risk
            </span>
          </div>
        </div>

        {/* Multi-day comparison cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {days.map((d, idx) => {
            const riskPct = d.p_stockout_by_this_day;
            const isHighRisk = riskPct >= 0.4;
            const isCritical = riskPct >= 0.6;

            const cashBarHeight = Math.min(100, Math.max(12, Math.round((d.cash_p50_ksh / maxVal) * 100)));
            const floatBarHeight = Math.min(100, Math.max(12, Math.round((d.float_p50_ksh / maxVal) * 100)));

            return (
              <div
                key={d.date}
                className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                  isCritical
                    ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/30"
                    : isHighRisk
                    ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {idx === 0 ? "Today" : d.weekday.slice(0, 3)}
                    </span>
                    <span className="text-[10px] text-slate-500">{d.date.slice(5)}</span>
                  </div>

                  {d.is_market_day && (
                    <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                      Market Day
                    </span>
                  )}
                  {d.event_label && (
                    <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {d.event_label}
                    </span>
                  )}
                </div>

                {/* Visual Bar representation */}
                <div className="h-28 flex items-end justify-center gap-2 my-3 px-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                  {/* Cash Bar */}
                  <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400">
                      {Math.round(d.cash_p50_ksh / 1000)}k
                    </span>
                    <div
                      style={{ height: `${cashBarHeight}%` }}
                      className="w-full bg-emerald-500 rounded-t-md transition-all shadow-sm"
                      title={`Cash Median: ${ksh(d.cash_p50_ksh)} (Cone: ${ksh(d.cash_p10_ksh)} - ${ksh(d.cash_p90_ksh)})`}
                    ></div>
                  </div>

                  {/* Float Bar */}
                  <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[9px] font-mono text-teal-700 dark:text-teal-400">
                      {Math.round(d.float_p50_ksh / 1000)}k
                    </span>
                    <div
                      style={{ height: `${floatBarHeight}%` }}
                      className="w-full bg-teal-500 rounded-t-md transition-all shadow-sm"
                      title={`Float Median: ${ksh(d.float_p50_ksh)} (Cone: ${ksh(d.float_p10_ksh)} - ${ksh(d.float_p90_ksh)})`}
                    ></div>
                  </div>
                </div>

                {/* Stockout Risk Indicator */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Stockout</span>
                    <span
                      className={`font-bold ${
                        isCritical
                          ? "text-rose-600 dark:text-rose-400"
                          : isHighRisk
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {pct(riskPct)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.round(riskPct * 100)}%` }}
                      className={`h-full rounded-full ${
                        isCritical ? "bg-rose-500" : isHighRisk ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
