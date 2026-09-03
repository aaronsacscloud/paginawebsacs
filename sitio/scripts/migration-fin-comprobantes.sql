alter table fin_gastos_pagos add column if not exists comprobante_path text, add column if not exists comprobante_nombre text;
alter table fin_adeudos_abonos add column if not exists comprobante_path text, add column if not exists comprobante_nombre text;
