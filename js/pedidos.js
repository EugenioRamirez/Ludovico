// ── pedidos.js · Gestión de Pedidos B2B ───────────────────────────────────────

const Pedidos = {

  lista:       [],   // pedidos con datos de cliente
  clientes:    [],   // para selectores
  condiciones: [],   // condiciones activas (para filtrar sabores por cliente)
  lineas:      [],   // líneas en memoria mientras el modal está abierto
  nextTempId:  1,

  filtroCliente: '',
  filtroEstado:  'activo',   // 'activo' (no cancelado/facturado) | estado específico | 'all'

  // ── Configuración de estados ──────────────────────────────────────────────────

  ESTADOS: {
    pendiente:  { label: 'Pendiente',  badge: 'badge-pend',   icon: '⏳' },
    confirmado: { label: 'Confirmado', badge: 'badge-pedido', icon: '✅' },
    preparando: { label: 'Preparando', badge: 'badge-low',    icon: '🧊' },
    entregado:  { label: 'Entregado',  badge: 'badge-ok',     icon: '📦' },
    incidencia: { label: 'Incidencia', badge: 'badge-crit',   icon: '⚠️' },
    cancelado:  { label: 'Cancelado',  badge: 'badge-crit',   icon: '❌' },
    facturado:  { label: 'Facturado',  badge: 'badge-ok',     icon: '🧾' },
  },

  // Estados que bloquean la edición libre
  ESTADOS_BLOQUEADOS: ['entregado', 'cancelado', 'facturado'],

  // Transiciones prohibidas
  estaTransicionPermitida(de, a) {
    if (de === 'cancelado' && a === 'facturado') return false;
    if (this.ESTADOS_BLOQUEADOS.includes(de) && a !== 'incidencia') return false;
    return true;
  },

  // ── Carga ────────────────────────────────────────────────────────────────────

  async load() {
    document.getElementById('pedidos-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await Promise.all([
      this.loadPedidos(),
      this.loadClientes(),
      this.loadCondiciones(),
    ]);
    this.renderClienteFilter();
    this.renderEstadoTabs();
    this.renderList();
    this.bindUI();
  },

  async loadPedidos() {
    try {
      const { data, error } = await sb
        .from('pedidos_b2b')
        .select(`*, clientes_b2b(id, razon_social, nombre_comercial)`)
        .order('fecha_recepcion', { ascending: false });
      if (error) throw error;
      this.lista = data || [];
    } catch (e) {
      console.error('Pedidos.loadPedidos:', e);
      document.getElementById('pedidos-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar pedidos</div>';
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
    } catch (e) { console.error('Pedidos.loadClientes:', e); }
  },

  async loadCondiciones() {
    try {
      const { data } = await sb
        .from('condiciones_comerciales')
        .select('id, cliente_id, sabor_id, precio_litro, precio_promocional, es_promocional, sabores_b2b(id, nombre, categoria)')
        .eq('activa', true);
      this.condiciones = data || [];
    } catch (e) { console.error('Pedidos.loadCondiciones:', e); }
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────

  nombreCliente(c) {
    if (!c) return '–';
    return c.nombre_comercial || c.razon_social;
  },

  condicionesDeCliente(clienteId) {
    return this.condiciones.filter(c => c.cliente_id === clienteId);
  },

  estadoBadge(estado) {
    const e = this.ESTADOS[estado] || { label: estado, badge: 'badge-ok', icon: '' };
    return `<span class="badge ${e.badge}">${e.icon} ${e.label}</span>`;
  },

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  filtered() {
    let list = this.lista;
    if (this.filtroCliente) list = list.filter(p => p.cliente_id === this.filtroCliente);
    if (this.filtroEstado === 'activo') {
      list = list.filter(p => !['cancelado', 'facturado'].includes(p.estado));
    } else if (this.filtroEstado !== 'all') {
      list = list.filter(p => p.estado === this.filtroEstado);
    }
    return list;
  },

  // ── Render filtros ────────────────────────────────────────────────────────────

  renderClienteFilter() {
    const sel = document.getElementById('pedidos-cliente-filter');
    sel.innerHTML = '<option value="">— Todos los clientes —</option>';
    this.clientes.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${escHtml(c.nombre_comercial || c.razon_social)}</option>`;
    });
    sel.value = this.filtroCliente;
    sel.onchange = () => { this.filtroCliente = sel.value; this.renderList(); };
  },

  renderEstadoTabs() {
    const tabs = document.getElementById('pedidos-estado-tabs');
    const opciones = [
      { val: 'activo',     label: 'Activos' },
      { val: 'pendiente',  label: '⏳ Pendiente' },
      { val: 'confirmado', label: '✅ Confirmado' },
      { val: 'preparando', label: '🧊 Preparando' },
      { val: 'entregado',  label: '📦 Entregado' },
      { val: 'all',        label: 'Todos' },
    ];
    tabs.innerHTML = opciones.map(o =>
      `<button class="filter-tab ${this.filtroEstado === o.val ? 'active' : ''}" data-val="${o.val}">${o.label}</button>`
    ).join('');
    tabs.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroEstado = btn.dataset.val;
        tabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderList();
      });
    });
  },

  // ── Render lista (acordeón) ───────────────────────────────────────────────────

  renderList() {
    const list    = this.filtered();
    const el      = document.getElementById('pedidos-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay pedidos</div>';
      return;
    }

    el.innerHTML = list.map(p => {
      const cliente    = this.nombreCliente(p.clientes_b2b);
      const bloqueado  = this.ESTADOS_BLOQUEADOS.includes(p.estado);
      const totalFmt   = `${parseFloat(p.total_importe).toFixed(2)} €`;
      const litrosFmt  = `${parseFloat(p.total_litros).toFixed(1)} L`;
      const fechaEnt   = fmtFecha(p.fecha_entrega_prevista);

      const botonesEstado = !bloqueado ? `
        <div style="margin-bottom:8px">
          <label class="acord-field-lbl">Cambiar estado</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
            ${Object.entries(this.ESTADOS)
              .filter(([k]) => k !== p.estado && this.estaTransicionPermitida(p.estado, k))
              .map(([k, v]) => `<button class="btn btn-sm btn-outline btn-cambiar-estado" data-id="${p.id}" data-estado="${k}">${v.icon} ${v.label}</button>`)
              .join('')}
          </div>
        </div>` : '';

      const btnEditar = !bloqueado && esAdmin
        ? `<button class="btn btn-sm btn-outline btn-edit-pedido" data-id="${p.id}">✏️ Editar</button>`
        : '';

      return `
        <div class="acord-row" data-id="${p.id}">
          <div class="acord-summary">
            <div class="acord-main">
              <span class="acord-nombre">${escHtml(cliente)}</span>
              <div class="acord-meta">
                <span class="acord-meta-txt">Entrega: ${fechaEnt}</span>
                <span class="acord-meta-txt">· ${litrosFmt} · ${totalFmt}</span>
              </div>
            </div>
            <div class="acord-right">
              ${this.estadoBadge(p.estado)}
              <span class="acord-chevron">›</span>
            </div>
          </div>
          <div class="acord-detail">
            <div class="acord-grid" style="margin-bottom:8px">
              <div class="acord-field">
                <span class="acord-field-lbl">Recepción</span>
                <span class="acord-field-val">${fmtFecha(p.fecha_recepcion)}</span>
              </div>
              <div class="acord-field">
                <span class="acord-field-lbl">Total</span>
                <span class="acord-field-val">${totalFmt} · ${litrosFmt}</span>
              </div>
              ${p.referencia_cliente ? `
              <div class="acord-field acord-field-full">
                <span class="acord-field-lbl">Ref. cliente</span>
                <span class="acord-field-val">${escHtml(p.referencia_cliente)}</span>
              </div>` : ''}
              ${p.notas_entrega ? `
              <div class="acord-field acord-field-full">
                <span class="acord-field-lbl">Notas entrega</span>
                <span class="acord-field-val">${escHtml(p.notas_entrega)}</span>
              </div>` : ''}
            </div>
            ${botonesEstado}
            <div class="acord-actions">
              <button class="btn btn-sm btn-ghost btn-ver-pedido" data-id="${p.id}">🔍 Ver líneas</button>
              ${btnEditar}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Acordeón
    el.querySelectorAll('.acord-summary').forEach(s => {
      s.addEventListener('click', () => {
        const row = s.closest('.acord-row');
        const isOpen = row.classList.contains('open');
        el.querySelectorAll('.acord-row.open').forEach(r => r.classList.remove('open'));
        if (!isOpen) row.classList.add('open');
      });
    });

    // Botones
    el.querySelectorAll('.btn-edit-pedido').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.openModal(btn.dataset.id); });
    });
    el.querySelectorAll('.btn-ver-pedido').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.verLineas(btn.dataset.id); });
    });
    el.querySelectorAll('.btn-cambiar-estado').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.cambiarEstado(btn.dataset.id, btn.dataset.estado);
      });
    });
  },

  // ── Ver líneas de un pedido ───────────────────────────────────────────────────

  async verLineas(pedidoId) {
    const pedido = this.lista.find(p => p.id === pedidoId);
    if (!pedido) return;

    document.getElementById('detalle-pedido-titulo').textContent =
      `${this.nombreCliente(pedido.clientes_b2b)} · ${fmtFecha(pedido.fecha_entrega_prevista)}`;

    const tbody = document.getElementById('detalle-lineas-tbody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="spinner-wrap"><div class="spinner"></div></div></td></tr>';

    openModal('modal-detalle-pedido-overlay');

    try {
      const { data, error } = await sb
        .from('pedidos_b2b_lineas')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at');
      if (error) throw error;

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin líneas</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(l => `
        <tr>
          <td>${escHtml(l.sabor_nombre)}${l.es_promocional ? ' 🎁' : ''}</td>
          <td style="text-align:right">${parseFloat(l.litros).toFixed(1)}</td>
          <td style="text-align:right">${parseFloat(l.precio_litro).toFixed(2)}</td>
          <td style="text-align:right">${l.es_promocional ? '–' : parseFloat(l.subtotal).toFixed(2)}</td>
          <td style="color:var(--text-muted);font-size:11px">${escHtml(l.observaciones || '')}</td>
        </tr>
      `).join('');

      document.getElementById('detalle-total-litros').textContent  = `${parseFloat(pedido.total_litros).toFixed(1)} L`;
      document.getElementById('detalle-total-importe').textContent = `${parseFloat(pedido.total_importe).toFixed(2)} €`;

    } catch (e) {
      console.error('verLineas:', e);
      tbody.innerHTML = '<tr><td colspan="5">Error al cargar líneas</td></tr>';
    }
  },

  // ── Cambiar estado ────────────────────────────────────────────────────────────

  async cambiarEstado(pedidoId, nuevoEstado) {
    const pedido = this.lista.find(p => p.id === pedidoId);
    const estadoInfo = this.ESTADOS[nuevoEstado];
    if (!confirm(`¿Cambiar estado a "${estadoInfo?.label}"?`)) return;

    try {
      const { error } = await sb
        .from('pedidos_b2b')
        .update({ estado: nuevoEstado, modificado_por: Estado.getEmpleada() })
        .eq('id', pedidoId);
      if (error) throw error;
      showToast(`Estado actualizado: ${estadoInfo?.label} ✓`, 'success');
      await this.load();
    } catch (e) {
      console.error('cambiarEstado:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Modal pedido ──────────────────────────────────────────────────────────────

  async openModal(id) {
    this.lineas    = [];
    this.nextTempId = 1;

    const pedido = id ? this.lista.find(p => p.id === id) : null;

    document.getElementById('modal-pedido-title').textContent =
      pedido ? 'Editar Pedido' : 'Nuevo Pedido';
    document.getElementById('pedido-id').value                    = pedido?.id || '';
    document.getElementById('pedido-estado').value                = pedido?.estado || 'pendiente';
    document.getElementById('pedido-fecha-recepcion').value       = pedido?.fecha_recepcion || new Date().toISOString().slice(0,10);
    document.getElementById('pedido-fecha-entrega').value         = pedido?.fecha_entrega_prevista || '';
    document.getElementById('pedido-ref-cliente').value           = pedido?.referencia_cliente || '';
    document.getElementById('pedido-notas-entrega').value         = pedido?.notas_entrega || '';
    document.getElementById('pedido-observaciones').value         = pedido?.observaciones || '';
    document.getElementById('pedido-comentarios').value           = pedido?.comentarios_logisticos || '';

    // Poblar selector clientes
    const selCliente = document.getElementById('pedido-cliente');
    selCliente.innerHTML = '<option value="">— Selecciona cliente —</option>';
    this.clientes.forEach(c => {
      selCliente.innerHTML += `<option value="${c.id}">${escHtml(c.nombre_comercial || c.razon_social)}</option>`;
    });

    if (pedido) {
      selCliente.value  = pedido.cliente_id;
      selCliente.disabled = true;   // no cambiar cliente en edición
      // Cargar líneas existentes
      const { data } = await sb.from('pedidos_b2b_lineas').select('*').eq('pedido_id', id).order('created_at');
      (data || []).forEach(l => {
        this.lineas.push({
          tempId:        this.nextTempId++,
          sabor_id:      l.sabor_id,
          condicion_id:  l.condicion_id,
          sabor_nombre:  l.sabor_nombre,
          litros:        parseFloat(l.litros),
          precio_litro:  parseFloat(l.precio_litro),
          es_promocional: l.es_promocional,
          subtotal:      parseFloat(l.subtotal),
          observaciones: l.observaciones || '',
        });
      });
      this._fillSaboresLinea(pedido.cliente_id);
    } else {
      selCliente.disabled = false;
      selCliente.onchange = () => this._fillSaboresLinea(selCliente.value);
      this._fillSaboresLinea('');
    }

    this._renderLineasModal();
    openModal('modal-pedido-overlay');
  },

  // Llena el selector de sabores de la línea según condiciones del cliente
  _fillSaboresLinea(clienteId) {
    const sel = document.getElementById('linea-sabor');
    const conds = clienteId ? this.condicionesDeCliente(clienteId) : [];
    sel.innerHTML = '<option value="">— Sabor —</option>';
    conds.forEach(c => {
      sel.innerHTML += `<option value="${c.sabor_id}" data-condicion="${c.id}" data-precio="${c.precio_litro}">${escHtml(c.sabores_b2b?.nombre || '')}</option>`;
    });
    // Auto-precio al elegir sabor
    sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt.dataset.precio) {
        document.getElementById('linea-precio').value = parseFloat(opt.dataset.precio).toFixed(2);
      }
    };
  },

  // ── Gestión de líneas en memoria ──────────────────────────────────────────────

  _addLinea() {
    const sel    = document.getElementById('linea-sabor');
    const litros = parseFloat(document.getElementById('linea-litros').value);
    const precio = parseFloat(document.getElementById('linea-precio').value);
    const esProm = document.getElementById('linea-es-promo').checked;
    const obs    = document.getElementById('linea-obs').value.trim();

    if (!sel.value)            { showToast('Selecciona un sabor', 'error'); return; }
    if (isNaN(litros) || litros <= 0) { showToast('Introduce litros válidos', 'error'); return; }
    if (isNaN(precio) || precio < 0)  { showToast('Introduce un precio válido', 'error'); return; }

    const opt         = sel.options[sel.selectedIndex];
    const sabor_nombre = opt.text;
    const condicion_id = opt.dataset.condicion || null;
    const subtotal     = esProm ? 0 : litros * precio;

    this.lineas.push({
      tempId: this.nextTempId++,
      sabor_id: sel.value, condicion_id, sabor_nombre,
      litros, precio_litro: precio, es_promocional: esProm, subtotal, observaciones: obs,
    });

    // Reset mini-form
    sel.value = '';
    document.getElementById('linea-litros').value = '';
    document.getElementById('linea-precio').value = '';
    document.getElementById('linea-es-promo').checked = false;
    document.getElementById('linea-obs').value = '';

    this._renderLineasModal();
  },

  _removeLinea(tempId) {
    this.lineas = this.lineas.filter(l => l.tempId !== tempId);
    this._renderLineasModal();
  },

  _renderLineasModal() {
    const tbody     = document.getElementById('modal-lineas-tbody');
    const totalLit  = this.lineas.reduce((s, l) => s + l.litros, 0);
    const totalImp  = this.lineas.reduce((s, l) => s + l.subtotal, 0);

    if (!this.lineas.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:12px">Sin líneas añadidas</td></tr>`;
    } else {
      tbody.innerHTML = this.lineas.map(l => `
        <tr>
          <td>${escHtml(l.sabor_nombre)}${l.es_promocional ? ' 🎁' : ''}</td>
          <td style="text-align:right">${l.litros.toFixed(1)}</td>
          <td style="text-align:right">${l.precio_litro.toFixed(2)}</td>
          <td style="text-align:right">${l.es_promocional ? '–' : l.subtotal.toFixed(2)}</td>
          <td style="text-align:center">
            <button class="btn btn-sm btn-ghost btn-rm-linea" data-temp="${l.tempId}" style="color:var(--red)">✕</button>
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.btn-rm-linea').forEach(btn => {
        btn.addEventListener('click', () => this._removeLinea(parseInt(btn.dataset.temp)));
      });
    }

    document.getElementById('modal-total-litros').textContent  = `${totalLit.toFixed(1)} L`;
    document.getElementById('modal-total-importe').textContent = `${totalImp.toFixed(2)} €`;
  },

  // ── Guardar pedido ────────────────────────────────────────────────────────────

  async savePedido() {
    const id                   = document.getElementById('pedido-id').value.trim();
    const cliente_id           = document.getElementById('pedido-cliente').value;
    const estado               = document.getElementById('pedido-estado').value;
    const fecha_recepcion      = document.getElementById('pedido-fecha-recepcion').value;
    const fecha_entrega_prevista = document.getElementById('pedido-fecha-entrega').value;
    const referencia_cliente   = document.getElementById('pedido-ref-cliente').value.trim() || null;
    const notas_entrega        = document.getElementById('pedido-notas-entrega').value.trim() || null;
    const observaciones        = document.getElementById('pedido-observaciones').value.trim() || null;
    const comentarios_logisticos = document.getElementById('pedido-comentarios').value.trim() || null;

    // Validaciones
    if (!cliente_id)             { showToast('Selecciona un cliente', 'error'); return; }
    if (!fecha_recepcion)        { showToast('La fecha de recepción es obligatoria', 'error'); return; }
    if (!fecha_entrega_prevista) { showToast('La fecha de entrega es obligatoria', 'error'); return; }
    if (!this.lineas.length)     { showToast('Añade al menos una línea', 'error'); return; }

    const total_litros  = this.lineas.reduce((s, l) => s + l.litros, 0);
    const total_importe = this.lineas.reduce((s, l) => s + l.subtotal, 0);
    const empleada      = Estado.getEmpleada();

    const btn = document.getElementById('btn-save-pedido');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      let pedidoId = id;

      const cabecera = {
        cliente_id, estado, fecha_recepcion, fecha_entrega_prevista,
        referencia_cliente, notas_entrega, observaciones, comentarios_logisticos,
        total_litros, total_importe, modificado_por: empleada,
      };

      if (id) {
        // Actualizar cabecera
        const { error } = await sb.from('pedidos_b2b').update(cabecera).eq('id', id);
        if (error) throw error;
        // Borrar líneas anteriores y reinsertar
        const { error: e2 } = await sb.from('pedidos_b2b_lineas').delete().eq('pedido_id', id);
        if (e2) throw e2;
      } else {
        // Crear pedido
        const { data, error } = await sb.from('pedidos_b2b')
          .insert({ ...cabecera, creado_por: empleada })
          .select('id')
          .single();
        if (error) throw error;
        pedidoId = data.id;
      }

      // Insertar líneas
      const lineasPayload = this.lineas.map(l => ({
        pedido_id:      pedidoId,
        sabor_id:       l.sabor_id,
        condicion_id:   l.condicion_id,
        sabor_nombre:   l.sabor_nombre,
        litros:         l.litros,
        precio_litro:   l.precio_litro,
        es_promocional: l.es_promocional,
        subtotal:       l.subtotal,
        observaciones:  l.observaciones || null,
      }));

      const { error: e3 } = await sb.from('pedidos_b2b_lineas').insert(lineasPayload);
      if (e3) throw e3;

      showToast(id ? 'Pedido actualizado ✓' : 'Pedido creado ✓', 'success');
      closeModal('modal-pedido-overlay');
      await this.load();

    } catch (e) {
      console.error('Pedidos.savePedido:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar pedido';
    }
  },

  // ── Bind UI ──────────────────────────────────────────────────────────────────

  bindUI() {
    document.getElementById('fab-add-pedido').onclick        = () => this.openModal(null);
    document.getElementById('modal-pedido-close').onclick    = () => closeModal('modal-pedido-overlay');
    document.getElementById('btn-cancel-pedido').onclick     = () => closeModal('modal-pedido-overlay');
    document.getElementById('btn-save-pedido').onclick       = () => this.savePedido();
    document.getElementById('btn-add-linea').onclick         = () => this._addLinea();
    document.getElementById('modal-detalle-close').onclick   = () => closeModal('modal-detalle-pedido-overlay');
  },
};
