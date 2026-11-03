/**
 * FloatWise Deterministic Number Verifier
 * 
 * Extracts every number, currency amount, and percentage mentioned in an AI draft
 * and checks whether each exists in the underlying calculation payload.
 * If unsupported numbers are found, rejects the draft and forces fallback to
 * the exact templated sentence computed by the math engine.
 */

import type { RecommendationResult } from "./engine";

export interface VerificationResult {
  verified: boolean;
  draftNumbers: number[];
  allowedNumbers: Set<number>;
  unsupportedNumbers: number[];
  safeText: string;
  source: "verified_ai" | "deterministic_fallback";
}

export function extractNumbers(text: string): number[] {
  // Matches integers, decimals, numbers with commas (e.g. 22,000, 46%, 150)
  const matches = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g) || [];
  const numbers: number[] = [];

  for (const match of matches) {
    const isPct = match.endsWith("%");
    const num = parseFloat(match.replace(/,/g, "").replace("%", ""));
    if (!isNaN(num)) {
      numbers.push(num);
      // If percentage, also allow the raw fraction (e.g. 46 and 0.46)
      if (isPct) {
        numbers.push(num / 100);
      }
    }
  }

  return numbers;
}

export function verifyAdviceText(
  aiDraft: string,
  calc: RecommendationResult,
  language: "en" | "sw" = "en"
): VerificationResult {
  // Collect all valid numbers produced by the deterministic engine
  const allowed = new Set<number>();

  // Add balances
  allowed.add(calc.balances.cash_ksh);
  allowed.add(calc.balances.float_ksh);
  allowed.add(calc.balances.total_ksh);
  allowed.add(calc.evidence.horizon_days);
  allowed.add(calc.evidence.n_runs);

  // Add restock numbers
  if (calc.restock) {
    allowed.add(calc.restock.add_cash_ksh);
    allowed.add(calc.restock.add_float_ksh);
    const pct = Math.round(calc.restock.p_plan_restocks_by_then * 100);
    allowed.add(pct);
    allowed.add(calc.restock.p_plan_restocks_by_then);
    allowed.add(calc.restock.day_index);
  }

  // Add daily risk percentages
  calc.p_stockout_by_day_no_restock.forEach((p, idx) => {
    allowed.add(Math.round(p * 100));
    allowed.add(p);
    allowed.add(idx + 1);
  });

  allowed.add(calc.expected_cost_ksh);

  // Allow common structural numbers (e.g., "1" or "2" days, 0, 7, 14, 24)
  [0, 1, 2, 3, 4, 5, 6, 7, 14, 30].forEach((n) => allowed.add(n));

  const draftNumbers = extractNumbers(aiDraft);
  const unsupportedNumbers: number[] = [];

  for (const n of draftNumbers) {
    // Check if n is allowed (with a small rounding tolerance)
    let found = false;
    for (const valid of allowed) {
      if (Math.abs(n - valid) < 0.01 || Math.abs(n - Math.round(valid)) === 0) {
        found = true;
        break;
      }
    }
    if (!found) {
      unsupportedNumbers.push(n);
    }
  }

  const verified = unsupportedNumbers.length === 0;
  const safeText = verified
    ? aiDraft
    : language === "sw"
    ? calc.plain_text_sw
    : calc.plain_text_en;

  return {
    verified,
    draftNumbers,
    allowedNumbers: allowed,
    unsupportedNumbers,
    safeText,
    source: verified ? "verified_ai" : "deterministic_fallback",
  };
}
