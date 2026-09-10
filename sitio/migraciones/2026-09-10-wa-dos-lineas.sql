-- Dos líneas de WhatsApp en el inbox: la nueva mexicana (default) y la +1 temporal (activa, se conserva 2-3 meses).
insert into wa_numeros (phone_number_id, display_phone_number, nombre, business_account_id, activo, es_default, webhook_id)
values ('1215290738345315', '+52 1 415 283 8733', 'Sacscloud', '1293219899080587', true, true,  'a9b22b4d-92c3-420a-9ef2-417116317b53'),
       ('1093719030485589', '+1 205 892 0417',    'Sacscloud (anterior)', '1293219899080587', true, false, 'b0b5aed8-f4e9-46d1-9dd8-203ff797f294')
on conflict (phone_number_id) do update set activo = excluded.activo, es_default = excluded.es_default, webhook_id = coalesce(wa_numeros.webhook_id, excluded.webhook_id);

-- Conversaciones sin línea con actividad desde que Kapso encendió (23-ago): todas fueron por el +1.
update wa_conversaciones set phone_number_id = '1093719030485589'
 where phone_number_id is null and ultimo_mensaje_at >= '2026-08-23';
