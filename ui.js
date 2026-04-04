// ============================================================
// ui.js — Pure rendering / DOM helpers
// ============================================================

// ──────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

/** Show/hide the full-screen loader */
export function showLoader()  { $("loader-overlay").classList.add("visible"); }
export function hideLoader()  { $("loader-overlay").classList.remove("visible"); }

/**
 * Show a toast notification.
 * @param {string} msg
 * @param {"ok"|"error"|"warn"|"info"} type
 */
export function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/** Format YYYY-MM-DD → "DD/MM/YYYY" for display */
export function fmtDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

/** Role label in Spanish */
const ROLE_LABELS = {
  director: "Director",
  gerente:  "Gerente",
  aga:      "A.G.A",
  ada:      "A.D.A",
};

/** Build a role badge element */
function roleBadge(role) {
  const span = document.createElement("span");
  span.className = `role-badge ${role}`;
  span.textContent = ROLE_LABELS[role] ?? role;
  return span;
}

/** Build a turno chip element */
function turnoChip(turno) {
  const map = { "Mañana": "manana", "Tarde": "tarde", "Noche": "noche" };
  const span = document.createElement("span");
  span.className = `turno-chip ${map[turno] ?? ""}`;
  span.textContent = turno || "—";
  return span;
}

// ──────────────────────────────────────────────────────────
// Header rendering
// ──────────────────────────────────────────────────────────

/**
 * Render nav pills and user info in the header.
 */
