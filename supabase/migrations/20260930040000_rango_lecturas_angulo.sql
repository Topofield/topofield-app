-- ============================================================================
-- Fase 24 — Grados, minutos y segundos de cada lectura, en su rango
-- ============================================================================
-- Ver docs/prds/23-pulido.md, PU9.
--
-- El ángulo de una estación es el promedio de sus lecturas, y llega
-- normalizado: una lectura de 90°00′65″ se promedia como 90°01′05″. La regla
-- de rango miraba solo ese promedio, así que la lectura cruda se guardaba con
-- 65 segundos. El cálculo no se equivocaba —el decimal es el mismo—, pero la
-- base guardaba un DMS que nadie anotaría, y un error de tecleo pasaba sin
-- aviso. El validador (`readingDmsError`) ya lo rechaza; el CHECK lo garantiza
-- aunque se salte la acción.
--
-- Antes de añadirlo se cuentan las filas fuera de rango: si hubiera alguna,
-- la migración se detiene con un mensaje en vez de fallar con el del CHECK.
-- ============================================================================

do $$
declare
  fuera int;
begin
  select count(*) into fuera
    from public.polygonal_angle_readings
   where angle_deg not between 0 and 359
      or angle_min not between 0 and 59
      or angle_sec < 0 or angle_sec >= 60;
  if fuera > 0 then
    raise exception
      'Hay % lecturas de ángulo fuera de rango: corríjalas antes de aplicar esta migración.', fuera;
  end if;
end;
$$;

alter table public.polygonal_angle_readings
  add constraint polygonal_angle_readings_dms_range check (
    angle_deg between 0 and 359
    and angle_min between 0 and 59
    and angle_sec >= 0 and angle_sec < 60
  );
