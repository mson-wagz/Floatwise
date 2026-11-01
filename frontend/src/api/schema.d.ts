export interface components {
  schemas: {
    Advice: {
      text: string;
      stockout_probability: number;
      restock_amount_ksh: number;
      restock_day?: string;
      restock_kind?: "cash" | "float" | "both" | "none";
      verified: boolean;
      evidence: {
        method: string;
        n_runs: number;
        horizon_days: number;
      };
      unsupported_numbers?: number[];
    };
    Transaction: {
      id: string;
      timestamp: string;
      type: "withdrawal" | "deposit" | "float_purchase" | "cash_banking" | "other";
      amount_ksh: number;
      commission_ksh: number;
      cash_delta_ksh: number;
      float_delta_ksh: number;
      source: "sms" | "voice" | "ledger" | "manual";
      confidence: number;
      needs_review: boolean;
      anomaly_warning?: string;
      raw_text?: string;
      redacted_text?: string;
    };
    Batch: {
      batch_id: string;
      shop_id: string;
      status: "pending" | "confirmed" | "rejected";
      transactions: components["schemas"]["Transaction"][];
      warnings: string[];
      float_balance_ksh?: number;
      unparsed: string[];
    };
    Shop: {
      shop_id: string;
      name: string;
      location: string;
      language: "sw" | "en";
      cash_ksh: number;
      float_ksh: number;
      market_days: string[];
      payday_dates: number[];
      transaction_count: number;
      as_of: string;
    };
    ForecastDay: {
      date: string;
      weekday: string;
      cash_p10_ksh: number;
      cash_p50_ksh: number;
      cash_p90_ksh: number;
      float_p10_ksh: number;
      float_p50_ksh: number;
      float_p90_ksh: number;
      p_stockout_by_this_day: number;
    };
    PeerShop: {
      id: string;
      name: string;
      location: string;
      distance_m: number;
      status: "surplus_cash" | "surplus_float" | "balanced";
      cash_excess_ksh: number;
      float_excess_ksh: number;
      verified: boolean;
      contact: string;
    };
  };
}
