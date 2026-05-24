-- ── B2B-BILL-001: Control de Facturación y Trazabilidad Verifactu ─────────────
-- Ejecutar en Supabase SQL Editor

-- ── Tabla principal de facturas B2B ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_b2b (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_id           UUID          NOT NULL REFERENCES proformas_b2b(id) ON DELETE RESTRICT,
  numero_factura        TEXT          NOT NULL,
  fecha_factura         DATE          NOT NULL,
  referencia_verifactu  TEXT,
  observaciones_internas TEXT,
  usuario_facturacion   TEXT          NOT NULL,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),

  CONSTRAINT facturas_b2b_numero_unico UNIQUE (numero_factura)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facturas_b2b_proforma  ON facturas_b2b (proforma_id);
CREATE INDEX IF NOT EXISTS idx_facturas_b2b_numero    ON facturas_b2b (numero_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_b2b_fecha     ON facturas_b2b (fecha_factura DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_b2b_usuario   ON facturas_b2b (usuario_facturacion);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE facturas_b2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturas_b2b_all"
  ON facturas_b2b FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Vista de trazabilidad completa ────────────────────────────────────────────
-- Factura → Proforma → Cliente → Albaranes
CREATE OR REPLACE VIEW v_facturas_trazabilidad AS
SELECT
  f.id                    AS factura_id,
  f.numero_factura,
  f.fecha_factura,
  f.referencia_verifactu,
  f.observaciones_internas,
  f.usuario_facturacion,
  f.created_at            AS fecha_registro,
  p.id                    AS proforma_id,
  p.periodo_mes,
  p.periodo_anio,
  p.total_final           AS proforma_total,
  c.id                    AS cliente_id,
  COALESCE(c.nombre_comercial, c.razon_social) AS cliente_nombre,
  c.nif_cif               AS cliente_nif,
  COUNT(l.id)             AS num_albaranes,
  SUM(CASE WHEN l.tipo = 'albaran' AND NOT COALESCE(l.excluida, false) THEN l.litros ELSE 0 END) AS total_litros
FROM facturas_b2b f
JOIN proformas_b2b p     ON p.id = f.proforma_id
JOIN clientes_b2b c      ON c.id = p.cliente_id
LEFT JOIN proformas_b2b_lineas l ON l.proforma_id = p.id
GROUP BY f.id, p.id, c.id;
