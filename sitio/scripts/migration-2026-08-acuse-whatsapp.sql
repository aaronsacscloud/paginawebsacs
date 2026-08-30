-- Acuse inmediato de WhatsApp, con la promesa correcta según la hora.
--
-- Sin horario configurado dentroDeHorario() devuelve true SIEMPRE, así que a
-- medianoche le habríamos dicho al lead "te contesto en unos minutos". Se fija
-- lunes a sábado de 9 a 19, hora de Ciudad de México: sábado entra porque
-- nuestros clientes son tiendas y el sábado es su día fuerte.
update wa_config set
  horario = '{"dias":[1,2,3,4,5,6],"desde":"09:00","hasta":"19:00"}'::jsonb,
  bienvenida_activa = true,
  bienvenida_texto  = 'Te leo 👋 Soy Andrea, consultora de moda en Sacs. Dame unos minutos y te contesto por aquí mismo.',
  fuera_activa = true,
  fuera_texto  = 'Te leo 👋 Soy Andrea, consultora de moda en Sacs. Ahorita ya estamos fuera de horario — te contesto en cuanto abramos, a partir de las 9 de la mañana.'
where id = 1;
