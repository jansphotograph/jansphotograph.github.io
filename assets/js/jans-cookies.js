/*
 * jans-cookies.js — Aviso de cookies y consentimiento.
 *
 * El sitio NO usa cookies publicitarias ni de analítica. Solo:
 *   · Necesario: almacenamiento local del navegador para recordar contenido y tu elección.
 *   · Contenido externo (opcional): video de YouTube incrustado.
 *
 *   JansConsent.allows("externos") → true/false
 *   JansConsent.open()             → vuelve a mostrar el aviso (enlace "Preferencias de cookies")
 *   window event "jans-consent"    → se dispara al guardar la elección
 */
(function () {
  "use strict";

  var KEY = "jans_consent";
  var VERSION = 1;
  var script = document.currentScript;
  var ROOT = (function () { try { return new URL("../../", script.src).href; } catch (e) { return "/"; } })();
  var POLICY = ROOT + "assets/pages/cookies.html";

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || "null");
      return c && c.v === VERSION ? c : null;
    } catch (e) { return null; }
  }

  function save(externos) {
    var c = { v: VERSION, necesarias: true, externos: !!externos, ts: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    hide();
    try { window.dispatchEvent(new CustomEvent("jans-consent", { detail: c })); } catch (e) {}
  }

  var banner = null;

  function css() {
    if (document.getElementById("jans-cookie-css")) return;
    var st = document.createElement("style");
    st.id = "jans-cookie-css";
    st.textContent =
      ".jc-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;" +
      "background:#161616;color:#eee;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px 20px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.55);font:400 .88rem/1.55 Inter,system-ui,sans-serif;animation:jcUp .3s ease}" +
      "@keyframes jcUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}" +
      ".jc-banner h2{font:700 1rem 'Playfair Display',Georgia,serif;margin:0 0 6px;color:#fff}" +
      ".jc-banner p{margin:0 0 14px;color:rgba(255,255,255,.72)}" +
      ".jc-banner a{color:#e91e8c;text-decoration:underline}" +
      ".jc-actions{display:flex;gap:10px;flex-wrap:wrap}" +
      ".jc-btn{flex:1 1 150px;border-radius:999px;padding:10px 16px;font:600 .85rem Inter,system-ui,sans-serif;cursor:pointer;border:1px solid transparent}" +
      ".jc-accept{background:#e91e8c;color:#fff}.jc-accept:hover{background:#c71e5f}" +
      ".jc-reject{background:transparent;color:#fff;border-color:rgba(255,255,255,.25)}.jc-reject:hover{border-color:#e91e8c}" +
      ".jc-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}";
    document.head.appendChild(st);
  }

  function show() {
    if (banner) return;
    css();
    banner = document.createElement("div");
    banner.className = "jc-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Aviso de cookies");
    banner.innerHTML =
      '<h2>Tu privacidad</h2>' +
      '<p>No usamos cookies publicitarias ni de analítica. Guardamos en tu navegador solo lo necesario para que el sitio funcione. ' +
      'Si aceptas, también cargaremos contenido de YouTube, que puede usar sus propias cookies. ' +
      '<a href="' + POLICY + '">Política de cookies</a></p>' +
      '<div class="jc-actions">' +
      '<button type="button" class="jc-btn jc-reject" data-jc="0">Solo necesarias</button>' +
      '<button type="button" class="jc-btn jc-accept" data-jc="1">Aceptar todo</button>' +
      '</div>';
    banner.addEventListener("click", function (e) {
      var b = e.target.closest("[data-jc]");
      if (b) save(b.getAttribute("data-jc") === "1");
    });
    document.body.appendChild(banner);
  }

  function hide() {
    if (banner) { banner.remove(); banner = null; }
  }

  window.JansConsent = {
    allows: function (cat) {
      var c = read();
      if (cat === "necesarias") return true;
      return !!(c && c[cat]);
    },
    decided: function () { return !!read(); },
    open: function () { hide(); show(); }
  };

  function init() {
    if (!read()) show();
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-cookie-prefs]");
      if (a) { e.preventDefault(); window.JansConsent.open(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
