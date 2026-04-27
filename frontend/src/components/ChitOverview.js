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
        const summaries = await Promise.all(
          CHIT_IDS.map(async (chitId) => {
            try {
              const configRef = doc(db, `chit-${chitId}-config`, "settings");
              const snap = await getDoc(configRef);
              if (snap.exists()) {
                const data = snap.data();
                const summary = data.summary || {};
                return {
                  id: chitId,
                  currentMonth: data.currentMonth || 1,
                  totalCollected: summary.totalCollected || 0,
                  totalPending: summary.totalPending || 0,
                  paidCount: summary.paidCount || 0,
                  totalMembers: summary.totalMembers || 0,
                };
              }
              return { id: chitId, currentMonth: 1, totalCollected: 0, totalPending: 0, paidCount: 0, totalMembers: 0 };
            } catch {
              return { id: chitId, currentMonth: 1, totalCollected: 0, totalPending: 0, paidCount: 0, totalMembers: 0 };
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
      <div className="overview-page">
        <div className="overview-header">
          <div className="overview-logo">C</div>
          <h1>Chitt Tracker</h1>
        </div>
        <div className="chit-overview">
          <h2 className="overview-main-title">Chit Fund Management Dashboard</h2>
        <p className="overview-section-title">Your Chit Funds</p>
          <div className="chit-grid">
            {CHIT_IDS.map((id) => (
              <div key={id} className="skeleton-card">
                <div style={{ height: 4, background: "#E2E8F0" }} />
                <div style={{ padding: 18 }}>
                  <div className="skeleton-bar" style={{ height: 14, width: "50%", marginBottom: 12 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "80%", marginBottom: 8 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "65%", marginBottom: 8 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "70%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div className="overview-logo">C</div>
        <h1>Chitt Tracker</h1>
        <span className="overview-header-sub">· {chits.length} funds</span>
      </div>
      <div className="chit-overview">
        <h2 className="overview-main-title">Chit Fund Management Dashboard</h2>
        <p className="overview-section-title">Your Chit Funds</p>
        <div className="chit-grid">
          {chits.map((chit) => {
            const progressPct = chit.totalMembers > 0
              ? Math.round((chit.paidCount / chit.totalMembers) * 100) : 0;
            return (
              <div key={chit.id} className="chit-card" onClick={() => onSelectChit(chit.id)}>
                <div className="chit-card-accent" />
                <div className="chit-card-body">
                  <div className="chit-header">
                    <h3>Chit {chit.id}</h3>
                    <span className="month-badge">Month {chit.currentMonth}</span>
                  </div>
                  <div className="chit-stats">
                    <div className="stat">
                      <span className="stat-label">Collected</span>
                      <span className="stat-value collected">₹{chit.totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Pending</span>
                      <span className="stat-value pending">₹{chit.totalPending.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="chit-progress-wrap">
                    <div className="chit-progress-label">
                      <span>Paid this month</span>
                      <span>{chit.paidCount} / {chit.totalMembers || 30}</span>
                    </div>
                    <div className="chit-progress-bar">
                      <div className="chit-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <button className="manage-btn">Manage This Chit →</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChitOverview;
