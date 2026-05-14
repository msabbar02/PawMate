/**
 * Contexto de tema (claro/oscuro) del panel.
 *
 * Persiste la elección en `localStorage` bajo la clave `admin-theme` y
 * propaga el atributo `data-theme` al elemento raíz para que el CSS
 * basado en variables responda.
 */
import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => localStorage.getItem('admin-theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('admin-theme', theme);
    }, [theme]);

    /** Alterna entre tema oscuro y claro. */
    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
