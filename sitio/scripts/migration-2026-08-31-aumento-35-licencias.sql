-- Aumento del 35% a las licencias (catálogo de precios).
-- Fecha: 2026-08-31. Autorizado por el dueño.
--
-- ALCANCE: SOLO el catálogo (precios para ventas NUEVAS).
-- NO se toca `subscriptions`: los clientes actuales siguen pagando lo pactado.
--
--   Plan          mensual            anual
--   vende         600  →   810       6,000  →   8,100
--   controla      900  → 1,215       9,000  →  12,150
--   fideliza    1,400  → 1,890      14,000  →  18,900
--   automatiza  2,800  → 3,780      28,000  →  37,800
--
-- Los 15 plugins y "personalizada"/"vitalicia_legacy" tienen precio NULL
-- (se cotizan a la medida): no hay nada que subir ahí.

UPDATE plans SET precio_mensual = 810,  precio_anual = 8100,  actualizado_at = now() WHERE slug = 'vende';
UPDATE plans SET precio_mensual = 1215, precio_anual = 12150, actualizado_at = now() WHERE slug = 'controla';
UPDATE plans SET precio_mensual = 1890, precio_anual = 18900, actualizado_at = now() WHERE slug = 'fideliza';
UPDATE plans SET precio_mensual = 3780, precio_anual = 37800, actualizado_at = now() WHERE slug = 'automatiza';
