import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8080;
const META_WA_TOKEN = process.env.META_WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Cloud API backend is running!");
});

// ✅ WhatsApp notification route
app.post("/send-whatsapp", async (req, res) => {
  console.log("📩 /send-whatsapp called with body:", req.body);

  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Missing phone or message" });
    }

    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${META_WA_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Message sent:", response.data);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
