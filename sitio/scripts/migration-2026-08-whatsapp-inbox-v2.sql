-- Inbox de WhatsApp v2 (inbox propio): no-leídos, asignación y notas internas.
-- `leida` se deriva (no_leidos > 0). Aplicar a mano, como todas.

alter table wa_conversaciones
  add column if not exists no_leidos int not null default 0,
  add column if not exists asignado_a uuid references team_members(id) on delete set null;
create index if not exists idx_wa_conv_asignado on wa_conversaciones(asignado_a);
create index if not exists idx_wa_conv_ultimo on wa_conversaciones(ultimo_mensaje_at desc);

-- Comentarios internos del equipo sobre una conversación: se ven en el hilo,
-- nunca viajan a WhatsApp.
create table if not exists wa_notas (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  autor text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_notas_conv on wa_notas(conversation_id, created_at);
