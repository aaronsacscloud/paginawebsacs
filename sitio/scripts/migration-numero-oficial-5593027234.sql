-- 12-sep-2026 · EL NÚMERO OFICIAL DE LA EMPRESA pasa a ser +52 55 9302 7234
-- (el mismo de Twilio, así que WhatsApp y teléfono quedan en un solo número).
--
-- Se registra la línea nueva en wa_numeros para que aparezca en el inbox y en
-- Configuración. NO se pone como default todavía: en Kapso está PENDING y en
-- ese estado Meta no deja mandar ni recibir. El cambio de default va aparte,
-- cuando Kapso la reporte CONNECTED (ver scripts/migration-numero-oficial-flip.sql).
insert into wa_numeros (phone_number_id, display_phone_number, nombre, es_default, activo, pausada, calidad, tier)
values ('1379200808599446', '+52 1 55 9302 7234', 'Sacscloud', false, true, false, 'UNKNOWN', 'STANDARD')
on conflict (phone_number_id) do update set
  display_phone_number = excluded.display_phone_number,
  nombre = excluded.nombre,
  activo = true,
  pausada = false;
