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

    /** URL fija de la imagen para compartir (Open Graph) de una página. */
    shareUrl: function (key) {
      return PUBLIC_PREFIX + "og/" + String(key).replace(/[^a-z0-9-]/g, "") + ".jpg";
    },

    /**
     * Crea la imagen para compartir (1200×630, JPG liviano) a partir de una foto del catálogo
     * y la publica en una URL fija (media/og/<key>.jpg) que usan las etiquetas og:image.
     */
    makeShareImage: async function (src, key, title) {
      var img = await new Promise(function (resolve, reject) {
        var im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = function () { resolve(im); };
        im.onerror = function () { reject(new Error("No se pudo cargar la imagen")); };
        im.src = src + (src.indexOf("?") < 0 ? "?" : "&") + "og=" + Date.now();
      });
      var W = 1200, H = 630;
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.fillStyle = "#0d0d0d"; g.fillRect(0, 0, W, H);
      // recorte tipo "cover", centrado un poco arriba (rostros en retratos verticales)
      var scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      var dx = (W - dw) / 2, dy = Math.min(0, Math.max(H - dh, (H - dh) * 0.38));
      g.drawImage(img, dx, dy, dw, dh);
      var grad = g.createLinearGradient(0, H * 0.45, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.78)");
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.fillStyle = "#e91e8c"; g.fillRect(56, H - 132, 64, 5);
      g.fillStyle = "#ffffff";
      g.font = "700 54px 'Playfair Display', Georgia, serif";
      g.fillText(String(title || "Jans Photograph").slice(0, 40), 56, H - 66);
      g.font = "600 22px Inter, Arial, sans-serif";
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillText("JANS PHOTOGRAPH · PANAMÁ", 56, H - 30);
      var dataUrl;
      try { dataUrl = c.toDataURL("image/jpeg", 0.84); }
      catch (e) { throw new Error("La imagen no permite procesarse (CORS)"); }
      var url = await JansCMS.uploadBase64("og/" + String(key).replace(/[^a-z0-9-]/g, "") + ".jpg", dataUrl.split(",")[1], "image/jpeg");
      if (!url) throw new Error("No se pudo subir la imagen");
      return url;
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
