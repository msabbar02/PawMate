import React, { createContext, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const initDone = useRef(false);
    const { t } = useTranslation();

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

    // ── Wake-up handler: if the tab was hidden for >30s, refresh the session
    //    and reconnect realtime so navigations don't hang on a stale socket. ──
    useEffect(() => {
        let lastHiddenAt = 0;
        let waking = false;

        const wake = async () => {
            if (waking) return;
            waking = true;
            try {
                // Refresh JWT in case it expired while the tab was hidden
                await Promise.race([
                    supabase.auth.refreshSession(),
                    new Promise((resolve) => setTimeout(resolve, 4000)), // hard cap
                ]);
                // Tear down and reopen the realtime websocket
                try {
                    supabase.realtime.disconnect();
                    supabase.realtime.connect();
                } catch (err) {
                    console.warn('Realtime reconnect failed:', err);
                }
                // Tell pages they can refetch fresh data
                window.dispatchEvent(new Event('pawmate:wake'));
            } catch (err) {
                console.warn('Wake-up refresh failed:', err);
            } finally {
                waking = false;
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenAt = Date.now();
                return;
            }
            const hiddenMs = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
            lastHiddenAt = 0;
            if (hiddenMs > 30 * 1000) wake();
        };

        const onOnline = () => wake();

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('online', onOnline);
        window.addEventListener('focus', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('focus', onVisibilityChange);
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
                return { success: false, message: t('auth.accessDenied') };
            }
            setAdminUser(profile);
            setIsAuthenticated(true);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message || t('auth.unknownError') };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        setIsAuthenticated(false);
    };

    const refreshProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) await fetchAdminProfile(session.user);
        } catch (err) {
            console.error('refreshProfile error:', err);
        }
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
                    <span>{t('auth.loading')}</span>
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
