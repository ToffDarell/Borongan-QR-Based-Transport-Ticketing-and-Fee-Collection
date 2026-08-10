// ===== DATA STORE =====
let drivers = JSON.parse(localStorage.getItem('borongan_drivers') || '[]');
let transactions = JSON.parse(localStorage.getItem('borongan_transactions') || '[]');
let vehicles = JSON.parse(localStorage.getItem('borongan_vehicles') || '[]');
let fees = JSON.parse(localStorage.getItem('borongan_fees') || '{"Tricycle":5,"Jeepney":60,"Multicab":60,"Bus":100}');
let activities = JSON.parse(localStorage.getItem('borongan_activities') || '[]');
let chartInstance = null;
let qrUsage = JSON.parse(localStorage.getItem('borongan_qr_usage') || '{}');

function showToast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', warning:'fa-triangle-exclamation' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon"><i class="fas ${icons[type]||icons.success}"></i></span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 300); }, 4000);
}

function addActivity(action, details) {
  const now = new Date();
  let badgeClass = 'updated';
  let icon = 'fa-pencil';
  if (action.includes('Added')) { badgeClass = 'added'; icon = 'fa-plus-circle'; }
  else if (action.includes('Deleted')) { badgeClass = 'deleted'; icon = 'fa-trash'; }
  else if (action.includes('Payment')) { badgeClass = 'payment'; icon = 'fa-credit-card'; }
  activities.unshift({ action, details, time: now.toTimeString().slice(0,5), timestamp: now.toISOString(), badgeClass, icon });
  if (activities.length > 50) activities.pop();
  localStorage.setItem('borongan_activities', JSON.stringify(activities));
  renderActivities();
}

