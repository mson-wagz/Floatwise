import { useState } from "react";
import { useTranslation } from "react-i18next";
import ChatPanel from "../components/ChatPannel";
import { LocalStore, type ChatEntry } from "../lib/store";
import { useChat } from "../api/hooks";
import { useShop } from "../lib/shop";

export default function ChatPage() {
  const { i18n } = useTranslation();
  const { data: shop, isLoading: shopLoading, error: shopError } = useShop();
  const chat = useChat();
  const [chats, setChats] = useState<ChatEntry[]>(LocalStore.getChats());
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  const append = (entry: ChatEntry) =>
    setChats((prev) => {
      const next = [...prev, entry];
      LocalStore.saveChats(next);
      return next;
    });

  const handleSendMessage = (userMessage: string) => {
    if (!shop || chat.isPending) return;

    // history must be captured before we append the new message
    const history = chats
      .slice(-10)
      .map((c) => ({ role: c.role as "user" | "assistant", content: c.text }));

    append({
      id: `usr_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: "user",
      text: userMessage,
      language: lang,
      verified: true,
    });

    chat.mutate(
      { question: userMessage, language: lang, history },
      {
        onSuccess: (r: any) =>
          append({
            id: `ast_${Date.now()}`,
            timestamp: new Date().toISOString(),
            role: "assistant",
            text: r.text,
            language: lang,
            verified: r.verified,
            unsupportedNumbers: r.unsupported_numbers,
            source: r.used_fallback ? "fallback" : "llm",
          } as ChatEntry),
        onError: (e: Error) =>
          append({
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            role: "assistant",
            text: `⚠️ ${e.message}`,
            language: lang,
            verified: false,
          } as ChatEntry),
      }
    );
  };

  if (shopLoading) return <p className="text-sm text-slate-500">Connecting to FloatWise…</p>;
  if (shopError || !shop)
    return (
      <p className="text-sm text-rose-600">
        Could not reach the server: {(shopError as Error | null)?.message ?? "unknown error"}
      </p>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block mb-1">
            Shopkeeper Assistant • Nairobi
          </span>
          <h1 className="text-2xl font-black tracking-tight">FloatWise Advisor</h1>
          <p className="text-sm opacity-90 mt-1 max-w-xl">
            Ask any question in Swahili or English. Every number comes from a deterministic
            simulation, and replies are checked against it before you see them.
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur rounded-xl p-3 border border-white/20 text-xs space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="opacity-80">Till Cash:</span>
            <span className="font-mono font-bold">KSh {shop.cash_ksh.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="opacity-80">Phone Float:</span>
            <span className="font-mono font-bold">KSh {shop.float_ksh.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <ChatPanel
        chats={chats}
        onSendMessage={handleSendMessage}
        currentCash={shop.cash_ksh}
        currentFloat={shop.float_ksh}
      />

      {chat.isPending && (
        <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
          {lang === "sw" ? "Inafikiria…" : "Thinking…"}
        </p>
      )}
    </div>
  );
}