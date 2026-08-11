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

// Data is now fetched from MySQL via PHP APIs.
// These remain as in-memory cache after fetch.
let drivers = [];
let transactions = [];
let vehicles = [];
let fees = { Tricycle: 5, Jeepney: 60, Multicab: 60, Bus: 100 };
let activities = [];
let chartInstance = null;
let qrUsage = {};

// Load all data from API on start
async function loadAllDataFromDB() {
  const [driversRes, vehiclesRes, paymentsRes, feesRes] = await Promise.all([
    fetch("api/drivers.php").then((r) => r.json()),
    fetch("api/vehicles.php").then((r) => r.json()),
    fetch("api/payments.php").then((r) => r.json()),
    fetch("api/fees.php").then((r) => r.json()),
  ]);
  if (driversRes.success) drivers = driversRes.drivers;
  if (vehiclesRes.success) vehicles = vehiclesRes.vehicles;
  if (paymentsRes.success) transactions = paymentsRes.payments;
  if (feesRes.success) fees = feesRes.fees;
}

function showToast(msg, type = "success") {
  const c = document.getElementById("toastContainer");
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-triangle-exclamation",
  };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon"><i class="fas ${icons[type] || icons.success}"></i></span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add("hiding");
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.start(ctx.currentTime);
    
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.error("Audio failed", e);
  }
}

function sendNotification(title, message) {
  playNotificationSound();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      icon: "images/borongan-logo.jpg"
    });
  }
}

function addActivity(action, details) {
  const now = new Date();
  let badgeClass = "updated";
  let icon = "fa-pencil";
  if (action.includes("Added")) {
    badgeClass = "added";
    icon = "fa-plus-circle";
  } else if (action.includes("Deleted")) {
    badgeClass = "deleted";
    icon = "fa-trash";
  } else if (action.includes("Payment")) {
    badgeClass = "payment";
    icon = "fa-credit-card";
  }
  activities.unshift({
    action,
    details,
    time: now.toTimeString().slice(0, 5),
    timestamp: now.toISOString(),
    badgeClass,
    icon,
  });
  if (activities.length > 50) activities.pop();
  localStorage.setItem("borongan_activities", JSON.stringify(activities));
  renderActivities();
}

function navigateTo(page) {
  document
    .querySelectorAll(".page-section")
    .forEach((s) => s.classList.remove("active"));
  const pg = document.getElementById("page-" + page);
  if (pg) pg.classList.add("active");
  document
    .querySelectorAll(".sidebar-item")
    .forEach((i) => i.classList.remove("active"));
  document
    .querySelector(`.sidebar-item[data-page="${page}"]`)
    ?.classList.add("active");
  if (window.innerWidth <= 768)
    document.getElementById("sidebar").classList.remove("open");
}

function renderActivities() {
  const el = document.getElementById("recentActivities");
  if (!activities.length) {
    el.innerHTML =
      '<div class="text-center py-4 text-gray-400 text-sm">No recent activities</div>';
    return;
  }
  el.innerHTML = activities
    .slice(0, 10)
    .map(
      (a) => `
    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition">
      <span class="activity-badge ${a.badgeClass || "updated"}">${a.action.split(" ")[0]}</span>
      <span class="flex-1 text-gray-700">${a.action} <span class="text-gray-500">${a.details}</span></span>
      <span class="text-gray-400 text-xs">${a.time}</span>
    </div>
  `,
    )
    .join("");
}

