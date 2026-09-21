-- BUG REVIEW (21-sep-2026) · el aviso de seguimiento nacía apagado y en silencio.
--
-- `permitido()` falla cerrado a propósito: una clave que no está en la tabla
-- devuelve false, porque sin poder leer qué está encendido no se le escribe a
-- nadie. Correcto — pero yo usé una clave nueva (`seguimiento_llamada`) sin
-- darla de alta, así que el aviso no habría salido NUNCA, ni con las plantillas
-- aprobadas, y sin un solo error en ningún log. Se habría descubierto dentro de
-- semanas, preguntándose por qué los seguimientos no reciben nada.
--
-- Nace ENCENDIDA: es un mensaje que el propio contacto pidió, y el interruptor
-- está ahí para apagarlo si molesta, no para tener que acordarse de prenderlo.
insert into wa_automatizaciones (clave, activa, nombre, categoria, nota)
values ('seguimiento_llamada', true,
        'Aviso de seguimiento sin contestar', 'telefonia',
        'Cuando alguien pide que le llamemos a una hora y no contesta esa llamada, se le escribe por WhatsApp diciéndole que se le marcó a la hora acordada.')
on conflict (clave) do nothing;

select clave, activa from wa_automatizaciones where clave = 'seguimiento_llamada';
