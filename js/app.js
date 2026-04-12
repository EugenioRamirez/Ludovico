// ── app.js · Router y controlador principal ──────────────────────────────────

const SCREENS = ['dashboard', 'inventario', 'conteo', 'compras'];
const TITLES  = {
  dashboard: '🏠 Dashboard',
  inventario: '📦 Inventario',
  conteo: '📋 Conteo Semanal',
  compras: '🛒 Lista de Compras',
};

// ── Utilidades globales ───────────────────────────────────────────────────────

function showToast(msg, type = 'info', duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

function fmtFecha(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(n, dec = 2) {
  const val = parseFloat(n) || 0;
  return val % 1 === 0 ? val.toString() : val.toFixed(dec).replace(/\.?0+$/, '');
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function openModal(overlayId) {
  document.getElementById(overlayId).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(overlayId) {
  document.getElementById(overlayId).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ── Router ────────────────────────────────────────────────────────────────────

const App = {
  currentScreen: 'dashboard',

  nav(screen) {
    if (!SCREENS.includes(screen)) return;

    // Hide all screens
    document.querySelectorAll('#main-content .screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    // Show target
    document.getElementById(`screen-${screen}`).classList.add('active');
    document.querySelector(`.nav-item[data-screen="${screen}"]`).classList.add('active');
    document.getElementById('topbar-title').textContent = TITLES[screen];

    this.currentScreen = screen;

    // Load screen data
    switch (screen) {
      case 'dashboard':   Dashboard.load();   break;
      case 'inventario':  Inventario.load();  break;
      case 'conteo':      Conteo.load();      break;
      case 'compras':     Compras.load();     break;
    }

    window.location.hash = screen;
  },

  init() {
    // Bind bottom nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.nav(btn.dataset.screen));
    });

    // Hash navigation
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (SCREENS.includes(hash)) this.nav(hash);
    });

    // Initial screen from hash or default
    const hash = window.location.hash.replace('#', '');
    this.nav(SCREENS.includes(hash) ? hash : 'dashboard');
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

function initLogin() {
  const grid = document.getElementById('login-grid');
  grid.innerHTML = '';
  EMPLEADAS.forEach(emp => {
    const btn = document.createElement('button');
    btn.className = 'login-btn';
    btn.innerHTML = `
      <div class="login-avatar" style="background:${emp.color}">${emp.avatar}</div>
      <span class="login-name">${emp.nombre}</span>
    `;
    btn.addEventListener('click', () => doLogin(emp.nombre));
    grid.appendChild(btn);
  });
}

function doLogin(nombre) {
  Estado.setEmpleada(nombre);
  renderTopbarAvatar(nombre);
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('app-layout').classList.remove('hidden');
  App.init();
}

function renderTopbarAvatar(nombre) {
  const emp = EMPLEADAS.find(e => e.nombre === nombre);
  const el  = document.getElementById('topbar-avatar');
  if (!emp) return;
  el.textContent       = emp.avatar;
  el.style.background  = emp.color;
  el.title             = `${emp.nombre} · Cerrar sesión`;
  el.onclick           = () => {
    if (confirm(`¿Cerrar sesión de ${emp.nombre}?`)) doLogout();
  };
}

function doLogout() {
  Estado.cerrarSesion();
  document.getElementById('app-layout').classList.add('hidden');
  document.getElementById('screen-login').classList.add('active');
  window.location.hash = '';
}

// ── Arranque ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  const empleada = Estado.getEmpleada();
  if (empleada) {
    doLogin(empleada);          // sesión persistida
  }
  // Si no hay sesión, se queda en la pantalla de login
});
