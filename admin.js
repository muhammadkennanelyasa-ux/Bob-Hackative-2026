/**
 * admin.js — MCU+ Admin Dashboard Logic
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Read & manage bookings in localStorage (key: 'mricare_bookings')
 *  2. Real-time Search and Status Filtering
 *  3. Demo Data Seeder (Mock data for hackathon presentation)
 *  4. CSV Export for HR & Medical Operations
 *  5. Direct WhatsApp communication with PIC
 *  6. Real-time status updater with modal and timestamp logs
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const LS_KEY = 'mricare_bookings';

const ALL_STATUSES = [
  'Menunggu Konfirmasi',
  'Dikonfirmasi',
  'Jadwal Diproses',
  'Selesai',
];

const STATUS_STYLE = {
  'Menunggu Konfirmasi': { badge: 'badge-pending',   dot: 'bg-amber-500 animate-pulse', label: 'Menunggu Konfirmasi' },
  'Dikonfirmasi':        { badge: 'badge-confirmed', dot: 'bg-slate-700',               label: 'Dikonfirmasi' },
  'Jadwal Diproses':     { badge: 'badge-scheduled', dot: 'bg-sky-500',                label: 'Jadwal Diproses' },
  'Selesai':             { badge: 'badge-done',      dot: 'bg-emerald-500',            label: 'Selesai' },
};

/* ── State ──────────────────────────────────────────────────── */
let currentFilter       = '';
let searchQuery         = '';
let modalBookingId      = null;
let modalSelectedStatus = null;
let toastTimer          = null;

/* ── DOM refs ───────────────────────────────────────────────── */
const statTotal       = document.getElementById('stat-total');
const statPending     = document.getElementById('stat-pending');
const statConfirmed   = document.getElementById('stat-confirmed');
const statDone        = document.getElementById('stat-done');

const tableContainer  = document.getElementById('table-container');
const tableBody       = document.getElementById('bookings-table-body');
const cardList        = document.getElementById('bookings-card-list');
const emptyState      = document.getElementById('empty-state');
const filterSelect    = document.getElementById('filter-status');
const inputSearch     = document.getElementById('input-search');
const btnRefresh      = document.getElementById('btn-refresh');
const btnClearAll     = document.getElementById('btn-clear-all');
const btnSeedData     = document.getElementById('btn-seed-data');
const btnSeedEmpty    = document.getElementById('btn-seed-data-empty');
const btnExportCsv    = document.getElementById('btn-export-csv');

const modalOverlay    = document.getElementById('modal-overlay');
const modalCompany    = document.getElementById('modal-company');
const modalDetail     = document.getElementById('modal-detail');
const modalOptions    = document.getElementById('modal-status-options');
const modalSave       = document.getElementById('modal-save');
const modalCancel     = document.getElementById('modal-cancel');
const modalClose      = document.getElementById('modal-close');
const toastEl         = document.getElementById('admin-toast');

/* ── localStorage Helpers ───────────────────────────────────── */
function getAllBookings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function setAllBookings(bookings) {
  localStorage.setItem(LS_KEY, JSON.stringify(bookings));
}

function updateBookingStatus(id, newStatus) {
  const bookings = getAllBookings();
  const rec = bookings.find(b => b.id === id);
  if (!rec) return false;
  rec.status    = newStatus;
  rec.updatedAt = new Date().toISOString();
  setAllBookings(bookings);
  localStorage.setItem('mricare_latest_update', Date.now().toString());
  window.dispatchEvent(new Event('storage'));

  // Sync to Firebase Cloud Firestore
  if (window.FirebaseService && typeof window.FirebaseService.updateBookingStatus === 'function') {
    window.FirebaseService.updateBookingStatus(id, newStatus).catch(err => {
      console.warn('Firebase status update background warning:', err);
    });
  }

  return true;
}

/* ── Formatting Helpers ─────────────────────────────────────── */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function statusBadgeHTML(status) {
  const s = STATUS_STYLE[status] || { badge: 'badge-pending', dot: 'bg-amber-500', label: status };
  return `<span class="status-badge ${s.badge}"><span class="w-1.5 h-1.5 rounded-full ${s.dot} shrink-0"></span><span>${s.label}</span></span>`;
}

