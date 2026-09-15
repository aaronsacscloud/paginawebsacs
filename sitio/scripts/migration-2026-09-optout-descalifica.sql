-- «YA NO ESTOY INTERESADO» TAMBIÉN CIERRA EL CICLO (14-sep-2026)
--
-- Hasta hoy el opt-out apagaba al agente y ahí quedaba: el lead seguía
-- figurando como Rezagado aunque hubiera dicho que no con todas sus letras.
-- El código ya lo arregla de aquí en adelante (`aplicarOptOut`); esto pone al
-- día a quien se quedó a medias.
--
-- Solo las etapas donde trabaja el agente (lead, lead_calificado, rezagado).
-- Un cliente que pide que no le escribamos no se da de baja como cliente, y una
-- oportunidad la cierra una persona.
DO $$
DECLARE
  r     record;
  n_tel text;
BEGIN
  FOR r IN
    SELECT ct.id, ct.lifecycle_stage
      FROM contacts ct
      JOIN ti_perfil p ON p.contact_id = ct.id
     WHERE (p.agente_estado->>'cerrado' = 'opt_out' OR ct.wa_optout IS TRUE)
       AND ct.lifecycle_stage IN ('lead', 'lead_calificado', 'rezagado')
  LOOP
    UPDATE contacts SET
      lifecycle_stage = 'descalificado', descarte_categoria = 'no_interesado',
      estatus_lead = 'descartado', estatus_lead_at = now(), updated_at = now()
     WHERE id = r.id;

    INSERT INTO activities (contact_id, tipo, titulo, automatico, metadata)
    VALUES (r.id, 'stage_change',
      'Lifecycle: ' || r.lifecycle_stage || ' → descalificado · dijo que ya no le interesa',
      true, jsonb_build_object('de', r.lifecycle_stage, 'a', 'descalificado', 'motivo', 'opt_out', 'categoria', 'no_interesado'));

    -- La línea de sistema en el hilo, igual que la que deja el código.
    SELECT telefono INTO n_tel FROM wa_conversaciones
     WHERE contact_id = r.id AND telefono IS NOT NULL
     ORDER BY ultimo_mensaje_at DESC NULLS LAST LIMIT 1;
    IF n_tel IS NOT NULL THEN
      INSERT INTO wa_mensajes (kapso_message_id, conversation_id, direccion, tipo, cuerpo, status, autor, metadata, created_at)
      SELECT 'sys-' || substr(md5(random()::text || r.id::text), 1, 12), c.id, 'saliente', 'text',
        'Pidió que no le escribamos más. Su etapa pasó de ' || r.lifecycle_stage ||
        ' a DESCALIFICADO (motivo: dijo que ya no le interesa) y se cerró el seguimiento: no le vuelve a salir nada automático.',
        'sent', 'Sistema',
        jsonb_build_object('sistema', true, 'opt_out', true, 'etapa_anterior', r.lifecycle_stage, 'descalificado', true),
        now()
        FROM wa_conversaciones c
       WHERE c.contact_id = r.id AND c.telefono = n_tel
       ORDER BY c.ultimo_mensaje_at DESC NULLS LAST LIMIT 1;
    END IF;
  END LOOP;
END $$;
