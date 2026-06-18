// ── dashboard.js ──────────────────────────────────────────────────────────────

const Dashboard = {

  async load() {
    this.renderGreeting();
    document.getElementById('dash-last-conteo-txt').textContent = '…';

    // Pills en estado cargando
    ['crit','low','ok'].forEach(t => {
      const el = document.getElementById(`dash-pill-${t}`);
      el.textContent = '–';
      el.classList.remove('hidden');
    });

    document.getElementById('alerts-list').innerHTML =
      '<div class="spinner-wrap" style="padding:12px"><div class="spinner"></div></div>';
    document.getElementById('dash-compras-btn').innerHTML = '';
    document.getElementById('dash-b2b-entregas').innerHTML =
      '<div class="spinner-wrap" style="padding:12px"><div class="spinner"></div></div>';
    ['bkpi-pedact', 'bkpi-enthoy', 'bkpi-incid', 'bkpi-facmes'].forEach(id => {
      document.getElementById(id).textContent = '–';
    });

    await Promise.all([
      this.loadStock(),
      this.loadLastConteo(),
      this.loadProduccionKPIs(),
      this.loadB2BKPIs(),
      this.loadB2BEntregas(),
    ]);
  },

  renderGreeting() {
    const empleada = Estado.getEmpleada() || '';
    const nombre   = empleada.split(' ')[0];
    const ahora    = new Date();
    const hora     = ahora.getHours();
    const saludo   = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

    document.getElementById('dash-greeting-name').textContent =
      `${saludo}, ${nombre} 👋`;
    document.getElementById('dash-greeting-date').textContent =
      ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  async loadStock() {
    try {
      const { data, error } = await sb
        .from('productos')
        .select('id, nombre, stock_actual, stock_minimo, unidad, proveedor, categorias(nombre)')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;

      let ok = 0, low = 0, crit = 0;
      const alertas = [];

      data.forEach(p => {
        if (p.stock_actual <= 0) {
          crit++;
          alertas.push({ ...p, nivel: 'crit' });
        } else if (p.stock_minimo > 0 && p.stock_actual < p.stock_minimo) {
          low++;
          alertas.push({ ...p, nivel: 'low' });
        } else {
          ok++;
        }
      });

      // Pills
      const pillCrit = document.getElementById('dash-pill-crit');
      const pillLow  = document.getElementById('dash-pill-low');
      const pillOk   = document.getElementById('dash-pill-ok');

      if (crit > 0) {
        pillCrit.textContent = `❌ ${crit}`;
        pillCrit.classList.remove('hidden');
      } else {
        pillCrit.classList.add('hidden');
      }
      if (low > 0) {
        pillLow.textContent = `⚠️ ${low}`;
        pillLow.classList.remove('hidden');
      } else {
        pillLow.classList.add('hidden');
      }
      pillOk.textContent = `✅ ${ok}`;
      pillOk.classList.remove('hidden');

      this.renderAlertas(alertas);
      this.renderComprasBtn(alertas.length);

    } catch (e) {
      console.error('Dashboard.loadStock:', e);
      document.getElementById('alerts-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar stock</div>';
    }
  },

  renderAlertas(items) {
    const el = document.getElementById('alerts-list');

    if (!items.length) {
      el.innerHTML = `
        <div class="dash-all-ok">
          <span class="dash-all-ok-icon">🎉</span>
          <span>Todo el inventario está en orden</span>
        </div>`;
      return;
    }

    // Críticos primero
    items.sort((a, b) => (a.nivel === 'crit' ? -1 : 1));

    el.innerHTML = items.map(p => {
      const cat  = p.categorias ? p.categorias.nombre : '';
      const prov = p.proveedor  ? ` · ${p.proveedor}` : '';
      return `
        <div class="alert-item">
          <div class="alert-item-left">
            <span class="badge badge-${p.nivel === 'crit' ? 'crit' : 'low'}">
              ${p.nivel === 'crit' ? '❌ Agotado' : '⚠️ Bajo'}
            </span>
            <div class="alert-item-info">
              <span class="alert-name">${escHtml(p.nombre)}</span>
              <span class="alert-sub">${escHtml(cat)}${escHtml(prov)}</span>
            </div>
          </div>
          <div class="alert-item-right">
            <span class="alert-stock">${fmtNum(p.stock_actual)} ${p.unidad}</span>
            <button class="btn-alert-compra" data-id="${p.id}" data-nombre="${escHtml(p.nombre)}" data-unidad="${p.unidad}" title="Añadir a compras">
              🛒
            </button>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.btn-alert-compra').forEach(btn => {
      btn.addEventListener('click', () => this.addToCompras(btn.dataset));
    });
  },

  renderComprasBtn(numAlertas) {
    const el = document.getElementById('dash-compras-btn');
    sb.from('lista_compra').select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .then(({ count }) => {
        const n = count || 0;
        const badge = n > 0 ? ` <span class="dash-compras-badge">${n}</span>` : '';
        const extra = numAlertas > 0
          ? `<span class="dash-compras-hint">Hay ${numAlertas} ingrediente${numAlertas > 1 ? 's' : ''} con alerta</span>`
          : '';
        el.innerHTML = `
          <button class="dash-compras-link" onclick="App.nav('compras')">
            🛒 Ir a lista de compras${badge}
          </button>
          ${extra}`;
      })
      .catch(() => {
        el.innerHTML = `<button class="dash-compras-link" onclick="App.nav('compras')">🛒 Lista de compras</button>`;
      });
  },

  async addToCompras({ id, nombre, unidad }) {
    const empleada = Estado.getEmpleada();
    try {
      const { data } = await sb
        .from('lista_compra')
        .select('id')
        .eq('producto_id', id)
        .eq('estado', 'pendiente')
        .limit(1);

      if (data && data.length) {
        showToast(`"${nombre}" ya está en la lista de compras`, 'info');
        return;
      }

      const { error } = await sb.from('lista_compra').insert({
        producto_id: parseInt(id),
        empleada,
        estado: 'pendiente',
        unidad,
      });
      if (error) throw error;
      showToast(`✓ "${nombre}" añadido a compras`, 'success');
      this.renderComprasBtn(0); // refresca el badge
    } catch (e) {
      showToast('Error al añadir', 'error');
    }
  },

  async loadProduccionKPIs() {
    try {
      const hoy   = new Date().toISOString().split('T')[0];
      const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [{ data: mixes }, { data: cremados }, { data: vitrina }, { data: ventas }] =
        await Promise.all([
          sb.from('lotes_mix').select('litros, litros_cremados'),
          sb.from('lotes_cremado').select('litros, litros_comercializados, fecha_cremado').lt('fecha_cremado', hoy),
          sb.from('lotes_venta').select('litros_restantes').gt('litros_restantes', 0),
          sb.from('lotes_venta').select('litros, litros_restantes').gte('fecha_comercializacion', hace7),
        ]);

      const nMixes   = (mixes    || []).filter(m => (m.litros - (m.litros_cremados || 0)) > 0.001).length;
      const nListos  = (cremados || []).filter(c => (c.litros - (c.litros_comercializados || 0)) > 0.001).length;
      const lVitrina = (vitrina  || []).reduce((s, v) => s + parseFloat(v.litros_restantes || 0), 0).toFixed(1);
      const lVendidos = (ventas  || []).reduce((s, v) => s + parseFloat((v.litros || 0) - (v.litros_restantes || 0)), 0).toFixed(1);

      document.getElementById('pkpi-mixes').textContent    = nMixes;
      document.getElementById('pkpi-listos').textContent   = nListos;
      document.getElementById('pkpi-vitrina').textContent  = lVitrina + 'L';
      document.getElementById('pkpi-vendidos').textContent = lVendidos + 'L';

    } catch (e) {
      console.error('loadProduccionKPIs:', e);
    }
  },

  async loadLastConteo() {
    try {
      const { data } = await sb
        .from('movimientos')
        .select('creado_en, empleada')
        .eq('tipo', 'ajuste')
        .order('creado_en', { ascending: false })
        .limit(1);

      const el = document.getElementById('dash-last-conteo-txt');
      if (!data || !data.length) {
        el.textContent = 'Sin conteos';
        return;
      }
      const d = new Date(data[0].creado_en);
      el.textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      document.getElementById('dash-last-conteo-badge').title =
        `Último conteo: ${fmtFecha(data[0].creado_en)} por ${data[0].empleada}`;
    } catch (e) {
      document.getElementById('dash-last-conteo-txt').textContent = '–';
    }
  },

  async loadB2BKPIs() {
    try {
      const hoy   = new Date().toISOString().split('T')[0];
      const ahora = new Date();
      const mes   = ahora.getMonth() + 1;
      const anio  = ahora.getFullYear();
      const ACTIVOS = ['pendiente', 'confirmado', 'preparando', 'incidencia'];

      const [rPedAct, rEntHoy, rIncid, rFactMes] = await Promise.all([
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .in('estado', ACTIVOS),
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .in('estado', ACTIVOS).eq('fecha_entrega_prevista', hoy),
        sb.from('pedidos_b2b').select('id', { count: 'exact', head: true })
          .or(`estado.eq.incidencia,and(estado.in.(pendiente,confirmado,preparando),fecha_entrega_prevista.lt.${hoy})`),
        sb.from('proformas_b2b').select('total_final')
          .eq('periodo_mes', mes).eq('periodo_anio', anio),
      ]);

      const nIncid    = rIncid.count || 0;
      const facturMes = (rFactMes.data || [])
        .reduce((s, p) => s + parseFloat(p.total_final || 0), 0);

      document.getElementById('bkpi-pedact').textContent = rPedAct.count || 0;
      document.getElementById('bkpi-enthoy').textContent = rEntHoy.count || 0;
      document.getElementById('bkpi-incid').textContent  = nIncid;
      document.getElementById('bkpi-facmes').textContent = Math.round(facturMes).toLocaleString('es-ES') + '€';

      const incidCard = document.getElementById('bkpi-incid-card');
      incidCard.classList.toggle('dash-prod-kpi-crit', nIncid > 0);
      incidCard.classList.toggle('dash-prod-kpi-ok', nIncid === 0);

    } catch (e) {
      console.error('loadB2BKPIs:', e);
      ['bkpi-pedact', 'bkpi-enthoy', 'bkpi-incid', 'bkpi-facmes'].forEach(id => {
        document.getElementById(id).textContent = '–';
      });
    }
  },

  async loadB2BEntregas() {
    const el = document.getElementById('dash-b2b-entregas');
    try {
      const hoy  = new Date().toISOString().split('T')[0];
      const en7  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await sb
        .from('pedidos_b2b')
        .select('id, estado, fecha_entrega_prevista, total_litros, clientes_b2b(nombre_comercial, razon_social)')
        .gte('fecha_entrega_prevista', hoy)
        .lte('fecha_entrega_prevista', en7)
        .not('estado', 'in', '("cancelado","facturado")')
        .order('fecha_entrega_prevista', { ascending: true })
        .limit(10);

      if (error) throw error;

      if (!data || !data.length) {
        el.innerHTML = '<div class="dash-b2b-empty">Sin entregas previstas esta semana</div>';
        return;
      }

      const hoyDate = new Date(hoy);

      el.innerHTML = data.map(p => {
        const cli    = p.clientes_b2b;
        const nombre = cli?.nombre_comercial || cli?.razon_social || '–';
        const fecha  = new Date(p.fecha_entrega_prevista + 'T00:00:00');
        const diffMs = fecha - hoyDate;
        const diffD  = Math.round(diffMs / (24 * 60 * 60 * 1000));

        let fechaLabel;
        if (diffD === 0)      fechaLabel = '<span class="dash-b2b-hoy">Hoy</span>';
        else if (diffD === 1) fechaLabel = '<span class="dash-b2b-hoy" style="background:#f59e0b">Mañana</span>';
        else                  fechaLabel = `<span class="dash-b2b-fecha">${fecha.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</span>`;

        const estadoBadge = p.estado === 'entregado'
          ? '<span class="badge badge-ok" style="font-size:10px">entregado</span>'
          : p.estado === 'incidencia'
          ? '<span class="badge badge-crit" style="font-size:10px">incidencia</span>'
          : '';

        return `
          <div class="dash-b2b-row">
            <div class="dash-b2b-cli">${escHtml(nombre)} ${estadoBadge}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
              ${fechaLabel}
              <span class="dash-b2b-litros">${fmtNum(p.total_litros || 0)}L</span>
            </div>
          </div>`;
      }).join('');

    } catch (e) {
      console.error('loadB2BEntregas:', e);
      el.innerHTML = '<div class="empty-msg error-msg">Error al cargar entregas</div>';
    }
  },
};
