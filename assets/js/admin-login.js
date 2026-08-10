(function() {
            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');
            const toggleBtn = document.getElementById('togglePass');
            const loginBtn = document.getElementById('loginBtn');
            const forgotBtn = document.getElementById('forgotBtn');
            const msgDiv = document.getElementById('formMsg');
            const errorDiv = document.getElementById('errorMsg');

            const modal = document.getElementById('forgotModal');
            const resetUser = document.getElementById('resetUser');
            const modalMsg = document.getElementById('modalMsg');
            const modalCancel = document.getElementById('modalCancel');
            const modalSend = document.getElementById('modalSend');

            // Admin credentials (in a real app, this would be server-side)
            const ADMIN_CREDENTIALS = {
                username: 'admin',
                password: 'admin123'
            };

            // Toggle password visibility
            let pwVisible = false;
            toggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                pwVisible = !pwVisible;
                passwordField.type = pwVisible ? 'text' : 'password';
                const icon = this.querySelector('i');
                icon.className = pwVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
                passwordField.focus();
            });

            // Forgot Password Modal
            forgotBtn.addEventListener('click', function() {
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
            modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
            document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

            modalSend.addEventListener('click', function() {
                const username = resetUser.value.trim();
                if (!username) {
                    modalMsg.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#b22234;"></i> Please enter your admin username.';
                    modalMsg.style.color = '#b22234';
                    return;
                }

                if (username !== ADMIN_CREDENTIALS.username) {
                    modalMsg.innerHTML = '<i class="fas fa-exclamation-circle" style="color:#b22234;"></i> No admin account found with that username.';
                    modalMsg.style.color = '#b22234';
                    return;
                }

                modalMsg.innerHTML = '<i class="fas fa-check-circle" style="color:#1a6d3b;"></i> Reset link sent to your email!';
                modalMsg.style.color = '#1a6d3b';
                setTimeout(function() { closeModal(); }, 2500);
            });

            resetUser.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    modalSend.click();
                }
            });

            // Login handler
            function handleLogin() {
                const username = usernameField.value.trim();
                const password = passwordField.value.trim();

                msgDiv.innerHTML = '';
                errorDiv.classList.remove('show');

                if (!username || !password) {
                    msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1" style="color:#b22234;"></i> Please enter all details.';
                    msgDiv.style.color = '#b22234';
                    return false;
                }

                if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
                    msgDiv.innerHTML = '<i class="fas fa-check-circle mr-1" style="color:#1a6d3b;"></i> Login successful! Redirecting to dashboard...';
                    msgDiv.style.color = '#1a6d3b';
                    
                    localStorage.setItem('admin_logged_in', 'true');
                    
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html';
                    }, 1500);
                    
                    return true;
                } else {
                    errorDiv.classList.add('show');
                    setTimeout(function() { errorDiv.classList.remove('show'); }, 3000);
                    return false;
                }
            }

            loginBtn.addEventListener('click', function(e) { e.preventDefault(); handleLogin(); });
            document.getElementById('loginForm').addEventListener('submit', function(e) { e.preventDefault(); handleLogin(); });

            // Clear messages on focus
            [usernameField, passwordField].forEach(input => {
                input.addEventListener('focus', function() {
                    msgDiv.innerHTML = '';
                    errorDiv.classList.remove('show');
                });
            });

            // Enter key navigation
            usernameField.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordField.focus();
                }
            });

            passwordField.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });

        })();