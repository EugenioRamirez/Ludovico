// ── calculadora.js · Calculadora de Recetas · v2 ─────────────────────────────

const BASE_LITROS = 2.5;   // litros base por defecto (recetas sin litros_base)

const RECETAS = [
  // ── Chocolates & Cacao ─────────────────────────────────────────────────────
  { categoria:"Chocolates & Cacao", nombre:"Helado de Chocolate con Leche",
    total:1511, ingredientes:[["Leche entera",1000],["Azúcar",160],["Dextrosa",40],["Glicerina",50],["Base Pro Crema",100],["Cacao amargo",200],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Chocolate Blanco",
    total:1151, ingredientes:[["Leche entera",650],["Base Pro Crema",100],["Cobertura blanca",350],["Glicerina",50],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Gianduja",
    subtitle:"Chocolate con Avellana",
    total:1341, ingredientes:[["Leche entera",840],["Azúcar",120],["Dextrosa",60],["Base Pro Crema",100],["Cacao amargo",60],["Pasta de avellana",160],["Sal",1]]},
  { categoria:"Chocolates & Cacao", nombre:"Helado de Chocolate con Maracuyá",
    litros_base:1, total:1000,
    ingredientes:[["Leche entera",496],["Nata 35%",70],["Leche en polvo",55],["Profiber",4],["Dextrosa",90],["Azúcar",50],["Cacao",100],["Fruta de la Pasión",135]]},

  // ── Frutos Secos & Pralinés ────────────────────────────────────────────────
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Pistacho",
    total:1231, ingredientes:[["Leche entera",750],["Azúcar",100],["Base Pro Crema",100],["Glicerina",30],["Pasta de pistacho",250],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Avellana",
    total:1281, ingredientes:[["Leche entera",725],["Azúcar",50],["Dextrosa",20],["Base Pro Crema",100],["Glicerina",30],["Pasta de avellana",275],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Nueces",
    total:1321, ingredientes:[["Leche entera",850],["Azúcar",220],["Base Pro Crema",100],["Pasta de nuez 100%",150],["Sal",1]]},
  { categoria:"Frutos Secos & Pralinés", nombre:"Helado de Turrón",
    total:1221, ingredientes:[["Leche entera",700],["Base Pro Crema",100],["Dextrosa",50],["Glicerina",20],["Pasta de turrón",300]]},

  // ── Helados Clásicos ───────────────────────────────────────────────────────
  { categoria:"Helados Clásicos", nombre:"Helado Stracciatella",
    subtitle:"Base láctea para Stracciatella",
    total:945, ingredientes:[["Leche entera",584],["Nata 35%",166],["Azúcar",65],["Dextrosa",63],["Leche en polvo 1%",30],["Glucosa",23],["Maltodextrina",10],["Profibe R",4]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Vainilla",
    subtitle:"Con Yema de Huevo",
    total:1310, ingredientes:[["Leche entera",700],["Azúcar",140],["Dextrosa",50],["Glicerina",20],["Base Pro Crema",80],["Nata 35%",150],["Yema de huevo",150],["Extracto natural de vainilla",20],["Sal",1]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Vainilla Sin Azúcar",
    total:1545, ingredientes:[["Leche entera",1000],["Azúcar",150],["Dextrosa",50],["Glicerina",25],["Base Pro Crema",100],["Nata 35%",200],["Extracto natural de vainilla",20],["Sal",1]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Nata",
    total:1240, ingredientes:[["Leche entera",300],["Azúcar",70],["Dextrosa",50],["Glicerina",20],["Base Pro Crema",100],["Nata 35%",700]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Leche Merengada",
    total:1555, ingredientes:[["Leche entera",1000],["Azúcar",200],["Dextrosa",55],["Base Pro Crema",100],["Nata 35%",150],["Aroma leche merengada",50]]},
  { categoria:"Helados Clásicos", nombre:"Helado de Yogur",
    total:1255, ingredientes:[["Leche entera",250],["Azúcar",80],["Dextrosa",40],["Base Pro Crema",100],["Yogur natural griego",750],["Glicerina",15],["Yogur en polvo",20]]},

  // ── Sorbetes & Frutas ─────────────────────────────────────────────────────
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Mango",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Mango",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Mandarina",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Mandarina",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Coco",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Coco",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Fresa",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Fresa",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Mora",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Mora",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Limón",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Limón",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Plátano",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Plátano",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Melón",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Melón",2000]]},
  { categoria:"Sorbetes & Frutas", nombre:"Helado de Fruta de la Pasión",
    litros_base:5, total:3794,
    ingredientes:[["Agua",850],["Dextrosa",356],["Azúcar",272],["Inulina",188],["Maltodextrina",118],["Profiber",10],["Puré de Fruta de la Pasión",2000]]},

  // ── Especiales & Gourmets ──────────────────────────────────────────────────
  { categoria:"Especiales & Gourmets", nombre:"Helado de Café",
    total:1341, ingredientes:[["Leche entera",900],["Azúcar",120],["Dextrosa",40],["Base Pro Crema",100],["Nata 35%",100],["Glicerina",30],["Pasta café / Nescafé",50],["Sal",1]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Regaliz Negro",
    total:1590, ingredientes:[["Leche entera",1000],["Azúcar",150],["Dextrosa",70],["Base Pro Crema",100],["Glicerina",20],["Nata 35%",200],["Pasta regaliz negro",50],["Sal",1]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Violetas",
    total:1495, ingredientes:[["Leche entera",1000],["Azúcar",275],["Base Pro Crema",100],["Glicerina",40],["Pétalos de violetas",20],["Extracto natural de violeta",60]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Queso Cabrales",
    total:1335, ingredientes:[["Leche entera",800],["Azúcar",75],["Dextrosa",100],["Base Pro Crema",80],["Queso de leche",200],["Queso Cabrales suave",80]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Pasa al Ron",
    nota:"Velocidad lenta para escurrir al Ron.",
    total:null, ingredientes:[["Leche entera",1000],["Azúcar",200],["Dextrosa",50],["Base Pro Crema",92],["Nata 35%",150],["Pasta Málaga suave",80]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de AOVE",
    litros_base:5, total:4752,
    ingredientes:[["Agua",3000],["Azúcar",750],["Profiber",35],["Leche en polvo",464],["Dextrosa",124],["Azúcar invertido",124],["AOVE",250],["Sal",5]]},
  { categoria:"Especiales & Gourmets", nombre:"Helado de Matcha",
    litros_base:1, total:1229,
    ingredientes:[["Leche entera",750],["Nata 35%",200],["Azúcar",100],["Base Pro Crema",125],["Matcha",28],["Dextrosa",25],["Sal",1]]},

  // ── Granizados & Bebidas ───────────────────────────────────────────────────
  { categoria:"Granizados & Bebidas", nombre:"Granizado de Limón",
    litros_base:10,
    nota:"Completar a 10 litros con agua fría en el cubo.",
    total:3100, ingredientes:[["Zumo de limón",1500],["Azúcar",1300],["Dextrosa",300]]},
  { categoria:"Granizados & Bebidas", nombre:"Granizada de Café",
    total:1170, ingredientes:[["Agua",1000],["Azúcar",150],["Nescafé clásico",20]]},
  { categoria:"Granizados & Bebidas", nombre:"Granizada de Sandía",
    litros_base:10,
    nota:"Completar a 10 litros con agua.",
    total:7275, ingredientes:[["Zumo de sandía",5000],["Zumo de limón",100],["Azúcar",2175]]},
];

// ── Módulo Calculadora ────────────────────────────────────────────────────────
const Calculadora = {

  init: false,
  _ultimoNombre: null,
  _ultimosLitros: null,

  load() {
    if (!this.init) {
      this.poblarSelect();
      document.getElementById('calc-btn').addEventListener('click', () => this.calcular());
      document.getElementById('calc-litros').addEventListener('keydown', e => {
        if (e.key === 'Enter') this.calcular();
      });

      const btnMix = document.getElementById('btn-preparar-mix');
      if (btnMix) {
        btnMix.addEventListener('click', () => {
          if (this._ultimoNombre && this._ultimosLitros) {
            Produccion.registrarMixDesdeCalc(this._ultimoNombre, this._ultimosLitros);
          }
        });
      }

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
    const base   = r.litros_base || BASE_LITROS;
    const factor = litros / base;
    let totalCalc = 0;
    r.ingredientes.forEach(([, g]) => { if (g) totalCalc += g * factor; });

    this._ultimoNombre  = r.nombre;
    this._ultimosLitros = litros;

    document.getElementById('calc-res-nombre').textContent = r.nombre;
    document.getElementById('calc-res-sub').textContent    = r.subtitle || r.categoria;
    document.getElementById('calc-res-litros').textContent = litros + ' L';
    document.getElementById('calc-res-factor').textContent = 'x' + factor.toFixed(2) + ' (base ' + base + ' L)';
    document.getElementById('calc-res-total').textContent  =
      r.total ? this.fmtG(r.total * factor) + ' total' : '—';

    const tbody = document.getElementById('calc-tbody');
    tbody.innerHTML = r.ingredientes.map(([ing, g]) =>
      `<tr><td>${ing}</td><td>${this.fmtG(g ? g * factor : null)}</td></tr>`
    ).join('');

    document.getElementById('calc-tfoot-total').textContent = this.fmtG(totalCalc);

    const notaEl = document.getElementById('calc-nota');
    if (r.nota) {
      notaEl.textContent = '⚠️ ' + r.nota;
      notaEl.classList.remove('hidden');
    } else {
      notaEl.classList.add('hidden');
    }

    document.getElementById('calc-empty').classList.add('hidden');
    document.getElementById('calc-result').classList.remove('hidden');
    const btnMix = document.getElementById('btn-preparar-mix');
    if (btnMix) btnMix.classList.remove('hidden');
  }
};
