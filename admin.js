const API_BASE = window.location.origin;
const adminPassword = localStorage.getItem("adminPassword");

if (!adminPassword) {
  window.location.href = "admin_login.html";
}

let allOrders = [];

function statusClass(status) {
  if (status === "PAID") {
    return "status-paid";
  }
  if (status === "LOCKED") {
    return "status-locked";
  }
  return "status-pending";
}

function renderOrders() {
  const container = document.getElementById("admin-orders");
  const search = document.getElementById("search").value.toLowerCase();
  const filter = document.getElementById("statusFilter").value;

  container.innerHTML = "";

  allOrders
    .filter(order => {
      const matchesSearch = order.email.toLowerCase().includes(search) || order.payment_id.toLowerCase().includes(search);
      const matchesStatus = filter === "ALL" || order.status === filter;
      return matchesSearch && matchesStatus;
    })
    .forEach(order => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.email}</td>
        <td><span class="status-pill ${statusClass(order.status)}">${order.status}</span></td>
        <td class="mono">${order.payment_id}</td>
        <td class="mono">${order.payment_source || "-"}</td>
        <td class="mono">${order.gmail_message_id || "-"}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline" onclick="markPaid('${order.payment_id}')">Mark Paid</button>
            <button class="btn btn-outline" onclick="lock('${order.payment_id}')">Lock</button>
            <button class="btn btn-outline" onclick="assignCredentials('${order.id}')">Assign Credentials</button>
          </div>
        </td>
      `;
      container.appendChild(row);
    });
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

  allOrders = await res.json();
  renderOrders();
}

async function markPaid(paymentId) {
  await fetch(`${API_BASE}/api/admin/paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword
    },
    body: JSON.stringify({ paymentId, paymentSource: "MANUAL", paymentAmount: 100 })
  });
  loadAllOrders();
}

async function lock(paymentId) {
  const lockReason = prompt("Lock reason?") || "Account locked";
  await fetch(`${API_BASE}/api/admin/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword
    },
    body: JSON.stringify({ paymentId, lockReason })
  });
  loadAllOrders();
}

async function assignCredentials(orderId) {
  const credentialsId = prompt("Credentials inventory ID?");
  if (!credentialsId) {
    return;
  }
  await fetch(`${API_BASE}/api/admin/assign-credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword
    },
    body: JSON.stringify({ orderId, credentialsId })
  });
  loadAllOrders();
}

document.getElementById("search").addEventListener("input", renderOrders);
document.getElementById("statusFilter").addEventListener("change", renderOrders);

loadAllOrders();
