(function() {
      const usernameField = document.getElementById('username');
      const passwordField = document.getElementById('password');
      const toggleBtn = document.getElementById('togglePass');
      const loginBtn = document.getElementById('loginBtn');
      const forgotBtn = document.getElementById('forgotBtn');
      const msgDiv = document.getElementById('formMsg');
      const successDiv = document.getElementById('successMsg');

      // show registration success message
      if (window.location.search.includes('registered=true')) {
        successDiv.classList.add('show');
        setTimeout(() => successDiv.classList.remove('show'), 5000);
      }

      // session check (driver)
      const session = localStorage.getItem('borongan_driver_session');
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          const drivers = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
          const driverExists = drivers.some(d => d.username === sessionData.username);
          if (driverExists) {
            window.location.href = 'driver-dashboard.html';
            return;
          } else {
            localStorage.removeItem('borongan_driver_session');
          }
        } catch(e) {
          localStorage.removeItem('borongan_driver_session');
        }
      }

      // toggle password visibility
      let pwVisible = false;
      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        pwVisible = !pwVisible;
        passwordField.type = pwVisible ? 'text' : 'password';
        this.querySelector('i').className = pwVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
        passwordField.focus();
      });

      // ----- forgot password modal -----
      const modal = document.getElementById('forgotModal');
      const resetUser = document.getElementById('resetUser');
      const modalMsg = document.getElementById('modalMsg');
      const modalCancel = document.getElementById('modalCancel');
      const modalSend = document.getElementById('modalSend');

      forgotBtn.addEventListener('click', () => {
        modal.classList.add('active');
        resetUser.value = '';
        modalMsg.innerHTML = '';
        resetUser.focus();
      });

      function closeModal() {
        modal.classList.remove('active');
        modalMsg.innerHTML = '';
      }

      modalCancel.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

      modalSend.addEventListener('click', function() {
        const username = resetUser.value.trim();
        if (!username) {
          modalMsg.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#b22234;"></i> Please enter your username.';
          modalMsg.style.color = '#b22234';
          return;
        }
        const stored = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
        const driverExists = stored.some(d => d.username === username);
        if (!driverExists) {
          modalMsg.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#b22234;"></i> No account found with that username.';
          modalMsg.style.color = '#b22234';
          return;
        }
        modalMsg.innerHTML = '<i class="fas fa-check-circle" style="color:#1a6d3b;"></i> Reset link sent to your email!';
        modalMsg.style.color = '#1a6d3b';
        setTimeout(() => closeModal(), 2200);
      });

      resetUser.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); modalSend.click(); } });

      // ----- login logic -----
      function handleLogin() {
        const username = usernameField.value.trim();
        const password = passwordField.value.trim();

        msgDiv.innerHTML = '';
        msgDiv.style.color = '';

        if (!username || !password) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Please enter your username and password.';
          msgDiv.style.color = '#b22234';
          return false;
        }

        if (password.length < 4) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must be at least 4 characters.';
          msgDiv.style.color = '#b22234';
          return false;
        }

        const stored = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
        if (stored.length === 0) {
          msgDiv.innerHTML = '<i class="fas fa-times-circle mr-1"></i> No registered drivers found. Please <a href="register.html" style="color:#0b2b4a;font-weight:600;">register</a> first.';
          msgDiv.style.color = '#b22234';
          return false;
        }

        const driver = stored.find(d => d.username === username);
        if (!driver) {
          msgDiv.innerHTML = '<i class="fas fa-times-circle mr-1"></i> No account found. Please <a href="register.html" style="color:#0b2b4a;font-weight:600;">register</a> first.';
          msgDiv.style.color = '#b22234';
          return false;
        }

        if (driver.password !== password) {
          msgDiv.innerHTML = '<i class="fas fa-times-circle mr-1"></i> Incorrect password. Please try again.';
          msgDiv.style.color = '#b22234';
          return false;
        }

        // success
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';

        msgDiv.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Welcome, ' + driver.fullName + '!';
        msgDiv.style.color = '#1a6d3b';

        localStorage.setItem('borongan_driver_session', JSON.stringify({
          username: driver.username,
          driverId: driver.driverId,
          fullName: driver.fullName,
          loginTime: new Date().toISOString()
        }));
        localStorage.setItem('current_driver', JSON.stringify(driver));

        setTimeout(() => {
          window.location.href = 'driver-dashboard.html';
        }, 1200);

        return true;
      }

      // event listeners
      loginBtn.addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
      document.getElementById('loginForm').addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });

      usernameField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); passwordField.focus(); } });
      passwordField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } });

      // clear error on focus
      [usernameField, passwordField].forEach(input => {
        input.addEventListener('focus', function() {
          const msg = msgDiv.innerHTML;
          if (msg.includes('Invalid') || msg.includes('fill') || msg.includes('valid') || 
              msg.includes('account') || msg.includes('Incorrect') || msg.includes('No registered')) {
            msgDiv.innerHTML = '';
          }
        });
      });

    })();