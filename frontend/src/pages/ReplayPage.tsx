import { useTranslation } from "react-i18next";
import { useReplay } from "../api/hooks";
import { ksh } from "../lib/format";

type Side = {
  expected_turned_away_customers: number;
  expected_days_with_a_stockout: number;
  expected_lost_commission_ksh: number;
  expected_customer_loss_ksh: number;
  restock_cost_ksh: number;
  total_cost_ksh: number;
};

type Daily = {
  date: string;
  weekday: string;
  actual_turned_away: number;
  plan_turned_away: number;
  actual_restock_cash_ksh: number;
  actual_restock_float_ksh: number;
  plan_expected_restock_cost_ksh: number;
};

type ReplayData = {
  period: { from: string; to: string; days: number };
  actual: Side;
  with_plan: Side;
  estimated_saving_ksh: number;
  saving_range_ksh: [number, number];
  daily: Daily[];
  method_note: string;
};

const ROWS: { label: string; key: keyof Side; money: boolean }[] = [
  { label: "Customers turned away", key: "expected_turned_away_customers", money: false },
  { label: "Days with a stockout", key: "expected_days_with_a_stockout", money: false },
  { label: "Lost commission", key: "expected_lost_commission_ksh", money: true },
  { label: "Customer loss (assumed)", key: "expected_customer_loss_ksh", money: true },
  { label: "Restocking cost", key: "restock_cost_ksh", money: true },
  { label: "Total cost", key: "total_cost_ksh", money: true },
];

export default function ReplayPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useReplay(30);
  const d = data as ReplayData | undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("replay.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("replay.subtitle")}
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Replaying your last 30 days…</p>}

      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300">
          {(error as Error).message}
        </div>
      )}

      {d && (
        <>
          {/* Headline saving */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 shadow-md">
            <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block">
              {d.period.from} to {d.period.to} ({d.period.days} days)
            </span>
            {d.estimated_saving_ksh > 0 ? (
              <>
                <span className="text-4xl font-black font-mono block mt-1">
                  {ksh(d.estimated_saving_ksh)}
                </span>
                <p className="text-sm opacity-90 mt-1">
                  Estimated saving if you had followed the plan. Likely range{" "}
                  {ksh(d.saving_range_ksh[0])} to {ksh(d.saving_range_ksh[1])}.
                </p>
              </>
            ) : (
              <p className="text-lg font-bold mt-1">
                Your actual restocking did about as well as the plan in this period.
              </p>
            )}
          </div>

          {/* Actual vs plan */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {t("replay.breakdown_title")}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Measure</th>
                    <th className="px-4 py-3">What you did</th>
                    <th className="px-4 py-3">With the plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.label}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {row.money ? ksh(d.actual[row.key]) : d.actual[row.key]}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.money ? ksh(d.with_plan[row.key]) : d.with_plan[row.key]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Day by day */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Day by day (average turned-away customers)
              </h3>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Your restock</th>
                    <th className="px-4 py-2">Turned away (you)</th>
                    <th className="px-4 py-2">Turned away (plan)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {d.daily.map((row) => {
                    const restock =
                      row.actual_restock_cash_ksh || row.actual_restock_float_ksh
                        ? [
                            row.actual_restock_cash_ksh && `cash ${ksh(row.actual_restock_cash_ksh)}`,
                            row.actual_restock_float_ksh && `float ${ksh(row.actual_restock_float_ksh)}`,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "—";
                    return (
                      <tr key={row.date}>
                        <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">
                          {row.date} {row.weekday.slice(0, 3)}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{restock}</td>
                        <td className="px-4 py-2 font-mono text-rose-600 dark:text-rose-400">
                          {row.actual_turned_away}
                        </td>
                        <td className="px-4 py-2 font-mono text-emerald-600 dark:text-emerald-400">
                          {row.plan_turned_away}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">{d.method_note}</p>
        </>
      )}
    </div>
  );
}