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
insert into wa_automatizaciones (clave, activa)
values ('abm_frio', false)
on conflict (clave) do nothing;
