import { redactText } from "./privacy";
import type { components } from "../api/schema";

export type Transaction = components["schemas"]["Transaction"];
export type Batch = components["schemas"]["Batch"];

// Kenyan M-Pesa standard commission lookup (estimated agent earning in KSh)
export function calculateMpesaCommission(amount: number, type: string): number {
  if (type !== "withdrawal" && type !== "deposit") return 0;
  if (amount <= 100) return 1.5;
  if (amount <= 500) return 5.0;
  if (amount <= 1000) return 11.0;
  if (amount <= 2500) return 28.0;
  if (amount <= 5000) return 40.0;
  if (amount <= 10000) return 60.0;
  if (amount <= 20000) return 100.0;
  if (amount <= 35000) return 145.0;
  if (amount <= 50000) return 165.0;
  return 190.0;
}

// Swahili number words mapping
const SWAHILI_NUMBERS: Record<string, number> = {
  "sifuri": 0,
  "moja": 1,
  "mbili": 2,
  "tatu": 3,
  "nne": 4,
  "tano": 5,
  "sita": 6,
  "saba": 7,
  "nane": 8,
  "tisa": 9,
  "kumi": 10,
  "ishirini": 20,
  "thelathini": 30,
  "arobaini": 40,
  "hamsini": 50,
  "sitini": 60,
  "sabini": 70,
  "themanini": 80,
  "tisini": 90,
  "mia": 100,
  "mia mbili": 200,
  "mia tano": 500,
  "elfu": 1000,
  "elfu moja": 1000,
  "elfu mbili": 2000,
  "elfu tatu": 3000,
  "elfu tano": 5000,
  "elfu kumi": 10000,
  "elfu kumi na tano": 15000,
  "elfu ishirini": 20000,
  "elfu hamsini": 50000,
  "elfu sabini": 70000,
  "elfu mia moja": 100000,
  "elfu mia mbili": 200000,
  "elfu mia tano": 500000, // Common speech confusion!
  "laki moja": 100000,
  "laki mbili": 200000,
  "laki tano": 500000,
};

export function parseSwahiliNumberWords(text: string): number | null {
  const clean = text.toLowerCase().trim();
  
  // Direct match
  if (SWAHILI_NUMBERS[clean] !== undefined) {
    return SWAHILI_NUMBERS[clean];
  }

  // Handle composite phrases: e.g. "elfu tano na mia tano" -> 5500
  let total = 0;
  let remaining = clean;

  if (remaining.includes("laki moja")) { total += 100000; remaining = remaining.replace("laki moja", ""); }
  if (remaining.includes("elfu hamsini")) { total += 50000; remaining = remaining.replace("elfu hamsini", ""); }
  if (remaining.includes("elfu ishirini")) { total += 20000; remaining = remaining.replace("elfu ishirini", ""); }
  if (remaining.includes("elfu kumi")) { total += 10000; remaining = remaining.replace("elfu kumi", ""); }
  if (remaining.includes("elfu tano")) { total += 5000; remaining = remaining.replace("elfu tano", ""); }
  if (remaining.includes("elfu mbili")) { total += 2000; remaining = remaining.replace("elfu mbili", ""); }
  if (remaining.includes("elfu moja")) { total += 1000; remaining = remaining.replace("elfu moja", ""); }

  // Numeric fallback: e.g., "5000", "Ksh 12,000"
  const numericMatch = clean.match(/(?:ksh|kes)?\s*([0-9,]+)/i);
  if (numericMatch) {
    const parsed = parseInt(numericMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed)) return parsed;
  }

  return total > 0 ? total : null;
}

/**
 * Check an extracted transaction for anomalies or suspicious entries.
 */
