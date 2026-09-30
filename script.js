/**
 * script.js — MCU+ B2B Mobile Medical Check-Up
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Render package catalog cards with interactive selection
 *  2. Robust Indonesian NLP Entity Extractor for Chat & Forms
 *  3. Hybrid Langflow AI Assistant + Intelligent Clinical Fallback
 *  4. Booking Summary with real-time price & Pax calculations
 *  5. Manual Form Editing & Modal Synchronizations
 *  6. Printable Quotation & B2B WhatsApp Sender
 *  7. Order Status Tracker synced with localStorage and admin updates
 *  8. Responsive Mobile Navigation & Micro-Interactions
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ============================================================
   0. CONFIGURATION & STATE
============================================================ */

const LANGFLOW_CONFIG = {
  endpoint: 'http://127.0.0.1:7860/api/v1/run/7b3f4b3f-6012-41f8-9fd9-06b0735db128',
  get apiKey() {
    return window.LANGFLOW_API_KEY || '';
  },
  timeoutMs: 4000, // 4-second timeout before graceful fallback
};

const LANGFLOW_SESSION_ID = crypto.randomUUID();
const LS_KEY = 'mricare_bookings';

/** @type {Array<{id:string, name:string, price:string, priceNum:number, tag:string, tagColor:string, minPax:number, features:string[]}>} */
const PACKAGES = [
  {
    id: 'basic',
    name: 'Paket Dasar',
    price: 'Rp 150.000 / pax',
    priceNum: 150000,
    tag: 'Regulasi Standar K3',
    tagColor: 'bg-med-blue/15 text-med-blue border border-med-blue/30',
    minPax: 30,
    features: [
      'Pemeriksaan Fisik & Tensi oleh Dokter Umum',
      'Pemeriksaan Indeks Massa Tubuh (BMI) & Visus Mata',
      'Tes Gula Darah Puasa (Glukosa Lab)',
      'Konsultasi Kesehatan Preventif Singkat',
      'Buku Rekapitulasi Fisik & Surat Keterangan Sehat',
    ],
  },
  {
    id: 'comprehensive',
    name: 'Paket Komprehensif',
    price: 'Rp 350.000 / pax',
    priceNum: 350000,
    tag: 'Paling Diminati Perusahaan',
    tagColor: 'bg-med-green/15 text-med-green-dark border border-med-green/30 font-bold',
    minPax: 30,
    features: [
      'Semua Item Pemeriksaan Paket Dasar',
      'Darah Lengkap & Urine Rutin (Lab Komplit)',
      'Fungsi Hati (SGOT/SGPT) & Fungsi Ginjal (Ureum/Kreatinin)',
      'Profil Lipid Lengkap (Kolesterol Total, HDL, LDL, Trigliserida)',
      'EKG 12-Lead (Rekam Jantung Elektrokardiografi)',
      'Portal Digital Hasil MCU H+1 untuk HR & Karyawan',
    ],
  },
  {
    id: 'executive',
    name: 'Paket Executive',
    price: 'Rp 750.000 / pax',
    priceNum: 750000,
    tag: 'Executive & Manajerial',
    tagColor: 'bg-purple-100 text-purple-700 border border-purple-300 font-bold',
    minPax: 15,
    features: [
      'Semua Item Pemeriksaan Paket Komprehensif',
      'Rontgen Dada (Digital Thorax X-Ray On-Bus)',
      'USG Abdomen Komplit oleh Tim Radiologi',
      'Pemeriksaan Spesifik Gigi & THT oleh Dokter Spesialis',
      'Konsultasi Mendalam Dokter Spesialis Okupasi (Sp.Ok)',
      'Executive Health Summary & Rekomendasi Ergonomi Perusahaan',
    ],
  },
];

/** Current session booking state */
const bookingState = {
  bookingId:       null,
  selectedPackage: PACKAGES[1], // Default: Paket Komprehensif
  company:         '',
  contactName:     '',
  phone:           '',
  date:            '',
  participants:    '100 orang',
  location:        '',
  notes:           '',
  estimasiHarga:   'Rp 35.000.000',
  sent:            false,
};

/* ============================================================
   1. DOM REFERENCES
============================================================ */

// Catalog & Interactive Booking Form
const packageGrid         = document.getElementById('package-grid');
const mainBookingForm     = document.getElementById('main-booking-form');
const bookingFormPackage  = document.getElementById('booking-form-package');
const bookingFormCompany  = document.getElementById('booking-form-company');
const bookingFormPicName  = document.getElementById('booking-form-pic-name');
const bookingFormPicPhone = document.getElementById('booking-form-pic-phone');
const bookingFormPax      = document.getElementById('booking-form-participants');
const bookingFormDate     = document.getElementById('booking-form-date');
const bookingFormLocation = document.getElementById('booking-form-location');
const bookingFormNotes    = document.getElementById('booking-form-notes');
const formPaxHint         = document.getElementById('form-pax-hint');

// Live Summary Sheet
const summaryPkgName    = document.getElementById('summary-package-name');
const summaryPkgPrice   = document.getElementById('summary-package-price');
const summaryPaxCount   = document.getElementById('summary-pax-count');
const summaryTotalPrice = document.getElementById('summary-total-price');
const summaryStatus     = document.getElementById('summary-status');
const summaryDetails    = document.getElementById('summary-details');
const btnConfirm        = document.getElementById('btn-confirm-booking');
const btnReset          = document.getElementById('btn-reset-booking');
const btnPrintSummary   = document.getElementById('btn-print-summary');
const btnManualEdit     = document.getElementById('btn-manual-edit');
const btnManualEditMob  = document.getElementById('btn-manual-edit-mobile');

// Chat UI
const chatToggle        = document.getElementById('chat-toggle');
const chatWindow        = document.getElementById('chat-window');
const chatCloseBtn      = document.getElementById('chat-close-btn');
const iconOpen          = document.getElementById('icon-open');
const iconClose         = document.getElementById('icon-close');
const chatDot           = document.getElementById('chat-dot');
const chatMessages      = document.getElementById('chat-messages');
const chatInput         = document.getElementById('chat-input');
const chatSendBtn       = document.getElementById('chat-send');
const typingIndicator   = document.getElementById('typing-indicator');
const toast             = document.getElementById('toast');
const heroAiBtn         = document.getElementById('hero-ai-btn');

// Modals
const modalEditBooking    = document.getElementById('modal-edit-booking');
const modalEditClose      = document.getElementById('modal-edit-close');
const modalEditCancel     = document.getElementById('modal-edit-cancel');
const formEditBooking     = document.getElementById('form-edit-booking');
const inputEditPackage    = document.getElementById('input-edit-package');
const inputEditCompany    = document.getElementById('input-edit-company');
const inputEditContact    = document.getElementById('input-edit-contact');
const inputEditPhone      = document.getElementById('input-edit-phone');
const inputEditDate       = document.getElementById('input-edit-date');
const inputEditPax        = document.getElementById('input-edit-participants');
const inputEditLocation   = document.getElementById('input-edit-location');

