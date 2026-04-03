// ============================================================
// db.js — Firestore data layer
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { currentUser } from "./auth.js";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Deterministic record document ID: "{uid}_{YYYY-MM-DD}" */
function recordId(userId, date) {
  return `${userId}_${date}`;
}

/** Today as YYYY-MM-DD in local time */
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ──────────────────────────────────────────────────────────
// USER operations
// ──────────────────────────────────────────────────────────

/**
 * Get a single user profile by uid.
 */
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/**
 * List users visible to the current user:
 * - Director → all users
 * - Gerente  → users where gerenteId == myUid
 */
export async function listUsers() {
  const role = currentUser?.role;
  const uid  = currentUser?.uid;

  let q;
  if (role === "director") {
    q = query(collection(db, "users"), orderBy("name"));
  } else if (role === "gerente") {
    q = query(
      collection(db, "users"),
      where("gerenteId", "==", uid),
      orderBy("name")
    );
  } else {
    // AGA/ADA: only their own document
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? [{ uid: snap.id, ...snap.data() }] : [];
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Create or overwrite a user profile (used by createUser in auth.js).
 * Also callable directly for updates.
 */
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

/**
 * Update specific fields on a user profile.
 */
export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

/**
 * Delete a user profile document.
 * (Actual Auth deletion requires Admin SDK; this removes the Firestore record.)
 */
export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
}

/**
 * List all Gerentes (for the gerenteId selector when Director creates a user).
 */
export async function listGerentes() {
  const q = query(
    collection(db, "users"),
    where("role", "==", "gerente"),
    orderBy("name")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ──────────────────────────────────────────────────────────
// RECORD operations
// ──────────────────────────────────────────────────────────

/**
 * Save (upsert) a daily record.
 * @param {string} userId
 * @param {string} date   YYYY-MM-DD
 * @param {{ turno, metas, desempeno, notes }} data
 */
export async function saveRecord(userId, date, data) {
  const user = await getUser(userId);
  const id   = recordId(userId, date);

  await setDoc(
    doc(db, "records", id),
    {
      userId:    userId,
      gerenteId: user?.gerenteId ?? null,
      date:      date,
      turno:     data.turno     ?? "",
      metas:     Number(data.metas)     || 0,
      desempeno: Number(data.desempeno) || 0,
      notes:     data.notes     ?? "",
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid ?? "unknown",
    },
    { merge: true }
  );
}

/**
 * Fetch a single record for a user on a given date.
 * Returns null if not found.
 */
export async function getRecord(userId, date) {
  const snap = await getDoc(doc(db, "records", recordId(userId, date)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * List records for a given date, filtered by role:
 * - Director → all records for that date
 * - Gerente  → records where gerenteId == myUid for that date
 * - AGA/ADA  → only own record for that date
 *
 * Returns a Map<userId, record>
 */
export async function listRecordsForDate(date) {
  const role = currentUser?.role;
  const uid  = currentUser?.uid;

  let q;
  if (role === "director") {
    q = query(collection(db, "records"), where("date", "==", date));
  } else if (role === "gerente") {
    q = query(
      collection(db, "records"),
      where("gerenteId", "==", uid),
      where("date", "==", date)
    );
  } else {
    // AGA/ADA: own record only
    const snap = await getDoc(doc(db, "records", recordId(uid, date)));
    const map  = new Map();
    if (snap.exists()) map.set(uid, { id: snap.id, ...snap.data() });
    return map;
  }

  const snap = await getDocs(q);
  const map  = new Map();
  snap.docs.forEach(d => map.set(d.data().userId, { id: d.id, ...d.data() }));
  return map;
}

/**
 * Fetch the last N records for a single user (for history panel).
 */
export async function listRecentRecords(userId, n = 7) {
  const q = query(
    collection(db, "records"),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(n)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Delete a record document.
 */
export async function deleteRecord(userId, date) {
  await deleteDoc(doc(db, "records", recordId(userId, date)));
}
