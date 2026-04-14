import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsAuthenticated(!!session && session.user?.email === 'adminpawmate@gmail.com');
            setLoading(false);
        }).catch((err) => {
            console.error('Error checking session:', err);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session && session.user?.email === 'adminpawmate@gmail.com');
            setLoading(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            if (email !== 'adminpawmate@gmail.com') {
                throw new Error("Acceso denegado: este email no pertenece a un administrador.");
            }
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Error de autenticación:", error);
            return false;
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    if (loading) return null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
