import type { components } from "../api/schema";
import { getToken, clearToken } from "../auth";

export type Shop = components["schemas"]["Shop"];
export type Transaction = components["schemas"]["Transaction"];
export type Batch = components["schemas"]["Batch"];
export type PeerShop = components["schemas"]["PeerShop"];

export interface ChatEntry {
  id: string;
  timestamp: string;
  role: "user" | "assistant";
  question?: string;
  text: string;
  language: "sw" | "en";
  stockoutProbability?: number;
  restockAmountKsh?: number;
  restockDay?: string;
  verified: boolean;
  unsupportedNumbers?: number[];
  source?: "verified_ai" | "deterministic_fallback";
}

export interface StockoutIncident {
  id: string;
  date: string;
  time: string;
  type: "cash" | "float";
  customerRequestKsh: number;
  lostCommissionKsh: number;
  reason: string;
}

/**
 * fetch() that sends the login token and handles an expired or missing login.
 * Token key and storage (localStorage or sessionStorage) are handled by auth.ts.
 */
async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/";
    throw new Error("Please log in again");
  }
  return res;
}

/** Best readable message from a failed response, falling back to `fallback`. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.error === "string") return data.error;
  } catch {
    /* body was not JSON */
  }
  return fallback;
}

export class Store {
  // Remembered after the first fetchShop so later calls don't need to look it up again.
  private static shopId: string | null = null;

  /**
   * Fetch the logged-in user's shop from the backend.
   */
  public static async fetchShop(): Promise<Shop> {
    const response = await authFetch("/api/shops/current");
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to fetch shop data"));
    }
    const shop = await response.json();
    Store.shopId = (shop as { shop_id?: string }).shop_id ?? null;
    return shop;
  }

  /**
   * Update the cash and float balances, and return the updated shop.
   */
  public static async updateBalances(cashKsh: number, floatKsh: number): Promise<Shop> {
    if (!Store.shopId) await Store.fetchShop();

    const response = await authFetch(`/api/shops/${Store.shopId}/balances`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cash_ksh: cashKsh, float_ksh: floatKsh }),
    });
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to update balances"));
    }
    return await response.json();
  }

  /**
   * Fetch peer shops from the backend.
   * (The backend has no /api/shops/peers route yet, so this returns 404 until it is added.)
   */
  public static async fetchPeers(): Promise<PeerShop[]> {
    const response = await authFetch("/api/shops/peers");
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to fetch peer shop data"));
    }
    return await response.json();
  }

  /**
   * Fetch stockout incidents from the backend.
   * (The backend has no /api/stockouts route yet, so this returns 404 until it is added.)
   */
  public static async fetchStockoutIncidents(): Promise<StockoutIncident[]> {
    const response = await authFetch("/api/stockouts");
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to fetch stockout incidents"));
    }
    return await response.json();
  }

  /**
   * Fetch the saved chat history for the logged-in user.
   * The backend stores each chat as a text "message", so each entry was saved as JSON
   * (see saveChat). Rows that are not valid entries are skipped.
   */
  public static async fetchChats(): Promise<ChatEntry[]> {
    const response = await authFetch("/chats");
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to fetch chat history"));
    }
    const data = await response.json();
    const rows: Array<{ message?: string }> = Array.isArray(data?.chats) ? data.chats : [];

    const entries: ChatEntry[] = [];
    for (const row of rows) {
      try {
        const entry = JSON.parse(row.message ?? "");
        if (entry && typeof entry.text === "string" && (entry.role === "user" || entry.role === "assistant")) {
          entries.push(entry as ChatEntry);
        }
      } catch {
        /* not one of our JSON entries */
      }
    }
    return entries;
  }

  /**
   * Save a chat entry. The backend accepts {message: string} (up to 4000 characters),
   * so the entry is sent as a JSON string.
   */
  public static async saveChat(entry: ChatEntry): Promise<void> {
    const response = await authFetch("/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: JSON.stringify(entry) }),
    });
    if (!response.ok) {
      throw new Error(await errorMessage(response, "Failed to save chat entry"));
    }
  }
}