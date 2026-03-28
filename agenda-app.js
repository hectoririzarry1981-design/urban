// agenda-app.js — Lógica de negocio: login, CRUD de agendas, LocalStorage

'use strict';

const App = (() => {
  // ── Estado de sesión ──────────────────────────────────────────────────────
  let sesion = {
    rolActivo: null,    // rol del usuario autenticado ('gad', 'aga', 'ada')
    rolVista: null,     // rol cuya agenda se está viendo (solo GAD puede cambiar)
    fecha: hoyISO()
  };

  // ── Utilidades ────────────────────────────────────────────────────────────
  function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function uid() {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  // ── LocalStorage ──────────────────────────────────────────────────────────
  function cargarDatos() {
    try {
      const raw = localStorage.getItem(AGENDA_CONFIG.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return _datosIniciales();
  }

  function guardarDatos(datos) {
    localStorage.setItem(AGENDA_CONFIG.storageKey, JSON.stringify(datos));
  }

  function _datosIniciales() {
    const roles = {};
    for (const [id, cfg] of Object.entries(AGENDA_CONFIG.roles)) {
      roles[id] = { pin: cfg.pin, nombre: cfg.nombre, agendas: {} };
    }
    return { version: 1, roles };
  }

  // ── Agenda CRUD ───────────────────────────────────────────────────────────
  function getAgenda(rol, fecha) {
    const datos = cargarDatos();
    const agendas = datos.roles[rol]?.agendas || {};
    return agendas[fecha] ? JSON.parse(JSON.stringify(agendas[fecha])) : AGENDA_CONFIG.agendaVacia();
  }

  function _setAgenda(rol, fecha, agenda) {
    const datos = cargarDatos();
    if (!datos.roles[rol]) return;
    datos.roles[rol].agendas[fecha] = agenda;
    guardarDatos(datos);
  }

  function tieneDatos(rol, fecha) {
    const datos = cargarDatos();
    const a = datos.roles[rol]?.agendas?.[fecha];
    if (!a) return false;
    return !!(
      a.turno?.entrada || a.turno?.salida ||
      (a.bloques && a.bloques.length > 0) ||
      (a.tareas && a.tareas.length > 0) ||
      a.notas
    );
  }

  // ── Turno ─────────────────────────────────────────────────────────────────
  function saveTurno(rol, fecha, entrada, salida) {
    const agenda = getAgenda(rol, fecha);
    agenda.turno = { entrada, salida };
    _setAgenda(rol, fecha, agenda);
  }

  // ── Bloques de tiempo ─────────────────────────────────────────────────────
  function addBloque(rol, fecha, hora, actividad) {
    const agenda = getAgenda(rol, fecha);
    agenda.bloques.push({ id: uid(), hora, actividad, completado: false });
    agenda.bloques.sort((a, b) => a.hora.localeCompare(b.hora));
    _setAgenda(rol, fecha, agenda);
    return agenda;
  }

  function updateBloque(rol, fecha, id, campos) {
    const agenda = getAgenda(rol, fecha);
    const idx = agenda.bloques.findIndex(b => b.id === id);
    if (idx === -1) return agenda;
    agenda.bloques[idx] = { ...agenda.bloques[idx], ...campos };
    if (campos.hora !== undefined) {
      agenda.bloques.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    _setAgenda(rol, fecha, agenda);
    return agenda;
  }

  function toggleBloque(rol, fecha, id) {
    const agenda = getAgenda(rol, fecha);
    const bloque = agenda.bloques.find(b => b.id === id);
    if (bloque) bloque.completado = !bloque.completado;
    _setAgenda(rol, fecha, agenda);
    return bloque;
  }

  function deleteBloque(rol, fecha, id) {
    const agenda = getAgenda(rol, fecha);
    agenda.bloques = agenda.bloques.filter(b => b.id !== id);
    _setAgenda(rol, fecha, agenda);
  }

  // ── Tareas ────────────────────────────────────────────────────────────────
  function addTarea(rol, fecha, texto) {
    const agenda = getAgenda(rol, fecha);
    agenda.tareas.push({ id: uid(), texto, completada: false, nota: '' });
    _setAgenda(rol, fecha, agenda);
    return agenda;
  }

  function updateTarea(rol, fecha, id, campos) {
    const agenda = getAgenda(rol, fecha);
    const idx = agenda.tareas.findIndex(t => t.id === id);
    if (idx === -1) return agenda;
    agenda.tareas[idx] = { ...agenda.tareas[idx], ...campos };
    _setAgenda(rol, fecha, agenda);
    return agenda;
  }

  function toggleTarea(rol, fecha, id) {
    const agenda = getAgenda(rol, fecha);
    const tarea = agenda.tareas.find(t => t.id === id);
    if (tarea) tarea.completada = !tarea.completada;
    _setAgenda(rol, fecha, agenda);
    return tarea;
  }

  function deleteTarea(rol, fecha, id) {
    const agenda = getAgenda(rol, fecha);
    agenda.tareas = agenda.tareas.filter(t => t.id !== id);
    _setAgenda(rol, fecha, agenda);
  }

  // ── Notas ─────────────────────────────────────────────────────────────────
  function saveNotas(rol, fecha, texto) {
    const agenda = getAgenda(rol, fecha);
    agenda.notas = texto;
    _setAgenda(rol, fecha, agenda);
  }

  // ── Login / Logout ────────────────────────────────────────────────────────
  function login(rolId, pin) {
    const datos = cargarDatos();
    const rolData = datos.roles[rolId];
    if (!rolData) return { ok: false, error: 'Rol no encontrado' };
    if (rolData.pin !== pin) return { ok: false, error: 'PIN incorrecto' };
    sesion.rolActivo = rolId;
    sesion.rolVista = rolId;
    sesion.fecha = hoyISO();
    return { ok: true };
  }

  function logout() {
    sesion.rolActivo = null;
    sesion.rolVista = null;
    sesion.fecha = hoyISO();
  }

  function cambiarRolVista(rolId) {
    if (sesion.rolActivo !== 'gad') return;
    sesion.rolVista = rolId;
  }

  function cambiarFecha(fecha) {
    sesion.fecha = fecha;
  }

  function getSesion() {
    return { ...sesion };
  }

  // ── Cambiar PIN ───────────────────────────────────────────────────────────
  function cambiarPin(rolId, pinActual, pinNuevo) {
    const datos = cargarDatos();
    if (!datos.roles[rolId]) return { ok: false, error: 'Rol no encontrado' };
    if (datos.roles[rolId].pin !== pinActual) return { ok: false, error: 'PIN actual incorrecto' };
    if (pinNuevo.length !== 4 || !/^\d{4}$/.test(pinNuevo)) return { ok: false, error: 'El nuevo PIN debe tener 4 dígitos' };
    datos.roles[rolId].pin = pinNuevo;
    guardarDatos(datos);
    return { ok: true };
  }

  // ── Fechas navigation helpers ─────────────────────────────────────────────
  function fechaAnterior(fechaISO) {
    const d = new Date(fechaISO + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function fechaSiguiente(fechaISO) {
    const d = new Date(fechaISO + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function formatFechaDisplay(fechaISO) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── Progreso del día ──────────────────────────────────────────────────────
  function progresoDia(rol, fecha) {
    const agenda = getAgenda(rol, fecha);
    const totalBloques = agenda.bloques.length;
    const completadosBloques = agenda.bloques.filter(b => b.completado).length;
    const totalTareas = agenda.tareas.length;
    const completadasTareas = agenda.tareas.filter(t => t.completada).length;
    const total = totalBloques + totalTareas;
    const completados = completadosBloques + completadasTareas;
    return { total, completados, pct: total > 0 ? Math.round((completados / total) * 100) : 0 };
  }

  return {
    login, logout, getSesion, cambiarRolVista, cambiarFecha, cambiarPin,
    getAgenda, tieneDatos,
    saveTurno,
    addBloque, updateBloque, toggleBloque, deleteBloque,
    addTarea, updateTarea, toggleTarea, deleteTarea,
    saveNotas,
    fechaAnterior, fechaSiguiente, formatFechaDisplay,
    progresoDia,
    hoyISO
  };
})();
