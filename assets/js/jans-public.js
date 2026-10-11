/*
 * jans-public.js — Lectura de contenido público desde Supabase (sin GitHub).
 *
 *  JansPub.json("blogs")    → contenido publicado desde el panel (config_sitio "pub:blogs").
 *                              Si todavía no se publicó en Supabase, usa el archivo
 *                              estático /data/socialmedia/blogs.json del sitio.
 *  JansPub.img(ruta)         → URL de imagen (Supabase Storage o ruta del sitio).
 *  JansPub.esc(texto)        → escapa HTML (evita inyección de código al pintar datos).
 *  JansPub.url(enlace)       → solo permite enlaces http(s)/mailto/tel/relativos.
 *  JansPub.watchVersion()    → recarga la página cuando el panel publica una versión nueva.
 *  JansPub.loading(el, tipo, n) / JansPub.empty(el, opts) / JansPub.error(el, opts)
 *                            → estados de carga (esqueletos), vacío y error con reintento.
 *
 * No depende del SDK de Supabase: usa la API REST con la clave pública.
 */
(function () {
  "use strict";

  var SB_URL = "https://qwwotzscuwnduzlralew.supabase.co";
  var SB_KEY = "sb_publishable_kiy_NJVZUEYTcNkzPDUdWA_7zpTL99g";
  var cache = {};
  var failed = {}; // nombre → true si no se pudo contactar con Supabase (error de red)

  function siteRoot() {
    // Soporta el sitio en la raíz del dominio (jansphotograph.com) y previsualizaciones locales
    var s = document.currentScript || document.querySelector('script[src*="jans-public.js"]');
    try { return new URL("../../", s.src).href; } catch (e) { return "/"; }
  }
  var ROOT = siteRoot();

  async function fromSupabase(name) {
    var url = SB_URL + "/rest/v1/config_sitio?select=valor&clave=eq." + encodeURIComponent("pub:" + name);
    var res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return undefined;
    return JSON.parse(rows[0].valor);
  }

  async function fromStatic(name) {
    var paths = ["data/socialmedia/" + name + ".json", "data/" + name + ".json"];
    for (var i = 0; i < paths.length; i++) {
      try {
        var res = await fetch(ROOT + paths[i], { cache: "no-cache" });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return null;
  }

  var JansPub = {
    SB_URL: SB_URL,
    SB_KEY: SB_KEY,

    json: function (name) {
      if (!cache[name]) {
        cache[name] = (async function () {
          failed[name] = false;
          try {
            var v = await fromSupabase(name);
            if (v !== undefined) return v;
          } catch (e) { failed[name] = true; }
          var st = await fromStatic(name);
          if (st === null) delete cache[name]; // permitir reintentar
          return st;
        })();
      }
      return cache[name];
    },

    /** true si la última lectura de `name` falló por conexión (para distinguir error de "vacío"). */
    failed: function (name) { return !!failed[name]; },

    /** Igual que json() pero rechaza la promesa si no hubo forma de obtener datos (para mostrar error). */
    jsonOrFail: async function (name) {
      var v = await JansPub.json(name);
      if (v === null || v === undefined) throw new Error("sin datos: " + name);
      return v;
    },

    /** GET a una tabla pública vía REST. Lanza error si falla la red o la respuesta. */
    table: async function (path) {
      var res = await fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    },

    img: function (path) {
      if (!path) return "";
      path = String(path);
      if (/^https:\/\//i.test(path)) return path;
      if (/^(javascript|data|vbscript):/i.test(path)) return "";
      return ROOT + path.replace(/^\/+/, "");
    },

    esc: function (v) {
      return String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },

    url: function (u) {
      u = String(u || "").trim();
      if (!u) return "";
      if (/^(https?:|mailto:|tel:)/i.test(u) || /^[./#?]/.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
      return "";
    },

    watchVersion: function () {
      var KEY = "jans_site_version";
      async function check() {
        try {
          var data = await fromSupabase("version");
          if (!data || !data.v) return;
          var current = localStorage.getItem(KEY);
          localStorage.setItem(KEY, String(data.v));
          if (current && current !== String(data.v)) location.reload();
        } catch (e) {}
      }
      check();
      setInterval(check, 6e4);
    }
  };


  // ---------------- Estados de interfaz ----------------
  var ICONS = {
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>'
  };
  var WA = "https://wa.me/50768622402";

  function repeat(n, html) { var o = ""; for (var i = 0; i < n; i++) o += html; return o; }

  function skeleton(tipo, n) {
    switch (tipo) {
      case "tiles": return repeat(n || 8, '<div class="js-skel js-skel-tile" aria-hidden="true"></div>');
      case "plans": return repeat(n || 3,
        '<div class="js-skel-plan" aria-hidden="true"><div class="js-skel js-skel-title"></div><div class="js-skel js-skel-price"></div>' +
        '<div class="js-skel js-skel-line w80"></div><div class="js-skel js-skel-line w60"></div><div class="js-skel js-skel-line w80"></div>' +
        '<div class="js-skel js-skel-btn"></div></div>');
      case "rows": return repeat(n || 4, '<div class="js-skel-row" aria-hidden="true"><div class="js-skel" style="width:55%"></div><div class="js-skel" style="width:15%"></div></div>');
      case "faq": return repeat(n || 3, '<div class="js-skel" aria-hidden="true" style="height:54px;margin-bottom:10px"></div>');
      case "testi": return repeat(n || 3, '<div class="js-skel-plan" aria-hidden="true"><div class="js-skel js-skel-line w80"></div><div class="js-skel js-skel-line w80"></div><div class="js-skel js-skel-line w60"></div><div class="js-skel js-skel-line w40" style="margin-top:18px"></div></div>');
      case "blog": return '<div class="js-skel" aria-hidden="true" style="height:320px;margin-bottom:28px"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px">' + repeat(n || 3, '<div class="js-skel js-skel-card" aria-hidden="true"></div>') + '</div>';
      default: return repeat(n || 4, '<div class="js-skel js-skel-card" aria-hidden="true"></div>');
    }
  }

  function stateHtml(o, isError) {
    var acts = (o.actions || []).map(function (a, i) {
      var cls = "js-state-btn " + (i === 0 ? "primary" : "ghost");
      if (a.href) return '<a class="' + cls + '" href="' + JansPub.esc(a.href) + '"' + (/^https?:/.test(a.href) ? ' target="_blank" rel="noopener"' : "") + ">" + JansPub.esc(a.label) + "</a>";
      return '<button type="button" class="' + cls + '" data-js-action="' + i + '">' + JansPub.esc(a.label) + "</button>";
    }).join("");
    return '<div class="js-state' + (isError ? " is-error" : "") + (o.compact ? " compact" : "") + '" role="status">' +
      '<div class="js-state-icon" aria-hidden="true">' + (ICONS[o.icon] || ICONS.camera) + "</div>" +
      "<h3>" + JansPub.esc(o.title) + "</h3>" + (o.text ? "<p>" + JansPub.esc(o.text) + "</p>" : "") +
      (acts ? '<div class="js-state-actions">' + acts + "</div>" : "") + "</div>";
  }

  function bindActions(el, o) {
    (o.actions || []).forEach(function (a, i) {
      if (typeof a.onClick !== "function") return;
      var b = el.querySelector('[data-js-action="' + i + '"]');
      if (b) b.addEventListener("click", a.onClick);
    });
  }

  JansPub.loading = function (el, tipo, n, label) {
    if (!el) return;
    el.setAttribute("aria-busy", "true");
    el.innerHTML = skeleton(tipo, n) + '<span class="js-sr" role="status">' + JansPub.esc(label || "Cargando…") + "</span>";
  };
  JansPub.empty = function (el, o) {
    if (!el) return;
    el.removeAttribute("aria-busy");
    el.innerHTML = stateHtml(o || {}, false);
    bindActions(el, o || {});
  };
  JansPub.error = function (el, o) {
    if (!el) return;
    o = o || {};
    el.removeAttribute("aria-busy");
    var opts = {
      icon: "wifi", compact: o.compact,
      title: o.title || "No pudimos cargar esta sección",
      text: o.text || "Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, escríbenos por WhatsApp.",
      actions: (o.retry ? [{ label: "Reintentar", onClick: o.retry }] : []).concat([{ label: "WhatsApp", href: WA }])
    };
    el.innerHTML = stateHtml(opts, true);
    bindActions(el, opts);
  };
  JansPub.done = function (el) { if (el) el.removeAttribute("aria-busy"); };

  /** Servicios adicionales (tablas servicios_adicionales + servicios_categorias visibles).
   *  Si no hay nada que mostrar o falla la carga, oculta la sección completa. */
  JansPub.serviciosAdicionales = async function (containerId, sectionEl) {
    var box = document.getElementById(containerId);
    if (!box) return;
    var hide = function () { if (sectionEl) sectionEl.style.display = "none"; else box.innerHTML = ""; };
    function render(cats, items) {
      var visible = new Set((cats || []).map(function (c) { return c.nombre; }));
      var grouped = {};
      (items || []).forEach(function (s) {
        var cat = s.categoria || "General";
        if (!visible.has(cat)) return;
        (grouped[cat] = grouped[cat] || []).push(s);
      });
      var keys = Object.keys(grouped);
      box.removeAttribute("aria-busy");
      if (!keys.length) return hide();
      if (sectionEl) sectionEl.style.display = "";
      box.innerHTML = keys.map(function (cat) {
        return '<div class="services-block"><div class="service-group-title">' + JansPub.esc(cat) + "</div>" +
          grouped[cat].map(function (s) {
            var precio = parseFloat(s.precio || s.price || 0);
            return '<div class="service-row"><span class="service-name">' + JansPub.esc(s.nombre || s.name) +
              '</span><span class="service-price">$' + (isFinite(precio) ? precio.toFixed(2) : "—") + "</span></div>";
          }).join("") + "</div>";
      }).join("");
    }
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem("jans_serv_adic_tablas") || "null"); } catch (e) {}
    if (cached && cached.items && cached.items.length) render(cached.cats, cached.items);
    else JansPub.loading(box, "rows", 5, "Cargando servicios adicionales…");
    try {
      var r = await Promise.all([
        JansPub.table("servicios_categorias?visible=eq.true&select=nombre,orden&order=orden.asc"),
        JansPub.table("servicios_adicionales?select=nombre,precio,categoria&order=nombre.asc")
      ]);
      try { localStorage.setItem("jans_serv_adic_tablas", JSON.stringify({ cats: r[0], items: r[1] })); } catch (e) {}
      render(r[0], r[1]);
    } catch (e) {
      if (!(cached && cached.items && cached.items.length)) hide();
    }
  };
  JansPub.WA = WA;

  window.JansPub = JansPub;
})();
