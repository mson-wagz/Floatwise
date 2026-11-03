import React from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ChatPanel from "../components/ChatPannel";
import { Store, type ChatEntry } from "../lib/store";
import { useChat } from "../api/hooks";
import { useShop } from "../lib/shop";

export default function ChatPage() {
  const { i18n } = useTranslation();
  const { data: shop, isLoading: shopLoading, error: shopError } = useShop();
  const chat = useChat();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const lang = (i18n.language?.startsWith("en") ? "en" : "sw") as "en" | "sw";

  // Fetch chat history dynamically from the backend
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const chatHistory = await Store.fetchChats(); // Fetch chats from the backend
        setChats(chatHistory);
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };

    fetchChats();
  }, []);

  // Append a new chat entry to the chat history
  const append = (entry: ChatEntry) => {
    setChats((prev) => [...prev, entry]);
  };

  // Handle sending a user message
  const handleSendMessage = (userMessage: string) => {
    if (!shop || chat.isPending) return;

    // Capture the last 10 messages as history
    const history = chats
      .slice(-10)
      .map((c) => ({ role: c.role as "user" | "assistant", content: c.text }));

    // Append the user's message to the chat
    append({
      id: `usr_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: "user",
      text: userMessage,
      language: lang,
      verified: true,
    });

    // Send the user's message to the backend
    chat.mutate(
      { question: userMessage, language: lang, history },
      {
        onSuccess: (response: any) => {
          append({
            id: `ast_${Date.now()}`,
            timestamp: new Date().toISOString(),
            role: "assistant",
            text: response.text, // Response from the backend
            language: lang,
            verified: response.verified,
            unsupportedNumbers: response.unsupported_numbers,
            source: response.used_fallback ? "fallback" : "llm",
          } as ChatEntry);
        },
        onError: (error: Error) => {
          append({
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            role: "assistant",
            text: `⚠️ ${error.message}`,
            language: lang,
            verified: false,
          } as ChatEntry);
        },
      }
    );
  };

  // Show loading state if the shop data is still being fetched
  if (shopLoading) return <p className="text-sm text-slate-500">Connecting to FloatWise…</p>;

  // Show error state if the shop data could not be fetched
  if (shopError || !shop)
    return (
      <p className="text-sm text-rose-600">
        Could not reach the server: {(shopError as Error | null)?.message ?? "unknown error"}
      </p>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Shop Information */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block mb-1">
            Shopkeeper Assistant • Nairobi
          </span>
          <h1 className="text-2xl font-black tracking-tight">FloatWise Advisor</h1>
          <p className="text-sm opacity-90 mt-1 max-w-xl">
            {lang === "sw"
              ? "Uliza swali lolote kwa Kiswahili au Kiingereza. Kila nambari inatokana na simulizi ya uhakika, na majibu yanakaguliwa kabla hujayaona."
              : "Ask any question in Swahili or English. Every number comes from a deterministic simulation, and replies are checked before you see them."}
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur rounded-xl p-3 border border-white/20 text-xs space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="opacity-80">{lang === "sw" ? "Pesa taslimu:" : "Till Cash:"}</span>
            <span className="font-mono font-bold">KSh {shop.cash_ksh.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="opacity-80">{lang === "sw" ? "Float ya simu:" : "Phone Float:"}</span>
            <span className="font-mono font-bold">KSh {shop.float_ksh.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        chats={chats}
        onSendMessage={handleSendMessage}
        currentCash={shop.cash_ksh}
        currentFloat={shop.float_ksh}
      />

      {/* Thinking Indicator */}
      {chat.isPending && (
        <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
          {lang === "en" ? "Thinking…" : "Inafikiria…"}
        </p>
      )}
    </div>
  );
}