function escHtml(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Stats ──────────────────────────────────────────────────── */
function updateStats(bookings) {
  statTotal.textContent     = bookings.length;
  statPending.textContent   = bookings.filter(b => b.status === 'Menunggu Konfirmasi').length;
  statConfirmed.textContent = bookings.filter(b => b.status === 'Dikonfirmasi' || b.status === 'Jadwal Diproses').length;
  statDone.textContent      = bookings.filter(b => b.status === 'Selesai').length;
}

/* ── Render Row (Desktop) ───────────────────────────────────── */
function renderTableRow(b) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-100 hover:bg-slate-50/70 transition-colors booking-row';
  tr.dataset.id = b.id;

  const waNumber = (b.phone || '').replace(/\D/g, '');
  const waClean = waNumber.startsWith('0') ? '62' + waNumber.slice(1) : waNumber;

  tr.innerHTML = `
    <td class="px-5 py-3.5">
      <p class="font-bold text-slate-900 text-xs sm:text-sm leading-snug">${escHtml(b.companyName)}</p>
      <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
        <span class="font-medium text-slate-700">${escHtml(b.contactName)}</span>
        <span class="text-slate-300">•</span>
        <span class="font-mono text-slate-500">${escHtml(b.phone)}</span>
      </div>
    </td>
    <td class="px-4 py-3.5">
      <span class="inline-block px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs">
        ${escHtml(b.package)}
      </span>
    </td>
    <td class="px-4 py-3.5 text-center whitespace-nowrap">
      <span class="font-mono font-bold text-slate-800 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
        ${escHtml(b.participants)}
      </span>
    </td>
    <td class="px-4 py-3.5 whitespace-nowrap">
      <span class="font-mono font-bold text-slate-950 text-xs">${escHtml(b.estimatedCost)}</span>
    </td>
    <td class="px-4 py-3.5">
      <p class="font-mono font-semibold text-slate-800 text-xs">${escHtml(b.date)}</p>
      <p class="text-[11px] text-slate-400 truncate max-w-[170px] mt-0.5" title="${escHtml(b.location)}">${escHtml(b.location)}</p>
    </td>
    <td class="px-4 py-3.5 whitespace-nowrap">${statusBadgeHTML(b.status)}</td>
    <td class="px-5 py-3.5 text-right whitespace-nowrap">
      <div class="inline-flex items-center justify-end gap-2">
        ${waClean ? `
          <a href="https://wa.me/${waClean}?text=Halo%20${encodeURIComponent(b.contactName || '')},%20kami%20dari%20tim%20admin%20MRI%20Care%20terkait%20pengajuan%20kunjungan%20Bus%20MCU%20${encodeURIComponent(b.companyName || '')}" 
             target="_blank" 
             class="inline-flex items-center gap-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold h-8 px-2.5 rounded-lg transition border border-emerald-200/80 shadow-2xs" 
             title="Hubungi PIC via WhatsApp">
            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
            </svg>
            <span>WA PIC</span>
          </a>
        ` : ''}
        <button class="btn-change-status inline-flex items-center gap-1.5 text-xs bg-[#0B3D3A] hover:bg-[#072B29] text-white font-semibold h-8 px-3 rounded-lg transition shadow-2xs"
                data-id="${escHtml(b.id)}">
          <svg class="w-3.5 h-3.5 text-emerald-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Ubah Status</span>
        </button>
      </div>
    </td>
  `;
  return tr;
}

