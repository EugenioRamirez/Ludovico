-- ══════════════════════════════════════════════════════════════════════════════
-- TABLAS: pedidos_b2b + pedidos_b2b_lineas
-- Historia de usuario: B2B-ORD-001 · Gestión de pedidos B2B
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Cabecera del pedido ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pedidos_b2b (

  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  cliente_id              UUID        NOT NULL REFERENCES clientes_b2b(id) ON DELETE RESTRICT,

  -- Campos obligatorios
  fecha_recepcion         DATE        NOT NULL,
  fecha_entrega_prevista  DATE        NOT NULL,
  estado                  TEXT        NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN (
                            'pendiente','confirmado','preparando',
                            'entregado','incidencia','cancelado','facturado'
                          )),

  -- Campos opcionales
  observaciones           TEXT,
  notas_entrega           TEXT,
  referencia_cliente      TEXT,
  comentarios_logisticos  TEXT,

  -- Totales calculados y almacenados (snapshot)
  total_litros            NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_importe           NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Auditoría
  creado_por              TEXT        NOT NULL,
  modificado_por          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Líneas del pedido ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pedidos_b2b_lineas (

  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  pedido_id       UUID          NOT NULL REFERENCES pedidos_b2b(id) ON DELETE CASCADE,
  sabor_id        UUID          NOT NULL REFERENCES sabores_b2b(id) ON DELETE RESTRICT,
  condicion_id    UUID          REFERENCES condiciones_comerciales(id) ON DELETE SET NULL,

  -- Snapshot del sabor en el momento del pedido (histórico inmutable)
  sabor_nombre    TEXT          NOT NULL,

  -- Campos obligatorios
  litros          NUMERIC(10,3) NOT NULL CHECK (litros > 0),
  precio_litro    NUMERIC(10,2) NOT NULL CHECK (precio_litro >= 0),
  es_promocional  BOOLEAN       NOT NULL DEFAULT FALSE,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 0 si es_promocional, else litros*precio_litro

  -- Campos opcionales
  observaciones   TEXT,

  -- Auditoría
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente  ON pedidos_b2b (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado   ON pedidos_b2b (estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fechas   ON pedidos_b2b (fecha_recepcion, fecha_entrega_prevista);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido    ON pedidos_b2b_lineas (pedido_id);
CREATE INDEX IF NOT EXISTS idx_lineas_sabor     ON pedidos_b2b_lineas (sabor_id);

-- ── Trigger updated_at en pedidos ────────────────────────────────────────────

CREATE TRIGGER trg_pedidos_b2b_updated_at
  BEFORE UPDATE ON pedidos_b2b
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE pedidos_b2b        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_b2b_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON pedidos_b2b
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_authenticated" ON pedidos_b2b_lineas
  FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- · pedidos_b2b_lineas.condicion_id → FK con ON DELETE SET NULL para conservar
--   el histórico aunque se desactive la condición comercial.
-- · sabor_nombre se guarda como snapshot: si el sabor cambia de nombre,
--   los pedidos históricos mantienen el nombre original.
-- · total_litros y total_importe se calculan en la app y se almacenan
--   para consultas rápidas sin recalcular líneas.
-- · ON DELETE CASCADE en líneas: borrar un pedido borra sus líneas.
-- · Los pedidos cancelados no pueden pasar a facturado (regla en la app).
-- ══════════════════════════════════════════════════════════════════════════════
