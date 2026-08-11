-- ============================================================================
-- Marca de creación del proyecto demo
-- ============================================================================
-- Al confirmar su correo, un usuario nuevo recibe un proyecto de ejemplo con
-- varios procesos poligonales. Esta columna es lo que impide que se le cree dos
-- veces.
--
-- La marca se reclama con:
--
--   update public.profiles set demo_seeded_at = now()
--   where id = $1 and demo_seeded_at is null
--
-- El `and demo_seeded_at is null` hace la operación atómica: si dos peticiones
-- compiten (dos pestañas, o el callback de confirmación y una recarga), solo una
-- afecta una fila. Esa es la que crea la demo; la otra no hace nada.
--
-- Se reclama ANTES de insertar los datos, no después: si se marcara al final y
-- la inserción fallara a mitad, un reintento duplicaría lo ya insertado. Así el
-- peor caso es una cuenta sin demo, que es el mismo estado que tendría sin esta
-- funcionalidad.
-- ============================================================================

alter table public.profiles
  add column demo_seeded_at timestamptz;

comment on column public.profiles.demo_seeded_at is
  'Cuándo se creó el proyecto de ejemplo de este usuario. NULL = todavía no. Se reclama con un UPDATE condicionado a NULL para que sea atómico.';
