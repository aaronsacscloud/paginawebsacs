-- Backfill de atribución de partner a contacts/deals/comisiones.
--
-- Contexto: antes del commit 21644e9 (2026-05-17), el endpoint
-- /api/scheduling/book.ts guardaba referrer_partner_id en `bookings`
-- pero NO en `contacts` ni `deals`. Resultado: los partners veían sus
-- referidos en "últimos movimientos" pero no en pipeline/leads.
--
-- Adicionalmente, /api/create-subscription.ts no escribía nada a Supabase,
-- así que las suscripciones pagadas vía referido no generaban comisión
-- venta_directa.
--
-- Este script:
--   1. Copia bookings.referrer_partner_id → contacts.referrer_partner_id
--      (solo donde el contact aún no tiene atribución, para no sobrescribir
--      lo que pudo registrar /api/save-lead correctamente).
--   2. Copia bookings.referrer_partner_id → deals.referrer_partner_id
--      (igual, solo donde deals.referrer_partner_id IS NULL).
--   3. Reporta cuántas filas se actualizaron.
--
-- Es idempotente: correrlo dos veces es seguro y no cambia nada en la
-- segunda corrida.

BEGIN;

-- ─── 1. Backfill contacts ────────────────────────────────────────
WITH bookings_attrib AS (
  SELECT DISTINCT ON (b.contact_id)
    b.contact_id,
    b.referrer_partner_id,
    b.created_at
  FROM bookings b
  WHERE b.contact_id IS NOT NULL
    AND b.referrer_partner_id IS NOT NULL
  ORDER BY b.contact_id, b.created_at ASC  -- primera atribución gana
),
updated_contacts AS (
  UPDATE contacts c
  SET
    referrer_partner_id = ba.referrer_partner_id,
    fuente = CASE
      WHEN c.fuente IS NULL OR c.fuente IN ('booking-page','website-form','website-prueba-gratis')
      THEN 'partner-link'
      ELSE c.fuente
    END
  FROM bookings_attrib ba
  WHERE c.id = ba.contact_id
    AND c.referrer_partner_id IS NULL
  RETURNING c.id
)
SELECT 'contacts backfilled' AS step, count(*) AS rows FROM updated_contacts;

-- ─── 2. Backfill deals ───────────────────────────────────────────
-- Camino A: por booking.deal_id directo
WITH bookings_with_deal AS (
  SELECT DISTINCT ON (b.deal_id)
    b.deal_id,
    b.referrer_partner_id,
    b.created_at
  FROM bookings b
  WHERE b.deal_id IS NOT NULL
    AND b.referrer_partner_id IS NOT NULL
  ORDER BY b.deal_id, b.created_at ASC
),
deals_via_booking AS (
  UPDATE deals d
  SET referrer_partner_id = bd.referrer_partner_id
  FROM bookings_with_deal bd
  WHERE d.id = bd.deal_id
    AND d.referrer_partner_id IS NULL
  RETURNING d.id
)
SELECT 'deals backfilled via booking.deal_id' AS step, count(*) AS rows FROM deals_via_booking;

-- Camino B: por contact_id (deals que no tienen booking directo)
WITH attributed_contacts AS (
  SELECT id, referrer_partner_id
  FROM contacts
  WHERE referrer_partner_id IS NOT NULL
),
deals_via_contact AS (
  UPDATE deals d
  SET referrer_partner_id = ac.referrer_partner_id
  FROM attributed_contacts ac
  WHERE d.contact_id = ac.id
    AND d.referrer_partner_id IS NULL
  RETURNING d.id
)
SELECT 'deals backfilled via contact_id' AS step, count(*) AS rows FROM deals_via_contact;

-- ─── 3. Backfill venta_directa commissions ──────────────────────
-- Para cada deal cerrado_ganada con referrer_partner_id que NO tenga
-- comisión venta_directa, crearla en status='pending' (el founder verifica
-- y la marca como earned cuando confirma el pago real).
WITH eligible_deals AS (
  SELECT
    d.id AS deal_id,
    d.referrer_partner_id AS partner_id,
    d.valor_total AS deal_value,
    COALESCE(tm.default_commission_pct, 20) AS rate_pct
  FROM deals d
  LEFT JOIN team_members tm ON tm.id = d.referrer_partner_id
  WHERE d.referrer_partner_id IS NOT NULL
    AND d.stage IN ('cerrada_ganada','won')
    AND NOT EXISTS (
      SELECT 1 FROM partner_commissions pc
      WHERE pc.deal_id = d.id
        AND pc.tipo = 'venta_directa'
    )
),
inserted_commissions AS (
  INSERT INTO partner_commissions (
    deal_id, partner_id, tipo, rate_pct, deal_value, commission_amount, status, nota
  )
  SELECT
    deal_id,
    partner_id,
    'venta_directa',
    rate_pct,
    deal_value,
    ROUND(COALESCE(deal_value, 0) * (rate_pct::numeric / 100), 2),
    'pending',
    'Backfill 2026-05: comisión retroactiva por suscripción pagada antes del fix'
  FROM eligible_deals
  RETURNING id
)
SELECT 'venta_directa commissions created' AS step, count(*) AS rows FROM inserted_commissions;

-- ─── 4. Backfill demo_completada commissions ────────────────────
-- Para bookings con estado='realizada' + referrer_partner_id que NO tengan
-- ya una comisión demo_completada, crearla en status='earned' (la demo ya pasó).
WITH eligible_bookings AS (
  SELECT
    b.id AS booking_id,
    b.referrer_partner_id AS partner_id,
    b.invitee_nombre,
    b.fecha
  FROM bookings b
  WHERE b.referrer_partner_id IS NOT NULL
    AND b.estado = 'realizada'
    AND NOT EXISTS (
      SELECT 1 FROM partner_commissions pc
      WHERE pc.booking_id = b.id
    )
),
inserted_demo_bonus AS (
  INSERT INTO partner_commissions (
    booking_id, partner_id, tipo, rate_pct, deal_value, commission_amount,
    status, earned_at, nota
  )
  SELECT
    booking_id,
    partner_id,
    'demo_completada',
    0,
    0,
    300,
    'earned',
    NOW(),
    'Backfill 2026-05: bono retroactivo demo realizada' ||
      CASE WHEN invitee_nombre IS NOT NULL THEN ' con ' || invitee_nombre ELSE '' END
  FROM eligible_bookings
  RETURNING id
)
SELECT 'demo_completada bonuses created' AS step, count(*) AS rows FROM inserted_demo_bonus;

-- ─── 5. Resumen final ───────────────────────────────────────────
SELECT
  'TOTALES POST-BACKFILL' AS resumen,
  (SELECT count(*) FROM contacts WHERE referrer_partner_id IS NOT NULL) AS contacts_atribuidos,
  (SELECT count(*) FROM deals WHERE referrer_partner_id IS NOT NULL)    AS deals_atribuidos,
  (SELECT count(*) FROM bookings WHERE referrer_partner_id IS NOT NULL) AS bookings_atribuidos,
  (SELECT count(*) FROM partner_commissions WHERE tipo = 'venta_directa') AS comisiones_venta_directa,
  (SELECT count(*) FROM partner_commissions WHERE tipo = 'demo_completada') AS comisiones_demo_completada,
  (SELECT count(*) FROM partner_commissions WHERE tipo = 'prueba_gratis') AS comisiones_prueba_gratis;

COMMIT;
