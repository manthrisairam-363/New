// src/components/MemberSetup.js
import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./MemberSetup.css";

export default function MemberSetup({ chitId, existingMembers = [], onComplete, onCancel }) {
  const isEditing = existingMembers.length > 0;

  // Pre-fill rows if editing existing members
  const [rows, setRows] = useState(
    isEditing
      ? existingMembers.map((m) => ({ name: m.name || "", phone: m.phone || "" }))
      : [{ name: "", phone: "" }]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addRow = () => {
    setRows((prev) => [...prev, { name: "", phone: "" }]);
  };

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const deleteRow = (index) => {
    if (rows.length === 1) return; // keep at least one row
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validate — all rows must have name and phone
    const filledRows = rows.filter((r) => r.name.trim() || r.phone.trim());
    if (filledRows.length === 0) {
      setError("Please add at least one member.");
      return;
    }
    const invalid = filledRows.find((r) => !r.name.trim() || !r.phone.trim());
    if (invalid) {
      setError("Every member needs both a name and a phone number.");
      return;
    }
    const badPhone = filledRows.find((r) => !/^\d{10}$/.test(r.phone.trim()));
    if (badPhone) {
      setError(`Phone number for "${badPhone.name}" must be exactly 10 digits.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      // If editing, we need to handle members beyond the current list
      // Build final member list: filled rows get real data, remaining slots keep existing payment data
      const totalSlots = Math.max(filledRows.length, existingMembers.length, 30);

      for (let i = 0; i < totalSlots; i++) {
        const existing = existingMembers[i] || {};
        const newData = filledRows[i];

        const memberDoc = {
          id: i + 1,
          name: newData ? newData.name.trim() : (existing.name || `Member ${i + 1}`),
          phone: newData ? newData.phone.trim() : (existing.phone || ""),
          chitMonthPicked: existing.chitMonthPicked ?? null,
          payments: existing.payments || {},
          shortPayments: existing.shortPayments || {},
        };

        await setDoc(
          doc(db, `chit-${chitId}-members`, String(i + 1)),
          memberDoc
        );
      }

      onComplete();
    } catch (err) {
      console.error("Save members error:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-overlay">
      <div className="setup-card">

        {/* Header */}
        <div className="setup-header">
          <div>
            <h2 className="setup-title">
              {isEditing ? "Edit Members" : "Set Up Members"}
            </h2>
            <p className="setup-subtitle">
              Chit {chitId} &nbsp;·&nbsp;
              {isEditing
                ? "Update names or phone numbers. Payment history stays intact."
                : "Add your members now. This data will be used for all 30 months."}
            </p>
          </div>
          {onCancel && (
            <button className="setup-cancel-btn" onClick={onCancel}>
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Member count pill */}
        <div className="setup-count-bar">
          <span className="setup-count-pill">
            {rows.filter((r) => r.name.trim()).length} members added
          </span>
          <span className="setup-hint">Max 30 members</span>
        </div>

        {/* Table */}
        <div className="setup-table-wrap">
          <table className="setup-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Full Name</th>
                <th>Phone Number</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="setup-num">{idx + 1}</td>
                  <td>
                    <input
                      className="setup-input"
                      type="text"
                      placeholder="e.g. Sairam"
                      value={row.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (idx === rows.length - 1 && rows.length < 30) addRow();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="setup-input"
                      type="tel"
                      placeholder="10-digit number"
                      maxLength={10}
                      value={row.phone}
                      onChange={(e) =>
                        updateRow(idx, "phone", e.target.value.replace(/\D/g, ""))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (idx === rows.length - 1 && rows.length < 30) addRow();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="setup-del-btn"
                      onClick={() => deleteRow(idx)}
                      disabled={rows.length === 1}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        {rows.length < 30 && (
          <button className="setup-add-row-btn" onClick={addRow}>
            + Add Member
          </button>
        )}

        {/* Error */}
        {error && <p className="setup-error">{error}</p>}

        {/* Footer actions */}
        <div className="setup-footer">
          {onCancel && (
            <button className="setup-secondary-btn" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
          <button
            className="setup-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isEditing
              ? "Save Changes"
              : "Save & Open Dashboard →"}
          </button>
        </div>

      </div>
    </div>
  );
}
