import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getToken, saveToken } from "../auth";
import { isKenyanPhone, login, type Lang } from "../lib/authApi";
import AuthLayout, { PasswordField, inputClass, labelClass } from "../components/AuthFormLayout";

export default function LoginPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang: Lang = i18n.language?.startsWith("en") ? "en" : "sw";
  const t = (en: string, sw: string) => (lang === "sw" ? sw : en);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Already logged in: go straight to the app.
  if (getToken()) return <Navigate to="/chat" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isKenyanPhone(phone)) {
      setError(t("Enter a valid Kenyan phone number.", "Weka nambari sahihi ya simu ya Kenya."));
      return;
    }
    if (!password) {
      setError(t("Enter your password.", "Weka nenosiri lako."));
      return;
    }

    setLoading(true);
    try {
      const data = await login(phone, password);
      saveToken(data.access_token, remember);
      if (data.language) i18n.changeLanguage(data.language);
      navigate("/chat", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("Welcome back", "Karibu tena")}
      subtitle={t(
        "Log in to see your float and cash plan.",
        "Ingia ili uone mpango wako wa float na pesa taslimu."
      )}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="phone" className={labelClass}>
            {t("Phone number", "Nambari ya simu")}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>

        <PasswordField
          id="password"
          label={t("Password", "Nenosiri")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          showText={t("Show", "Onyesha")}
          hideText={t("Hide", "Ficha")}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            {t("Remember me on this device", "Nikumbuke kwenye kifaa hiki")}
          </label>
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {t("Forgot password?", "Umesahau nenosiri?")}
          </button>
        </div>

        {showForgot && (
          <p className="text-xs rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 p-3">
            {t(
              "Password reset by SMS is coming soon. For now, contact support to reset your password.",
              "Kubadilisha nenosiri kwa SMS kunakuja hivi karibuni. Kwa sasa, wasiliana na msaada."
            )}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 p-3"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-5 py-3 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold shadow-sm"
        >
          {loading ? t("Logging in…", "Inaingia…") : "Log In / Ingia"}
        </button>
      </form>

      <p className="text-sm text-center text-slate-600 dark:text-slate-400 mt-5">
        {t("New to FloatWise?", "Mgeni kwenye FloatWise?")}{" "}
        <Link to="/signup" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
          {t("Create account", "Sajili")}
        </Link>
      </p>
    </AuthLayout>
  );
}