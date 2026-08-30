-- El winback tiene que ignorar la salida por «descartado».
--
-- Los 24 clientes que hicieron churn tienen TODOS `estatus_lead =
-- 'descartado'` — es lo que quedó cuando dejaron de ser clientes. Y el motor
-- expulsa a todo descartado de toda secuencia.
--
-- Sin esto, la cadencia los habría enrolado y sacado en la MISMA corrida: cero
-- envíos, y en el reporte «graduados: 24», que se lee como trabajo hecho.
--
-- Y el diagnóstico de secuencias tampoco lo habría cachado: revisa las reglas
-- de ENTRADA y esta es de SALIDA. Habría dicho «entra: sí» mientras el contacto
-- no recibía nada.
--
-- `ignorar_salidas` es una lista por secuencia y no un interruptor global: la
-- regla sigue valiendo para las siete cadencias donde un descartado sí debe
-- salir. Aquí, «descartado» no es una decisión sobre este contacto — es su
-- estado normal.
begin;

update crm_secuencias
   set entrada = entrada || '{"ignorar_salidas":["descartado"]}'::jsonb
 where id = '11111111-2222-4333-8444-5555555555c1';

commit;
