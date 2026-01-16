const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const PAYMENT_ID_REGEX = /(GPT|GPC)-[A-Z0-9]{4,8}(?:-[A-Z0-9]{3,6})?/;

function extractBody(payload) {
  if (!payload) {
    return "";
  }
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts && payload.parts.length > 0) {
    return payload.parts.map(extractBody).join("\n");
  }
  return "";
}

function parseAmount(body) {
  const amountMatch = body.match(/\$?\s*100(?:\.00)?\s*CAD/i);
  if (amountMatch) {
    return 100;
  }
  const plainMatch = body.match(/\$?\s*100(?:\.00)?/);
  return plainMatch ? 100 : null;
}

function extractSenderEmail(headers) {
  const fromHeader = headers.find(header => header.name.toLowerCase() === "from");
  if (!fromHeader) {
    return null;
  }
  const emailMatch = fromHeader.value.match(/<(.+?)>/);
  return emailMatch ? emailMatch[1] : fromHeader.value;
}

async function markProcessed(messageId) {
  const labelId = process.env.GMAIL_LABEL_PROCESSED;
  if (!labelId) {
    return;
  }
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [labelId]
    }
  });
}

async function assignCredentials(orderId) {
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

async function handlePayment({ paymentId, senderEmail, amount, messageId }) {
  let { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("payment_id", paymentId)
    .eq("status", "PENDING")
    .limit(1)
    .single();

  if (!order && senderEmail) {
    const { data: fallbackOrder } = await supabase
      .from("orders")
      .select("id, status")
      .eq("sender_email", senderEmail)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    order = fallbackOrder;
  }

  if (!order) {
    await supabase
      .from("admin_actions")
      .insert([
        {
          admin_action: "UNMATCHED_PAYMENT",
          notes: `Message ${messageId} no match for ${paymentId || "missing payment id"}`
        }
      ]);
    return false;
  }

  if (amount !== 100) {
    await supabase
      .from("admin_actions")
      .insert([
        {
          admin_action: "UNMATCHED_AMOUNT",
          order_id: order.id,
          notes: `Message ${messageId} amount ${amount}`
        }
      ]);
    return false;
  }

  await supabase
    .from("orders")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      payment_source: "ETRANSFER",
      payment_amount: amount,
      gmail_message_id: messageId
    })
    .eq("id", order.id);

  await assignCredentials(order.id);

  await supabase
    .from("admin_actions")
    .insert([
      {
        admin_action: "AUTO_PAID",
        order_id: order.id,
        notes: `Message ${messageId}`
      }
    ]);

  return true;
}

async function checkTransfers() {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "Interac e-Transfer"
  });

  if (!res.data.messages) {
    return;
  }

  for (const msg of res.data.messages) {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full"
    });

    const body = extractBody(message.data.payload);
    const headers = message.data.payload.headers || [];
    const paymentIdMatch = body.match(PAYMENT_ID_REGEX);
    const paymentId = paymentIdMatch ? paymentIdMatch[0] : null;
    const amount = parseAmount(body);
    const senderEmail = extractSenderEmail(headers);

    const matched = await handlePayment({
      paymentId,
      senderEmail,
      amount,
      messageId: msg.id
    });

    if (matched) {
      await markProcessed(msg.id);
    }
  }
}

checkTransfers()
  .then(() => console.log("Gmail scan complete"))
  .catch((error) => {
    console.error("Gmail scan failed", error);
    process.exitCode = 1;
  });
