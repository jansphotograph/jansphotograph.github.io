/*
 * jans-form.js — Protección de formularios públicos (reservas y comentarios).
 *
 *  · Campo trampa (honeypot) invisible: los bots lo rellenan, las personas no.
 *  · Tiempo mínimo: un envío en menos de 3 s desde que cargó el formulario es un bot.
 *  · Límite de envíos por navegador (el servidor además limita por IP).
 *  · Limpieza de texto: quita etiquetas HTML y caracteres de control, recorta y limita longitud.
 *  · Detección de código: rechaza "javascript:", "onerror=", "<script", etc.
 *
 * La validación definitiva la hace Supabase (trigger _proteger_formulario); esto
 * evita envíos basura y da mensajes claros al usuario.
 */
(function () {
  "use strict";

  var MIN_MS = 3000;
  var BAD = /(<\s*\/?\s*(script|iframe|object|embed|svg|img|style|link|meta)\b)|((javascript|vbscript|data)\s*:)|((^|[^a-z])on[a-z]+\s*=)/i;
  var state = {};

  function honeypot(form, id) {
    var wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important";
    var label = document.createElement("label");
    label.textContent = "No completar";
    var input = document.createElement("input");
    input.type = "text";
    input.name = "website";
    input.id = id + "_hp";
    input.tabIndex = -1;
    input.autocomplete = "off";
    label.appendChild(input);
    wrap.appendChild(label);
    form.appendChild(wrap);
    return input;
  }

  var JansForm = {
    /** Prepara un formulario/contenedor. `key` identifica el formulario (p. ej. "reservas"). */
    protect: function (container, key, opts) {
      opts = opts || {};
      if (!container) return;
      state[key] = {
        hp: honeypot(container, key),
        t0: Date.now(),
        max: opts.max || 3,
        windowMs: (opts.windowMin || 30) * 60000
      };
    },

    /** Devuelve { ok, bot, msg }. Si bot === true conviene simular éxito sin enviar. */
    check: function (key) {
      var st = state[key];
      if (!st) return { ok: true };
      if (st.hp && st.hp.value) return { ok: false, bot: true };
      if (Date.now() - st.t0 < MIN_MS) return { ok: false, bot: true };
      try {
        var lk = "jans_envios_" + key;
        var now = Date.now();
        var list = JSON.parse(localStorage.getItem(lk) || "[]").filter(function (t) { return now - t < st.windowMs; });
        if (list.length >= st.max) {
          return { ok: false, msg: "Ya enviaste varias solicitudes hace poco. Intenta de nuevo más tarde o escríbenos por WhatsApp." };
        }
      } catch (e) {}
      return { ok: true };
    },

    /** Registra un envío exitoso (para el límite por navegador). */
    sent: function (key) {
      var st = state[key];
      try {
        var lk = "jans_envios_" + key;
        var now = Date.now();
        var list = JSON.parse(localStorage.getItem(lk) || "[]").filter(function (t) { return !st || now - t < st.windowMs; });
        list.push(now);
        localStorage.setItem(lk, JSON.stringify(list));
      } catch (e) {}
    },

    /** Limpia texto de usuario. */
    clean: function (v, max) {
      var s = String(v == null ? "" : v)
        .replace(/<[^>]*>/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim();
      return max ? s.slice(0, max) : s;
    },

    /** true si el texto contiene algo que parece código. */
    hasCode: function (v) {
      return BAD.test(String(v || ""));
    },

    isEmail: function (v) {
      return /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[a-z]{2,}$/i.test(String(v || ""));
    },

    isPhone: function (v) {
      var d = String(v || "").replace(/[\s().+-]/g, "");
      return /^\d{7,15}$/.test(d);
    },

    /** Traduce errores del servidor a mensajes para el usuario. */
    serverMessage: function (error) {
      var m = (error && (error.message || error.details)) || "";
      if (/Demasiados envíos/i.test(m)) return "Recibimos varias solicitudes desde tu conexión. Intenta más tarde o escríbenos por WhatsApp.";
      if (/demasiado largo/i.test(m)) return "Uno de los campos es demasiado largo.";
      if (/no permitido/i.test(m)) return "El texto contiene caracteres o código no permitidos.";
      return "";
    }
  };

  window.JansForm = JansForm;
})();