function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.sidebar-item[data-page="${page}"]`)?.classList.add('active');
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function renderActivities() {
  const el = document.getElementById('recentActivities');
  if (!activities.length) { el.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">No recent activities</div>'; return; }
  el.innerHTML = activities.slice(0,10).map(a => `
    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition">
      <span class="activity-badge ${a.badgeClass || 'updated'}">${a.action.split(' ')[0]}</span>
      <span class="flex-1 text-gray-700">${a.action} <span class="text-gray-500">${a.details}</span></span>
      <span class="text-gray-400 text-xs">${a.time}</span>
    </div>
  `).join('');
}

function initSidebar() {
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', function() {
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      const pg = document.getElementById('page-'+this.dataset.page);
      if (pg) pg.classList.add('active');
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('admin_logged_in') !== 'true') {
    window.location.href = 'admin-login.html';
    return;
  }

  document.getElementById('mobileToggle').addEventListener('click', function() { document.getElementById('sidebar').classList.toggle('open'); });
  initSidebar();
  updateLastUpdated();
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
  const adminName = localStorage.getItem('admin_name') || 'Admin';
  document.getElementById('adminGreetingName').textContent = adminName;
});

window.logout = function() {
  if (confirm('Are you sure you want to log out of the admin panel?')) {
    localStorage.removeItem('admin_logged_in');
    window.location.href = 'admin-login.html';
  }
};

function updateLastUpdated() {
  document.getElementById('lastUpdatedTime').textContent = new Date().toLocaleTimeString();
}

function globalSearch() {
  const query = document.getElementById('globalSearch').value.trim();
  if (!query) { showToast('Enter a search term', 'warning'); return; }
  const found = drivers.filter(d => 
    d.fullName.toLowerCase().includes(query.toLowerCase()) ||
    d.driverId.toLowerCase().includes(query.toLowerCase()) ||
    (d.plateNumber && d.plateNumber.toLowerCase().includes(query.toLowerCase()))
  );
  if (found.length > 0) {
    document.querySelector('[data-page=drivers]').click();
    document.getElementById('driverSearch').value = query;
    filterDrivers();
    showToast(`Found ${found.length} driver(s)`, 'success');
  } else {
    showToast('No results found', 'warning');
  }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(m => { m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); }); });

function logout() { if (confirm('Logout?')) { localStorage.removeItem('admin_logged_in'); window.location.href='admin-login.html'; } }

let confirmCallback = null;
function showConfirm(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = msg;
  confirmCallback = cb;
  document.getElementById('confirmYesBtn').onclick = function() { closeModal('confirmModal'); if (confirmCallback) confirmCallback(); };
  openModal('confirmModal');
}

// ===== PHOTO PREVIEW =====
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('photoPlaceholder').style.display = 'none';
    const preview = document.getElementById('photoPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function resetPhotoPreview() {
  document.getElementById('photoPreview').src = '';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('photoPlaceholder').style.display = 'flex';
  document.getElementById('dPhoto').value = '';
}

// ===== DASHBOARD =====
function updateDashboard() {
  const totalDrivers = drivers.length;
  const totalVehicles = vehicles.length;
  const today = new Date().toDateString();
  const todayTrans = transactions.filter(t => new Date(t.date).toDateString() === today);
  const monthTrans = transactions.filter(t => new Date(t.date).getMonth() === new Date().getMonth());
  const todayTotal = todayTrans.reduce((s,t) => s + t.amount, 0);
  const monthTotal = monthTrans.reduce((s,t) => s + t.amount, 0);
  const activeDrivers = drivers.filter(d => d.status !== 'Inactive').length;
  const activeVehicles = vehicles.filter(v => v.status === 'Active').length;
  const pending = drivers.filter(d => d.status === 'Pending').length;
  const qrCount = drivers.filter(d => d.status !== 'Inactive').length;
  const activeToday = todayTrans.length;
  const regVehicles = vehicles.length;

  document.getElementById('statDrivers').textContent = totalDrivers;
  document.getElementById('statActiveDrivers').textContent = activeDrivers;
  document.getElementById('statVehicles').textContent = totalVehicles;
  document.getElementById('statActiveVehicles').textContent = activeVehicles;
  document.getElementById('statTodayCollect').textContent = '₱' + todayTotal;
  document.getElementById('statMonthlyCollect').textContent = '₱' + monthTotal;
  document.getElementById('monthlyTransCount').textContent = monthTrans.length;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statQR').textContent = qrCount;
  document.getElementById('statActiveToday').textContent = activeToday;
  document.getElementById('statRegVehicles').textContent = regVehicles;

  document.getElementById('todayTrend').textContent = '● Current';

  const recent = transactions.slice(-5).reverse();
  const rb = document.getElementById('recentTable');
  if (!recent.length) rb.innerHTML = '<tr><td colspan="4"><div class="empty-state py-3"><i class="fas fa-inbox"></i><p class="text-sm">No transactions</p></div></td></tr>';
  else rb.innerHTML = recent.map(t => `<tr class="border-b border-gray-100"><td class="py-2">${t.driverName}</td><td class="py-2">${t.vehicleType}</td><td class="py-2 font-bold text-primary">₱${t.amount}</td><td class="py-2 text-sm text-gray-500">${t.time}</td></tr>`).join('');
  updateChartData();
}

// ===== CHART =====
function initChart() {
  const ctx = document.getElementById('collectionChart').getContext('2d');
  chartInstance = new Chart(ctx, { type:'bar', data:{ labels:[], datasets:[{ label:'Collection (₱)', data:[], backgroundColor:'rgba(178,34,52,0.7)', borderColor:'#b22234', borderWidth:2, borderRadius:4 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:v => '₱'+v } } } } });
  updateChartData();
}
function updateChartData() {
  const labels = [], data = [];
  for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); const ds = d.toISOString().split('T')[0]; const total = transactions.filter(t => t.date === ds).reduce((s,t) => s + t.amount, 0); labels.push(d.toLocaleDateString('en-US',{month:'short',day:'numeric'})); data.push(total); }
  if (chartInstance) { chartInstance.data.labels = labels; chartInstance.data.datasets[0].data = data; chartInstance.update(); }
}
function updateChart(type) { if (chartInstance) { chartInstance.config.type = type; chartInstance.update(); showToast(`Chart: ${type}`, 'success'); } }

// ===== DRIVERS =====
function renderDrivers() {
  const search = document.getElementById('driverSearch').value.toLowerCase();
  const sort = document.getElementById('driverSort').value;
  let filtered = drivers.filter(d => d.fullName.toLowerCase().includes(search) || d.driverId.toLowerCase().includes(search) || (d.plateNumber||'').toLowerCase().includes(search));
  if (sort === 'newest') filtered = filtered.sort((a,b) => b.driverId.localeCompare(a.driverId));
  else if (sort === 'oldest') filtered = filtered.sort((a,b) => a.driverId.localeCompare(b.driverId));
  else if (sort === 'name') filtered = filtered.sort((a,b) => a.fullName.localeCompare(b.fullName));
  const table = document.getElementById('driverTable');
  if (!filtered.length) { table.innerHTML = '<tr><td colspan="8"><div class="empty-state py-4"><i class="fas fa-user-slash"></i><h3>No drivers</h3><p>Add a driver</p></div></td></tr>'; return; }
  table.innerHTML = filtered.map(d => `<tr class="border-b border-gray-100 hover:bg-gray-50">
    <td class="py-2">
      <div class="profile-photo">
        ${d.photo ? `<img src="${d.photo}" alt="${d.fullName}">` : `<span>${d.fullName.charAt(0).toUpperCase()}</span>`}
      </div>
    </td>
    <td class="py-2 font-mono text-xs">${d.driverId}</td>
    <td class="py-2 font-medium">${d.fullName}</td>
    <td class="py-2 text-sm">${d.vehicleType||'N/A'} - ${d.plateNumber||'N/A'}</td>
    <td class="py-2 text-sm">${d.contact||'N/A'}</td>
    <td class="py-2 text-sm">${d.licenseNo||'N/A'}</td>
    <td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${d.status === 'Inactive' ? 'bg-red-100 text-red-700' : d.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">${d.status||'Active'}</span></td>
    <td class="py-2"><button class="btn-primary btn-sm" onclick="editDriver('${d.driverId}')"><i class="fas fa-edit"></i></button><button class="btn-danger btn-sm" onclick="confirmDeleteDriver('${d.driverId}')"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('');
}
function filterDrivers() { renderDrivers(); }

