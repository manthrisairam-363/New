// src/components/MemberHistory.js
import React from "react";
import "./MemberHistory.css";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthLabel(monthNum, startMonth, startYear) {
  if (!startMonth || !startYear) return `Month ${monthNum}`;
  const totalMonths = startMonth - 1 + monthNum - 1;
  const year = startYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  return `${MONTH_NAMES[month]} ${year}`;
}

function getMemberPaymentAmount(member, month, BEFORE_AMOUNTS, AFTER_AMOUNT) {
  if (member.chitMonthPicked && month >= member.chitMonthPicked) {
    return AFTER_AMOUNT;
  }
  return BEFORE_AMOUNTS[month - 1] || AFTER_AMOUNT;
}

export default function MemberHistory({ member, config, onClose, BEFORE_AMOUNTS, AFTER_AMOUNT, TOTAL_MONTHS }) {
  const startMonth = config?.startMonth;
  const startYear = config?.startYear;
  const currentMonth = config?.currentMonth || TOTAL_MONTHS;

  // Build month-by-month history
  const months = [];
  let totalPaid = 0;
  let totalDue = 0;

  for (let m = 1; m <= TOTAL_MONTHS; m++) {
    const payment = member.payments?.[m] || {};
    const short = member.shortPayments?.[m] || 0;
    const amount = getMemberPaymentAmount(member, m, BEFORE_AMOUNTS, AFTER_AMOUNT);
    const isFuture = m > currentMonth;

    if (payment.paid) totalPaid += amount - short;
    else if (!isFuture) totalDue += amount + short;

    months.push({
      num: m,
      label: getMonthLabel(m, startMonth, startYear),
      paid: payment.paid || false,
      date: payment.date || null,
      short,
      amount,
      isFuture,
    });
  }

  const paidMonths = months.filter(m => m.paid).length;
  const unpaidMonths = months.filter(m => !m.paid && !m.isFuture).length;

  return (
    <div className="mh-backdrop" onClick={onClose}>
      <div className="mh-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="mh-header">
          <div>
            <div className="mh-name">{member.name}</div>
            <div className="mh-phone">{member.phone}</div>
          </div>
          <button className="mh-close" onClick={onClose}>x</button>
        </div>

        {/* Summary pills */}
        <div className="mh-summary">
          <div className="mh-pill mh-pill-green">
            <span className="mh-pill-val">{paidMonths}</span>
            <span className="mh-pill-label">Paid</span>
          </div>
          <div className="mh-pill mh-pill-red">
            <span className="mh-pill-val">{unpaidMonths}</span>
            <span className="mh-pill-label">Pending</span>
          </div>
          <div className="mh-pill mh-pill-blue">
            <span className="mh-pill-val">Rs.{totalPaid.toLocaleString()}</span>
            <span className="mh-pill-label">Total Paid</span>
          </div>
          <div className="mh-pill mh-pill-orange">
            <span className="mh-pill-val">Rs.{totalDue.toLocaleString()}</span>
            <span className="mh-pill-label">Outstanding</span>
          </div>
        </div>

        {/* Month list */}
        <div className="mh-list">
          {months.map(mo => (
            <div
              key={mo.num}
              className={`mh-row ${mo.paid ? "mh-row-paid" : mo.isFuture ? "mh-row-future" : "mh-row-unpaid"}`}
            >
              <div className="mh-row-left">
                <span className={`mh-status-dot ${mo.paid ? "dot-green" : mo.isFuture ? "dot-grey" : "dot-red"}`} />
                <div>
                  <div className="mh-month-label">{mo.label}</div>
                  {mo.paid && mo.date && (
                    <div className="mh-date">Paid on {new Date(mo.date).toLocaleDateString()}</div>
                  )}
                  {!mo.paid && !mo.isFuture && (
                    <div className="mh-date mh-overdue">Pending</div>
                  )}
                  {mo.isFuture && (
                    <div className="mh-date">Upcoming</div>
                  )}
                </div>
              </div>
              <div className="mh-row-right">
                <div className="mh-amount">Rs.{mo.amount.toLocaleString()}</div>
                {mo.short > 0 && (
                  <div className="mh-short">Short: Rs.{mo.short.toLocaleString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
