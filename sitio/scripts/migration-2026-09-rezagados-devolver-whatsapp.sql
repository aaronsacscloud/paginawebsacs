-- DEVOLVER EL WHATSAPP A REZAGADOS (15-sep-2026)
--
-- Error mío: el dueño dijo «los descalificados ya no reciben WhatsApp» y yo lo
-- apliqué a Rezagados. Rezagados SIEMPRE mandó WhatsApp y así se queda; la que
-- es de puro correo es «Descalificados · top of mind», que ya lo está.
--
-- Se reponen los 6 pasos tal como estaban —el mismo orden, el mismo día, el
-- mismo carril y el mismo activo/apagado—. Los dos primeros son los que salen
-- (rezagado_saludo_v2 y rezagado_cuenta_v2); los otros cuatro estaban apagados
-- desde antes y se reponen apagados, que es como los dejó quien los editó.
insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, activo, dia_semana, wa_plantilla)
select s.id, v.orden, v.dia, 'wa', v.activo, v.dia_semana, v.plantilla
from crm_secuencias s,
     (values (1,    1, true,  null::int, 'rezagado_saludo_v2'),
             (2,    2, true,  null,      'rezagado_cuenta_v2'),
             (1055, 1, false, 1,         'rezagado_novedad'),
             (2025, 1, false, 3,         'rezagado_curva'),
             (2105, 1, false, 3,         'rezagado_puerta'),
             (3085, 1, false, 5,         'rezagado_temporada')
     ) as v(orden, dia, activo, dia_semana, plantilla)
where s.nombre = 'Rezagados · top of mind'
  and not exists (select 1 from crm_secuencia_pasos p
                  where p.secuencia_id = s.id and p.canal = 'wa' and p.orden = v.orden);

-- Comprobación: Rezagados vuelve a 33 pasos (31 correos + 2 WhatsApp activos +
-- 4 apagados) y Descalificados sigue siendo de puro correo.
select s.nombre, s.activa, p.canal, p.activo, count(*) as pasos
from crm_secuencias s join crm_secuencia_pasos p on p.secuencia_id = s.id
where s.nombre in ('Rezagados · top of mind', 'Descalificados · top of mind')
group by 1, 2, 3, 4 order by 1, 3, 4;
