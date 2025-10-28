// src/components/Dashboard.js
import React, { useEffect, useState, useRef } from "react";
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

  const MEMBER_NAMES = [
    "Sairam", "Arun", "Adhvaith", "Apoorva", "ramu",
    "Member 6", "Member 7", "Member 8", "Member 9", "Member 10",
    "Member 11", "Member 12", "Member 13", "Member 14", "Member 15",
    "Member 16", "Member 17", "Member 18", "Member 19", "Member 20",
    "Member 21", "Member 22", "Member 23", "Member 24", "Member 25",
    "Member 26", "Member 27", "Member 28", "Member 29", "Member 30"
  ];

  const MEMBER_PHONES = [
    "9533126221", "9876543002", "9876543003", "9876543004", "9876543005",
    "9876543006", "9876543007", "9876543008", "9876543009", "9876543010",
    "9876543011", "9876543012", "9876543013", "9876543014", "9876543015",
    "9876543016", "9876543017", "9876543018", "9876543019", "9876543020",
    "9876543021", "9876543022", "9876543023", "9876543024", "9876543025",
    "9876543026", "9876543027", "9876543028", "9876543029", "9876543030"
  ];

  const getMemberDueAmount = (member, currMonth) => {
    let due = 0;
    for (let m = 1; m <= currMonth; m++) {
      const shortPayment = member.shortPayments?.[m] || 0;
      due += shortPayment;
      if (!member.payments?.[m]) {
        if (member.chitMonthPicked && m >= member.chitMonthPicked) {
          due += AFTER_AMOUNT;
        } else {
          due += BEFORE_AMOUNTS[m - 1] || AFTER_AMOUNT;
        }
      }
    }
    return due;
  };

  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const recognitionRef = useRef(null);

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
          const initial = Array.from({ length: TOTAL_MONTHS }, (_, i) => ({
            id: i + 1,
            name: MEMBER_NAMES[i] || `Member ${i + 1}`,
            phone: MEMBER_PHONES[i] || "",
            chitMonthPicked: null,
            payments: {},
            shortPayments: {},
          }));
          for (const member of initial) {
            // Write to chit-{chitId}-members
            await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), member);
          }
          mList = initial;
        } else {
          mList = mList.map((mm, idx) => ({
            ...mm,
            name: mm.name || MEMBER_NAMES[idx] || `Member ${idx + 1}`,
            phone: mm.phone || MEMBER_PHONES[idx] || "",
            chitMonthPicked:
              typeof mm.chitMonthPicked === "number" ? mm.chitMonthPicked : null,
            payments: mm.payments || {},
            shortPayments: mm.shortPayments || {},
          }));
        }
        mList.sort((a, b) => a.id - b.id);
        setMembers(mList);

        const cSnap = await getDoc(configDocRef);
        let cdata;
        if (!cSnap.exists()) {
          cdata = {
            currentMonth: 1,
            currentReceiver: 1,
          };
          await setDoc(configDocRef, cdata);
        } else {
          cdata = cSnap.data();
          if (
            !cdata.currentMonth ||
            cdata.currentMonth < 1 ||
            cdata.currentMonth > TOTAL_MONTHS
          ) {
            cdata.currentMonth = 1;
          }
          if (
            !cdata.currentReceiver ||
            cdata.currentReceiver < 1 ||
            cdata.currentReceiver > mList.length
          ) {
            cdata.currentReceiver = 1;
          }
          await updateDoc(configDocRef, {
            currentMonth: cdata.currentMonth,
            currentReceiver: cdata.currentReceiver,
          });
        }
        setConfig(cdata);
        setSelectedMonth(cdata.currentMonth || 1);
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
  const getChitAmount = (month) => CHIT_AMOUNTS[month - 1] || CHIT_AMOUNTS[0];
  const countPaidForMonth = (month) =>
    members.filter((m) => m.payments?.[month]).length;

  const getMemberPaymentAmount = (member, currMonth) => {
    if (member.chitMonthPicked && currMonth >= member.chitMonthPicked) {
      return AFTER_AMOUNT;
    }
    return BEFORE_AMOUNTS[currMonth - 1] || AFTER_AMOUNT;
  };

