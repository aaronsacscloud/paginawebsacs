-- Tipo de reunión «Reunión director general» para la cadencia de churn.
--
-- Vive en el calendario de Andrea (owner_id = el mismo miembro que hospeda
-- «Conversación con dirección» y «Sesión de crecimiento»), pero el anfitrión
-- visible es Aarón Herzberg, director general de Sacs: es él quien recibe a
-- quien se fue y quien puede autorizar el año sin costo en la misma llamada.
-- Se reserva en https://www.sacscloud.com/agendar/director-general
begin;
insert into event_types (
  slug, nombre, descripcion, duracion_minutos, buffer_antes_minutos, buffer_despues_minutos,
  aviso_minimo_horas, max_dias_adelanto, tipo_reunion, ubicacion_tipo, color,
  owner_id, host_ids, activo, categoria, requiere_minuta, recordatorios,
  confirmacion_email, confirmacion_whatsapp, anfitrion_nombre
) select
  'director-general',
  'Reunión director general',
  'Treinta minutos con Aarón Herzberg, director general de Sacs. Es para quien ya usó Sacs y lo dejó: en la reunión escuchamos qué pasó, te enseñamos lo que cambió y, si tiene sentido para tu negocio, te dejamos activo un año completo de Sacs sin costo, con la implementación hecha por nosotros en 7 días.',
  30, 0, 5, 2, 60, 'individual', 'google_meet', '#4536BE',
  '60be8bd8-995a-45ca-926f-1bcb159d3c1e', '{}'::uuid[], true, 'consultoria', true,
  '[{"id":"r1","email":true,"activo":true,"unidad":"dias","cantidad":1,"whatsapp":true},
    {"id":"r2","email":true,"activo":true,"unidad":"horas","cantidad":3,"whatsapp":true},
    {"id":"r3","email":false,"activo":true,"unidad":"minutos","cantidad":10,"whatsapp":true}]'::jsonb,
  true, true, 'Aarón Herzberg · Director general de Sacs'
where not exists (select 1 from event_types where slug = 'director-general');
commit;
