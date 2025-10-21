// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBLOgdKMQ4yDeiTtdUBvm3o4BBl1UW_JPI",
  authDomain: "chitttracker.firebaseapp.com",
  projectId: "chitttracker",
  storageBucket: "chitttracker.firebasestorage.app",
  messagingSenderId: "513061015997",
  appId: "1:513061015997:web:80d27f8172f2148402c2d4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
