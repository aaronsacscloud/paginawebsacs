-- Inbox v5 (omnicanal): eventos de sistema del hilo. Aplicar a mano.
create table if not exists wa_eventos (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  tipo text not null,           -- asignada | estado | snooze | despertada
  detalle text,
  autor text,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_eventos_conv on wa_eventos(conversation_id, created_at);
