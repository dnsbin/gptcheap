
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Gmail auth (service account or OAuth token)
const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/gmail.readonly"]
});

const gmail = google.gmail({ version: "v1", auth });

async function checkTransfers() {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "Interac GPT-"
  });

  if (!res.data.messages) return;

  for (const msg of res.data.messages) {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full"
    });

    const body = Buffer.from(
      message.data.payload.parts[0].body.data || "",
      "base64"
    ).toString("utf-8");

    // Detect amount + payment ID
    const amountMatch = body.includes("100");
    const idMatch = body.match(/GPT-[A-Z0-9]{6}/);

    if (!amountMatch || !idMatch) continue;

    const paymentId = idMatch[0];

    // Mark order as PAID
    await supabase
      .from("orders")
      .update({ status: "PAID" })
      .eq("payment_id", paymentId);
  }
}

checkTransfers()
  .then(() => console.log("Gmail scan complete"))
  .catch(console.error);
