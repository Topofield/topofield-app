-- Fase 44 — sin el catálogo de equipos.
--
-- El alta de la nivelación y la visita de asentamientos piden el equipo
-- escribiendo, como la poligonal desde la Fase 35, y el catálogo (Fase 25) ya
-- no lo lee ningún formulario. Se borra la tabla `equipment`; su trigger de
-- `updated_at`, su índice único y sus políticas de RLS se van con ella. Ningún
-- proceso la referenciaba: el equipo de cada uno sigue en sus columnas
-- `equipment_*`.
--
-- Va DESPUÉS del merge a `main` (doc técnica § 13): el código anterior lee
-- `equipment` en el layout de todas las páginas autenticadas.

drop table if exists public.equipment;
