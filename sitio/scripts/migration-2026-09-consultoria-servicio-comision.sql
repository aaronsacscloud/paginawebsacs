-- Consultoría como concepto del catálogo, y su tarifa para el consultor.
--
-- Hasta hoy una consultoría se escribía A MANO en la cotización ("Implementación
-- 1 a 1", "Pers: gestión de costos y merma") y quedaba como texto libre. Nada
-- de lo que está abajo podía saber qué se había vendido: ni Consultoría, ni el
-- ARR, ni la comisión. El catálogo ya tenía Implementación, Capacitación y
-- Migración desde antes —y tampoco se usaban, porque el cotizador no tenía
-- botón para meterlas—.
--
-- Las dos tarifas nuevas no son un "servicio de arranque" más:
--   · Consultoría 74 % — es trabajo que EJECUTA el consultor, no una venta que
--     se trae. Sacs se queda el 26 % de plataforma y administración.
--   · Implementación 100 % — si el cliente paga por ella, el dinero es de quien
--     la hace. Cuando va de cortesía entra en $0 y no comisiona nada, así que
--     la regla no necesita excepción.
-- Capacitación y Migración se quedan en el 35 % de la categoría `servicio`.
--
-- Ganan sobre la regla de categoría porque el motor prefiere siempre la regla
-- más específica (SKU=4 > categoría=2 > comodín). Quedan editables desde
-- Configuración → Comisiones sin tocar código.

-- ── 1 · El concepto en el catálogo ──
insert into plans (slug, nombre, categoria, a_la_medida, activo, orden, descripcion)
select 'servicio_consultoria', 'Consultoría', 'servicio', true, true,
       -- Primero de la lista: es el servicio que más se cotiza y el que motivó
       -- este cambio; los otros tres llevaban meses en el catálogo sin usarse.
       coalesce((select min(orden) from plans where categoria = 'servicio'), 1) - 1,
       'Acompañamiento y consultoría de negocio: revisión de procesos, definición de flujos y sesiones de trabajo con el cliente.'
where not exists (select 1 from plans where slug = 'servicio_consultoria');

-- ── 2 · Las tarifas, una por modelo de comisiones ──
-- `pct_renovacion` se queda en nulo a propósito: un servicio no se renueva, y
-- un nulo hace que cobre siempre su tasa de primera venta.
insert into comision_reglas (modelo_id, plan_id, categoria, origen, pct, nota)
select m.id, p.id, null, null, 74,
       'Consultoría · la ejecuta el consultor (Sacs se queda el 26%)'
from comision_modelos m
cross join (select id from plans where slug = 'servicio_consultoria') p
where not exists (
  select 1 from comision_reglas r where r.modelo_id = m.id and r.plan_id = p.id
);

insert into comision_reglas (modelo_id, plan_id, categoria, origen, pct, nota)
select m.id, p.id, null, null, 100,
       'Implementación · si el cliente la paga, el cobro es de quien la ejecuta'
from comision_modelos m
cross join (select id from plans where slug = 'servicio_implementacion') p
where not exists (
  select 1 from comision_reglas r where r.modelo_id = m.id and r.plan_id = p.id
);
