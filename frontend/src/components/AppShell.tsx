import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import { LocalStore } from "../lib/store";
import { ksh } from "../lib/format";

export default function AppShell() {
  const { t } = useTranslation();
  const [shop, setShop] = useState(LocalStore.getShop());
  const [currentUser, setCurrentUser] = useState(LocalStore.getCurrentUser());
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [editCash, setEditCash] = useState(shop.cash_ksh);
  const [editFloat, setEditFloat] = useState(shop.float_ksh);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const handleLogout = () => {
    LocalStore.logout();
    setCurrentUser(null);
    setShop(LocalStore.getShop());
  };

  const saveBalances = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = LocalStore.updateBalances(editCash, editFloat);
    setShop(updated);
    setShowBalanceModal(false);
  };

  const navItems = [
    { to: "/", label: t("nav.advisor"), icon: "💬" },
    { to: "/add", label: t("nav.add_data"), icon: "📥" },
    { to: "/forecast", label: t("nav.forecast"), icon: "📈" },
    { to: "/whatif", label: t("nav.what_if"), icon: "🔮" },
    { to: "/replay", label: t("nav.replay"), icon: "📊" },
    { to: "/matches", label: t("nav.float_swap"), icon: "🔄" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Kiosk Profile */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
                FW
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  FloatWise
                </span>
                <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Nairobi M-Pesa
                </span>
              </div>
            </Link>

            <span className="text-slate-300 dark:text-slate-700 hidden md:inline">|</span>

            <div className="hidden md:flex flex-col text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{shop.name}</span>
              <span className="text-[11px]">{shop.location}</span>
            </div>
          </div>

          {/* Quick Drawer Balances & Interactive Status */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Live Till Balance Chips */}
            <button
              onClick={() => {
                setEditCash(shop.cash_ksh);
                setEditFloat(shop.float_ksh);
                setShowBalanceModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-emerald-500 transition-colors shadow-2xs text-left"
              title="Click to update physical cash or phone float"
            >
              <div className="text-xs">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cash in Drawer</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {ksh(shop.cash_ksh)}
                </span>
              </div>
              <span className="text-slate-300 dark:text-slate-600 font-light">/</span>
              <div className="text-xs">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Phone Float</span>
                <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                  {ksh(shop.float_ksh)}
                </span>
              </div>
              <span className="text-xs text-slate-400 ml-1">✏️</span>
            </button>

            {/* Privacy Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              title={t("privacy.tooltip")}
            >
              <span>🔒</span>
              <span>PII Shield</span>
            </div>

            {/* Offline-Ready Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                isOffline
                  ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber-500" : "bg-emerald-500"}`}></span>
              <span className="hidden sm:inline">{isOffline ? "Offline Ready" : "Local Solver Active"}</span>
            </div>

            {/* Language Switcher */}
            <LanguageToggle />

            {/* User Account / Auth Link */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-700">
                <div className="hidden xl:flex flex-col text-right text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                    {currentUser.shopName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    0{currentUser.phone.slice(3)}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 text-xs text-slate-600 dark:text-slate-400 font-medium transition-colors"
                  title="Sign out of current shop"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>👤</span>
                <span>Log In</span>
              </Link>
            )}
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:flex border-t border-slate-100 dark:border-slate-800 px-6 max-w-7xl mx-auto overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 py-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center p-1 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Balance Adjustment Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Update Drawer & Float Balances
              </h3>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Count the cash in your till and check your M-Pesa agent SIM balance on your phone.
            </p>

            <form onSubmit={saveBalances} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Cash in Drawer (KSh)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={editCash}
                  onChange={(e) => setEditCash(Number(e.target.value))}
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
                <div className="flex gap-2 mt-1.5">
                  {[+5000, +10000, -5000].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setEditCash((c) => Math.max(0, c + delta))}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      {delta > 0 ? `+${delta / 1000}k` : `${delta / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  M-Pesa Digital Float on Phone (KSh)
                </label>
                <input
                  type="number"
                  step="1000"
                  value={editFloat}
                  onChange={(e) => setEditFloat(Number(e.target.value))}
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800"
                />
                <div className="flex gap-2 mt-1.5">
                  {[+5000, +10000, -5000].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setEditFloat((f) => Math.max(0, f + delta))}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      {delta > 0 ? `+${delta / 1000}k` : `${delta / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                >
                  Save & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
