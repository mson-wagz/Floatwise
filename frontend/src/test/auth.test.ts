import { describe, it, expect, beforeEach } from "vitest";
import {
  LocalStore,
  isValidKenyanPhone,
  normalizeKenyanPhone,
  formatKenyanPhoneDisplay,
} from "../lib/store";

describe("FloatWise Authentication & Kenyan Phone Validation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("validates valid Kenyan mobile phone numbers", () => {
    // 07xx numbers
    expect(isValidKenyanPhone("0712345678")).toBe(true);
    expect(isValidKenyanPhone("0722889900")).toBe(true);

    // 01xx numbers (newer Safaricom & Airtel blocks)
    expect(isValidKenyanPhone("0112345678")).toBe(true);
    expect(isValidKenyanPhone("0101234567")).toBe(true);

    // With +254 country code
    expect(isValidKenyanPhone("+254712345678")).toBe(true);
    expect(isValidKenyanPhone("+254112345678")).toBe(true);

    // With spaces
    expect(isValidKenyanPhone("0712 345 678")).toBe(true);
    expect(isValidKenyanPhone("+254 712 345 678")).toBe(true);

    // Invalid numbers
    expect(isValidKenyanPhone("")).toBe(false);
    expect(isValidKenyanPhone("0712345")).toBe(false); // Too short
    expect(isValidKenyanPhone("0812345678")).toBe(false); // Invalid prefix (08 not valid mobile)
    expect(isValidKenyanPhone("abcdefghij")).toBe(false);
  });

  it("normalizes Kenyan phone numbers to E.164 format without plus", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
    expect(normalizeKenyanPhone("+254 712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
  });

  it("formats Kenyan phone number for friendly UI display", () => {
    expect(formatKenyanPhoneDisplay("0712345678")).toBe("+254 712 345 678");
  });

  it("registers a new shopkeeper account and prevents duplicate phone registration", () => {
    const res1 = LocalStore.register({
      shopName: "Mama Wanjiku Kiosk",
      phone: "0722112233",
      tillNumber: "123456",
      password: "wanjiku2026",
      preferredLanguage: "sw",
    });

    expect(res1.success).toBe(true);
    expect(res1.user?.shopName).toBe("Mama Wanjiku Kiosk");
    expect(res1.user?.phone).toBe("254722112233");

    // Attempting to register the same phone number again must fail
    const res2 = LocalStore.register({
      shopName: "Duplicate Shop",
      phone: "0722112233",
      password: "anotherpassword",
      preferredLanguage: "en",
    });

    expect(res2.success).toBe(false);
    expect(res2.error).toContain("already exists");
  });

  it("logs in with correct credentials and rejects incorrect password", () => {
    // Demo user Stacy exists
    const success = LocalStore.login("0712345678", "stacy2026");
    expect(success.success).toBe(true);
    expect(success.user?.shopName).toBe("Mama Stacy M-Pesa & Grocery");

    // Wrong password
    const fail = LocalStore.login("0712345678", "wrongpass");
    expect(fail.success).toBe(false);
    expect(fail.error).toContain("Incorrect phone number or password");
  });

  it("enforces rate-limit lockout after 3 consecutive failed login attempts", () => {
    LocalStore.login("0712345678", "wrong1");
    LocalStore.login("0712345678", "wrong2");
    const third = LocalStore.login("0712345678", "wrong3");

    expect(third.success).toBe(false);
    expect(third.remainingSeconds).toBeGreaterThan(0);
    expect(third.error).toContain("Too many incorrect attempts");

    // Any subsequent attempt while locked out is rejected
    const blocked = LocalStore.login("0712345678", "stacy2026");
    expect(blocked.success).toBe(false);
    expect(blocked.remainingSeconds).toBeGreaterThan(0);
  });
});
