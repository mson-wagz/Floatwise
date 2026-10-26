import type { components } from "./schema";

export type Advice = components["schemas"]["Advice"];
export type Transaction = components["schemas"]["Transaction"];

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}