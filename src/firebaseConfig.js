// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
