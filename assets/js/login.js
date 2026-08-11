(function () {
  const usernameField = document.getElementById("username");
  const passwordField = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePass");
  const loginBtn = document.getElementById("loginBtn");
  const forgotBtn = document.getElementById("forgotBtn");
  const msgDiv = document.getElementById("formMsg");
  const successDiv = document.getElementById("successMsg");

  // show registration success message
  if (window.location.search.includes("registered=true")) {
    successDiv.classList.add("show");
    setTimeout(() => successDiv.classList.remove("show"), 5000);
  }

  // session check (driver)
  // ── LINES 17-148: REPLACE WITH THIS ──────────────────────────

  // Session check via API
  fetch("api/driver_login.php", { method: "GET" }).catch(() => {}); // silent fail if no session

  // Login handler — calls PHP API
  function handleLogin() {
    const username = usernameField.value.trim();
    const password = passwordField.value.trim();

    msgDiv.innerHTML = "";
    msgDiv.style.color = "";

    if (!username || !password) {
      msgDiv.innerHTML =
        '<i class="fas fa-exclamation-circle mr-1"></i> Please enter your username and password.';
      msgDiv.style.color = "#b22234";
      return false;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';

    fetch("api/driver_login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          msgDiv.innerHTML =
            '<i class="fas fa-check-circle mr-1"></i> Welcome, ' +
            data.driver.fullName +
            "!";
          msgDiv.style.color = "#1a6d3b";

          // Store session (mirrors old localStorage keys)
          localStorage.setItem(
            "borongan_driver_session",
            JSON.stringify({
              username: data.driver.username,
              driverId: data.driver.driverId,
              fullName: data.driver.fullName,
              loginTime: new Date().toISOString(),
            }),
          );
          localStorage.setItem("current_driver", JSON.stringify(data.driver));

          setTimeout(() => {
            window.location.href = "driver-dashboard.html";
          }, 1200);
        } else {
          loginBtn.disabled = false;
          loginBtn.innerHTML = "Login";
          msgDiv.innerHTML =
            '<i class="fas fa-times-circle mr-1"></i> ' +
            (data.error || "Invalid credentials.");
          msgDiv.style.color = "#b22234";
        }
      })
      .catch(() => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";
        msgDiv.innerHTML =
          '<i class="fas fa-exclamation-circle mr-1"></i> Cannot connect to server.';
        msgDiv.style.color = "#b22234";
      });
  }

  // event listeners
  loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    handleLogin();
  });
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleLogin();
  });

  usernameField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordField.focus();
    }
  });
  passwordField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  });

  // clear error on focus
  [usernameField, passwordField].forEach((input) => {
    input.addEventListener("focus", function () {
      const msg = msgDiv.innerHTML;
      if (
        msg.includes("Invalid") ||
        msg.includes("fill") ||
        msg.includes("valid") ||
        msg.includes("account") ||
        msg.includes("Incorrect") ||
        msg.includes("No registered")
      ) {
        msgDiv.innerHTML = "";
      }
    });
  });
})();
