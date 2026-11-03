// Calls the FastAPI /signup and /login routes.
// If your Vite proxy only forwards /api, set VITE_API_URL=http://localhost:8000
// in the frontend .env (and restart `npm run dev`).
const API = import.meta.env.VITE_API_URL ?? "";

export type Lang = "en" | "sw";

export type SignupInput = {
  shop_name: string;
  phone: string;
  till_number?: string;
  password: string;
  language: Lang;
};

export type LoginResult = {
  access_token: string;
  token_type: string;
  shop_name: string | null;
  language: Lang;
};

// Same rule as the backend: 07xx / 01xx / 254xx / +254xx
export function isKenyanPhone(raw: string): boolean {
  const p = raw.replace(/[\s\-()]/g, "");
  return /^(\+254|254|0)[17]\d{8}$/.test(p);
}

const FIELD_NAMES: Record<string, string> = {
  shop_name: "Shop name",
  phone: "Phone number",
  till_number: "Till number",
  password: "Password",
};

function readError(data: any, status: number): string {
  const d = data?.detail;
  if (typeof d === "string") return d; // 400 / 401
  if (Array.isArray(d) && d.length > 0) { // 422 validation list
    const first = d[0];
    const key = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1]) : "";
    const msg = String(first.msg ?? "").replace(/^Value error, /, "");
    return FIELD_NAMES[key] ? `${FIELD_NAMES[key]}: ${msg}` : msg;
  }
  if (typeof data?.error === "string") return data.error; // 503 etc.
  return `Something went wrong (${status})`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readError(data, res.status));
  return data as T;
}

export function login(phone: string, password: string) {
  return post<LoginResult>("/login", { phone, password });
}

export function signup(input: SignupInput) {
  const body = { ...input, till_number: input.till_number?.trim() || null };
  return post<{ message: string }>("/signup", body);
}