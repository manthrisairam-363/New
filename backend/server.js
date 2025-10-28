const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Backend is running!"));

// Send via WhatsApp Cloud API
app.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, message } = req.body;

    // Normalize number to E.164; default to +91 if your app stores 10-digit Indian numbers
    const digits = String(phone).replace(/\D/g, "");
    const to =
      digits.startsWith("+") ? digits :
      digits.startsWith("91") ? `+${digits}` :
      `+91${digits}`;

    const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",           // Use "template" if outside 24h window
      text: { body: message }
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.META_WA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("WA send error:", data);
      return res.status(r.status).json({ success: false, error: data });
    }

    res.json({ success: true, response: data });
  } catch (e) {
    console.error("WA send exception:", e);
    res.status(500).json({ success: false, error: "send_failed" });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
