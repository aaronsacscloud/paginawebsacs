drop view if exists v_ti_reactivacion_candidatos;
-- 2026-09-04 · Reactivación v2 (decisión del dueño): los leads que NUNCA contestaron, o que solo dijeron «hola»,
-- no se tratan igual que los que sí platicaron. Y el tamaño (sucursales) cambia lo que se les dice.
--   sin_respuesta · nunca contestó un mensaje: hay que explicarle qué es Sacs, nunca lo supo.
--   ambiguo       · contestó solo un saludo o un «ok» y nunca más: sabe que existimos, no qué hacemos.
--   conversacion  · preguntó algo concreto y se quedó a medias.
--   intencion     · pidió precio, planes o demo.
-- El reloj: si nunca contestó, cuenta desde NUESTRO último mensaje.
create or replace view v_ti_reactivacion_candidatos as
with ult as (
  select c.contact_id,
         (array_agg(c.id order by c.ultimo_mensaje_at desc nulls last))[1] conv_id,
         (array_agg(c.telefono order by c.ultimo_mensaje_at desc nulls last))[1] telefono,
         max(c.ultimo_entrante_at) ult_in,
         max(c.ultimo_mensaje_at) ult_msg,
         bool_or(exists (select 1 from wa_mensajes m where m.conversation_id = c.id and m.direccion = 'entrante'
                          and m.cuerpo ~* '(precio|cu[aá]nto|demo|cotiza|costo|mensualidad|planes?\M)')) pidio,
         coalesce(max((select count(*) from wa_mensajes m where m.conversation_id = c.id and m.direccion = 'entrante')), 0) n_entrantes,
         coalesce(max((select max(length(m.cuerpo)) from wa_mensajes m where m.conversation_id = c.id and m.direccion = 'entrante')), 0) largo_entrante
  from wa_conversaciones c
  where c.contact_id is not null and coalesce(c.interna, false) = false
  group by c.contact_id)
select k.id contact_id, k.nombre, k.email, k.lifecycle_stage, k.company_id,
       coalesce(co.nombre_comercial, co.nombre) empresa,
       u.conv_id conversation_id, u.telefono,
       coalesce(u.ult_in, u.ult_msg) ult_in,
       (extract(epoch from (now() - coalesce(u.ult_in, u.ult_msg))) / 2629800)::int meses_sin_hablar,
       u.n_entrantes, u.largo_entrante,
       case
         when u.n_entrantes = 0 then 'sin_respuesta'
         when u.pidio then 'intencion'
         when u.n_entrantes <= 2 and u.largo_entrante <= 25 then 'ambiguo'
         else 'conversacion'
       end segmento,
       coalesce(k.sucursales_interes, co.sucursales) sucursales,
       case
         when coalesce(k.sucursales_interes, co.sucursales) is null then 'desconocido'
         when coalesce(k.sucursales_interes, co.sucursales) <= 1 then 'una'
         when coalesce(k.sucursales_interes, co.sucursales) <= 5 then 'pocas'
         else 'cadena'
       end tamano,
       k.giro, co.giro giro_empresa, k.fuente
from ult u
join contacts k on k.id = u.contact_id
left join companies co on co.id = k.company_id
where k.archived_at is null
  and k.lifecycle_stage in ('lead','lead_calificado','oportunidad','rezagado')
  and coalesce(k.wa_optout, false) = false
  and coalesce(k.descarte_categoria, '') not like 'no_era_lead%'
  and coalesce((k.propiedades->>'reactivacion_excluir')::boolean, false) = false
  and coalesce(k.giro, '') !~* '(restaur|caf[eé]|taquer|comida|food|pizz|sushi|burger|hamburg|cocina|antojit|fonda|cantina|panader|pasteler|helad|jug[ou]|bebida|bar\b|cerve|mariscos|tacos)'
  and coalesce(co.giro, '') !~* '(restaur|caf[eé]|taquer|comida|food|pizz|sushi|burger|hamburg|cocina|antojit|fonda|cantina|panader|pasteler|helad|jug[ou]|bebida|bar\b|cerve|mariscos|tacos)'
  and coalesce(co.nombre_comercial, co.nombre, '') !~* '(restaur|caf[eé]|taquer|pizz|sushi|burger|hamburg|antojit|fonda|cantina|panader|pasteler|helader|mariscos|tacos)'
  -- El reloj corre desde su última señal; si nunca contestó, desde nuestro último intento.
  and coalesce(u.ult_in, u.ult_msg) is not null
  and coalesce(u.ult_in, u.ult_msg) < now() - interval '60 days'
  and coalesce(u.ult_in, u.ult_msg) > now() - interval '365 days'
  and not exists (select 1 from quotes q where q.contact_id = k.id and q.estado not in ('deleted','plantilla'))
  and not exists (select 1 from bookings b where b.contact_id = k.id and b.estado in ('asistio','confirmada','agendada'))
  and not exists (select 1 from ti_perfil p where p.contact_id = k.id and p.silenciar_ia = true)
  and not exists (select 1 from ti_reactivacion r where r.contact_id = k.id and not (r.estado = 'rechazada' and r.error = 'Todavía no: esperar' and r.decidido_at < now() - interval '60 days'))
  and not exists (select 1 from ti_perfil p2 where p2.contact_id = k.id and p2.agente_estado ? 'reenganche')
order by (u.pidio) desc, coalesce(u.ult_in, u.ult_msg) desc;