function initSidebar() {
  document.querySelectorAll(".sidebar-item[data-page]").forEach((item) => {
    item.addEventListener("click", async function () {
      await loadAllDataFromDB();
      document
        .querySelectorAll(".page-section")
        .forEach((s) => s.classList.remove("active"));
      const pg = document.getElementById("page-" + this.dataset.page);
      if (pg) pg.classList.add("active");
      document
        .querySelectorAll(".sidebar-item")
        .forEach((i) => i.classList.remove("active"));
      this.classList.add("active");
      if (window.innerWidth <= 768)
        document.getElementById("sidebar").classList.remove("open");
    });
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  if (localStorage.getItem("admin_logged_in") !== "true") {
    window.location.href = "admin-login.html";
    return;
  }
  requestNotificationPermission();

  document
    .getElementById("mobileToggle")
    .addEventListener("click", function () {
      document.getElementById("sidebar").classList.toggle("open");
    });
  initSidebar();
  updateLastUpdated();
  
  await loadAllDataFromDB();
  
  loadFees();
  loadVehicleDrivers();
  updateDashboard();
  renderDrivers();
  renderVehicles();
  renderQRs();
  renderTransactions();
  renderActivities();
  initChart();
  setInterval(updateLastUpdated, 60000);
  const adminName = localStorage.getItem("admin_name") || "Admin";
  document.getElementById("adminGreetingName").textContent = adminName;
  startPaymentPolling();
});

window.logout = function () {
  ConfirmModal.show({
    title: "Logout?",
    message: "Are you sure you want to log out of the admin panel?",
    confirmText: "Yes, logout",
    cancelText: "Cancel",
    onConfirm: function() {
      localStorage.removeItem("admin_logged_in");
      window.location.href = "admin-login.html";
    }
  });
};

function updateLastUpdated() {
  document.getElementById("lastUpdatedTime").textContent =
    new Date().toLocaleTimeString();
}

let lastTransactionCount = 0;

function startPaymentPolling() {
  lastTransactionCount = transactions.length;
  
  setInterval(async () => {
    if (localStorage.getItem("admin_logged_in") !== "true") return;
    
    // Check localStorage notification flags first (fast, same-machine testing)
    const raw = localStorage.getItem("borongan_admin_notifs");
    if (raw) {
      try {
        let notifications = JSON.parse(raw);
        const unread = notifications.filter(n => !n.read);
        if (unread.length > 0) {
          unread.forEach((n) => {
            showToast(`New Self-Payment: ₱${n.amount} from ${n.driverName}`, "success");
            sendNotification("Payment Received", `₱${n.amount} from ${n.driverName} (Self-Payment)`);
            addActivity("Payment Received", `${n.driverName} - ₱${n.amount} (Self-Payment)`);
            n.read = true;
          });
          localStorage.setItem("borongan_admin_notifs", JSON.stringify(notifications));
          
          await loadAllDataFromDB();
          updateDashboard();
          renderTransactions();
          updateChartData();
          
          const scanInput = document.getElementById("qrScanInput");
          if (scanInput && scanInput.value.trim()) {
            scanQR(true);
          }
          
          lastTransactionCount = transactions.length;
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    // Fallback: Check database payment count to catch cross-device payments
    try {
      const res = await fetch("api/payments.php").then(r => r.json());
      if (res.success && res.payments.length > lastTransactionCount) {
        if (lastTransactionCount > 0) {
          const newPayments = res.payments.slice(0, res.payments.length - lastTransactionCount);
          newPayments.forEach(t => {
            showToast(`New Payment: ₱${t.amount} from ${t.driverName}`, "success");
            sendNotification("Payment Received", `₱${t.amount} from ${t.driverName}`);
            addActivity("Payment Received", `${t.driverName} - ₱${t.amount}`);
          });
        }
        transactions = res.payments;
        updateDashboard();
        renderTransactions();
        updateChartData();
        
        const scanInput = document.getElementById("qrScanInput");
        if (scanInput && scanInput.value.trim()) {
          scanQR(true);
        }
        
        lastTransactionCount = transactions.length;
      } else if (res.success) {
        transactions = res.payments;
        lastTransactionCount = transactions.length;
      }
    } catch (e) {
      // fail silently
    }
  }, 4000);
}

function globalSearch() {
  const query = document.getElementById("globalSearch").value.trim();
  if (!query) {
    showToast("Enter a search term", "warning");
    return;
  }
  const found = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(query.toLowerCase()) ||
      d.driverId.toLowerCase().includes(query.toLowerCase()) ||
      (d.plateNumber &&
        d.plateNumber.toLowerCase().includes(query.toLowerCase())),
  );
  if (found.length > 0) {
    document.querySelector("[data-page=drivers]").click();
    document.getElementById("driverSearch").value = query;
    filterDrivers();
    showToast(`Found ${found.length} driver(s)`, "success");
  } else {
    showToast("No results found", "warning");
  }
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
document.querySelectorAll(".modal-overlay").forEach((m) => {
  m.addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("active");
  });
});

function logout() {
  window.logout();
}

function showConfirm(title, msg, cb) {
  ConfirmModal.show({
    title: title,
    message: msg,
    confirmText: "Delete",
    cancelText: "Cancel",
    onConfirm: cb
  });
}

// ===== PHOTO PREVIEW =====
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById("photoPlaceholder").style.display = "none";
    const preview = document.getElementById("photoPreview");
    preview.src = e.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function resetPhotoPreview() {
  document.getElementById("photoPreview").src = "";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("photoPlaceholder").style.display = "flex";
  document.getElementById("dPhoto").value = "";
}

// ===== DASHBOARD =====
function updateDashboard() {
  const totalDrivers = drivers.length;
  const totalVehicles = vehicles.length;
  const today = new Date().toLocaleDateString('en-CA');
  const currentMonth = today.slice(0, 7); // YYYY-MM
  const todayTrans = transactions.filter(
    (t) => t.date === today,
  );
  const monthTrans = transactions.filter(
    (t) => t.date && t.date.startsWith(currentMonth),
  );
  const todayTotal = todayTrans.reduce((s, t) => s + Number(t.amount), 0);
  const monthTotal = monthTrans.reduce((s, t) => s + Number(t.amount), 0);
  const activeDrivers = drivers.filter((d) => d.status !== "Inactive").length;
  const activeVehicles = vehicles.filter((v) => v.status === "Active").length;
  const pending = drivers.filter((d) => d.status === "Pending").length;
  const qrCount = drivers.filter((d) => d.status !== "Inactive").length;
  const activeToday = todayTrans.length;
  const regVehicles = vehicles.length;

  document.getElementById("statDrivers").textContent = totalDrivers;
  document.getElementById("statActiveDrivers").textContent = activeDrivers;
  document.getElementById("statVehicles").textContent = totalVehicles;
  document.getElementById("statActiveVehicles").textContent = activeVehicles;
  document.getElementById("statTodayCollect").textContent = "₱" + todayTotal;
  document.getElementById("statMonthlyCollect").textContent = "₱" + monthTotal;
  document.getElementById("monthlyTransCount").textContent = monthTrans.length;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statQR").textContent = qrCount;
  document.getElementById("statActiveToday").textContent = activeToday;
  document.getElementById("statRegVehicles").textContent = regVehicles;

  document.getElementById("todayTrend").textContent = "● Current";

  const recent = transactions.slice(-5).reverse();
  const rb = document.getElementById("recentTable");
  if (!recent.length)
    rb.innerHTML =
      '<tr><td colspan="4"><div class="empty-state py-3"><i class="fas fa-inbox"></i><p class="text-sm">No transactions</p></div></td></tr>';
  else
    rb.innerHTML = recent
      .map(
        (t) =>
          `<tr class="border-b border-gray-100"><td class="py-2">${t.driverName}</td><td class="py-2">${t.vehicleType}</td><td class="py-2 font-bold text-primary">₱${t.amount}</td><td class="py-2 text-sm text-gray-500">${t.time}</td></tr>`,
      )
      .join("");
  updateChartData();
}

// ===== CHART =====
function initChart() {
  const ctx = document.getElementById("collectionChart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Collection (₱)",
          data: [],
          backgroundColor: "rgba(178,34,52,0.7)",
          borderColor: "#b22234",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "₱" + v } } },
    },
  });
  updateChartData();
}
function updateChartData() {
  const labels = [],
    data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const total = transactions
      .filter((t) => t.date === ds)
      .reduce((s, t) => s + t.amount, 0);
    labels.push(
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
    data.push(total);
  }
  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
  }
}
function updateChart(type) {
  if (chartInstance) {
    chartInstance.config.type = type;
    chartInstance.update();
    showToast(`Chart: ${type}`, "success");
  }
}