const modalComparison       = document.getElementById('modal-comparison');
const btnOpenComparison     = document.getElementById('btn-open-comparison');
const modalComparisonClose  = document.getElementById('modal-comparison-close');
const modalComparisonSelect = document.getElementById('modal-comparison-select');

// Mobile Nav
const mobileMenuToggle    = document.getElementById('mobile-menu-toggle');
const mobileMenu          = document.getElementById('mobile-menu');
const hamburgerIcon       = document.getElementById('hamburger-icon');
const hamburgerCloseIcon  = document.getElementById('hamburger-close-icon');

/* ============================================================
   2. LOCALSTORAGE PERSISTENCE (Shared with admin.html)
============================================================ */

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

function saveBooking() {
  const bookings = getAllBookings();
  const now = new Date().toISOString();

  let record = bookings.find(b => b.id === bookingState.bookingId);

  if (record) {
    Object.assign(record, {
      companyName:   bookingState.company       || record.companyName,
      participants:  bookingState.participants  || record.participants,
      package:       bookingState.selectedPackage ? bookingState.selectedPackage.name : record.package,
      packageId:     bookingState.selectedPackage ? bookingState.selectedPackage.id   : record.packageId,
      estimatedCost: bookingState.estimasiHarga || record.estimatedCost,
      location:      bookingState.location      || record.location,
      date:          bookingState.date          || record.date,
      contactName:   bookingState.contactName   || record.contactName,
      phone:         bookingState.phone         || record.phone,
      updatedAt:     now,
    });
  } else {
    record = {
      id:            crypto.randomUUID(),
      companyName:   bookingState.company       || 'PT Belum Ditentukan',
      participants:  bookingState.participants  || '—',
      package:       bookingState.selectedPackage ? bookingState.selectedPackage.name : '—',
      packageId:     bookingState.selectedPackage ? bookingState.selectedPackage.id   : '',
      estimatedCost: bookingState.estimasiHarga || '—',
      location:      bookingState.location      || '—',
      date:          bookingState.date          || '—',
      contactName:   bookingState.contactName   || '—',
      phone:         bookingState.phone         || '—',
      status:        'Menunggu Konfirmasi',
      createdAt:     now,
      updatedAt:     now,
    };
    bookings.push(record);
    bookingState.bookingId = record.id;
  }

  setAllBookings(bookings);
  return record;
}

function loadLatestBooking() {
  const bookings = getAllBookings();
  if (!bookings.length) return null;

  if (bookingState.bookingId) {
    const found = bookings.find(b => b.id === bookingState.bookingId);
    if (found) return found;
  }

  // Prioritize booking for currently logged in user/company
  try {
    const currentUser = JSON.parse(localStorage.getItem('mricare_current_user'));
    if (currentUser) {
      const userBooking = bookings.find(b => 
        (currentUser.company && b.companyName && b.companyName.toLowerCase().includes(currentUser.company.toLowerCase())) ||
        (currentUser.name && b.contactName && b.contactName.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        (currentUser.email && b.email && b.email.toLowerCase() === currentUser.email.toLowerCase())
      );
      if (userBooking) return userBooking;
    }
  } catch {}

  return bookings.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

/* ============================================================
   3. CATALOG RENDERING & SELECTION
============================================================ */

function renderPackageCards() {
  packageGrid.innerHTML = '';
  PACKAGES.forEach((pkg) => {
    const card = document.createElement('article');
    card.className = 'package-card bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between';
    card.dataset.packageId = pkg.id;
    card.setAttribute('aria-label', `Pilih ${pkg.name}`);

    const featureItems = pkg.features
      .map(f => `
        <li class="flex items-start gap-2 text-xs sm:text-sm text-slate-600 leading-snug">
          <svg class="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>${f}</span>
        </li>`)
      .join('');

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between mb-4">
          <span class="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">${pkg.tag}</span>
          <span class="text-[11px] font-mono text-slate-400">Min. ${pkg.minPax} pax</span>
        </div>
        <h3 class="text-lg font-display font-extrabold text-slate-950 mb-1">${pkg.name}</h3>
        <p class="text-slate-900 font-display font-bold text-base mb-5">${pkg.price}</p>
        <ul class="space-y-2.5 mb-6">${featureItems}</ul>
      </div>
      <button class="btn-select-package w-full bg-slate-950 text-white font-semibold text-xs py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        Pilih Paket Ini
      </button>
    `;

    card.addEventListener('click', (e) => {
      selectPackage(pkg.id);
    });

    packageGrid.appendChild(card);
  });
}

function selectPackage(packageId, silentChat = false) {
  const pkg = PACKAGES.find(p => p.id === packageId);
  if (!pkg) return;

  bookingState.selectedPackage = pkg;
  bookingState.sent = false;

  // Sync form package select dropdown & quick buttons
  if (bookingFormPackage) {
    bookingFormPackage.value = pkg.id;
  }
  document.querySelectorAll('.quick-pkg-btn').forEach(btn => {
    if (btn.dataset.pkg === pkg.id) {
      btn.className = 'quick-pkg-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#0B3D3A] bg-[#0B3D3A]/10 text-[#0B3D3A] transition cursor-pointer';
    } else {
      btn.className = 'quick-pkg-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition cursor-pointer';
    }
  });

  if (formPaxHint) {
    formPaxHint.textContent = `Min. ${pkg.minPax} pax`;
  }

  // Recalculate price if participants already given
  const num = parseInt(String(bookingState.participants || '').replace(/\D/g, '')) || 100;
  bookingState.participants = `${num} orang`;
  bookingState.estimasiHarga = `Rp ${(num * pkg.priceNum).toLocaleString('id-ID')}`;

  // Update card visuals in catalog
  document.querySelectorAll('.package-card').forEach(card => {
    card.classList.remove('selected');
    const btn = card.querySelector('.btn-select-package');
    if (btn) {
      btn.className = 'btn-select-package w-full bg-slate-950 text-white font-semibold text-xs py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm';
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        Pilih Paket Ini`;
    }
  });

  const selectedCard = document.querySelector(`.package-card[data-package-id="${packageId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    const btn = selectedCard.querySelector('.btn-select-package');
    if (btn) {
      btn.className = 'btn-select-package w-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5';
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Dipilih`;
    }
  }

  updateSummaryPanel();
  showToast(`✅ ${pkg.name} berhasil dipilih!`);

  if (!silentChat) {
    openChat();
    appendBotMessage(
      `Pilihan tepat! Anda memilih **${pkg.name}** (${pkg.price}).\n\nSilakan periksa atau lengkapi data pada **Formulir Pemesanan** di bawah untuk langsung mengunci estimasi biaya dan jadwal armada Bus MCU+.`
    );
  }
}

/* ============================================================
   4. SUMMARY PANEL & FORM STATE SYNCHRONIZER
=========================================================== */

