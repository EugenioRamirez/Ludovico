// ── proformas.js · Gestión de Proformas B2B (B2B-INV-001) ────────────────────

const Proformas = {

  lista:      [],   // proformas con datos de cliente
  clientes:   [],   // para selectores
  lineas:     [],   // líneas de la proforma abierta en el modal
  _pfActivo:  null, // proforma activa en el modal de detalle
  _editable:  false,// modo edición en el modal de detalle

  filtroCliente: '',
  filtroMes:     '',
  filtroAnio:    new Date().getFullYear(),
  filtroEstado:  'all',

  ESTADOS: {
    borrador:  { label: 'Borrador',  icon: '📝', cls: 'pf-est-borrador'  },
    revisada:  { label: 'Revisada',  icon: '👁️',  cls: 'pf-est-revisada'  },
    enviada:   { label: 'Enviada',   icon: '📤', cls: 'pf-est-enviada'   },
    aprobada:  { label: 'Aprobada',  icon: '✅', cls: 'pf-est-aprobada'  },
    facturada: { label: 'Facturada', icon: '🧾', cls: 'pf-est-facturada' },
  },

  TIPOS_AJUSTE: {
    descuento_comercial: 'Descuento comercial',
    promocion:           'Promoción',
    regularizacion:      'Regularización',
    compensacion:        'Compensación',
    incidencia:          'Incidencia',
    ajuste_manual:       'Ajuste manual',
  },

  MESES: ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],

  // ── Carga ────────────────────────────────────────────────────────────────────

  async load() {
    document.getElementById('proformas-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await Promise.all([this.loadProformas(), this.loadClientes()]);
    this.renderFiltros();
    this.renderList();
    this.bindUI();
  },

  async loadProformas() {
    try {
      const { data, error } = await sb
        .from('proformas_b2b')
        .select('*, clientes_b2b(id, razon_social, nombre_comercial)')
        .order('periodo_anio', { ascending: false })
        .order('periodo_mes',  { ascending: false });
      if (error) throw error;
      this.lista = data || [];
    } catch (e) {
      console.error('Proformas.loadProformas:', e);
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
    } catch (e) { console.error('Proformas.loadClientes:', e); }
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────

  nombreCliente(c) {
    if (!c) return '–';
    return c.nombre_comercial || c.razon_social;
  },

  periodoLabel(mes, anio) {
    return `${this.MESES[mes - 1]} ${anio}`;
  },

  estadoBadge(estado) {
    const e = this.ESTADOS[estado] || { label: estado, icon: '', cls: '' };
    return `<span class="pf-badge ${e.cls}">${e.icon} ${e.label}</span>`;
  },

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  filtered() {
    let list = this.lista;
    if (this.filtroCliente) list = list.filter(p => p.cliente_id === this.filtroCliente);
    if (this.filtroMes)     list = list.filter(p => p.periodo_mes === parseInt(this.filtroMes));
    if (this.filtroAnio)    list = list.filter(p => p.periodo_anio === parseInt(this.filtroAnio));
    if (this.filtroEstado !== 'all') list = list.filter(p => p.estado === this.filtroEstado);
    return list;
  },

  // ── Render filtros ────────────────────────────────────────────────────────────

  renderFiltros() {
    // Selector cliente
    const selCli = document.getElementById('pf-filtro-cliente');
    selCli.innerHTML = '<option value="">— Todos los clientes —</option>';
    this.clientes.forEach(c => {
      selCli.innerHTML += `<option value="${c.id}">${escHtml(c.nombre_comercial || c.razon_social)}</option>`;
    });
    selCli.value = this.filtroCliente;
    selCli.onchange = () => { this.filtroCliente = selCli.value; this.renderList(); };

    // Selector mes
    const selMes = document.getElementById('pf-filtro-mes');
    selMes.innerHTML = '<option value="">— Todos los meses —</option>' +
      this.MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    selMes.value = this.filtroMes;
    selMes.onchange = () => { this.filtroMes = selMes.value; this.renderList(); };

    // Selector año
    const selAnio = document.getElementById('pf-filtro-anio');
    const hoy = new Date().getFullYear();
    selAnio.innerHTML = [hoy + 1, hoy, hoy - 1, hoy - 2]
      .map(a => `<option value="${a}">${a}</option>`).join('');
    selAnio.value = this.filtroAnio;
    selAnio.onchange = () => { this.filtroAnio = parseInt(selAnio.value); this.renderList(); };

    // Tabs de estado
    const tabs = document.getElementById('pf-estado-tabs');
    const opciones = [
      { val: 'all',       label: 'Todas' },
      { val: 'borrador',  label: '📝 Borrador' },
      { val: 'revisada',  label: '👁️ Revisada' },
      { val: 'enviada',   label: '📤 Enviada' },
      { val: 'aprobada',  label: '✅ Aprobada' },
      { val: 'facturada', label: '🧾 Facturada' },
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
    const el      = document.getElementById('proformas-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay proformas para los filtros seleccionados</div>';
      return;
    }

    el.innerHTML = list.map(pf => {
      const cliente   = this.nombreCliente(pf.clientes_b2b);
      const periodo   = this.periodoLabel(pf.periodo_mes, pf.periodo_anio);
      const facturada = pf.estado === 'facturada';

      const botonesEstado = !facturada ? `
        <div style="margin-bottom:8px">
          <label class="acord-field-lbl">Cambiar estado</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
            ${Object.entries(this.ESTADOS)
              .filter(([k]) => k !== pf.estado)
              .map(([k, v]) => `<button class="btn btn-sm btn-outline btn-pf-estado" data-id="${pf.id}" data-estado="${k}">${v.icon} ${v.label}</button>`)
              .join('')}
          </div>
        </div>` : '';

      const btnEditar = !facturada && esAdmin
        ? `<button class="btn btn-sm btn-outline btn-pf-editar" data-id="${pf.id}">✏️ Editar</button>`
        : '';

      const btnEliminar = esAdmin && pf.estado === 'borrador'
        ? `<button class="btn btn-sm btn-ghost btn-pf-eliminar" data-id="${pf.id}" style="color:var(--red)">🗑️ Eliminar</button>`
        : '';

      const btnFacturar = esAdmin && pf.estado === 'aprobada'
        ? `<button class="btn btn-sm btn-primary btn-pf-facturar" data-id="${pf.id}">🧾 Registrar Factura</button>`
        : '';

      return `
        <div class="acord-row" data-id="${pf.id}">
          <div class="acord-summary">
            <div class="acord-main">
              <span class="acord-nombre">${escHtml(cliente)}</span>
              <div class="acord-meta">
                <span class="acord-meta-txt">${periodo}</span>
                <span class="acord-meta-txt">· ${parseFloat(pf.total_litros).toFixed(1)} L · ${parseFloat(pf.total_final).toFixed(2)} €</span>
              </div>
            </div>
            <div class="acord-right">
              ${this.estadoBadge(pf.estado)}
              <span class="acord-chevron">›</span>
            </div>
          </div>
          <div class="acord-detail">
            <div class="acord-grid" style="margin-bottom:8px">
              <div class="acord-field">
                <span class="acord-field-lbl">Generada</span>
                <span class="acord-field-val">${fmtFecha(pf.fecha_generacion)}</span>
              </div>
              <div class="acord-field">
                <span class="acord-field-lbl">Subtotal albaranes</span>
                <span class="acord-field-val">${parseFloat(pf.subtotal).toFixed(2)} €</span>
              </div>
              ${parseFloat(pf.total_ajustes) !== 0 ? `
              <div class="acord-field">
                <span class="acord-field-lbl">Ajustes</span>
                <span class="acord-field-val">${parseFloat(pf.total_ajustes) >= 0 ? '+' : ''}${parseFloat(pf.total_ajustes).toFixed(2)} €</span>
              </div>` : ''}
              <div class="acord-field">
                <span class="acord-field-lbl">Total final</span>
                <span class="acord-field-val" style="font-weight:700;color:var(--cyan)">${parseFloat(pf.total_final).toFixed(2)} €</span>
              </div>
            </div>
            ${botonesEstado}
            <div class="acord-actions">
              <button class="btn btn-sm btn-ghost btn-pf-ver" data-id="${pf.id}">🔍 Ver detalle</button>
              <button class="btn btn-sm btn-ghost btn-pf-pdf" data-id="${pf.id}">🖨️ PDF</button>
              ${btnEditar}
              ${btnFacturar}
              ${btnEliminar}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Acordeón
    el.querySelectorAll('.acord-summary').forEach(s => {
      s.addEventListener('click', () => {
        const row    = s.closest('.acord-row');
        const isOpen = row.classList.contains('open');
        el.querySelectorAll('.acord-row.open').forEach(r => r.classList.remove('open'));
        if (!isOpen) row.classList.add('open');
      });
    });

    el.querySelectorAll('.btn-pf-ver').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.abrirDetalle(btn.dataset.id, false); });
    });
    el.querySelectorAll('.btn-pf-editar').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.abrirDetalle(btn.dataset.id, true); });
    });
    el.querySelectorAll('.btn-pf-pdf').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.printProforma(btn.dataset.id); });
    });
    el.querySelectorAll('.btn-pf-estado').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.cambiarEstado(btn.dataset.id, btn.dataset.estado); });
    });
    el.querySelectorAll('.btn-pf-eliminar').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.eliminarProforma(btn.dataset.id); });
    });
    el.querySelectorAll('.btn-pf-facturar').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.abrirModalFacturar(btn.dataset.id); });
    });
  },

  // ── Modal: Generar nueva proforma ─────────────────────────────────────────────

  abrirModalGenerar() {
    // Poblar selector de clientes
    const sel = document.getElementById('pf-gen-cliente');
    sel.innerHTML = '<option value="">— Selecciona cliente —</option>';
    this.clientes.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${escHtml(c.nombre_comercial || c.razon_social)}</option>`;
    });
    sel.value = this.filtroCliente || '';

    // Poblar meses
    const selMes = document.getElementById('pf-gen-mes');
    selMes.innerHTML = this.MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    selMes.value = new Date().getMonth() + 1;

    // Año actual
    document.getElementById('pf-gen-anio').value = new Date().getFullYear();

    // Reset preview
    document.getElementById('pf-gen-preview-wrap').classList.add('hidden');
    document.getElementById('btn-pf-gen-confirm').disabled = true;

    openModal('modal-pf-generar-overlay');
  },

  async previewGenerar() {
    const clienteId = document.getElementById('pf-gen-cliente').value;
    const mes       = parseInt(document.getElementById('pf-gen-mes').value);
    const anio      = parseInt(document.getElementById('pf-gen-anio').value);

    if (!clienteId) { showToast('Selecciona un cliente', 'error'); return; }

    // Verificar si ya existe proforma para ese periodo
    const existe = this.lista.find(p =>
      p.cliente_id === clienteId && p.periodo_mes === mes && p.periodo_anio === anio
    );
    if (existe) {
      showToast(`Ya existe una proforma para ${this.MESES[mes - 1]} ${anio}`, 'error');
      return;
    }

    const wrap    = document.getElementById('pf-gen-preview-wrap');
    const preview = document.getElementById('pf-gen-preview');
    wrap.classList.remove('hidden');
    preview.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    document.getElementById('btn-pf-gen-confirm').disabled = true;

    const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    // OJO: no usar .toISOString() aquí — new Date(anio, mes, 0) crea la fecha
    // a medianoche en hora LOCAL, y toISOString() la convierte a UTC. En
    // horario de verano España (UTC+2), esa medianoche local cae en el día
    // anterior en UTC, así que el último día del mes se calculaba mal (un
    // día antes) y el albarán entregado justo ese último día se quedaba
    // fuera del filtro .lte(). getDate() en cambio lee el día en hora local,
    // sin conversión, así que es seguro.
    const ultimoDia   = new Date(anio, mes, 0).getDate();
    const fechaFin    = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    try {
      const { data: pedidos, error } = await sb
        .from('pedidos_b2b')
        .select('id, fecha_entrega_prevista, total_litros, total_importe, referencia_cliente')
        .eq('cliente_id', clienteId)
        .eq('estado', 'entregado')
        .is('proforma_id', null)
        .gte('fecha_entrega_prevista', fechaInicio)
        .lte('fecha_entrega_prevista', fechaFin)
        .order('fecha_entrega_prevista');
      if (error) throw error;

      if (!pedidos.length) {
        preview.innerHTML = `<div class="pf-preview-empty">No hay albaranes entregados sin facturar para este periodo.</div>`;
        return;
      }

      const totalLitros  = pedidos.reduce((s, p) => s + parseFloat(p.total_litros || 0), 0);
      const totalImporte = pedidos.reduce((s, p) => s + parseFloat(p.total_importe || 0), 0);

      preview.innerHTML = `
        <div class="pf-preview-header">Se consolidarán <strong>${pedidos.length} albarán(es)</strong></div>
        <div style="overflow-x:auto">
          <table class="pf-preview-table">
            <thead><tr><th>Ref. albarán</th><th>Fecha entrega</th><th style="text-align:right">Litros</th><th style="text-align:right">Importe €</th></tr></thead>
            <tbody>
              ${pedidos.map(p => `
                <tr>
                  <td style="font-size:11px">ALB-${p.id.slice(0, 8).toUpperCase()}</td>
                  <td>${fmtFecha(p.fecha_entrega_prevista)}</td>
                  <td style="text-align:right">${parseFloat(p.total_litros || 0).toFixed(1)}</td>
                  <td style="text-align:right">${parseFloat(p.total_importe || 0).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>TOTAL</strong></td>
                <td style="text-align:right"><strong>${totalLitros.toFixed(1)}</strong></td>
                <td style="text-align:right"><strong>${totalImporte.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>`;

      document.getElementById('btn-pf-gen-confirm').disabled = false;

    } catch (e) {
      console.error('previewGenerar:', e);
      preview.innerHTML = `<div class="pf-preview-empty">Error al consultar albaranes: ${e.message}</div>`;
    }
  },

  async confirmarGeneracion() {
    const clienteId = document.getElementById('pf-gen-cliente').value;
    const mes       = parseInt(document.getElementById('pf-gen-mes').value);
    const anio      = parseInt(document.getElementById('pf-gen-anio').value);
    const empleada  = Estado.getEmpleada();

    const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
    // OJO: no usar .toISOString() aquí — new Date(anio, mes, 0) crea la fecha
    // a medianoche en hora LOCAL, y toISOString() la convierte a UTC. En
    // horario de verano España (UTC+2), esa medianoche local cae en el día
    // anterior en UTC, así que el último día del mes se calculaba mal (un
    // día antes) y el albarán entregado justo ese último día se quedaba
    // fuera del filtro .lte(). getDate() en cambio lee el día en hora local,
    // sin conversión, así que es seguro.
    const ultimoDia   = new Date(anio, mes, 0).getDate();
    const fechaFin    = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const btn = document.getElementById('btn-pf-gen-confirm');
    btn.disabled = true; btn.textContent = 'Generando…';

    try {
      // 1. Obtener pedidos elegibles
      const { data: pedidos, error: e0 } = await sb
        .from('pedidos_b2b')
        .select('id, fecha_entrega_prevista, total_litros, total_importe')
        .eq('cliente_id', clienteId)
        .eq('estado', 'entregado')
        .is('proforma_id', null)
        .gte('fecha_entrega_prevista', fechaInicio)
        .lte('fecha_entrega_prevista', fechaFin);
      if (e0) throw e0;

      // 2. Obtener líneas de esos pedidos
      const pedidoIds = pedidos.map(p => p.id);
      const { data: todasLineas, error: e1 } = await sb
        .from('pedidos_b2b_lineas')
        .select('*')
        .in('pedido_id', pedidoIds);
      if (e1) throw e1;

      const lineas = todasLineas || [];

      // 3. Calcular totales
      const total_litros  = lineas.reduce((s, l) => s + parseFloat(l.litros || 0), 0);
      const subtotal      = lineas.reduce((s, l) => s + parseFloat(l.subtotal || 0), 0);
      const total_promo   = lineas.filter(l => l.es_promocional).reduce((s, l) => s + parseFloat(l.litros || 0), 0);

      // 4. Crear cabecera de proforma
      const { data: proforma, error: e2 } = await sb
        .from('proformas_b2b')
        .insert({
          cliente_id:               clienteId,
          periodo_mes:              mes,
          periodo_anio:             anio,
          fecha_generacion:         new Date().toISOString().slice(0, 10),
          total_litros,
          subtotal,
          total_promociones_litros: total_promo,
          total_ajustes:            0,
          total_final:              subtotal,
          creado_por:               empleada,
        })
        .select('id')
        .single();
      if (e2) throw e2;

      const proformaId = proforma.id;

      // 5. Crear líneas de albarán
      if (lineas.length) {
        const lineasPayload = lineas.map(l => {
          const ped = pedidos.find(p => p.id === l.pedido_id);
          return {
            proforma_id:     proformaId,
            tipo:            'albaran',
            pedido_id:       l.pedido_id,
            pedido_linea_id: l.id,
            num_albaran:     l.pedido_id.slice(0, 8).toUpperCase(),
            fecha_albaran:   ped?.fecha_entrega_prevista || null,
            sabor_nombre:    l.sabor_nombre,
            litros:          l.litros,
            precio_litro:    l.precio_litro,
            es_promocional:  l.es_promocional,
            subtotal_linea:  l.subtotal,
            excluida:        false,
          };
        });
        const { error: e3 } = await sb.from('proformas_b2b_lineas').insert(lineasPayload);
        if (e3) throw e3;
      }

      // 6. Vincular pedidos a la proforma
      const { error: e4 } = await sb
        .from('pedidos_b2b')
        .update({ proforma_id: proformaId })
        .in('id', pedidoIds);
      if (e4) throw e4;

      showToast(`Proforma generada: ${pedidos.length} albarán(es) consolidado(s) ✓`, 'success');
      closeModal('modal-pf-generar-overlay');
      await this.load();

    } catch (e) {
      console.error('confirmarGeneracion:', e);
      showToast('Error al generar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Generar proforma';
    }
  },

  // ── Modal: Detalle / Editar proforma ──────────────────────────────────────────

  async abrirDetalle(proformaId, editable = false) {
    const pf = this.lista.find(p => p.id === proformaId);
    if (!pf) return;

    this._pfActivo = pf;
    this._editable = editable && pf.estado !== 'facturada';

    // Header
    document.getElementById('pf-det-titulo').textContent =
      `${this.nombreCliente(pf.clientes_b2b)} · ${this.periodoLabel(pf.periodo_mes, pf.periodo_anio)}`;
    document.getElementById('pf-det-estado').innerHTML = this.estadoBadge(pf.estado);
    document.getElementById('pf-det-id').value = pf.id;

    // Notas (habilitadas solo en edición)
    ['pf-det-obs-interna', 'pf-det-notas-cliente', 'pf-det-comentarios'].forEach(id => {
      document.getElementById(id).disabled = !this._editable;
    });
    document.getElementById('pf-det-obs-interna').value  = pf.observaciones_internas || '';
    document.getElementById('pf-det-notas-cliente').value = pf.notas_cliente || '';
    document.getElementById('pf-det-comentarios').value  = pf.comentarios_comerciales || '';

    document.getElementById('btn-pf-det-guardar-notas').classList.toggle('hidden', !this._editable);
    document.getElementById('pf-add-ajuste-section').classList.toggle('hidden', !this._editable);

    // Limpiar y cargar líneas
    document.getElementById('pf-det-lineas-wrap').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';

    openModal('modal-pf-detalle-overlay');
    await this._cargarLineasDetalle();
  },

  async _cargarLineasDetalle() {
    try {
      const { data: lineas, error } = await sb
        .from('proformas_b2b_lineas')
        .select('*')
        .eq('proforma_id', this._pfActivo.id)
        .order('tipo')
        .order('fecha_albaran')
        .order('created_at');
      if (error) throw error;
      this.lineas = lineas || [];
      this._renderLineasDetalle();
    } catch (e) {
      console.error('_cargarLineasDetalle:', e);
      document.getElementById('pf-det-lineas-wrap').innerHTML =
        '<div class="empty-msg">Error al cargar líneas</div>';
    }
  },

  _renderLineasDetalle() {
    const wrap         = document.getElementById('pf-det-lineas-wrap');
    const lineasAlb    = this.lineas.filter(l => l.tipo === 'albaran');
    const lineasAjuste = this.lineas.filter(l => l.tipo === 'ajuste');
    const ed           = this._editable;

    // ── Sección albaranes ─────────────────────────────────────────────────────
    let html = `<div class="pf-section-label">📦 Albaranes incluidos</div>`;

    if (!lineasAlb.length) {
      html += `<div class="pf-empty-section">Sin líneas de albarán</div>`;
    } else {
      html += `
        <div style="overflow-x:auto">
          <table class="pf-lineas-table">
            <thead>
              <tr>
                <th>Albarán</th><th>Fecha</th><th>Sabor</th>
                <th style="text-align:right">L</th>
                <th style="text-align:right">€/L</th>
                <th style="text-align:right">Subtotal</th>
                ${ed ? '<th style="text-align:center">Excluir</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${lineasAlb.map(l => {
                const ex = l.excluida;
                return `<tr class="${ex ? 'pf-linea-excluida' : ''}">
                  <td class="pf-alb-ref">ALB-${l.num_albaran || '–'}</td>
                  <td>${fmtFecha(l.fecha_albaran)}</td>
                  <td>${escHtml(l.sabor_nombre || '–')}${l.es_promocional ? ' 🎁' : ''}</td>
                  <td style="text-align:right">${parseFloat(l.litros || 0).toFixed(1)}</td>
                  <td style="text-align:right">${parseFloat(l.precio_litro || 0).toFixed(2)}</td>
                  <td style="text-align:right">${ex ? `<s>${parseFloat(l.subtotal_linea || 0).toFixed(2)}</s>` : parseFloat(l.subtotal_linea || 0).toFixed(2)}</td>
                  ${ed ? `<td style="text-align:center">
                    <button class="btn-pf-toggle-excluir" data-id="${l.id}" title="${ex ? 'Incluir' : 'Excluir'}">${ex ? '↩️' : '✕'}</button>
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // ── Sección ajustes ────────────────────────────────────────────────────────
    html += `<div class="pf-section-label" style="margin-top:14px">🔧 Ajustes manuales</div>`;

    if (!lineasAjuste.length) {
      html += `<div class="pf-empty-section">Sin ajustes manuales</div>`;
    } else {
      html += `
        <div style="overflow-x:auto">
          <table class="pf-lineas-table">
            <thead>
              <tr>
                <th>Tipo</th><th>Descripción</th>
                <th style="text-align:right">Importe €</th>
                <th>Notas</th>
                ${ed ? '<th></th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${lineasAjuste.map(l => `
                <tr>
                  <td class="pf-alb-ref">${escHtml(this.TIPOS_AJUSTE[l.tipo_ajuste] || l.tipo_ajuste || '–')}</td>
                  <td>${escHtml(l.descripcion || '–')}</td>
                  <td style="text-align:right;font-weight:700;color:${parseFloat(l.importe || 0) < 0 ? '#c62828' : '#2e7d32'}">
                    ${parseFloat(l.importe || 0) >= 0 ? '+' : ''}${parseFloat(l.importe || 0).toFixed(2)}
                  </td>
                  <td style="font-size:11px;color:#888">${escHtml(l.observaciones_ajuste || '')}</td>
                  ${ed ? `<td style="text-align:center">
                    <button class="btn btn-sm btn-ghost btn-pf-del-ajuste" data-id="${l.id}" style="color:var(--red)">✕</button>
                  </td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // ── Totales ────────────────────────────────────────────────────────────────
    const activas      = lineasAlb.filter(l => !l.excluida);
    const totalLitros  = activas.reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const litrosPromo  = activas.filter(l => l.es_promocional).reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const subtotal     = activas.reduce((s, l) => s + parseFloat(l.subtotal_linea || 0), 0);
    const totalAjustes = lineasAjuste.reduce((s, l) => s + parseFloat(l.importe || 0), 0);
    const totalFinal   = subtotal + totalAjustes;

    html += `
      <div class="pf-totales">
        <div class="pf-total-row"><span>Total litros servidos</span><strong>${totalLitros.toFixed(1)} L</strong></div>
        ${litrosPromo > 0 ? `<div class="pf-total-row"><span>Litros promocionales 🎁</span><strong>${litrosPromo.toFixed(1)} L</strong></div>` : ''}
        <div class="pf-total-row"><span>Subtotal albaranes</span><strong>${subtotal.toFixed(2)} €</strong></div>
        ${totalAjustes !== 0 ? `<div class="pf-total-row"><span>Total ajustes</span><strong style="color:${totalAjustes < 0 ? '#c62828' : '#2e7d32'}">${totalAjustes >= 0 ? '+' : ''}${totalAjustes.toFixed(2)} €</strong></div>` : ''}
        <div class="pf-total-row pf-total-final"><span>TOTAL PROFORMA</span><strong>${totalFinal.toFixed(2)} €</strong></div>
      </div>`;

    wrap.innerHTML = html;

    // Bind botones de excluir / incluir
    if (ed) {
      wrap.querySelectorAll('.btn-pf-toggle-excluir').forEach(btn => {
        btn.addEventListener('click', () => this._toggleExcluirLinea(btn.dataset.id));
      });
      wrap.querySelectorAll('.btn-pf-del-ajuste').forEach(btn => {
        btn.addEventListener('click', () => this._eliminarAjuste(btn.dataset.id));
      });
    }
  },

  // ── Excluir / incluir línea de albarán ────────────────────────────────────────

  async _toggleExcluirLinea(lineaId) {
    const linea = this.lineas.find(l => l.id === lineaId);
    if (!linea) return;
    const nuevo = !linea.excluida;
    try {
      const { error } = await sb.from('proformas_b2b_lineas')
        .update({ excluida: nuevo }).eq('id', lineaId);
      if (error) throw error;
      linea.excluida = nuevo;
      await this._recalcularYGuardarTotales();
      this._renderLineasDetalle();
    } catch (e) {
      console.error('_toggleExcluirLinea:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Eliminar ajuste manual ────────────────────────────────────────────────────

  async _eliminarAjuste(lineaId) {
    if (!confirm('¿Eliminar este ajuste?')) return;
    try {
      const { error } = await sb.from('proformas_b2b_lineas').delete().eq('id', lineaId);
      if (error) throw error;
      this.lineas = this.lineas.filter(l => l.id !== lineaId);
      await this._recalcularYGuardarTotales();
      this._renderLineasDetalle();
      showToast('Ajuste eliminado ✓', 'success');
    } catch (e) {
      console.error('_eliminarAjuste:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Recalcular y guardar totales en la cabecera ───────────────────────────────

  async _recalcularYGuardarTotales() {
    const activas      = this.lineas.filter(l => l.tipo === 'albaran' && !l.excluida);
    const lAjustes     = this.lineas.filter(l => l.tipo === 'ajuste');
    const total_litros = activas.reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const subtotal     = activas.reduce((s, l) => s + parseFloat(l.subtotal_linea || 0), 0);
    const total_promo  = activas.filter(l => l.es_promocional).reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const total_ajustes = lAjustes.reduce((s, l) => s + parseFloat(l.importe || 0), 0);
    const total_final  = subtotal + total_ajustes;

    const { error } = await sb.from('proformas_b2b').update({
      total_litros, subtotal,
      total_promociones_litros: total_promo,
      total_ajustes, total_final,
      modificado_por: Estado.getEmpleada(),
    }).eq('id', this._pfActivo.id);
    if (error) throw error;

    // Actualizar en lista local
    const pf = this.lista.find(p => p.id === this._pfActivo.id);
    if (pf) Object.assign(pf, { total_litros, subtotal, total_ajustes, total_final });
  },

  // ── Añadir ajuste manual ──────────────────────────────────────────────────────

  async addAjuste() {
    const tipo_ajuste   = document.getElementById('ajuste-tipo').value;
    const descripcion   = document.getElementById('ajuste-descripcion').value.trim();
    const importe       = parseFloat(document.getElementById('ajuste-importe').value);
    const obs           = document.getElementById('ajuste-obs').value.trim() || null;

    if (!tipo_ajuste)    { showToast('Selecciona un tipo de ajuste', 'error'); return; }
    if (!descripcion)    { showToast('La descripción es obligatoria', 'error'); return; }
    if (isNaN(importe))  { showToast('Introduce un importe válido (puede ser negativo)', 'error'); return; }

    try {
      const { data: nueva, error } = await sb
        .from('proformas_b2b_lineas')
        .insert({
          proforma_id:          this._pfActivo.id,
          tipo:                 'ajuste',
          tipo_ajuste,
          descripcion,
          importe,
          observaciones_ajuste: obs,
        })
        .select()
        .single();
      if (error) throw error;

      this.lineas.push(nueva);
      await this._recalcularYGuardarTotales();

      // Reset form
      document.getElementById('ajuste-tipo').value        = '';
      document.getElementById('ajuste-descripcion').value = '';
      document.getElementById('ajuste-importe').value     = '';
      document.getElementById('ajuste-obs').value         = '';

      this._renderLineasDetalle();
      showToast('Ajuste añadido ✓', 'success');

    } catch (e) {
      console.error('addAjuste:', e);
      showToast('Error al añadir ajuste: ' + (e.message || e), 'error');
    }
  },

  // ── Guardar notas ─────────────────────────────────────────────────────────────

  async guardarNotas() {
    const proformaId = document.getElementById('pf-det-id').value;
    const obs        = document.getElementById('pf-det-obs-interna').value.trim()  || null;
    const notas      = document.getElementById('pf-det-notas-cliente').value.trim() || null;
    const coms       = document.getElementById('pf-det-comentarios').value.trim()   || null;

    try {
      const { error } = await sb.from('proformas_b2b').update({
        observaciones_internas:  obs,
        notas_cliente:           notas,
        comentarios_comerciales: coms,
        modificado_por:          Estado.getEmpleada(),
      }).eq('id', proformaId);
      if (error) throw error;

      const pf = this.lista.find(p => p.id === proformaId);
      if (pf) { pf.observaciones_internas = obs; pf.notas_cliente = notas; pf.comentarios_comerciales = coms; }

      showToast('Notas guardadas ✓', 'success');
    } catch (e) {
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Cambiar estado ────────────────────────────────────────────────────────────

  async cambiarEstado(proformaId, nuevoEstado) {
    const pf        = this.lista.find(p => p.id === proformaId);
    const estadoInf = this.ESTADOS[nuevoEstado];
    const empleada  = Estado.getEmpleada();

    const msg = nuevoEstado === 'facturada'
      ? `¿Marcar como FACTURADA?\n\nSe bloquearán la proforma y todos sus albaranes. Esta acción no se puede deshacer.`
      : `¿Cambiar estado a "${estadoInf?.label}"?`;
    if (!confirm(msg)) return;

    try {
      const { error } = await sb.from('proformas_b2b')
        .update({ estado: nuevoEstado, modificado_por: empleada })
        .eq('id', proformaId);
      if (error) throw error;

      // Al facturar, marcar los pedidos vinculados como facturado
      if (nuevoEstado === 'facturada') {
        const { data: pfLineas } = await sb
          .from('proformas_b2b_lineas')
          .select('pedido_id')
          .eq('proforma_id', proformaId)
          .eq('tipo', 'albaran')
          .not('pedido_id', 'is', null);

        const ids = [...new Set((pfLineas || []).map(l => l.pedido_id).filter(Boolean))];
        if (ids.length) {
          await sb.from('pedidos_b2b')
            .update({ estado: 'facturado', modificado_por: empleada })
            .in('id', ids);
        }
      }

      showToast(`Estado actualizado: ${estadoInf?.label} ✓`, 'success');
      await this.load();

    } catch (e) {
      console.error('cambiarEstado:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Registrar Factura (B2B-BILL-001) ──────────────────────────────────────────

  abrirModalFacturar(proformaId) {
    const pf = this.lista.find(p => p.id === proformaId);
    if (!pf) return;

    const cliente  = this.nombreCliente(pf.clientes_b2b);
    const periodo  = this.periodoLabel(pf.periodo_mes, pf.periodo_anio);
    const baseImp  = parseFloat(pf.subtotal || 0) + parseFloat(pf.total_ajustes || 0);
    const cuotaIVA = baseImp * 0.10;
    const total    = baseImp + cuotaIVA;

    // Rellenar resumen en el modal
    document.getElementById('fact-modal-cliente').textContent  = cliente;
    document.getElementById('fact-modal-periodo').textContent  = periodo;
    document.getElementById('fact-modal-total').textContent    = `${total.toFixed(2)} €`;

    // Limpiar campos
    document.getElementById('fact-num-factura').value        = '';
    document.getElementById('fact-fecha-factura').value      = new Date().toISOString().split('T')[0];
    document.getElementById('fact-ref-verifactu').value      = '';
    document.getElementById('fact-obs-factura').value        = '';
    document.getElementById('fact-error').textContent        = '';

    // Guardar referencia
    document.getElementById('fact-proforma-id').value = proformaId;

    openModal('modal-pf-facturar-overlay');
  },

  async confirmarFactura() {
    const proformaId = document.getElementById('fact-proforma-id').value;
    const numero     = document.getElementById('fact-num-factura').value.trim();
    const fecha      = document.getElementById('fact-fecha-factura').value;
    const refVf      = document.getElementById('fact-ref-verifactu').value.trim() || null;
    const obs        = document.getElementById('fact-obs-factura').value.trim() || null;
    const errEl      = document.getElementById('fact-error');
    errEl.textContent = '';

    if (!numero) { errEl.textContent = 'El número de factura es obligatorio.'; return; }
    if (!fecha)  { errEl.textContent = 'La fecha de factura es obligatoria.'; return; }

    const empleada = Estado.getEmpleada();

    try {
      // Verificar unicidad del número de factura
      const { data: existe } = await sb
        .from('facturas_b2b')
        .select('id')
        .eq('numero_factura', numero)
        .maybeSingle();

      if (existe) {
        errEl.textContent = `El número de factura "${numero}" ya existe. Usa un número único.`;
        return;
      }

      // Insertar factura
      const { error: errIns } = await sb.from('facturas_b2b').insert({
        proforma_id:           proformaId,
        numero_factura:        numero,
        fecha_factura:         fecha,
        referencia_verifactu:  refVf,
        observaciones_internas: obs,
        usuario_facturacion:   empleada,
      });
      if (errIns) throw errIns;

      // Cambiar estado proforma → facturada (y bloquear albaranes)
      await this._facturarProformaInterna(proformaId, empleada);

      closeModal('modal-pf-facturar-overlay');
      showToast(`Factura ${numero} registrada ✓`, 'success', 3500);
      await this.load();

      // Refrescar también el historial si está cargado
      if (typeof Facturas !== 'undefined' && App.currentScreen === 'facturas') {
        Facturas.load();
      }

    } catch (e) {
      console.error('confirmarFactura:', e);
      errEl.textContent = 'Error: ' + (e.message || JSON.stringify(e));
    }
  },

  async _facturarProformaInterna(proformaId, empleada) {
    // Cambiar estado proforma
    const { error } = await sb.from('proformas_b2b')
      .update({ estado: 'facturada', modificado_por: empleada })
      .eq('id', proformaId);
    if (error) throw error;

    // Bloquear pedidos vinculados → estado facturado
    const { data: pfLineas } = await sb
      .from('proformas_b2b_lineas')
      .select('pedido_id')
      .eq('proforma_id', proformaId)
      .eq('tipo', 'albaran')
      .not('pedido_id', 'is', null);

    const ids = [...new Set((pfLineas || []).map(l => l.pedido_id).filter(Boolean))];
    if (ids.length) {
      await sb.from('pedidos_b2b')
        .update({ estado: 'facturado', modificado_por: empleada })
        .in('id', ids);
    }
  },

  // ── Eliminar proforma ─────────────────────────────────────────────────────────

  async eliminarProforma(proformaId) {
    if (!confirm('¿Eliminar esta proforma?\n\nLos albaranes quedarán libres para incluirse en futuras proformas.')) return;

    try {
      // Desvincular pedidos
      const { data: pfLineas } = await sb
        .from('proformas_b2b_lineas')
        .select('pedido_id')
        .eq('proforma_id', proformaId)
        .eq('tipo', 'albaran')
        .not('pedido_id', 'is', null);

      const ids = [...new Set((pfLineas || []).map(l => l.pedido_id).filter(Boolean))];
      if (ids.length) {
        await sb.from('pedidos_b2b').update({ proforma_id: null }).in('id', ids);
      }

      // Borrar proforma (líneas en cascada)
      const { error } = await sb.from('proformas_b2b').delete().eq('id', proformaId);
      if (error) throw error;

      showToast('Proforma eliminada', 'success');
      await this.load();

    } catch (e) {
      console.error('eliminarProforma:', e);
      showToast('Error al eliminar: ' + (e.message || e), 'error');
    }
  },

  // ── Imprimir PDF ──────────────────────────────────────────────────────────────

  async printProforma(proformaId) {
    const pf = this.lista.find(p => p.id === proformaId);
    if (!pf) return;
    showToast('Preparando PDF…', 'info', 1500);

    try {
      let logoDataUrl = '';
      try {
        const resp = await fetch('assets/logo.png');
        const blob = await resp.blob();
        logoDataUrl = await new Promise(resolve => {
          const r = new FileReader();
          r.onload  = e => resolve(e.target.result);
          r.onerror = () => resolve('');
          r.readAsDataURL(blob);
        });
      } catch (_) {}

      const { data: cli } = await sb
        .from('clientes_b2b')
        .select('razon_social, nombre_comercial, nif_cif, direccion_fiscal, telefono, email_facturacion')
        .eq('id', pf.cliente_id)
        .single();

      const { data: lineas } = await sb
        .from('proformas_b2b_lineas')
        .select('*')
        .eq('proforma_id', proformaId)
        .order('tipo')
        .order('fecha_albaran')
        .order('created_at');

      const html = this._buildProformaHtml(pf, cli || {}, lineas || [], logoDataUrl);
      const win  = window.open('', '_blank', 'width=820,height=700');
      if (!win) { showToast('Permite ventanas emergentes para imprimir', 'error', 4000); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);

    } catch (e) {
      console.error('printProforma:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  _buildProformaHtml(pf, cli, lineas, logoDataUrl = '') {
    const numPF         = pf.id.slice(0, 8).toUpperCase();
    const clienteNombre = cli.nombre_comercial || cli.razon_social || '–';
    const estado        = this.ESTADOS[pf.estado] || { label: pf.estado, icon: '' };
    const periodo       = this.periodoLabel(pf.periodo_mes, pf.periodo_anio);

    const lineasAlb    = lineas.filter(l => l.tipo === 'albaran' && !l.excluida);
    const lineasAjuste = lineas.filter(l => l.tipo === 'ajuste');

    const filasAlb = lineasAlb.map((l, i) => `
      <tr>
        <td style="text-align:center;color:#888;font-size:10px">${i + 1}</td>
        <td style="font-size:10px;color:#888">ALB-${l.num_albaran || '–'}</td>
        <td style="font-size:11px;white-space:nowrap">${fmtFecha(l.fecha_albaran)}</td>
        <td>${escHtml(l.sabor_nombre || '–')}${l.es_promocional ? ' <span class="promo-tag">PROMO</span>' : ''}</td>
        <td style="text-align:right">${parseFloat(l.litros || 0).toFixed(1)}</td>
        <td style="text-align:right">${parseFloat(l.precio_litro || 0).toFixed(2)}</td>
        <td style="text-align:right">${parseFloat(l.subtotal_linea || 0).toFixed(2)}</td>
      </tr>`).join('');

    const filasAjuste = lineasAjuste.map(l => `
      <tr>
        <td colspan="4">${escHtml(this.TIPOS_AJUSTE[l.tipo_ajuste] || '–')} · ${escHtml(l.descripcion || '')}</td>
        <td colspan="2" style="text-align:right;font-size:10px;color:#888">${escHtml(l.observaciones_ajuste || '')}</td>
        <td style="text-align:right;font-weight:700;color:${parseFloat(l.importe || 0) < 0 ? '#c62828' : '#2e7d32'}">
          ${parseFloat(l.importe || 0) >= 0 ? '+' : ''}${parseFloat(l.importe || 0).toFixed(2)}
        </td>
      </tr>`).join('');

    const totalLitros  = lineasAlb.reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const litrosPromo  = lineasAlb.filter(l => l.es_promocional).reduce((s, l) => s + parseFloat(l.litros || 0), 0);
    const subtotal     = lineasAlb.reduce((s, l) => s + parseFloat(l.subtotal_linea || 0), 0);
    const totalAjustes = lineasAjuste.reduce((s, l) => s + parseFloat(l.importe || 0), 0);
    const baseImponible = subtotal + totalAjustes;
    const cuotaIVA     = baseImponible * 0.10;
    const totalFinal   = baseImponible + cuotaIVA;

    const notasHtml = [
      pf.notas_cliente           ? `<p><strong>Notas al cliente:</strong> ${escHtml(pf.notas_cliente)}</p>` : '',
      pf.comentarios_comerciales ? `<p><strong>Comentarios comerciales:</strong> ${escHtml(pf.comentarios_comerciales)}</p>` : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Proforma PF-${numPF} · Ludovico Helados</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 1.4cm 1.6cm; }
    html, body { height: 100%; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a2a3a;
           padding: 24px 32px; display: flex; flex-direction: column; min-height: 100vh; }
    .contenido { flex: 1; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 3px solid #1565a0; padding-bottom: 12px; margin-bottom: 16px; }
    .hdr-logo { display: flex; align-items: center; gap: 10px; }
    .hdr-logo img { height: 48px; width: auto; }
    .hdr-logo-txt { font-size: 20px; font-weight: 900; color: #1565a0; }
    .hdr-logo-txt span { color: #F5A623; }
    .hdr-sub { font-size: 10px; color: #666; margin-top: 2px; }
    .hdr-doc { text-align: right; }
    .hdr-doc h1 { font-size: 16px; font-weight: 800; color: #1565a0; text-transform: uppercase; letter-spacing: 1px; }
    .hdr-doc .hdr-num { font-size: 12px; color: #555; margin-top: 2px; }
    .hdr-doc .hdr-estado { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; background:#e3f2fd; color:#1565a0; margin-top:4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .info-box { border: 1px solid #dde4ee; border-radius: 7px; padding: 10px 12px; }
    .info-box h2 { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #1565a0; font-weight: 800; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 6px; }
    .info-box p { font-size: 11px; line-height: 1.6; }
    .section-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #1565a0; margin: 14px 0 6px; border-left: 3px solid #1565a0; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    thead th { background: #1565a0; color: #fff; padding: 6px 7px; text-align: left; font-size: 10px; }
    tbody td { padding: 6px 7px; border-bottom: 1px solid #eee; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f7fafd; }
    tfoot td { padding: 8px 7px; font-weight: 700; border-top: 2px solid #1565a0; background: #f0f4f8; }
    .promo-tag { font-size: 9px; font-weight: 700; color: #1565a0; background: #e3f2fd; padding: 1px 4px; border-radius: 4px; }
    .totales-box { background: #f0f4f8; border-radius: 8px; padding: 10px 14px; margin-top: 10px; }
    .tot-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; border-bottom: 1px solid #e0e7f0; }
    .tot-row:last-child { border-bottom: none; }
    .tot-separator { border-top: 2px solid #1565a0; margin-top: 4px; padding-top: 7px; font-size: 12px; }
    .tot-final { border-top: 1px solid #b0c4d8; margin-top: 2px; padding-top: 7px; font-size: 14px; font-weight: 800; border-bottom: none !important; }
    .notas-box { background: #fffde7; border-left: 4px solid #F5A623; padding: 8px 12px; margin-top: 10px; border-radius: 4px; font-size: 11px; line-height: 1.7; }
    .aviso { margin-top: 14px; font-size: 10px; color: #888; font-style: italic; text-align: center; padding: 8px; border: 1px dashed #ccc; border-radius: 4px; }
    .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #aaa; }
    @media print {
      body { padding: 0; min-height: 297mm; }
      @page { size: A4; margin: 1.4cm 1.6cm; }
    }
  </style>
</head>
<body>
<div class="contenido">

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
    <div class="hdr-doc">
      <h1>Proforma</h1>
      <div class="hdr-num">PF-${numPF} · ${periodo}</div>
      <div class="hdr-estado">${estado.icon} ${estado.label}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h2>Datos del documento</h2>
      <p><strong>Número proforma:</strong> PF-${numPF}</p>
      <p><strong>Periodo:</strong> ${periodo}</p>
      <p><strong>Fecha emisión:</strong> ${fmtFecha(pf.fecha_generacion)}</p>
      <p><strong>Estado:</strong> ${estado.icon} ${estado.label}</p>
    </div>
    <div class="info-box">
      <h2>Cliente</h2>
      <p><strong>${escHtml(clienteNombre)}</strong></p>
      ${cli.razon_social && cli.razon_social !== clienteNombre ? `<p>${escHtml(cli.razon_social)}</p>` : ''}
      ${cli.nif_cif          ? `<p>NIF/CIF: ${escHtml(cli.nif_cif)}</p>` : ''}
      ${cli.direccion_fiscal ? `<p>${escHtml(cli.direccion_fiscal)}</p>` : ''}
      ${cli.telefono         ? `<p>Tel: ${escHtml(cli.telefono)}</p>` : ''}
    </div>
  </div>

  <div class="section-lbl">Detalle de albaranes</div>
  <table>
    <thead>
      <tr>
        <th style="width:24px;text-align:center">#</th>
        <th style="width:68px">Albarán</th>
        <th style="width:88px">Fecha</th>
        <th>Sabor / Producto</th>
        <th style="width:50px;text-align:right">Litros</th>
        <th style="width:56px;text-align:right">€/L</th>
        <th style="width:70px;text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${filasAlb || '<tr><td colspan="7" style="text-align:center;color:#888">Sin líneas de albarán</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right">Subtotal albaranes</td>
        <td style="text-align:right">${totalLitros.toFixed(1)}</td>
        <td></td>
        <td style="text-align:right">${subtotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  ${lineasAjuste.length ? `
  <div class="section-lbl">Ajustes comerciales</div>
  <table>
    <thead>
      <tr>
        <th colspan="4">Concepto</th>
        <th colspan="2">Observaciones</th>
        <th style="width:70px;text-align:right">Importe €</th>
      </tr>
    </thead>
    <tbody>${filasAjuste}</tbody>
  </table>` : ''}

  <div class="totales-box">
    <div class="tot-row"><span>Total litros servidos</span><strong>${totalLitros.toFixed(1)} L</strong></div>
    ${litrosPromo > 0 ? `<div class="tot-row"><span>Litros promocionales 🎁</span><strong>${litrosPromo.toFixed(1)} L</strong></div>` : ''}
    <div class="tot-row"><span>Subtotal albaranes</span><strong>${subtotal.toFixed(2)} €</strong></div>
    ${totalAjustes !== 0 ? `<div class="tot-row"><span>Total ajustes</span><strong style="color:${totalAjustes < 0 ? '#c62828' : '#2e7d32'}">${totalAjustes >= 0 ? '+' : ''}${totalAjustes.toFixed(2)} €</strong></div>` : ''}
    <div class="tot-row tot-separator"><span><strong>Base imponible</strong></span><strong>${baseImponible.toFixed(2)} €</strong></div>
    <div class="tot-row"><span>IVA 10%</span><strong>${cuotaIVA.toFixed(2)} €</strong></div>
    <div class="tot-row tot-final"><span>TOTAL PROFORMA (IVA incl.)</span><strong>${totalFinal.toFixed(2)} €</strong></div>
  </div>

  ${notasHtml ? `<div class="notas-box">${notasHtml}</div>` : ''}

  <div class="aviso">⚠️ Este documento es una proforma y no tiene validez fiscal. La factura definitiva se emitirá en Verifactu.</div>

</div>

<div class="footer">
  Ludovico Desarrollo Madrid · NIF B21689682 · C/ Litio 1 3C, 28045 Madrid
  &nbsp;·&nbsp; Generado el ${new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })}
</div>
</body>
</html>`;
  },

  // ── Bind UI ──────────────────────────────────────────────────────────────────

  bindUI() {
    document.getElementById('fab-add-proforma').onclick          = () => this.abrirModalGenerar();
    document.getElementById('modal-pf-gen-close').onclick        = () => closeModal('modal-pf-generar-overlay');
    document.getElementById('btn-pf-gen-cancel').onclick         = () => closeModal('modal-pf-generar-overlay');
    document.getElementById('btn-pf-gen-preview').onclick        = () => this.previewGenerar();
    document.getElementById('btn-pf-gen-confirm').onclick        = () => this.confirmarGeneracion();
    document.getElementById('modal-pf-det-close').onclick        = () => closeModal('modal-pf-detalle-overlay');
    document.getElementById('btn-pf-det-guardar-notas').onclick  = () => this.guardarNotas();
    document.getElementById('btn-pf-add-ajuste').onclick         = () => this.addAjuste();
  },
};
