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

const DEFAULT_SHOP: Shop = {
  shop_id: "shop_mama_stacy",
  name: "Mama Stacy M-Pesa & Grocery",
  location: "Umoja 1 Market, Outering Rd, Nairobi",
  language: "sw",
  cash_ksh: 38000,
  float_ksh: 52000,
  market_days: ["saturday", "wednesday"],
  payday_dates: [25, 30, 31, 1],
  transaction_count: 142,
  as_of: new Date().toISOString(),
};

const DEFAULT_PEERS: PeerShop[] = [
  {
    id: "peer_brian",
    name: "Mama Brian M-Pesa & Chemist",
    location: "Opposite Equity Bank, 65m away",
    distance_m: 65,
    status: "surplus_cash",
    cash_excess_ksh: 35000,
    float_excess_ksh: 0,
    verified: true,
    contact: "0712 345 678",
  },
  {
    id: "peer_total",
    name: "TotalEnergies Service Station Agent",
    location: "Outering Roundabout, 140m away",
    distance_m: 140,
    status: "surplus_float",
    cash_excess_ksh: 0,
    float_excess_ksh: 48000,
    verified: true,
    contact: "0722 889 900",
  },
  {
    id: "peer_kamau",
    name: "Kamau Electronics & Simu",
    location: "Moi Drive, Umoja, 210m away",
    distance_m: 210,
    status: "surplus_cash",
    cash_excess_ksh: 20000,
    float_excess_ksh: 0,
    verified: true,
    contact: "0733 112 233",
  },
  {
    id: "peer_oti",
    name: "Oti Posho Mill Agent",
    location: "Umoja Market Stall 44, 280m away",
    distance_m: 280,
    status: "balanced",
    cash_excess_ksh: 0,
    float_excess_ksh: 0,
    verified: false,
    contact: "0720 554 433",
  },
];

const DEFAULT_STOCKOUTS: StockoutIncident[] = [
  {
    id: "so_1",
    date: "2026-10-24",
    time: "15:45",
    type: "cash",
    customerRequestKsh: 15000,
    lostCommissionKsh: 100,
    reason: "Saturday Market Day withdrawal surge ran drawer empty",
  },
  {
    id: "so_2",
    date: "2026-10-25",
    time: "11:20",
    type: "cash",
    customerRequestKsh: 20000,
    lostCommissionKsh: 145,
    reason: "Civil servants payday cash withdrawal",
  },
  {
    id: "so_3",
    date: "2026-10-20",
    time: "17:10",
    type: "float",
    customerRequestKsh: 30000,
    lostCommissionKsh: 145,
    reason: "Wholesale merchant depositing cash, phone float depleted",
  },
  {
    id: "so_4",
    date: "2026-10-14",
    time: "14:05",
    type: "cash",
    customerRequestKsh: 10000,
    lostCommissionKsh: 60,
    reason: "School fees payment week",
  },
  {
    id: "so_5",
    date: "2026-10-08",
    time: "16:30",
    type: "cash",
    customerRequestKsh: 25000,
    lostCommissionKsh: 145,
    reason: "Market Day rush",
  },
];

export class LocalStore {
  private static getKey(key: string): string {
    return `floatwise_${key}`;
  }

  public static getShop(): Shop {
    const raw = localStorage.getItem(this.getKey("shop"));
    if (!raw) {
      this.saveShop(DEFAULT_SHOP);
      return DEFAULT_SHOP;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_SHOP;
    }
  }

  public static saveShop(shop: Shop): void {
    localStorage.setItem(this.getKey("shop"), JSON.stringify(shop));
  }

  public static updateBalances(cashKsh: number, floatKsh: number): Shop {
    const shop = this.getShop();
    shop.cash_ksh = Math.max(0, cashKsh);
    shop.float_ksh = Math.max(0, floatKsh);
    shop.as_of = new Date().toISOString();
    this.saveShop(shop);
    return shop;
  }

  public static getPendingBatch(): Batch | null {
    const raw = localStorage.getItem(this.getKey("pending_batch"));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static savePendingBatch(batch: Batch | null): void {
    if (!batch) {
      localStorage.removeItem(this.getKey("pending_batch"));
    } else {
      localStorage.setItem(this.getKey("pending_batch"), JSON.stringify(batch));
    }
  }

  public static commitBatch(batch: Batch): { shop: Shop; transactionsAdded: number } {
    const shop = this.getShop();
    const existingTxns = this.getTransactions();

    let netCash = 0;
    let netFloat = 0;

    for (const t of batch.transactions) {
      netCash += t.cash_delta_ksh;
      netFloat += t.float_delta_ksh;
      existingTxns.unshift(t);
    }

    // Apply deltas to drawer and phone
    shop.cash_ksh = Math.max(0, shop.cash_ksh + netCash);
    if (batch.float_balance_ksh !== undefined && batch.float_balance_ksh > 0) {
      // If the SMS reported an explicit new M-Pesa balance, calibrate to that
      shop.float_ksh = batch.float_balance_ksh;
    } else {
      shop.float_ksh = Math.max(0, shop.float_ksh + netFloat);
    }

    shop.transaction_count = existingTxns.length;
    shop.as_of = new Date().toISOString();

    this.saveShop(shop);
    this.saveTransactions(existingTxns);
    this.savePendingBatch(null);

    return { shop, transactionsAdded: batch.transactions.length };
  }

  public static getTransactions(): Transaction[] {
    const raw = localStorage.getItem(this.getKey("transactions"));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveTransactions(txns: Transaction[]): void {
    localStorage.setItem(this.getKey("transactions"), JSON.stringify(txns.slice(0, 500)));
  }

  public static getChats(): ChatEntry[] {
    const raw = localStorage.getItem(this.getKey("chats"));
    if (!raw) {
      return [
        {
          id: "welcome_1",
          timestamp: new Date().toISOString(),
          role: "assistant",
          text: "Habari! Mimi ni msaidizi wako wa FloatWise. Ninaangalia pesa taslimu kwenye droo na salio la simu (M-Pesa) ili usiwahi kuishiwa. Unaweza kusema kwa sauti, kupaste ujumbe wa M-Pesa, au kuuliza mfano 'vipi ikiwa karo za shule zinalipwa Alhamisi?'.",
          language: "sw",
          stockoutProbability: 0.46,
          restockAmountKsh: 22000,
          restockDay: "Saturday",
          verified: true,
          source: "verified_ai",
        },
      ];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveChats(chats: ChatEntry[]): void {
    localStorage.setItem(this.getKey("chats"), JSON.stringify(chats));
  }

  public static addChat(entry: ChatEntry): void {
    const chats = this.getChats();
    chats.push(entry);
    this.saveChats(chats);
  }

  public static getStockoutIncidents(): StockoutIncident[] {
    const raw = localStorage.getItem(this.getKey("stockouts"));
    if (!raw) {
      localStorage.setItem(this.getKey("stockouts"), JSON.stringify(DEFAULT_STOCKOUTS));
      return DEFAULT_STOCKOUTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_STOCKOUTS;
    }
  }

  public static getPeers(): PeerShop[] {
    const raw = localStorage.getItem(this.getKey("peers"));
    if (!raw) {
      localStorage.setItem(this.getKey("peers"), JSON.stringify(DEFAULT_PEERS));
      return DEFAULT_PEERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_PEERS;
    }
  }
}
