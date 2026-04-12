// ── conteo.js · Conteo Semanal ────────────────────────────────────────────────

const Conteo = {
  productos: [],

  async load() {
    document.getElementById('conteo-list').innerHTML =
      '<div class="spinner-wrap"><div class="spinner"></div></div>';

    // Fecha de hoy
    const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('conteo-fecha-val').textContent = hoy;

    try {
      const { data, error } = await sb
        .from('productos')
        .select('*, categorias(nombre)')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      this.productos = data || [];
      this.renderForm();
      this.bindUI();
    } catch (e) {
      console.error('Conteo.load:', e);
      document.getElementById('conteo-list').innerHTML =
        '<div class="empty-msg error-msg">Error al cargar productos</div>';
    }
  },

  renderForm() {
    const el = document.getElementById('conteo-list');
    if (!this.productos.length) {
      el.innerHTML = '<div class="empty-msg">No hay productos en el inventario todavía</div>';
      return;
    }

    // Agrupar por categoría
    const grupos = {};
    this.productos.forEach(p => {
      const cat = p.categorias ? p.categorias.nombre : 'Sin categoría';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(p);
    });

    el.innerHTML = Object.entries(grupos).map(([cat, prods]) => `
      <div class="conteo-grupo">
        <div class="conteo-cat-title">${cat}</div>
        ${prods.map(p => `
          <div class="conteo-item" data-id="${p.id}">
            <div class="conteo-item-info">
              <span class="conteo-nombre">${p.nombre}</span>
              <span class="conteo-actual">Actual: <strong>${fmtNum(p.stock_actual)} ${p.unidad}</strong></span>
            </div>
            <div class="conteo-input-wrap">
              <input
                type="number"
                class="conteo-input"
                data-id="${p.id}"
                data-unidad="${p.unidad}"
                data-anterior="${p.stock_actual}"
                min="0"
                step="0.1"
                placeholder="–"
              />
              <span class="conteo-unidad">${p.unidad}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  bindUI() {
    document.getElementById('btn-guardar-conteo').onclick = () => this.guardar();

    // FAB: abrir modal de producto (reutiliza el de Inventario)
    const fab = document.getElementById('fab-add-desde-conteo');
    if (fab) {
      fab.onclick = () => {
        // Asegurarnos de que las categorías estén cargadas
        if (!Inventario.categorias.length) Inventario.loadCategorias();
        Inventario.openProductoModal(null);
        // Al guardar, recargar conteo
        const btnSave = document.getElementById('btn-save-producto');
        const originalSave = btnSave.onclick;
        btnSave.onclick = async () => {
          await Inventario.saveProducto();
          await Conteo.load();
        };
      };
    }
  },

  async guardar() {
    const empleada = Estado.getEmpleada();
    const inputs   = document.querySelectorAll('.conteo-input');
    const cambios  = [];

    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val === '') return;           // no tocado → ignorar
      const nuevo   = parseFloat(val);
      if (isNaN(nuevo) || nuevo < 0) return;
      const anterior = parseFloat(inp.dataset.anterior);
      cambios.push({
        id:       parseInt(inp.dataset.id),
        nuevo,
        anterior,
        diferencia: nuevo - anterior,
      });
    });

    if (!cambios.length) {
      showToast('No has introducido ningún valor', 'info');
      return;
    }

    const btn = document.getElementById('btn-guardar-conteo');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
      // Actualizar stock + registrar movimiento para cada cambio
      for (const c of cambios) {
        const { error: e1 } = await sb
          .from('productos')
          .update({ stock_actual: c.nuevo })
          .eq('id', c.id);
        if (e1) throw e1;

        const { error: e2 } = await sb.from('movimientos').insert({
          producto_id: c.id,
          tipo:        'ajuste',
          cantidad:    Math.abs(c.diferencia),
          empleada,
          notas:       `Conteo semanal · anterior: ${fmtNum(c.anterior)}`,
        });
        if (e2) throw e2;
      }

      showToast(`✅ ${cambios.length} producto${cambios.length !== 1 ? 's' : ''} actualizado${cambios.length !== 1 ? 's' : ''}`, 'success');

      // Recargar formulario con nuevos valores
      await this.load();

    } catch (e) {
      console.error('Conteo.guardar:', e);
      showToast('Error al guardar: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar todo';
    }
  }
};
