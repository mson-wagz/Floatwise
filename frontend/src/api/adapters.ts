export type RawRestock = {
    date: string; weekday: string; day_index: number;
    kind: "cash" | "float" | "both" | "bank_cash" | "bank_float" | "bank_both";
    add_cash_ksh: number; add_float_ksh: number;
    bank_cash_ksh: number; bank_float_ksh: number;
    p_stockout_before: number;
    p_plan_restocks_by_then?: number;
  };
  
  export type Rec = {
    as_of: string;
    balances: { cash_ksh: number; float_ksh: number; total_ksh: number };
    restock: RawRestock | null;
    p_stockout_by_day_no_restock: number[];
    stockout_probability: number;        // risk on the restock day (or at horizon if no restock)
    expected_cost_ksh: number;
    evidence: { method: string; horizon_days: number };
    plain_text_en: string;
    plain_text_sw: string;
  };
  
  const SW_DAY: Record<string, string> = {
    Monday: "Jumatatu", Tuesday: "Jumanne", Wednesday: "Jumatano", Thursday: "Alhamisi",
    Friday: "Ijumaa", Saturday: "Jumamosi", Sunday: "Jumapili",
  };
  const n = (x: number) => x.toLocaleString("en-KE");
  
  function buildText(r: RawRestock | null, risk: number[], horizon: number) {
    if (!r) {
      return {
        en: `Your balances look safe for the next ${horizon} days. No restock is needed.`,
        sw: `Salio lako liko salama kwa siku ${horizon} zijazo. Huhitaji kuongeza sasa.`,
      };
    }
    const when = r.day_index === 0 ? "today" : r.day_index === 1 ? "tomorrow morning" : `${r.weekday} morning`;
    const whenSw = r.day_index === 0 ? "leo" : r.day_index === 1 ? "kesho asubuhi" : `asubuhi ya ${SW_DAY[r.weekday] ?? r.weekday}`;
    const pct = Math.round((risk[r.day_index] ?? r.p_stockout_before) * 100);
    const chance = `Without restocking there is about a ${pct}% chance a customer is turned away by then.`;
    const chanceSw = `Bila kuongeza, kuna uwezekano wa takriban ${pct}% mteja atakosa huduma kufikia hapo.`;
  
    switch (r.kind) {
      case "cash":
        return { en: `Add about KSh ${n(r.add_cash_ksh)} in cash by ${when}. ${chance}`,
                 sw: `Ongeza takriban KSh ${n(r.add_cash_ksh)} pesa taslimu kufikia ${whenSw}. ${chanceSw}` };
      case "float":
        return { en: `Buy about KSh ${n(r.add_float_ksh)} in e-float by ${when}. ${chance}`,
                 sw: `Nunua takriban KSh ${n(r.add_float_ksh)} float ya simu kufikia ${whenSw}. ${chanceSw}` };
      case "both":
        return { en: `Add KSh ${n(r.add_cash_ksh)} cash and KSh ${n(r.add_float_ksh)} float by ${when}. ${chance}`,
                 sw: `Ongeza KSh ${n(r.add_cash_ksh)} pesa taslimu na KSh ${n(r.add_float_ksh)} float kufikia ${whenSw}. ${chanceSw}` };
      case "bank_cash":
        return { en: `Pay about KSh ${n(r.bank_cash_ksh)} of your till cash into the bank ${when}.`,
                 sw: `Weka takriban KSh ${n(r.bank_cash_ksh)} ya pesa taslimu benki ${whenSw}.` };
      case "bank_float":
        return { en: `Sell back about KSh ${n(r.bank_float_ksh)} of e-float ${when}.`,
                 sw: `Rudisha takriban KSh ${n(r.bank_float_ksh)} ya float ${whenSw}.` };
      default:
        return { en: `Bank KSh ${n(r.bank_cash_ksh)} cash and sell back KSh ${n(r.bank_float_ksh)} float ${when}.`,
                 sw: `Weka KSh ${n(r.bank_cash_ksh)} benki na rudisha KSh ${n(r.bank_float_ksh)} ya float ${whenSw}.` };
    }
  }
  
  export function toRecommendation(raw: any): Rec {
    const risk: number[] = raw.p_stockout_by_day_no_restock ?? [];
    const r: RawRestock | null = raw.restock;
    const t = buildText(r, risk, raw.evidence?.horizon_days ?? risk.length);
    return {
      as_of: raw.as_of,
      balances: { ...raw.balances, total_ksh: raw.balances.cash_ksh + raw.balances.float_ksh },
      restock: r,
      p_stockout_by_day_no_restock: risk,
      stockout_probability: r ? (risk[r.day_index] ?? r.p_stockout_before) : (risk[risk.length - 1] ?? 0),
      expected_cost_ksh: raw.expected_cost_ksh,
      evidence: raw.evidence,
      plain_text_en: t.en,
      plain_text_sw: t.sw,
    };
  }
  
  export function toWhatIf(raw: any) {
    return {
      baseline: toRecommendation(raw.baseline),
      scenario: toRecommendation(raw.scenario),
      assumptions_changed: raw.assumptions_changed as string[],
      delta: raw.delta as { expected_cost_ksh: number; p_stockout_at_horizon_no_restock: number },
    };
  }
  
  export type ChartDay = {
    date: string; weekday: string; dayIndex: number;
    cash_p10_ksh: number; cash_p50_ksh: number; cash_p90_ksh: number;
    float_p10_ksh: number; float_p50_ksh: number; float_p90_ksh: number;
    p_stockout_by_this_day: number;
    is_market_day: boolean; is_payday: boolean;
    expected_customers: number; // not provided by the backend
  };
  
  export function toForecast(raw: any, shop: { market_days: string[]; payday_dates: number[] }) {
    const markets = shop.market_days.map((d) => d.toLowerCase());
    const days: ChartDay[] = raw.days.map((d: any, i: number) => ({
      ...d,
      dayIndex: i,
      is_market_day: markets.includes(d.weekday.toLowerCase()),
      is_payday: shop.payday_dates.includes(Number(d.date.slice(8, 10))),
      expected_customers: 0,
    }));
    return { days, scenario: raw.scenario as string };
  }