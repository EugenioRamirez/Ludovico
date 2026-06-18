// ── dashboard-b2b.js · Dashboard Operativo B2B (B2B-DASH-001) ────────────────

const DashboardB2B = {

  _timer: null,     // auto-refresh handle
  _hoy:   null,     // ISO date string 'YYYY-MM-DD'
  _manana: null,

  // ── Carga principal ─────────────────────────────────────────────────────────

  async load() {
    const hoy     = new Date();
    const man     = new Date(hoy); man.setDate(man.getDate() + 1);
    this._hoy     = hoy.toISOString().split('T')[0];
    this._manana  = man.toISOString().split('T')[0];

    this._renderSkeleton();
    await this._fetchAll();
    this._startAutoRefresh();
  },

  unload() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  _startAutoRefresh() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      if (App.currentScreen === 'db2b') await this._fetchAll();
      else this.unload();
    }, 60_000);
  },

  _renderSkeleton() {
    const el = document.getElementById('db2b-content');
    if (!el) return;
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  },

  // ── Fetch paralelo de todos los datos ───────────────────────────────────────

  async _fetchAll() {
    try {
      const hoy    = this._hoy;
      const man    = this._manana;
      const hoyM   = new Date(hoy);
      const mes    = hoyM.getMonth() + 1;
      const anio   = hoyM.getFullYear();

      const en7    = new Date(hoy); en7.setDate(en7.getDate() + 7);
      const en7Iso = en7.toISOString().split('T')[0];

      const ACTIVOS  = ['pendiente', 'confirmado', 'preparando', 'incidencia'];
      const PENDPF   = ['borrador', 'revisada', 'enviada', 'aprobada'];

      // Rango del mes actual, para las KPIs de litros/facturación servidos
      const mesIniIso = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const mesFinDia  = new Date(anio, mes, 0).getDate(); // último día del mes
      const mesFinIso  = `${anio}-${String(mes).padStart(2, '0')}-${String(mesFinDia).padStart(2, '0')}`;

      const [
        rPedPend,
        rPedHoy,
        rPedMan,
        rAlbSinPf,
        rPfPend,
        rCliActivos,
        rKpiMes,
        rPedOper,
        rEntregas,
        rPfEstados,
        rActPed,
        rActPf,
        rActFact,
      ] = await Promise.all([

        // KPI 1: pedidos pendientes (no cerrados)
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .in('estado', ACTIVOS),

        // KPI 2: entregas hoy
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .in('estado', ACTIVOS)
          .eq('fecha_entrega_prevista', hoy),

        // KPI 3: entregas mañana
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .in('estado', ACTIVOS)
          .eq('fecha_entrega_prevista', man),

        // KPI 4: albaranes sin facturar (entregado sin proforma)
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .eq('estado', 'entregado')
          .is('proforma_id', null),

        // KPI 5: proformas pendientes
        sb.from('proformas_b2b').select('id', { count: 'exact', head: true })
          .in('estado', PENDPF),

        // KPI 6: clientes activos
        sb.from('clientes_b2b').select('id', { count: 'exact', head: true })
          .eq('activo', true),

        // KPI 7+8: litros servidos al cliente y su importe este mes — pedidos ya
        // entregados (o entregados y después facturados), según fecha de entrega
        // prevista. Independiente de si hay proforma/factura emitida o no.
        sb.from('pedidos_b2b')
          .select('total_litros, total_importe')
          .in('estado', ['entregado', 'facturado'])
          .gte('fecha_entrega_prevista', mesIniIso)
          .lte('fecha_entrega_prevista', mesFinIso),

        // Panel pedidos operativos (últimos 30 activos, ordenados por fecha entrega)
        sb.from('pedidos_b2b')
          .select(`id, estado, fecha_entrega_prevista,
                   total_litros, observaciones,
                   clientes_b2b(id, nombre_comercial, razon_social)`)
          .in('estado', ACTIVOS)
          .order('fecha_entrega_prevista', { ascending: true })
          .limit(30),

        // Panel entregas próximas (hoy → +7 días)
        sb.from('pedidos_b2b')
          .select(`id, estado, fecha_entrega_prevista,
                   total_litros, observaciones,
                   clientes_b2b(id, nombre_comercial, razon_social)`)
          .in('estado', ['pendiente', 'confirmado', 'preparando', 'entregado', 'incidencia'])
          .gte('fecha_entrega_prevista', hoy)
          .lte('fecha_entrega_prevista', en7Iso)
          .order('fecha_entrega_prevista', { ascending: true })
          .limit(50),

        // Panel facturación: proformas por estado
        sb.from('proformas_b2b')
          .select('estado, total_final, total_litros, periodo_mes, periodo_anio, id, cliente_id, clientes_b2b(nombre_comercial, razon_social)')
          .in('estado', PENDPF)
          .order('periodo_anio', { ascending: false })
          .order('periodo_mes',  { ascending: false })
          .limit(20),

        // Actividad reciente: pedidos (por última modificación, así un cambio de
        // estado reciente — p.ej. a "entregado" — sube al feed)
        sb.from('pedidos_b2b')
          .select('id, estado, created_at, updated_at, modificado_por, clientes_b2b(nombre_comercial, razon_social)')
          .order('updated_at', { ascending: false })
          .limit(8),

        // Actividad reciente: proformas (idem, por updated_at)
        sb.from('proformas_b2b')
          .select('id, estado, periodo_mes, periodo_anio, created_at, updated_at, modificado_por, clientes_b2b(nombre_comercial, razon_social)')
          .order('updated_at', { ascending: false })
          .limit(5),

        // Actividad reciente: facturas
        sb.from('facturas_b2b')
          .select('id, numero_factura, fecha_factura, usuario_facturacion, created_at, proformas_b2b(periodo_mes, periodo_anio, clientes_b2b(nombre_comercial, razon_social))')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Calcular KPIs de mes (litros servidos y su importe, ya entregados)
      const kpiMesDatos = rKpiMes.data || [];
      const litrosMes   = kpiMesDatos.reduce((s, p) => s + parseFloat(p.total_litros || 0), 0);
      const facturMes   = kpiMesDatos.reduce((s, p) => s + parseFloat(p.total_importe || 0), 0);

      this._render({
        kpis: {
          pedPend:    rPedPend.count   || 0,
          entHoy:     rPedHoy.count    || 0,
          entMan:     rPedMan.count    || 0,
          albSinPf:   rAlbSinPf.count  || 0,
          pfPend:     rPfPend.count    || 0,
          cliActivos: rCliActivos.count || 0,
          litrosMes,
          facturMes,
          mes, anio,
        },
        pedOper:    rPedOper.data   || [],
        entregas:   rEntregas.data  || [],
        pfEstados:  rPfEstados.data || [],
        actividad:  this._mergeActividad(
                      rActPed.data  || [],
                      rActPf.data   || [],
                      rActFact.data || [],
                    ),
      });

    } catch (err) {
      console.error('DashboardB2B._fetchAll:', err);
      const el = document.getElementById('db2b-content');
      if (el) el.innerHTML = `<div class="empty-msg">Error cargando el dashboard. ${err.message || ''}</div>`;
    }
  },

  // ── Render principal ────────────────────────────────────────────────────────

  _render(d) {
    const el = document.getElementById('db2b-content');
    if (!el) return;

    const { kpis } = d;
    const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mesLabel = `${MESES[kpis.mes]} ${kpis.anio}`;

    el.innerHTML = `
      <!-- ── KPI Grid ── -->
      <div class="db2b-kpi-grid">
        ${this._kpiCard('⏳', 'Pedidos activos',      kpis.pedPend,  '',       kpis.pedPend  > 0 ? 'kpi-warn' : 'kpi-ok',  'pedidos')}
        ${this._kpiCard('📦', 'Entregas hoy',          kpis.entHoy,   '',       kpis.entHoy   > 0 ? 'kpi-info' : '',        'pedidos')}
        ${this._kpiCard('🚚', 'Entregas mañana',       kpis.entMan,   '',       '',                                          'pedidos')}
        ${this._kpiCard('📋', 'Albaranes sin proforma',kpis.albSinPf,'',        kpis.albSinPf > 0 ? 'kpi-warn' : 'kpi-ok',  'proformas')}
        ${this._kpiCard('🧾', 'Proformas pendientes',  kpis.pfPend,   '',       kpis.pfPend   > 0 ? 'kpi-info' : 'kpi-ok',  'proformas')}
        ${this._kpiCard('👥', 'Clientes activos',      kpis.cliActivos,'',      'kpi-blue',                                  'clientes')}
        ${this._kpiCard('🧊', `Litros servidos ${mesLabel}`,    kpis.litrosMes.toFixed(0), 'L', 'kpi-blue', 'pedidos')}
        ${this._kpiCard('💶', `Facturación ${mesLabel}`,kpis.facturMes.toFixed(2),'€','kpi-green', 'pedidos')}
      </div>

      <!-- ── Panels grid ── -->
      <div class="db2b-panels">

        <!-- Pedidos operativos -->
        <div class="db2b-panel">
          <div class="db2b-panel-header">
            <span>📦 Pedidos operativos</span>
            <button class="btn btn-sm btn-ghost" onclick="App.nav('pedidos')">Ver todos →</button>
          </div>
          <div class="db2b-panel-body">
            ${this._renderPedOper(d.pedOper)}
          </div>
        </div>

        <!-- Entregas próximas -->
        <div class="db2b-panel">
          <div class="db2b-panel-header">
            <span>🚚 Entregas próximas</span>
            <button class="btn btn-sm btn-ghost" onclick="App.nav('pedidos')">Ver pedidos →</button>
          </div>
          <div class="db2b-panel-body">
            ${this._renderEntregas(d.entregas)}
          </div>
        </div>

        <!-- Panel facturación -->
        <div class="db2b-panel">
          <div class="db2b-panel-header">
            <span>🧾 Facturación pendiente</span>
            <button class="btn btn-sm btn-ghost" onclick="App.nav('proformas')">Ver proformas →</button>
          </div>
          <div class="db2b-panel-body">
            ${this._renderFact(d.pfEstados)}
          </div>
        </div>

      </div>

      <!-- ── Actividad reciente ── -->
      <div class="db2b-actividad">
        <div class="db2b-panel-header">
          <span>🕐 Actividad reciente</span>
          <button class="btn btn-sm btn-ghost" onclick="DashboardB2B._fetchAll()">🔄 Actualizar</button>
        </div>
        <div class="db2b-timeline">
          ${this._renderActividad(d.actividad)}
        </div>
      </div>
    `;
  },

  // ── KPI Card ────────────────────────────────────────────────────────────────

  _kpiCard(icon, label, value, unit, cls, navTarget) {
    return `
      <div class="db2b-kpi ${cls || ''}" ${navTarget ? `onclick="App.nav('${navTarget}')" style="cursor:pointer"` : ''}>
        <div class="db2b-kpi-icon">${icon}</div>
        <div class="db2b-kpi-value">${value}<span class="db2b-kpi-unit">${unit}</span></div>
        <div class="db2b-kpi-label">${label}</div>
      </div>`;
  },

  // ── Panel: Pedidos operativos ───────────────────────────────────────────────

  _renderPedOper(peds) {
    if (!peds.length) return '<p class="db2b-empty">No hay pedidos activos</p>';

    const BADGE = {
      pendiente:  'badge-pend',
      confirmado: 'badge-pedido',
      preparando: 'badge-low',
      incidencia: 'badge-crit',
    };

    return peds.map(p => {
      const cli    = p.clientes_b2b;
      const nombre = cli?.nombre_comercial || cli?.razon_social || '–';
      const vence  = p.fecha_entrega_prevista;
      const hoy    = this._hoy;
      const tarde  = vence && vence < hoy;
      const esHoy  = vence === hoy;

      return `
      <div class="db2b-ped-row ${tarde ? 'db2b-row-late' : ''}" onclick="App.nav('pedidos')">
        <div class="db2b-ped-left">
          <span class="badge ${BADGE[p.estado] || 'badge-ok'}">${p.estado}</span>
          <span class="db2b-ped-cliente">${escHtml(nombre)}</span>
        </div>
        <div class="db2b-ped-right">
          ${vence ? `<span class="db2b-ped-fecha ${tarde ? 'late' : esHoy ? 'today' : ''}">${fmtFecha(vence)}</span>` : ''}
          <span class="db2b-ped-litros">${parseFloat(p.total_litros || 0).toFixed(0)} L</span>
        </div>
      </div>`;
    }).join('');
  },

  // ── Panel: Entregas próximas ────────────────────────────────────────────────

  _renderEntregas(peds) {
    if (!peds.length) return '<p class="db2b-empty">Sin entregas en los próximos 7 días</p>';

    const hoy  = this._hoy;
    const man  = this._manana;

    const grupos = { hoy: [], manana: [], resto: [] };
    peds.forEach(p => {
      const f = p.fecha_entrega_prevista;
      if (f === hoy)  grupos.hoy.push(p);
      else if (f === man) grupos.manana.push(p);
      else grupos.resto.push(p);
    });

    let html = '';
    const renderGrupo = (label, items) => {
      if (!items.length) return '';
      return `
        <div class="db2b-ent-grupo-lbl">${label} (${items.length})</div>
        ${items.map(p => {
          const cli    = p.clientes_b2b;
          const nombre = cli?.nombre_comercial || cli?.razon_social || '–';
          const BADGE  = { pendiente:'badge-pend', confirmado:'badge-pedido',
                           preparando:'badge-low', entregado:'badge-ok', incidencia:'badge-crit' };
          return `
          <div class="db2b-ent-row">
            <span class="badge ${BADGE[p.estado] || 'badge-ok'}">${p.estado}</span>
            <span class="db2b-ent-cliente">${escHtml(nombre)}</span>
            <span class="db2b-ent-litros">${parseFloat(p.total_litros || 0).toFixed(0)} L</span>
          </div>`;
        }).join('')}`;
    };

    html += renderGrupo('🔴 Hoy',    grupos.hoy);
    html += renderGrupo('🟡 Mañana', grupos.manana);
    html += renderGrupo('📅 Esta semana', grupos.resto);
    return html || '<p class="db2b-empty">Sin entregas próximas</p>';
  },

  // ── Panel: Facturación ──────────────────────────────────────────────────────

  _renderFact(proformas) {
    if (!proformas.length) return '<p class="db2b-empty">No hay proformas pendientes</p>';

    const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const porEstado = { borrador: [], revisada: [], enviada: [], aprobada: [] };
    proformas.forEach(pf => { if (porEstado[pf.estado]) porEstado[pf.estado].push(pf); });

    const EST_LABEL = {
      borrador:  { icon: '📝', label: 'Borrador' },
      revisada:  { icon: '👁️',  label: 'Revisada' },
      enviada:   { icon: '📤', label: 'Enviada al cliente' },
      aprobada:  { icon: '✅', label: 'Aprobada — pendiente facturar' },
    };

    let html = '';
    ['aprobada', 'enviada', 'revisada', 'borrador'].forEach(est => {
      const items = porEstado[est];
      if (!items.length) return;
      const e = EST_LABEL[est];
      html += `<div class="db2b-fact-grupo">
        <div class="db2b-fact-grupo-lbl">${e.icon} ${e.label} (${items.length})</div>`;
      items.slice(0, 5).forEach(pf => {
        const cli    = pf.clientes_b2b;
        const nombre = cli?.nombre_comercial || cli?.razon_social || '–';
        html += `
        <div class="db2b-fact-row" onclick="App.nav('proformas')">
          <span class="db2b-fact-cli">${escHtml(nombre)}</span>
          <span class="db2b-fact-per">${MESES[pf.periodo_mes]} ${pf.periodo_anio}</span>
          <span class="db2b-fact-tot">${parseFloat(pf.total_final || 0).toFixed(2)} €</span>
        </div>`;
      });
      if (items.length > 5) html += `<div class="db2b-fact-more">+${items.length - 5} más</div>`;
      html += '</div>';
    });

    return html;
  },

  // ── Actividad reciente ──────────────────────────────────────────────────────

  _mergeActividad(peds, pfs, facts) {
    const eventos = [];

    const PED_EVENTO = {
      pendiente:  { icon: '📦', texto: 'Pedido recibido' },
      confirmado: { icon: '✅', texto: 'Pedido confirmado' },
      preparando: { icon: '🧊', texto: 'Pedido en elaboración' },
      entregado:  { icon: '🚚', texto: 'Pedido entregado' },
      incidencia: { icon: '⚠️', texto: 'Incidencia en pedido' },
      cancelado:  { icon: '❌', texto: 'Pedido cancelado' },
      facturado:  { icon: '🧾', texto: 'Pedido facturado' },
    };

    peds.forEach(p => {
      const cli = p.clientes_b2b;
      const ev  = PED_EVENTO[p.estado] || { icon: '📦', texto: 'Pedido' };
      eventos.push({
        ts:     p.updated_at || p.created_at,
        icon:   ev.icon,
        texto:  `${ev.texto} — ${cli?.nombre_comercial || cli?.razon_social || '–'}`,
        sub:    `Pedido ${p.id.slice(0,6).toUpperCase()}`,
        nav:    'pedidos',
        user:   p.modificado_por || '',
      });
    });

    pfs.forEach(p => {
      const cli    = p.clientes_b2b;
      const MESES  = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const PF_EVENTO = {
        borrador:  { icon: '📝', texto: 'Proforma creada' },
        revisada:  { icon: '👁️', texto: 'Proforma revisada' },
        enviada:   { icon: '📤', texto: 'Proforma emitida' },
        aprobada:  { icon: '✅', texto: 'Proforma aprobada' },
        facturada: { icon: '🧾', texto: 'Proforma facturada' },
      };
      const ev = PF_EVENTO[p.estado] || { icon: '📋', texto: 'Proforma' };
      eventos.push({
        ts:     p.updated_at || p.created_at,
        icon:   ev.icon,
        texto:  `${ev.texto} — ${cli?.nombre_comercial || cli?.razon_social || '–'}`,
        sub:    `${MESES[p.periodo_mes]} ${p.periodo_anio}`,
        nav:    'proformas',
        user:   p.modificado_por || '',
      });
    });

    facts.forEach(f => {
      const pf  = f.proformas_b2b;
      const cli = pf?.clientes_b2b;
      const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      eventos.push({
        ts:     f.created_at,
        icon:   '🧾',
        texto:  `Factura ${f.numero_factura}`,
        sub:    `${cli?.nombre_comercial || cli?.razon_social || '–'} · ${pf ? MESES[pf.periodo_mes] + ' ' + pf.periodo_anio : ''}`,
        nav:    'facturas',
        user:   f.usuario_facturacion || '',
      });
    });

    return eventos
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 15);
  },

  _renderActividad(eventos) {
    if (!eventos.length) return '<p class="db2b-empty">Sin actividad reciente</p>';

    return eventos.map(ev => {
      const hace = this._timeAgo(ev.ts);
      return `
      <div class="db2b-act-row" onclick="App.nav('${ev.nav}')">
        <div class="db2b-act-icon">${ev.icon}</div>
        <div class="db2b-act-body">
          <div class="db2b-act-texto">${escHtml(ev.texto)}</div>
          <div class="db2b-act-sub">${escHtml(ev.sub)}</div>
        </div>
        <div class="db2b-act-meta">
          <span class="db2b-act-hace">${hace}</span>
          ${ev.user ? `<span class="db2b-act-user">${escHtml(ev.user)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'ahora';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h`;
    const dias = Math.floor(h / 24);
    return `${dias} d`;
  },
};
