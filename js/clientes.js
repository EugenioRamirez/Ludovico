// ── clientes.js · Gestión de Clientes B2B ─────────────────────────────────────

const Clientes = {
  lista: [],
  filtro: 'activo',   // 'activo' | 'inactivo' | 'all'
  searchQ: '',

  // ── Carga principal ──────────────────────────────────────────────────────────

  async load() {
    document.getElementById('clientes-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';
    await this.loadClientes();
    this.renderFilterTabs();
    this.renderList();
    this.bindUI();
  },

  async loadClientes() {
    try {
      const { data, error } = await sb
        .from('clientes_b2b')
        .select('*')
        .order('razon_social');
      if (error) throw error;
      this.lista = data || [];
    } catch (e) {
      console.error('Clientes.loadClientes:', e);
      document.getElementById('clientes-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar clientes</div>';
    }
  },

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  filtered() {
    let list = this.lista;
    if (this.filtro === 'activo')   list = list.filter(c => c.activo);
    if (this.filtro === 'inactivo') list = list.filter(c => !c.activo);
    if (this.searchQ) {
      const q = this.searchQ.toLowerCase();
      list = list.filter(c =>
        (c.razon_social || '').toLowerCase().includes(q) ||
        (c.nombre_comercial || '').toLowerCase().includes(q) ||
        (c.nif_cif || '').toLowerCase().includes(q) ||
        (c.contacto_nombre || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  // ── Render pestañas ──────────────────────────────────────────────────────────

  renderFilterTabs() {
    const tabs = document.getElementById('clientes-filter-tabs');
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

  renderList() {
    const list    = this.filtered();
    const el      = document.getElementById('clientes-list');
    const esAdmin = Estado.getEmpleada() === 'Administrador';

    if (!list.length) {
      el.innerHTML = '<div class="empty-msg">No hay clientes</div>';
      document.getElementById('fab-add-cliente').style.display = esAdmin ? 'flex' : 'none';
      return;
    }

    el.innerHTML = list.map(c => {
      const canal = c.canal_comunicacion === 'whatsapp' ? '💬 WhatsApp' : '📧 Email';
      const badge = c.activo
        ? '<span class="badge badge-ok">Activo</span>'
        : '<span class="badge badge-crit">Inactivo</span>';
      return `
        <div class="producto-item cliente-item" data-id="${c.id}">
          <div class="producto-main">
            <div class="producto-info">
              <span class="producto-nombre">
                ${c.nombre_comercial ? escHtml(c.nombre_comercial) : escHtml(c.razon_social)}
              </span>
              <span class="producto-cat">
                ${escHtml(c.razon_social)}
                ${c.nombre_comercial ? `· <span class="producto-prov">${escHtml(c.nif_cif)}</span>` : `· <span class="producto-prov">${escHtml(c.nif_cif)}</span>`}
              </span>
            </div>
            <div class="producto-stock-wrap">
              ${badge}
            </div>
          </div>
          <div class="cliente-meta">
            <span>👤 ${escHtml(c.contacto_nombre)}</span>
            <span>📞 ${escHtml(c.telefono)}</span>
            <span>${canal}</span>
          </div>
          ${esAdmin ? `
          <div class="producto-actions">
            <button class="btn btn-sm btn-outline btn-edit-cliente" data-id="${c.id}" title="Editar cliente">
              ✏️ Editar
            </button>
            <button class="btn btn-sm btn-ghost btn-toggle-cliente" data-id="${c.id}" data-activo="${c.activo}" title="${c.activo ? 'Desactivar' : 'Activar'}">
              ${c.activo ? '🔴 Desactivar' : '🟢 Activar'}
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Bind acciones
    el.querySelectorAll('.btn-edit-cliente').forEach(btn => {
      btn.addEventListener('click', () => this.openModal(btn.dataset.id));
    });
    el.querySelectorAll('.btn-toggle-cliente').forEach(btn => {
      btn.addEventListener('click', () => this.toggleActivo(btn.dataset.id, btn.dataset.activo === 'true'));
    });

    document.getElementById('fab-add-cliente').style.display = esAdmin ? 'flex' : 'none';
  },

  // ── Toggle activo/inactivo ───────────────────────────────────────────────────

  async toggleActivo(id, estaActivo) {
    const cliente = this.lista.find(c => c.id === id);
    const accion  = estaActivo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${cliente?.razon_social}?`)) return;

    try {
      const { error } = await sb
        .from('clientes_b2b')
        .update({ activo: !estaActivo })
        .eq('id', id);
      if (error) throw error;
      showToast(`Cliente ${estaActivo ? 'desactivado' : 'activado'} ✓`, 'success');
      await this.load();
    } catch (e) {
      console.error('toggleActivo:', e);
      showToast('Error: ' + (e.message || e), 'error');
    }
  },

  // ── Modal ────────────────────────────────────────────────────────────────────

  openModal(id) {
    const c = id ? this.lista.find(x => x.id === id) : null;

    document.getElementById('modal-cliente-title').textContent =
      c ? 'Editar Cliente B2B' : 'Nuevo Cliente B2B';
    document.getElementById('cliente-id').value              = c?.id || '';
    document.getElementById('cliente-razon-social').value    = c?.razon_social || '';
    document.getElementById('cliente-nif').value             = c?.nif_cif || '';
    document.getElementById('cliente-dir-fiscal').value      = c?.direccion_fiscal || '';
    document.getElementById('cliente-email-fact').value      = c?.email_facturacion || '';
    document.getElementById('cliente-contacto').value        = c?.contacto_nombre || '';
    document.getElementById('cliente-telefono').value        = c?.telefono || '';
    document.getElementById('cliente-dir-entrega').value     = c?.direccion_entrega || '';
    document.getElementById('cliente-nombre-comercial').value = c?.nombre_comercial || '';
    document.getElementById('cliente-email-op').value        = c?.email_operativo || '';
    document.getElementById('cliente-canal').value           = c?.canal_comunicacion || 'whatsapp';
    document.getElementById('cliente-condiciones').value     = c?.condiciones_pago || '';
    document.getElementById('cliente-observaciones').value   = c?.observaciones || '';
    document.getElementById('cliente-notas-entrega').value   = c?.notas_entrega || '';
    document.getElementById('cliente-ref-aeat').value        = c?.referencia_aeat || '';

    openModal('modal-cliente-overlay');
  },

  // ── Guardar ──────────────────────────────────────────────────────────────────

  async saveCliente() {
    const id = document.getElementById('cliente-id').value.trim();

    // Recoger campos
    const razon_social      = document.getElementById('cliente-razon-social').value.trim();
    const nif_cif           = document.getElementById('cliente-nif').value.trim().toUpperCase();
    const direccion_fiscal  = document.getElementById('cliente-dir-fiscal').value.trim();
    const email_facturacion = document.getElementById('cliente-email-fact').value.trim();
    const contacto_nombre   = document.getElementById('cliente-contacto').value.trim();
    const telefono          = document.getElementById('cliente-telefono').value.trim();
    const direccion_entrega = document.getElementById('cliente-dir-entrega').value.trim() || null;
    const nombre_comercial  = document.getElementById('cliente-nombre-comercial').value.trim() || null;
    const email_operativo   = document.getElementById('cliente-email-op').value.trim() || null;
    const canal_comunicacion = document.getElementById('cliente-canal').value;
    const condiciones_pago  = document.getElementById('cliente-condiciones').value.trim() || null;
    const observaciones     = document.getElementById('cliente-observaciones').value.trim() || null;
    const notas_entrega     = document.getElementById('cliente-notas-entrega').value.trim() || null;
    const referencia_aeat   = document.getElementById('cliente-ref-aeat').value.trim() || null;

    // ── Validaciones obligatorias ──
    if (!razon_social)      { showToast('La razón social es obligatoria', 'error'); return; }
    if (!nif_cif)           { showToast('El NIF/CIF es obligatorio', 'error'); return; }
    if (!direccion_fiscal)  { showToast('La dirección fiscal es obligatoria', 'error'); return; }
    if (!email_facturacion) { showToast('El email de facturación es obligatorio', 'error'); return; }
    if (!contacto_nombre)   { showToast('El nombre de contacto es obligatorio', 'error'); return; }
    if (!telefono)          { showToast('El teléfono es obligatorio', 'error'); return; }

    // ── Validar NIF único (client-side) ──
    const duplicado = this.lista.find(c => c.nif_cif === nif_cif && c.id !== id);
    if (duplicado) {
      showToast(`El NIF/CIF ${nif_cif} ya existe (${duplicado.razon_social})`, 'error');
      return;
    }

    const btn = document.getElementById('btn-save-cliente');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    try {
      const payload = {
        razon_social, nif_cif, direccion_fiscal, email_facturacion,
        contacto_nombre, telefono, direccion_entrega,
        nombre_comercial, email_operativo, canal_comunicacion,
        condiciones_pago, observaciones, notas_entrega, referencia_aeat,
      };

      if (id) {
        // ── Editar ──
        const { error } = await sb.from('clientes_b2b').update(payload).eq('id', id);
        if (error) throw error;
        showToast('Cliente actualizado ✓', 'success');
      } else {
        // ── Nuevo ──
        const { error } = await sb.from('clientes_b2b').insert({
          ...payload,
          activo:     true,
          creado_por: Estado.getEmpleada(),
        });
        // Supabase devuelve error 23505 si el NIF ya existe (constraint)
        if (error) {
          if (error.code === '23505') {
            showToast(`El NIF/CIF ${nif_cif} ya existe en la base de datos`, 'error');
            return;
          }
          throw error;
        }
        showToast('Cliente añadido ✓', 'success');
      }

      closeModal('modal-cliente-overlay');
      await this.load();

    } catch (e) {
      console.error('saveCliente:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Guardar';
    }
  },

  // ── Bind UI ──────────────────────────────────────────────────────────────────

  bindUI() {
    // Búsqueda
    const search = document.getElementById('clientes-search');
    search.addEventListener('input', () => {
      this.searchQ = search.value.trim();
      this.renderList();
    });

    // FAB
    document.getElementById('fab-add-cliente').onclick = () => this.openModal(null);

    // Modal botones
    document.getElementById('modal-cliente-close').onclick    = () => closeModal('modal-cliente-overlay');
    document.getElementById('btn-cancel-cliente').onclick     = () => closeModal('modal-cliente-overlay');
    document.getElementById('btn-save-cliente').onclick       = () => this.saveCliente();
  },
};

// ── Helper: escapar HTML ──────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
