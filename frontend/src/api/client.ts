// src/api/client.ts
const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  // JSON bodies get a content type; FormData (voice/photo uploads) must not,
  // because the browser sets its own multipart boundary.
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the FloatWise server. Is the backend running?");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Your handlers return {"error": ...}; HTTPException returns {"detail": ...}.
    const detail =
      typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? "");
    throw new ApiError(res.status, body.error ?? (detail || res.statusText));
  }

  return res.json();
}

// Shop routes -> http://localhost:8000/api/...
export const api = <T = any>(path: string, init?: RequestInit) =>
  request<T>(`${BASE}/api${path}`, init);

// Auth and saved chats -> http://localhost:8000/login, /signup, /chats
export const apiRoot = <T = any>(path: string, init?: RequestInit) =>
  request<T>(`${BASE}${path}`, init);