/**
 * FloatWise Offline Mathematical Solver & Forecasting Engine
 * 
 * Re-implements the exact coupled cash/e-float queue dynamics in TypeScript
 * so the web app runs 100% offline in browser without needing an internet connection.
 * 
 * Key Principles:
 * 1. Cash + Float is conserved on customer transactions (withdrawals vs deposits).
 * 2. Numbers are computed deterministically. The language model NEVER invents numbers.
 */

export const UNIT_KSH = 1000;
export const CHURN_COST_PER_CUSTOMER_KSH = 150; // Lost margin & customer goodwill per turned away visit

export interface DayForecast {
  date: string;
  weekday: string;
  dayIndex: number;
  cash_p10_ksh: number;
  cash_p50_ksh: number;
  cash_p90_ksh: number;
  float_p10_ksh: number;
  float_p50_ksh: number;
  float_p90_ksh: number;
  p_stockout_by_this_day: number;
  expected_customers: number;
  is_market_day: boolean;
  is_payday: boolean;
  event_label?: string;
}

export interface RecommendationResult {
  as_of: string;
  balances: {
    cash_ksh: number;
    float_ksh: number;
    total_ksh: number;
  };
  restock: {
    date: string;
    weekday: string;
    day_index: number;
    kind: "cash" | "float" | "both";
    add_cash_ksh: number;
    add_float_ksh: number;
    p_stockout_before: number;
    p_plan_restocks_by_then: number;
  } | null;
  p_stockout_by_day_no_restock: number[];
  stockout_definition: string;
  expected_cost_ksh: number;
  evidence: {
    method: string;
    n_runs: number;
    horizon_days: number;
  };
  plain_text_en: string;
  plain_text_sw: string;
  verified: boolean;
}

export interface WhatIfScenarioInput {
  market_days?: string[];
  demand_multiplier?: number;
  events?: Array<{ date: string; multiplier: number; label: string }>;
  horizon_days?: number;
}

export interface SimulationConfig {
  txnAmountsKsh: number[]; // Transaction amounts
  txnWeights: number[]; // Weights for transaction amounts
  baselineCustomers: Record<number, number>; // Baseline customer arrivals per weekday
  maxCapacityKsh: number; // Maximum cash/float capacity
  churnCostPerCustomerKsh: number; // Cost per turned-away customer
}

