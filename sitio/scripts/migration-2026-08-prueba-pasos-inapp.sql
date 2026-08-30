-- Los siete mensajes dentro de Sacs, enganchados a «Prueba gratis · 14 días».
--
-- Se intercalan con los correos que ya existían. Un in-app NO compite con el
-- correo del mismo día: no interrumpe —espera a que el usuario entre— y no
-- consume el cupo de «un correo y un WhatsApp por lead por día». Por eso los
-- días 2, 6, 9, 11 y 14 tienen los dos, y está bien.
--
-- Los `orden` van con hueco de 5 para poder meter algo entre dos sin renumerar.
begin;

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, inapp_campana_id, activo)
select 'cc275288-213f-4acd-958b-564c2afacda1', v.orden, v.dia, 'inapp', c.id, true
from (values
  (205,  2, 'Prueba · sesión con consultor (1 de 3)'),
  (405,  4, 'Prueba · tu promoción del anual'),
  (605,  6, 'Prueba · sesión con consultor (2 de 3)'),
  (905,  9, 'Prueba · sesión con consultor (3 de 3)'),
  (1105, 11, 'Prueba · pregunta por WhatsApp'),
  (1305, 13, 'Prueba · contratar con el 35%'),
  (1405, 14, 'Prueba · último día')
) as v(orden, dia, campana)
join inapp_campanas c on c.nombre = v.campana
where not exists (
  select 1 from crm_secuencia_pasos p
  where p.secuencia_id = 'cc275288-213f-4acd-958b-564c2afacda1' and p.inapp_campana_id = c.id
);

commit;
