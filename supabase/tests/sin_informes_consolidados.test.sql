-- Fase 38: el informe de cada proceso vive en su página; la tabla de los
-- informes consolidados y su función de inmutabilidad ya no existen.
begin;
select plan(2);
select hasnt_table('public', 'reports', 'la tabla de informes consolidados no existe');
select hasnt_function('public', 'reject_update_on_report', 'ni su función de inmutabilidad');
select * from finish();
rollback;
