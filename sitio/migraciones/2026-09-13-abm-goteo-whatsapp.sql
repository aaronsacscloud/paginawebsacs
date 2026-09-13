-- 13-sep-2026 · WhatsApp dentro del goteo (envíos progresivos)
--
-- El dueño pidió que el goteo de Villa Hidalgo también mande los WhatsApp.
-- Hasta hoy el WhatsApp del ABM era manual (abrir wa.me con el texto cargado)
-- por dos razones: Meta exige plantilla aprobada para iniciar conversación,
-- y el número es el de la tienda. La primera se resuelve registrando las tres
-- plantillas en Meta; la segunda la decide el dueño, y el goteo la acota:
-- diez negocios al día, solo a quien publicó su wa.me (candado en la base),
-- por la línea que el CRM elija para «prospección» y con el disyuntor de
-- calidad de la línea mandando por encima.
--
-- 1. La plantilla del ABM sabe cómo se llama en Meta.
alter table abm_plantillas add column if not exists meta_nombre text;
alter table abm_plantillas add column if not exists meta_idioma text not null default 'es_MX';

update abm_plantillas set meta_nombre = 'abm_mayoristas_' || nombre
 where giro = 'mayoristas' and canal = 'whatsapp' and meta_nombre is null;

-- 2. Los tres pasos de WhatsApp de la cadencia de mayoristas (ambas rutas).
--    Los días no chocan con los correos (1,4,6,10,14,19,25,33): el que abre
--    va al día siguiente del primer correo, el que sigue a media cadencia y
--    el que cierra después del último correo.
insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select c.id, d.dia, d.orden, 'whatsapp', p.id, true, d.nota
  from abm_cadencias c
  join (values (2, 1, 'abre', 'Abre por WhatsApp un día después del primer correo'),
               (16, 2, 'sigue', 'Insiste una vez a media cadencia'),
               (36, 3, 'cierra', 'Cierra después del último correo')) as d(dia, orden, nombre, nota) on true
  join abm_plantillas p on p.giro = 'mayoristas' and p.canal = 'whatsapp' and p.nombre = d.nombre
 where c.giro = 'mayoristas'
   and not exists (select 1 from abm_pasos x where x.cadencia_id = c.id and x.canal = 'whatsapp' and x.orden = d.orden);

-- 3. Cuántos WhatsApp al día, aparte del cupo de correo.
insert into abm_config (clave, valor, nota)
values ('wa_tope_dia', '10', 'WhatsApp de prospección por día, todos los goteos juntos. La calidad de la línea manda por encima.')
on conflict (clave) do nothing;
