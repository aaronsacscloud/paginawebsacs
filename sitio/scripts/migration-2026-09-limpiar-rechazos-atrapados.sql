-- Limpieza de los leads que dijeron «no» y se quedaron atrapados — 16-sep-2026
--
-- El arreglo de `aplicarRechazo` / `terminarCadencia` (commit 57de7e5d) aplica
-- de aquí en adelante. Esto repara a los que ya habían caído en el hueco: los
-- que tocaron un botón de rechazo y siguieron como `lead` y dentro de una
-- secuencia activa, recibiendo correos de marketing después de decir que no.
--
-- Medido antes de correrlo: 3 personas tocaron un botón de rechazo en toda la
-- historia; 1 seguía como lead y en secuencia viva (Montse Gutiérrez, LUGU).
-- Es a propósito un barrido chico y acotado a la evidencia dura —el botón—, no
-- a texto libre: un «ahora no puedo hablar» no es un rechazo y no se toca.
--
-- Reversa: `lifecycle_stage` vuelve a 'lead' y `detenida_at` a null en las
-- filas con motivo='descalificado_retroactivo'.

with rechazos as (
  select distinct c.contact_id
  from wa_mensajes m
  join wa_conversaciones c on c.id = m.conversation_id
  where m.direccion = 'entrante'
    and m.tipo = 'button'
    and lower(trim(coalesce(m.cuerpo, ''))) in
        ('ahora no', 'no, gracias', 'no gracias', 'no me interesa', 'por ahora no', 'no por ahora')
    and c.contact_id is not null
)
update contacts ct
set lifecycle_stage = 'descalificado', updated_at = now()
from rechazos r
where ct.id = r.contact_id
  and ct.lifecycle_stage in ('lead', 'lead_calificado', 'rezagado');

with rechazos as (
  select distinct c.contact_id
  from wa_mensajes m
  join wa_conversaciones c on c.id = m.conversation_id
  where m.direccion = 'entrante'
    and m.tipo = 'button'
    and lower(trim(coalesce(m.cuerpo, ''))) in
        ('ahora no', 'no, gracias', 'no gracias', 'no me interesa', 'por ahora no', 'no por ahora')
    and c.contact_id is not null
)
update crm_secuencia_miembros sm
set detenida_at = now(), motivo = 'descalificado_retroactivo'
from rechazos r
where sm.contact_id = r.contact_id
  and sm.detenida_at is null;
