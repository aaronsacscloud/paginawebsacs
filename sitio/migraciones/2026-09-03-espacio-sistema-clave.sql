-- Equipo · canales de Sistema: los mensajes que escribe el sistema traen
-- metadata.clave (la misma clave idempotente de crm_notificaciones) para que
-- un reintento del webhook o del cron no escriba dos veces el mismo aviso.
create index if not exists espacio_mensajes_clave_idx
  on espacio_mensajes ((metadata->>'clave'))
  where metadata ? 'clave';
