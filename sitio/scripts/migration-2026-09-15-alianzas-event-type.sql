-- Tipo de cita "Alianzas comerciales" para la página /partners (15-sep-2026).
-- Host: la cuenta que hoy atiende las demos (owner del evento 'demo').
insert into event_types (nombre, slug, descripcion, duracion_minutos, buffer_antes_minutos, buffer_despues_minutos, aviso_minimo_horas, max_reservas_dia, max_dias_adelanto, tipo_reunion, ubicacion_tipo, color, owner_id, host_ids, activo, categoria)
select 'Alianzas comerciales', 'alianzas',
  'Cita para partners: orquestadores, consultores, referidos y proveedores de tecnología que quieren trabajar con Sacs.',
  45, 10, 10, 12, 6, 30, 'individual', 'google_meet', '#4B7BE5', owner_id, '{}', true, 'alianzas'
from event_types where slug = 'demo'
on conflict do nothing;

insert into booking_questions (event_type_id, tipo, label, placeholder, required, options, orden, activo)
select et.id, v.tipo, v.label, v.placeholder, v.required, v.options::jsonb, v.orden, true
from event_types et,
(values
  ('text', 'Empresa o marca personal', 'Cómo te conocen', true, null, 1),
  ('select', 'Tipo de alianza', 'Elige una', true, '["Partner orquestador (implementación integral)","Consultor o especialista en retail","Referidos (influencer, creador, red de contactos)","Proveedor de tecnología (API / MCP)","Aún no sé"]', 2),
  ('select', 'País', 'Elige', true, '["México","Colombia","Chile","Perú","Argentina","España","Estados Unidos","Otro"]', 3),
  ('text', '¿A cuántos retailers de moda podrías llegar?', 'Un estimado', false, null, 4)
) as v(tipo, label, placeholder, required, options, orden)
where et.slug = 'alianzas'
and not exists (select 1 from booking_questions b where b.event_type_id = et.id);
