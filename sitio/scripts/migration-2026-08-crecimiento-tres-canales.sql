-- Que las CINCO capacidades viajen por los tres canales, no solo por correo.
--
-- EL HUECO
-- Axo, Nivelación y Personalizaciones ya tenían su mensaje dentro de Sacs.
-- Empleados y Administración iban solo por correo — y son justamente las dos
-- que menos se piden solas, porque nadie busca un módulo de recursos humanos
-- dentro de un sistema de punto de venta. Son las que MÁS necesitan aparecer
-- en la pantalla donde el cliente ya está.
--
-- Y un WhatsApp más: el de nivelación. Uno por capacidad sería demasiado para
-- un cliente, así que se elige la que más dinero mueve y se manda por el canal
-- que más se lee. Quedan tres WhatsApp en setenta días, que sigue siendo poco
-- para alguien que ya te paga.
--
-- Los dos in-app nuevos llevan LAS DOS OPCIONES, igual que el resto: agendar
-- los 45 minutos o escribir. Dos botones es el máximo de una campaña y caben
-- exactos.
begin;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · tus colaboradores', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "Tu equipo también cabe en Sacs", "mensaje": "Asistencias, contratos, actas administrativas y clima laboral, en el expediente de cada quien. El día que hay que sostener una decisión con alguien, tenerlo a la mano cambia esa conversación.", "botones": [{"texto": "Que me lo enseñen", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 27') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · a dónde se fue el dinero', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Ya sabes cuánto vendiste. ¿Y cuánto gastaste?", "mensaje": "Gastos, cuentas por cobrar y por pagar, y la conciliación con tus bancos — en el mismo lugar donde ya vive la venta. «¿Este mes ganamos?» deja de contestarse con una corazonada.", "botones": [{"texto": "Ver cómo funciona", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 39') on conflict do nothing;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, inapp_campana_id, activo)
select '11111111-2222-4333-8444-5555555555b1', v.orden, v.dia, 'inapp', ic.id, true
from (values
  (42, 27, 'Crecimiento · tus colaboradores'),
  (55, 39, 'Crecimiento · a dónde se fue el dinero')
) as v(orden, dia, campana)
join inapp_campanas ic on ic.nombre = v.campana
where not exists (select 1 from crm_secuencia_pasos p where p.secuencia_id='11111111-2222-4333-8444-5555555555b1' and p.inapp_campana_id = ic.id);

-- El WhatsApp de nivelación cae en el día 50: dos después del correo, para que
-- llegue cuando el argumento todavía está fresco y no como un mensaje suelto.
insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
select '11111111-2222-4333-8444-5555555555b1', 62, 50, 'wa', 'crecimiento_nivelacion', true
where not exists (select 1 from crm_secuencia_pasos p where p.secuencia_id='11111111-2222-4333-8444-5555555555b1' and p.wa_plantilla='crecimiento_nivelacion');

commit;
