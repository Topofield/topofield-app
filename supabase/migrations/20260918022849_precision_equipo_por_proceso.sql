-- ============================================================================
-- Precisión y equipo por proceso
-- ============================================================================
-- Ver docs/prds/07-precision-equipo-por-proceso.md.
--
-- El orden de precisión y el equipo vivían en `projects` y se pedían al crear
-- el proyecto, pero se deciden al levantar: un mismo proyecto puede tener una
-- poligonal de tercer orden con estación total y una nivelación de primer
-- orden con nivel digital. Peor: `reports` solo guarda ids y la página de
-- impresión leía `project.*` en vivo, así que editar el equipo reescribía
-- informes ya emitidos, incluidos los de procesos cerrados.
--
-- Al mover el dato al proceso, el congelado sale gratis: el proceso cerrado ya
-- es inmutable por trigger.
--
-- Los campos de precisión dependen del INSTRUMENTO. `angular_precision_seconds`
-- y `linear_precision` son campos de estación total (ISO 17123-3 y -4); a un
-- nivel se le pide su desviación típica en mm por km de doble nivelación
-- (ISO 17123-2). Por eso nivelación y asentamientos nunca encajaron en el
-- modelo anterior.
-- ============================================================================

-- --- 1. Poligonal: estación total ------------------------------------------

alter table public.polygonal_processes
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  -- decimal(5,1), no (4,1): el origen `projects.angular_precision_seconds`
  -- ya era decimal(5,1) y el validador del formulario viejo aceptaba hasta
  -- 9999.9. Un proyecto con un valor así (sin sentido como especificación de
  -- instrumento, pero alcanzable por el formulario) haría desbordar el
  -- UPDATE del backfill y abortar toda la migración. Ensanchar el dominio no
  -- cuesta nada y elimina esa ruta de fallo.
  add column angular_precision_seconds  decimal(5,1),
  add column distance_precision_mm      decimal(4,1),
  add column distance_precision_ppm     decimal(4,1);

comment on column public.polygonal_processes.angular_precision_seconds is
  'Precisión angular de la estación total en segundos (ISO 17123-3).';
comment on column public.polygonal_processes.distance_precision_mm is
  'Término constante de la precisión de distancia, en mm (ISO 17123-4).';
comment on column public.polygonal_processes.distance_precision_ppm is
  'Término proporcional de la precisión de distancia, en ppm (ISO 17123-4).';

-- --- 2. Nivelación: nivel --------------------------------------------------

alter table public.leveling_processes
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  add column level_type                 text
    check (level_type in ('automatico','digital')),
  add column km_precision_mm            decimal(4,2);

comment on column public.leveling_processes.km_precision_mm is
  'Desviación típica del nivel, en mm por km de doble nivelación (ISO 17123-2).';

-- --- 3. Asentamientos: nivel, por visita -----------------------------------
-- La visita ya traía `equipment` como texto libre desde la Fase 5: el módulo
-- acertó con la ubicación (el instrumento puede cambiar entre campañas) y le
-- faltaba la estructura. `operator` se conserva: es otra cosa.

alter table public.settlement_visits
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  add column level_type                 text
    check (level_type in ('automatico','digital')),
  add column km_precision_mm            decimal(4,2);

-- --- 4. Backfill desde el proyecto -----------------------------------------
-- ATENCIÓN: esto toca procesos y visitas CERRADAS, que son inmutables por
-- trigger. Se desactivan y se reactivan aquí mismo, solo para esta operación.
--
-- Por qué es legítimo: se está rellenando un dato que el proceso (o la
-- visita) SIEMPRE tuvo de forma implícita, heredado del proyecto, y que ahora
-- pasa a ser explícito. No se altera ninguna medición ni ningún resultado de
-- cierre.
--
-- Por qué esto NO es un permiso general: cualquier otra migración que quiera
-- escribir sobre procesos o visitas cerradas tiene que justificarse por su
-- cuenta. La excepción es este backfill, no el patrón.
--
-- Nombres de trigger confirmados contra pg_trigger en la base local antes de
-- escribir esto (no se asumieron del PRD): `polygonal_processes` usa el
-- patrón "_when_closed"; `leveling_processes` usa "_on_closed". Son distintos
-- a propósito, cada uno data de la migración que lo creó.
--
-- `settlement_visits` tiene DOS triggers que disparan en UPDATE y hay que
-- desactivar ambos, no solo uno: `settlement_visits_reject_update_on_closed`
-- (la visita cerrada) y `settlement_visits_reject_write_when_site_closed`
-- (el LUGAR cerrado, aunque la visita en sí siga abierta). Verificado con una
-- visita cerrada y, por separado, con un lugar cerrado: ambos casos abortan
-- el UPDATE si el trigger correspondiente sigue activo (ver task-2-report.md,
-- sección de fix). `settlement_visits_reject_delete_when_closed` es BEFORE
-- DELETE, no dispara en UPDATE, así que no se toca. `settlement_visits_set_updated_at`
-- tampoco se toca: es inofensivo y debe seguir actualizando `updated_at`.

