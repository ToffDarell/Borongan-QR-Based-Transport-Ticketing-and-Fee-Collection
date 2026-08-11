(function () {
  const usernameField = document.getElementById("username");
  const passwordField = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePass");
  const loginBtn = document.getElementById("loginBtn");
  const forgotBtn = document.getElementById("forgotBtn");
  const msgDiv = document.getElementById("formMsg");
  const errorDiv = document.getElementById("errorMsg");

  const modal = document.getElementById("forgotModal");
  const resetUser = document.getElementById("resetUser");
  const modalMsg = document.getElementById("modalMsg");
  const modalCancel = document.getElementById("modalCancel");
  const modalSend = document.getElementById("modalSend");

  // Login handler — calls PHP API
  function handleLogin() {
    const username = usernameField.value.trim();
    const password = passwordField.value.trim();

    msgDiv.innerHTML = "";
    errorDiv.classList.remove("show");

    if (!username || !password) {
      msgDiv.innerHTML =
        '<i class="fas fa-exclamation-circle mr-1" style="color:#b22234;"></i> Please enter all details.';
      msgDiv.style.color = "#b22234";
      return false;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';

    fetch("api/admin_login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          msgDiv.innerHTML =
            '<i class="fas fa-check-circle mr-1" style="color:#1a6d3b;"></i> Login successful! Redirecting...';
          msgDiv.style.color = "#1a6d3b";
          localStorage.setItem("admin_logged_in", "true");
          localStorage.setItem("admin_name", data.username);
          setTimeout(() => {
            window.location.href = "admin-dashboard.html";
          }, 1500);
        } else {
          loginBtn.disabled = false;
          loginBtn.innerHTML = "Login";
          errorDiv.classList.add("show");
          setTimeout(() => errorDiv.classList.remove("show"), 3000);
        }
      })
      .catch(() => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";
        msgDiv.innerHTML =
          '<i class="fas fa-exclamation-circle mr-1" style="color:#b22234;"></i> Cannot connect to server.';
        msgDiv.style.color = "#b22234";
      });
  }

  loginBtn.addEventListener("click", function (e) {
    e.preventDefault();
    handleLogin();
  });
  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    handleLogin();
  });

  // Clear messages on focus
  [usernameField, passwordField].forEach((input) => {
    input.addEventListener("focus", function () {
      msgDiv.innerHTML = "";
      errorDiv.classList.remove("show");
    });
  });

  // Enter key navigation
  usernameField.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordField.focus();
    }
  });

  passwordField.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  });
})();
