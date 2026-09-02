-- El corte semanal tenía dos formas de perder dinero por el CALENDARIO.
--
-- 1. La ventana era lunes→viernes: sábado y domingo no caían en ninguna
--    semana. Hoy hay 31 líneas con fecha de fin de semana ($184,182 de
--    comisión) que ningún corte automático habría recogido nunca.
--    Se arregla en código: la ventana pasa a ser de 7 días y las semanas
--    consecutivas embaldosan el calendario sin huecos ni traslapes.
--
-- 2. Un pago capturado tarde cae en una semana cuyo corte YA se cerró, y la
--    línea se queda sin corte para siempre. No es un caso raro: 133 de 183
--    pagos ($2,562,918) se capturaron más de una semana después de su fecha.
--    Se arregla arrastrando las líneas rezagadas al siguiente corte.
--
-- `arrastrar_desde` es el piso de ese arrastre. Existe porque sin él, el
-- primer corte semanal se llevaría los $776,639 de comisión histórica de
-- 2025-2026 que hoy están sin corte — y si esa historia se paga o no es una
-- decisión del dueño, no del cron. Se deja en la fecha de arranque del
-- módulo; para incluir historia, se mueve esta fecha hacia atrás.
alter table comision_ciclo add column if not exists arrastrar_desde date;
update comision_ciclo set arrastrar_desde = '2026-09-01' where id = true and arrastrar_desde is null;

comment on column comision_ciclo.arrastrar_desde is
  'Piso del arrastre de lineas rezagadas: una linea anterior a esta fecha no entra sola a un corte.';
