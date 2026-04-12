// ── dashboard.js ──────────────────────────────────────────────────────────────

const Dashboard = {

  async load() {
    this.renderKPIs('–', '–', '–');
    document.getElementById('alerts-list').innerHTML        = '<div class="empty-msg">Cargando…</div>';
    document.getElementById('dash-compras-count').textContent = 'Cargando…';
    document.getElementById('last-conteo').textContent     = 'Cargando…';

    await Promise.all([
      this.loadStock(),
      this.loadComprasPendientes(),
      this.loadLastConteo(),
    ]);
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
        .select('id, nombre, stock_actual, stock_minimo, unidad')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;

      let ok = 0, low = 0, crit = 0;
      const alertItems = [];

      data.forEach(p => {
        const ratio = p.stock_minimo > 0 ? p.stock_actual / p.stock_minimo : 1;
        if (p.stock_actual <= 0) {
          crit++;
          alertItems.push({ ...p, nivel: 'crit' });
        } else if (ratio < 1) {
          low++;
          alertItems.push({ ...p, nivel: 'low' });
        } else {
          ok++;
        }
      });

      this.renderKPIs(ok, low, crit);
      this.renderAlerts(alertItems);

    } catch (e) {
      console.error('Dashboard.loadStock:', e);
      document.getElementById('alerts-list').innerHTML = '<div class="empty-msg error-msg">Error al cargar stock</div>';
    }
  },

  renderAlerts(items) {
    const el = document.getElementById('alerts-list');
    if (!items.length) {
      el.innerHTML = '<div class="empty-msg">✅ Todo el inventario está OK</div>';
      return;
    }
    // Sort: crit first, then low
    items.sort((a, b) => (a.nivel === 'crit' ? -1 : 1));
    el.innerHTML = items.slice(0, 8).map(p => `
      <div class="alert-item">
        <span class="badge badge-${p.nivel === 'crit' ? 'crit' : 'low'}">
          ${p.nivel === 'crit' ? '❌ Agotado' : '⚠️ Bajo'}
        </span>
        <span class="alert-name">${p.nombre}</span>
        <span class="alert-stock">${fmtNum(p.stock_actual)} ${p.unidad}</span>
      </div>
    `).join('') + (items.length > 8
      ? `<div class="empty-msg" style="margin-top:8px">…y ${items.length - 8} más</div>`
      : '');
  },

  async loadComprasPendientes() {
    try {
      const { data, error } = await sb
        .from('lista_compra')
        .select('id', { count: 'exact' })
        .eq('estado', 'pendiente');

      if (error) throw error;
      const n = data ? data.length : 0;
      document.getElementById('dash-compras-count').textContent =
        n > 0 ? `${n} ítem${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''} de pedir` : 'No hay ítems pendientes';
    } catch (e) {
      document.getElementById('dash-compras-count').textContent = 'Error al cargar';
    }
  },

  async loadLastConteo() {
    try {
      // The last conteo is the most recent movimiento of tipo='ajuste' (conteo semanal saves as ajuste)
      const { data, error } = await sb
        .from('movimientos')
        .select('creado_en, empleada')
        .eq('tipo', 'ajuste')
        .order('creado_en', { ascending: false })
        .limit(1);

      if (error) throw error;
      const el = document.getElementById('last-conteo');
      if (!data || !data.length) {
        el.textContent = 'No hay conteos registrados aún';
        return;
      }
      const mov = data[0];
      el.innerHTML = `<strong>${fmtFecha(mov.creado_en)}</strong> · por ${mov.empleada || 'Empleada'}`;
    } catch (e) {
      document.getElementById('last-conteo').textContent = 'Error al cargar';
    }
  }
};
