-- 2026-09-03 · "Equipo": cuántos mensajes sin leer hay por canal, en UNA consulta.
--
-- El árbol del chat pinta el contador de cada canal en cada carga: con 13
-- canales serían 13 consultas. Esta función devuelve, para una persona, los
-- canales visibles con mensajes nuevos, cuántos son y cuántos la mencionan.
-- Solo cuenta mensajes raíz (los hilos se avisan por mención/seguimiento),
-- de otros autores, no borrados, posteriores a su última lectura del canal.
create or replace function espacio_no_leidos(p_usuario uuid)
returns table (canal_id uuid, n bigint, menciones bigint, ultimo_at timestamptz)
language sql stable as $$
  select m.canal_id,
         count(*)::bigint as n,
         count(*) filter (where p_usuario = any(m.menciones))::bigint as menciones,
         max(m.created_at) as ultimo_at
  from espacio_mensajes m
  join espacio_canales c on c.id = m.canal_id
  left join espacio_lecturas l on l.canal_id = m.canal_id and l.usuario_id = p_usuario
  where m.hilo_de is null
    and m.borrado_at is null
    and m.autor_id <> p_usuario
    and c.archivado_at is null
    and (c.tipo <> 'directo' or p_usuario = any(c.participantes))
    and m.created_at > coalesce(l.ultimo_leido_at, '1970-01-01'::timestamptz)
  group by m.canal_id;
$$;

-- Solo el servidor la llama (service_role); la llave anónima no la ejecuta.
revoke execute on function espacio_no_leidos(uuid) from public, anon, authenticated;

-- Verificación esperada: una fila vacía o con contadores, sin error.
-- select * from espacio_no_leidos('9ad1b50f-0000-0000-0000-000000000000');
