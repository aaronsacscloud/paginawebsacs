-- La minuta pasa al formato de los reportes (dueño, 1-oct-2026): el cliente
-- marca cada acuerdo «de acuerdo» y firma la conformidad de la minuta.
--
-- Columnas APARTE de `minuta`: la minuta es lo que se escribió en la junta; la
-- firma no la cambia, la acusa. Mismo diseño que reportes_trabajo
-- (migration-2026-09-reportes-firma.sql).
alter table bookings
  add column if not exists minuta_revisados jsonb not null default '{}'::jsonb,  -- { "a:<n>": fecha ISO }
  add column if not exists minuta_firma jsonb,                                  -- { nombre, leyenda, trazo, at, ip, ua }
  add column if not exists minuta_firmado_at timestamptz;

comment on column bookings.minuta_revisados is 'Acuerdos de la minuta que el cliente marcó «de acuerdo»: {"a:<posición>": fecha ISO}.';
comment on column bookings.minuta_firma is 'Firma del cliente en la minuta: {nombre, leyenda, trazo (data URL PNG), at, ip, ua}.';
comment on column bookings.minuta_firmado_at is 'Cuándo firmó el cliente la minuta (copia de minuta_firma.at, para listar).';
