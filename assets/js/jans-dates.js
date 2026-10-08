/*
 * jans-dates.js — Formato único de fechas para todo el sitio (panel y formulario público).
 *
 * REGLA:
 *   - Se GUARDA siempre en ISO: fechas "AAAA-MM-DD" (createdAt, fecha, session_date,
 *     fecha_especial) y marcas de tiempo ISO completas (created_at). Es lo que Supabase/Postgres
 *     entiende sin ambigüedad.
 *   - Se MUESTRA siempre "DD/MM/AAAA" (tablas, modales y PDFs).
 *
 * Los registros viejos pueden traer createdAt en otros formatos y se leen bien:
 *   "10/08/2026" → MM/DD/AAAA (toLocaleDateString("es-PA") del formulario público antiguo)
 *   "8/10/2026"  → D/M/AAAA   (panel antiguo)
 *   Para desempatar se usa created_at de Supabase cuando existe.
 *
 *  JansDate.today()                 → "2026-10-08" (fecha local de hoy, ISO)
 *  JansDate.iso(valor)              → "AAAA-MM-DD" o "" (acepta Date, ISO, D/M/AAAA…)
 *  JansDate.fmt(valor)              → "08/10/2026" o "—"
 *  JansDate.fmtLong(valor)          → "8 de Octubre 2026"
 *  JansDate.parse(valor, opts)      → Date (12:00 local) o null
 *  JansDate.created(rec, kind)      → Date de creación de una reserva/cotización
 *  JansDate.createdISO(rec, kind)   → "AAAA-MM-DD" de creación (normalizado)
 */
(function () {
  "use strict";

  var MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function mk(y, m, d) {
    if (!(y > 1900 && y < 3000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    var dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt.getMonth() === m - 1 ? dt : null;
  }

  function toIso(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /*
   * Candidatos de fecha para un texto. opts.order: "dm" (por defecto) o "md".
   */
  function candidates(v, order) {
    var s = String(v).trim(), m;
    // Marca de tiempo ISO completa (con hora) → fecha local
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      var t = new Date(s);
      return isNaN(t.getTime()) ? [] : [mk(t.getFullYear(), t.getMonth() + 1, t.getDate())];
    }
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return [mk(+m[1], +m[2], +m[3])].filter(Boolean);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(s))) {
      var dm = mk(+m[3], +m[2], +m[1]), md = mk(+m[3], +m[1], +m[2]);
      return (order === "md" ? [md, dm] : [dm, md]).filter(Boolean);
    }
    // "8 de Octubre 2026" / "8 de octubre de 2026"
    if ((m = /^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i.exec(s))) {
      var mi = MESES.findIndex(function (x) { return x.toLowerCase() === m[2].toLowerCase(); });
      if (mi >= 0) return [mk(+m[3], mi + 1, +m[1])].filter(Boolean);
    }
    return [];
  }

  function parse(v, opts) {
    if (v == null || v === "" || v === "—") return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : mk(v.getFullYear(), v.getMonth() + 1, v.getDate());
    opts = opts || {};
    var c = candidates(v, opts.order);
    if (!c.length) return null;
    if (opts.hint) {
      var h = opts.hint instanceof Date ? opts.hint : new Date(opts.hint);
      if (!isNaN(h.getTime())) {
        var hit = c.find(function (x) { return sameDay(x, h); });
        if (hit) return hit;
      }
    }
    return c[0];
  }

  function iso(v, opts) {
    var d = parse(v, opts);
    return d ? toIso(d) : "";
  }

  function fmt(v, opts) {
    var d = parse(v, opts);
    return d ? pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() : "—";
  }

  function fmtLong(v, opts) {
    var d = parse(v, opts);
    return d ? d.getDate() + " de " + MESES[d.getMonth()] + " " + d.getFullYear() : "";
  }

  function today() { return toIso(new Date()); }

  /*
   * Fecha de creación de una reserva o cotización.
   *  - Si createdAt (texto) coincide con created_at de Supabase → created_at (incluye la hora, sirve para ordenar).
   *  - Si no coincide, el admin la editó a mano → manda createdAt.
   *  - Reservas web viejas ("10/08/2026", ambos de 2 dígitos) eran MM/DD.
   */
  function created(rec, kind) {
    if (!rec) return null;
    var stamp = rec.createdAtISO || rec.created_at || "";
    var sd = stamp ? new Date(stamp) : null;
    if (sd && isNaN(sd.getTime())) sd = null;
    var txt = String(rec.createdAt || "").trim();
    var order = "dm";
    var mm = /^(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(txt);
    if (kind === "reserva" && mm && mm[1].length === 2 && mm[2].length === 2) order = "md";
    var c = txt ? candidates(txt, order) : [];
    if (sd) {
      if (!c.length || c.some(function (x) { return sameDay(x, sd); })) return sd;
      return c[0];
    }
    if (c.length) return c[0];
    var idm = /^[a-z]+_(\d{12,13})/.exec(String(rec.id || ""));
    return idm ? new Date(+idm[1]) : null;
  }

  function createdISO(rec, kind) {
    var d = created(rec, kind);
    return d ? toIso(d) : "";
  }

  window.JansDate = {
    MESES: MESES,
    today: today,
    iso: iso,
    fmt: fmt,
    fmtLong: fmtLong,
    parse: parse,
    created: created,
    createdISO: createdISO,
    isIso: function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
  };
})();
