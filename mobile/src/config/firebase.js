import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDmcvUF4rXPs9KDjYM8WBSB3w4ZhmhX4U0",
    authDomain: "pawmate-992da.firebaseapp.com",
    projectId: "pawmate-992da",
    storageBucket: "pawmate-992da.firebasestorage.app",
    messagingSenderId: "1020012421897",
    appId: "1:1020012421897:web:e1acb7c27ea30fe662a9d8",
    measurementId: "G-PXS5R7JMZB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with async storage persistence
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
