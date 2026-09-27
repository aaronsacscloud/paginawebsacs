-- La FIRMA del cliente y el «revisado» por punto en los reportes al cliente.
--
-- Pedido del dueño (27-sep-2026): en Trabajo en curso, Reporte de entregas y
-- Reporte ejecutivo el cliente firma; en los dos primeros, además, marca cada
-- punto como revisado. En el ejecutivo la firma dice que está consciente del
-- trabajo realizado.
--
-- Va en columnas APARTE de `hechos` a propósito: `hechos` es la FOTO del
-- documento —lo que la liga tiene que decir igual en diciembre— y la firma no
-- cambia el documento, lo acusa. Mezclarlas sería reescribir la foto cada vez
-- que el cliente palomea un renglón.

alter table reportes_trabajo
  -- { "<llave del renglón>": "<cuándo lo marcó, ISO>" }. La llave es estable
  -- porque la foto no cambia: en entregas, «e:<posición>»; en curso, «c:<folio>».
  add column if not exists revisados jsonb not null default '{}'::jsonb,
  -- { nombre, leyenda, trazo (PNG en data URL), at, ip, ua }
  add column if not exists firma jsonb,
  -- Aparte del jsonb para poder listar y contar firmados sin abrirlo.
  add column if not exists firmado_at timestamptz;

comment on column reportes_trabajo.revisados is 'Renglones que el cliente marcó como revisados: {llave: fecha ISO}. Solo entregas y curso.';
comment on column reportes_trabajo.firma is 'Firma del cliente: {nombre, leyenda, trazo (data URL PNG), at, ip, ua}. Una vez firmada, el documento no admite más cambios de revisados.';
comment on column reportes_trabajo.firmado_at is 'Cuándo firmó el cliente (copia de firma.at, para listar).';