-- --- 4a. Guarda: `linear_precision` tiene que parsear ENTERA ---------------
-- `linear_precision` era texto libre sin validación de formato, así que un
-- proyecto puede traer cualquier cosa. Antes esto se parseaba con dos
-- `substring()` independientes y sin anclar, y el fallo era silencioso y
-- peor que no migrar:
--
--   '2,5+2ppm'   -> mm = 5, ppm = 2. La coma es el separador decimal en
--                   es-CO, y el patrón viejo tomaba el «5» de después de la
--                   coma: el doble del 2.5 real, escrito sin avisar.
--   '(3 + 2) ppm'-> mm = 3, ppm = NULL. Medio registro.
--   '1000+2ppm'  -> desbordaba decimal(4,1) DENTRO de la ventana con los
--                   triggers de inmutabilidad desactivados.
--
-- Y la columna origen se borra al final de esta misma migración (§ 5), así
-- que un número mal parseado queda sin auditoría posible ni forma de
-- recuperarlo.
--
-- Por eso el criterio es: o la cadena parsea entera, o la migración aborta
-- nombrando el valor. Un formato sorpresa —incluido el decimal con coma, que
-- NO se adivina— merece atención humana, no un número inventado. Abortar
-- aquí, además, saca la ruta de desbordamiento fuera de la ventana en la que
-- los triggers están desactivados.

do $guard$
declare
  ofensivos text;
begin
  select string_agg(format('%s -> %L', id, linear_precision), ', ' order by id)
    into ofensivos
    from public.projects
   where linear_precision is not null
     and (
       -- No casa el patrón completo y anclado.
       linear_precision !~* '^\s*\d+(\.\d+)?\s*(mm)?\s*\+\s*\d+(\.\d+)?\s*ppm\s*$'
       -- O casa, pero no cabe en decimal(4,1) (máximo 999.9). El OR no
       -- cortocircuita en SQL, pero si no casa `regexp_match` devuelve NULL
       -- y el subíndice de un array nulo es NULL, no un error.
       or (regexp_match(linear_precision, '^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*\+\s*(\d+(?:\.\d+)?)\s*ppm\s*$', 'i'))[1]::numeric >= 1000
       or (regexp_match(linear_precision, '^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*\+\s*(\d+(?:\.\d+)?)\s*ppm\s*$', 'i'))[2]::numeric >= 1000
     );

  if ofensivos is not null then
    raise exception
      'projects.linear_precision con formato no reconocido o fuera de rango: %',
      ofensivos
      using hint =
        'Se esperaba «<mm>+<ppm>ppm», p. ej. "2+2ppm" o "2.5 mm + 2 ppm", con punto decimal y ambos términos por debajo de 1000. '
        'Corrija el valor en projects.linear_precision y vuelva a aplicar la migración: no se adivina el número.';
  end if;
end
$guard$;

alter table public.polygonal_processes disable trigger polygonal_processes_reject_update_when_closed;
alter table public.leveling_processes  disable trigger leveling_processes_reject_update_on_closed;

-- "2+2ppm" -> 2 y 2. UN solo `regexp_match` anclado con las DOS capturas,
-- no dos `substring()` sueltos: así los dos números salen por fuerza del
-- mismo emparejamiento de la misma cadena, y no pueden venir de sitios
-- distintos. Lo que no case ya abortó en la guarda de arriba, así que aquí
-- `lp` solo es nulo cuando `linear_precision` era nulo.
with proyecto as (
  select id,
         precision_order,
         equipment_brand,
         equipment_model,
         equipment_serial,
         equipment_calibration_date,
         angular_precision_seconds,
         regexp_match(
           linear_precision,
           '^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*\+\s*(\d+(?:\.\d+)?)\s*ppm\s*$',
           'i'
         ) as lp
    from public.projects
)
update public.polygonal_processes p
   set precision_order            = pr.precision_order,
       equipment_brand            = pr.equipment_brand,
       equipment_model            = pr.equipment_model,
       equipment_serial           = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date,
       angular_precision_seconds  = pr.angular_precision_seconds,
       distance_precision_mm      = (pr.lp)[1]::decimal,
       distance_precision_ppm     = (pr.lp)[2]::decimal
  from proyecto pr
 where pr.id = p.project_id;

update public.leveling_processes l
   set precision_order            = pr.precision_order,
       equipment_brand            = pr.equipment_brand,
       equipment_model            = pr.equipment_model,
       equipment_serial           = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date
  from public.projects pr
 where pr.id = l.project_id;
-- `level_type` y `km_precision_mm` quedan nulos: el proyecto nunca tuvo ese
-- dato y no hay de dónde derivarlo. Se capturan.

alter table public.polygonal_processes enable trigger polygonal_processes_reject_update_when_closed;
alter table public.leveling_processes  enable trigger leveling_processes_reject_update_on_closed;

-- Las visitas heredan el orden y el equipo a través del lugar. El texto libre
-- de `equipment` pasa a `equipment_model`, que es lo que suele contener.
alter table public.settlement_visits disable trigger settlement_visits_reject_update_on_closed;
alter table public.settlement_visits disable trigger settlement_visits_reject_write_when_site_closed;

update public.settlement_visits v
   set precision_order = pr.precision_order,
       equipment_brand = pr.equipment_brand,
       equipment_model = coalesce(nullif(v.equipment, ''), pr.equipment_model),
       equipment_serial = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date
  from public.sites s
  join public.projects pr on pr.id = s.project_id
 where s.id = v.site_id;

alter table public.settlement_visits enable trigger settlement_visits_reject_update_on_closed;
alter table public.settlement_visits enable trigger settlement_visits_reject_write_when_site_closed;

alter table public.settlement_visits drop column equipment;

-- --- 5. `projects` pierde las siete columnas -------------------------------

alter table public.projects
  drop column precision_order,
  drop column equipment_brand,
  drop column equipment_model,
  drop column equipment_serial,
  drop column angular_precision_seconds,
  drop column linear_precision,
  drop column equipment_calibration_date;
