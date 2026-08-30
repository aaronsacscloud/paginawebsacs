-- QUÉ CORREO SE MANDÓ  ·  2026-08-30
--
-- `email_sends` registra a quién, cuándo, si llegó y si lo abrieron — pero NO
-- qué se le mandó. Ni asunto, ni un pedazo del cuerpo. Los 89 envíos que hay
-- tampoco traen plantilla ni campaña (template_id y campaign_id en null los 89),
-- así que no hay de dónde deducirlo después: el dato existía solo en el momento
-- del envío y se perdía ahí.
--
-- La consecuencia en pantalla: el inbox dice «Correo «campaña»: lo abrió». La
-- palabra «campaña» es un relleno —no hay ninguna campaña— y no dice de qué
-- correo habla. Saber que abrió ALGO, sin saber qué, no sirve para retomar la
-- conversación, que es justo para lo que se mira.
--
-- Se guarda asunto + un extracto corto, no el HTML completo: el cuerpo puede
-- pesar cientos de kB por envío y lo que hace falta para reconocer el correo es
-- el asunto y sus primeras líneas.

alter table email_sends
  add column if not exists asunto  text,
  add column if not exists extracto text;

comment on column email_sends.asunto   is 'Asunto tal como salió. Se escribe al enviar: después no hay de dónde sacarlo.';
comment on column email_sends.extracto is 'Primeras ~240 letras del texto plano, para reconocer el correo sin guardar el cuerpo entero.';
