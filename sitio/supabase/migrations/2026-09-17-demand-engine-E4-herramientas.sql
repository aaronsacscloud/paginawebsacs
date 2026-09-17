-- DEMAND ENGINE · etapa 4: los índices del uso de herramientas.
--
-- La tabla `de_herramienta_usos` ya nació en E0, junto con el contrato de
-- herramientas, y hasta hoy estuvo vacía porque no había ninguna herramienta.
-- Con la primera viva hacen falta sus índices: sin ellos, la pregunta que
-- justifica todo esto —¿qué herramienta trae clientes?— se contesta con un
-- table scan que crecerá para siempre.
--
-- Ojo con el nombre de la columna de fecha: es `created_at`, como el resto del
-- CRM. (Escribí `creado_en` por inercia del resto del motor, que sí usa
-- español, y la migración falló entera.)
--
-- Sobre la columna `resumen`: se deja SIN ESCRIBIR a propósito. El resumen es
-- derivado, no la entrada cruda, pero nombra las tallas y los productos del
-- retailer. La promesa de la herramienta es que sus números no se quedan aquí,
-- y esa promesa vale más que la comodidad de leer respuestas en soporte. Para
-- saber qué herramienta convierte basta slug + visitor_id.

create index if not exists de_herramienta_usos_slug_idx
  on de_herramienta_usos (slug, created_at desc);

-- Los parciales son los que cierran el círculo herramienta → lead → cliente en
-- la etapa 5, y la mayoría de las filas no traerán ni visitante ni contacto.
create index if not exists de_herramienta_usos_visitor_idx
  on de_herramienta_usos (visitor_id) where visitor_id is not null;

create index if not exists de_herramienta_usos_contact_idx
  on de_herramienta_usos (contact_id) where contact_id is not null;

comment on table de_herramienta_usos is
  'Uso de las herramientas públicas del motor. Solo metadatos: jamás la entrada del usuario, y `resumen` se deja nulo por la misma razón.';
