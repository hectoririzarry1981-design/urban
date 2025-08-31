/* Verificador de Postres – Totales, KPIs, Vigencia y Alertas */
const APP_VERSION = 1;
const STORAGE_KEY = "postres_vigencia_v7";

const asInt = v => { const n = parseInt(v ?? 0, 10); return isNaN(n) ? 0 : n; };

const App = {
  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.setupInitialState();
      this.setupEventListeners();
      UI.updateView('reportes'); 
    });
    window.addEventListener("resize", UI.setStickyOffsets);
  },

  setupInitialState() {
    const initialData = POSTRES.map(n => ({ nombre: n }));
    const handleInputChange = (tr) => {
      this.calcRow(tr);
      this.refreshKPIs();
    };
    UI.renderTable(initialData, handleInputChange);
    this.refreshKPIs();
    const now = new Date();
    $("#fecha").value = now.toISOString().slice(0, 10);
    $("#hora").value = now.toTimeString().slice(0, 5);
    UI.setStickyOffsets();
  },

  setupEventListeners() {
    $("#btnExportCSV").addEventListener("click", () => this.exportCSV());
    $("#btnSaveLocal").addEventListener("click", () => this.saveLocal());
    $("#btnLoadLocal").addEventListener("click", () => this.loadLocal());
    $("#btnClear").addEventListener("click", () => this.clearAll());
    
    $$(".nav-pills .pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        const view = e.target.dataset.view;
        UI.updateView(view);
      });
    });

    this.wireNotifications();
  },

  parsePrepDateTime(row) {
    const f = $(`input[name="prepFecha"]`, row).value;
    const h = $(`input[name="prepHora"]`, row).value;
    if (!f || !h) return null;
    const [yy, mm, dd] = f.split("-").map(Number);
    const [HH, MM] = h.split(":").map(Number);
    return new Date(yy, mm - 1, dd, HH, MM, 0, 0);
  },

  calcRow(tr) {
    const get = (n) => asInt($(`input[name="${n}"]`, tr).value);
    const A = get("PM") + get("V") + get("E");
    const B = get("H") + get("S") - get("D");
    const d = A - B;
    const abs = Math.abs(d);

    let cuadre;
    if (abs === 0) {
      cuadre = { label: "Cuadre OK", status: "ok" };
    } else if (abs <= 2) {
      cuadre = { label: "Validar conteo", status: "warn" };
    } else {
      cuadre = { label: "Descuadre", status: "bad" };
    }

    const nombre = tr.querySelector("td").textContent.trim();
    const prep = this.parsePrepDateTime(tr);
    const vH = VIDA_HORAS[nombre] ?? 24;

    let vencimiento;
    if (prep) {
      const vence = new Date(prep.getTime() + vH * 3600 * 1000);
      const ms = vence - Date.now();
      let vigencia;
      if (ms <= 0) {
        vigencia = { label: "Expirado", status: "vig-bad" };
      } else if (ms <= 4 * 3600 * 1000) {
        vigencia = { label: "Por expirar", status: "vig-warn" };
      } else {
        vigencia = { label: "Vigente", status: "vig-ok" };
      }
      vencimiento = { vence, ms, vigencia };
    }

    const calcs = { A, B, d, cuadre, vencimiento };
    UI.updateRowUI(tr, calcs);
    return calcs;
  },

  collectData() {
    const out = [];
    $$("#tblPostres tbody tr").forEach((tr) => {
      const nombre = tr.querySelector("td").textContent.trim();
      const get = (n) => asInt($(`input[name="${n}"]`, tr).value);
      out.push({
        nombre,
        PM: get("PM"),
        V: get("V"),
        E: get("E"),
        H: get("H"),
        S: get("S"),
        D: get("D"),
        totalA: Number($(".totA", tr).textContent.replace(/\D/g, "")) || 0,
        totalB: Number($(".totB", tr).textContent.replace(/\D/g, "")) || 0,
        delta: Number($(".delta", tr).textContent.replace(/[^\-0-9]/g, "")) || 0,
        estado: $(".status", tr).textContent,
        prepFecha: $(`input[name="prepFecha"]`, tr).value || "",
        prepHora: $(`input[name="prepHora"]`, tr).value || "",
        vence: $(".vence", tr).textContent,
        restante: $(".resta", tr).textContent,
        vigencia: $(".vig-status", tr).textContent,
      });
    });
    return out;
  },

  refreshKPIs() {
    const rows = this.collectData();
    const A = rows.reduce((s, r) => s + (r.totalA || 0), 0);
    const B = rows.reduce((s, r) => s + (r.totalB || 0), 0);
    const D = A - B;
    const X = rows.filter((r) =>
      String(r.vigencia).toLowerCase().includes("expirado")
    ).length;
    UI.updateKPIsUI({ A, B, D, X });
  },

  exportCSV() {
    const meta = {
      gerencial: $("#gerencial").value || "",
      fecha: $("#fecha").value || "",
      hora: $("#hora").value || "",
    };
    const rows = this.collectData();
    const H = [
      "Postre", "PM", "V", "E", "Total A", "H", "S", "D", "Total B", 
      "Diferencia", "Estado", "Prep Fecha", "Prep Hora", "Vence", 
      "Restante", "Vigencia", "Gerencial", "Fecha Rev", "Hora Rev",
    ];
    const lines = [H.join(",")];
    rows.forEach((r) =>
      lines.push(
        [
          `"${r.nombre}"`,
          r.PM, r.V, r.E, r.totalA,
          r.H, r.S, r.D, r.totalB,
          r.delta, r.estado,
          `"${r.prepFecha}"`, `"${r.prepHora}"`, `"${r.vence}"`, 
          `"${r.restante}"`, `"${r.vigencia}"`, `"${meta.gerencial}"`, 
          `"${meta.fecha}"`, `"${meta.hora}"`,
        ].join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `verificador_postres_${meta.fecha || new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    UI.toast("CSV exportado.", "ok");
  },

  saveLocal() {
    const data = {
      version: APP_VERSION,
      meta: {
        gerencial: $("#gerencial").value,
        fecha: $("#fecha").value,
        hora: $("#hora").value,
      },
      filas: this.collectData(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    UI.toast("Datos guardados en el dispositivo.", "ok");
  },

  migrateData(data) {
    if (!data.version) {
      data.version = 1;
      data.meta = data.meta || {};
      data.filas = (data.filas || []).map((r) => ({
        nombre: r.nombre,
        PM: r.PM, V: r.V, E: r.E,
        H: r.H, S: r.S, D: r.D,
        prepFecha: r.prepFecha, prepHora: r.prepHora,
      }));
    }
    return data;
  },

  loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      UI.toast("No hay datos guardados.", "warn");
      return;
    }
    let data = JSON.parse(raw);
    if (data.version !== APP_VERSION) {
      data = this.migrateData(data);
    }
    $("#gerencial").value = data.meta.gerencial || "";
    $("#fecha").value = data.meta.fecha || "";
    $("#hora").value = data.meta.hora || "";
    const handleInputChange = (tr) => {
      this.calcRow(tr);
      this.refreshKPIs();
    };
    UI.renderTable(data.filas, handleInputChange);
    this.refreshKPIs();
    UI.toast("Datos cargados.", "ok");
  },

  NOTIFY_ENABLED: false,
  notifiedSet: new Set(),

  async ensureNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  },

  notifyExpired(nombre) {
    if (!this.NOTIFY_ENABLED) return;
    try {
      new Notification("Postre vencido", {
        body: `${nombre} ha expirado. Retirar de venta.`,
        icon: "icon-192.png",
      });
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    } catch {}
  },

  scanExpirados() {
    $$("#tblPostres tbody tr").forEach((tr) => {
      const nombre = tr.querySelector("td").textContent.trim();
      const status = $(".vig-status", tr)?.textContent?.toLowerCase() || "";
      const key = nombre + "|expired";
      if (status.includes("expirado")) {
        if (!this.notifiedSet.has(key)) {
          this.notifiedSet.add(key);
          this.notifyExpired(nombre);
          UI.toast(`Vencido: ${nombre}`, "err");
        }
      } else {
        this.notifiedSet.delete(key);
      }
    });
  },

  wireNotifications() {
    $("#btnNotify").addEventListener("click", async () => {
      const ok = await this.ensureNotificationPermission();
      this.NOTIFY_ENABLED = ok;
      UI.toast(ok ? "Alertas activadas." : "Permiso denegado para notificaciones.", ok ? "ok" : "warn");
    });
    setInterval(() => {
      $$("#tblPostres tbody tr").forEach((tr) => this.calcRow(tr));
      this.refreshKPIs();
      this.scanExpirados();
    }, 60 * 1000);
  },

  clearAll() {
    $("#gerencial").value = "";
    $("#fecha").value = "";
    $("#hora").value = "";
    const initialData = POSTRES.map(n => ({ nombre: n }));
    const handleInputChange = (tr) => {
        this.calcRow(tr);
        this.refreshKPIs();
    };
    UI.renderTable(initialData, handleInputChange);
    this.refreshKPIs();
    UI.toast("Tabla reiniciada.", "warn");
  },
};

App.init();
