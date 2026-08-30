-- Rafael contestó "Si" a las 17:23 y la conversación se cerró a las 18:00, con
-- su mensaje sin leer. Cerrada la saca de los cuatro filtros del inbox Y silencia
-- la alerta de "lleva rato esperando" (webhook, caso conversation.inactive).
-- Se reabre para que vuelva a la fila. El candado nuevo evita que se repita.
update wa_conversaciones
set estado_crm = 'abierta', cierre_categoria = null, cierre_nota = null
where telefono = '+523317935768' and estado_crm = 'resuelta';

insert into wa_eventos (conversation_id, tipo, autor, detalle)
select id, 'estado', null, 'Reabierta: se había cerrado con un mensaje del cliente sin contestar'
from wa_conversaciones where telefono = '+523317935768';
