import type { components } from "../api/schema";

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

export class Store {
  /**
   * Fetch shop data dynamically from the backend.
   */
  public static async fetchShop(): Promise<Shop> {
    try {
      const response = await fetch("/api/shops/current", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`, // Include token if required
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch shop data");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching shop data:", error);
      throw error;
    }
  }

  /**
   * Fetch peer shops dynamically from the backend.
   */
  public static async fetchPeers(): Promise<PeerShop[]> {
    try {
      const response = await fetch("/api/shops/peers");
      if (!response.ok) {
        throw new Error("Failed to fetch peer shop data");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching peer shop data:", error);
      throw error;
    }
  }

  /**
   * Fetch stockout incidents dynamically from the backend.
   */
  public static async fetchStockoutIncidents(): Promise<StockoutIncident[]> {
    try {
      const response = await fetch("/api/stockouts");
      if (!response.ok) {
        throw new Error("Failed to fetch stockout incidents");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching stockout incidents:", error);
      throw error;
    }
  }

  /**
   * Fetch chat history dynamically from the backend.
   */
  public static async fetchChats(): Promise<ChatEntry[]> {
    try {
      const response = await fetch("/api/chats");
      if (!response.ok) {
        throw new Error("Failed to fetch chat history");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching chat history:", error);
      throw error;
    }
  }

  /**
   * Save a new chat entry to the backend.
   */
  public static async saveChat(entry: ChatEntry): Promise<void> {
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!response.ok) {
        throw new Error("Failed to save chat entry");
      }
    } catch (error) {
      console.error("Error saving chat entry:", error);
      throw error;
    }
  }
}