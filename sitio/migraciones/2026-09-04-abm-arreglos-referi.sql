-- Arreglos del referí de marketing de cuentas (4-sep-2026).

-- 1. Direcciones rotas: seis truncadas sin dominio venían marcadas confianza ALTA.
--    SendGrid las rechaza, el disyuntor cuenta 6 rebotes y el sistema se apaga solo
--    el primer día, antes de mandar un correo bueno.
update abm_canales set estado='invalido', confianza='baja'
 where tipo like 'email%' and valor !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$';

-- 2. A un cliente que ya paga NO se le manda correo en frío. Es el peor correo posible.
update abm_cuentas set etapa='no_contactar' where ya_es_cliente is not null and etapa <> 'ganada';

-- 3. El Reply-To del CRM era un gmail personal. From en un dominio y Reply-To en un
--    buzón gratuito es una de las heurísticas más viejas de suplantación, y al prospecto
--    que revisa el remitente le parece un cobrador, no un proveedor de software.
update email_tenants set reply_to='aaron@sacscloud.com'
 where slug='sacs' and (reply_to is null or reply_to like '%gmail.com');

-- 4. El disyuntor se apagaba y nadie lo volvía a encender. Ahora la pausa automática
--    lleva fecha y el cartero la levanta solo al día siguiente.
alter table abm_config add column if not exists hasta date;
update abm_config set nota = 'si | no | auto (auto se levanta solo al día siguiente)' where clave='pausado';

-- 5. La columna que el motor ya usa pero la migración no declaraba.
alter table abm_plantillas add column if not exists ruta text not null default 'demo';

-- 6. El hilo del correo: para poder contestar dentro de la misma conversación.
alter table abm_toques add column if not exists hilo_mensaje_id text;
alter table abm_toques add column if not exists token text;
create index if not exists abm_toques_token_ix on abm_toques (token);
