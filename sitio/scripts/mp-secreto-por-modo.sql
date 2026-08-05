-- El secreto de firma del webhook es POR ENTORNO en Mercado Pago: la clave del
-- modo prueba no valida los avisos de producción. La tabla guardaba el token por
-- modo pero el secreto en una sola columna, así que al cambiar a producción se
-- seguía validando con la clave de prueba -> 401 en CADA pago real, en silencio.
alter table crm_pasarelas add column if not exists webhook_secret_prueba text;
alter table crm_pasarelas add column if not exists webhook_secret_produccion text;

-- Se copia el valor actual a AMBOS para no cambiar el comportamiento de hoy:
-- si la clave guardada era la correcta para un modo, lo sigue siendo.
update crm_pasarelas
   set webhook_secret_prueba     = coalesce(webhook_secret_prueba, webhook_secret),
       webhook_secret_produccion = coalesce(webhook_secret_produccion, webhook_secret)
 where webhook_secret is not null;

-- Un aviso rechazado por firma no dejaba rastro: MP reintentaba, se rendía, y el
-- pago nunca se registraba sin que nadie se enterara. Ahora se anota para poder
-- gritarlo en la pantalla de conexión.
create index if not exists ix_webhook_eventos_recibido on crm_webhook_eventos (recibido_at desc);
