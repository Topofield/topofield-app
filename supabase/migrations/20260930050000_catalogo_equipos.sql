-- ============================================================================
-- Fase 25 — Catálogo de equipos
-- ============================================================================
-- Ver docs/prds/24-catalogo-equipos.md, sección A.
--
-- Cada usuario da de alta sus estaciones totales y sus niveles una vez y los
-- elige en cada proceso. El catálogo es una PLANTILLA (decisión del usuario
-- 1): elegir un equipo copia sus datos en las columnas `equipment_*` y de
-- precisión del proceso o de la visita, que siguen siendo la fuente del
-- informe. Ningún proceso referencia esta tabla, así que editar o borrar un
-- equipo no cambia nada de lo ya medido ni informado —el agujero por el que la
-- Fase 8 descartó una tabla referenciada por id (su decisión 2)—.
--
-- Las escalas son las de las columnas de los procesos, para que copiar nunca
-- falle. Los campos de un tipo quedan nulos en el otro.
-- ============================================================================

create table public.equipment (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid()
                              references auth.users(id) on delete cascade,
  kind                      text not null
                              check (kind in ('total_station', 'level')),
  brand                     text,
  model                     text,
  serial                    text,
  calibration_date          date,
  -- Estación total (ISO 17123-3 y -4), como en `polygonal_processes`.
  angular_precision_seconds decimal(5,1) check (angular_precision_seconds > 0),
  distance_precision_mm     decimal(4,1) check (distance_precision_mm >= 0),
  distance_precision_ppm    decimal(4,1) check (distance_precision_ppm >= 0),
  -- Nivel (ISO 17123-2), como en `leveling_processes` y `settlement_visits`.
  level_type                text check (level_type in ('automatico', 'digital')),
  km_precision_mm           decimal(4,2) check (km_precision_mm > 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Un equipo se reconoce por su marca o su modelo.
  constraint equipment_has_name check (
    coalesce(btrim(brand), '') <> '' or coalesce(btrim(model), '') <> ''
  ),
  -- Los campos del otro tipo, vacíos.
  constraint equipment_fields_match_kind check (
    (kind = 'total_station' and level_type is null and km_precision_mm is null)
    or (kind = 'level'
        and angular_precision_seconds is null
        and distance_precision_mm is null
        and distance_precision_ppm is null)
  )
);

comment on table public.equipment is
  'Catálogo de equipos del usuario (Fase 25). Plantilla: los procesos copian sus datos y no lo referencian.';

-- El mismo aparato una sola vez: misma marca, modelo y serie, sin distinguir
-- mayúsculas ni espacios de los extremos (decisión 4 del PRD).
create unique index equipment_unique_instrument on public.equipment (
  user_id,
  kind,
  lower(coalesce(btrim(brand), '')),
  lower(coalesce(btrim(model), '')),
  lower(coalesce(btrim(serial), ''))
);

create trigger equipment_set_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

alter table public.equipment enable row level security;

-- Cada usuario, solo sus equipos.
create policy "equipment_select_own" on public.equipment
  for select using (auth.uid() = user_id);

create policy "equipment_insert_own" on public.equipment
  for insert with check (auth.uid() = user_id);

create policy "equipment_update_own" on public.equipment
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "equipment_delete_own" on public.equipment
  for delete using (auth.uid() = user_id);
