-- «Winback · los que se fueron»: 20 pasos · 15 correo · 5 WhatsApp.
--
-- SIN MENSAJES DENTRO DE SACS, y no es un olvido. Un cliente que se fue NO
-- entra al sistema: medido sobre los 24 churned, 12 llevan más de 90 días sin
-- vender y 9 no tienen ni dato de actividad. Un mensaje in-app se quedaría
-- esperando para siempre a alguien que no va a abrir la puerta. Correo y
-- WhatsApp son los únicos canales que llegan.
--
-- EL RITMO ES LENTO A PROPÓSITO: 135 días para 20 mensajes, uno cada semana en
-- promedio. A quien ya se fue no se le persigue, se le acompaña de lejos. Y las
-- fases tienen ritmos distintos: la de escuchar es más apretada (cada 6-8 días,
-- mientras el tema está fresco) y la de la oferta más suelta (cada 10), porque
-- una decisión de volver no se toma con prisa.
--
-- LOS 5 WHATSAPP, uno por fase:
--   día  9  el director quiere hablar          (fase 1 · escuchar)
--   día 25  una frase, la que sea              (fase 1 · último intento)
--   día 45  lo que arreglamos                  (fase 2 · sin pedir nada)
--   día 87  el año sin costo                   (fase 3 · la oferta)
--   día 130 aquí le paro                       (fase 4 · la puerta)
--
-- LA SALIDA MÁS IMPORTANTE es que conteste. En cuanto responde por cualquier
-- canal, la cadencia se detiene y manda la persona: nadie que acaba de decirte
-- por qué se fue debe recibir al día siguiente el correo automático número 6.
begin;

insert into crm_secuencias (id, nombre, activa, corte_dias, objetivo, hora_inicio, hora_fin, dias_envio, entrada)
values ('11111111-2222-4333-8444-5555555555c1'::uuid, 'Winback · los que se fueron', false, 180,
        'respondio', 10, 18, '[1,2,3,4,5]'::jsonb,
        '{"para_clientes":true,"lifecycle":["churned"],
          "estatus":["nuevo","contactado","sin_respuesta","respondio","cotizado","negociando","descartado"]}'::jsonb)
on conflict (id) do nothing;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, email_template_id, activo)
select '11111111-2222-4333-8444-5555555555c1', v.orden, v.dia, 'correo', t.id, true
from (values
  ( 10,   1, 'Winback 1 · Nos dimos cuenta'),
  ( 20,   6, 'Winback 2 · Nuestro director quiere hablar contigo'),
  ( 40,  13, 'Winback 3 · No es para convencerte'),
  ( 50,  21, 'Winback 4 · Aunque sea una frase'),
  ( 70,  31, 'Winback 5 · Lo que arreglamos'),
  ( 80,  41, 'Winback 6 · Ya no dependes de nosotros'),
  (100,  53, 'Winback 7 · El acompañamiento es otro'),
  (110,  63, 'Winback 8 · Lo que hacen hoy las marcas como la tuya'),
  (120,  73, 'Winback 9 · Tus datos siguen ahí'),
  (130,  83, 'Winback 10 · Un año completo, sin costo'),
  (150,  93, 'Winback 11 · Qué significa «con acompañamiento»'),
  (160, 103, 'Winback 12 · La garantía'),
  (170, 113, 'Winback 13 · Por qué a ti'),
  (180, 123, 'Winback 14 · Sigue en pie'),
  (200, 135, 'Winback 15 · Aquí le paro')
) as v(orden, dia, plantilla)
join email_templates t on t.nombre = v.plantilla;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
values
  ('11111111-2222-4333-8444-5555555555c1',  30,   9, 'wa', 'winback_direccion',     true),
  ('11111111-2222-4333-8444-5555555555c1',  60,  25, 'wa', 'winback_una_frase',     true),
  ('11111111-2222-4333-8444-5555555555c1',  90,  45, 'wa', 'winback_cambios',       true),
  ('11111111-2222-4333-8444-5555555555c1', 140,  87, 'wa', 'winback_ano_sin_costo', true),
  ('11111111-2222-4333-8444-5555555555c1', 190, 130, 'wa', 'winback_puerta',        true);

commit;
