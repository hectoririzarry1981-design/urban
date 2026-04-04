// ============================================================
// app.js — Main orchestrator / router
// ============================================================

import { initAuth, login, logout, createUser, currentUser as getUser } from "./auth.js";
import {
  listUsers,
  listGerentes,
  listRecordsForDate,
  listRecentRecords,
  getRecord,
  saveRecord,
  deleteUserProfile,
  todayStr,
} from "./db.js";
import {
  showLoader,
  hideLoader,
  toast,
  renderHeader,
  renderTeamDashboard,
  renderMyDashboard,
  renderRecordForm,
  renderUsersPanel,
} from "./ui.js";

// ── App state ────────────────────────────────────────────
const State = {
  view:         "login",   // "login" | "dashboard" | "users" | "record"
  selectedDate: todayStr(),
  editTarget:   null,      // { userId, date } when editing a record
};

// ── Bootstrap ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initAuth(onUserReady, onLoggedOut);

  // Login form
  document.getElementById("form-login").addEventListener("submit", async e => {
    e.preventDefault();
    const errEl = document.getElementById("login-error");
    errEl.textContent = "";
    const email    = document.getElementById("input-email").value.trim();
    const password = document.getElementById("input-password").value;
    const btn      = document.getElementById("btn-login");
    btn.disabled   = true;
    btn.textContent = "Entrando…";
    try {
      await login(email, password);
      // onUserReady fires automatically via onAuthStateChanged
    } catch (err) {
      errEl.textContent = _friendlyAuthError(err.code);
      btn.disabled  = false;
      btn.textContent = "Iniciar sesión";
    }
  });

  // Logout button
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await logout();
  });
});

// ── Auth callbacks ─────────────────────────────────────────
function onUserReady(user) {
  setView("dashboard");
  navigate("dashboard");
}

function onLoggedOut() {
  setView("login");
  document.getElementById("main-content").innerHTML = "";
  document.getElementById("main-nav").innerHTML = "";
  document.getElementById("user-info").innerHTML = "";
  // Reset login form
  const form = document.getElementById("form-login");
  if (form) form.reset();
  const btn = document.getElementById("btn-login");
  if (btn) { btn.disabled = false; btn.textContent = "Iniciar sesión"; }
}

// ── View switching ─────────────────────────────────────────
function setView(view) {
  State.view = view;
  document.body.dataset.view = view === "login" ? "login" : "dashboard";
}

// ── Router ─────────────────────────────────────────────────
async function navigate(view, params = {}) {
  // Get current user from module (re-read each time since auth.js exports a let)
  const user = _currentUser();
  if (!user) return;

  setView(view);

  // Always re-render the header so nav pills reflect active view
  renderHeader(user, view, navigate);

  if (view === "dashboard") {
    await loadDashboard(user);
  } else if (view === "users") {
    await loadUsers(user);
  } else if (view === "record") {
    await loadRecordForm(user, params.userId, params.date);
  }
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard(user) {
  showLoader();
  try {
    if (user.role === "director" || user.role === "gerente") {
      const [users, recordsMap] = await Promise.all([
        listUsers(),
        listRecordsForDate(State.selectedDate),
      ]);
      renderTeamDashboard(
        users,
        recordsMap,
        State.selectedDate,
        (userId, date) => navigate("record", { userId, date }),
        (newDate) => {
          State.selectedDate = newDate;
          loadDashboard(user);
        }
      );
    } else {
      // AGA / ADA — personal view
      const today = todayStr();
      const [todayRecord, history] = await Promise.all([
        getRecord(user.uid, today),
        listRecentRecords(user.uid, 7),
      ]);
      renderMyDashboard(
        user,
        todayRecord,
        history,
        (userId, date) => navigate("record", { userId, date })
      );
    }
  } catch (err) {
    console.error(err);
    toast("Error cargando datos: " + err.message, "error");
  } finally {
    hideLoader();
  }
}

// ── Users ──────────────────────────────────────────────────
async function loadUsers(user) {
  if (user.role !== "director" && user.role !== "gerente") {
    navigate("dashboard");
    return;
  }
  showLoader();
  try {
    const [users, gerentes] = await Promise.all([
      listUsers(),
      user.role === "director" ? listGerentes() : Promise.resolve([]),
    ]);
    renderUsersPanel(
      users,
      user,
      gerentes,
      onAddUser,
      onDeleteUser
    );
  } catch (err) {
    console.error(err);
    toast("Error cargando usuarios: " + err.message, "error");
  } finally {
    hideLoader();
  }
}

// ── Record Form ────────────────────────────────────────────
async function loadRecordForm(currentUserObj, userId, date) {
  showLoader();
  try {
    // Determine whose record we're editing
    // AGA/ADA can only edit their own
    const targetUid = (currentUserObj.role === "aga" || currentUserObj.role === "ada")
      ? currentUserObj.uid
      : (userId || currentUserObj.uid);

    // Fetch the target user's profile for display name
    const allUsers  = await listUsers();
    const targetUser = allUsers.find(u => u.uid === targetUid) || currentUserObj;

    const existing = await getRecord(targetUid, date);

    renderRecordForm(
      targetUser,
      date,
      existing,
      async (formData) => {
        showLoader();
        try {
          await saveRecord(targetUid, formData.date, formData);
          toast("Registro guardado", "ok");
          // If date changed, update selectedDate
          State.selectedDate = formData.date;
          navigate("dashboard");
        } catch (err) {
          console.error(err);
          toast("Error guardando: " + err.message, "error");
        } finally {
          hideLoader();
        }
      },
      () => navigate("dashboard")
    );
  } catch (err) {
    console.error(err);
    toast("Error cargando registro: " + err.message, "error");
  } finally {
    hideLoader();
  }
}

// ── User management handlers ───────────────────────────────
async function onAddUser(data) {
  showLoader();
  try {
    await createUser(data.email, data.password, {
      name:      data.name,
      role:      data.role,
      gerenteId: data.gerenteId || null,
    });
    toast(`Usuario ${data.name} creado`, "ok");
    // Reload users panel
    const user = _currentUser();
    await loadUsers(user);
  } catch (err) {
    console.error(err);
    toast("Error creando usuario: " + err.message, "error");
    throw err; // re-throw so the form can display it inline
  } finally {
    hideLoader();
  }
}

async function onDeleteUser(uid) {
  showLoader();
  try {
    await deleteUserProfile(uid);
    toast("Usuario eliminado", "ok");
    const user = _currentUser();
    await loadUsers(user);
  } catch (err) {
    console.error(err);
    toast("Error eliminando usuario: " + err.message, "error");
  } finally {
    hideLoader();
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Re-read currentUser from auth.js each time.
 * (The exported `let` updates in place when auth state changes.)
 */
function _currentUser() {
  // auth.js exports `currentUser` as a named export (let).
  // We imported it as `getUser` alias — but since ES modules are live bindings,
  // we can just re-import. However, since we imported it at the top as a
  // snapshot, we re-export via a getter in auth.js.
  // Simplest workaround: expose via window during dev, or use the import alias.
  // `getUser` is the live binding from `import { currentUser as getUser }`.
  return getUser;
}

function _friendlyAuthError(code) {
  const map = {
    "auth/invalid-email":        "El correo electrónico no es válido.",
    "auth/user-not-found":       "No existe un usuario con ese correo.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/invalid-credential":   "Correo o contraseña incorrectos.",
    "auth/too-many-requests":    "Demasiados intentos. Espera un momento.",
    "auth/network-request-failed": "Error de conexión. Verifica tu internet.",
  };
  return map[code] || "Error al iniciar sesión. Intenta de nuevo.";
}
