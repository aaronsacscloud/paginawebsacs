-- Llamadas inteligentes · el número que ve el cliente cuando le llamamos.
-- Por omisión es el número Twilio (TWILIO_NUMERO); si el dueño verifica el
-- WhatsApp de ventas como Caller ID en Twilio, se guarda aquí y se usa en
-- todas las salientes (marcador y llamadas desde el chat).
alter table wa_config add column if not exists tel_caller_id text;
