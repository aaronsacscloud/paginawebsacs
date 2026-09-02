-- Candado ATÓMICO de idempotencia para el envío desde el inbox: dos peticiones con la misma marca
-- (reintento del cliente mientras la primera seguía en vuelo) mandaban DOS mensajes al lead
-- (caso 2026-09-02 22:29, dos wamids distintos con el mismo idem). La reserva se inserta ANTES de mandar.
create table if not exists wa_envios_idem (
  idem text primary key,
  conversation_id uuid,
  wamid text,
  created_at timestamptz not null default now()
);
