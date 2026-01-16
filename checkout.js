async function createOrder() {
  const emailField = document.getElementById("email");
  const sender = document.getElementById("sender").value;
  const paymentIdField = document.getElementById("paymentId");

  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  if (emailField) {
    emailField.value = session.user.email || "";
  }

  const res = await fetch(`${API_BASE}/api/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ senderEmail: sender })
  });

  const data = await res.json();
  paymentIdField.innerText = data.paymentId || "";
}

async function loadCheckoutUser() {
  const emailField = document.getElementById("email");
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  if (emailField) {
    emailField.value = session.user.email || "";
  }
}

loadCheckoutUser();
