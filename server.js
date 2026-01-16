
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ENV VARS (set these on DigitalOcean)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Health check
app.get("/", (req, res) => {
  res.send("GPTCheap backend running");
});

// Create order
app.post("/api/order", async (req, res) => {
  const { email, senderEmail } = req.body;

  const paymentId = "GPT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        email,
        sender_email: senderEmail,
        payment_id: paymentId,
        status: "PENDING"
      }
    ]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ paymentId });
});

// Get user orders
app.get("/api/orders/:email", async (req, res) => {
  const email = req.params.email;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Mark order as paid (admin / automation)
app.post("/api/order/paid", async (req, res) => {
  const { paymentId } = req.body;

  const { error } = await supabase
    .from("orders")
    .update({ status: "PAID" })
    .eq("payment_id", paymentId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
