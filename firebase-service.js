/**
 * firebase-service.js — Universal Firebase Integration for MCU+
 * ─────────────────────────────────────────────────────────────
 * Works across file://, http://localhost, and production hosting.
 * Supports:
 *  1. Google Analytics
 *  2. Cloud Firestore real-time Bookings & Status sync
 *  3. Firebase Authentication (Google OAuth & Email/Password)
 *  4. Seamless offline-first LocalStorage fallback
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

(function () {
  // Default config provided for MCU+ project
  const defaultConfig = {
    apiKey: "AIzaSyDy9d4lABGB4DQ58_ZR2AHmea7beaNLPTY",
    authDomain: "mcuplus-c05cd.firebaseapp.com",
    projectId: "mcuplus-c05cd",
    storageBucket: "mcuplus-c05cd.firebasestorage.app",
    messagingSenderId: "992405150087",
    appId: "1:992405150087:web:11d2b497c45d8bb2615b22",
    measurementId: "G-XTL33YTLR1"
  };

  const config = window.FIREBASE_CONFIG || defaultConfig;

  let app = null;
  let auth = null;
  let db = null;
  let analytics = null;
  let isReady = false;

  // Initialize Firebase when SDK is loaded
  function initFirebase() {
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK not loaded in global scope yet. Retrying...');
      return false;
    }

    try {
      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }

      if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
      }

      if (typeof firebase.firestore === 'function') {
        db = firebase.firestore();
        // Enable offline persistence if available
        try {
          db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (_) {}
      }

      if (typeof firebase.analytics === 'function') {
        try {
          analytics = firebase.analytics();
          console.log('📊 Firebase Analytics connected: G-XTL33YTLR1');
        } catch (_) {}
      }

      isReady = true;
      console.log('🔥 Firebase successfully connected for project:', config.projectId);
      return true;
    } catch (err) {
      console.warn('⚠️ Firebase initialization notice (running with local resilience):', err);
      return false;
    }
  }

  // Auto-init immediately or wait for script load
  if (!initFirebase()) {
    window.addEventListener('load', initFirebase);
  }

  /* ── Public Service Object ──────────────────────────────────── */
  const FirebaseService = {
    get app() { return app; },
    get auth() { return auth; },
    get db() { return db; },
    get analytics() { return analytics; },
    isReady() {
      if (!isReady && typeof firebase !== 'undefined') initFirebase();
      return isReady && !!db;
    },

    // Log Analytics Event
    logEvent(eventName, params = {}) {
      try {
        if (analytics) analytics.logEvent(eventName, params);
      } catch (_) {}
    },

    // Save booking to Firestore collection 'bookings'
    async saveBooking(booking) {
      if (!this.isReady()) {
        console.log('ℹ️ Firebase offline mode: booking cached locally.');
        return booking;
      }
      try {
        const docId = booking.id || ('mcu-' + Date.now());
        const payload = {
          ...booking,
          id: docId,
          updatedAt: new Date().toISOString(),
          serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('bookings').doc(docId).set(payload, { merge: true });
        this.logEvent('booking_created', { package: booking.packageId, company: booking.companyName });
        console.log('✅ Booking synced to Firebase Firestore:', docId);
        return payload;
      } catch (err) {
        console.warn('Firestore saveBooking notice (saved to localStorage fallback):', err);
        return booking;
      }
    },

    // Real-time listener on bookings collection
    onBookingsChange(callback) {
      if (!this.isReady()) return () => {};
      try {
        return db.collection('bookings')
          .orderBy('createdAt', 'desc')
          .onSnapshot((snapshot) => {
            const bookings = [];
            snapshot.forEach((docSnap) => {
              bookings.push(docSnap.data());
            });
            callback(bookings);
          }, (err) => {
            console.warn('Firestore onSnapshot notice:', err);
          });
      } catch (err) {
        console.warn('Firestore onBookingsChange notice:', err);
        return () => {};
      }
    },

    // Update booking status in Firestore
    async updateBookingStatus(bookingId, newStatus, historyEntry) {
      if (!this.isReady()) return false;
      try {
        const updateData = {
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
        if (historyEntry) {
          updateData.lastHistory = historyEntry;
        }
        await db.collection('bookings').doc(bookingId).update(updateData);
        this.logEvent('booking_status_updated', { bookingId, newStatus });
        console.log('✅ Status updated in Firebase Firestore:', bookingId, '->', newStatus);
        return true;
      } catch (err) {
        console.warn('Firestore updateBookingStatus notice:', err);
        return false;
      }
    },

    // Seed batch mock bookings to Firestore
    async seedBookings(bookingsList) {
      if (!this.isReady()) return false;
      try {
        const batch = db.batch();
        bookingsList.forEach((b) => {
          const ref = db.collection('bookings').doc(b.id);
          batch.set(ref, { ...b, updatedAt: new Date().toISOString() }, { merge: true });
        });
        await batch.commit();
        console.log('✅ Seed bookings written to Firebase Firestore.');
        return true;
      } catch (err) {
        console.warn('Firestore seedBookings notice:', err);
        return false;
      }
    },

    // Clear all bookings in Firestore
    async clearAllBookings() {
      if (!this.isReady()) return false;
      try {
        const snap = await db.collection('bookings').get();
        const batch = db.batch();
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        console.log('✅ All bookings deleted from Firebase Firestore.');
        return true;
      } catch (err) {
        console.warn('Firestore clearAllBookings notice:', err);
        return false;
      }
    },

    // Google OAuth Login
    async loginWithGoogle() {
      if (!auth && typeof firebase !== 'undefined' && firebase.auth) {
        auth = firebase.auth();
      }
      if (!auth) {
        throw new Error('SDK Firebase Auth belum termuat. Periksa koneksi internet Anda.');
      }

      // Check for file:// protocol
      if (window.location.protocol === 'file:') {
        const err = new Error('PROTOCOL_FILE_LIMITATION');
        err.code = 'auth/operation-not-supported-in-this-environment';
        throw err;
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      const userProfile = {
        id: user.uid,
        name: user.displayName || 'Google Enterprise User',
        email: user.email,
        company: 'PT ' + (user.displayName ? user.displayName.split(' ')[0] : 'Klien') + ' Indonesia',
        phone: user.phoneNumber || '0812' + Math.floor(10000000 + Math.random() * 90000000),
        avatar: (user.displayName ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2) : 'GU').toUpperCase(),
        role: (user.email === 'admin@mricare.id' || user.email === 'admin@mcuplus.id') ? 'admin' : 'client',
        photoURL: user.photoURL || null,
        authProvider: 'google',
        createdAt: new Date().toISOString()
      };

      // Store in Firestore users collection
      if (db) {
        try {
          await db.collection('users').doc(user.uid).set(userProfile, { merge: true });
        } catch (_) {}
      }

      this.logEvent('login', { method: 'google' });
      return userProfile;
    },

    // Email & Password Login (Firebase Live + Instant Firestore Sync)
    async loginWithEmail(email, password) {
      if (!auth && typeof firebase !== 'undefined' && firebase.auth) auth = firebase.auth();
      if (!auth) throw new Error('Firebase Auth belum siap.');

      const res = await auth.signInWithEmailAndPassword(email, password);
      const user = res.user;

      let userProfile = null;
      if (db) {
        try {
          // Fast timeout race (1 second max) for Firestore fetch
          const docPromise = db.collection('users').doc(user.uid).get();
          const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1000));
          const doc = await Promise.race([docPromise, timeoutPromise]);
          if (doc && doc.exists) {
            userProfile = doc.data();
          }
        } catch (_) {}
      }

      if (!userProfile) {
        const namePart = user.displayName || email.split('@')[0];
        const role = (email.toLowerCase().includes('admin') || email === 'admin@mricare.id' || email === 'admin@mcuplus.id') ? 'admin' : 'klien';
        userProfile = {
          id: user.uid,
          name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          company: 'PT ' + (namePart.split(' ')[0] || 'Klien') + ' Indonesia',
          email: user.email,
          phone: user.phoneNumber || '0812' + Math.floor(10000000 + Math.random() * 90000000),
          role: role,
          avatar: (namePart.split(' ').map(w => w[0]).join('').slice(0, 2) || 'MC').toUpperCase(),
          authProvider: 'password',
          createdAt: new Date().toISOString()
        };
        if (db) {
          db.collection('users').doc(user.uid).set(userProfile, { merge: true }).catch(() => {});
        }
      }

      this.logEvent('login', { method: 'password' });
      return userProfile;
    },

    // Email & Password Registration (Instant Firebase Live Auth + Async Firestore Write)
    async registerWithEmail(email, password, profile = {}) {
      if (!auth && typeof firebase !== 'undefined' && firebase.auth) auth = firebase.auth();
      if (!auth) throw new Error('Firebase Auth belum siap.');

      const res = await auth.createUserWithEmailAndPassword(email, password);
      const user = res.user;

      if (profile.name && user.updateProfile) {
        user.updateProfile({ displayName: profile.name }).catch(() => {});
      }

      const role = (email.toLowerCase().includes('admin') || email === 'admin@mricare.id' || email === 'admin@mcuplus.id') ? 'admin' : 'klien';
      const initials = profile.name ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'MC';

      const userProfile = {
        id: user.uid,
        email: user.email,
        name: profile.name || email.split('@')[0],
        company: profile.company || 'PT Mitra Korporat',
        phone: profile.phone || '',
        avatar: initials,
        role: role,
        authProvider: 'password',
        createdAt: new Date().toISOString()
      };

      // Non-blocking background write to Cloud Firestore
      if (db) {
        db.collection('users').doc(user.uid).set(userProfile, { merge: true }).catch(err => {
          console.warn('Firestore user doc write notice:', err);
        });
      }

      this.logEvent('sign_up', { method: 'password', role });
      return userProfile;
    },

    // Send Password Reset Email
    async sendPasswordReset(email) {
      if (!auth && typeof firebase !== 'undefined' && firebase.auth) auth = firebase.auth();
      if (!auth) throw new Error('Firebase Auth belum siap.');
      return await auth.sendPasswordResetEmail(email);
    },

    // Logout
    async logout() {
      if (auth) {
        await auth.signOut();
      }
    }
  };

  window.FirebaseService = FirebaseService;
})();
