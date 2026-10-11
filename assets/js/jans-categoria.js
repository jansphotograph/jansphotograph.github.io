/*
 * jans-categoria.js — Galería, planes y preguntas frecuentes de una página de categoría.
 * Requiere jans-public.js.  Uso:  JansCategoria.init({ slug: "retratos" })
 *
 * Cada sección tiene estado de carga (esqueleto), vacío (mensaje + acción) y error (reintentar).
 * Lo guardado en el navegador se muestra al instante y se actualiza con Supabase.
 */
(function () {
  "use strict";
  var P = window.JansPub, esc = P.esc;

  function cache(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  var UBIC = {
    estudio: { icon: "🏠", label: "Sesión en estudio" },
    exterior: { icon: "🌿", label: "Sesión en exterior" }
  };

  function planCard(p) {
    var popular = !!p.popular;
    var ub = UBIC[p.ubicacion] || UBIC.estudio;
    var href = "../quotes/reservas.html?plan=" + encodeURIComponent(p.nombre || "") +
      "&precio=" + encodeURIComponent(p.precio || 0) +
      (p.id ? "&plan_id=" + encodeURIComponent(p.id) : "") +
      "&ubicacion=" + encodeURIComponent(p.ubicacion === "exterior" ? "exterior" : "estudio");
    return '<div class="plan-card-pub' + (popular ? " plan-popular" : "") + '">' +
      (popular ? '<div class="popular-badge">⭐ Más Popular</div>' : "") +
      '<div class="pc-name' + (popular ? " pc-name-popular" : "") + '">' + esc(p.nombre) + "</div>" +
      '<div class="pc-ubicacion pc-ubicacion-' + (p.ubicacion === "exterior" ? "exterior" : "estudio") + '">' + ub.icon + " " + ub.label + "</div>" +
      '<div class="pc-price">$' + esc(p.precio) + "<span> USD</span></div>" +
      '<ul class="pc-includes">' + (p.incluye || []).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" +
      '<a href="' + esc(href) + '" class="btn-agendar">Agendar</a></div>';
  }

  function initGallery(slug) {
    var grid = document.getElementById("catalogGrid");
    if (!grid) return;
    var hasStatic = !!grid.querySelector(".catalog-item img");
    var key = "jans_galeria_" + slug;

    function render(list) {
      grid.removeAttribute("aria-busy");
      grid.innerHTML = list.map(function (img, i) {
        return '<div class="catalog-item"><img src="' + esc(P.img(img.imagen)) + '" alt="Foto ' + (i + 1) +
          ' de la galería" loading="lazy" onerror="this.parentElement.style.display=\'none\'" /></div>';
      }).join("");
    }
    function emptyState() {
      P.empty(grid, {
        icon: "camera", title: "Galería en preparación",
        text: "Estamos seleccionando las mejores fotos de esta categoría. Mientras tanto, mira nuestras sesiones más recientes en Instagram.",
        actions: [{ label: "Ver Instagram", href: "https://www.instagram.com/jans_photograph/" }]
      });
    }
    async function load() {
      try {
        var rows = await P.table("galeria_categoria?select=imagen,orden&categoria=eq." + encodeURIComponent(slug) + "&order=orden.asc");
        cache(key, rows);
        if (rows.length) render(rows);
        else if (!hasStatic) emptyState();
      } catch (e) {
        if (!hasStatic && !(cache(key) || []).length) P.error(grid, { title: "No pudimos cargar la galería", retry: function () { P.loading(grid, "tiles", 8); load(); } });
      }
    }
    var cached = cache(key) || [];
    if (cached.length) render(cached);
    else if (!hasStatic) P.loading(grid, "tiles", 8, "Cargando galería…");
    load();
  }

  function initPlans(slug) {
    var box = document.getElementById("planCardsContainer");
    if (!box) return;
    function render(all) {
      var plans = (all || []).filter(function (p) { return p.categoria === slug || p.categoria === "todos"; });
      box.removeAttribute("aria-busy");
      if (!plans.length) {
        P.empty(box, {
          icon: "tag", title: "Planes en preparación",
          text: "Muy pronto publicaremos los planes de esta categoría. Escríbenos y te armamos una propuesta a tu medida.",
          actions: [{ label: "Escribir por WhatsApp", href: P.WA }, { label: "Ver otras categorías", href: "../servicios.html" }]
        });
        return;
      }
      box.innerHTML = plans.map(planCard).join("");
    }
    async function load() {
      try {
        var rows = await P.table("planes_publicos?select=*&order=orden.asc");
        cache("jans_planes", rows);
        render(rows);
      } catch (e) {
        if (!box.querySelector(".plan-card-pub")) P.error(box, { title: "No pudimos cargar los planes", retry: function () { P.loading(box, "plans", 3); load(); } });
      }
    }
    var cached = cache("jans_planes");
    if (Array.isArray(cached) && cached.length) render(cached);
    else P.loading(box, "plans", 3, "Cargando planes…");
    load();
  }

  function initFaqs() {
    var box = document.getElementById("faqContainer");
    var section = document.getElementById("aclaracionesSection");
    if (!box) return;
    function render(faqs) {
      box.removeAttribute("aria-busy");
      if (!Array.isArray(faqs) || !faqs.length) { if (section) section.style.display = "none"; return; }
      if (section) section.style.display = "";
      box.innerHTML = faqs.map(function (f) {
        return '<details class="aclaracion-item"><summary>' + esc(f.pregunta) + "</summary><p>" + esc(f.respuesta) + "</p></details>";
      }).join("");
    }
    var cached = cache("jans_faqs");
    if (Array.isArray(cached) && cached.length) render(cached);
    else P.loading(box, "faq", 3, "Cargando preguntas frecuentes…");
    P.json("faqs").then(function (faqs) {
      if (faqs) cache("jans_faqs", faqs);
      if (faqs || !box.querySelector(".aclaracion-item")) render(faqs || []);
    });
  }

  window.JansCategoria = {
    planCard: planCard,
    init: function (o) {
      var slug = String(o.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!slug) return;
      initGallery(slug);
      initPlans(slug);
      initFaqs();
      P.watchVersion();
    }
  };
})();
