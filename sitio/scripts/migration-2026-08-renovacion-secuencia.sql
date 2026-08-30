-- «Rumbo a la renovación»: la secuencia, sus mensajes in-app y sus pasos.
--
-- ES LA PRIMERA CADENCIA DE CLIENTE. Estrena las dos capacidades nuevas del
-- motor:
--   · `entrada.ancla = 'renovacion'` — cuenta hacia ATRÁS hacia la fecha de
--     próxima factura. Su día 1 es «faltan 90» y su último es «faltan 18».
--   · `entrada.para_clientes = true` — apaga la regla que expulsa a todo
--     cliente de toda secuencia. Sin eso el cliente salía el primer día.
--
-- LA ESCALA. El motor traduce «faltan N» a la escala normal con
-- `dia = 90 - faltan + 1`, para que el resto del bucle no tenga que saber que
-- esta corre al revés:
--     faltan 90 → día  1      faltan 40 → día 51
--     faltan 80 → día 11      faltan 33 → día 58
--     faltan 60 → día 31      faltan 25 → día 66
--     faltan 52 → día 39      faltan 18 → día 73
--     faltan 45 → día 46
--
-- EL CORTE es 76 = «faltan 15». Ahí termina y toma `arr-reminders`, que ya
-- manda el recordatorio de cobro a 30, 15 y 7 días. Los avisos del descuento
-- caen a 33 y 18 días —tres antes de cada acantilado— para no chocar con él y
-- porque avisar de un plazo el día que vence es un peor ofrecimiento.
begin;

insert into crm_secuencias (id, nombre, activa, corte_dias, objetivo, hora_inicio, hora_fin, dias_envio, entrada)
values ('11111111-2222-4333-8444-5555555555a1'::uuid, 'Rumbo a la renovación', false, 76, 'respondio', 10, 18, '[1,2,3,4,5]'::jsonb,
        '{"ancla":"renovacion","para_clientes":true,"lifecycle":["cliente"],
          "estatus":["nuevo","contactado","sin_respuesta","respondio","cotizado","negociando"],
          "filtros":[{"campo":"dias_sin_venta","op":"menor_que","valor":30}],"logica":"AND"}'::jsonb)
on conflict (id) do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Renovación · lo que ya pagas y no usas', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "Hay módulos de tu plan que no has abierto", "mensaje": "Están incluidos en lo que ya pagas — no cuestan nada extra. Vale la pena verlos antes de tu renovación: a veces el que falta es justo el que resuelve lo que hoy haces a mano.", "botones": [{"texto": "Ver mi cuenta", "accion": "modulo", "destino": "dashboard"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555a1', 'Renovación · día 11') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Renovación · sesión con consultor', 'activa', 'agenda', 'web', 'normal', 'continua',
        '{"titulo": "Media hora antes de tu renovación", "agenda_slug": "consultoria", "mensaje": "Para revisar cómo te fue este año y qué te está costando trabajo. No es soporte ni demo: es la conversación de fondo. Sin costo, y aunque al final decidas no continuar.", "botones": [{"texto": "Ver horarios", "accion": "cerrar"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555a1', 'Renovación · día 31') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Renovación · el 10% por anticipación', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Renueva antes y pagas 10% menos", "mensaje": "Renovar con 30 días de anticipación te deja un 10% de descuento; con 15, un 5%. Tu monto exacto y tus fechas límite te llegaron por correo.", "botones": [{"texto": "Quiero renovar", "accion": "whatsapp_ventas"}, {"texto": "Después", "accion": "cerrar"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555a1', 'Renovación · día 58') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Renovación · últimos días del 5%', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Quedan pocos días para el 5%", "mensaje": "Después de esta semana tu renovación va al precio normal. Nada grave — pero si ibas a renovar de todos modos, más vale que sea ahora.", "botones": [{"texto": "Renovar", "accion": "whatsapp_ventas"}, {"texto": "Después", "accion": "cerrar"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555a1', 'Renovación · día 73') on conflict do nothing;

-- ── Los pasos ──
insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, email_template_id, activo)
select '11111111-2222-4333-8444-5555555555a1', v.orden, v.dia, 'correo', t.id, true
from (values
  (10,   1, 'Renovación 1 · Tu año en números'),
  (30,  31, 'Renovación 2 · Media hora para lo que te cuesta trabajo'),
  (40,  39, 'Renovación 3 · Lo que no se ve desde afuera'),
  (50,  51, 'Renovación 4 · La última antes de tu renovación'),
  (60,  58, 'Renovación 5 · Renueva antes y te ahorras {{ahorro_10|un 10%}}'),
  (80,  73, 'Renovación 6 · Últimos días del 5%')
) as v(orden, dia, plantilla)
join email_templates t on t.nombre = v.plantilla;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, inapp_campana_id, activo)
select '11111111-2222-4333-8444-5555555555a1', v.orden, v.dia, 'inapp', ic.id, true
from (values
  (20, 11, 'Renovación · lo que ya pagas y no usas'),
  (35, 31, 'Renovación · sesión con consultor'),
  (65, 58, 'Renovación · el 10% por anticipación'),
  (85, 73, 'Renovación · últimos días del 5%')
) as v(orden, dia, campana)
join inapp_campanas ic on ic.nombre = v.campana;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
values
  ('11111111-2222-4333-8444-5555555555a1', 45, 46, 'wa', 'renovacion_sesion', true),
  ('11111111-2222-4333-8444-5555555555a1', 70, 66, 'wa', 'renovacion_descuento', true);

commit;
