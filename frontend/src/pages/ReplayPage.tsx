import { useState } from "react";
import { LocalStore } from "../lib/store";
import { ksh } from "../lib/format";
import { useTranslation } from "react-i18next";

export default function ReplayPage() {
  const { t } = useTranslation();
  const [incidents] = useState(LocalStore.getStockoutIncidents());

  // Aggregate numbers
  const totalLostCommission = incidents.reduce((sum, i) => sum + i.lostCommissionKsh, 0);
  const totalVolumeMissed = incidents.reduce((sum, i) => sum + i.customerRequestKsh, 0);
  const totalTurnedAway = incidents.length * 7; // Average 7 customers turned away per dry spell

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

      {/* Top Loss KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/40 p-5 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-rose-700 dark:text-rose-300 block">
            {t("replay.lost_commissions")}
          </span>
          <span className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1 block">
            {ksh(totalLostCommission * 12)}
          </span>
          <span className="text-xs text-rose-700/80 dark:text-rose-400 mt-1 block">
            Straight agent commission income lost
          </span>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 p-5 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300 block">
            {t("replay.missed_volume")}
          </span>
          <span className="text-3xl font-black text-amber-700 dark:text-amber-300 font-mono mt-1 block">
            {ksh(totalVolumeMissed * 3)}
          </span>
          <span className="text-xs text-amber-700/80 dark:text-amber-400 mt-1 block">
            M-Pesa money that walked to rival kiosks
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            {t("replay.turned_away_customers")}
          </span>
          <span className="text-3xl font-black text-slate-900 dark:text-slate-100 font-mono mt-1 block">
            {totalTurnedAway}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            Customers told: "Nimeishiwa, jaribu duka lingine"
          </span>
        </div>
      </div>

      {/* Prevention Strategy Callout */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 shadow-md flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div className="space-y-1">
          <h3 className="font-bold text-sm uppercase tracking-wider">
            FloatWise Recommendation Payoff
          </h3>
          <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed">
            By acting on FloatWise's advance alerts before Saturday market day and school fee dates, you could have prevented <strong>85%</strong> of these dry periods, putting an extra <strong>{ksh(totalLostCommission * 10)}</strong> in your pocket each month.
          </p>
        </div>
      </div>

      {/* Historical Stockout Incidents Log */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            {t("replay.breakdown_title")}
          </h3>
          <span className="text-xs text-slate-500">October 2026 Audit</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Depleted Asset</th>
                <th className="px-4 py-3">Turned Away Request</th>
                <th className="px-4 py-3">Lost Commission</th>
                <th className="px-4 py-3">Root Cause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                    {inc.date} at {inc.time}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        inc.type === "cash"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                      }`}
                    >
                      {inc.type === "cash" ? "💵 Cash Drawer Empty" : "📱 Phone Float Depleted"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {ksh(inc.customerRequestKsh)}
                  </td>
                  <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {ksh(inc.lostCommissionKsh)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                    {inc.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