// ===== DRIVERS =====
function renderDrivers() {
  const search = document.getElementById("driverSearch").value.toLowerCase();
  const sort = document.getElementById("driverSort").value;
  let filtered = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(search) ||
      d.driverId.toLowerCase().includes(search) ||
      (d.plateNumber || "").toLowerCase().includes(search),
  );
  if (sort === "newest")
    filtered = filtered.sort((a, b) => b.driverId.localeCompare(a.driverId));
  else if (sort === "oldest")
    filtered = filtered.sort((a, b) => a.driverId.localeCompare(b.driverId));
  else if (sort === "name")
    filtered = filtered.sort((a, b) => a.fullName.localeCompare(b.fullName));
  const table = document.getElementById("driverTable");
  if (!filtered.length) {
    table.innerHTML =
      '<tr><td colspan="8"><div class="empty-state py-4"><i class="fas fa-user-slash"></i><h3>No drivers</h3><p>Add a driver</p></div></td></tr>';
    return;
  }
  table.innerHTML = filtered
    .map(
      (d) => `<tr class="border-b border-gray-100 hover:bg-gray-50">
    <td class="py-2">
      <div class="profile-photo">
        ${d.photo ? `<img src="${d.photo}" alt="${d.fullName}">` : `<span>${d.fullName.charAt(0).toUpperCase()}</span>`}
      </div>
    </td>
    <td class="py-2 font-mono text-xs">${d.driverId}</td>
    <td class="py-2 font-medium">${d.fullName}</td>
    <td class="py-2 text-sm">${d.vehicleType || "N/A"} - ${d.plateNumber || "N/A"}</td>
    <td class="py-2 text-sm">${d.contact || "N/A"}</td>
    <td class="py-2 text-sm">${d.licenseNo || "N/A"}</td>
    <td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${d.status === "Inactive" ? "bg-red-100 text-red-700" : d.status === "Pending" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}">${d.status || "Active"}</span></td>
    <td class="py-2"><button class="btn-primary btn-sm" onclick="editDriver('${d.driverId}')"><i class="fas fa-edit"></i></button><button class="btn-danger btn-sm" onclick="confirmDeleteDriver('${d.driverId}')"><i class="fas fa-trash"></i></button></td>
  </tr>`,
    )
    .join("");
}
function filterDrivers() {
  renderDrivers();
}

document.getElementById("driverForm").addEventListener("submit", function (e) {
  e.preventDefault();
  saveDriver();
});

