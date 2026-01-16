
const API_BASE = "http://YOUR_SERVER_IP:3000";

const email = localStorage.getItem("userEmail");

async function loadOrders() {
  const res = await fetch(`${API_BASE}/api/orders/${email}`);
  const orders = await res.json();

  const container = document.getElementById("orders");
  container.innerHTML = "";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <p><strong>Student Plus</strong></p>
      <p>Status: <span>${o.status}</span></p>
      <p>Payment ID: ${o.payment_id}</p>
    `;
    container.appendChild(div);
  });
}

loadOrders();
