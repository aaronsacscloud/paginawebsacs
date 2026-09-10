-- TELEFONÍA · Minuta en PDF: dónde vive el archivo y en qué va su entrega.
-- 2026-09-10
--
-- El estado del envío se guarda EN LA LLAMADA y no en una cola aparte, porque
-- una minuta pertenece a una llamada y solo a una: una tabla de pendientes
-- sería una segunda copia de la verdad que hay que mantener sincronizada.
-- Cuando el cliente escribe y se abre la ventana de 24 h, el webhook de entrada
-- busca aquí mismo las que quedaron esperando.

alter table wa_llamadas
  add column if not exists minuta_pdf_url text,
  add column if not exists minuta_pdf_at timestamptz,
  -- null = todavía no se decide · 'enviada' · 'pendiente_ventana' (se avisó y
  -- se espera a que conteste) · 'no_aplica' (sin conversación, sin WhatsApp o
  -- la regla apagada) · 'caducada' · 'fallo'
  add column if not exists minuta_envio_estado text,
  add column if not exists minuta_envio_at timestamptz,
  add column if not exists minuta_envio_motivo text;

-- El webhook de entrada pregunta «¿esta conversación tiene minutas esperando?»
-- en CADA mensaje que llega. Sin índice sería un recorrido de la tabla entera
-- por mensaje.
create index if not exists wa_llamadas_minuta_pendiente_idx
  on wa_llamadas (conversation_id)
  where minuta_envio_estado = 'pendiente_ventana';

-- ── Reglas de envío de la minuta ───────────────────────────────────────────
alter table wa_config
  add column if not exists minuta_envio_activa boolean not null default false,
  -- Plantilla con encabezado de DOCUMENTO: la única forma de mandar el PDF
  -- fuera de la ventana de 24 h. Hoy no existe ninguna aprobada; mientras no
  -- la haya, se cae al aviso de abajo.
  add column if not exists minuta_envio_plantilla_doc text,
  -- Plantilla UTILITY de aviso: «tenemos la minuta, respóndenos y te la
  -- mandamos». Al contestar se abre la ventana y el PDF sale solo.
  add column if not exists minuta_envio_plantilla_aviso text,
  -- Una minuta vieja ya no le sirve a nadie: pasados estos días, la que quedó
  -- esperando se descarta en vez de aparecer de la nada un mes después.
  add column if not exists minuta_envio_caduca_dias integer not null default 7,
  -- El texto que acompaña al PDF cuando la ventana SÍ está abierta.
  add column if not exists minuta_envio_texto text;

update wa_config set minuta_envio_texto = coalesce(minuta_envio_texto,
  'Te comparto el resumen de nuestra llamada, {{nombre}} 📄 Ahí quedaron los puntos que tocamos y los acuerdos. Cualquier cosa, respóndeme por aquí.')
where id = 1;
