
const API_BASE = "http://YOUR_SERVER_IP:3000";
const email = localStorage.getItem("userEmail");

async function loadOrders() {
  const res = await fetch(`${API_BASE}/api/orders/${email}`);
  const orders = await res.json();

  const container = document.getElementById("orders");
  container.innerHTML = "";

  orders.forEach(o => {
    let creds = "";
    if (o.status === "PAID") {
      creds = `<p><strong>Login:</strong> ${o.credentials_email}<br>
               <strong>Password:</strong> ${o.credentials_password}</p>`;
    }

    if (o.status === "LOCKED") {
      creds = "<p style='color:red'>Account locked due to abuse</p>";
    }

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <p><strong>Student Plus</strong></p>
      <p>Status: ${o.status}</p>
      <p>Payment ID: ${o.payment_id}</p>
      ${creds}
    `;
    container.appendChild(div);
  });
}

loadOrders();
