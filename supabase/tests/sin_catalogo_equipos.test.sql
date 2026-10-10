-- Fase 44: sin el catálogo de equipos. El equipo de cada proceso sigue en sus
-- columnas `equipment_*`.
begin;
select plan(2);
select hasnt_table('public', 'equipment', 'la tabla del catálogo de equipos no existe');
select has_column('public', 'leveling_processes', 'equipment_brand', 'el equipo de la nivelación sigue en sus columnas');
select * from finish();
rollback;
