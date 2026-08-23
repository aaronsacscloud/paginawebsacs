-- Catálogo de licencias y plugins: una sola tabla `plans` con categoría,
-- descripción y las modalidades de cobro que cada concepto permite.
-- Aditivo: no toca precios ni nombres de las 7 filas que ya existen.

alter table plans add column if not exists categoria   text not null default 'plan';
alter table plans add column if not exists descripcion text;
alter table plans add column if not exists precio_vitalicio numeric;
alter table plans add column if not exists modalidades text[] not null default array['anual']::text[];
alter table plans add column if not exists actualizado_at timestamptz default now();

-- Qué modalidades admite hoy cada licencia (deducido de lo que ya se vende).
update plans set modalidades = array['mensual','anual']::text[]
  where slug in ('vende','controla','fideliza','automatiza','personalizada');
update plans set modalidades = array['anual']::text[]      where slug = 'soporte_premium';
update plans set modalidades = array['vitalicio']::text[]  where slug = 'vitalicia_legacy';

update plans set descripcion = d.txt from (values
  ('vende',            'Punto de venta, catálogo y control de existencias.'),
  ('controla',         'Todo lo de Vende más compras, traspasos y reportes por sucursal.'),
  ('fideliza',         'Todo lo de Controla más lealtad, monedero y campañas a clientes.'),
  ('automatiza',       'Todo lo de Fideliza más automatizaciones e inteligencia de inventario.'),
  ('personalizada',    'Alcance pactado con el cliente. El precio se define al cotizar.'),
  ('soporte_premium',  'Póliza de soporte y actualizaciones.'),
  ('vitalicia_legacy', 'Licencias vendidas de por vida antes del modelo de suscripción.')
) as d(slug,txt) where plans.slug = d.slug and plans.descripcion is null;

-- Los 5 plugins nuevos + los 10 que hasta hoy vivían hardcodeados en el código.
insert into plans (slug, nombre, descripcion, categoria, modalidades, a_la_medida, activo, orden)
values
 ('plugin_administracion','Plugin Administración','Control financiero y administrativo de la empresa.','plugin',array['mensual','anual','vitalicio']::text[],true,true,101),
 ('plugin_staff','Plugin Staff','Gestión de Personal.','plugin',array['mensual','anual','vitalicio']::text[],true,true,102),
 ('plugin_ia','Plugin IA','Inteligencia Artificial para la Operación.','plugin',array['mensual','anual','vitalicio']::text[],true,true,103),
 ('plugin_vip','Plugin VIP','Flujos Avanzados de Operación Configurables.','plugin',array['mensual','anual','vitalicio']::text[],true,true,104),
 ('plugin_premium','Plugin Premium','Control avanzado de tu negocio en una sola solución. Integra herramientas VIP, administración financiera y gestión de personal para tener mayor control sobre la operación, los recursos y el equipo de trabajo.','plugin',array['mensual','anual','vitalicio']::text[],true,true,105),
 ('plugin_ordenes_servicio','Órdenes de servicio','Recepción, diagnóstico y entrega de equipos en taller.','plugin',array['anual']::text[],true,true,111),
 ('plugin_consignacion','Consignación','Mercancía de terceros: liquidación al proveedor por lo vendido.','plugin',array['anual']::text[],true,true,112),
 ('plugin_joyeria','Joyería','Costeo por metal y pureza con el precio del gramo al día.','plugin',array['anual']::text[],true,true,113),
 ('plugin_listas_escolares','Listas escolares','Kits por escuela y grado, con cobro a la escuela o al papá.','plugin',array['anual']::text[],true,true,114),
 ('plugin_eventos','Eventos y reservaciones','Ventas de evento, fila de entrega y cortes por show.','plugin',array['anual']::text[],true,true,115),
 ('plugin_nivelacion','Nivelación de inventario','Reparto de existencias entre sucursales según lo que vende cada una.','plugin',array['anual']::text[],true,true,116),
 ('plugin_ecommerce','Tienda en línea','Catálogo público y carrito conectados al mismo inventario.','plugin',array['anual']::text[],true,true,117),
 ('plugin_facturacion','Facturación','CFDI 4.0 con timbres, complementos de pago y notas de crédito.','plugin',array['anual']::text[],true,true,118),
 ('plugin_empleados','Empleados (RH)','Expediente, asistencia y actas administrativas del personal.','plugin',array['anual']::text[],true,true,119),
 ('plugin_admin_avanzada','Administración avanzada (bancos y efectivo)','Cuentas de efectivo, bancos y conciliación.','plugin',array['anual']::text[],true,true,120)
on conflict (slug) do nothing;
