// ===== DATA =====
// Native HTML5 <dialog> styled Confirmation Modal Utility
const ConfirmModal = {
  show({ title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm }) {
    let dialog = document.getElementById("nativeConfirmDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "nativeConfirmDialog";
      dialog.className = "confirm-dialog-modal";
      dialog.innerHTML = `
        <div class="confirm-dialog-content">
          <h3 id="nativeConfirmTitle" class="confirm-dialog-title"></h3>
          <p id="nativeConfirmMsg" class="confirm-dialog-msg"></p>
          <div class="confirm-dialog-actions">
            <button id="nativeConfirmCancelBtn" class="confirm-dialog-btn confirm-dialog-btn-cancel"></button>
            <button id="nativeConfirmConfirmBtn" class="confirm-dialog-btn confirm-dialog-btn-confirm"></button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    dialog.querySelector("#nativeConfirmTitle").textContent = title;
    dialog.querySelector("#nativeConfirmMsg").textContent = message;
    
    const cancelBtn = dialog.querySelector("#nativeConfirmCancelBtn");
    const confirmBtn = dialog.querySelector("#nativeConfirmConfirmBtn");
    
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;

    const closeDialog = () => {
      dialog.close();
    };

    cancelBtn.onclick = () => {
      closeDialog();
    };

    confirmBtn.onclick = () => {
      closeDialog();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };

    dialog.showModal();
  }
};

        let currentDriver = null;
        let driverTransactions = [];
        let tempPhotoDataURL = null;
        let driverActivityLog = [];
        let driverNotifications = [];
        let knownDriverPaymentIds = new Set();
        let driverPaymentPollingTimer = null;
        let driverPaymentRefreshInProgress = false;

        function updateLastUpdated() {
            document.getElementById('lastUpdatedTime').textContent = new Date().toLocaleTimeString();
        }

        function getActivityLog(driverId) {
            const key = 'borongan_driver_activity_' + driverId;
            const stored = localStorage.getItem(key);
            if (stored) {
                try { return JSON.parse(stored); } catch { return []; }
            }
            return [];
        }

        function saveActivityLog(driverId, log) {
            const key = 'borongan_driver_activity_' + driverId;
            localStorage.setItem(key, JSON.stringify(log));
        }

        // Keep driver notifications separate per driver so one driver's payment
        // alerts cannot appear in another driver's account on the same browser.
        function getDriverNotificationStorageKey() {
            return 'borongan_driver_notifications_' + (currentDriver ? currentDriver.driverId : 'unknown');
        }

        // Notification content is rendered into HTML, so escape dynamic values
        // such as receipt numbers before placing them in the notification panel.
        function escapeDriverNotificationHtml(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[character]));
        }

        function formatDriverNotificationTime(timestamp) {
            const date = new Date(timestamp);
            if (Number.isNaN(date.getTime())) return '';
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }

        function saveDriverNotifications() {
            try {
                localStorage.setItem(getDriverNotificationStorageKey(), JSON.stringify(driverNotifications));
            } catch (error) {
                console.warn('Unable to save driver notifications', error);
            }
        }

        function renderDriverNotifications() {
            const list = document.getElementById('driverNotificationList');
            const badge = document.getElementById('driverNotificationBadge');
            if (!list || !badge) return;

            const unreadCount = driverNotifications.filter(notification => !notification.read).length;
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.hidden = unreadCount === 0;

            if (driverNotifications.length === 0) {
                list.innerHTML = '<div class="driver-notification__empty">No notifications yet.</div>';
                return;
            }

            list.innerHTML = driverNotifications.slice(0, 30).map(notification => `
                <div role="listitem">
                    <button type="button" class="driver-notification__item ${notification.read ? '' : 'is-unread'}"
                        data-driver-notification-id="${escapeDriverNotificationHtml(notification.id)}">
                        <span class="driver-notification__icon"><i class="fas fa-receipt" aria-hidden="true"></i></span>
                        <span>
                            <span class="driver-notification__title">${escapeDriverNotificationHtml(notification.title)}</span>
                            <span class="driver-notification__message">${escapeDriverNotificationHtml(notification.message)}</span>
                            <span class="driver-notification__time">${escapeDriverNotificationHtml(formatDriverNotificationTime(notification.timestamp))}</span>
                        </span>
                    </button>
                </div>
            `).join('');
        }

        function addDriverPaymentNotification(payment) {
            const paymentId = String(payment.id || '');
            if (!paymentId || driverNotifications.some(notification => notification.paymentId === paymentId)) return;

            const amount = Number(payment.amount || 0).toFixed(2);
            const paymentDate = [payment.date, payment.time].filter(Boolean).join(' ');
            driverNotifications.unshift({
                id: 'driver-notification-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                paymentId: paymentId,
                title: 'Terminal fee collected',
                message: '₱' + amount + ' · Receipt ' + paymentId + (paymentDate ? ' · ' + paymentDate : ''),
                timestamp: new Date().toISOString(),
                read: false
            });
            driverNotifications = driverNotifications.slice(0, 50);
            saveDriverNotifications();
            renderDriverNotifications();
        }

        function seedTodayDriverPaymentNotifications() {
            const today = new Date().toISOString().split('T')[0];
            driverTransactions
                .filter(payment => payment.date === today)
                .slice()
                .sort((first, second) => String(first.time || '').localeCompare(String(second.time || '')))
                .forEach(addDriverPaymentNotification);
        }

        function initDriverNotifications() {
            try {
                const stored = JSON.parse(localStorage.getItem(getDriverNotificationStorageKey()) || '[]');
                driverNotifications = Array.isArray(stored) ? stored : [];
            } catch (error) {
                driverNotifications = [];
            }

            // Mark the transactions already loaded as known. Polling will only
            // create a new alert when a later API response contains a new receipt.
            knownDriverPaymentIds = new Set(driverTransactions.map(payment => String(payment.id || '')));
            seedTodayDriverPaymentNotifications();

            const bell = document.getElementById('driverNotificationBell');
            const panel = document.getElementById('driverNotificationPanel');
            const wrapper = document.getElementById('driverNotification');
            const list = document.getElementById('driverNotificationList');
            const markRead = document.getElementById('markDriverNotificationsRead');
            if (!bell || !panel || !wrapper || !list || !markRead) return;

            bell.addEventListener('click', event => {
                event.stopPropagation();
                const isOpen = panel.hidden;
                panel.hidden = !isOpen;
                bell.setAttribute('aria-expanded', String(isOpen));
            });

            markRead.addEventListener('click', event => {
                event.stopPropagation();
                driverNotifications = driverNotifications.map(notification => ({ ...notification, read: true }));
                saveDriverNotifications();
                renderDriverNotifications();
            });

            list.addEventListener('click', event => {
                const item = event.target.closest('[data-driver-notification-id]');
                if (!item) return;
                const notificationId = item.getAttribute('data-driver-notification-id');
                driverNotifications = driverNotifications.map(notification => notification.id === notificationId
                    ? { ...notification, read: true }
                    : notification);
                saveDriverNotifications();
                renderDriverNotifications();
            });

            document.addEventListener('click', event => {
                if (!wrapper.contains(event.target)) {
                    panel.hidden = true;
                    bell.setAttribute('aria-expanded', 'false');
                }
            });

            renderDriverNotifications();
        }

        async function refreshDriverPayments() {
            if (driverPaymentRefreshInProgress || !currentDriver) return;
            driverPaymentRefreshInProgress = true;
            const previousPaymentIds = new Set(knownDriverPaymentIds);

            try {
                await loadDriverTransactions();
                const newPayments = driverTransactions.filter(payment => {
                    const paymentId = String(payment.id || '');
                    return paymentId && !previousPaymentIds.has(paymentId);
                });
                knownDriverPaymentIds = new Set(driverTransactions.map(payment => String(payment.id || '')));

                if (newPayments.length > 0) {
                    newPayments
                        .slice()
                        .sort((first, second) => (String(first.date || '') + String(first.time || ''))
                            .localeCompare(String(second.date || '') + String(second.time || '')))
                        .forEach(addDriverPaymentNotification);
                    populateDashboard();
                    renderPaymentHistory();
                    checkPaymentReminder();
                }
            } finally {
                driverPaymentRefreshInProgress = false;
            }
        }

        function startDriverPaymentPolling() {
            if (driverPaymentPollingTimer) clearInterval(driverPaymentPollingTimer);
            driverPaymentPollingTimer = setInterval(refreshDriverPayments, 5000);
        }

        function logDriverActivity(action, icon = 'fa-info-circle', logClass = 'log-login') {
            if (!currentDriver) return;
            const now = new Date();
            const timeStr = now.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const entry = {
                action: action,
                time: timeStr,
                timestamp: now.toISOString(),
                icon: icon,
                logClass: logClass
            };
            driverActivityLog = getActivityLog(currentDriver.driverId);
            driverActivityLog.unshift(entry);
            if (driverActivityLog.length > 200) driverActivityLog = driverActivityLog.slice(0, 200);
            saveActivityLog(currentDriver.driverId, driverActivityLog);
            renderActivities();
        }

        function renderActivities() {
            const container = document.getElementById('recentActivities');
            if (!currentDriver) { container.innerHTML =
                    '<div class="text-center py-4 text-gray-400 text-sm">No recent activities</div>'; return; }
            driverActivityLog = getActivityLog(currentDriver.driverId);
            if (!driverActivityLog || driverActivityLog.length === 0) {
                container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">No recent activities</div>';
                return;
            }
            container.innerHTML = driverActivityLog.slice(0, 10).map(log => `
                <div class="activity-log-item ${log.logClass || 'log-login'}">
                    <div class="log-left">
                        <span class="log-icon"></span>
                        <span class="log-action">${log.action}</span>
                    </div>
                    <span class="log-time">${log.time}</span>
                </div>
            `).join('');
        }

        function getDriverFromAdminData(username) {
            const current = localStorage.getItem('current_driver');
            if (current) {
                try { return JSON.parse(current); } catch {}
            }
            const raw = localStorage.getItem('borongan_drivers');
            if (!raw) return null;
            try { return JSON.parse(raw).find(d => d.username === username) || null; } catch { return null; }
        }

        function saveDriverData(updated) {
            const raw = localStorage.getItem('borongan_drivers');
            if (!raw) return false;
            try {
                const drivers = JSON.parse(raw);
                const idx = drivers.findIndex(d => d.driverId === updated.driverId);
                if (idx === -1) return false;
                drivers[idx] = updated;
                localStorage.setItem('borongan_drivers', JSON.stringify(drivers));
                return true;
            } catch { return false; }
        }

        function getDriverTransactions(driverId) {
            const raw = localStorage.getItem('borongan_transactions');
            if (!raw) return [];
            try { return JSON.parse(raw).filter(t => t.driverId === driverId); } catch { return []; }
        }

        function getFee(vehicleType) {
            const fees = { 'Tricycle': 5, 'Jeepney': 60, 'Multicab': 60, 'Bus': 100 };
            return fees[vehicleType] || 0;
        }

        function checkAuth() {
            const session = localStorage.getItem('borongan_driver_session');
            if (!session) { window.location.href = 'login.html'; return false; }
            try {
                const s = JSON.parse(session);
                if (s.expires && new Date(s.expires) < new Date()) { localStorage.removeItem('borongan_driver_session');
                    window.location.href = 'login.html'; return false; }
                return true;
            } catch { window.location.href = 'login.html'; return false; }
        }

        async function initDriverDashboard() {
            if (!checkAuth()) return;
            const session = JSON.parse(localStorage.getItem('borongan_driver_session'));
            const username = session.username;
            currentDriver = getDriverFromAdminData(username);
            if (!currentDriver) {
                showToast('Driver not found.', 'error');
                setTimeout(() => { localStorage.removeItem('borongan_driver_session');
                    window.location.href = 'login.html'; }, 2000);
                return;
            }
            await loadDriverTransactions();
            initDriverNotifications();
            startDriverPaymentPolling();

            logDriverActivity('Logged in to dashboard', 'fa-sign-in-alt', 'log-login');

            document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long',
                year: 'numeric', month: 'long', day: 'numeric' });
            updateLastUpdated();
            setInterval(updateLastUpdated, 60000);
            populateDashboard();
            generateQR();
            populateQRPage();
            renderPaymentHistory();
            populateProfile();
            renderActivities();
            checkPaymentReminder();
        }

        function populateDashboard() {
            const d = currentDriver;
            const fee = getFee(d.vehicleType);

            document.getElementById('driverName').textContent = d.fullName;

            const photo = document.getElementById('profilePhoto');
            if (d.photo) photo.innerHTML = `<img src="${d.photo}" alt="Driver">`;
            else photo.textContent = d.fullName.charAt(0).toUpperCase();

            document.getElementById('statVehicle').textContent = d.vehicleType;
            document.getElementById('statPlate').textContent = d.plateNumber;

            const today = new Date().toISOString().split('T')[0];
            const todayTrans = driverTransactions.filter(t => t.date === today);
            const todayTotal = todayTrans.reduce((s, t) => s + t.amount, 0);
            document.getElementById('todayPayment').textContent = '₱' + todayTotal;

            const statusEl = document.getElementById('paymentStatusBadge');
            if (todayTrans.length > 0) {
                statusEl.textContent = 'Paid Today';
                statusEl.className = 'status-badge paid';
            } else {
                statusEl.textContent = 'Pending';
                statusEl.className = 'status-badge pending';
            }

            document.getElementById('totalPayments').textContent = driverTransactions.filter(t => t.status === 'Paid' || !t
                .status).length;

            if (driverTransactions.length > 0) {
                const last = driverTransactions[driverTransactions.length - 1];
                document.getElementById('lastPayment').textContent = '₱' + last.amount;
                document.getElementById('lastPaymentTime').textContent = last.date;
            } else {
                document.getElementById('lastPayment').textContent = '--';
                document.getElementById('lastPaymentTime').textContent = '--';
            }

            document.getElementById('qrDriverName').textContent = d.fullName;
            document.getElementById('qrVehicleType').textContent = d.vehicleType;
            document.getElementById('qrPlateNumber').textContent = d.plateNumber;
            document.getElementById('qrFee').textContent = '₱' + fee;
            document.getElementById('infoVehicleType').textContent = d.vehicleType;
            document.getElementById('infoPlateNumber').textContent = d.plateNumber;
            document.getElementById('infoFee').textContent = '₱' + fee;
            document.getElementById('infoStatus').textContent = d.status || 'Active';
        }

        function generateQR() {
            const d = currentDriver;
            const qrText =
                `ID:${d.driverId}|Name:${d.fullName}|Plate:${d.plateNumber}|Type:${d.vehicleType}|Fee:${getFee(d.vehicleType)}`;

            const qrEl = document.getElementById('qrCode');
            if (qrEl) {
                qrEl.innerHTML = '';
                try {
                    new QRCode(qrEl, { text: qrText, width: 130, height: 130, colorDark: '#b22234', colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H });
                } catch { qrEl.innerHTML = '<p class="text-gray-400">QR</p>'; }
            }

            const qrFullEl = document.getElementById('qrCodeFull');
            if (qrFullEl) {
                qrFullEl.innerHTML = '';
                try {
                    new QRCode(qrFullEl, { text: qrText, width: 130, height: 130, colorDark: '#b22234',
                        colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
                } catch { qrFullEl.innerHTML = '<p class="text-gray-400">QR</p>'; }
            }

            logDriverActivity('Viewed QR Code', 'fa-qrcode', 'log-qr');
        }

        function populateQRPage() {
            const d = currentDriver;
            document.getElementById('displayRegNumber').textContent = d.driverId || '--';
            document.getElementById('displayIdBadge').textContent = d.driverId || '--';
            document.getElementById('displayName').textContent = d.fullName || 'N/A';
            document.getElementById('displayBirthdate').textContent = d.birthdate || 'N/A';
            document.getElementById('displayGender').textContent = d.gender || 'N/A';
            document.getElementById('displayContact').textContent = d.contact || 'N/A';
            document.getElementById('displayVehicle').textContent = d.vehicleType || 'N/A';
            document.getElementById('displayPlate').textContent = d.plateNumber || 'N/A';
            document.getElementById('displayLicense').textContent = d.licenseNo || 'N/A';

            const photoLarge = document.getElementById('photoDisplayLarge');
            if (d.photo) {
                photoLarge.innerHTML = `<img src="${d.photo}" alt="Driver Photo">`;
            } else {
                const initials = (d.fullName || 'Driver').split(' ')
                    .filter(n => n.length > 0)
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                photoLarge.innerHTML = `<span class="photo-initials">${initials || 'DR'}</span>`;
            }
        }

        function downloadQRFull() {
            const card = document.querySelector('.digital-id-card');
            if (!card) { showToast('Generate ID first', 'warning'); return; }
            showToast('Generating download...', 'success');
            html2canvas(card, {
                scale: 2,
                backgroundColor: '#ffffff',
                allowTaint: false,
                useCORS: true,
                logging: false
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `DriverID_${currentDriver.driverId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('ID downloaded successfully!', 'success');
                logDriverActivity('Downloaded Driver ID', 'fa-download', 'log-profile');
            }).catch(err => {
                showToast('Download failed, use Print for best quality', 'warning');
                console.error(err);
            });
        }

        function downloadQR() {
            const canvas = document.querySelector('#qrCode canvas');
            if (canvas) {
                // Download only the QR code image, not the whole card
                const link = document.createElement('a');
                link.download = `QR_${currentDriver.driverId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('QR downloaded!', 'success');
                logDriverActivity('Downloaded QR Code', 'fa-download', 'log-qr');
            } else showToast('Generate QR first', 'warning');
        }

        function shareQR() {
            if (navigator.share) {
                const canvas = document.querySelector('#qrCode canvas');
                if (canvas) canvas.toBlob(blob => { navigator.share({ title: 'My QR Code', files: [new File([blob],
                            'qr.png', { type: 'image/png' })] }).catch(() => {}); });
                logDriverActivity('Shared QR Code', 'fa-share-alt', 'log-qr');
            } else showToast('Share not supported', 'warning');
        }

        function printQRCard() {
            // Ensure receipt area is hidden before printing QR
            document.getElementById('receiptPrintArea').classList.remove('show-receipt-print');
            window.print();
        }

        function renderPaymentHistory() {
            const search = document.getElementById('paymentSearch')?.value.toLowerCase() || '';
            const filter = document.getElementById('paymentFilter')?.value || 'all';
            const table = document.getElementById('paymentHistoryTable');
            const count = document.getElementById('paymentCount');
            const count2 = document.getElementById('paymentCount2');
            let data = driverTransactions;
            if (filter !== 'all') data = data.filter(t => t.status === filter);
            if (search) data = data.filter(t => t.id.toLowerCase().includes(search) || (t.status && t.status.toLowerCase()
                .includes(search)));

            const totalPaid = driverTransactions.reduce((sum, t) => sum + t.amount, 0);
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthPaid = driverTransactions.filter(t => new Date(t.date) >= monthStart).reduce((sum, t) => sum + t.amount,
                0);
            document.getElementById('totalPaidAmount').textContent = '₱' + totalPaid;
            document.getElementById('monthPaidAmount').textContent = '₱' + monthPaid;
            count.textContent = data.length;
            count2.textContent = data.length;

            if (data.length === 0) { table.innerHTML =
                    '<tr><td colspan="6"><div class="empty-state py-4"><i class="fas fa-receipt"></i><h3>No payments found</h3></div></td></tr>';
                return; }
            table.innerHTML = data.map(t => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-2 font-mono text-xs">${t.id}</td>
              <td class="py-2">${t.date}</td>
              <td class="py-2">${t.time}</td>
              <td class="py-2 font-bold text-primary">₱${t.amount}</td>
              <td class="py-2"><span class="status-badge ${t.status ? t.status.toLowerCase() : 'paid'}">${t.status || 'Paid'}</span></td>
              <td class="py-2">
                <button class="btn-primary btn-sm" onclick="viewReceipt('${t.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn-outline btn-sm" onclick="printReceipt('${t.id}')"><i class="fas fa-print"></i></button>
              </td>
            </tr>
          `).join('');
        }

        function viewReceipt(id) {
            const t = driverTransactions.find(x => x.id === id);
            if (t) {
                document.getElementById('rReceiptNo').textContent = t.id;
                document.getElementById('rDate').textContent = t.date;
                document.getElementById('rTime').textContent = t.time;
                document.getElementById('rDriver').textContent = currentDriver.fullName;
                document.getElementById('rPlate').textContent = currentDriver.plateNumber;
                document.getElementById('rVehicle').textContent = currentDriver.vehicleType;
                document.getElementById('rAmount').textContent = '₱' + t.amount;
                document.getElementById('rStatus').textContent = t.status || 'PAID';
                const printArea = document.getElementById('receiptPrintArea');
                printArea.classList.add('show-receipt-print');
                printArea.style.display = 'block';
                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        printArea.style.display = 'none';
                        printArea.classList.remove('show-receipt-print');
                    }, 500);
                }, 100);
                logDriverActivity('Viewed receipt #' + id, 'fa-eye', 'log-payment');
            } else {
                showToast('Receipt not found', 'error');
            }
        }

        function printReceipt(id) {
            const t = driverTransactions.find(x => x.id === id);
            if (t) {
                document.getElementById('rReceiptNo').textContent = t.id;
                document.getElementById('rDate').textContent = t.date;
                document.getElementById('rTime').textContent = t.time;
                document.getElementById('rDriver').textContent = currentDriver.fullName;
                document.getElementById('rPlate').textContent = currentDriver.plateNumber;
                document.getElementById('rVehicle').textContent = currentDriver.vehicleType;
                document.getElementById('rAmount').textContent = '₱' + t.amount;
                document.getElementById('rStatus').textContent = t.status || 'PAID';
                const printArea = document.getElementById('receiptPrintArea');
                printArea.classList.add('show-receipt-print');
                printArea.style.display = 'block';
                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        printArea.style.display = 'none';
                        printArea.classList.remove('show-receipt-print');
                    }, 500);
                }, 100);
                logDriverActivity('Printed receipt #' + id, 'fa-print', 'log-payment');
            } else {
                showToast('Receipt not found', 'error');
            }
        }

        async function loadDriverTransactions() {
            try {
                const res = await fetch('api/payments.php?driverId=' + encodeURIComponent(currentDriver.driverId));
                const data = await res.json();
                if (data.success) {
                    driverTransactions = data.payments.map(t => ({
                        ...t,
                        amount: Number(t.amount || 0),
                        status: t.status || 'Paid',
                        vehicleType: t.vehicleType || currentDriver.vehicleType,
                        plateNumber: t.plateNumber || currentDriver.plateNumber
                    }));
                    return;
                }
            } catch (error) {
                console.error('Unable to load payment history', error);
            }

            // Keep old local demo records visible if the API is unavailable.
            driverTransactions = getDriverTransactions(currentDriver.driverId);
        }

        function checkPaymentReminder() {
            const today = new Date().toISOString().split('T')[0];
            const todayTrans = driverTransactions.filter(t => t.date === today);
            const el = document.getElementById('paymentReminder');
            if (todayTrans.length === 0) {
                el.innerHTML = `
              <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                <i class="fas fa-info-circle text-yellow-600 text-xl"></i>
                <div>
                  <div class="font-semibold text-yellow-800">No terminal collection recorded today</div>
                  <div class="text-sm text-yellow-700">Present your QR code to the terminal officer when you arrive. The officer will scan your QR code and collect the configured fee.</div>
                </div>
              </div>
            `;
            } else {
                el.innerHTML = `
              <div class="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <i class="fas fa-check-circle text-green-600 text-xl"></i>
                <div><div class="font-semibold text-green-800">Terminal collection recorded</div><div class="text-sm text-green-700">${todayTrans.length} collection${todayTrans.length === 1 ? '' : 's'} recorded today. Latest receipt: ${todayTrans[0].id}</div></div>
              </div>
            `;
            }
        }

        function populateProfile() {
            const d = currentDriver;
            const fee = getFee(d.vehicleType);
            const photo = document.getElementById('profilePhoto');
            if (d.photo) photo.innerHTML = `<img src="${d.photo}" alt="Driver">`;
            else photo.textContent = d.fullName.charAt(0).toUpperCase();
            document.getElementById('profileName').textContent = d.fullName;
            document.getElementById('profileId').textContent = d.driverId;
            document.getElementById('profileFullName').textContent = d.fullName;
            document.getElementById('profileAddress').textContent = d.address || '--';
            document.getElementById('profileContact').textContent = d.contact || '--';
            document.getElementById('profileBirthdate').textContent = d.birthdate || '--';
            document.getElementById('profileGender').textContent = d.gender || '--';
            document.getElementById('profileLicense').textContent = d.licenseNo || '--';
            document.getElementById('profileUsername').textContent = d.username || '--';
            document.getElementById('profileVehicleType').textContent = d.vehicleType;
            document.getElementById('profilePlateNumber').textContent = d.plateNumber;
            document.getElementById('profileFee').textContent = '₱' + fee;
            document.getElementById('profileRegDate').textContent = d.registrationDate || '--';
            document.getElementById('profileLicenseExp').textContent = d.licenseExpiration || '--';
        }

        function openEditProfileModal() {
            const d = currentDriver;
            document.getElementById('editFullName').value = d.fullName || '';
            document.getElementById('editAddress').value = d.address || '';
            document.getElementById('editContact').value = d.contact || '';
            document.getElementById('editBirthdate').value = d.birthdate || '';
            document.getElementById('editGender').value = d.gender || 'Male';
            document.getElementById('editLicenseNo').value = d.licenseNo || '';
            document.getElementById('editUsername').value = d.username || '';
            document.getElementById('editVehicleType').value = d.vehicleType || 'Tricycle';
            document.getElementById('editPlateNumber').value = d.plateNumber || '';
            document.getElementById('editLicenseExp').value = d.licenseExpiration || '';
            document.getElementById('regDateDisplay').textContent = d.registrationDate || '--';
            document.getElementById('editPhoto').value = '';
            const preview = document.getElementById('photoPreview');
            if (d.photo) preview.innerHTML = `<img src="${d.photo}" alt="Current">`;
            else preview.innerHTML = '<i class="fas fa-user"></i>';
            tempPhotoDataURL = null;
            openModal('editProfileModal');
        }

        document.getElementById('editProfileForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = 'Saving...';
            setTimeout(() => {
                const fullName = document.getElementById('editFullName').value.trim();
                const address = document.getElementById('editAddress').value.trim();
                const contact = document.getElementById('editContact').value.trim();
                const birthdate = document.getElementById('editBirthdate').value;
                const gender = document.getElementById('editGender').value;
                const licenseNo = document.getElementById('editLicenseNo').value.trim();
                const username = document.getElementById('editUsername').value.trim();
                const vehicleType = document.getElementById('editVehicleType').value;
                const plateNumber = document.getElementById('editPlateNumber').value.trim().toUpperCase();
                const licenseExp = document.getElementById('editLicenseExp').value;
                if (!fullName || !username || !plateNumber) { showToast('Please fill required fields',
                        'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                    return; }
                const drivers = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
                if (drivers.find(d => d.username === username && d.driverId !== currentDriver.driverId)) {
                    showToast('Username taken', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                    return; }
                if (drivers.find(d => d.plateNumber === plateNumber && d.driverId !== currentDriver.driverId)) {
                    showToast('Plate number registered to another driver', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                    return; }
                const updated = { ...currentDriver, fullName, address, contact, birthdate, gender,
                    licenseNo: licenseNo.toUpperCase(), username, vehicleType, plateNumber,
                    licenseExpiration: licenseExp };
                if (tempPhotoDataURL) updated.photo = tempPhotoDataURL;
                if (saveDriverData(updated)) {
                    currentDriver = updated;
                    logDriverActivity('Updated profile information', 'fa-user-edit', 'log-profile');
                    populateDashboard();
                    populateProfile();
                    populateQRPage();
                    generateQR();
                    closeModal('editProfileModal');
                    showToast('Profile updated!', 'success');
                    renderActivities();
                } else showToast('Failed to update', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }, 300);
        });

        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }
        document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', function(e) { if (e.target ===
                this) this.classList.remove('active'); }));

        function navigateTo(page) {
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            const target = document.getElementById('page-' + page);
            if (target) target.classList.add('active');
            document.querySelectorAll('.sidebar-item[data-page]').forEach(i => {
                i.classList.toggle('active', i.dataset.page === page);
            });
            if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');

            if (page === 'qr') {
                logDriverActivity('Viewed Digital Driver ID', 'fa-id-card', 'log-qr');
                populateQRPage();
                generateQR();
            }
            if (page === 'payments') {
                logDriverActivity('Viewed Payment History', 'fa-receipt', 'log-payment');
            }
            if (page === 'profile') {
                logDriverActivity('Viewed Profile', 'fa-user', 'log-profile');
            }
        }
        document.querySelectorAll('.sidebar-item[data-page]').forEach(i => i.addEventListener('click', function() {
            navigateTo(this.dataset.page);
        }));
        document.getElementById('mobileToggle').addEventListener('click', function() { document.getElementById('sidebar')
                .classList.toggle('open'); });

        window.logout = function() {
            ConfirmModal.show({
                title: "Logout?",
                message: "Are you sure you want to log out of the driver dashboard?",
                confirmText: "Yes, logout",
                cancelText: "Cancel",
                onConfirm: function() {
                    logDriverActivity('Logged out', 'fa-sign-out-alt', 'log-logout');
                    localStorage.removeItem('borongan_driver_session');
                    window.location.href = 'login.html';
                }
            });
        }

        function showToast(message, type = 'success') {
            const container = document.getElementById('toastContainer');
            const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-triangle-exclamation' };
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML =
                `<span class="toast-icon"><i class="fas ${icons[type] || icons.success}"></i></span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.add('hiding');
                setTimeout(() => toast.remove(), 300); }, 4000);
        }

        function showChangePassword() {
            const form = document.getElementById('passwordForm');
            const error = document.getElementById('passwordError');
            form.reset();
            error.textContent = '';
            error.hidden = true;
            openModal('passwordModal');
            requestAnimationFrame(() => document.getElementById('newPassword').focus());
        }

        document.getElementById('passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;
            const error = document.getElementById('passwordError');

            const showPasswordError = (message) => {
                error.textContent = message;
                error.hidden = false;
            };

            if (newPass.length < 4) {
                showPasswordError('Password must be at least 4 characters.');
                document.getElementById('newPassword').focus();
                return;
            }
            if (newPass !== confirmPass) {
                showPasswordError('The passwords do not match.');
                document.getElementById('confirmPassword').focus();
                return;
            }

            const drivers = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
            const idx = drivers.findIndex(d => d.driverId === currentDriver.driverId);
            if (idx === -1) {
                closeModal('passwordModal');
                showToast('Unable to update password.', 'error');
                return;
            }

            drivers[idx].password = newPass;
            localStorage.setItem('borongan_drivers', JSON.stringify(drivers));
            closeModal('passwordModal');
            showToast('Password changed successfully!', 'success');
            logDriverActivity('Changed password', 'fa-key', 'log-profile');
        });

        document.getElementById('editPhoto').addEventListener('change', function(e) {
            const preview = document.getElementById('photoPreview');
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                    tempPhotoDataURL = ev.target.result;
                };
                reader.readAsDataURL(this.files[0]);
            }
        });

        document.getElementById('paymentSearch').addEventListener('input', renderPaymentHistory);
        document.getElementById('paymentFilter').addEventListener('change', renderPaymentHistory);

        document.addEventListener('DOMContentLoaded', initDriverDashboard);
