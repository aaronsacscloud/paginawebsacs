-- Los tipos de reunión, en la paleta del CRM (lib/crm/paleta.ts).
-- Traían colores del sitio público y de Tailwind (#4B7BE5, #2AB5A0, #4FBF95
-- suelto): en la ficha del cliente, en el calendario y en la liga que recibe
-- el cliente se veían de otro producto. Morados y rosas primero.
update event_types set color = '#9B8CFA' where slug = 'consultoria';      -- morado, el color del CRM
update event_types set color = '#5B4BD6' where slug = 'personalizacion';  -- morado tinta
update event_types set color = '#D9538E' where slug = 'demo';             -- rosa: la firma de marca, y la demo es la venta
update event_types set color = '#EFA6CA' where slug = 'cotizacion';       -- rosa suave
update event_types set color = '#7DA6F5' where slug = 'seguimiento';      -- azul
update event_types set color = '#4FBF95' where slug = 'configuracion';    -- verde
update event_types set color = '#E8A838' where slug = 'capacitacion';     -- ámbar

-- Y la categoría real de los dos que estaban como 'otro': con esa etiqueta
-- cualquier reporte por categoría manda las demos al cajón de "Otro".
update event_types set categoria = 'demo'          where slug = 'demo';
update event_types set categoria = 'configuracion' where slug = 'configuracion';
