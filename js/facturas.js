// ── facturas.js · Historial de Facturación B2B (B2B-BILL-001) ────────────────

const Facturas = {

  lista:    [],
  clientes: [],

  // Filtros activos
  filtroCliente: '',
  filtroNumero:  '',
  filtroAnio:    '',
  filtroMes:     '',

  // ── Carga principal ─────────────────────────────────────────────────────────

  async load() {
    try {
      await Promise.all([this.loadFacturas(), this.loadClientes()]);
      this.renderFiltros();
      this.renderList();
      this.bindUI();
    } catch (err) {
      console.error('Facturas.load:', err);
      showToast('Error cargando facturas', 'error');
    }
  },

  async loadFacturas() {
    let q = sb
      .from('facturas_b2b')
      .select(`
        id,
        numero_factura,
        fecha_factura,
        referencia_verifactu,
        observaciones_internas,
        usuario_facturacion,
        created_at,
        proforma_id,
        proformas_b2b (
          id,
          periodo_mes,
          periodo_anio,
          total_litros,
          subtotal,
          total_ajustes,
          total_final,
          clientes_b2b ( id, nombre_comercial, razon_social, nif_cif )
        )
      `)
      .order('fecha_factura', { ascending: false });

    const { data, error } = await q;
    if (error) throw error;
    this.lista = data || [];
  },

  async loadClientes() {
    const { data, error } = await sb
      .from('clientes_b2b')
      .select('id, nombre_comercial, razon_social')
      .order('nombre');
    if (error) throw error;
    this.clientes = data || [];
  },

  // ── Filtros ─────────────────────────────────────────────────────────────────

  renderFiltros() {
    // Cliente selector
    const selCli = document.getElementById('fact-filtro-cliente');
    if (selCli) {
      const val = selCli.value;
      selCli.innerHTML = '<option value="">Todos los clientes</option>' +
        this.clientes.map(c => `<option value="${c.id}">${escHtml(c.nombre_comercial || c.razon_social)}</option>`).join('');
      if (val) selCli.value = val;
    }

    // Año selector
    const selAnio = document.getElementById('fact-filtro-anio');
    if (selAnio) {
      const hoy = new Date();
      const anioAct = hoy.getFullYear();
      const val = selAnio.value;
      selAnio.innerHTML = '<option value="">Todos los años</option>';
      for (let a = anioAct; a >= anioAct - 3; a--) {
        selAnio.innerHTML += `<option value="${a}">${a}</option>`;
      }
      if (val) selAnio.value = val;
    }
  },

  filtrar() {
    return this.lista.filter(f => {
      const pf  = f.proformas_b2b;
      const cli = pf?.clientes_b2b;

      if (this.filtroCliente && cli?.id !== this.filtroCliente) return false;

      if (this.filtroNumero) {
        const txt = this.filtroNumero.toLowerCase();
        if (!f.numero_factura.toLowerCase().includes(txt) &&
            !(f.referencia_verifactu || '').toLowerCase().includes(txt)) return false;
      }

      if (this.filtroAnio) {
        const anioFact = new Date(f.fecha_factura).getFullYear();
        if (String(anioFact) !== this.filtroAnio) return false;
      }

      if (this.filtroMes) {
        const mesFact = new Date(f.fecha_factura).getMonth() + 1;
        if (String(mesFact) !== this.filtroMes) return false;
      }

      return true;
    });
  },

  // ── Renderizado de lista ────────────────────────────────────────────────────

  renderList() {
    const el  = document.getElementById('facturas-list');
    const cnt = document.getElementById('fact-count');
    if (!el) return;

    const lista = this.filtrar();

    if (cnt) cnt.textContent = `${lista.length} factura${lista.length !== 1 ? 's' : ''}`;

    if (!lista.length) {
      el.innerHTML = `<div class="empty-state">
        <p>No hay facturas que coincidan con los filtros.</p>
      </div>`;
      return;
    }

    el.innerHTML = lista.map(f => {
      const pf  = f.proformas_b2b;
      const cli = pf?.clientes_b2b;
      const mes = pf ? this._nombreMes(pf.periodo_mes) + ' ' + pf.periodo_anio : '–';

      return `
      <div class="acord-row" id="fact-row-${f.id}">
        <div class="acord-summary" data-id="${f.id}">
          <div class="acord-header-left">
            <span class="fact-numero">${escHtml(f.numero_factura)}</span>
            <span class="fact-fecha">${fmtFecha(f.fecha_factura)}</span>
            ${f.referencia_verifactu
              ? `<span class="fact-ref-vf">🔗 ${escHtml(f.referencia_verifactu)}</span>`
              : ''}
          </div>
          <div class="acord-header-right">
            <span class="fact-cliente">${escHtml(cli?.nombre_comercial || cli?.razon_social || '–')}</span>
            <span class="fact-periodo">Período: ${mes}</span>
            <span class="fact-total">${parseFloat(pf?.total_final || 0).toFixed(2)} €</span>
            <button class="btn-icon" title="Ver detalle" data-acord="${f.id}">🔍</button>
          </div>
        </div>
        <div class="acord-detail hidden" id="fact-detail-${f.id}">
          ${this._renderDetalle(f)}
        </div>
      </div>`;
    }).join('');

    // Acordeón
    el.querySelectorAll('.acord-summary').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const id     = row.dataset.id;
        const detail = document.getElementById(`fact-detail-${id}`);
        const isOpen = !detail.classList.contains('hidden');

        el.querySelectorAll('.acord-detail').forEach(d => d.classList.add('hidden'));
        el.querySelectorAll('.acord-summary').forEach(r => r.classList.remove('open'));

        if (!isOpen) {
          detail.classList.remove('hidden');
          row.classList.add('open');
        }
      });
    });

    el.querySelectorAll('[data-acord]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id     = btn.dataset.acord;
        const detail = document.getElementById(`fact-detail-${id}`);
        const summ   = document.querySelector(`.acord-summary[data-id="${id}"]`);
        const isOpen = !detail.classList.contains('hidden');

        el.querySelectorAll('.acord-detail').forEach(d => d.classList.add('hidden'));
        el.querySelectorAll('.acord-summary').forEach(r => r.classList.remove('open'));

        if (!isOpen) {
          detail.classList.remove('hidden');
          summ?.classList.add('open');
        }
      });
    });
  },

  _renderDetalle(f) {
    const pf  = f.proformas_b2b;
    const cli = pf?.clientes_b2b;

    return `
    <div class="fact-detalle">
      <div class="fact-det-grid">
        <div class="fact-det-col">
          <div class="fact-det-section">
            <div class="fact-det-title">Datos de factura</div>
            <div class="fact-det-row"><span>Número</span><strong>${escHtml(f.numero_factura)}</strong></div>
            <div class="fact-det-row"><span>Fecha</span><strong>${fmtFecha(f.fecha_factura)}</strong></div>
            ${f.referencia_verifactu
              ? `<div class="fact-det-row"><span>Ref. Verifactu</span><strong>${escHtml(f.referencia_verifactu)}</strong></div>`
              : ''}
            <div class="fact-det-row"><span>Registrada por</span><strong>${escHtml(f.usuario_facturacion)}</strong></div>
            <div class="fact-det-row"><span>Fecha registro</span><strong>${fmtFecha(f.created_at)}</strong></div>
          </div>
          ${f.observaciones_internas ? `
          <div class="fact-det-section">
            <div class="fact-det-title">Observaciones</div>
            <p class="fact-det-obs">${escHtml(f.observaciones_internas)}</p>
          </div>` : ''}
        </div>

        <div class="fact-det-col">
          <div class="fact-det-section">
            <div class="fact-det-title">Trazabilidad</div>
            <div class="fact-det-row"><span>Cliente</span><strong>${escHtml(cli?.nombre_comercial || cli?.razon_social || '–')}</strong></div>
            ${cli?.nif_cif ? `<div class="fact-det-row"><span>NIF</span><strong>${escHtml(cli.nif_cif)}</strong></div>` : ''}
            <div class="fact-det-row"><span>Proforma</span>
              <strong>
                ${pf ? `${this._nombreMes(pf.periodo_mes)} ${pf.periodo_anio}` : '–'}
                <span class="badge-facturada">FACTURADA</span>
              </strong>
            </div>
          </div>

          ${pf ? `
          <div class="fact-det-section">
            <div class="fact-det-title">Importes de proforma</div>
            <div class="fact-det-row"><span>Litros totales</span><strong>${parseFloat(pf.total_litros || 0).toFixed(1)} L</strong></div>
            <div class="fact-det-row"><span>Subtotal albaranes</span><strong>${parseFloat(pf.subtotal || 0).toFixed(2)} €</strong></div>
            ${parseFloat(pf.total_ajustes || 0) !== 0
              ? `<div class="fact-det-row"><span>Ajustes</span><strong>${parseFloat(pf.total_ajustes || 0).toFixed(2)} €</strong></div>`
              : ''}
            <div class="fact-det-row fact-det-row-total"><span>Base imponible</span><strong>${(parseFloat(pf.subtotal || 0) + parseFloat(pf.total_ajustes || 0)).toFixed(2)} €</strong></div>
            <div class="fact-det-row"><span>IVA 10%</span><strong>${((parseFloat(pf.subtotal || 0) + parseFloat(pf.total_ajustes || 0)) * 0.10).toFixed(2)} €</strong></div>
            <div class="fact-det-row fact-det-row-final"><span>TOTAL (IVA incl.)</span><strong>${parseFloat(pf.total_final || 0).toFixed(2)} €</strong></div>
          </div>` : ''}
        </div>
      </div>
    </div>`;
  },

  // ── Bind UI ─────────────────────────────────────────────────────────────────

  bindUI() {
    // Filtro cliente
    const selCli = document.getElementById('fact-filtro-cliente');
    if (selCli) {
      selCli.value = this.filtroCliente;
      selCli.onchange = () => { this.filtroCliente = selCli.value; this.renderList(); };
    }

    // Filtro número / ref
    const inpNum = document.getElementById('fact-filtro-numero');
    if (inpNum) {
      inpNum.value = this.filtroNumero;
      inpNum.oninput = () => { this.filtroNumero = inpNum.value.trim(); this.renderList(); };
    }

    // Filtro año
    const selAnio = document.getElementById('fact-filtro-anio');
    if (selAnio) {
      selAnio.value = this.filtroAnio;
      selAnio.onchange = () => { this.filtroAnio = selAnio.value; this.renderList(); };
    }

    // Filtro mes
    const selMes = document.getElementById('fact-filtro-mes');
    if (selMes) {
      selMes.value = this.filtroMes;
      selMes.onchange = () => { this.filtroMes = selMes.value; this.renderList(); };
    }
  },

  // ── Utilidades ──────────────────────────────────────────────────────────────

  _nombreMes(n) {
    const nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return nombres[n] || '–';
  },
};
