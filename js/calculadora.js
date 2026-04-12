// ── calculadora.js · Calculadora de Recetas ───────────────────────────────────

const BASE_LITROS = 2.5;

const RECETAS = [
  // ── Chocolates & Cacao ─────────────────────────────────────────────────────
  { categoria:"Chocolates & Cacao", nombre:"Helado de Tiramisú",
    total:1370, ingredientes:[["Leche entera",800],["Azúcar",170],["Base Pro Crema",100],["Yema de huevo",100],["Nata 35%",100],["Tiramisú (aroma/pasta)",130]]},
  { categoria:"Chocolates & Cacao", nombre:"Chocolate a la Jerez con Leche",
    total:1791, ingredientes:[["Leche entera",1000],["Azúcar",250],["Dextrosa",50],["Base Pro Crema",80],["Glicerina",50],["Nata 35%",100],["Yema de huevo",100],["Cacao amargo",200],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Chocolate con Leche",
    total:1511, ingredientes:[["Leche entera",1000],["Azúcar",160],["Dextrosa",40],["Glicerina",50],["Base Pro Crema",100],["Cacao amargo",200],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Semi Sorbete de Chocolate 70%",
    total:1251, ingredientes:[["Agua",700],["Azúcar",100],["Azúcar invertido",50],["Base Pro Crema",100],["Cobertura negra 70%",250],["Cacao en polvo",50],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Chocolate Blanco",
    total:1151, ingredientes:[["Leche",650],["Base Pro Crema",100],["Cobertura blanca",350],["Glicerina",50],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Gianduja",
    subtitle:"Chocolate con Avellana",
    total:1341, ingredientes:[["Leche",840],["Azúcar",120],["Dextrosa",60],["Base Pro",100],["Cacao amargo",60],["Pasta de avellana",160],["Sal",1]]},

  // ── Frutos Secos & Pralinés ────────────────────────────────────────────────
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Pistacho",
    total:1231, ingredientes:[["Leche entera",750],["Azúcar",100],["Base Pro Crema",100],["Glicerina",30],["Pasta de pistacho",250],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Semi Sorbete de Pistacho",
    total:1251, ingredientes:[["Agua",625],["Azúcar",80],["Dextrosa",50],["Base Pro Crema",100],["Glicerina",20],["Pasta de pistacho",375],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Avellana",
    total:1281, ingredientes:[["Leche",725],["Azúcar",50],["Dextrosa",20],["Base Pro Crema",100],["Glicerina",30],["Pasta de avellana",275],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Nueces",
    total:1321, ingredientes:[["Leche",850],["Azúcar",220],["Base Pro Crema",100],["Pasta de nuez 100%",150],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Turrón",
    total:1221, ingredientes:[["Leche",700],["Base Pro Crema",100],["Dextrosa",50],["Glicerina",20],["Pasta de turrón",300]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Semi Sorbete de Turrón",
    total:1100, ingredientes:[["Agua",600],["Base Pro",100],["Pasta de turrón",400]]},

  // ── Helados Clásicos ───────────────────────────────────────────────────────
  { categoria:"Helados Clásicos", nombre:"Helado de Vainilla",
    subtitle:"Con Yema de Huevo",
    total:1310, ingredientes:[["Leche",700],["Azúcar",140],["Dextrosa",50],["Glicerina",20],["Base Pro Crema",80],["Nata 35%",150],["Yema de huevo",150],["Extracto de vainilla",20],["Sal",1]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Vainilla Sin Azúcar",
    total:1545, ingredientes:[["Leche entera",1000],["Azúcar",150],["Dextrosa",50],["Glicerina",25],["Base Pro Crema",100],["Nata 35%",200],["Extracto natural de vainilla",20],["Sal",1]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Nata",
    total:1240, ingredientes:[["Leche entera",300],["Azúcar",70],["Dextrosa",50],["Glicerina",20],["Base Pro Crema",100],["Nata 35%",700]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Leche Merengada",
    total:1555, ingredientes:[["Leche entera",1000],["Azúcar",200],["Dextrosa",55],["Base Pro Crema",100],["Nata 35%",150],["Aroma leche merengada",50]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Miel",
    total:1250, ingredientes:[["Leche",900],["Miel",150],["Base Pro Crema",100],["Nata 35%",100]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Yogur",
    total:1255, ingredientes:[["Leche entera",250],["Azúcar",80],["Dextrosa",40],["Base Pro Crema",100],["Yogur natural griego",750],["Glicerina",15],["Yogur en polvo",20]]},

  // ── Sorbetes & Frutas ──────────────────────────────────────────────────────
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete de Fresa",
    total:1385, ingredientes:[["Azúcar",300],["Pulpa de fresa",1000],["Pro Sorbete",80],["Ácido cítrico",5]]},
  { categoria:"Sorbetes & Frutas", nombre:"Semi-Sorbete de Mango",
    total:1250, ingredientes:[["Agua",300],["Pulpa de mango",630],["Azúcar",200],["Pro Crema",75],["Dextrosa",40],["Ácido málico",5]]},
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete de Melón",
    total:1225, ingredientes:[["Agua",200],["Pulpa de melón",720],["Base Pro Sorbete",100],["Azúcar",200],["Ácido cítrico",5]]},
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete de Piña",
    total:1305, ingredientes:[["Pulpa de piña",900],["Azúcar",300],["Base Pro Sorbete",100],["Ácido cítrico",5]]},
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete de Limón",
    total:1500, ingredientes:[["Zumo de limón",400],["Base Pro Sorbete",150],["Azúcar",200],["Dextrosa",50],["Agua",650],["Pasta limón (piel)",50]]},
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete de Melocotón",
    total:1140, ingredientes:[["Pulpa de melocotón",900],["Pro Sorbete",80],["Azúcar",160]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Plátano",
    total:1255, ingredientes:[["Leche",200],["Base Pro Crema",100],["Agua",100],["Azúcar",100],["Dextrosa",50],["Pulpa de plátano",700],["Ácido cítrico",5]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Coco",
    total:1250, ingredientes:[["Leche desnatada",400],["Pulpa de coco",600],["Pro Crema Sorbete",100],["Azúcar",100],["Dextrosa",50]]},
  { categoria:"Sorbetes & Frutas", nombre:"Sorbete Fruto de la Pasión",
    total:1296, ingredientes:[["Agua",225],["Pulpa",900],["Base Pro + Z1",140],["Azúcar",25],["Ácido cítrico",6]]},

  // ── Especiales & Gourmets ──────────────────────────────────────────────────
  { categoria:"Especiales & Gourmets", nombre:"Helado de Café",
    total:1341, ingredientes:[["Leche entera",900],["Azúcar",120],["Dextrosa",40],["Base Pro Crema",100],["Nata 35%",100],["Glicerina",30],["Pasta café / Nescafé",50],["Sal",1]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Regaliz Negro",
    total:1590, ingredientes:[["Leche entera",1000],["Azúcar",150],["Dextrosa",70],["Base Pro Crema",100],["Glicerina",20],["Nata 35%",200],["Pasta regaliz negro",50],["Sal",1]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Flores (Violetas)",
    total:1495, ingredientes:[["Leche entera",1000],["Azúcar",275],["Base Pro Crema",100],["Glicerina",40],["Pétalos de violetas",20],["Extracto natural de violeta",60]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Mezcal",
    total:1270, ingredientes:[["Leche entera",830],["Maltodextrina",150],["Glucosa en polvo",20],["Base Pro Crema",100],["Mezcal",170]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Queso Cabrales",
    total:1335, ingredientes:[["Leche entera",800],["Azúcar",75],["Dextrosa",100],["Base Pro Crema",80],["Queso de leche",200],["Queso Cabrales suave",80]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Pasa al Ron",
    nota:"Velocidad lenta para escurrir al Ron.",
    total:null, ingredientes:[["Leche entera",1000],["Azúcar",200],["Dextrosa",50],["Base Pro",92],["Nata 35%",150],["Pasta Málaga suave",80]]},
  { categoria:"Especiales & Gourmets", nombre:"Semi Sorbete de Huevo",
    total:1165, ingredientes:[["Agua",275],["Glicerina",55],["Dextrosa",60],["Base Pro Crema",50],["Yema de huevo",725]]},

  // ── Granizados & Bebidas ───────────────────────────────────────────────────
  { categoria:"Granizados & Bebidas", nombre:"Granizado de Limón",
    nota:"Completar a 1 litro de agua. Reposar y colar.",
    total:null, ingredientes:[["Zumo de limón",1500],["Agua",1000],["Azúcar",1300],["Dextrosa",300]]},
  { categoria:"Granizados & Bebidas", nombre:"Leche Merengada Granizada",
    nota:"Hervir, reposar, colar y granizar.",
    total:null, ingredientes:[["Leche",5000],["Azúcar",750],["Rama de canela",null],["Cáscara de limón",null]]},
  { categoria:"Granizados & Bebidas", nombre:"Granizada de Café",
    total:1170, ingredientes:[["Agua",1000],["Azúcar",150],["Nescafé clásico",20]]},
  { categoria:"Granizados & Bebidas", nombre:"Granizada de Sandía",
    total:null, ingredientes:[["Zumo licuado de sandía",5000],["Azúcar",375],["Agua",5000]]},
];

// ── Módulo Calculadora ────────────────────────────────────────────────────────
const Calculadora = {

  init: false,

  load() {
    if (!this.init) {
      this.poblarSelect();
      document.getElementById('calc-btn').addEventListener('click', () => this.calcular());
      document.getElementById('calc-litros').addEventListener('keydown', e => {
        if (e.key === 'Enter') this.calcular();
      });
      this.init = true;
    }
  },

  poblarSelect() {
    const sel = document.getElementById('calc-sabor');
    const cats = {};
    RECETAS.forEach((r, i) => {
      if (!cats[r.categoria]) cats[r.categoria] = [];
      cats[r.categoria].push({ i, nombre: r.nombre });
    });
    Object.entries(cats).forEach(([cat, items]) => {
      const og = document.createElement('optgroup');
      og.label = cat;
      items.forEach(({ i, nombre }) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = nombre;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
  },

  fmtG(val) {
    if (val === null || val === undefined) return '—';
    if (val >= 1000) return (val / 1000).toFixed(2).replace('.', ',') + ' kg';
    return Math.round(val) + ' g';
  },

  calcular() {
    const idxStr = document.getElementById('calc-sabor').value;
    const litros = parseFloat(document.getElementById('calc-litros').value.replace(',', '.'));

    if (idxStr === '' || isNaN(litros) || litros <= 0) {
      showToast('Selecciona un sabor e introduce los litros', 'error');
      return;
    }

    const r      = RECETAS[parseInt(idxStr)];
    const factor = litros / BASE_LITROS;
    let totalCalc = 0;
    r.ingredientes.forEach(([, g]) => { if (g) totalCalc += g * factor; });

    // Header resultado
    document.getElementById('calc-res-nombre').textContent   = r.nombre;
    document.getElementById('calc-res-sub').textContent      = r.subtitle || r.categoria;
    document.getElementById('calc-res-litros').textContent   = `${litros} litros`;
    document.getElementById('calc-res-factor').textContent   = `Factor ×${factor.toFixed(2)}`;
    document.getElementById('calc-res-total').textContent    = `${this.fmtG(totalCalc)} de mezcla`;

    // Tabla
    const tbody = document.getElementById('calc-tbody');
    tbody.innerHTML = '';
    r.ingredientes.forEach(([nombre, g]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${nombre}</td><td>${g ? this.fmtG(g * factor) : '—'}</td>`;
      tbody.appendChild(tr);
    });
    document.getElementById('calc-tfoot-total').textContent = this.fmtG(totalCalc);

    // Nota
    const notaEl = document.getElementById('calc-nota');
    if (r.nota) { notaEl.textContent = '⚠️ ' + r.nota; notaEl.classList.remove('hidden'); }
    else { notaEl.classList.add('hidden'); }

    // Mostrar resultado
    document.getElementById('calc-empty').classList.add('hidden');
    document.getElementById('calc-result').classList.remove('hidden');
  }
};
