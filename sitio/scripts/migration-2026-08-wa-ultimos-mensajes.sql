-- WHATSAPP · Últimos K mensajes de N conversaciones, en UNA consulta.
-- APLICADA en Supabase (proyecto crm sacs) el 2026-08-29.
--
-- Por qué existe: el inbox precargaba el hilo de las conversaciones recientes
-- para que abrirlas fuera instantáneo, pero lo hacía con una petición a /hilo
-- POR conversación, y cada /hilo dispara media docena de consultas. Medido al
-- entrar al inbox: 7 hilos = 5.7 s de red compitiendo con la lista que el
-- usuario está esperando.
--
-- PostgREST no sabe hacer "los últimos K de cada grupo" en un solo viaje; una
-- consulta con IN + limit global se la come la conversación más parlanchina y
-- deja a las demás sin nada. La window function reparte por conversación, así
-- que el reparto es exacto.
--
-- Medido en producción: 483 mensajes de 50 conversaciones en 11.5 ms, usando
-- el índice idx_wa_msj_conv (conversation_id, created_at) que ya existía.
--
-- Es de solo lectura y aditiva: borrarla solo devuelve el inbox al camino viejo.
create or replace function wa_ultimos_mensajes(ids uuid[], k integer default 15)
returns table (
  conversation_id uuid, id uuid, direccion text, tipo text, cuerpo text,
  media_url text, media_id text, mime text, filename text, autor text,
  status text, enviado_at timestamptz, created_at timestamptz
)
language sql stable
as $$
  select t.conversation_id, t.id, t.direccion, t.tipo, t.cuerpo,
         t.media_url, t.media_id, t.mime, t.filename, t.autor,
         t.status, t.enviado_at, t.created_at
  from (
    select m.*, row_number() over (partition by m.conversation_id
                                   order by m.created_at desc) as rn
    from wa_mensajes m
    where m.conversation_id = any(ids) and m.borrado_at is null
  ) t
  where t.rn <= k;
$$;
