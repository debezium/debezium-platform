import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18next
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'it'],
    ns: ['common', 'pipeline', 'source', 'destination', 'transform', 'statusMessage', 'vault'],
    defaultNS: 'common',
    load: 'all', // Ensures all namespaces are loaded
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'navigator', 'path', 'subdomain'],
      caches: ['localStorage', 'cookie'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
