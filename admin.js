
const API_BASE = "http://YOUR_SERVER_IP:3000";
const adminPassword = localStorage.getItem("adminPassword");

if (!adminPassword) {
  window.location.href = "admin_login.html";
}

async function loadAllOrders() {
  const res = await fetch(`${API_BASE}/api/admin/orders`, {
    headers: { "x-admin-password": adminPassword }
  });

  if (res.status === 401) {
    localStorage.removeItem("adminPassword");
    window.location.href = "admin_login.html";
    return;
  }

  const orders = await res.json();
  const container = document.getElementById("admin-orders");
  container.innerHTML = "";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <p><strong>${o.email}</strong></p>
      <p>Status: ${o.status}</p>
      <p>Payment ID: ${o.payment_id}</p>
      <button onclick="markPaid('${o.payment_id}')">Mark Paid</button>
      <button onclick="lock('${o.payment_id}')">Lock</button>
    `;
    container.appendChild(div);
  });
}

async function markPaid(paymentId) {
  await fetch(`${API_BASE}/api/order/paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword
    },
    body: JSON.stringify({ paymentId })
  });
  loadAllOrders();
}

async function lock(paymentId) {
  await fetch(`${API_BASE}/api/order/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword
    },
    body: JSON.stringify({ paymentId })
  });
  loadAllOrders();
}

loadAllOrders();