export function renderHeader(user, activeView, onNav) {
  const navEl = $("main-nav");
  navEl.innerHTML = "";

  const pills = [{ key: "dashboard", label: "Dashboard" }];
  if (user.role === "director" || user.role === "gerente") {
    pills.push({ key: "users", label: "Usuarios" });
  }

  pills.forEach(({ key, label }) => {
    const btn = document.createElement("button");
    btn.className = `nav-pill${activeView === key ? " active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", () => onNav(key));
    navEl.appendChild(btn);
  });

  const infoEl = $("user-info");
  infoEl.innerHTML = "";
  const nameEl = document.createElement("span");
  nameEl.className = "user-name";
  nameEl.textContent = user.name;
  infoEl.appendChild(nameEl);
  infoEl.appendChild(roleBadge(user.role));
}

// ──────────────────────────────────────────────────────────
// Dashboard — Director / Gerente (table view)
// ──────────────────────────────────────────────────────────

/**
 * Render the team dashboard table.
 */
export function renderTeamDashboard(users, recordsMap, date, onEdit, onDateChange) {
  const main = $("main-content");
  main.innerHTML = "";

  // Date navigator
  const dateNav = document.createElement("div");
  dateNav.className = "date-nav";
  dateNav.innerHTML = `
    <span class="date-nav-label">Fecha:</span>
    <input type="date" id="date-picker" value="${date}" />
  `;
  main.appendChild(dateNav);

  dateNav.querySelector("#date-picker").addEventListener("change", e => {
    onDateChange(e.target.value);
  });

  if (users.length === 0) {
    main.appendChild(_emptyState("No hay usuarios en tu equipo aún.", "👥"));
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";

  const table = document.createElement("table");
  table.className = "data-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Rol</th>
        <th>Turno</th>
        <th>Metas</th>
        <th>Desempeño</th>
        <th>Notas</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="team-tbody"></tbody>
  `;
  wrapper.appendChild(table);
  main.appendChild(wrapper);

  const tbody = table.querySelector("#team-tbody");

  users.forEach(user => {
    const rec = recordsMap.get(user.uid);
    const tr  = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = user.name;

    const roleTd = document.createElement("td");
    roleTd.appendChild(roleBadge(user.role));

    const turnoTd = document.createElement("td");
    if (rec && rec.turno) {
      turnoTd.appendChild(turnoChip(rec.turno));
    } else {
      turnoTd.className = "no-record";
      turnoTd.textContent = "—";
    }

    const metasTd = document.createElement("td");
    metasTd.textContent = rec ? rec.metas : "—";
    if (!rec) metasTd.className = "no-record";

    const desemTd = document.createElement("td");
    desemTd.textContent = rec ? rec.desempeno : "—";
    if (!rec) desemTd.className = "no-record";

    const notesTd = document.createElement("td");
    notesTd.className = "text-muted text-small";
    notesTd.textContent = rec && rec.notes ? rec.notes : "—";

    const actionTd = document.createElement("td");
    const editBtn  = document.createElement("button");
    editBtn.className   = "btn-icon";
    editBtn.title       = "Editar registro";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => onEdit(user.uid, date));
    actionTd.appendChild(editBtn);

    tr.append(nameTd, roleTd, turnoTd, metasTd, desemTd, notesTd, actionTd);
    tbody.appendChild(tr);
  });
}

// ──────────────────────────────────────────────────────────
// Dashboard — AGA / ADA (personal card view)
// ──────────────────────────────────────────────────────────

/**
 * Render the personal record panel for AGA / ADA.
 */
export function renderMyDashboard(user, todayRecord, history, onEdit) {
  const main = $("main-content");
  main.innerHTML = "";

  const today = new Date().toISOString().slice(0, 10);
  const panel = document.createElement("div");
  panel.className = "my-record-panel";

  // Today's card
  const todayCard = document.createElement("div");
  todayCard.className = "record-today-card";
  todayCard.innerHTML = `<h2>Mi registro de hoy — ${fmtDate(today)}</h2>`;

  const kpis = document.createElement("div");
  kpis.className = "record-kpis";

  [
    { label: "Turno",     value: todayRecord ? todayRecord.turno     : null, isText: true },
    { label: "Metas",     value: todayRecord ? todayRecord.metas     : null },
    { label: "Desempeño", value: todayRecord ? todayRecord.desempeno : null },
  ].forEach(({ label, value, isText }) => {
    const item = document.createElement("div");
    item.className = "kpi-item";
    item.innerHTML = `<div class="kpi-label">${label}</div>`;
    const val = document.createElement("div");
    const hasValue = value !== null && value !== undefined && value !== "";
    if (hasValue) {
      val.className = "kpi-value";
      if (isText) val.appendChild(turnoChip(value));
      else val.textContent = value;
    } else {
      val.className = "kpi-value no-data";
      val.textContent = "Sin registro";
    }
    item.appendChild(val);
    kpis.appendChild(item);
  });

  todayCard.appendChild(kpis);

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-primary";
  editBtn.textContent = todayRecord ? "✏️ Editar registro de hoy" : "➕ Registrar hoy";
  editBtn.addEventListener("click", () => onEdit(user.uid, today));
  todayCard.appendChild(editBtn);
  panel.appendChild(todayCard);

  // History table
  if (history.length > 0) {
    const histCard = document.createElement("div");
    histCard.className = "history-card";
    histCard.innerHTML = `<h2>Historial reciente</h2>`;

    const histTable = document.createElement("table");
    histTable.className = "history-table";
    histTable.innerHTML = `
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Turno</th>
          <th>Metas</th>
          <th>Desempeño</th>
          <th>Notas</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = histTable.querySelector("tbody");
    history.forEach(rec => {
      const tr = document.createElement("tr");

      const turnoTd = document.createElement("td");
      turnoTd.appendChild(turnoChip(rec.turno));

      const editBtn2 = document.createElement("button");
      editBtn2.className   = "btn-icon";
      editBtn2.textContent = "✏️";
      editBtn2.addEventListener("click", () => onEdit(user.uid, rec.date));
      const btnTd = document.createElement("td");
      btnTd.appendChild(editBtn2);

      const dateTd = document.createElement("td");
      dateTd.textContent = fmtDate(rec.date);
      const metasTd = document.createElement("td");
      metasTd.textContent = rec.metas;
      const desemTd = document.createElement("td");
      desemTd.textContent = rec.desempeno;
      const notesTd = document.createElement("td");
      notesTd.className = "text-muted text-small";
      notesTd.textContent = rec.notes || "—";

      tr.append(dateTd, turnoTd, metasTd, desemTd, notesTd, btnTd);
      tbody.appendChild(tr);
    });

    histCard.appendChild(histTable);
    panel.appendChild(histCard);
  }

  main.appendChild(panel);
}

// ──────────────────────────────────────────────────────────
// Record Form
// ──────────────────────────────────────────────────────────

/**
 * Render the record entry/edit form.
 */
export function renderRecordForm(targetUser, date, existing, onSubmit, onCancel) {
  const main = $("main-content");
  main.innerHTML = "";

  const card = document.createElement("div");
  card.className = "record-form-card";
  card.innerHTML = `
    <h2>Registro — ${targetUser.name} · ${fmtDate(date)}</h2>
    <form id="record-form">
      <div class="form-grid">
        <div class="form-group">
          <label for="rf-date">Fecha</label>
          <input type="date" id="rf-date" value="${date}" required />
        </div>
        <div class="form-group">
          <label for="rf-turno">Turno</label>
          <select id="rf-turno" required>
            <option value="">— Seleccionar —</option>
            <option value="Mañana"${existing && existing.turno === "Mañana" ? " selected" : ""}>Mañana</option>
            <option value="Tarde"${existing && existing.turno === "Tarde"   ? " selected" : ""}>Tarde</option>
            <option value="Noche"${existing && existing.turno === "Noche"   ? " selected" : ""}>Noche</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rf-metas">Metas</label>
          <input type="number" id="rf-metas" min="0" value="${existing ? existing.metas : ""}" placeholder="0" />
        </div>
        <div class="form-group">
          <label for="rf-desempeno">Desempeño</label>
          <input type="number" id="rf-desempeno" min="0" value="${existing ? existing.desempeno : ""}" placeholder="0" />
        </div>
      </div>
      <div class="form-group">
        <label for="rf-notes">Notas (opcional)</label>
        <textarea id="rf-notes" placeholder="Observaciones...">${existing ? existing.notes || "" : ""}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Guardar</button>
        <button type="button" id="btn-cancel-record" class="btn btn-secondary">Cancelar</button>
      </div>
      <p id="record-error" class="error-msg"></p>
    </form>
  `;

  main.appendChild(card);

  card.querySelector("#record-form").addEventListener("submit", e => {
    e.preventDefault();
    const turno = card.querySelector("#rf-turno").value;
    if (!turno) {
      card.querySelector("#record-error").textContent = "Selecciona un turno.";
      return;
    }
    card.querySelector("#record-error").textContent = "";
    onSubmit({
      date:      card.querySelector("#rf-date").value,
      turno,
      metas:     card.querySelector("#rf-metas").value,
      desempeno: card.querySelector("#rf-desempeno").value,
      notes:     card.querySelector("#rf-notes").value.trim(),
    });
  });

  card.querySelector("#btn-cancel-record").addEventListener("click", onCancel);
}

// ──────────────────────────────────────────────────────────
// Users Panel
// ──────────────────────────────────────────────────────────

/**
 * Render the user management panel.
 */
export function renderUsersPanel(users, currentUser, gerentes, onAddUser, onDeleteUser) {
  const main = $("main-content");
  main.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "users-panel";

  // Header
  const hdr = document.createElement("div");
  hdr.className = "panel-header";
  const hdrTitle = document.createElement("h2");
  hdrTitle.textContent = "Usuarios";
  const addBtn = document.createElement("button");
  addBtn.className   = "btn btn-primary";
  addBtn.textContent = "+ Agregar usuario";
  hdr.append(hdrTitle, addBtn);
  panel.appendChild(hdr);

  // Add-user form panel (hidden by default)
  const addPanel = document.createElement("div");
  addPanel.className = "add-user-panel";
  addPanel.id        = "add-user-panel";

  const roleOptions    = _buildRoleOptions(currentUser.role);
  const gerenteOptions = gerentes.map(g =>
    `<option value="${g.uid}">${g.name}</option>`
  ).join("");

  addPanel.innerHTML = `
    <h3>Nuevo usuario</h3>
    <form id="form-add-user">
      <div class="form-grid">
        <div class="form-group">
          <label>Nombre completo</label>
          <input type="text" id="au-name" required placeholder="Juan Pérez" />
        </div>
        <div class="form-group">
          <label>Correo electrónico</label>
          <input type="email" id="au-email" required placeholder="juan@correo.com" />
        </div>
        <div class="form-group">
          <label>Contraseña temporal</label>
          <input type="password" id="au-password" required minlength="6" placeholder="mín. 6 caracteres" />
        </div>
        <div class="form-group">
          <label>Rol</label>
          <select id="au-role" required>${roleOptions}</select>
        </div>
        ${currentUser.role === "director" ? `
        <div class="form-group" id="au-gerente-group">
          <label>Gerente asignado (para A.G.A / A.D.A)</label>
          <select id="au-gerente">
            <option value="">— Ninguno —</option>
            ${gerenteOptions}
          </select>
        </div>` : ""}
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Crear usuario</button>
        <button type="button" id="btn-cancel-add" class="btn btn-secondary">Cancelar</button>
      </div>
      <p id="add-user-error" class="error-msg"></p>
    </form>
  `;
  panel.appendChild(addPanel);

  // Toggle form
  addBtn.addEventListener("click", () => addPanel.classList.toggle("open"));
  addPanel.querySelector("#btn-cancel-add").addEventListener("click", () => {
    addPanel.classList.remove("open");
  });

  // Show/hide gerente selector based on role
  const roleSelect    = addPanel.querySelector("#au-role");
  const gerenteGroup  = addPanel.querySelector("#au-gerente-group");
  if (gerenteGroup) {
    const toggle = () => {
      gerenteGroup.style.display = ["aga", "ada"].includes(roleSelect.value) ? "block" : "none";
    };
    toggle();
    roleSelect.addEventListener("change", toggle);
  }

  // Submit add-user
  addPanel.querySelector("#form-add-user").addEventListener("submit", async e => {
    e.preventDefault();
    const errEl   = addPanel.querySelector("#add-user-error");
    const submitBtn = addPanel.querySelector("[type=submit]");
    errEl.textContent = "";

    const data = {
      name:      addPanel.querySelector("#au-name").value.trim(),
      email:     addPanel.querySelector("#au-email").value.trim(),
      password:  addPanel.querySelector("#au-password").value,
      role:      addPanel.querySelector("#au-role").value,
      gerenteId: addPanel.querySelector("#au-gerente") ? addPanel.querySelector("#au-gerente").value || null : null,
    };

    if (!data.name || !data.email || !data.password || !data.role) {
      errEl.textContent = "Completa todos los campos requeridos.";
      return;
    }

    if (currentUser.role === "gerente" && ["aga", "ada"].includes(data.role)) {
      data.gerenteId = currentUser.uid;
    }

    try {
      submitBtn.disabled = true;
      await onAddUser(data);
      addPanel.classList.remove("open");
      addPanel.querySelector("#form-add-user").reset();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Users table
  if (users.length === 0) {
    panel.appendChild(_emptyState("No hay usuarios aún.", "👤"));
    main.appendChild(panel);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";

  const table = document.createElement("table");
  table.className = "data-table";

  const showGerenteCol = currentUser.role === "director";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Correo</th>
        <th>Rol</th>
        ${showGerenteCol ? "<th></th>" : ""}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  users
    .filter(u => u.uid !== currentUser.uid)
    .forEach(user => {
      const tr = document.createElement("tr");

      const nameTd = document.createElement("td");
      nameTd.textContent = user.name;

      const emailTd = document.createElement("td");
      emailTd.className = "text-muted text-small";
      emailTd.textContent = user.email;

      const roleTd = document.createElement("td");
      roleTd.appendChild(roleBadge(user.role));

      tr.append(nameTd, emailTd, roleTd);

      if (showGerenteCol) {
        const actionTd = document.createElement("td");
        const delBtn   = document.createElement("button");
        delBtn.className   = "btn-icon";
        delBtn.title       = "Eliminar usuario";
        delBtn.textContent = "🗑️";
        delBtn.addEventListener("click", () => {
          if (confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) {
            onDeleteUser(user.uid);
          }
        });
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });

  wrapper.appendChild(table);
  panel.appendChild(wrapper);
  main.appendChild(panel);
}

// ──────────────────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────────────────

function _emptyState(msg, icon = "📭") {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `<div class="empty-icon">${icon}</div><p>${msg}</p>`;
  return div;
}

function _buildRoleOptions(creatorRole) {
  const all = [
    { value: "gerente", label: "Gerente" },
    { value: "aga",     label: "A.G.A — Asistente de Gerente en Adiestramiento" },
    { value: "ada",     label: "A.D.A — Asistente de Adiestramiento" },
  ];
  const allowed = creatorRole === "director"
    ? all
    : all.filter(r => r.value !== "gerente");

  return `<option value="">— Seleccionar rol —</option>` +
    allowed.map(r => `<option value="${r.value}">${r.label}</option>`).join("");
}