/* ── Render Card (Mobile & Tablet) ──────────────────────────── */
function renderCard(b) {
  const div = document.createElement('div');
  div.className = 'booking-card bg-white rounded-xl shadow-2xs border border-slate-200 p-4';
  div.dataset.id = b.id;

  const waNumber = (b.phone || '').replace(/\D/g, '');
  const waClean = waNumber.startsWith('0') ? '62' + waNumber.slice(1) : waNumber;

  div.innerHTML = `
    <div class="flex items-start justify-between mb-3 pb-2.5 border-b border-slate-100">
      <div>
        <p class="font-bold text-slate-900 text-sm">${escHtml(b.companyName)}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">PIC: <span class="font-medium text-slate-700">${escHtml(b.contactName)}</span> · <span class="font-mono text-slate-500">${escHtml(b.phone)}</span></p>
      </div>
      <div>${statusBadgeHTML(b.status)}</div>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs text-slate-700 mb-3 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
      <div><span class="text-slate-400 text-[10px] uppercase font-mono">Paket:</span><br/><strong class="text-slate-900 font-semibold">${escHtml(b.package)}</strong></div>
      <div><span class="text-slate-400 text-[10px] uppercase font-mono">Peserta:</span><br/><strong class="text-slate-900 font-mono">${escHtml(b.participants)}</strong></div>
      <div><span class="text-slate-400 text-[10px] uppercase font-mono">Estimasi:</span><br/><strong class="text-slate-950 font-mono font-bold">${escHtml(b.estimatedCost)}</strong></div>
      <div><span class="text-slate-400 text-[10px] uppercase font-mono">Tanggal:</span><br/><strong class="text-slate-900 font-mono">${escHtml(b.date)}</strong></div>
      <div class="col-span-2"><span class="text-slate-400 text-[10px] uppercase font-mono">Lokasi:</span><br/><strong class="text-slate-900 font-medium">${escHtml(b.location)}</strong></div>
    </div>
    <div class="flex items-center gap-2">
      ${waClean ? `
        <a href="https://wa.me/${waClean}" target="_blank" class="flex-1 inline-flex items-center justify-center gap-1.5 h-9 text-xs bg-emerald-50 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-100 transition border border-emerald-200/80 shadow-2xs">
          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
          </svg>
          <span>WA PIC</span>
        </a>
      ` : ''}
      <button class="btn-change-status flex-1 inline-flex items-center justify-center gap-1.5 h-9 text-xs bg-[#0B3D3A] text-white font-semibold rounded-lg hover:bg-[#072B29] transition shadow-2xs"
              data-id="${escHtml(b.id)}">
        <svg class="w-3.5 h-3.5 text-emerald-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Ubah Status</span>
      </button>
    </div>
  `;
  return div;
}

/* ── Main Render ────────────────────────────────────────────── */
function render() {
  const allBookings = getAllBookings()
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  updateStats(allBookings);

  let filtered = allBookings;

  if (currentFilter) {
    if (currentFilter === 'Dikonfirmasi') {
      filtered = filtered.filter(b => b.status === 'Dikonfirmasi' || b.status === 'Jadwal Diproses');
    } else {
      filtered = filtered.filter(b => b.status === currentFilter);
    }
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(b => 
      (b.companyName || '').toLowerCase().includes(q) ||
      (b.contactName || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.package || '').toLowerCase().includes(q) ||
      (b.location || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q)
    );
  }

  tableBody.innerHTML = '';
  cardList.innerHTML  = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    cardList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tableContainer.classList.remove('hidden');
  cardList.classList.remove('hidden');

  filtered.forEach(b => {
    tableBody.appendChild(renderTableRow(b));
    cardList.appendChild(renderCard(b));
  });

  // Attach button handlers
  document.querySelectorAll('.btn-change-status').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
}

/* ── Modal Status Changer ───────────────────────────────────── */
function openModal(bookingId) {
  const bookings = getAllBookings();
  const b = bookings.find(rec => rec.id === bookingId);
  if (!b) return;

  modalBookingId      = bookingId;
  modalSelectedStatus = b.status;

  modalCompany.textContent = `ID: ${bookingId.slice(0, 8)}… • TANGGAL: ${formatDate(b.createdAt)}`;

  modalDetail.innerHTML = `
    <div class="grid grid-cols-2 gap-x-4 gap-y-2">
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Perusahaan:</span><br/><strong class="text-slate-900">${escHtml(b.companyName)}</strong></div>
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Paket:</span><br/><strong class="text-slate-900">${escHtml(b.package)}</strong></div>
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Peserta:</span><br/><strong class="text-slate-900 font-mono">${escHtml(b.participants)}</strong></div>
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Estimasi:</span><br/><strong class="text-slate-950 font-mono font-bold">${escHtml(b.estimatedCost)}</strong></div>
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Tanggal:</span><br/><strong class="text-slate-900 font-mono">${escHtml(b.date)}</strong></div>
      <div><span class="text-slate-400 text-[10px] font-mono uppercase">Lokasi:</span><br/><strong class="text-slate-900">${escHtml(b.location)}</strong></div>
    </div>
    <div class="pt-2 border-t border-slate-200 mt-2 text-slate-600 text-xs">
      PIC: <strong class="text-slate-900">${escHtml(b.contactName)}</strong> (<span class="font-mono">${escHtml(b.phone)}</span>)
    </div>
  `;

  modalOptions.innerHTML = ALL_STATUSES.map(s => {
    const isSelected = s === b.status;
    return `
      <button class="modal-status-btn flex items-center justify-between text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-all ${isSelected ? 'border-[#0B3D3A] bg-[#0B3D3A] text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}"
              data-status="${escHtml(s)}">
        <span>${s}</span>
        <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-slate-300'}"></span>
      </button>
    `;
  }).join('');

  modalOptions.querySelectorAll('.modal-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalSelectedStatus = btn.dataset.status;
      modalOptions.querySelectorAll('.modal-status-btn').forEach(b2 => {
        const active = b2.dataset.status === modalSelectedStatus;
        b2.className = `modal-status-btn flex items-center justify-between text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-all ${active ? 'border-[#0B3D3A] bg-[#0B3D3A] text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`;
        const dot = b2.querySelector('.rounded-full');
        if (dot) dot.className = `w-2 h-2 rounded-full ${active ? 'bg-emerald-300' : 'bg-slate-300'}`;
      });
    });
  });

  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalBookingId      = null;
  modalSelectedStatus = null;
}

