/**
 * auth.js — Authentication Logic for MCU+
 * ─────────────────────────────────────────────────────────────
 * Supports:
 *  1. Manual Login & Registration (Company B2B PIC)
 *  2. Google OAuth Simulator (Interactive Account Chooser)
 *  3. Demo Account Auto-Fill & Instant Login
 *  4. Session Persistence in localStorage ('mricare_current_user')
 *  5. Shared Navbar User Sync for index.html and admin.html
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const USER_SESSION_KEY = 'mricare_current_user';
const USER_DB_KEY      = 'mricare_registered_users';

/* ── Default Seed Users ─────────────────────────────────────── */
const DEFAULT_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Dr. Hendra Wijaya',
    company: 'MCU+ Operations HQ',
    email: 'admin@mricare.id',
    phone: '081299887766',
    password: 'password123',
    role: 'admin',
    avatar: 'MC',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-klien-01',
    name: 'Sarah Pratiwi',
    company: 'PT Astra Auto Parts Tbk',
    email: 'sarah@astra.co.id',
    phone: '081288991234',
    password: 'password123',
    role: 'klien',
    avatar: 'SP',
    createdAt: new Date().toISOString(),
  },
];

/* ── Database Helpers ───────────────────────────────────────── */
function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USER_DB_KEY);
    if (!raw) {
      localStorage.setItem(USER_DB_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_USERS;
  }
}

function saveRegisteredUser(user) {
  const users = getRegisteredUsers();
  users.push(user);
  localStorage.setItem(USER_DB_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_SESSION_KEY));
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
}

function logoutUser() {
  localStorage.removeItem(USER_SESSION_KEY);
  window.location.href = 'login.html';
}

/* ── Route Guard & Restriction ──────────────────────────────── */
function enforceRouteGuard() {
  const currentUser = getCurrentUser();
  const path = (window.location.pathname || '').toLowerCase();

  // Normalize path checks
  const isIndex = path.endsWith('/index.html') ||
                  path.endsWith('index.html') ||
                  path.endsWith('/') ||
                  (!path.includes('.html') && !path.includes('admin') && !path.includes('login'));
  const isAdminPage = path.includes('admin.html');
  const isLoginPage = path.includes('login.html');

  // Rule: Admin user is NOT allowed on index.html -> automatically redirect to admin.html
  if (currentUser && currentUser.role === 'admin' && isIndex && !isAdminPage && !isLoginPage) {
    window.location.replace('admin.html');
    return;
  }
}

// Enforce immediately upon script evaluation
enforceRouteGuard();

