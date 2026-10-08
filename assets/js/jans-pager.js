/*
 * jans-pager.js — Utilidades compartidas para las listas del panel
 * (master-reservas, master-cotizaciones, master-historial).
 *
 *  JansList.PER_PAGE                 → 15 registros por página
 *  (requiere jans-dates.js cargado antes)
 *  JansList.createdTs(rec, kind)     → timestamp (ms) de la fecha en que se creó el registro
 *  JansList.createdLabel(ts)         → "08/10/2026"
 *  JansList.norm(str)                → texto en minúsculas y sin acentos (para buscar)
 *  JansList.normId(str)              → cédula/RUC sin espacios, guiones ni puntos
 *  JansList.fillYears(select, tsList)→ llena un <select> con los años presentes
 *  JansList.paginate(list, page)     → { items, page, pages, total, from, to }
 *  JansList.renderPager(el, info, onGo) → dibuja « Primera ‹ Anterior  Página X de Y  Siguiente › Última »
 */
(function () {
  "use strict";

  var PER_PAGE = 15;

  // Las fechas se resuelven con jans-dates.js (formato único del sitio)
  function createdTs(rec, kind) {
    var d = window.JansDate ? window.JansDate.created(rec, kind) : null;
    return d ? d.getTime() : 0;
  }

  function createdLabel(ts) {
    return ts && window.JansDate ? window.JansDate.fmt(new Date(ts)) : "—";
  }

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  function normId(s) {
    return norm(s).replace(/[\s.\-_/]/g, "");
  }

  function fillYears(select, tsList) {
    if (!select) return;
    var cur = select.value;
    var years = {};
    tsList.forEach(function (ts) { if (ts) years[new Date(ts).getFullYear()] = 1; });
    var sorted = Object.keys(years).sort(function (a, b) { return b - a; });
    select.innerHTML = '<option value="">Todos los años</option>' +
      sorted.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("");
    if (cur && years[cur]) select.value = cur;
  }

  function paginate(list, page, per) {
    per = per || PER_PAGE;
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / per));
    page = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
    var start = (page - 1) * per;
    return {
      items: list.slice(start, start + per),
      page: page,
      pages: pages,
      total: total,
      from: total ? start + 1 : 0,
      to: Math.min(start + per, total)
    };
  }

  // Página en la que cae un id (para "highlight")
  function pageOf(list, id, per) {
    per = per || PER_PAGE;
    var i = list.findIndex(function (x) { return x && x.id === id; });
    return i < 0 ? 1 : Math.floor(i / per) + 1;
  }

  function injectCss() {
    if (document.getElementById("jans-pager-css")) return;
    var st = document.createElement("style");
    st.id = "jans-pager-css";
    st.textContent =
      ".jl-filters{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}" +
      ".jl-filters input,.jl-filters select{padding:9px 14px;background:var(--dark);border:1px solid var(--border);border-radius:9px;color:var(--white);font-family:var(--font);font-size:.85rem;outline:none;min-width:0}" +
      ".jl-filters input:focus,.jl-filters select:focus{border-color:var(--pink)}" +
      ".jl-filters .jl-grow{flex:1 1 180px}" +
      ".jl-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 4px 2px;font-size:.82rem;color:var(--gray-l)}" +
      ".jl-pager-btns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}" +
      ".jl-pager button{min-width:38px;height:34px;padding:0 12px;background:var(--dark);border:1px solid var(--border);border-radius:8px;color:var(--white);font-family:var(--font);font-size:.82rem;cursor:pointer;transition:border-color .15s,background .15s}" +
      ".jl-pager button:hover:not(:disabled){border-color:var(--pink-l);color:var(--pink-l)}" +
      ".jl-pager button:disabled{opacity:.35;cursor:not-allowed}" +
      ".jl-pager .jl-cur{padding:0 10px;color:var(--white);font-weight:600;white-space:nowrap}" +
      ".jl-type{display:inline-block;padding:3px 9px;border-radius:20px;font-size:.7rem;font-weight:700;letter-spacing:.03em;white-space:nowrap}" +
      ".jl-type-res{background:rgba(59,130,246,.14);color:#93c5fd;border:1px solid rgba(59,130,246,.3)}" +
      ".jl-type-cot{background:rgba(233,30,140,.12);color:#f9a8d4;border:1px solid rgba(233,30,140,.3)}" +
      "tr.jl-flash td{animation:jlFlash 2.2s ease-out}" +
      "@keyframes jlFlash{0%{background:rgba(233,30,140,.28)}100%{background:transparent}}" +
      "@media (max-width:600px){.jl-pager{justify-content:center}.jl-pager-info{width:100%;text-align:center}.jl-pager button .jl-lbl{display:none}}";
    document.head.appendChild(st);
  }

  function renderPager(el, info, onGo) {
    if (!el) return;
    injectCss();
    if (!info.total) { el.innerHTML = ""; return; }
    var p = info.page, n = info.pages;
    el.className = "jl-pager";
    el.innerHTML =
      '<div class="jl-pager-info">Mostrando ' + info.from + "–" + info.to + " de " + info.total + "</div>" +
      '<div class="jl-pager-btns">' +
      '<button type="button" data-go="1" title="Primera página"' + (p <= 1 ? " disabled" : "") + '>« <span class="jl-lbl">Primera</span></button>' +
      '<button type="button" data-go="' + (p - 1) + '" title="Página anterior"' + (p <= 1 ? " disabled" : "") + '>‹ <span class="jl-lbl">Anterior</span></button>' +
      '<span class="jl-cur">Página ' + p + " de " + n + "</span>" +
      '<button type="button" data-go="' + (p + 1) + '" title="Página siguiente"' + (p >= n ? " disabled" : "") + '><span class="jl-lbl">Siguiente</span> ›</button>' +
      '<button type="button" data-go="' + n + '" title="Última página"' + (p >= n ? " disabled" : "") + '><span class="jl-lbl">Última</span> »</button>' +
      "</div>";
    el.querySelectorAll("button[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { onGo(parseInt(b.getAttribute("data-go"), 10)); });
    });
  }

  // Ejecuta fn como máximo una vez cada `ms` mientras se escribe
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }

  window.JansList = {
    PER_PAGE: PER_PAGE,
    createdTs: createdTs,
    createdLabel: createdLabel,
    norm: norm,
    normId: normId,
    fillYears: fillYears,
    paginate: paginate,
    pageOf: pageOf,
    renderPager: renderPager,
    injectCss: injectCss,
    debounce: debounce
  };
  if (document.head) injectCss(); else document.addEventListener("DOMContentLoaded", injectCss);
})();
