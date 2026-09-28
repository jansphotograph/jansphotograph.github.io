/*
 * admin-guard.js — Protección de las páginas del panel (master.html y mstr/*.html)
 *
 * Cargar JUSTO DESPUÉS del SDK de Supabase y antes del contenido:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="../js/admin-guard.js"></script>          (desde assets/pages/)
 *   <script src="../../js/admin-guard.js"></script>       (desde assets/pages/mstr/)
 *
 * - Oculta la página hasta confirmar que hay sesión Y que el correo es admin
 *   (función es_admin() en Supabase, que consulta la tabla admin_emails).
 * - Si no hay sesión, no es admin, o la sesión se cierra/expira → a auth.html.
 * - Expone window._jansAuthClient, window._jansAdminEmail, window.jansAdminReady
 *   (Promise<boolean>) y window.jansLogout().
 *
 * Esto es una capa de interfaz. La protección real de los datos son las
 * políticas RLS de supabase/seguridad-admin.sql.
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://qwwotzscuwnduzlralew.supabase.co";
  var SUPABASE_KEY = "sb_publishable_kiy_NJVZUEYTcNkzPDUdWA_7zpTL99g";

  var script = document.currentScript;
  var AUTH_URL = new URL("../pages/auth/auth.html", script ? script.src : location.href).href;

  // Ocultar todo hasta verificar (evita que se vea el panel un instante)
  var hideStyle = document.createElement("style");
  hideStyle.id = "jans-guard-hide";
  hideStyle.textContent = "html{visibility:hidden!important}";
  document.head.appendChild(hideStyle);

  var redirecting = false;
  function toAuth(reason) {
    if (redirecting) return;
    redirecting = true;
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf("sb-") === 0 || k === "jans_master_auth") sessionStorage.removeItem(k);
      });
    } catch (e) {}
    location.replace(AUTH_URL + (reason ? "?e=" + encodeURIComponent(reason) : ""));
  }

  var client = null;
  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
    });
  } catch (e) {
    toAuth();
    return;
  }
  window._jansAuthClient = client;

  var loggingOut = false;
  window.jansLogout = async function () {
    loggingOut = true;
    try { await client.auth.signOut(); } catch (e) {}
    toAuth();
  };

  window.jansAdminReady = (async function () {
    try {
      var res = await client.auth.getSession();
      var session = res && res.data && res.data.session;
      if (!session) { toAuth(); return false; }

      var chk = await client.rpc("es_admin");
      if (chk.error || chk.data !== true) {
        loggingOut = true;
        try { await client.auth.signOut(); } catch (e) {}
        toAuth("noadmin");
        return false;
      }

      window._jansAdminEmail = session.user && session.user.email;
      hideStyle.remove();
      return true;
    } catch (e) {
      toAuth();
      return false;
    }
  })();

  client.auth.onAuthStateChange(function (event, session) {
    if (loggingOut) return;
    if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) toAuth("expirada");
  });

  // Si alguien vuelve con "atrás" tras cerrar sesión (bfcache), revalidar
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) location.reload();
  });
})();
