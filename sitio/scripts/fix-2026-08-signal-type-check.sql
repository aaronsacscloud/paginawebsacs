-- El CHECK de signal_type congelaba 5 tipos de una versión anterior del CRM, así
-- que TODA señal nueva se rechazaba — y como el registro atrapaba el error, la
-- bandeja se quedaba vacía sin decir por qué.
--
-- Se quita la lista cerrada en vez de ampliarla: los tipos los define el detector
-- en código y crecen cada vez que se agrega una señal. Un CHECK que hay que
-- migrar en cada señal nueva solo garantiza que la próxima vuelva a fallar en
-- silencio. La integridad que importa aquí la da el índice único por
-- (empresa, tipo) abierto, no una lista de strings.
alter table expansion_signals drop constraint if exists expansion_signals_signal_type_check;
delete from expansion_signals where signal_type = 'prueba_diag';
