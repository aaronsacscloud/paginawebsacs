-- Un enlace de WhatsApp que no abre nada no es una vía.
update abm_canales set estado='invalido', confianza='baja'
 where tipo like 'whatsapp%' and valor like 'https://wa.me/%'
   and length(regexp_replace(valor,'[^0-9]','','g')) not between 12 and 13;

-- La lada trae el nombre largo del municipio; la pantalla y los correos usan
-- el nombre con el que la gente llama a su ciudad.
update abm_cuentas set ciudad = 'Ciudad de México' where ciudad ilike '%, Ciudad de Mexico' or ciudad ilike '%, CDMX';
update abm_cuentas set ciudad = 'Puebla' where ciudad = 'Heroica Puebla de Zaragoza';
update abm_cuentas set ciudad = 'Querétaro' where ciudad in ('Santiago de Querétaro','Santiago de Queretaro');
update abm_cuentas set ciudad = 'Aguascalientes' where ciudad = 'Aguascalientes, Aguascalientes';
update abm_cuentas set ciudad = 'Mérida' where ciudad = 'Merida';
update abm_cuentas set ciudad = 'León' where ciudad in ('León de los Aldama','Leon de los Aldama');
