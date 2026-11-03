import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocalStore, isValidKenyanPhone, normalizeKenyanPhone } from "../lib/store";

interface SignupPageProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  setServerError?: (msg: string | null) => void;
}

export default function SignupPage({
  onSuccess,
  onSwitchToLogin,
  setServerError,
}: SignupPageProps) {
  const { t, i18n } = useTranslation();

  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [tillNumber, setTillNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "sw">(
    (i18n.language?.startsWith("sw") ? "sw" : "en") as "en" | "sw"
  );
  const [isLoading, setIsLoading] = useState(false);

  // Field validation and touched states
  const [touched, setTouched] = useState({
    shopName: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });

  const [errors, setErrors] = useState<{
    shopName?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateField = (
    field: "shopName" | "phone" | "password" | "confirmPassword",
    val: string,
    currentPass?: string
  ) => {
    const newErrors = { ...errors };

    if (field === "shopName") {
      if (!val.trim()) {
        newErrors.shopName = t("auth.errors.required", "This field is required.");
      } else {
        delete newErrors.shopName;
      }
    }

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

      // Check confirm password if already touched
      if (touched.confirmPassword && confirmPassword) {
        if (confirmPassword !== val) {
          newErrors.confirmPassword = t(
            "auth.errors.password_mismatch",
            "Passwords do not match."
          );
        } else {
          delete newErrors.confirmPassword;
        }
      }
    }

    if (field === "confirmPassword") {
      const basePass = currentPass !== undefined ? currentPass : password;
      if (!val) {
        newErrors.confirmPassword = t("auth.errors.required", "This field is required.");
      } else if (val !== basePass) {
        newErrors.confirmPassword = t(
          "auth.errors.password_mismatch",
          "Passwords do not match."
        );
      } else {
        delete newErrors.confirmPassword;
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleBlur = (field: "shopName" | "phone" | "password" | "confirmPassword") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let val = "";
    if (field === "shopName") val = shopName;
    else if (field === "phone") val = phone;
    else if (field === "password") val = password;
    else if (field === "confirmPassword") val = confirmPassword;
    validateField(field, val);
  };

  const handleLanguageChange = (lang: "en" | "sw") => {
    setPreferredLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("floatwise_lang", lang);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      shopName: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    const eName = validateField("shopName", shopName);
    const ePhone = validateField("phone", phone);
    const ePass = validateField("password", password);
    const eConf = validateField("confirmPassword", confirmPassword, password);

    const hasErrors = !!eName.shopName || !!ePhone.phone || !!ePass.password || !!eConf.confirmPassword;
    if (hasErrors) {
      return;
    }

    if (setServerError) setServerError(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const res = LocalStore.register({
        shopName,
        phone,
        tillNumber: tillNumber.trim() || undefined,
        password,
        preferredLanguage,
      });

      if (!res.success) {
        if (setServerError) {
          setServerError(res.error || t("auth.errors.existing_account"));
        }
      } else {
        if (setServerError) setServerError(null);
        if (onSuccess) {
          onSuccess();
        }
      }
    }, 700);
  };

  const fillSampleNewAgent = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setShopName("Mama Wanjiku General Merchant");
    setPhone(`072233${randomSuffix}`);
    setTillNumber("654321");
    setPassword("wanjiku26");
    setConfirmPassword("wanjiku26");
    setTouched({ shopName: true, phone: true, password: true, confirmPassword: true });
    setErrors({});
    if (setServerError) setServerError(null);
  };

  const triggerExistingAccountTest = () => {
    // 0712345678 is Mama Stacy which already exists
    setShopName("Mama Stacy Clone");
    setPhone("0712345678");
    setTillNumber("892144");
    setPassword("secret123");
    setConfirmPassword("secret123");
    setTouched({ shopName: true, phone: true, password: true, confirmPassword: true });
    setErrors({});
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("auth.signup_heading", "Create Shopkeeper Account")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {t(
            "auth.signup_subheading",
            "Join thousands of Nairobi M-Pesa agents keeping their till and float balanced."
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {/* Shop / Agent Name */}
        <div>
          <label
            htmlFor="signup-shopname"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            {t("auth.shop_name_label", "Shop / Agent Name")}
          </label>
          <input
            id="signup-shopname"
            type="text"
            value={shopName}
            onChange={(e) => {
              setShopName(e.target.value);
              if (touched.shopName) validateField("shopName", e.target.value);
            }}
            onBlur={() => handleBlur("shopName")}
            placeholder={t("auth.shop_name_placeholder", "e.g., Mama Wanjiku Shop")}
            disabled={isLoading}
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
              touched.shopName && errors.shopName
                ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
            }`}
          />
          {touched.shopName && errors.shopName && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
              <span>⚠️</span>
              <span>{errors.shopName}</span>
            </p>
          )}
        </div>

        {/* Kenyan Phone Number */}
        <div>
          <label
            htmlFor="signup-phone"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
              id="signup-phone"
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
              disabled={isLoading}
              className={`w-full pl-24 pr-4 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all font-mono ${
                touched.phone && errors.phone
                  ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
              }`}
            />
          </div>
          {touched.phone && errors.phone && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
              <span>⚠️</span>
              <span>{errors.phone}</span>
            </p>
          )}
        </div>

        {/* Optional M-Pesa Till / Agent Number */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="signup-till"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("auth.till_label", "M-Pesa Till / Agent Number (Optional)")}
            </label>
            <span className="text-[10px] text-slate-400">Optional</span>
          </div>
          <input
            id="signup-till"
            type="text"
            inputMode="numeric"
            value={tillNumber}
            onChange={(e) => setTillNumber(e.target.value)}
            placeholder={t("auth.till_placeholder", "e.g., 892144 or 7-digit Till")}
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 font-mono"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            {t(
              "auth.till_helper",
              "Optional: Helps match your Safaricom agent float SIM messages"
            )}
          </p>
        </div>

        {/* Password Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Password */}
          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t("auth.password_label", "Password")}
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) validateField("password", e.target.value);
                }}
                onBlur={() => handleBlur("password")}
                placeholder={t("auth.password_placeholder", "At least 6 characters")}
                disabled={isLoading}
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  touched.password && errors.password
                    ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span className="text-xs select-none">{showPassword ? "🙈" : "👁️"}</span>
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
                <span>⚠️</span>
                <span>{errors.password}</span>
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="signup-confirmpassword"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {t("auth.confirm_password_label", "Confirm Password")}
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <input
                id="signup-confirmpassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (touched.confirmPassword)
                    validateField("confirmPassword", e.target.value, password);
                }}
                onBlur={() => handleBlur("confirmPassword")}
                placeholder={t(
                  "auth.confirm_password_placeholder",
                  "Re-enter your password"
                )}
                disabled={isLoading}
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  touched.confirmPassword && errors.confirmPassword
                    ? "border-rose-400 focus:ring-rose-400/40 bg-rose-50/20"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <span className="text-xs select-none">
                  {showConfirmPassword ? "🙈" : "👁️"}
                </span>
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 animate-fadeIn">
                <span>⚠️</span>
                <span>{errors.confirmPassword}</span>
              </p>
            )}
          </div>
        </div>

        {/* Preferred Language Selector */}
        <div className="pt-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t("auth.preferred_lang_label", "Preferred Language / Lugha")}
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                preferredLanguage === "en"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span>🇬🇧</span>
              <span>English</span>
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("sw")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                preferredLanguage === "sw"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span>🇰🇪</span>
              <span>Kiswahili</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{t("auth.creating_account", "Creating account...")}</span>
              </>
            ) : (
              <span>{t("auth.signup_btn", "Create Account / Sajili")}</span>
            )}
          </button>
        </div>
      </form>

      {/* Switch to Login Prompt */}
      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Already registered?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Log in to existing shop
          </button>
        </p>
      </div>

      {/* Quick Demo Pre-fill for Testing */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
          Quick Demo Presets:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={fillSampleNewAgent}
            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium text-[11px] transition-colors"
          >
            ✓ Fill New Agent (Mama Wanjiku)
          </button>
          <button
            type="button"
            onClick={triggerExistingAccountTest}
            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium text-[11px] transition-colors"
          >
            ⚡ Test Existing Account Error (0712345678)
          </button>
        </div>
      </div>
    </div>
  );
}
