import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { registerForPushNotifications } from '../utils/pushNotifications';

export const AuthContext = createContext({
    user: null, // The Supabase user object
    userData: null, // Additional user data from Postgres
    isLoading: true, // Loading state
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let subscriptionChannel = null;

        const handleAuthChange = async (session) => {
            if (session?.user) {
                setUser(session.user);
                
                // Fetch initial user data
                const fetchUserData = async () => {
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                        
                    if (data && !error) {
                        setUserData(data);
                        registerForPushNotifications().catch(() => {});
                    } else {
                        console.log("No such user document or error:", error);
                        setUserData(null);
                    }
                    setIsLoading(false);
                };
                
                await fetchUserData();

                // Subscribe to real-time changes on this user's row
                subscriptionChannel = supabase
                    .channel('public:users')
                    .on('postgres_changes', { 
                        event: '*', 
                        schema: 'public', 
                        table: 'users',
                        filter: `id=eq.${session.user.id}`
                    }, (payload) => {
                        if (payload.new) {
                            setUserData(payload.new);
                        }
                    })
                    .subscribe();

            } else {
                setUser(null);
                setUserData(null);
                setIsLoading(false);
                if (subscriptionChannel) {
                    supabase.removeChannel(subscriptionChannel);
                    subscriptionChannel = null;
                }
            }
        };

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
            handleAuthChange(session);
        });

        return () => {
            subscription.unsubscribe();
            if (subscriptionChannel) {
                supabase.removeChannel(subscriptionChannel);
            }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};
