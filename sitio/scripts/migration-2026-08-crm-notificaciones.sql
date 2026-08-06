-- ═══ Notificaciones del CRM (campana) ═══
--
-- Lo que pasa solo hay que poder verlo sin ir a buscarlo: un cobro automático
-- de Mercado Pago entra, se registra el pago y avanza la próxima factura sin
-- que nadie toque nada. Eso es justo lo que hace que nadie se entere — ni del
-- que entró, ni del que rebotó.
--
-- `clave` es la defensa contra el duplicado: Mercado Pago REINTENTA sus avisos
-- y la conciliación puede volver a ver el mismo cobro. Con índice único, tres
-- reintentos del mismo pago son una sola notificación.
--
-- RLS encendido y SIN políticas, igual que crm_cobros_mp / payments: solo la
-- service key del servidor entra; nada de esto se expone al navegador.

create table if not exists crm_notificaciones (
  id              uuid primary key default gen_random_uuid(),
  clave           text unique,
  tipo            text not null,
  nivel           text not null default 'info',   -- info | alerta | urgente
  titulo          text not null,
  detalle         text,
  monto           numeric,
  company_id      uuid references companies(id)     on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  payment_id      uuid references payments(id)      on delete set null,
  destino         text,                            -- pestaña del CRM a la que lleva
  metadata        jsonb,
  leida_at        timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists crm_notif_created_idx on crm_notificaciones (created_at desc);
-- Parcial: el badge de la campana solo cuenta las NO leídas.
create index if not exists crm_notif_no_leidas_idx on crm_notificaciones (created_at desc) where leida_at is null;
create index if not exists crm_notif_company_idx on crm_notificaciones (company_id);

alter table crm_notificaciones enable row level security;
