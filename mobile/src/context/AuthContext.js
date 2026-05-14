import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { registerForPushNotifications } from '../utils/pushNotifications';
import { logSystemAction } from '../utils/logger';
import { sendWelcomeEmail } from '../config/api';

export const AuthContext = createContext({
    user: null,
    userData: null,
    isLoading: true,
    refreshUserData: async () => {},
    updateUserOptimistic: () => {},
    unreadMessages: 0,
    pendingBookings: 0,
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [pendingBookings, setPendingBookings] = useState(0);

    // Referencias a todos los canales Realtime activos para limpiarlos al cerrar sesión.
    const channelsRef = useRef([]);
    const presenceIntervalRef = useRef(null);
    const userDataRef = useRef(null);
    // Último usuario autenticado, necesario para registrar el SIGNED_OUT con su id real.
    const lastUserRef = useRef(null);

    // Mantenemos un ref con userData para poder leerlo desde callbacks.
    useEffect(() => { userDataRef.current = userData; }, [userData]);

    /**
     * Aplica un parche local sobre `userData` sin esperar a la BD. Sirve para
     * que la UI reaccione al instante (avatar, settings, etc.).
     *
     * @param {object} partial Campos a sobrescribir.
     */
    const updateUserOptimistic = (partial) => {
        setUserData(prev => prev ? { ...prev, ...partial } : prev);
    };

    /**
     * Vuelve a leer la fila del usuario desde Supabase y refresca el estado.
     */
    const refreshUserData = useCallback(async () => {
        const currentUser = user;
        if (!currentUser) return;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        if (data && !error) {
            setUserData(data);
        }
    }, [user]);

    /**
     * Marca al usuario como "presente" actualizando `last_seen` cada minuto y
     * cuando la app vuelve a primer plano. No toca `isOnline` (lo controlan
     * los cuidadores manualmente).
     *
     * @param {string} userId Identificador del usuario.
     * @returns {object} Suscripción de AppState para poder eliminarla luego.
     */
    const startPresence = (userId) => {
        supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});

        presenceIntervalRef.current = setInterval(() => {
            supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
        }, 60000);

        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
            }
        });

        return appStateListener;
    };

    /**
     * Detiene el heartbeat de presencia y deja al usuario como desconectado.
     *
     * @param {string} userId Identificador del usuario.
     */
    const stopPresence = (userId) => {
        if (presenceIntervalRef.current) {
            clearInterval(presenceIntervalRef.current);
            presenceIntervalRef.current = null;
        }
        if (userId) {
            supabase.from('users').update({ isOnline: false, last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
        }
    };

    /**
     * Cancela todos los canales Realtime que tengamos abiertos.
     */
    const cleanupChannels = () => {
        channelsRef.current.forEach(ch => {
            try { supabase.removeChannel(ch); } catch {}
        });
        channelsRef.current = [];
    };

    useEffect(() => {
        let appStateListener = null;

        const handleAuthChange = async (session) => {
            if (session?.user) {
                setUser(session.user);
                const uid = session.user.id;

                // Fetch initial user data
                let { data: profile, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', uid)
                    .single();

                // Si el trigger handle_new_user no creó la fila pública, la creamos aquí.
                if (!profile && (error?.code === 'PGRST116' || error?.details?.includes('0 rows'))) {
                    const meta = session.user.user_metadata || {};
                    const fullName = meta.full_name || meta.name || meta.fullName || '';
                    const [firstName, ...rest] = fullName.split(' ');
                    const lastName = rest.join(' ');
                    const newRow = {
                        id: uid,
                        email: session.user.email || meta.email || '',
                        firstName: meta.firstName || firstName || '',
                        lastName: meta.lastName || lastName || '',
                        fullName: fullName,
                        photoURL: meta.avatar_url || meta.picture || null,
                        avatar: meta.avatar_url || meta.picture || null,
                        role: 'normal',
                    };
                    const { data: inserted, error: insertErr } = await supabase
                        .from('users')
                        .insert(newRow)
                        .select()
                        .single();
                    if (insertErr) {
                        console.error('Failed to auto-create user profile:', insertErr);
                    } else {
                        profile = inserted;
                        error = null;
                    }
                }

                if (profile && !error) {
                    // Si el usuario está baneado lo expulsamos antes de cargar nada más.
                    if (profile.is_banned) {
                        Alert.alert('Cuenta suspendida', 'Tu cuenta ha sido suspendida por un administrador.');
                        await supabase.auth.signOut();
                        return;
                    }
                    setUserData(profile);
                    registerForPushNotifications().catch(() => {});
                } else {
                    setUserData(null);
                    setIsLoading(false);
                    return;
                }
                setIsLoading(false);

                cleanupChannels();

                // Canal 1: cambios sobre la fila del usuario (incluye detección de baneo).
                const userChannel = supabase
                    .channel(`rt:user:${uid}`)
                    .on('postgres_changes', {
                        event: '*', schema: 'public', table: 'users',
                        filter: `id=eq.${uid}`
                    }, async (payload) => {
                        if (payload.new?.is_banned) {
                            Alert.alert('Cuenta suspendida', 'Tu cuenta ha sido suspendida por un administrador.');
                            await supabase.auth.signOut();
                            return;
                        }
                        // Releemos la fila para evitar payloads truncados con campos jsonb grandes.
                        const { data: freshData } = await supabase.from('users').select('*').eq('id', uid).single();
                        if (freshData) setUserData(freshData);
                    })
                    .subscribe();
                channelsRef.current.push(userChannel);

                // Canal 2: contador de mensajes sin leer.
                const fetchUnread = async () => {
                    const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('receiverId', uid)
                        .eq('read', false);
                    setUnreadMessages(count || 0);
                };
                fetchUnread();

                const msgChannel = supabase
                    .channel(`rt:messages:${uid}`)
                    .on('postgres_changes', {
                        event: '*', schema: 'public', table: 'messages',
                        filter: `receiverId=eq.${uid}`
                    }, fetchUnread)
                    .subscribe();
                channelsRef.current.push(msgChannel);

                // Canal 3: contador de reservas pendientes (cambia según el rol).
                const fetchPending = async () => {
                    const role = userDataRef.current?.role || profile?.role;
                    const field = role === 'caregiver' ? 'caregiverId' : 'ownerId';
                    const { count } = await supabase
                        .from('reservations')
                        .select('*', { count: 'exact', head: true })
                        .eq(field, uid)
                        .eq('status', 'pendiente');
                    setPendingBookings(count || 0);
                };
                fetchPending();

                const bookChannel = supabase
                    .channel(`rt:bookings:${uid}`)
                    .on('postgres_changes', {
                        event: '*', schema: 'public', table: 'reservations'
                    }, fetchPending)
                    .subscribe();
                channelsRef.current.push(bookChannel);

                // Heartbeat de presencia.
                appStateListener = startPresence(uid);

            } else {
                // El usuario ha cerrado sesión.
                const prevUid = user?.id;
                stopPresence(prevUid);
                cleanupChannels();
                setUser(null);
                setUserData(null);
                setUnreadMessages(0);
                setPendingBookings(0);
                setIsLoading(false);
            }
        };

        // Lectura inicial de la sesión almacenada en AsyncStorage.
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
            // Si ya había una sesión persistida, registramos también un USER_LOGIN
            // con el flag `resumed:true` para que el panel de admin pueda mostrar
            // que el usuario está activo (de lo contrario solo se loggea cuando
            // hay un SIGNED_IN explícito y nunca al reabrir la app).
            if (session?.user) {
                lastUserRef.current = { id: session.user.id, email: session.user.email };
                logSystemAction(
                    session.user.id,
                    session.user.email,
                    'USER_LOGIN',
                    'Auth',
                    { event: 'INITIAL_SESSION', resumed: true, platform: Platform.OS, version: Platform.Version }
                ).catch(() => {});
            }
        });

        // Suscripción a los cambios de autenticación (login / logout).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
            handleAuthChange(session);
            if (_evt === 'SIGNED_IN' && session?.user) {
                lastUserRef.current = { id: session.user.id, email: session.user.email };
                const createdAt = new Date(session.user.created_at).getTime();
                const now = Date.now();
                const isNewUser = now - createdAt < 60000;
                logSystemAction(
                    session.user.id,
                    session.user.email,
                    isNewUser ? 'USER_SIGNUP' : 'USER_LOGIN',
                    'Auth',
                    { event: _evt, platform: Platform.OS, version: Platform.Version }
                );
                if (isNewUser) {
                    const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.fullName || '';
                    sendWelcomeEmail(session.user.email, fullName).catch(() => {});
                }
            } else if (_evt === 'SIGNED_OUT') {
                const prev = lastUserRef.current;
                if (prev?.id && prev?.email) {
                    logSystemAction(prev.id, prev.email, 'USER_LOGOUT', 'Auth', { event: _evt, platform: Platform.OS });
                }
                lastUserRef.current = null;
            }
        });

        return () => {
            subscription.unsubscribe();
            cleanupChannels();
            stopPresence(user?.id);
            if (appStateListener) appStateListener.remove();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, isLoading, refreshUserData, updateUserOptimistic, unreadMessages, pendingBookings }}>
            {children}
        </AuthContext.Provider>
    );
};
