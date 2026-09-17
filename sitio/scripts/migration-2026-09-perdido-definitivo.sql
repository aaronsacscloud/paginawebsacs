-- «Perdido · definitivo»: la etapa del que dijo que no a volver — 17-sep-2026
--
-- APROBADO POR EL DUEÑO. Su planteamiento fue partir «Perdido» en tres:
-- en conciliación, definitivo y sin respuesta. Se hacen DOS de los tres, y el
-- tercero a propósito no es una etapa:
--
--   · «En conciliación» ya existía (`en_conciliacion`).
--   · «Definitivo» se crea aquí: es una DECISIÓN suya y cambia el trato para
--     siempre.
--   · «Sin respuesta al proceso» NO se crea. Nadie decide que alguien no ha
--     contestado: lo decide el reloj. Como etapa, alguien tendría que moverlos
--     a mano cuando pasan los días y devolverlos en cuanto contesten —no va a
--     pasar—, y encima el dato YA existe exacto en `conciliaciones.estado`.
--     Copiarlo a `lifecycle_stage` son dos verdades que se separan. Se resuelve
--     derivándolo en la pantalla de Churn.
--
-- LA REGLA CON LA QUE SE SEPARÓ: una etapa es algo que alguien DECIDE; un
-- estado es algo que PASA.
--
-- QUÉ ESTABA COSTANDO NO TENERLA. La campaña «Winback · un año sin costo»
-- entra por `lifecycle: ['churned']`, y no había forma de decirle «éste ya
-- dijo que no». Ezequiel Cruz Román apretó «Ahorita no» el 15-sep 19:01 y
-- recibió otro correo el 16-sep 19:00.

begin;

-- 1. La etapa. Va con orden 9 —pegada a «Perdido» (8) y a «En conciliación»—
--    porque los tres son el mismo tramo del ciclo: el de después del cliente.
insert into crm_lifecycle_etapas (id, nombre, orden)
values ('perdido_definitivo', 'Perdido · definitivo', 9)
on conflict (id) do nothing;

-- 2. LOS QUE YA DIJERON QUE NO. Se mueven los `churned` cuyo último mensaje
--    entrante fue un «no» de botón, exacto y completo —no un «no» dentro de una
--    frase, que puede ser «no me quedó claro»—.
--    Se apunta quiénes en `activities` para que mañana se entienda por qué
--    cambiaron solos de etapa.
with dijeron_no as (
  select distinct c.id, m.cuerpo, m.created_at
    from contacts c
    join wa_conversaciones w on w.contact_id = c.id
    join wa_mensajes m on m.conversation_id = w.id
   where c.lifecycle_stage = 'churned'
     and m.direccion = 'entrante'
     and lower(btrim(m.cuerpo)) in
         ('ahorita no','no me interesa','ya no','no gracias','no, gracias','ahora no')
)
, movidos as (
  update contacts c set lifecycle_stage = 'perdido_definitivo', updated_at = now()
    from dijeron_no d where c.id = d.id
  returning c.id, d.cuerpo
)
insert into activities (contact_id, tipo, automatico, titulo, descripcion)
select id, 'descalificado', true, 'Pasó a «Perdido · definitivo»',
       'Dijo «' || cuerpo || '» a la propuesta de volver. Se movió solo al crear la etapa (17-sep-2026).'
  from movidos;

-- 3. Y que no les llegue nada más: se para lo que tuvieran vivo.
update crm_secuencia_miembros m
   set detenida_at = now(), motivo = 'perdido definitivo: dijo que no'
  from contacts c
 where m.contact_id = c.id
   and c.lifecycle_stage = 'perdido_definitivo'
   and m.detenida_at is null;

commit;

-- Comprobación:
--   select lifecycle_stage, count(*) from contacts group by 1 order by 2 desc;
--   select count(*) from crm_secuencia_miembros m join contacts c on c.id=m.contact_id
--    where c.lifecycle_stage='perdido_definitivo' and m.detenida_at is null;  -- 0
