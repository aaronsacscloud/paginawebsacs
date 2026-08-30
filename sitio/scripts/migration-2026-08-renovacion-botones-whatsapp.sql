-- Todos los botones de la renovación llevan a WhatsApp.
--
-- POR QUÉ SE QUITA EL AGENDADOR
-- Para un LEAD, agendar es el compromiso que se busca: pone fecha y obliga a
-- prepararse. Para un CLIENTE que ya te conoce, es fricción: tiene que abrir un
-- calendario, encontrar hueco y esperar tres días para preguntar algo que se
-- contesta en dos mensajes.
--
-- Y las tres cosas que quiere un cliente antes de renovar —resolver una duda,
-- ver un upgrade, pedir algo específico— caben en un hilo y no en una junta.
-- Si la conversación amerita la sesión, el consultor se la ofrece ahí mismo.
--
-- EL MENSAJE PRELLENADO CAMBIA EN CADA CORREO, a propósito: cuando llega a la
-- bandeja, quien atiende ve de qué correo viene sin preguntar. Un «hola» a
-- secas obliga a reconstruir el contexto y a que el cliente lo explique otra
-- vez, que es justo lo que veníamos a evitarle.
begin;

update email_templates set bloques = (
  select jsonb_agg(case when b.value->>'id' = 'b1'
    then b.value || '{"texto": "💬 Escribir a un consultor", "href": "https://wa.me/12058920417?text=Hola%2C%20quiero%20platicar%20con%20un%20consultor%20antes%20de%20mi%20renovacion", "sub": "Te contestamos por WhatsApp · dudas, upgrades o lo que necesites"}'::jsonb
    else b.value end order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord))
where nombre = 'Renovación 2 · Media hora para lo que te cuesta trabajo';

update email_templates set bloques = (
  select jsonb_agg(case when b.value->>'id' = 'b1'
    then b.value || '{"texto": "💬 Escribir a un consultor", "href": "https://wa.me/12058920417?text=Hola%2C%20hay%20cosas%20de%20Sacs%20que%20no%20estoy%20usando%20y%20quiero%20entender%20cuales%20me%20sirven", "sub": "Cuéntanos qué te falta y te decimos si Sacs ya lo hace"}'::jsonb
    else b.value end order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord))
where nombre = 'Renovación 3 · Lo que no se ve desde afuera';

update email_templates set bloques = (
  select jsonb_agg(case when b.value->>'id' = 'b1'
    then b.value || '{"texto": "💬 Escribir a un consultor", "href": "https://wa.me/12058920417?text=Hola%2C%20antes%20de%20decidir%20mi%20renovacion%20quiero%20platicar%20con%20un%20consultor", "sub": "Dudas, upgrades o ajustes a tu plan · por WhatsApp"}'::jsonb
    else b.value end order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord))
where nombre = 'Renovación 4 · La última antes de tu renovación';

update email_templates set bloques = (
  select jsonb_agg(case when b.value->>'id' = 'b1'
    then b.value || '{"texto": "💬 Renovar o ajustar mi plan", "href": "https://wa.me/12058920417?text=Hola%2C%20quiero%20renovar%20aprovechando%20el%20descuento%20por%20anticipacion", "sub": "Te ayudamos a renovar, cambiar de plan o agregar sucursales"}'::jsonb
    else b.value end order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord))
where nombre = 'Renovación 5 · Renueva antes y te ahorras {{ahorro_10|un 10%}}';

update email_templates set bloques = (
  select jsonb_agg(case when b.value->>'id' = 'b1'
    then b.value || '{"texto": "💬 Renovar antes de que suba", "href": "https://wa.me/12058920417?text=Hola%2C%20quiero%20renovar%20con%20el%205%25%20antes%20de%20que%20se%20acabe", "sub": "Un mensaje y lo dejamos listo"}'::jsonb
    else b.value end order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord))
where nombre = 'Renovación 6 · Últimos días del 5%';

-- El correo 4 tenía dos botones: agendar y WhatsApp. Ahora los dos dirían lo
-- mismo, así que se queda uno. Dos botones que hacen lo mismo no dan opciones:
-- hacen dudar.
update email_templates set bloques = (
  select jsonb_agg(b.value order by b.ord)
  from jsonb_array_elements(bloques) with ordinality b(value, ord)
  where b.value->>'id' <> 'b2')
where nombre = 'Renovación 4 · La última antes de tu renovación';

commit;
-- Los mensajes in-app de la renovación también llevan a WhatsApp.
--
-- El de la sesión era formato `agenda` —modal con calendario— y pasa a `modal`
-- con el botón de WhatsApp. Misma razón que en los correos: para un cliente que
-- ya te conoce, abrir un calendario y esperar tres días es más fricción que
-- escribir dos mensajes. Si la conversación amerita la sesión, el consultor se
-- la ofrece ahí mismo.
--
-- El de «lo que ya pagas y no usas» conserva su enlace al panel —ahí el destino
-- ES una pantalla suya— pero gana el de WhatsApp como primer botón: saber cuál
-- de esos módulos le sirve no se resuelve mirando una lista, se resuelve
-- preguntando.
begin;

update inapp_campanas
   set formato = 'modal',
       contenido = jsonb_set(contenido, '{botones}',
         '[{"texto":"Escribir a un consultor","accion":"whatsapp_ventas"},
           {"texto":"Ahora no","accion":"cerrar"}]'::jsonb)
                   - 'agenda_slug',
       updated_at = now()
 where nombre = 'Renovación · sesión con consultor';

update inapp_campanas
   set contenido = jsonb_set(contenido, '{botones}',
         '[{"texto":"Pregúntanos cuál te sirve","accion":"whatsapp_ventas"},
           {"texto":"Ver mi cuenta","accion":"modulo","destino":"dashboard"}]'::jsonb),
       updated_at = now()
 where nombre = 'Renovación · lo que ya pagas y no usas';

commit;
