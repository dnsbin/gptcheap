const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function requireAdmin(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  next();
}

function generatePaymentId() {
  const token = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `GPT-${token}`;
}

async function createUniquePaymentId() {
  let paymentId = generatePaymentId();
  let exists = true;

  while (exists) {
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("payment_id", paymentId)
      .limit(1);

    if (data && data.length === 0) {
      exists = false;
      break;
    }
    paymentId = generatePaymentId();
  }

  return paymentId;
}

async function logAdminAction(action, orderId, notes) {
  await supabase
    .from("admin_actions")
    .insert([{ admin_action: action, order_id: orderId, notes }]);
}

async function assignNextCredential(orderId) {
  const { data: credentials } = await supabase
    .from("credentials_inventory")
    .select("id, login_email, login_password")
    .eq("assigned", false)
    .order("assigned_at", { ascending: true })
    .limit(1);

  if (!credentials || credentials.length === 0) {
    return null;
  }

  const credential = credentials[0];
  await supabase
    .from("credentials_inventory")
    .update({ assigned: true, assigned_at: new Date().toISOString() })
    .eq("id", credential.id);

  await supabase
    .from("orders")
    .update({
      credentials_id: credential.id,
      credentials_email: credential.login_email,
      credentials_password: credential.login_password
    })
    .eq("id", orderId);

  return credential;
}

// Health check
app.get("/", (req, res) => {
  res.send("GPTCheap backend running");
});

app.get("/api/config", (req, res) => {
  res.json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
});

// Create order (auth required)
app.post("/api/order", requireUser, async (req, res) => {
  const { senderEmail } = req.body;
  const paymentId = await createUniquePaymentId();

  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        user_id: req.user.id,
        email: req.user.email,
        sender_email: senderEmail,
        payment_id: paymentId,
        status: "PENDING"
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ paymentId, orderId: data.id });
});

// Get user orders (auth required)
app.get("/api/orders", requireUser, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Admin: get all orders
app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Admin: mark order paid
app.post("/api/admin/paid", requireAdmin, async (req, res) => {
  const { paymentId, paymentSource, paymentAmount, gmailMessageId } = req.body;

  const { data: order, error } = await supabase
    .from("orders")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      payment_source: paymentSource || "MANUAL",
      payment_amount: paymentAmount || 100,
      gmail_message_id: gmailMessageId || null
    })
    .eq("payment_id", paymentId)
    .select("id")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await assignNextCredential(order.id);
  await logAdminAction("MARK_PAID", order.id, `Payment ID ${paymentId}`);

  res.json({ success: true });
});

// Admin: lock order
app.post("/api/admin/lock", requireAdmin, async (req, res) => {
  const { paymentId, lockReason } = req.body;

  const { data: order, error } = await supabase
    .from("orders")
    .update({ status: "LOCKED", lock_reason: lockReason || "Account locked" })
    .eq("payment_id", paymentId)
    .select("id")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  await logAdminAction("LOCK", order.id, lockReason || "Account locked");
  res.json({ success: true });
});

// Admin: assign credentials manually
app.post("/api/admin/assign-credentials", requireAdmin, async (req, res) => {
  const { orderId, credentialsId } = req.body;

  const { data: credential, error } = await supabase
    .from("credentials_inventory")
    .select("id, login_email, login_password")
    .eq("id", credentialsId)
    .single();

  if (error || !credential) {
    return res.status(404).json({ error: "Credential not found" });
  }

  await supabase
    .from("credentials_inventory")
    .update({ assigned: true, assigned_at: new Date().toISOString() })
    .eq("id", credential.id);

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      credentials_id: credential.id,
      credentials_email: credential.login_email,
      credentials_password: credential.login_password
    })
    .eq("id", orderId);

  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  await logAdminAction("ASSIGN_CREDENTIALS", orderId, `Credential ${credentialsId}`);

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
