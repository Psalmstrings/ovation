/* ==========================================================================
   OVATION MUSIC HOUSE — FIREBASE ENGINE & AUTHENTICATION HANDLER
   Connected to Firebase Project: ovation-music
   Supports Firebase Auth, Firestore real-time sync, and Local Storage fallback.
   ========================================================================== */

// Exact Firebase Web App Configuration provided by User
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDKff566j8q6vtr-BDP2y9E_eODPaPZUEI",
  authDomain: "ovation-music.firebaseapp.com",
  projectId: "ovation-music",
  storageBucket: "ovation-music.firebasestorage.app",
  messagingSenderId: "131269710319",
  appId: "1:131269710319:web:f196a75c9a699a7028661a",
  measurementId: "G-B3QTCMC0F5"
};

class OvationDatabase {
  constructor() {
    this.db = null;
    this.auth = null;
    this.analytics = null;
    this.useLocalStorage = true;
    this.initPromise = this.initFirebase();
  }

  async initFirebase() {
    try {
      // Dynamically import Firebase v12 SDK modules
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js");
      const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js");
      const { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js");
      const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js");

      const app = initializeApp(FIREBASE_CONFIG);
      try { this.analytics = getAnalytics(app); } catch (e) { console.log("Analytics optional load"); }
      
      this.db = getFirestore(app);
      this.auth = getAuth(app);
      
      // Store modular helper references
      this.fs = { collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot };
      this.authMethods = { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile };

      this.useLocalStorage = false;
      console.log("🔥 Connected to Firebase Project: ovation-music successfully.");
    } catch (err) {
      console.warn("⚠️ Firebase live connection initialization notice. Using resilient LocalStorage fallback:", err);
      this.useLocalStorage = true;
    }
  }

  /**
   * Save a new enquiry from Contact or Booking forms
   */
  async saveEnquiry(enquiryData) {
    await this.initPromise;
    const payload = {
      ...enquiryData,
      timestamp: new Date().toISOString(),
      status: enquiryData.status || 'pending'
    };

    if (!this.useLocalStorage && this.db) {
      try {
        const colRef = this.fs.collection(this.db, 'enquiries');
        const docRef = await this.fs.addDoc(colRef, payload);
        this.saveToLocalBackup(payload, docRef.id);
        return { success: true, id: docRef.id, mode: 'firestore' };
      } catch (error) {
        console.error("Firestore Save Error, storing to local storage:", error);
      }
    }

    const id = 'LOCAL_' + Date.now();
    payload.id = id;
    this.saveToLocalBackup(payload, id);
    return { success: true, id: id, mode: 'local' };
  }

  saveToLocalBackup(payload, id) {
    const existing = JSON.parse(localStorage.getItem('ovation_enquiries') || '[]');
    const item = { ...payload, id };
    existing.unshift(item);
    localStorage.setItem('ovation_enquiries', JSON.stringify(existing));
  }

  /**
   * Fetch all customer enquiries
   */
  async getEnquiries() {
    await this.initPromise;
    if (!this.useLocalStorage && this.db) {
      try {
        const q = this.fs.query(this.fs.collection(this.db, 'enquiries'), this.fs.orderBy('timestamp', 'desc'));
        const snapshot = await this.fs.getDocs(q);
        const data = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
        if (data.length > 0) return data;
      } catch (error) {
        console.warn("Firestore Fetch Notice, reading local cache:", error);
      }
    }
    return JSON.parse(localStorage.getItem('ovation_enquiries') || '[]');
  }

  /**
   * Subscribe to realtime enquiries stream
   */
  async subscribeEnquiries(callback) {
    await this.initPromise;
    if (!this.useLocalStorage && this.db) {
      try {
        const q = this.fs.query(this.fs.collection(this.db, 'enquiries'), this.fs.orderBy('timestamp', 'desc'));
        return this.fs.onSnapshot(q, (snapshot) => {
          const data = [];
          snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
          callback(data);
        });
      } catch (err) {
        console.warn("Snapshot subscription fallback:", err);
      }
    }
    callback(await this.getEnquiries());
    return () => {};
  }

  /**
   * Update Status of an enquiry (pending -> contacted -> completed)
   */
  async updateStatus(id, newStatus) {
    await this.initPromise;
    if (!this.useLocalStorage && this.db && !id.startsWith('LOCAL_')) {
      try {
        const docRef = this.fs.doc(this.db, 'enquiries', id);
        await this.fs.updateDoc(docRef, { status: newStatus });
      } catch (err) {
        console.error("Firestore status update error:", err);
      }
    }

    const existing = JSON.parse(localStorage.getItem('ovation_enquiries') || '[]');
    const index = existing.findIndex(item => item.id === id);
    if (index !== -1) {
      existing[index].status = newStatus;
      localStorage.setItem('ovation_enquiries', JSON.stringify(existing));
    }
    return { success: true };
  }

  /**
   * Delete an enquiry
   */
  async deleteEnquiry(id) {
    await this.initPromise;
    if (!this.useLocalStorage && this.db && !id.startsWith('LOCAL_')) {
      try {
        const docRef = this.fs.doc(this.db, 'enquiries', id);
        await this.fs.deleteDoc(docRef);
      } catch (err) {
        console.error("Firestore delete error:", err);
      }
    }

    const existing = JSON.parse(localStorage.getItem('ovation_enquiries') || '[]');
    const filtered = existing.filter(item => item.id !== id);
    localStorage.setItem('ovation_enquiries', JSON.stringify(filtered));
    return { success: true };
  }

  /* ===== AUTHENTICATION & USER PROFILE METHODS ===== */

  /**
   * Create a new user account in Firebase Auth & store user profile in Firestore
   */
  async signUpUser({ fullName, email, password, role = 'Admin' }) {
    await this.initPromise;

    if (!this.useLocalStorage && this.auth && this.db) {
      try {
        // 1. Create account in Firebase Auth
        const userCred = await this.authMethods.createUserWithEmailAndPassword(this.auth, email, password);
        const user = userCred.user;

        // 2. Set Display Name in Firebase Auth profile
        try {
          await this.authMethods.updateProfile(user, { displayName: fullName });
        } catch (e) {
          console.log("Auth profile update notice:", e);
        }

        // 3. Save User Profile Document in Firestore 'users' collection
        const userProfile = {
          uid: user.uid,
          fullName,
          email,
          role,
          createdAt: new Date().toISOString()
        };

        const userDocRef = this.fs.doc(this.db, 'users', user.uid);
        await this.fs.setDoc(userDocRef, userProfile);

        // Save session locally
        localStorage.setItem('ovation_admin_session', JSON.stringify(userProfile));

        return { success: true, user: userProfile, mode: 'firebase' };
      } catch (err) {
        console.error("Firebase SignUp Error:", err);
        return { success: false, error: err.message };
      }
    }

    // Local Storage Fallback Mode
    const localUsers = JSON.parse(localStorage.getItem('ovation_users') || '[]');
    if (localUsers.find(u => u.email === email)) {
      return { success: false, error: "An account with this email already exists locally." };
    }

    const userProfile = {
      uid: 'LOCAL_USER_' + Date.now(),
      fullName,
      email,
      role,
      password,
      createdAt: new Date().toISOString()
    };

    localUsers.push(userProfile);
    localStorage.setItem('ovation_users', JSON.stringify(localUsers));
    localStorage.setItem('ovation_admin_session', JSON.stringify(userProfile));

    return { success: true, user: userProfile, mode: 'local' };
  }

  /**
   * Sign In User via Firebase Auth and RETRIEVE User Profile Data from Firebase Firestore
   */
  async loginUser(email, password) {
    await this.initPromise;
    
    // Master Admin Passkey Fallback
    if (email === "admin@ovationmusic.com" && password === "Admin@Ovation") {
      const sessionUser = { 
        fullName: "Ovation Super Admin", 
        email: "admin@ovationmusichouse.com", 
        role: "Super Admin", 
        uid: "ADMIN_MASTER" 
      };
      localStorage.setItem('ovation_admin_session', JSON.stringify(sessionUser));
      return { success: true, user: sessionUser, source: 'master' };
    }

    if (!this.useLocalStorage && this.auth && this.db) {
      try {
        // 1. Authenticate with Firebase Auth
        const userCred = await this.authMethods.signInWithEmailAndPassword(this.auth, email, password);
        const uid = userCred.user.uid;

        // 2. Retrieve User Data from Firestore 'users' collection
        let userProfile = null;
        try {
          const userDocRef = this.fs.doc(this.db, 'users', uid);
          const docSnap = await this.fs.getDoc(userDocRef);
          
          if (docSnap.exists()) {
            userProfile = docSnap.data();
          } else {
            // Fallback profile if user document doesn't exist yet
            userProfile = {
              uid: uid,
              fullName: userCred.user.displayName || email.split('@')[0],
              email: email,
              role: 'Admin',
              createdAt: new Date().toISOString()
            };
            // Create the doc for future reads
            await this.fs.setDoc(userDocRef, userProfile);
          }
        } catch (e) {
          console.warn("Firestore user profile fetch notice:", e);
          userProfile = {
            uid: uid,
            fullName: userCred.user.displayName || email,
            email: email,
            role: 'Admin'
          };
        }

        // Store active session profile locally
        localStorage.setItem('ovation_admin_session', JSON.stringify(userProfile));
        return { success: true, user: userProfile, source: 'firestore' };
      } catch (err) {
        console.error("Firebase Login Error:", err);
        return { success: false, error: err.message };
      }
    }

    // Local Storage Fallback check
    const localUsers = JSON.parse(localStorage.getItem('ovation_users') || '[]');
    const foundUser = localUsers.find(u => u.email === email && u.password === password);
    if (foundUser) {
      localStorage.setItem('ovation_admin_session', JSON.stringify(foundUser));
      return { success: true, user: foundUser, source: 'local' };
    }

    return { success: false, error: "Invalid login credentials. Please check your email and password." };
  }

  /**
   * Alias for backward compatibility
   */
  async loginAdmin(email, password) {
    return this.loginUser(email, password);
  }

  logoutAdmin() {
    localStorage.removeItem('ovation_admin_session');
    if (this.auth && this.authMethods) {
      try { this.authMethods.signOut(this.auth); } catch (e) {}
    }
  }

  getAdminSession() {
    const session = localStorage.getItem('ovation_admin_session');
    return session ? JSON.parse(session) : null;
  }

  /* ===== BOOKING METHODS ===== */

  /**
   * Save a new music class booking to Firestore 'bookings' collection
   */
  async saveBooking(bookingData) {
    await this.initPromise;
    const payload = {
      ...bookingData,
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };

    if (!this.useLocalStorage && this.db) {
      try {
        const colRef = this.fs.collection(this.db, 'bookings');
        const docRef = await this.fs.addDoc(colRef, payload);
        this.saveBookingToLocalBackup(payload, docRef.id);
        return { success: true, id: docRef.id, mode: 'firestore' };
      } catch (error) {
        console.error('Firestore Booking Save Error:', error);
        throw error;
      }
    }

    // LocalStorage fallback
    const id = 'LOCAL_BKG_' + Date.now();
    payload.id = id;
    this.saveBookingToLocalBackup(payload, id);
    return { success: true, id: id, mode: 'local' };
  }

  saveBookingToLocalBackup(payload, id) {
    const existing = JSON.parse(localStorage.getItem('ovation_bookings') || '[]');
    const item = { ...payload, id };
    existing.unshift(item);
    localStorage.setItem('ovation_bookings', JSON.stringify(existing));
  }

  /**
   * Fetch all bookings (for admin dashboard)
   */
  async getBookings() {
    await this.initPromise;
    if (!this.useLocalStorage && this.db) {
      try {
        const q = this.fs.query(
          this.fs.collection(this.db, 'bookings'),
          this.fs.orderBy('createdAt', 'desc')
        );
        const snapshot = await this.fs.getDocs(q);
        const data = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
        if (data.length > 0) return data;
      } catch (error) {
        console.warn('Firestore Bookings Fetch Notice, reading local cache:', error);
      }
    }
    return JSON.parse(localStorage.getItem('ovation_bookings') || '[]');
  }

  /**
   * Subscribe to real-time bookings stream (for admin dashboard)
   */
  async subscribeBookings(callback) {
    await this.initPromise;
    if (!this.useLocalStorage && this.db) {
      try {
        const q = this.fs.query(
          this.fs.collection(this.db, 'bookings'),
          this.fs.orderBy('createdAt', 'desc')
        );
        return this.fs.onSnapshot(q, (snapshot) => {
          const data = [];
          snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
          callback(data);
        });
      } catch (err) {
        console.warn('Bookings snapshot subscription fallback:', err);
      }
    }
    callback(await this.getBookings());
    return () => {};
  }

  /**
   * Update booking status (Pending -> Confirmed -> Cancelled -> Completed)
   */
  async updateBookingStatus(id, newStatus) {
    await this.initPromise;
    if (!this.useLocalStorage && this.db && !id.startsWith('LOCAL_')) {
      try {
        const docRef = this.fs.doc(this.db, 'bookings', id);
        await this.fs.updateDoc(docRef, { status: newStatus });
      } catch (err) {
        console.error('Firestore booking status update error:', err);
      }
    }
    const existing = JSON.parse(localStorage.getItem('ovation_bookings') || '[]');
    const index = existing.findIndex(item => item.id === id);
    if (index !== -1) {
      existing[index].status = newStatus;
      localStorage.setItem('ovation_bookings', JSON.stringify(existing));
    }
    return { success: true };
  }
}

// Global Singleton Instance
window.OvationDB = new OvationDatabase();
