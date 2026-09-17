-- El plan que YA tenía, no un número a mano — 17-sep-2026
--
-- Pedido del dueño: «aquí no es "a cuánto vuelve al mes": pon una sección donde
-- se confirma el plan que ella pagó en su momento, ya sea anual o mensual, y
-- manéjalo en automático después de los 12 meses gratis que le damos».
--
-- Tiene razón y el campo viejo tenía dos problemas. Uno: pedía teclear un
-- número que el sistema YA SABE —la suscripción que canceló está en la base con
-- su plan, su ciclo y su monto—, y todo dato que se teclea pudiendo leerse
-- termina distinto del real. Dos, y más grave: obligaba a convertir a mensual.
-- Quien pagaba $42,000 al año no vuelve a «$3,500 al mes»: vuelve a su
-- anualidad. Escribirlo como mensualidad cambia el trato en el documento que
-- firma, y ahí es donde nacen los malentendidos de cobranza.
--
-- Por eso se guarda el CICLO además del monto: el documento tiene que poder
-- decir «$42,000 al año» o «$3,500 al mes» según lo que de verdad tenía.

alter table quotes add column if not exists rescate_ciclo        text;
alter table quotes add column if not exists rescate_plan_nombre  text;

comment on column quotes.rescate_ciclo is 'mensual | anual — el ciclo del plan que tenía. Decide cómo se escribe el monto de regreso en el documento.';
comment on column quotes.rescate_plan_nombre is 'Nombre del plan que pagaba, tal como estaba en su suscripción.';
