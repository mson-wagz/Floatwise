import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useShop, useShopId } from "../lib/shop";
import { toForecast, toRecommendation, toWhatIf } from "./adapters";

export type WhatIfScenario = {
  market_day?: string; // singular: the backend takes one day
  demand_multiplier?: number;
  events?: { date: string; multiplier: number; label: string }[];
  horizon_days?: number;
};

// ---------- chat ----------
export function useChat() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (body: {
      question: string;
      language: "sw" | "en";
      history: { role: "user" | "assistant"; content: string }[];
    }) => api(`/shops/${shopId}/chat`, { method: "POST", body: JSON.stringify(body) }),
  });
}

// ---------- model outputs ----------
export function useForecast(days = 7) {
  const { data: shop } = useShop();
  return useQuery({
    queryKey: ["forecast", shop?.shop_id, days],
    queryFn: async () =>
      toForecast(await api(`/shops/${shop!.shop_id}/forecast?horizon_days=${days}`), shop!),
    enabled: !!shop,
  });
}

export function useRecommendation(days = 14) {
  const shopId = useShopId();
  return useQuery({
    queryKey: ["recommendation", shopId, days],
    queryFn: async () =>
      toRecommendation(await api(`/shops/${shopId}/recommendation?horizon_days=${days}`)),
    enabled: !!shopId,
  });
}

export function useWhatIf(scenario: WhatIfScenario) {
  const shopId = useShopId();
  return useQuery({
    queryKey: ["whatif", shopId, scenario],
    queryFn: async () =>
      toWhatIf(
        await api(`/shops/${shopId}/whatif`, {
          method: "POST",
          body: JSON.stringify(scenario),
        })
      ),
    enabled: !!shopId,
  });
}

export function useReplay(days = 30) {
  const shopId = useShopId();
  return useQuery({
    queryKey: ["replay", shopId, days],
    queryFn: () => api(`/shops/${shopId}/replay?days=${days}`),
    enabled: !!shopId,
    retry: false, // a 400 "no history yet" is an answer, not a glitch
  });
}

// ---------- data entry: sms / voice / ledger photo all return a pending batch ----------
export function useIngestSms() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (text: string) =>
      api(`/shops/${shopId}/sms`, { method: "POST", body: JSON.stringify({ text }) }),
  });
}

export function useUploadAudio() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (blob: Blob) => {
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      return api(`/shops/${shopId}/voice`, { method: "POST", body: fd });
    },
  });
}

export function useUploadLedger() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return api(`/shops/${shopId}/ledger-image`, { method: "POST", body: fd });
    },
  });
}

export function useConfirmBatch() {
  const shopId = useShopId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      batchId: string;
      edits: { id: string; type?: string; amount_ksh?: number }[];
      removed_ids: string[];
    }) =>
      api(`/shops/${shopId}/batches/${v.batchId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ edits: v.edits, removed_ids: v.removed_ids }),
      }),
    // balances and history changed, so every forecast, advice and replay is stale
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRejectBatch() {
  const shopId = useShopId();
  return useMutation({
    mutationFn: (batchId: string) =>
      api(`/shops/${shopId}/batches/${batchId}/reject`, { method: "POST" }),
  });
}