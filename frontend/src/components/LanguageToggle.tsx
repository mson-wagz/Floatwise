import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "sw";

  const toggleLanguage = () => {
    const next = currentLang.startsWith("sw") ? "en" : "sw";
    i18n.changeLanguage(next);
    localStorage.setItem("floatwise_lang", next);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50"
      title="Badilisha Lugha / Change Language"
    >
      <span className="text-sm">🇰🇪</span>
      <span>{currentLang.startsWith("sw") ? "Kiswahili" : "English"}</span>
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
        ({currentLang.startsWith("sw") ? "EN" : "SW"})
      </span>
    </button>
  );
}
