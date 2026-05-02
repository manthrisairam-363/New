// src/components/Dashboard.js
import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import MemberSetup from "./MemberSetup";

export default function Dashboard({ chitId, onBack }) {

  const TOTAL_MONTHS = 30;
  const BEFORE_AMOUNTS = [
    17700, 17700, 17500, 17500, 17300, 17300, 17100, 17100, 16800, 16800, 16500,
    16500, 16000, 16000, 15500, 15000, 14500, 14000, 13500, 13000, 12500, 12000,
    11500, 11000, 10500, 9500, 9000, 9000, 9000, 19500,
  ];
  const AFTER_AMOUNT = 19500;

  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingMembers, setEditingMembers] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // ---- TOAST ----
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
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
  const configDocRef = doc(db, `chit-${chitId}-config`, "settings");

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const mSnap = await getDocs(membersCol);
        let mList = [];
        mSnap.forEach((d) => mList.push(d.data()));

        if (mList.length === 0) {
          // No members yet  -  MemberSetup will handle creation
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
          setMembers(mList); // if all were placeholders, mList=[] -> setup screen shows
        }

        const cSnap = await getDoc(configDocRef);
        let cdata;
        if (!cSnap.exists()) {
          cdata = { currentMonth: 1, currentReceiver: 1 };
          await setDoc(configDocRef, cdata);
        } else {
          cdata = cSnap.data();

          // Auto-calculate current month from start date if available
          if (cdata.startMonth && cdata.startYear) {
            const today = new Date();
            const diff = (today.getFullYear() - cdata.startYear) * 12
              + (today.getMonth() + 1 - cdata.startMonth) + 1;
            cdata.currentMonth = Math.min(Math.max(1, diff), TOTAL_MONTHS);
          }

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
  }, [chitId]);

  const getCurrentMonth = () => config?.currentMonth || 1;
  const getCurrentReceiverId = () => config?.currentReceiver || 1;

  // Convert month number to calendar month name + year
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const getMonthLabel = (monthNum) => {
    if (!config?.startMonth || !config?.startYear) return `Month ${monthNum}`;
    const totalMonths = config.startMonth - 1 + monthNum - 1;
    const year = config.startYear + Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    return `${MONTH_NAMES[month]} ${year}`;
  };

  const getMonthShort = (monthNum) => {
    if (!config?.startMonth || !config?.startYear) return String(monthNum);
    const totalMonths = config.startMonth - 1 + monthNum - 1;
    const year = config.startYear + Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    return `${MONTH_NAMES[month]}'${String(year).slice(2)}`;
  };

  // Get correct payment date for a past month
  const getPaymentDateForMonth = (monthNum) => {
    if (!config?.startMonth || !config?.startYear) return new Date().toISOString();
    const totalMonths = config.startMonth - 1 + monthNum - 1;
    const year = config.startYear + Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    // Use last day of that month
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    // If the month is in the future, use today; otherwise use last day of that month
    return lastDay > today ? today.toISOString() : lastDay.toISOString();
  };
  const countPaidForMonth = (month) =>
    members.filter((m) => m.payments?.[month]?.paid).length;

  const getMemberPaymentAmount = (member, currMonth) => {
    if (member.chitMonthPicked && currMonth >= member.chitMonthPicked) {
      return AFTER_AMOUNT;
    }
    return BEFORE_AMOUNTS[currMonth - 1] || AFTER_AMOUNT;
  };

  // ---- TOGGLE PAYMENT (FIXED: only marks the selected month) ----
  const togglePayment = async (member) => {
    try {
      const month = selectedMonth;
      const payments = { ...member.payments };
      const isCurrentlyPaid = payments[month]?.paid || false;

      if (!isCurrentlyPaid) {
        // Mark ALL unpaid months up to selected month as paid on this date
        // This handles members who settle multiple months at once
        for (let m = 1; m <= month; m++) {
          if (!payments[m]?.paid) {
            payments[m] = { paid: true, date: getPaymentDateForMonth(m) };
          }
        }
      } else {
        // Undo: only unmark the selected month, leave other months intact
        payments[month] = { paid: false, date: null };
      }

      const updatedMember = { ...member, payments };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      const newMembers = members.map((p) => (p.id === member.id ? updatedMember : p));
      setMembers(newMembers);
      updateOverviewSummary(newMembers, config);

      showToast(
        isCurrentlyPaid
          ? `${member.name} - Month ${month} marked unpaid`
          : `${member.name} - all dues cleared up to Month ${month}`
      );
    } catch (err) {
      console.error("togglePayment error:", err);
      showToast("Failed to update payment", "error");
    }
  };

  // ---- UPDATE OVERVIEW SUMMARY (so ChitOverview loads fast) ----
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
      // Non-critical  -  overview will still work, just may show stale data
      console.error("Summary update failed:", err);
    }
  };

  const updateShortPayment = async (member, month, amount) => {
    try {
      const updatedShortPayments = { ...member.shortPayments, [month]: amount };
      const updatedMember = { ...member, shortPayments: updatedShortPayments };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );
    } catch (error) {
      console.error("Failed to update short payment:", error);
    }
  };

  const assignChitMonth = async (member, month) => {
    const alreadyPicked = members.some((m) => m.chitMonthPicked === month);
    if (alreadyPicked) {
      showToast(`Another member already picked chit for month ${month}`, "error");
      return;
    }
    try {
      const updatedMember = {
        ...member,
        chitMonthPicked: month,
        chitPickDate: new Date().toISOString(),
      };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );
      showToast(`${member.name} picked chit for Month ${month} (ok)`);
    } catch (err) {
      console.error("assignChitMonth error:", err);
    }
  };

  const unassignChitMonth = async (member) => {
    try {
      const updatedMember = { ...member, chitMonthPicked: null, chitPickDate: null };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );
      showToast(`${member.name} pick undone`);
    } catch (err) {
      console.error("unassignChitMonth error:", err);
    }
  };



  if (loading || selectedMonth === null)
    return <div style={{ padding: 20, textAlign: "center" }}>Loading...</div>;

  // ---- SHOW MEMBER SETUP if no members yet ----
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
              ...mm,
              name: mm.name || `Member ${mm.id}`,
              phone: mm.phone || "",
              chitMonthPicked: typeof mm.chitMonthPicked === "number" ? mm.chitMonthPicked : null,
              payments: mm.payments || {},
              shortPayments: mm.shortPayments || {},
            }));
            list.sort((a, b) => a.id - b.id);
            setMembers(list);
            setLoading(false);
            showToast("Members saved successfully (ok)");
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

  // Total outstanding across ALL months up to current
  const totalOutstanding = members.reduce(
    (sum, m) => sum + getMemberDueAmount(m, selectedMonth), 0
  );

  // Receiver: only show name if someone actually picked this month
  const pickedThisMonth = members.find((m) => m.chitMonthPicked === selectedMonth);
  const receiverDisplay = pickedThisMonth ? pickedThisMonth.name : null;

  return (
    <div className="dashboard">

      {/* ---- TOAST ---- */}
      {toast && (
        <div className={`toast ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* ---- STICKY TOP BAR ---- */}}
      <div className="db-topbar">
        <button className="db-back-btn" onClick={onBack}>
          Back to Overview
        </button>
        <h2 className="db-title">Chit {chitId} - Dashboard</h2>
        <button
          className={`db-edit-btn ${selectedMonth === 1 ? "prominent" : "subtle"}`}
          onClick={() => setEditingMembers(true)}
        >
          {selectedMonth === 1 ? "Set Up / Edit Members" : "Edit Members"}
        </button>
      </div>

      <div className="db-body">

        {/* ---- SUMMARY CARDS (4 cards) ---- */}
        <div className="summary-container">
          <div className="summary">
            <div className="summary-card">
              <small>Month Status</small>
              <strong style={{ fontSize: "1.3em" }}>{getMonthLabel(selectedMonth)}</strong>
              <span className="sub">Paid: {paidCount} / Unpaid: {members.length - paidCount}</span>
              {receiverDisplay && (
                <span className="sub" style={{ marginTop: 4, display: "block", color: "#4F46E5", fontWeight: 700, fontSize: "1em" }}>
                  Receiver: {receiverDisplay}
                </span>
              )}
            </div>
            <div className="summary-card">
              <small>Collected This Month</small>
              <strong style={{ color: "var(--success)" }}>Rs.{collected.toLocaleString()}</strong>
              <span className="sub">Expected: Rs.{totalPerMonth.toLocaleString()}</span>
            </div>
            <div className="summary-card pending-card">
              <small>Pending This Month</small>
              <strong style={{ color: "var(--danger)" }}>Rs.{pending.toLocaleString()}</strong>
              <span className="sub">Current month only</span>
            </div>
            <div className="summary-card" style={{ background: "#FFF1F2", border: "1px solid #FECDD3" }}>
              <small style={{ color: "#9F1239" }}>Total Outstanding</small>
              <strong style={{ color: "#BE123C" }}>Rs.{totalOutstanding.toLocaleString()}</strong>
              <span className="sub">All months combined</span>
            </div>
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
              <button key={monthNum} className={cls} onClick={() => setSelectedMonth(monthNum)} title={getMonthLabel(monthNum)}>
                {getMonthShort(monthNum)}
              </button>
            );
          })}
        </div>

        {/* ---- PAYMENTS TABLE ---- */}
        <div className="table-card">
          <div className="table-card-header">
            <h3>Payment Tracking - {getMonthLabel(selectedMonth)}</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Chit Picked</th>
                  <th>Due</th>
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
                        ) : " - "}
                      </td>
                      <td>
                        {m.chitMonthPicked ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "0.85em", color: "#D97706", fontWeight: 600 }}>
                              Month {m.chitMonthPicked}
                            </span>
                            {m.chitPickDate && (Date.now() - new Date(m.chitPickDate).getTime() < 7 * 24 * 3600000) && (
                              <button
                                className="btn-undo"
                                onClick={() => unassignChitMonth(m)}
                                title="Undo pick (available for 7 days)"
                              >
                                undo
                              </button>
                            )}
                          </span>
                        ) : !alreadyPicked ? (
                          <button
                            className="action-button btn-pick-now"
                            onClick={() => assignChitMonth(m, selectedMonth)}
                          >
                            Pick Now
                          </button>
                        ) : " - "}
                      </td>
                      <td style={{ fontWeight: 600 }}>Rs.{getMemberPaymentAmount(m, selectedMonth).toLocaleString()}</td>
                      <td>
                        {(() => {
                          const paymentObj = m.payments?.[selectedMonth] || {};
                          const paid = paymentObj.paid || false;
                          const paidDate = paymentObj.date;

                          const amount = getMemberPaymentAmount(m, selectedMonth);
                          const totalDue = getMemberDueAmount(m, selectedMonth);
                          const prevDue = selectedMonth > 1 ? getMemberDueAmount(m, selectedMonth - 1) : 0;
                          const paidDateStr = paidDate ? new Date(paidDate).toLocaleDateString() : '';
                          const waConfirmMsg = encodeURIComponent(
                            `Hi ${m.name}, your chit payment for Month ${selectedMonth} (Rs.${amount.toLocaleString()}) has been received on ${paidDateStr}. Thank you! - Chitt Tracker`
                          );
                          const waReminderMsg = encodeURIComponent(
                            prevDue > 0
                              ? `Hi ${m.name}, your chit payments are pending. Total due: Rs.${totalDue.toLocaleString()} (includes previous unpaid months + Month ${selectedMonth}). Kindly pay at the earliest. Thank you! - Chitt Tracker`
                              : `Hi ${m.name}, your chit payment for Month ${selectedMonth} (Rs.${amount.toLocaleString()}) is pending. Kindly pay at the earliest. Thank you! - Chitt Tracker`
                          );
                          const waBase = `https://wa.me/91${m.phone}?text=`;

                          const WhatsAppIcon = () => (
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.998l6.304-1.453A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.502-5.179-1.381l-.371-.22-3.742.862.892-3.648-.242-.378A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                            </svg>
                          );

                          const BellIcon = () => (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                            </svg>
                          );

                          if (!paid) {
                            return (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button className="action-button btn-mark-paid" onClick={() => togglePayment(m)}>
                                  Mark Paid
                                </button>
                                <a
                                  href={`${waBase}${waReminderMsg}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-reminder"
                                  title="Send payment reminder"
                                >
                                  <BellIcon />
                                </a>
                              </span>
                            );
                          }

                          return (
                            <span className="status-paid">
                              OK Paid
                              {paidDate && (
                                <span className="status-paid-date">
                                  {new Date(paidDate).toLocaleDateString()}
                                </span>
                              )}
                              <a
                                href={`${waBase}${waConfirmMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-whatsapp"
                                title="Send WhatsApp confirmation"
                              >
                                <WhatsAppIcon />
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
                          Rs.{getMemberDueAmount(m, selectedMonth).toLocaleString()}
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
  );
}
