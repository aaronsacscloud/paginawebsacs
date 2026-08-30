-- Los tres WhatsApp de «Prueba gratis · 14 días».
--
-- Las plantillas quedaron aprobadas por Meta el 2026-08-30. Las escribe
-- Fernanda; Andrea queda para la sesión consultiva.
--
-- DÍAS 3, 6 Y 10 — y no 2, 6 y 10 como decía el plan original.
-- El día 2 ya tiene DOS toques: el correo de la sesión con Andrea y el mensaje
-- dentro de Sacs que ofrece la sesión con consultor. Son la misma oferta en dos
-- canales. Meterle encima un WhatsApp sobre la Academia habría sido un tercer
-- toque el mismo día, hablando de otra cosa.
--
-- El día 3 funciona mejor incluso: el correo del día 1 presenta la Academia, y
-- el WhatsApp llega dos días después a preguntar si entró. Un recordatorio
-- separado del anuncio se lee como interés; pegado, como insistencia.
--
--   día  3  prueba_academia     ¿ya entraste a la Academia?
--   día  6  prueba_productos    ¿cómo vas con tus productos?
--   día 10  prueba_inventario   vas a la mitad · existencias y órdenes
--
-- El día 10 estaba vacío: ni correo ni in-app. Es el hueco natural para el
-- «vas a la mitad».
--
-- El motor ya cuida lo demás: un WhatsApp por lead por día contando TODO lo que
-- salió, y si una persona tomó la conversación la cadencia se hace a un lado
-- cinco días.
begin;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
select 'cc275288-213f-4acd-958b-564c2afacda1', v.orden, v.dia, 'wa', v.plantilla, true
from (values
  (308,  3, 'prueba_academia'),
  (608,  6, 'prueba_productos'),
  (1008, 10, 'prueba_inventario')
) as v(orden, dia, plantilla)
where not exists (
  select 1 from crm_secuencia_pasos p
  where p.secuencia_id = 'cc275288-213f-4acd-958b-564c2afacda1' and p.wa_plantilla = v.plantilla
);

commit;
