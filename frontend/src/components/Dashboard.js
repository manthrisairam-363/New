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
import MemberHistory from "./MemberHistory";

export default function Dashboard({ chitId, onBack, user, onLogout }) {

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
  const [selectedMember, setSelectedMember] = useState(null);
  const [reportHtml, setReportHtml] = useState(null);
  const [settingStartDate, setSettingStartDate] = useState(false);
  const [startDateInput, setStartDateInput] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
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
        // Mark ALL unpaid months up to selected month as paid
        // date = actual payment date for that month (for WhatsApp message)
        // markedAt = when user clicked Mark Paid (for undo 1-hour window)
        // Use today as payment date for ALL months being paid now
        // They came in today and paid everything - today is the correct date
        const todayISO = new Date().toISOString();
        for (let m = 1; m <= month; m++) {
          if (!payments[m]?.paid) {
            payments[m] = {
              paid: true,
              date: todayISO,   // when they actually paid
              markedAt: todayISO, // same - for undo window
            };
          }
        }
      } else {
        // Undo: only unmark the selected month
        payments[month] = { paid: false, date: null, markedAt: null };
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

  const saveStartDate = async () => {
    try {
      const sm = startDateInput.month;
      const sy = startDateInput.year;
      const today = new Date();
      const diff = (today.getFullYear() - sy) * 12 + (today.getMonth() + 1 - sm) + 1;
      const currentMonth = Math.min(Math.max(1, diff), TOTAL_MONTHS);
      await updateDoc(configDocRef, { startMonth: sm, startYear: sy, currentMonth });
      setConfig(prev => ({ ...prev, startMonth: sm, startYear: sy, currentMonth }));
      setSelectedMonth(currentMonth);
      setSettingStartDate(false);
      showToast("Start date saved! Month names updated.");
    } catch (err) {
      showToast("Failed to save start date", "error");
    }
  };

  // ---- GENERATE PDF REPORT ----
  const generateReport = () => {
    const monthLabel = getMonthLabel(selectedMonth);
    const chitName = config?.chitName || `Chit ${chitId}`;
    const today = new Date().toLocaleDateString();

    const rows = members.map((m, idx) => {
      const paid = m.payments?.[selectedMonth]?.paid || false;
      const paidDate = m.payments?.[selectedMonth]?.date;
      const amount = getMemberPaymentAmount(m, selectedMonth);
      const totalDue = getMemberDueAmount(m, selectedMonth);
      const short = m.shortPayments?.[selectedMonth] || 0;
      const receiver = m.chitMonthPicked ? `Month ${m.chitMonthPicked}` : "-";
      const statusColor = paid ? "#059669" : "#DC2626";
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
      return `
        <tr style="background:${rowBg}">
          <td>${m.id}</td>
          <td style="font-weight:600">${m.name}</td>
          <td>${m.phone || "-"}</td>
          <td>${receiver}</td>
          <td>Rs.${amount.toLocaleString()}</td>
          <td style="color:${statusColor};font-weight:700">${paid ? "Paid" : "Pending"}</td>
          <td>${paid && paidDate ? new Date(paidDate).toLocaleDateString() : "-"}</td>
          <td style="color:${totalDue > 0 ? "#DC2626" : "#059669"};font-weight:600">Rs.${totalDue.toLocaleString()}</td>
          <td>${short > 0 ? "Rs." + short.toLocaleString() : "-"}</td>
        </tr>`;
    }).join("");

    const totalCollected = members.reduce((sum, m) => {
      if (!m.payments?.[selectedMonth]?.paid) return sum;
      let memberTotal = 0;
      for (let mo = 1; mo <= selectedMonth; mo++) {
        if (m.payments?.[mo]?.paid) memberTotal += getMemberPaymentAmount(m, mo);
      }
      return sum + memberTotal;
    }, 0);
    const totalPending = members.reduce((sum, m) => {
      if (m.payments?.[selectedMonth]?.paid) return sum;
      return sum + getMemberDueAmount(m, selectedMonth);
    }, 0);
    const paidCount = members.filter(m => m.payments?.[selectedMonth]?.paid).length;
    const receiver = members.find(m => m.chitMonthPicked === selectedMonth);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${chitName} - ${monthLabel} Report</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1E1B4B; padding-bottom: 16px; }
    .logo { font-size: 28px; font-weight: 900; color: #1E1B4B; }
    .logo span { color: #F59E0B; }
    .report-meta { text-align: right; }
    .report-meta h2 { font-size: 16px; font-weight: 700; color: #1E1B4B; }
    .report-meta p { font-size: 11px; color: #6b7280; margin-top: 3px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; }
    .summary-box { flex: 1; background: #f8faff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
    .summary-box .val { font-size: 18px; font-weight: 800; color: #1E1B4B; }
    .summary-box .lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-top: 3px; letter-spacing: 0.05em; }
    .summary-box.green .val { color: #059669; }
    .summary-box.red .val { color: #DC2626; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1E1B4B; }
    th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #C7D2FE; }
    td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    @media print { body { padding: 16px; } }
    @media (max-width: 600px) {
      body { padding: 12px; font-size: 11px; }
      .header { flex-direction: column; gap: 10px; }
      .report-meta { text-align: left; }
      .summary { flex-wrap: wrap; }
      .summary-box { flex: 1 1 45%; }
      .logo { font-size: 20px; }
      th { padding: 7px 6px; font-size: 9px; }
      td { padding: 7px 6px; font-size: 11px; }
      th:nth-child(3), td:nth-child(3),
      th:nth-child(9), td:nth-child(9) { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Chitt<span>Tracker</span></div>
    <div class="report-meta">
      <h2>${chitName} - ${monthLabel} Collection Report</h2>
      <p>Generated on ${today}</p>
      ${receiver ? `<p>Chit Receiver: <strong>${receiver.name}</strong></p>` : ""}
    </div>
  </div>

  <div class="summary">
    <div class="summary-box">
      <div class="val">${paidCount} / ${members.length}</div>
      <div class="lbl">Members Paid</div>
    </div>
    <div class="summary-box green">
      <div class="val">Rs.${totalCollected.toLocaleString()}</div>
      <div class="lbl">Total Collected</div>
    </div>
    <div class="summary-box red">
      <div class="val">Rs.${totalPending.toLocaleString()}</div>
      <div class="lbl">Total Pending</div>
    </div>
    <div class="summary-box">
      <div class="val">Rs.${(totalCollected + totalPending).toLocaleString()}</div>
      <div class="lbl">Total Expected</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Phone</th><th>Chit Picked</th>
        <th>Amount</th><th>Status</th><th>Paid On</th><th>Total Due</th><th>Short Paid</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    ChittTracker - Chit Fund Management App &nbsp;|&nbsp; ${chitName} &nbsp;|&nbsp; ${monthLabel} &nbsp;|&nbsp; Generated ${today}
  </div>
</body>
</html>`;

    setReportHtml(html);
  };

  // ---- SEND ALL REMINDERS ----
  const sendAllReminders = () => {
    const unpaidMembers = members.filter(
      (m) => !(m.payments?.[selectedMonth]?.paid) && m.phone
    );
    if (unpaidMembers.length === 0) {
      showToast("All members have paid this month!", "success");
      return;
    }
    // Open WhatsApp for each unpaid member one by one
    unpaidMembers.forEach((m, idx) => {
      const amount = getMemberPaymentAmount(m, selectedMonth);
      const totalDue = getMemberDueAmount(m, selectedMonth);
      const prevDue = selectedMonth > 1 ? getMemberDueAmount(m, selectedMonth - 1) : 0;
      const msg = encodeURIComponent(
        prevDue > 0
          ? `Hi ${m.name}, your chit payments are pending. Total due: Rs.${totalDue.toLocaleString()} (includes previous unpaid months + ${getMonthLabel(selectedMonth)}). Kindly pay at the earliest. Thank you! - Chitt Tracker`
          : `Hi ${m.name}, your chit payment for ${getMonthLabel(selectedMonth)} (Rs.${amount.toLocaleString()}) is pending. Kindly pay at the earliest. Thank you! - Chitt Tracker`
      );
      const url = `https://wa.me/91${m.phone}?text=${msg}`;
      setTimeout(() => window.open(url, "_blank"), idx * 800);
    });
    showToast(`Sending reminders to ${unpaidMembers.length} members...`);
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
  // Collected = total cash actually received when a member marked paid in this month
  // This includes back dues from previous months they settled
  const collected = members.reduce((sum, m) => {
    const paid = m.payments?.[selectedMonth]?.paid || false;
    if (!paid) return sum;
    // Count all months this member paid (including back dues settled this month)
    let memberPaid = 0;
    for (let mo = 1; mo <= selectedMonth; mo++) {
      if (m.payments?.[mo]?.paid) {
        const exp = getMemberPaymentAmount(m, mo);
        const short = m.shortPayments?.[mo] || 0;
        memberPaid += Math.max(0, exp - short);
      }
    }
    return sum + memberPaid;
  }, 0);
  // Pending = what's still owed by unpaid members this month
  const pending = members.reduce((sum, m) => {
    const paid = m.payments?.[selectedMonth]?.paid || false;
    if (paid) return sum;
    return sum + getMemberDueAmount(m, selectedMonth);
  }, 0);
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

      {/* ---- MEMBER HISTORY MODAL ---- */}
      {selectedMember && (
        <MemberHistory
          member={selectedMember}
          config={config}
          onClose={() => setSelectedMember(null)}
          BEFORE_AMOUNTS={BEFORE_AMOUNTS}
          AFTER_AMOUNT={AFTER_AMOUNT}
          TOTAL_MONTHS={TOTAL_MONTHS}
        />
      )}

      {/* ---- REPORT OVERLAY ---- */}
      {reportHtml && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 600,
          background: "#fff", display: "flex", flexDirection: "column",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #1E1B4B, #312E81)",
            padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95em" }}>
              Collection Report
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const iframe = document.getElementById("report-iframe");
                  if (iframe) iframe.contentWindow.print();
                }}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                  color: "#E0E7FF", padding: "6px 14px", borderRadius: 6,
                  fontSize: "0.82em", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Print / PDF
              </button>
              <button
                onClick={() => setReportHtml(null)}
                style={{
                  background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "#C7D2FE", padding: "6px 14px", borderRadius: 6,
                  fontSize: "0.82em", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
          </div>
          <iframe
            id="report-iframe"
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            srcDoc={reportHtml}
            title="Collection Report"
          />
        </div>
      )}

      {/* ---- STICKY TOP BAR ---- */}
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

        {/* ---- SET START DATE PROMPT ---- */}
        {!config?.startMonth && !settingStartDate && (
          <div style={{
            background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12,
            padding: "14px 18px", marginBottom: 16, display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10
          }}>
            <div>
              <div style={{ fontWeight: 700, color: "#1E1B4B", fontSize: "0.9em" }}>
                Set a start date for this chit
              </div>
              <div style={{ color: "#6366F1", fontSize: "0.78em", marginTop: 2 }}>
                This enables month names (Jan 2026, Feb 2026...) instead of numbers
              </div>
            </div>
            <button
              onClick={() => setSettingStartDate(true)}
              style={{
                background: "#4F46E5", color: "white", border: "none",
                padding: "8px 16px", borderRadius: 8, fontWeight: 600,
                fontSize: "0.85em", cursor: "pointer", fontFamily: "inherit"
              }}
            >
              Set Start Date
            </button>
          </div>
        )}

        {/* ---- START DATE FORM ---- */}
        {settingStartDate && (
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 12,
            padding: "20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{ fontWeight: 700, color: "#1E1B4B", marginBottom: 12 }}>
              When did this chit start?
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={startDateInput.month}
                onChange={e => setStartDateInput(p => ({ ...p, month: Number(e.target.value) }))}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: "0.9em", fontFamily: "inherit" }}
              >
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i) => (
                  <option key={i} value={i+1}>{m}</option>
                ))}
              </select>
              <select
                value={startDateInput.year}
                onChange={e => setStartDateInput(p => ({ ...p, year: Number(e.target.value) }))}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: "0.9em", fontFamily: "inherit" }}
              >
                {Array.from({length:10},(_,i)=>new Date().getFullYear()-5+i).map(y=>(
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button onClick={saveStartDate} style={{
                background: "#4F46E5", color: "white", border: "none",
                padding: "8px 20px", borderRadius: 8, fontWeight: 700,
                fontSize: "0.9em", cursor: "pointer", fontFamily: "inherit"
              }}>Save</button>
              <button onClick={() => setSettingStartDate(false)} style={{
                background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0",
                padding: "8px 16px", borderRadius: 8, fontSize: "0.9em",
                cursor: "pointer", fontFamily: "inherit"
              }}>Cancel</button>
            </div>
          </div>
        )}

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
              <span className="sub">Incl. dues cleared: Rs.{totalPerMonth.toLocaleString()} expected</span>
            </div>
            <div className="summary-card pending-card">
              <small>Pending This Month</small>
              <strong style={{ color: "var(--danger)" }}>Rs.{pending.toLocaleString()}</strong>
              <span className="sub">Unpaid members incl. their dues</span>
            </div>
            <div className="summary-card" style={{ background: "#FFF1F2", border: "1px solid #FECDD3" }}>
              <small style={{ color: "#9F1239" }}>Total Outstanding</small>
              <strong style={{ color: "#BE123C" }}>Rs.{totalOutstanding.toLocaleString()}</strong>
              <span className="sub">All dues across all months</span>
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
          <div className="table-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Payment Tracking - {getMonthLabel(selectedMonth)}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={sendAllReminders}
                style={{
                  background: "rgba(251,191,36,0.2)",
                  border: "1px solid rgba(251,191,36,0.35)",
                  color: "#FCD34D",
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: "0.8em",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                Remind All Unpaid
              </button>
              <button
                onClick={generateReport}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#E0E7FF",
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: "0.8em",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                Export Report
              </button>
            </div>
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
                      <td style={{ textAlign: "left" }}>
                        <button
                          onClick={() => setSelectedMember(m)}
                          style={{
                            background: "none", border: "none", padding: 0,
                            fontWeight: 600, fontSize: "0.95em", color: "#1E1B4B",
                            cursor: "pointer", textDecoration: "underline",
                            textDecorationColor: "#C7D2FE", fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          {m.name}
                        </button>
                      </td>
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

                          // Count months paid and total amount - all paid on same date means they settled dues
                          let totalPaidByMember = 0;
                          let monthsPaidCount = 0;
                          for (let mo = 1; mo <= selectedMonth; mo++) {
                            if (m.payments?.[mo]?.paid) {
                              totalPaidByMember += getMemberPaymentAmount(m, mo);
                              monthsPaidCount++;
                            }
                          }
                          // hadBackDues: true if they paid more than just this month
                          // OR if total paid is more than just current month amount
                          const hadBackDues = monthsPaidCount > 1 || totalPaidByMember > amount;
                          const waConfirmMsg = encodeURIComponent(
                            hadBackDues
                              ? `Hi ${m.name}, we have received Rs.${totalPaidByMember.toLocaleString()} on ${paidDateStr}. All your pending dues up to ${getMonthLabel(selectedMonth)} have been cleared. Thank you! - Chitt Tracker`
                              : `Hi ${m.name}, your chit payment for ${getMonthLabel(selectedMonth)} (Rs.${amount.toLocaleString()}) has been received on ${paidDateStr}. Thank you! - Chitt Tracker`
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
                              {paymentObj.markedAt && (Date.now() - new Date(paymentObj.markedAt).getTime() < 3600000) && (
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
