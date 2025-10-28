// server.js

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Backend is running successfully!");
});

// WhatsApp Cloud API send route
app.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: "Phone and message are required." });
    }

    // Normalize phone number to E.164 format
    const digits = phone.replace(/\D/g, "");
    const to = phone.startsWith("+")
      ? phone
      : digits.startsWith("91")
        ? `+${digits}`
        : `+91${digits}`;

    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const META_WA_TOKEN = process.env.META_WA_TOKEN;

    if (!PHONE_NUMBER_ID || !META_WA_TOKEN) {
      console.error("❌ Missing environment variables.");
      return res.status(500).json({ success: false, error: "Server misconfiguration." });
    }

    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_WA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp API error:", data);
      return res.status(response.status).json({ success: false, error: data });
    }

    console.log("✅ Message sent successfully:", data);
    res.json({ success: true, response: data });

  } catch (error) {
    console.error("🔥 Exception while sending message:", error);
    res.status(500).json({ success: false, error: "send_failed" });
  }
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
