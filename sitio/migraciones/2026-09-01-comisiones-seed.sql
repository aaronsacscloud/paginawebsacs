-- ════════════════════════════════════════════════════════════════════════
-- Comisiones · limpieza de SKUs + siembra del modelo
-- ════════════════════════════════════════════════════════════════════════
--
-- PRERREQUISITO del motor: si una suscripción no tiene plan_id, no hay SKU al
-- cual colgarle un porcentaje. Había 33 así, sobre 28 nombres distintos que en
-- realidad son variantes de escritura del mismo concepto ("plugin premium",
-- "PLUGIN PREMIUM ", "licencia PLUGIN VIP", "Plugins & Add ons VIP"…).
--
-- Se resuelve en dos pasos y NINGUNO adivina:
--   · se crean los SKUs que faltaban de cosas que YA se venden;
--   · se emparejan solo los nombres que coinciden sin ambigüedad.
-- Lo verdaderamente ambiguo se queda sin plan_id a propósito y sale marcado
-- en la pantalla de comisiones. Un pago sin SKU no desaparece del periodo:
-- aparece señalado, que es lo contrario de tragárselo en silencio.

begin;

-- ═══ 1 · Categorías nuevas ═══
-- El catálogo solo conocía 'plan' y 'plugin'. El marco de colaboración cobra
-- distinto la personalización (20%) y los servicios de arranque (35%), y la
-- suscripción al canal de partners es un concepto aparte. Sin categoría propia
-- no se les puede poner tarifa.
insert into plans (slug, nombre, descripcion, categoria, modalidades, a_la_medida, activo, orden)
values
  ('personalizacion',      'Personalización a la medida', 'Desarrollo hecho para un cliente específico.',        'personalizacion', array['vitalicio'],          true,  true, 1),
  ('servicio_implementacion','Implementación',            'Puesta en marcha de la cuenta.',                      'servicio',        array['vitalicio'],          true,  true, 1),
  ('servicio_capacitacion', 'Capacitación',               'Capacitación al equipo del cliente.',                 'servicio',        array['vitalicio'],          true,  true, 2),
  ('servicio_migracion',    'Migración de datos',         'Carga de catálogo, existencias e histórico.',         'servicio',        array['vitalicio'],          true,  true, 3),
  ('canal_partners',        'Suscripción al canal de partners', 'Cuota que paga un partner por pertenecer al canal.', 'partner',   array['anual','mensual'],    true,  true, 1)
on conflict (slug) do nothing;

-- SKUs de producto que ya se vendían sin existir en el catálogo (salieron del
-- audit de suscripciones sin plan_id).
insert into plans (slug, nombre, descripcion, categoria, modalidades, a_la_medida, activo, orden)
values
  ('plugin_inbox',          'Inbox',          'Bandeja de conversaciones.',        'plugin', array['anual','mensual'], true, true, 30),
  ('plugin_mobile',         'App móvil',      'Aplicación móvil de SACS.',         'plugin', array['anual','mensual'], true, true, 31),
  ('plugin_pagina_web',     'Página web',     'Sitio web del cliente.',            'plugin', array['anual','vitalicio'], true, true, 32),
  ('plugin_email_marketing','Email marketing','Campañas y embudos de correo.',     'plugin', array['anual','mensual'], true, true, 33)
on conflict (slug) do nothing;

-- ═══ 2 · Emparejar lo ya vendido ═══
-- Solo coincidencias inequívocas: se normaliza el nombre (minúsculas, sin
-- acentos, sin "licencia/plan", sin la modalidad al final) y se compara contra
-- una lista escrita a mano. Nada de LIKE difuso: un emparejamiento equivocado
-- le paga una comisión a la persona equivocada.
with norm as (
  select s.id,
         regexp_replace(
           trim(lower(translate(s.nombre_plan, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))),
           '\s+', ' ', 'g') as n
  from subscriptions s
  where s.plan_id is null and s.nombre_plan is not null
),
mapa(patron, slug) as (values
  ('controla',                       'controla'),
  ('vende',                          'vende'),
  ('plan vende anual',               'vende'),
  ('licencia fideliza',              'fideliza'),
  ('licencia fideliza vitalicia',    'fideliza'),
  ('licencia personalizada anual',   'personalizada'),
  ('licencia vitalicia legacy',      'vitalicia_legacy'),
  ('soporte premium anual',          'soporte_premium'),
  ('plugin premium',                 'plugin_premium'),
  ('plugin vip',                     'plugin_vip'),
  ('licencia plugin vip',            'plugin_vip'),
  ('plugins & add ons vip',          'plugin_vip'),
  ('empleados (rh)',                 'plugin_empleados'),
  ('listas escolares anual',         'plugin_listas_escolares'),
  ('licencia inbox',                 'plugin_inbox'),
  ('licencia mobile',                'plugin_mobile'),
  ('licenica pagina web',            'plugin_pagina_web'),
  ('plugin email marketing',         'plugin_email_marketing'),
  ('programa partners sacs',         'canal_partners')
)
update subscriptions s
   set plan_id = p.id
  from norm, mapa, plans p
 where s.id = norm.id
   and norm.n = mapa.patron
   and p.slug = mapa.slug;

-- ═══ 3 · El modelo del marco de colaboración ═══
insert into comision_modelos (nombre, descripcion, es_default, desc_corporativa_pct, desc_pagadora_pct, cuenta_default, tasa_incumplimiento_pct)
select 'Consultoría externa · marco 2026',
       'Tarifas del marco de colaboración: la tasa es del CLIENTE (según su origen) y se conserva en todas sus renovaciones.',
       true, 16, 6, 'corporativa', 15
where not exists (select 1 from comision_modelos where nombre = 'Consultoría externa · marco 2026');

-- La matriz origen × concepto. La personalización y los servicios pagan igual
-- para todos los orígenes porque el grueso del monto se va en horas de equipo,
-- no en captación: por eso su regla no lleva origen.
with m as (select id from comision_modelos where nombre = 'Consultoría externa · marco 2026')
insert into comision_reglas (modelo_id, categoria, origen, pct, nota)
select m.id, v.categoria, v.origen, v.pct, v.nota from m, (values
  ('plan',            'lead_sacs',  35, 'Licencia · lead de marketing de Sacs'),
  ('plan',            'referido',   55, 'Licencia · referido u outbound'),
  ('plan',            'recuperada', 70, 'Licencia · cuenta recuperada'),
  ('plan',            'heredado',   30, 'Licencia · cuenta preexistente de Sacs'),
  ('plugin',          'lead_sacs',  30, 'Plugin · lead de marketing de Sacs'),
  ('plugin',          'referido',   55, 'Plugin · referido u outbound'),
  ('plugin',          'recuperada', 70, 'Plugin · cuenta recuperada'),
  ('plugin',          'heredado',   30, 'Plugin · cuenta preexistente de Sacs'),
  ('personalizacion', null,         20, 'Personalización · igual para todo origen'),
  ('servicio',        null,         35, 'Servicios de arranque · igual para todo origen'),
  ('partner',         null,         35, 'Suscripción al canal de partners')
) as v(categoria, origen, pct, nota)
on conflict do nothing;

commit;
