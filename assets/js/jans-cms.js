/*
 * jans-cms.js — Almacenamiento del panel en Supabase (reemplaza a GitHub).
 *
 *  · Archivos (fotos, QR, códigos de barras) → Supabase Storage, bucket "media".
 *  · Contenido público (blogs, equipo, redes, empresa, FAQ, versión, …)
 *    → tabla config_sitio, claves "pub:<nombre>".
 *
 * Requiere que admin-guard.js se haya cargado antes (usa window._jansAuthClient,
 * que ya tiene la sesión del administrador). Las políticas RLS del SQL
 * (supabase/cms-supabase.sql) permiten escribir solo a admins.
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://qwwotzscuwnduzlralew.supabase.co";
  var BUCKET = "media";
  var PUBLIC_PREFIX = SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/";

  function sb() {
    var c = window._jansAuthClient;
    if (!c) throw new Error("Sin sesión de Supabase");
    return c;
  }

  // "assets/images/x.jpg" o "x.jpg" → ruta limpia dentro del bucket
  function cleanPath(path) {
    return String(path || "")
      .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//, "")
      .replace(/\?.*$/, "")
      .replace(/^\/+/, "")
      .replace(/^assets\/images\//, "")
      .replace(/\.\.+/g, "")
      .replace(/[^a-zA-Z0-9._\/-]/g, "-");
  }

  function guessType(path) {
    var ext = (String(path).split(".").pop() || "").toLowerCase();
    return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
             gif: "image/gif", svg: "image/svg+xml" }[ext] || "application/octet-stream";
  }

  function base64ToBlob(b64, type) {
    var bin = atob(String(b64).replace(/\s+/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }

  function jsonKey(file) {
    return "pub:" + String(file || "").split("/").pop().replace(/\.json$/i, "");
  }

  var JansCMS = {
    BUCKET: BUCKET,

    isStorageUrl: function (u) {
      return typeof u === "string" && u.indexOf(PUBLIC_PREFIX) === 0;
    },

    publicUrl: function (path) {
      return PUBLIC_PREFIX + cleanPath(path);
    },

    /** Sube un archivo en base64. Devuelve la URL pública (con ?v= para evitar caché) o null. */
    uploadBase64: async function (path, base64, contentType) {
      var p = cleanPath(path);
      var type = contentType || guessType(p);
      if (!/^image\//.test(type)) { console.error("Tipo de archivo no permitido:", type); return null; }
      try {
        var res = await sb().storage.from(BUCKET).upload(p, base64ToBlob(base64, type), {
          upsert: true, contentType: type, cacheControl: "3600"
        });
        if (res.error) { console.error("Storage upload:", res.error.message || res.error); return null; }
        return PUBLIC_PREFIX + p + "?v=" + Date.now();
      } catch (e) {
        console.error("Storage upload:", e);
        return null;
      }
    },

    /** Borra un archivo del bucket. Rutas antiguas del repositorio se ignoran (no hay nada que borrar). */
    remove: async function (pathOrUrl) {
      if (!JansCMS.isStorageUrl(pathOrUrl)) return false;
      try {
        var res = await sb().storage.from(BUCKET).remove([cleanPath(pathOrUrl)]);
        return !res.error;
      } catch (e) { return false; }
    },

    /** Guarda contenido público (antes data/*.json en GitHub). */
    putJson: async function (file, data) {
      try {
        var res = await sb().from("config_sitio").upsert([{
          clave: jsonKey(file), valor: JSON.stringify(data), updated_at: new Date().toISOString()
        }], { onConflict: "clave" });
        if (res.error) { console.error("putJson", file, res.error.message || res.error); return false; }
        return true;
      } catch (e) { console.error("putJson", file, e); return false; }
    },

    getJson: async function (file) {
      try {
        var res = await sb().from("config_sitio").select("valor").eq("clave", jsonKey(file)).maybeSingle();
        if (res.error || !res.data) return null;
        return JSON.parse(res.data.valor);
      } catch (e) { return null; }
    },

    /** Marca una nueva versión del sitio (las páginas públicas recargan su caché). */
    bumpVersion: function (note) {
      return JansCMS.putJson("version.json", { v: Date.now(), ts: new Date().toISOString(), note: note || "" });
    }
  };

  window.JansCMS = JansCMS;

  // Limpieza: borrar cualquier token/config de GitHub que haya quedado en este navegador
  try {
    ["jans_gh_config", "jans_gh_token", "jans_gh_token_enc", "jans_public_owner", "jans_public_repo"].forEach(function (k) {
      localStorage.removeItem(k);
    });
    Object.keys(localStorage).forEach(function (k) {
      if (/(^|_)gh(_|$)|github/i.test(k)) localStorage.removeItem(k);
    });
  } catch (e) {}
})();
