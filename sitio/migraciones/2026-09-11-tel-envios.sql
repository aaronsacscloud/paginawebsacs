-- LLAMADAS INTELIGENTES · Cierre con IA: lo que se prometió mandar en la llamada.
-- Cada fila es un envío (texto + PDF) preparado a partir de `tel_conocimiento`
-- o de lo que contestó el vendedor; sale por WhatsApp si hay ventana, por
-- plantilla si no, y si no hay ni plantilla queda esperando a que el cliente
-- escriba (igual que la minuta).
create table if not exists tel_envios (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid references tel_sesion_items(id) on delete set null,
  contact_id       uuid,
  conversation_id  uuid,
  telefono         text not null,
  tema             text not null,
  detalle          text,                     -- lo que pidió exactamente, en palabras de la llamada
  texto            text,                     -- el mensaje de WhatsApp que acompaña al PDF
  pdf_url          text,
  conocimiento_id  uuid references tel_conocimiento(id) on delete set null,
  estado           text not null default 'falta' check (estado in ('falta','listo','enviado','pendiente_ventana','sin_via','fallo','omitido')),
  motivo           text,
  enviado_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists tel_envios_conv_idx on tel_envios (conversation_id) where estado = 'pendiente_ventana';
create index if not exists tel_envios_item_idx on tel_envios (item_id);

-- 11-sep (bug review): candado de envío. `enviando` es el estado mientras uno solo (latido, vendedor o webhook) lo manda.
alter table tel_envios drop constraint if exists tel_envios_estado_check;
alter table tel_envios add constraint tel_envios_estado_check check (estado in ('falta','listo','enviando','enviado','pendiente_ventana','sin_via','fallo','omitido'));
