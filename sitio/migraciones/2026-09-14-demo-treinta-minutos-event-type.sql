-- La demo dura 30 minutos (decisión del dueño, 14-sep-2026: «actualmente
-- estamos teniendo demos en línea durante 30 minutos»). El tipo de evento
-- `demo` de /agendar/demo seguía en 60 y con la descripción «Test update»:
-- los correos del ABM prometen 30 y la página de agendar decía 60.
update event_types
   set duracion_minutos = 30,
       descripcion = 'Demo en línea de 30 minutos: le mostramos paso a paso cómo optimizar la operación de su negocio de moda.',
       updated_at = now()
 where slug = 'demo' and duracion_minutos = 60;
select slug, duracion_minutos, descripcion from event_types where slug = 'demo';
