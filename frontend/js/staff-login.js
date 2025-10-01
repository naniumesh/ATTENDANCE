// Clear session if accessing login page
localStorage.removeItem("loggedIn");
localStorage.removeItem("staffId");
localStorage.removeItem("staffName");
localStorage.removeItem("staffUsername");
localStorage.removeItem("completedDates");

document.getElementById("loginBtn").addEventListener("click", login);

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  try {
    const res = await fetch("https://attendance-jmxr.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.staffId) {
      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("staffId", data.staffId);
      localStorage.setItem("staffName", data.name);
      localStorage.setItem("staffUsername", data.username);

      window.location.href = "staff.html";
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Login error.");
  }
}
