-- Un tipo de reunión propio para la cadencia de expansión.
--
-- POR QUÉ NO REUSAR `consultoria`
-- El nombre del tipo es lo primero que ve el cliente en el agendador, y también
-- lo que aparece en el reporte de reuniones. «Reunión de consultoría» a un
-- cliente que ya paga suena a que algo salió mal; y en el reporte, mezclada con
-- las consultorías de venta, hace imposible saber cuántas reuniones de
-- crecimiento se tuvieron y en qué acabaron.
--
-- 45 minutos y no 60: no hay que descubrir el negocio, ya lo conocemos. Es
-- enseñar dos o tres cosas y escuchar qué le sirve.
--
-- Hereda dueño y horarios de `consultoria`: si se copiaran a mano, el día que
-- alguien cambie su disponibilidad este tipo se quedaría con la vieja y el
-- agendador ofrecería horas que ya no existen.
begin;

insert into event_types (nombre, slug, descripcion, duracion_minutos, categoria,
                         buffer_despues_minutos, aviso_minimo_horas, max_dias_adelanto,
                         tipo_reunion, ubicacion_tipo, color, owner_id, activo, requiere_minuta)
select 'Sesión de crecimiento', 'crecimiento',
       'Media hora larga para ver qué más puede hacer Sacs por tu operación: '
       'automatizar con IA, control de empleados, administración y bancos, '
       'nivelación de inventario o personalizar tus propios procesos. '
       'Es para clientes que ya operan bien y quieren ir más lejos.',
       45, 'consultoria',
       e.buffer_despues_minutos, e.aviso_minimo_horas, e.max_dias_adelanto,
       e.tipo_reunion, e.ubicacion_tipo, '#1B6B4F', e.owner_id, true, true
from event_types e
where e.slug = 'consultoria'
  and not exists (select 1 from event_types x where x.slug = 'crecimiento');

commit;
