-- WhatsApp dentro de «Rezagados · top of mind».
--
-- EL PROBLEMA
-- La cadencia tenía 30 pasos y los 30 eran de correo. La instrucción era
-- «mínimo 30 entre correos y WhatsApp», así que el número estaba, pero el canal
-- que más despierta a un rezagado no estaba en ninguna parte.
--
-- POR QUÉ NO SE LE PONE UN CARRIL PROPIO
-- El motor rota UN paso por carril cada vez que llega su día de la semana. Un
-- carril de WhatsApp propio dispararía un mensaje CADA SEMANA en su día, y
-- luego se agotaría — front-loaded y demasiado seguido. WhatsApp no es correo:
-- Meta lo cobra por mensaje, entra al teléfono personal, y a la tercera semana
-- seguida de mensajes de marca uno bloquea. Por eso los pasos van INTERCALADOS
-- dentro de los carriles que ya existen, en posiciones que los dejan caer en
-- las semanas 3, 6, 9 y 11 — uno cada mes aproximadamente.
--
-- LA RENUMERACIÓN
-- Los `orden` actuales son enteros consecutivos (106, 107…), así que no cabe
-- nada entre dos pasos. Se renumeran con hueco de 10 y por carril
-- (1000 lunes · 2000 miércoles · 3000 viernes), preservando el orden actual, y
-- los WhatsApp entran en los huecos. Así la próxima inserción tampoco obliga a
-- renumerar. No hay riesgo para los miembros: `enviados` se indexa por id de
-- paso, no por orden — y hoy la secuencia está apagada y sin nadie dentro.
begin;

-- ── Lunes: 1010, 1020 … 1100 ──
with l as (
  select id, row_number() over (order by orden) rn
  from crm_secuencia_pasos
  where secuencia_id = '739989ac-dd75-455c-8711-5bf76c741e18' and dia_semana = 1
)
update crm_secuencia_pasos p set orden = 1000 + l.rn * 10 from l where l.id = p.id;

-- ── Miércoles: 2010 … 2100 ──
with l as (
  select id, row_number() over (order by orden) rn
  from crm_secuencia_pasos
  where secuencia_id = '739989ac-dd75-455c-8711-5bf76c741e18' and dia_semana = 3
)
update crm_secuencia_pasos p set orden = 2000 + l.rn * 10 from l where l.id = p.id;

-- ── Viernes: 3010 … 3100 ──
with l as (
  select id, row_number() over (order by orden) rn
  from crm_secuencia_pasos
  where secuencia_id = '739989ac-dd75-455c-8711-5bf76c741e18' and dia_semana = 5
)
update crm_secuencia_pasos p set orden = 3000 + l.rn * 10 from l where l.id = p.id;

-- ── Los cuatro WhatsApp, en los huecos ──
--   2025 → 3ª vez que corre el carril del miércoles  → semana 3
--   1055 → 6ª del lunes                              → semana 6
--   3085 → 9ª del viernes                            → semana 9
--   2105 → después del último miércoles              → semana 11 (la salida)
--
-- El de la semana 11 es el que cierra: pregunta si le para. Darle una puerta
-- limpia es lo que más respuestas saca de un rezagado — y el que contesta
-- «sigue» vale más que diez que nunca dijeron nada.
insert into crm_secuencia_pasos (secuencia_id, orden, dia, dia_semana, canal, wa_plantilla, activo)
values
  ('739989ac-dd75-455c-8711-5bf76c741e18', 2025, 1, 3, 'wa', 'rezagado_curva',     true),
  ('739989ac-dd75-455c-8711-5bf76c741e18', 1055, 1, 1, 'wa', 'rezagado_novedad',   true),
  ('739989ac-dd75-455c-8711-5bf76c741e18', 3085, 1, 5, 'wa', 'rezagado_temporada', true),
  ('739989ac-dd75-455c-8711-5bf76c741e18', 2105, 1, 3, 'wa', 'rezagado_puerta',    true);

commit;
