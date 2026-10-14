/*
 * jans-pdf.js — Maquetador compacto para los PDF del panel (confirmaciones, cotizaciones y facturas).
 *
 *  · Tamaño CARTA (8½ × 11 in = 215.9 × 279.4 mm) — antes se generaba en A4 y se cortaba al imprimir.
 *  · Espaciado vertical comprimido (encabezado, filas y cajas más bajos) para que todo quepa en una hoja.
 *  · Si aun así el contenido no cabe (muchos servicios, notas largas), continúa en una página nueva
 *    con encabezado reducido; nunca escribe fuera del área imprimible.
 *  · Textos largos se ajustan en varias líneas en lugar de salirse del margen.
 *  · Pie de página con "Página X de N" en todas las hojas.
 *
 * Uso:
 *   const P = JansPDF.create({ company, logo, kind: "FACTURA", number: "#001", meta: ["Emitida: …", "RUC: …"] });
 *   P.banner("RESERVA CONFIRMADA", [22,163,74]);
 *   P.section("DATOS DEL CLIENTE"); P.twoCols(left, right);
 *   P.table({ title, items: [[desc, precio, negrita?]], totals: [...], highlight: {label, value} });
 *   P.notes(texto); P.seal(texto); P.stub({...}); P.save("archivo.pdf");
 */
