-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: condiciones_comerciales
-- Historia de usuario: B2B-TAR-001 · Condiciones comerciales por cliente B2B
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS condiciones_comerciales (

  -- ── Identificador ────────────────────────────────────────────────────────────
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Relaciones ───────────────────────────────────────────────────────────────
  cliente_id          UUID        NOT NULL REFERENCES clientes_b2b(id)  ON DELETE RESTRICT,
  sabor_id            UUID        NOT NULL REFERENCES sabores_b2b(id)   ON DELETE RESTRICT,

  -- ── Campos obligatorios ───────────────────────────────────────────────────────
  precio_litro        NUMERIC(10,2) NOT NULL,
  activa              BOOLEAN     NOT NULL DEFAULT TRUE,
  fecha_inicio        DATE        NOT NULL,

  -- ── Campos opcionales ─────────────────────────────────────────────────────────
  fecha_fin           DATE,
  es_promocional      BOOLEAN     NOT NULL DEFAULT FALSE,
  precio_promocional  NUMERIC(10,2),
  observaciones       TEXT,
  notas_comerciales   TEXT,

  -- ── Auditoría ────────────────────────────────────────────────────────────────
  creado_por          TEXT        NOT NULL,
  modificado_por      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índice parcial UNIQUE: no puede haber dos condiciones ACTIVAS
--    para el mismo cliente + mismo sabor
CREATE UNIQUE INDEX IF NOT EXISTS idx_condiciones_activas_unique
  ON condiciones_comerciales (cliente_id, sabor_id)
  WHERE activa = TRUE;

-- ── Índices de consulta ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_condiciones_cliente   ON condiciones_comerciales (cliente_id);
CREATE INDEX IF NOT EXISTS idx_condiciones_sabor     ON condiciones_comerciales (sabor_id);
CREATE INDEX IF NOT EXISTS idx_condiciones_activa    ON condiciones_comerciales (activa);
CREATE INDEX IF NOT EXISTS idx_condiciones_vigencia  ON condiciones_comerciales (fecha_inicio, fecha_fin);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
CREATE TRIGGER trg_condiciones_updated_at
  BEFORE UPDATE ON condiciones_comerciales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE condiciones_comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON condiciones_comerciales
  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- · El índice parcial UNIQUE evita duplicar condiciones ACTIVAS para el mismo
--   cliente+sabor. Históricas (activa=false) pueden coexistir sin límite.
-- · ON DELETE RESTRICT en ambas FK: no se pueden borrar clientes ni sabores
--   que tengan condiciones asociadas.
-- · precio_promocional puede ser 0€ (promotions gratuitas).
-- · Las condiciones inactivas se conservan como histórico.
-- ══════════════════════════════════════════════════════════════════════════════
