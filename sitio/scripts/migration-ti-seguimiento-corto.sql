-- 2026-09-04 · SEGUIMIENTO DE 1 A 4 DÍAS (decisión del dueño): prospectos a los que YA les escribimos y llevan
-- entre 20 h y 4 días sin contestar. No es el reloj de silencio (ese va por ciclos de semanas): es la ventana
-- corta, donde el seguimiento todavía se siente natural. Se clasifica la situación y se redacta el mensaje.
create or replace view v_ti_seguimiento_corto as
with ult as (
  select v.contact_id,
         max(m.created_at) filter (where m.direccion = 'saliente') as ult_sal,
         max(m.created_at) filter (where m.direccion = 'entrante') as ult_ent,
         count(*) filter (where m.direccion = 'entrante')          as n_entrantes,
         count(*)                                                   as n_mensajes
  from wa_conversaciones v
  join wa_mensajes m on m.conversation_id = v.id and m.borrado_at is null
  where v.contact_id is not null
  group by v.contact_id
)
select c.id as contact_id, c.nombre, c.lifecycle_stage, c.giro, c.email, c.whatsapp, c.owner_id, c.company_id,
       u.ult_sal, u.ult_ent, u.n_entrantes, u.n_mensajes,
       round(extract(epoch from (now() - u.ult_sal)) / 3600)::int as horas_sin_respuesta,
       (u.n_entrantes > 0) as respondio_alguna_vez,
       -- el mensaje que el reloj de silencio ya dejó en la fila (si lo hay): la clasificación decide si sirve o se reemplaza
       (select e.id from ti_envios e where e.contact_id = c.id and e.estado in ('pendiente','sugerencia') order by e.created_at desc limit 1) as envio_id,
       (select e.origen from ti_envios e where e.contact_id = c.id and e.estado in ('pendiente','sugerencia') order by e.created_at desc limit 1) as envio_origen,
       (select e.mensaje from ti_envios e where e.contact_id = c.id and e.estado in ('pendiente','sugerencia') order by e.created_at desc limit 1) as envio_mensaje
from ult u
join contacts c on c.id = u.contact_id
left join ti_perfil p on p.contact_id = c.id
where u.ult_sal is not null
  and u.ult_sal < now() - interval '20 hours'
  and u.ult_sal > now() - interval '4 days'
  and (u.ult_ent is null or u.ult_ent < u.ult_sal)          -- lo último fue nuestro: la pelota está de su lado
  and c.lifecycle_stage in ('lead', 'lead_calificado', 'oportunidad', 'rezagado')
  and coalesce(p.silenciar_ia, false) = false
  and coalesce((p.agente_estado->>'cerrado'), '') <> 'opt_out'
  and c.archived_at is null
  -- sin cita futura ni cita a la que ya asistió (ahí manda la cadena de la reunión, no esto)
  and not exists (select 1 from bookings b where b.contact_id = c.id and (b.estado = 'asistio' or (b.estado in ('agendada','confirmada') and b.fecha >= current_date)))
order by u.ult_sal desc;
