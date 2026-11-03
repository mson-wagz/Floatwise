import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getToken, saveToken } from "../auth";
import { isKenyanPhone, login, signup, type Lang } from "../lib/authApi";
import AuthLayout, { PasswordField, inputClass, labelClass } from "../components/AuthFormLayout";

export default function SignupPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang: Lang = i18n.language?.startsWith("en") ? "en" : "sw";
  const t = (en: string, sw: string) => (lang === "sw" ? sw : en);

  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [till, setTill] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (getToken()) return <Navigate to="/chat" replace />;

  const validate = (): string | null => {
    if (shopName.trim().length < 2)
      return t("Enter your shop or agent name.", "Weka jina la duka au wakala wako.");
    if (!isKenyanPhone(phone))
      return t("Enter a valid Kenyan phone number.", "Weka nambari sahihi ya simu ya Kenya.");
    if (till.trim() && !/^\d{6,7}$/.test(till.trim()))
      return t("Till or agent number must be 6 or 7 digits.", "Nambari ya till au wakala iwe na tarakimu 6 au 7.");
    if (password.length < 6)
      return t("Password must be at least 6 characters.", "Nenosiri liwe na angalau herufi 6.");
    if (password !== confirm)
      return t("The two passwords do not match.", "Manenosiri mawili hayalingani.");
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      await signup({
        shop_name: shopName.trim(),
        phone,
        till_number: till,
        password,
        language: lang,
      });

      // Log the new user in straight away. If that fails, send them to the login page.
      try {
        const data = await login(phone, password);
        saveToken(data.access_token, true);
        navigate("/chat", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const langButton = (value: Lang, label: string) => (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(value)}
      aria-pressed={lang === value}
      className={`flex-1 px-4 py-2 text-sm rounded-xl border font-semibold transition-colors ${
        lang === value
          ? "bg-emerald-600 border-emerald-600 text-white"
          : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AuthLayout
      title={t("Create your account", "Fungua akaunti yako")}
      subtitle={t(
        "Set up your shop in a few minutes.",
        "Sanidi duka lako kwa dakika chache."
      )}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="shop" className={labelClass}>
            {t("Shop / agent name", "Jina la duka / wakala")}
          </label>
          <input
            id="shop"
            type="text"
            autoComplete="organization"
            placeholder="Mama Wanjiku Shop"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            {t("Phone number", "Nambari ya simu")}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678 / +254 712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="till" className={labelClass}>
            {t("M-Pesa till / agent number (optional)", "Nambari ya till / wakala ya M-Pesa (si lazima)")}
          </label>
          <input
            id="till"
            type="text"
            inputMode="numeric"
            maxLength={7}
            value={till}
            onChange={(e) => setTill(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} font-mono`}
          />
        </div>

        <PasswordField
          id="password"
          label={t("Password", "Nenosiri")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showText={t("Show", "Onyesha")}
          hideText={t("Hide", "Ficha")}
          hint={t("At least 6 characters.", "Angalau herufi 6.")}
        />

        <PasswordField
          id="confirm"
          label={t("Confirm password", "Thibitisha nenosiri")}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          showText={t("Show", "Onyesha")}
          hideText={t("Hide", "Ficha")}
        />

        <div>
          <span className={labelClass}>{t("Preferred language", "Lugha unayopendelea")}</span>
          <div className="flex gap-2">
            {langButton("en", "English")}
            {langButton("sw", "Kiswahili")}
          </div>
        </div>

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
          {loading ? t("Creating account…", "Inafungua akaunti…") : "Create Account / Sajili"}
        </button>
      </form>

      <p className="text-sm text-center text-slate-600 dark:text-slate-400 mt-5">
        {t("Already have an account?", "Tayari una akaunti?")}{" "}
        <Link to="/login" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
          {t("Log in", "Ingia")}
        </Link>
      </p>
    </AuthLayout>
  );
}