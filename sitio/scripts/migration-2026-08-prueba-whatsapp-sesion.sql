-- Tres WhatsApp más en «Prueba gratis · 14 días»: la sesión con consultor.
--
-- Los tres que ya había (academia, productos, inventario) son de SOPORTE:
-- preguntan cómo va. Ninguno ofrecía la sesión, que es la conversión real de
-- una prueba — quien la toma contrata mucho más que quien no.
--
-- DÓNDE CAEN, y por qué ahí
--   día  5  prueba_sesion_consultor  la primera oferta por WhatsApp
--   día 12  prueba_sesion_repaso     «te quedan pocos días»
--   día 15  prueba_cierre_sesion     al día siguiente de que terminó
--
-- El motor manda máximo UN WhatsApp por lead por día, así que ninguno puede
-- caer en un día que ya tenga otro: 3, 6 y 10 están ocupados. Los días 5, 12 y
-- 15 estaban libres de WhatsApp, y el 12 estaba libre de todo.
--
-- El del día 5 va DESPUÉS del in-app del día 2 y ANTES del día 6, a propósito:
-- es el mismo ofrecimiento por otro canal para quien no abrió el modal. Un
-- mensaje personal después de uno que se ignoró funciona; dos el mismo día, no.
--
-- El del día 15 llega cuando la cuenta YA está bloqueada. Es el único momento
-- en que la sesión se ofrece a alguien que perdió el acceso, y por eso el texto
-- dice que todo sigue guardado antes de proponer nada: primero se quita el
-- miedo a haber perdido el trabajo, después se habla.
--
-- Y ese último ofrece la sesión «aunque al final no contrates». Condicionar la
-- ayuda a la compra en el momento de decidir es la forma más rápida de que la
-- decisión sea no.
begin;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
select 'cc275288-213f-4acd-958b-564c2afacda1', v.orden, v.dia, 'wa', v.plantilla, true
from (values
  (508,  5, 'prueba_sesion_consultor'),
  (1208, 12, 'prueba_sesion_repaso'),
  (1508, 15, 'prueba_cierre_sesion')
) as v(orden, dia, plantilla)
where not exists (
  select 1 from crm_secuencia_pasos p
  where p.secuencia_id = 'cc275288-213f-4acd-958b-564c2afacda1' and p.wa_plantilla = v.plantilla
);

commit;