// ---- TOGGLE PAYMENT ----
const togglePayment = async (member) => {
  try {
    const month = selectedMonth;
    const now = new Date().toISOString();
    const payments = { ...member.payments };

    // Mark all months up to selectedMonth as paid
    for (let m = 1; m <= month; m++) {
      const paymentObj = payments[m] || {};
      if (!paymentObj.paid) {
        payments[m] = { paid: true, date: now };
      }
    }

    // Handle short payment correction
    if (month > 1 && member.shortPayments?.[month - 1]) {
      const updatedShortPayments = { ...member.shortPayments, [month - 1]: 0 };
      const updatedMember = {
        ...member,
        payments,
        shortPayments: updatedShortPayments,
      };

      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );

      // ✅ Send WhatsApp notification after short payment fix
      await sendWhatsappNotification(
        updatedMember.phone,
        `Hi ${updatedMember.name}, your pending chit short payment has been cleared for Month ${selectedMonth}. ✅`
      );

      return;
    }

    // Normal monthly payment update
    const updatedMember = { ...member, payments };
    await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
    setMembers((prev) =>
      prev.map((p) => (p.id === member.id ? updatedMember : p))
    );

    // ✅ Send WhatsApp notification after normal payment update
    await sendWhatsappNotification(
      updatedMember.phone,
      `Hi ${updatedMember.name}, your chit payment for Month ${selectedMonth} is marked as PAID. ✅`
    );
  } catch (err) {
    console.error("togglePayment error:", err);
  }
};

// ---- WHATSAPP NOTIFICATION ----
const sendWhatsappNotification = async (member) => {
  try {
    const response = await fetch("https://new-production-ffd2.up.railway.app/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: member.phone,
        message: `Your chit payment for Month ${selectedMonth} is marked as paid. Thank you, ${member.name}!`
      }),
    });

    const data = await response.json();
    console.log("✅ WhatsApp response:", data);
  } catch (error) {
    console.error("❌ WhatsApp notification error:", error);
  }
};

  const updateShortPayment = async (member, month, amount) => {
    try {
      const updatedShortPayments = {
        ...member.shortPayments,
        [month]: amount,
      };
      const updatedMember = {
        ...member,
        shortPayments: updatedShortPayments,
      };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );
    } catch (error) {
      console.error("Failed to update short payment,", error);
    }
  };

  const assignChitMonth = async (member, month) => {
    const alreadyPicked = members.some((m) => m.chitMonthPicked === month);
    if (alreadyPicked) {
      alert(`A member has already picked chit for month ${month}.`);
      return;
    }
    try {
      const updatedMember = { ...member, chitMonthPicked: month };
      await setDoc(doc(db, `chit-${chitId}-members`, String(member.id)), updatedMember);
      setMembers((prev) =>
        prev.map((p) => (p.id === member.id ? updatedMember : p))
      );
      alert(`Member ${member.id} picked chit in month ${month}.`);
    } catch (err) {
      console.error("assignChitMonth error:", err);
    }
  };

  const advanceMonth = async () => {
    if (!config) return;
    const currMonth = getCurrentMonth();
    if (currMonth >= TOTAL_MONTHS) {
      alert(`All ${TOTAL_MONTHS} months completed.`);
      return;
    }
    try {
      const nextMonth = currMonth + 1;
      const nextReceiver =
        getCurrentReceiverId() >= members.length
          ? 1
          : getCurrentReceiverId() + 1;
      await updateDoc(configDocRef, {
        currentMonth: nextMonth,
        currentReceiver: nextReceiver,
      });
      setConfig((prev) => ({
        ...prev,
        currentMonth: nextMonth,
        currentReceiver: nextReceiver,
      }));
      setSelectedMonth(nextMonth);
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          payments: { ...m.payments, [nextMonth]: false },
        }))
      );
    } catch (err) {
      alert("Failed to advance month.");
    }
  };

  const resetThisMonth = async () => {
    const month = selectedMonth;
    try {
      for (const m of members) {
        const updatedPayments = { ...m.payments, [month]: false };
        const updatedMember = { ...m, payments: updatedPayments };
        await setDoc(doc(db, `chit-${chitId}-members`, String(m.id)), updatedMember);
      }
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          payments: { ...m.payments, [month]: false },
        }))
      );
      alert(`All payments for month ${month} set to unpaid.`);
    } catch (err) {
      alert("Reset failed.");
    }
  };

  const startVoiceRecognition = () => {
    if (!window.webkitSpeechRecognition) {
      alert("Voice API only supported in Chrome.");
      return;
    }
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.onresult = async (event) => {
      const spoken = event.results[0][0].transcript;
      setVoiceText(spoken);
      const match = spoken.match(/member\s*(\d+)\s*(mark\s)?paid/i);
      if (match) {
        const memberId = Number(match[1]);
        const member = members.find((m) => m.id === memberId);
        if (member) await togglePayment(member);
      }
      setListening(false);
    };
    recognitionRef.current.onend = () => setListening(false);
    recognitionRef.current.start();
    setListening(true);
  };

  if (loading || selectedMonth === null)
    return <div style={{ padding: 20 }}>Loading...</div>;

  const paidCount = countPaidForMonth(selectedMonth);

  const totalPerMonth = members.reduce(
    (sum, m) => sum + getMemberPaymentAmount(m, selectedMonth),
    0
  );