document.getElementById('driverForm').addEventListener('submit', function(e) { e.preventDefault(); saveDriver(); });

function saveDriver() {
  const btn = document.getElementById('driverSubmitBtn');
  const text = document.getElementById('driverSubmitText');
  btn.disabled = true; text.innerHTML = '<span class="spinner"></span> Saving...';
  setTimeout(() => {
    const id = document.getElementById('editDriverId').value;
    const photoFile = document.getElementById('dPhoto').files[0];
    let photoData = document.getElementById('photoPreview').src || '';
    
    const data = {
      fullName: document.getElementById('dFullName').value.trim(),
      address: document.getElementById('dAddress').value.trim(),
      contact: document.getElementById('dContact').value.trim(),
      birthdate: document.getElementById('dBirthdate').value,
      gender: document.getElementById('dGender').value,
      vehicleType: document.getElementById('dVehicleType').value,
      plateNumber: document.getElementById('dPlateNumber').value.trim().toUpperCase(),
      licenseNo: document.getElementById('dLicenseNo').value.trim().toUpperCase(),
      username: document.getElementById('dUsername').value.trim(),
      password: document.getElementById('dPassword').value || 'default123',
      status: 'Active'
    };
    
    // If there's a photo, save it
    if (photoData && photoData.startsWith('data:image')) {
      data.photo = photoData;
    } else if (id) {
      // Keep existing photo if editing and no new photo uploaded
      const existing = drivers.find(d => d.driverId === id);
      if (existing && existing.photo) {
        data.photo = existing.photo;
      }
    }
    
    if (!data.fullName || !data.username) { showToast('Required fields missing', 'error'); btn.disabled=false; text.textContent='Save'; return; }
    if (id) {
      const idx = drivers.findIndex(d => d.driverId === id);
      if (idx !== -1) drivers[idx] = { ...drivers[idx], ...data };
      showToast(`Driver ${data.fullName} updated`, 'success'); addActivity('Updated Driver', data.fullName);
    } else {
      const lastId = drivers.reduce((max, d) => Math.max(max, parseInt(d.driverId ? d.driverId.split('-')[1] : 0)), 0);
      data.driverId = `DR-${String(lastId + 1).padStart(4, '0')}`;
      drivers.push(data);
      showToast(`Driver ${data.fullName} added`, 'success'); addActivity('Added Driver', data.fullName);
    }
    localStorage.setItem('borongan_drivers', JSON.stringify(drivers));
    syncVehiclesFromDrivers();
    closeModal('driverModal');
    document.getElementById('driverForm').reset();
    document.getElementById('editDriverId').value = '';
    document.getElementById('driverModalTitle').textContent = 'Add Driver';
    resetPhotoPreview();
    renderDrivers(); updateDashboard(); loadVehicleDrivers(); renderQRs();
    btn.disabled=false; text.textContent='Save';
  }, 500);
}

