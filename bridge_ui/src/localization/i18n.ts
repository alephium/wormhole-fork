import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import de from "../../locales/de-DE/translation.json";
import el from "../../locales/el-GR/translation.json";
import en from "../../locales/en-US/translation.json";
import id from "../../locales/id-ID/translation.json";
import vi from "../../locales/vi-VN/translation.json";
import pt from "../../locales/pt-PT/translation.json";
import { supportedLanguages } from "./languages";

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
      el: { translation: el },
      de: { translation: de },
      vi: { translation: vi },
      pt: { translation: pt },
    },
    supportedLngs: supportedLanguages,
    fallbackLng: "en",
    detection: {
      lookupLocalStorage: "language",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
