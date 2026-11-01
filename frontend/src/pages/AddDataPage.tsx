import { useState } from "react";
import { useTranslation } from "react-i18next";
import VoiceRecorder from "../components/VoiceRecorder";
import ImagePicker from "../components/ImagePicker";
import TransactionTable from "../components/TransactionTable";
import { parseMpesaSms } from "../lib/ingest";
import { LocalStore } from "../lib/store";
import type { components } from "../api/schema";

type Transaction = components["schemas"]["Transaction"];

const SAMPLE_MPESA_SMS = `QA12BC34DE Confirmed. Ksh3,500.00 sent to MAMA STACY 0712345678 on 28/10/26 at 2:15 PM. New M-PESA balance is Ksh48,500.00.
QA12BC34DF Confirmed. You have received Ksh5,000.00 from JOHN KAMAU 0722998877 on 28/10/26 at 3:10 PM. New M-PESA balance is Ksh43,500.00.
QA12BC34DG Confirmed. on 28/10/26 at 4:20 PM Give Ksh12,000.00 cash to MARY WANJIKU 0733123456. New M-PESA balance is Ksh55,500.00.`;

export default function AddDataPage() {
  const { t } = useTranslation();
  const [shop, setShop] = useState(LocalStore.getShop());
  const [activeTab, setActiveTab] = useState<"voice" | "sms" | "ledger">("voice");
  const [smsText, setSmsText] = useState("");
  const [pendingBatch, setPendingBatch] = useState<{
    transactions: Transaction[];
    warnings: string[];
    detectedFloatBalance?: number;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSmsAnalyze = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smsText.trim()) return;

    const result = parseMpesaSms(smsText, shop.cash_ksh, shop.float_ksh);
    setPendingBatch(result);
  };

  const loadSampleSms = () => {
    setSmsText(SAMPLE_MPESA_SMS);
    const result = parseMpesaSms(SAMPLE_MPESA_SMS, shop.cash_ksh, shop.float_ksh);
    setPendingBatch(result);
  };

  const handleBatchExtracted = (result: { transactions: Transaction[]; warnings: string[] }) => {
    setPendingBatch(result);
  };

  const handleConfirmBatch = (confirmedTxns: Transaction[]) => {
    if (!pendingBatch) return;

    const batch: components["schemas"]["Batch"] = {
      batch_id: `batch_${Date.now()}`,
      shop_id: shop.shop_id,
      status: "confirmed",
      transactions: confirmedTxns,
      warnings: pendingBatch.warnings,
      float_balance_ksh: pendingBatch.detectedFloatBalance,
      unparsed: [],
    };

    const { shop: updatedShop, transactionsAdded } = LocalStore.commitBatch(batch);
    setShop(updatedShop);
    setPendingBatch(null);
    setSmsText("");
    setSuccessMessage(
      `✓ Successfully saved ${transactionsAdded} transactions! Cash drawer updated to KSh ${updatedShop.cash_ksh.toLocaleString()} and phone float to KSh ${updatedShop.float_ksh.toLocaleString()}.`
    );

    setTimeout(() => {
      setSuccessMessage(null);
    }, 6000);
  };

  const handleRejectBatch = () => {
    setPendingBatch(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("ingest.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("ingest.subtitle")}
        </p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-sm font-semibold flex items-center justify-between shadow-sm">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 dark:text-emerald-300 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Mode Selector Tabs */}
      {!pendingBatch && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("voice")}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === "voice"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🎙️</span>
              <span>{t("ingest.tab_voice")}</span>
            </button>
            <button
              onClick={() => setActiveTab("sms")}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === "sms"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📱</span>
              <span>{t("ingest.tab_sms")}</span>
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === "ledger"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📸</span>
              <span>{t("ingest.tab_ledger")}</span>
            </button>
          </div>

          {/* Active Tab Content */}
          {activeTab === "voice" && (
            <VoiceRecorder
              onExtracted={handleBatchExtracted}
              currentCash={shop.cash_ksh}
              currentFloat={shop.float_ksh}
            />
          )}

          {activeTab === "sms" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Paste M-Pesa SMS Messages
                </label>
                <textarea
                  rows={5}
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder={t("ingest.sms_placeholder")}
                  className="w-full text-sm font-mono p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                ></textarea>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={loadSampleSms}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  📋 {t("ingest.sample_sms")}
                </button>

                <button
                  type="button"
                  onClick={handleSmsAnalyze}
                  disabled={!smsText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
                >
                  {t("ingest.parse_button")}
                </button>
              </div>
            </div>
          )}

          {activeTab === "ledger" && (
            <ImagePicker
              onExtracted={handleBatchExtracted}
              currentCash={shop.cash_ksh}
              currentFloat={shop.float_ksh}
            />
          )}
        </div>
      )}

      {/* Human-in-the-Loop Review Screen */}
      {pendingBatch && (
        <div className="border border-emerald-500/30 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                Step 2 of 2 • Human in the Loop
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {t("ingest.review_title")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("ingest.review_subtitle")}
              </p>
            </div>

            <button
              onClick={handleRejectBatch}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>

          <TransactionTable
            transactions={pendingBatch.transactions}
            warnings={pendingBatch.warnings}
            onConfirm={handleConfirmBatch}
            onReject={handleRejectBatch}
            currentCash={shop.cash_ksh}
            currentFloat={shop.float_ksh}
          />
        </div>
      )}
    </div>
  );
}
