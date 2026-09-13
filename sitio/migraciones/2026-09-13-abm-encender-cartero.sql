-- 13-sep-2026 · Se enciende el cartero del ABM para el goteo de Villa Hidalgo.
--
-- Decisión del dueño (mensaje del 13-sep-2026): «usa el dominio que ya tenemos
-- que usamos para enviar correos normal». El correo en frío sale por el
-- inquilino `sacs` (aaron@news.sacscloud.com), el mismo de las campañas.
-- Riesgo asumido y avisado: una queja de spam del frío pega a la reputación
-- del remitente de casa. Lo acotan el goteo (10 cuentas/día) y el disyuntor
-- (una queja o 5% de rebotes pausa el día).
insert into abm_config (clave, valor, nota)
values ('tenant_slug', 'sacs', 'Por decisión del dueño 13-sep-2026: el correo en frío sale por el remitente normal (aaron@news.sacscloud.com)')
on conflict (clave) do update set valor = excluded.valor, nota = excluded.nota;

update abm_config
   set valor = 'no', hasta = null, nota = 'encendido por Aarón el 2026-09-13 · goteo Villa Hidalgo'
 where clave = 'pausado';