function updateSummaryPanel() {
  const pkg = bookingState.selectedPackage || PACKAGES[1];
  bookingState.selectedPackage = pkg;

  // 1. Calculate cost
  const numPax = parseInt(String(bookingState.participants || '').replace(/\D/g, '')) || 100;
  const totalCostNum = numPax * pkg.priceNum;
  bookingState.estimasiHarga = `Rp ${totalCostNum.toLocaleString('id-ID')}`;

  // 2. Update summary sheet header & prices
  if (summaryPkgName)    summaryPkgName.textContent  = pkg.name;
  if (summaryPkgPrice)   summaryPkgPrice.textContent = `${pkg.price}`;
  if (summaryPaxCount)   summaryPaxCount.textContent = `${numPax} Orang`;
  if (summaryTotalPrice) summaryTotalPrice.textContent = bookingState.estimasiHarga;

  if (summaryStatus) {
    if (bookingState.sent) {
      summaryStatus.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full';
      summaryStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Terkirim ke Admin`;
    } else {
      summaryStatus.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full';
      summaryStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Draft Pengajuan`;
    }
  }

  // 3. Update summary details breakdown list
  if (summaryDetails) {
    summaryDetails.innerHTML = '';
    const detailFields = [
      { label: 'Perusahaan',     value: bookingState.company,     icon: '🏢' },
      { label: 'Nama PIC',       value: bookingState.contactName, icon: '👤' },
      { label: 'WhatsApp / HP',  value: bookingState.phone,       icon: '📞' },
      { label: 'Tgl Kunjungan',  value: bookingState.date,        icon: '📅' },
      { label: 'Lokasi On-Site', value: bookingState.location,    icon: '📍' },
      { label: 'Catatan Khusus', value: bookingState.notes,       icon: '📝' },
    ];

    detailFields.forEach(({ label, value, icon }) => {
      if (!value) return;
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0';
      row.innerHTML = `
        <span class="text-stone-500 flex items-center gap-1.5">
          <span>${icon}</span>
          <span>${label}:</span>
        </span>
        <span class="font-semibold text-stone-900 text-right truncate max-w-[180px]">${escapeHtml(value)}</span>
      `;
      summaryDetails.appendChild(row);
    });
  }

  // 4. Sync form inputs if changed externally (e.g. from chatbot)
  if (bookingFormPackage && bookingFormPackage.value !== pkg.id) {
    bookingFormPackage.value = pkg.id;
  }
  if (bookingFormCompany && bookingState.company && bookingFormCompany.value !== bookingState.company) {
    bookingFormCompany.value = bookingState.company;
  }
  if (bookingFormPicName && bookingState.contactName && bookingFormPicName.value !== bookingState.contactName) {
    bookingFormPicName.value = bookingState.contactName;
  }
  if (bookingFormPicPhone && bookingState.phone && bookingFormPicPhone.value !== bookingState.phone) {
    bookingFormPicPhone.value = bookingState.phone;
  }
  if (bookingFormPax && numPax && String(bookingFormPax.value) !== String(numPax)) {
    bookingFormPax.value = numPax;
  }
}

/* Connect Interactive Booking Form Listeners */
function initBookingForm() {
  if (bookingFormPackage) {
    bookingFormPackage.addEventListener('change', (e) => {
      selectPackage(e.target.value, true);
    });
  }

  document.querySelectorAll('.quick-pkg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectPackage(btn.dataset.pkg, true);
    });
  });

  if (bookingFormCompany) {
    bookingFormCompany.addEventListener('input', (e) => {
      bookingState.company = e.target.value.trim();
      updateSummaryPanel();
    });
  }

  if (bookingFormPicName) {
    bookingFormPicName.addEventListener('input', (e) => {
      bookingState.contactName = e.target.value.trim();
      updateSummaryPanel();
    });
  }

  if (bookingFormPicPhone) {
    bookingFormPicPhone.addEventListener('input', (e) => {
      bookingState.phone = e.target.value.trim();
      updateSummaryPanel();
    });
  }

  if (bookingFormPax) {
    bookingFormPax.addEventListener('input', (e) => {
      const count = parseInt(e.target.value) || 0;
      bookingState.participants = count > 0 ? `${count} orang` : '';
      document.querySelectorAll('.quick-pax-btn').forEach(b => {
        if (parseInt(b.dataset.pax) === count) {
          b.className = 'quick-pax-btn text-xs font-medium px-3 py-2 rounded-lg border border-[#0B3D3A] bg-[#0B3D3A]/10 text-[#0B3D3A] font-bold transition cursor-pointer';
        } else {
          b.className = 'quick-pax-btn text-xs font-medium px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition cursor-pointer';
        }
      });
      updateSummaryPanel();
    });
  }

  document.querySelectorAll('.quick-pax-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pax = parseInt(btn.dataset.pax);
      if (bookingFormPax) bookingFormPax.value = pax;
      bookingState.participants = `${pax} orang`;
      document.querySelectorAll('.quick-pax-btn').forEach(b => {
        if (b === btn) {
          b.className = 'quick-pax-btn text-xs font-medium px-3 py-2 rounded-lg border border-[#0B3D3A] bg-[#0B3D3A]/10 text-[#0B3D3A] font-bold transition cursor-pointer';
        } else {
          b.className = 'quick-pax-btn text-xs font-medium px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition cursor-pointer';
        }
      });
      updateSummaryPanel();
    });
  });

  if (bookingFormDate) {
    bookingFormDate.addEventListener('change', (e) => {
      if (e.target.value) {
        const [y, m, d] = e.target.value.split('-');
        bookingState.date = `${d}/${m}/${y}`;
      } else {
        bookingState.date = '';
      }
      updateSummaryPanel();
    });
  }

  if (bookingFormLocation) {
    bookingFormLocation.addEventListener('input', (e) => {
      bookingState.location = e.target.value.trim();
      updateSummaryPanel();
    });
  }

  if (bookingFormNotes) {
    bookingFormNotes.addEventListener('input', (e) => {
      bookingState.notes = e.target.value.trim();
      updateSummaryPanel();
    });
  }

  // Pre-fill with logged-in user if available
  try {
    const user = JSON.parse(localStorage.getItem('mricare_current_user'));
    if (user && user.role !== 'admin') {
      if (user.company && !bookingState.company) {
        bookingState.company = user.company;
        if (bookingFormCompany) bookingFormCompany.value = user.company;
      }
      if (user.name && !bookingState.contactName) {
        bookingState.contactName = user.name;
        if (bookingFormPicName) bookingFormPicName.value = user.name;
      }
      if (user.phone && !bookingState.phone) {
        bookingState.phone = user.phone;
        if (bookingFormPicPhone) bookingFormPicPhone.value = user.phone;
      }
    }
  } catch {}
}

/* ============================================================
   5. NLP ENTITY EXTRACTOR (INDONESIAN B2B CONVERSATION)
============================================================ */

/**
 * Robust extractor analyzing user messages to populate bookingState in real-time.
 */
