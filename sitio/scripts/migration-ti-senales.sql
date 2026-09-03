-- Señales (2026-09-04): lo que el lead hace y vale saber, sin convertirse en tarea. El agente actúa solo cuando se cruza un umbral.
create table if not exists ti_senales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  tipo text not null,                 -- cotizacion_vista | lead_nuevo | pagina_precios | agenda_abierta | ...
  detalle jsonb, ocurrio_at timestamptz not null default now(),
  umbral text, accion text, envio_id uuid,
  clave text unique,                  -- idempotencia (p. ej. cot:<quote>:<ultima_vista_at>)
  created_at timestamptz default now()
);
create index if not exists ix_ti_senales_contacto on ti_senales(contact_id, ocurrio_at desc);
create index if not exists ix_ti_senales_dia on ti_senales(ocurrio_at desc);
update ti_config set valor = valor || '{"umbral_llamada_cotizacion":20000}'::jsonb where id = 1 and not (valor ? 'umbral_llamada_cotizacion');
