// ── produccion.js · Control de Producción ────────────────────────────────────

const Produccion = {

  _accion: null,
  _tabActiva: 'operativa',

  // ── Cargar pantalla ──────────────────────────────────────────────────────
  async load() {
    const el = document.getElementById('screen-produccion');
    el.innerHTML = `
      <!-- Tabs -->
      <div class="prod-tabs">
        <button class="prod-tab active" id="ptab-operativa" onclick="Produccion.switchTab('operativa')">⚙️ Operativa</button>
        <button class="prod-tab" id="ptab-historico" onclick="Produccion.switchTab('historico')">📋 Histórico</button>
      </div>

      <!-- ══ OPERATIVA ══ -->
      <div id="prod-panel-operativa">
        <!-- KPIs -->
        <div class="prod-kpi-row">
          <div class="prod-kpi-box prod-kpi-mix"><div class="prod-kpi-v" id="pkpi-mixes">–</div><div class="prod-kpi-l">Mixes preparados</div></div>
          <div class="prod-kpi-box prod-kpi-cong"><div class="prod-kpi-v" id="pkpi-congel">–</div><div class="prod-kpi-l">En congelación</div></div>
          <div class="prod-kpi-box prod-kpi-list"><div class="prod-kpi-v" id="pkpi-listos">–</div><div class="prod-kpi-l">Listo para Venta</div></div>
          <div class="prod-kpi-box prod-kpi-com"><div class="prod-kpi-v" id="pkpi-comerc">–</div><div class="prod-kpi-l">En comercialización</div></div>
        </div>

        <!-- Filtros -->
        <div class="prod-filtros">
          <button class="prod-filtro active" onclick="Produccion.filtrar('todos',this)">Todos</button>
          <button class="prod-filtro" onclick="Produccion.filtrar('mix',this)">🟡 Mix</button>
          <button class="prod-filtro" onclick="Produccion.filtrar('congel',this)">🔵 Congelación</button>
          <button class="prod-filtro" onclick="Produccion.filtrar('listo',this)">🟢 Listo Venta</button>
          <button class="prod-filtro" onclick="Produccion.filtrar('comerc',this)">⚪ Comercialización</button>
        </div>

        <!-- Lista lotes activos -->
        <div id="prod-lotes-list"><div class="prod-loading">Cargando…</div></div>
      </div>

      <!-- ══ HISTÓRICO ══ -->
      <div id="prod-panel-historico" style="display:none">
        <!-- Selector periodo -->
        <div class="prod-periodo-sel">
          <button class="prod-periodo-btn active" onclick="Produccion.setPeriodo('semana',this)">Esta semana</button>
          <button class="prod-periodo-btn" onclick="Produccion.setPeriodo('mes',this)">Este mes</button>
          <button class="prod-periodo-btn" onclick="Produccion.setPeriodo('custom',this)">Personalizado</button>
        </div>
        <div id="prod-periodo-info" class="prod-periodo-info"></div>

        <!-- Rango personalizado -->
        <div class="prod-rango-custom hidden" id="prod-rango-custom">
          <div class="prod-rango-fields">
            <div><label>Desde</label><input type="date" id="rango-desde" /></div>
            <div><label>Hasta</label><input type="date" id="rango-hasta" /></div>
          </div>
          <button class="prod-periodo-btn active" onclick="Produccion.cargarHistorico()">Aplicar</button>
        </div>

        <!-- KPIs histórico -->
        <div class="prod-hist-kpis">
          <div class="prod-hist-kpi"><div class="prod-hist-kpi-v" id="hkpi-lotes">–</div><div class="prod-hist-kpi-l">Lotes vendidos</div></div>
          <div class="prod-hist-kpi"><div class="prod-hist-kpi-v" id="hkpi-litros">–</div><div class="prod-hist-kpi-l">Litros vendidos</div></div>
          <div class="prod-hist-kpi"><div class="prod-hist-kpi-v" id="hkpi-sabores">–</div><div class="prod-hist-kpi-l">Sabores distintos</div></div>
        </div>

        <div class="prod-seccion-lbl">Detalle del periodo</div>
        <div id="prod-hist-list"><div class="prod-loading">Cargando…</div></div>
      </div>`;

    await this.renderOperativa();
    this.setPeriodoSilencioso('semana');
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  switchTab(tab) {
    this._tabActiva = tab;
    document.getElementById('ptab-operativa').classList.toggle('active', tab === 'operativa');
    document.getElementById('ptab-historico').classList.toggle('active', tab === 'historico');
    document.getElementById('prod-panel-operativa').style.display = tab === 'operativa' ? '' : 'none';
    document.getElementById('prod-panel-historico').style.display = tab === 'historico' ? '' : 'none';
    if (tab === 'historico') this.cargarHistorico();
  },

  // ── Filtrar lotes ────────────────────────────────────────────────────────
  filtrar(estado, btn) {
    document.querySelectorAll('.prod-filtro').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.prod-lote').forEach(c => {
      c.style.display = (estado === 'todos' || c.dataset.estado === estado) ? '' : 'none';
    });
  },

  // ── Renderizar operativa ─────────────────────────────────────────────────
  async renderOperativa() {
    const hoy = this.hoy();
    const [{ data: mixes }, { data: congel }, { data: listos }, { data: comerc }] = await Promise.all([
      sb.from('lotes_mix').select('*').order('fecha', { ascending: false }),
      sb.from('lotes_cremado').select('*').eq('fecha_cremado', hoy).order('created_at', { ascending: false }),
      sb.from('lotes_cremado').select('*').lt('fecha_cremado', hoy).order('fecha_cremado', { ascending: false }),
      sb.from('lotes_venta').select('*').gt('litros_restantes', 0).order('fecha_comercializacion', { ascending: false }),
    ]);

    // KPIs
    const mixesPend  = (mixes  || []).filter(m => (m.litros - (m.litros_cremados||0)) > 0.001).length;
    const listosPend = (listos || []).filter(c => (c.litros - (c.litros_comercializados||0)) > 0.001).length;
    document.getElementById('pkpi-mixes').textContent  = mixesPend;
    document.getElementById('pkpi-congel').textContent = (congel || []).length;
    document.getElementById('pkpi-listos').textContent = listosPend;
    document.getElementById('pkpi-comerc').textContent = (comerc || []).length;

    // Construir lista unificada
    const items = [];

    (mixes || []).filter(m => (m.litros - (m.litros_cremados||0)) > 0.001).forEach(m => {
      const pend = +(m.litros - (m.litros_cremados||0)).toFixed(2);
      items.push({ estado: 'mix', fecha: m.fecha, html: `
        <div class="prod-lote estado-mix" data-estado="mix">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🟡</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${m.receta_nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-mix">Mix preparado</span>
              <span>elaborado ${this.fmtF(m.fecha)}</span>
              ${m.litros_cremados > 0 ? `<span style="color:#FFD54F">${pend}L pendientes</span>` : ''}
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${m.litros}L</div>
            <button class="prod-btn-accion prod-btn-mix" onclick="Produccion.abrirModal('cremar','${m.id}','${this.esc(m.receta_nombre)}',${pend})">→ Congelar</button>
          </div>
        </div>` });
    });

    (congel || []).forEach(c => {
      items.push({ estado: 'congel', fecha: c.fecha_cremado, html: `
        <div class="prod-lote estado-congel" data-estado="congel">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🔵</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${c.receta_nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-congel">En congelación</span>
              <span>desde hoy</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${c.litros}L</div>
            <span class="prod-lote-nota">listo mañana</span>
          </div>
        </div>` });
    });

    (listos || []).filter(c => (c.litros - (c.litros_comercializados||0)) > 0.001).forEach(c => {
      const pend = +(c.litros - (c.litros_comercializados||0)).toFixed(2);
      items.push({ estado: 'listo', fecha: c.fecha_cremado, html: `
        <div class="prod-lote estado-listo" data-estado="listo">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🟢</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${c.receta_nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-listo">Listo para Venta</span>
              <span>congelado ${this.fmtF(c.fecha_cremado)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${pend}L</div>
            <button class="prod-btn-accion prod-btn-listo" onclick="Produccion.abrirModal('comercializar','${c.id}','${this.esc(c.receta_nombre)}',${pend})">→ Comercializar</button>
          </div>
        </div>` });
    });

    (comerc || []).forEach(v => {
      items.push({ estado: 'comerc', fecha: v.fecha_comercializacion, html: `
        <div class="prod-lote estado-comerc" data-estado="comerc">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">⚪</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${v.receta_nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-comerc">En comercialización</span>
              <span>desde ${this.fmtF(v.fecha_comercializacion)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${v.litros_restantes}L</div>
            <button class="prod-btn-accion prod-btn-vendido" onclick="Produccion.abrirModal('baja','${v.id}','${this.esc(v.receta_nombre)}',${v.litros_restantes})">✓ Vendido</button>
          </div>
        </div>` });
    });

    const cont = document.getElementById('prod-lotes-list');
    if (!items.length) {
      cont.innerHTML = '<div class="prod-empty">Sin lotes activos — prepara un mix desde la Calculadora</div>';
    } else {
      cont.innerHTML = items.map(i => i.html).join('');
    }
  },

  // ── Histórico ────────────────────────────────────────────────────────────
  setPeriodo(periodo, btn) {
    document.querySelectorAll('.prod-periodo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const rangoEl = document.getElementById('prod-rango-custom');
    rangoEl.classList.toggle('hidden', periodo !== 'custom');
    if (periodo !== 'custom') {
      this._periodoActivo = periodo;
      this.actualizarInfoPeriodo(periodo);
      this.cargarHistorico();
    }
  },

  setPeriodoSilencioso(periodo) {
    this._periodoActivo = periodo;
  },

  actualizarInfoPeriodo(periodo) {
    const hoy = new Date();
    let txt = '';
    if (periodo === 'semana') {
      const lunes = new Date(hoy);
      const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
      lunes.setDate(hoy.getDate() - dia);
      txt = `Desde el lunes ${this.fmtF(lunes.toISOString().split('T')[0])} hasta hoy`;
    } else if (periodo === 'mes') {
      const mes = hoy.toLocaleDateString('es-ES', { month: 'long' });
      txt = `Desde el 1 de ${mes} hasta hoy`;
    }
    const el = document.getElementById('prod-periodo-info');
    if (el) el.textContent = txt;
  },

  getRangoDates() {
    const hoy = new Date();
    const hoyStr = this.hoy();
    if (this._periodoActivo === 'semana') {
      const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - dia);
      return { desde: lunes.toISOString().split('T')[0], hasta: hoyStr };
    } else if (this._periodoActivo === 'mes') {
      return { desde: `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`, hasta: hoyStr };
    } else {
      return {
        desde: document.getElementById('rango-desde')?.value || hoyStr,
        hasta: document.getElementById('rango-hasta')?.value || hoyStr,
      };
    }
  },

  async cargarHistorico() {
    const { desde, hasta } = this.getRangoDates();
    this.actualizarInfoPeriodo(this._periodoActivo);

    const { data } = await sb.from('lotes_venta')
      .select('*')
      .gte('fecha_comercializacion', desde)
      .lte('fecha_comercializacion', hasta)
      .order('fecha_comercializacion', { ascending: false });

    const cont = document.getElementById('prod-hist-list');
    if (!data || !data.length) {
      document.getElementById('hkpi-lotes').textContent   = '0';
      document.getElementById('hkpi-litros').textContent  = '0L';
      document.getElementById('hkpi-sabores').textContent = '0';
      cont.innerHTML = '<div class="prod-empty">Sin ventas en este periodo</div>';
      return;
    }

    const litrosVendidos  = data.reduce((s, v) => s + parseFloat((v.litros||0) - (v.litros_restantes||0)), 0);
    const saboresDistintos = new Set(data.map(v => v.receta_nombre)).size;

    document.getElementById('hkpi-lotes').textContent   = data.length;
    document.getElementById('hkpi-litros').textContent  = litrosVendidos.toFixed(1) + 'L';
    document.getElementById('hkpi-sabores').textContent = saboresDistintos;

    cont.innerHTML = data.map(v => {
      const vendidos = +(v.litros - (v.litros_restantes||0)).toFixed(2);
      const agotado  = v.litros_restantes <= 0;
      return `
        <div class="prod-hist-item">
          <div class="prod-hist-info">
            <div class="prod-hist-nombre">${v.receta_nombre}</div>
            <div class="prod-hist-meta">Comercializado ${this.fmtF(v.fecha_comercializacion)}</div>
          </div>
          <div class="prod-hist-right">
            <div class="prod-hist-litros">${vendidos > 0 ? vendidos + 'L vendidos' : v.litros + 'L'}</div>
            <div class="prod-hist-estado ${agotado ? 'hist-agotado' : 'hist-parcial'}">
              ${agotado ? '✅ Agotado' : `🟡 ${v.litros_restantes}L en vitrina`}
            </div>
          </div>
        </div>`;
    }).join('');
  },

  // ── Modal unificado (usa modal estático del HTML) ────────────────────────
  abrirModal(tipo, id, nombre, max) {
    this._accion = { tipo, id, nombre, max };
    const titulos   = { cremar: 'Poner a congelar', comercializar: 'Comercializar', baja: 'Marcar como vendido', mix: 'Preparar Mix' };
    const fechaLbls = { cremar: 'Fecha congelación', comercializar: 'Fecha comercialización', mix: 'Fecha elaboración' };
    const litLbls   = {
      cremar:        `Litros a congelar (máx. ${max}L)`,
      comercializar: `Litros a comercializar (máx. ${max}L)`,
      baja:          `Litros vendidos / retirados (máx. ${max}L)`,
      mix:           'Litros a producir'
    };

    document.getElementById('modal-prod-title').textContent    = titulos[tipo] || tipo;
    document.getElementById('modal-prod-subtitle').textContent = nombre;
    document.getElementById('modal-prod-litros').value         = max < 9999 ? max : '';
    document.getElementById('modal-prod-litros').max           = max < 9999 ? max : '';
    document.getElementById('modal-prod-litros-lbl').textContent = litLbls[tipo] || 'Litros';
    document.getElementById('modal-prod-notas').value          = '';

    const fechaRow = document.getElementById('modal-prod-fecha-row');
    if (tipo === 'baja') {
      fechaRow.style.display = 'none';
    } else {
      fechaRow.style.display = '';
      document.getElementById('modal-prod-fecha-lbl').textContent = fechaLbls[tipo] || 'Fecha';
      document.getElementById('modal-prod-fecha').value = this.hoy();
    }
    openModal('modal-prod-overlay');
  },

  async ejecutarAccion() {
    if (!this._accion) return;
    const { tipo, id, nombre, max } = this._accion;
    const litros = parseFloat(document.getElementById('modal-prod-litros').value);
    const fecha  = document.getElementById('modal-prod-fecha').value;
    const notas  = document.getElementById('modal-prod-notas').value.trim() || null;

    if (!litros || litros <= 0 || (max < 9999 && litros > max)) {
      showToast(`Litros deben estar entre 0.1 y ${max}`, 'error'); return;
    }

    document.getElementById('btn-save-prod').disabled = true;
    try {
      if      (tipo === 'mix')           await this._guardarMix(nombre, litros, fecha, notas);
      else if (tipo === 'cremar')        await this._guardarCremado(id, nombre, litros, fecha, notas);
      else if (tipo === 'comercializar') await this._guardarComercializado(id, nombre, litros, fecha, notas);
      else if (tipo === 'baja')          await this._guardarBaja(id, litros, notas);
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
    const { data: mix } = await sb.from('lotes_mix').select('litros_cremados').eq('id', mixId).single();
    await sb.from('lotes_mix').update({ litros_cremados: +((mix?.litros_cremados||0) + litros).toFixed(2) }).eq('id', mixId);
    closeModal('modal-prod-overlay');
    showToast(`${litros}L de ${nombre} en congelación ✓`);
    await this.renderOperativa();
  },

  async _guardarComercializado(cremadoId, nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_venta').insert({ cremado_id: cremadoId, receta_nombre: nombre, litros, litros_restantes: litros, fecha_comercializacion: fecha, notas });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    const { data: cr } = await sb.from('lotes_cremado').select('litros_comercializados').eq('id', cremadoId).single();
    await sb.from('lotes_cremado').update({ litros_comercializados: +((cr?.litros_comercializados||0) + litros).toFixed(2) }).eq('id', cremadoId);
    closeModal('modal-prod-overlay');
    showToast(`${litros}L de ${nombre} en comercialización ✓`);
    await this.renderOperativa();
  },

  async _guardarBaja(ventaId, litros, notas) {
    const { data: lote } = await sb.from('lotes_venta').select('litros_restantes').eq('id', ventaId).single();
    const nuevos = Math.max(0, +((lote?.litros_restantes||0) - litros).toFixed(2));
    const { error } = await sb.from('lotes_venta').update({ litros_restantes: nuevos, notas }).eq('id', ventaId);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('modal-prod-overlay');
    showToast(`${litros}L vendidos registrados ✓`);
    await this.renderOperativa();
  },

  // ── Desde calculadora ────────────────────────────────────────────────────
  registrarMixDesdeCalc(nombre, litros) {
    this._accion = { tipo: 'mix', id: null, nombre, max: 9999 };
    document.getElementById('modal-prod-title').textContent      = 'Preparar Mix';
    document.getElementById('modal-prod-subtitle').textContent   = nombre;
    document.getElementById('modal-prod-litros').value           = litros;
    document.getElementById('modal-prod-litros').max             = '';
    document.getElementById('modal-prod-litros-lbl').textContent = 'Litros a producir';
    document.getElementById('modal-prod-fecha-row').style.display = '';
    document.getElementById('modal-prod-fecha-lbl').textContent  = 'Fecha elaboración';
    document.getElementById('modal-prod-fecha').value            = this.hoy();
    document.getElementById('modal-prod-notas').value            = '';
    openModal('modal-prod-overlay');
  },

  // ── Helpers ──────────────────────────────────────────────────────────────
  hoy()    { return new Date().toISOString().split('T')[0]; },
  esc(str) { return (str || '').replace(/'/g, "\\'"); },
  fmtF(str) {
    if (!str) return '–';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
};
