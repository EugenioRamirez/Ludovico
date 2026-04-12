// ── Configuración Supabase ────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://xsqzmtbecsbjqrcxfzbl.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcXptdGJlY3NianFyY3hmemJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTA1OTUsImV4cCI6MjA5MDcyNjU5NX0.LJ-eBd2oxfXWBlatD4-2eqKIq6CuR7gv6Mv87DpXFf8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Empleadas ─────────────────────────────────────────────────────────────────
const EMPLEADAS = [
  { nombre: 'Laura Duarte',   avatar: 'LD', color: '#1565A0' },
  { nombre: 'Lorena Carmona', avatar: 'LC', color: '#00B4CC' },
  { nombre: 'Susan Matildo',  avatar: 'SM', color: '#F5821F' },
  { nombre: 'Administrador',  avatar: 'AD', color: '#7EC855' },
];

// ── Estado global de sesión ───────────────────────────────────────────────────
const Estado = {
  empleada: null,
  setEmpleada(nombre) {
    this.empleada = nombre;
    sessionStorage.setItem('ludovico_empleada', nombre);
  },
  getEmpleada() {
    if (!this.empleada) {
      this.empleada = sessionStorage.getItem('ludovico_empleada');
    }
    return this.empleada;
  },
  cerrarSesion() {
    this.empleada = null;
    sessionStorage.removeItem('ludovico_empleada');
  }
};
