import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LocalStore,
  isValidKenyanPhone,
  normalizeKenyanPhone,
  formatKenyanPhoneDisplay,
} from "../lib/store";

interface LoginPageProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  setServerError?: (msg: string | null) => void;
}

export default function LoginPage({
  onSuccess,
  onSwitchToSignup,
  setServerError,
}: LoginPageProps) {
  const { t } = useTranslation();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Field-level touched & error state
  const [touched, setTouched] = useState({ phone: false, password: false });
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});

  // Countdown timer for lockout
  const [lockoutSec, setLockoutSec] = useState<number>(0);

  useEffect(() => {
    // Check initial lockout
    const sec = LocalStore.getLockoutRemainingSeconds();
    setLockoutSec(sec);
    if (sec > 0 && setServerError) {
      setServerError(
        t(
          "auth.errors.too_many_attempts",
          "Too many incorrect attempts. Please wait 1 minute before trying again."
        )
      );
    }
  }, [setServerError, t]);

  useEffect(() => {
    if (lockoutSec <= 0) return;
    const interval = setInterval(() => {
      setLockoutSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (setServerError) setServerError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSec, setServerError]);

  // Client-side field validation
  const validateField = (field: "phone" | "password", val: string) => {
    const newErrors = { ...errors };

    if (field === "phone") {
      const clean = val.trim();
      if (!clean) {
        newErrors.phone = t("auth.errors.required", "This field is required.");
      } else if (!isValidKenyanPhone(clean)) {
        newErrors.phone = t(
          "auth.errors.invalid_phone",
          "Please enter a valid Kenyan phone number (e.g., 0712345678 or +254...)"
        );
      } else {
        delete newErrors.phone;
      }
    }

    if (field === "password") {
      if (!val) {
        newErrors.password = t("auth.errors.required", "This field is required.");
      } else if (val.length < 6) {
        newErrors.password = t(
          "auth.errors.weak_password",
          "Password must be at least 6 characters."
        );
      } else {
        delete newErrors.password;
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleBlur = (field: "phone" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, field === "phone" ? phone : password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ phone: true, password: true });
    const errsPhone = validateField("phone", phone);
    const errsPass = validateField("password", password);
    const hasClientErrors = !!errsPhone.phone || !!errsPass.password;

    if (hasClientErrors) {
      return;
    }

    if (lockoutSec > 0) {
      if (setServerError) {
        setServerError(
          t(
            "auth.errors.too_many_attempts",
            "Too many incorrect attempts. Please wait 1 minute before trying again."
          )
        );
      }
      return;
    }

    if (setServerError) setServerError(null);
    setIsLoading(true);

    // Simulate authenticating against the offline store or backend API
    setTimeout(() => {
      setIsLoading(false);
      const res = LocalStore.login(phone, password, rememberMe);

      if (!res.success) {
        if (res.remainingSeconds && res.remainingSeconds > 0) {
          setLockoutSec(res.remainingSeconds);
        }
        if (setServerError) {
          setServerError(res.error || t("auth.errors.invalid_credentials"));
        }
      } else {
        if (setServerError) setServerError(null);
        if (onSuccess) {
          onSuccess();
        }
      }
    }, 600);
  };

  // Quick Demo Helpers for testing
  const fillDemoUser = (userType: "valid" | "wrong_pw" | "lockout") => {
    if (userType === "valid") {
      setPhone("0712345678");
      setPassword("stacy2026");
      setTouched({ phone: true, password: true });
      setErrors({});
      if (setServerError) setServerError(null);
    } else if (userType === "wrong_pw") {
      setPhone("0712345678");
      setPassword("wrongpassword");
      setTouched({ phone: true, password: true });
      setErrors({});
    } else if (userType === "lockout") {
      // Trigger lockout state
      LocalStore.setLockoutState({ attempts: 3, lockedUntil: Date.now() + 60 * 1000 });
      setLockoutSec(60);
      if (setServerError) {
        setServerError(
          t(
            "auth.errors.too_many_attempts",
            "Too many incorrect attempts. Please wait 1 minute before trying again."
          )
        );
      }
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("auth.login_heading", "Welcome back, Agent")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {t(
            "auth.login_subheading",
            "Sign in to check today's restock advice and protect your drawer."
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Phone Number Field */}
        <div>
          <label
            htmlFor="login-phone"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {t("auth.phone_label", "Phone Number")}
          </label>
          <div className="relative rounded-xl shadow-2xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 text-sm">
              <span className="text-base mr-1">🇰🇪</span>
              <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 pr-2">
                +254
              </span>
            </div>
            <input
              id="login-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (touched.phone) validateField("phone", e.target.value);
              }}
              onBlur={() => handleBlur("phone")}
              placeholder={t("auth.phone_placeholder", "e.g., 0712 345 678 or +254...")}
              disabled={isLoading || lockoutSec > 0}
              className={`w-full pl-24 pr-4 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all font-mono ${
                touched.phone && errors.phone
                  ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
              }`}
            />
          </div>
          {touched.phone && errors.phone && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
              <span>⚠️</span>
              <span>{errors.phone}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("auth.password_label", "Password")}
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              {t("auth.forgot_password", "Forgot password?")}
            </button>
          </div>
          <div className="relative rounded-xl shadow-2xs">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) validateField("password", e.target.value);
              }}
              onBlur={() => handleBlur("password")}
              placeholder={t("auth.password_placeholder", "At least 6 characters")}
              disabled={isLoading || lockoutSec > 0}
              className={`w-full pl-3.5 pr-11 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                touched.password && errors.password
                  ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="text-sm select-none">{showPassword ? "🙈" : "👁️"}</span>
            </button>
          </div>
          {touched.password && errors.password && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
              <span>⚠️</span>
              <span>{errors.password}</span>
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <div className="text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 block">
                {t("auth.remember_me", "Remember me on this device")}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t(
                  "auth.remember_helper",
                  "Keeps your shop signed in even without an internet connection"
                )}
              </span>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || lockoutSec > 0}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{t("auth.logging_in", "Logging in...")}</span>
              </>
            ) : lockoutSec > 0 ? (
              <span>Locked ({lockoutSec}s)</span>
            ) : (
              <span>{t("auth.login_btn", "Log In / Ingia")}</span>
            )}
          </button>
        </div>
      </form>

      {/* Switch to Signup Prompt */}
      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          New to FloatWise?{" "}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Create an agent account
          </button>
        </p>
      </div>

      {/* Quick Interactive Testing & Demo Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
          Quick Demo Credentials & Error Simulation:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => fillDemoUser("valid")}
            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium text-[11px] transition-colors"
          >
            ✓ Fill Demo (Mama Stacy)
          </button>
          <button
            type="button"
            onClick={() => fillDemoUser("wrong_pw")}
            className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-medium text-[11px] transition-colors"
          >
            ⚡ Test Wrong Password
          </button>
          <button
            type="button"
            onClick={() => fillDemoUser("lockout")}
            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium text-[11px] transition-colors"
          >
            ⏱️ Test 1-Min Lockout
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Password Assistance
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              For security, FloatWise stores your shop credentials locally on this device. If
              you have forgotten your password, you can re-register your phone number with your
              M-Pesa agent SIM or reach out to your local Nairobi market agent lead.
            </p>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              Demo tip: The pre-configured demo password for <strong>0712345678</strong> is{" "}
              <code className="font-mono font-bold bg-white/70 dark:bg-black/30 px-1 py-0.5 rounded">
                stacy2026
              </code>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
