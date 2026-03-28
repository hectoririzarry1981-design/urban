// agenda-ui.js — Renderizado DOM, vistas e interacciones

'use strict';

const UI = (() => {
  // ── Helpers DOM ───────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  let notifTimer = null;

  function toast(msg, tipo = 'ok') {
    clearTimeout(notifTimer);
    let t = $('#toast');
    if (!t) {
      t = el('div', 'toast');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = `toast toast-${tipo} show`;
    notifTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── Pantalla de Login ─────────────────────────────────────────────────────
  function renderLogin() {
    const app = $('#app');
    app.innerHTML = '';
    app.className = 'screen-login';

    const wrap = el('div', 'login-wrap');

    // Logo / Header
    const header = el('div', 'login-header');
    header.innerHTML = `
      <div class="login-logo">📋</div>
      <h1 class="login-title">Agenda Diaria</h1>
      <p class="login-subtitle">Planes de Trabajo — Adiestramiento</p>
    `;
    wrap.appendChild(header);

    // Cards de roles
    const rolesWrap = el('div', 'login-roles');
    for (const [id, cfg] of Object.entries(AGENDA_CONFIG.roles)) {
      const card = el('button', 'role-card');
      card.dataset.rol = id;
      card.style.setProperty('--rol-accent', cfg.accentColor);
      card.innerHTML = `
        <span class="role-badge" style="background:${cfg.accentColor}22;color:${cfg.accentColor}">${cfg.nombre}</span>
        <span class="role-nombre-completo">${cfg.nombreCompleto}</span>
      `;
      card.addEventListener('click', () => _seleccionarRol(id));
      rolesWrap.appendChild(card);
    }
    wrap.appendChild(rolesWrap);

    // Panel de PIN (oculto hasta seleccionar rol)
    const pinPanel = el('div', 'pin-panel hidden');
    pinPanel.id = 'pin-panel';
    pinPanel.innerHTML = `
      <p class="pin-label">Ingresa tu PIN de 4 dígitos</p>
      <div class="pin-display" id="pin-display">
        <span class="pin-dot" data-idx="0"></span>
        <span class="pin-dot" data-idx="1"></span>
        <span class="pin-dot" data-idx="2"></span>
        <span class="pin-dot" data-idx="3"></span>
      </div>
      <p class="pin-error hidden" id="pin-error">PIN incorrecto. Intenta de nuevo.</p>
      <div class="pin-keypad" id="pin-keypad">
        ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
          <button class="pin-key ${k===''?'pin-key-empty':''}" data-key="${k}">${k}</button>
        `).join('')}
      </div>
      <button class="btn-link" id="btn-cambiar-rol">← Cambiar rol</button>
    `;
    wrap.appendChild(pinPanel);

    app.appendChild(wrap);

    // Eventos keypad
    $('#pin-keypad').addEventListener('click', e => {
      const key = e.target.closest('[data-key]');
      if (!key || key.dataset.key === '') return;
      _keypadPress(key.dataset.key);
    });

    $('#btn-cambiar-rol').addEventListener('click', () => {
      _resetPinPanel();
      document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
      $('#pin-panel').classList.add('hidden');
    });
  }

  let _pinActual = '';
  let _rolSeleccionado = null;

  function _seleccionarRol(id) {
    _rolSeleccionado = id;
    _pinActual = '';
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    const card = $(`.role-card[data-rol="${id}"]`);
    if (card) card.classList.add('selected');
    const panel = $('#pin-panel');
    panel.classList.remove('hidden');
    _actualizarPinDots();
    $('#pin-error').classList.add('hidden');
  }

  function _keypadPress(key) {
    if (key === '⌫') {
      _pinActual = _pinActual.slice(0, -1);
    } else if (_pinActual.length < 4) {
      _pinActual += key;
    }
    _actualizarPinDots();
    if (_pinActual.length === 4) {
      setTimeout(_intentarLogin, 200);
    }
  }

  function _actualizarPinDots() {
    document.querySelectorAll('.pin-dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < _pinActual.length);
    });
  }

  function _intentarLogin() {
    const resultado = App.login(_rolSeleccionado, _pinActual);
    if (resultado.ok) {
      renderDashboard();
    } else {
      $('#pin-error').classList.remove('hidden');
      _pinActual = '';
      _actualizarPinDots();
      const panel = $('#pin-panel');
      panel.classList.add('shake');
      setTimeout(() => panel.classList.remove('shake'), 500);
    }
  }

  function _resetPinPanel() {
    _pinActual = '';
    _rolSeleccionado = null;
    _actualizarPinDots();
  }

  // ── Dashboard Principal ───────────────────────────────────────────────────
  let _tabActiva = 'horario';

  function renderDashboard() {
    const sesion = App.getSesion();
    const rolCfg = AGENDA_CONFIG.roles[sesion.rolActivo];
    const rolVistaCfg = AGENDA_CONFIG.roles[sesion.rolVista];

    const app = $('#app');
    app.innerHTML = '';
    app.className = 'screen-dashboard';
    document.documentElement.style.setProperty('--accent', rolCfg.accentColor);

    // ── Header ──
    const header = el('header', 'dash-header');
    header.innerHTML = `
      <div class="dash-header-left">
        <span class="dash-logo">📋</span>
        <div>
          <div class="dash-title">Agenda Diaria</div>
          <div class="dash-rol" style="color:${rolCfg.accentColor}">${rolCfg.nombre} — ${rolCfg.nombreCompleto}</div>
        </div>
      </div>
      <div class="dash-header-right">
        <button class="icon-btn" id="btn-config" title="Configuración">⚙</button>
        <button class="icon-btn" id="btn-logout" title="Cerrar sesión">⏏</button>
      </div>
    `;
    app.appendChild(header);

    // ── Tabs de rol (solo GAD) ──
    if (sesion.rolActivo === 'gad') {
      const rolTabs = el('div', 'rol-tabs');
      for (const [id, cfg] of Object.entries(AGENDA_CONFIG.roles)) {
        const tab = el('button', `rol-tab ${sesion.rolVista === id ? 'active' : ''}`);
        tab.dataset.rolVista = id;
        tab.style.setProperty('--tab-color', cfg.accentColor);
        tab.innerHTML = `<span class="rol-tab-badge" style="background:${cfg.accentColor}22;color:${cfg.accentColor}">${cfg.nombre}</span>`;
        tab.addEventListener('click', () => {
          App.cambiarRolVista(id);
          renderDashboard();
        });
        rolTabs.appendChild(tab);
      }
      app.appendChild(rolTabs);
    }

    // ── Navegación de fechas ──
    const fechaBar = el('div', 'fecha-bar');
    fechaBar.innerHTML = `
      <button class="icon-btn fecha-nav" id="btn-fecha-ant" title="Día anterior">‹</button>
      <div class="fecha-center">
        <input type="date" id="fecha-picker" value="${sesion.fecha}" class="fecha-input">
        <div class="fecha-display" id="fecha-display">${App.formatFechaDisplay(sesion.fecha)}</div>
        ${sesion.fecha === App.hoyISO() ? '<span class="hoy-badge">HOY</span>' : ''}
      </div>
      <button class="icon-btn fecha-nav" id="btn-fecha-sig" title="Día siguiente">›</button>
    `;
    app.appendChild(fechaBar);

    // ── Barra de progreso del día ──
    const prog = App.progresoDia(sesion.rolVista, sesion.fecha);
    const progBar = el('div', 'progress-bar-wrap');
    progBar.innerHTML = `
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${prog.pct}%;background:${rolVistaCfg.accentColor}"></div>
      </div>
      <span class="progress-label">${prog.completados}/${prog.total} completados (${prog.pct}%)</span>
    `;
    app.appendChild(progBar);

    // ── Tabs de sección ──
    const seccTabs = el('div', 'secc-tabs');
    const tabs = [
      { id: 'horario', icon: '🕐', label: 'Horario' },
      { id: 'tareas', icon: '✅', label: 'Tareas' },
      { id: 'notas', icon: '📝', label: 'Notas' }
    ];
    tabs.forEach(t => {
      const btn = el('button', `secc-tab ${_tabActiva === t.id ? 'active' : ''}`);
      btn.dataset.tab = t.id;
      btn.innerHTML = `${t.icon} ${t.label}`;
      btn.addEventListener('click', () => {
        _tabActiva = t.id;
        renderDashboard();
      });
      seccTabs.appendChild(btn);
    });
    app.appendChild(seccTabs);

    // ── Contenido de la sección activa ──
    const content = el('div', 'secc-content');
    if (_tabActiva === 'horario') _renderHorario(content, sesion.rolVista, sesion.fecha, rolVistaCfg);
    if (_tabActiva === 'tareas') _renderTareas(content, sesion.rolVista, sesion.fecha, rolVistaCfg);
    if (_tabActiva === 'notas') _renderNotas(content, sesion.rolVista, sesion.fecha);
    app.appendChild(content);

    // ── Eventos globales ──
    $('#btn-logout').addEventListener('click', () => {
      App.logout();
      _tabActiva = 'horario';
      renderLogin();
    });

    $('#btn-config').addEventListener('click', () => _renderConfigPanel(rolCfg));

    $('#btn-fecha-ant').addEventListener('click', () => {
      App.cambiarFecha(App.fechaAnterior(App.getSesion().fecha));
      renderDashboard();
    });

    $('#btn-fecha-sig').addEventListener('click', () => {
      App.cambiarFecha(App.fechaSiguiente(App.getSesion().fecha));
      renderDashboard();
    });

    $('#fecha-picker').addEventListener('change', e => {
      App.cambiarFecha(e.target.value);
      renderDashboard();
    });
  }

  // ── Sección Horario ───────────────────────────────────────────────────────
  function _renderHorario(container, rol, fecha, rolCfg) {
    const agenda = App.getAgenda(rol, fecha);

    // Tarjeta de turno
    const turnoCard = el('div', 'card turno-card');
    turnoCard.innerHTML = `
      <h3 class="card-title">🕐 Turno del Día</h3>
      <div class="turno-grid">
        <label class="turno-field">
          <span>Entrada</span>
          <input type="time" id="turno-entrada" value="${agenda.turno.entrada}" class="time-input">
        </label>
        <label class="turno-field">
          <span>Salida</span>
          <input type="time" id="turno-salida" value="${agenda.turno.salida}" class="time-input">
        </label>
      </div>
    `;
    container.appendChild(turnoCard);

    // Duración del turno
    _calcDuracionTurno(turnoCard, agenda.turno.entrada, agenda.turno.salida);

    const saveTurno = () => {
      const entrada = $('#turno-entrada').value;
      const salida = $('#turno-salida').value;
      App.saveTurno(rol, fecha, entrada, salida);
      _calcDuracionTurno(turnoCard, entrada, salida);
      toast('Turno guardado');
    };
    $('#turno-entrada').addEventListener('change', saveTurno);
    $('#turno-salida').addEventListener('change', saveTurno);

    // Bloques de tiempo
    const bloquesCard = el('div', 'card bloques-card');
    bloquesCard.innerHTML = `<h3 class="card-title">📅 Plan de Actividades</h3>`;

    const bloquesList = el('div', 'bloques-list');
    bloquesList.id = 'bloques-list';
    _renderBloquesList(bloquesList, agenda.bloques, rol, fecha, rolCfg);
    bloquesCard.appendChild(bloquesList);

    // Formulario añadir bloque
    const addForm = el('div', 'add-bloque-form');
    addForm.innerHTML = `
      <input type="time" id="nuevo-bloque-hora" class="time-input" placeholder="Hora">
      <input type="text" id="nuevo-bloque-act" class="text-input" placeholder="Describe la actividad...">
      <button class="btn-add" id="btn-add-bloque" style="--accent:${rolCfg.accentColor}">+ Agregar</button>
    `;
    bloquesCard.appendChild(addForm);

    $('#btn-add-bloque').addEventListener('click', () => {
      const hora = $('#nuevo-bloque-hora').value;
      const act = $('#nuevo-bloque-act').value.trim();
      if (!act) { toast('Escribe una actividad', 'warn'); return; }
      App.addBloque(rol, fecha, hora, act);
      $('#nuevo-bloque-hora').value = '';
      $('#nuevo-bloque-act').value = '';
      _refreshBloquesList(rol, fecha, rolCfg);
      _refreshProgreso(rol, fecha, rolCfg.accentColor);
      toast('Actividad agregada');
    });

    // Enter en el campo de actividad también agrega
    $('#nuevo-bloque-act').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btn-add-bloque').click();
    });

    container.appendChild(bloquesCard);
  }

  function _calcDuracionTurno(card, entrada, salida) {
    let durEl = card.querySelector('.turno-duracion');
    if (!durEl) {
      durEl = el('div', 'turno-duracion');
      card.appendChild(durEl);
    }
    if (entrada && salida) {
      const [eh, em] = entrada.split(':').map(Number);
      const [sh, sm] = salida.split(':').map(Number);
      let mins = (sh * 60 + sm) - (eh * 60 + em);
      if (mins < 0) mins += 24 * 60;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      durEl.innerHTML = `<span class="turno-duracion-label">Duración:</span> <strong>${h}h ${m}m</strong>`;
    } else {
      durEl.textContent = '';
    }
  }

  function _renderBloquesList(container, bloques, rol, fecha, rolCfg) {
    container.innerHTML = '';
    if (bloques.length === 0) {
      container.innerHTML = '<p class="empty-msg">No hay actividades para este día. ¡Agrega la primera!</p>';
      return;
    }
    bloques.forEach(b => {
      const item = el('div', `bloque-item ${b.completado ? 'completado' : ''}`);
      item.dataset.id = b.id;
      item.innerHTML = `
        <button class="bloque-check" data-id="${b.id}" title="Marcar como completado" style="--chk-color:${rolCfg.accentColor}">
          ${b.completado ? '✓' : ''}
        </button>
        <span class="bloque-hora">${b.hora || '—'}</span>
        <span class="bloque-act">${_esc(b.actividad)}</span>
        <button class="bloque-del icon-btn" data-id="${b.id}" title="Eliminar">×</button>
      `;
      container.appendChild(item);
    });

    // Eventos
    container.querySelectorAll('.bloque-check').forEach(btn => {
      btn.addEventListener('click', () => {
        App.toggleBloque(rol, fecha, Number(btn.dataset.id));
        _refreshBloquesList(rol, fecha, rolCfg);
        _refreshProgreso(rol, fecha, rolCfg.accentColor);
      });
    });
    container.querySelectorAll('.bloque-del').forEach(btn => {
      btn.addEventListener('click', () => {
        App.deleteBloque(rol, fecha, Number(btn.dataset.id));
        _refreshBloquesList(rol, fecha, rolCfg);
        _refreshProgreso(rol, fecha, rolCfg.accentColor);
        toast('Actividad eliminada', 'warn');
      });
    });
  }

  function _refreshBloquesList(rol, fecha, rolCfg) {
    const agenda = App.getAgenda(rol, fecha);
    const list = $('#bloques-list');
    if (list) _renderBloquesList(list, agenda.bloques, rol, fecha, rolCfg);
  }

  // ── Sección Tareas ────────────────────────────────────────────────────────
  function _renderTareas(container, rol, fecha, rolCfg) {
    const agenda = App.getAgenda(rol, fecha);

    const card = el('div', 'card tareas-card');
    card.innerHTML = `<h3 class="card-title">✅ Tareas del Día</h3>`;

    const list = el('div', 'tareas-list');
    list.id = 'tareas-list';
    _renderTareasList(list, agenda.tareas, rol, fecha, rolCfg);
    card.appendChild(list);

    const addForm = el('div', 'add-tarea-form');
    addForm.innerHTML = `
      <input type="text" id="nueva-tarea-txt" class="text-input" placeholder="Nueva tarea...">
      <button class="btn-add" id="btn-add-tarea" style="--accent:${rolCfg.accentColor}">+ Agregar</button>
    `;
    card.appendChild(addForm);

    $('#btn-add-tarea', card) || card.querySelector('#btn-add-tarea');
    container.appendChild(card);

    container.querySelector('#btn-add-tarea').addEventListener('click', () => {
      const txt = container.querySelector('#nueva-tarea-txt').value.trim();
      if (!txt) { toast('Escribe una tarea', 'warn'); return; }
      App.addTarea(rol, fecha, txt);
      container.querySelector('#nueva-tarea-txt').value = '';
      _refreshTareasList(container, rol, fecha, rolCfg);
      _refreshProgreso(rol, fecha, rolCfg.accentColor);
      toast('Tarea agregada');
    });

    container.querySelector('#nueva-tarea-txt').addEventListener('keydown', e => {
      if (e.key === 'Enter') container.querySelector('#btn-add-tarea').click();
    });
  }

  function _renderTareasList(container, tareas, rol, fecha, rolCfg) {
    container.innerHTML = '';
    if (tareas.length === 0) {
      container.innerHTML = '<p class="empty-msg">No hay tareas para este día. ¡Agrega la primera!</p>';
      return;
    }
    tareas.forEach(t => {
      const item = el('div', `tarea-item ${t.completada ? 'completada' : ''}`);
      item.dataset.id = t.id;
      item.innerHTML = `
        <div class="tarea-main">
          <button class="tarea-check" data-id="${t.id}" style="--chk-color:${rolCfg.accentColor}" title="Completar">
            ${t.completada ? '✓' : ''}
          </button>
          <span class="tarea-txt">${_esc(t.texto)}</span>
          <button class="tarea-del icon-btn" data-id="${t.id}" title="Eliminar">×</button>
        </div>
        <div class="tarea-nota-wrap">
          <textarea class="tarea-nota" data-id="${t.id}" placeholder="Añadir nota u observación...">${_esc(t.nota)}</textarea>
        </div>
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.tarea-check').forEach(btn => {
      btn.addEventListener('click', () => {
        App.toggleTarea(rol, fecha, Number(btn.dataset.id));
        _refreshTareasList(container, rol, fecha, rolCfg);
        _refreshProgreso(rol, fecha, rolCfg.accentColor);
      });
    });

    container.querySelectorAll('.tarea-del').forEach(btn => {
      btn.addEventListener('click', () => {
        App.deleteTarea(rol, fecha, Number(btn.dataset.id));
        _refreshTareasList(container, rol, fecha, rolCfg);
        _refreshProgreso(rol, fecha, rolCfg.accentColor);
        toast('Tarea eliminada', 'warn');
      });
    });

    // Auto-guardar notas
    container.querySelectorAll('.tarea-nota').forEach(ta => {
      let timer;
      ta.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          App.updateTarea(rol, fecha, Number(ta.dataset.id), { nota: ta.value });
          toast('Nota guardada');
        }, 1000);
      });
    });
  }

  function _refreshTareasList(container, rol, fecha, rolCfg) {
    const agenda = App.getAgenda(rol, fecha);
    const list = container.querySelector('#tareas-list');
    if (list) _renderTareasList(list, agenda.tareas, rol, fecha, rolCfg);
  }

  // ── Sección Notas ─────────────────────────────────────────────────────────
  function _renderNotas(container, rol, fecha) {
    const agenda = App.getAgenda(rol, fecha);
    const card = el('div', 'card notas-card');
    card.innerHTML = `
      <h3 class="card-title">📝 Notas del Día</h3>
      <textarea id="notas-textarea" class="notas-textarea" placeholder="Escribe observaciones, recordatorios o cualquier nota del día...">${_esc(agenda.notas)}</textarea>
      <div class="notas-footer">
        <span class="notas-status" id="notas-status"></span>
      </div>
    `;
    container.appendChild(card);

    let timer;
    container.querySelector('#notas-textarea').addEventListener('input', e => {
      clearTimeout(timer);
      const statusEl = container.querySelector('#notas-status');
      statusEl.textContent = 'Guardando...';
      timer = setTimeout(() => {
        App.saveNotas(rol, fecha, e.target.value);
        statusEl.textContent = 'Guardado ✓';
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
      }, 800);
    });
  }

  // ── Panel de Configuración (cambiar PIN) ──────────────────────────────────
  function _renderConfigPanel(rolCfg) {
    const overlay = el('div', 'modal-overlay');
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">⚙ Configuración</h3>
        <p class="modal-subtitle">Cambiar PIN — ${rolCfg.nombre}</p>
        <label class="modal-field">
          PIN actual
          <input type="password" id="pin-actual" class="text-input" maxlength="4" inputmode="numeric">
        </label>
        <label class="modal-field">
          Nuevo PIN (4 dígitos)
          <input type="password" id="pin-nuevo" class="text-input" maxlength="4" inputmode="numeric">
        </label>
        <label class="modal-field">
          Confirmar nuevo PIN
          <input type="password" id="pin-confirm" class="text-input" maxlength="4" inputmode="numeric">
        </label>
        <p class="modal-error hidden" id="modal-error"></p>
        <div class="modal-actions">
          <button class="btn-secondary" id="btn-modal-cancel">Cancelar</button>
          <button class="btn-primary" id="btn-modal-save" style="--accent:${rolCfg.accentColor}">Guardar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#btn-modal-save').addEventListener('click', () => {
      const actual = overlay.querySelector('#pin-actual').value;
      const nuevo = overlay.querySelector('#pin-nuevo').value;
      const confirm = overlay.querySelector('#pin-confirm').value;
      const errEl = overlay.querySelector('#modal-error');

      if (nuevo !== confirm) {
        errEl.textContent = 'Los PINs nuevos no coinciden.';
        errEl.classList.remove('hidden');
        return;
      }
      const sesion = App.getSesion();
      const resultado = App.cambiarPin(sesion.rolActivo, actual, nuevo);
      if (!resultado.ok) {
        errEl.textContent = resultado.error;
        errEl.classList.remove('hidden');
        return;
      }
      overlay.remove();
      toast('PIN actualizado correctamente');
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _refreshProgreso(rol, fecha, accentColor) {
    const prog = App.progresoDia(rol, fecha);
    const fill = document.querySelector('.progress-bar-fill');
    const label = document.querySelector('.progress-label');
    if (fill) fill.style.width = `${prog.pct}%`;
    if (label) label.textContent = `${prog.completados}/${prog.total} completados (${prog.pct}%)`;
  }

  function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { renderLogin, renderDashboard, toast };
})();

// ── Inicialización ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  UI.renderLogin();
});
