import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDmcvUF4rXPs9KDjYM8WBSB3w4ZhmhX4U0",
    authDomain: "pawmate-992da.firebaseapp.com",
    projectId: "pawmate-992da",
    storageBucket: "pawmate-992da.firebasestorage.app",
    messagingSenderId: "1020012421897",
    appId: "1:1020012421897:web:e1acb7c27ea30fe662a9d8",
    measurementId: "G-PXS5R7JMZB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        const snap = await getDocs(collection(db, "users"));
        console.log("Success! Users found: " + snap.docs.length);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
