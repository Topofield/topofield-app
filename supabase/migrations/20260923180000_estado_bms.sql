-- ============================================================================
-- Estado de los BMs: dar de baja y dar de alta — Fase 11
-- ============================================================================
-- Ver docs/prds/10-estado-bms.md.
--
-- Un punto de asentamiento tiene VIGENCIA: se mide en una visita de fecha `d`
-- si y solo si
--
--   (active_from is null or d >= active_from) and (retired_on is null or d < retired_on)
--
-- · `active_from` es la fecha de alta. Null = punto original del lugar.
-- · `retired_on` es la PRIMERA fecha en que ya no se mide (límite exclusivo).
-- · El estado «de baja» no se guarda aparte: se deriva de `retired_on`, para
--   que una columna de estado no pueda contradecir a la fecha.
--
-- Las filas existentes quedan con las tres columnas en null: puntos originales
-- y vigentes. No hay backfill.
-- ============================================================================

alter table public.settlement_points
  add column active_from       date,
  add column retired_on        date,
  add column retirement_reason text;

alter table public.settlement_points
  add constraint settlement_points_retirement_complete
    check ((retired_on is null) = (retirement_reason is null)),
  add constraint settlement_points_retirement_reason_not_blank
    check (retirement_reason is null or btrim(retirement_reason) <> ''),
  add constraint settlement_points_active_before_retired
    check (active_from is null or retired_on is null or active_from < retired_on),
  -- Un punto dado de alta no lleva C0: su línea base es su primera lectura. Con
  -- las dos, no habría respuesta a qué fecha corresponde la C0 tecleada, y el
  -- motor la fecharía en la visita 0 del lugar, antes de que el punto existiera.
  add constraint settlement_points_alta_without_c0
    check (active_from is null or initial_elevation is null);

-- --- Predicado de vigencia ---------------------------------------------------
-- Una sola expresión de la regla dentro de la base, compartida por los tres
-- triggers. Su gemela en TypeScript es `isPointActiveOn`
-- (src/lib/calculations/settlement.ts); las dos se prueban en los mismos
-- bordes: la fecha de alta SÍ es vigente, la de baja NO.

create or replace function public.point_active_on(
  p_active_from date,
  p_retired_on  date,
  p_date        date
)
returns boolean
language sql
immutable
as $$
  select (p_active_from is null or p_date >= p_active_from)
     and (p_retired_on  is null or p_date <  p_retired_on);
$$;

-- --- Invariante: ninguna lectura cae fuera de la vigencia de su punto --------
-- Hay TRES escrituras que pueden romperlo, y un trigger solo en las lecturas
-- dejaría pasar las otras dos: mover la baja de un punto o la fecha de una
-- visita por la API REST no toca `settlement_readings`. La clave publicable es
-- pública por diseño, así que la defensa de las Server Actions no basta.

-- 1. Escribir una lectura.
create or replace function public.reject_reading_outside_point_validity()
returns trigger
language plpgsql
as $$
declare
  v_date        date;
  v_active_from date;
  v_retired_on  date;
  v_code        text;
begin
  select date into v_date
  from public.settlement_visits
  where id = new.visit_id;

  select active_from, retired_on, code
    into v_active_from, v_retired_on, v_code
  from public.settlement_points
  where id = new.point_id;

  if not public.point_active_on(v_active_from, v_retired_on, v_date) then
    raise exception
      'El punto % no está vigente el %; no admite lecturas en esa visita.',
      v_code, v_date
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_readings_reject_outside_validity
  before insert or update on public.settlement_readings
  for each row execute function public.reject_reading_outside_point_validity();

-- 2. Cambiar la vigencia de un punto.
create or replace function public.reject_validity_change_orphaning_readings()
returns trigger
language plpgsql
as $$
declare
  v_date date;
begin
  select v.date into v_date
  from public.settlement_readings r
  join public.settlement_visits v on v.id = r.visit_id
  where r.point_id = new.id
    and not public.point_active_on(new.active_from, new.retired_on, v.date)
  order by v.date
  limit 1;

  if v_date is not null then
    raise exception
      'El punto % tiene una lectura el %, fuera de la vigencia nueva.',
      new.code, v_date
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_points_reject_validity_orphaning_readings
  before update of active_from, retired_on on public.settlement_points
  for each row execute function public.reject_validity_change_orphaning_readings();

-- 3. Cambiar la fecha de una visita.
create or replace function public.reject_visit_date_outside_point_validity()
returns trigger
language plpgsql
as $$
declare
  v_code text;
begin
  select p.code into v_code
  from public.settlement_readings r
  join public.settlement_points p on p.id = r.point_id
  where r.visit_id = new.id
    and not public.point_active_on(p.active_from, p.retired_on, new.date)
  order by p.code
  limit 1;

  if v_code is not null then
    raise exception
      'La visita tiene una lectura de %, que no está vigente el %.',
      v_code, new.date
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_visits_reject_date_outside_point_validity
  before update of date on public.settlement_visits
  for each row execute function public.reject_visit_date_outside_point_validity();
