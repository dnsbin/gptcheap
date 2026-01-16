function statusClass(status) {
  if (status === "PAID") {
    return "status-paid";
  }
  if (status === "LOCKED") {
    return "status-locked";
  }
  return "status-pending";
}

async function loadOrders() {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const res = await fetch(`${API_BASE}/api/orders`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  const orders = await res.json();

  const container = document.getElementById("orders");
  container.innerHTML = "";

  let paidCount = 0;
  let pendingCount = 0;

  orders.forEach(o => {
    if (o.status === "PAID") {
      paidCount += 1;
    } else if (o.status === "PENDING") {
      pendingCount += 1;
    }

    let creds = "";
    if (o.status === "PAID") {
      creds = `
        <div class="card">
          <div class="panel-title">
            <h3>Credentials</h3>
            <span class="status-pill status-paid">PAID</span>
          </div>
          <p class="mono">${o.credentials_email || ""}</p>
          <button class="btn btn-outline copy-btn" data-copy-text="${o.credentials_email || ""}">Copy Email</button>
          <p class="mono">${o.credentials_password || ""}</p>
          <button class="btn btn-outline copy-btn" data-copy-text="${o.credentials_password || ""}">Copy Password</button>
        </div>
      `;
    }

    if (o.status === "LOCKED") {
      const reason = o.lock_reason ? `Reason: ${o.lock_reason}` : "Account locked due to abuse";
      creds = `<p class='note' style='color: var(--danger);'>${reason}</p>`;
    }

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="panel-title">
        <h3>Student Plus</h3>
        <span class="status-pill ${statusClass(o.status)}">${o.status}</span>
      </div>
      <p class="note">Payment ID</p>
      <p class="mono">${o.payment_id}</p>
      <button class="btn btn-outline copy-btn" data-copy-text="${o.payment_id}">Copy Payment ID</button>
      ${creds}
    `;
    container.appendChild(div);
  });

  const totalElement = document.getElementById("kpi-total");
  const paidElement = document.getElementById("kpi-paid");
  const pendingElement = document.getElementById("kpi-pending");

  if (totalElement) {
    totalElement.innerText = orders.length;
  }
  if (paidElement) {
    paidElement.innerText = paidCount;
  }
  if (pendingElement) {
    pendingElement.innerText = pendingCount;
  }
}

loadOrders();
