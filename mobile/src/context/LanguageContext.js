import React, { createContext, useState, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from '../i18n/es';
import en from '../i18n/en';

const translations = { es, en };

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState('es');

    const switchLanguage = useCallback(async (newLang) => {
        setLang(newLang);
        await AsyncStorage.setItem('pawmate_lang', newLang);
    }, []);

    React.useEffect(() => {
        AsyncStorage.getItem('pawmate_lang').then(saved => {
            if (saved && translations[saved]) setLang(saved);
        });
    }, []);

    const t = useCallback((key, params) => {
        const keys = key.split('.');
        let val = translations[lang];
        for (const k of keys) {
            val = val?.[k];
        }
        if (val === undefined) {
            // Fallback to Spanish
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
