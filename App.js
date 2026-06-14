/* ═══════════════════════════════════════════
   KELUARGA IMAM — APP.JS
   LocalStorage sebagai fallback jika Supabase
   belum dikonfigurasi
═══════════════════════════════════════════ */

// ── KONFIGURASI SUPABASE ──
// Ganti dengan URL dan KEY dari dashboard Supabase kamu
const SUPABASE_URL = 'GANTI_DENGAN_SUPABASE_URL';
const SUPABASE_KEY = 'GANTI_DENGAN_SUPABASE_ANON_KEY';
const FAMILY_CODE  = 'imamfamily2024'; // Ganti kode keluarga di sini

let supabase = null;
let useLocalStorage = true;

// Init Supabase jika sudah dikonfigurasi
if (SUPABASE_URL !== 'GANTI_DENGAN_SUPABASE_URL') {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    useLocalStorage = false;
  } catch(e) { console.warn('Supabase tidak tersedia, pakai localStorage.'); }
}

// ── STATE ──
let vehicles  = [];
let services  = [];
let workshops = [];
let currentWizardStep = 1;
let currentVehicleType = 'Motor';

// ── STANDAR SERVIS (built-in reference) ──
const SERVICE_SCHEDULE = {
  Motor: [
    { name: 'Ganti Oli Mesin',    km: 2000,  months: 3  },
    { name: 'Ganti Busi',         km: 8000,  months: 12 },
    { name: 'Filter Udara',       km: 12000, months: 12 },
    { name: 'Servis Karburator',  km: 6000,  months: 6  },
    { name: 'Cek Rem',            km: 6000,  months: 6  },
    { name: 'Tune Up Ringan',     km: 6000,  months: 6  },
    { name: 'Tune Up Besar',      km: 24000, months: 24 },
    { name: 'Ganti Rantai/Belt',  km: 20000, months: 24 },
  ],
  Mobil: [
    { name: 'Ganti Oli Mesin',      km: 5000,  months: 6  },
    { name: 'Ganti Oli Transmisi',  km: 40000, months: 24 },
    { name: 'Filter Udara',         km: 20000, months: 12 },
    { name: 'Busi',                 km: 20000, months: 24 },
    { name: 'Cek Rem & Kampas',     km: 10000, months: 12 },
    { name: 'Filter Bahan Bakar',   km: 40000, months: 24 },
    { name: 'Timing Belt/Chain',    km: 60000, months: 48 },
    { name: 'Tune Up',              km: 10000, months: 12 },
    { name: 'Cek AC & Freon',       km: 20000, months: 12 },
    { name: 'Fluida Rem',           km: 20000, months: 24 },
  ]
};

// ── LOGIN ──
document.getElementById('login-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function doLogin() {
  const code = document.getElementById('login-code').value.trim();
  const err  = document.getElementById('login-error');
  if (code === FAMILY_CODE) {
    err.classList.add('hidden');
    sessionStorage.setItem('ki_auth', '1');
    showApp();
  } else {
    err.classList.remove('hidden');
    document.getElementById('login-code').classList.add('shake');
    setTimeout(() => document.getElementById('login-code').classList.remove('shake'), 400);
  }
}

function doLogout() {
  sessionStorage.removeItem('ki_auth');
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('login-code').value = '';
}

// ── INIT ──
async function showApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  setGreeting();
  await loadAll();
  checkAutoRedirect();
}

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  document.getElementById('dashboard-greeting').textContent = `${greet}, Keluarga Imam 👋`;
}

async function loadAll() {
  await Promise.all([loadVehicles(), loadServices(), loadWorkshops()]);
  renderDashboard();
  renderVehicleList();
  renderServiceList();
  renderReminderList();
  renderWorkshopList();
  populateVehicleSelects();
  checkNotifications();
}

// ── STORAGE HELPERS ──
async function dbGet(table) {
  if (useLocalStorage) {
    return JSON.parse(localStorage.getItem('ki_' + table) || '[]');
  }
  const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  return data || [];
}

async function dbInsert(table, row) {
  if (useLocalStorage) {
    const rows = await dbGet(table);
    row.id = Date.now().toString();
    row.created_at = new Date().toISOString();
    rows.unshift(row);
    localStorage.setItem('ki_' + table, JSON.stringify(rows));
    return row;
  }
  const { data } = await supabase.from(table).insert(row).select().single();
  return data;
}

async function dbUpdate(table, id, updates) {
  if (useLocalStorage) {
    const rows = await dbGet(table);
    const idx  = rows.findIndex(r => r.id === id);
    if (idx > -1) { rows[idx] = { ...rows[idx], ...updates }; localStorage.setItem('ki_' + table, JSON.stringify(rows)); }
    return;
  }
  await supabase.from(table).update(updates).eq('id', id);
}

