import type { components } from "../api/schema";

export type Shop = components["schemas"]["Shop"];
export type Transaction = components["schemas"]["Transaction"];
export type Batch = components["schemas"]["Batch"];
export type PeerShop = components["schemas"]["PeerShop"];

export interface AuthUser {
  id: string;
  shopName: string;
  phone: string;
  tillNumber?: string;
  preferredLanguage: "en" | "sw";
  passwordHash: string;
  createdAt: string;
}

export interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // timestamp ms
}

const DEFAULT_USERS: AuthUser[] = [
  {
    id: "usr_mama_stacy",
    shopName: "Mama Stacy M-Pesa & Grocery",
    phone: "254712345678",
    tillNumber: "892144",
    preferredLanguage: "sw",
    passwordHash: "stacy2026",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr_brian",
    shopName: "Mama Brian M-Pesa & Chemist",
    phone: "254722889900",
    tillNumber: "741258",
    preferredLanguage: "en",
    passwordHash: "brian2026",
    createdAt: new Date().toISOString(),
  },
];

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

export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "254" + digits.slice(1);
  }
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  return digits;
}

export function formatKenyanPhoneDisplay(raw: string): string {
  const norm = normalizeKenyanPhone(raw);
  if (norm.length === 12 && norm.startsWith("254")) {
    return `+254 ${norm.slice(3, 6)} ${norm.slice(6, 9)} ${norm.slice(9)}`;
  }
  return raw;
}

export function isValidKenyanPhone(raw: string): boolean {
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  // 07XXXXXXXX or 01XXXXXXXX (10 digits)
  if (digits.length === 10 && digits.startsWith("0") && (digits[1] === "7" || digits[1] === "1")) {
    return true;
  }
  // 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
  if (digits.length === 12 && digits.startsWith("254") && (digits[3] === "7" || digits[3] === "1")) {
    return true;
  }
  return false;
}

export class LocalStore {
  private static getKey(key: string): string {
    return `floatwise_${key}`;
  }

  // --- User Authentication & Session ---
  public static getUsers(): AuthUser[] {
    const raw = localStorage.getItem(this.getKey("users"));
    if (!raw) {
      localStorage.setItem(this.getKey("users"), JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_USERS;
    }
  }

  public static saveUsers(users: AuthUser[]): void {
    localStorage.setItem(this.getKey("users"), JSON.stringify(users));
  }

  public static getCurrentUser(): AuthUser | null {
    // Check session storage first (if remember me was false), then local storage
    const sessionRaw = sessionStorage.getItem(this.getKey("current_user"));
    if (sessionRaw) {
      try { return JSON.parse(sessionRaw); } catch { /* ignore */ }
    }
    const localRaw = localStorage.getItem(this.getKey("current_user"));
    if (localRaw) {
      try { return JSON.parse(localRaw); } catch { return null; }
    }
    return null;
  }

  public static setCurrentUser(user: AuthUser | null, remember = true): void {
    if (!user) {
      localStorage.removeItem(this.getKey("current_user"));
      sessionStorage.removeItem(this.getKey("current_user"));
    } else {
      const payload = JSON.stringify(user);
      if (remember) {
        localStorage.setItem(this.getKey("current_user"), payload);
        sessionStorage.removeItem(this.getKey("current_user"));
      } else {
        sessionStorage.setItem(this.getKey("current_user"), payload);
        localStorage.removeItem(this.getKey("current_user"));
      }
    }
  }

  public static getLockoutState(): LockoutState {
    const raw = localStorage.getItem(this.getKey("lockout"));
    if (!raw) return { attempts: 0, lockedUntil: null };
    try {
      const state: LockoutState = JSON.parse(raw);
      if (state.lockedUntil && Date.now() > state.lockedUntil) {
        // Lockout expired
        return { attempts: 0, lockedUntil: null };
      }
      return state;
    } catch {
      return { attempts: 0, lockedUntil: null };
    }
  }

  public static setLockoutState(state: LockoutState): void {
    localStorage.setItem(this.getKey("lockout"), JSON.stringify(state));
  }

  public static getLockoutRemainingSeconds(): number {
    const state = this.getLockoutState();
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      return Math.ceil((state.lockedUntil - Date.now()) / 1000);
    }
    return 0;
  }

  public static register(data: {
    shopName: string;
    phone: string;
    tillNumber?: string;
    password: string;
    preferredLanguage: "en" | "sw";
  }): { success: boolean; user?: AuthUser; error?: string } {
    const normPhone = normalizeKenyanPhone(data.phone);
    const users = this.getUsers();

    // Check if phone already registered
    const exists = users.some((u) => u.phone === normPhone);
    if (exists) {
      return {
        success: false,
        error: "An account with this phone number already exists. Try logging in.",
      };
    }

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      shopName: data.shopName.trim(),
      phone: normPhone,
      tillNumber: data.tillNumber?.trim() || undefined,
      preferredLanguage: data.preferredLanguage,
      passwordHash: data.password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    // Sync shop profile
    const shop = this.getShop();
    shop.name = newUser.shopName;
    shop.language = newUser.preferredLanguage;
    this.saveShop(shop);

    this.setCurrentUser(newUser, true);
    return { success: true, user: newUser };
  }

  public static login(
    phone: string,
    password: string,
    remember = true
  ): { success: boolean; user?: AuthUser; error?: string; remainingSeconds?: number } {
    // 1. Check lockout
    const remaining = this.getLockoutRemainingSeconds();
    if (remaining > 0) {
      return {
        success: false,
        error: "Too many incorrect attempts. Please wait 1 minute before trying again.",
        remainingSeconds: remaining,
      };
    }

    const normPhone = normalizeKenyanPhone(phone);
    const users = this.getUsers();
    const user = users.find((u) => u.phone === normPhone && u.passwordHash === password);

    if (!user) {
      // Record failed attempt
      const state = this.getLockoutState();
      const newAttempts = state.attempts + 1;
      if (newAttempts >= 3) {
        const lockedUntil = Date.now() + 60 * 1000; // 60 seconds lockout
        this.setLockoutState({ attempts: newAttempts, lockedUntil });
        return {
          success: false,
          error: "Too many incorrect attempts. Please wait 1 minute before trying again.",
          remainingSeconds: 60,
        };
      } else {
        this.setLockoutState({ attempts: newAttempts, lockedUntil: null });
        return {
          success: false,
          error: "Incorrect phone number or password. Please try again.",
        };
      }
    }

    // Success: clear lockout
    this.setLockoutState({ attempts: 0, lockedUntil: null });

    // Sync active shop profile
    const shop = this.getShop();
    shop.name = user.shopName;
    shop.language = user.preferredLanguage;
    this.saveShop(shop);

    this.setCurrentUser(user, remember);
    return { success: true, user };
  }

  public static logout(): void {
    this.setCurrentUser(null, false);
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
