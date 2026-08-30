-- Tercer canal en las secuencias: el mensaje DENTRO de Sacs.
--
-- POR QUÉ HACE FALTA
-- Correo y WhatsApp le hablan al lead donde está su atención repartida. Durante
-- una prueba gratis el mejor lugar para hablarle es el sistema que está usando:
-- ahí ya decidió poner atención, el mensaje llega en el contexto de lo que está
-- haciendo, y no cuesta ni un peso de Meta ni de SendGrid.
--
-- Outbound ya sabe entregar mensajes in-app (`inapp_campanas` →
-- `sacs3_global.campanas_inapp` vía el puente). Lo que faltaba era que una
-- SECUENCIA pudiera disparar uno para UN lead en su día N, en vez de que
-- alguien lance una campaña a mano a toda una audiencia.
--
-- CÓMO SE CONECTA, y por qué así
-- El paso no guarda contenido: apunta a una campaña de Outbound
-- (`inapp_campana_id`). La campaña es el mensaje; la secuencia decide a quién y
-- cuándo. Duplicar el contenido dentro del paso habría creado un segundo editor
-- de mensajes in-app —con su propio formato, sus propios botones y su propia
-- vista previa— que se separaría del de Outbound en la primera semana.
--
-- Cuando un lead llega a ese paso, su cuenta de SACS se agrega a
-- `audiencia.incluir_cuentas` de esa campaña y se republica. La audiencia crece
-- lead por lead en vez de resolverse por condiciones.
begin;

alter table crm_secuencia_pasos
  add column if not exists inapp_campana_id uuid references inapp_campanas(id) on delete set null;

alter table crm_secuencia_pasos drop constraint if exists crm_secuencia_pasos_canal_check;
alter table crm_secuencia_pasos add constraint crm_secuencia_pasos_canal_check
  check (canal = any (array['correo'::text, 'wa'::text, 'inapp'::text]));

-- Un paso in-app sin campaña no falla: se salta en silencio, que es el modo de
-- falla que este proyecto lleva toda la semana persiguiendo. Que la base lo
-- impida.
alter table crm_secuencia_pasos drop constraint if exists crm_secuencia_pasos_inapp_chk;
alter table crm_secuencia_pasos add constraint crm_secuencia_pasos_inapp_chk
  check (canal <> 'inapp' or inapp_campana_id is not null);

-- Campaña gobernada por una secuencia: su audiencia NO se resuelve por
-- condiciones, la va llenando el cron un lead a la vez.
alter table inapp_campanas add column if not exists origen_secuencia uuid references crm_secuencias(id) on delete set null;

comment on column inapp_campanas.origen_secuencia is
  'Si viene de una secuencia, su audiencia la llena el cron (audiencia.solo_manual) y no se debe editar desde Outbound.';

commit;
