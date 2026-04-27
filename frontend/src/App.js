// src/App.js
import React, { useState } from "react";
import ChitOverview from "./components/ChitOverview";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  // Restore selected chit from sessionStorage so refresh doesn't lose state
  const [selectedChit, setSelectedChit] = useState(() => {
    const saved = sessionStorage.getItem("selectedChit");
    return saved ? Number(saved) : null;
  });

  const handleSelectChit = (chitId) => {
    sessionStorage.setItem("selectedChit", chitId);
    setSelectedChit(chitId);
  };

  const handleBackToOverview = () => {
    sessionStorage.removeItem("selectedChit");
    setSelectedChit(null);
  };

  return (
    <div className="App">
      {selectedChit ? (
        <Dashboard
          chitId={selectedChit}
          onBack={handleBackToOverview}
        />
      ) : (
        <ChitOverview onSelectChit={handleSelectChit} />
      )}
    </div>
  );
}

export default App;
