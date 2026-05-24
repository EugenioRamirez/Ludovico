// ── sabores.js · Mantenimiento de Sabores B2B ─────────────────────────────────

const Sabores = {
  lista:   [],
  filtro:  'activo',   // 'activo' | 'inactivo' | 'all'
  searchQ: '',

  // ── Carga ────────────────────────────────────────────────────────────────────

  async load() {
    document.getElementById('sabores-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await this.loadSabores();
    this.renderFilterTabs();
    this.renderList();
    this.bindUI();
  },

  async loadSabores() {
    try {
      const { data, error } = await sb
        .from('sabores_b2b')
        .select('*')
        .order('orden_visualizacion')
        .order('nombre');
      if (error) throw error;
      this.lista = data || [];
    } catch (e) {
      console.error('Sabores.loadSabores:', e);
      document.getElementById('sabores-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar sabores</div>';
    }
  },

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  filtered() {
    let list = this.lista;
    if (this.filtro === 'activo')   list = list.filter(s => s.activo);
    if (this.filtro === 'inactivo') list = list.filter(s => !s.activo);
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(s => (s.nombre || '').toLowerCase().includes(q));
    }
    return list;
  },

  // ── Render pestañas ──────────────────────────────────────────────────────────

  renderFilterTabs() {
    const tabs = document.getElementById('sabores-filter-tabs');
    const opciones = [
      { val: 'activo',   label: 'Activos' },
      { val: 'inactivo', label: 'Inactivos' },
      { val: 'all',      label: 'Todos' },
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

  CAT_LABELS: { estandar: 'Estándar', especial: 'Especial', premium: 'Premium' },
  CAT_COLORS: { estandar: 'badge-ok', especial: 'badge-pend', premium: 'badge-pedido' },

  renderList() {
    const list    = this.filtered();
    const el      = document.getElementById('sabores-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay sabores</div>';
      document.getElementById('fab-add-sabor').style.display = esAdmin ? 'flex' : 'none';
      return;
    }

    el.innerHTML = list.map(s => {
      const catLabel  = this.CAT_LABELS[s.categoria] || s.categoria || '';
      const catBadge  = this.CAT_COLORS[s.categoria]  || 'badge-ok';
      const estadoBadge = s.activo
        ? '<span class="badge badge-ok">Activo</span>'
        : '<span class="badge badge-crit">Inactivo</span>';
      const b2bBadge = s.visible_b2b
        ? '<span class="badge badge-pedido">B2B ✓</span>'
        : '<span class="badge" style="background:#eee;color:#999">B2B ✗</span>';

      return `
        <div class="producto-item" data-id="${s.id}">
          <div class="producto-main">
            <div class="producto-info">
              <span class="producto-nombre">${escHtml(s.nombre)}</span>
              <span class="producto-cat">
                ${catLabel ? `<span class="badge ${catBadge}" style="font-size:10px;padding:2px 7px">${catLabel}</span>` : ''}
                ${s.precio_litro ? `· <span class="producto-prov">${parseFloat(s.precio_litro).toFixed(2)} €/L</span>` : ''}
              </span>
            </div>
            <div class="producto-stock-wrap" style="gap:5px;flex-direction:column;align-items:flex-end">
              ${estadoBadge}
              ${b2bBadge}
            </div>
          </div>
          ${s.descripcion ? `<div class="cliente-meta" style="margin-top:4px">${escHtml(s.descripcion)}</div>` : ''}
          ${esAdmin ? `
          <div class="producto-actions">
            <button class="btn btn-sm btn-outline btn-edit-sabor" data-id="${s.id}">✏️ Editar</button>
            <button class="btn btn-sm btn-ghost btn-toggle-sabor" data-id="${s.id}" data-activo="${s.activo}">
              ${s.activo ? '🔴 Desactivar' : '🟢 Activar'}
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-edit-sabor').forEach(btn => {
      btn.addEventListener('click', () => this.openModal(btn.dataset.id));
    });
    el.querySelectorAll('.btn-toggle-sabor').forEach(btn => {
      btn.addEventListener('click', () => this.toggleActivo(btn.dataset.id, btn.dataset.activo === 'true'));
    });

    document.getElementById('fab-add-sabor').style.display = esAdmin ? 'flex' : 'none';
  },

  // ── Toggle activo ────────────────────────────────────────────────────────────

  async toggleActivo(id, estaActivo) {
    const sabor  = this.lista.find(s => s.id === id);
    const accion = estaActivo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} "${sabor?.nombre}"?`)) return;

    try {
      const { error } = await sb
        .from('sabores_b2b')
        .update({ activo: !estaActivo, modificado_por: Estado.getEmpleada() })
        .eq('id', id);
      if (error) throw error;
      showToast(`Sabor ${estaActivo ? 'desactivado' : 'activado'} ✓`, 'success');
      await this.load();
    } catch (e) {
      console.error('Sabores.toggleActivo:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Modal ────────────────────────────────────────────────────────────────────

  openModal(id) {
    const s = id ? this.lista.find(x => x.id === id) : null;

    document.getElementById('modal-sabor-title').textContent = s ? 'Editar Sabor' : 'Nuevo Sabor';
    document.getElementById('sabor-id').value             = s?.id || '';
    document.getElementById('sabor-nombre').value         = s?.nombre || '';
    document.getElementById('sabor-categoria').value      = s?.categoria || 'estandar';
    document.getElementById('sabor-precio').value         = s?.precio_litro || '';
    document.getElementById('sabor-orden').value          = s?.orden_visualizacion ?? '';
    document.getElementById('sabor-descripcion').value    = s?.descripcion || '';
    document.getElementById('sabor-observaciones').value  = s?.observaciones || '';
    document.getElementById('sabor-visible-b2b').checked  = s ? s.visible_b2b : true;
    document.getElementById('sabor-activo').checked       = s ? s.activo : true;

    openModal('modal-sabor-overlay');
  },

  // ── Guardar ──────────────────────────────────────────────────────────────────

  async saveSabor() {
    const id          = document.getElementById('sabor-id').value.trim();
    const nombre      = document.getElementById('sabor-nombre').value.trim();
    const categoria   = document.getElementById('sabor-categoria').value;
    const precio_litro = parseFloat(document.getElementById('sabor-precio').value) || null;
    const orden_visualizacion = parseInt(document.getElementById('sabor-orden').value) || 0;
    const descripcion    = document.getElementById('sabor-descripcion').value.trim() || null;
    const observaciones  = document.getElementById('sabor-observaciones').value.trim() || null;
    const visible_b2b    = document.getElementById('sabor-visible-b2b').checked;
    const activo         = document.getElementById('sabor-activo').checked;

    // Validaciones
    if (!nombre) { showToast('El nombre del sabor es obligatorio', 'error'); return; }

    // Duplicado nombre (client-side)
    const duplicado = this.lista.find(s => s.nombre.toLowerCase() === nombre.toLowerCase() && s.id !== id);
    if (duplicado) {
      showToast(`Ya existe un sabor llamado "${nombre}"`, 'error');
      return;
    }

    const btn = document.getElementById('btn-save-sabor');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    const empleada = Estado.getEmpleada();

    try {
      const payload = {
        nombre, categoria, precio_litro, orden_visualizacion,
        descripcion, observaciones, visible_b2b, activo,
        modificado_por: empleada,
      };

      if (id) {
        const { error } = await sb.from('sabores_b2b').update(payload).eq('id', id);
        if (error) throw error;
        showToast('Sabor actualizado ✓', 'success');
      } else {
        const { error } = await sb.from('sabores_b2b').insert({
          ...payload,
          creado_por: empleada,
        });
        if (error) {
          if (error.code === '23505') {
            showToast(`Ya existe un sabor con ese nombre`, 'error');
            return;
          }
          throw error;
        }
        showToast('Sabor creado ✓', 'success');
      }

      closeModal('modal-sabor-overlay');
      await this.load();

    } catch (e) {
      console.error('Sabores.saveSabor:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
  },

  // ── Bind UI ──────────────────────────────────────────────────────────────────

  bindUI() {
    const search = document.getElementById('sabores-search');
    search.addEventListener('input', () => {
      this.searchQ = search.value.trim();
      this.renderList();
    });

    document.getElementById('fab-add-sabor').onclick         = () => this.openModal(null);
    document.getElementById('modal-sabor-close').onclick     = () => closeModal('modal-sabor-overlay');
    document.getElementById('btn-cancel-sabor').onclick      = () => closeModal('modal-sabor-overlay');
    document.getElementById('btn-save-sabor').onclick        = () => this.saveSabor();
  },

  // ── Util: devuelve lista de sabores activos y visibles en B2B ────────────────
  // (para usar desde el módulo de pedidos en el futuro)
  activosB2B() {
    return this.lista.filter(s => s.activo && s.visible_b2b);
  },
};
