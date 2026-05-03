// src/App.js
import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebaseConfig";
import ChitOverview from "./components/ChitOverview";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import "./App.css";

function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [selectedChit, setSelectedChit] = useState(() => {
    const saved = sessionStorage.getItem("selectedChit");
    return saved || null;
  });

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      // Clear selected chit on logout
      if (!firebaseUser) {
        sessionStorage.removeItem("selectedChit");
        setSelectedChit(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSelectChit = (chitId) => {
    sessionStorage.setItem("selectedChit", chitId);
    setSelectedChit(chitId);
  };

  const handleBackToOverview = () => {
    sessionStorage.removeItem("selectedChit");
    setSelectedChit(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Still checking auth state
  if (user === undefined) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0F0B2E, #1E1B4B)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ color: "rgba(196,181,253,0.6)", fontSize: "0.95em" }}>
          Loading...
        </div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <Login />;
  }

  // Logged in - show app
  return (
    <div className="App">
      {selectedChit ? (
        <Dashboard
          chitId={selectedChit}
          onBack={handleBackToOverview}
          user={user}
          onLogout={handleLogout}
        />
      ) : (
        <ChitOverview
          onSelectChit={handleSelectChit}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
