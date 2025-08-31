/* Verificador de Postres – Totales, KPIs, Vigencia y Alertas */
const STORAGE_KEY = "postres_vigencia_v7";
const VIDA_HORAS = {"Quesitos":24,"Maíz":24,"Zanahoria":24,"Red Velvet":24,"ChocoChip":24,"Cinnamon Roll":96,"Lf Coffee Cake":48};
const POSTRES = ["Maíz","Zanahoria","Red Velvet","Lf Coffee Cake","Quesitos","Cinnamon Roll","ChocoChip","Meso Kids","Catering Galletas","Catering Quesitos","Catering Mixtos"];
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const asInt = v => { const n = parseInt(v ?? 0, 10); return isNaN(n) ? 0 : n; };
function vidaHorasPorNombre(n){ return VIDA_HORAS[n] ?? 24; }
function fmtDateTime(dt){ if(!dt) return "—"; const p=n=>String(n).padStart(2,"0"); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`; }
function fmtDur(ms){ if(ms==null) return "—"; const neg=ms<0; ms=Math.abs(ms); const m=Math.floor(ms/60000), d=Math.floor(m/1440), h=Math.floor((m-d*1440)/60), mi=m%60; return (neg?"-":"")+(d?`${d}d `:"")+`${h}h ${mi}m`; }
function parsePrepDateTime(row){ const f=$(`input[name="prepFecha"]`,row).value, h=$(`input[name="prepHora"]`,row).value; if(!f||!h) return null; const [yy,mm,dd]=f.split("-").map(Number), [HH,MM]=h.split(":").map(Number); return new Date(yy,mm-1,dd,HH,MM,0,0); }
function toast(msg,type="ok",ms=2600){ const host=$("#toasts"); if(!host) return; const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=msg; host.appendChild(el); setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; setTimeout(()=>el.remove(),180); }, ms); }
function setStickyOffsets(){ const hdr=document.querySelector(".app-header"); const top=(hdr?.offsetHeight||0)+8; document.documentElement.style.setProperty("--theadTop", top+"px"); }
function calcRow(tr){
  const get = n => asInt($(`input[name="${n}"]`, tr).value);
  const A = get("PM") + get("V") + get("E");
  const B = (get("H") + get("S")) - get("D");
  const d = A - B;
  $(".totA",tr).innerHTML = `<span class="badge">${A}</span>`;
  $(".totB",tr).innerHTML = `<span class="badge">${B}</span>`;
  $(".delta",tr).innerHTML = `<span class="badge ${d>=0?'delta-pos':'delta-neg'}">${d}</span>`;
  const st=$(".status",tr); st.className="status"; const abs=Math.abs(d);
  if(abs===0){ st.textContent="Cuadre OK"; st.classList.add("ok"); }
  else if(abs<=2){ st.textContent="Validar conteo"; st.classList.add("warn"); }
  else{ st.textContent="Descuadre"; st.classList.add("bad"); }
  const nombre=tr.querySelector("td").textContent.trim(); const prep=parsePrepDateTime(tr); const vH=vidaHorasPorNombre(nombre);
  const venceEl=$(".vence",tr), restEl=$(".resta",tr), vigEl=$(".vig-status",tr); vigEl.className="vig-status";
  if(!prep){ venceEl.textContent="—"; restEl.textContent="—"; vigEl.textContent="Sin datos"; return; }
  const vence=new Date(prep.getTime()+vH*3600*1000); const ms=vence-Date.now();
  venceEl.textContent=fmtDateTime(vence); restEl.textContent=fmtDur(ms);
  if(ms<=0){ vigEl.textContent="Expirado"; vigEl.classList.add("vig-bad"); }
  else if(ms<=4*3600*1000){ vigEl.textContent="Por expirar"; vigEl.classList.add("vig-warn"); }
  else{ vigEl.textContent="Vigente"; vigEl.classList.add("vig-ok"); }
}
function refreshKPIs(){ const rows=collectData(); const A=rows.reduce((s,r)=>s+(r.totalA||0),0); const B=rows.reduce((s,r)=>s+(r.totalB||0),0); const D=A-B; const X=rows.filter(r=>String(r.vigencia).toLowerCase().includes("expirado")).length;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; }; set("kpiA",A); set("kpiB",B); set("kpiDelta",D); set("kpiExp",X); }
function renderTable(data){
  const tb=$("#tblPostres tbody"); tb.innerHTML="";
  data.forEach(it=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="sticky">${it.nombre}</td>
      <td><input type="number" inputmode="numeric" placeholder="0" name="PM" value="${it.PM ?? ""}"></td>
      <td><input type="number" inputmode="numeric" placeholder="0" name="V" value="${it.V ?? ""}"></td>
      <td><input type="number" inputmode="numeric" placeholder="0" name="E" value="${it.E ?? ""}"></td>
      <td class="totA sep-left">0</td>
      <td class="sep-left"><input type="number" inputmode="numeric" placeholder="0" name="H" value="${it.H ?? ""}"></td>
      <td><input type="number" inputmode="numeric" placeholder="0" name="S" value="${it.S ?? ""}"></td>
      <td><input type="number" inputmode="numeric" placeholder="0" name="D" value="${it.D ?? ""}"></td>
      <td class="totB sep-left">0</td>
      <td class="delta">0</td>
      <td class="status">—</td>
      <td class="sep-left"><input type="date" name="prepFecha" value="${it.prepFecha ?? ""}"></td>
      <td><input type="time" name="prepHora" value="${it.prepHora ?? ""}"></td>
      <td class="vence">—</td>
      <td class="resta">—</td>
      <td class="vig-status">Sin datos</td>`;
    $$("input",tr).forEach(inp=>{ inp.addEventListener("input",()=>{ calcRow(tr); refreshKPIs(); }); inp.addEventListener("change",()=>{ calcRow(tr); refreshKPIs(); }); });
    tb.appendChild(tr); calcRow(tr);
  }); refreshKPIs();
}
function collectData(){
  const out=[]; $$("#tblPostres tbody tr").forEach(tr=>{
    const nombre=tr.querySelector("td").textContent.trim();
    const get=n=>asInt($(`input[name="${n}"]`,tr).value);
    out.push({ nombre, PM:get("PM"), V:get("V"), E:get("E"), H:get("H"), S:get("S"), D:get("D"),
      totalA:Number($(".totA",tr).textContent.replace(/\D/g,''))||0,
      totalB:Number($(".totB",tr).textContent.replace(/\D/g,''))||0,
      delta:Number($(".delta",tr).textContent.replace(/[^\-0-9]/g,''))||0,
      estado:$(".status",tr).textContent,
      prepFecha:$(`input[name="prepFecha"]`,tr).value||"",
      prepHora:$(`input[name="prepHora"]`,tr).value||"",
      vence:$(".vence",tr).textContent,
      restante:$(".resta",tr).textContent,
      vigencia:$(".vig-status",tr).textContent
    });
  }); return out;
}
function exportCSV(){
  const meta={ gerencial:$("#gerencial").value||"", fecha:$("#fecha").value||"", hora:$("#hora").value||"" };
  const rows=collectData();
  const H=["Postre","PM","V","E","Total A","H","S","D","Total B","Diferencia","Estado","Prep Fecha","Prep Hora","Vence","Restante","Vigencia","Gerencial","Fecha Rev","Hora Rev"];
  const lines=[H.join(",")];
  rows.forEach(r=>lines.push([`"${r.nombre}"`,r.PM,r.V,r.E,r.totalA,r.H,r.S,r.D,r.totalB,r.delta,r.estado,`"${r.prepFecha}"`,`"${r.prepHora}"`,`"${r.vence}"`,`"${r.restante}"`,`"${r.vigencia}"`,`"${meta.gerencial}"`,`"${meta.fecha}"`,`"${meta.hora}"`].join(",")));
  const blob=new Blob([lines.join("\\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); const url=URL.createObjectURL(blob);
  a.href=url; a.download=`verificador_postres_${meta.fecha||new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),0);
  toast("CSV exportado.","ok");
}
function saveLocal(){ const data={ meta:{gerencial:$("#gerencial").value,fecha:$("#fecha").value,hora:$("#hora").value}, filas:collectData() }; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); toast("Datos guardados en el dispositivo.","ok"); }
function loadLocal(){
  const raw=localStorage.getItem(STORAGE_KEY); if(!raw){ toast("No hay datos guardados.","warn"); return; }
  const d=JSON.parse(raw);
  $("#gerencial").value=d.meta.gerencial||""; $("#fecha").value=d.meta.fecha||""; $("#hora").value=d.meta.hora||"";
  const filas=(d.filas||[]).map(r=>({ nombre:r.nombre, PM:r.PM, V:r.V, E:r.E, H:r.H, S:r.S, D:r.D, prepFecha:r.prepFecha, prepHora:r.prepHora }));
  renderTable(filas); toast("Datos cargados.","ok");
}
let NOTIFY_ENABLED=false; const notifiedSet=new Set();
async function ensureNotificationPermission(){ if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; if(Notification.permission==="denied") return false; const p=await Notification.requestPermission(); return p==="granted"; }
function notifyExpired(nombre){ if(!NOTIFY_ENABLED) return; try{ new Notification("Postre vencido",{ body:`${nombre} ha expirado. Retirar de venta.`, icon:"icon-192.png" }); if("vibrate" in navigator) navigator.vibrate([200,100,200]); }catch{} }
function scanExpirados(){
  $$("#tblPostres tbody tr").forEach(tr=>{
    const nombre=tr.querySelector("td").textContent.trim();
    const status=$(".vig-status",tr)?.textContent?.toLowerCase()||"";
    const key=nombre+"|expired";
    if(status.includes("expirado")){ if(!notifiedSet.has(key)){ notifiedSet.add(key); notifyExpired(nombre); toast(`Vencido: ${nombre}`,"err"); } }
    else{ notifiedSet.delete(key); }
  });
}
function wireNotifications(){
  $("#btnNotify").addEventListener("click", async ()=>{
    const ok=await ensureNotificationPermission(); NOTIFY_ENABLED=ok;
    toast(ok?"Alertas activadas.":"Permiso denegado para notificaciones.", ok?"ok":"warn");
  });
  setInterval(()=>{
    $$("#tblPostres tbody tr").forEach(tr=>calcRow(tr));
    refreshKPIs();
    scanExpirados();
  }, 60*1000);
}
function clearAll(){ $("#gerencial").value=""; $("#fecha").value=""; $("#hora").value=""; renderTable(POSTRES.map(n=>({nombre:n}))); toast("Tabla reiniciada.","warn"); }
document.addEventListener("DOMContentLoaded", ()=>{
  renderTable(POSTRES.map(n=>({nombre:n})));
  $("#btnExportCSV").addEventListener("click", exportCSV);
  $("#btnSaveLocal").addEventListener("click", saveLocal);
  $("#btnLoadLocal").addEventListener("click", loadLocal);
  $("#btnClear").addEventListener("click", clearAll);
  wireNotifications();
  const now=new Date(); $("#fecha").value=now.toISOString().slice(0,10); $("#hora").value=now.toTimeString().slice(0,5);
  setStickyOffsets();
});
window.addEventListener("resize", setStickyOffsets);
