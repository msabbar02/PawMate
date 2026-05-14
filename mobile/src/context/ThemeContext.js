import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme/colors';

const THEME_KEY = '@pawmate_dark_mode';
const LEFTY_KEY = '@pawmate_lefty';

export const ThemeContext = createContext({
    theme: lightTheme,
    toggleTheme: () => { },
    isDarkMode: false,
    isLeftHanded: false,
    toggleHandedness: () => { },
});

/**
 * Provee el tema activo (claro / oscuro) y la preferencia de mano (zurdo /
 * diestro). Ambas opciones se persisten en AsyncStorage y se inicializan
 * respetando el esquema del sistema operativo si no hay valor guardado.
 */
export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLeftHanded, setIsLeftHanded] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Recupera las preferencias guardadas al montar el provider.
    useEffect(() => {
        (async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_KEY);
                if (savedTheme !== null) {
                    setIsDarkMode(savedTheme === 'true');
                } else if (systemColorScheme === 'dark') {
                    setIsDarkMode(true);
                }
                const savedLefty = await AsyncStorage.getItem(LEFTY_KEY);
                if (savedLefty !== null) {
                    setIsLeftHanded(savedLefty === 'true');
                }
            } catch { /* sin acción */ }
            setLoaded(true);
        })();
    }, []);

    /**
     * Conmuta entre tema claro y oscuro y persiste la elección.
     */
    const toggleTheme = async () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        try {
            await AsyncStorage.setItem(THEME_KEY, String(newValue));
        } catch { /* sin acción */ }
    };

    /**
     * Conmuta el modo zurdo/diestro y persiste la elección.
     */
    const toggleHandedness = async () => {
        const newValue = !isLeftHanded;
        setIsLeftHanded(newValue);
        try {
            await AsyncStorage.setItem(LEFTY_KEY, String(newValue));
        } catch { /* sin acción */ }
    };

    const theme = isDarkMode ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode, isLeftHanded, toggleHandedness }}>
            {children}
        </ThemeContext.Provider>
    );
};
