// ── inventario.js ─────────────────────────────────────────────────────────────

const Inventario = {
  productos: [],
  categorias: [],
  catFiltro: 'all',
  searchQ: '',

  async load() {
    document.getElementById('inv-list').innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await Promise.all([this.loadCategorias(), this.loadProductos()]);
    this.renderCatTabs();
    this.renderList();
    this.bindUI();
  },

  async loadCategorias() {
    try {
      const { data, error } = await sb.from('categorias').select('*').order('nombre');
      if (error) throw error;
      this.categorias = data || [];
      // también llenar el select del modal de producto
      const sel = document.getElementById('prod-categoria');
      sel.innerHTML = '<option value="">– Sin categoría –</option>';
      this.categorias.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
      });
    } catch (e) {
      console.error('Inventario.loadCategorias:', e);
    }
  },

  async loadProductos() {
    try {
      const { data, error } = await sb
        .from('productos')
        .select('*, categorias(nombre)')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      this.productos = data || [];
    } catch (e) {
      console.error('Inventario.loadProductos:', e);
      document.getElementById('inv-list').innerHTML = '<div class="empty-msg error-msg">Error al cargar productos</div>';
    }
  },

  renderCatTabs() {
    const container = document.getElementById('inv-cat-tabs');
    // Obtener categorías presentes en los productos cargados
    const catIds = [...new Set(this.productos.map(p => p.categoria_id).filter(Boolean))];
    const cats   = this.categorias.filter(c => catIds.includes(c.id));

    container.innerHTML = `<button class="filter-tab ${this.catFiltro === 'all' ? 'active' : ''}" data-cat="all">Todos</button>`;
    cats.forEach(c => {
      container.innerHTML += `<button class="filter-tab ${this.catFiltro == c.id ? 'active' : ''}" data-cat="${c.id}">${c.nombre}</button>`;
    });

    container.querySelectorAll('.filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.catFiltro = btn.dataset.cat;
        container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderList();
      });
    });
  },

  filtered() {
    let list = this.productos;
    if (this.catFiltro !== 'all') {
      list = list.filter(p => p.categoria_id == this.catFiltro);
    }
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(p => p.nombre.toLowerCase().includes(q));
    }
    return list;
  },

  stockClass(p) {
    if (p.stock_actual <= 0) return 'crit';
    if (p.stock_minimo > 0 && p.stock_actual < p.stock_minimo) return 'low';
    return 'ok';
  },

  stockBarPct(p) {
    if (!p.stock_minimo) return 100;
    const pct = Math.min((p.stock_actual / (p.stock_minimo * 2)) * 100, 100);
    return Math.max(pct, 0);
  },

  renderList() {
    const list = this.filtered();
    const el   = document.getElementById('inv-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay productos</div>';
      return;
    }

    el.innerHTML = list.map(p => {
      const cls  = this.stockClass(p);
      const pct  = this.stockBarPct(p);
      const cat  = p.categorias ? p.categorias.nombre : '';
      return `
        <div class="producto-item" data-id="${p.id}">
          <div class="producto-main">
            <div class="producto-info">
              <span class="producto-nombre">${p.nombre}</span>
              ${cat ? `<span class="producto-cat">${cat}</span>` : ''}
            </div>
            <div class="producto-stock-wrap">
              <span class="badge badge-${cls}">
                ${fmtNum(p.stock_actual)} ${p.unidad}
              </span>
              ${p.stock_minimo > 0 ? `<span class="stock-min-lbl">mín ${fmtNum(p.stock_minimo)}</span>` : ''}
            </div>
          </div>
          <div class="stock-bar">
            <div class="stock-fill stock-fill-${cls}" style="width:${pct}%"></div>
          </div>
          <div class="producto-actions">
            <button class="btn btn-sm btn-outline btn-stock" data-id="${p.id}" title="Ajustar stock">
              ± Stock
            </button>
            ${esAdmin ? `<button class="btn btn-sm btn-ghost btn-edit-prod" data-id="${p.id}" title="Editar">✏️</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Bind botones
    el.querySelectorAll('.btn-stock').forEach(btn => {
      btn.addEventListener('click', () => this.openStockModal(btn.dataset.id));
    });
    el.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', () => this.openProductoModal(btn.dataset.id));
    });

    // FAB solo para admin
    document.getElementById('fab-add-producto').style.display = esAdmin ? 'flex' : 'none';
  },

  bindUI() {
    // Búsqueda
    const search = document.getElementById('inv-search');
    search.addEventListener('input', () => {
      this.searchQ = search.value.trim();
      this.renderList();
    });

    // FAB añadir
    document.getElementById('fab-add-producto').onclick = () => this.openProductoModal(null);

    // Modal producto – botones
    document.getElementById('modal-producto-close').onclick  = () => closeModal('modal-producto-overlay');
    document.getElementById('btn-cancel-producto').onclick   = () => closeModal('modal-producto-overlay');
    document.getElementById('btn-save-producto').onclick     = () => this.saveProducto();

    // Modal stock – botones
    document.getElementById('modal-stock-close').onclick = () => closeModal('modal-stock-overlay');
    document.getElementById('btn-cancel-stock').onclick  = () => closeModal('modal-stock-overlay');
    document.getElementById('btn-save-stock').onclick    = () => this.saveStock();

    // Toggle tipo movimiento
    document.getElementById('stock-tipo-group').querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#stock-tipo-group .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const isAjuste = btn.dataset.val === 'ajuste';
        document.getElementById('stock-cantidad').parentElement.style.display   = isAjuste ? 'none' : '';
        document.getElementById('stock-ajuste-row').style.display               = isAjuste ? '' : 'none';
      });
    });
  },

  openProductoModal(id) {
    const modal = document.getElementById('modal-producto-overlay');
    const prod  = id ? this.productos.find(p => p.id == id) : null;

    document.getElementById('modal-producto-title').textContent = prod ? 'Editar Producto' : 'Añadir Producto';
    document.getElementById('prod-id').value          = prod ? prod.id : '';
    document.getElementById('prod-nombre').value      = prod ? prod.nombre : '';
    document.getElementById('prod-categoria').value   = prod ? (prod.categoria_id || '') : '';
    document.getElementById('prod-unidad').value      = prod ? prod.unidad : 'kg';
    document.getElementById('prod-stock-min').value   = prod ? prod.stock_minimo : '';
    document.getElementById('prod-notas').value       = prod ? (prod.notas || '') : '';

    openModal('modal-producto-overlay');
  },

  async saveProducto() {
    const id       = document.getElementById('prod-id').value;
    const nombre   = document.getElementById('prod-nombre').value.trim();
    const catId    = document.getElementById('prod-categoria').value || null;
    const unidad   = document.getElementById('prod-unidad').value;
    const stockMin = parseFloat(document.getElementById('prod-stock-min').value) || 0;
    const notas    = document.getElementById('prod-notas').value.trim() || null;

    if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }

    const btn = document.getElementById('btn-save-producto');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
      const payload = { nombre, categoria_id: catId, unidad, stock_minimo: stockMin, notas };

      if (id) {
        const { error } = await sb.from('productos').update(payload).eq('id', id);
        if (error) throw error;
        showToast('Producto actualizado ✓', 'success');
      } else {
        const { error } = await sb.from('productos').insert({ ...payload, stock_actual: 0 });
        if (error) throw error;
        showToast('Producto añadido ✓', 'success');
      }

      closeModal('modal-producto-overlay');
      await this.load();

    } catch (e) {
      console.error('saveProducto:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  },

  openStockModal(id) {
    const prod = this.productos.find(p => p.id == id);
    if (!prod) return;

    document.getElementById('stock-prod-id').value  = prod.id;
    document.getElementById('modal-stock-title').textContent = `Stock · ${prod.nombre}`;
    document.getElementById('stock-prod-info').textContent =
      `Stock actual: ${fmtNum(prod.stock_actual)} ${prod.unidad}  ·  Mínimo: ${fmtNum(prod.stock_minimo)} ${prod.unidad}`;
    document.getElementById('stock-cantidad').value      = '';
    document.getElementById('stock-nuevo-total').value   = '';
    document.getElementById('stock-notas').value         = '';

    // Reset toggle to entrada
    document.querySelectorAll('#stock-tipo-group .toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#stock-tipo-group .toggle-btn[data-val="entrada"]').classList.add('active');
    document.getElementById('stock-cantidad').parentElement.style.display = '';
    document.getElementById('stock-ajuste-row').style.display = 'none';

    openModal('modal-stock-overlay');
  },

  async saveStock() {
    const id     = document.getElementById('stock-prod-id').value;
    const prod   = this.productos.find(p => p.id == id);
    const tipo   = document.querySelector('#stock-tipo-group .toggle-btn.active')?.dataset.val || 'entrada';
    const notas  = document.getElementById('stock-notas').value.trim() || null;
    const empleada = Estado.getEmpleada();

    let cantidad, nuevoStock;

    if (tipo === 'ajuste') {
      nuevoStock = parseFloat(document.getElementById('stock-nuevo-total').value);
      if (isNaN(nuevoStock) || nuevoStock < 0) { showToast('Introduce el nuevo total', 'error'); return; }
      cantidad = nuevoStock - prod.stock_actual;
    } else {
      cantidad = parseFloat(document.getElementById('stock-cantidad').value);
      if (isNaN(cantidad) || cantidad <= 0) { showToast('Introduce una cantidad > 0', 'error'); return; }
      nuevoStock = tipo === 'entrada'
        ? prod.stock_actual + cantidad
        : Math.max(prod.stock_actual - cantidad, 0);
    }

    const btn = document.getElementById('btn-save-stock');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
      // Actualizar stock en productos
      const { error: e1 } = await sb
        .from('productos')
        .update({ stock_actual: nuevoStock })
        .eq('id', id);
      if (e1) throw e1;

      // Registrar movimiento
      const { error: e2 } = await sb.from('movimientos').insert({
        producto_id: parseInt(id),
        tipo,
        cantidad: Math.abs(cantidad),
        empleada,
        notas,
      });
      if (e2) throw e2;

      showToast('Stock actualizado ✓', 'success');
      closeModal('modal-stock-overlay');
      await this.load();

    } catch (e) {
      console.error('saveStock:', e);
      showToast('Error: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
};
