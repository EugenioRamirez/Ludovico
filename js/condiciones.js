// ── condiciones.js · Condiciones Comerciales B2B ──────────────────────────────

const Condiciones = {
  lista:     [],    // condiciones cargadas
  clientes:  [],    // para los selectores
  sabores:   [],    // para los selectores
  filtro:    'activa',   // 'activa' | 'inactiva' | 'all'
  filtroCliente: '',     // UUID del cliente o '' para todos
  searchQ:   '',

  // ── Carga ────────────────────────────────────────────────────────────────────

  async load() {
    document.getElementById('condiciones-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await Promise.all([
      this.loadCondiciones(),
      this.loadClientes(),
      this.loadSabores(),
    ]);
    this.renderClienteFilter();
    this.renderFilterTabs();
    this.renderList();
    this.bindUI();
  },

  async loadCondiciones() {
    try {
      const { data, error } = await sb
        .from('condiciones_comerciales')
        .select(`
          *,
          clientes_b2b ( id, razon_social, nombre_comercial ),
          sabores_b2b  ( id, nombre, categoria )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.lista = data || [];
    } catch (e) {
      console.error('Condiciones.loadCondiciones:', e);
      document.getElementById('condiciones-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar condiciones</div>';
    }
  },

  async loadClientes() {
    try {
      const { data } = await sb
        .from('clientes_b2b')
        .select('id, razon_social, nombre_comercial')
        .eq('activo', true)
        .order('razon_social');
      this.clientes = data || [];
    } catch (e) { console.error('Condiciones.loadClientes:', e); }
  },

  async loadSabores() {
    try {
      const { data } = await sb
        .from('sabores_b2b')
        .select('id, nombre, categoria, precio_litro')
        .eq('activo', true)
        .eq('visible_b2b', true)
        .order('orden_visualizacion')
        .order('nombre');
      this.sabores = data || [];
    } catch (e) { console.error('Condiciones.loadSabores:', e); }
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────

  nombreCliente(c) {
    if (!c) return '–';
    return c.nombre_comercial || c.razon_social;
  },

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  filtered() {
    let list = this.lista;
    if (this.filtro === 'activa')   list = list.filter(c => c.activa);
    if (this.filtro === 'inactiva') list = list.filter(c => !c.activa);
    if (this.filtroCliente)         list = list.filter(c => c.cliente_id === this.filtroCliente);
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(c =>
        (c.clientes_b2b?.razon_social  || '').toLowerCase().includes(q) ||
        (c.clientes_b2b?.nombre_comercial || '').toLowerCase().includes(q) ||
        (c.sabores_b2b?.nombre         || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  // ── Render selector de cliente ────────────────────────────────────────────────

  renderClienteFilter() {
    const sel = document.getElementById('condiciones-cliente-filter');
    sel.innerHTML = '<option value="">— Todos los clientes —</option>';
    this.clientes.forEach(c => {
      const label = c.nombre_comercial || c.razon_social;
      sel.innerHTML += `<option value="${c.id}">${escHtml(label)}</option>`;
    });
    sel.value = this.filtroCliente;
    sel.onchange = () => {
      this.filtroCliente = sel.value;
      this.renderList();
    };
  },

  // ── Render pestañas ──────────────────────────────────────────────────────────

  renderFilterTabs() {
    const tabs = document.getElementById('condiciones-filter-tabs');
    const opciones = [
      { val: 'activa',   label: 'Activas' },
      { val: 'inactiva', label: 'Inactivas' },
      { val: 'all',      label: 'Todas' },
    ];
    tabs.innerHTML = opciones.map(o =>
      `<button class="filter-tab ${this.filtro === o.val ? 'active' : ''}" data-filtro="${o.val}">${o.label}</button>`
    ).join('');
    tabs.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtro = btn.dataset.filtro;
        tabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderList();
      });
    });
  },

  // ── Render lista ─────────────────────────────────────────────────────────────

  CAT_BADGE: { estandar: 'badge-ok', especial: 'badge-pend', premium: 'badge-pedido' },

  renderList() {
    const list    = this.filtered();
    const el      = document.getElementById('condiciones-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay condiciones comerciales</div>';
      document.getElementById('fab-add-condicion').style.display = esAdmin ? 'flex' : 'none';
      return;
    }

    el.innerHTML = list.map(c => {
      const cliente    = this.nombreCliente(c.clientes_b2b);
      const sabor      = c.sabores_b2b?.nombre || '–';
      const catBadge   = this.CAT_BADGE[c.sabores_b2b?.categoria] || 'badge-ok';
      const catLabel   = c.sabores_b2b?.categoria
        ? ({ estandar: 'Estándar', especial: 'Especial', premium: 'Premium' })[c.sabores_b2b.categoria]
        : '';
      const estadoBadge = c.activa
        ? '<span class="badge badge-ok">Activa</span>'
        : '<span class="badge badge-crit">Inactiva</span>';
      const promoBadge = c.es_promocional
        ? '<span class="badge badge-pend">🎁 Promo</span>'
        : '';
      const precio = c.es_promocional && c.precio_promocional !== null
        ? `<span style="text-decoration:line-through;color:var(--text-muted)">${parseFloat(c.precio_litro).toFixed(2)}€</span> <strong>${parseFloat(c.precio_promocional).toFixed(2)} €/L</strong>`
        : `<strong>${parseFloat(c.precio_litro).toFixed(2)} €/L</strong>`;
      const fechas = c.fecha_fin
        ? `${fmtFecha(c.fecha_inicio)} → ${fmtFecha(c.fecha_fin)}`
        : `Desde ${fmtFecha(c.fecha_inicio)}`;

      return `
        <div class="producto-item" data-id="${c.id}">
          <div class="producto-main">
            <div class="producto-info">
              <span class="producto-nombre">${escHtml(cliente)}</span>
              <span class="producto-cat">
                ${escHtml(sabor)}
                ${catLabel ? `· <span class="badge ${catBadge}" style="font-size:10px;padding:2px 7px">${catLabel}</span>` : ''}
              </span>
            </div>
            <div class="producto-stock-wrap" style="gap:5px;flex-direction:column;align-items:flex-end">
              ${estadoBadge}
              ${promoBadge}
            </div>
          </div>
          <div class="cliente-meta">
            <span>💶 ${precio}</span>
            <span>📅 ${fechas}</span>
          </div>
          ${c.notas_comerciales ? `<div class="cliente-meta" style="margin-top:2px;font-style:italic">${escHtml(c.notas_comerciales)}</div>` : ''}
          ${esAdmin ? `
          <div class="producto-actions">
            <button class="btn btn-sm btn-outline btn-edit-condicion" data-id="${c.id}">✏️ Editar</button>
            <button class="btn btn-sm btn-ghost btn-toggle-condicion" data-id="${c.id}" data-activa="${c.activa}">
              ${c.activa ? '🔴 Desactivar' : '🟢 Activar'}
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-edit-condicion').forEach(btn => {
      btn.addEventListener('click', () => this.openModal(btn.dataset.id));
    });
    el.querySelectorAll('.btn-toggle-condicion').forEach(btn => {
      btn.addEventListener('click', () => this.toggleActiva(btn.dataset.id, btn.dataset.activa === 'true'));
    });

    document.getElementById('fab-add-condicion').style.display = esAdmin ? 'flex' : 'none';
  },

  // ── Toggle activa ────────────────────────────────────────────────────────────

  async toggleActiva(id, estaActiva) {
    const c = this.lista.find(x => x.id === id);
    const desc = `${this.nombreCliente(c?.clientes_b2b)} – ${c?.sabores_b2b?.nombre}`;
    if (!confirm(`¿${estaActiva ? 'Desactivar' : 'Activar'} la condición de "${desc}"?`)) return;

    try {
      const { error } = await sb
        .from('condiciones_comerciales')
        .update({ activa: !estaActiva, modificado_por: Estado.getEmpleada() })
        .eq('id', id);
      if (error) throw error;
      showToast(`Condición ${estaActiva ? 'desactivada' : 'activada'} ✓`, 'success');
      await this.load();
    } catch (e) {
      console.error('Condiciones.toggleActiva:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Modal ────────────────────────────────────────────────────────────────────

  openModal(id) {
    const c = id ? this.lista.find(x => x.id === id) : null;

    document.getElementById('modal-condicion-title').textContent =
      c ? 'Editar Condición Comercial' : 'Nueva Condición Comercial';
    document.getElementById('condicion-id').value = c?.id || '';

    // Poblar selector clientes
    const selCliente = document.getElementById('condicion-cliente');
    selCliente.innerHTML = '<option value="">— Selecciona cliente —</option>';
    this.clientes.forEach(cl => {
      const label = cl.nombre_comercial || cl.razon_social;
      selCliente.innerHTML += `<option value="${cl.id}">${escHtml(label)}</option>`;
    });
    selCliente.value = c?.cliente_id || '';

    // Poblar selector sabores
    this._fillSaboresSelect(c?.sabor_id || '');

    // Rellenar campos
    document.getElementById('condicion-precio').value       = c?.precio_litro || '';
    document.getElementById('condicion-fecha-inicio').value = c?.fecha_inicio || new Date().toISOString().slice(0, 10);
    document.getElementById('condicion-fecha-fin').value    = c?.fecha_fin || '';
    document.getElementById('condicion-promo').checked      = c?.es_promocional || false;
    document.getElementById('condicion-precio-promo').value = c?.precio_promocional || '';
    document.getElementById('condicion-observaciones').value = c?.observaciones || '';
    document.getElementById('condicion-notas').value        = c?.notas_comerciales || '';

    this._togglePromoRow(c?.es_promocional || false);

    openModal('modal-condicion-overlay');
  },

  _fillSaboresSelect(selectedId) {
    const sel = document.getElementById('condicion-sabor');
    sel.innerHTML = '<option value="">— Selecciona sabor —</option>';
    this.sabores.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${escHtml(s.nombre)}</option>`;
    });
    sel.value = selectedId;
    // Sugerir precio estándar al seleccionar sabor
    sel.onchange = () => {
      const sabor = this.sabores.find(s => s.id === sel.value);
      if (sabor?.precio_litro && !document.getElementById('condicion-precio').value) {
        document.getElementById('condicion-precio').value = parseFloat(sabor.precio_litro).toFixed(2);
      }
    };
  },

  _togglePromoRow(show) {
    document.getElementById('condicion-promo-row').style.display = show ? '' : 'none';
  },

  // ── Guardar ──────────────────────────────────────────────────────────────────

  async saveCondicion() {
    const id            = document.getElementById('condicion-id').value.trim();
    const cliente_id    = document.getElementById('condicion-cliente').value;
    const sabor_id      = document.getElementById('condicion-sabor').value;
    const precio_litro  = parseFloat(document.getElementById('condicion-precio').value);
    const fecha_inicio  = document.getElementById('condicion-fecha-inicio').value;
    const fecha_fin     = document.getElementById('condicion-fecha-fin').value || null;
    const es_promocional = document.getElementById('condicion-promo').checked;
    const precio_promo_raw = document.getElementById('condicion-precio-promo').value;
    const precio_promocional = es_promocional && precio_promo_raw !== ''
      ? parseFloat(precio_promo_raw)
      : null;
    const observaciones    = document.getElementById('condicion-observaciones').value.trim() || null;
    const notas_comerciales = document.getElementById('condicion-notas').value.trim() || null;

    // Validaciones
    if (!cliente_id)           { showToast('Selecciona un cliente', 'error'); return; }
    if (!sabor_id)             { showToast('Selecciona un sabor', 'error'); return; }
    if (isNaN(precio_litro) || precio_litro < 0) { showToast('El precio por litro es obligatorio', 'error'); return; }
    if (!fecha_inicio)         { showToast('La fecha de inicio es obligatoria', 'error'); return; }
    if (fecha_fin && fecha_fin < fecha_inicio) {
      showToast('La fecha fin no puede ser anterior al inicio', 'error'); return;
    }

    // Validar duplicado activo (client-side)
    const duplicado = this.lista.find(c =>
      c.cliente_id === cliente_id &&
      c.sabor_id   === sabor_id   &&
      c.activa     === true        &&
      c.id         !== id
    );
    if (duplicado) {
      const nombreSabor   = duplicado.sabores_b2b?.nombre || '';
      const nombreCliente = this.nombreCliente(duplicado.clientes_b2b);
      showToast(`Ya existe una condición activa para "${nombreCliente} – ${nombreSabor}"`, 'error');
      return;
    }

    const btn = document.getElementById('btn-save-condicion');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    const empleada = Estado.getEmpleada();

    try {
      const payload = {
        cliente_id, sabor_id, precio_litro, activa: true,
        fecha_inicio, fecha_fin, es_promocional, precio_promocional,
        observaciones, notas_comerciales,
        modificado_por: empleada,
      };

      if (id) {
        const { error } = await sb.from('condiciones_comerciales').update(payload).eq('id', id);
        if (error) throw error;
        showToast('Condición actualizada ✓', 'success');
      } else {
        const { error } = await sb.from('condiciones_comerciales').insert({
          ...payload, creado_por: empleada,
        });
        if (error) {
          if (error.code === '23505') {
            showToast('Ya existe una condición activa para este cliente y sabor', 'error');
            return;
          }
          throw error;
        }
        showToast('Condición creada ✓', 'success');
      }

      closeModal('modal-condicion-overlay');
      await this.load();

    } catch (e) {
      console.error('Condiciones.saveCondicion:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
  },

  // ── Bind UI ──────────────────────────────────────────────────────────────────

  bindUI() {
    const search = document.getElementById('condiciones-search');
    search.addEventListener('input', () => {
      this.searchQ = search.value.trim();
      this.renderList();
    });

    document.getElementById('fab-add-condicion').onclick          = () => this.openModal(null);
    document.getElementById('modal-condicion-close').onclick      = () => closeModal('modal-condicion-overlay');
    document.getElementById('btn-cancel-condicion').onclick       = () => closeModal('modal-condicion-overlay');
    document.getElementById('btn-save-condicion').onclick         = () => this.saveCondicion();

    // Toggle fila precio promocional
    document.getElementById('condicion-promo').addEventListener('change', e => {
      this._togglePromoRow(e.target.checked);
    });
  },

  // ── Util: condiciones activas de un cliente (para pedidos) ───────────────────
  activasDeCliente(clienteId) {
    return this.lista.filter(c => c.cliente_id === clienteId && c.activa);
  },
};
