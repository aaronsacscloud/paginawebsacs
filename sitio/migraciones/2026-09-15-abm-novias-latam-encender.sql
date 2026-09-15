-- ══ Encender la cadencia de novias en Latinoamérica ═══════════════════════════
--
-- NO CORRER sin el OK del dueño. Es el interruptor que el reporte previo al
-- lanzamiento (15-sep-2026) le pide revisar: hasta aquí las cuentas de fuera
-- de México entraron en `en_pausa` (carga-pais.py, motivo fijo) precisamente
-- para que ningún goteo las tomara antes de tiempo, y los goteos por país
-- («Novias · Colombia», …) nacieron `pausado` en 2026-09-14-abm-novias-latam-cadencia.sql.
--
-- Qué hace, en orden:
--   1. Las cuentas cargadas por país pasan de `en_pausa` a `sin_tocar`
--      (solo las que tienen el motivo de la carga; una pausa puesta a mano
--      por un vendedor se respeta).
--   2. Los goteos «Novias · <País>» pasan a `activo` con inicio hoy: 10
--      cuentas por país por día, correo primero; el WhatsApp del guion solo
--      sale cuando la plantilla Meta esté APPROVED (abm-whatsapp.ts lo revisa
--      en cada envío, no hace falta tocar nada aquí).
--   3. El goteo «Novias · diagnóstico · Latam» se queda pausado: la ruta de
--      diagnóstico es para cuentas grandes elegidas a mano, no para el barrido.
--
-- Para apagarlo: update abm_goteo set estado='pausado' where nombre like 'Novias · %'
-- and cadencia_id='a1c0de11-0000-4000-8000-0000000a0001'; las cuentas ya en
-- cadencia terminan su guion salvo que se pausen también (abm-ritmo).

begin;

-- 1. Las cuentas de la carga por país quedan disponibles para el goteo.
with libres as (
  update abm_cuentas
     set etapa = 'sin_tocar', pausa_motivo = null, pausa_hasta = null, updated_at = now()
   where giro = 'novias'
     and pais in ('Colombia','Argentina','Chile','Perú','Ecuador','Guatemala','Costa Rica','Panamá','Uruguay','República Dominicana')
     and etapa = 'en_pausa'
     and pausa_motivo = 'Carga por país: en revisión del dueño antes de lanzar la cadencia'
   returning pais
)
select pais, count(*) liberadas from libres group by 1 order by 2 desc;

-- 2. Un goteo por país, 10 cuentas al día, desde hoy.
update abm_goteo
   set estado = 'activo', inicio = current_date, updated_at = now()
 where cadencia_id = 'a1c0de11-0000-4000-8000-0000000a0001'
   and nombre like 'Novias · %'
   and estado = 'pausado'
returning nombre, cuentas_dia, filtro;

commit;
