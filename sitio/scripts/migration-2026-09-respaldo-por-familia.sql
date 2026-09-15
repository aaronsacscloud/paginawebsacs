-- EL RESPALDO TIENE QUE HABLAR DEL MISMO TEMA (15-sep-2026)
--
-- A Jakob se le mandó el aviso del número nuevo. Meta lo frenó, y en su lugar
-- salió la utility genérica: «quedamos pendientes del tema de tu solicitud con
-- Sacs». No tiene nada que ver con lo que le íbamos a decir. Del mismo blast
-- salieron siete mensajes así.
--
-- Cada plantilla declara ahora su GEMELA de utilidad —la que dice lo mismo por
-- un carril que Meta no frena— y el que no tenga gemela no manda nada: mejor
-- silencio que confundir a alguien.
ALTER TABLE wa_plantillas ADD COLUMN IF NOT EXISTS respaldo_utility text;

COMMENT ON COLUMN wa_plantillas.respaldo_utility IS
  'La plantilla de UTILIDAD que dice lo mismo que esta, para cuando Meta frena el marketing. Debe existir y estar aprobada como UTILITY; si no, no hay respaldo y no se manda nada.';

-- Las parejas que de verdad dicen lo mismo. Lo demás se queda en NULL a
-- propósito: un respaldo que no viene al caso es peor que ninguno.
UPDATE wa_plantillas SET respaldo_utility = 'ti_seguimiento_utility_v1'  WHERE nombre = 'ti_seguimiento_marketing_v1';
UPDATE wa_plantillas SET respaldo_utility = 'ti_promo_utility_v1'        WHERE nombre = 'ti_promo_marketing_v1';
UPDATE wa_plantillas SET respaldo_utility = 'ti_cierre_utility_v1'       WHERE nombre = 'ti_cierre_marketing_v1';
UPDATE wa_plantillas SET respaldo_utility = 'ti_preparacion_utility_v1'  WHERE nombre = 'ti_preparacion_marketing_v1';

-- La reactivación y las cadencias de lead SÍ encajan con «quedamos pendientes
-- del tema de tu solicitud con Sacs»: todas ellas le escriben a alguien que
-- pidió información y se quedó a medias.
UPDATE wa_plantillas SET respaldo_utility = 'pendiente_retomar'
 WHERE categoria = 'MARKETING' AND status = 'APPROVED' AND respaldo_utility IS NULL
   AND (nombre LIKE 'ti_reactivacion%' OR nombre LIKE 'cadencia_%' OR nombre LIKE 'rezagado_%'
        OR nombre LIKE 'seguimiento_%' OR nombre LIKE 'contacto_seguimiento');
