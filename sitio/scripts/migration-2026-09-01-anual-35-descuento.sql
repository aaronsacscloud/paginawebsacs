-- El plan ANUAL deja de ser "12 meses al precio de 10" (2 meses gratis) y pasa
-- a ser 12 meses con 35% de descuento. Decisión del dueño, 2026-09-01.
-- El precio MENSUAL no cambia. Solo el catálogo: las suscripciones vigentes
-- conservan su precio pactado.
--
--   Plan          mensual   anual (10 meses)  →  anual (12 × 0.65)
--   vende             810             8,100   →    6,318
--   controla        1,215            12,150   →    9,477
--   fideliza        1,890            18,900   →   14,742
--   automatiza      3,780            37,800   →   29,484

UPDATE plans SET precio_anual = 6318,  actualizado_at = now() WHERE slug = 'vende';
UPDATE plans SET precio_anual = 9477,  actualizado_at = now() WHERE slug = 'controla';
UPDATE plans SET precio_anual = 14742, actualizado_at = now() WHERE slug = 'fideliza';
UPDATE plans SET precio_anual = 29484, actualizado_at = now() WHERE slug = 'automatiza';
