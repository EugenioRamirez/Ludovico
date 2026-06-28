// ── produccion.js · Control de Producción ────────────────────────────────────

const Produccion = {

  _accion: null,
  _tabActiva: 'operativa',
  _filtroActivo: 'todos',
  _grupos: null, // último agrupado por sabor de mix/listo/comerc — usado por abrirModalGrupo()

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
          <div class="prod-kpi-box prod-kpi-mix"><div class="prod-kpi-v" id="pkpi-op-mixes">–</div><div class="prod-kpi-l">Mixes preparados</div></div>
          <div class="prod-kpi-box prod-kpi-cong"><div class="prod-kpi-v" id="pkpi-congel">–</div><div class="prod-kpi-l">En congelación</div></div>
          <div class="prod-kpi-box prod-kpi-list"><div class="prod-kpi-v" id="pkpi-op-listos">–</div><div class="prod-kpi-l">Listo para Venta</div></div>
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

        <div class="prod-seccion-lbl">🏆 Ranking de sabores vendidos</div>
        <div id="prod-hist-ranking"><div class="prod-loading">Cargando…</div></div>

        <div class="prod-seccion-lbl">Detalle del periodo</div>
        <div id="prod-hist-list"><div class="prod-loading">Cargando…</div></div>

        ${this.esAdmin() ? `
        <div class="prod-admin-zona">
          <div class="prod-admin-lbl">⚙️ Zona Administrador</div>
          <button class="prod-btn-danger" onclick="Produccion.borrarHistoricoVentas()">🗑️ Borrar historial de comercializados</button>
        </div>` : ''}
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
    else this.renderOperativa();
  },

  // ── Filtrar lotes ────────────────────────────────────────────────────────
  filtrar(estado, btn) {
    this._filtroActivo = estado;
    document.querySelectorAll('.prod-filtro').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._aplicarFiltro();
  },

  // Reaplica this._filtroActivo a los lotes actualmente renderizados —
  // se llama tanto desde filtrar() como tras cada renderOperativa(), para
  // que un refresco de datos no "olvide" qué pestaña de filtro estaba activa.
  _aplicarFiltro() {
    document.querySelectorAll('.prod-lote').forEach(c => {
      c.style.display = (this._filtroActivo === 'todos' || c.dataset.estado === this._filtroActivo) ? '' : 'none';
    });
  },

  // Agrupa filas de una tabla por receta_nombre, sumando lo pendiente de cada
  // una. Cada grupo guarda sus lotes de origen ordenados por fecha ascendente
  // (el más antiguo primero) para poder repartir acciones en FIFO: al pulsar
  // "Congelar/Comercializar/Vendido" sobre la tarjeta fusionada, los litros
  // solicitados se descuentan empezando por el lote que lleva más tiempo
  // esperando.
  _agruparPorSabor(rows, pendienteFn, fechaFn) {
    const mapa = new Map();
    rows.forEach(r => {
      const pend = +pendienteFn(r).toFixed(2);
      if (pend <= 0.001) return;
      if (!mapa.has(r.receta_nombre)) mapa.set(r.receta_nombre, { nombre: r.receta_nombre, total: 0, lotes: [] });
      const g = mapa.get(r.receta_nombre);
      g.total += pend;
      g.lotes.push({ id: r.id, pend, fecha: fechaFn(r) });
    });
    const grupos = Array.from(mapa.values());
    grupos.forEach(g => {
      g.lotes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // FIFO
      g.total = +g.total.toFixed(2);
      g.fechaMin = g.lotes[0]?.fecha;
    });
    grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return grupos;
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

    // Agrupar por sabor — una tarjeta por sabor+estado, con los litros de
    // todos sus lotes sumados. "congel" también se agrupa solo para mostrar
    // (no tiene acción, así que no necesita guardarse en this._grupos).
    const gruposMix    = this._agruparPorSabor(mixes  || [], m => m.litros - (m.litros_cremados||0),       m => m.fecha);
    const gruposCongel = this._agruparPorSabor(congel || [], c => c.litros,                                  c => c.fecha_cremado);
    const gruposListo  = this._agruparPorSabor(listos || [], c => c.litros - (c.litros_comercializados||0), c => c.fecha_cremado);
    const gruposComerc = this._agruparPorSabor(comerc || [], v => v.litros_restantes,                        v => v.fecha_comercializacion);

    // Guardado para que abrirModalGrupo() pueda resolver, al pulsar una
    // acción, qué lotes concretos hay detrás de la tarjeta fusionada.
    this._grupos = { mix: gruposMix, listo: gruposListo, comerc: gruposComerc };

    // KPIs — número de sabores distintos pendientes en cada estado (coincide
    // ahora con el número de tarjetas que se ven debajo, ya fusionadas)
    document.getElementById('pkpi-op-mixes').textContent  = gruposMix.length;
    document.getElementById('pkpi-congel').textContent    = gruposCongel.length;
    document.getElementById('pkpi-op-listos').textContent = gruposListo.length;
    document.getElementById('pkpi-comerc').textContent    = gruposComerc.length;

    // Construir lista unificada
    const items = [];
    const nLotesTxt = g => g.lotes.length > 1 ? ` · ${g.lotes.length} lotes` : '';

    gruposMix.forEach(g => {
      items.push({ estado: 'mix', fecha: g.fechaMin, html: `
        <div class="prod-lote estado-mix" data-estado="mix">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🟡</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${g.nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-mix">Mix preparado</span>
              <span>elaborado ${this.fmtF(g.fechaMin)}${nLotesTxt(g)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${g.total}L</div>
            <button class="prod-btn-accion prod-btn-mix" onclick="Produccion.abrirModalGrupo('cremar','${this.esc(g.nombre)}')">→ Congelar</button>
          </div>
        </div>` });
    });

    gruposCongel.forEach(g => {
      items.push({ estado: 'congel', fecha: g.fechaMin, html: `
        <div class="prod-lote estado-congel" data-estado="congel">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🔵</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${g.nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-congel">En congelación</span>
              <span>desde hoy${nLotesTxt(g)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${g.total}L</div>
            <span class="prod-lote-nota">listo mañana</span>
          </div>
        </div>` });
    });

    gruposListo.forEach(g => {
      items.push({ estado: 'listo', fecha: g.fechaMin, html: `
        <div class="prod-lote estado-listo" data-estado="listo">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">🟢</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${g.nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-listo">Listo para Venta</span>
              <span>congelado ${this.fmtF(g.fechaMin)}${nLotesTxt(g)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${g.total}L</div>
            <button class="prod-btn-accion prod-btn-listo" onclick="Produccion.abrirModalGrupo('comercializar','${this.esc(g.nombre)}')">→ Comercializar</button>
          </div>
        </div>` });
    });

    gruposComerc.forEach(g => {
      items.push({ estado: 'comerc', fecha: g.fechaMin, html: `
        <div class="prod-lote estado-comerc" data-estado="comerc">
          <div class="prod-lote-color"></div>
          <div class="prod-lote-ico">⚪</div>
          <div class="prod-lote-info">
            <div class="prod-lote-nombre">${g.nombre}</div>
            <div class="prod-lote-meta">
              <span class="plote-badge badge-comerc">En comercialización</span>
              <span>desde ${this.fmtF(g.fechaMin)}${nLotesTxt(g)}</span>
            </div>
          </div>
          <div class="prod-lote-accion">
            <div class="prod-lote-litros">${g.total}L</div>
            <button class="prod-btn-accion prod-btn-vendido" onclick="Produccion.abrirModalGrupo('baja','${this.esc(g.nombre)}')">✓ Vendido</button>
          </div>
        </div>` });
    });

    const cont = document.getElementById('prod-lotes-list');
    if (!items.length) {
      cont.innerHTML = '<div class="prod-empty">Sin lotes activos — prepara un mix desde la Calculadora</div>';
    } else {
      cont.innerHTML = items.map(i => i.html).join('');
    }
    this._aplicarFiltro();
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

    const cont     = document.getElementById('prod-hist-list');
    const contRank = document.getElementById('prod-hist-ranking');
    if (!data || !data.length) {
      document.getElementById('hkpi-lotes').textContent   = '0';
      document.getElementById('hkpi-litros').textContent  = '0L';
      document.getElementById('hkpi-sabores').textContent = '0';
      cont.innerHTML     = '<div class="prod-empty">Sin ventas en este periodo</div>';
      contRank.innerHTML = '<div class="prod-empty">Sin ventas en este periodo</div>';
      return;
    }

    const litrosVendidos  = data.reduce((s, v) => s + parseFloat((v.litros||0) - (v.litros_restantes||0)), 0);
    const saboresDistintos = new Set(data.map(v => v.receta_nombre)).size;

    document.getElementById('hkpi-lotes').textContent   = data.length;
    document.getElementById('hkpi-litros').textContent  = litrosVendidos.toFixed(1) + 'L';
    document.getElementById('hkpi-sabores').textContent = saboresDistintos;

    // Ranking de sabores — totaliza, para cada receta_nombre, los litros
    // vendidos (litros - litros_restantes) de todos sus lotes dentro del
    // periodo seleccionado, y lo ordena de mayor a menor. Usa la misma
    // definición de "vendido" que el KPI "Litros vendidos" de arriba, así
    // que la suma de este ranking siempre coincide con ese KPI.
    const porSabor = new Map();
    data.forEach(v => {
      const vendido = +((v.litros || 0) - (v.litros_restantes || 0)).toFixed(2);
      if (vendido <= 0) return;
      porSabor.set(v.receta_nombre, +((porSabor.get(v.receta_nombre) || 0) + vendido).toFixed(2));
    });
    const ranking = Array.from(porSabor, ([nombre, litros]) => ({ nombre, litros }))
      .sort((a, b) => b.litros - a.litros);

    if (!ranking.length) {
      contRank.innerHTML = '<div class="prod-empty">Sin ventas en este periodo</div>';
    } else {
      const totalRank = ranking.reduce((s, r) => s + r.litros, 0);
      const maxLitros = ranking[0].litros || 1;

      // Top 3 → podio. El orden visual de las barras es 2°, 1°, 3°
      // (la del medio, más alta, es la primera). Si hay menos de 3
      // sabores con ventas, sencillamente se omiten las barras que faltan.
      const top3   = ranking.slice(0, 3);
      const claves = ['oro', 'plata', 'bronce'];
      const orden  = [1, 0, 2].filter(i => top3[i]);
      const podioHtml = !top3.length ? '' : `<div class="prod-podio">${orden.map(i => {
        const r       = top3[i];
        const corona  = i === 0 ? '<div class="prod-podio-corona">👑</div>' : '';
        const medalla = i !== 0 ? `<div class="prod-podio-medalla">${i + 1}°</div>` : '';
        return `
          <div class="prod-podio-item">
            <div class="prod-podio-bar ${claves[i]}">
              ${corona}${medalla}
              <div class="prod-podio-num">${i + 1}</div>
            </div>
            <div class="prod-podio-nombre">${r.nombre}</div>
            <div class="prod-podio-litros">${r.litros}L</div>
          </div>`;
      }).join('')}</div>`;

      // Ranks 4+ → misma lista de antes, bajo el divisor "Otros sabores".
      const resto = ranking.slice(3);
      const restoHtml = !resto.length ? '' : `<div class="prod-seccion-lbl prod-rank-otros-lbl">Otros sabores</div>${resto.map((r, idx) => {
        const pct   = totalRank > 0 ? Math.round((r.litros / totalRank) * 100) : 0;
        const ancho = Math.round((r.litros / maxLitros) * 100);
        return `
          <div class="prod-rank-item">
            <div class="prod-rank-pos">${idx + 4}</div>
            <div class="prod-rank-info">
              <div class="prod-rank-nombre">${r.nombre}</div>
              <div class="prod-rank-bar"><div class="prod-rank-bar-fill" style="width:${ancho}%"></div></div>
            </div>
            <div class="prod-rank-right">
              <div class="prod-rank-litros">${r.litros}L</div>
              <div class="prod-rank-pct">${pct}%</div>
            </div>
          </div>`;
      }).join('')}`;

      contRank.innerHTML = podioHtml + restoHtml;
    }

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

  // Resuelve, a partir del nombre de sabor pulsado en una tarjeta fusionada,
  // qué lotes concretos hay detrás (guardados por renderOperativa() en
  // this._grupos) y abre el modal con el total combinado como máximo.
  abrirModalGrupo(tipo, nombre) {
    const claves = { cremar: 'mix', comercializar: 'listo', baja: 'comerc' };
    const grupo = (this._grupos?.[claves[tipo]] || []).find(g => g.nombre === nombre);
    if (!grupo) { showToast('No se encontró el lote — refresca la pantalla', 'error'); return; }
    this.abrirModal(tipo, grupo.lotes, nombre, grupo.total);
  },

  // ── Modal unificado (usa modal estático del HTML) ────────────────────────
  // `lotes` es la lista de lotes de origen (FIFO, más antiguo primero) que
  // hay detrás de la tarjeta — vacía/irrelevante para tipo 'mix', que es alta
  // nueva y no consume nada existente.
  abrirModal(tipo, lotes, nombre, max) {
    this._accion = { tipo, lotes: lotes || [], nombre, max };
    const titulos   = { cremar: 'Poner a congelar', comercializar: 'Comercializar', baja: 'Marcar como vendido', mix: 'Preparar Mix' };
    const fechaLbls = { cremar: 'Fecha congelación', comercializar: 'Fecha comercialización', mix: 'Fecha elaboración' };
    const litLbls   = {
      cremar:        `Litros a congelar (máx. ${max}L)`,
      comercializar: `Litros a comercializar (máx. ${max}L)`,
      baja:          `Litros vendidos / retirados (máx. ${max}L)`,
      mix:           'Litros a producir'
    };

    document.getElementById('modal-prod-title').textContent    = titulos[tipo] || tipo;
    document.getElementById('modal-prod-subtitle').textContent = nombre + (lotes && lotes.length > 1 ? ` (${lotes.length} lotes — se aplicará empezando por el más antiguo)` : '');
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
    const { tipo, nombre, max, lotes } = this._accion;
    const litros = parseFloat(document.getElementById('modal-prod-litros').value);
    const fecha  = document.getElementById('modal-prod-fecha').value;
    const notas  = document.getElementById('modal-prod-notas').value.trim() || null;

    if (!litros || litros <= 0 || (max < 9999 && litros > max)) {
      showToast(`Litros deben estar entre 0.1 y ${max}`, 'error'); return;
    }

    document.getElementById('btn-save-prod').disabled = true;
    try {
      if (tipo === 'mix') {
        await this._crearMix(nombre, litros, fecha, notas);
        showToast(`Mix de ${nombre} (${litros}L) registrado ✓`);
      } else {
        // Repartir los litros solicitados entre los lotes de origen,
        // empezando por el más antiguo (FIFO) hasta cubrir lo pedido.
        let restante = litros;
        for (const lote of lotes) {
          if (restante <= 0.005) break;
          const usar = +Math.min(restante, lote.pend).toFixed(2);
          if (usar <= 0) continue;
          if      (tipo === 'cremar')        await this._aplicarCremado(lote.id, nombre, usar, fecha, notas);
          else if (tipo === 'comercializar') await this._aplicarComercializado(lote.id, nombre, usar, fecha, notas);
          else if (tipo === 'baja')          await this._aplicarBaja(lote.id, usar, notas);
          restante = +(restante - usar).toFixed(2);
        }
        const msgs = {
          cremar:        `${litros}L de ${nombre} en congelación ✓`,
          comercializar: `${litros}L de ${nombre} en comercialización ✓`,
          baja:          `${litros}L de ${nombre} vendidos registrados ✓`,
        };
        showToast(msgs[tipo] || 'Hecho ✓');
      }
      closeModal('modal-prod-overlay');
      await this.renderOperativa();
    } catch (err) {
      showToast('Error: ' + (err.message || err), 'error');
    } finally {
      document.getElementById('btn-save-prod').disabled = false;
    }
  },

  // ── Mutaciones puras (sin toast/cierre de modal — eso lo hace ejecutarAccion,
  // una sola vez, aunque una acción FIFO toque varios lotes de origen) ──────
  async _crearMix(nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_mix').insert({ receta_nombre: nombre, litros, fecha, notas });
    if (error) throw error;
  },

  async _aplicarCremado(mixId, nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_cremado').insert({ mix_id: mixId, receta_nombre: nombre, litros, fecha_cremado: fecha, notas });
    if (error) throw error;
    const { data: mix } = await sb.from('lotes_mix').select('litros_cremados').eq('id', mixId).single();
    const { error: errUp } = await sb.from('lotes_mix').update({ litros_cremados: +((mix?.litros_cremados||0) + litros).toFixed(2) }).eq('id', mixId);
    if (errUp) throw errUp;
  },

  async _aplicarComercializado(cremadoId, nombre, litros, fecha, notas) {
    const { error } = await sb.from('lotes_venta').insert({ cremado_id: cremadoId, receta_nombre: nombre, litros, litros_restantes: litros, fecha_comercializacion: fecha, notas });
    if (error) throw error;
    const { data: cr } = await sb.from('lotes_cremado').select('litros_comercializados').eq('id', cremadoId).single();
    const { error: errUp } = await sb.from('lotes_cremado').update({ litros_comercializados: +((cr?.litros_comercializados||0) + litros).toFixed(2) }).eq('id', cremadoId);
    if (errUp) throw errUp;
  },

  async _aplicarBaja(ventaId, litros, notas) {
    const { data: lote } = await sb.from('lotes_venta').select('litros_restantes').eq('id', ventaId).single();
    const nuevos = Math.max(0, +((lote?.litros_restantes||0) - litros).toFixed(2));
    const { error } = await sb.from('lotes_venta').update({ litros_restantes: nuevos, notas }).eq('id', ventaId);
    if (error) throw error;
  },

  // ── Desde calculadora ────────────────────────────────────────────────────
  registrarMixDesdeCalc(nombre, litros) {
    this._accion = { tipo: 'mix', lotes: [], nombre, max: 9999 };
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

  // ── Admin: borrar todos los datos ───────────────────────────────────────
  esAdmin() {
    return Estado.getEmpleada() === 'Administrador';
  },

  async borrarHistoricoVentas() {
    if (!this.esAdmin()) return;
    const ok = confirm('⚠️ ¿Borrar todo el historial de comercializados?\n\nEsto eliminará todos los registros de lotes_venta.\nLos mixes y lotes en congelación no se borran.\nEsta acción no se puede deshacer.');
    if (!ok) return;

    const btn = document.querySelector('.prod-btn-danger');
    if (btn) { btn.disabled = true; btn.textContent = 'Borrando…'; }

    try {
      const { error } = await sb.from('lotes_venta').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;

      // Resetear litros_comercializados en lotes_cremado
      await sb.from('lotes_cremado').update({ litros_comercializados: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');

      showToast('Historial de comercializados eliminado ✓');
      await Produccion.load();
    } catch (err) {
      showToast('Error al borrar: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🗑️ Borrar historial de comercializados'; }
    }
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
