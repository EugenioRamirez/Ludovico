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

      // Eliminar: solo admin, cualquier estado
      const puedeEliminar = esAdmin;
      const btnEliminar = puedeEliminar
        ? `<button class="btn btn-sm btn-ghost btn-del-pedido" data-id="${p.id}" style="color:var(--red)">🗑️ Eliminar</button>`
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
              <button class="btn btn-sm btn-ghost btn-print-albaran" data-id="${p.id}">🖨️ Albarán</button>
              ${btnEditar}
              ${btnEliminar}
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
    el.querySelectorAll('.btn-del-pedido').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.eliminarPedido(btn.dataset.id);
      });
    });
    el.querySelectorAll('.btn-print-albaran').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.printAlbaran(btn.dataset.id);
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
          <td style="text-align:right">${parseFloat(l.subtotal).toFixed(2)}</td>
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
      const precioPromo = (c.precio_promocional != null) ? c.precio_promocional : '';
      sel.innerHTML += `<option value="${c.sabor_id}" data-condicion="${c.id}" data-precio="${c.precio_litro}" data-precio-promo="${precioPromo}">${escHtml(c.sabores_b2b?.nombre || '')}</option>`;
    });
    // Auto-precio al elegir sabor (o al cambiar checkbox promo)
    const actualizarPrecio = () => {
      const opt   = sel.options[sel.selectedIndex];
      const esProm = document.getElementById('linea-es-promo').checked;
      if (!opt.value) return;
      if (esProm && opt.dataset.precioPromo !== '') {
        document.getElementById('linea-precio').value = parseFloat(opt.dataset.precioPromo).toFixed(2);
      } else if (opt.dataset.precio) {
        document.getElementById('linea-precio').value = parseFloat(opt.dataset.precio).toFixed(2);
      }
    };
    sel.onchange = actualizarPrecio;
    // También cuando cambia el checkbox de promocional
    const chkPromo = document.getElementById('linea-es-promo');
    chkPromo.onchange = actualizarPrecio;
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

    const opt          = sel.options[sel.selectedIndex];
    const sabor_nombre = opt.text;
    const condicion_id = opt.dataset.condicion || null;
    // Si es promocional pero tiene precio propio (≠ 0), se cobra ese precio
    // Solo es gratuita si el precio introducido es exactamente 0
    const subtotal     = litros * precio;

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
          <td style="text-align:right">${l.subtotal.toFixed(2)}</td>
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

  // ── Imprimir albarán ──────────────────────────────────────────────────────────

  async printAlbaran(pedidoId) {
    const pedido = this.lista.find(p => p.id === pedidoId);
    if (!pedido) return;

    showToast('Preparando albarán…', 'info', 1500);

    try {
      // Logo como base64 para que funcione en ventana nueva
      let logoDataUrl = '';
      try {
        const resp = await fetch('assets/logo.png');
        const blob = await resp.blob();
        logoDataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload  = e => resolve(e.target.result);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch (_) { /* sin logo si falla */ }

      // Datos completos del cliente
      const { data: cli } = await sb
        .from('clientes_b2b')
        .select('razon_social, nombre_comercial, nif_cif, direccion_fiscal, telefono, email_facturacion')
        .eq('id', pedido.cliente_id)
        .single();

      // Líneas del pedido
      const { data: lineas, error } = await sb
        .from('pedidos_b2b_lineas')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at');
      if (error) throw error;

      const html = this._buildAlbaranHtml(pedido, cli || {}, lineas || [], logoDataUrl);
      const win  = window.open('', '_blank', 'width=820,height=700');
      if (!win) { showToast('Permite ventanas emergentes para imprimir', 'error', 4000); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);

    } catch (e) {
      console.error('printAlbaran:', e);
      showToast('Error al generar albarán: ' + (e.message || e), 'error');
    }
  },

  _buildAlbaranHtml(pedido, cli, lineas, logoDataUrl = '') {
    const numAlbaran   = pedido.id.slice(0, 8).toUpperCase();
    const clienteNombre = cli.nombre_comercial || cli.razon_social || '–';
    const estado        = this.ESTADOS[pedido.estado] || { label: pedido.estado, icon: '' };

    const filasLineas = lineas.map((l, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escHtml(l.sabor_nombre)}${l.es_promocional ? ' <span style="font-size:10px;color:#1565a0;font-weight:700">[PROMO]</span>' : ''}</td>
        <td style="text-align:right">${parseFloat(l.litros).toFixed(1)}</td>
        <td style="text-align:right">${parseFloat(l.precio_litro).toFixed(2)}</td>
        <td style="text-align:right">${parseFloat(l.subtotal).toFixed(2)}</td>
        <td style="color:#888;font-size:11px">${escHtml(l.observaciones || '')}</td>
      </tr>`).join('');

    const totalLitros  = lineas.reduce((s, l) => s + parseFloat(l.litros), 0).toFixed(1);
    const totalImporte = lineas.reduce((s, l) => s + parseFloat(l.subtotal), 0).toFixed(2);

    const notasHtml = [
      pedido.notas_entrega       ? `<p><strong>Notas entrega:</strong> ${escHtml(pedido.notas_entrega)}</p>` : '',
      pedido.observaciones       ? `<p><strong>Observaciones:</strong> ${escHtml(pedido.observaciones)}</p>` : '',
      pedido.referencia_cliente  ? `<p><strong>Ref. cliente:</strong> ${escHtml(pedido.referencia_cliente)}</p>` : '',
      pedido.comentarios_logisticos ? `<p><strong>Logística:</strong> ${escHtml(pedido.comentarios_logisticos)}</p>` : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Albarán ${numAlbaran} · Helados Ludovico</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a2a3a; background: #fff; padding: 28px 36px; }
    /* CABECERA */
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1565a0; padding-bottom: 14px; margin-bottom: 18px; }
    .hdr-logo { display: flex; align-items: center; gap: 10px; }
    .hdr-logo img { height: 48px; width: auto; }
    .hdr-logo-txt { font-size: 22px; font-weight: 900; color: #1565a0; letter-spacing: -0.5px; }
    .hdr-logo-txt span { color: #F5A623; }
    .hdr-sub { font-size: 11px; color: #666; margin-top: 3px; }
    .hdr-albaran { text-align: right; }
    .hdr-albaran h1 { font-size: 18px; font-weight: 800; color: #1565a0; text-transform: uppercase; letter-spacing: 1px; }
    .hdr-albaran .num { font-size: 13px; color: #555; margin-top: 3px; }
    .hdr-albaran .estado { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #e3f2fd; color: #1565a0; margin-top: 5px; }
    /* INFO BICOLUMNA */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .info-box { border: 1px solid #dde4ee; border-radius: 8px; padding: 12px 14px; }
    .info-box h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #1565a0; font-weight: 800; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 8px; }
    .info-box p { font-size: 12px; line-height: 1.7; color: #333; }
    .info-box strong { color: #1a2a3a; }
    /* TABLA */
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
    thead th { background: #1565a0; color: #fff; padding: 8px 9px; text-align: left; font-size: 11px; }
    tbody td { padding: 7px 9px; border-bottom: 1px solid #eee; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f7fafd; }
    tfoot td { padding: 9px; font-weight: 700; border-top: 2px solid #1565a0; background: #f0f4f8; font-size: 13px; }
    /* NOTAS */
    .notas { background: #fffde7; border-left: 4px solid #F5A623; padding: 10px 14px; border-radius: 4px; margin-bottom: 18px; font-size: 12px; line-height: 1.7; }
    .notas p { margin-bottom: 3px; }
    /* FIRMA */
    .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
    .firma-box { border-top: 1.5px solid #1a2a3a; padding-top: 6px; }
    .firma-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
    .firma-espacio { height: 52px; }
    /* PIE */
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      body { padding: 12px 20px; }
      @page { margin: 1.2cm; }
    }
  </style>
</head>
<body>

  <!-- CABECERA -->
  <div class="hdr">
    <div>
      <div class="hdr-logo">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Ludovico Helados"/>` : ''}
        <div>
          <div class="hdr-logo-txt">Ludovico <span>Helados</span></div>
          <div class="hdr-sub">Ludovico Desarrollo Madrid · NIF B21689682</div>
          <div class="hdr-sub">C/ Litio 1 3C · 28045 Madrid</div>
        </div>
      </div>
    </div>
    <div class="hdr-albaran">
      <h1>Albarán de entrega</h1>
      <div class="num">Ref. ALB-${numAlbaran}</div>
      <div class="estado">${estado.icon} ${estado.label}</div>
    </div>
  </div>

  <!-- INFO PEDIDO + CLIENTE -->
  <div class="info-grid">
    <div class="info-box">
      <h2>Datos del pedido</h2>
      <p><strong>Fecha recepción:</strong> ${fmtFecha(pedido.fecha_recepcion)}</p>
      <p><strong>Fecha entrega:</strong> ${fmtFecha(pedido.fecha_entrega_prevista)}</p>
      ${pedido.referencia_cliente ? `<p><strong>Ref. cliente:</strong> ${escHtml(pedido.referencia_cliente)}</p>` : ''}
      <p><strong>Creado por:</strong> ${escHtml(pedido.creado_por || '–')}</p>
    </div>
    <div class="info-box">
      <h2>Cliente</h2>
      <p><strong>${escHtml(clienteNombre)}</strong></p>
      ${cli.razon_social && cli.razon_social !== clienteNombre ? `<p>${escHtml(cli.razon_social)}</p>` : ''}
      ${cli.nif_cif       ? `<p>NIF/CIF: ${escHtml(cli.nif_cif)}</p>` : ''}
      ${cli.direccion_fiscal ? `<p>${escHtml(cli.direccion_fiscal)}</p>` : ''}
      ${cli.telefono      ? `<p>Tel: ${escHtml(cli.telefono)}</p>` : ''}
    </div>
  </div>

  <!-- LÍNEAS -->
  <table>
    <thead>
      <tr>
        <th style="width:32px;text-align:center">#</th>
        <th>Sabor / Producto</th>
        <th style="width:70px;text-align:right">Litros</th>
        <th style="width:80px;text-align:right">€/litro</th>
        <th style="width:90px;text-align:right">Subtotal €</th>
        <th style="width:120px">Observaciones</th>
      </tr>
    </thead>
    <tbody>${filasLineas}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${totalLitros} L</td>
        <td></td>
        <td style="text-align:right">${totalImporte} €</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <!-- NOTAS -->
  ${notasHtml ? `<div class="notas">${notasHtml}</div>` : ''}

  <!-- FIRMA -->
  <div class="firma-grid">
    <div class="firma-box">
      <div class="firma-espacio"></div>
      <div class="firma-label">Firma y sello del cliente · Recibido conforme</div>
    </div>
    <div class="firma-box">
      <div class="firma-espacio"></div>
      <div class="firma-label">Firma del repartidor · Helados Ludovico</div>
    </div>
  </div>

  <div class="footer">
    Ludovico Desarrollo Madrid · NIF B21689682 · C/ Litio 1 3C, 28045 Madrid &nbsp;|&nbsp; Documento generado el ${new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })}
  </div>

</body>
</html>`;
  },

  // ── Eliminar pedido ───────────────────────────────────────────────────────────

  async eliminarPedido(pedidoId) {
    const pedido  = this.lista.find(p => p.id === pedidoId);
    const cliente = this.nombreCliente(pedido?.clientes_b2b);
    const fecha   = fmtFecha(pedido?.fecha_entrega_prevista);

    if (!confirm(`¿Eliminar el pedido de "${cliente}" (entrega: ${fecha})?\n\nSe borrarán también todas sus líneas. Esta acción no se puede deshacer.`)) return;

    try {
      // Las líneas se borran en cascada por la FK ON DELETE CASCADE
      const { error } = await sb.from('pedidos_b2b').delete().eq('id', pedidoId);
      if (error) throw error;
      showToast('Pedido eliminado', 'success');
      await this.load();
    } catch (e) {
      console.error('Pedidos.eliminarPedido:', e);
      showToast('Error al eliminar: ' + (e.message || e), 'error');
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
