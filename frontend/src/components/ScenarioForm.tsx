import { useState } from "react";
import type { WhatIfScenarioInput } from "../lib/engine";

interface ScenarioFormProps {
  onSimulate: (scenario: WhatIfScenarioInput) => void;
  isCalculating?: boolean;
}

export default function ScenarioForm({ onSimulate, isCalculating = false }: ScenarioFormProps) {
  const [marketDay, setMarketDay] = useState("saturday");
  const [multiplier, setMultiplier] = useState(1.0);
  const [hasSchoolFees, setHasSchoolFees] = useState(false);
  const [schoolFeeDay, setSchoolFeeDay] = useState("thursday");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const events: Array<{ date: string; multiplier: number; label: string }> = [];

    if (hasSchoolFees) {
      // Set to the upcoming selected day of the week
      const targetDate = new Date();
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const targetDayIdx = dayNames.indexOf(schoolFeeDay.toLowerCase());
      const currentDayIdx = targetDate.getDay();
      let diff = targetDayIdx - currentDayIdx;
      if (diff <= 0) diff += 7;
      targetDate.setDate(targetDate.getDate() + diff);

      events.push({
        date: targetDate.toISOString().split("T")[0],
        multiplier: 2.2,
        label: "School Fees Deadline",
      });
    }

    onSimulate({
      market_days: [marketDay],
      demand_multiplier: multiplier,
      events,
    });
  };

  const applySchoolFeesPreset = (day = "thursday") => {
    setHasSchoolFees(true);
    setSchoolFeeDay(day);
    setMultiplier(1.2);

    const targetDate = new Date();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDayIdx = dayNames.indexOf(day.toLowerCase());
    let diff = targetDayIdx - targetDate.getDay();
    if (diff <= 0) diff += 7;
    targetDate.setDate(targetDate.getDate() + diff);

    onSimulate({
      market_days: [marketDay],
      demand_multiplier: 1.2,
      events: [
        {
          date: targetDate.toISOString().split("T")[0],
          multiplier: 2.4,
          label: "School Fees Deadline",
        },
      ],
    });
  };

  const resetToBaseline = () => {
    setMarketDay("saturday");
    setMultiplier(1.0);
    setHasSchoolFees(false);
    onSimulate({});
  };

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
          Scenario Controls
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Adjust upcoming market days or special spikes to see how restocking timing and cash needs change.
        </p>
      </div>

      {/* Quick Scenario Chips */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Instant Scenarios:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applySchoolFeesPreset("thursday")}
            className="text-xs px-3 py-1.5 rounded-full border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-semibold hover:bg-blue-100 transition-colors"
          >
            🎒 "What if school fees are on Thursday?"
          </button>
          <button
            type="button"
            onClick={() => {
              setMultiplier(1.8);
              onSimulate({ demand_multiplier: 1.8 });
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition-colors"
          >
            💰 "What if tomorrow is civil service payday?"
          </button>
          <button
            type="button"
            onClick={() => {
              setMultiplier(0.6);
              onSimulate({ demand_multiplier: 0.6 });
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 transition-colors"
          >
            🌧️ "What if heavy rain keeps shoppers home?"
          </button>
          <button
            type="button"
            onClick={resetToBaseline}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ↺ Reset to Normal Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {/* Market Day Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Weekly Market Day
          </label>
          <select
            value={marketDay}
            onChange={(e) => setMarketDay(e.target.value)}
            className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="saturday">Saturday (Umoja Market Peak)</option>
            <option value="wednesday">Wednesday</option>
            <option value="friday">Friday</option>
            <option value="monday">Monday</option>
            <option value="none">No Regular Market Day</option>
          </select>
        </div>

        {/* Demand Multiplier */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Demand Multiplier
            </label>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {multiplier.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={multiplier}
            onChange={(e) => setMultiplier(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 mt-2"
          />
        </div>

        {/* School Fees Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            School Fees Payment Rush
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              id="schoolFees"
              checked={hasSchoolFees}
              onChange={(e) => setHasSchoolFees(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded"
            />
            <label htmlFor="schoolFees" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              Active (+140% cash withdrawals)
            </label>
          </div>
          {hasSchoolFees && (
            <select
              value={schoolFeeDay}
              onChange={(e) => setSchoolFeeDay(e.target.value)}
              className="w-full mt-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-800"
            >
              <option value="thursday">Due on Thursday</option>
              <option value="wednesday">Due on Wednesday</option>
              <option value="friday">Due on Friday</option>
              <option value="monday">Due on Monday</option>
            </select>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isCalculating}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2"
        >
          {isCalculating && <span className="animate-spin text-xs">⏳</span>}
          <span>Run Simulation & Compare</span>
        </button>
      </div>
    </form>
  );
}
