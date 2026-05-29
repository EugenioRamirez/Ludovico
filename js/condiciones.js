// ── condiciones.js · Condiciones Comerciales B2B ──────────────────────────────

const Condiciones = {
  lista:         [],    // condiciones cargadas
  clientes:      [],    // para los selectores
  sabores:       [],    // para los selectores
  filtro:        'activa',   // 'activa' | 'inactiva' | 'all'
  filtroCliente: '',         // UUID del cliente seleccionado

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
    let list = this.lista.filter(c => c.cliente_id === this.filtroCliente);
    if (this.filtro === 'activa')   list = list.filter(c => c.activa);
    if (this.filtro === 'inactiva') list = list.filter(c => !c.activa);
    return list;
  },

  // ── Render selector de cliente ────────────────────────────────────────────────

  renderClienteFilter() {
    const sel = document.getElementById('condiciones-cliente-filter');
    sel.innerHTML = '<option value="">— Selecciona un cliente —</option>';
    this.clientes.forEach(c => {
      const label = c.nombre_comercial || c.razon_social;
      sel.innerHTML += `<option value="${c.id}">${escHtml(label)}</option>`;
    });
    sel.value = this.filtroCliente;
    sel.onchange = () => {
      this.filtroCliente = sel.value;
      this.renderFilterTabs();
      this.renderList();
    };
  },

  // ── Render pestañas ──────────────────────────────────────────────────────────

  renderFilterTabs() {
    const tabs = document.getElementById('condiciones-filter-tabs');
    if (!this.filtroCliente) { tabs.innerHTML = ''; return; }
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

  // ── Render lista (acordeón) ──────────────────────────────────────────────────

  CAT_LABELS: { estandar: 'Estándar', especial: 'Especial', premium: 'Premium' },
  CAT_BADGE:  { estandar: 'badge-ok', especial: 'badge-pend', premium: 'badge-pedido' },

  renderList() {
    const list    = this.filtered();
    const el      = document.getElementById('condiciones-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';
    const fab     = document.getElementById('fab-add-condicion');

    if (!this.filtroCliente) {
      el.innerHTML = '<div class="empty-msg">Selecciona un cliente para ver sus tarifas</div>';
      fab.classList.add('hidden');
      return;
    }

    fab.classList.toggle('hidden', !esAdmin);

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay tarifas para este cliente.<br><small>Usa ＋ para añadir un sabor.</small></div>';
      return;
    }

    // ── Separar activas / inactivas ──────────────────────────────────────────
    const activas   = list.filter(c => c.activa);
    const inactivas = list.filter(c => !c.activa);

    const renderFila = c => {
      const sabor      = c.sabores_b2b?.nombre || '–';
      const cat        = c.sabores_b2b?.categoria || '';
      const catLabel   = this.CAT_LABELS[cat] || '';
      const catBadge   = this.CAT_BADGE[cat]  || '';
      const precioBase = parseFloat(c.precio_litro).toFixed(2);
      const tienePromo = c.es_promocional && c.precio_promocional !== null;
      const precioPromo = tienePromo ? parseFloat(c.precio_promocional).toFixed(2) : null;
      const vigencia   = c.fecha_fin
        ? `${fmtFecha(c.fecha_inicio)} → ${fmtFecha(c.fecha_fin)}`
        : `Desde ${fmtFecha(c.fecha_inicio)}`;

      return `
        <tr class="${!c.activa ? 'cond-fila-inactiva' : ''}">
          <td class="cond-td-sabor">${escHtml(sabor)}</td>
          <td>${catLabel ? `<span class="badge ${catBadge}" style="font-size:10px">${catLabel}</span>` : ''}</td>
          <td class="cond-td-precio">
            ${tienePromo
              ? `<s class="cond-precio-tachado">${precioBase}</s> <strong class="cond-precio-promo-val">${precioPromo} €/L</strong>`
              : `<strong>${precioBase} €/L</strong>`}
          </td>
          <td>${tienePromo ? '<span class="cond-promo-pill">🎁 Promo</span>' : '<span class="cond-sin-promo">—</span>'}</td>
          <td class="cond-td-vigencia">${vigencia}</td>
          ${esAdmin ? `
          <td class="cond-td-acciones">
            <button class="btn btn-sm btn-ghost btn-edit-condicion" data-id="${c.id}">✏️</button>
            <button class="btn btn-sm btn-ghost btn-toggle-condicion" data-id="${c.id}" data-activa="${c.activa}"
              title="${c.activa ? 'Desactivar' : 'Activar'}">${c.activa ? '🔴' : '🟢'}</button>
          </td>` : '<td></td>'}
        </tr>`;
    };

    let html = `
      <table class="cond-tabla">
        <thead>
          <tr>
            <th>Sabor</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Promoción</th>
            <th>Vigencia</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${activas.map(renderFila).join('')}
        </tbody>
      </table>`;

    if (inactivas.length) {
      html += `
        <div class="cond-inactivas-titulo">Tarifas inactivas (${inactivas.length})</div>
        <table class="cond-tabla cond-tabla-inactivas">
          <tbody>${inactivas.map(renderFila).join('')}</tbody>
        </table>`;
    }

    el.innerHTML = html;

    el.querySelectorAll('.btn-edit-condicion').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.openModal(btn.dataset.id); });
    });
    el.querySelectorAll('.btn-toggle-condicion').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.toggleActiva(btn.dataset.id, btn.dataset.activa === 'true'); });
    });
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
