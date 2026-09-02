-- ════════════════════════════════════════════════════════════════════════
-- Comisiones v2 — correcciones del review + el alcance que faltaba
-- ════════════════════════════════════════════════════════════════════════
--
-- Correcciones de esquema:
--   · borrar a un miembro del equipo NO puede borrar su historial de pagos;
--   · borrar un SKU NO puede llevarse sus tarifas en silencio.
--
-- Alcance nuevo (cláusulas 4, 6, 8.3 y 8.7 del marco de colaboración):
--   · condiciones de renovación y tasa reducida;
--   · descuento por encima del tope, que sale de la comisión;
--   · override del 10% sobre las ventas de un partner reclutado;
--   · el CRM al 90%.

begin;

-- ═══ 1 · FKs que estaban mal ═══
-- El historial de comisiones es el registro de cuánto se le pagó a alguien:
-- es justo lo que hay que conservar el día que esa persona se va.
alter table comision_lineas drop constraint if exists comision_lineas_owner_id_fkey;
alter table comision_lineas add constraint comision_lineas_owner_id_fkey
  foreign key (owner_id) references team_members(id) on delete restrict;

-- Retirar un SKU con tarifas debe FALLAR y avisar, no vaciarlas sin decir nada.
alter table comision_reglas drop constraint if exists comision_reglas_plan_id_fkey;
alter table comision_reglas add constraint comision_reglas_plan_id_fkey
  foreign key (plan_id) references plans(id) on delete restrict;

-- ═══ 2 · Modelo: tope de descuento y override de partners ═══
alter table comision_modelos
  -- Hasta aquí puede descontar sin costo. Lo que se pase sale de su comisión.
  add column if not exists tope_descuento_pct   numeric not null default 35,
  -- % que gana quien RECLUTÓ a un partner, sobre las ventas de ese partner.
  -- NULL = este modelo no paga override.
  add column if not exists override_partner_pct numeric;

-- ═══ 3 · Quién reclutó a cada partner ═══
-- Es lo que permite que la venta de una persona le pague a otra.
alter table team_members
  add column if not exists reclutado_por_id uuid references team_members(id) on delete set null;

-- ═══ 4 · Evaluación anual de renovación (cláusula 4) ═══
--
-- Condición A (contacto real) es de criterio: la marca una persona.
-- Condición B (crecer 50%) se calcula sola contra lo contratado el año anterior.
-- Sin evaluación registrada NO se castiga: se asume que cumple. Un sistema que
-- baja la comisión por falta de un dato que nadie capturó es peor que no tenerlo.
create table if not exists comision_evaluaciones (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  anio          integer not null,
  condicion_a   boolean,
  base_anterior numeric not null default 0,
  vendido       numeric not null default 0,
  meta          numeric not null default 0,
  cumple_b      boolean not null default false,
  cumple        boolean,
  nota          text,
  calculado_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create unique index if not exists comision_evaluaciones_uniq on comision_evaluaciones (company_id, anio);

-- ═══ 5 · Columnas nuevas de la línea ═══
alter table comision_lineas
  -- 'venta' = la comisión de quien atiende la cuenta.
  -- 'override_partner' = el % de quien reclutó al partner que vendió.
  add column if not exists tipo                 text not null default 'venta',
  add column if not exists es_renovacion        boolean not null default false,
  add column if not exists tasa_reducida        boolean not null default false,
  add column if not exists descuento_venta_pct  numeric not null default 0,
  add column if not exists descuento_exceso     numeric not null default 0,
  add column if not exists origen_owner_id      uuid references team_members(id) on delete set null;

do $$ begin
  alter table comision_lineas add constraint comision_lineas_tipo_ck
    check (tipo in ('venta','override_partner'));
exception when duplicate_object then null; end $$;

-- El índice único pasa a incluir el tipo: un mismo pago puede generar la
-- comisión de la venta Y el override de quien reclutó al vendedor. Sin esto,
-- las dos líneas chocarían si por alguna razón cayeran en la misma persona.
drop index if exists comision_lineas_pago_owner_uniq;
create unique index if not exists comision_lineas_pago_owner_tipo_uniq
  on comision_lineas (payment_id, owner_id, tipo);

-- ═══ 6 · El CRM como producto vendible (cláusula 8.7) ═══
insert into plans (slug, nombre, descripcion, categoria, modalidades, a_la_medida, activo, orden)
values ('crm_sacs', 'CRM Sacs', 'Licencia del CRM. Lo construye la consultora: el 90% de cada venta es suyo y el 10% queda para mantenimiento y servidores del portal.', 'crm', array['anual','mensual'], true, true, 1)
on conflict (slug) do nothing;

with m as (select id from comision_modelos where es_default limit 1)
insert into comision_reglas (modelo_id, categoria, origen, pct, nota)
select m.id, 'crm', null, 90, 'CRM · participación como desarrolladora (el 10% restante va a mantenimiento y servidores)'
from m
on conflict do nothing;

-- El override del 10% sobre las ventas de un partner, en el modelo por defecto.
update comision_modelos set override_partner_pct = 10 where es_default and override_partner_pct is null;

commit;
