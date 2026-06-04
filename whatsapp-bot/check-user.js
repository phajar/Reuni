const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCfZ9zV6DOuSZoFoFvkW8NCSaxNlmn8R8k",
    authDomain: "reuniakbar.firebaseapp.com",
    projectId: "reuniakbar",
    storageBucket: "reuniakbar.firebasestorage.app",
    messagingSenderId: "542951643652",
    appId: "1:542951643652:web:1b4b7dac6c676a5d6c3351"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

async function check() {
    console.log("Fetching users from Firestore...");
    try {
        const querySnapshot = await db.collection("users").get();
        querySnapshot.forEach((doc) => {
            console.log(`User: ${doc.id} => Email: ${doc.data().email}, Role: ${doc.data().role}, Nama: ${doc.data().nama}`);
        });
    } catch (e) {
        console.error("Error fetching users:", e);
    }
    process.exit(0);
}

check();
