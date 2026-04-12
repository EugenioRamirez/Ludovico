// ── compras.js · Lista de Compras ─────────────────────────────────────────────

const Compras = {
  items:     [],
  productos: [],
  filtro:    'all',

  async load() {
    document.getElementById('compras-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';

    await Promise.all([this.loadProductos(), this.loadItems()]);
    this.renderList();
    this.bindUI();
  },

  async loadProductos() {
    try {
      const { data } = await sb
        .from('productos')
        .select('id, nombre, unidad, categorias(nombre)')
        .eq('activo', true)
        .order('nombre');
      this.productos = data || [];

      // Agrupar por categoría
      const grupos = {};
      this.productos.forEach(p => {
        const cat = p.categorias ? p.categorias.nombre : 'Sin categoría';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(p);
      });

      const sel = document.getElementById('compra-producto-sel');
      sel.innerHTML = '<option value="">– Escribir manualmente –</option>';

      Object.entries(grupos).sort((a,b) => a[0].localeCompare(b[0])).forEach(([cat, prods]) => {
        const group = document.createElement('optgroup');
        group.label = cat;
        prods.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.dataset.unidad = p.unidad;
          opt.textContent = p.nombre;
          group.appendChild(opt);
        });
        sel.appendChild(group);
      });
    } catch (e) {
      console.error('Compras.loadProductos:', e);
    }
  },

  async loadItems() {
    try {
      const { data, error } = await sb
        .from('lista_compra')
        .select('*, productos(nombre, unidad)')
        .order('creado_en', { ascending: false });
      if (error) throw error;
      this.items = data || [];
    } catch (e) {
      console.error('Compras.loadItems:', e);
      document.getElementById('compras-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar la lista</div>';
    }
  },

  filtered() {
    if (this.filtro === 'all') return this.items;
    return this.items.filter(i => i.estado === this.filtro);
  },

  estadoLabel(estado) {
    const map = {
      pendiente: { lbl: 'Pendiente', cls: 'pend' },
      pedido:    { lbl: 'Pedido',    cls: 'pedido' },
      recibido:  { lbl: 'Recibido',  cls: 'recv' },
    };
    return map[estado] || { lbl: estado, cls: 'pend' };
  },

  nombreItem(item) {
    if (item.productos) return item.productos.nombre;
    return item.nombre_libre || '(sin nombre)';
  },

  renderList() {
    const list = this.filtered();
    const el   = document.getElementById('compras-list');

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay ítems en esta categoría</div>';
      return;
    }

    el.innerHTML = list.map(item => {
      const { lbl, cls } = this.estadoLabel(item.estado);
      const nombre = this.nombreItem(item);
      const unidad = item.unidad || (item.productos ? item.productos.unidad : '') || '';
      const qty    = item.cantidad != null ? `${fmtNum(item.cantidad)} ${unidad}` : unidad;

      const esPedido = item.estado === 'pedido';
      return `
        <div class="compra-item" data-id="${item.id}">
          <div class="compra-check-wrap">
            <button class="compra-check compra-check-${cls}" data-id="${item.id}" title="Cambiar estado">
              ${item.estado === 'recibido' ? '✓' : item.estado === 'pedido' ? '→' : '○'}
            </button>
          </div>
          <div class="compra-info">
            <span class="compra-nombre ${item.estado === 'recibido' ? 'tachado' : ''}">${nombre}</span>
            ${esPedido ? `
              <div class="compra-qty-wrap">
                <input class="compra-qty-input" type="number" min="0" step="0.1"
                  value="${item.cantidad != null ? item.cantidad : ''}"
                  placeholder="Cant." data-id="${item.id}" data-unidad="${unidad}" />
                <button class="btn-qty-save" data-id="${item.id}">✓ Guardar</button>
              </div>
            ` : qty ? `<span class="compra-qty">${qty}</span>` : ''}
            ${item.notas ? `<span class="compra-notas">${item.notas}</span>` : ''}
            <span class="compra-meta">Por ${item.empleada} · <span class="badge badge-${cls}">${lbl}</span></span>
          </div>
          <button class="btn btn-sm btn-ghost btn-del-compra" data-id="${item.id}" title="Eliminar">🗑</button>
        </div>
      `;
    }).join('');

    // Bind checks
    el.querySelectorAll('.compra-check').forEach(btn => {
      btn.addEventListener('click', () => this.avanzarEstado(btn.dataset.id));
    });
    el.querySelectorAll('.btn-del-compra').forEach(btn => {
      btn.addEventListener('click', () => this.eliminar(btn.dataset.id));
    });
    // Guardar cantidad editada (solo en estado pedido)
    el.querySelectorAll('.btn-qty-save').forEach(btn => {
      btn.addEventListener('click', () => this.guardarCantidad(btn.dataset.id));
    });
    el.querySelectorAll('.compra-qty-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.guardarCantidad(inp.dataset.id);
      });
    });
  },

  async avanzarEstado(id) {
    const item = this.items.find(i => i.id == id);
    if (!item) return;
    const siguiente = { pendiente: 'pedido', pedido: 'recibido', recibido: 'pendiente' };
    const nuevo = siguiente[item.estado] || 'pendiente';

    try {
      const { error } = await sb.from('lista_compra').update({ estado: nuevo }).eq('id', id);
      if (error) throw error;
      item.estado = nuevo;
      this.renderList();

      // Si recibido, ofrecer actualizar stock automáticamente si hay producto_id
      if (nuevo === 'recibido' && item.producto_id && item.cantidad) {
        if (confirm(`¿Actualizar el stock de "${this.nombreItem(item)}" (+${fmtNum(item.cantidad)} ${item.unidad || ''})?`)) {
          const prod = await sb.from('productos').select('stock_actual').eq('id', item.producto_id).single();
          if (!prod.error && prod.data) {
            const nuevoStock = prod.data.stock_actual + item.cantidad;
            await sb.from('productos').update({ stock_actual: nuevoStock }).eq('id', item.producto_id);
            await sb.from('movimientos').insert({
              producto_id: item.producto_id,
              tipo: 'entrada',
              cantidad: item.cantidad,
              empleada: Estado.getEmpleada(),
              notas: 'Recibido desde lista de compras',
            });
            showToast('Stock actualizado ✓', 'success');
          }
        }
      }
    } catch (e) {
      console.error('avanzarEstado:', e);
      showToast('Error al cambiar estado', 'error');
    }
  },

  async guardarCantidad(id) {
    const inp = document.querySelector(`.compra-qty-input[data-id="${id}"]`);
    if (!inp) return;
    const nueva = parseFloat(inp.value);
    if (isNaN(nueva) || nueva < 0) { showToast('Cantidad no válida', 'error'); return; }
    const unidad = inp.dataset.unidad || '';
    try {
      const { error } = await sb.from('lista_compra').update({ cantidad: nueva }).eq('id', id);
      if (error) throw error;
      const item = this.items.find(i => i.id == id);
      if (item) item.cantidad = nueva;
      showToast(`Cantidad actualizada: ${nueva} ${unidad}`, 'success');
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  },

  async eliminar(id) {
    if (!confirm('¿Eliminar este ítem de la lista?')) return;
    try {
      const { error } = await sb.from('lista_compra').delete().eq('id', id);
      if (error) throw error;
      this.items = this.items.filter(i => i.id != id);
      this.renderList();
      showToast('Ítem eliminado', 'info');
    } catch (e) {
      showToast('Error al eliminar', 'error');
    }
  },

  bindUI() {
    // Filtros de estado
    document.querySelectorAll('#compras-filter-tabs .filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#compras-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filtro = btn.dataset.estado;
        this.renderList();
      });
    });

    // FAB
    document.getElementById('fab-add-compra').onclick = () => this.openModal();

    // Modal compra
    document.getElementById('modal-compra-close').onclick  = () => closeModal('modal-compra-overlay');
    document.getElementById('btn-cancel-compra').onclick   = () => closeModal('modal-compra-overlay');
    document.getElementById('btn-save-compra').onclick     = () => this.saveItem();

    // Cuando se selecciona un producto del inventario, auto-rellenar unidad
    document.getElementById('compra-producto-sel').addEventListener('change', e => {
      const opt = e.target.selectedOptions[0];
      const esManual = !e.target.value;
      document.getElementById('compra-nombre-row').style.display = esManual ? '' : 'none';
      if (!esManual) {
        document.getElementById('compra-unidad').value = opt.dataset.unidad || '';
      }
    });

    // Exportar PDF
    document.getElementById('btn-export-pdf').onclick = () => PdfExport.exportarCompras(this.items);
  },

  openModal() {
    document.getElementById('compra-producto-sel').value = '';
    document.getElementById('compra-nombre-libre').value = '';
    document.getElementById('compra-cantidad').value     = '';
    document.getElementById('compra-unidad').value       = '';
    document.getElementById('compra-notas').value        = '';
    document.getElementById('compra-nombre-row').style.display = '';
    openModal('modal-compra-overlay');
  },

  async saveItem() {
    const prodId    = document.getElementById('compra-producto-sel').value || null;
    const nomLibre  = document.getElementById('compra-nombre-libre').value.trim() || null;
    const cantidad  = parseFloat(document.getElementById('compra-cantidad').value) || null;
    const unidad    = document.getElementById('compra-unidad').value.trim() || null;
    const notas     = document.getElementById('compra-notas').value.trim() || null;
    const empleada  = Estado.getEmpleada();

    if (!prodId && !nomLibre) {
      showToast('Introduce un producto o escribe un nombre', 'error');
      return;
    }

    const btn = document.getElementById('btn-save-compra');
    btn.disabled = true;
    btn.textContent = 'Añadiendo…';

    try {
      const { error } = await sb.from('lista_compra').insert({
        producto_id: prodId ? parseInt(prodId) : null,
        nombre_libre: prodId ? null : nomLibre,
        cantidad,
        unidad,
        empleada,
        notas,
        estado: 'pendiente',
      });
      if (error) throw error;

      showToast('Añadido a la lista ✓', 'success');
      closeModal('modal-compra-overlay');
      await this.load();

    } catch (e) {
      console.error('saveItem:', e);
      showToast('Error: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Añadir';
    }
  }
};
