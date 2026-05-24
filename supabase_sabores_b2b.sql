-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: sabores_b2b
-- Historia de usuario: B2B-PROD-001 · Mantenimiento de sabores B2B
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sabores_b2b (

  -- ── Identificador ────────────────────────────────────────────────────────────
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Campos obligatorios ───────────────────────────────────────────────────────
  nombre            TEXT        NOT NULL,
  activo            BOOLEAN     NOT NULL DEFAULT TRUE,
  visible_b2b       BOOLEAN     NOT NULL DEFAULT TRUE,

  -- ── Campos opcionales ─────────────────────────────────────────────────────────
  descripcion       TEXT,
  categoria         TEXT        DEFAULT 'estandar'
                               CHECK (categoria IN ('estandar', 'especial', 'premium')),
  precio_litro      NUMERIC(10,2),        -- solo informativo
  orden_visualizacion INTEGER   DEFAULT 0,
  observaciones     TEXT,                 -- internas

  -- ── Auditoría ────────────────────────────────────────────────────────────────
  creado_por        TEXT        NOT NULL,
  modificado_por    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Restricciones ────────────────────────────────────────────────────────────
  CONSTRAINT sabores_b2b_nombre_unique UNIQUE (nombre)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sabores_b2b_activo     ON sabores_b2b (activo);
CREATE INDEX IF NOT EXISTS idx_sabores_b2b_visible    ON sabores_b2b (visible_b2b);
CREATE INDEX IF NOT EXISTS idx_sabores_b2b_orden      ON sabores_b2b (orden_visualizacion);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
-- (reutiliza la función set_updated_at() creada en clientes_b2b si ya existe)
CREATE TRIGGER trg_sabores_b2b_updated_at
  BEFORE UPDATE ON sabores_b2b
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE sabores_b2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON sabores_b2b
  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- · nombre UNIQUE → el sistema rechaza duplicados.
-- · activo = false desactiva sin borrar; no afecta pedidos históricos.
-- · visible_b2b = false excluye el sabor de nuevos pedidos B2B.
-- · precio_litro es solo referencial; las tarifas reales irán en tabla aparte.
-- · No eliminar sabores con uso en pedidos → aplicar FK ON DELETE RESTRICT
--   cuando se cree la tabla de pedidos.
-- ══════════════════════════════════════════════════════════════════════════════
