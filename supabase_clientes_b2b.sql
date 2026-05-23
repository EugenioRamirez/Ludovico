-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: clientes_b2b
-- Historia de usuario: Alta de cliente B2B · Helados Ludovico
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS clientes_b2b (

  -- ── Identificador ────────────────────────────────────────────────────────────
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Datos fiscales (obligatorios) ────────────────────────────────────────────
  razon_social     TEXT        NOT NULL,
  nif_cif          TEXT        NOT NULL,
  direccion_fiscal TEXT        NOT NULL,
  email_facturacion TEXT       NOT NULL,

  -- ── Datos de contacto (obligatorios) ─────────────────────────────────────────
  contacto_nombre  TEXT        NOT NULL,
  telefono         TEXT        NOT NULL,

  -- ── Dirección de entrega (puede diferir de la fiscal) ────────────────────────
  direccion_entrega TEXT,

  -- ── Estado ───────────────────────────────────────────────────────────────────
  activo           BOOLEAN     NOT NULL DEFAULT TRUE,

  -- ── Datos opcionales ─────────────────────────────────────────────────────────
  nombre_comercial  TEXT,
  email_operativo   TEXT,
  canal_comunicacion TEXT       DEFAULT 'whatsapp'
                               CHECK (canal_comunicacion IN ('email', 'whatsapp')),
  condiciones_pago  TEXT,
  observaciones     TEXT,        -- internas, no visibles para el cliente
  notas_entrega     TEXT,
  referencia_aeat   TEXT,        -- referencia AEAT/Verifactu si aplica

  -- ── Auditoría ────────────────────────────────────────────────────────────────
  creado_por       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Restricciones ────────────────────────────────────────────────────────────
  CONSTRAINT clientes_b2b_nif_unique UNIQUE (nif_cif)
);

-- ── Índices útiles ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_b2b_activo     ON clientes_b2b (activo);
CREATE INDEX IF NOT EXISTS idx_clientes_b2b_razon_social ON clientes_b2b (razon_social);

-- ── Trigger: actualizar updated_at automáticamente ───────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_b2b_updated_at
  BEFORE UPDATE ON clientes_b2b
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security (opcional pero recomendado) ───────────────────────────
-- Habilitar RLS y permitir acceso con la anon key usada por la app
ALTER TABLE clientes_b2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON clientes_b2b
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- · La columna "nif_cif" tiene constraint UNIQUE → el sistema rechaza duplicados.
-- · "activo = false" desactiva al cliente sin eliminarlo.
-- · "observaciones" es interna y nunca se muestra al cliente.
-- · No eliminar clientes con pedidos asociados: aplicar la restricción vía
--   FK en la tabla de pedidos cuando ésta se cree (ON DELETE RESTRICT).
-- ══════════════════════════════════════════════════════════════════════════════
