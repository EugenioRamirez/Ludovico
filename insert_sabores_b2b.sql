-- ══════════════════════════════════════════════════════════════════════════════
-- INSERT sabores B2B · Helados Ludovico
-- Ejecutar en: Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO sabores_b2b
  (nombre, activo, visible_b2b, categoria, precio_litro, orden_visualizacion, creado_por)
VALUES
  ('Aceite de Oliva',       true,  true, 'estandar', 11, 1,  'Administrador'),
  ('Avellana',              false, true, 'estandar', 11, 2,  'Administrador'),
  ('Avellana sin azúcar',   false, true, 'estandar', 11, 3,  'Administrador'),
  ('Café',                  false, true, 'estandar', 11, 4,  'Administrador'),
  ('Chocolate',             true,  true, 'estandar', 11, 5,  'Administrador'),
  ('Chocolate Blanco',      false, true, 'estandar', 11, 6,  'Administrador'),
  ('Chocolate sin azúcar',  false, true, 'estandar', 11, 7,  'Administrador'),
  ('Coco',                  false, true, 'estandar', 11, 8,  'Administrador'),
  ('Dulce de Leche',        false, true, 'estandar', 11, 9,  'Administrador'),
  ('Fresa',                 true,  true, 'estandar', 11, 10, 'Administrador'),
  ('Fruta de la Pasión',    true,  true, 'estandar', 11, 11, 'Administrador'),
  ('Gianduia',              false, true, 'estandar', 11, 12, 'Administrador'),
  ('Leche Merengada',       false, true, 'estandar', 11, 13, 'Administrador'),
  ('Limón',                 true,  true, 'estandar', 11, 14, 'Administrador'),
  ('Mandarina',             false, true, 'estandar', 11, 15, 'Administrador'),
  ('Mango',                 false, true, 'estandar', 11, 16, 'Administrador'),
  ('Melón',                 false, true, 'estandar', 11, 17, 'Administrador'),
  ('Mora',                  true,  true, 'estandar', 11, 18, 'Administrador'),
  ('Pasas al Ron',          true,  true, 'estandar', 11, 19, 'Administrador'),
  ('Pistacho',              true,  true, 'premium',  14, 20, 'Administrador'),
  ('Plátano',               false, true, 'estandar', 11, 21, 'Administrador'),
  ('Stracciatella',         false, true, 'estandar', 11, 22, 'Administrador'),
  ('Turrón',                false, true, 'estandar', 11, 23, 'Administrador'),
  ('Vainilla',              false, true, 'estandar', 11, 24, 'Administrador'),
  ('Violetas',              true,  true, 'estandar', 11, 25, 'Administrador'),
  ('Yogur',                 true,  true, 'estandar', 11, 26, 'Administrador');
