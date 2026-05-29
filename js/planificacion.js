// ── planificacion.js · Planificación de Producción ───────────────────────────
// Usa el array global RECETAS (calculadora.js) y BASE_LITROS = 2.5

const PLAN_ESTADOS_BLOQUEADOS = ['cerrada'];

const Planificacion = {
  lista: [],
  _editandoId: null,
  _filaCount: 0,

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _fmtKg(g) {
    if (g === null || g === undefined) return '—';
    if (g >= 1000) return (g / 1000).toFixed(2).replace('.', ',') + ' kg';
    return Math.round(g) + ' g';
  },

  _recetaNombres() {
    return RECETAS.map(r => r.nombre).sort();
  },

  _findReceta(nombre) {
    return RECETAS.find(r => r.nombre === nombre) || null;
  },

  _calcLinea(receta, litros) {
    const factor = litros / BASE_LITROS;
    const ings = receta.ingredientes.map(([nombre, g]) => ({
      nombre,
      cantidad_g: g !== null && g !== undefined ? g * factor : null,
    }));
    return { factor, ings };
  },

  _consolidar(lineasCalc) {
    const mapa = {};
    lineasCalc.forEach(lc => {
      if (!lc.ings) return;
      lc.ings.forEach(ing => {
        if (ing.cantidad_g === null) return;
        const key = ing.nombre.trim().toLowerCase();
        if (!mapa[key]) mapa[key] = { nombre: ing.nombre, total_g: 0 };
        mapa[key].total_g += ing.cantidad_g;
      });
    });
    return Object.values(mapa).sort((a, b) => b.total_g - a.total_g);
  },

  _estadoBadge(estado) {
    const cfg = {
      borrador:  { cls: 'badge-pendiente', txt: '✏️ Borrador' },
      calculada: { cls: 'badge-revisada',  txt: '🧮 Calculada' },
      cerrada:   { cls: 'badge-facturada', txt: '🔒 Cerrada' },
    };
    const c = cfg[estado] || { cls: '', txt: estado };
    return `<span class="badge ${c.cls}">${c.txt}</span>`;
  },

  // ── Carga principal ───────────────────────────────────────────────────────────

  async load() {
    // Bind filtros (solo una vez)
    if (!this._filtrosBound) {
      document.querySelectorAll('.plan-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.plan-filtro').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderList();
        });
      });
      this._filtrosBound = true;
    }

    const el = document.getElementById('plan-list');
    el.innerHTML = '<div class="spinner-wrap" style="padding:24px"><div class="spinner"></div></div>';

    const { data, error } = await sb
      .from('planificaciones_produccion')
      .select('*')
      .order('fecha_planificacion', { ascending: false });

    if (error) {
      el.innerHTML = '<div class="empty-msg error-msg">Error al cargar planificaciones</div>';
      console.error('Planificacion.load:', error);
      return;
    }

    this.lista = data || [];
    this.renderList();
  },

  renderList() {
    const el = document.getElementById('plan-list');

    // Filtro activo
    const filtro = document.querySelector('.plan-filtro.active')?.dataset.estado || 'todos';

    const filtradas = filtro === 'todos'
      ? this.lista
      : this.lista.filter(p => p.estado === filtro);

    if (!filtradas.length) {
      el.innerHTML = '<div class="empty-msg">No hay planificaciones' + (filtro !== 'todos' ? ' con este estado' : '') + '</div>';
      return;
    }

    el.innerHTML = filtradas.map(p => {
      const nombre = p.nombre || `Planificación ${fmtFecha(p.fecha_planificacion)}`;
      const fObj   = p.fecha_objetivo ? ` → objetivo: ${fmtFecha(p.fecha_objetivo)}` : '';
      return `
        <div class="acord-item" id="plan-item-${p.id}">
          <div class="acord-summary" data-id="${p.id}">
            <div class="plan-acord-left">
              <span class="plan-acord-nombre">${escHtml(nombre)}</span>
              <span class="plan-acord-meta">${fmtFecha(p.fecha_planificacion)}${escHtml(fObj)}</span>
            </div>
            <div class="plan-acord-right">
              ${this._estadoBadge(p.estado)}
            </div>
          </div>
          <div class="acord-detail hidden" id="plan-detail-${p.id}"></div>
        </div>`;
    }).join('');

    el.querySelectorAll('.acord-summary[data-id]').forEach(row => {
      row.addEventListener('click', () => this._toggleDetalle(row.dataset.id));
    });
  },

  // ── Detalle acordeón ─────────────────────────────────────────────────────────

  async _toggleDetalle(id) {
    const detail = document.getElementById(`plan-detail-${id}`);
    if (!detail.classList.contains('hidden')) {
      detail.classList.add('hidden');
      return;
    }
    detail.innerHTML = '<div class="spinner-wrap" style="padding:16px"><div class="spinner"></div></div>';
    detail.classList.remove('hidden');
    await this._renderDetalle(id);
  },

  async _renderDetalle(id) {
    const detail = document.getElementById(`plan-detail-${id}`);
    const plan   = this.lista.find(p => p.id === id);
    if (!plan) { detail.innerHTML = '<div class="error-msg">Plan no encontrado</div>'; return; }

    const { data: lineas, error } = await sb
      .from('planificacion_lineas')
      .select('*')
      .eq('planificacion_id', id)
      .order('created_at');

    if (error) {
      detail.innerHTML = '<div class="empty-msg error-msg">Error al cargar líneas</div>';
      return;
    }

    if (!lineas || !lineas.length) {
      detail.innerHTML = `
        <div class="plan-detail-body">
          <div class="empty-msg">Sin sabores en esta planificación</div>
          ${this._renderAcciones(plan)}
        </div>`;
      return;
    }

    // Calcular por línea
    const lineasCalc = lineas.map(l => {
      const receta = this._findReceta(l.receta_nombre);
      if (!receta) return { ...l, recetaError: true };
      const { factor, ings } = this._calcLinea(receta, parseFloat(l.litros_solicitados));
      return { ...l, receta, factor, ings };
    });

    const consolidado = this._consolidar(lineasCalc.filter(l => !l.recetaError));

    let html = '<div class="plan-detail-body">';

    // Observaciones
    if (plan.observaciones) {
      html += `<div class="plan-obs">💬 ${escHtml(plan.observaciones)}</div>`;
    }

    // Por sabor
    html += '<div class="plan-sabores">';
    lineasCalc.forEach(l => {
      if (l.recetaError) {
        html += `<div class="plan-linea-error">⚠️ Receta "${escHtml(l.receta_nombre)}" no encontrada en el sistema</div>`;
        return;
      }
      html += `
        <div class="plan-linea-block">
          <div class="plan-linea-header">
            <span class="plan-linea-nombre">${escHtml(l.receta_nombre)}</span>
            <span class="plan-linea-meta">${fmtNum(l.litros_solicitados)} L · ×${l.factor.toFixed(2)}</span>
          </div>
          <table class="plan-ing-table">
            <tbody>
              ${l.ings.map(ing => `
                <tr>
                  <td>${escHtml(ing.nombre)}</td>
                  <td class="plan-ing-qty">${this._fmtKg(ing.cantidad_g)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    });
    html += '</div>';

    // Consolidado (solo si hay 2+ sabores o 1 sabor con ingredientes)
    if (consolidado.length) {
      const totalG = consolidado.reduce((s, c) => s + c.total_g, 0);
      html += `
        <div class="plan-consolidated">
          <div class="plan-consolidated-title">📊 Ingredientes consolidados totales</div>
          <table class="plan-ing-table plan-ing-table-full">
            <thead>
              <tr><th>Ingrediente</th><th class="plan-ing-qty">Cantidad total</th></tr>
            </thead>
            <tbody>
              ${consolidado.map(c => `
                <tr>
                  <td>${escHtml(c.nombre)}</td>
                  <td class="plan-ing-qty plan-ing-qty-total">${this._fmtKg(c.total_g)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total masa</strong></td>
                <td class="plan-ing-qty"><strong>${this._fmtKg(totalG)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }

    html += this._renderAcciones(plan);
    html += '</div>';

    detail.innerHTML = html;
  },

  _renderAcciones(plan) {
    if (plan.estado === 'cerrada') {
      return `<div class="plan-detail-actions"><span class="plan-cerrada-msg">🔒 Planificación cerrada — solo lectura</span></div>`;
    }
    return `
      <div class="plan-detail-actions">
        <button class="btn btn-sm btn-ghost" onclick="Planificacion.abrirModalEditar('${plan.id}')">✏️ Editar</button>
        ${plan.estado === 'borrador'
          ? `<button class="btn btn-sm btn-secondary" onclick="Planificacion.marcarCalculada('${plan.id}')">🧮 Marcar como calculada</button>`
          : ''}
        <button class="btn btn-sm btn-danger-outline" onclick="Planificacion.cerrar('${plan.id}')">🔒 Cerrar planificación</button>
      </div>`;
  },

  // ── Cambios de estado ─────────────────────────────────────────────────────────

  async marcarCalculada(id) {
    const { error } = await sb
      .from('planificaciones_produccion')
      .update({ estado: 'calculada' })
      .eq('id', id);
    if (error) { showToast('Error al actualizar estado', 'error'); return; }
    showToast('Planificación marcada como calculada', 'success');
    await this.load();
    this._toggleDetalle(id); // reabrir
  },

  async cerrar(id) {
    if (!confirm('¿Cerrar esta planificación? No podrá modificarse.')) return;
    const { error } = await sb
      .from('planificaciones_produccion')
      .update({ estado: 'cerrada' })
      .eq('id', id);
    if (error) { showToast('Error al cerrar', 'error'); return; }
    showToast('Planificación cerrada', 'info');
    await this.load();
    this._toggleDetalle(id);
  },

  // ── Modal crear / editar ──────────────────────────────────────────────────────

  abrirModalNueva() {
    this._editandoId = null;
    this._filaCount = 0;
    document.getElementById('plan-modal-titulo').textContent = 'Nueva planificación';
    document.getElementById('plan-modal-nombre').value = '';
    document.getElementById('plan-modal-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('plan-modal-fecha-obj').value = '';
    document.getElementById('plan-modal-obs').value = '';
    document.getElementById('plan-modal-error').textContent = '';
    document.getElementById('plan-filas-body').innerHTML = '';
    this._agregarFila();
    openModal('modal-plan-overlay');
  },

  async abrirModalEditar(id) {
    const plan = this.lista.find(p => p.id === id);
    if (!plan || PLAN_ESTADOS_BLOQUEADOS.includes(plan.estado)) {
      showToast('Esta planificación no puede editarse', 'error');
      return;
    }
    this._editandoId = id;
    this._filaCount = 0;
    document.getElementById('plan-modal-titulo').textContent = 'Editar planificación';
    document.getElementById('plan-modal-nombre').value = plan.nombre || '';
    document.getElementById('plan-modal-fecha').value = plan.fecha_planificacion || '';
    document.getElementById('plan-modal-fecha-obj').value = plan.fecha_objetivo || '';
    document.getElementById('plan-modal-obs').value = plan.observaciones || '';
    document.getElementById('plan-modal-error').textContent = '';
    document.getElementById('plan-filas-body').innerHTML = '';

    const { data: lineas } = await sb
      .from('planificacion_lineas')
      .select('*')
      .eq('planificacion_id', id)
      .order('created_at');

    if (lineas && lineas.length) {
      lineas.forEach(l => this._agregarFila(l.receta_nombre, l.litros_solicitados));
    } else {
      this._agregarFila();
    }
    openModal('modal-plan-overlay');
  },

  _agregarFila(recetaNombre = '', litros = '') {
    const n = ++this._filaCount;
    const nombres = this._recetaNombres();
    const options = nombres.map(nm =>
      `<option value="${escHtml(nm)}" ${nm === recetaNombre ? 'selected' : ''}>${escHtml(nm)}</option>`
    ).join('');

    const fila = document.createElement('div');
    fila.className = 'plan-fila';
    fila.id = `plan-fila-${n}`;
    fila.innerHTML = `
      <select class="plan-fila-sabor" id="plan-sabor-${n}">
        <option value="">— Selecciona sabor —</option>
        ${options}
      </select>
      <input type="number" class="plan-fila-litros" id="plan-litros-${n}"
        placeholder="Litros" min="0.1" step="0.5"
        value="${litros}" style="width:90px">
      <button type="button" class="btn-plan-del-fila" onclick="Planificacion._eliminarFila(${n})" title="Eliminar fila">✕</button>`;

    document.getElementById('plan-filas-body').appendChild(fila);
  },

  _eliminarFila(n) {
    const el = document.getElementById(`plan-fila-${n}`);
    if (el) el.remove();
  },

  async guardar() {
    const empleada = Estado.getEmpleada();
    const nombre   = document.getElementById('plan-modal-nombre').value.trim();
    const fecha    = document.getElementById('plan-modal-fecha').value;
    const fechaObj = document.getElementById('plan-modal-fecha-obj').value;
    const obs      = document.getElementById('plan-modal-obs').value.trim();
    const errEl    = document.getElementById('plan-modal-error');

    if (!fecha) { errEl.textContent = 'La fecha de planificación es obligatoria.'; return; }

    // Recoger filas
    const filas = [];
    document.querySelectorAll('#plan-filas-body .plan-fila').forEach(fila => {
      const sabor  = fila.querySelector('.plan-fila-sabor').value;
      const litros = parseFloat(fila.querySelector('.plan-fila-litros').value);
      if (sabor && !isNaN(litros) && litros > 0) {
        filas.push({ receta_nombre: sabor, litros_solicitados: litros });
      }
    });

    if (!filas.length) { errEl.textContent = 'Añade al menos un sabor con litros válidos.'; return; }

    // Comprobar duplicados de sabor en la misma planificación
    const nombres = filas.map(f => f.receta_nombre);
    const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i);
    if (duplicados.length) {
      errEl.textContent = `Sabor duplicado: "${duplicados[0]}". Cada sabor solo puede aparecer una vez.`;
      return;
    }

    errEl.textContent = '';
    const btnGuardar = document.getElementById('plan-btn-guardar');
    btnGuardar.disabled = true;

    try {
      let planId = this._editandoId;

      if (planId) {
        // Actualizar cabecera
        const { error: errUpd } = await sb
          .from('planificaciones_produccion')
          .update({
            nombre: nombre || null,
            fecha_planificacion: fecha,
            fecha_objetivo: fechaObj || null,
            observaciones: obs || null,
            estado: 'borrador',
          })
          .eq('id', planId);
        if (errUpd) throw errUpd;

        // Borrar líneas anteriores y reinsertar
        await sb.from('planificacion_lineas').delete().eq('planificacion_id', planId);

      } else {
        // Insertar nueva planificación
        const { data: inserted, error: errIns } = await sb
          .from('planificaciones_produccion')
          .insert({
            nombre: nombre || null,
            fecha_planificacion: fecha,
            fecha_objetivo: fechaObj || null,
            observaciones: obs || null,
            estado: 'borrador',
            usuario_creador: empleada,
          })
          .select()
          .single();
        if (errIns) throw errIns;
        planId = inserted.id;
      }

      // Insertar líneas
      const lineasInsert = filas.map(f => ({ planificacion_id: planId, ...f }));
      const { error: errLineas } = await sb.from('planificacion_lineas').insert(lineasInsert);
      if (errLineas) throw errLineas;

      closeModal('modal-plan-overlay');
      showToast(this._editandoId ? 'Planificación actualizada' : 'Planificación creada', 'success');
      await this.load();
      // Abrir el detalle de la planificación guardada
      this._toggleDetalle(planId);

    } catch (e) {
      console.error('Planificacion.guardar:', e);
      errEl.textContent = 'Error al guardar: ' + (e.message || e.code || JSON.stringify(e));
    } finally {
      btnGuardar.disabled = false;
    }
  },
};
