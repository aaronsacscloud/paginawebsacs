-- 2026-09-03 · Seguimiento: paridad 9/10 antes de la autonomía.
-- Cada sugerencia del agente que un consultor decide (enviar tal cual, modificar, rechazar)
-- o que el humano contestó por su cuenta deja UNA calificación. El promedio de las últimas
-- N (ventana, default 300) contra la meta (default 9.0) decide cuándo el agente responde solo.
create table if not exists ti_calificaciones (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references ti_envios(id) on delete set null,
  contact_id uuid,
  conversation_id uuid,
  usuario_id uuid,
  decision text not null check (decision in ('enviar','modificar','rechazar','humano')),
  calificacion numeric(3,1) not null,
  similitud numeric(4,3),
  mensaje_sugerido text,
  mensaje_final text,
  motivo text,
  detalle text,
  adjuntos jsonb default '[]'::jsonb,
  origen text,
  estado_guion text,
  created_at timestamptz default now()
);
create index if not exists ix_ti_calif_created on ti_calificaciones (created_at desc);
create unique index if not exists uq_ti_calif_envio on ti_calificaciones (envio_id) where envio_id is not null;