function editDriver(id) {
  const d = drivers.find(x => x.driverId === id);
  if (!d) return;
  document.getElementById('editDriverId').value = id;
  document.getElementById('dFullName').value = d.fullName||'';
  document.getElementById('dAddress').value = d.address||'';
  document.getElementById('dContact').value = d.contact||'';
  document.getElementById('dBirthdate').value = d.birthdate||'';
  document.getElementById('dGender').value = d.gender||'';
  document.getElementById('dVehicleType').value = d.vehicleType||'';
  document.getElementById('dPlateNumber').value = d.plateNumber||'';
  document.getElementById('dLicenseNo').value = d.licenseNo||'';
  document.getElementById('dUsername').value = d.username||'';
  document.getElementById('dPassword').value = '';
  
  // Load existing photo if available
  if (d.photo) {
    document.getElementById('photoPlaceholder').style.display = 'none';
    const preview = document.getElementById('photoPreview');
    preview.src = d.photo;
    preview.style.display = 'block';
  } else {
    resetPhotoPreview();
  }
  
  document.getElementById('driverModalTitle').textContent = 'Edit Driver';
  openModal('driverModal');
}

function confirmDeleteDriver(id) {
  const d = drivers.find(x => x.driverId === id);
  if (!d) return;
  showConfirm('Delete Driver?', `Delete "${d.fullName}"?`, () => { drivers = drivers.filter(x => x.driverId !== id); localStorage.setItem('borongan_drivers', JSON.stringify(drivers)); showToast(`Deleted ${d.fullName}`, 'error'); addActivity('Deleted Driver', d.fullName); renderDrivers(); updateDashboard(); loadVehicleDrivers(); renderQRs(); });
}

// ===== VEHICLES =====
document.getElementById('vehicleForm').addEventListener('submit', function(e) { e.preventDefault(); saveVehicle(); });

function syncVehiclesFromDrivers() {
  drivers.forEach(d => {
    if (d.plateNumber && d.vehicleType) {
      if (!vehicles.some(v => v.plateNumber === d.plateNumber)) {
        vehicles.push({ plateNumber: d.plateNumber, vehicleType: d.vehicleType, driverId: d.driverId, status: 'Active' });
      } else {
        const v = vehicles.find(v => v.plateNumber === d.plateNumber);
        if (v && v.driverId !== d.driverId) v.driverId = d.driverId;
      }
    }
  });
  localStorage.setItem('borongan_vehicles', JSON.stringify(vehicles));
  renderVehicles(); updateDashboard(); showToast('Vehicles synced', 'success');
}

