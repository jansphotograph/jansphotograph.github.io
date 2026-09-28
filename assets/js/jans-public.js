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
 *
 * No depende del SDK de Supabase: usa la API REST con la clave pública.
 */
(function () {
  "use strict";

  var SB_URL = "https://qwwotzscuwnduzlralew.supabase.co";
  var SB_KEY = "sb_publishable_kiy_NJVZUEYTcNkzPDUdWA_7zpTL99g";
  var cache = {};

  function siteRoot() {
    // Soporta el sitio en la raíz del dominio (jansphotograph.com) y previsualizaciones locales
    var s = document.currentScript || document.querySelector('script[src*="jans-public.js"]');
    try { return new URL("../../", s.src).href; } catch (e) { return "/"; }
  }
  var ROOT = siteRoot();

  async function fromSupabase(name) {
    var url = SB_URL + "/rest/v1/config_sitio?select=valor&clave=eq." + encodeURIComponent("pub:" + name);
    var res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, cache: "no-store" });
    if (!res.ok) return undefined;
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
          try {
            var v = await fromSupabase(name);
            if (v !== undefined) return v;
          } catch (e) {}
          return fromStatic(name);
        })();
      }
      return cache[name];
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

  window.JansPub = JansPub;
})();