function extractEntitiesFromText(text) {
  let updated = false;

  // 1. Detect Package Intent
  if (/\b(?:paket\s+)?dasar\b/i.test(text) && !bookingState.selectedPackage) {
    bookingState.selectedPackage = PACKAGES.find(p => p.id === 'basic');
    updated = true;
  } else if (/\b(?:paket\s+)?komprehensif\b/i.test(text)) {
    bookingState.selectedPackage = PACKAGES.find(p => p.id === 'comprehensive');
    updated = true;
  } else if (/\b(?:paket\s+)?executive\b/i.test(text)) {
    bookingState.selectedPackage = PACKAGES.find(p => p.id === 'executive');
    updated = true;
  }

  // 2. Detect Company Name (e.g., PT Mahakarya, CV Sumber Makmur, Perusahaan XYZ)
  const companyMatch = text.match(/\b(?:pt\.?|cv\.?|perusahaan|instansi|yayasan)\s+([A-Za-z0-9\s.,\-\/]+?)(?:(?=[\n,.]|\s+(?:dengan|untuk|pic|alamat|tanggal|jumlah|kontak|no|mau|ingin))|$)/i);
  if (companyMatch && companyMatch[1].trim().length > 2) {
    bookingState.company = capitalizeWords(companyMatch[0].trim());
    updated = true;
  }

  // 3. Detect PIC Name (e.g. Budi, Ibu Sarah, etc.)
  const picMatch = text.match(/\b(?:nama saya|nama pic|pic\s*:\s*|pic|contact person|kontak|atas nama|nama|saya)\s+([A-Za-z\s]{2,25})(?:\s+(?:dari|no|telp|hp|wa|tanggal|di|mau|ingin|selaku)|[,.]|$)/i);
  if (picMatch && !/^(pt|cv|perusahaan|paket|dasar|komprehensif|executive|ingin|mau|bisa)$/i.test(picMatch[1].trim())) {
    bookingState.contactName = capitalizeWords(picMatch[1].trim());
    updated = true;
  }

  // 4. Detect Phone Number (08xxx or +62xxx)
  const phoneMatch = text.match(/(?:(?:\+62|62|0)\s*(?:8[1-9][0-9]{1,2})[\s\-]*[0-9]{3,4}[\s\-]*[0-9]{3,5}|\b08\d{8,12}\b)/);
  if (phoneMatch) {
    bookingState.phone = phoneMatch[0].replace(/[\s\-]/g, '');
    updated = true;
  }

  // 5. Detect Participants count (e.g. 50 orang, 100 pax, 120 karyawan)
  const paxMatch = text.match(/\b(\d{1,4})\s*(?:orang|peserta|karyawan|pax|pegawai|staf|jiwa)\b/i);
  if (paxMatch) {
    const count = parseInt(paxMatch[1]);
    if (count > 0) {
      bookingState.participants = `${count} orang`;
      if (bookingState.selectedPackage) {
        const total = count * bookingState.selectedPackage.priceNum;
        bookingState.estimasiHarga = `Rp ${total.toLocaleString('id-ID')}`;
      }
      updated = true;
    }
  }

  // 6. Detect Date
  const dateMatch = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
  if (dateMatch) {
    bookingState.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    updated = true;
  } else {
    const indonesianMonthMatch = text.match(/\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{2,4})?\b/i);
    if (indonesianMonthMatch) {
      bookingState.date = capitalizeWords(indonesianMonthMatch[0]);
      updated = true;
    }
  }

  // 7. Detect Location
  const locMatch = text.match(/\b(?:jl\.?|jalan|alamat(?:\s*lokasi)?|lokasi(?:\s*di)?|kawasan|gedung|area|bertempat di)\s*[:]?\s*([A-Za-z0-9\s.,\-\/]+?)(?:(?=[\n,]|\s+(?:untuk|dengan|pada|sebanyak|no\s*telp|no\s*hp|hp[:\s]|wa[:\s]|peserta|tanggal))|$)/i);
  if (locMatch && locMatch[1].trim().length > 3 && !/^(hari|besok|lusa|paket|pagi|siang)/i.test(locMatch[1].trim())) {
    bookingState.location = capitalizeWords(locMatch[0].trim().replace(/^lokasi[:\s]*/i, '').replace(/^alamat[:\s]*/i, ''));
    updated = true;
  }

  if (updated) {
    updateSummaryPanel();
  }

  return updated;
}

/* ============================================================
   6. HYBRID AI ASSISTANT & LOCAL CLINICAL REASONING
============================================================ */

/**
 * Smart local B2B healthcare reasoning engine.
 * Responds authentically to medical check-up inquiries, calculations, and booking steps.
 */
