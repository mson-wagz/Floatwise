/**
 * FloatWise Privacy Shield: Client-side PII scrubber for Kenyan M-Pesa agents.
 * Ensures customer phone numbers, full legal names, and national IDs never
 * leave the device or reach any external language model unredacted.
 */

// Matches Kenyan phone formats: +254 7XX, 07XX, 01XX, 2541XX
const KENYAN_PHONE_REGEX = /(?<!\d)(?:\+?254|0)[17]\d{8}(?!\d)/g;

// Matches name patterns in M-Pesa statements:
// "sent to JOHN KAMAU 07..." or "from MARY WANJIKU 07..."
const MPESA_NAME_REGEX = /\b(from|to|for|paid to)\s+([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){1,3})\s+(?=(?:\+?254|0)[17]|\b[A-Z0-9]{10}\b|on|\d)/gi;

// National ID numbers often recorded in paper notebooks or agent forms
const NATIONAL_ID_REGEX = /\b(?:ID|Id|id)[\s:#]*([0-9]{7,9})\b/g;

export interface RedactionResult {
  original: string;
  sanitized: string;
  phonesFound: number;
  namesFound: number;
  idsFound: number;
  tokensReplaced: string[];
}

export function redactText(text: string): RedactionResult {
  let sanitized = text;
  let phonesFound = 0;
  let namesFound = 0;
  let idsFound = 0;
  const tokensReplaced: string[] = [];

  // 1. Redact customer names attached to transactions
  sanitized = sanitized.replace(MPESA_NAME_REGEX, (match, prefix, name) => {
    namesFound++;
    tokensReplaced.push(`Name: ${name}`);
    return `${prefix} [CUSTOMER_NAME]`;
  });

  // 2. Redact phone numbers
  sanitized = sanitized.replace(KENYAN_PHONE_REGEX, (match) => {
    phonesFound++;
    tokensReplaced.push(`Phone: ${match}`);
    return "[PHONE]";
  });

  // 3. Redact national ID numbers
  sanitized = sanitized.replace(NATIONAL_ID_REGEX, (match, id) => {
    idsFound++;
    tokensReplaced.push(`ID: ${id}`);
    return "ID: [REDACTED_ID]";
  });

  return {
    original: text,
    sanitized,
    phonesFound,
    namesFound,
    idsFound,
    tokensReplaced,
  };
}

export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 9) return "[REDACTED]";
  const start = clean.slice(0, 4);
  const end = clean.slice(-2);
  return `${start}***${end}`;
}
