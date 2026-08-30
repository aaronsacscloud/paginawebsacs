-- La base para las cadencias autónomas: saber si un contacto sigue vivo, y
-- dejar que una secuencia MUEVA la etapa en vez de solo reaccionar a ella.
--
-- Hasta hoy el cron sabía de correos y WhatsApps. Pero "sin actividad de ventas"
-- es otra cosa: junta seis señales que viven en seis tablas distintas, y sin
-- unificarlas no se puede escribir la condición de los rezagados.
begin;

-- ── 1 · La última señal de vida, venga de donde venga ──────────────────────
alter table contacts
  add column if not exists ultima_actividad_venta_at timestamptz,
  add column if not exists ultima_actividad_venta_tipo text,
  add column if not exists reciclado_at timestamptz,
  add column if not exists reciclado_veces integer not null default 0;

comment on column contacts.ultima_actividad_venta_at is
  'La mas reciente de: correo enviado o abierto, WhatsApp en cualquier direccion, visita al sitio, cotizacion, reunion, o cambio de estatus. Es la vara de "sigue vivo".';
comment on column contacts.reciclado_at is
  'Cuando volvio de rezagado a lead por mostrar interes. reciclado_veces cuenta las vueltas: alguien que recicla tres veces y nunca compra no es un lead tibio, es un patron.';

create index if not exists idx_contacts_ultima_actividad on contacts (ultima_actividad_venta_at);