function getSmartBotReply(userText) {
  const msg = userText.toLowerCase();

  // Price Calculation request
  const numMatch = userText.match(/\b(\d+)\s*(?:orang|peserta|karyawan|pax)?\b/i);
  if ((msg.includes('hitung') || msg.includes('biaya') || msg.includes('estimasi') || msg.includes('harga')) && numMatch && parseInt(numMatch[1]) > 0) {
    const count = parseInt(numMatch[1]);
    const pkg = bookingState.selectedPackage || PACKAGES[1]; // default to comprehensive
    const total = count * pkg.priceNum;
    bookingState.participants = `${count} orang`;
    bookingState.selectedPackage = pkg;
    bookingState.estimasiHarga = `Rp ${total.toLocaleString('id-ID')}`;
    updateSummaryPanel();

    return `Berikut rincian estimasi biaya untuk **${count} peserta** dengan **${pkg.name}**:\n\n• Tarif: ${pkg.price}\n• Jumlah: ${count} orang\n• **Total Estimasi: Rp ${total.toLocaleString('id-ID')}**\n\nFasilitas mencakup armada Bus MCU lengkap di lokasi, tim medis berizin, peralatan lab, dan laporan hasil digital H+1.\n\nApakah Anda ingin melanjutkan ke penjadwalan kunjungan?`;
  }

  // Recommendation query
  if (msg.includes('rekomendasi') || msg.includes('saran') || msg.includes('beda') || msg.includes('kantor vs pabrik')) {
    return `💡 **Panduan Rekomendasi Paket MCU Sesuai Profil Industri:**\n\n1. **Karyawan Kantor / Administrasi**: Disarankan **Paket Dasar** (Rp 150.000/pax) atau **Paket Komprehensif** (Rp 350.000/pax) untuk deteksi sindrom metabolik, kolesterol, glukosa, dan rekam jantung EKG.\n\n2. **Karyawan Pabrik / Manufaktur / Lapangan**: Wajib **Paket Komprehensif** atau **Executive** (ada tambahan Rontgen Thorax paru dan tes fungsi organ).\n\n3. **Manajemen / Direksi (C-Level)**: **Paket Executive** (Rp 750.000/pax) dengan Rontgen Thorax, USG Abdomen, dan evaluasi dokter spesialis okupasi.`;
  }

  // Bus Facilities query
  if (msg.includes('fasilitas') || msg.includes('bus') || msg.includes('armada') || msg.includes('alat') || msg.includes('listrik') || msg.includes('genset')) {
    return `🚌 **Fasilitas Armada Bus MCU MCU+:**\n\n• **Ruang Kedap Rontgen**: Mesin Digital X-Ray Thorax terkalibrasi BAPETEN.\n• **Bilik EKG & USG**: Ruang pemeriksaan privat ber-AC dengan bed medis.\n• **Mini Laboratory On-Bus**: Centrifuge & penyimpanan sampel darah/urine standar lab.\n• **Genset Mandiri**: Silent generator mandiri tanpa perlu pasokan listrik pabrik.\n• **Kapasitas**: 80 – 150 peserta per bus per hari.`;
  }

  // Greeting
  if (/^(halo|hai|hi|hello|pagi|siang|sore|malam|assalamualaikum)/i.test(msg)) {
    const pkgText = bookingState.selectedPackage 
      ? `Anda sedang memilih **${bookingState.selectedPackage.name}**.`
      : `Anda dapat memilih paket di katalog atau bertanya estimasi biaya.`;
    return `Halo! 👋 Saya **AI Assistant MCU+**.\n\nSaya siap membantu simulasi biaya, rekomendasi paket, serta reservasi armada Bus MCU untuk perusahaan Anda.\n\n${pkgText}\n\nAda yang bisa saya bantu?`;
  }

  // Fallback with progress guidance
  const missing = [];
  if (!bookingState.selectedPackage) missing.push('Pilihan Paket MCU');
  if (!bookingState.company) missing.push('Nama Perusahaan (PT/CV)');
  if (!bookingState.contactName) missing.push('Nama PIC');
  if (!bookingState.phone) missing.push('No. Telepon / WhatsApp');
  if (!bookingState.participants) missing.push('Jumlah Peserta');
  if (!bookingState.date) missing.push('Tanggal Kunjungan');
  if (!bookingState.location) missing.push('Lokasi Kunjungan');

  if (missing.length > 0 && missing.length <= 4) {
    return `Terima kasih atas informasinya! Data Anda telah terupdate di **Booking Summary**.\n\nUntuk melengkapi reservasi, silakan informasikan:\n${missing.map(m => `• ${m}`).join('\n')}`;
  }

  if (missing.length === 0) {
    return `✅ **Seluruh data pemesanan telah lengkap!**\n\nSilakan periksa detailnya di bagian **Booking Summary**, lalu klik tombol **Kirim ke Admin MCU+ & WhatsApp** untuk validasi jadwal resmi oleh tim operasional kami.`;
  }

  return `Terima kasih! Saya telah mencatat detail percakapan Anda.\n\nAnda dapat menyebutkan nama PT, jumlah peserta, tanggal yang diinginkan, atau bertanya seputar pemeriksaan medis MCU on-site kami.`;
}

/**
 * Sends message to Langflow with timeout and fallback.
 */
async function sendToLangflowWithFallback(userMessage) {
  // 1. Run local entity extractor immediately
  extractEntitiesFromText(userMessage);

  // 2. Try Langflow API if configured
  if (LANGFLOW_CONFIG.endpoint && LANGFLOW_CONFIG.apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LANGFLOW_CONFIG.timeoutMs);

      const payload = {
        output_type: 'chat',
        input_type:  'chat',
        input_value: userMessage,
        session_id:  LANGFLOW_SESSION_ID,
      };

      const response = await fetch(LANGFLOW_CONFIG.endpoint, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    LANGFLOW_CONFIG.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const replyText = data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
        if (replyText) {
          // Also run extractor on Langflow's output in case it structured entities
          extractEntitiesFromText(replyText);
          return replyText;
        }
      }
    } catch (err) {
      console.warn('[AI Assistant] Langflow offline or timed out, seamlessly using smart local reasoning.', err);
    }
  }

  // 3. Graceful smart fallback
  return getSmartBotReply(userMessage);
}

/* ============================================================
   7. CHAT INTERACTIONS & RENDERING
============================================================ */

function openChat() {
  chatWindow.classList.remove('chat-window-hidden');
  chatWindow.classList.add('chat-window-visible');
  iconOpen.classList.add('hidden');
  iconClose.classList.remove('hidden');
  chatDot.classList.add('hidden');
  chatInput.focus();
  scrollChatToBottom();
}

function closeChat() {
  chatWindow.classList.remove('chat-window-visible');
  chatWindow.classList.add('chat-window-hidden');
  iconOpen.classList.remove('hidden');
  iconClose.classList.add('hidden');
}

function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-bubble-enter flex justify-end';
  wrapper.innerHTML = `
    <div class="max-w-[85%] bg-med-blue text-white text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed shadow-sm">
      ${escapeHtml(text).replace(/\n/g, '<br/>')}
    </div>
  `;
  chatMessages.appendChild(wrapper);
  scrollChatToBottom();
}

function appendBotMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-bubble-enter flex items-start gap-2.5';

  const formatted = formatBotText(text);

  wrapper.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-med-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-med-blue">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <rect x="3" y="8" width="18" height="11" rx="3"/>
        <circle cx="9" cy="13" r="1" fill="currentColor"/>
        <circle cx="15" cy="13" r="1" fill="currentColor"/>
      </svg>
    </div>
    <div class="max-w-[85%] bg-white text-slate-700 text-xs sm:text-sm px-4 py-3 rounded-2xl rounded-tl-sm leading-relaxed shadow-sm border border-slate-200/80 space-y-1.5">
      ${formatted}
    </div>
  `;
  chatMessages.appendChild(wrapper);
  scrollChatToBottom();
}

function formatBotText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n\n/g, '<div class="my-1.5"></div>')
    .replace(/\n/g, '<br/>');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function showTyping() {
  typingIndicator.classList.remove('hidden');
  scrollChatToBottom();
}

function hideTyping() {
  typingIndicator.classList.add('hidden');
}

async function sendMessage(customText) {
  const text = (customText || chatInput.value).trim();
  if (!text) return;

  appendUserMessage(text);

  if (!customText) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  showTyping();
  chatSendBtn.disabled = true;
  chatInput.disabled   = true;

  try {
    const reply = await sendToLangflowWithFallback(text);
    hideTyping();
    appendBotMessage(reply);
  } catch (err) {
    hideTyping();
    appendBotMessage('Terjadi kendala teknis. Namun data Anda tetap aman dan dapat diinput melalui form manual.');
  } finally {
    chatSendBtn.disabled = false;
    chatInput.disabled   = false;
    chatInput.focus();
  }
}

/* ============================================================
   8. ORDER STATUS TRACKER & PERSISTENCE
============================================================ */

function saveBooking() {
  const newRecord = {
    id: bookingState.bookingId || ('mcu-' + Date.now()),
    package: bookingState.selectedPackage ? bookingState.selectedPackage.name : 'Paket Komprehensif',
    packageId: bookingState.selectedPackage ? bookingState.selectedPackage.id : 'comprehensive',
    companyName: bookingState.company || 'PT Belum Tercatat',
    picName: bookingState.contactName || 'PIC',
    phone: bookingState.phone || '-',
    participants: bookingState.participants || '100 orang',
    date: bookingState.date || 'Sesuai Jadwal',
    location: bookingState.location || 'Lokasi Perusahaan',
    notes: bookingState.notes || '',
    estimasiHarga: bookingState.estimasiHarga || 'Rp 35.000.000',
    status: 'Menunggu Konfirmasi',
    createdAt: new Date().toISOString(),
    history: [
      {
        status: 'Menunggu Konfirmasi',
        timestamp: new Date().toISOString(),
        note: 'Pemesanan baru diajukan melalui formulir website MCU+.'
      }
    ]
  };

  bookingState.bookingId = newRecord.id;

  // 1. LocalStorage cache (offline-first)
  try {
    const existing = JSON.parse(localStorage.getItem('mricare_bookings') || '[]');
    const idx = existing.findIndex(b => b.id === newRecord.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...newRecord };
    } else {
      existing.unshift(newRecord);
    }
    localStorage.setItem('mricare_bookings', JSON.stringify(existing));
    localStorage.setItem('mricare_latest_update', Date.now().toString());
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  // 2. Firebase Cloud Firestore
  if (window.FirebaseService && typeof window.FirebaseService.saveBooking === 'function') {
    window.FirebaseService.saveBooking(newRecord).catch(err => {
      console.warn('Firebase saveBooking background warning:', err);
    });
  }

  return newRecord;
}

function loadLatestBooking() {
  try {
    const list = JSON.parse(localStorage.getItem('mricare_bookings') || '[]');
    if (bookingState.bookingId) {
      const found = list.find(b => b.id === bookingState.bookingId);
      if (found) return found;
    }
    return list[0] || null;
  } catch (e) {
    return null;
  }
}

const STATUS_STEP_MAP = {
  'Menunggu Konfirmasi': 2,
  'Dikonfirmasi':        3,
  'Jadwal Diproses':     3,
  'Selesai':             4,
};

function updateOrderStatusUI(status, booking = null) {
  const b = booking || loadLatestBooking();
  const currentStatus = status || (b ? b.status : 'Menunggu Konfirmasi');
  const activeStep = STATUS_STEP_MAP[currentStatus] ?? 2;

  const INACTIVE     = ['border-stone-200', 'bg-white',     'text-stone-300', 'text-stone-400', ''];
  const DONE         = ['border-[#0B3D3A]', 'bg-[#0B3D3A]',  'text-white',     'text-[#0B3D3A]', 'shadow-2xs'];
  const ACTIVE_AMBER = ['border-amber-500', 'bg-amber-500', 'text-white',     'text-amber-700', 'ring-4 ring-amber-100 shadow-xs'];
  const ACTIVE_TEAL  = ['border-[#0B3D3A]', 'bg-[#0B3D3A]', 'text-white',     'text-[#0B3D3A]', 'ring-4 ring-emerald-100 shadow-xs'];
  const ACTIVE_GREEN = ['border-emerald-600', 'bg-emerald-600', 'text-white', 'text-emerald-700', 'ring-4 ring-emerald-100 shadow-xs'];

  function stepStyle(n) {
    if (n < activeStep) return DONE;
    if (n === activeStep) {
      if (currentStatus === 'Menunggu Konfirmasi') return ACTIVE_AMBER;
      if (currentStatus === 'Selesai') return ACTIVE_GREEN;
      return ACTIVE_TEAL;
    }
    return INACTIVE;
  }

  [1, 2, 3, 4].forEach(n => {
    const circle = document.getElementById(`step-${n}-circle`);
    const label  = document.getElementById(`step-${n}-label`);
    if (!circle || !label) return;
    const [border, bg, iconColor, labelColor, ring] = stepStyle(n);
    circle.className = `w-10 h-10 rounded-full border flex items-center justify-center mb-2 transition-all duration-300 ${border} ${bg} ${ring}`.trim();
    const icon = circle.querySelector('svg');
    if (icon) icon.className = `w-4 h-4 ${iconColor}`;
    label.className = `text-xs font-bold ${labelColor}`;
  });

  const fill = document.getElementById('status-progress-fill');
  if (fill) {
    fill.style.width = (activeStep <= 1) ? '0%' : (activeStep === 2) ? '33.3%' : (activeStep === 3) ? '66.6%' : '100%';
  }

  const CARD_INFO = {
    'Menunggu Konfirmasi': {
      cls:   'bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 flex items-start gap-4 transition-all shadow-2xs',
      iconCls: 'bg-amber-100 text-amber-700 border border-amber-300',
      title: 'Menunggu Konfirmasi Tim Operasional Admin',
      desc:  'Data pemesanan Anda telah tersimpan. Tim operasional admin kami sedang memeriksa ketersediaan armada bus untuk tanggal yang diajukan dan akan menghubungi PIC segera.',
    },
    'Dikonfirmasi': {
      cls:   'bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-5 flex items-start gap-4 transition-all shadow-2xs',
      iconCls: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      title: 'Pemesanan Dikonfirmasi — Alokasi Armada Dimulai ✅',
      desc:  'Pemesanan kunjungan Bus MCU Anda telah disetujui. Tim logistik medis sedang menyiapkan alokasi unit armada bus, nakes, dan dokter penanggung jawab.',
    },
    'Jadwal Diproses': {
      cls:   'bg-sky-50/90 border border-sky-200/90 rounded-2xl p-5 flex items-start gap-4 transition-all shadow-2xs',
      iconCls: 'bg-sky-100 text-sky-800 border border-sky-300',
      title: 'Jadwal & Armada Siap Operasional 🚌',
      desc:  'Alokasi armada Bus MCU (Unit Alpha) dan jadwal on-site telah ditetapkan lengkap dengan silent genset & rontgen digital. Surat konfirmasi tugas siap diterbitkan.',
    },
    'Selesai': {
      cls:   'bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4 transition-all shadow-2xs',
      iconCls: 'bg-emerald-200/80 text-emerald-900 border border-emerald-300',
      title: 'Medical Check-Up Selesai Dilaksanakan 🎉',
      desc:  'Layanan MCU On-Site telah terlaksana dengan sukses. Laporan kesehatan digital karyawan & sertifikat K3 dapat diakses melalui portal HR MCU+.',
    },
  };

  const info = CARD_INFO[currentStatus] || CARD_INFO['Menunggu Konfirmasi'];
  const card      = document.getElementById('order-status-card');
  const cardTitle = document.getElementById('order-status-title');
  const cardDesc  = document.getElementById('order-status-desc');
  if (card) {
    card.className = info.cls;
    const iconContainer = card.querySelector('div:first-child');
    if (iconContainer) iconContainer.className = `w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${info.iconCls}`;
  }
  if (cardTitle) cardTitle.textContent = info.title;
  
  if (cardDesc) {
    let extraMeta = '';
    if (b) {
      extraMeta = `<div class="mt-2.5 pt-2 border-t border-stone-200/80 text-[11px] font-mono text-stone-600 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>🏢 <strong>${escHtml(b.companyName)}</strong></span>
        <span>📦 <strong>${escHtml(b.package)}</strong> (${escHtml(b.participants)})</span>
        <span>📅 <strong>${escHtml(b.date)}</strong></span>
        <span class="text-stone-400">• ID: ${escHtml((b.id || '').slice(0, 8))}</span>
      </div>`;
    }
    cardDesc.innerHTML = `${info.desc}${extraMeta}`;
  }
}

function startStatusPolling() {
  function checkAndRefresh() {
    const rec = loadLatestBooking();
    if (rec) updateOrderStatusUI(rec.status, rec);
  }

  // Initial check
  checkAndRefresh();

  // Listen for storage events across tabs/windows
  window.addEventListener('storage', (e) => {
    if (e.key === 'mricare_bookings' || e.key === 'mricare_current_user' || e.key === 'mricare_latest_update') {
      checkAndRefresh();
    }
  });

  // Real-time Firebase Firestore Sync Listener
  const tryAttachFirebase = () => {
    if (window.FirebaseService && typeof window.FirebaseService.onBookingsChange === 'function') {
      window.FirebaseService.onBookingsChange((firestoreBookings) => {
        if (firestoreBookings && Array.isArray(firestoreBookings) && firestoreBookings.length > 0) {
          localStorage.setItem('mricare_bookings', JSON.stringify(firestoreBookings));
          checkAndRefresh();
        }
      });
    } else {
      setTimeout(tryAttachFirebase, 500);
    }
  };
  tryAttachFirebase();

  // Fast polling fallback
  setInterval(checkAndRefresh, 1500);
}

/* ============================================================
   9. MODAL HANDLERS (Manual Edit & Comparison)
============================================================ */

function openManualEditModal() {
  if (bookingState.selectedPackage) {
    inputEditPackage.value = bookingState.selectedPackage.id;
  }
  inputEditCompany.value  = bookingState.company || '';
  inputEditContact.value  = bookingState.contactName || '';
  inputEditPhone.value    = bookingState.phone || '';
  inputEditPax.value      = bookingState.participants ? parseInt(bookingState.participants.replace(/\D/g, '')) || '' : '';
  inputEditLocation.value = bookingState.location || '';

  // Format date for date input if standard dd/mm/yyyy
  if (bookingState.date && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(bookingState.date)) {
    const [d, m, y] = bookingState.date.split('/');
    inputEditDate.value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  modalEditBooking.classList.remove('hidden');
}

function closeManualEditModal() {
  modalEditBooking.classList.add('hidden');
}

formEditBooking.addEventListener('submit', (e) => {
  e.preventDefault();

  const chosenPkg = PACKAGES.find(p => p.id === inputEditPackage.value);
  if (chosenPkg) {
    selectPackage(chosenPkg.id, true);
  }

  bookingState.company     = capitalizeWords(inputEditCompany.value.trim());
  bookingState.contactName = capitalizeWords(inputEditContact.value.trim());
  bookingState.phone       = inputEditPhone.value.trim();
  bookingState.location    = capitalizeWords(inputEditLocation.value.trim());

  const paxNum = parseInt(inputEditPax.value) || 0;
  if (paxNum > 0) {
    bookingState.participants = `${paxNum} orang`;
    if (bookingState.selectedPackage) {
      bookingState.estimasiHarga = `Rp ${(paxNum * bookingState.selectedPackage.priceNum).toLocaleString('id-ID')}`;
    }
  }

  if (inputEditDate.value) {
    const [y, m, d] = inputEditDate.value.split('-');
    bookingState.date = `${d}/${m}/${y}`;
  }

  updateSummaryPanel();
  closeManualEditModal();
  showToast('✅ Data pemesanan berhasil diperbarui!');
});

/* Comparison Modal */
function openComparisonModal() {
  modalComparison.classList.remove('hidden');
}
function closeComparisonModal() {
  modalComparison.classList.add('hidden');
}

/* ============================================================
   10. WHATSAPP & PRINT ACTIONS
============================================================ */

function buildWhatsAppText() {
  const s = bookingState;
  const lines = [
    `*PERMINTAAN RESERVASI MCU ON-SITE - MCU+*`,
    `──────────────────────────────`,
    `📦 *Paket Layanan:* ${s.selectedPackage ? s.selectedPackage.name : '—'}`,
    `🏢 *Nama Perusahaan:* ${s.company || '—'}`,
    `👤 *Nama PIC:* ${s.contactName || '—'}`,
    `📞 *No. WhatsApp / HP:* ${s.phone || '—'}`,
    `📅 *Tanggal Kunjungan:* ${s.date || '—'}`,
    `👥 *Jumlah Peserta:* ${s.participants || '—'}`,
    `📍 *Lokasi On-Site:* ${s.location || '—'}`,
    `💰 *Estimasi Total:* ${s.estimasiHarga || '—'}`,
    s.notes ? `📝 *Catatan Tambahan:* ${s.notes}` : '',
    `──────────────────────────────`,
    `_Dikirim via Platform MCU+ B2B Portal_`,
  ].filter(Boolean);
  return lines.join('\n');
}

btnConfirm.addEventListener('click', () => {
  if (!bookingState.selectedPackage) {
    showToast('⚠️ Silakan pilih paket MCU terlebih dahulu!');
    return;
  }

  // Validate fields from inputs / bookingState
  if (bookingFormCompany && !bookingState.company) bookingState.company = bookingFormCompany.value.trim();
  if (bookingFormPicName && !bookingState.contactName) bookingState.contactName = bookingFormPicName.value.trim();
  if (bookingFormPicPhone && !bookingState.phone) bookingState.phone = bookingFormPicPhone.value.trim();
  if (bookingFormLocation && !bookingState.location) bookingState.location = bookingFormLocation.value.trim();

  const missing = [];
  if (!bookingState.company) missing.push('Nama Perusahaan');
  if (!bookingState.contactName) missing.push('Nama PIC');
  if (!bookingState.phone) missing.push('No. WhatsApp');

  if (missing.length > 0) {
    showToast(`⚠️ Mohon lengkapi: ${missing.join(', ')}`);
    if (bookingFormCompany && !bookingState.company) bookingFormCompany.focus();
    else if (bookingFormPicName && !bookingState.contactName) bookingFormPicName.focus();
    else if (bookingFormPicPhone && !bookingState.phone) bookingFormPicPhone.focus();
    return;
  }

  // 1. Save to LocalStorage
  const record = saveBooking();

  // 2. Mark as sent
  bookingState.sent = true;
  updateSummaryPanel();
  updateOrderStatusUI(record.status);

  // 3. Open WhatsApp
  const waNumber = '6281299999999';
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(buildWhatsAppText())}`;
  window.open(waUrl, '_blank');

  showToast('📤 Data reservasi tersimpan & WhatsApp dibuka!');

  // 4. Chat notification
  openChat();
  appendBotMessage(
    `📤 **Data reservasi perusahaan Anda telah berhasil tersimpan dan terkirim ke Tim Medis MCU+.**\n\nTim operasional kami akan segera menghubungi PIC (**${bookingState.contactName}**) via WhatsApp (${bookingState.phone}) untuk konfirmasi teknis penugasan bus. Terima kasih!`
  );

  document.getElementById('order-status')?.scrollIntoView({ behavior: 'smooth' });
});

