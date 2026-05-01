// src/components/AddChitModal.js
import React, { useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./AddChitModal.css";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export default function AddChitModal({ onClose, onAdded }) {
  const [chitName, setChitName] = useState("");
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(currentYear);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-calculate current month of chit based on start date
  const calcCurrentMonth = (sm, sy) => {
    const today = new Date();
    const diff = (today.getFullYear() - sy) * 12 + (today.getMonth() + 1 - sm) + 1;
    return Math.min(Math.max(1, diff), 30);
  };

  const previewMonth = calcCurrentMonth(startMonth, startYear);

  const handleSave = async () => {
    const name = chitName.trim();
    if (!name) { setError("Please enter a chit name or ID."); return; }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(name)) {
      setError("Name can only contain letters, numbers, spaces, - and _");
      return;
    }

    const chitId = name.replace(/\s+/g, "_");
    setSaving(true);
    setError("");

    try {
      // Check if already exists
      const existing = await getDoc(doc(db, `chit-${chitId}-config`, "settings"));
      if (existing.exists()) {
        setError(`A chit named "${name}" already exists.`);
        setSaving(false);
        return;
      }

      const currentMonth = calcCurrentMonth(startMonth, startYear);

      // Create config
      await setDoc(doc(db, `chit-${chitId}-config`, "settings"), {
        chitId,
        chitName: name,
        startMonth,
        startYear,
        currentMonth,
        currentReceiver: 1,
        summary: { totalCollected: 0, totalPending: 0, paidCount: 0, totalMembers: 0 },
      });

      // Save chit to global list
      const listRef = doc(db, "app-config", "chits");
      const listSnap = await getDoc(listRef);
      const existing_ids = listSnap.exists() ? (listSnap.data().ids || []) : [];
      await setDoc(listRef, { ids: [...existing_ids, chitId] });

      onAdded(chitId);
    } catch (err) {
      console.error("AddChit error:", err);
      setError("Failed to create chit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="modal-title">Add New Chit</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">

          <div className="modal-field">
            <label className="modal-label">Chit Name / ID</label>
            <input
              className="modal-input"
              type="text"
              placeholder="e.g. 2027, Family Chit, Office Chit"
              value={chitName}
              onChange={e => { setChitName(e.target.value); setError(""); }}
              maxLength={30}
            />
            <span className="modal-hint">This will be the display name on the overview page.</span>
          </div>

          <div className="modal-field">
            <label className="modal-label">Chit Start Month and Year</label>
            <div className="modal-row">
              <select
                className="modal-select"
                value={startMonth}
                onChange={e => setStartMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="modal-select"
                value={startYear}
                onChange={e => setStartYear(Number(e.target.value))}
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <span className="modal-hint">When did this chit fund start?</span>
          </div>

          <div className="modal-preview">
            <div className="modal-preview-icon">ℹ</div>
            <div>
              <div className="modal-preview-title">
                {MONTHS[startMonth - 1]} {startYear} start
                {" → "}Currently on <strong>Month {previewMonth}</strong>
              </div>
              <div className="modal-preview-sub">
                The app will automatically track which month the chit is on based on today's date.
              </div>
            </div>
          </div>

          {error && <div className="modal-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="modal-save" onClick={handleSave} disabled={saving}>
            {saving ? "Creating..." : "Create Chit"}
          </button>
        </div>

      </div>
    </div>
  );
}
