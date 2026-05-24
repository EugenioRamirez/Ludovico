-- ══════════════════════════════════════════════════════════════════════════════
-- TABLAS: proformas_b2b + proformas_b2b_lineas
-- Historia de usuario: B2B-INV-001 · Consolidación mensual y proformas B2B
-- Ejecutar en: Supabase → SQL Editor
-- ORDEN OBLIGATORIO: primero proformas_b2b, luego ALTER pedidos_b2b, luego líneas
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Cabecera de la proforma ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proformas_b2b (

  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  cliente_id                UUID          NOT NULL REFERENCES clientes_b2b(id) ON DELETE RESTRICT,

  -- Periodo y estado
  periodo_mes               INTEGER       NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio              INTEGER       NOT NULL CHECK (periodo_anio >= 2024),
  estado                    TEXT          NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador','revisada','enviada','aprobada','facturada')),
  fecha_generacion          DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Campos opcionales
  observaciones_internas    TEXT,
  notas_cliente             TEXT,
  comentarios_comerciales   TEXT,

  -- Totales calculados (snapshot)
  total_litros              NUMERIC(10,3) NOT NULL DEFAULT 0,
  subtotal                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_promociones_litros  NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_ajustes             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_final               NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Auditoría
  creado_por                TEXT          NOT NULL,
  modificado_por            TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Un cliente solo puede tener una proforma por mes/año
  UNIQUE (cliente_id, periodo_mes, periodo_anio)
);

-- ── 2. FK proforma_id en pedidos_b2b ─────────────────────────────────────────
-- (pedidos_b2b ya existe; proformas_b2b debe existir antes de este ALTER)

ALTER TABLE pedidos_b2b
  ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proformas_b2b(id) ON DELETE SET NULL;

-- ── 3. Líneas de la proforma ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proformas_b2b_lineas (

  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  proforma_id           UUID          NOT NULL REFERENCES proformas_b2b(id)       ON DELETE CASCADE,

  -- Discriminador: 'albaran' | 'ajuste'
  tipo                  TEXT          NOT NULL CHECK (tipo IN ('albaran','ajuste')),
  excluida              BOOLEAN       NOT NULL DEFAULT FALSE,

  -- ── Campos exclusivos de líneas de albarán ───────────────────────────────
  pedido_id             UUID          REFERENCES pedidos_b2b(id)          ON DELETE SET NULL,
  pedido_linea_id       UUID          REFERENCES pedidos_b2b_lineas(id)   ON DELETE SET NULL,
  num_albaran           TEXT,           -- snapshot 8 chars del UUID
  fecha_albaran         DATE,
  sabor_nombre          TEXT,
  litros                NUMERIC(10,3),
  precio_litro          NUMERIC(10,2),
  es_promocional        BOOLEAN       DEFAULT FALSE,
  subtotal_linea        NUMERIC(10,2),

  -- ── Campos exclusivos de líneas de ajuste ────────────────────────────────
  tipo_ajuste           TEXT          CHECK (tipo_ajuste IN (
                          'descuento_comercial','promocion','regularizacion',
                          'compensacion','incidencia','ajuste_manual'
                        )),
  descripcion           TEXT,
  importe               NUMERIC(10,2),   -- positivo o negativo
  observaciones_ajuste  TEXT,

  -- Auditoría
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_proformas_cliente   ON proformas_b2b (cliente_id);
CREATE INDEX IF NOT EXISTS idx_proformas_periodo   ON proformas_b2b (periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_proformas_estado    ON proformas_b2b (estado);
CREATE INDEX IF NOT EXISTS idx_pf_lineas_proforma  ON proformas_b2b_lineas (proforma_id);
CREATE INDEX IF NOT EXISTS idx_pf_lineas_pedido    ON proformas_b2b_lineas (pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_proforma    ON pedidos_b2b (proforma_id);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

CREATE TRIGGER trg_proformas_b2b_updated_at
  BEFORE UPDATE ON proformas_b2b
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE proformas_b2b        ENABLE ROW LEVEL SECURITY;
ALTER TABLE proformas_b2b_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON proformas_b2b
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON proformas_b2b_lineas
  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- · proformas_b2b debe crearse ANTES del ALTER TABLE pedidos_b2b.
-- · proformas_b2b_lineas.pedido_id / pedido_linea_id → SET NULL para no perder
--   líneas si se modifica el pedido original.
-- · excluida=TRUE excluye la línea de totales pero mantiene el histórico.
-- · importe en ajustes puede ser negativo (descuentos, compensaciones).
-- · UNIQUE(cliente_id, periodo_mes, periodo_anio) impide duplicados.
-- · Al marcar una proforma como 'facturada', la app actualiza pedidos a
--   estado='facturado'. Las líneas quedan inmutables.
-- ══════════════════════════════════════════════════════════════════════════════
