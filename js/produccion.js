// ── produccion.js · Control de Producción Kanban ─────────────────────────────

const Produccion = {

  // ── Cargar pantalla ──────────────────────────────────────────────────────
  async load() {
    const el = document.getElementById('screen-produccion');
    el.innerHTML = `
      <div class="prod-header">
        <h2 class="prod-title">Control de Producción</h2>
      </div>
      <div class="kanban-board" id="kanban-board">
        <div class="kanban-col" id="col-mixes">
          <div class="kanban-col-header kanban-mix">🟡 Mixes</div>
          <div class="kanban-cards" id="cards-mixes"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col" id="col-cremando">
          <div class="kanban-col-header kanban-cremando">🔵 Cremando</div>
          <div class="kanban-cards" id="cards-cremando"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col" id="col-venta">
          <div class="kanban-col-header kanban-venta">🟢 En Venta</div>
          <div class="kanban-cards" id="cards-venta"><div class="kanban-loading">Cargando…</div></div>
        </div>
        <div class="kanban-col" id="col-comercializados">
          <div class="kanban-col-header kanban-comercializado">⚪ Comercializados</div>
          <div class="kanban-cards" id="cards-comercializados"><div class="kanban-loading">Cargando…</div></div>
        </div>
      </div>`;
    await this.renderAll();
  },

  // ── Renderizar todas las columnas ────────────────────────────────────────
  async renderAll() {
    await Promise.all([
      this.renderMixes(),
      this.renderCremando(),
      this.renderEnVenta(),
      this.renderComercializados()
    ]);
  },

  // ── Columna 1: Mixes ─────────────────────────────────────────────────────
  async renderMixes() {
    const { data, error } = await supabase
      .from('lotes_mix')
      .select('*')
      .order('fecha', { ascending: false });

    const cont = document.getElementById('cards-mixes');
    if (error || !data) { cont.innerHTML = '<div class="kanban-empty">Error cargando mixes</div>'; return; }

    // Solo los que tienen litros pendientes de cremar
    const activos = data.filter(m => (m.litros - m.litros_cremados) > 0.001);
    if (!activos.length) { cont.innerHTML = '<div class="kanban-empty">Sin mixes pendientes</div>'; return; }

    cont.innerHTML = activos.map(m => {
      const pendiente = parseFloat((m.litros - m.litros_cremados).toFixed(2));
      return `
        <div class="kanban-card">
          <div class="kcard-sabor">${m.receta_nombre}</div>
          <div class="kcard-info">
            <span class="kcard-litros">${m.litros}L total</span>
            ${m.litros_cremados > 0 ? `<span class="kcard-badge">cremados ${m.litros_cremados}L</span>` : ''}
          </div>
          <div class="kcard-fecha">${this.fmtFecha(m.fecha)}</div>
          ${m.notas ? `<div class="kcard-notas">${m.notas}</div>` : ''}
          <button class="btn-kaction btn-cremar" onclick="Produccion.modalCremar('${m.id}','${m.receta_nombre}',${pendiente})">
            → Cremar (${pendiente}L disponibles)
          </button>
        </div>`;
    }).join('');
  },

  // ── Columna 2: Cremando (fecha = hoy) ───────────────────────────────────
  async renderCremando() {
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('lotes_cremado')
      .select('*')
      .eq('fecha_cremado', hoy)
      .order('created_at', { ascending: false });

    const cont = document.getElementById('cards-cremando');
    if (error || !data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    if (!data.length) { cont.innerHTML = '<div class="kanban-empty">Nada cremando hoy</div>'; return; }

    cont.innerHTML = data.map(c => `
      <div class="kanban-card">
        <div class="kcard-sabor">${c.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${c.litros}L</span>
          <span class="kcard-badge kcard-badge-blue">listo mañana</span>
        </div>
        <div class="kcard-fecha">Cremado: ${this.fmtFecha(c.fecha_cremado)}</div>
        ${c.notas ? `<div class="kcard-notas">${c.notas}</div>` : ''}
      </div>`).join('');
  },

  // ── Columna 3: En Venta (cremado ayer o antes, no comercializado todo) ──
  async renderEnVenta() {
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('lotes_cremado')
      .select('*')
      .lt('fecha_cremado', hoy)
      .order('fecha_cremado', { ascending: false });

    const cont = document.getElementById('cards-venta');
    if (error || !data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }

    // Solo los que tienen litros pendientes de comercializar
    const listos = data.filter(c => (c.litros - c.litros_comercializados) > 0.001);
    if (!listos.length) { cont.innerHTML = '<div class="kanban-empty">Sin helados listos</div>'; return; }

    cont.innerHTML = listos.map(c => {
      const pendiente = parseFloat((c.litros - c.litros_comercializados).toFixed(2));
      return `
        <div class="kanban-card">
          <div class="kcard-sabor">${c.receta_nombre}</div>
          <div class="kcard-info">
            <span class="kcard-litros">${pendiente}L disponibles</span>
            ${c.litros_comercializados > 0 ? `<span class="kcard-badge">comercializados ${c.litros_comercializados}L</span>` : ''}
          </div>
          <div class="kcard-fecha">Cremado: ${this.fmtFecha(c.fecha_cremado)}</div>
          ${c.notas ? `<div class="kcard-notas">${c.notas}</div>` : ''}
          <button class="btn-kaction btn-comercializar" onclick="Produccion.modalComercializar('${c.id}','${c.receta_nombre}',${pendiente})">
            → Comercializar
          </button>
        </div>`;
    }).join('');
  },

  // ── Columna 4: Comercializados (con litros_restantes > 0) ───────────────
  async renderComercializados() {
    const { data, error } = await supabase
      .from('lotes_venta')
      .select('*')
      .gt('litros_restantes', 0)
      .order('fecha_comercializacion', { ascending: false });

    const cont = document.getElementById('cards-comercializados');
    if (error || !data) { cont.innerHTML = '<div class="kanban-empty">Error</div>'; return; }
    if (!data.length) { cont.innerHTML = '<div class="kanban-empty">Sin lotes activos</div>'; return; }

    cont.innerHTML = data.map(v => `
      <div class="kanban-card">
        <div class="kcard-sabor">${v.receta_nombre}</div>
        <div class="kcard-info">
          <span class="kcard-litros">${v.litros_restantes}L restantes</span>
          <span class="kcard-badge">${v.litros}L inicial</span>
        </div>
        <div class="kcard-fecha">Desde: ${this.fmtFecha(v.fecha_comercializacion)}</div>
        ${v.notas ? `<div class="kcard-notas">${v.notas}</div>` : ''}
        <button class="btn-kaction btn-baja" onclick="Produccion.modalBaja('${v.id}','${v.receta_nombre}',${v.litros_restantes})">
          Dar de baja
        </button>
      </div>`).join('');
  },

  // ── Modal: Cremar mix ────────────────────────────────────────────────────
  modalCremar(mixId, nombre, maxLitros) {
    const hoy = new Date().toISOString().split('T')[0];
    this.showModal(`
      <h3 class="modal-title">Cremar Mix</h3>
      <p class="modal-subtitle">${nombre}</p>
      <div class="form-group">
        <label>Litros a cremar <small>(máx. ${maxLitros}L)</small></label>
        <input type="number" id="cremar-litros" class="form-input" value="${maxLitros}" min="0.1" max="${maxLitros}" step="0.1">
      </div>
      <div class="form-group">
        <label>Fecha cremado</label>
        <input type="date" id="cremar-fecha" class="form-input" value="${hoy}">
      </div>
      <div class="form-group">
        <label>Notas (opcional)</label>
        <input type="text" id="cremar-notas" class="form-input" placeholder="Ej: turno tarde">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="Produccion.closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="Produccion.guardarCremado('${mixId}','${nombre}',${maxLitros})">Cremar</button>
      </div>`);
  },

  async guardarCremado(mixId, nombre, maxLitros) {
    const litros = parseFloat(document.getElementById('cremar-litros').value);
    const fecha  = document.getElementById('cremar-fecha').value;
    const notas  = document.getElementById('cremar-notas').value.trim();

    if (!litros || litros <= 0 || litros > maxLitros) {
      showToast(`Litros deben ser entre 0.1 y ${maxLitros}`, 'error'); return;
    }

    // Insertar lote_cremado
    const { error: e1 } = await supabase.from('lotes_cremado').insert({
      mix_id: mixId, receta_nombre: nombre,
      litros, fecha_cremado: fecha,
      notas: notas || null
    });
    if (e1) { showToast('Error al guardar cremado', 'error'); return; }

    // Actualizar litros_cremados en el mix
    const { data: mix } = await supabase.from('lotes_mix').select('litros_cremados').eq('id', mixId).single();
    const nuevoCremado = parseFloat(((mix?.litros_cremados || 0) + litros).toFixed(2));
    await supabase.from('lotes_mix').update({ litros_cremados: nuevoCremado }).eq('id', mixId);

    this.closeModal();
    showToast(`${litros}L de ${nombre} pasados a cremar ✓`);
    await this.renderAll();
  },

  // ── Modal: Comercializar cremado ─────────────────────────────────────────
  modalComercializar(cremadoId, nombre, maxLitros) {
    const hoy = new Date().toISOString().split('T')[0];
    this.showModal(`
      <h3 class="modal-title">Comercializar</h3>
      <p class="modal-subtitle">${nombre}</p>
      <div class="form-group">
        <label>Litros a comercializar <small>(máx. ${maxLitros}L)</small></label>
        <input type="number" id="com-litros" class="form-input" value="${maxLitros}" min="0.1" max="${maxLitros}" step="0.1">
      </div>
      <div class="form-group">
        <label>Fecha comercialización</label>
        <input type="date" id="com-fecha" class="form-input" value="${hoy}">
      </div>
      <div class="form-group">
        <label>Notas (opcional)</label>
        <input type="text" id="com-notas" class="form-input" placeholder="Ej: vitrina izquierda">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="Produccion.closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="Produccion.guardarComercializado('${cremadoId}','${nombre}',${maxLitros})">Comercializar</button>
      </div>`);
  },

  async guardarComercializado(cremadoId, nombre, maxLitros) {
    const litros = parseFloat(document.getElementById('com-litros').value);
    const fecha  = document.getElementById('com-fecha').value;
    const notas  = document.getElementById('com-notas').value.trim();

    if (!litros || litros <= 0 || litros > maxLitros) {
      showToast(`Litros deben ser entre 0.1 y ${maxLitros}`, 'error'); return;
    }

    const { error: e1 } = await supabase.from('lotes_venta').insert({
      cremado_id: cremadoId, receta_nombre: nombre,
      litros, litros_restantes: litros,
      fecha_comercializacion: fecha,
      notas: notas || null
    });
    if (e1) { showToast('Error al comercializar', 'error'); return; }

    // Actualizar litros_comercializados en cremado
    const { data: cr } = await supabase.from('lotes_cremado').select('litros_comercializados').eq('id', cremadoId).single();
    const nuevoComercializado = parseFloat(((cr?.litros_comercializados || 0) + litros).toFixed(2));
    await supabase.from('lotes_cremado').update({ litros_comercializados: nuevoComercializado }).eq('id', cremadoId);

    this.closeModal();
    showToast(`${litros}L de ${nombre} comercializados ✓`);
    await this.renderAll();
  },

  // ── Modal: Dar de baja ───────────────────────────────────────────────────
  modalBaja(ventaId, nombre, maxLitros) {
    this.showModal(`
      <h3 class="modal-title">Dar de Baja</h3>
      <p class="modal-subtitle">${nombre}</p>
      <div class="form-group">
        <label>Litros vendidos / retirados <small>(máx. ${maxLitros}L)</small></label>
        <input type="number" id="baja-litros" class="form-input" value="${maxLitros}" min="0.1" max="${maxLitros}" step="0.1">
      </div>
      <div class="form-group">
        <label>Notas (opcional)</label>
        <input type="text" id="baja-notas" class="form-input" placeholder="Ej: vendidos, retirados por calidad…">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="Produccion.closeModal()">Cancelar</button>
        <button class="btn-danger" onclick="Produccion.guardarBaja('${ventaId}',${maxLitros})">Dar de baja</button>
      </div>`);
  },

  async guardarBaja(ventaId, maxLitros) {
    const litros = parseFloat(document.getElementById('baja-litros').value);
    const notas  = document.getElementById('baja-notas').value.trim();

    if (!litros || litros <= 0 || litros > maxLitros) {
      showToast(`Litros deben ser entre 0.1 y ${maxLitros}`, 'error'); return;
    }

    const { data: lote } = await supabase.from('lotes_venta').select('litros_restantes').eq('id', ventaId).single();
    const nuevosRestantes = parseFloat(((lote?.litros_restantes || 0) - litros).toFixed(2));

    await supabase.from('lotes_venta').update({
      litros_restantes: Math.max(0, nuevosRestantes),
      notas: notas || null
    }).eq('id', ventaId);

    this.closeModal();
    showToast(`Baja registrada: ${litros}L ✓`);
    await this.renderAll();
  },

  // ── Método público: registrar mix desde la calculadora ──────────────────
  async registrarMixDesdeCalc(nombre, litros) {
    const hoy = new Date().toISOString().split('T')[0];
    this.showModal(`
      <h3 class="modal-title">Preparar Mix</h3>
      <p class="modal-subtitle">${nombre}</p>
      <div class="form-group">
        <label>Litros</label>
        <input type="number" id="mix-litros" class="form-input" value="${litros}" min="0.1" step="0.1">
      </div>
      <div class="form-group">
        <label>Fecha elaboración</label>
        <input type="date" id="mix-fecha" class="form-input" value="${hoy}">
      </div>
      <div class="form-group">
        <label>Notas (opcional)</label>
        <input type="text" id="mix-notas" class="form-input" placeholder="Ej: turno mañana">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="Produccion.closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="Produccion.guardarMix('${nombre}')">Registrar Mix</button>
      </div>`);
  },

  async guardarMix(nombre) {
    const litros = parseFloat(document.getElementById('mix-litros').value);
    const fecha  = document.getElementById('mix-fecha').value;
    const notas  = document.getElementById('mix-notas').value.trim();

    if (!litros || litros <= 0) { showToast('Introduce los litros', 'error'); return; }

    const { error } = await supabase.from('lotes_mix').insert({
      receta_nombre: nombre, litros, fecha,
      notas: notas || null
    });
    if (error) { showToast('Error al guardar mix', 'error'); return; }

    this.closeModal();
    showToast(`Mix de ${nombre} (${litros}L) registrado ✓`);
  },

  // ── Helpers ──────────────────────────────────────────────────────────────
  showModal(html) {
    let overlay = document.getElementById('prod-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'prod-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal-sheet" id="prod-modal-sheet"></div>`;
      overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(); });
      document.body.appendChild(overlay);
    }
    document.getElementById('prod-modal-sheet').innerHTML = html;
    overlay.classList.remove('hidden');
  },

  closeModal() {
    const overlay = document.getElementById('prod-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  fmtFecha(str) {
    if (!str) return '–';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
};