function saveDriver() {
  const btn = document.getElementById("driverSubmitBtn");
  const text = document.getElementById("driverSubmitText");
  btn.disabled = true;
  text.innerHTML = '<span class="spinner"></span> Saving...';

  const id = document.getElementById("editDriverId").value;
  let photoData = document.getElementById("photoPreview").src || "";

  const data = {
    fullName: document.getElementById("dFullName").value.trim(),
    address: document.getElementById("dAddress").value.trim(),
    contact: document.getElementById("dContact").value.trim(),
    birthdate: document.getElementById("dBirthdate").value,
    gender: document.getElementById("dGender").value,
    vehicleType: document.getElementById("dVehicleType").value,
    plateNumber: document.getElementById("dPlateNumber").value.trim().toUpperCase(),
    licenseNo: document.getElementById("dLicenseNo").value.trim().toUpperCase(),
    username: document.getElementById("dUsername").value.trim(),
    password: document.getElementById("dPassword").value || "default123",
    status: "Active",
  };

  if (photoData && photoData.startsWith("data:image")) {
    data.photo = photoData;
  } else if (id) {
    const existing = drivers.find((d) => d.driverId === id);
    if (existing && existing.photo) data.photo = existing.photo;
  }

  if (!data.fullName || !data.username) {
    showToast("Required fields missing", "error");
    btn.disabled = false;
    text.textContent = "Save";
    return;
  }

  if (id) {
    // UPDATE via API
    data.driverId = id;
    fetch("api/drivers.php?id=" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    .then(r => r.json())
    .then(async res => {
      if (res.success) {
        showToast(`Driver ${data.fullName} updated`, "success");
        addActivity("Updated Driver", data.fullName);
        await loadAllDataFromDB();
        closeModal("driverModal");
        document.getElementById("driverForm").reset();
        document.getElementById("editDriverId").value = "";
        document.getElementById("driverModalTitle").textContent = "Add Driver";
        resetPhotoPreview();
        renderDrivers(); updateDashboard(); loadVehicleDrivers(); renderQRs();
      } else { showToast(res.error || "Update failed", "error"); }
      btn.disabled = false; text.textContent = "Save";
    })
    .catch(() => { showToast("Server error", "error"); btn.disabled = false; text.textContent = "Save"; });
  } else {
    // CREATE via API
    fetch("api/drivers.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    .then(r => r.json())
    .then(async res => {
      if (res.success) {
        showToast(`Driver ${data.fullName} added`, "success");
        addActivity("Added Driver", data.fullName);
        await loadAllDataFromDB();
        closeModal("driverModal");
        document.getElementById("driverForm").reset();
        document.getElementById("editDriverId").value = "";
        document.getElementById("driverModalTitle").textContent = "Add Driver";
        resetPhotoPreview();
        renderDrivers(); updateDashboard(); loadVehicleDrivers(); renderQRs();
      } else { showToast(res.error || "Save failed", "error"); }
      btn.disabled = false; text.textContent = "Save";
    })
    .catch(() => { showToast("Server error", "error"); btn.disabled = false; text.textContent = "Save"; });
  }
}

function editDriver(id) {
  const d = drivers.find((x) => x.driverId === id);
  if (!d) return;
  document.getElementById("editDriverId").value = id;
  document.getElementById("dFullName").value = d.fullName || "";
  document.getElementById("dAddress").value = d.address || "";
  document.getElementById("dContact").value = d.contact || "";
  document.getElementById("dBirthdate").value = d.birthdate || "";
  document.getElementById("dGender").value = d.gender || "";
  document.getElementById("dVehicleType").value = d.vehicleType || "";
  document.getElementById("dPlateNumber").value = d.plateNumber || "";
  document.getElementById("dLicenseNo").value = d.licenseNo || "";
  document.getElementById("dUsername").value = d.username || "";
  document.getElementById("dPassword").value = "";

  // Load existing photo if available
  if (d.photo) {
    document.getElementById("photoPlaceholder").style.display = "none";
    const preview = document.getElementById("photoPreview");
    preview.src = d.photo;
    preview.style.display = "block";
  } else {
    resetPhotoPreview();
  }

  document.getElementById("driverModalTitle").textContent = "Edit Driver";
  openModal("driverModal");
}

function confirmDeleteDriver(id) {
  const d = drivers.find((x) => x.driverId === id);
  if (!d) return;
  showConfirm("Delete Driver?", `Delete "${d.fullName}"?`, () => {
    fetch("api/drivers.php?id=" + id, { method: "DELETE" })
    .then(r => r.json())
    .then(async res => {
      if (res.success) {
        showToast(`Deleted ${d.fullName}`, "error");
        addActivity("Deleted Driver", d.fullName);
        await loadAllDataFromDB();
        renderDrivers(); updateDashboard(); loadVehicleDrivers(); renderQRs();
      } else { showToast("Delete failed", "error"); }
    })
    .catch(() => showToast("Server error", "error"));
  });
}

// ===== VEHICLES =====
document.getElementById("vehicleForm").addEventListener("submit", function (e) {
  e.preventDefault();
  saveVehicle();
});

function syncVehiclesFromDrivers() {
  const syncs = drivers
    .filter(d => d.plateNumber && d.vehicleType)
    .map(d => fetch("api/vehicles.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plateNumber: d.plateNumber, vehicleType: d.vehicleType, driverId: d.driver_id || d.driverId, status: "Active" }),
    }));
  Promise.all(syncs).then(async () => {
    await loadAllDataFromDB();
    renderVehicles(); updateDashboard();
    showToast("Vehicles synced", "success");
  });
}

function renderVehicles() {
  const search = document.getElementById("vehicleSearch").value.toLowerCase();
  let filtered = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(search) ||
      v.vehicleType.toLowerCase().includes(search),
  );
  document.getElementById("vehicleCount").textContent = vehicles.length;
  document.getElementById("activeVehicleCount").textContent = vehicles.filter(
    (v) => v.status === "Active",
  ).length;
  document.getElementById("inactiveVehicleCount").textContent = vehicles.filter(
    (v) => v.status === "Inactive",
  ).length;
  const table = document.getElementById("vehicleTable");
  if (!filtered.length) {
    table.innerHTML =
      '<tr><td colspan="5"><div class="empty-state py-4"><i class="fas fa-truck"></i><h3>No vehicles</h3></div></td></tr>';
    return;
  }
  table.innerHTML = filtered
    .map((v) => {
      const driver = drivers.find((d) => d.driverId === v.driverId);
      return `<tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 font-mono text-sm font-bold">${v.plateNumber}</td>
      <td class="py-2">${v.vehicleType}</td>
      <td class="py-2">${driver ? driver.fullName : '<span class="text-gray-400">Unassigned</span>'}</td>
      <td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${v.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}">${v.status}</span></td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="editVehicle('${v.plateNumber}')"><i class="fas fa-edit"></i></button><button class="btn-danger btn-sm" onclick="confirmDeleteVehicle('${v.plateNumber}')"><i class="fas fa-trash"></i></button></td>
    </tr>`;
    })
    .join("");
}

function loadVehicleDrivers() {
  const s = document.getElementById("vDriver");
  s.innerHTML = '<option value="">Unassigned</option>';
  drivers.forEach((d) => {
    s.innerHTML += `<option value="${d.driverId}">${d.fullName} (${d.driverId})</option>`;
  });
}

