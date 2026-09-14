-- FUSIÓN DE FICHAS PARTIDAS POR EL «1» DEL MÓVIL MEXICANO (14-sep-2026)
--
-- Mario Barranco es cliente desde julio. El 13 de septiembre escribió por
-- WhatsApp y el CRM no lo reconoció: su ficha vieja guarda el número con el
-- «1» que usan los móviles mexicanos (+5212215627300) y lo que entra por
-- WhatsApp se normaliza sin él (+522215627300). La búsqueda comparaba el texto
-- exacto, así que abrió una ficha nueva —«WhatsApp 7300», sin nombre— y una
-- conversación nueva. En el inbox, un cliente con 257 mensajes de historia
-- aparecía como un desconocido con tres.
--
-- Esto une las dos fichas y las dos conversaciones, y de paso normaliza los
-- teléfonos que quedaban con el formato viejo. El código ya no vuelve a
-- partirlos: `ligarContacto` compara por los últimos diez dígitos.
DO $$
DECLARE
  v_vive   uuid := '2e90fefc-8895-4918-bdf8-74c5ad88720d';  -- Mario barranco Barranco
  v_muere  uuid := 'b1228659-4557-4535-b125-3a698f7e51e6';  -- «WhatsApp 7300»
  c_vive   uuid := '21820cba-74ce-40dd-b55b-afca12244f07';  -- su conversación, 257 mensajes
  c_muere  uuid := '5548acbd-e93e-424d-9710-3438403eeb1b';  -- la nueva, 3 mensajes
  r        record;
  n        int;
  nueva    wa_conversaciones%ROWTYPE;
BEGIN
  -- 1) La conversación que sobrevive es la que tiene la historia. Se queda con
  --    el teléfono normalizado y con el id de Kapso más reciente: por ahí
  --    entran los mensajes nuevos.
  --
  --    El id de Kapso es ÚNICO en la tabla, así que primero se suelta del lado
  --    que se va y luego se pone del lado que se queda; al revés choca contra
  --    su propio duplicado (medido: 23505 al primer intento).
  SELECT * INTO nueva FROM wa_conversaciones WHERE id = c_muere;
  UPDATE wa_conversaciones SET kapso_conversation_id = NULL WHERE id = c_muere;

  UPDATE wa_conversaciones v SET
    telefono = nueva.telefono,
    kapso_conversation_id = COALESCE(nueva.kapso_conversation_id, v.kapso_conversation_id),
    estado = nueva.estado,
    ultimo_mensaje_at = GREATEST(v.ultimo_mensaje_at, nueva.ultimo_mensaje_at),
    ultimo_entrante_at = GREATEST(COALESCE(v.ultimo_entrante_at, 'epoch'::timestamptz), COALESCE(nueva.ultimo_entrante_at, 'epoch'::timestamptz)),
    ultima_direccion = nueva.ultima_direccion,
    no_leidos = COALESCE(v.no_leidos, 0) + COALESCE(nueva.no_leidos, 0)
  WHERE v.id = c_vive;

  -- 2) Lo que colgaba de la conversación nueva pasa a la que sobrevive.
  UPDATE wa_mensajes SET conversation_id = c_vive WHERE conversation_id = c_muere;
  UPDATE wa_notas    SET conversation_id = c_vive WHERE conversation_id = c_muere;
  UPDATE ti_envios   SET conversation_id = c_vive WHERE conversation_id = c_muere;
  DELETE FROM wa_conversaciones WHERE id = c_muere;

  -- 3) Todo lo que apunta al contacto que muere pasa al que vive. Se recorren
  --    las llaves foráneas de verdad, no una lista escrita a mano: si mañana
  --    hay una tabla nueva, entra sola. Donde el que vive YA tiene su fila
  --    (ti_perfil, miembros de secuencia: uno por contacto), la del duplicado
  --    se borra en vez de chocar.
  FOR r IN
    SELECT tc.table_name AS t, kcu.column_name AS c
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'contacts' AND ccu.column_name = 'id'
       AND tc.table_name <> 'contacts'
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', r.t, r.c, r.c) USING v_vive, v_muere;
    EXCEPTION WHEN unique_violation THEN
      EXECUTE format('DELETE FROM %I WHERE %I = $1', r.t, r.c) USING v_muere;
    END;
  END LOOP;

  -- 4) Lo que la ficha nueva sabía y la vieja no (nada se pisa).
  UPDATE contacts v SET
    whatsapp = '+522215627300',
    company_id = COALESCE(v.company_id, m.company_id),
    last_contact_at = GREATEST(COALESCE(v.last_contact_at, 'epoch'::timestamptz), COALESCE(m.last_contact_at, 'epoch'::timestamptz)),
    updated_at = now()
  FROM contacts m WHERE v.id = v_vive AND m.id = v_muere;

  DELETE FROM contacts WHERE id = v_muere;

  -- 5) Y los demás teléfonos con el formato viejo, normalizados. Solo los que
  --    no chocan con otra ficha ya normalizada.
  UPDATE contacts c SET whatsapp = '+52' || right(regexp_replace(c.whatsapp, '[^0-9]', '', 'g'), 10), updated_at = now()
   WHERE c.whatsapp LIKE '+521%' AND length(regexp_replace(c.whatsapp, '[^0-9]', '', 'g')) = 13
     AND NOT EXISTS (SELECT 1 FROM contacts o WHERE o.id <> c.id
                       AND o.whatsapp = '+52' || right(regexp_replace(c.whatsapp, '[^0-9]', '', 'g'), 10));
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'telefonos normalizados: %', n;
END $$;