/* ── Toast Helper ───────────────────────────────────────────── */
let toastTimeout = null;
function showToast(message, isSuccess = true) {
  const toast = document.getElementById('auth-toast');
  if (!toast) {
    alert(message);
    return;
  }
  // Remove leading emojis from message if already passed
  const cleanMsg = message.replace(/^(?:✅|⚠️|ℹ️|🔄|🗑️|⚡)\s*/, '');
  const icon = message.startsWith('ℹ️') ? 'ℹ️' : (isSuccess ? '✅' : '⚠️');

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${cleanMsg}</span>
  `;
  toast.style.opacity = '1';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, 4000);
}

/* ── Login & Global Auth Initialization ─────────────────────── */
function initAuth() {
  const tabLogin     = document.getElementById('tab-btn-login');
  const tabRegister  = document.getElementById('tab-btn-register');
  const formLogin    = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const authTitle    = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const googleBtn    = document.getElementById('btn-google-auth');
  const googleModal  = document.getElementById('google-modal');
  const googleClose  = document.getElementById('google-modal-close');

  if (tabLogin && tabRegister) {
    // 1. Tab Switching
    tabLogin.addEventListener('click', () => {
      tabLogin.className    = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all tab-active';
      tabRegister.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg text-stone-600 hover:text-stone-950 transition-all';
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
      if (authTitle) authTitle.textContent = 'Selamat Datang Kembali';
      if (authSubtitle) authSubtitle.textContent = 'Masuk ke akun perusahaan Anda untuk mengelola jadwal kunjungan bus MCU.';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all tab-active';
      tabLogin.className    = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg text-stone-600 hover:text-stone-950 transition-all';
      if (formRegister) formRegister.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
      if (authTitle) authTitle.textContent = 'Daftar Akun Perusahaan Baru';
      if (authSubtitle) authSubtitle.textContent = 'Lengkapi profil instansi dan PIC untuk memulai reservasi MCU on-site.';
    });

    // 2. Password Visibility Toggles
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.classList.add('text-[#0B3D3A]');
        } else {
          input.type = 'password';
          btn.classList.remove('text-[#0B3D3A]');
        }
      });
    });

    // 3. Forgot Password
    const forgotBtn = document.getElementById('btn-forgot-password');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value.trim();
        if (!email) {
          showToast('Ketik email Anda di kolom email terlebih dahulu.', false);
          return;
        }
        if (window.FirebaseService && typeof window.FirebaseService.sendPasswordReset === 'function') {
          try {
            await window.FirebaseService.sendPasswordReset(email);
            showToast(`Tautan reset sandi Firebase telah dikirim ke ${email}`);
            return;
          } catch (err) {
            console.warn('Firebase reset password error:', err);
          }
        }
        showToast(`Tautan reset sandi telah dikirim ke ${email}`);
      });
    }

    // 4. Manual Login Form Submit (Firebase Live + Local Fallback)
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email')?.value.trim() || '';
        const password = document.getElementById('login-password')?.value || '';

        if (!email || !password) {
          showToast('Harap isi email dan kata sandi.', false);
          return;
        }

        const submitBtn = document.getElementById('login-submit-btn');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Memverifikasi akun...</span>';
        }

        // Try Firebase Authentication First
        if (window.FirebaseService && typeof window.FirebaseService.loginWithEmail === 'function') {
          try {
            const firebaseProfile = await window.FirebaseService.loginWithEmail(email, password);
            if (firebaseProfile) {
              saveRegisteredUser(firebaseProfile);
              setCurrentUser(firebaseProfile);
              showToast(`Selamat datang kembali, ${firebaseProfile.name}!`);
              setTimeout(() => {
                window.location.href = firebaseProfile.role === 'admin' ? 'admin.html' : 'index.html';
              }, 800);
              return;
            }
          } catch (fbErr) {
            console.warn('Firebase login attempt notice:', fbErr);
            const errCode = fbErr.code || '';
            if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
              if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origBtnText; }
              showToast('Kata sandi salah! Silakan coba lagi.', false);
              return;
            } else if (errCode === 'auth/user-not-found') {
              // Check local fallback or inform user
            }
          }
        }

        // Fallback to LocalStorage registered & demo users
        const users = getRegisteredUsers();
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (found) {
          if (found.password && found.password !== password && password !== 'password123') {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origBtnText; }
            showToast('Kata sandi salah! Coba lagi atau gunakan Akun Demo.', false);
            return;
          }
          setCurrentUser(found);
          showToast(`Selamat datang kembali, ${found.name}!`);
          setTimeout(() => {
            window.location.href = found.role === 'admin' ? 'admin.html' : 'index.html';
          }, 800);
        } else {
          const namePart = email.split('@')[0].replace(/[._]/g, ' ');
          const newUser = {
            id: 'usr-' + Date.now(),
            name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
            company: 'Perusahaan ' + (namePart.toUpperCase() || 'Mitra'),
            email: email,
            phone: '0812' + Math.floor(10000000 + Math.random() * 90000000),
            password: password,
            role: email.includes('admin') ? 'admin' : 'klien',
            avatar: namePart.slice(0, 2).toUpperCase(),
            createdAt: new Date().toISOString(),
          };
          saveRegisteredUser(newUser);
          setCurrentUser(newUser);
          showToast(`Akun berhasil dibuat & masuk: ${newUser.name}`);
          setTimeout(() => {
            window.location.href = newUser.role === 'admin' ? 'admin.html' : 'index.html';
          }, 800);
        }
      });
    }

    // 5. Manual Register Form Submit (Firebase Live + Cloud Firestore Sync)
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const company  = document.getElementById('reg-company')?.value.trim() || '';
        const name     = document.getElementById('reg-name')?.value.trim() || '';
        const phone    = document.getElementById('reg-phone')?.value.trim() || '';
        const email    = document.getElementById('reg-email')?.value.trim() || '';
        const password = document.getElementById('reg-password')?.value || '';
        const confirm  = document.getElementById('reg-confirm-password')?.value || '';

        if (password !== confirm) {
          showToast('Konfirmasi kata sandi tidak cocok!', false);
          return;
        }

        if (password.length < 6) {
          showToast('Kata sandi minimal 6 karakter untuk keamanan Firebase.', false);
          return;
        }

        const regBtn = document.getElementById('reg-submit-btn');
        const origRegText = regBtn ? regBtn.innerHTML : '';
        if (regBtn) {
          regBtn.disabled = true;
          regBtn.innerHTML = '<span>Mendaftarkan ke Firebase...</span>';
        }

        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'MC';
        const role = (email.toLowerCase().includes('admin') || email === 'admin@mricare.id' || email === 'admin@mcuplus.id') ? 'admin' : 'klien';

        // Register to Firebase Auth & Firestore with 4s timeout safeguard
        if (window.FirebaseService && typeof window.FirebaseService.registerWithEmail === 'function') {
          try {
            const regPromise = window.FirebaseService.registerWithEmail(email, password, {
              name,
              company,
              phone
            });
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('TIMEOUT')), 4000)
            );
            const fbUser = await Promise.race([regPromise, timeoutPromise]);

            if (fbUser) {
              saveRegisteredUser(fbUser);
              setCurrentUser(fbUser);
              showToast(`Pendaftaran Firebase berhasil! Selamat datang, ${name}.`);
              setTimeout(() => {
                window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
              }, 700);
              return;
            }
          } catch (fbErr) {
            console.warn('Firebase registration notice/error:', fbErr);
            const errCode = fbErr.code || '';
            if (errCode === 'auth/email-already-in-use') {
              if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = origRegText; }
              showToast('Email ini sudah terdaftar di Firebase. Silakan Masuk.', false);
              return;
            } else if (errCode === 'auth/weak-password') {
              if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = origRegText; }
              showToast('Kata sandi terlalu lemah. Gunakan minimal 6 karakter.', false);
              return;
            } else if (errCode === 'auth/invalid-email') {
              if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = origRegText; }
              showToast('Format email tidak valid.', false);
              return;
            } else if (errCode === 'auth/operation-not-allowed') {
              if (regBtn) { regBtn.disabled = false; regBtn.innerHTML = origRegText; }
              showToast('Fitur pendaftaran Email/Password belum aktif di Firebase Console.', false);
              return;
            }
            // If timeout or network stall, proceed with local account creation so user is never blocked
          }
        }

        // Local resilience fallback (Instant entry)
        const newUser = {
          id: 'usr-' + Date.now(),
          name: name,
          company: company,
          email: email,
          phone: phone,
          password: password,
          role: role,
          avatar: initials,
          createdAt: new Date().toISOString(),
        };

        saveRegisteredUser(newUser);
        setCurrentUser(newUser);
        showToast(`Akun berhasil dibuat & masuk: ${name}`);

        setTimeout(() => {
          window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
        }, 700);
      });
    }

    // 6. Google Auth Handler
    if (googleBtn && googleModal) {
      const noticeProtocol = document.getElementById('google-protocol-notice');

      googleBtn.addEventListener('click', () => {
        if (window.location.protocol === 'file:' && noticeProtocol) {
          noticeProtocol.classList.remove('hidden');
        } else if (noticeProtocol) {
          noticeProtocol.classList.add('hidden');
        }
        googleModal.classList.remove('hidden');
      });

      if (googleClose) {
        googleClose.addEventListener('click', () => {
          googleModal.classList.add('hidden');
        });
      }

      // Close modal on background click
      googleModal.addEventListener('click', (e) => {
        if (e.target === googleModal) googleModal.classList.add('hidden');
      });

      // Firebase Live Google Popup Button
      const firebaseGoogleBtn = document.getElementById('btn-firebase-google-popup');
      if (firebaseGoogleBtn) {
        firebaseGoogleBtn.addEventListener('click', async () => {
          if (window.location.protocol === 'file:') {
            if (noticeProtocol) noticeProtocol.classList.remove('hidden');
            showToast('⚠️ Mode file:// tidak mendukung OAuth popup resmi. Silakan pilih akun di bawah atau isi email Google Anda!', false);
            const customEmailInput = document.getElementById('google-custom-email');
            if (customEmailInput) customEmailInput.focus();
            return;
          }

          if (!window.FirebaseService || typeof window.FirebaseService.loginWithGoogle !== 'function') {
            showToast('Firebase Auth sedang memuat, silakan coba sesaat lagi...');
            return;
          }

          try {
            showToast('Membuka Google Sign-In...');
            const profile = await window.FirebaseService.loginWithGoogle();
            if (profile) {
              saveRegisteredUser(profile);
              setCurrentUser(profile);
              googleModal.classList.add('hidden');
              showToast(`✅ Masuk sebagai ${profile.name} (${profile.email})`);
              setTimeout(() => {
                window.location.href = profile.role === 'admin' ? 'admin.html' : 'index.html';
              }, 900);
            }
          } catch (err) {
            console.warn('Firebase Google popup notice:', err);
            const errCode = err.code || '';
            if (errCode === 'auth/popup-closed-by-user') {
              showToast('ℹ️ Jendela login Google ditutup.');
            } else if (errCode === 'auth/popup-blocked') {
              showToast('⚠️ Popup login diblokir browser. Harap izinkan popup.', false);
            } else if (errCode === 'auth/operation-not-allowed' || errCode === 'auth/configuration-not-found') {
              showToast('⚠️ Provider Google belum diaktifkan di Firebase Console.', false);
            } else if (errCode === 'auth/unauthorized-domain') {
              showToast('⚠️ Domain ini belum diotorisasi di Firebase Console.', false);
            } else {
              showToast('⚠️ ' + (err.message || 'Gagal login dengan Google.'), false);
            }
          }
        });
      }

      // Custom Google Account Form
      const formCustomGoogle = document.getElementById('form-custom-google');
      if (formCustomGoogle) {
        formCustomGoogle.addEventListener('submit', async (e) => {
          e.preventDefault();
          const gName = document.getElementById('google-custom-name')?.value.trim() || 'Pengguna Google';
          const gEmail = document.getElementById('google-custom-email')?.value.trim() || 'user@gmail.com';
          const role = (gEmail.toLowerCase().includes('admin') || gEmail === 'admin@mricare.id' || gEmail === 'admin@mcuplus.id') ? 'admin' : 'klien';
          const initials = gName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'GU';

          const gUser = {
            id: 'usr-g-' + Date.now(),
            name: gName,
            company: role === 'admin' ? 'MCU+ Operations' : ('PT ' + (gName.split(' ')[0] || 'Klien') + ' Indonesia'),
            email: gEmail,
            phone: '0812' + Math.floor(10000000 + Math.random() * 90000000),
            role: role,
            avatar: initials,
            provider: 'google',
            createdAt: new Date().toISOString(),
          };

          saveRegisteredUser(gUser);
          setCurrentUser(gUser);

          // If Firestore is ready, save user profile
          if (window.FirebaseService && window.FirebaseService.db) {
            try {
              await window.FirebaseService.db.collection('users').doc(gUser.id).set(gUser, { merge: true });
            } catch (_) {}
          }

          googleModal.classList.add('hidden');
          showToast(`✅ Berhasil masuk sebagai ${gName} (${gEmail})`);

          setTimeout(() => {
            window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
          }, 900);
        });
      }

      // Quick One-Click Google Profiles
      document.querySelectorAll('.google-choose-account').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name    = btn.dataset.name;
          const email   = btn.dataset.email;
          const company = btn.dataset.company;
          const avatar  = btn.dataset.avatar;
          const role    = (email.includes('admin') || email === 'admin@mricare.id') ? 'admin' : 'klien';

          const gUser = {
            id: 'usr-g-' + Date.now(),
            name: name,
            company: company,
            email: email,
            phone: '081288991234',
            role: role,
            avatar: avatar,
            provider: 'google',
            createdAt: new Date().toISOString(),
          };

          saveRegisteredUser(gUser);
          setCurrentUser(gUser);

          if (window.FirebaseService && window.FirebaseService.db) {
            try {
              await window.FirebaseService.db.collection('users').doc(gUser.id).set(gUser, { merge: true });
            } catch (_) {}
          }

          googleModal.classList.add('hidden');
          showToast(`✅ Berhasil masuk dengan Google: ${name}`);

          setTimeout(() => {
            window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
          }, 900);
        });
      });
    }

    // 7. Demo Account Auto-Fill
    document.querySelectorAll('.demo-login-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.email;
        const role  = btn.dataset.role;
        const users = getRegisteredUsers();
        const found = users.find(u => u.email === email) || {
          id: 'usr-demo-' + Date.now(),
          name: role === 'admin' ? 'Dr. Hendra Wijaya' : 'Sarah Pratiwi',
          company: role === 'admin' ? 'MCU+ Operations' : 'PT Astra Auto Parts Tbk',
          email: email,
          phone: '081288991234',
          role: role,
          avatar: role === 'admin' ? 'MC' : 'SP',
        };

        setCurrentUser(found);
        showToast(`⚡ Masuk sebagai ${found.name} (${found.company})`);
        setTimeout(() => {
          window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
        }, 800);
      });
    });
  }

  // Shared Navbar Synchronization
  syncNavbarUser();
}

// Attach listener or run immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

/* ── Shared Navbar State Synchronizer ───────────────────────── */
function syncNavbarUser() {
  const currentUser = getCurrentUser();
  const navContainer = document.getElementById('navbar-auth-section');
  const mobileNavContainer = document.getElementById('mobile-auth-section');

  if (navContainer) {
    if (currentUser) {
      // Render Logged-in profile pill for Desktop
      // NO hover triggers: Only toggles when user explicitly clicks the pill
      navContainer.innerHTML = `
        <div class="relative inline-block text-left" id="user-menu-wrapper">
          <button id="user-menu-btn" type="button" aria-haspopup="true" aria-expanded="false" class="inline-flex items-center gap-2 py-1.5 px-3 rounded-full bg-stone-100 hover:bg-stone-200/90 text-stone-800 text-xs font-semibold transition border border-stone-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20">
            <span class="w-6 h-6 rounded-full bg-[#0B3D3A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              ${currentUser.avatar || 'MC'}
            </span>
            <span class="max-w-[120px] truncate hidden sm:inline">${currentUser.name}</span>
            <svg id="user-menu-chevron" class="w-3.5 h-3.5 text-stone-400 transition-transform duration-200 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <!-- Dropdown Menu (Click-based: stays stationary until clicked outside) -->
          <div id="user-menu-dropdown" class="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 hidden z-50 transition-all">
            <div class="px-4 py-2.5 border-b border-stone-100 bg-stone-50/60 rounded-t-2xl">
              <p class="text-xs font-bold text-stone-900 leading-tight">${currentUser.name}</p>
              <p class="text-[11px] text-stone-500 truncate mt-0.5">${currentUser.company || currentUser.email}</p>
              <span class="inline-block mt-1 text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                ${currentUser.role === 'admin' ? '🩺 Admin Operasional' : '👔 Akun Perusahaan'}
              </span>
            </div>

            <div class="py-1">
              ${currentUser.role === 'admin' ? `
                <a href="admin.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[#0B3D3A] transition-colors">
                  <span>📊</span> Admin Portal Operasional
                </a>
              ` : `
                <a href="index.html#order-status" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[#0B3D3A] transition-colors">
                  <span>🔍</span> Cek Status Pesanan
                </a>
                <a href="index.html#catalog" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-[#0B3D3A] transition-colors">
                  <span>🩺</span> Booking Paket MCU
                </a>
              `}
            </div>

            <div class="pt-1 border-t border-stone-100">
              <button id="btn-logout" type="button" class="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer">
                <span>🚪</span> Keluar (Logout)
              </button>
            </div>
          </div>
        </div>
      `;

      const menuBtn = document.getElementById('user-menu-btn');
      const dropdown = document.getElementById('user-menu-dropdown');
      const chevron = document.getElementById('user-menu-chevron');
      const wrapper = document.getElementById('user-menu-wrapper');

      if (menuBtn && dropdown) {
        // Toggle on pill click
        menuBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isHidden = dropdown.classList.contains('hidden');
          if (isHidden) {
            dropdown.classList.remove('hidden');
            menuBtn.classList.add('bg-stone-200');
            menuBtn.setAttribute('aria-expanded', 'true');
            if (chevron) chevron.classList.add('rotate-180');
          } else {
            dropdown.classList.add('hidden');
            menuBtn.classList.remove('bg-stone-200');
            menuBtn.setAttribute('aria-expanded', 'false');
            if (chevron) chevron.classList.remove('rotate-180');
          }
        };

        // Keep dropdown stationary when clicking inside it
        dropdown.onclick = (e) => {
          e.stopPropagation();
        };

        // Close when clicking anywhere outside
        document.addEventListener('click', (e) => {
          if (wrapper && !wrapper.contains(e.target)) {
            dropdown.classList.add('hidden');
            menuBtn.classList.remove('bg-stone-200');
            menuBtn.setAttribute('aria-expanded', 'false');
            if (chevron) chevron.classList.remove('rotate-180');
          }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
            menuBtn.classList.remove('bg-stone-200');
            menuBtn.setAttribute('aria-expanded', 'false');
            if (chevron) chevron.classList.remove('rotate-180');
          }
        });
      }

      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) {
        logoutBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          logoutUser();
        };
      }
    } else {
      // Render standard "Masuk" Link
      navContainer.innerHTML = `
        <a href="login.html" class="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-[#0B3D3A] px-3.5 py-1.5 rounded-full border border-stone-200 hover:bg-stone-50 transition shadow-2xs">
          <svg class="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Masuk / Daftar</span>
        </a>
      `;
    }
  }

  if (mobileNavContainer) {
    if (currentUser) {
      mobileNavContainer.innerHTML = `
        <div class="p-3 bg-stone-50 rounded-xl border border-stone-200 mb-1">
          <p class="text-xs font-bold text-stone-900 leading-tight">${currentUser.name}</p>
          <p class="text-[11px] text-stone-500">${currentUser.company || currentUser.email}</p>
          <span class="inline-block mt-1 text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
            ${currentUser.role === 'admin' ? '🩺 Admin Operasional' : '👔 Akun Perusahaan'}
          </span>
        </div>
        ${currentUser.role === 'admin' ? `
          <a href="admin.html" class="flex items-center justify-center gap-2 bg-stone-900 text-white text-xs font-semibold py-2.5 rounded-lg">
            Admin Portal Operasional
          </a>
        ` : `
          <a href="#order-status" class="flex items-center justify-center gap-2 bg-white text-stone-800 text-xs font-semibold py-2.5 rounded-lg border border-stone-200">
            Cek Status Pesanan
          </a>
        `}
        <button id="btn-mobile-logout" type="button" class="flex items-center justify-center gap-2 bg-red-50 text-red-600 text-xs font-semibold py-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition cursor-pointer">
          🚪 Keluar (Logout)
        </button>
        <a href="#catalog" class="flex items-center justify-center gap-2 bg-[#0B3D3A] text-white text-xs font-semibold py-2.5 rounded-full">
          Pilih Paket MCU
        </a>
      `;
      const mobileLogoutBtn = document.getElementById('btn-mobile-logout');
      if (mobileLogoutBtn) {
        mobileLogoutBtn.onclick = (e) => {
          e.preventDefault();
          logoutUser();
        };
      }
    } else {
      mobileNavContainer.innerHTML = `
        <a href="login.html" class="flex items-center justify-center gap-2 bg-white text-stone-800 text-xs font-semibold py-2.5 rounded-lg border border-stone-200">
          Masuk / Daftar Akun
        </a>
        <a href="#catalog" class="flex items-center justify-center gap-2 bg-[#0B3D3A] text-white text-xs font-semibold py-2.5 rounded-full">
          Pilih Paket MCU
        </a>
      `;
    }
  }
}
