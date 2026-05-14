import React, { createContext, useState, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from '../i18n/es';
import en from '../i18n/en';

const translations = { es, en };

export const LanguageContext = createContext();

/**
 * Provee el idioma actual de la app y la función `t()` para traducir claves.
 * Persiste la elección del usuario en AsyncStorage.
 */
export function LanguageProvider({ children }) {
    const [lang, setLang] = useState('es');

    /**
     * Cambia el idioma activo y lo guarda en AsyncStorage.
     *
     * @param {'es'|'en'} newLang Código del nuevo idioma.
     */
    const switchLanguage = useCallback(async (newLang) => {
        setLang(newLang);
        await AsyncStorage.setItem('@pawmate_lang', newLang);
    }, []);

    React.useEffect(() => {
        AsyncStorage.getItem('@pawmate_lang').then(saved => {
            if (saved && translations[saved]) setLang(saved);
        });
    }, []);

    /**
     * Función de traducción. Acepta claves anidadas con notación de puntos
     * ("home.title") y placeholders "{name}" sustituibles por `params`.
     *
     * @param {string} key    Clave de traducción.
     * @param {object} [params] Diccionario de sustituciones.
     * @returns {string} Texto traducido o la propia clave si no hay match.
     */
    const t = useCallback((key, params) => {
        const keys = key.split('.');
        let val = translations[lang];
        for (const k of keys) {
            val = val?.[k];
        }
        if (val === undefined) {
            // Si falta la traducción cae al español como idioma por defecto.
            val = translations.es;
            for (const k of keys) {
                val = val?.[k];
            }
        }
        if (typeof val === 'string' && params) {
            return val.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? '');
        }
        return val ?? key;
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, switchLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useTranslation = () => useContext(LanguageContext);