function saveModalStatus() {
  if (!modalBookingId || !modalSelectedStatus) return;
  const ok = updateBookingStatus(modalBookingId, modalSelectedStatus);
  if (ok) {
    showToast(`✅ Status diperbarui: ${modalSelectedStatus}`);
    render();
  } else {
    showToast('⚠️ Gagal memperbarui status.');
  }
  closeModal();
}

/* ── CSV Export Helper ──────────────────────────────────────── */
function exportToCSV() {
  const bookings = getAllBookings();
  if (!bookings.length) {
    showToast('⚠️ Tidak ada data untuk diekspor!');
    return;
  }

  const headers = ['ID', 'Perusahaan', 'PIC', 'Telepon', 'Paket', 'Peserta', 'Estimasi Biaya', 'Tanggal Kunjungan', 'Lokasi', 'Status', 'Dibuat Pada'];
  const rows = bookings.map(b => [
    `"${b.id}"`,
    `"${(b.companyName || '').replace(/"/g, '""')}"`,
    `"${(b.contactName || '').replace(/"/g, '""')}"`,
    `"${(b.phone || '').replace(/"/g, '""')}"`,
    `"${(b.package || '').replace(/"/g, '""')}"`,
    `"${(b.participants || '').replace(/"/g, '""')}"`,
    `"${(b.estimatedCost || '').replace(/"/g, '""')}"`,
    `"${(b.date || '').replace(/"/g, '""')}"`,
    `"${(b.location || '').replace(/"/g, '""')}"`,
    `"${(b.status || '').replace(/"/g, '""')}"`,
    `"${(b.createdAt || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `mricare_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('📥 File CSV berhasil diunduh!');
}

/* ── Demo Data Seeder (For Hackathon Showcase) ──────────────── */
function seedDemoData() {
  const mockBookings = [
    {
      id: crypto.randomUUID(),
      companyName: 'PT Astra Auto Parts Tbk',
      contactName: 'Ibu Sarah Pratiwi',
      phone: '081288991234',
      package: 'Paket Komprehensif',
      packageId: 'comprehensive',
      participants: '120 orang',
      estimatedCost: 'Rp 42.000.000',
      date: '15/10/2026',
      location: 'Kawasan Industri KIIC Lot C-4, Karawang Barat',
      status: 'Menunggu Konfirmasi',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      companyName: 'PT Indofood CBP Sukses Makmur',
      contactName: 'Bapak Hendra Wijaya',
      phone: '081399887766',
      package: 'Paket Executive',
      packageId: 'executive',
      participants: '45 orang',
      estimatedCost: 'Rp 33.750.000',
      date: '20/10/2026',
      location: 'Gedung Indofood Tower Lt. 18, Jl. Jend. Sudirman Kav. 76, Jakarta',
      status: 'Dikonfirmasi',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      companyName: 'PT Unilever Oleochemical Indonesia',
      contactName: 'Ibu Rina Anggraini',
      phone: '085712345678',
      package: 'Paket Komprehensif',
      packageId: 'comprehensive',
      participants: '200 orang',
      estimatedCost: 'Rp 70.000.000',
      date: '25/10/2026',
      location: 'Kawasan Ekonomi Khusus Sei Mangkei, Simalungun',
      status: 'Jadwal Diproses',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      companyName: 'CV Digital Solusi Kreatif',
      contactName: 'Bapak Dimas Aditya',
      phone: '081912344321',
      package: 'Paket Dasar',
      packageId: 'basic',
      participants: '35 orang',
      estimatedCost: 'Rp 5.250.000',
      date: '05/10/2026',
      location: 'Green Lake City Boulevard No. 12, Tangerang',
      status: 'Selesai',
      createdAt: new Date(Date.now() - 3600000 * 120).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
  ];

  setAllBookings(mockBookings);
  localStorage.setItem('mricare_latest_update', Date.now().toString());
  window.dispatchEvent(new Event('storage'));
  
  // Sync seed data to Firebase Cloud Firestore
  if (window.FirebaseService && typeof window.FirebaseService.seedBookings === 'function') {
    window.FirebaseService.seedBookings(mockBookings).catch(err => {
      console.warn('Firebase seed background warning:', err);
    });
  }

  render();
  showToast('⚡ 4 Data demo B2B berhasil dimuat!');
}

/* ── Route Guard & Access Control ───────────────────────────── */
function checkAdminAccess() {
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  if (!user || user.role !== 'admin') {
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `
        <div class="max-w-md mx-auto my-16 bg-white border border-stone-200 rounded-3xl p-8 shadow-xl text-center">
          <div class="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl">
            🔒
          </div>
          <h2 class="text-xl font-display font-extrabold text-stone-950 mb-2">Akses Terbatas: Tim Operasional</h2>
          <p class="text-xs text-stone-500 leading-relaxed mb-6">
            Halaman Admin Portal hanya dapat diakses oleh akun tim medis dan operasional MCU+. Silakan masuk menggunakan akun admin yang telah disediakan.
          </p>
          <div class="space-y-2.5">
            <a href="login.html" class="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0B3D3A] text-white text-xs font-semibold hover:bg-[#072B29] transition shadow-xs">
              <span>Masuk sebagai Admin Operasional</span>
              <span>→</span>
            </a>
            <a href="index.html" class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200 transition">
              Kembali ke Beranda Website
            </a>
          </div>
        </div>
      `;
    }
    return false;
  }
  return true;
}

/* ── Toast Helper ───────────────────────────────────────────── */
function showToast(msg) {
  toastEl.textContent  = msg;
  toastEl.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 3200);
}

/* ── Event Wiring ───────────────────────────────────────────── */
filterSelect.addEventListener('change', () => {
  currentFilter = filterSelect.value;
  render();
});

inputSearch.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  render();
});

