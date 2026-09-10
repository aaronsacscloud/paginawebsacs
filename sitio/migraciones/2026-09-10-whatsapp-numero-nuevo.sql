-- Cambio del número de WhatsApp de ventas en las plantillas de correo:
-- +1 205 892 0417 (Kapso, temporal) y +52 1 55 3663 4392 → +52 1 415 283 8733 (línea mexicana dedicada en Kapso).
update email_templates
   set bloques = replace(replace(replace(replace(bloques::text,
       'wa.me/12058920417', 'wa.me/524152838733'),
       'wa.me/5215536634392', 'wa.me/524152838733'),
       '+52 1 55 3663 4392', '+52 1 415 283 8733'),
       '55 3663 4392', '415 283 8733')::jsonb
 where bloques::text ~ '12058920417|5215536634392|3663 4392';
