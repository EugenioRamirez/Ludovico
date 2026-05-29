// ── planificacion.js · Planificación de Producción ───────────────────────────
// Usa el array global RECETAS (calculadora.js) y BASE_LITROS = 2.5

const Planificacion = {
  lista: [],
  _filtrosBound: false,
  _planActual: null,   // planificación abierta en el worksheet

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _fmtKg(g) {
    if (g === null || g === undefined) return '—';
    if (g >= 1000) return (g / 1000).toFixed(2).replace('.', ',') + ' kg';
    return Math.round(g) + ' g';
  },

  _estadoBadge(estado) {
    const cfg = {
      borrador:  { cls: 'badge-pendiente', txt: '✏️ Borrador' },
      calculada: { cls: 'badge-revisada',  txt: '🧮 Calculada' },
      cerrada:   { cls: 'badge-facturada', txt: '🔒 Cerrada' },
    };
    const c = cfg[estado] || { cls: '', txt: estado };
    return `<span class="badge ${c.cls}">${c.txt}</span>`;
  },

  _calcLinea(receta, litros) {
    const base   = receta.litros_base || BASE_LITROS;
    const factor = litros / base;
    const ings = receta.ingredientes.map(([nombre, g]) => ({
      nombre,
      cantidad_g: g !== null && g !== undefined ? g * factor : null,
    }));
    return { factor, ings };
  },

  _consolidar(lineasCalc) {
    const mapa = {};
    lineasCalc.forEach(lc => {
      (lc.ings || []).forEach(ing => {
        if (ing.cantidad_g === null) return;
        const key = ing.nombre.trim().toLowerCase();
        if (!mapa[key]) mapa[key] = { nombre: ing.nombre, total_g: 0 };
        mapa[key].total_g += ing.cantidad_g;
      });
    });
    return Object.values(mapa).sort((a, b) => b.total_g - a.total_g);
  },

  // ── Carga principal (lista) ───────────────────────────────────────────────────

  async load() {
    if (!this._filtrosBound) {
      document.querySelectorAll('.plan-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.plan-filtro').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderList();
        });
      });
      this._filtrosBound = true;
    }

    const el = document.getElementById('plan-list');
    el.innerHTML = '<div class="spinner-wrap" style="padding:24px"><div class="spinner"></div></div>';

    const { data, error } = await sb
      .from('planificaciones_produccion')
      .select('*')
      .order('fecha_planificacion', { ascending: false });

    if (error) {
      el.innerHTML = '<div class="empty-msg error-msg">Error al cargar planificaciones</div>';
      return;
    }
    this.lista = data || [];
    this.renderList();
  },

  renderList() {
    const el      = document.getElementById('plan-list');
    const filtro  = document.querySelector('.plan-filtro.active')?.dataset.estado || 'todos';
    const filtradas = filtro === 'todos' ? this.lista : this.lista.filter(p => p.estado === filtro);

    if (!filtradas.length) {
      el.innerHTML = '<div class="empty-msg">No hay planificaciones' + (filtro !== 'todos' ? ' con este estado' : '') + '.<br><small>Usa ＋ para crear una nueva.</small></div>';
      return;
    }

    el.innerHTML = filtradas.map(p => {
      const nombre = p.nombre || `Planificación ${fmtFecha(p.fecha_planificacion)}`;
      const fObj   = p.fecha_objetivo ? `<span class="plan-card-fobj">→ objetivo ${fmtFecha(p.fecha_objetivo)}</span>` : '';
      return `
        <div class="plan-card" id="plan-card-${p.id}" onclick="Planificacion.abrirWorksheet('${p.id}')">
          <div class="plan-card-left">
            <span class="plan-card-nombre">${escHtml(nombre)}</span>
            <span class="plan-card-meta">${fmtFecha(p.fecha_planificacion)} ${fObj}</span>
          </div>
          <div class="plan-card-right">
            ${this._estadoBadge(p.estado)}
            <span class="plan-card-arrow">›</span>
          </div>
        </div>`;
    }).join('');
  },

  // ── Modal creación (solo cabecera) ────────────────────────────────────────────

  abrirModalNueva() {
    document.getElementById('plan-modal-nombre').value = '';
    document.getElementById('plan-modal-fecha').value  = new Date().toISOString().split('T')[0];
    document.getElementById('plan-modal-fecha-obj').value = '';
    document.getElementById('plan-modal-obs').value    = '';
    document.getElementById('plan-modal-error').textContent = '';
    openModal('modal-plan-overlay');
    setTimeout(() => document.getElementById('plan-modal-nombre').focus(), 100);
  },

  async crearPlanificacion() {
    const empleada = Estado.getEmpleada();
    const nombre   = document.getElementById('plan-modal-nombre').value.trim();
    const fecha    = document.getElementById('plan-modal-fecha').value;
    const fechaObj = document.getElementById('plan-modal-fecha-obj').value;
    const obs      = document.getElementById('plan-modal-obs').value.trim();
    const errEl    = document.getElementById('plan-modal-error');

    if (!fecha) { errEl.textContent = 'La fecha de planificación es obligatoria.'; return; }

    const btn = document.getElementById('plan-btn-crear');
    btn.disabled = true;
    errEl.textContent = '';

    try {
      const { data: inserted, error } = await sb
        .from('planificaciones_produccion')
        .insert({
          nombre:              nombre || null,
          fecha_planificacion: fecha,
          fecha_objetivo:      fechaObj || null,
          observaciones:       obs || null,
          estado:              'borrador',
          usuario_creador:     empleada,
        })
        .select()
        .single();

      if (error) throw error;

      closeModal('modal-plan-overlay');
      await this.load();
      this.abrirWorksheet(inserted.id);

    } catch (e) {
      errEl.textContent = 'Error al crear: ' + (e.message || e.code || JSON.stringify(e));
    } finally {
      btn.disabled = false;
    }
  },

  // ── Worksheet (pantalla de planificación) ────────────────────────────────────

  async abrirWorksheet(planId) {
    const plan = this.lista.find(p => p.id === planId);
    if (!plan) return;
    this._planActual = plan;

    // Cargar líneas guardadas
    const { data: lineas } = await sb
      .from('planificacion_lineas')
      .select('receta_nombre, litros_solicitados')
      .eq('planificacion_id', planId);

    const litrosPorReceta = {};
    (lineas || []).forEach(l => { litrosPorReceta[l.receta_nombre] = l.litros_solicitados; });

    this._renderWorksheet(plan, litrosPorReceta);
    openModal('modal-plan-ws-overlay');
  },

  _renderWorksheet(plan, litrosPorReceta) {
    const esCerrada = plan.estado === 'cerrada';
    const nombre    = plan.nombre || `Planificación ${fmtFecha(plan.fecha_planificacion)}`;

    // Cabecera
    document.getElementById('ws-titulo').textContent    = nombre;
    document.getElementById('ws-fecha').textContent     = fmtFecha(plan.fecha_planificacion);
    document.getElementById('ws-estado').innerHTML      = this._estadoBadge(plan.estado);

    // Botones de acción
    const acciones = document.getElementById('ws-acciones');
    if (esCerrada) {
      acciones.innerHTML = `
        <span class="plan-cerrada-msg">🔒 Planificación cerrada — solo lectura</span>
        <button class="btn btn-ghost btn-sm" onclick="Planificacion.generarPDF('${plan.id}')">📄 Descargar PDF</button>
        <button class="btn btn-danger-outline btn-sm" onclick="Planificacion.eliminar('${plan.id}')">🗑️ Eliminar</button>`;
    } else {
      acciones.innerHTML = `
        <button class="btn btn-ghost btn-sm" onclick="Planificacion._editarCabecera('${plan.id}')">✏️ Editar datos</button>
        <button class="btn btn-primary btn-sm" id="ws-btn-guardar" onclick="Planificacion.guardarLineas('${plan.id}')">💾 Guardar</button>
        ${plan.estado === 'borrador'
          ? `<button class="btn btn-secondary btn-sm" onclick="Planificacion.marcarCalculada('${plan.id}')">🧮 Marcar calculada</button>`
          : ''}
        <button class="btn btn-ghost btn-sm" onclick="Planificacion.generarPDF('${plan.id}')">📄 PDF</button>
        <button class="btn btn-danger-outline btn-sm" onclick="Planificacion.cerrar('${plan.id}')">🔒 Cerrar</button>
        <button class="btn btn-danger-outline btn-sm" onclick="Planificacion.eliminar('${plan.id}')">🗑️ Eliminar</button>`;
    }

    // Grid de sabores por categoría
    const cats = {};
    RECETAS.forEach(r => {
      if (!cats[r.categoria]) cats[r.categoria] = [];
      cats[r.categoria].push(r);
    });

    let gridHtml = '';
    Object.entries(cats).forEach(([cat, recetas]) => {
      gridHtml += `<div class="ws-cat-header">${escHtml(cat)}</div>`;
      recetas.forEach(r => {
        const val    = litrosPorReceta[r.nombre] || '';
        const rowCls = val ? 'ws-sabor-row ws-sabor-row-filled' : 'ws-sabor-row';
        gridHtml += `
          <div class="${rowCls}" id="ws-row-${CSS.escape(r.nombre)}">
            <span class="ws-sabor-nombre">${escHtml(r.nombre)}</span>
            <div class="ws-sabor-input-wrap">
              <input type="number" class="ws-litros-input" data-receta="${escHtml(r.nombre)}"
                placeholder="—" min="0.5" step="0.5" value="${val}"
                ${esCerrada ? 'readonly' : ''}
                oninput="Planificacion._onLitrosChange(this)">
              <span class="ws-litros-unit">L</span>
            </div>
          </div>`;
      });
    });

    document.getElementById('ws-grid').innerHTML = gridHtml;

    // Calcular ingredientes con los valores actuales
    this._recalcularIngredientes();
  },

  _toggleDetalleSabores(btn) {
    const detalle = btn.closest('#ws-resumen').querySelector('.ws-detalle-sabores');
    const oculto  = detalle.classList.toggle('hidden');
    btn.textContent = oculto ? 'Ver por sabor ▾' : 'Ocultar detalle ▴';
  },

  _onLitrosChange(input) {
    // Resaltar la fila si tiene valor
    const fila = input.closest('.ws-sabor-row');
    const val  = parseFloat(input.value);
    if (val > 0) fila.classList.add('ws-sabor-row-filled');
    else         fila.classList.remove('ws-sabor-row-filled');
    // Recalcular ingredientes en tiempo real
    this._recalcularIngredientes();
  },

  _recalcularIngredientes() {
    const inputs   = document.querySelectorAll('.ws-litros-input');
    const lineasCalc = [];

    inputs.forEach(inp => {
      const litros  = parseFloat(inp.value);
      if (!litros || litros <= 0) return;
      const receta  = RECETAS.find(r => r.nombre === inp.dataset.receta);
      if (!receta) return;
      const { factor, ings } = this._calcLinea(receta, litros);
      lineasCalc.push({ receta_nombre: receta.nombre, litros, factor, ings });
    });

    const elResumen = document.getElementById('ws-resumen');

    if (!lineasCalc.length) {
      elResumen.innerHTML = '<div class="ws-empty-calc">Introduce litros en al menos un sabor para ver el cálculo de ingredientes.</div>';
      return;
    }

    const totalLitros = lineasCalc.reduce((s, l) => s + l.litros, 0);
    const consolidado = this._consolidar(lineasCalc);
    const totalMasaG  = consolidado.reduce((s, c) => s + c.total_g, 0);

    // Detalle por sabor (colapsado por defecto)
    const detalleSaboresHtml = lineasCalc.map(l => `
      <div class="ws-res-sabor">
        <div class="ws-res-sabor-header">
          <span>${escHtml(l.receta_nombre)}</span>
          <span class="ws-res-sabor-meta">${fmtNum(l.litros)} L · ×${l.factor.toFixed(2)}</span>
        </div>
        <table class="plan-ing-table">
          <tbody>
            ${l.ings.map(ing => `
              <tr>
                <td>${escHtml(ing.nombre)}</td>
                <td class="plan-ing-qty">${this._fmtKg(ing.cantidad_g)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

    const html = `
      <!-- Resumen de sabores seleccionados -->
      <div class="ws-res-summary-bar">
        <span class="ws-res-summary-txt">🍨 ${lineasCalc.length} sabor${lineasCalc.length > 1 ? 'es' : ''} · ${fmtNum(totalLitros)} L totales</span>
        <button class="ws-btn-toggle-detalle" onclick="Planificacion._toggleDetalleSabores(this)">Ver por sabor ▾</button>
      </div>

      <!-- Detalle por sabor (oculto por defecto) -->
      <div class="ws-res-sabores ws-detalle-sabores hidden">
        ${detalleSaboresHtml}
      </div>

      <!-- Consolidado (siempre visible) -->
      <div class="ws-res-consolidado">
        <div class="ws-res-titulo">📊 Ingredientes consolidados</div>
        <table class="plan-ing-table plan-ing-table-full">
          <thead><tr><th>Ingrediente</th><th class="plan-ing-qty">Total</th></tr></thead>
          <tbody>
            ${consolidado.map(c => `
              <tr>
                <td>${escHtml(c.nombre)}</td>
                <td class="plan-ing-qty plan-ing-qty-total">${this._fmtKg(c.total_g)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Masa total</strong></td>
              <td class="plan-ing-qty"><strong>${this._fmtKg(totalMasaG)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    elResumen.innerHTML = html;
  },

  // ── Guardar líneas desde el worksheet ────────────────────────────────────────

  async guardarLineas(planId) {
    const filas = [];
    document.querySelectorAll('.ws-litros-input').forEach(inp => {
      const litros = parseFloat(inp.value);
      if (litros > 0) filas.push({ planificacion_id: planId, receta_nombre: inp.dataset.receta, litros_solicitados: litros });
    });

    const btn = document.getElementById('ws-btn-guardar');
    if (btn) btn.disabled = true;

    try {
      // Borrar líneas anteriores y reinsertar
      await sb.from('planificacion_lineas').delete().eq('planificacion_id', planId);

      if (filas.length) {
        const { error } = await sb.from('planificacion_lineas').insert(filas);
        if (error) throw error;
      }

      showToast(`Planificación guardada (${filas.length} sabor${filas.length !== 1 ? 'es' : ''})`, 'success');
      await this.load();
      // Actualizar el plan en el worksheet
      this._planActual = this.lista.find(p => p.id === planId);

    } catch (e) {
      showToast('Error al guardar: ' + (e.message || ''), 'error');
      console.error('guardarLineas:', e);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ── Cambios de estado ─────────────────────────────────────────────────────────

  async marcarCalculada(planId) {
    const { error } = await sb
      .from('planificaciones_produccion')
      .update({ estado: 'calculada' })
      .eq('id', planId);
    if (error) { showToast('Error al actualizar estado', 'error'); return; }
    showToast('Planificación marcada como calculada', 'success');
    await this.load();
    this._planActual = this.lista.find(p => p.id === planId);
    // Refrescar acciones en el worksheet
    const litrosPorReceta = {};
    document.querySelectorAll('.ws-litros-input').forEach(inp => {
      const v = parseFloat(inp.value);
      if (v > 0) litrosPorReceta[inp.dataset.receta] = v;
    });
    this._renderWorksheet(this._planActual, litrosPorReceta);
  },

  async cerrar(planId) {
    if (!confirm('¿Cerrar esta planificación? No podrá modificarse.')) return;
    const { error } = await sb
      .from('planificaciones_produccion')
      .update({ estado: 'cerrada' })
      .eq('id', planId);
    if (error) { showToast('Error al cerrar', 'error'); return; }
    showToast('Planificación cerrada', 'info');
    closeModal('modal-plan-ws-overlay');
    await this.load();
  },

  async eliminar(planId) {
    if (!confirm('¿Eliminar esta planificación? Esta acción no se puede deshacer.')) return;
    const { error } = await sb
      .from('planificaciones_produccion')
      .delete()
      .eq('id', planId);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    showToast('Planificación eliminada', 'info');
    closeModal('modal-plan-ws-overlay');
    await this.load();
  },

  async generarPDF(planId) {
    const plan = this.lista.find(p => p.id === planId);
    if (!plan) return;

    const { data: lineas } = await sb
      .from('planificacion_lineas')
      .select('*')
      .eq('planificacion_id', planId)
      .order('created_at');

    // Calcular
    const lineasCalc = (lineas || []).map(l => {
      const receta = this._findReceta(l.receta_nombre);
      if (!receta) return null;
      const { factor, ings } = this._calcLinea(receta, parseFloat(l.litros_solicitados));
      return { ...l, receta, factor, ings };
    }).filter(Boolean);

    const consolidado  = this._consolidar(lineasCalc);
    const totalLitros  = lineasCalc.reduce((s, l) => s + parseFloat(l.litros_solicitados), 0);
    const totalMasaG   = consolidado.reduce((s, c) => s + c.total_g, 0);
    const nombre       = plan.nombre || `Planificación ${fmtFecha(plan.fecha_planificacion)}`;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, margin = 14;
    let y = 0;

    // ── Cabecera ────────────────────────────────────────────────────────────
    doc.setFillColor(21, 101, 160);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Helados Ludovico · Planificación de Producción', margin, 14);
    y = 30;

    // ── Datos planificación ─────────────────────────────────────────────────
    doc.setTextColor(13, 46, 74);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(nombre, margin, y); y += 7;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 142, 170);
    let meta = `Fecha: ${fmtFecha(plan.fecha_planificacion)}`;
    if (plan.fecha_objetivo) meta += `   |   Objetivo: ${fmtFecha(plan.fecha_objetivo)}`;
    meta += `   |   Estado: ${plan.estado}`;
    doc.text(meta, margin, y); y += 5;
    if (plan.observaciones) {
      doc.text(`Obs: ${plan.observaciones}`, margin, y); y += 5;
    }
    y += 3;

    // ── Resumen sabores ─────────────────────────────────────────────────────
    doc.setFillColor(224, 246, 250);
    doc.rect(margin, y, W - margin * 2, 7, 'F');
    doc.setTextColor(13, 46, 74); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Sabores planificados — ${lineasCalc.length} sabores · ${fmtNum(totalLitros)} L totales`, margin + 2, y + 5);
    y += 10;

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    lineasCalc.forEach(l => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setTextColor(21, 101, 160);
      doc.text(`${l.receta_nombre}`, margin, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 142, 170);
      doc.text(`${fmtNum(l.litros_solicitados)} L · ×${l.factor.toFixed(2)}`, W - margin, y, { align: 'right' });
      y += 5;
    });
    y += 4;

    // ── Ingredientes consolidados ───────────────────────────────────────────
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFillColor(21, 101, 160);
    doc.rect(margin, y, W - margin * 2, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Ingredientes consolidados', margin + 2, y + 5);
    y += 10;

    // Cabecera tabla
    doc.setFillColor(240, 244, 248);
    doc.rect(margin, y, W - margin * 2, 6, 'F');
    doc.setTextColor(13, 46, 74); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Ingrediente', margin + 2, y + 4);
    doc.text('Cantidad total', W - margin - 2, y + 4, { align: 'right' });
    y += 7;

    // Filas
    doc.setFont('helvetica', 'normal');
    consolidado.forEach((c, i) => {
      if (y > 275) { doc.addPage(); y = 20; }
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1, W - margin * 2, 6, 'F');
      }
      doc.setTextColor(13, 46, 74);
      doc.text(c.nombre, margin + 2, y + 3);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(21, 101, 160);
      doc.text(this._fmtKg(c.total_g), W - margin - 2, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 6;
    });

    // Total masa
    y += 2;
    doc.setDrawColor(197, 223, 240);
    doc.line(margin, y, W - margin, y); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 46, 74); doc.setFontSize(9);
    doc.text('Masa total', margin + 2, y + 3);
    doc.text(this._fmtKg(totalMasaG), W - margin - 2, y + 3, { align: 'right' });

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} · Helados Ludovico`, W / 2, 290, { align: 'center' });

    const filename = `planificacion_${(nombre).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${plan.fecha_planificacion}.pdf`;
    doc.save(filename);
  },

  _findReceta(nombre) {
    return RECETAS.find(r => r.nombre === nombre) || null;
  },

  async _editarCabecera(planId) {
    const plan = this.lista.find(p => p.id === planId);
    if (!plan) return;
    document.getElementById('plan-modal-nombre').value        = plan.nombre || '';
    document.getElementById('plan-modal-fecha').value         = plan.fecha_planificacion || '';
    document.getElementById('plan-modal-fecha-obj').value     = plan.fecha_objetivo || '';
    document.getElementById('plan-modal-obs').value           = plan.observaciones || '';
    document.getElementById('plan-modal-error').textContent   = '';
    // Cambiar modo del modal a "editar"
    document.getElementById('plan-modal-titulo').textContent  = 'Editar planificación';
    document.getElementById('plan-btn-crear').textContent     = '💾 Guardar cambios';
    document.getElementById('plan-btn-crear').onclick         = () => this._guardarCabecera(planId);
    openModal('modal-plan-overlay');
  },

  async _guardarCabecera(planId) {
    const nombre   = document.getElementById('plan-modal-nombre').value.trim();
    const fecha    = document.getElementById('plan-modal-fecha').value;
    const fechaObj = document.getElementById('plan-modal-fecha-obj').value;
    const obs      = document.getElementById('plan-modal-obs').value.trim();
    const errEl    = document.getElementById('plan-modal-error');

    if (!fecha) { errEl.textContent = 'La fecha es obligatoria.'; return; }

    const { error } = await sb
      .from('planificaciones_produccion')
      .update({ nombre: nombre || null, fecha_planificacion: fecha, fecha_objetivo: fechaObj || null, observaciones: obs || null })
      .eq('id', planId);

    if (error) { errEl.textContent = 'Error: ' + error.message; return; }

    closeModal('modal-plan-overlay');
    // Restaurar modal a modo "crear"
    document.getElementById('plan-modal-titulo').textContent = 'Nueva planificación';
    document.getElementById('plan-btn-crear').textContent    = '➡️ Crear y añadir sabores';
    document.getElementById('plan-btn-crear').onclick        = () => this.crearPlanificacion();

    await this.load();
    this._planActual = this.lista.find(p => p.id === planId);
    // Actualizar cabecera del worksheet sin recargar grid
    document.getElementById('ws-titulo').textContent = this._planActual.nombre || `Planificación ${fmtFecha(this._planActual.fecha_planificacion)}`;
    document.getElementById('ws-fecha').textContent  = fmtFecha(this._planActual.fecha_planificacion);
    showToast('Datos actualizados', 'success');
  },
};
