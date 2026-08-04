-- Ajustes con la regla de negocio confirmada (4-ago-2026):
--
-- 1) "Cuentas de efectivo / bancos" NO está en ningún plan: se habilita solo con
--    el PLUGIN DE ADMINISTRACIÓN AVANZADA. Quien lo use sin haberlo comprado es
--    oportunidad de cobro, no un cliente en su derecho.
-- 2) "Promociones" es el módulo del sistema donde se crean promociones para
--    aplicar descuentos EN EL PUNTO DE VENTA. Es funcionalidad de venta base, así
--    que va en Vende. (No confundir con "campañas y promociones por WhatsApp" de
--    Fideliza, que es marketing y es otra cosa.) Se coloca en el plan más bajo a
--    propósito: en una señal de oportunidad comercial, un falso positivo cuesta
--    más que una detección de menos.
insert into crm_modulos_plugin (modulo, plugin_slug, nota) values
  ('Cuentas de efectivo / bancos', 'plugin_admin_avanzada',
   'No está en ningún plan: se habilita con el plugin de Administración avanzada.')
on conflict (modulo) do update set plugin_slug = excluded.plugin_slug, nota = excluded.nota;

update crm_plan_modulos
   set incluido = false,
       origen = 'Plugin de Administración avanzada — no está en ningún plan',
       confirmado = true
 where modulo = 'Cuentas de efectivo / bancos';

update crm_plan_modulos
   set incluido = true,
       origen = 'Vende · módulo de promociones para descuentos en el punto de venta',
       confirmado = true
 where modulo = 'Promociones';