create or replace function public.recalcular_actividad_venta(p_contact uuid default null)
returns integer language plpgsql as $$
declare n integer;
begin
  with senales as (
    select ct.id,
      greatest(
        coalesce((select max(greatest(s.created_at, s.first_opened_at)) from email_sends s where s.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(m.created_at) from wa_conversaciones c join wa_mensajes m on m.conversation_id = c.id
                  where c.contact_id = ct.id and m.borrado_at is null), 'epoch'::timestamptz),
        coalesce((select max(v.created_at) from contact_visits v where v.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(q.created_at) from quotes q where q.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(b.created_at) from bookings b where b.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce(ct.estatus_lead_at, 'epoch'::timestamptz),
        coalesce(ct.last_contact_at, 'epoch'::timestamptz)
      ) ultima,
      -- De donde vino la ultima, para que el aviso pueda decirlo.
      (select x.tipo from (
         select 'correo' tipo, max(greatest(s.created_at, s.first_opened_at)) cuando from email_sends s where s.contact_id = ct.id
         union all select 'whatsapp', max(m.created_at) from wa_conversaciones c join wa_mensajes m on m.conversation_id = c.id where c.contact_id = ct.id and m.borrado_at is null
         union all select 'sitio web', max(v.created_at) from contact_visits v where v.contact_id = ct.id
         union all select 'cotizacion', max(q.created_at) from quotes q where q.contact_id = ct.id
         union all select 'reunion', max(b.created_at) from bookings b where b.contact_id = ct.id
       ) x where x.cuando is not null order by x.cuando desc limit 1) tipo
    from contacts ct
    where p_contact is null or ct.id = p_contact)
  update contacts c set
    ultima_actividad_venta_at   = nullif(s.ultima, 'epoch'::timestamptz),
    ultima_actividad_venta_tipo = s.tipo
  from senales s where c.id = s.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 2 · Las secuencias pueden ACTUAR, no solo reaccionar ───────────────────
alter table crm_secuencias
  add column if not exists acciones jsonb not null default '{}'::jsonb,
  add column if not exists modo text not null default 'arco';

comment on column crm_secuencias.acciones is
  'Que hace la secuencia ademas de mandar. al_entrar / al_salir: {lifecycle, marcar, inscribir_en}. Asi una cadencia puede mover a rezagado, y al salir devolver a lead reciclado y encadenar con la de seguimiento.';
comment on column crm_secuencias.modo is
  'arco = pasos por dia y termina (el modelo de siempre). permanente = goteo indefinido de novedades; no tiene corte y solo se sale mostrando interes.';

-- ── 3 · La cadencia de rezagados, ya configurada ───────────────────────────
insert into crm_secuencias (nombre, descripcion, activa, modo, objetivo, corte_dias, entrada, acciones)
select
  'Rezagados · top of mind',
  'Goteo permanente para quien lleva 30 dias sin una sola senal de vida. No busca vender: busca estar cerca cuando su momento vuelva. Solo sale mostrando interes real, y ahi regresa como lead reciclado a la cadencia de seguimiento.',
  false, 'permanente', 'respondio', 3650,
  jsonb_build_object(
    'estatus', jsonb_build_array('nuevo','contactado','sin_respuesta','respondio','descubrimiento','agendado'),
    'lifecycle', jsonb_build_array('rezagado'),
    'ancla', 'estatus_lead_at',
    'filtros', jsonb_build_array(),
    'logica', 'AND',
    'cada_dias', 14),
  jsonb_build_object(
    'al_salir', jsonb_build_object(
      'lifecycle', 'lead',
      'marcar', 'reciclado',
      'inscribir_en', 'Seguimiento a leads sin respuesta'))
where not exists (select 1 from crm_secuencias where nombre = 'Rezagados · top of mind');

commit;
-- CORRECCIÓN: estatus_lead_at NO es actividad de ventas.
--
-- Lo había incluido y está mal: ese campo cambia cuando alguien mueve un chip
-- en el CRM. Con él dentro, un lead "revive" porque un vendedor lo reetiquetó
-- —sin que el lead haya hecho absolutamente nada—, que es lo contrario de lo
-- que esta métrica debe medir. Se queda last_contact_at porque ese sí es un
-- toque real hacia afuera.
--
-- Se aprovecha para que el TIPO cubra también ese caso: antes un contacto cuyo
-- único rastro era un toque nuestro salía con fecha pero sin tipo, y el aviso
-- decía "(ninguna)" teniendo una.
create or replace function public.recalcular_actividad_venta(p_contact uuid default null)
returns integer language plpgsql as $$
declare n integer;
begin
  with senales as (
    select ct.id,
      greatest(
        coalesce((select max(greatest(s.created_at, s.first_opened_at)) from email_sends s where s.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(m.created_at) from wa_conversaciones c join wa_mensajes m on m.conversation_id = c.id
                  where c.contact_id = ct.id and m.borrado_at is null), 'epoch'::timestamptz),
        coalesce((select max(v.created_at) from contact_visits v where v.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(q.created_at) from quotes q where q.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce((select max(b.created_at) from bookings b where b.contact_id = ct.id), 'epoch'::timestamptz),
        coalesce(ct.last_contact_at, 'epoch'::timestamptz)
      ) ultima,
      (select x.tipo from (
         select 'correo' tipo, max(greatest(s.created_at, s.first_opened_at)) cuando from email_sends s where s.contact_id = ct.id
         union all select 'whatsapp', max(m.created_at) from wa_conversaciones c join wa_mensajes m on m.conversation_id = c.id where c.contact_id = ct.id and m.borrado_at is null
         union all select 'sitio web', max(v.created_at) from contact_visits v where v.contact_id = ct.id
         union all select 'cotizacion', max(q.created_at) from quotes q where q.contact_id = ct.id
         union all select 'reunion', max(b.created_at) from bookings b where b.contact_id = ct.id
         union all select 'contacto', ct.last_contact_at
       ) x where x.cuando is not null order by x.cuando desc limit 1) tipo
    from contacts ct
    where p_contact is null or ct.id = p_contact)
  update contacts c set
    ultima_actividad_venta_at   = nullif(s.ultima, 'epoch'::timestamptz),
    ultima_actividad_venta_tipo = s.tipo
  from senales s where c.id = s.id;
  get diagnostics n = row_count;
  return n;
end $$;

select public.recalcular_actividad_venta() actualizados;
-- La cadencia de rezagados se reconfigura para cerrar el ciclo SOLA.
--
-- Antes su entrada era lifecycle='rezagado', o sea que alguien tenía que mover
-- la etapa a mano primero. Ahora entra por la señal —30 días sin nada— y ELLA
-- MISMA mueve a rezagado al inscribir. Un solo mecanismo en vez de dos.
update crm_secuencias set
  entrada = jsonb_build_object(
    'estatus', jsonb_build_array('nuevo','contactado','sin_respuesta','respondio','descubrimiento'),
    'lifecycle', jsonb_build_array('lead','lead_calificado'),
    'ancla', 'estatus_lead_at',
    'logica', 'AND',
    'cada_dias', 14,
    'filtros', jsonb_build_array(
      jsonb_build_object('campo','sin_actividad','op','hace_mas','valor','30'))),
  acciones = jsonb_build_object(
    'al_entrar', jsonb_build_object('lifecycle','rezagado'),
    'al_salir', jsonb_build_object(
      'lifecycle','lead','marcar','reciclado',
      'inscribir_en','Seguimiento a leads sin respuesta'))
where nombre = 'Rezagados · top of mind';
