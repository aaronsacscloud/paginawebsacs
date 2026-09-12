-- EL CAMBIO DE LÍNEA OFICIAL · correr SOLO cuando Kapso reporte el
-- +52 55 9302 7234 (phone_number_id 1379200808599446) como CONNECTED.
--
-- Por qué en dos pasos: en PENDING Meta no deja mandar ni recibir, así que
-- ponerlo de default antes de tiempo tumba todos los envíos del CRM.
--
-- El 415 283 8733 NO se borra: se queda activo para que las conversaciones que
-- ya viven ahí se puedan seguir contestando y su historial no se toque. Deja de
-- ser el default y se marca con la redirección, que es la forma en que el
-- sistema retira una línea (quien escriba ahí recibe el aviso del número nuevo).
begin;
update wa_numeros set es_default = false where es_default = true;
update wa_numeros set es_default = true, activo = true, pausada = false, nombre = 'Sacscloud'
  where phone_number_id = '1379200808599446';
update wa_numeros set
    nombre = 'Sacscloud (anterior · 415)',
    redirigir_a = '525593027234',
    redirigir_texto = 'Hola, este número ya no está en uso. Nuestro número oficial es el +52 55 9302 7234: escríbenos ahí y te atendemos de inmediato.'
  where phone_number_id = '1215290738345315';
-- Las reglas de ruteo por contexto que apuntaban al 415 se mueven al nuevo.
update wa_reglas_linea set phone_number_id = '1379200808599446' where phone_number_id = '1215290738345315';
commit;
