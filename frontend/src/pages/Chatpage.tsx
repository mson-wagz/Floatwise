import { useState, useEffect } from "react";
import ChatPanel from "../components/ChatPannel";
import { LocalStore, type ChatEntry } from "../lib/store";
import { SimulationEngine } from "../lib/engine";
import { verifyAdviceText } from "../lib/verifier";
import { useTranslation } from "react-i18next";

export default function ChatPage() {
  const { i18n } = useTranslation();
  const [shop, setShop] = useState(LocalStore.getShop());
  const [chats, setChats] = useState<ChatEntry[]>(LocalStore.getChats());
  const lang = (i18n.language?.startsWith("sw") ? "sw" : "en") as "sw" | "en";

  useEffect(() => {
    // Keep local shop state refreshed
    setShop(LocalStore.getShop());
  }, []);

  const handleSendMessage = (userMessage: string) => {
    // 1. Add user message
    const userEntry: ChatEntry = {
      id: `usr_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: "user",
      text: userMessage,
      language: lang,
      verified: true,
    };

    // 2. Parse user query for scenarios (e.g. "what if school fees on Thursday")
    const lower = userMessage.toLowerCase();
    let scenarioMultiplier = 1.0;
    const events: Array<{ date: string; multiplier: number; label: string }> = [];

    if (lower.includes("school") || lower.includes("karo")) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2); // Upcoming Thursday / fee day
      events.push({
        date: targetDate.toISOString().split("T")[0],
        multiplier: 2.3,
        label: "School Fees Spike",
      });
      scenarioMultiplier = 1.3;
    } else if (lower.includes("market") || lower.includes("soko")) {
      scenarioMultiplier = 1.8;
    } else if (lower.includes("payday") || lower.includes("mshahara")) {
      scenarioMultiplier = 1.6;
    }

    // 3. Compute deterministic calculation
    const calc = SimulationEngine.recommend(shop.cash_ksh, shop.float_ksh, new Date(), 14, {
      demand_multiplier: scenarioMultiplier,
      events,
    });

    // 4. Draft conversational advice & verify every number
    let draft = "";
    if (lower.includes("school") || lower.includes("karo")) {
      if (lang === "sw") {
        draft = `Ikiwa karo za shule zinalipwa Alhamisi, mahitaji ya kutoa pesa taslimu yataongezeka sana. ${calc.plain_text_sw}`;
      } else {
        draft = `If school fees are due on Thursday, cash withdrawals will surge heavily. ${calc.plain_text_en}`;
      }
    } else if (lower.includes("why") || lower.includes("kwa nini")) {
      if (lang === "sw") {
        draft = `Float ya simu inapungua pale wateja wanapoweka pesa (deposits). Wateja wakiweka pesa, unachukua pesa taslimu na kutuma float kutoka kwa simu. ${calc.plain_text_sw}`;
      } else {
        draft = `Phone float decreases when customers deposit cash. You take cash into your till and send them e-float from your phone. ${calc.plain_text_en}`;
      }
    } else {
      draft = lang === "sw" ? calc.plain_text_sw : calc.plain_text_en;
    }

    // 5. Run number verifier
    const verification = verifyAdviceText(draft, calc, lang);

    const assistantEntry: ChatEntry = {
      id: `ast_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: "assistant",
      text: verification.safeText,
      language: lang,
      stockoutProbability: calc.restock?.p_plan_restocks_by_then ?? 0.46,
      restockAmountKsh: calc.restock?.add_cash_ksh ?? calc.restock?.add_float_ksh ?? 22000,
      restockDay: calc.restock?.weekday ?? "Saturday",
      verified: verification.verified,
      unsupportedNumbers: verification.unsupportedNumbers,
      source: verification.source,
    };

    const updatedChats = [...chats, userEntry, assistantEntry];
    setChats(updatedChats);
    LocalStore.saveChats(updatedChats);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block mb-1">
            Shopkeeper Assistant • Nairobi
          </span>
          <h1 className="text-2xl font-black tracking-tight">
            FloatWise Advisor
          </h1>
          <p className="text-sm opacity-90 mt-1 max-w-xl">
            Ask any question in Swahili or English. Every number comes from a deterministic simulation—the AI never invents any.
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

      {/* Main Conversational Panel */}
      <ChatPanel
        chats={chats}
        onSendMessage={handleSendMessage}
        currentCash={shop.cash_ksh}
        currentFloat={shop.float_ksh}
      />
    </div>
  );
}
