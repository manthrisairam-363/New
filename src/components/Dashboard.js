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

// Calculate due including all partial payments and unpaid logic
const getMemberDueAmount = (member, currMonth) => {
  let due = 0;
  for (let m = 1; m <= currMonth; m++) {
    // Add "short payment" for any month, even if paid, if nonzero
    const shortPayment = member.shortPayments?.[m] || 0;
    due += shortPayment;

    // For UNPAID months, also add the base expected payment
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

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const recognitionRef = useRef(null);

  const membersCol = collection(db, "members");
  const configDocRef = doc(db, "config", "settings");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const mSnap = await getDocs(membersCol);
        let mList = [];
        mSnap.forEach((d) => mList.push(d.data()));
        if (mList.length === 0) {
          const initial = Array.from({ length: TOTAL_MONTHS }, (_, i) => ({
            id: i + 1,
            name: `Member ${i + 1}`,
            chitMonthPicked: null,
            payments: {},
            shortPayments: {},
          }));
          for (const member of initial) {
            await setDoc(doc(db, "members", String(member.id)), member);
          }
          mList = initial;
        } else {
          mList = mList.map((mm) => ({
            ...mm,
            chitMonthPicked:
              typeof mm.chitMonthPicked === "number" ? mm.chitMonthPicked : null,
            payments: mm.payments || {},
            shortPayments: mm.shortPayments || {},
          }));
        }
        mList.sort((a, b) => a.id - b.id);
        setMembers(mList);

        // Load config
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
    };
    fetchAll();
  }, []);

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

