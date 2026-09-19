-- INBOX · marcar cuándo el último entrante fue una respuesta automática.
--
-- Pedido del dueño (19-sep-2026): una respuesta automática del negocio del
-- prospecto («gracias por contactarnos, nuestro horario es…») mandaba la
-- conversación a «No contestadas», que es la única bandeja accionable del
-- inbox. No hay nada que contestar ahí: no la escribió nadie.
--
-- Se guarda en la CONVERSACIÓN y no se calcula al vuelo porque el inbox no
-- carga mensajes: son 1000 conversaciones por pantallazo, y mirar el último
-- texto de cada una serían mil consultas por carga.
alter table wa_conversaciones add column if not exists ultimo_entrante_auto boolean not null default false;

comment on column wa_conversaciones.ultimo_entrante_auto is
  'El último mensaje entrante es una respuesta automática del negocio (bienvenida, horario). No cuenta como contacto real.';

-- Relleno de lo que ya está: mismos patrones que `lib/whatsapp/autorespuesta.ts`.
update wa_conversaciones c set ultimo_entrante_auto = true
where c.ultima_direccion = 'entrante'
  and coalesce(c.ultimo_mensaje_texto, '') ~* '(gracias por (contactarnos|escribirnos|comunicarte|tu mensaje)|horario de atenci[oó]n|(te|le) (daremos|responderemos|contestaremos) respuesta|mensaje autom[aá]tico|respuesta autom[aá]tica|en (este )?momento no podemos (responder|atender)|hemos recibido tu (mensaje|solicitud)|un asesor (se comunicar[aá]|te atender[aá]))'
  and length(coalesce(c.ultimo_mensaje_texto, '')) > 40;
