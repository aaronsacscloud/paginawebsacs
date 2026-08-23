-- De qué señal del sistema nació esta idea.
-- Sin esto, la misma venta se dice dos veces: la señal automática arriba y la
-- idea capturada abajo (caso Alazanas: "227 proveedores y 32 cuentas por pagar"
-- vs. "Módulo de administración y gastos"). Con el tipo guardado, la señal deja
-- de ofrecerse en cuanto ya existe la idea que la atiende.
-- Nulo = idea capturada a mano, que es el caso normal.
alter table mejoras add column if not exists senal_tipo text;
create index if not exists mejoras_senal_tipo_idx on mejoras (company_id, senal_tipo) where senal_tipo is not null;
