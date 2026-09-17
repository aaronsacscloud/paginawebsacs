-- 17-sep-2026 · Lo que hacía falta para ver la prospección sin abrir una terminal.
--
-- POR QUÉ. Esta semana pasaron tres cosas que nadie podía ver desde el CRM:
--   · 554 correos aprobados esperando y 115 ya vencidos;
--   · la cadencia de novias llevaba días escribiendo correos que NUNCA salían,
--     porque calzado y marcas se llevaban el cupo del día (40+40 contra 10);
--   · el tope real del día son ~20 correos (el dominio sigue calentando), no
--     los 320 configurados.
-- Todo eso se descubrió consultando la base a mano. Estas vistas y esta columna
-- son para que se vea en pantalla.
begin;

-- 1 · PRIORIDAD POR GOTEO ────────────────────────────────────────────────────
-- Hasta hoy el cupo se repartía por orden de llegada, y el que enrolaba más
-- ganaba. Con prioridad, el dueño decide quién va primero cuando no alcanza.
alter table abm_goteo add column if not exists prioridad smallint not null default 5;
comment on column abm_goteo.prioridad is '1 = primero en el reparto del cupo, 9 = último. Por defecto 5.';

-- 2 · LA FILA, POR GIRO ──────────────────────────────────────────────────────
-- Cuánto espera y desde cuándo. `vencidos` es lo que ya tenía que haber salido.
create or replace view v_abm_fila as
select
  a.giro,
  coalesce(nullif(trim(a.pais), ''), 'México') as pais,
  t.canal,
  count(*) filter (where t.estado = 'aprobado')                               as en_fila,
  count(*) filter (where t.estado = 'aprobado' and t.programado_at < now())   as vencidos,
  count(*) filter (where t.estado = 'borrador')                               as borradores,
  min(t.programado_at) filter (where t.estado = 'aprobado' and t.programado_at < now()) as vencido_mas_viejo,
  count(*) filter (where t.estado = 'enviado')                                as enviados,
  count(*) filter (where t.estado = 'enviado' and t.enviado_at > now() - interval '24 hours') as enviados_24h,
  max(t.enviado_at)                                                           as ultimo_envio
from abm_toques t join abm_cuentas a on a.id = t.cuenta_id
group by 1, 2, 3;

-- 3 · EL EMBUDO DE LA CADENCIA ───────────────────────────────────────────────
-- En qué correo va cada cuenta y qué pasó con cada paso: es lo que dice cuál
-- de los ocho hay que reescribir.
-- El número del correo NO sale de `paso_id` —solo 216 de 3,761 toques lo
-- traen— sino del orden en que están programados dentro de cada cuenta, que es
-- justo como los recibe el negocio.
drop view if exists v_abm_embudo;
create view v_abm_embudo as
with num as (
  select t.*, row_number() over (partition by t.cuenta_id, t.canal order by t.programado_at, t.created_at) numero
    from abm_toques t)
select
  a.giro,
  coalesce(nullif(trim(a.pais), ''), 'México') as pais,
  t.canal,
  t.numero,
  min(t.asunto) filter (where t.asunto is not null)               as asunto,
  count(*)                                                        as toques,
  count(*) filter (where t.estado = 'enviado')                    as enviados,
  count(*) filter (where t.estado = 'cancelado')                  as cancelados,
  count(*) filter (where s.opened_at is not null)                 as abiertos,
  count(*) filter (where s.clicked_at is not null)                as clics,
  count(*) filter (where s.bounced_at is not null)                as rebotes,
  count(*) filter (where s.unsubscribed_at is not null)           as bajas
from num t
join abm_cuentas a on a.id = t.cuenta_id
left join email_sends s on s.id = t.send_id
where t.numero <= 20
group by 1, 2, 3, 4;

-- 4 · LA SALUD DE LOS DATOS ──────────────────────────────────────────────────
-- Lo que esta semana se cazó a mano: cuentas sin vía, correos rotos o de
-- terceros, WhatsApp con lada de otro país, ciudades impresentables.
create or replace view v_abm_salud_datos as
with lada as (select * from (values
    ('México','52'),('España','34'),('Argentina','54'),('Colombia','57'),('Chile','56'),
    ('Perú','51'),('Ecuador','593'),('Costa Rica','506'),('Panamá','507'),('Uruguay','598'),
    ('Guatemala','502'),('República Dominicana','1')) v(pais, l))
select
  a.giro,
  coalesce(nullif(trim(a.pais), ''), 'México') as pais,
  count(*)                                                                         as cuentas,
  count(*) filter (where not a.tiene_email and not a.tiene_wa)                     as sin_via,
  count(*) filter (where a.ciudad is null or a.ciudad ~ '(^| )(de|del|la)$')       as ciudad_rara,
  count(*) filter (where exists (
      select 1 from abm_canales c where c.cuenta_id = a.id and c.tipo like 'email%'
        and c.estado <> 'invalido'
        and lower(c.valor) !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))          as correo_roto,
  count(*) filter (where exists (
      select 1 from abm_canales c join lada on lada.pais = coalesce(nullif(trim(a.pais), ''), 'México')
       where c.cuenta_id = a.id and c.tipo like 'whatsapp%' and c.estado <> 'invalido'
         and regexp_replace(c.valor, '\D', '', 'g') !~ ('^' || lada.l)))           as wa_de_otro_pais,
  count(*) filter (where a.sitio is not null and (a.sitio_http = 0 or a.sitio_http >= 400)) as sitio_caido
from abm_cuentas a
where coalesce(a.ya_es_cliente, '') = ''
group by 1, 2;

commit;

select (select count(*) from v_abm_fila) fila, (select count(*) from v_abm_embudo) embudo,
       (select count(*) from v_abm_salud_datos) salud,
       (select count(*) from abm_goteo where prioridad = 5) goteos_en_prioridad_normal;