export function checkAnomalies(
  amount: number,
  type: string,
  currentCash: number,
  currentFloat: number,
  rawNarration?: string
): string | undefined {
  // 1. Extreme single-transaction threshold for small kiosks
  if (amount > 150000) {
    if (rawNarration && (rawNarration.includes("elfu mia tano") || rawNarration.includes("500,000"))) {
      return "⚠️ Unusual amount: KSh 500,000 detected. Did speaker mean 'elfu tano' (5,000) or 'laki tano' (500,000)? Please verify.";
    }
    return `⚠️ High value warning: KSh ${amount.toLocaleString()} is unusually large for a single retail agent transaction.`;
  }

  if (amount <= 0) {
    return "⚠️ Invalid transaction amount (must be greater than 0).";
  }

  // 2. Physical drawer solvency check
  if (type === "withdrawal" && amount > currentCash) {
    return `⚠️ Drawer warning: Withdrawal of KSh ${amount.toLocaleString()} exceeds cash in till (KSh ${currentCash.toLocaleString()}).`;
  }

  // 3. Digital phone float check
  if (type === "deposit" && amount > currentFloat) {
    return `⚠️ Phone float warning: Deposit of KSh ${amount.toLocaleString()} requires more float than currently available (KSh ${currentFloat.toLocaleString()}).`;
  }

  return undefined;
}

/**
 * Parse raw M-Pesa SMS text. Supports multiple messages separated by lines or blank breaks.
 */
