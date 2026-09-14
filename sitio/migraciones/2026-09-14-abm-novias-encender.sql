-- 14-sep-2026 · Novias: se enciende la cadencia (correo + WhatsApp) con goteo.
--
-- El dueño revisó la cadencia completa y dijo: «1 ok 2 ok 3 sí claro, a los
-- que ya están confirmados igual». O sea: (1) MX corrido —41 válidos, 2
-- inválidos, se marcaron con scripts/abm-verificar-mx.mjs—, (2) goteo de
-- diez al día con los borradores del 12-sep borrados para que el goteo los
-- vuelva a escribir con el código de hoy, y (3) WhatsApp dentro de la
-- cadencia, solo a quien publicó su wa.me (50 de 73 lo hicieron).
--
-- ── A. Las tres plantillas de WhatsApp, reescritas para Meta ────────────────
-- Las que había estaban escritas para mandarse a mano y llevaban condicionales
-- ([[si persona]]…, [[si rating]]…). Una plantilla de Meta es texto FIJO con
-- huecos: no hay condicionales, y en el envío automático no viaja persona ni
-- calificación (variablesDe sin persona → el hueco saldría «—»). Se quedan
-- solo {{nombre}} y {{ciudad}}, que las 73 casas tienen. Conservan los siete
-- elementos del §7.6 (quiénes somos, de dónde salió el contacto, algo real de
-- ellos, por qué ellos, lo específico de novias, lo que damos, una pregunta
-- fácil). Ninguna variable abre ni cierra el cuerpo; todas caben en 1024.
-- Los botones (boton_texto/boton_url) los registra `botonesDe` en
-- abm-whatsapp.ts: un toque en la respuesta rápida abre la ventana de 24 h.
-- Un «Ahora no» también es respuesta y frena la cadencia: mejor eso que un
-- reporte.
begin;

update abm_plantillas set
  cuerpo = E'Buen día. Le escribo de Sacs — hacemos software mexicano de inventario y punto de venta para negocios de moda.\n\nEstamos armando el mapa de las mejores casas de novia de México y {{nombre}}, en {{ciudad}}, salió en la lista. Los encontramos en Google Maps; nadie nos pasó su contacto.\n\nLe escribo porque lo nuestro no es un punto de venta genérico: tenemos una versión hecha para casas de novia. Apartados con la fecha de la boda y sus abonos al día, el muestrario marcado aparte de lo que sí se vende, y las pruebas, el taller y el pedido al proveedor con fecha.\n\nEste mes estamos dando demos gratis por videollamada, 20 minutos y sin compromiso. ¿Le muestro cómo se vería con sus modelos?',
  meta_nombre = 'abm_novias_abre', meta_idioma = 'es_MX',
  boton_texto = 'Sí, muéstrenme | Ahora no', boton_url = null,
  objetivo = 'WhatsApp · abre. Plantilla de Meta: texto fijo, solo {{nombre}} y {{ciudad}}. Un día después del primer correo.'
where id = '8ef4c942-c949-4ef5-b0c2-7088be6aa185';

update abm_plantillas set
  cuerpo = E'Le escribo una vez más y ya no le insisto más.\n\nLo que más nos dicen las casas de novia es que todo cuelga de una fecha: el vestido que se pide al proveedor, las pruebas, el anticipo y la liquidación. Si una se recorre, se recorren todas — y eso hoy casi siempre vive en una libreta o en un grupo de WhatsApp.\n\nEso es justo lo que resuelve la versión para novias: cada novia con su fecha, sus abonos y sus pruebas en un solo lugar, y el sistema avisando antes, no cuando ya se pasó.\n\nLa demo por videollamada sigue en pie: 20 minutos, gratis y sin compromiso. ¿Le acomoda esta semana o la que entra?',
  meta_nombre = 'abm_novias_sigue', meta_idioma = 'es_MX',
  boton_texto = 'Esta semana | Mejor no', boton_url = null,
  objetivo = 'WhatsApp · sigue. Plantilla de Meta sin huecos. A media cadencia (día 16).'
where id = '1a9e6ccd-ed67-4d7a-84bd-7227dfe16096';

update abm_plantillas set
  cuerpo = E'Con este cierro el tema — no quiero ser el que insiste.\n\nSi en alguna temporada les pesa llevar los apartados, las pruebas y los abonos en libreta, aquí seguimos y con gusto les muestro cómo lo resuelve el sistema. Este número queda abierto.\n\nY si prefiere verlo sin hablar con nadie primero, puede agendar la demo cuando quiera con el botón de abajo.\n\nGracias por el tiempo y mucho éxito con la temporada.',
  meta_nombre = 'abm_novias_cierra', meta_idioma = 'es_MX',
  boton_texto = 'Agendar cuando quiera', boton_url = 'https://www.sacscloud.com/agendar/demo',
  objetivo = 'WhatsApp · cierra. Plantilla de Meta sin huecos, con botón de enlace a la agenda. Después del último correo (día 36).'
