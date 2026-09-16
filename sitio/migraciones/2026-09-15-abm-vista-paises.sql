-- 15-sep-2026 · Dos vistas para manejar la prospección POR PAÍS desde el CRM.
--
-- Por qué: la base de novias pasó de «México y ya» a 11 países y 3,565 cuentas
-- en pausa esperando el OK del dueño. Soltarlas, encender su goteo o ver cómo
-- va cada país se hacía con SQL a mano; eso no es una función del producto y
-- nadie más que yo podía hacerlo. Estas vistas le dan a la pantalla «Países»
-- (pestaña de Cuentas objetivo) sus números en una sola consulta, sin bajarse
-- 25 mil cuentas al navegador ni pedir un conteo por país.
--
-- Son vistas, no tablas: no guardan nada, siempre dicen la verdad de ahora.
begin;

-- ── La base por giro y país ─────────────────────────────────────────────────
-- Una fila por (giro, país): cuántas cuentas hay, cuántas esperan permiso
-- (`en_pausa`), cuántas están listas para entrar al goteo (`sin_tocar`),
-- cuántas ya andan en cadencia y por dónde se les puede escribir.
create or replace view v_abm_paises as
select
  giro,
  coalesce(nullif(trim(pais), ''), 'México') as pais,
  count(*)                                                      as cuentas,
  count(*) filter (where etapa = 'en_pausa')                    as en_pausa,
  count(*) filter (where etapa = 'sin_tocar')                   as sin_tocar,
  count(*) filter (where etapa = 'en_cadencia')                 as en_cadencia,
  count(*) filter (where etapa = 'respondio')                   as respondio,
  count(*) filter (where etapa in ('reunion','diagnostico','propuesta','ganada')) as avanzadas,
  count(*) filter (where etapa = 'no_contactar')                as no_contactar,
  count(*) filter (where tiene_email)                           as con_correo,
  count(*) filter (where tiene_wa)                              as con_wa,
  count(*) filter (where tiene_email or tiene_wa)               as contactables,
  count(*) filter (where sitio is not null)                     as con_sitio,
  count(*) filter (where coalesce(sucursales, 0) >= 5)          as cadenas,
  count(distinct ciudad)                                        as ciudades,
  round(avg(google_resenas))                                    as resenas_prom,
  max(updated_at)                                               as ultimo_movimiento
from abm_cuentas
where coalesce(ya_es_cliente, '') = ''   -- un cliente nuestro no es un prospecto
group by 1, 2;

-- ── Lo que se ha mandado, por giro, país y canal ────────────────────────────
-- El mismo corte que pide el reporte diario: cuántos toques salieron, cuántos
-- esperan en la fila, cuántos se cancelaron (una respuesta cancela el resto de
-- la cadencia: por eso `cancelado` es buena señal, no una falla) y cuándo fue
-- el último envío.
create or replace view v_abm_pais_toques as
select
  a.giro,
  coalesce(nullif(trim(a.pais), ''), 'México') as pais,
  t.canal,
  count(*)                                                            as toques,
  count(*) filter (where t.estado = 'enviado')                        as enviados,
  count(*) filter (where t.estado in ('aprobado','programado','enviando')) as en_fila,
  count(*) filter (where t.estado = 'borrador')                       as borradores,
  count(*) filter (where t.estado = 'cancelado')                      as cancelados,
  count(*) filter (where t.estado = 'rebote')                         as rebotes,
  count(distinct t.cuenta_id)                                         as cuentas,
  count(distinct t.cuenta_id) filter (where t.estado = 'enviado')     as cuentas_con_envio,
  max(t.enviado_at)                                                   as ultimo_envio
from abm_toques t
join abm_cuentas a on a.id = t.cuenta_id
group by 1, 2, 3;

commit;

select (select count(*) from v_abm_paises) filas_paises, (select count(*) from v_abm_pais_toques) filas_toques;