btnRefresh.addEventListener('click', () => {
  render();
  showToast('🔄 Data diperbarui.');
});

btnClearAll.addEventListener('click', () => {
  if (!confirm('Hapus SELURUH riwayat booking dari localStorage & cloud? Tindakan ini tidak dapat dibatalkan.')) return;
  localStorage.removeItem(LS_KEY);
  localStorage.setItem('mricare_latest_update', Date.now().toString());
  window.dispatchEvent(new Event('storage'));
  
  if (window.FirebaseService && typeof window.FirebaseService.clearAllBookings === 'function') {
    window.FirebaseService.clearAllBookings().catch(err => {
      console.warn('Firebase clearAllBookings background warning:', err);
    });
  }

  render();
  showToast('🗑️ Semua data booking telah dihapus.');
});

btnSeedData.addEventListener('click', seedDemoData);
if (btnSeedEmpty) btnSeedEmpty.addEventListener('click', seedDemoData);
btnExportCsv.addEventListener('click', exportToCSV);

modalSave.addEventListener('click', saveModalStatus);
modalCancel.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

const btnAdminLogout = document.getElementById('admin-topbar-logout');
if (btnAdminLogout) {
  btnAdminLogout.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof logoutUser === 'function') {
      logoutUser();
    } else {
      localStorage.removeItem('mricare_current_user');
      window.location.href = 'login.html';
    }
  });
}

// Quick filter via Stat Cards
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    const f = card.dataset.filter;
    currentFilter = f;
    filterSelect.value = f;

    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-filter'));
    card.classList.add('active-filter');
    render();
  });
});

// Init & Guard with Firebase real-time listener
if (checkAdminAccess()) {
  render();

  // Attach Real-time Firestore sync
  const tryAttachFirebaseAdmin = () => {
    if (window.FirebaseService && typeof window.FirebaseService.onBookingsChange === 'function') {
      window.FirebaseService.onBookingsChange((firestoreBookings) => {
        if (firestoreBookings && Array.isArray(firestoreBookings)) {
          setAllBookings(firestoreBookings);
          render();
        }
      });
    } else {
      setTimeout(tryAttachFirebaseAdmin, 500);
    }
  };
  tryAttachFirebaseAdmin();

  setInterval(render, 4000);
}