function saveVehicle() {
  const btn = document.getElementById("vehicleSubmitBtn");
  const text = document.getElementById("vehicleSubmitText");
  btn.disabled = true;
  text.innerHTML = '<span class="spinner"></span> Saving...';
  const data = {
    plateNumber: document.getElementById("vPlateNumber").value.trim().toUpperCase(),
    vehicleType: document.getElementById("vVehicleType").value,
    driverId: document.getElementById("vDriver").value,
    status: document.getElementById("vStatus").value,
  };
  if (!data.plateNumber || !data.vehicleType) {
    showToast("Required fields missing", "error");
    btn.disabled = false; text.textContent = "Save"; return;
  }
  fetch("api/vehicles.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  .then(r => r.json())
  .then(async res => {
    if (res.success) {
      showToast(`Vehicle ${data.plateNumber} saved`, "success");
      addActivity("Saved Vehicle", data.plateNumber);
      await loadAllDataFromDB();
      closeModal("vehicleModal");
      document.getElementById("vehicleForm").reset();
      document.getElementById("editVehiclePlate").value = "";
      document.getElementById("vehicleModalTitle").textContent = "Add Vehicle";
      renderVehicles(); updateDashboard();
    } else { showToast(res.error || "Save failed", "error"); }
    btn.disabled = false; text.textContent = "Save";
  })
  .catch(() => { showToast("Server error", "error"); btn.disabled = false; text.textContent = "Save"; });
}

function editVehicle(plate) {
  const v = vehicles.find((x) => x.plateNumber === plate);
  if (!v) return;
  document.getElementById("editVehiclePlate").value = plate;
  document.getElementById("vPlateNumber").value = v.plateNumber;
  document.getElementById("vVehicleType").value = v.vehicleType;
  document.getElementById("vDriver").value = v.driverId || "";
  document.getElementById("vStatus").value = v.status;
  document.getElementById("vehicleModalTitle").textContent = "Edit Vehicle";
  openModal("vehicleModal");
}
function confirmDeleteVehicle(plate) {
  showConfirm("Delete Vehicle?", `Delete ${plate}?`, () => {
    fetch("api/vehicles.php?plate=" + encodeURIComponent(plate), { method: "DELETE" })
    .then(r => r.json())
    .then(async res => {
      if (res.success) {
        showToast(`Deleted ${plate}`, "error");
        addActivity("Deleted Vehicle", plate);
        await loadAllDataFromDB();
        renderVehicles(); updateDashboard();
      } else { showToast("Delete failed", "error"); }
    })
    .catch(() => showToast("Server error", "error"));
  });
}

// ===== QR =====
function renderQRs() {
  const table = document.getElementById("qrTable");
  if (!drivers.length) {
    table.innerHTML =
      '<tr><td colspan="7"><div class="empty-state py-4"><i class="fas fa-qrcode"></i><h3>No QR codes</h3></div></td></tr>';
    return;
  }
  table.innerHTML = drivers
    .map((d) => {
      const usage = qrUsage[d.driverId] || {
        lastScanned: "Never",
        timesUsed: 0,
      };
      return `<tr class="border-b border-gray-100">
      <td class="py-2 font-medium">${d.fullName}</td>
      <td class="py-2">${d.vehicleType || "N/A"} - ${d.plateNumber || "N/A"}</td>
      <td class="py-2"><div id="qr-${d.driverId}" style="width:50px;height:50px;"></div></td>
      <td class="py-2"><span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span></td>
      <td class="py-2 text-xs">${usage.lastScanned}</td>
      <td class="py-2 text-xs">${usage.timesUsed}</td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="generateQR('${d.driverId}')"><i class="fas fa-sync"></i></button><button class="btn-outline btn-sm" onclick="printQR('${d.driverId}')"><i class="fas fa-print"></i></button><button class="btn-danger btn-sm" onclick="deleteQR('${d.driverId}')"><i class="fas fa-trash"></i></button></td>
    </tr>`;
    })
    .join("");
  drivers.forEach((d) => {
    const c = document.getElementById(`qr-${d.driverId}`);
    if (c) {
      c.innerHTML = "";
      try {
        new QRCode(c, {
          text: `ID:${d.driverId}|Name:${d.fullName}|Plate:${d.plateNumber}|Type:${d.vehicleType}`,
          width: 50,
          height: 50,
          colorDark: "#b22234",
          colorLight: "#ffffff",
        });
      } catch (e) {
        c.innerHTML = '<span class="text-xs text-gray-400">QR</span>';
      }
    }
  });
}
function generateQR(id) {
  showToast(
    `QR regenerated for ${drivers.find((d) => d.driverId === id)?.fullName}`,
    "success",
  );
  renderQRs();
}
function printQR(id) {
  window.open(`driver-id.html?id=${id}`, "_blank");
}
function deleteQR(id) {
  showConfirm("Delete QR?", "Remove driver QR code?", () => {
    fetch("api/drivers.php?id=" + id, { method: "DELETE" })
    .then(r => r.json())
    .then(async res => {
      if (res.success) {
        showToast("QR/Driver deleted", "error");
        addActivity("Deleted QR", id);
        await loadAllDataFromDB();
        renderQRs();
        updateDashboard();
      } else {
        showToast("Delete failed", "error");
      }
    })
    .catch(() => showToast("Server error", "error"));
  });
}

// ===== PAYMENT =====
function scanQR(silent = false) {
  const input = document.getElementById("qrScanInput").value.trim();
  if (!input) {
    if (!silent) showToast("Enter search term", "warning");
    return;
  }
  const driver = drivers.find(
    (d) =>
      d.driverId === input ||
      d.plateNumber === input.toUpperCase() ||
      d.fullName.toLowerCase().includes(input.toLowerCase()),
  );
  const details = document.getElementById("paymentDetails");
  if (!driver) {
    details.innerHTML = `<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle text-4xl block mb-2"></i>Driver not found</div>`;
    if (!silent) showToast("Driver not found", "error");
    return;
  }
  const fee = fees[driver.vehicleType] || 0;
  const today = new Date().toLocaleDateString('en-CA');
  const paidToday = transactions.some(
    (t) => (t.driverId === driver.driverId || t.driverId === driver.driver_id) && t.date === today
  );
  const driverId = driver.driver_id || driver.driverId;
  const photo = driver.photo
    ? `<img src="${driver.photo}" alt="${driver.fullName}">`
    : `<span>${driver.fullName.charAt(0).toUpperCase()}</span>`;
  const actionBtn = paidToday
    ? `<div class="flex items-center gap-2 justify-center bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 font-semibold">
        <i class="fas fa-check-circle"></i> Already Paid Today
       </div>`
    : `<div class="flex gap-2 mt-4">
        <button class="btn-primary flex-1" onclick="processPayment('${driverId}', ${fee})">
          <i class="fas fa-check"></i> Collect
        </button>
        <button class="btn-outline flex-1" onclick="clearPayment()">Cancel</button>
       </div>`;
  details.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center gap-3 border-b border-gray-100 pb-3">
        <div class="profile-photo w-12 h-12 text-lg">${photo}</div>
        <div>
          <div class="font-bold text-gray-800">${driver.fullName}</div>
          <div class="text-sm text-gray-500">${driver.driverId}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="text-gray-500">Vehicle</div><div class="font-medium">${driver.vehicleType}</div>
        <div class="text-gray-500">Plate</div><div class="font-medium">${driver.plateNumber}</div>
        <div class="text-gray-500">Fee</div><div class="font-bold text-primary text-lg">₱${fee}</div>
      </div>
      ${actionBtn}
    </div>
  `;
}
function clearPayment() {
  document.getElementById("qrScanInput").value = "";
  document.getElementById("paymentDetails").innerHTML =
    '<div class="text-center py-8 text-gray-400"><i class="fas fa-credit-card text-4xl block mb-2"></i>Search for a driver</div>';
}

function processPayment(driverId, amount) {
  const driver = drivers.find((d) => d.driverId === driverId);
  if (!driver) return;
  const vehicle = vehicles.find(v => v.plate_number === driver.plate_number || v.plateNumber === driver.plateNumber);
  fetch("api/payments.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      driverId: driver.driver_id || driver.driverId,
      vehicleId: vehicle ? vehicle.vehicle_id : null,
      amount: amount,
      driverName: driver.full_name || driver.fullName,
    }),
  })
  .then(r => r.json())
  .then(async res => {
    if (res.success) {
      const receiptNo = res.receiptNo;
      const now = new Date();
      const trans = {
        id: receiptNo, driverId, driverName: driver.full_name || driver.fullName,
        vehicleType: driver.vehicle_type || driver.vehicleType,
        plateNumber: driver.plate_number || driver.plateNumber,
        amount, date: now.toISOString().split("T")[0], time: now.toTimeString().slice(0,5),
      };
      // Store last transaction so the Print button can access it
      window._lastReceipt = trans;
      document.getElementById("paymentDetails").innerHTML = `
        <div class="text-center py-6">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-check-circle text-green-600 text-3xl"></i>
          </div>
          <div class="font-bold text-lg text-green-700 mb-1">Payment Received!</div>
          <div class="text-sm text-gray-600">₱${amount} from <strong>${driver.full_name || driver.fullName}</strong></div>
          <div class="text-xs text-gray-400 mt-1 mb-4">Receipt: ${receiptNo} &nbsp;|&nbsp; ${trans.date} ${trans.time}</div>
          <div class="flex gap-2 justify-center mt-3">
            <button class="btn-primary" onclick="printReceipt(window._lastReceipt)">
              <i class="fas fa-print mr-1"></i> Print Receipt
            </button>
            <button class="btn-outline" onclick="clearPayment()">
              <i class="fas fa-plus mr-1"></i> New Payment
            </button>
          </div>
        </div>`;
      showToast(`₱${amount} collected`, "success");
      sendNotification("Payment Collected", `₱${amount} received from ${driver.full_name || driver.fullName}`);
      addActivity("Payment Received", `${driver.full_name || driver.fullName} - ₱${amount}`);
      await loadAllDataFromDB();
      updateDashboard(); renderTransactions(); updateChartData();
    } else { showToast(res.error || "Payment failed", "error"); }
  })
  .catch(() => showToast("Server error", "error"));
}

function printReceipt(trans) {
  const driver = drivers.find((d) => d.driverId === trans.driverId);
  const printWindow = window.open("", "_blank", "width=400,height=600");
  printWindow.document.write(`
    <html><head><title>Receipt</title><style>
      body { font-family: 'Courier New', monospace; padding: 30px 20px; max-width: 350px; margin: 0 auto; background: white; }
      .receipt { border: 2px dashed #333; padding: 20px; border-radius: 8px; }
      .header { text-align: center; font-size: 1.2rem; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
      .paid { font-size: 2.5rem; font-weight: bold; color: #16a34a; text-align: center; letter-spacing: 4px; border: 3px solid #16a34a; padding: 8px; border-radius: 8px; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; }
      .label { color: #555; }
      .value { font-weight: bold; }
      .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 15px; text-align: center; font-size: 0.8rem; color: #777; }
    </style>  <link rel="stylesheet" href="assets/css/admin-dashboard.css" />
</head><body>
    <div class="receipt">
      <div class="header">BORONGAN TRANSPORT</div>
      <div class="paid">PAID</div>
      <div class="row"><span class="label">Receipt</span><span class="value">${trans.id}</span></div>
      <div class="row"><span class="label">Driver</span><span class="value">${driver ? driver.fullName : trans.driverName}</span></div>
      <div class="row"><span class="label">Plate</span><span class="value">${trans.plateNumber || "N/A"}</span></div>
      <div class="row"><span class="label">Vehicle</span><span class="value">${trans.vehicleType}</span></div>
      <div class="row"><span class="label">Amount</span><span class="value">₱${trans.amount}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${trans.date}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${trans.time}</span></div>
      <div class="footer">Thank you!</div>
      <div class="no-print" style="text-align:center;margin-top:16px;display:flex;gap:8px;justify-content:center;">
      <button onclick="window.print()" style="background:#b22234;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:0.9rem;"><i class="fas fa-print"></i> Print</button>
      <button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:0.9rem;">Close</button>
    </div>
    <style>.no-print { display:flex; } @media print { .no-print { display:none !important; } }</style>
    <script>
      window.onload = function() { window.print(); };
    <\/script>
  `);
  printWindow.document.close();
}

document.getElementById("qrScanInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") scanQR();
});

// ===== TRANSACTIONS =====
function renderTransactions() {
  const search = document.getElementById("transSearch").value.toLowerCase();
  const dateFilter = document.getElementById("transDate").value;
  let data = transactions;
  if (search)
    data = data.filter(
      (t) =>
        t.driverName.toLowerCase().includes(search) ||
        t.driverId.toLowerCase().includes(search) ||
        t.id.toLowerCase().includes(search),
    );
  if (dateFilter) data = data.filter((t) => t.date === dateFilter);
  const table = document.getElementById("transTable");
  if (!data.length) {
    table.innerHTML =
      '<tr><td colspan="7"><div class="empty-state py-4"><i class="fas fa-receipt"></i><h3>No transactions</h3></div></td></tr>';
    return;
  }
  table.innerHTML = data
    .slice()
    .reverse()
    .map(
      (t) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 font-mono text-xs">${t.id}</td>
      <td class="py-2">${t.driverName}</td>
      <td class="py-2">${t.vehicleType}</td>
      <td class="py-2 font-bold text-primary">₱${t.amount}</td>
      <td class="py-2 text-sm">${t.date}</td>
      <td class="py-2 text-sm">${t.time}</td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="printReceiptById('${t.id}')"><i class="fas fa-print"></i></button></td>
    </tr>
  `,
    )
    .join("");
}

function printReceiptById(id) {
  const t = transactions.find((x) => x.id === id);
  if (t) printReceipt(t);
}

function exportTransactionsPDF() {
  showToast("PDF export ready", "success");
  const data = transactions;
  if (!data.length) {
    showToast("No data to export", "warning");
    return;
  }
  const rows = data
    .slice()
    .reverse()
    .map(
      (t) =>
        `<tr><td>${t.id}</td><td>${t.driverName}</td><td>${t.vehicleType}</td><td>&#8369;${t.amount}</td><td>${t.date}</td><td>${t.time}</td></tr>`,
    )
    .join("");
  const total = data.reduce((s, t) => s + Number(t.amount), 0);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  printWindow.document.write(`
    <html><head><title>Transaction History PDF</title><style>
      body { font-family: Arial, sans-serif; padding: 30px; max-width: 1200px; margin: 0 auto; }
      h1 { color: #b22234; border-bottom: 2px solid #b22234; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th { background: #f0f0f0; padding: 10px; border: 1px solid #ddd; }
      td { padding: 8px; border: 1px solid #ddd; }
      .total { font-weight: bold; font-size: 1.2rem; margin-top: 15px; }
      .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 15px; text-align: center; color: #777; }
    <\/style><\/head><body>
    <h1>Borongan Transport &middot; Transaction History<\/h1>
    <p>Generated: ${new Date().toLocaleString()}<\/p>
    <table><thead><tr><th>Receipt<\/th><th>Driver<\/th><th>Vehicle<\/th><th>Amount<\/th><th>Date<\/th><th>Time<\/th><\/tr><\/thead><tbody>${rows}<\/tbody><\/table>
    <div class="total">Total Transactions: ${data.length} | Total Amount: &#8369;${total}<\/div>
    <div class="footer">Prepared by: ${document.getElementById("adminName").value || "Admin"}<\/div>
    <script>
      function doPrint() {
        if (window.hasPrinted) return;
        window.hasPrinted = true;
        setTimeout(() => {
          window.print();
          setTimeout(() => { window.close(); }, 500);
        }, 500);
      }
      window.onload = doPrint;
      document.addEventListener('DOMContentLoaded', doPrint);
      setTimeout(doPrint, 800);
    <\/script>
  `);
  printWindow.document.close();
}

function exportTransactionsExcel() {
  showToast("Excel export ready", "success");
  const data = transactions;
  if (!data.length) {
    showToast("No data to export", "warning");
    return;
  }
  let csv = "Receipt,Driver,Vehicle,Amount,Date,Time\n";
  data
    .slice()
    .reverse()
    .forEach((t) => {
      csv += `${t.id},${t.driverName},${t.vehicleType},${t.amount},${t.date},${t.time}\n`;
    });
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "transactions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

// ===== REPORTS =====
function generateReport(type) {
  const dataContainer = document.getElementById("reportData");
  const summary = document.getElementById("reportSummary");
  let filtered = transactions;
  let periodLabel = "",
    reportTypeLabel = "";
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  const currentMonth = todayStr.slice(0, 7); // YYYY-MM
  const currentYear = todayStr.slice(0, 4); // YYYY

  if (type === "daily") {
    filtered = transactions.filter((t) => t.date === todayStr);
    periodLabel = todayStr;
    reportTypeLabel = "Daily Report";
  } else if (type === "weekly") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const startStr = start.toLocaleDateString('en-CA');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endStr = end.toLocaleDateString('en-CA');
    
    filtered = transactions.filter((t) => t.date >= startStr && t.date <= endStr);
    periodLabel = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    reportTypeLabel = "Weekly Report";
  } else if (type === "monthly") {
    filtered = transactions.filter(
      (t) => t.date && t.date.startsWith(currentMonth)
    );
    periodLabel = now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    reportTypeLabel = "Monthly Report";
  } else if (type === "yearly") {
    filtered = transactions.filter(
      (t) => t.date && t.date.startsWith(currentYear)
    );
    periodLabel = currentYear;
    reportTypeLabel = "Yearly Report";
  }

  if (!filtered.length) {
    dataContainer.innerHTML =
      '<p class="text-gray-400 text-center py-8">No data for this period</p>';
    summary.innerHTML = '<p class="text-gray-400 text-sm">No data</p>';
    showToast("No data", "warning");
    return;
  }
  const summaryData = {};
  filtered.forEach((t) => {
    if (!summaryData[t.vehicleType])
      summaryData[t.vehicleType] = { count: 0, total: 0 };
    summaryData[t.vehicleType].count++;
    summaryData[t.vehicleType].total += Number(t.amount);
  });
  summary.innerHTML =
    Object.entries(summaryData)
      .map(
        ([k, v]) =>
          `<div class="flex justify-between border-b border-gray-100 py-1 text-sm"><span>${k}</span><span>${v.count} - &#8369;${v.total.toFixed(2)}</span></div>`,
      )
      .join("") +
    `<div class="flex justify-between py-2 font-bold text-primary"><span>Total</span><span>${filtered.length} - &#8369;${filtered.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}</span></div>`;
  const rows = filtered
    .slice()
    .reverse()
    .map(
      (t) =>
        `<tr><td>${t.id}</td><td>${t.driverName}</td><td>${t.vehicleType}</td><td>&#8369;${Number(t.amount).toFixed(2)}</td><td>${t.date}</td></tr>`,
    )
    .join("");
  const total = filtered.reduce((s, t) => s + Number(t.amount), 0).toFixed(2);
  const admin = document.getElementById("adminName").value || "Admin";
  dataContainer.innerHTML = `
    <div class="no-print flex justify-between items-center mb-3"><span class="font-semibold">${reportTypeLabel} - ${periodLabel}</span><div><button class="btn-primary btn-sm" onclick="window.print()"><i class="fas fa-print"></i> Print</button></div></div>
    <div id="printableReport" class="print-report" style="font-family:'Courier New',monospace;background:white;padding:20px;max-width:1000px;margin:0 auto;">
      <div style="text-align:center;font-size:1.4rem;font-weight:bold;border-bottom:2px solid #222;padding-bottom:8px;">BORONGAN TRANSPORT &middot; ${reportTypeLabel}</div>
      <div style="text-align:center;margin-bottom:16px;font-size:0.9rem;">${periodLabel}</div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;"><thead><tr><th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;">Receipt</th><th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;">Driver</th><th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;">Vehicle</th><th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;">Amount</th><th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;">Date</th></tr></thead><tbody>${rows}</tbody><tfoot><tr style="font-weight:bold;border-top:2px solid #222;"><td colspan="3" style="border:1px solid #333;padding:6px 10px;">TOTAL</td><td style="border:1px solid #333;padding:6px 10px;">&#8369;${total}</td><td style="border:1px solid #333;padding:6px 10px;">${filtered.length} transactions</td></tr></tfoot></table>
      <div style="margin-top:30px;display:flex;justify-content:space-between;"><div style="width:40%;border-top:1px solid #333;padding-top:6px;text-align:center;">Prepared: ${admin}</div><div style="width:40%;border-top:1px solid #333;padding-top:6px;text-align:center;">Approved: ________________</div></div>
      <div style="margin-top:16px;font-size:0.8rem;text-align:center;color:#555;border-top:1px solid #ccc;padding-top:10px;">Generated ${new Date().toLocaleString()} by ${admin}</div>
    </div>
  `;
  showToast(`Report generated: ${reportTypeLabel}`, "success");
}

// ===== SETTINGS =====
function loadFees() {
  document.getElementById("feeTricycle").value = fees.Tricycle || 5;
  document.getElementById("feeJeepney").value = fees.Jeepney || 60;
  document.getElementById("feeMulticab").value = fees.Multicab || 60;
  document.getElementById("feeBus").value = fees.Bus || 100;
}
function saveFees() {
  fees = {
    Tricycle: parseInt(document.getElementById("feeTricycle").value) || 5,
    Jeepney: parseInt(document.getElementById("feeJeepney").value) || 60,
    Multicab: parseInt(document.getElementById("feeMulticab").value) || 60,
    Bus: parseInt(document.getElementById("feeBus").value) || 100,
  };
  localStorage.setItem("borongan_fees", JSON.stringify(fees));
  showToast("Fees saved", "success");
  addActivity("Updated Fees", "Vehicle fees updated");
}
function updateAdmin() {
  const p = document.getElementById("adminPassword").value,
    c = document.getElementById("adminConfirmPassword").value;
  if (p && p !== c) {
    showToast("Passwords do not match", "error");
    return;
  }
  showToast("Profile updated", "success");
  addActivity("Updated Profile", "Admin profile");
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminConfirmPassword").value = "";
}
