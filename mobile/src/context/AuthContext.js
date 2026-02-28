import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export const AuthContext = createContext({
    user: null, // The Firebase user object
    userData: null, // Additional user data from Firestore
    isLoading: true, // Loading state
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot = null;

        // Subscribe to auth state changes
        const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
            if (authenticatedUser) {
                setUser(authenticatedUser);

                // Fetch additional user data from Firestore in real-time
                const docRef = doc(db, 'users', authenticatedUser.uid);
                unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserData({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        console.log("No such user document!");
                        setUserData(null);
                    }
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    setIsLoading(false);
                });

            } else {
                setUser(null);
                setUserData(null);
                setIsLoading(false);
                if (unsubscribeSnapshot) {
                    unsubscribeSnapshot();
                    unsubscribeSnapshot = null;
                }
            }
        });

        // Unsubscribe on unmount
        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};
