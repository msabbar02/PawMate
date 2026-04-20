import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
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

    // Track all channels for cleanup
    const channelsRef = useRef([]);
    const presenceIntervalRef = useRef(null);
    const userDataRef = useRef(null);

    // Keep ref in sync for use in callbacks
    useEffect(() => { userDataRef.current = userData; }, [userData]);

    const updateUserOptimistic = (partial) => {
        setUserData(prev => prev ? { ...prev, ...partial } : prev);
    };

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

    // ── Presence: update last_seen ──────────────
    const startPresence = (userId) => {
        // Update last_seen on login (don't force isOnline — caregivers control it manually)
        supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});

        // Heartbeat every 60s — only last_seen
        presenceIntervalRef.current = setInterval(() => {
            supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
        }, 60000);

        // AppState listener: only update last_seen, don't override manual online toggle
        const appStateListener = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
            }
        });

        return appStateListener;
    };

    const stopPresence = (userId) => {
        if (presenceIntervalRef.current) {
            clearInterval(presenceIntervalRef.current);
            presenceIntervalRef.current = null;
        }
        if (userId) {
            supabase.from('users').update({ isOnline: false, last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
        }
    };

    // ── Cleanup all realtime channels ───────────────────────
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
                const { data: profile, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', uid)
                    .single();

                if (profile && !error) {
                    // ── Ban check on login ──
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

                // Clean previous channels
                cleanupChannels();

                // ── Channel 1: User profile realtime (ban detection + data sync) ──
                const userChannel = supabase
                    .channel(`rt:user:${uid}`)
                    .on('postgres_changes', {
                        event: '*', schema: 'public', table: 'users',
                        filter: `id=eq.${uid}`
                    }, async (payload) => {
                        // Ban check from payload (small field, always delivered)
                        if (payload.new?.is_banned) {
                            Alert.alert('Cuenta suspendida', 'Tu cuenta ha sido suspendida por un administrador.');
                            await supabase.auth.signOut();
                            return;
                        }
                        // Refresh from DB instead of using payload (payload may be truncated with large fields like galleryPhotos)
                        const { data: freshData } = await supabase.from('users').select('*').eq('id', uid).single();
                        if (freshData) setUserData(freshData);
                    })
                    .subscribe();
                channelsRef.current.push(userChannel);

                // ── Channel 2: Unread messages ──
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

                // ── Channel 3: Pending bookings ──
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

                // ── Start presence heartbeat ──
                appStateListener = startPresence(uid);

            } else {
                // Signed out
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

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
            handleAuthChange(session);
            if (_evt === 'SIGNED_IN' && session?.user) {
                logSystemAction(session.user.id, session.user.email, 'USER_LOGIN', 'Auth', { event: _evt });
                // Send welcome email for new users (created in the last 60 seconds)
                const createdAt = new Date(session.user.created_at).getTime();
                const now = Date.now();
                if (now - createdAt < 60000) {
                    const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.fullName || '';
                    sendWelcomeEmail(session.user.email, fullName).catch(() => {});
                }
            } else if (_evt === 'SIGNED_OUT') {
                logSystemAction(user?.id || 'Sistema', user?.email || 'Sistema', 'USER_LOGOUT', 'Auth', { event: _evt });
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
