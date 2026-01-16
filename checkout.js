
const API_BASE = "http://YOUR_SERVER_IP:3000";

async function createOrder() {
  const email = document.getElementById("email").value;
  const sender = document.getElementById("sender").value;

  localStorage.setItem("userEmail", email);

  const res = await fetch(`${API_BASE}/api/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senderEmail: sender })
  });

  const data = await res.json();
  document.getElementById("paymentId").innerText = data.paymentId;
}
