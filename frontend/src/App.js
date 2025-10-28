// src/App.js
import React, { useState } from "react";
import ChitOverview from "./components/ChitOverview";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  const [selectedChit, setSelectedChit] = useState(null);

  const handleSelectChit = (chitId) => {
    setSelectedChit(chitId);
  };

  const handleBackToOverview = () => {
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