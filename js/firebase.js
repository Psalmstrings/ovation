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
      const { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js");
      const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js");

      const app = initializeApp(FIREBASE_CONFIG);
      try { this.analytics = getAnalytics(app); } catch (e) { console.log("Analytics optional load"); }
      
      this.db = getFirestore(app);
      this.auth = getAuth(app);
      
      // Store modular helper references
      this.fs = { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot };
      this.authMethods = { signInWithEmailAndPassword, signOut, onAuthStateChanged };

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
        // Also save to local storage as double backup
        this.saveToLocalBackup(payload, docRef.id);
        return { success: true, id: docRef.id, mode: 'firestore' };
      } catch (error) {
        console.error("Firestore Save Error, storing to local storage:", error);
      }
    }

    // Local Storage Fallback
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
    // Fallback to initial local fetch
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

    // Always update local storage as well
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

  /* ===== AUTHENTICATION METHODS ===== */
  async loginAdmin(email, password) {
    await this.initPromise;
    
    // Master fallback passkey for admin dashboard access
    if (email === "admin@ovationmusic.com" && password === "ovation2026") {
      const sessionUser = { email: "admin@ovationmusic.com", role: "Super Admin", uid: "ADMIN_MASTER" };
      localStorage.setItem('ovation_admin_session', JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    }

    if (!this.useLocalStorage && this.auth) {
      try {
        const userCred = await this.authMethods.signInWithEmailAndPassword(this.auth, email, password);
        const user = { email: userCred.user.email, uid: userCred.user.uid, role: 'Admin' };
        localStorage.setItem('ovation_admin_session', JSON.stringify(user));
        return { success: true, user };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: "Invalid credentials. Use admin@ovationmusic.com / ovation2026 or set up Firebase Auth user." };
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
}

// Global Singleton Instance
window.OvationDB = new OvationDatabase();
