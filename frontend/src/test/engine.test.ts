import { describe, it, expect } from "vitest";
import { SimulationEngine } from "../lib/engine";
import { parseMpesaSms, parseSwahiliNumberWords, checkAnomalies } from "../lib/ingest";
import { verifyAdviceText } from "../lib/verifier";
import { redactText } from "../lib/privacy";

describe("FloatWise Core Engine & Ingestion", () => {
  it("determines restocking recommendation and stockout risk deterministically", () => {
    const cashKsh = 35000;
    const floatKsh = 50000;
    const rec = SimulationEngine.recommend(cashKsh, floatKsh, new Date(), 14);

    expect(rec.balances.total_ksh).toBe(85000);
    expect(rec.p_stockout_by_day_no_restock.length).toBe(14);
    expect(rec.evidence.n_runs).toBe(2000);
    expect(rec.plain_text_en).toContain("KSh");
    expect(rec.verified).toBe(true);
  });

  it("scrubs customer names and Kenyan phone numbers for privacy", () => {
    const raw = "QA12BC34DE Confirmed. Ksh1,500.00 sent to MAMA STACY 0712345678 on 28/10/26.";
    const { sanitized, phonesFound, namesFound } = redactText(raw);

    expect(phonesFound).toBeGreaterThan(0);
    expect(sanitized).not.toContain("0712345678");
    expect(sanitized).toContain("[PHONE]");
  });

  it("parses Swahili number words correctly", () => {
    expect(parseSwahiliNumberWords("elfu tano")).toBe(5000);
    expect(parseSwahiliNumberWords("elfu kumi")).toBe(10000);
    expect(parseSwahiliNumberWords("elfu ishirini")).toBe(20000);
    expect(parseSwahiliNumberWords("laki moja")).toBe(100000);
    expect(parseSwahiliNumberWords("elfu mia tano")).toBe(500000);
  });

  it("warns about anomalies like misheard 'elfu mia tano' and drawer solvency", () => {
    const anomaly = checkAnomalies(500000, "withdrawal", 30000, 40000, "alitoa elfu mia tano");
    expect(anomaly).toBeDefined();
    expect(anomaly).toContain("elfu mia tano");

    // Drawer solvency warning
    const solvencyWarning = checkAnomalies(45000, "withdrawal", 20000, 40000);
    expect(solvencyWarning).toBeDefined();
    expect(solvencyWarning).toContain("exceeds cash in till");
  });

  it("verifies that AI draft contains only computed numbers and rejects hallucinations", () => {
    const calc = SimulationEngine.recommend(30000, 40000, new Date(), 14);
    
    // Draft with an invented number that doesn't exist in simulation
    const hallucinatedDraft = "Add KSh 999,999 cash by tomorrow.";
    const result = verifyAdviceText(hallucinatedDraft, calc, "en");

    expect(result.verified).toBe(false);
    expect(result.unsupportedNumbers).toContain(999999);
    expect(result.safeText).toBe(calc.plain_text_en); // Safely fell back to deterministic template!
  });
});
