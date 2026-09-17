-- La agenda de Andrea arranca a las 12:00 PM — 17-sep-2026
--
-- REVISIÓN QUE PIDIÓ EL DUEÑO («que revise si está bien en el sistema»):
-- NO estaba bien. `availability_schedules.weekly_hours` tenía 09:00–13:00 y
-- 14:00–18:00 de lunes a viernes, así que el agendador público seguía ofreciendo
-- huecos desde las nueve de la mañana.
--
-- Queda un solo rango continuo 12:00–18:00, L-V. Sin el corte de comida de
-- 13:00–14:00: con la jornada empezando al mediodía, ese corte dejaba UNA sola
-- hora antes de comer y partía la tarde en dos pedazos raros.
--
-- ⚠️ Y DE PASO, UN PROBLEMA QUE YA ESTABA AHÍ:
-- hay TRES filas, las tres con `es_default = true` y `activo = true`. El código
-- hace `.order('es_default', {ascending:false}).limit(1)` — sin desempate. Con
-- tres filas empatadas, Postgres puede devolver CUALQUIERA de las tres, y no
-- necesariamente la misma en cada consulta. Hoy no se nota porque las tres
-- tienen el mismo contenido; el día que alguien edite una desde la pantalla de
-- disponibilidad, la agenda empezaría a contestar distinto según le toque.
-- Por eso el update va sobre LAS TRES: mientras existan, tienen que decir lo
-- mismo. Dejar una sola activa es la limpieza de fondo y se decide aparte,
-- porque no sé si algo las referencia por id.

update availability_schedules
set weekly_hours = jsonb_build_object(
      '0', jsonb_build_object('enabled', false, 'ranges', '[]'::jsonb),
      '1', jsonb_build_object('enabled', true,  'ranges', jsonb_build_array(jsonb_build_object('start','12:00','end','18:00'))),
      '2', jsonb_build_object('enabled', true,  'ranges', jsonb_build_array(jsonb_build_object('start','12:00','end','18:00'))),
      '3', jsonb_build_object('enabled', true,  'ranges', jsonb_build_array(jsonb_build_object('start','12:00','end','18:00'))),
      '4', jsonb_build_object('enabled', true,  'ranges', jsonb_build_array(jsonb_build_object('start','12:00','end','18:00'))),
      '5', jsonb_build_object('enabled', true,  'ranges', jsonb_build_array(jsonb_build_object('start','12:00','end','18:00'))),
      '6', jsonb_build_object('enabled', false, 'ranges', '[]'::jsonb)
    )
where activo = true;
