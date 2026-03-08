import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../theme/colors';

const THEME_KEY = '@pawmate_dark_mode';

export const ThemeContext = createContext({
    theme: lightTheme,
    toggleTheme: () => { },
    isDarkMode: false,
});

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load saved preference on mount
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(THEME_KEY);
                if (saved !== null) {
                    setIsDarkMode(saved === 'true');
                } else if (systemColorScheme === 'dark') {
                    setIsDarkMode(true);
                }
            } catch { /* ignore */ }
            setLoaded(true);
        })();
    }, []);

    const toggleTheme = async () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        try {
            await AsyncStorage.setItem(THEME_KEY, String(newValue));
        } catch { /* ignore */ }
    };

    const theme = isDarkMode ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};
