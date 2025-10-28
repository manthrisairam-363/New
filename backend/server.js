const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Add your WhatsApp or other API routes here...

//const PORT = process.env.PORT || 3000;
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.post("/send-whatsapp", (req, res) => {
  // For now, just echo the data to confirm it's working
  // Replace with WhatsApp code later
  console.log("Received at /send-whatsapp:", req.body);
  res.json({ success: true, msg: "WhatsApp API endpoint hit", data: req.body });
});
