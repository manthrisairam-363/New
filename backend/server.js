import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // or native fetch if using Node 18+

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Cloud API backend is running!");
});

// WhatsApp send endpoint
app.post("/send-whatsapp", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: "Missing phone or message" });
    }

    const digits = String(phone).replace(/\D/g, "");
    const to =
      digits.startsWith("+") ? digits :
      digits.startsWith("91") ? `+${digits}` :
      `+91${digits}`;

    const url = `https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.META_WA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("WhatsApp send error:", data);
      return res.status(response.status).json({ success: false, error: data });
    }

    res.json({ success: true, response: data });
  } catch (error) {
    console.error("Send Exception:", error);
    res.status(500).json({ success: false, error: "send_failed" });
  }
});

// Use Railway PORT or default to 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
