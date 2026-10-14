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
  // Letras latinas (incluye tildes, ñ y ü). Igual que la validación del servidor.
  var L = "A-Za-zÀ-ÖØ-öø-ÿ";
  // Palabra principal: letras; admite un apóstrofo inicial (O'Brien, D'Angelo) y un guion (Ana-María).
  var WORD_RE = new RegExp("^(?:[" + L + "]')?[" + L + "]{2,}(?:-[" + L + "]{2,})?$");
  var BAD_NAME_CHARS = new RegExp("[^" + L + "\\s'’-]", "g");
  // Partículas que pueden ir ANTES del nombre o apellido: De León, Del Cid, De la Guardia, De los Santos, Van Dyke…
  var PARTICLES = ["de", "del", "la", "las", "los", "da", "das", "do", "dos", "di", "du", "van", "von", "der", "den", "le", "lo", "san", "santa"];
  function isParticle(w) { return PARTICLES.indexOf(String(w).toLocaleLowerCase("es")) >= 0; }
  function cap(w) { return w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es"); }
  function capWord(w) { return w.split(/([-'])/).map(function (x) { return /^[-']$/.test(x) ? x : cap(x); }).join(""); }
  function mainCount(v) {
    return String(v || "").trim().split(/\s+/).filter(function (w) { return w && !isParticle(w); }).length;
  }

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

    /**
     * Un solo nombre o un solo apellido, solo letras (con tildes, ñ y ü).
     * Se permiten compuestos de una sola persona: partículas delante (De León, Del Cid,
     * De la Guardia), guion (Ana-María) y apóstrofo (O'Brien). No se permiten dos
     * nombres o dos apellidos (Pedro José, González Pérez), números ni signos.
     * Devuelve { ok, value, error }.
     */
    singleWord: function (v, tipo) {
      var t = tipo || "nombre";
      var raw = String(v == null ? "" : v).replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();
      var ej = t === "apellido" ? "De León" : "Ana-María";
      if (!raw) return { ok: false, value: "", error: "Escribe tu " + t + "." };
      if (BAD_NAME_CHARS.test(raw)) { BAD_NAME_CHARS.lastIndex = 0; return { ok: false, value: raw, error: "El " + t + " solo puede tener letras (sin números, signos ni caracteres especiales)." }; }
      BAD_NAME_CHARS.lastIndex = 0;
      if (raw.length > 40) return { ok: false, value: raw, error: "El " + t + " es muy largo (máximo 40 caracteres)." };
      var words = raw.split(" ");
      var i = 0;
      while (i < words.length && isParticle(words[i])) i++;
      if (i === words.length) return { ok: false, value: raw, error: "Completa el " + t + " (por ejemplo «" + ej + "»)." };
      if (i > 3 || words.length - i > 1) return { ok: false, value: raw, error: "Escribe solo un " + t + " (se permiten compuestos como «" + ej + "»)." };
      var main = words[i];
      if (!WORD_RE.test(main)) {
        if (main.replace(/[-']/g, "").length < 2) return { ok: false, value: raw, error: "El " + t + " es muy corto." };
        return { ok: false, value: raw, error: "Revisa el " + t + ": el guion y el apóstrofo solo sirven para unir (Ana-María, O'Brien)." };
      }
      var out = words.slice(0, i).map(function (w, k) { return k === 0 ? cap(w) : w.toLocaleLowerCase("es"); });
      out.push(capWord(main));
      return { ok: true, value: out.join(" "), error: "" };
    },

    /**
     * Activa el filtro en vivo en un input de nombre/apellido:
     *  · quita al instante números, signos y caracteres especiales,
     *  · avisa si se escribe un espacio (dos nombres o dos apellidos),
     *  · pone mayúscula inicial al salir del campo.
     */
    bindSingleWord: function (input, tipo, opts) {
      if (!input) return;
      opts = opts || {};
      var hint = document.createElement("div");
      hint.className = "field-hint";
      hint.id = input.id + "_hint";
      hint.setAttribute("aria-live", "polite");
      input.setAttribute("aria-describedby", hint.id);
      input.insertAdjacentElement("afterend", hint);
      input.setAttribute("maxlength", "40");
      input.setAttribute("autocapitalize", "words");
      input.setAttribute("spellcheck", "false");
      function show(msg, isError) {
        hint.textContent = msg || "";
        hint.classList.toggle("is-error", !!isError);
        input.classList.toggle("is-invalid", !!isError);
        input.setAttribute("aria-invalid", isError ? "true" : "false");
      }
      input.addEventListener("input", function () {
        var before = input.value;
        var cleaned = before.replace(BAD_NAME_CHARS, "").replace(/\s{2,}/g, " ").replace(/-{2,}/g, "-").replace(/'{2,}/g, "'");
        if (cleaned !== before) {
          var pos = input.selectionStart - (before.length - cleaned.length);
          input.value = cleaned;
          try { input.setSelectionRange(pos, pos); } catch (e) {}
          show("Solo se permiten letras.", false);
        } else show("", false);
        if (mainCount(cleaned) > 1) show("Escribe solo un " + tipo + ". " + (opts.otherHint || ""), true);
      });
      input.addEventListener("blur", function () {
        if (!input.value.trim()) { if (!opts.optional) show("", false); return; }
        var r = JansForm.singleWord(input.value, tipo);
        if (r.ok) { input.value = r.value; show("", false); } else show(r.error + " " + (opts.otherHint || ""), true);
      });
      input._jansShow = show;
    },

    /** Valida un input enlazado y muestra el error junto al campo. */
    checkSingleWord: function (input, tipo, opts) {
      opts = opts || {};
      var r = JansForm.singleWord(input.value, tipo);
      if (!r.ok && opts.optional && !input.value.trim()) return { ok: true, value: "" };
      if (input._jansShow) input._jansShow(r.ok ? "" : r.error + " " + (opts.otherHint || ""), !r.ok);
      if (r.ok) input.value = r.value;
      return r;
    },

    /** Traduce errores del servidor a mensajes para el usuario. */
    serverMessage: function (error) {
      var m = (error && (error.message || error.details)) || "";
      if (/nombre|apellido/i.test(m) && /válid/i.test(m)) return "Revisa el nombre y el apellido: escribe solo un nombre y un apellido, con letras.";
      if (/Demasiados envíos/i.test(m)) return "Recibimos varias solicitudes desde tu conexión. Intenta más tarde o escríbenos por WhatsApp.";
      if (/demasiado largo/i.test(m)) return "Uno de los campos es demasiado largo.";
      if (/no permitido/i.test(m)) return "El texto contiene caracteres o código no permitidos.";
      return "";
    }
  };

  window.JansForm = JansForm;
})();
