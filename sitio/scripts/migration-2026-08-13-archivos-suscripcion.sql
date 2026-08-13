-- Contratos y documentos de cada suscripción.
--
-- Se guarda la lista en la propia suscripción y NO los archivos: los binarios
-- van a un bucket PRIVADO de Storage. El bucket público que usan los adjuntos
-- de cotización sirve para un brochure; un contrato firmado ahí queda
-- accesible para cualquiera que tenga la liga, sin sesión.
alter table subscriptions add column if not exists archivos jsonb not null default '[]'::jsonb;
comment on column subscriptions.archivos is
  'Documentos de la suscripción: [{path, nombre, tipo, size, subido_at, subido_por}]. El path apunta al bucket privado crm-docs.';
