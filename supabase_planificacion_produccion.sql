-- ══════════════════════════════════════════════════════════════
-- Helados Ludovico · Planificación de Producción
-- PROD-PLAN-001
-- ══════════════════════════════════════════════════════════════

-- ── 1. Tabla principal de planificaciones ─────────────────────
create table if not exists planificaciones_produccion (
  id               uuid default gen_random_uuid() primary key,
  nombre           text,
  fecha_planificacion date not null,
  fecha_objetivo   date,
  observaciones    text,
  estado           text not null default 'borrador'
                     check (estado in ('borrador','calculada','cerrada')),
  usuario_creador  text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── 2. Líneas de planificación (un sabor + litros por fila) ────
create table if not exists planificacion_lineas (
  id               uuid default gen_random_uuid() primary key,
  planificacion_id uuid not null
                     references planificaciones_produccion(id)
                     on delete cascade,
  receta_nombre    text not null,
  litros_solicitados numeric(10,2) not null check (litros_solicitados > 0),
  created_at       timestamptz default now()
);

-- ── 3. Índices ─────────────────────────────────────────────────
create index if not exists idx_plan_prod_estado
  on planificaciones_produccion(estado);

create index if not exists idx_plan_prod_fecha
  on planificaciones_produccion(fecha_planificacion desc);

create index if not exists idx_plan_lineas_plan_id
  on planificacion_lineas(planificacion_id);

-- ── 4. RLS ─────────────────────────────────────────────────────
alter table planificaciones_produccion enable row level security;
alter table planificacion_lineas        enable row level security;

create policy planificaciones_produccion_all
  on planificaciones_produccion for all
  using (true) with check (true);

create policy planificacion_lineas_all
  on planificacion_lineas for all
  using (true) with check (true);

-- ── 5. Trigger updated_at ──────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_plan_prod_updated_at
  before update on planificaciones_produccion
  for each row execute function set_updated_at();
