-- LAS LLAMADAS PERDIDAS QUE NO DEJARON RASTRO (15-sep-2026)
--
-- «Las llamadas que lleguen por aquí que aparezcan ahí» —en No contestadas—.
-- Hasta hoy, si el número que llamaba no tenía conversación, la bitácora no
-- tenía dónde escribir y la llamada desaparecía: ni nota, ni fila, ni rastro.
-- Medido: cuatro llamadas entrantes, tres sin conversación, ninguna contestada.
--
-- El código ya lo arregla de aquí en adelante (`registrarBitacoraLlamada` abre
-- el hilo por teléfono y marca la conversación como pendiente). Esto recupera
-- las que ya habían pasado.
DO $$
DECLARE
  r      record;
  v_conv uuid;
  v_tel  text;
BEGIN
  FOR r IN
    SELECT l.id, l.call_id, l.telefono, l.conversation_id,
           COALESCE(l.ended_at, l.started_at, l.created_at) AS cuando
      FROM wa_llamadas l
     WHERE l.direccion = 'entrante' AND l.answered_at IS NULL
       -- `client:...` es el navegador de un asesor, no una persona que llama.
       AND l.telefono ~ '^\+?[0-9]{10,15}$'
     ORDER BY l.created_at
  LOOP
    -- El teléfono, como lo guarda WhatsApp: +52 y diez dígitos (sin el 1 de móvil).
    v_tel := CASE
      WHEN length(regexp_replace(r.telefono, '[^0-9]', '', 'g')) = 13
       AND left(regexp_replace(r.telefono, '[^0-9]', '', 'g'), 3) = '521'
        THEN '+52' || right(regexp_replace(r.telefono, '[^0-9]', '', 'g'), 10)
      WHEN left(r.telefono, 1) = '+' THEN r.telefono
      ELSE '+' || regexp_replace(r.telefono, '[^0-9]', '', 'g')
    END;

    v_conv := r.conversation_id;
    IF v_conv IS NULL THEN
      SELECT id INTO v_conv FROM wa_conversaciones
       WHERE right(regexp_replace(telefono, '[^0-9]', '', 'g'), 10) = right(regexp_replace(v_tel, '[^0-9]', '', 'g'), 10)
       ORDER BY ultimo_mensaje_at DESC LIMIT 1;
    END IF;
    IF v_conv IS NULL THEN
      INSERT INTO wa_conversaciones (telefono, estado, ultimo_mensaje_at, ultima_direccion, ultimo_mensaje_texto)
      VALUES (v_tel, 'ended', r.cuando, 'entrante', '📞 Llamada perdida')
      RETURNING id INTO v_conv;
    END IF;

    UPDATE wa_llamadas SET conversation_id = v_conv WHERE id = r.id;

    -- Pendiente solo si la llamada es lo ÚLTIMO que pasó en ese hilo: si
    -- después ya hubo conversación, alguien la atendió.
    UPDATE wa_conversaciones SET
      ultima_direccion = 'entrante',
      ultimo_mensaje_at = r.cuando,
      ultimo_mensaje_texto = '📞 Llamada perdida',
      estado_crm = 'abierta'
     WHERE id = v_conv AND (ultimo_mensaje_at IS NULL OR ultimo_mensaje_at <= r.cuando);
  END LOOP;
END $$;
