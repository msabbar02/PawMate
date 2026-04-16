import React, { createContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const initDone = useRef(false);

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
        let timeout;

        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.warn('Session restore failed:', error.message);
                    setIsAuthenticated(false);
                    setLoading(false);
                    return;
                }
                if (session?.user) {
                    const profile = await fetchAdminProfile(session.user);
                    setIsAuthenticated(!!profile);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (err) {
                console.warn('Auth init error:', err);
                setIsAuthenticated(false);
            } finally {
                initDone.current = true;
                setLoading(false);
            }
        };

        // Safety timeout — never stay on blank screen
        timeout = setTimeout(() => {
            if (!initDone.current) {
                console.warn('Auth init timeout — forcing load');
                setLoading(false);
            }
        }, 5000);

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Skip the initial event — handled by initAuth
            if (!initDone.current) return;

            if (event === 'SIGNED_OUT') {
                setIsAuthenticated(false);
                setAdminUser(null);
                return;
            }
            if (session?.user) {
                const profile = await fetchAdminProfile(session.user);
                setIsAuthenticated(!!profile);
            } else {
                setIsAuthenticated(false);
                setAdminUser(null);
            }
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
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

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-color, #0B0E14)',
            }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                    <div style={{
                        width: 40, height: 40, margin: '0 auto 16px',
                        border: '3px solid rgba(255,255,255,0.1)',
                        borderTopColor: 'var(--primary-color, #3b82f6)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <span>Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, adminUser, login, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
