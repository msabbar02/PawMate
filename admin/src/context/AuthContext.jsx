import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAdminProfile = async (authUser) => {
        if (!authUser) { setAdminUser(null); return null; }
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();
            if (!error && data && data.role === 'admin') {
                setAdminUser(data);
                return data;
            }
            return null;
        } catch { return null; }
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const profile = await fetchAdminProfile(session.user);
                setIsAuthenticated(!!profile);
            }
            setLoading(false);
        }).catch(() => setLoading(false));

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                const profile = await fetchAdminProfile(session.user);
                setIsAuthenticated(!!profile);
            } else {
                setIsAuthenticated(false);
                setAdminUser(null);
            }
            setLoading(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            const trimmedEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email: trimmedEmail, 
                password 
            });
            if (error) return { success: false, message: error.message };

            // Check admin role in users table
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile || profile.role !== 'admin') {
                await supabase.auth.signOut();
                return { success: false, message: 'Acceso denegado: no tienes permisos de administrador.' };
            }
            setAdminUser(profile);
            setIsAuthenticated(true);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message || 'Error desconocido' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        setIsAuthenticated(false);
    };

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetchAdminProfile(session.user);
    };

    if (loading) return null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, adminUser, login, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
