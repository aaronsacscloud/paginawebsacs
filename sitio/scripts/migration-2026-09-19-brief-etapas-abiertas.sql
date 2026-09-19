-- Brief de proyecto: las etapas dejan de estar bloqueadas.
--
-- El dueno lo pidio el 19-sep-2026: "lo que se necesita es que estas secciones
-- esten abiertas". Antes el brief era secuencial (firmar abria la 1, aprobar
-- abria la siguiente) y despues quedo colgado solo de la firma. Ninguna de las
-- dos puertas se queda: el cliente entra con su link y contesta lo que quiera.
--
-- Solo toca 'bloqueada'. Una etapa 'enviada' o 'aprobada' NO se reabre: eso
-- devolveria a escritura algo que ya esta cerrado y en revision.
update proyecto_etapa
   set estado = 'abierta'
 where estado = 'bloqueada';