export function parseMpesaSms(
  text: string,
  currentCash: number,
  currentFloat: number
): { transactions: Transaction[]; warnings: string[]; detectedFloatBalance?: number } {
  const transactions: Transaction[] = [];
  const warnings: string[] = [];
  let detectedFloatBalance: number | undefined;

  // Split multi-message text blocks by standard Safaricom transaction reference start (e.g. QA12BC34DE or 10-char alphanumeric)
  const messageBlocks = text
    .split(/(?=[A-Z0-9]{10}\s+Confirmed)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < messageBlocks.length; i++) {
    const raw = messageBlocks[i];
    const { sanitized } = redactText(raw);

    // Regex for M-Pesa confirmation
    // e.g.: "QA12BC34DE Confirmed. Ksh1,500.00 sent to..."
    // or:   "QA12BC34DF Confirmed. You have received Ksh2,000.00 from..."
    // or:   "QA12BC34DG Confirmed. on 28/10/26 at 11:30 AM Withdraw Ksh5,000.00..."
    const codeMatch = raw.match(/\b([A-Z0-9]{10})\b/);
    const code = codeMatch ? codeMatch[1] : `TX_${Date.now()}_${i}`;

    // Extract amount
    const amountMatch = raw.match(/(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (!amountMatch) {
      // Not a valid transaction message
      continue;
    }
    const amount = Math.round(parseFloat(amountMatch[1].replace(/,/g, "")));

    // Extract new M-Pesa balance if reported in SMS
    const balMatch = raw.match(/(?:balance is|bal is|new balance is)\s*(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (balMatch) {
      detectedFloatBalance = Math.round(parseFloat(balMatch[1].replace(/,/g, "")));
    }

    // Determine type
    let type: Transaction["type"] = "withdrawal";
    const lower = raw.toLowerCase();

    if (lower.includes("you have received") || lower.includes("received ksh") || lower.includes("deposit")) {
      // Customer deposit: shopkeeper received cash, sent e-float
      type = "deposit";
    } else if (lower.includes("give cash to") || lower.includes("withdraw") || lower.includes("sent to") || lower.includes("paid to")) {
      // Customer withdrawal: shopkeeper gave cash, received e-float
      type = "withdrawal";
    } else if (lower.includes("float purchase") || lower.includes("bought float")) {
      type = "float_purchase";
    } else if (lower.includes("banked") || lower.includes("banking")) {
      type = "cash_banking";
    }

    // Cash and Float Deltas
    let cashDelta = 0;
    let floatDelta = 0;
    if (type === "withdrawal") {
      cashDelta = -amount;
      floatDelta = +amount;
    } else if (type === "deposit") {
      cashDelta = +amount;
      floatDelta = -amount;
    } else if (type === "float_purchase") {
      cashDelta = -amount;
      floatDelta = +amount;
    } else if (type === "cash_banking") {
      cashDelta = -amount;
      floatDelta = 0;
    }

    const anomaly = checkAnomalies(amount, type, currentCash, currentFloat, raw);
    if (anomaly) warnings.push(`[${code}]: ${anomaly}`);

    const commission = calculateMpesaCommission(amount, type);

    transactions.push({
      id: code,
      timestamp: new Date().toISOString(),
      type,
      amount_ksh: amount,
      commission_ksh: commission,
      cash_delta_ksh: cashDelta,
      float_delta_ksh: floatDelta,
      source: "sms",
      confidence: 0.98,
      needs_review: !!anomaly,
      anomaly_warning: anomaly,
      raw_text: raw,
      redacted_text: sanitized,
    });
  }

  return { transactions, warnings, detectedFloatBalance };
}

/**
 * Parse spoken narration (transcribed from Swahili or English voice note).
 */
export function parseVoiceNarration(
  transcript: string,
  currentCash: number,
  currentFloat: number
): { transactions: Transaction[]; warnings: string[] } {
  const transactions: Transaction[] = [];
  const warnings: string[] = [];
  const { sanitized } = redactText(transcript);

  // Split into statements / clauses
  const sentences = transcript.split(/(?:,|\.|\bna pia\b|\band then\b|\bkisha\b)/i);

  sentences.forEach((sentence, idx) => {
    const s = sentence.trim().toLowerCase();
    if (!s) return;

    let type: Transaction["type"] | null = null;
    if (s.includes("kutoa") || s.includes("alitoa") || s.includes("withdraw") || s.includes("took cash") || s.includes("alichukua")) {
      type = "withdrawal";
    } else if (s.includes("kuweka") || s.includes("ameweka") || s.includes("deposit") || s.includes("put money") || s.includes("alilipa")) {
      type = "deposit";
    } else if (s.includes("kununua float") || s.includes("buy float") || s.includes("bought float")) {
      type = "float_purchase";
    }

    const amount = parseSwahiliNumberWords(s);

    if (type && amount && amount > 0) {
      let cashDelta = 0;
      let floatDelta = 0;
      if (type === "withdrawal") {
        cashDelta = -amount;
        floatDelta = +amount;
      } else if (type === "deposit") {
        cashDelta = +amount;
        floatDelta = -amount;
      } else if (type === "float_purchase") {
        cashDelta = -amount;
        floatDelta = +amount;
      }

      const anomaly = checkAnomalies(amount, type, currentCash, currentFloat, s);
      if (anomaly) warnings.push(`[Voice item #${idx + 1}]: ${anomaly}`);

      transactions.push({
        id: `VOICE_${Date.now()}_${idx}`,
        timestamp: new Date().toISOString(),
        type,
        amount_ksh: amount,
        commission_ksh: calculateMpesaCommission(amount, type),
        cash_delta_ksh: cashDelta,
        float_delta_ksh: floatDelta,
        source: "voice",
        confidence: anomaly ? 0.65 : 0.88,
        needs_review: true, // Voice always flagged for review
        anomaly_warning: anomaly,
        raw_text: sentence.trim(),
        redacted_text: sanitized,
      });
    }
  });

  return { transactions, warnings };
}

/**
 * Parse simulated ledger notebook image lines.
 */
export function parseLedgerRows(
  rows: Array<{ date: string; customerRef: string; inKsh?: number; outKsh?: number; notes?: string }>,
  currentCash: number,
  currentFloat: number
): { transactions: Transaction[]; warnings: string[] } {
  const transactions: Transaction[] = [];
  const warnings: string[] = [];

  rows.forEach((row, idx) => {
    const isOut = row.outKsh && row.outKsh > 0;
    const type: Transaction["type"] = isOut ? "withdrawal" : "deposit";
    const amount = isOut ? row.outKsh! : (row.inKsh || 0);

    if (amount <= 0) return;

    const anomaly = checkAnomalies(amount, type, currentCash, currentFloat, row.notes);
    if (anomaly) warnings.push(`[Ledger line ${idx + 1}]: ${anomaly}`);

    transactions.push({
      id: `LEDGER_${Date.now()}_${idx}`,
      timestamp: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      type,
      amount_ksh: amount,
      commission_ksh: calculateMpesaCommission(amount, type),
      cash_delta_ksh: type === "withdrawal" ? -amount : +amount,
      float_delta_ksh: type === "withdrawal" ? +amount : -amount,
      source: "ledger",
      confidence: 0.92,
      needs_review: true,
      anomaly_warning: anomaly,
      raw_text: `${row.date} | ${row.customerRef} | ${isOut ? `Out: ${amount}` : `In: ${amount}`}`,
    });
  });

  return { transactions, warnings };
}
