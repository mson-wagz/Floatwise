import React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import VoiceRecorder from "../components/VoiceRecorder";
import ImagePicker from "../components/ImagePicker";
import TransactionTable from "../components/TransactionTable";
import { useIngestSms, useConfirmBatch, useRejectBatch } from "../api/hooks";
import { useShop } from "../lib/shop";
import type { components } from "../api/schema";

type Transaction = components["schemas"]["Transaction"];

// Shape returned by the backend's _batch() serializer
type ServerBatch = {
  batch_id: string;
  transactions: Transaction[];
  warnings: string[];
  unparsed: string[];
  float_balance_ksh: number | null;
};

const SAMPLE_MPESA_SMS = `QA12BC34DE Confirmed. Ksh3,500.00 sent to MAMA STACY 0712345678 on 28/10/26 at 2:15 PM. New M-PESA balance is Ksh48,500.00.
QA12BC34DF Confirmed. You have received Ksh5,000.00 from JOHN KAMAU 0722998877 on 28/10/26 at 3:10 PM. New M-PESA balance is Ksh43,500.00.
QA12BC34DG Confirmed. on 28/10/26 at 4:20 PM Give Ksh12,000.00 cash to MARY WANJIKU 0733123456. New M-PESA balance is Ksh55,500.00.`;

export default function AddDataPage() {
  const { t } = useTranslation();
  const { data: shop } = useShop();
  const ingest = useIngestSms();
  const confirm = useConfirmBatch();
  const reject = useRejectBatch();

  const [activeTab, setActiveTab] = useState<"voice" | "sms" | "ledger">("voice");
  const [smsText, setSmsText] = useState("");
  const [batch, setBatch] = useState<ServerBatch | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!shop) return <p className="text-sm text-slate-500">Connecting to FloatWise…</p>;

  const showError = (e: Error) => setErrorMessage(e.message);

  const analyzeSms = (text: string) => {
    if (!text.trim()) return;
    setErrorMessage(null);
    ingest.mutate(text, {
      onSuccess: (b: ServerBatch) => setBatch(b),
      onError: showError,
    });
  };

  // VoiceRecorder and ImagePicker upload to the backend themselves
  // and hand the returned batch to this callback.
  const handleBatchExtracted = (b: ServerBatch) => {
    setErrorMessage(null);
    setBatch(b);
  };

  const handleConfirmBatch = (confirmed: Transaction[]) => {
    if (!batch) return;

    const original = new Map<string, any>(batch.transactions.map((tx: any) => [tx.id, tx]));
    const keptIds = new Set(confirmed.map((tx: any) => tx.id));

    const removed_ids = [...original.keys()].filter((id) => !keptIds.has(id));
    const edits = confirmed
      .filter((tx: any) => {
        const o = original.get(tx.id);
        return o && (o.type !== tx.type || o.amount_ksh !== tx.amount_ksh);
      })
      .map((tx: any) => ({ id: tx.id, type: tx.type, amount_ksh: tx.amount_ksh }));

    confirm.mutate(
      { batchId: batch.batch_id, edits, removed_ids },
      {
        onSuccess: (r: any) => {
          const saved = confirmed.length;
          setBatch(null);
          setSmsText("");
          setSuccessMessage(`✓ Saved ${saved} transaction${saved === 1 ? "" : "s"}. Balances updated.`);
          setTimeout(() => setSuccessMessage(null), 6000);
        },
        onError: showError,
      }
    );
  };

  const handleRejectBatch = () => {
    if (batch) reject.mutate(batch.batch_id);
    setBatch(null);
  };

  const tabClass = (tab: typeof activeTab) =>
    `flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
      activeTab === tab
        ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
        : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("ingest.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("ingest.subtitle")}</p>
      </div>

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

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold ml-3">
            ✕
          </button>
        </div>
      )}

      {!batch && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab("voice")} className={tabClass("voice")}>
              <span>🎙️</span>
              <span>{t("ingest.tab_voice")}</span>
            </button>
            <button onClick={() => setActiveTab("sms")} className={tabClass("sms")}>
              <span>📱</span>
              <span>{t("ingest.tab_sms")}</span>
            </button>
            <button onClick={() => setActiveTab("ledger")} className={tabClass("ledger")}>
              <span>📸</span>
              <span>{t("ingest.tab_ledger")}</span>
            </button>
          </div>

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
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSmsText(SAMPLE_MPESA_SMS);
                    analyzeSms(SAMPLE_MPESA_SMS);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  📋 {t("ingest.sample_sms")}
                </button>

                <button
                  type="button"
                  onClick={() => analyzeSms(smsText)}
                  disabled={!smsText.trim() || ingest.isPending}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
                >
                  {ingest.isPending ? "Reading…" : t("ingest.parse_button")}
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

      {batch && (
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

          {batch.unparsed.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              Could not read {batch.unparsed.length} line{batch.unparsed.length === 1 ? "" : "s"}.
              Check the ones below or add them by hand.
            </div>
          )}

          <TransactionTable
            transactions={batch.transactions}
            warnings={batch.warnings}
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