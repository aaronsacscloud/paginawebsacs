-- EL QUE VOLVIÓ POR EL CORREO, DE VUELTA EN SU FICHA (14-sep-2026)
--
-- Matin Vera Vera (sujuma) es una cuenta cancelada. El 14 de septiembre recibió
-- el correo del año sin costo, hizo clic en su botón de WhatsApp a las 20:48:46
-- y su mensaje llegó a las 20:49:51 desde un teléfono que no teníamos. El CRM
-- abrió un lead nuevo sin nombre («WhatsApp 6258»), lo metió a la cadencia de
-- rezagados y lo sacó en el mismo minuto.
--
-- El dato para reconocerlo YA estaba guardado: el clic vive en
-- `email_sends.clicked_links` con su contacto, el enlace y el segundo exacto, y
-- el enlace lleva escrito el texto que llegó, palabra por palabra. De 32 correos
-- enviados ese día, él fue el ÚNICO que hizo clic.
--
-- Esto une lo que nunca debió separarse. De aquí en adelante lo hace solo:
-- `identificarPorClic` corre en la puerta de entrada, antes de dar por
-- desconocido a nadie.
DO $$
DECLARE
  v_vive  uuid := 'a4c8b674-5d52-403c-90b0-514c0c4400b0';  -- Matin Vera Vera · sujuma
  v_muere uuid := 'a536d2de-8720-48d0-aefc-1fdf31d26b8d';  -- «WhatsApp 6258»
  c_conv  uuid := '4d84702c-d97c-4574-ac05-3f7215ecd68f';  -- su conversación de WhatsApp
  v_emp   uuid := '57754430-e8d7-4d56-85f1-b3200907e0ab';
  r       record;
BEGIN
  -- La conversación pasa a su ficha de siempre.
  UPDATE wa_conversaciones SET contact_id = v_vive, company_id = v_emp WHERE id = c_conv;

  -- Y el teléfono se guarda: la próxima vez se reconoce sin ayuda de nadie.
  UPDATE contacts SET whatsapp = '+525512406258', updated_at = now()
   WHERE id = v_vive AND whatsapp IS NULL;

  -- Todo lo que colgaba del lead provisional pasa al contacto de verdad. Donde
  -- el que vive ya tiene su fila (una por contacto), la del duplicado se borra.
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

  DELETE FROM contacts WHERE id = v_muere;

  -- Que quede dicho en su historia por qué está aquí: no es un lead frío, es
  -- una cuenta que se fue y está volviendo por la oferta que le mandamos.
  INSERT INTO activities (contact_id, company_id, tipo, titulo, automatico, metadata)
  VALUES (v_vive, v_emp, 'nota',
    'Volvió por el correo «Un año de Sacs sin costo»: hizo clic en el botón de WhatsApp a las 14:48 y escribió a las 14:49 desde el +52 55 1240 6258',
    true, jsonb_build_object('identificado_por', 'clic_wa_correo', 'conversation_id', c_conv));
END $$;
