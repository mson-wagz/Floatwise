import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";

const KEY = "floatwise_shop_id";

/**
 * Ensure the shop exists by either fetching it from the server
 * or creating a new one dynamically based on user input or external data.
 */
async function ensureShop() {
  const saved = localStorage.getItem(KEY);

  // If a shop ID is saved in localStorage, try to fetch it
  if (saved) {
    try {
      return await api(`/shops/${saved}`);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
      // If the shop is not found on the server, fall through to recreate it
    }
  }

  // Dynamically create a new shop (replace this with user input or external data)
  const shopData = await getShopData();
  const shop = await api("/shops", {
    method: "POST",
    body: JSON.stringify(shopData),
  });

  // Save the new shop ID in localStorage
  localStorage.setItem(KEY, shop.shop_id);
  return shop;
}

/**
 * Dynamically fetch or generate shop data.
 * Replace this function with user input, API calls, or other dynamic sources.
 */
async function getShopData() {
  // Example: Fetch shop data from an external API or user input
  // Replace this with your actual implementation
  return {
    name: "Dynamic Shop Name", // Replace with user input or external data
    language: "sw", // Replace with user-selected language
    cash_ksh: 0, // Replace with initial cash balance from user input or external data
    float_ksh: 0, // Replace with initial float balance from user input or external data
    market_days: [], // Replace with user-selected market days
    payday_dates: [], // Replace with user-selected payday dates
  };
}

/**
 * React Query hook to fetch or create the shop.
 */
export function useShop() {
  return useQuery({ queryKey: ["shop"], queryFn: ensureShop, staleTime: Infinity });
}

/**
 * React Query hook to get the shop ID.
 */
export const useShopId = () => useShop().data?.shop_id as string | undefined;