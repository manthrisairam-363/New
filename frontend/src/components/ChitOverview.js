// src/components/ChitOverview.js
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./ChitOverview.css";

const CHIT_IDS = [2025, 2026, 1992, 2434, 1809, 1116];

const ChitOverview = ({ onSelectChit }) => {
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChitSummaries = async () => {
      setLoading(true);
      try {
        // Only read 6 config documents — no member reads needed
        const summaries = await Promise.all(
          CHIT_IDS.map(async (chitId) => {
            try {
              const configRef = doc(db, `chit-${chitId}-config`, "settings");
              const snap = await getDoc(configRef);

              if (snap.exists()) {
                const data = snap.data();
                // Use cached summary if available, otherwise show defaults
                const summary = data.summary || {};
                return {
                  id: chitId,
                  currentMonth: data.currentMonth || 1,
                  totalCollected: summary.totalCollected || 0,
                  totalPending: summary.totalPending || 0,
                  paidCount: summary.paidCount || 0,
                  totalMembers: summary.totalMembers || 30,
                };
              } else {
                // Config doesn't exist yet — chit not opened
                return {
                  id: chitId,
                  currentMonth: 1,
                  totalCollected: 0,
                  totalPending: 0,
                  paidCount: 0,
                  totalMembers: 30,
                };
              }
            } catch {
              return {
                id: chitId,
                currentMonth: 1,
                totalCollected: 0,
                totalPending: 0,
                paidCount: 0,
                totalMembers: 30,
              };
            }
          })
        );
        setChits(summaries);
      } catch (error) {
        console.error("Error fetching chit summaries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChitSummaries();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="chit-overview">
      <h2>Chit Fund Management Dashboard</h2>
      <div className="chit-grid">
        {chits.map((chit) => (
          <div key={chit.id} className="chit-card" onClick={() => onSelectChit(chit.id)}>
            <div className="chit-header">
              <h3>Chit {chit.id}</h3>
              <span className="month-badge">Month {chit.currentMonth}</span>
            </div>

            <div className="chit-stats">
              <div className="stat">
                <span className="stat-label">Total Collected</span>
                <span className="stat-value collected">₹{chit.totalCollected.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pending Collection</span>
                <span className="stat-value pending">₹{chit.totalPending.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Paid This Month</span>
                <span className="stat-value">{chit.paidCount} / {chit.totalMembers}</span>
              </div>
            </div>

            <div className="chit-actions">
              <button className="manage-btn">Manage This Chit →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChitOverview;
