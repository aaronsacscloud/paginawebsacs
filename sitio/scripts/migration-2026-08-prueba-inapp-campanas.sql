-- Los mensajes DENTRO de Sacs de la prueba gratis.
--
-- Siete campañas de Outbound gobernadas por la secuencia: su audiencia empieza
-- VACÍA y el cron le va metiendo la cuenta de cada lead cuando llega a su día.
-- Por eso `audiencia.solo_manual` — sin esa bandera, `grupos: []` significa
-- «todas las empresas» y la primera publicación le habría llegado a las 560
-- cuentas en vez de a un lead en su día 2.
--
-- LA MEZCLA, y por qué así
--   día  2  sesión con consultor (1 de 3)   modal con calendario
--   día  4  su promoción del anual          tarjeta en inicio · NO interrumpe
--   día  6  sesión con consultor (2 de 3)   modal con calendario
--   día  9  sesión con consultor (3 de 3)   modal con calendario
--   día 11  pregunta por WhatsApp           banner · deja de pedir cita
--   día 13  contratar con el 35%            modal de compra con precio
--   día 14  último día                      banner
--
-- Las tres sesiones NO repiten el mismo texto. Tres veces la misma frase se lee
-- como un robot y la tercera ya no se abre: cambia el pretexto —arrancas, vas a
-- la mitad, te queda poco— aunque la oferta sea la misma.
--
-- En el día 11 se deja de pedir cita y se pide la DUDA. Quien no agendó tres
-- veces no va a agendar la cuarta; lo que sí hace es escribir una pregunta
-- concreta si se la piden así.
--
-- La promoción del anual entra en el día 4 y no al final: que la conozca
-- mientras prueba —no el último día, cuando ya suena a rescate.
begin;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · sesión con consultor (1 de 3)', 'activa', 'agenda', 'web', 'normal', 'continua',
        '{"titulo": "Media hora para revisar tus procesos", "mensaje": "Estás arrancando tu prueba. Antes de que captures nada, vale la pena revisar juntos cómo trabajas hoy: qué vendes, cuántas sucursales tienes y de dónde sale tu inventario. Con eso te decimos por dónde empezar en vez de que lo adivines.", "agenda_slug": "consultoria", "botones": [{"texto": "Ver horarios", "accion": "cerrar"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 2')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · tu promoción del anual', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "Tu prueba trae 35% en el pago anual", "mensaje": "Si al terminar decides quedarte y contratas el año completo de tu primera sucursal, el descuento ya está reservado a tu nombre. No hay que pedirlo ni negociarlo — te lo decimos ahora para que lo tengas en cuenta mientras pruebas, no el último día.", "botones": [{"texto": "Ver los planes", "accion": "url_sacs", "destino": "https://www.sacscloud.com/precios"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 4')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · sesión con consultor (2 de 3)', 'activa', 'agenda', 'web', 'normal', 'continua',
        '{"titulo": "¿Cómo te está yendo?", "mensaje": "Vas a la mitad de tu prueba. Es el mejor momento para una sesión: ya tienes datos tuyos adentro, así que en vez de explicarte el sistema podemos revisar TU catálogo y TU forma de vender. Media hora, sin costo.", "agenda_slug": "consultoria", "botones": [{"texto": "Ver horarios", "accion": "cerrar"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 6')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · sesión con consultor (3 de 3)', 'activa', 'agenda', 'web', 'normal', 'continua',
        '{"titulo": "Lo que falta, en media hora", "mensaje": "Te quedan pocos días. Si hay algo que no acabaste de configurar —tallas, sucursales, tu primera orden de compra— lo dejamos listo en una sesión en vez de que te quedes con la duda.", "agenda_slug": "consultoria", "botones": [{"texto": "Ver horarios", "accion": "cerrar"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 9')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · pregunta por WhatsApp', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "¿Te atoraste en algo?", "mensaje": "No hace falta agendar nada. Escríbenos la duda concreta por WhatsApp y te contestamos ahí mismo: cómo cargar tus tallas, cómo abrir caja, cómo ver existencias por sucursal — lo que sea.", "botones": [{"texto": "Mandar mi duda", "accion": "whatsapp_ventas"}, {"texto": "Ahora no", "accion": "cerrar"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 11')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · contratar con el 35%', 'activa', 'compra', 'web', 'normal', 'continua',
        '{"titulo": "Quédate con 35% en el año", "mensaje": "Tu prueba termina pronto. Contratando el pago anual de tu primera sucursal conservas todo lo que ya cargaste —tu catálogo, tus clientes, tus ventas— y no vuelves a empezar de cero.", "oferta": {"concepto": "Primera sucursal, pago anual con 35% de descuento", "plan_slug": null, "monto_base": 0, "descuento_pct": 35}, "botones": [{"texto": "Contratar", "accion": "cerrar"}, {"texto": "Tengo una duda", "accion": "whatsapp_ventas"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 13')
on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Prueba · último día', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Mañana termina tu prueba", "mensaje": "Si necesitas más tiempo, dínoslo y te lo damos: es preferible que decidas bien a que decidas rápido. Y si ya lo tienes claro, tu 35% del anual sigue en pie.", "botones": [{"texto": "Necesito más días", "accion": "whatsapp_ventas"}, {"texto": "Quiero contratar", "accion": "url_sacs", "destino": "https://www.sacscloud.com/precios"}]}'::jsonb,
        '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb,
        '{"tipo":"todos"}'::jsonb, 'cc275288-213f-4acd-958b-564c2afacda1',
        'Prueba gratis · día 14')
on conflict do nothing;

commit;
-- La oferta necesita un precio de verdad, no un 0.
--
-- Se ancla al plan `controla` porque es el que más contratan las marcas de moda
-- (40 de 87 clientes activos; `fideliza` 27, `vende` 18). El precio sale del
-- catálogo vivo (`plans`), no de un número escrito a mano que se quedaría viejo
-- la próxima vez que cambien las tarifas.
--
-- Y el texto lo dice: es el plan más contratado, no «tu» plan. Enseñar un
-- precio como si ya estuviera decidido, a alguien que todavía está probando,
-- es la forma más rápida de que cierre el modal.
update inapp_campanas
   set contenido = jsonb_set(
         jsonb_set(contenido, '{oferta,plan_slug}', '"controla"'::jsonb),
         '{mensaje}',
         to_jsonb('Tu prueba termina pronto. Contratando el pago anual conservas todo lo que ya cargaste —tu catálogo, tus clientes, tus ventas— y no vuelves a empezar de cero. Abajo va el plan Controla, que es el que más contratan las marcas de moda; si el tuyo es otro, dínoslo y lo ajustamos.'::text)),
       updated_at = now()
 where nombre = 'Prueba · contratar con el 35%';
