-- El apagador de la cadencia de WhatsApp en frío del ABM.
--
-- Nace APAGADA, y a propósito. Es la automatización que le escribe a negocios
-- que nunca nos buscaron: tiene que encenderla una persona cuando las
-- plantillas estén aprobadas y haya decidido empezar, no aparecer encendida
-- porque se desplegó el código.
--
-- `permitido()` devuelve false si no puede leer esta tabla, así que una fila
-- faltante tampoco abre la puerta — pero es mejor que exista y se vea apagada
-- en la pantalla de automatizaciones que que nadie sepa que existe.
--
-- La categoría tiene que ser una de las que la pantalla ya agrupa (ia,
-- cadencia, inbox, cobranza, llamadas, agenda, primer_mensaje). Le puse
-- 'salientes' en el primer intento y la fila quedaba invisible: existía en la
-- base pero no en ninguna pestaña.
insert into wa_automatizaciones (clave, nombre, categoria, activa, nota)
values ('abm_frio', 'Prospección en frío (ABM)', 'cadencia', false,
        'Los 3 WhatsApp a negocios que nunca nos escribieron. Solo a números que el propio negocio publicó como WhatsApp.')
on conflict (clave) do nothing;
