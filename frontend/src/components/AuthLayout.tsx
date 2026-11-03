import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import { LocalStore } from "../lib/store";

interface AuthLayoutProps {
  initialMode?: "login" | "signup";
  onSuccess?: () => void;
}

export default function AuthLayout({
  initialMode,
  onSuccess,
}: AuthLayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from prop, route pathname, or default to "login"
  const getRouteMode = (): "login" | "signup" => {
    if (initialMode) return initialMode;
    if (location.pathname.includes("signup")) return "signup";
    return "login";
  };

  const [activeTab, setActiveTab] = useState<"login" | "signup">(getRouteMode());
  const [serverError, setServerError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online / offline network state
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update tab if route changes
  useEffect(() => {
    if (location.pathname.includes("signup")) {
      setActiveTab("signup");
    } else if (location.pathname.includes("login")) {
      setActiveTab("login");
    }
    setServerError(null);
  }, [location.pathname]);

  const handleTabSwitch = (mode: "login" | "signup") => {
    setActiveTab(mode);
    setServerError(null);
  };

  const handleAuthSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      navigate("/");
    }
  };

  const isExistingAccountError =
    serverError?.includes("already exists") ||
    serverError?.includes("tayari ipo");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      
      {/* Top Bar with Language Switcher & Home Link */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <Link
          to="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <span>←</span>
          <span>Back to App</span>
        </Link>
        <LanguageToggle />
      </div>

      {/* Main Auth Container */}
      <div className="max-w-md w-full mx-auto my-auto">
        
        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20 group hover:scale-105 transition-transform">
            <span className="font-black text-2xl tracking-tight">FW</span>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              FloatWise
            </h1>
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              {t("auth.tagline", "FloatWise — Never run out of float or cash.")}
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-5 sm:p-7 space-y-5">
          
          {/* Offline Mode Warning Banner */}
          {isOffline && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-2xs">
              <span className="text-base select-none mt-0.5">📡</span>
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] block opacity-80">
                  Offline Mode Active
                </span>
                <p className="mt-0.5 leading-relaxed">
                  {t(
                    "auth.errors.offline_warning",
                    "You are currently offline. FloatWise will log you in using stored offline credentials if available, or try again when connected."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Top Server / Authentication Error Alert Banner */}
          {serverError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-xs flex items-start justify-between gap-3 shadow-2xs animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <span className="text-base select-none mt-0.5">🛑</span>
                <div className="space-y-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] block opacity-80">
                    Authentication Alert
                  </span>
                  <p className="leading-relaxed font-medium">{serverError}</p>

                  {/* If error is existing account, provide a 1-click shortcut to switch to login */}
                  {isExistingAccountError && (
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("login")}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-rose-800 dark:text-rose-300 underline underline-offset-2"
                    >
                      Click here to switch to Log In →
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setServerError(null)}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 p-1 font-bold text-sm"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Segmented Switcher (Log In vs Create Account) */}
          <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleTabSwitch("login")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === "login"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t("auth.login_tab", "Log In")}
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("signup")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center ${
                activeTab === "signup"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t("auth.signup_tab", "Create Account")}
            </button>
          </div>

          {/* Form Content */}
          <div className="pt-1">
            {activeTab === "login" ? (
              <LoginPage
                onSuccess={handleAuthSuccess}
                onSwitchToSignup={() => handleTabSwitch("signup")}
                setServerError={setServerError}
              />
            ) : (
              <SignupPage
                onSuccess={handleAuthSuccess}
                onSwitchToLogin={() => handleTabSwitch("login")}
                setServerError={setServerError}
              />
            )}
          </div>
        </div>

        {/* Trust & Privacy Reassurance Footer */}
        <div className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <span>🔒</span>
            <span>256-bit Offline Encryption • Zero PII Shared</span>
          </p>
          <p className="text-[11px]">
            Designed for Kenyan M-Pesa & Mobile Money Agents
          </p>
        </div>
      </div>

      {/* Bottom spacer for clean centering */}
      <div className="py-2"></div>
    </div>
  );
}
