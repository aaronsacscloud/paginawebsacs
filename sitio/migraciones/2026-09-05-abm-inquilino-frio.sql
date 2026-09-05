-- El remitente del correo en frío · PLANTILLA, no se corre tal cual.
--
-- El correo en frío NO puede salir por el mismo remitente que manda facturas y
-- confirmaciones de cita: en SendGrid una queja de spam suprime a nivel de
-- CUENTA, no de campaña. Un prospecto molesto dejaría sin correo a los clientes
-- que ya pagan. Por eso: subdominio propio, cuenta de SendGrid aparte, y este
-- renglón.
--
-- ANTES de correr esto hay que tener (lo hace el dueño):
--   1. El subdominio elegido (p. ej. hola.sacscloud.com) autenticado en la
--      cuenta NUEVA de SendGrid: sus CNAME de DKIM y el de retorno.
--   2. Un grupo de supresión (ASM) en esa cuenta nueva.
--   3. La dirección postal REAL (donde se pueda recibir correspondencia; una
--      oficina virtual sirve, un apartado postal no).
--   4. El buzón privacidad@sacscloud.com existiendo y siendo leído: un buzón
--      de derechos ARCO muerto es peor que no ofrecerlo.
--   5. EMAIL_REPLY_DOMAIN=crm.sacscloud.com en el entorno (ese dominio YA está
--      completo: MX a SendGrid, SPF con -all y DMARC en p=reject).
--
-- Luego se sustituyen los <marcadores> y se corre.

insert into email_tenants (
  slug, nombre, from_nombre, from_email, reply_to,
  direccion_fisica, aviso_privacidad_url, motivo_recepcion, footer_extra,
  sendgrid_domain_id, sendgrid_asm_group_id, proveedor_key_env,
  presion_max_semana, limite_diario,
  freno_umbral_quejas, freno_umbral_rebotes, freno_muestra_minima, activo
) values (
  'sacs-frio', 'Sacs', 'Aarón de Sacs', '<remitente@hola.sacscloud.com>', 'aaron@sacscloud.com',
  '<Calle y número, Colonia, C.P. #####, Alcaldía o Municipio, Estado, México>',
  'https://www.sacscloud.com/privacidad',
  -- La verdad, y además la base legal: la ley no pide consentimiento cuando el
  -- dato viene de una fuente de acceso público. Decirlo desarma la objeción
  -- antes de que se formule, y convierte un "reportar spam" en un "cancelar".
  'Recibe este correo porque su negocio publica esta dirección en su sitio o en un directorio público, y creemos que Sacs le puede servir. No compramos ni intercambiamos listas. Si prefiere que no le escribamos, cancele abajo y no volvemos a hacerlo.',
  'Sacs es una marca de <RAZÓN SOCIAL, S.A. de C.V.>. Puede ejercer sus derechos ARCO escribiendo a privacidad@sacscloud.com.',
  '<id del dominio autenticado en la cuenta NUEVA>',
  '<grupo ASM de la cuenta NUEVA>',
  'SENDGRID_API_KEY_FRIO',
  99,      -- la presión semanal no aplica al frío: el motor trae sus propios frenos
  9999,    -- el cupo lo pone la rampa de calentamiento, no el inquilino
  0.08,    -- quejas: por debajo del 0.1% que ya castiga Gmail
  3,       -- rebotes: en una lista investigada a mano, 5% ya es un desastre
  10,      -- muestra mínima: con 50, el freno estaría MUERTO hasta el día 12 de la rampa
  true
)
on conflict (slug) do nothing;

-- Y se le dice al motor cuál es su remitente. Sin esto no manda nada.
insert into abm_config (clave, valor, nota) values
  ('tenant_slug', 'sacs-frio', 'El renglón de email_tenants por el que sale el correo en frío. Nunca el de casa.')
on conflict (clave) do update set valor = excluded.valor;