(function () {
  "use strict";

  var PINK = [199, 30, 95], DARK = [20, 20, 20], GREEN = [22, 163, 74];
  var money = function (n) { return "$" + (Number(n) || 0).toFixed(2); };

  function create(o) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "letter" });
    var W = doc.internal.pageSize.getWidth();   // 215.9
    var H = doc.internal.pageSize.getHeight();  // 279.4
    var M = 14;                                  // margen lateral
    var PAGE_FOOTER = o.pageFooter !== false;    // facturas: el "Gracias…" va dentro del cuerpo, no al pie
    var FOOT = PAGE_FOOTER ? 11 : 6;             // alto reservado abajo
    var BOTTOM = H - FOOT - 5;                   // último y utilizable
    var company = o.company || {};
    var y = 0;

    function font(size, style, color) {
      doc.setFontSize(size);
      doc.setFont("helvetica", style || "normal");
      if (color) doc.setTextColor(color[0], color[1], color[2]);
    }

    function header(compact) {
      var h = compact ? 13 : 21;
      doc.setFillColor(DARK[0], DARK[1], DARK[2]);
      doc.rect(0, 0, W, h, "F");
      var tx = M;
      if (!compact && o.logo) {
        try { doc.addImage(o.logo, "PNG", M, 3.5, 14, 14, undefined, "FAST"); tx = M + 18; } catch (e) {}
      }
      font(compact ? 10 : 13, "bold", [255, 255, 255]);
      doc.text(String(company.nombre || "Jans Photograph"), tx, compact ? 8.5 : 9.5);
      font(compact ? 9 : 11, "bold", [255, 255, 255]);
      doc.text(String((o.kind ? o.kind + " " : "") + (o.number || "")).trim(), W - M, compact ? 8.5 : 9.5, { align: "right" });
      if (!compact) {
        font(7, "normal", [205, 205, 205]);
        var info = [company.telefono ? "Tel: " + company.telefono : "", company.email || ""].filter(Boolean).join("   ·   ");
        if (info) doc.text(info, tx, 14);
        if (company.ubicacion) doc.text(doc.splitTextToSize(String(company.ubicacion), 110)[0], tx, 17.5);
        font(7, "normal", [180, 180, 180]);
        (o.meta || []).filter(Boolean).slice(0, 2).forEach(function (m, i) { doc.text(String(m), W - M, 14 + i * 3.6, { align: "right" }); });
      }
      y = h + 5.5;
    }

    function newPage() {
      doc.addPage("letter", "portrait");
      header(true);
    }

    /** Asegura `h` mm libres; si no caben, pasa a otra página. */
    function ensure(h) {
      if (y + h > BOTTOM) newPage();
    }

    header(false);

    var api = {
      doc: doc, W: W, H: H, M: M,
      get y() { return y; }, set y(v) { y = v; },
      ensure: ensure,
      money: money,

      banner: function (text, color) {
        ensure(9);
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(M, y, W - M * 2, 8, 1.5, 1.5, "F");
        font(10.5, "bold", [255, 255, 255]);
        doc.text(String(text), W / 2, y + 5.5, { align: "center" });
        y += 12;
      },

      section: function (title, color) {
        ensure(12);
        var c = color || PINK;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(M, y - 3.5, W - M * 2, 5, 1, 1, "F");
        font(7.5, "bold", c);
        doc.text(String(title), M + 2, y);
        y += 5;
      },

      /** Dos columnas de "Etiqueta: valor" con ajuste de texto. */
      twoCols: function (left, right, opts) {
        opts = opts || {};
        var gap = 6, colW = (W - M * 2 - gap) / 2, labW = opts.labelW || 27, lh = 3.6;
        var x1 = M + 2, x2 = M + colW + gap;
        function measure(rows) {
          return rows.map(function (r) {
            font(8.5, "bold");
            var lines = doc.splitTextToSize(String(r[1] == null || r[1] === "" ? "—" : r[1]), colW - labW - 2);
            return { label: r[0], lines: lines, h: Math.max(4.3, lines.length * lh + 0.7) };
          });
        }
        var L = measure(left || []), R = measure(right || []);
        var n = Math.max(L.length, R.length);
        for (var i = 0; i < n; i++) {
          var rh = Math.max(L[i] ? L[i].h : 0, R[i] ? R[i].h : 0);
          ensure(rh);
          [[L[i], x1], [R[i], x2]].forEach(function (pair) {
            var it = pair[0], x = pair[1];
            if (!it) return;
            font(7.5, "normal", [125, 125, 125]);
            doc.text(String(it.label), x, y);
            font(8.5, "bold", [30, 30, 30]);
            doc.text(it.lines, x + labW, y);
          });
          y += rh;
        }
        y += 1.5;
      },

      /**
       * Tabla de conceptos con totales.
       * items: [[descripcion, precio, negrita]] · totals: [{label, value, color, bold}]
       * highlight: {label, value} → barra rosa de total.
       */
      table: function (t) {
        var x0 = M, x1 = W - M, inner = x1 - x0;
        var priceW = 26, descW = inner - priceW - 8, rowLH = 3.6;
        ensure(16);
        var boxTop = y;
        y += 4.5;
        font(8, "bold", PINK);
        doc.text(String(t.title || "DETALLE"), x0 + 4, y);
        y += 4.3;
        font(7, "bold", [140, 140, 140]);
        doc.text(t.descHeader || "DESCRIPCIÓN", x0 + 4, y);
        doc.text("PRECIO", x1 - 4, y, { align: "right" });
        y += 1.6;
        doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2);
        doc.line(x0 + 4, y, x1 - 4, y);
        y += 3.9;
        var segTop = boxTop;
        function closeBox(bottom) {
          doc.setDrawColor(PINK[0], PINK[1], PINK[2]); doc.setLineWidth(0.4);
          doc.roundedRect(x0, segTop, inner, bottom - segTop, 1.5, 1.5, "S");
        }
        (t.items || []).forEach(function (it) {
          font(8.5, it[2] ? "bold" : "normal", [30, 30, 30]);
          var lines = doc.splitTextToSize(String(it[0] || "—"), descW);
          var h = lines.length * rowLH + 1.1;
          if (y + h > BOTTOM) { closeBox(y - 2); newPage(); segTop = y - 4; }
          font(8.5, it[2] ? "bold" : "normal", [30, 30, 30]);
          doc.text(lines, x0 + 4, y);
          doc.text(money(it[1]), x1 - 4, y, { align: "right" });
          y += h;
        });
        var totH = (t.totals || []).length * 4.6 + (t.highlight ? 10 : 0) + 4;
        if (y + totH > BOTTOM) { closeBox(y - 2); newPage(); segTop = y - 4; }
        doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2);
        doc.line(x0 + 4, y - 1.6, x1 - 4, y - 1.6);
        y += 2.3;
        (t.totals || []).forEach(function (r) {
          font(r.big ? 10 : 8.5, "normal", [85, 85, 85]);
          if (r.big) font(10, "bold", r.color || PINK);
          doc.text(String(r.label), x0 + 4, y);
          font(r.big ? 10 : 8.5, "bold", r.color || [30, 30, 30]);
          doc.text(String(r.value), x1 - 4, y, { align: "right" });
          y += r.big ? 5.2 : 4.6;
        });
        if (t.highlight) {
          y += 0.5;
          doc.setFillColor(PINK[0], PINK[1], PINK[2]);
          doc.roundedRect(x0 + 3, y - 4.3, inner - 6, 7.6, 1.5, 1.5, "F");
          font(10, "bold", [255, 255, 255]);
          doc.text(String(t.highlight.label), x0 + 7, y + 0.8);
          doc.text(String(t.highlight.value), x1 - 7, y + 0.8, { align: "right" });
          y += 5.6;
        }
        closeBox(y);
        y += 4;
      },

      notes: function (text, title) {
        if (!text) return;
        font(8, "normal");
        var lines = doc.splitTextToSize(String(text), W - M * 2 - 4);
        ensure(Math.min(lines.length, 3) * 3.6 + 6);
        font(7.5, "bold", [120, 120, 120]);
        doc.text(String(title || "NOTAS:"), M + 2, y);
        y += 4;
        lines.forEach(function (ln) {
          ensure(3.8);
          font(8, "normal", [70, 70, 70]);
          doc.text(ln, M + 2, y);
          y += 3.6;
        });
        y += 3;
      },

      /** Texto suelto ajustado (avisos, condiciones). */
      paragraph: function (text, opts) {
        opts = opts || {};
        font(opts.size || 7.8, opts.style || "normal");
        var lines = doc.splitTextToSize(String(text), W - M * 2 - 4);
        lines.forEach(function (ln) {
          ensure(3.8);
          font(opts.size || 7.8, opts.style || "normal", opts.color || [90, 90, 90]);
          doc.text(ln, opts.center ? W / 2 : M + 2, y, opts.center ? { align: "center" } : undefined);
          y += 3.6;
        });
        y += 2;
      },

      seal: function (text) {
        ensure(10);
        doc.setDrawColor(PINK[0], PINK[1], PINK[2]); doc.setLineWidth(0.35);
        doc.roundedRect(M, y, W - M * 2, 8.5, 1.5, 1.5, "S");
        font(8, "bolditalic", [175, 175, 175]);
        doc.text(String(text), W / 2, y + 5.5, { align: "center" });
        y += 11.5;
      },

      /** Cintillo "Gracias por confiar en nosotros" dentro del cuerpo (parte que se entrega al cliente). */
      thanksBand: function (title, line) {
        ensure(13);
        doc.setFillColor(DARK[0], DARK[1], DARK[2]);
        doc.rect(0, y, W, 11, "F");
        font(8.5, "bold", [255, 255, 255]);
        doc.text(String(title || "Gracias por confiar en nosotros"), W / 2, y + 4.6, { align: "center" });
        if (line) {
          font(6.5, "normal", [190, 190, 190]);
          doc.text(doc.splitTextToSize(String(line), W - M * 2)[0] || "", W / 2, y + 8.6, { align: "center" });
        }
        y += 15;
      },

      stubHeight: function (s) {
        var rows = Math.max((s.left || []).length, (s.right || []).length);
        return 7 + 4.2 + rows * 4.4 + 1.5 + 9 + 6;
      },

      /**
       * Cierre de factura, en este orden y siempre juntos en la misma hoja:
       *   sello → cintillo "Gracias…" (parte del cliente) → línea de corte → constancia (parte que se guarda).
       */
      invoiceClose: function (c) {
        ensure(11.5 + 15 + api.stubHeight(c.stub));
        api.seal(c.seal || "Factura que no presente sello es nula");
        api.thanksBand(c.thanksTitle, c.thanksLine);
        api.stub(c.stub);
      },

      /** Constancia recortable: se mantiene completa en una misma página. */
      stub: function (s) {
        ensure(api.stubHeight(s));
        doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
        font(6.5, "italic", [150, 150, 150]);
        doc.text("Constancia — recortar y conservar", W / 2, y + 3.6, { align: "center" });
        y += 7;
        font(7.5, "bold", PINK);
        doc.text(String(s.title || "CONSTANCIA"), M + 2, y);
        y += 4.2;
        api.twoCols(s.left || [], s.right || [], { labelW: 20 });
        if (s.signature !== false) {
          y += 3;
          doc.setDrawColor(170, 170, 170); doc.setLineWidth(0.3);
          doc.line(M + 2, y, M + 72, y);
          font(7, "normal", [120, 120, 120]);
          doc.text("Firma del cliente", M + 2, y + 3.4);
          y += 6;
        }
      },

      save: function (filename, footerTitle, footerLine) {
        var n = doc.getNumberOfPages();
        for (var p = 1; p <= n; p++) {
          doc.setPage(p);
          if (!PAGE_FOOTER) {
            if (n > 1) {
              font(6.5, "normal", [150, 150, 150]);
              doc.text("Página " + p + " de " + n, W - M, H - 5, { align: "right" });
            }
            continue;
          }
          doc.setFillColor(DARK[0], DARK[1], DARK[2]);
          doc.rect(0, H - FOOT, W, FOOT, "F");
          font(8, "bold", [255, 255, 255]);
          doc.text(String(footerTitle || "Gracias por confiar en nosotros"), W / 2, H - FOOT + 4.4, { align: "center" });
          font(6.5, "normal", [190, 190, 190]);
          doc.text(doc.splitTextToSize(String(footerLine || ""), W - M * 2 - 30)[0] || "", W / 2, H - FOOT + 8.4, { align: "center" });
          if (n > 1) {
            font(6.5, "normal", [190, 190, 190]);
            doc.text("Página " + p + " de " + n, W - M, H - FOOT + 8.4, { align: "right" });
          }
        }
        doc.save(filename);
        return doc;
      }
    };
    return api;
  }

  window.JansPDF = { create: create, money: money, PINK: PINK, GREEN: GREEN };
})();
