-- ══════════════════════════════════════════════════════════════════════════════
-- INSERT clientes B2B iniciales · Helados Ludovico
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO clientes_b2b (
  razon_social, nif_cif, direccion_fiscal, email_facturacion,
  contacto_nombre, telefono,
  nombre_comercial, canal_comunicacion,
  activo, creado_por
) VALUES

-- Cliente 1: NOATHI
(
  'NOATHI',
  '03910170D',
  'C/ Embajadores, Nº 183B, 28045 Madrid',
  'pendiente@noathi.com',
  'Karol',
  '+34657032067',
  NULL,
  'whatsapp',
  true,
  'Administrador'
),

-- Cliente 2: Restaurante Albor
(
  'TRADICIONEANDO, S.L',
  'B72784010',
  'C/ de Juan Martín El Empecinado, 9, 28045 Madrid',
  'pendiente@albor.com',
  'Álvaro Ibáñez',
  '+34690103958',
  'Restaurante Albor',
  'whatsapp',
  true,
  'Administrador'
);