btnReset.addEventListener('click', () => {
  if (!confirm('Reset seluruh data formulir pemesanan?')) return;

  Object.assign(bookingState, {
    selectedPackage: PACKAGES[1],
    company: '', contactName: '', phone: '',
    date: '', participants: '100 orang', location: '',
    notes: '', estimasiHarga: 'Rp 35.000.000', sent: false, bookingId: null,
  });

  if (bookingFormCompany) bookingFormCompany.value = '';
  if (bookingFormPicName) bookingFormPicName.value = '';
  if (bookingFormPicPhone) bookingFormPicPhone.value = '';
  if (bookingFormPax) bookingFormPax.value = '100';
  if (bookingFormDate) bookingFormDate.value = '';
  if (bookingFormLocation) bookingFormLocation.value = '';
  if (bookingFormNotes) bookingFormNotes.value = '';
  if (bookingFormPackage) bookingFormPackage.value = 'comprehensive';

  document.querySelectorAll('.package-card').forEach(card => {
    card.classList.remove('selected');
    const btn = card.querySelector('.btn-select-package');
    if (btn) {
      btn.className = 'btn-select-package w-full bg-slate-950 text-white font-semibold text-xs py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm';
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        Pilih Paket Ini`;
    }
  });

  updateSummaryPanel();
  showToast('🔄 Formulir pemesanan telah direset.');
});

if (btnPrintSummary) {
  btnPrintSummary.addEventListener('click', () => {
    window.print();
  });
}

/* ============================================================
   11. UI WIRING & EVENT LISTENERS
============================================================ */

// Chat open/close
chatToggle.addEventListener('click', () => {
  const isOpen = chatWindow.classList.contains('chat-window-visible');
  isOpen ? closeChat() : openChat();
});
chatCloseBtn.addEventListener('click', closeChat);
if (heroAiBtn) heroAiBtn.addEventListener('click', openChat);

// Chat quick chips
document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// Chat input events
chatSendBtn.addEventListener('click', () => sendMessage());
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${chatInput.scrollHeight}px`;
});

// Modals
if (btnManualEdit) btnManualEdit.addEventListener('click', openManualEditModal);
if (btnManualEditMob) btnManualEditMob.addEventListener('click', openManualEditModal);
if (modalEditClose) modalEditClose.addEventListener('click', closeManualEditModal);
if (modalEditCancel) modalEditCancel.addEventListener('click', closeManualEditModal);
if (modalEditBooking) {
  modalEditBooking.addEventListener('click', e => { if (e.target === modalEditBooking) closeManualEditModal(); });
}

if (btnOpenComparison) btnOpenComparison.addEventListener('click', openComparisonModal);
if (modalComparisonClose) modalComparisonClose.addEventListener('click', closeComparisonModal);
if (modalComparisonSelect) modalComparisonSelect.addEventListener('click', () => {
  closeComparisonModal();
  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
});
if (modalComparison) {
  modalComparison.addEventListener('click', e => { if (e.target === modalComparison) closeComparisonModal(); });
}

// Mobile Hamburger Menu
if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', () => {
    const isHidden = mobileMenu.classList.contains('hidden');
    if (isHidden) {
      mobileMenu.classList.remove('hidden');
      hamburgerIcon.classList.add('hidden');
      hamburgerCloseIcon.classList.remove('hidden');
    } else {
      mobileMenu.classList.add('hidden');
      hamburgerIcon.classList.remove('hidden');
      hamburgerCloseIcon.classList.add('hidden');
    }
  });

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      hamburgerIcon.classList.remove('hidden');
      hamburgerCloseIcon.classList.add('hidden');
    });
  });
}

