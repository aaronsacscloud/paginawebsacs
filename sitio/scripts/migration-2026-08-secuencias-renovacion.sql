-- Dos capacidades nuevas del motor de secuencias. No es contenido: sin esto,
-- NINGUNA cadencia de post-venta se puede construir.
--
-- 1 · CONTAR HACIA ATRÁS
-- Las cinco secuencias actuales cuentan días hacia adelante desde un ancla
-- (`estatus_lead_at`, `prueba_inicio`, `created_at`). Una cadencia de renovación
-- cuenta hacia ATRÁS hacia `subscriptions.proxima_factura`: su día 1 es «faltan
-- 90» y su último es «faltan 35». Se declara con `entrada.ancla = 'renovacion'`.
--
-- 2 · DEJAR DE EXPULSAR CLIENTES
-- El motor tiene una regla dura: si el contacto es `cliente`, sale de la
-- secuencia con motivo «convertido». Es correcta para las cinco de adquisición
-- —ahí convertir ES el final— y hace IMPOSIBLE cualquier cadencia de retención:
-- el cliente sale el primer día.
--
-- `entrada.para_clientes = true` apaga esa regla SOLO para las secuencias que
-- son de cliente. No se quita la regla en general: eso reabriría el bug de
-- perseguir con correos de venta a alguien que ya compró, que es peor.
begin;

comment on column crm_secuencias.entrada is
  'Reglas de entrada. Claves: estatus[], lifecycle[], filtros[], logica, ancla '
  '(estatus_lead_at | prueba_inicio | created_at | renovacion), cada_dias, '
  'para_clientes (bool: no expulsar a quien ya es cliente).';

-- Índice para el barrido de renovaciones: el cron busca por fecha de próxima
-- factura entre hoy y +90 días, y hoy eso es un scan de la tabla.
create index if not exists idx_subs_proxima_factura_activa
  on subscriptions (proxima_factura)
  where estado = 'activa';

commit;
