-- ═══ Qué módulos incluye cada plan ═══
--
-- Sirve para detectar clientes que USAN módulos que su plan no cubre (upsell) y
-- clientes que pagan por módulos que no usan (riesgo de churn).
--
-- Se guarda como MATRIZ EXPLÍCITA (plan × módulo) en vez de una escalera con
-- herencia que se resuelva al leer. Son 17 módulos × 6 planes = 102 filas: se
-- puede abrir la tabla y ver exactamente qué permite cada plan, y corregir un
-- caso suelto con un UPDATE sin tocar código ni redesplegar. La columna `origen`
-- deja escrito POR QUÉ está permitido, para no re-discutirlo dentro de un mes.
create table if not exists crm_plan_modulos (
  plan_slug  text not null,
  modulo     text not null,          -- nombre EXACTO del catálogo de sacs_api (17)
  incluido   boolean not null,
  origen     text,                   -- de dónde sale la decisión
  confirmado boolean not null default true,  -- false = ambiguo, pendiente de revisión humana
  primary key (plan_slug, modulo)
);

-- Módulos que NO pertenecen a ningún plan base: se venden como plugin aparte.
-- Usarlos NO es "fuera de plan" si el cliente compró el add-on — por eso se
-- marcan aquí y el indicador los resta antes de avisar.
create table if not exists crm_modulos_plugin (
  modulo      text primary key,
  plugin_slug text,                  -- slug del plugin en el catálogo de planes
  nota        text
);

truncate crm_plan_modulos;
truncate crm_modulos_plugin;

insert into crm_modulos_plugin (modulo, plugin_slug, nota) values
  ('Eventos y salones',     'plugin_eventos',           'No aparece en ningún plan de la web: se vende como plugin.'),
  ('Reparaciones / taller', 'plugin_ordenes_servicio',  'No aparece en ningún plan de la web: se vende como plugin.');

-- ── La escalera: Controla hereda de Vende, Fideliza de Controla, Automatiza de Fideliza ──
with modulos(modulo, tier, confirmado, origen) as (values
  -- tier 1 = Vende
  ('Punto de venta',              1, true,  'Vende · "Punto de venta online y offline"'),
  ('Pedidos / eCommerce',         1, true,  'Vende · "Pedidos y apartados" + "Tienda en línea integrada"'),
  ('Apartados',                   1, true,  'Vende · "Pedidos y apartados"'),
  ('Cortes de caja',              1, true,  'Vende · "Cortes de caja y arqueos"'),
  ('Facturación electrónica',     1, true,  'Vende · "Facturación: 20 folios incluidos"'),
  -- tier 2 = Controla
  ('Órdenes de compra',           2, true,  'Controla · "Órdenes de compra y cuentas por pagar"'),
  ('Transferencias',              2, true,  'Controla · "Traspasos entre sucursales"'),
  ('Conteos físicos',             2, true,  'Controla · "Conteo físico desde el celular"'),
  ('Gastos',                      2, true,  'Controla · "Control de gastos"'),
  ('Proveedores',                 2, true,  'Controla · implícito en "cuentas por pagar"'),
  ('Catálogo de clientes',        2, true,  'Controla · "Directorio de clientes e historial de compras"'),
  ('Promociones',                 2, false, 'AMBIGUO: Vende tiene "precios por volumen", Fideliza "campañas por WhatsApp". Provisional en Controla.'),
  ('Cuentas de efectivo / bancos',2, false, 'AMBIGUO: no aparece literal en ninguna categoría. Provisional en Controla.'),
  -- tier 3 = Fideliza
  ('Programa de lealtad',         3, true,  'Fideliza · "Monedero electrónico y puntos por compra"'),
  ('Tarjetas de regalo',          3, true,  'Fideliza · "Tarjetas de regalo físicas y digitales"')
), planes(plan_slug, tier) as (values
  ('vende', 1), ('controla', 2), ('fideliza', 3), ('automatiza', 4)
)
insert into crm_plan_modulos (plan_slug, modulo, incluido, origen, confirmado)
select p.plan_slug, m.modulo, (m.tier <= p.tier),
       case when m.tier <= p.tier then m.origen else 'Requiere un plan superior (tier ' || m.tier || ')' end,
       m.confirmado
  from planes p cross join modulos m;

-- Los dos plugins: en ningún plan base.
insert into crm_plan_modulos (plan_slug, modulo, incluido, origen, confirmado)
select p.plan_slug, g.modulo, false, 'Plugin que se vende aparte', true
  from (values ('vende'),('controla'),('fideliza'),('automatiza'),('vitalicia')) p(plan_slug)
  cross join crm_modulos_plugin g;

-- ── VITALICIA: no es un punto de la escalera, es un paquete propio ──
-- Regla del negocio (3-ago-2026): todo lo de Vende, y de Controla ÚNICAMENTE la
-- recepción de productos. Nada más. Se escribe como excepción explícita porque
-- no se puede expresar con "hereda de Vende".
insert into crm_plan_modulos (plan_slug, modulo, incluido, origen, confirmado)
select 'vitalicia', m.modulo,
       (m.tier = 1 or m.modulo = 'Órdenes de compra'),
       case when m.tier = 1 then 'Vitalicia · incluye todo el plan Vende'
            when m.modulo = 'Órdenes de compra' then 'Vitalicia · ÚNICA excepción de Controla: recepción de productos'
            else 'Vitalicia · no incluido (solo Vende + recepción de productos)' end,
       -- "recepción de productos" vive dentro del flujo de órdenes de compra, que
       -- es el módulo que SACS detecta; queda por confirmar que sea el mapeo correcto.
       (m.modulo <> 'Órdenes de compra')
  from (values
    ('Punto de venta',1),('Pedidos / eCommerce',1),('Apartados',1),('Cortes de caja',1),('Facturación electrónica',1),
    ('Órdenes de compra',2),('Transferencias',2),('Conteos físicos',2),('Gastos',2),('Proveedores',2),
    ('Catálogo de clientes',2),('Promociones',2),('Cuentas de efectivo / bancos',2),
    ('Programa de lealtad',3),('Tarjetas de regalo',3)
  ) m(modulo, tier);
