-- Tres capacidades más en «Crecimiento»: subir de plan, catálogo con IA y
-- renta de productos. Correo + dentro de Sacs para las tres, y UN solo
-- WhatsApp más — el del catálogo con IA.
--
-- POR QUÉ ESE Y NO OTRO
-- Es el que peor se explica por escrito y mejor enseñando, y el único donde el
-- cliente puede mandarnos una foto suya por el mismo canal y recibirla hecha en
-- minutos. Un WhatsApp que termina en algo que el cliente ve de inmediato vale
-- más que tres que solo describen.
--
-- El arco se alarga a 116 días. Las capacidades nuevas van al final a propósito:
-- las cinco primeras son cosas que ya puede usar con lo que paga; estas tres
-- son cambios más grandes —de plan, de forma de fotografiar, de modelo de
-- negocio— y pedirlas antes de haber demostrado utilidad es pedir demasiado
-- pronto.
begin;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · el plan que sigue', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "Hay un escalón más arriba del tuyo", "mensaje": "Subir de plan no es empezar de nuevo: conservas tu catálogo, tus clientes y tu histórico — lo que cambia es qué puedes hacer con ellos. Te decimos qué trae el que sigue en tu caso, y si te conviene o no.", "botones": [{"texto": "Ver qué trae", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 87') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · catálogo con IA', 'activa', 'banner_superior', 'web', 'normal', 'continua',
        '{"titulo": "Tus prendas, puestas en un modelo", "mensaje": "Sin sesión de fotos: la foto que ya tienes sale puesta en una persona. Y tu clienta puede ver cómo se le vería a ella con el probador virtual, con lo que sí hay en su talla.", "botones": [{"texto": "Que me lo enseñen", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Mandar una foto", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 99') on conflict do nothing;

insert into inapp_campanas (nombre, estado, formato, canal, prioridad, modo, contenido, comportamiento, audiencia, nivel, origen_secuencia, objetivo_texto)
values ('Crecimiento · rentar en vez de vender', 'activa', 'tarjeta_inicio', 'web', 'normal', 'continua',
        '{"titulo": "La misma prenda, cobrada muchas veces", "mensaje": "Calendario por pieza, depósito en garantía, estado a la devolución y cuánto lleva generado cada prenda contra lo que costó. Con el mismo inventario que ya tienes.", "botones": [{"texto": "Ver cómo funciona", "accion": "url_sacs", "destino": "https://www.sacscloud.com/agendar/crecimiento"}, {"texto": "Preguntar", "accion": "whatsapp_ventas"}]}'::jsonb, '{}'::jsonb,
        '{"grupos": [], "incluir_cuentas": [], "solo_manual": true}'::jsonb, '{"tipo":"todos"}'::jsonb,
        '11111111-2222-4333-8444-5555555555b1', 'Crecimiento · día 111') on conflict do nothing;

-- El cierre pasa del día 72 al 120: ahora resume diez cosas, no cinco.
update crm_secuencia_pasos set dia = 120, orden = 200
 where secuencia_id = '11111111-2222-4333-8444-5555555555b1'
   and email_template_id = (select id from email_templates where nombre = 'Crecimiento 7 · ¿Alguno te movió?');

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, email_template_id, activo)
select '11111111-2222-4333-8444-5555555555b1', v.orden, v.dia, 'correo', t.id, true
from (values
  (100,  84, 'Crecimiento 8 · Lo que trae el plan que sigue'),
  (120,  96, 'Crecimiento 9 · Tu catálogo, con inteligencia artificial'),
  (140, 108, 'Crecimiento 10 · Rentar en vez de vender')
) as v(orden, dia, plantilla)
join email_templates t on t.nombre = v.plantilla
where not exists (select 1 from crm_secuencia_pasos p where p.secuencia_id='11111111-2222-4333-8444-5555555555b1' and p.email_template_id = t.id);

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, inapp_campana_id, activo)
select '11111111-2222-4333-8444-5555555555b1', v.orden, v.dia, 'inapp', ic.id, true
from (values
  (105,  87, 'Crecimiento · el plan que sigue'),
  (125,  99, 'Crecimiento · catálogo con IA'),
  (145, 111, 'Crecimiento · rentar en vez de vender')
) as v(orden, dia, campana)
join inapp_campanas ic on ic.nombre = v.campana
where not exists (select 1 from crm_secuencia_pasos p where p.secuencia_id='11111111-2222-4333-8444-5555555555b1' and p.inapp_campana_id = ic.id);

insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
select '11111111-2222-4333-8444-5555555555b1', 130, 102, 'wa', 'crecimiento_catalogo_ia', true
where not exists (select 1 from crm_secuencia_pasos p where p.secuencia_id='11111111-2222-4333-8444-5555555555b1' and p.wa_plantilla='crecimiento_catalogo_ia');

-- El corte sube: con 120 días de arco, 120 lo dejaría fuera por un día.
update crm_secuencias set corte_dias = 160 where id = '11111111-2222-4333-8444-5555555555b1';

commit;
-- El correo de cierre resumía CINCO cosas y ahora la serie enseña OCHO.
--
-- Un cierre que no menciona lo que mandaste hace tres semanas se lee como si no
-- te acordaras de tu propia cadencia — y el que sí leyó el del plan o el de la
-- renta se pregunta si le llegaron por error.
begin;

update email_templates
   set asunto = 'Ocho cosas en cuatro meses. ¿Alguna te sirvió?',
       preview_text = 'Y si ninguna, dímelo y dejo de mandarlas.',
       bloques = (
         select jsonb_agg(
           case
             when b.value->>'id' = 't1'
               then jsonb_build_object('id','t1','tipo','texto','texto',
                    '{{nombre|Hola}}, te mandé ocho cosas en estos meses:')
             when b.value->>'id' = 'l1'
               then jsonb_build_object('id','l1','tipo','lista','items', jsonb_build_array(
                    '🤖 **Axo** — el asistente que ejecuta.',
                    '👥 **Empleados** — asistencias, contratos, actas, clima.',
                    '🏦 **Administración** — gastos, cobrar y pagar, bancos.',
                    '📦 **Nivelación** — qué mover y qué comprar.',
                    '🧩 **Personalizaciones** — automatizar un proceso tuyo.',
                    '⬆️ **El plan que sigue** — {{plan_siguiente|el siguiente escalón}}.',
                    '📸 **Catálogo con IA** — modelos y probador virtual.',
                    '👗 **Renta de productos** — la misma prenda, muchas veces.'))
             else b.value
           end order by b.ord)
         from jsonb_array_elements(bloques) with ordinality b(value, ord))
 where nombre = 'Crecimiento 7 · ¿Alguno te movió?';

commit;
