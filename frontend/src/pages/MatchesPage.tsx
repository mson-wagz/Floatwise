import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client"; // Ensure this is your API client
import { ksh } from "../lib/format";
import type { PeerShop, Shop } from "../lib/store";

export default function MatchesPage() {
  const { t } = useTranslation();
  const [shop, setShop] = useState<Shop | null>(null);
  const [peers, setPeers] = useState<PeerShop[]>([]);
  const [activeModalPeer, setActiveModalPeer] = useState<PeerShop | null>(null);
  const [swapAmount, setSwapAmount] = useState<number>(20000);
  const [swapConfirmed, setSwapConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch shop and peer data from the backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch shop data
        const shopData = await api("/api/shops/shop_mama_stacy"); // Replace with the actual shop ID
        setShop(shopData);

        // Fetch peer shops data
        const peerData = await api("/api/shops/shop_mama_stacy/peers"); // Replace with the actual shop ID
        setPeers(peerData);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Analyze current shop's need
  const isCashLow = shop?.cash_ksh < 35000;
  const isFloatLow = shop?.float_ksh < 35000;

  const handleProposeSwap = (peer: PeerShop) => {
    setActiveModalPeer(peer);
    setSwapConfirmed(false);
    // Suggest appropriate amount
    if (peer.status === "surplus_cash") {
      setSwapAmount(Math.min(25000, peer.cash_excess_ksh));
    } else if (peer.status === "surplus_float") {
      setSwapAmount(Math.min(25000, peer.float_excess_ksh));
    }
  };

  const handleCompleteSwap = async () => {
    try {
      // Send swap request to the backend
      await api(`/api/shops/${shop?.shop_id}/batches/swap`, {
        method: "POST",
        body: JSON.stringify({
          peer_id: activeModalPeer?.id,
          amount_ksh: swapAmount,
        }),
      });

      setSwapConfirmed(true);
      setTimeout(() => {
        setActiveModalPeer(null);
        setSwapConfirmed(false);
      }, 2500);
    } catch (error) {
      console.error("Error completing swap:", error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("swap.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("swap.loading")}
        </p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("swap.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("swap.no_shop")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {t("swap.title")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t("swap.subtitle")}
        </p>
      </div>

      {/* Your Current Status Matcher */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300">
            Your Shop's Balance Profile
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              Till: {ksh(shop.cash_ksh)} Cash | Phone: {ksh(shop.float_ksh)} Float
            </span>
          </div>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-300 mt-1">
            {isCashLow
              ? "⚡ You have low till cash. Best matched with shops holding surplus physical cash."
              : isFloatLow
              ? "⚡ You have low phone float. Best matched with shops holding excess digital float."
              : "✓ Your balances are currently balanced. You can supply cash or float to help neighbors."}
          </p>
        </div>

        <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white font-semibold">
          Umoja 1 Market Radar Active
        </span>
      </div>

      {/* Nearby Peer Shops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {peers.map((peer) => {
          const hasSurplusCash = peer.status === "surplus_cash";
          const hasSurplusFloat = peer.status === "surplus_float";

          return (
            <div
              key={peer.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {peer.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      📍 {peer.location} ({peer.distance_m}m away)
                    </p>
                  </div>

                  {peer.verified && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                      title="Verified Safaricom M-Pesa Merchant"
                    >
                      ✓ Verified
                    </span>
                  )}
                </div>

                {/* Balance Status Callout */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Float Status:</span>
                    <span
                      className={`font-bold ${
                        hasSurplusCash
                          ? "text-emerald-600 dark:text-emerald-400"
                          : hasSurplusFloat
                          ? "text-teal-600 dark:text-teal-400"
                          : "text-slate-600"
                      }`}
                    >
                      {hasSurplusCash
                        ? `Has +${ksh(peer.cash_excess_ksh)} Excess Cash`
                        : hasSurplusFloat
                        ? `Has +${ksh(peer.float_excess_ksh)} Excess Float`
                        : "Balanced"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {hasSurplusCash
                      ? "Looking to swap physical cash for your digital M-Pesa float."
                      : hasSurplusFloat
                      ? "Looking to receive cash in exchange for sending you M-Pesa float."
                      : "Can swap small amounts if needed."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">
                  📞 {peer.contact}
                </span>

                <button
                  onClick={() => handleProposeSwap(peer)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>{t("swap.propose_swap")}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}