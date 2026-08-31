-- ═══ Recordatorios de reunión configurables por tipo ══════════════════════
--
-- Antes había DOS recordatorios y estaban escritos en el código del cron:
-- correo a las 24 h y WhatsApp a la hora. Ni se podían cambiar, ni agregar
-- otro, ni elegir canal. Ahora cada tipo de reunión trae su propia lista.
--
-- Forma de `recordatorios` (jsonb, arreglo):
--   [{ "id": "r1", "cantidad": 1, "unidad": "dias",
--      "email": true, "whatsapp": true, "activo": true }]
--   unidad ∈ minutos | horas | dias | semanas
--
-- `confirmacion_email` / `confirmacion_whatsapp`: el aviso que sale al
-- AGENDAR (no es recordatorio: es el acuse con el link de Meet).

begin;

alter table event_types
  add column if not exists recordatorios jsonb not null default '[]'::jsonb,
  add column if not exists confirmacion_email boolean not null default true,
  add column if not exists confirmacion_whatsapp boolean not null default true;

comment on column event_types.recordatorios is
  'Arreglo de {id, cantidad, unidad, email, whatsapp, activo}. El cron los resuelve a minutos antes del inicio.';

-- Los tres que pidió el dueno, para TODOS los tipos vivos. Se escriben aqui
-- y no en el codigo: el codigo no debe traer politica de negocio, y asi se
-- pueden cambiar desde la pantalla sin volver a desplegar.
update event_types set recordatorios = jsonb_build_array(
    jsonb_build_object('id','r1','cantidad',1,'unidad','dias',    'email',true,'whatsapp',true,'activo',true),
    jsonb_build_object('id','r2','cantidad',3,'unidad','horas',   'email',true,'whatsapp',true,'activo',true),
    jsonb_build_object('id','r3','cantidad',10,'unidad','minutos','email',false,'whatsapp',true,'activo',true)
  ),
  confirmacion_email = true,
  confirmacion_whatsapp = true,
  updated_at = now()
where archived_at is null;

select nombre, jsonb_array_length(recordatorios) recordatorios, confirmacion_email, confirmacion_whatsapp
from event_types where archived_at is null order by nombre;

commit;
