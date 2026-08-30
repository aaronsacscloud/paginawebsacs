-- «Crecimiento · lo que sigue»: la secuencia de expansión para clientes.
--
-- SEGUNDA cadencia de cliente, después de la de renovación. Usa
-- `entrada.para_clientes` por la misma razón: sin eso el motor los expulsa el
-- primer día con motivo «convertido».
--
-- EL ANCLA es la de por omisión —la fecha en que el cliente ENTRA a la
-- secuencia—, no una fecha suya del pasado. Con `created_at` todos los clientes
-- actuales aparecerían en su día 500 y recibirían los siete correos de golpe;
-- así cada uno camina su propio arco de setenta días desde que entra.
--
-- QUIÉN ENTRA: clientes que están OPERANDO. El filtro pide menos de 15 días sin
-- vender. A quien no está usando el sistema no se le ofrece más sistema — ese
-- va a la cadencia de cuenta dormida, que es otra conversación.
--
-- LAS DOS OPCIONES en todos los pasos: agendar la «Sesión de crecimiento» (45
-- min, tipo de reunión propio) o escribir por WhatsApp. Quien prefiere hablar
-- agenda; quien prefiere escribir, escribe. Obligar a una sola pierde a la
-- mitad — y de una cadencia de expansión, la mitad que se pierde suele ser la
-- que ya te iba a comprar.
begin;

insert into crm_secuencias (id, nombre, activa, corte_dias, objetivo, hora_inicio, hora_fin, dias_envio, entrada)
values ('11111111-2222-4333-8444-5555555555b1'::uuid, 'Crecimiento · lo que sigue', false, 120, 'respondio', 10, 18, '[1,2,3,4,5]'::jsonb,
        '{"para_clientes":true,"lifecycle":["cliente"],
          "estatus":["nuevo","contactado","sin_respuesta","respondio","cotizado","negociando"],
          "filtros":[{"campo":"dias_sin_venta","op":"menor_que","valor":15}],"logica":"AND"}'::jsonb)
on conflict (id) do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · qué más puede hacer Sacs', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "Lo estás usando bien. Hay más.", "mensaje": "Te vamos a ir mostrando lo que Sacs también puede hacer por tu operación: automatizar con IA, llevar a tus colaboradores, administrar gastos y cobranza, o decirte qué mover entre sucursales. Son extensiones de tu plan — lo que implica cada una lo vemos contigo.", "botones": [{"texto": "Agendar 45 minutos", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar por WhatsApp", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 1') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · el asistente que ejecuta', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Axo puede hacerlo por ti", "mensaje": "No te explica dónde está el botón: te lleva a la pantalla, y si se lo pides, lo configura él. Con los mismos permisos que ya tienes.", "botones": [{"texto": "Que me lo enseñen", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 15') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · qué mover y qué comprar', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Antes de comprar, acomodar", "mensaje": "La nivelación te dice qué transferir entre tus sucursales y qué pedirle al proveedor de verdad — después de haber movido lo que ya pagaste.", "botones": [{"texto": "Ver cómo funciona", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 52') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · un proceso tuyo, automatizado', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "¿Qué haces a mano cada semana?", "mensaje": "Casi cualquier flujo de tu negocio se puede automatizar dentro de Sacs: una autorización, un aviso, un documento que hoy se llena a mano. Cuéntanos cuál es el tuyo.", "botones": [{"texto": "Contarlo en una sesión", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Contarlo por WhatsApp", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 68') on conflict do nothing;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, email_template_id, activo)
select '11111111-2222-4333-8444-5555555555b1', v.orden, v.dia, 'correo', t.id, true
from (values
  (10,  1, 'Crecimiento 1 · Lo estás usando bien'),
  (30, 12, 'Crecimiento 2 · Axo hace el trabajo, no te lo explica'),
  (40, 24, 'Crecimiento 3 · Tus colaboradores, en un lugar'),
  (50, 36, 'Crecimiento 4 · A dónde se fue el dinero'),
  (60, 48, 'Crecimiento 5 · Que el sistema te diga qué mover'),
  (70, 60, 'Crecimiento 6 · Si tu proceso es distinto, se programa'),
  (90, 72, 'Crecimiento 7 · ¿Alguno te movió?')
) as v(orden, dia, plantilla)
join email_templates t on t.nombre = v.plantilla;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, inapp_campana_id, activo)
select '11111111-2222-4333-8444-5555555555b1', v.orden, v.dia, 'inapp', ic.id, true
from (values
  (15,  1, 'Crecimiento · qué más puede hacer Sacs'),
  (35, 15, 'Crecimiento · el asistente que ejecuta'),
  (65, 52, 'Crecimiento · qué mover y qué comprar'),
  (85, 68, 'Crecimiento · un proceso tuyo, automatizado')
) as v(orden, dia, campana)
join inapp_campanas ic on ic.nombre = v.campana;

-- WhatsApp solo dos veces en setenta días: es cliente, no lead. Uno a media
-- serie y otro al final, cuando ya vio todo y toca preguntar cuál le movió.
insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
values
  ('11111111-2222-4333-8444-5555555555b1', 45, 30, 'wa', 'crecimiento_sesion', true),
  ('11111111-2222-4333-8444-5555555555b1', 80, 66, 'wa', 'crecimiento_proceso', true);

commit;
