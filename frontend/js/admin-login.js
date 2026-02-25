    document.getElementById("loginBtn").addEventListener("click", async () => {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!username || !password) {
        document.getElementById("message").textContent = "Please fill all fields.";
        return;
      }

      try {
        const res = await fetch("ttps://attendance-jmxr.onrender.com/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
          document.getElementById("message").textContent = "Login successful!";
          document.getElementById("message").style.color = "#4CAF50";

          // Redirect or do something after login
          setTimeout(() => {
            sessionStorage.setItem("isAdminLoggedIn", "true");
            window.location.href = "admin.html";
          }, 1000);
        } else {
          document.getElementById("message").textContent = data.message || "Login failed.";
          document.getElementById("message").style.color = "#C62828";
        }
      } catch (err) {
        console.error(err);
        document.getElementById("message").textContent = "Error connecting to server.";
        document.getElementById("message").style.color = "#C62828";
      }
    });
    document.getElementById("otherLoginBtn").addEventListener("click", () => {
      window.location.href = "staff-login.html";

    });