async function dbDelete(table, id) {
  if (useLocalStorage) {
    const rows = (await dbGet(table)).filter(r => r.id !== id);
    localStorage.setItem('ki_' + table, JSON.stringify(rows));
    return;
  }
  await supabase.from(table).delete().eq('id', id);
}

// ── LOAD DATA ──
async function loadVehicles()  { vehicles  = await dbGet('vehicles');  }
async function loadServices()  { services  = await dbGet('services');  }
async function loadWorkshops() { workshops = await dbGet('workshops'); }

// ── NAVIGATION ──
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidenav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
}

// ── DASHBOARD ──
function renderDashboard() {
  const grid = document.getElementById('vehicle-grid');
  grid.innerHTML = '';

  if (vehicles.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5"/><circle cx="18" cy="17" r="2"/><circle cx="7" cy="17" r="2"/></svg>
        <h4>Belum ada kendaraan</h4>
        <p>Tambahkan kendaraan pertama keluarga Imam</p>
        <button class="btn btn-primary" onclick="openAddVehicleModal()">+ Tambah Kendaraan</button>
      </div>`;
    updateStats(0, 0, 0, 0);
    return;
  }

  let ok = 0, warn = 0, urgent = 0;

  vehicles.forEach((v, i) => {
    const status = getVehicleStatus(v);
    if (status.level === 'ok') ok++;
    else if (status.level === 'warn') warn++;
    else urgent++;

    const card = document.createElement('div');
    card.className = 'vehicle-card';
    card.style.animationDelay = (i * 80) + 'ms';
    card.onclick = () => openVehicleDetail(v.id);

    const pct = Math.min(100, Math.round((status.kmSince / status.kmInterval) * 100));
    const fillClass = pct >= 90 ? 'fill-red' : pct >= 70 ? 'fill-amber' : 'fill-green';
    const badgeClass = status.level === 'ok' ? 'badge-ok' : status.level === 'warn' ? 'badge-warn' : 'badge-urgent';
    const badgeText  = status.level === 'ok' ? 'Kondisi Baik' : status.level === 'warn' ? 'Perlu Perhatian' : 'Segera Servis';

    card.innerHTML = `
      <div class="vehicle-card-top">
        <span class="vehicle-card-type ${v.type === 'Motor' ? 'type-motor' : 'type-mobil'}">${v.type}</span>
        <div class="vehicle-name">${v.brand} ${v.model}</div>
        <div class="vehicle-plate">${v.plate || '— Plat belum diisi —'}</div>
        <div class="vehicle-owner">Pemilik: ${v.owner}</div>
      </div>
      <div class="vehicle-card-mid">
        <div class="vehicle-km">
          <span class="vehicle-km-value">${Number(v.odometer || 0).toLocaleString('id')}</span>
          <span class="vehicle-km-unit">km</span>
        </div>
        <div class="progress-label">
          <span>Servis berikutnya</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${fillClass}" data-pct="${pct}" style="width:0%"></div>
        </div>
      </div>
      <div class="vehicle-card-bot">
        <span class="vehicle-last-service">${status.lastText}</span>
        <span class="vehicle-status-badge ${badgeClass}">${badgeText}</span>
      </div>`;

    grid.appendChild(card);
  });

  // Animate progress bars
  setTimeout(() => {
    document.querySelectorAll('.progress-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 200);

  updateStats(vehicles.length, ok, warn, urgent);
  animateCounter('stat-total-vehicles', vehicles.length);
  animateCounter('stat-ok', ok);
  animateCounter('stat-warning', warn);
  animateCounter('stat-urgent', urgent);
}

function updateStats(total, ok, warn, urgent) {
  document.getElementById('stat-total-vehicles').textContent = total;
  document.getElementById('stat-ok').textContent = ok;
  document.getElementById('stat-warning').textContent = warn;
  document.getElementById('stat-urgent').textContent = urgent;
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 20));
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 40);
}

function getVehicleStatus(vehicle) {
  const lastService = services
    .filter(s => s.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const schedule = SERVICE_SCHEDULE[vehicle.type] || SERVICE_SCHEDULE.Motor;
  const oliSchedule = schedule[0]; // Ganti oli sebagai indikator utama
  const kmInterval = oliSchedule.km;

  const kmSince = lastService
    ? Math.max(0, (vehicle.odometer || 0) - (lastService.odometer || 0))
    : (vehicle.odometer || 0);

  const daysSince = lastService
    ? Math.floor((Date.now() - new Date(lastService.date)) / 86400000)
    : 999;

  const kmPct    = kmSince / kmInterval;
  const monthPct = daysSince / (oliSchedule.months * 30);
  const maxPct   = Math.max(kmPct, monthPct);

  const level = maxPct >= 1 ? 'urgent' : maxPct >= 0.75 ? 'warn' : 'ok';
  const lastText = lastService
    ? `Servis ${formatDate(lastService.date)}`
    : 'Belum pernah servis';

  return { level, kmSince, kmInterval, daysSince, lastText };
}

// ── VEHICLE LIST (page kendaraan) ──
function renderVehicleList() {
  const el = document.getElementById('vehicle-list');
  el.innerHTML = '';
  if (vehicles.length === 0) {
    el.innerHTML = `<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5"/><circle cx="18" cy="17" r="2"/><circle cx="7" cy="17" r="2"/></svg><h4>Belum ada kendaraan</h4><p>Tambahkan kendaraan keluarga</p><button class="btn btn-primary" onclick="openAddVehicleModal()">+ Tambah</button></div>`;
    return;
  }
  vehicles.forEach((v, i) => {
    const el2 = document.createElement('div');
    el2.className = 'vehicle-list-item';
    el2.style.animationDelay = (i * 60) + 'ms';
    el2.innerHTML = `
      <div class="vehicle-avatar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5"/><circle cx="18" cy="17" r="2"/><circle cx="7" cy="17" r="2"/></svg>
      </div>
      <div class="vehicle-list-info">
        <div class="vehicle-list-name">${v.brand} ${v.model} ${v.year}</div>
        <div class="vehicle-list-sub">${v.plate || 'Plat belum diisi'} · ${v.owner} · ${Number(v.odometer||0).toLocaleString('id')} km</div>
      </div>
      <div class="vehicle-list-actions">
        <button class="btn btn-icon" onclick="openVehicleDetail('${v.id}')" title="Detail">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </button>
        <button class="btn btn-icon" onclick="editVehicle('${v.id}')" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-icon" onclick="deleteVehicle('${v.id}')" title="Hapus" style="color:var(--red)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    el.appendChild(el2);
  });
}

// ── ADD VEHICLE ──
function openAddVehicleModal() {
  currentWizardStep = 1;
  currentVehicleType = 'Motor';
  document.getElementById('vehicle-id').value = '';
  document.getElementById('modal-vehicle-title').textContent = 'Tambah Kendaraan';
  resetVehicleForm();
  updateWizardUI();
  openModal('modal-vehicle');
}

function resetVehicleForm() {
  ['v-brand','v-model','v-color','v-plate','v-notes','v-stnk-tax','v-stnk-5yr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('v-odometer').value = '';
  document.getElementById('v-pkb').value = '';
  document.getElementById('v-tire-date').value = '';
  document.getElementById('v-owner').value = 'Imam';
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-type="Motor"]').classList.add('active');

  // Fill year select
  const ySel = document.getElementById('v-year');
  ySel.innerHTML = '';
  const now = new Date().getFullYear();
  for (let y = now; y >= 1990; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    ySel.appendChild(opt);
  }
}

function pickType(btn, type) {
  currentVehicleType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function updateModels() {
  // Just a hint — model is free text input
}

function wizardNext() {
  if (currentWizardStep === 1) {
    const brand = document.getElementById('v-brand').value;
    const model = document.getElementById('v-model').value.trim();
    if (!brand || !model) { showToast('Pilih merek dan isi model kendaraan'); return; }
  }
  if (currentWizardStep < 3) {
    currentWizardStep++;
    updateWizardUI();
  } else {
    saveVehicle();
  }
}

function wizardBack() {
  if (currentWizardStep > 1) { currentWizardStep--; updateWizardUI(); }
}

function updateWizardUI() {
  for (let i = 1; i <= 3; i++) {
    document.getElementById('wizard-' + i).classList.toggle('active', i === currentWizardStep);
    document.getElementById('wizard-' + i).classList.toggle('hidden', i !== currentWizardStep);
  }
  document.querySelectorAll('.wizard-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.toggle('active', n === currentWizardStep);
    s.classList.toggle('done',   n < currentWizardStep);
  });
  document.querySelectorAll('.wizard-line').forEach((l, i) => {
    l.classList.toggle('done', i < currentWizardStep - 1);
  });
  document.getElementById('btn-wizard-back').style.display = currentWizardStep > 1 ? 'inline-flex' : 'none';
  document.getElementById('btn-wizard-next').textContent = currentWizardStep === 3 ? 'Simpan Kendaraan' : 'Lanjut →';
}

async function saveVehicle() {
  const id = document.getElementById('vehicle-id').value;
  const data = {
    type:       currentVehicleType,
    brand:      document.getElementById('v-brand').value,
    model:      document.getElementById('v-model').value.trim(),
    year:       document.getElementById('v-year').value,
    color:      document.getElementById('v-color').value.trim(),
    plate:      document.getElementById('v-plate').value.trim().toUpperCase(),
    odometer:   parseInt(document.getElementById('v-odometer').value) || 0,
    owner:      document.getElementById('v-owner').value,
    stnk_tax:   document.getElementById('v-stnk-tax').value,
    stnk_5yr:   document.getElementById('v-stnk-5yr').value,
    pkb:        parseInt(document.getElementById('v-pkb').value) || 0,
    tire_date:  document.getElementById('v-tire-date').value,
    notes:      document.getElementById('v-notes').value.trim(),
  };

  if (id) {
    await dbUpdate('vehicles', id, data);
    showToast('Kendaraan berhasil diperbarui ✓');
  } else {
    await dbInsert('vehicles', data);
    showToast('Kendaraan berhasil ditambahkan ✓');
  }

  closeModal('modal-vehicle');
  await loadVehicles();
  renderDashboard();
  renderVehicleList();
  populateVehicleSelects();
  checkNotifications();
}

async function editVehicle(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  currentVehicleType = v.type;
  currentWizardStep = 1;
  document.getElementById('vehicle-id').value = id;
  document.getElementById('modal-vehicle-title').textContent = 'Edit Kendaraan';
  resetVehicleForm();

  document.getElementById('v-brand').value   = v.brand  || '';
  document.getElementById('v-model').value   = v.model  || '';
  document.getElementById('v-color').value   = v.color  || '';
  document.getElementById('v-plate').value   = v.plate  || '';
  document.getElementById('v-odometer').value= v.odometer || '';
  document.getElementById('v-owner').value   = v.owner  || 'Imam';
  document.getElementById('v-stnk-tax').value= v.stnk_tax || '';
  document.getElementById('v-stnk-5yr').value= v.stnk_5yr || '';
  document.getElementById('v-pkb').value     = v.pkb || '';
  document.getElementById('v-tire-date').value = v.tire_date || '';
  document.getElementById('v-notes').value   = v.notes  || '';
  document.getElementById('v-year').value    = v.year   || '';

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === v.type);
  });

  updateWizardUI();
  openModal('modal-vehicle');
}

async function deleteVehicle(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  if (!confirm(`Hapus kendaraan ${v.brand} ${v.model}? Semua riwayat servis juga akan terhapus.`)) return;
  await dbDelete('vehicles', id);
  const relatedServices = services.filter(s => s.vehicle_id === id);
  for (const s of relatedServices) await dbDelete('services', s.id);
  showToast('Kendaraan dihapus');
  await loadAll();
}

// ── VEHICLE DETAIL ──
function openVehicleDetail(id) {
  const v = vehicles.find(x => x.id === id);
  if (!v) return;
  const vServices = services.filter(s => s.vehicle_id === id).sort((a,b) => new Date(b.date) - new Date(a.date));
  const schedule  = SERVICE_SCHEDULE[v.type] || SERVICE_SCHEDULE.Motor;

  document.getElementById('detail-title').textContent = `${v.brand} ${v.model} ${v.year}`;

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Informasi Kendaraan</div>
      <div class="detail-grid">
        <div class="detail-field"><label>Merek & Model</label><span>${v.brand} ${v.model}</span></div>
        <div class="detail-field"><label>Tahun</label><span>${v.year}</span></div>
        <div class="detail-field"><label>Nomor Polisi</label><span>${v.plate || '—'}</span></div>
        <div class="detail-field"><label>Warna</label><span>${v.color || '—'}</span></div>
        <div class="detail-field"><label>Odometer</label><span>${Number(v.odometer||0).toLocaleString('id')} km</span></div>
        <div class="detail-field"><label>Pemilik</label><span>${v.owner}</span></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Dokumen & Reminder</div>
      <div class="detail-grid">
        <div class="detail-field"><label>Jatuh Tempo Pajak STNK</label><span>${v.stnk_tax ? formatDate(v.stnk_tax) : '—'}</span></div>
        <div class="detail-field"><label>STNK 5 Tahunan</label><span>${v.stnk_5yr ? formatDate(v.stnk_5yr) : '—'}</span></div>
        <div class="detail-field"><label>PKB Tahun Lalu</label><span>${v.pkb ? 'Rp ' + Number(v.pkb).toLocaleString('id') : '—'}</span></div>
        <div class="detail-field"><label>Ban Dipasang</label><span>${v.tire_date ? formatDate(v.tire_date) : '—'}</span></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Jadwal Servis Standar (${v.type})</div>
      <table class="schedule-table">
        <tr><th>Jenis Servis</th><th>Setiap (km)</th><th>Setiap (bulan)</th></tr>
        ${schedule.map(s => `<tr><td>${s.name}</td><td>${s.km.toLocaleString('id')} km</td><td>${s.months} bln</td></tr>`).join('')}
      </table>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Riwayat Servis (${vServices.length} catatan)</div>
      ${vServices.length === 0
        ? '<p class="text-muted text-sm">Belum ada catatan servis untuk kendaraan ini.</p>'
        : vServices.slice(0, 5).map(s => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:14px;font-weight:600">${s.type_list || 'Servis'}</div>
                <div style="font-size:12px;color:var(--text-3);margin-top:2px">${formatDate(s.date)} · ${Number(s.odometer||0).toLocaleString('id')} km · ${s.workshop || '—'}</div>
              </div>
              <div style="font-size:14px;font-weight:700">Rp ${Number(s.cost||0).toLocaleString('id')}</div>
            </div>
            ${s.notes ? `<div style="font-size:12px;color:var(--text-3);margin-top:4px">${s.notes}</div>` : ''}
          </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-primary btn-sm" onclick="closeModal('modal-vehicle-detail');openAddServiceModalFor('${id}')">+ Catat Servis</button>
      <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-vehicle-detail');editVehicle('${id}')">Edit Kendaraan</button>
    </div>`;

  openModal('modal-vehicle-detail');
}

// ── SERVICES ──
function openAddServiceModal() {
  document.getElementById('service-id').value = '';
  document.getElementById('modal-service-title').textContent = 'Catat Servis';
  resetServiceForm();
  openModal('modal-service');
}

function openAddServiceModalFor(vehicleId) {
  openAddServiceModal();
  document.getElementById('s-vehicle').value = vehicleId;
}

function resetServiceForm() {
  document.getElementById('s-vehicle').value = '';
  document.getElementById('s-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('s-odometer').value = '';
  document.getElementById('s-workshop').value = '';
  document.getElementById('s-cost').value = '';
  document.getElementById('s-notes').value = '';
  document.querySelectorAll('.stype-btn').forEach(b => b.classList.remove('active'));
}

function toggleStype(btn) {
  btn.classList.toggle('active');
}

async function saveService() {
  const vehicleId = document.getElementById('s-vehicle').value;
  if (!vehicleId) { showToast('Pilih kendaraan terlebih dahulu'); return; }

  const types = Array.from(document.querySelectorAll('.stype-btn.active')).map(b => b.textContent);
  if (types.length === 0) { showToast('Pilih minimal satu jenis servis'); return; }

  const date = document.getElementById('s-date').value;
  if (!date) { showToast('Isi tanggal servis'); return; }

  const id = document.getElementById('service-id').value;
  const odometer = parseInt(document.getElementById('s-odometer').value) || 0;

  const data = {
    vehicle_id: vehicleId,
    date,
    odometer,
    type_list:  types.join(', '),
    workshop:   document.getElementById('s-workshop').value.trim(),
    cost:       parseInt(document.getElementById('s-cost').value) || 0,
    notes:      document.getElementById('s-notes').value.trim(),
  };

  if (id) {
    await dbUpdate('services', id, data);
    showToast('Servis diperbarui ✓');
  } else {
    await dbInsert('services', data);
    // Update odometer kendaraan jika lebih besar
    const v = vehicles.find(x => x.id === vehicleId);
    if (v && odometer > (v.odometer || 0)) {
      await dbUpdate('vehicles', vehicleId, { odometer });
    }
    showToast('Servis berhasil dicatat ✓');
  }

  closeModal('modal-service');
  await loadServices();
  await loadVehicles();
  renderDashboard();
  renderServiceList();
  renderReminderList();
  checkNotifications();
}

function renderServiceList() {
  const el = document.getElementById('service-list');
  el.innerHTML = '';

  const filterVehicle = document.getElementById('filter-vehicle').value;
  const filterType    = document.getElementById('filter-type').value;

  let filtered = [...services];
  if (filterVehicle) filtered = filtered.filter(s => s.vehicle_id === filterVehicle);
  if (filterType)    filtered = filtered.filter(s => s.type_list && s.type_list.includes(filterType));
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg><h4>Belum ada catatan servis</h4><p>Mulai catat servis kendaraan keluarga</p><button class="btn btn-primary" onclick="openAddServiceModal()">+ Catat Servis</button></div>`;
    return;
  }

  filtered.forEach((s, i) => {
    const v = vehicles.find(x => x.id === s.vehicle_id);
    const el2 = document.createElement('div');
    el2.className = 'service-item';
    el2.style.animationDelay = (i * 50) + 'ms';
    el2.innerHTML = `
      <div>
        <div class="service-item-head">
          <div class="service-tags">
            ${(s.type_list || 'Servis').split(', ').map(t => `<span class="service-tag">${t}</span>`).join('')}
          </div>
        </div>
        <div class="service-meta">
          ${formatDate(s.date)} · ${Number(s.odometer||0).toLocaleString('id')} km · ${s.workshop || '—'}
        </div>
        ${s.notes ? `<div class="service-meta" style="margin-top:4px;font-style:italic">${s.notes}</div>` : ''}
        <div class="service-item-actions">
          <button class="btn btn-icon" onclick="editService('${s.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon" onclick="deleteService('${s.id}')" title="Hapus" style="color:var(--red)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div>
        <div class="service-cost">Rp ${Number(s.cost||0).toLocaleString('id')}</div>
        <div class="service-vehicle-name">${v ? v.brand + ' ' + v.model : '—'}</div>
      </div>`;
    el.appendChild(el2);
  });
}

async function editService(id) {
  const s = services.find(x => x.id === id);
  if (!s) return;
  document.getElementById('service-id').value = id;
  document.getElementById('modal-service-title').textContent = 'Edit Servis';
  resetServiceForm();
  document.getElementById('s-vehicle').value  = s.vehicle_id || '';
  document.getElementById('s-date').value     = s.date || '';
  document.getElementById('s-odometer').value = s.odometer || '';
  document.getElementById('s-workshop').value = s.workshop || '';
  document.getElementById('s-cost').value     = s.cost || '';
  document.getElementById('s-notes').value    = s.notes || '';
  const types = (s.type_list || '').split(', ');
  document.querySelectorAll('.stype-btn').forEach(b => {
    b.classList.toggle('active', types.includes(b.textContent));
  });
  openModal('modal-service');
}

async function deleteService(id) {
  if (!confirm('Hapus catatan servis ini?')) return;
  await dbDelete('services', id);
  await loadServices();
  renderServiceList();
  renderDashboard();
  renderReminderList();
  showToast('Catatan servis dihapus');
}

// ── REMINDERS ──
function renderReminderList() {
  const el = document.getElementById('reminder-list');
  el.innerHTML = '';
  const items = [];
  const today = new Date();

  vehicles.forEach(v => {
    // STNK Pajak
    if (v.stnk_tax) {
      const diff = daysDiff(today, new Date(v.stnk_tax));
      items.push({ label: `Pajak STNK — ${v.brand} ${v.model}`, sub: `Pemilik: ${v.owner}`, date: v.stnk_tax, diff, type: 'stnk' });
    }
    // STNK 5 Tahunan
    if (v.stnk_5yr) {
      const diff = daysDiff(today, new Date(v.stnk_5yr));
      items.push({ label: `STNK 5 Tahunan — ${v.brand} ${v.model}`, sub: `Perlu ke Samsat`, date: v.stnk_5yr, diff, type: 'stnk5' });
    }
    // Ban
    if (v.tire_date) {
      const tireAge = Math.floor((today - new Date(v.tire_date)) / (86400000 * 30));
      const maxMonths = v.type === 'Motor' ? 36 : 60;
      const remaining = maxMonths - tireAge;
      if (remaining <= 12) {
        items.push({ label: `Ganti Ban — ${v.brand} ${v.model}`, sub: `Ban sudah ${tireAge} bulan (batas ${maxMonths} bulan)`, date: null, diff: remaining * 30, type: 'tire' });
      }
    }
    // Servis berdasarkan km
    const status = getVehicleStatus(v);
    if (status.level !== 'ok') {
      const kmLeft = Math.max(0, (SERVICE_SCHEDULE[v.type]||SERVICE_SCHEDULE.Motor)[0].km - status.kmSince);
      items.push({ label: `Ganti Oli — ${v.brand} ${v.model}`, sub: `Sudah ${status.kmSince.toLocaleString('id')} km sejak oli terakhir`, date: null, diff: kmLeft > 0 ? Math.round(kmLeft / 10) : -1, type: 'service', level: status.level });
    }
  });

  items.sort((a, b) => a.diff - b.diff);

  if (items.length === 0) {
    el.innerHTML = `<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h4>Semua aman!</h4><p>Tidak ada reminder yang mendesak saat ini.</p></div>`;
    return;
  }

  items.forEach((item, i) => {
    const urgency = item.diff < 0 || (item.level === 'urgent') ? 'urgent' : item.diff <= 30 ? 'warn' : 'ok';
    const dotColor = urgency === 'ok' ? 'var(--teal)' : urgency === 'warn' ? 'var(--amber)' : 'var(--red)';
    const dateClass = urgency === 'ok' ? 'rdate-ok' : urgency === 'warn' ? 'rdate-warn' : 'rdate-urgent';
    let dateText = '';
    if (item.date) {
      dateText = item.diff < 0 ? 'Lewat jatuh tempo!' : item.diff === 0 ? 'Hari ini!' : `${item.diff} hari lagi`;
    } else {
      dateText = item.diff <= 0 ? 'Segera ganti!' : `~${Math.round(item.diff)} hari lagi`;
    }

    const d = document.createElement('div');
    d.className = 'reminder-item';
    d.style.animationDelay = (i * 60) + 'ms';
    d.innerHTML = `
      <div class="reminder-dot" style="background:${dotColor}"></div>
      <div class="reminder-info">
        <div class="reminder-title">${item.label}</div>
        <div class="reminder-sub">${item.sub}${item.date ? ' · Jatuh tempo: ' + formatDate(item.date) : ''}</div>
      </div>
      <span class="reminder-date ${dateClass}">${dateText}</span>`;
    el.appendChild(d);
  });
}

// ── WORKSHOPS ──
function openAddWorkshopModal() {
  document.getElementById('workshop-id').value = '';
  document.getElementById('modal-workshop-title').textContent = 'Tambah Bengkel';
  ['w-name','w-phone','w-address','w-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('w-specialty').value = 'Motor & Mobil';
  openModal('modal-workshop');
}

async function saveWorkshop() {
  const name = document.getElementById('w-name').value.trim();
  if (!name) { showToast('Isi nama bengkel'); return; }
  const id = document.getElementById('workshop-id').value;
  const data = {
    name,
    phone:     document.getElementById('w-phone').value.trim(),
    address:   document.getElementById('w-address').value.trim(),
    specialty: document.getElementById('w-specialty').value,
    notes:     document.getElementById('w-notes').value.trim(),
  };
  if (id) { await dbUpdate('workshops', id, data); showToast('Bengkel diperbarui ✓'); }
  else    { await dbInsert('workshops', data);      showToast('Bengkel ditambahkan ✓'); }
  closeModal('modal-workshop');
  await loadWorkshops();
  renderWorkshopList();
}

function renderWorkshopList() {
  const el = document.getElementById('workshop-list');
  el.innerHTML = '';
  if (workshops.length === 0) {
    el.innerHTML = `<div class="empty-state"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><h4>Belum ada bengkel tersimpan</h4><p>Tambahkan bengkel favorit keluarga</p><button class="btn btn-primary" onclick="openAddWorkshopModal()">+ Tambah Bengkel</button></div>`;
    return;
  }
  workshops.forEach((w, i) => {
    const d = document.createElement('div');
    d.className = 'workshop-item';
    d.style.animationDelay = (i * 60) + 'ms';
    d.innerHTML = `
      <div class="workshop-avatar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div class="workshop-info">
        <div class="workshop-name">${w.name}</div>
        <div class="workshop-sub">${w.specialty} · ${w.phone || '—'} · ${w.address || '—'}</div>
        ${w.notes ? `<div style="font-size:12px;color:var(--text-3);margin-top:3px">${w.notes}</div>` : ''}
      </div>
      <div class="workshop-actions">
        ${w.phone ? `<a class="btn btn-icon" href="tel:${w.phone}" title="Telepon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.46 2.68h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/></svg></a>` : ''}
        <button class="btn btn-icon" onclick="editWorkshop('${w.id}')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-icon" onclick="deleteWorkshop('${w.id}')" title="Hapus" style="color:var(--red)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </div>`;
    el.appendChild(d);
  });
}

async function editWorkshop(id) {
  const w = workshops.find(x => x.id === id);
  if (!w) return;
  document.getElementById('workshop-id').value  = id;
  document.getElementById('modal-workshop-title').textContent = 'Edit Bengkel';
  document.getElementById('w-name').value      = w.name || '';
  document.getElementById('w-phone').value     = w.phone || '';
  document.getElementById('w-address').value   = w.address || '';
  document.getElementById('w-specialty').value = w.specialty || 'Motor & Mobil';
  document.getElementById('w-notes').value     = w.notes || '';
  openModal('modal-workshop');
}

async function deleteWorkshop(id) {
  if (!confirm('Hapus bengkel ini?')) return;
  await dbDelete('workshops', id);
  await loadWorkshops();
  renderWorkshopList();
  showToast('Bengkel dihapus');
}

// ── POPULATE SELECTS ──
function populateVehicleSelects() {
  ['s-vehicle', 'filter-vehicle'].forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = id === 'filter-vehicle'
      ? '<option value="">Semua Kendaraan</option>'
      : '<option value="">-- Pilih Kendaraan --</option>';
    vehicles.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.brand} ${v.model} (${v.owner})`;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  });
}

// ── NOTIFICATIONS ──
function checkNotifications() {
  const dot = document.getElementById('notif-dot');
  const today = new Date();
  let hasAlert = false;

  vehicles.forEach(v => {
    if (v.stnk_tax && daysDiff(today, new Date(v.stnk_tax)) <= 30) hasAlert = true;
    const status = getVehicleStatus(v);
    if (status.level !== 'ok') hasAlert = true;
  });

  dot.classList.toggle('hidden', !hasAlert);
}

function showNotifications() {
  const today = new Date();
  const items = [];

  vehicles.forEach(v => {
    const status = getVehicleStatus(v);
    if (status.level !== 'ok') {
      items.push({ icon: '🔧', text: `${v.brand} ${v.model} perlu servis oli`, sub: `${status.kmSince.toLocaleString('id')} km sejak servis terakhir` });
    }
    if (v.stnk_tax) {
      const diff = daysDiff(today, new Date(v.stnk_tax));
      if (diff <= 30) {
        items.push({ icon: '📋', text: `Pajak STNK ${v.brand} ${v.model}`, sub: diff < 0 ? 'Sudah lewat jatuh tempo!' : `${diff} hari lagi jatuh tempo` });
      }
    }
  });

  const el = document.getElementById('notif-list');
  el.innerHTML = items.length === 0
    ? '<p style="text-align:center;color:var(--text-3);padding:20px">Tidak ada notifikasi saat ini</p>'
    : items.map(n => `
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:22px">${n.icon}</span>
          <div><div style="font-size:14px;font-weight:500">${n.text}</div><div style="font-size:12px;color:var(--text-3);margin-top:2px">${n.sub}</div></div>
        </div>`).join('');

  openModal('modal-notif');
}

// ── TUTORIAL ──
const TUTORIAL_STEPS = [
  { title: 'Selamat datang!', desc: 'Ini adalah aplikasi servis kendaraan Keluarga Imam. Mari saya tunjukkan cara pakainya.' },
  { title: 'Dashboard', desc: 'Di halaman utama ini, kamu bisa lihat ringkasan semua kendaraan keluarga dan kondisi masing-masing.' },
  { title: 'Tambah Kendaraan', desc: 'Klik tombol "+ Tambah Kendaraan" di pojok kanan atas untuk mendaftarkan motor atau mobil keluarga.' },
  { title: 'Catat Servis', desc: 'Setiap selesai servis, masuk ke menu "Servis" lalu klik "+ Catat Servis". Isi tanggal, km, dan biaya.' },
  { title: 'Reminder', desc: 'Menu "Reminder" menampilkan semua pengingat: pajak STNK, ganti ban, dan servis yang sudah waktunya.' },
  { title: 'Bengkel Favorit', desc: 'Simpan nomor dan alamat bengkel favorit di menu "Bengkel" agar mudah dihubungi kapan saja.' },
];
let tutorialStep = 0;

function startTutorial() {
  tutorialStep = 0;
  updateTutorial();
  document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function nextTutorial() {
  tutorialStep++;
  if (tutorialStep >= TUTORIAL_STEPS.length) { endTutorial(); return; }
  updateTutorial();
}

function updateTutorial() {
  const step = TUTORIAL_STEPS[tutorialStep];
  document.getElementById('tutorial-step-badge').textContent = `${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-desc').textContent  = step.desc;
  const nextBtn = document.querySelector('#tutorial-box .btn-primary');
  if (nextBtn) nextBtn.textContent = tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Selesai ✓' : 'Lanjut →';
}

function endTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
}

// ── MODAL HELPERS ──
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

function closeModalBackdrop(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, 2500);
}

// ── UTILS ──
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysDiff(a, b) {
  return Math.round((b - a) / 86400000);
}

function checkAutoRedirect() {
  if (sessionStorage.getItem('ki_auth') === '1') return;
}

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['modal-vehicle','modal-service','modal-workshop','modal-vehicle-detail','modal-notif','modal-notif'].forEach(closeModal);
    endTutorial();
  }
});

// ── AUTO LOGIN CHECK ──
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('ki_auth') === '1') {
    showApp();
  }
  // Year select fill for initial load
  const ySel = document.getElementById('v-year');
  if (ySel && ySel.options.length === 0) {
    const now = new Date().getFullYear();
    for (let y = now; y >= 1990; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      ySel.appendChild(opt);
    }
  }
});