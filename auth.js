// ============================================================
// auth.js — Authentication layer
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
  deleteApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db, firebaseConfig } from "./firebase-config.js";

/**
 * Cached current user profile.
 * Shape: { uid, name, email, role, gerenteId }
 */
export let currentUser = null;

/**
 * Initialize auth state listener.
 * @param {Function} onReady  - called with currentUser when signed in
 * @param {Function} onLogout - called when signed out
 */
export function initAuth(onReady, onLogout) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      currentUser = null;
      onLogout();
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!snap.exists()) {
        // User exists in Auth but not in Firestore — sign them out
        await signOut(auth);
        onLogout();
        return;
      }

      const data = snap.data();
      currentUser = {
        uid:       firebaseUser.uid,
        email:     firebaseUser.email,
        name:      data.name      || firebaseUser.email,
        role:      data.role      || "ada",
        gerenteId: data.gerenteId || null,
      };

      onReady(currentUser);
    } catch (err) {
      console.error("Error loading user profile:", err);
      onLogout();
    }
  });
}

/**
 * Sign in with email + password.
 * @returns {Promise<void>}
 */
export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out current user.
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Create a new user WITHOUT signing out the current session.
 * Uses a secondary Firebase app instance as the standard client-side workaround.
 *
 * @param {string} email
 * @param {string} password
 * @param {{ name: string, role: string, gerenteId: string|null }} profile
 * @returns {Promise<string>} uid of the newly created user
 */
export async function createUser(email, password, profile) {
  // Spin up a temporary secondary app so we don't displace the current session
  const secondaryApp  = initializeApp(firebaseConfig, `secondary_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  let newUid;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    newUid = cred.user.uid;

    // Sign out the secondary app immediately — we only needed the UID
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }

  // Write the Firestore profile under the new UID
  await setDoc(doc(db, "users", newUid), {
    name:       profile.name,
    email:      email,
    role:       profile.role,
    gerenteId:  profile.gerenteId ?? null,
    createdAt:  serverTimestamp(),
    createdBy:  currentUser?.uid ?? "unknown",
  });

  return newUid;
}
