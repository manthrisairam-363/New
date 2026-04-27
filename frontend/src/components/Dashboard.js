// src/components/Dashboard.js
import React, { useEffect, useState } from “react”;
import “./Dashboard.css”;
import {
collection,
getDocs,
doc,
getDoc,
setDoc,
updateDoc,
} from “firebase/firestore”;
import { db } from “../firebaseConfig”;
import MemberSetup from “./MemberSetup”;

export default function Dashboard({ chitId, onBack }) {

const TOTAL_MONTHS = 30;
const BEFORE_AMOUNTS = [
17700, 17700, 17500, 17500, 17300, 17300, 17100, 17100, 16800, 16800, 16500,
16500, 16000, 16000, 15500, 15000, 14500, 14000, 13500, 13000, 12500, 12000,
11500, 11000, 10500, 9500, 9000, 9000, 9000, 19500,
];
const AFTER_AMOUNT = 19500;
const CHIT_AMOUNTS = [
500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000,
500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000, 500000,
505000, 510000, 515000, 520000, 525000, 530000, 535000, 540000, 545000, 550000,
];

const [members, setMembers] = useState([]);
const [config, setConfig] = useState(null);
const [loading, setLoading] = useState(true);
const [editingMembers, setEditingMembers] = useState(false);
const [selectedMonth, setSelectedMonth] = useState(null);

// –– TOAST ––
const [toast, setToast] = useState(null);
const showToast = (message, type = “success”) => {
setToast({ message, type });
setTimeout(() => setToast(null), 3000);
};

const getMemberDueAmount = (member, currMonth) => {
let due = 0;
for (let m = 1; m <= currMonth; m++) {
const shortPayment = member.shortPayments?.[m] || 0;
due += shortPayment;
if (!member.payments?.[m]?.paid) {
if (member.chitMonthPicked && m >= member.chitMonthPicked) {
due += AFTER_AMOUNT;
} else {
due += BEFORE_AMOUNTS[m - 1] || AFTER_AMOUNT;
}
}
}
return due;
};

const membersCol = collection(db, `chit-${chitId}-members`);
const configDocRef = doc(db, `chit-${chitId}-config`, “settings”);

useEffect(() => {
async function fetchAll() {
setLoading(true);
try {
const mSnap = await getDocs(membersCol);
let mList = [];
mSnap.forEach((d) => mList.push(d.data()));

```
    if (mList.length === 0) {
      // No members yet — MemberSetup will handle creation
      setMembers([]);
    } else {
      mList = mList
        .map((mm) => ({
          ...mm,
          name: mm.name || `Member ${mm.id}`,
          phone: mm.phone || "",
          chitMonthPicked:
            typeof mm.chitMonthPicked === "number" ? mm.chitMonthPicked : null,
          payments: mm.payments || {},
          shortPayments: mm.shortPayments || {},
        }))
        .filter((mm) => mm.phone && mm.phone.trim() !== ""); // skip placeholders
      mList.sort((a, b) => a.id - b.id);
      setMembers(mList); // if all were placeholders, mList=[] → setup screen shows
    }

    const cSnap = await getDoc(configDocRef);
    let cdata;
    if (!cSnap.exists()) {
      cdata = { currentMonth: 1, currentReceiver: 1 };
      await setDoc(configDocRef, cdata);
    } else {
      cdata = cSnap.data();
      if (!cdata.currentMonth || cdata.currentMonth < 1 || cdata.currentMonth > TOTAL_MONTHS) {
        cdata.currentMonth = 1;
      }
      if (!cdata.currentReceiver || cdata.currentReceiver < 1 || cdata.currentReceiver > mList.length) {
        cdata.currentReceiver = 1;
      }
      await updateDoc(configDocRef, {
        currentMonth: cdata.currentMonth,
        currentReceiver: cdata.currentReceiver,
      });
    }
    setConfig(cdata);
    setSelectedMonth(cdata.currentMonth || 1);
    // Seed overview summary so ChitOverview loads fast next time
    setTimeout(() => updateOverviewSummary(mList, cdata), 500);
  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    setLoading(false);
  }
}
fetchAll();
// eslint-disable-next-line react-hooks/exhaustive-deps
```

}, [chitId]);

const getCurrentMonth = () => config?.currentMonth || 1;
const getCurrentReceiverId = () => config?.currentReceiver || 1;
const getChitAmount = (month) => CHIT_AMOUNTS[month - 1] || CHIT_AMOUNTS[0];
const countPaidForMonth = (month) =>
members.filter((m) => m.payments?.[month]?.paid).length;

const getMemberPaymentAmount = (member, currMonth) => {
if (member.chitMonthPicked && currMonth >= member.chitMonthPicked) {
return AFTER_AMOUNT;
}
return BEFORE_AMOUNTS[currMonth - 1] || AFTER_AMOUNT;
};

// –– TOGGLE PAYMENT (FIXED: only marks the selected month) ––
const togglePayment = async (member) => {
try {
const month = selectedMonth;
const now = new Date().toISOString();
const payments = { …member.payments };
const isCurrentlyPaid = payments[month]?.paid || false;

```
  if (!isCurrentlyPaid) {
    // Mark ONLY the selected month as paid
    payments[month] = { paid: true, date: now };
  } else {
    // Unmark if already paid (toggle off)
    payments[month] = { paid: false, date: null };
  }

  // If there's a short payment from previous month, clear it when marking paid
  let updatedShortPayments = { ...member.shortPayments };
  if (!isCurrentlyPaid && month > 1 && updatedShortPayments[month - 1]) {
    updatedShortPayments[month - 1] = 0;
  }

  const updatedMember = { ...member, payments, shortPayments: updatedShortPayments };
  await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
  const newMembers = members.map((p) => (p.id === member.id ? updatedMember : p));
  setMembers(newMembers);
  // Keep overview summary in sync
  updateOverviewSummary(newMembers, config);

  showToast(
    isCurrentlyPaid
      ? `${member.name} — Month ${month} marked unpaid`
      : `✅ ${member.name} — Month ${month} marked paid`
  );
} catch (err) {
  console.error("togglePayment error:", err);
  showToast("Failed to update payment", "error");
}
```

};

// –– UPDATE OVERVIEW SUMMARY (so ChitOverview loads fast) ––
const updateOverviewSummary = async (updatedMembers, currentConfig) => {
try {
const currMonth = currentConfig?.currentMonth || 1;
const BEFORE_AMT = [
17700,17700,17500,17500,17300,17300,17100,17100,16800,16800,16500,
16500,16000,16000,15500,15000,14500,14000,13500,13000,12500,12000,
11500,11000,10500,9500,9000,9000,9000,19500,
];
const AFT = 19500;
let totalCollected = 0, totalPending = 0, paidCount = 0;

```
  updatedMembers.forEach((member) => {
    for (let month = 1; month <= currMonth; month++) {
      const expected = member.chitMonthPicked && month >= member.chitMonthPicked
        ? AFT : (BEFORE_AMT[month - 1] || AFT);
      const paid = member.payments?.[month]?.paid || false;
      const short = member.shortPayments?.[month] || 0;
      if (paid) {
        totalCollected += Math.max(0, expected - short);
        totalPending += short;
      } else {
        totalPending += expected;
      }
    }
    if (member.payments?.[currMonth]?.paid) paidCount++;
  });

  await updateDoc(configDocRef, {
    summary: {
      totalCollected, totalPending, paidCount,
      totalMembers: updatedMembers.length,
      lastUpdated: new Date().toISOString(),
    },
  });
} catch (err) {
  // Non-critical — overview will still work, just may show stale data
  console.error("Summary update failed:", err);
}
```

};

const updateShortPayment = async (member, month, amount) => {
try {
const updatedShortPayments = { …member.shortPayments, [month]: amount };
const updatedMember = { …member, shortPayments: updatedShortPayments };
await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
setMembers((prev) =>
prev.map((p) => (p.id === member.id ? updatedMember : p))
);
} catch (error) {
console.error(“Failed to update short payment:”, error);
}
};

const assignChitMonth = async (member, month) => {
const alreadyPicked = members.some((m) => m.chitMonthPicked === month);
if (alreadyPicked) {
showToast(`Another member already picked chit for month ${month}`, “error”);
return;
}
try {
const updatedMember = { …member, chitMonthPicked: month };
await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
setMembers((prev) =>
prev.map((p) => (p.id === member.id ? updatedMember : p))
);
showToast(`${member.name} picked chit for Month ${month} ✅`);
} catch (err) {
console.error(“assignChitMonth error:”, err);
}
};

const advanceMonth = async () => {
if (!config) return;
const currMonth = getCurrentMonth();
if (currMonth >= TOTAL_MONTHS) {
showToast(`All ${TOTAL_MONTHS} months completed.`, “error”);
return;
}
const confirmed = window.confirm(
`Advance to Month ${currMonth + 1}? Make sure all Month ${currMonth} payments are recorded.`
);
if (!confirmed) return;
try {
const nextMonth = currMonth + 1;
const nextReceiver =
getCurrentReceiverId() >= members.length ? 1 : getCurrentReceiverId() + 1;
await updateDoc(configDocRef, {
currentMonth: nextMonth,
currentReceiver: nextReceiver,
});
const newConfig = { …config, currentMonth: nextMonth, currentReceiver: nextReceiver };
setConfig(newConfig);
setSelectedMonth(nextMonth);
updateOverviewSummary(members, newConfig);
showToast(`Advanced to Month ${nextMonth} ✅`);
} catch (err) {
showToast(“Failed to advance month”, “error”);
}
};

const resetThisMonth = async () => {
const month = selectedMonth;
const confirmed = window.confirm(
`Reset ALL payments for Month ${month} to unpaid? This cannot be undone.`
);
if (!confirmed) return;
try {
for (const m of members) {
const updatedPayments = { …m.payments, [month]: { paid: false, date: null } };
const updatedMember = { …m, payments: updatedPayments };
await setDoc(doc(db, `chit-${chitId}-members`, String(m.id)), updatedMember);
}
const resetMembers = members.map((m) => ({
…m,
payments: { …m.payments, [month]: { paid: false, date: null } },
}));
setMembers(resetMembers);
updateOverviewSummary(resetMembers, config);
showToast(`Month ${month} payments reset to unpaid`);
} catch (err) {
showToast(“Reset failed”, “error”);
}
};

if (loading || selectedMonth === null)
return <div style={{ padding: 20, textAlign: “center” }}>Loading…</div>;

// –– SHOW MEMBER SETUP if no members yet ––
if (members.length === 0 || editingMembers) {
return (
<MemberSetup
chitId={chitId}
existingMembers={editingMembers ? members : []}
onComplete={() => {
setEditingMembers(false);
setLoading(true);
// Re-fetch members after setup
getDocs(collection(db, `chit-${chitId}-members`)).then((snap) => {
let list = [];
snap.forEach((d) => list.push(d.data()));
list = list.map((mm) => ({
…mm,
name: mm.name || `Member ${mm.id}`,
phone: mm.phone || “”,
chitMonthPicked: typeof mm.chitMonthPicked === “number” ? mm.chitMonthPicked : null,
payments: mm.payments || {},
shortPayments: mm.shortPayments || {},
}));
list.sort((a, b) => a.id - b.id);
setMembers(list);
setLoading(false);
showToast(“Members saved successfully ✅”);
});
}}
onCancel={members.length > 0 ? () => setEditingMembers(false) : null}
/>
);
}

const paidCount = countPaidForMonth(selectedMonth);
const totalPerMonth = members.reduce(
(sum, m) => sum + getMemberPaymentAmount(m, selectedMonth), 0
);
const collected = members.reduce((sum, m) => {
const paid = m.payments?.[selectedMonth]?.paid || false;
if (paid) {
const expected = getMemberPaymentAmount(m, selectedMonth);
const short = m.shortPayments?.[selectedMonth] || 0;
return sum + Math.max(0, expected - short);
}
return sum;
}, 0);
const pending = totalPerMonth - collected;
const alreadyPicked = members.some((m) => m.chitMonthPicked === selectedMonth);

return (
<div className="dashboard">

```
  {/* ---- TOAST ---- */}
  {toast && (
    <div className={`toast ${toast.type === "error" ? "error" : "success"}`}>
      {toast.message}
    </div>
  )}

  {/* ---- STICKY TOP BAR ---- */}
  <div className="db-topbar">
    <button className="db-back-btn" onClick={onBack}>
      ← Back to Overview
    </button>
    <h2 className="db-title">Chit {chitId} — Dashboard</h2>
    <button
      className={`db-edit-btn ${selectedMonth === 1 ? "prominent" : "subtle"}`}
      onClick={() => setEditingMembers(true)}
    >
      ✎ {selectedMonth === 1 ? "Set Up / Edit Members" : "Edit Members"}
    </button>
  </div>

  <div className="db-body">

    {/* ---- SUMMARY CARDS ---- */}
    <div className="summary-container">
      <div className="summary">
        <div className="summary-card">
          <small>Month Status</small>
          <strong>Month {selectedMonth}</strong>
          <span className="sub">Paid: {paidCount} / Unpaid: {members.length - paidCount}</span>
        </div>
        <div className="summary-card">
          <small>Collected This Month</small>
          <strong style={{ color: "var(--success)" }}>₹{collected.toLocaleString()}</strong>
          <span className="sub">Total Expected: ₹{totalPerMonth.toLocaleString()}</span>
        </div>
        <div className="summary-card pending-card">
          <small>Pending Collection</small>
          <strong style={{ color: "var(--danger)" }}>₹{pending.toLocaleString()}</strong>
          <span className="sub">Due in current month</span>
        </div>
        <div className="summary-card">
          <small>Current Receiver</small>
          <strong>Member {getCurrentReceiverId()}</strong>
          <span className="sub">Chit Value: ₹{getChitAmount(selectedMonth).toLocaleString()}</span>
        </div>
      </div>

      <div className="admin-actions">
        <button className="btn-advance" onClick={advanceMonth}>
          ▶ Advance to Month {getCurrentMonth() + 1}
        </button>
        <button className="btn-reset" onClick={resetThisMonth}>
          ↺ Reset Month {selectedMonth} Payments
        </button>
      </div>
    </div>

    {/* ---- MONTH SELECTOR ---- */}
    <div className="months-bar">
      {[...Array(TOTAL_MONTHS)].map((_, i) => {
        const monthNum = i + 1;
        const isActive = selectedMonth === monthNum;
        const isCurrent = monthNum === getCurrentMonth();
        let cls = "month-btn";
        if (isActive) cls += " active";
        else if (isCurrent) cls += " current";
        return (
          <button key={monthNum} className={cls} onClick={() => setSelectedMonth(monthNum)}>
            {monthNum}
          </button>
        );
      })}
    </div>

    {/* ---- PAYMENTS TABLE ---- */}
    <div className="table-card">
      <div className="table-card-header">
        <h3>Payment Tracking — Month {selectedMonth}</h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Chit Picked</th>
              <th>Due (M{selectedMonth})</th>
              <th>Status</th>
              <th>Short Payment</th>
              <th>Total Due</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const prevMonthDue = selectedMonth > 1 ? getMemberDueAmount(m, selectedMonth - 1) : 0;
              const rowClass = prevMonthDue > 0 ? "prev-due" : "";
              const showBadge = prevMonthDue > 0;
              const isPaid = Boolean(m.payments?.[selectedMonth]?.paid);
              let statusClass = isPaid ? "paid" : "unpaid";
              if (m.id === getCurrentReceiverId()) statusClass = "receiver";

              return (
                <tr key={m.id} className={`${rowClass} ${statusClass}`}>
                  <td><strong>{m.id}</strong></td>
                  <td style={{ textAlign: "left", fontWeight: 500 }}>{m.name}</td>
                  <td style={{ fontSize: "0.85em" }}>
                    {m.phone ? (
                      <a
                        href={`tel:${m.phone}`}
                        style={{ color: "var(--text-muted)", textDecoration: "underline", textDecorationColor: "var(--border)" }}
                      >
                        {m.phone}
                      </a>
                    ) : "—"}
                  </td>
                  <td>
                    {m.chitMonthPicked ? (
                      <span style={{ fontSize: "0.85em", color: "var(--warning)", fontWeight: 600 }}>
                        Month {m.chitMonthPicked}
                      </span>
                    ) : !alreadyPicked ? (
                      <button
                        className="action-button btn-pick-now"
                        onClick={() => assignChitMonth(m, selectedMonth)}
                      >
                        Pick Now
                      </button>
                    ) : "—"}
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{getMemberPaymentAmount(m, selectedMonth).toLocaleString()}</td>
                  <td>
                    {(() => {
                      const paymentObj = m.payments?.[selectedMonth] || {};
                      const paid = paymentObj.paid || false;
                      const paidDate = paymentObj.date;

                      if (!paid) {
                        return (
                          <button className="action-button btn-mark-paid" onClick={() => togglePayment(m)}>
                            Mark Paid
                          </button>
                        );
                      }

                      const amount = getMemberPaymentAmount(m, selectedMonth);
                      const waMsg = encodeURIComponent(
                        `Hi ${m.name}, your chit payment for Month ${selectedMonth} (₹${amount.toLocaleString()}) has been received. Thank you! — Chitt Tracker`
                      );
                      const waUrl = `https://wa.me/91${m.phone}?text=${waMsg}`;

                      return (
                        <span className="status-paid">
                          ✓ Paid
                          {paidDate && (
                            <span className="status-paid-date">
                              {new Date(paidDate).toLocaleDateString()}
                            </span>
                          )}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-whatsapp"
                            title="Send WhatsApp confirmation"
                          >
                            💬
                          </a>
                          {paidDate && (Date.now() - new Date(paidDate).getTime() < 3600000) && (
                            <button className="btn-undo" onClick={() => togglePayment(m)}>undo</button>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <input
                      className="short-input"
                      type="number"
                      min="0"
                      value={m.shortPayments?.[selectedMonth] || 0}
                      onChange={(e) => updateShortPayment(m, selectedMonth, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    <strong style={{ color: showBadge ? "var(--danger)" : "var(--text)" }}>
                      ₹{getMemberDueAmount(m, selectedMonth).toLocaleString()}
                    </strong>
                    {showBadge && <span className="due-badge">DUE</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div style={{ marginTop: 16, color: "var(--text-muted)", fontSize: "0.85em", textAlign: "center" }}>
      Note: "Total Due" includes all unpaid months' amounts + accumulated short payments up to Month {selectedMonth}.
    </div>

  </div>
</div>
```

);
}