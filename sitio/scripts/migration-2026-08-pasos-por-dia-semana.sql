-- Pasos con día de la semana: tres pozos rotando en paralelo.
--
-- La permanente rotaba UNA lista: manda el siguiente que no haya visto. Pero la
-- cadencia de rezagados no es una lista, son tres carriles con personalidad
-- propia: lunes un insight que lo haga pensar, miércoles un tip que pueda
-- aplicar esta semana, viernes una función nueva de Sacs con su pantalla real.
--
-- Sin esto, agregar tres insights seguidos haría que le llegaran tres lunes
-- seguidos de insight y ningún tip. Cada carril avanza por su cuenta.
begin;

alter table crm_secuencia_pasos
  add column if not exists dia_semana integer;

comment on column crm_secuencia_pasos.dia_semana is
  'Solo en modo permanente: 1=lun … 7=dom. El paso pertenece al carril de ese dia y rota solo contra los suyos. Nulo = entra en la rotacion general.';

create index if not exists idx_pasos_dia_semana on crm_secuencia_pasos (secuencia_id, dia_semana) where dia_semana is not null;

-- La cadencia de rezagados manda lunes, miercoles y viernes. cada_dias baja a 1
-- porque ahora el ritmo lo pone el calendario, no el contador.
update crm_secuencias
set dias_envio = '[1,3,5]'::jsonb,
    entrada = jsonb_set(entrada, '{cada_dias}', '1'::jsonb)
where nombre = 'Rezagados · top of mind';

commit;
