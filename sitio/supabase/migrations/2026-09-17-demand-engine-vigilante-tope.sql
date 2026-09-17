-- ARREGLO · el vigilante revivía acciones sin mirar su tope de intentos.
--
-- El bug: el paso 1 de `de_tomar_acciones` regresa a 'lista' TODA acción
-- 'corriendo' con lease vencido, sin comparar `intentos` contra `max_intentos`.
-- El tope solo se aplicaba en `fallar()` (TypeScript), que corre cuando el
-- manejador lanza excepción y el worker sobrevive para reportarla.
--
-- O sea: el tope funcionaba justo en el caso en que NO hace falta, y no existía
-- en el caso para el que el vigilante fue construido — que el worker se muera
-- sin avisar. En este proyecto eso ya pasó dos veces: el OOM del servidor y los
-- despliegues de Vercel cortando crons a media ejecución.
--
-- Consecuencia: una acción que mata al worker de forma repetible entra en bucle
-- infinito. Y no es un bucle gratis: varios tipos gastan en llamadas a IA antes
-- de llegar al punto donde truenan, así que cada vuelta cuesta dinero de verdad.
-- Sin datos de producción todavía (ninguna fila con intentos > max_intentos),
-- pero es cuestión de que se caiga el worker en el momento equivocado.
--
-- El arreglo va en dos capas, a propósito:
--   · el vigilante MATA en vez de revivir lo que ya agotó sus intentos;
--   · el reparto además filtra por `intentos < max_intentos`, para que ninguna
--     otra ruta que ponga una acción en 'lista' pueda saltarse el tope.

-- Los DEFAULT se conservan: sin ellos Postgres rechaza el reemplazo, y el
-- código que llama `rpc('de_tomar_acciones', { n, lease_seg })` sin alguno de
-- los dos dejaría de funcionar.
create or replace function de_tomar_acciones(n integer default 5, lease_seg integer default 600)
returns setof de_acciones
language plpgsql
as $$
begin
  -- 1 · el worker anterior se cayó o el despliegue lo cortó.
  --     Si ya agotó sus intentos, NO se revive: se declara muerta. Revivirla es
  --     lo que convierte un fallo repetible en un bucle infinito.
  update de_acciones
     set estado = 'muerta',
         terminada_at = now(),
         lease_hasta = null,
         error = coalesce(error, '{}'::jsonb) || jsonb_build_object(
           'mensaje', 'El worker murió sin reportar y ya no quedan intentos (lease vencido).',
           'definitivo', true,
           'intento', intentos,
           'at', now()
         ),
         updated_at = now()
   where estado = 'corriendo'
     and lease_hasta is not null and lease_hasta < now()
     and intentos >= max_intentos;

  update de_acciones
     set estado = 'lista', lease_hasta = null, updated_at = now()
   where estado = 'corriendo'
     and lease_hasta is not null and lease_hasta < now()
     and intentos < max_intentos;

  -- 2 · dependencias cumplidas
  update de_acciones a
     set estado = 'lista', updated_at = now()
   where a.estado = 'pendiente'
     and (a.depende_de is null
          or exists (select 1 from de_acciones d where d.id = a.depende_de and d.estado = 'terminada'));

  -- 3 · reparte trabajo. El filtro de intentos es red de seguridad: cualquier
  --     ruta futura que ponga algo en 'lista' se topa con el mismo tope.
  return query
  with tomadas as (
    select id from de_acciones
     where estado = 'lista'
       and programada_at <= now()
       and intentos < max_intentos
     order by prioridad desc, programada_at asc
     limit greatest(n, 0)
     for update skip locked
  )
  update de_acciones a
     set estado = 'corriendo',
         iniciada_at = now(),
         lease_hasta = now() + make_interval(secs => lease_seg),
         intentos = a.intentos + 1,
         updated_at = now()
    from tomadas t
   where a.id = t.id
  returning a.*;
end;
$$;

comment on function de_tomar_acciones is
  'Reparte trabajo con candado. El vigilante MATA lo que agotó intentos en vez de revivirlo: revivir un fallo repetible es un bucle infinito que además gasta en llamadas de IA.';