function renderVehicles() {
  const search = document.getElementById('vehicleSearch').value.toLowerCase();
  let filtered = vehicles.filter(v => v.plateNumber.toLowerCase().includes(search) || v.vehicleType.toLowerCase().includes(search));
  document.getElementById('vehicleCount').textContent = vehicles.length;
  document.getElementById('activeVehicleCount').textContent = vehicles.filter(v => v.status === 'Active').length;
  document.getElementById('inactiveVehicleCount').textContent = vehicles.filter(v => v.status === 'Inactive').length;
  const table = document.getElementById('vehicleTable');
  if (!filtered.length) { table.innerHTML = '<tr><td colspan="5"><div class="empty-state py-4"><i class="fas fa-truck"></i><h3>No vehicles</h3></div></td></tr>'; return; }
  table.innerHTML = filtered.map(v => {
    const driver = drivers.find(d => d.driverId === v.driverId);
    return `<tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 font-mono text-sm font-bold">${v.plateNumber}</td>
      <td class="py-2">${v.vehicleType}</td>
      <td class="py-2">${driver ? driver.fullName : '<span class="text-gray-400">Unassigned</span>'}</td>
      <td class="py-2"><span class="px-2 py-1 rounded-full text-xs ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${v.status}</span></td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="editVehicle('${v.plateNumber}')"><i class="fas fa-edit"></i></button><button class="btn-danger btn-sm" onclick="confirmDeleteVehicle('${v.plateNumber}')"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function loadVehicleDrivers() {
  const s = document.getElementById('vDriver');
  s.innerHTML = '<option value="">Unassigned</option>';
  drivers.forEach(d => { s.innerHTML += `<option value="${d.driverId}">${d.fullName} (${d.driverId})</option>`; });
}

function saveVehicle() {
  const btn = document.getElementById('vehicleSubmitBtn');
  const text = document.getElementById('vehicleSubmitText');
  btn.disabled = true; text.innerHTML = '<span class="spinner"></span> Saving...';
  setTimeout(() => {
    const editPlate = document.getElementById('editVehiclePlate').value;
    const data = {
      plateNumber: document.getElementById('vPlateNumber').value.trim().toUpperCase(),
      vehicleType: document.getElementById('vVehicleType').value,
      driverId: document.getElementById('vDriver').value,
      status: document.getElementById('vStatus').value
    };
    if (!data.plateNumber || !data.vehicleType) { showToast('Required fields missing', 'error'); btn.disabled=false; text.textContent='Save'; return; }
    if (editPlate) {
      const idx = vehicles.findIndex(v => v.plateNumber === editPlate);
      if (idx !== -1) { vehicles[idx] = { ...vehicles[idx], ...data }; showToast(`Vehicle ${data.plateNumber} updated`, 'success'); addActivity('Updated Vehicle', data.plateNumber); }
    } else {
      if (vehicles.some(v => v.plateNumber === data.plateNumber)) { showToast('Plate exists', 'error'); btn.disabled=false; text.textContent='Save'; return; }
      vehicles.push(data); showToast(`Vehicle ${data.plateNumber} added`, 'success'); addActivity('Added Vehicle', data.plateNumber);
    }
    localStorage.setItem('borongan_vehicles', JSON.stringify(vehicles));
    closeModal('vehicleModal');
    document.getElementById('vehicleForm').reset();
    document.getElementById('editVehiclePlate').value = '';
    document.getElementById('vehicleModalTitle').textContent = 'Add Vehicle';
    renderVehicles(); updateDashboard();
    btn.disabled=false; text.textContent='Save';
  }, 500);
}

function editVehicle(plate) {
  const v = vehicles.find(x => x.plateNumber === plate);
  if (!v) return;
  document.getElementById('editVehiclePlate').value = plate;
  document.getElementById('vPlateNumber').value = v.plateNumber;
  document.getElementById('vVehicleType').value = v.vehicleType;
  document.getElementById('vDriver').value = v.driverId||'';
  document.getElementById('vStatus').value = v.status;
  document.getElementById('vehicleModalTitle').textContent = 'Edit Vehicle';
  openModal('vehicleModal');
}
function confirmDeleteVehicle(plate) { showConfirm('Delete Vehicle?', `Delete ${plate}?`, () => { vehicles = vehicles.filter(v => v.plateNumber !== plate); localStorage.setItem('borongan_vehicles', JSON.stringify(vehicles)); showToast(`Deleted ${plate}`, 'error'); addActivity('Deleted Vehicle', plate); renderVehicles(); updateDashboard(); }); }

// ===== QR =====
function renderQRs() {
  const table = document.getElementById('qrTable');
  if (!drivers.length) { table.innerHTML = '<tr><td colspan="7"><div class="empty-state py-4"><i class="fas fa-qrcode"></i><h3>No QR codes</h3></div></td></tr>'; return; }
  table.innerHTML = drivers.map(d => {
    const usage = qrUsage[d.driverId] || { lastScanned: 'Never', timesUsed: 0 };
    return `<tr class="border-b border-gray-100">
      <td class="py-2 font-medium">${d.fullName}</td>
      <td class="py-2">${d.vehicleType||'N/A'} - ${d.plateNumber||'N/A'}</td>
      <td class="py-2"><div id="qr-${d.driverId}" style="width:50px;height:50px;"></div></td>
      <td class="py-2"><span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span></td>
      <td class="py-2 text-xs">${usage.lastScanned}</td>
      <td class="py-2 text-xs">${usage.timesUsed}</td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="generateQR('${d.driverId}')"><i class="fas fa-sync"></i></button><button class="btn-outline btn-sm" onclick="printQR('${d.driverId}')"><i class="fas fa-print"></i></button><button class="btn-danger btn-sm" onclick="deleteQR('${d.driverId}')"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');
  drivers.forEach(d => {
    const c = document.getElementById(`qr-${d.driverId}`);
    if (c) { c.innerHTML = ''; try { new QRCode(c, { text: `ID:${d.driverId}|Name:${d.fullName}|Plate:${d.plateNumber}|Type:${d.vehicleType}`, width:50, height:50, colorDark:'#b22234', colorLight:'#ffffff' }); } catch(e) { c.innerHTML='<span class="text-xs text-gray-400">QR</span>'; } }
  });
}
function generateQR(id) { showToast(`QR regenerated for ${drivers.find(d=>d.driverId===id)?.fullName}`, 'success'); renderQRs(); }
function printQR(id) { window.open(`driver-id.html?id=${id}`, '_blank'); }
function deleteQR(id) { showConfirm('Delete QR?', 'Remove QR code?', () => { drivers = drivers.filter(d => d.driverId !== id); localStorage.setItem('borongan_drivers', JSON.stringify(drivers)); renderQRs(); updateDashboard(); showToast('QR deleted', 'error'); }); }

// ===== PAYMENT =====
function scanQR() {
  const input = document.getElementById('qrScanInput').value.trim();
  if (!input) { showToast('Enter search term', 'warning'); return; }
  const driver = drivers.find(d => d.driverId === input || d.plateNumber === input.toUpperCase() || d.fullName.toLowerCase().includes(input.toLowerCase()));
  const details = document.getElementById('paymentDetails');
  if (!driver) { details.innerHTML = `<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle text-4xl block mb-2"></i>Driver not found</div>`; showToast('Driver not found', 'error'); return; }
  const fee = fees[driver.vehicleType] || 0;
  details.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center gap-3 border-b border-gray-100 pb-3">
        <div class="profile-photo w-12 h-12 text-lg">
          ${driver.photo ? `<img src="${driver.photo}" alt="${driver.fullName}">` : `<span>${driver.fullName.charAt(0).toUpperCase()}</span>`}
        </div>
        <div><div class="font-bold text-gray-800">${driver.fullName}</div><div class="text-sm text-gray-500">${driver.driverId}</div></div>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm"><div class="text-gray-500">Vehicle</div><div class="font-medium">${driver.vehicleType}</div><div class="text-gray-500">Plate</div><div class="font-medium">${driver.plateNumber}</div><div class="text-gray-500">Fee</div><div class="font-bold text-primary text-lg">₱${fee}</div></div>
      <div class="flex gap-2 mt-4"><button class="btn-primary flex-1" onclick="processPayment('${driver.driverId}', ${fee})"><i class="fas fa-check"></i> Collect</button><button class="btn-outline flex-1" onclick="clearPayment()">Cancel</button></div>
    </div>
  `;
}
function clearPayment() { document.getElementById('qrScanInput').value = ''; document.getElementById('paymentDetails').innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-credit-card text-4xl block mb-2"></i>Search for a driver</div>'; }

function processPayment(driverId, amount) {
  const driver = drivers.find(d => d.driverId === driverId);
  if (!driver) return;
  const now = new Date();
  const trans = {
    id: 'TR-' + String(transactions.length + 1).padStart(4, '0'),
    driverId: driver.driverId,
    driverName: driver.fullName,
    vehicleType: driver.vehicleType,
    plateNumber: driver.plateNumber,
    amount: amount,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0,5),
    timestamp: now.toISOString()
  };
  transactions.push(trans);
  localStorage.setItem('borongan_transactions', JSON.stringify(transactions));
  if (!qrUsage[driverId]) qrUsage[driverId] = { lastScanned: now.toLocaleString(), timesUsed: 0 };
  qrUsage[driverId].lastScanned = now.toLocaleString();
  qrUsage[driverId].timesUsed += 1;
  localStorage.setItem('borongan_qr_usage', JSON.stringify(qrUsage));
  
  printReceipt(trans);
  
  document.getElementById('paymentDetails').innerHTML = `<div class="text-center py-8 text-green-600"><i class="fas fa-check-circle text-4xl block mb-2"></i><div class="font-bold text-lg">Payment Received!</div><div class="text-sm">₱${amount} from ${driver.fullName}</div><div class="text-xs text-gray-500 mt-2">Receipt: ${trans.id} | ${trans.date} ${trans.time}</div></div>`;
  showToast(`₱${amount} from ${driver.fullName}`, 'success');
  addActivity('Payment Received', `${driver.fullName} - ₱${amount}`);
  updateDashboard(); renderTransactions(); updateChartData();
}

function printReceipt(trans) {
  const driver = drivers.find(d => d.driverId === trans.driverId);
  const printWindow = window.open('', '_blank', 'width=400,height=600');
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
      <div class="row"><span class="label">Plate</span><span class="value">${trans.plateNumber || 'N/A'}</span></div>
      <div class="row"><span class="label">Vehicle</span><span class="value">${trans.vehicleType}</span></div>
      <div class="row"><span class="label">Amount</span><span class="value">₱${trans.amount}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${trans.date}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${trans.time}</span></div>
      <div class="footer">Thank you!</div>
    </div>
    <script>window.print(); setTimeout(() => { window.close(); }, 1000); <\/script>
  `);
  printWindow.document.close();
}

document.getElementById('qrScanInput').addEventListener('keydown', e => { if (e.key === 'Enter') scanQR(); });

// ===== TRANSACTIONS =====
function renderTransactions() {
  const search = document.getElementById('transSearch').value.toLowerCase();
  const dateFilter = document.getElementById('transDate').value;
  let data = transactions;
  if (search) data = data.filter(t => t.driverName.toLowerCase().includes(search) || t.driverId.toLowerCase().includes(search) || t.id.toLowerCase().includes(search));
  if (dateFilter) data = data.filter(t => t.date === dateFilter);
  const table = document.getElementById('transTable');
  if (!data.length) { table.innerHTML = '<tr><td colspan="7"><div class="empty-state py-4"><i class="fas fa-receipt"></i><h3>No transactions</h3></div></td></tr>'; return; }
  table.innerHTML = data.slice().reverse().map(t => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-2 font-mono text-xs">${t.id}</td>
      <td class="py-2">${t.driverName}</td>
      <td class="py-2">${t.vehicleType}</td>
      <td class="py-2 font-bold text-primary">₱${t.amount}</td>
      <td class="py-2 text-sm">${t.date}</td>
      <td class="py-2 text-sm">${t.time}</td>
      <td class="py-2"><button class="btn-primary btn-sm" onclick="printReceiptById('${t.id}')"><i class="fas fa-print"></i></button></td>
    </tr>
  `).join('');
}

function printReceiptById(id) {
  const t = transactions.find(x => x.id === id);
  if (t) printReceipt(t);
}

function exportTransactionsPDF() {
  showToast('PDF export ready', 'success');
  const data = transactions;
  if (!data.length) { showToast('No data to export', 'warning'); return; }
  const rows = data.slice().reverse().map(t => `<tr><td>${t.id}</td><td>${t.driverName}</td><td>${t.vehicleType}</td><td>&#8369;${t.amount}</td><td>${t.date}</td><td>${t.time}</td></tr>`).join('');
  const total = data.reduce((s,t) => s + t.amount, 0);
  const printWindow = window.open('', '_blank', 'width=900,height=700');
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
    <div class="footer">Prepared by: ${document.getElementById('adminName').value || 'Admin'}<\/div>
    <script>window.print(); setTimeout(() => { window.close(); }, 1500);<\/script>
  `);
  printWindow.document.close();
}

function exportTransactionsExcel() {
  showToast('Excel export ready', 'success');
  const data = transactions;
  if (!data.length) { showToast('No data to export', 'warning'); return; }
  let csv = 'Receipt,Driver,Vehicle,Amount,Date,Time\n';
  data.slice().reverse().forEach(t => {
    csv += `${t.id},${t.driverName},${t.vehicleType},${t.amount},${t.date},${t.time}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'transactions.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

// ===== REPORTS =====
function generateReport(type) {
  const dataContainer = document.getElementById('reportData');
  const summary = document.getElementById('reportSummary');
  let filtered = transactions;
  let periodLabel = '', reportTypeLabel = '';
  const now = new Date();
  if (type === 'daily') {
    const today = now.toDateString();
    filtered = transactions.filter(t => new Date(t.date).toDateString() === today);
    periodLabel = today; reportTypeLabel = 'Daily Report';
  } else if (type === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    filtered = transactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
    periodLabel = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`; reportTypeLabel = 'Weekly Report';
  } else if (type === 'monthly') {
    filtered = transactions.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
    periodLabel = now.toLocaleString('default', { month:'long', year:'numeric' }); reportTypeLabel = 'Monthly Report';
  } else if (type === 'yearly') {
    filtered = transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
    periodLabel = now.getFullYear().toString(); reportTypeLabel = 'Yearly Report';
  }
  if (!filtered.length) { dataContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No data for this period</p>'; summary.innerHTML = '<p class="text-gray-400 text-sm">No data</p>'; showToast('No data', 'warning'); return; }
  const summaryData = {};
  filtered.forEach(t => { if (!summaryData[t.vehicleType]) summaryData[t.vehicleType] = { count:0, total:0 }; summaryData[t.vehicleType].count++; summaryData[t.vehicleType].total += t.amount; });
  summary.innerHTML = Object.entries(summaryData).map(([k,v]) => `<div class="flex justify-between border-b border-gray-100 py-1 text-sm"><span>${k}</span><span>${v.count} - &#8369;${v.total}</span></div>`).join('') +
    `<div class="flex justify-between py-2 font-bold text-primary"><span>Total</span><span>${filtered.length} - &#8369;${filtered.reduce((s,t) => s + t.amount, 0)}</span></div>`;
  const rows = filtered.slice().reverse().map(t => `<tr><td>${t.id}</td><td>${t.driverName}</td><td>${t.vehicleType}</td><td>&#8369;${t.amount}</td><td>${t.date}</td></tr>`).join('');
  const total = filtered.reduce((s,t) => s + t.amount, 0);
  const admin = document.getElementById('adminName').value || 'Admin';
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
  showToast(`Report generated: ${reportTypeLabel}`, 'success');
}

// ===== SETTINGS =====
function loadFees() {
  document.getElementById('feeTricycle').value = fees.Tricycle || 5;
  document.getElementById('feeJeepney').value = fees.Jeepney || 60;
  document.getElementById('feeMulticab').value = fees.Multicab || 60;
  document.getElementById('feeBus').value = fees.Bus || 100;
}
function saveFees() {
  fees = { Tricycle: parseInt(document.getElementById('feeTricycle').value)||5, Jeepney: parseInt(document.getElementById('feeJeepney').value)||60, Multicab: parseInt(document.getElementById('feeMulticab').value)||60, Bus: parseInt(document.getElementById('feeBus').value)||100 };
  localStorage.setItem('borongan_fees', JSON.stringify(fees));
  showToast('Fees saved', 'success'); addActivity('Updated Fees', 'Vehicle fees updated');
}
function updateAdmin() {
  const p = document.getElementById('adminPassword').value, c = document.getElementById('adminConfirmPassword').value;
  if (p && p !== c) { showToast('Passwords do not match', 'error'); return; }
  showToast('Profile updated', 'success'); addActivity('Updated Profile', 'Admin profile');
  document.getElementById('adminPassword').value = ''; document.getElementById('adminConfirmPassword').value = '';
}