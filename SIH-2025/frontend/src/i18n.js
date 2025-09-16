import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslation from './locales/en/translation.json';
import hiTranslation from './locales/hi/translation.json';
import frTranslation from './locales/fr/translation.json';
import esTranslation from './locales/es/translation.json';
import deTranslation from './locales/de/translation.json';
import zhTranslation from './locales/zh/translation.json';
import jaTranslation from './locales/ja/translation.json';
import arTranslation from './locales/ar/translation.json';
import bnTranslation from './locales/bn/translation.json';
import taTranslation from './locales/ta/translation.json';

// Translation resources object
const resources = {
  en: { translation: enTranslation },
  hi: { translation: hiTranslation },
  fr: { translation: frTranslation },
  es: { translation: esTranslation },
  de: { translation: deTranslation },
  zh: { translation: zhTranslation },
  ja: { translation: jaTranslation },
  ar: { translation: arTranslation },
  bn: { translation: bnTranslation },
  ta: { translation: taTranslation }
};

// Configure i18next
i18n
  .use(LanguageDetector) // Detect user language from browser
  .use(initReactI18next) // Pass i18n down to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Fallback language if detection fails
    debug: false, // Set to true for debugging
    
    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'], // Cache language preference in localStorage
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // React i18next options
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    }
  });

export default i18n;
