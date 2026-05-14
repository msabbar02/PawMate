/**
 * Configuración de internacionalización (i18next) para la web pública.
 *
 * Persiste el idioma seleccionado en `localStorage` con la clave
 * `@pawmate_web_lang` y usa español como fallback. Los recursos se cargan
 * de forma síncrona desde `es.json` e `en.json`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';

const savedLang = localStorage.getItem('@pawmate_web_lang') || 'es';

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: savedLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('@pawmate_web_lang', lng);
});

export default i18n;
