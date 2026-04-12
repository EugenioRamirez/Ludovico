// ── dashboard.js ──────────────────────────────────────────────────────────────

const Dashboard = {

  async load() {
    this.renderGreeting();
    this.renderKPIs('–', '–', '–');
    document.getElementById('alerts-list').innerHTML   = '<div class="empty-msg">Cargando…</div>';
    document.getElementById('dash-last-conteo-txt').textContent = '…';
    document.getElementById('dash-action-compras').textContent  = 'Lista de compras';

    await Promise.all([
      this.loadStock(),
      this.loadComprasPendientes(),
      this.loadLastConteo(),
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

  renderKPIs(ok, low, crit) {
    document.getElementById('kpi-ok').querySelector('.kpi-val').textContent   = ok;
    document.getElementById('kpi-low').querySelector('.kpi-val').textContent  = low;
    document.getElementById('kpi-crit').querySelector('.kpi-val').textContent = crit;
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

      this.renderKPIs(ok, low, crit);
      this.renderAlertas(alertas);

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
              <span class="alert-name">${p.nombre}</span>
              <span class="alert-sub">${cat}${prov}</span>
            </div>
          </div>
          <div class="alert-item-right">
            <span class="alert-stock">${fmtNum(p.stock_actual)} ${p.unidad}</span>
            <button class="btn-alert-compra" data-id="${p.id}" data-nombre="${p.nombre}" data-unidad="${p.unidad}" title="Añadir a compras">
              🛒
            </button>
          </div>
        </div>`;
    }).join('');

    // Botón añadir a compras directamente desde dashboard
    el.querySelectorAll('.btn-alert-compra').forEach(btn => {
      btn.addEventListener('click', () => this.addToCompras(btn.dataset));
    });
  },

  async addToCompras({ id, nombre, unidad }) {
    const empleada = Estado.getEmpleada();
    try {
      // Comprobar si ya está pendiente
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
      this.loadComprasPendientes();
    } catch (e) {
      showToast('Error al añadir', 'error');
    }
  },

  async loadComprasPendientes() {
    try {
      const { data } = await sb
        .from('lista_compra')
        .select('id')
        .eq('estado', 'pendiente');

      const n   = data ? data.length : 0;
      const txt = n > 0 ? `Lista de compras (${n})` : 'Lista de compras';
      document.getElementById('dash-action-compras').textContent = txt;
    } catch (e) { /* silencioso */ }
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
  }
};
