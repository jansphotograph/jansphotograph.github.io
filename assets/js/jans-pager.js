/*
 * jans-pager.js — Paginación y búsqueda para las tablas del panel (Master).
 *
 *   var pg = JansPager.paginate(lista, pagina, 15);   // { items, page, pages, total, from, to }
 *   JansPager.render(contenedor, pg, function (nuevaPagina) { ... });
 *   JansPager.matches(textoBuscado, [nombre, cedula, factura])  // búsqueda sin tildes ni guiones
 */
(function () {
  "use strict";

  var PER_PAGE = 15;

  function norm(v) {
    return String(v == null ? "" : v)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .trim();
  }
  // Para cédula / RUC / # de factura: solo letras y números ("8-888-888" = "8888888", "#0012" = "0012")
  function compact(v) { return norm(v).replace(/[^a-z0-9]/g, ""); }

  function matches(query, fields) {
    var q = norm(query);
    if (!q) return true;
    var qc = compact(q);
    return (fields || []).some(function (f) {
      if (f == null || f === "") return false;
      if (norm(f).indexOf(q) >= 0) return true;
      return qc.length > 0 && compact(f).indexOf(qc) >= 0;
    });
  }

  function paginate(list, page, per) {
    per = per || PER_PAGE;
    var total = (list || []).length;
    var pages = Math.max(1, Math.ceil(total / per));
    var p = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
    var start = (p - 1) * per;
    return {
      items: (list || []).slice(start, start + per),
      page: p, pages: pages, total: total, per: per,
      from: total ? start + 1 : 0,
      to: Math.min(start + per, total)
    };
  }

  /** Página en la que aparece el elemento que cumple `pred` (para abrir uno concreto). */
  function pageOf(list, pred, per) {
    var i = (list || []).findIndex(pred);
    return i < 0 ? 1 : Math.floor(i / (per || PER_PAGE)) + 1;
  }

  var ICON = {
    first: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
    last: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>'
  };

  function injectCss() {
    if (document.getElementById("jans-pager-css")) return;
    var s = document.createElement("style");
    s.id = "jans-pager-css";
    s.textContent =
      ".jpager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 4px 2px;font-family:var(--font,Inter,sans-serif)}" +
      ".jpager-info{font-size:.8rem;color:var(--gray-l,#999)}" +
      ".jpager-info strong{color:var(--white,#fff);font-weight:600}" +
      ".jpager-btns{display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
      ".jpager-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;background:var(--dark,#141414);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:8px;color:var(--white,#fff);font:600 .78rem var(--font,Inter,sans-serif);cursor:pointer;transition:border-color .15s,background .15s}" +
      ".jpager-btn:hover:not(:disabled){border-color:var(--pink-l,#e91e8c);background:rgba(233,30,140,.08)}" +
      ".jpager-btn:focus-visible{outline:2px solid var(--pink-l,#e91e8c);outline-offset:2px}" +
      ".jpager-btn:disabled{opacity:.35;cursor:not-allowed}" +
      ".jpager-page{min-width:92px;text-align:center;font-size:.8rem;font-weight:600;color:var(--white,#fff)}" +
      "@media (max-width:560px){.jpager{justify-content:center}.jpager-info{width:100%;text-align:center}.jpager-btn .jpager-lbl{display:none}}";
    document.head.appendChild(s);
  }

  function render(el, pg, onGo) {
    if (!el) return;
    injectCss();
    if (!pg.total) { el.innerHTML = ""; return; }
    var atStart = pg.page <= 1, atEnd = pg.page >= pg.pages;
    function btn(act, label, icon, disabled, iconAfter) {
      return '<button type="button" class="jpager-btn" data-go="' + act + '"' + (disabled ? " disabled" : "") +
        ' aria-label="' + label + '" title="' + label + '">' +
        (iconAfter ? '<span class="jpager-lbl">' + label + "</span>" + icon : icon + '<span class="jpager-lbl">' + label + "</span>") +
        "</button>";
    }
    el.innerHTML =
      '<nav class="jpager" aria-label="Paginación">' +
        '<div class="jpager-info">Mostrando <strong>' + pg.from + "–" + pg.to + "</strong> de <strong>" + pg.total + "</strong></div>" +
        '<div class="jpager-btns">' +
          btn("first", "Primera", ICON.first, atStart) +
          btn("prev", "Anterior", ICON.prev, atStart) +
          '<span class="jpager-page" aria-live="polite">Página ' + pg.page + " de " + pg.pages + "</span>" +
          btn("next", "Siguiente", ICON.next, atEnd, true) +
          btn("last", "Última", ICON.last, atEnd, true) +
        "</div>" +
      "</nav>";
    el.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        var go = b.getAttribute("data-go");
        var p = go === "first" ? 1 : go === "prev" ? pg.page - 1 : go === "next" ? pg.page + 1 : pg.pages;
        if (typeof onGo === "function") onGo(Math.min(Math.max(1, p), pg.pages));
      });
    });
  }

  window.JansPager = { PER_PAGE: PER_PAGE, paginate: paginate, render: render, matches: matches, pageOf: pageOf, norm: norm };
})();
