-- "No ahora" no es "no". Hasta hoy una cuenta solo podía estar ganada o
-- perdida, así que la que no contestaba se marcaba perdida —y se perdía de
-- verdad— o seguía recibiendo correos para siempre.
alter table abm_cuentas drop constraint if exists abm_cuentas_etapa_ck;
alter table abm_cuentas add constraint abm_cuentas_etapa_ck check (etapa in
  ('sin_tocar','en_cadencia','respondio','reunion','diagnostico','propuesta',
   'ganada','perdida','en_pausa','no_contactar'));

alter table abm_cuentas add column if not exists pausa_hasta date;
alter table abm_cuentas add column if not exists pausa_motivo text;
alter table abm_cuentas add column if not exists fatiga int default 0;
create index if not exists abm_cuentas_pausa_ix on abm_cuentas (etapa, pausa_hasta);

comment on column abm_cuentas.fatiga is
  'Toques sin respuesta acumulados. Baja la prioridad: sin esto, las mismas cuentas se comen el cupo todos los días.';
comment on column abm_cuentas.pausa_hasta is
  'Fecha en que la cuenta vuelve a la fila. Se despierta ANTES si aparece una señal (abrieron tienda, cambio de gerente).';
