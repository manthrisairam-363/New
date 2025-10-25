const functions = require("firebase-functions");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

admin.initializeApp();

// Replace these with your actual Twilio credentials from the screenshot
const TWILIO_ACCOUNT_SID = "add here "; // Your full Account SID
const TWILIO_AUTH_TOKEN = "add here"; // Click "Show" and copy the full token
const TWILIO_WHATSAPP_NUMBER = "whatsapp:+19788294472"; // Twilio sandbox number

exports.notifyPaymentReceived = functions.firestore
  .document("members/{memberId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const memberId = context.params.memberId;

    // Check if any payment was newly marked as paid
    const beforePayments = before.payments || {};
    const afterPayments = after.payments || {};

    let newlyPaidMonth = null;

    // Find the month that was just marked paid
    for (const month in afterPayments) {
      const wasPaid = beforePayments[month]?.paid || false;
      const isPaid = afterPayments[month]?.paid || false;

      if (!wasPaid && isPaid) {
        newlyPaidMonth = month;
        break;
      }
    }

    // If no new payment was marked, exit
    if (!newlyPaidMonth) {
      console.log("No new payment marked for member", memberId);
      return null;
    }

    // Get member details
    const memberName = after.name || `Member ${memberId}`;
    const memberPhone = after.phone;

    if (!memberPhone) {
      console.log("No phone number for member", memberId);
      return null;
    }

    // Prepare WhatsApp message
    const message = `Hi ${memberName}, your chit payment for Month ${newlyPaidMonth} has been marked as paid. Thank you!`;

    const toNumber = `whatsapp:+91${memberPhone}`; // Indian numbers

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
          },
          body: new URLSearchParams({
            From: TWILIO_WHATSAPP_NUMBER,
            To: toNumber,
            Body: message,
          }),
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        console.log("WhatsApp sent successfully:", data);
      } else {
        console.error("Error sending WhatsApp:", data);
      }
      
      return null;
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      return null;
    }
  });