const collected = members.reduce((sum, m) => {
  const paid = m.payments?.[selectedMonth]?.paid || false;
  // Only count if 'Mark Paid' was done
  if (paid) {
    const expected = getMemberPaymentAmount(m, selectedMonth);
    const short = m.shortPayments?.[selectedMonth] || 0;
    // Don't allow negative collected, so max(0, ...)
    return sum + Math.max(0, expected - short);
  }
  return sum;
}, 0);
  const pending = totalPerMonth - collected;
  const alreadyPicked = members.some(
    (m) => m.chitMonthPicked === selectedMonth
  );

  return (
    <div className="dashboard">
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: "#6c757d",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            marginBottom: "10px",
          }}
        >
          ← Back to Overview
        </button>
        <h2>Chit {chitId} Tracker Dashboard</h2>
      </div>
      {/* Voice Input Section */}
      <button
        className={`voice-btn${listening ? " active" : ""}`}
        onClick={startVoiceRecognition}
        disabled={listening}
      >
        {listening ? "Listening..." : "Voice Update"}
      </button>
      {voiceText && (
        <div className="voice-text">
          Heard: "{voiceText}"
        </div>
      )}

      {/* Summary Card Container */}
      <div className="summary-container">
        <div className="summary">
          <div className="summary-card">
            <small style={{ color: "#007bff" }}>Current Month Status</small>
            <strong>Month: {selectedMonth}</strong>
            <small>
              Paid: {paidCount} / Unpaid: {members.length - paidCount}
            </small>
          </div>

          <div className="summary-card">
            <small style={{ color: "#28a745" }}>Collected This Month</small>
            <strong>₹{collected.toLocaleString()}</strong>
            <small>Total Expected: ₹{totalPerMonth.toLocaleString()}</small>
          </div>

          <div className="summary-card" style={{ background: "#fff3cd" }}>
            <small style={{ color: "#dc3545" }}>Pending Collection</small>
            <strong style={{ color: "#dc3545" }}>
              ₹{pending.toLocaleString()}
            </strong>
            <small>Due in current month</small>
          </div>

          <div className="summary-card">
            <small style={{ color: "#6c757d" }}>Current Receiver</small>
            <strong>Member {getCurrentReceiverId()}</strong>
            <small>
              Chit Value: ₹{getChitAmount(selectedMonth).toLocaleString()}
            </small>
          </div>
        </div>

        {/* Admin Actions */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 10,
            borderTop: "1px solid #eee",
          }}
        >
          <button
            className="action-button"
            onClick={advanceMonth}
            style={{ marginRight: 10, backgroundColor: "#ffc107" }}
          >
            Advance to Month {getCurrentMonth() + 1}
          </button>
          <button
            className="action-button"
            onClick={resetThisMonth}
            style={{ backgroundColor: "#dc3545" }}
          >
            Reset Month {selectedMonth} Payments
          </button>
        </div>
      </div>

      {/* Months Selector */}
      <div
        className="months-bar"
        style={{ marginBottom: 24, textAlign: "center" }}
      >
        {[...Array(TOTAL_MONTHS)].map((_, i) => (
          <button
            key={i + 1}
            onClick={() => setSelectedMonth(i + 1)}
            style={{
              margin: "2px",
              fontWeight: selectedMonth === i + 1 ? "bold" : "normal",
              background: selectedMonth === i + 1 ? "#007bff" : "#e9ecef",
              color: selectedMonth === i + 1 ? "white" : "#495057",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Main Data Table Card */}
      <div className="table-card">
        <h3 style={{ marginTop: 0, marginBottom: 20, textAlign: "left" }}>
          Payment Tracking for Month {selectedMonth}
        </h3>

        <table className="members-table">
          <thead>
            <tr>
              <th>Member ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Picked Month</th>
              <th>Payment Due (M{selectedMonth})</th>
              <th>Status</th>
              <th>Short Payment</th>
              <th>Total Due</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const prevMonthDue =
                selectedMonth > 1
                  ? getMemberDueAmount(m, selectedMonth - 1)
                  : 0;
              const rowClass = prevMonthDue > 0 ? "prev-due" : "";
              const showBadge = prevMonthDue > 0;
              const isPaid = Boolean(m.payments?.[selectedMonth]);

              let statusClass = isPaid ? "paid" : "unpaid";
              if (m.id === getCurrentReceiverId()) {
                statusClass = "receiver";
              }

              return (
                <tr
                  key={m.id}
                  className={`${rowClass} ${statusClass}`}
                >
                  <td>{m.id}</td>
                  <td>{m.name}</td>
                  <td>{m.phone}</td>
                  <td>
                    {m.chitMonthPicked ? (
                      `Month ${m.chitMonthPicked}`
                    ) : !alreadyPicked ? (
                      <button
                        className="action-button"
                        onClick={() => assignChitMonth(m, selectedMonth)}
                      >
                        Pick Now
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    ₹{getMemberPaymentAmount(m, selectedMonth).toLocaleString()}
                  </td>
                  <td>
                    {(() => {
                      const paymentObj = m.payments?.[selectedMonth] || {};
                      const paid = paymentObj.paid || false;
                      const paidDate = paymentObj.date;
                      return !paid ? (
                        <button
                          className="action-button"
                          style={{ backgroundColor: "#00cc66" }}
                          onClick={() => togglePayment(m)}
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <>
                          ✅ Paid
                          {paidDate && (
                            <span
                              style={{
                                marginLeft: 6,
                                color: "#6c757d",
                                fontWeight: "normal",
                                fontSize: "0.85em",
                              }}
                            >
                              ({new Date(paidDate).toLocaleDateString()})
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={m.shortPayments?.[selectedMonth] || 0}
                      onChange={(e) =>
                        updateShortPayment(
                          m,
                          selectedMonth,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      style={{
                        width: 80,
                        padding: 5,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                      }}
                    />
                  </td>
                  <td>
                    <strong style={{ color: showBadge ? "#dc3545" : "#333" }}>
                      ₹{getMemberDueAmount(m, selectedMonth).toLocaleString()}
                    </strong>
                    {showBadge && <span className="due-badge">DUE!</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 20, color: "#6c757d", fontSize: "0.9em" }}>
        <small>
          **Important Note:** The "Total Due" column includes any unpaid months'
          amounts *plus* accumulated short payments up to the selected month.
        </small>
      </div>
    </div>
  );
}
