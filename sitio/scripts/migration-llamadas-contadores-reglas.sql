-- TELEFONÍA · Contadores de llamadas por contacto + reglas automáticas.
-- 2026-09-10
--
-- 1) Los contadores son una VISTA, no columnas denormalizadas en `contacts`.
--    Una llamada cambia de desenlace después de terminar (el veredicto de la
--    contestadora llega por otro camino), así que un contador incrementado a
--    mano se desincroniza el primer día. La vista siempre dice la verdad y no
--    hay que rellenar nada hacia atrás.
--
-- 2) Las reglas viven en `wa_config` (fila única, id=1), igual que el resto de
--    la automatización del inbox: bienvenida, horario, cadencia.

-- ── Contadores por contacto ────────────────────────────────────────────────
create or replace view v_llamadas_contacto as
select
  cv.contact_id,
  count(*)                                                            as total,
  count(*) filter (where l.direccion = 'saliente')                    as salientes,
  count(*) filter (where l.direccion = 'entrante')                    as entrantes,
  -- CONTESTADA = habló una persona. Se exige duración Y que la detección de
  -- contestadora no haya dicho «máquina»: para Twilio el buzón contesta, así
  -- que sin ese filtro tres buzones contarían como tres conversaciones.
  count(*) filter (
    where l.estado = 'terminada' and coalesce(l.duracion_seg, 0) > 0
      and coalesce(l.payload->>'answered_by', '') not like 'machine%'
  )                                                                   as contestadas,
  count(*) filter (where coalesce(l.payload->>'answered_by','') like 'machine%') as buzon,
  count(*) filter (where l.estado in ('perdida', 'rechazada', 'fallida'))         as sin_contestar,
  -- Lo que de verdad importa para decidir si insistir: cuántas veces se marcó
  -- sin conseguir hablar con nadie.
  count(*) filter (
    where l.direccion = 'saliente' and (
      l.estado in ('perdida', 'rechazada', 'fallida')
      or coalesce(l.payload->>'answered_by','') like 'machine%'
    )
  )                                                                   as intentos_fallidos,
  sum(coalesce(l.duracion_seg, 0)) filter (
    where coalesce(l.payload->>'answered_by','') not like 'machine%'
  )                                                                   as segundos_hablados,
  max(l.started_at)                                                   as ultima_llamada_at,
  max(l.started_at) filter (
    where l.estado = 'terminada' and coalesce(l.duracion_seg, 0) > 0
      and coalesce(l.payload->>'answered_by','') not like 'machine%'
  )                                                                   as ultima_contestada_at
from wa_llamadas l
join wa_conversaciones cv on cv.id = l.conversation_id
where l.canal = 'telefono' and cv.contact_id is not null
group by cv.contact_id;

comment on view v_llamadas_contacto is
  'Contadores de telefonía por contacto. Vista y no columnas: el desenlace de una llamada se corrige después de terminar (veredicto de contestadora), y un contador a mano se desincroniza.';

-- La vista se consulta por contacto en la ficha; el índice es el que la hace
-- barata cuando la tabla crezca.
create index if not exists wa_llamadas_conv_canal_idx
  on wa_llamadas (conversation_id, canal);

-- ── Reglas automáticas de llamadas ─────────────────────────────────────────
alter table wa_config
  -- Prendida/apagada desde Configuración ▸ WhatsApp ▸ Llamadas.
  add column if not exists llamadas_regla_activa boolean not null default false,
  -- Qué desenlace la dispara: 'buzon' | 'sin_contestar' | 'ambos'
  add column if not exists llamadas_regla_cuando text not null default 'ambos',
  -- El mensaje cuando la ventana de 24 h está ABIERTA (texto libre).
  add column if not exists llamadas_regla_texto text,
  -- Fuera de la ventana Meta NO deja texto libre: hace falta una plantilla
  -- UTILITY aprobada. Si está vacía, fuera de ventana no se manda nada y la
  -- nota del inbox lo dice — mejor eso que un envío que falla en silencio.
  add column if not exists llamadas_regla_plantilla text,
  -- «Si le vuelvo a marcar, que no se lo mande otra vez.»
  add column if not exists llamadas_regla_una_vez boolean not null default true,
  -- Respetar el horario de atención configurado para el inbox.
  add column if not exists llamadas_regla_horario boolean not null default true;

update wa_config set llamadas_regla_texto = coalesce(llamadas_regla_texto,
  'Hola {{nombre}} 👋 Te acabamos de marcar desde el {{numero}} y no te encontramos. '
  || 'Si quieres, lo vemos por aquí mismo por WhatsApp cuando puedas — solo respóndenos a este mensaje.')
where id = 1;
