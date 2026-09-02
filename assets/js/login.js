(function () {
  const usernameField = document.getElementById("username");
  const passwordField = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePass");
  const loginBtn = document.getElementById("loginBtn");
  const forgotBtn = document.getElementById("forgotBtn");
  const msgDiv = document.getElementById("formMsg");
  const successDiv = document.getElementById("successMsg");

  // forgot password modal elements
  const forgotModal = document.getElementById("forgotModal");
  const resetUser = document.getElementById("resetUser");
  const resetNewPass = document.getElementById("resetNewPass");
  const resetConfirmPass = document.getElementById("resetConfirmPass");
  const toggleResetPass = document.getElementById("toggleResetPass");
  const toggleResetConfirm = document.getElementById("toggleResetConfirm");
  const modalMsg = document.getElementById("modalMsg");
  const modalCancel = document.getElementById("modalCancel");
  const modalSend = document.getElementById("modalSend");

  // password strength elements
  const resetPwPopover = document.getElementById("resetPwPopover");
  const resetBars = [
    document.getElementById("resetBar1"),
    document.getElementById("resetBar2"),
    document.getElementById("resetBar3"),
    document.getElementById("resetBar4"),
  ];
  const resetStrengthText = document.getElementById("resetPwStrengthText");
  const resetConfirmMatch = document.getElementById("resetConfirmMatch");

  // show message if redirected from register
  if (window.location.search.includes("registered=true") && successDiv) {
    successDiv.classList.add("show");
    setTimeout(() => successDiv.classList.remove("show"), 5000);
  }

  // toggle password show and hide
  function setupToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      const icon = btn.querySelector("i");
      if (icon) {
        icon.className = isPass ? "fas fa-eye-slash" : "fas fa-eye";
      }
      if (document.activeElement === input) {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    });
  }

  // setup toggle buttons
  setupToggle(toggleBtn, passwordField);
  setupToggle(toggleResetPass, resetNewPass);
  setupToggle(toggleResetConfirm, resetConfirmPass);

  // show password rules on focus
  if (resetNewPass && resetPwPopover) {
    resetNewPass.addEventListener("focus", function () {
      resetPwPopover.classList.add("active");
    });
    resetNewPass.addEventListener("blur", function () {
      if (resetNewPass.value.length === 0) {
        resetPwPopover.classList.remove("active");
      }
    });
  }

  // check password strength and rules
  function checkResetPasswordStrength(password) {
    const checks = {
      length: password.length >= 12,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    let passedCount = 0;
    const reqMap = {
      length: "resetReqLength",
      upper: "resetReqUpper",
      lower: "resetReqLower",
      number: "resetReqNumber",
      special: "resetReqSpecial",
    };

    Object.keys(checks).forEach((key) => {
      const isPassed = checks[key];
      const el = document.getElementById(reqMap[key]);
      if (el) {
        el.classList.toggle("valid", isPassed);
        const icon = el.querySelector(".icon");
        if (icon) {
          icon.innerHTML = isPassed
            ? '<i class="fas fa-check-circle"></i>'
            : '<i class="far fa-circle"></i>';
        }
      }
      if (isPassed) passedCount++;
    });

    // update strength bar
    resetBars.forEach((bar, i) => {
      if (!bar) return;
      bar.className = "track-bar";
      if (password.length > 0) {
        if (passedCount <= 2 && i <= 0) {
          bar.classList.add("active", "weak");
        } else if (passedCount <= 4 && i < passedCount - 1) {
          bar.classList.add("active", "medium");
        } else if (passedCount === 5 && i < 4) {
          bar.classList.add("active", "strong");
        }
      }
    });

    // update strength text
    if (resetStrengthText) {
      if (password.length === 0) {
        resetStrengthText.textContent = "Use 12 or more characters";
        resetStrengthText.style.color = "#64748b";
      } else if (passedCount <= 2) {
        resetStrengthText.textContent = "Too weak (missing requirements)";
        resetStrengthText.style.color = "#ef4444";
      } else if (passedCount < 5) {
        resetStrengthText.textContent = "Almost there (good passphrase)";
        resetStrengthText.style.color = "#f59e0b";
      } else {
        resetStrengthText.textContent = "Strong passphrase!";
        resetStrengthText.style.color = "#10b981";
      }
    }

    return checks;
  }

  function checkResetConfirmMatch() {
    if (!resetConfirmMatch) return;
    const pass = resetNewPass ? resetNewPass.value : "";
    const confirm = resetConfirmPass ? resetConfirmPass.value : "";
    if (confirm.length === 0) {
      resetConfirmMatch.textContent = "";
      return;
    }
    if (pass === confirm) {
      resetConfirmMatch.textContent = "✓ Passwords match";
      resetConfirmMatch.style.color = "#10b981";
    } else {
      resetConfirmMatch.textContent = "Passwords do not match yet";
      resetConfirmMatch.style.color = "#ef4444";
    }
  }

  if (resetNewPass) {
    resetNewPass.addEventListener("input", function () {
      if (resetPwPopover) resetPwPopover.classList.add("active");
      checkResetPasswordStrength(this.value);
      checkResetConfirmMatch();
    });
  }

  if (resetConfirmPass) {
    resetConfirmPass.addEventListener("input", checkResetConfirmMatch);
  }

  // check existing session
  fetch("api/driver_login.php", { method: "GET" }).catch(() => {});

  // handle login submit
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

          // save session to local storage
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

  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  if (usernameField) {
    usernameField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        passwordField.focus();
      }
    });
  }

  if (passwordField) {
    passwordField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  // clear error on focus
  [usernameField, passwordField].forEach((input) => {
    if (input) {
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
    }
  });

  // forgot password modal functions
  function openForgotModal() {
    if (!forgotModal) return;
    forgotModal.classList.add("active");
    if (resetUser) {
      resetUser.value = usernameField ? usernameField.value.trim() : "";
    }
    if (resetNewPass) {
      resetNewPass.value = "";
      resetNewPass.type = "password";
      if (toggleResetPass) {
        const icon = toggleResetPass.querySelector("i");
        if (icon) icon.className = "fas fa-eye";
      }
    }
    if (resetConfirmPass) {
      resetConfirmPass.value = "";
      resetConfirmPass.type = "password";
      if (toggleResetConfirm) {
        const icon = toggleResetConfirm.querySelector("i");
        if (icon) icon.className = "fas fa-eye";
      }
    }
    if (resetPwPopover) resetPwPopover.classList.remove("active");
    checkResetPasswordStrength("");
    if (resetConfirmMatch) resetConfirmMatch.textContent = "";
    if (modalMsg) {
      modalMsg.innerHTML = "";
      modalMsg.style.color = "";
    }
    setTimeout(() => {
      if (resetUser && !resetUser.value) {
        resetUser.focus();
      } else if (resetNewPass) {
        resetNewPass.focus();
      }
    }, 100);
  }

  function closeForgotModal() {
    if (!forgotModal) return;
    forgotModal.classList.remove("active");
    if (modalMsg) {
      modalMsg.innerHTML = "";
      modalMsg.style.color = "";
    }
    if (modalSend) {
      modalSend.disabled = false;
      modalSend.innerHTML = "Reset Password";
    }
  }

  if (forgotBtn) {
    forgotBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openForgotModal();
    });
  }

  if (modalCancel) {
    modalCancel.addEventListener("click", (e) => {
      e.preventDefault();
      closeForgotModal();
    });
  }

  if (forgotModal) {
    forgotModal.addEventListener("click", (e) => {
      if (e.target === forgotModal) closeForgotModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && forgotModal && forgotModal.classList.contains("active")) {
      closeForgotModal();
    }
  });

  function handleResetPassword() {
    const username = resetUser.value.trim();
    const newPass = resetNewPass.value;
    const confirmPass = resetConfirmPass.value;

    modalMsg.innerHTML = "";
    modalMsg.style.color = "";

    if (!username) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Please enter your username.';
      modalMsg.style.color = "#b22234";
      resetUser.focus();
      return;
    }

    if (!newPass) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Please enter a new password.';
      modalMsg.style.color = "#b22234";
      resetNewPass.focus();
      return;
    }

    const checks = checkResetPasswordStrength(newPass);

    if (!checks.length) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must be at least 12 characters.';
      modalMsg.style.color = "#b22234";
      if (resetPwPopover) resetPwPopover.classList.add("active");
      resetNewPass.focus();
      return;
    }

    if (!checks.upper) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must contain at least one uppercase letter.';
      modalMsg.style.color = "#b22234";
      if (resetPwPopover) resetPwPopover.classList.add("active");
      resetNewPass.focus();
      return;
    }

    if (!checks.lower) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must contain at least one lowercase letter.';
      modalMsg.style.color = "#b22234";
      if (resetPwPopover) resetPwPopover.classList.add("active");
      resetNewPass.focus();
      return;
    }

    if (!checks.number) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must contain at least one number.';
      modalMsg.style.color = "#b22234";
      if (resetPwPopover) resetPwPopover.classList.add("active");
      resetNewPass.focus();
      return;
    }

    if (!checks.special) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must contain at least one special symbol.';
      modalMsg.style.color = "#b22234";
      if (resetPwPopover) resetPwPopover.classList.add("active");
      resetNewPass.focus();
      return;
    }

    if (newPass !== confirmPass) {
      modalMsg.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Passwords do not match.';
      modalMsg.style.color = "#b22234";
      resetConfirmPass.focus();
      return;
    }

    modalSend.disabled = true;
    modalSend.innerHTML = '<span class="spinner"></span> Resetting...';

    fetch("api/reset_password.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        role: "driver",
        newPassword: newPass,
        confirmPassword: confirmPass,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        modalSend.disabled = false;
        modalSend.innerHTML = "Reset Password";

        if (data.success) {
          modalMsg.innerHTML =
            '<i class="fas fa-check-circle mr-1"></i> ' +
            (data.message || "Password reset successfully!");
          modalMsg.style.color = "#10b981";

          try {
            const drivers = JSON.parse(localStorage.getItem("borongan_drivers") || "[]");
            const idx = drivers.findIndex((d) => d.username === username);
            if (idx !== -1) {
              drivers[idx].password = newPass;
              localStorage.setItem("borongan_drivers", JSON.stringify(drivers));
            }
          } catch (e) {}

          if (usernameField) usernameField.value = username;
          if (passwordField) passwordField.value = "";

          setTimeout(() => {
            closeForgotModal();
            if (passwordField) passwordField.focus();
          }, 1800);
        } else {
          modalMsg.innerHTML =
            '<i class="fas fa-times-circle mr-1"></i> ' +
            (data.error || "Failed to reset password.");
          modalMsg.style.color = "#b22234";
        }
      })
      .catch(() => {
        modalSend.disabled = false;
        modalSend.innerHTML = "Reset Password";
        modalMsg.innerHTML =
          '<i class="fas fa-exclamation-circle mr-1"></i> Cannot connect to server.';
        modalMsg.style.color = "#b22234";
      });
  }

  if (modalSend) {
    modalSend.addEventListener("click", (e) => {
      e.preventDefault();
      handleResetPassword();
    });
  }

  [resetUser, resetNewPass, resetConfirmPass].forEach((input) => {
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleResetPassword();
        }
      });
    }
  });
})();
