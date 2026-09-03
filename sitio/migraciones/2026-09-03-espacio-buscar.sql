-- 2026-09-03 · Búsqueda de "Equipo": texto + transcripciones de audio.
--
-- PostgREST no deja hacer ilike sobre adjuntos::text, y las transcripciones
-- viven dentro de ese jsonb (arreglo de adjuntos). Una función lo resuelve en
-- una sola consulta; el trigram de texto sigue sirviendo para la parte gorda.
-- Solo la llama el servidor: sin permisos para anon/authenticated.
create or replace function espacio_buscar(p_canales uuid[], p_q text, p_limite int default 40)
returns setof espacio_mensajes
language sql stable
as $$
  select m.*
  from espacio_mensajes m
  where m.canal_id = any(p_canales)
    and m.borrado_at is null
    and (
      m.texto ilike '%' || p_q || '%'
      or exists (
        select 1 from jsonb_array_elements(m.adjuntos) a
        where a->>'transcripcion' ilike '%' || p_q || '%'
      )
    )
  order by m.created_at desc
  limit greatest(1, least(p_limite, 100));
$$;
revoke execute on function espacio_buscar(uuid[], text, int) from public, anon, authenticated;

-- Verificación esperada: proacl con postgres y service_role, sin anon.
-- select proacl from pg_proc where proname = 'espacio_buscar';
