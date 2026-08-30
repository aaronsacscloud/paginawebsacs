-- La llave foránea que hacía que NINGUNA secuencia enviara nada.
--
-- EL BUG, y cómo se veía desde fuera
-- El cron de cadencias lee a sus miembros así:
--
--     supabase.from('crm_secuencia_miembros')
--       .select('id, contact_id, …, contacts(id, nombre, …)')
--
-- Ese `contacts(...)` es un JOIN de PostgREST, y PostgREST solo sabe unir dos
-- tablas si hay una LLAVE FORÁNEA declarada entre ellas.
-- `crm_secuencia_miembros` tenía FK a `crm_secuencias` pero NO a `contacts`, así
-- que la consulta devolvía:
--
--     PGRST200 · Could not find a relationship between
--     'crm_secuencia_miembros' and 'contacts' in the schema cache
--
-- Y el código hace `(miembros || [])`, que convierte ese error en una lista
-- vacía. Resultado: las secuencias ENROLABAN gente y no le mandaban nada nunca.
-- Sin excepción, sin log, sin un solo renglón en ninguna pantalla.
--
-- Medido antes de este arreglo: `activities` tenía **0** filas de tipo
-- `secuencia_envio` en toda su historia. Ni un envío. Nunca.
--
-- Por eso el correo de bienvenida de la prueba gratis, los 34 pasos de
-- rezagados y los ocho de Oportunidad estaban listos y muertos al mismo tiempo:
-- el trabajo estaba hecho y la tubería, cortada.
--
-- `on delete cascade` porque un miembro sin contacto no significa nada: si se
-- borra el contacto, su membresía se va con él.
begin;

alter table crm_secuencia_miembros
  drop constraint if exists crm_secuencia_miembros_contact_id_fkey;
alter table crm_secuencia_miembros
  add constraint crm_secuencia_miembros_contact_id_fkey
  foreign key (contact_id) references contacts(id) on delete cascade;

-- PostgREST cachea el esquema: sin esto la relación existe en la base y él
-- sigue sin verla hasta el próximo reinicio.
notify pgrst, 'reload schema';

commit;
