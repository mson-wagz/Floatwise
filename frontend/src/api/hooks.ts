import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { useShopId } from "../lib/shop";

export function useChat() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (body: { message: string; language: "sw" | "en"; conversation_id?: string }) =>
      api(`/shops/${shopId}/chat`, { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useForecast(days = 7) {
  const shopId = useShopId();
  return useQuery({
    queryKey: ["forecast", shopId, days],
    queryFn: () => api(`/shops/${shopId}/forecast?horizon_days=${days}`),
  });
}

export function useReplay(days = 30) {
  const shopId = useShopId();
  return useQuery({
    queryKey: ["replay", shopId, days],
    queryFn: () => api(`/shops/${shopId}/replay?days=${days}`),
  });
}