where id = 'ede4be36-d88b-47e7-9a08-14c140ec02ed';

-- ── B. Los pasos de WhatsApp en las dos cadencias de novias ─────────────────
-- Mismos días que mayoristas: abre al día 2 (un día después del primer
-- correo), insiste al 16 y cierra al 36, después del último correo. El cron
-- ya cuida que no salgan correo y WhatsApp el mismo día a la misma casa.
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'whatsapp', p.id, true, d.nota
from abm_cadencias c
join (values
  (2, 1, 'abre',   'Abre por WhatsApp un día después del primer correo'),
  (16, 2, 'sigue', 'Insiste una vez a media cadencia'),
  (36, 3, 'cierra','Cierra después del último correo')
) as d(dia, orden, pl, nota) on true
join abm_plantillas p on p.giro = 'novias' and p.canal = 'whatsapp' and p.nombre = d.pl and p.activa
where c.giro = 'novias'
  and not exists (select 1 from abm_pasos x where x.cadencia_id = c.id and x.canal = 'whatsapp' and x.dia = d.dia);

-- ── C. Fuera los borradores del 12-sep y las dos pruebas canceladas ─────────
-- 29 casas tienen 232 correos en borrador escritos desde la ficha la noche del
-- 12-sep (sin WhatsApp, y con el guion anterior a los arreglos de esta
-- semana); Estrómboli y Tiscareno Bride traen 16 correos cancelados de las
-- pruebas del 13-sep. Nada se envió. Se borran para que las 73 queden con
-- cero toques y el goteo las escriba de nuevo, con su firma y su fecha, como
-- a cualquier otra (igual que el relanzamiento de Intermoda del 14-sep).
do $$ begin
  if exists (
    select 1 from abm_toques t join abm_cuentas c on c.id = t.cuenta_id
    where c.giro = 'novias' and t.estado not in ('borrador', 'aprobado', 'cancelado')
  ) then raise exception 'hay toques de novias enviados o en curso: no se borra nada'; end if;
end $$;

create temp table _novias_reset on commit drop as
  select distinct t.cuenta_id from abm_toques t join abm_cuentas c on c.id = t.cuenta_id where c.giro = 'novias';

delete from abm_toques where cuenta_id in (select cuenta_id from _novias_reset);

update abm_cuentas set etapa = 'sin_tocar', updated_at = now()
 where id in (select cuenta_id from _novias_reset) and etapa in ('sin_tocar', 'en_cadencia');

insert into abm_actividad (cuenta_id, canal, tipo, texto)
select cuenta_id, 'sistema', 'nota',
  'Se borró la cadencia en borrador del 12-sep (nunca se envió). El dueño encendió el goteo «Novias · diez al día» el 14-sep-2026: el goteo la vuelve a escribir con el guion vigente, con WhatsApp si publicó su wa.me.'
from _novias_reset;

-- ── D. El goteo ─────────────────────────────────────────────────────────────
-- Diez al día, con IA, las mejor puntuadas primero, firma del dueño (quien
-- enciende un goteo aprueba lo que va dejando aprobado cada día, manual 8.3 y
-- 8.4). Uno por ruta: 69 casas van a demo y 4 a diagnóstico; un goteo solo
-- toma cuentas de la ruta de su cadencia. Primer lote: 15-sep-2026 10:00 CDMX.
insert into abm_goteo (id, cadencia_id, nombre, cuentas_dia, filtro, con_ia, estado, creado_por, nota) values
  ('d0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b13', '085bb4af-530d-4714-a9fe-9e5a990ad401', 'Novias · diez al día', 10, '{}'::jsonb, true, 'activo',
   '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
   'Casas de novia (ruta demo). Correo + WhatsApp a quien publicó su wa.me, por instrucción del dueño el 14-sep-2026. Diez casas nuevas cada día hábil, las mejor puntuadas primero. MX corrido el mismo día: 41 correos válidos, 2 inválidos.'),
  ('d0a1f5e2-7b3d-4a9e-8c21-5e6d7f8a9b14', '1bff645d-0ffa-4cc9-aa3a-57542bf3633c', 'Novias · diagnóstico', 10, '{}'::jsonb, true, 'activo',
   '60be8bd8-995a-45ca-926f-1bcb159d3c1e',
   'Las 4 casas de novia con sucursales van por la ruta de diagnóstico. Mismo esquema que el goteo demo.')
on conflict (id) do nothing;

commit;
