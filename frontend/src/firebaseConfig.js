// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDywEWlitzUV5lGEfXimRTb8Y_2cSc1n0Y",
  authDomain: "chitt-tracker.firebaseapp.com",
  projectId: "chitt-tracker",
  storageBucket: "chitt-tracker.firebasestorage.app",
  messagingSenderId: "1034284899657",
  appId: "1:1034284899657:web:94c528036e5466fbf20e98"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence - app loads from cache instantly on repeat visits
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open - persistence only works in one tab at a time
    console.log("Firestore persistence unavailable - multiple tabs open");
  } else if (err.code === "unimplemented") {
    // Browser doesn't support persistence
    console.log("Firestore persistence not supported in this browser");
  }
});
