const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const UI = {
  fmtDateTime(dt) {
    if (!dt) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(
      dt.getDate()
    )} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
  },

  fmtDur(ms) {
    if (ms == null) return "—";
    const neg = ms < 0;
    ms = Math.abs(ms);
    const m = Math.floor(ms / 60000),
      d = Math.floor(m / 1440),
      h = Math.floor((m - d * 1440) / 60),
      mi = m % 60;
    return (neg ? "-" : "") + (d ? `${d}d ` : "") + `${h}h ${mi}m`;
  },

  toast(msg, type = "ok", ms = 2600) {
    const host = $("#toasts");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 180);
    }, ms);
  },

  setStickyOffsets() {
    const hdr = document.querySelector(".app-header");
    const top = (hdr?.offsetHeight || 0) + 8;
    document.documentElement.style.setProperty("--theadTop", top + "px");
  },

  renderTable(data, onInputChange) {
    const tb = $("#tblPostres tbody");
    tb.innerHTML = "";
    data.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="sticky">${it.nombre}</td>
        <td class="col-inventario"><input type="number" inputmode="numeric" placeholder="0" name="PM" value="${it.PM ?? ""}"></td>
        <td class="col-inventario"><input type="number" inputmode="numeric" placeholder="0" name="V" value="${it.V ?? ""}"></td>
        <td class="col-inventario"><input type="number" inputmode="numeric" placeholder="0" name="E" value="${it.E ?? ""}"></td>
        <td class="col-inventario totA sep-left">0</td>
        <td class="col-inventario sep-left"><input type="number" inputmode="numeric" placeholder="0" name="H" value="${it.H ?? ""}"></td>
        <td class="col-inventario"><input type="number" inputmode="numeric" placeholder="0" name="S" value="${it.S ?? ""}"></td>
        <td class="col-inventario"><input type="number" inputmode="numeric" placeholder="0" name="D" value="${it.D ?? ""}"></td>
        <td class="col-inventario totB sep-left">0</td>
        <td class="col-inventario delta">0</td>
        <td class="col-inventario status">—</td>
        <td class="col-vigencia sep-left"><input type="date" name="prepFecha" value="${it.prepFecha ?? ""}"></td>
        <td class="col-vigencia"><input type="time" name="prepHora" value="${it.prepHora ?? ""}"></td>
        <td class="col-vigencia vence">—</td>
        <td class="col-vigencia resta">—</td>
        <td class="col-vigencia vig-status">Sin datos</td>`;
      $$("input", tr).forEach((inp) => {
        const handler = () => onInputChange(tr);
        inp.addEventListener("input", handler);
        inp.addEventListener("change", handler);
      });
      tb.appendChild(tr);
      onInputChange(tr);
    });
  },

  updateRowUI(tr, calcs) {
    $(".totA", tr).innerHTML = `<span class="badge">${calcs.A}</span>`;
    $(".totB", tr).innerHTML = `<span class="badge">${calcs.B}</span>`;
    $(".delta", tr).innerHTML = `<span class="badge ${calcs.d >= 0 ? 'delta-pos' : 'delta-neg'} ">${calcs.d}</span>`;

    const st = $(".status", tr);
    st.className = "status col-inventario"; // reset class
    st.textContent = calcs.cuadre.label;
    st.classList.add(calcs.cuadre.status);

    const venceEl = $(".vence", tr), restEl = $(".resta", tr), vigEl = $(".vig-status", tr);
    vigEl.className = "vig-status col-vigencia"; // reset class

    if (!calcs.vencimiento) {
      venceEl.textContent = "—";
      restEl.textContent = "—";
      vigEl.textContent = "Sin datos";
      return;
    }

    venceEl.textContent = this.fmtDateTime(calcs.vencimiento.vence);
    restEl.textContent = this.fmtDur(calcs.vencimiento.ms);
    vigEl.textContent = calcs.vencimiento.vigencia.label;
    vigEl.classList.add(calcs.vencimiento.vigencia.status);
  },

  updateKPIsUI(kpis) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("kpiA", kpis.A);
    set("kpiB", kpis.B);
    set("kpiDelta", kpis.D);
    set("kpiExp", kpis.X);
  },

  updateView(view) {
    const appDiv = $(".app");
    // Remove all view-related classes
    appDiv.classList.remove("view-reportes", "view-inventario", "view-vigencia");
    // Add the selected view class
    if (view !== 'reportes') { // 'reportes' is the default, showing all
        appDiv.classList.add(`view-${view}`);
    }

    // Update active pill
    $$(".nav-pills .pill").forEach(pill => {
      pill.classList.toggle("active", pill.dataset.view === view);
    });
  }
};
