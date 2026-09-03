-- ═══ payments: el comprobante del CLIENTE (no el acuse que emitimos) ═══════
--
-- Pedido del dueño (3-sep-2026): al registrar un pago, el comprobante es
-- obligatorio. Medido antes de tocar nada: 184 pagos, UNO con comprobante.
--
-- POR QUÉ COLUMNAS NUEVAS Y NO `comprobante_url`:
-- El comprobante de un pago suele ser la captura de una transferencia — trae
-- cuentas, saldos y nombres. `comprobante_url` guarda una URL de bucket
-- PÚBLICO, donde el archivo queda accesible para quien tenga la liga. Estos
-- van al bucket privado `comprobantes` (el mismo de los gastos), que solo se
-- lee con URL firmada de una hora. Se guarda la RUTA, no una URL: una URL
-- firmada caduca y guardarla sería guardar un link muerto.
--
-- Mismos nombres que `fin_gastos_pagos` (comprobante_path / comprobante_nombre)
-- a propósito: dos formas de nombrar lo mismo obligan a recordar cuál toca.
--
-- `comprobante_url` se queda: tiene un pago vivo y borrarla lo perdería.
--
-- Aditiva y reversible:
--   alter table payments drop column comprobante_path, drop column comprobante_nombre;

alter table payments add column if not exists comprobante_path text;
alter table payments add column if not exists comprobante_nombre text;

-- Para poder contestar «¿qué pagos entraron sin comprobante?» sin barrer la
-- tabla entera. Parcial: solo interesan los que NO lo tienen.
create index if not exists payments_sin_comprobante
  on payments (fecha desc) where comprobante_path is null;

select count(*) pagos,
       count(comprobante_path) con_comprobante_nuevo,
       count(comprobante_url) con_comprobante_viejo
  from payments;
