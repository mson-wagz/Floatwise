import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import sw from "./sw.json";

const savedLang = typeof window !== "undefined" ? localStorage.getItem("floatwise_lang") || "sw" : "sw";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sw: { translation: sw },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
