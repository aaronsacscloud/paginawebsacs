-- ═══ Bandeja de oportunidades: que las señales se TRABAJEN ═══
--
-- El detector genera ~70 alertas cada dos días y todas caían en el timeline sin
-- estado ni dueño. Una señal que nadie puede marcar como atendida se vuelve
-- paisaje en dos semanas, y sin saber cuáles se cerraron no hay forma de afinar
-- un solo umbral: no se sabe qué señal sirve y cuál es ruido.
--
-- Se EXTIENDE expansion_signals en vez de crear una tabla nueva: tener dos
-- lugares para el mismo concepto sería peor que el problema que resuelve.
alter table expansion_signals
  add column if not exists estado          text not null default 'nueva',  -- nueva | contactado | ganada | descartada
  add column if not exists titulo          text,
  add column if not exists detalle         text,
  add column if not exists accion          text,
  add column if not exists peso            integer,
  add column if not exists owner_id        uuid references team_members(id) on delete set null,
  add column if not exists motivo_descarte text,
  add column if not exists cerrada_at      timestamptz,
  add column if not exists visto_at        timestamptz,   -- última vez que el cron la reconfirmó
  add column if not exists updated_at      timestamptz default now();

-- Una señal VIVA por (empresa, tipo). El cron la reconfirma tocando visto_at, no
-- la duplica: si no, en una semana habría 300 filas del mismo caso.
-- El índice es PARCIAL a propósito: una cerrada no bloquea que el mismo problema
-- vuelva a abrirse meses después, que es información legítima.
create unique index if not exists uq_expsig_abierta
  on expansion_signals (company_id, signal_type)
  where estado in ('nueva', 'contactado');

create index if not exists ix_expsig_estado on expansion_signals (estado, detected_at desc);

-- Las filas viejas usaban dismissed_at como único estado; se traen al modelo nuevo.
update expansion_signals set estado = 'descartada', cerrada_at = dismissed_at
 where dismissed_at is not null and estado = 'nueva';
