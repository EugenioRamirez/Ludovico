// ── pdf.js · Exportación PDF con jsPDF ───────────────────────────────────────

const PdfExport = {

  exportarCompras(items) {
    if (!items || !items.length) {
      showToast('No hay ítems en la lista', 'info');
      return;
    }

    // Filtrar no-recibidos (pendiente + pedido)
    const activos = items.filter(i => i.estado !== 'recibido');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // ── Colores de marca ──────────────────────────────────────────────────────
    const BLUE   = [21, 101, 160];
    const CYAN   = [0, 180, 204];
    const ORANGE = [245, 130, 31];
    const WHITE  = [255, 255, 255];
    const LIGHT  = [245, 248, 252];
    const DARK   = [30, 40, 60];
    const GRAY   = [120, 130, 150];

    const W    = 210;
    const H    = 297;
    const ML   = 14;
    const MR   = W - 14;
    const CW   = MR - ML;

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 30, 'F');

    doc.setFillColor(...CYAN);
    doc.rect(0, 30, W, 3, 'F');

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Helados Ludovico', ML, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Lista de Compras', ML, 21);

    // Fecha
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(...CYAN);
    doc.text(fecha, MR, 21, { align: 'right' });

    // ── Generado por ──────────────────────────────────────────────────────────
    const empleada = Estado.getEmpleada() || 'Empleada';
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.text(`Generado por: ${empleada}`, ML, 40);

    // ── Resumen de estados ────────────────────────────────────────────────────
    const pendCount  = items.filter(i => i.estado === 'pendiente').length;
    const pedidCount = items.filter(i => i.estado === 'pedido').length;
    const recvCount  = items.filter(i => i.estado === 'recibido').length;

    doc.setFillColor(...LIGHT);
    doc.roundedRect(ML, 44, CW, 18, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);

    const col = CW / 3;
    [
      { lbl: 'Pendiente',  val: pendCount,  color: ORANGE },
      { lbl: 'Pedido',     val: pedidCount, color: CYAN },
      { lbl: 'Recibido',   val: recvCount,  color: [126, 200, 85] },
    ].forEach((s, i) => {
      const x = ML + col * i + col / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...s.color);
      doc.text(String(s.val), x, 54, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(s.lbl, x, 59, { align: 'center' });
    });

    // ── Tabla ─────────────────────────────────────────────────────────────────
    let y = 70;

    // Cabecera de tabla
    doc.setFillColor(...BLUE);
    doc.rect(ML, y, CW, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PRODUCTO',  ML + 3,       y + 5.5);
    doc.text('CANTIDAD',  ML + 100,     y + 5.5);
    doc.text('ESTADO',    ML + 135,     y + 5.5);
    doc.text('QUIÉN',     ML + 162,     y + 5.5);

    y += 8;

    // Filas
    const estadoInfo = {
      pendiente: { lbl: 'Pendiente',  color: ORANGE },
      pedido:    { lbl: 'Pedido',     color: CYAN   },
      recibido:  { lbl: 'Recibido',   color: [126, 200, 85] },
    };

    items.forEach((item, idx) => {
      if (y > H - 20) {
        doc.addPage();
        y = 20;
        // mini cabecera en páginas siguientes
        doc.setFillColor(...BLUE);
        doc.rect(0, 0, W, 10, 'F');
        doc.setTextColor(...WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Helados Ludovico · Lista de Compras (cont.)', ML, 7);
        y = 16;
      }

      const rowH = 9;
      const bg   = idx % 2 === 0 ? WHITE : LIGHT;
      doc.setFillColor(...bg);
      doc.rect(ML, y, CW, rowH, 'F');

      const nombre   = item.productos ? item.productos.nombre : (item.nombre_libre || '–');
      const unidad   = item.unidad || (item.productos ? item.productos.unidad : '') || '';
      const qty      = item.cantidad != null ? `${fmtNum(item.cantidad)} ${unidad}` : (unidad || '–');
      const info     = estadoInfo[item.estado] || estadoInfo.pendiente;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...DARK);

      // truncar nombre a 40 chars
      const nomTxt = nombre.length > 38 ? nombre.substring(0, 37) + '…' : nombre;
      doc.text(nomTxt,         ML + 3,   y + 6);
      doc.text(qty,            ML + 100, y + 6);

      // Estado con color
      doc.setTextColor(...info.color);
      doc.setFont('helvetica', 'bold');
      doc.text(info.lbl,       ML + 135, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      const empTxt = (item.empleada || '').split(' ')[0]; // solo primer nombre
      doc.text(empTxt,         ML + 162, y + 6);

      // Notas debajo si las hay
      if (item.notas) {
        y += rowH;
        doc.setFillColor(...bg);
        doc.rect(ML, y, CW, 6, 'F');
        doc.setTextColor(...GRAY);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const notaTxt = item.notas.length > 80 ? item.notas.substring(0, 79) + '…' : item.notas;
        doc.text(`  ↳ ${notaTxt}`, ML + 3, y + 4.5);
        y += 6;
      } else {
        y += rowH;
      }

      // línea separadora
      doc.setDrawColor(220, 225, 235);
      doc.line(ML, y, MR, y);
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...BLUE);
      doc.rect(0, H - 10, W, 10, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Helados Ludovico · Sistema de Inventario', ML, H - 3.5);
      doc.text(`Página ${p} / ${totalPages}`, MR, H - 3.5, { align: 'right' });
    }

    // ── Descargar ─────────────────────────────────────────────────────────────
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    doc.save(`Compras_Ludovico_${ts}.pdf`);
    showToast('PDF generado ✓', 'success');
  }
};
