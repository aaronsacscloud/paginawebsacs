-- «Vi X en  y me quedé pensando…»
--
-- Once plantillas del correo 1 meten {{ciudad}} pegada a la frase, sin su
-- [[si ciudad]]. Con las 80 cuentas mexicanas que no traen ciudad, el correo
-- que jura no ser automático abre con un hueco a la vista.
--
-- El giro que sí lo tiene bien es zapaterías: `Vi {{nombre}}[[si ciudad]] en
-- {{ciudad}}[[/si]]`. Se copia esa forma. Son 80 cuentas, no miles, pero es
-- el primer renglón del primer correo de verdad de la cadencia.

update abm_plantillas
set cuerpo = replace(cuerpo, 'Vi {{nombre}} en {{ciudad}}',
                             'Vi {{nombre}}[[si ciudad]] en {{ciudad}}[[/si]]')
where activa and canal = 'email' and cuerpo like '%Vi {{nombre}} en {{ciudad}}%';

select count(*) quedan_sueltas from abm_plantillas
where activa and canal='email' and cuerpo like '%{{ciudad}}%'
  and cuerpo !~ '\[\[si ciudad\]\][^\[]*\{\{ciudad\}\}';
