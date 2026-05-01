// src/components/ChitOverview.js
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./ChitOverview.css";
import AddChitModal from "./AddChitModal";

// Fallback hardcoded IDs for existing chits (migrated to Firestore on first load)
const LEGACY_IDS = ["2025", "2026", "1992", "2434", "1809", "1116"];

const ChitOverview = ({ onSelectChit }) => {
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchChitSummaries = async () => {
    setLoading(true);
    try {
      // Load chit IDs from Firestore (or migrate legacy hardcoded ones)
      const listRef = doc(db, "app-config", "chits");
      const listSnap = await getDoc(listRef);

      let chitIds;
      if (!listSnap.exists() || !(listSnap.data().ids || []).length) {
        // First time: migrate legacy IDs to Firestore
        chitIds = LEGACY_IDS;
        await setDoc(listRef, { ids: LEGACY_IDS });
      } else {
        chitIds = listSnap.data().ids || [];
      }

      // Fetch summary for each chit
      const summaries = await Promise.all(
        chitIds.map(async (chitId) => {
          try {
            const configRef = doc(db, `chit-${chitId}-config`, "settings");
            const snap = await getDoc(configRef);
            if (snap.exists()) {
              const data = snap.data();
              const summary = data.summary || {};

              // Auto-calculate current month if startMonth/startYear is set
              let currentMonth = data.currentMonth || 1;
              if (data.startMonth && data.startYear) {
                const today = new Date();
                const diff = (today.getFullYear() - data.startYear) * 12
                  + (today.getMonth() + 1 - data.startMonth) + 1;
                currentMonth = Math.min(Math.max(1, diff), 30);
              }

              return {
                id: chitId,
                name: data.chitName || `Chit ${chitId}`,
                startMonth: data.startMonth || null,
                startYear: data.startYear || null,
                currentMonth,
                totalCollected: summary.totalCollected || 0,
                totalPending: summary.totalPending || 0,
                paidCount: summary.paidCount || 0,
                totalMembers: summary.totalMembers || 0,
              };
            }
            return {
              id: chitId, name: `Chit ${chitId}`, currentMonth: 1,
              totalCollected: 0, totalPending: 0, paidCount: 0, totalMembers: 0,
            };
          } catch {
            return {
              id: chitId, name: `Chit ${chitId}`, currentMonth: 1,
              totalCollected: 0, totalPending: 0, paidCount: 0, totalMembers: 0,
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

  useEffect(() => { fetchChitSummaries(); }, []);

  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="overview-page">
      {showAddModal && (
        <AddChitModal
          onClose={() => setShowAddModal(false)}
          onAdded={(newId) => {
            setShowAddModal(false);
            fetchChitSummaries();
            setTimeout(() => onSelectChit(newId), 300);
          }}
        />
      )}

      <div className="chit-overview">
        <div className="overview-page-header">
          <h2 className="overview-main-title">Chit Fund Management Dashboard</h2>
          <p className="overview-subtitle">Chitt Tracker · {chits.length} funds</p>
        </div>

        {/* Add New Chit Button */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <button className="add-chit-btn" onClick={() => setShowAddModal(true)}>
            + Add New Chit
          </button>
        </div>

        {loading ? (
          <div className="chit-grid">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="skeleton-card">
                <div style={{ height: 4, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ padding: 18 }}>
                  <div className="skeleton-bar" style={{ height: 14, width: "50%", marginBottom: 12 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "80%", marginBottom: 8 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "65%", marginBottom: 8 }} />
                  <div className="skeleton-bar" style={{ height: 10, width: "70%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="chit-grid">
            {chits.map((chit) => {
              const progressPct = chit.totalMembers > 0
                ? Math.round((chit.paidCount / chit.totalMembers) * 100) : 0;
              return (
                <div key={chit.id} className="chit-card" onClick={() => onSelectChit(chit.id)}>
                  <div className="chit-card-accent" />
                  <div className="chit-card-body">
                    <div className="chit-header">
                      <h3>{chit.name}</h3>
                      <span className="month-badge">Month {chit.currentMonth}</span>
                    </div>

                    {/* Show start date if set */}
                    {chit.startMonth && chit.startYear && (
                      <div className="chit-start-date">
                        Started {MONTHS_SHORT[chit.startMonth - 1]} {chit.startYear}
                      </div>
                    )}

                    <div className="chit-stats">
                      <div className="stat">
                        <span className="stat-label">Collected</span>
                        <span className="stat-value collected">Rs.{chit.totalCollected.toLocaleString()}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Pending</span>
                        <span className="stat-value pending">Rs.{chit.totalPending.toLocaleString()}</span>
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
        )}
      </div>
    </div>
  );
};

export default ChitOverview;
