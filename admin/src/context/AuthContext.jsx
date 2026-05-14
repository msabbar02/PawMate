/**
 * Contexto de autenticación del panel de administración.
 *
 * Gestiona la sesión Supabase, restringe el acceso a usuarios con rol
 * `admin`, mantiene la sesión viva al volver de inactividad refrescando
 * el JWT y reconectando el websocket de Realtime, y expone helpers para
 * login/logout/recarga de perfil al resto de la app.
 */
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

    /**
     * Carga el perfil del usuario desde la tabla `users` y solo lo expone
     * si su rol es `admin`. Devuelve el perfil o `null`.
     *
     * @param {{ id: string }} authUser Usuario devuelto por Supabase Auth.
     * @returns {Promise<Object|null>}  Perfil de admin o null.
     */
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

    // Inicialización de la sesión + suscripción a cambios de Auth.
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

        // Salvavidas: si la inicialización tarda más de 5 s, libera la UI igualmente.
        timeout = setTimeout(() => {
            if (!initDone.current) {
                console.warn('Auth init timeout — forzando carga');
                setLoading(false);
            }
        }, 5000);

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Ignora el primer evento, ya cubierto por initAuth.
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

    /*
     * Manejo de reactivación del tab.
     * Si el navegador estuvo más de 30 s oculto/sin red, refresca el JWT
     * y reconecta Realtime; emite el evento `pawmate:wake` para que las
     * páginas vuelvan a pedir datos frescos sin recargar entera la app.
     */
    useEffect(() => {
        let lastHiddenAt = 0;
        let waking = false;

        const wake = async () => {
            if (waking) return;
            waking = true;
            try {
                // Refresca el JWT con un tope duro de 4 s para no bloquear la UI.
                await Promise.race([
                    supabase.auth.refreshSession(),
                    new Promise((resolve) => setTimeout(resolve, 4000)),
                ]);
                try {
                    supabase.realtime.disconnect();
                    supabase.realtime.connect();
                } catch (err) {
                    console.warn('Realtime reconnect failed:', err);
                }
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

    /**
     * Inicia sesión contra Supabase y verifica que el usuario es admin.
     * Si no lo es cierra la sesión inmediatamente para no exponer datos.
     *
     * @param {string} email    Email del administrador.
     * @param {string} password Contraseña.
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    const login = async (email, password) => {
        try {
            const trimmedEmail = email.trim().toLowerCase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password
            });
            if (error) return { success: false, message: error.message };

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

    /** Cierra la sesión actual y limpia el estado. */
    const logout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        setIsAuthenticated(false);
    };

    /** Vuelve a leer el perfil del admin desde Supabase (tras editarlo). */
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