const togglePayment = async (member) => {
  try {
    const month = selectedMonth;
    const now = new Date().toISOString();
    const payments = { ...member.payments };

    // Mark all unpaid months up to and including the selected month as paid
    for (let m = 1; m <= month; m++) {
      const paymentObj = payments[m] || {};
      if (!paymentObj.paid) {
        payments[m] = { paid: true, date: now };
      }
    }

    // AUTOMATICALLY CLEAR previous month's short payment if due is now paid
    if (month > 1 && member.shortPayments?.[month-1]) {
      // You can add extra logic to only clear if the right amount is paid
      const updatedShortPayments = { ...member.shortPayments, [month-1]: 0 };
      const updatedMember = { ...member, payments, shortPayments: updatedShortPayments };
      await setDoc(doc(db, "members", String(member.id)), updatedMember);
      setMembers((prev) => prev.map((p) => (p.id === member.id ? updatedMember : p)));
      return;
    }

    const updatedMember = { ...member, payments };
    await setDoc(doc(db, "members", String(member.id)), updatedMember);
    setMembers((prev) => prev.map((p) => (p.id === member.id ? updatedMember : p)));
  } catch (err) {
    console.error("togglePayment error:", err);
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
      await setDoc(doc(db, "members", String(member.id)), updatedMember);
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
      await setDoc(doc(db, "members", String(member.id)), updatedMember);
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
        await setDoc(doc(db, "members", String(m.id)), {
          payments: updatedPayments,
        });
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
  const collected = members.reduce(
    (sum, m) =>
      sum +
      (m.payments?.[selectedMonth]
        ? getMemberPaymentAmount(m, selectedMonth)
        : 0),
    0
  );
  const pending = totalPerMonth - collected;
  const alreadyPicked = members.some(
    (m) => m.chitMonthPicked === selectedMonth
  );

  return (
    <div className="dashboard" style={{ padding: 20 }}>
      <h2>Chitt Tracker Dashboard</h2>
      <button
        className={`voice-btn${listening ? " active" : ""}`}
        onClick={startVoiceRecognition}
        disabled={listening}
        style={{ marginBottom: 16 }}
      >
        {listening ? "Listening..." : "Voice Update"}
      </button>
      {voiceText && (
        <div className="voice-text" style={{ marginBottom: 8 }}>
          Heard: "{voiceText}"
        </div>
      )}
      <div className="summary">
        <p>
          <b>Month:</b> {selectedMonth} &nbsp;|&nbsp; <b>Total Members:</b> {members.length} &nbsp;|&nbsp;
          <b>Paid:</b> {paidCount} &nbsp;|&nbsp; <b>Unpaid:</b> {members.length - paidCount}
        </p>
        <p>
          <b>This Month’s Receiver:</b> Member {getCurrentReceiverId()} &nbsp;|&nbsp; Chit Amount: ₹{getChitAmount(selectedMonth).toLocaleString()}
        </p>
        <div style={{ marginTop: 8 }}>
          <button onClick={advanceMonth} style={{ marginRight: 8 }}>
            Advance Month (manual)
          </button>
          <button onClick={resetThisMonth} style={{ marginRight: 8 }}>
            Reset This Month (mark all unpaid)
          </button>
        </div>
      </div>
      <div className="amount-summary" style={{ marginTop: 12 }}>
        <p>
          <b>Total Amount Per Month:</b> ₹{totalPerMonth.toLocaleString()}
        </p>
        <p>
          <b>Collected This Month:</b> ₹{collected.toLocaleString()}
        </p>
        <p>
          <b>Pending Collection:</b> ₹{pending.toLocaleString()}
        </p>
      </div>
      {/* Months Selector */}
      <div
        className="months-bar"
        style={{ marginBottom: 24, textAlign: "center" }}
      >
        {[...Array(TOTAL_MONTHS)].map((_, i) => (
          <button
            key={i + 1}
            style={{
              margin: "2px",
              fontWeight: selectedMonth === i + 1 ? "bold" : "",
              background: selectedMonth === i + 1 ? "#007bff" : "#eee",
              color: selectedMonth === i + 1 ? "white" : "black",
              borderRadius: 4,
              padding: "3px 10px",
            }}
            onClick={() => setSelectedMonth(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 18 }}>Members</h3>
      <table className="members-table">
        <thead>
          <tr>
            <th>Member ID</th>
            <th>Name</th>
            <th>Picked Month</th>
            <th>Payment for Month {selectedMonth}</th>
            <th>Status (Month {selectedMonth})</th>
            <th>Short Payment</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
  {members.map((m) => {
    const prevMonthDue = selectedMonth > 1 ? getMemberDueAmount(m, selectedMonth - 1) : 0;
    const rowClass = prevMonthDue > 0 ? "prev-due" : "";
    const showBadge = prevMonthDue > 0;
    const isPaid = Boolean(m.payments?.[selectedMonth]);
    return (
      <tr
        key={m.id}
        className={`${rowClass} ${m.id === getCurrentReceiverId() ? "receiver" : isPaid ? "paid" : "unpaid"}`}
      >
        <td>{m.id}</td>
        <td>{m.name}</td>
        <td>
          {m.chitMonthPicked
            ? `Month ${m.chitMonthPicked}`
            : !alreadyPicked ? (
                <button onClick={() => assignChitMonth(m, selectedMonth)}>
                  Pick Now ({selectedMonth})
                </button>
              ) : (
                "-"
              )}
        </td>
        <td>
          ₹{getMemberPaymentAmount(m, selectedMonth).toLocaleString()}
        </td>
<td>
  {
    (() => {
      const paymentObj = m.payments?.[selectedMonth] || {};
      const paid = paymentObj.paid || false;
      const paidDate = paymentObj.date;
      return !paid ? (
        <button onClick={() => togglePayment(m)}>
          Mark Paid
        </button>
      ) : (
        <>
          ✅ Paid
          {paidDate && (
            <span style={{
              marginLeft: 6,
              color: "#888",
              fontWeight: "normal",
              fontSize: "0.85em"
            }}>
              ({new Date(paidDate).toLocaleString()})
            </span>
          )}
        </>
      );
    })()
  }
</td>

        <td>
          <input
            type="number"
            min="0"
            value={m.shortPayments?.[selectedMonth] || 0}
            onChange={e =>
              updateShortPayment(m, selectedMonth, parseFloat(e.target.value) || 0)
            }
            style={{ width: 80 }}
          />
        </td>
        <td>
          ₹{getMemberDueAmount(m, selectedMonth).toLocaleString()}
          {showBadge && (
            <span className="due-badge">
              DUE! ⚠️
            </span>
          )}
        </td>
      </tr>
    );
  })}
</tbody>

      </table>
      <div style={{ marginTop: 20, color: "#555" }}>
        <small>
          Only one member can pick chit in a month. All members pay only that
          month's value from your scheme until they pick chit.
          <br />
          The "Pick Now" button will disappear after a member is picked for
          this month.
        </small>
      </div>
    </div>
  );
}
