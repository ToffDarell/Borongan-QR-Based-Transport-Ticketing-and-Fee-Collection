(function() {
      const form = document.getElementById('driverForm');
      const registerBtn = document.getElementById('registerBtn');
      const msgDiv = document.getElementById('registerMsg');
      const successMsg = document.getElementById('successMsg');
      const successText = document.getElementById('successText');

      // ===== Temporary Data Arrays for Duplicate Check =====
      const getExistingPlateNumbers = () => {
        const stored = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
        return stored.map(d => d.plateNumber);
      };

      const getExistingLicenseNumbers = () => {
        const stored = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
        return stored.map(d => d.licenseNo);
      };

      // ===== Set registration date to TODAY =====
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      document.getElementById('registrationDate').value = todayStr;
      document.getElementById('registrationDate').setAttribute('readonly', true);

      // ===== DOM Elements =====
      const vehicleType = document.getElementById('vehicleType');
      const plateInput = document.getElementById('plateNumber');
      const licenseInput = document.getElementById('licenseNo');
      const vehicleTypeError = document.getElementById('vehicleTypeError');
      const plateError = document.getElementById('plateError');
      const licenseError = document.getElementById('licenseError');

      // ===== Get selected plate type =====
      function getSelectedPlateType() {
        const radios = document.querySelectorAll('input[name="plateType"]');
        for (let radio of radios) {
          if (radio.checked) return radio.value;
        }
        return 'Temporary';
      }

      // ===== Get selected license type =====
      function getSelectedLicenseType() {
        const radios = document.querySelectorAll('input[name="licenseType"]');
        for (let radio of radios) {
          if (radio.checked) return radio.value;
        }
        return 'Non-Professional';
      }

      // ===== Validation Functions =====

      function validateVehicleType() {
        const value = vehicleType.value;
        if (!value) {
          vehicleType.classList.add('input-error');
          vehicleTypeError.classList.add('show');
          return false;
        } else {
          vehicleType.classList.remove('input-error');
          vehicleTypeError.classList.remove('show');
          return true;
        }
      }

      function validatePlateNumber() {
        const plate = plateInput.value.trim();
        if (!plate) {
          plateInput.classList.add('input-error');
          plateError.textContent = 'Please enter your plate number.';
          plateError.classList.add('show');
          return false;
        }
        if (plate.length < 3 || plate.length > 15) {
          plateInput.classList.add('input-error');
          plateError.textContent = 'Plate number must be between 3 and 15 characters.';
          plateError.classList.add('show');
          return false;
        }
        if (!/^[A-Za-z0-9\s-]+$/.test(plate)) {
          plateInput.classList.add('input-error');
          plateError.textContent = 'Use letters, numbers, and hyphens only.';
          plateError.classList.add('show');
          return false;
        }
        const existingPlates = getExistingPlateNumbers();
        if (existingPlates.includes(plate.toUpperCase())) {
          plateInput.classList.add('input-error');
          plateError.textContent = 'Plate number already registered.';
          plateError.classList.add('show');
          return false;
        }
        plateInput.classList.remove('input-error');
        plateError.classList.remove('show');
        return true;
      }

      function validateLicenseNumber() {
        const license = licenseInput.value.trim();
        if (!license) {
          licenseInput.classList.add('input-error');
          licenseError.textContent = 'Please enter your driver\'s license number.';
          licenseError.classList.add('show');
          return false;
        }
        if (license.length < 5 || license.length > 20) {
          licenseInput.classList.add('input-error');
          licenseError.textContent = 'License number must be between 5 and 20 characters.';
          licenseError.classList.add('show');
          return false;
        }
        if (!/^[A-Za-z0-9-]+$/.test(license)) {
          licenseInput.classList.add('input-error');
          licenseError.textContent = 'Use letters, numbers, and hyphens only.';
          licenseError.classList.add('show');
          return false;
        }
        const existingLicenses = getExistingLicenseNumbers();
        if (existingLicenses.includes(license.toUpperCase())) {
          licenseInput.classList.add('input-error');
          licenseError.textContent = 'Driver\'s license number already registered.';
          licenseError.classList.add('show');
          return false;
        }
        licenseInput.classList.remove('input-error');
        licenseError.classList.remove('show');
        return true;
      }

      // ===== Real-time Validation =====
      vehicleType.addEventListener('change', validateVehicleType);

      plateInput.addEventListener('input', function() {
        if (plateInput.classList.contains('input-error')) {
          plateInput.classList.remove('input-error');
          plateError.classList.remove('show');
        }
      });
      plateInput.addEventListener('blur', validatePlateNumber);

      licenseInput.addEventListener('input', function() {
        if (licenseInput.classList.contains('input-error')) {
          licenseInput.classList.remove('input-error');
          licenseError.classList.remove('show');
        }
      });
      licenseInput.addEventListener('blur', validateLicenseNumber);

      // ===== Radio button change - update hints =====
      document.querySelectorAll('input[name="plateType"]').forEach(radio => {
        radio.addEventListener('change', function() {
          const hint = document.getElementById('plateHint');
          const type = getSelectedPlateType();
          let example = '';
          if (type === 'Temporary') {
            example = 'e.g., TEMP-12345';
          } else if (type === 'Old') {
            example = 'e.g., ABC-1234';
          } else {
            example = 'e.g., NEW-1234-AB';
          }
          hint.innerHTML = `<i class="fas fa-info-circle mr-1"></i> ${type}: Letters, numbers, hyphens (${example})`;
        });
      });

      // ===== Password Toggle =====
      const togglePass = document.getElementById('togglePassword');
      const toggleConfirm = document.getElementById('toggleConfirm');
      const passInput = document.getElementById('password');
      const confirmInput = document.getElementById('confirmPassword');

      togglePass.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        this.querySelector('i').className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
        passInput.focus();
      });

      toggleConfirm.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const isPass = confirmInput.type === 'password';
        confirmInput.type = isPass ? 'text' : 'password';
        this.querySelector('i').className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
        confirmInput.focus();
      });

      // ===== Password Strength =====
      const bars = [
        document.getElementById('bar1'),
        document.getElementById('bar2'),
        document.getElementById('bar3'),
        document.getElementById('bar4')
      ];
      const strengthText = document.getElementById('pwStrengthText');

      function checkPasswordStrength(password) {
        let score = 0;
        const checks = {
          length: password.length >= 8,
          upper: /[A-Z]/.test(password),
          lower: /[a-z]/.test(password),
          number: /\d/.test(password),
          special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        document.getElementById('reqLength').innerHTML = checks.length ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>';
        document.getElementById('reqUpper').innerHTML = checks.upper ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>';
        document.getElementById('reqLower').innerHTML = checks.lower ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>';
        document.getElementById('reqNumber').innerHTML = checks.number ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>';
        document.getElementById('reqSpecial').innerHTML = checks.special ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-circle"></i>';

        document.querySelectorAll('.req .icon').forEach(el => {
          if (el.innerHTML.includes('check-circle')) {
            el.className = 'icon valid';
          } else {
            el.className = 'icon invalid';
          }
        });

        if (checks.length) score++;
        if (checks.upper) score++;
        if (checks.lower) score++;
        if (checks.number) score++;
        if (checks.special) score++;

        bars.forEach((bar, i) => {
          bar.className = 'pw-strength-bar';
          if (i < score) {
            bar.classList.add('active');
            if (score <= 2) bar.classList.add('weak');
            else if (score <= 3) bar.classList.add('medium');
            else bar.classList.add('strong');
          }
        });

        if (password.length === 0) {
          strengthText.textContent = 'Enter a password';
          strengthText.style.color = '#6b7280';
        } else if (score <= 2) {
          strengthText.textContent = 'Weak password';
          strengthText.style.color = '#ef4444';
        } else if (score <= 3) {
          strengthText.textContent = 'Medium password';
          strengthText.style.color = '#f59e0b';
        } else {
          strengthText.textContent = 'Strong password!';
          strengthText.style.color = '#22c55e';
        }

        return checks;
      }

      passInput.addEventListener('input', function() {
        checkPasswordStrength(this.value);
        checkConfirmMatch();
      });

      function checkConfirmMatch() {
        const pass = passInput.value;
        const confirm = confirmInput.value;
        const matchDiv = document.getElementById('confirmMatch');
        if (confirm.length === 0) {
          matchDiv.textContent = '';
          matchDiv.style.color = '#6b7280';
          return;
        }
        if (pass === confirm) {
          matchDiv.textContent = '✓ Passwords match';
          matchDiv.style.color = '#22c55e';
        } else {
          matchDiv.textContent = '✗ Passwords do not match';
          matchDiv.style.color = '#ef4444';
        }
      }

      confirmInput.addEventListener('input', checkConfirmMatch);

      // ===== Helper Functions =====
      function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      function formatDate(dateStr) {
        if (!dateStr) return '--';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }

      // ===== Form Submit =====
      form.addEventListener('submit', async function(e) {
        e.preventDefault();

        msgDiv.innerHTML = '';
        successMsg.classList.remove('show');

        const isVehicleTypeValid = validateVehicleType();
        const isPlateValid = validatePlateNumber();
        const isLicenseValid = validateLicenseNumber();

        const fullName = document.getElementById('fullName').value.trim();
        const address = document.getElementById('address').value.trim();
        const contact = document.getElementById('contact').value.trim();
        const birthdate = document.getElementById('birthdate').value;
        const gender = document.getElementById('gender').value;
        const registrationDate = document.getElementById('registrationDate').value;
        const licenseExpiration = document.getElementById('licenseExpiration').value;
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const photoFile = document.getElementById('photoUpload').files[0];
        const plateType = getSelectedPlateType();
        const licenseType = getSelectedLicenseType();

        if (!fullName) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Full Name is required.'; return; }
        if (!address) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Address is required.'; return; }
        if (!contact) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Contact Number is required.'; return; }
        if (!birthdate) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Birthdate is required.'; return; }
        if (!gender) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Gender is required.'; return; }
        if (!registrationDate) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Registration Date is required.'; return; }
        if (!licenseExpiration) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> License Expiration is required.'; return; }
        if (!username) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Username is required.'; return; }
        if (!password) { msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password is required.'; return; }

        if (!isVehicleTypeValid || !isPlateValid || !isLicenseValid) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Please fix all errors before continuing.';
          return;
        }

        if (licenseExpiration <= registrationDate) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> License expiration must be after registration date.';
          return;
        }

        const pwChecks = checkPasswordStrength(password);
        const isStrong = pwChecks.length && pwChecks.upper && pwChecks.lower && pwChecks.number && pwChecks.special;
        if (!isStrong) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
          return;
        }

        if (password !== confirmPassword) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Passwords do not match.';
          return;
        }

        const stored = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
        if (stored.some(d => d.username === username)) {
          msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Username already taken.';
          return;
        }

        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span class="spinner"></span> Registering...';

        let lastId = 0;
        stored.forEach(d => {
          const num = parseInt(d.driverId.split('-')[1]);
          if (num > lastId) lastId = num;
        });
        const driverId = `DR-${String(lastId + 1).padStart(4, '0')}`;

        const driverData = {
          driverId,
          fullName,
          address,
          contact,
          birthdate,
          gender,
          vehicleType: vehicleType.value,
          plateType: plateType,
          plateNumber: plateInput.value.trim().toUpperCase(),
          licenseType: licenseType,
          licenseNo: licenseInput.value.trim().toUpperCase(),
          registrationDate: formatDate(registrationDate),
          licenseExpiration: formatDate(licenseExpiration),
          username,
          password,
          status: 'Active',
          photo: null
        };

        if (photoFile) {
          try {
            driverData.photo = await readFileAsDataURL(photoFile);
          } catch (err) {
            msgDiv.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Failed to read photo.';
            registerBtn.disabled = false;
            registerBtn.innerHTML = 'Register Driver';
            return;
          }
        }

        stored.push(driverData);
        localStorage.setItem('borongan_drivers', JSON.stringify(stored));

        console.log('Driver registered:', driverData);

        successText.textContent = `Account created successfully for ${fullName}!`;
        successMsg.classList.add('show');

        form.reset();
        document.getElementById('registrationDate').value = todayStr;
        registerBtn.innerHTML = '✓ Registered!';

        setTimeout(function() {
          window.location.href = 'login.html?registered=true';
        }, 3000);
      });

      document.querySelectorAll('#driverForm input, #driverForm select').forEach(el => {
        el.addEventListener('focus', () => {
          if (msgDiv.textContent.includes('required') || msgDiv.textContent.includes('match') || 
              msgDiv.textContent.includes('characters') || msgDiv.textContent.includes('already') || 
              msgDiv.textContent.includes('format') || msgDiv.textContent.includes('Invalid') ||
              msgDiv.textContent.includes('fix all errors')) {
            msgDiv.innerHTML = '';
          }
        });
      });

    })();