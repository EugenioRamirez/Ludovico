// ── produccion.js · Control de Producción Kanban ─────────────────────────────

const Produccion = {

  _accion: null,   // { tipo, id, nombre, max }

  // ── Cargar pantalla ──────────────────────────────────────────────────────
  async load() {
    const el = document.getElementById('screen-produccion');
    el.innerHTML = `
      <div style="padding:14px 14px 6px">
        <div style="font-size:1rem;font-weight:700;">Control de Producción</div>
      </div>
      <div class="kanban-board" id="kanban-board">
        <div class="kanban-col">
          <div class="kanban-col-header kanban-mix">🟡 Mixes</div>
          <div class="kanban-cards" id="cards-mixes"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-header kanban-cremando">🔵 Cremando hoy</div>
          <div class="kanban-cards" id="cards-cremando"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-header kanban-venta">🟢 En Venta</div>
          <div class="kanban-cards" id="cards-venta"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col">
          <div class="kanban-col-header kanban-comercializado">⚪ Comercializados</div>
          <div class="kanban-cards" id="cards-comercializados"><div class="kanban-loading">Cargando…</div></div>
        </div>
      </div>`;

    await this.renderAll();
  },

  // ── Renderizar columnas ──────────────────────────────────────────────────
  async renderAll() {
    await Promise.all([
      this.renderMixes(),
      this.renderCremando(),
      this.renderEnVenta(),
      this.renderComercializados()
    ]);
  },

  async renderMixes() {
    const { data } = await sb.from('lotes_mix').select('*').order('fecha', { ascending: false });
    const cont = document.getElementById('cards-mixes');
    if (!data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    const activos = data.filter(m => (m.litros - (m.litros_cremados || 0)) > 0.001);
    if (!activos.length) { cont.innerHTML = '<div class="kanban-empty">Sin mixes pendientes</div>'; return; }
    cont.innerHTML = activos.map(m => {
      const pend = +(m.litros - (m.litros_cremados || 0)).toFixed(2);
      return `<div class="kanban-card">
        <div class="kcard-sabor">${m.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${m.litros}L total</span>
          ${m.litros_cremados > 0 ? `<span class="kcard-badge">cremados ${m.litros_cremados}L</span>` : ''}
        </div>
        <div class="kcard-fecha">${this.fmtF(m.fecha)}</div>
        ${m.notas ? `<div class="kcard-notas">${m.notas}</div>` : ''}
        <button class="btn-kaction btn-cremar"
          onclick="Produccion.abrirModal('cremar','${m.id}','${m.receta_nombre.replace(/'/g,"\\'")}',${pend})">
          → Cremar (${pend}L disp.)
        </button>
      </div>`;
    }).join('');
  },

  async renderCremando() {
    const hoy = this.hoy();
    const { data } = await sb.from('lotes_cremado').select('*').eq('fecha_cremado', hoy).order('created_at', { ascending: false });
    const cont = document.getElementById('cards-cremando');
    if (!data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    if (!data.length) { cont.innerHTML = '<div class="kanban-empty">Nada cremando hoy</div>'; return; }
    cont.innerHTML = data.map(c => `
      <div class="kanban-card">
        <div class="kcard-sabor">${c.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${c.litros}L</span>
          <span class="kcard-badge kcard-badge-blue">listo mañana</span>
        </div>
        <div class="kcard-fecha">Cremado: ${this.fmtF(c.fecha_cremado)}</div>
        ${c.notas ? `<div class="kcard-notas">${c.notas}</div>` : ''}
      </div>`).join('');
  },

  async renderEnVenta() {
    const hoy = this.hoy();
    const { data } = await sb.from('lotes_cremado').select('*').lt('fecha_cremado', hoy).order('fecha_cremado', { ascending: false });
    const cont = document.getElementById('cards-venta');
    if (!data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    const listos = data.filter(c => (c.litros - (c.litros_comercializados || 0)) > 0.001);
    if (!listos.length) { cont.innerHTML = '<div class="kanban-empty">Sin helados listos</div>'; return; }
    cont.innerHTML = listos.map(c => {
      const pend = +(c.litros - (c.litros_comercializados || 0)).toFixed(2);
      return `<div class="kanban-card">
        <div class="kcard-sabor">${c.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${pend}L disponibles</span>
          ${c.litros_comercializados > 0 ? `<span class="kcard-badge">comerc. ${c.litros_comercializados}L</span>` : ''}
        </div>
        <div class="kcard-fecha">Cremado: ${this.fmtF(c.fecha_cremado)}</div>
        ${c.notas ? `<div class="kcard-notas">${c.notas}</div>` : ''}
        <button class="btn-kaction btn-comercializar"
          onclick="Produccion.abrirModal('comercializar','${c.id}','${c.receta_nombre.replace(/'/g,"\\'")}',${pend})">
          → Comercializar
        </button>
      </div>`;
    }).join('');
  },

  async renderComercializados() {
    const { data } = await sb.from('lotes_venta').select('*').gt('litros_restantes', 0).order('fecha_comercializacion', { ascending: false });
    const cont = document.getElementById('cards-comercializados');
    if (!data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    if (!data.length) { cont.innerHTML = '<div class="kanban-empty">Sin lotes activos</div>'; return; }
    cont.innerHTML = data.map(v => `
      <div class="kanban-card">
        <div class="kcard-sabor">${v.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${v.litros_restantes}L restantes</span>
          <span class="kcard-badge">${v.litros}L inicial</span>
        </div>
        <div class="kcard-fecha">Desde: ${this.fmtF(v.fecha_comercializacion)}</div>
        ${v.notas ? `<div class="kcard-notas">${v.notas}</div>` : ''}
        <button class="btn-kaction btn-baja"
          onclick="Produccion.abrirModal('baja','${v.id}','${v.receta_nombre.replace(/'/g,"\\'")}',${v.litros_restantes})">
          Dar de baja
        </button>
      </div>`).join('');
  },

  // ── Modal unificado ──────────────────────────────────────────────────────
  abrirModal(tipo, id, nombre, max) {
    this._accion = { tipo, id, nombre, max };

    const titulos = { cremar: 'Cremar Mix', comercializar: 'Comercializar', baja: 'Dar de baja', mix: 'Preparar Mix' };
    const fechaLbls = { cremar: 'Fecha cremado', comercializar: 'Fecha comercialización', mix: 'Fecha elaboración' };

    document.getElementById('modal-prod-title').textContent    = titulos[tipo] || tipo;
    document.getElementById('modal-prod-subtitle').textContent = nombre;
    document.getElementById('modal-prod-litros').value         = max;
    document.getElementById('modal-prod-litros').max           = max;
    document.getElementById('modal-prod-notas').value          = '';

    // Fecha
    const fechaRow = document.getElementById('modal-prod-fecha-row');
    if (tipo === 'baja') {
      fechaRow.style.display = 'none';
    } else {
      fechaRow.style.display = '';
      document.getElementById('modal-prod-fecha-lbl').textContent = fechaLbls[tipo] || 'Fecha';
      document.getElementById('modal-prod-fecha').value = this.hoy();
    }

    // Label litros
    const litLbls = { cremar: `Litros a cremar (máx. ${max}L)`, comercializar: `Litros a comercializar (máx. ${max}L)`, baja: `Litros vendidos / retirados (máx. ${max}L)`, mix: 'Litros a producir' };
    document.getElementById('modal-prod-litros-lbl').textContent = litLbls[tipo] || 'Litros';

    openModal('modal-prod-overlay');
  },

  // ── Ejecutar acción según tipo ───────────────────────────────────────────
  async ejecutarAccion() {
    const { tipo, id, nombre, max } = this._accion;
    const litros = parseFloat(document.getElementById('modal-prod-litros').value);
    const fecha  = document.getElementById('modal-prod-fecha').value;
    const notas  = document.getElementById('modal-prod-notas').value.trim() || null;

    if (!litros || litros <= 0 || litros > max) {
      showToast(`Litros deben estar entre 0.1 y ${max}`, 'error'); return;
    }

    document.getElementById('btn-save-prod').disabled = true;

    try {
      if (tipo === 'mix') {
        await this._guardarMix(nombre, litros, fecha, notas);
      } else if (tipo === 'cremar') {
        await this._guardarCremado(id, nombre, litros, fecha, notas);
      } else if (tipo === 'comercializar') {
        await this._guardarComercializado(id, nombre, litros, fecha, notas);
      } else if (tipo === 'baja') {
        await this._guardarBaja(id, litros, notas);
      }
    } finally {
      document.getElementById('btn-save-prod').disabled = false;
    }
  },

  async _guardarMix(nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_mix').insert({ receta_nombre: nombre, litros, fecha, notas });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('modal-prod-overlay');
    showToast(`Mix de ${nombre} (${litros}L) registrado ✓`);
  },

  async _guardarCremado(mixId, nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_cremado').insert({ mix_id: mixId, receta_nombre: nombre, litros, fecha_cremado: fecha, notas });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    // Actualizar litros_cremados en el mix
    const { data: mix } = await sb.from('lotes_mix').select('litros_cremados').eq('id', mixId).single();
    await sb.from('lotes_mix').update({ litros_cremados: +((mix?.litros_cremados || 0) + litros).toFixed(2) }).eq('id', mixId);
    closeModal('modal-prod-overlay');
    showToast(`${litros}L cremados ✓`);
    await this.renderAll();
  },

  async _guardarComercializado(cremadoId, nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_venta').insert({ cremado_id: cremadoId, receta_nombre: nombre, litros, litros_restantes: litros, fecha_comercializacion: fecha, notas });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    const { data: cr } = await sb.from('lotes_cremado').select('litros_comercializados').eq('id', cremadoId).single();
    await sb.from('lotes_cremado').update({ litros_comercializados: +((cr?.litros_comercializados || 0) + litros).toFixed(2) }).eq('id', cremadoId);
    closeModal('modal-prod-overlay');
    showToast(`${litros}L comercializados ✓`);
    await this.renderAll();
  },

  async _guardarBaja(ventaId, litros, notas) {
    const { data: lote } = await sb.from('lotes_venta').select('litros_restantes').eq('id', ventaId).single();
    const nuevos = Math.max(0, +((lote?.litros_restantes || 0) - litros).toFixed(2));
    const { error } = await sb.from('lotes_venta').update({ litros_restantes: nuevos, notas }).eq('id', ventaId);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('modal-prod-overlay');
    showToast(`Baja de ${litros}L registrada ✓`);
    await this.renderAll();
  },

  // ── Llamado desde Calculadora ────────────────────────────────────────────
  registrarMixDesdeCalc(nombre, litros) {
    this.abrirModal('mix', null, nombre, 9999);
    document.getElementById('modal-prod-litros').value = litros;
    document.getElementById('modal-prod-litros').max   = 9999;
  },

  // ── Helpers ──────────────────────────────────────────────────────────────
  hoy() { return new Date().toISOString().split('T')[0]; },
  fmtF(str) {
    if (!str) return '–';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
};