export class SimulationEngine {
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  /**
   * Deterministic pseudo-random generator with seed for reproducible simulations.
   */
  private static lcg(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /**
   * Compute multi-day forecast trajectories without restocking.
   */
  public forecast(
    cashKsh: number,
    floatKsh: number,
    startDate: Date = new Date(),
    horizonDays = 7,
    scenario: WhatIfScenarioInput = {}
  ): { days: DayForecast[]; overallRisk: number } {
    const days: DayForecast[] = [];
    const nSimulations = 2000;
    const rng = SimulationEngine.lcg(42);

    const marketDays = (scenario.market_days || ["saturday"]).map((d) => d.toLowerCase());
    const globalMultiplier = scenario.demand_multiplier || 1.0;

    const trajectories: Array<{ cash: number[]; float: number[]; stockoutDay: number | null }> = [];

    for (let sim = 0; sim < nSimulations; sim++) {
      let curC = cashKsh;
      let curF = floatKsh;
      const cHist: number[] = [];
      const fHist: number[] = [];
      let stockoutDay: number | null = null;

      for (let t = 0; t < horizonDays; t++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + t);
        const dayOfWeek = d.getDay();
        const weekdayName = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        const dayOfMonth = d.getDate();

        // Calculate expected customer arrivals
        let baseLambda = this.config.baselineCustomers[dayOfWeek] || 22;
        const isMarketDay = marketDays.includes(weekdayName);
        if (isMarketDay) baseLambda *= 1.7;

        const isPayday = dayOfMonth === 25 || dayOfMonth === 30 || dayOfMonth === 31 || dayOfMonth === 1;
        if (isPayday) baseLambda *= 1.5;

        const isoDate = d.toISOString().split("T")[0];
        const event = scenario.events?.find((e) => e.date === isoDate);
        if (event) {
          baseLambda *= event.multiplier;
        }

        const lambda = baseLambda * globalMultiplier;

        let nCust = Math.round(lambda + (rng() - 0.5) * Math.sqrt(lambda) * 2.2);
        nCust = Math.max(0, nCust);

        let pWithdrawal = 0.58;
        if (isPayday || event?.label.toLowerCase().includes("school")) {
          pWithdrawal = 0.76;
        } else if (isMarketDay) {
          pWithdrawal = 0.65;
        }

        for (let c = 0; c < nCust; c++) {
          const isWithdrawal = rng() < pWithdrawal;
          const r = rng();
          let cumWeight = 0;
          let amount = 3000;
          for (let k = 0; k < this.config.txnWeights.length; k++) {
            cumWeight += this.config.txnWeights[k];
            if (r <= cumWeight) {
              amount = this.config.txnAmountsKsh[k];
              break;
            }
          }

          if (isWithdrawal) {
            if (curC < amount) {
              if (stockoutDay === null) stockoutDay = t;
            } else {
              curC -= amount;
              curF = Math.min(this.config.maxCapacityKsh - curC, curF + amount);
            }
          } else {
            if (curF < amount) {
              if (stockoutDay === null) stockoutDay = t;
            } else {
              curF -= amount;
              curC = Math.min(this.config.maxCapacityKsh - curF, curC + amount);
            }
          }
        }

        cHist.push(curC);
        fHist.push(curF);
      }

      trajectories.push({ cash: cHist, float: fHist, stockoutDay });
    }

    for (let t = 0; t < horizonDays; t++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + t);
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      const dayOfMonth = d.getDate();
      const isoDate = d.toISOString().split("T")[0];

      const cashSamples = trajectories.map((traj) => traj.cash[t]).sort((a, b) => a - b);
      const floatSamples = trajectories.map((traj) => traj.float[t]).sort((a, b) => a - b);

      const stockoutsByT = trajectories.filter((traj) => traj.stockoutDay !== null && traj.stockoutDay <= t).length;
      const pStockout = Math.min(1.0, Math.round((stockoutsByT / nSimulations) * 1000) / 1000);

      const p10Idx = Math.floor(nSimulations * 0.1);
      const p50Idx = Math.floor(nSimulations * 0.5);
      const p90Idx = Math.floor(nSimulations * 0.9);

      const isMarketDay = marketDays.includes(weekday.toLowerCase());
      const isPayday = dayOfMonth === 25 || dayOfMonth === 30 || dayOfMonth === 31 || dayOfMonth === 1;
      const event = scenario.events?.find((e) => e.date === isoDate);

      let expectedCustomers = Math.round((this.config.baselineCustomers[d.getDay()] || 22) * globalMultiplier);
      if (isMarketDay) expectedCustomers = Math.round(expectedCustomers * 1.7);
      if (event) expectedCustomers = Math.round(expectedCustomers * event.multiplier);

      days.push({
        date: isoDate,
        weekday,
        dayIndex: t,
        cash_p10_ksh: Math.round(cashSamples[p10Idx] / 1000) * 1000,
        cash_p50_ksh: Math.round(cashSamples[p50Idx] / 1000) * 1000,
        cash_p90_ksh: Math.round(cashSamples[p90Idx] / 1000) * 1000,
        float_p10_ksh: Math.round(floatSamples[p10Idx] / 1000) * 1000,
        float_p50_ksh: Math.round(floatSamples[p50Idx] / 1000) * 1000,
        float_p90_ksh: Math.round(floatSamples[p90Idx] / 1000) * 1000,
        p_stockout_by_this_day: pStockout,
        expected_customers: expectedCustomers,
        is_market_day: isMarketDay,
        is_payday: isPayday,
        event_label: event?.label,
      });
    }

    const overallRisk = days[days.length - 1]?.p_stockout_by_this_day || 0;
    return { days, overallRisk };
  }

  private static translateWeekday(day: string): string {
    const map: Record<string, string> = {
      Monday: "Jumatatu",
      Tuesday: "Jumanne",
      Wednesday: "Jumatano",
      Thursday: "Alhamisi",
      Friday: "Ijumaa",
      Saturday: "Jumamosi",
      Sunday: "Jumapili",
    };
    return map[day] || day;
  }
}