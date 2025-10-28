// src/components/ChitOverview.js
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./ChitOverview.css";

const ChitOverview = ({ onSelectChit }) => {
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChitSummaries = async () => {
      setLoading(true);
      try {
        // Define your 5 chits
        const chitIds = [1, 2, 3, 4, 5];
        const chitSummaries = [];

        for (const chitId of chitIds) {
          const membersCol = collection(db, `chit-${chitId}-members`);
          const configCol = collection(db, `chit-${chitId}-config`);
          
          try {
            const membersSnap = await getDocs(membersCol);
            const configSnap = await getDocs(configCol);
            
            let membersList = [];
            membersSnap.forEach(doc => membersList.push(doc.data()));
            
            let configData = { currentMonth: 1 };
            if (!configSnap.empty) {
              configData = configSnap.docs[0].data();
            }

            // Calculate summary stats
            const currentMonth = configData.currentMonth || 1;
            const totalMembers = membersList.length || 30;
            
let totalCollected = 0;
let totalPending = 0;
membersList.forEach(member => {
  for (let month = 1; month <= currentMonth; month++) {
    const expectedAmount = member.chitMonthPicked && month >= member.chitMonthPicked ? 19500 : 17700;
    const paid = member.payments?.[month]?.paid || false;
    const short = member.shortPayments?.[month] || 0;
    if (paid) {
      totalCollected += Math.max(0, expectedAmount - short);  // What's actually paid
      totalPending += short;                                  // What's still pending out of the paid amount
    } else {
      totalPending += expectedAmount;                         // Full not-yet-paid amount
    }
  }
});


            chitSummaries.push({
              id: chitId,
              name: `Chit ${chitId}`,
              currentMonth,
              totalMembers,
              totalCollected,
              totalPending,
              activeMembers: membersList.filter(m => 
                Object.keys(m.payments || {}).some(month => m.payments[month])
              ).length
            });
          } catch (err) {
            // If collections don't exist, add placeholder
            chitSummaries.push({
              id: chitId,
              name: `Chit ${chitId}`,
              currentMonth: 1,
              totalMembers: 30,
              totalCollected: 0,
              totalPending: 531000, // 30 members * 17700
              activeMembers: 0
            });
          }
        }

        setChits(chitSummaries);
      } catch (error) {
        console.error("Error fetching chit summaries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChitSummaries();
  }, []);

  if (loading) {
    return <div className="loading">Loading chit summaries...</div>;
  }

  return (
    <div className="chit-overview">
      <h2>Chit Fund Management Dashboard</h2>
      <div className="chit-grid">
        {chits.map(chit => (
          <div key={chit.id} className="chit-card" onClick={() => onSelectChit(chit.id)}>
            <div className="chit-header">
              <h3>{chit.name}</h3>
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
                <span className="stat-label">Active Members</span>
                <span className="stat-value">{chit.activeMembers} / {chit.totalMembers}</span>
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