import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../theme/colors';

export const ThemeContext = createContext({
    theme: lightTheme,
    toggleTheme: () => { },
    isDarkMode: false,
});

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Optionally default to system scheme. For now, we wait for user preference,
        // or we can set it to system default initially.
        if (systemColorScheme === 'dark') {
            setIsDarkMode(true);
        }
    }, [systemColorScheme]);

    const toggleTheme = () => {
        setIsDarkMode((prevMode) => !prevMode);
    };

    const theme = isDarkMode ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};