// Toast helper
let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3200);
}

function capitalizeWords(str) {
  return String(str || '').replace(/\b\w/g, c => c.toUpperCase());
}

/* ============================================================
   HERO BUS AUTO CAROUSEL CONTROLLER
============================================================ */
function initHeroCarousel() {
  const container = document.getElementById('hero-bus-carousel');
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');
  const unitBadge = document.getElementById('carousel-unit-badge');
  const capBadge = document.getElementById('carousel-cap-badge');

  if (!container || slides.length === 0) return;

  let currentIndex = 0;
  let carouselTimer = null;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      if (i === index) {
        slide.classList.remove('opacity-0', 'pointer-events-none', 'z-0');
        slide.classList.add('opacity-100', 'z-10');
      } else {
        slide.classList.remove('opacity-100', 'z-10');
        slide.classList.add('opacity-0', 'pointer-events-none', 'z-0');
      }
    });

    dots.forEach((dot, i) => {
      if (i === index) {
        dot.className = 'carousel-dot w-5 h-2 rounded-full bg-emerald-400 transition-all duration-300';
      } else {
        dot.className = 'carousel-dot w-2 h-2 rounded-full bg-white/40 hover:bg-white/70 transition-all duration-300 cursor-pointer';
      }
    });

    const activeSlide = slides[index];
    if (activeSlide && unitBadge) {
      unitBadge.textContent = activeSlide.dataset.unit || 'Bus MCU On-Site';
    }
    if (activeSlide && capBadge) {
      capBadge.textContent = activeSlide.dataset.cap || 'Kapasitas On-Site';
    }

    currentIndex = index;
  }

  function nextSlide() {
    const next = (currentIndex + 1) % slides.length;
    showSlide(next);
  }

  function startAutoPlay() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(nextSlide, 4000);
  }

  function stopAutoPlay() {
    if (carouselTimer) clearInterval(carouselTimer);
  }

  // Dots click support
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      showSlide(i);
      startAutoPlay();
    });
  });

  // Pause on hover
  container.addEventListener('mouseenter', stopAutoPlay);
  container.addEventListener('mouseleave', startAutoPlay);

  // Initialize
  showSlide(0);
  startAutoPlay();
}

/* ============================================================
   12. INITIALIZATION
============================================================ */

function init() {
  renderPackageCards();
  initBookingForm();
  initHeroCarousel();

  const saved = loadLatestBooking();
  if (saved) {
    bookingState.bookingId = saved.id;
    updateOrderStatusUI(saved.status);
  } else {
    updateOrderStatusUI('Menunggu Konfirmasi');
  }

  updateSummaryPanel();
  startStatusPolling();

  // Welcome message
  appendBotMessage(
    'Halo! 👋 Selamat datang di **Asisten AI MCU+**.\n\nSaya siap membantu simulasi biaya & konsultasi kebutuhan **Medical Check-Up On-Site** untuk perusahaan Anda.\n\n💡 _Silakan isi Formulir Pemesanan atau klik salah satu topik cepat di atas._'
  );
}

init();
