-- 16-sep-2026 · Lo que el cargador por país le colgó a cuentas de otro país.
--
-- Cierre fino de G1: además de los teléfonos con lada ajena (ya invalidados),
-- quedaban canales cuya FUENTE dice de qué carga vienen —`abm_fuentes.agente`
-- = «carga novias es 2026-09»— sobre cuentas que no son de ese país. Son tres,
-- todos de la fusión Pronovias España → «Pronovias Monterrey» (México), e
-- incluye `sevilla.cuna@pronovias.es`: el buzón de una tienda de Sevilla en la
-- ficha de Monterrey. Se invalidan por su origen, que es el dato duro; una
-- regla por dominio (.es en cuenta mexicana) se habría llevado por delante a
-- los muchos negocios mexicanos que usan hotmail.es.
begin;

update abm_canales c set estado = 'invalido'
  from abm_cuentas a,
       (select distinct f.cuenta_id, lower(f.valor) valor, substring(f.agente from 'carga novias ([a-z]{2})') iso
          from abm_fuentes f where f.agente like 'carga novias %') f,
       (values ('mx','México'),('es','España'),('ar','Argentina'),('co','Colombia'),('cl','Chile'),
               ('pe','Perú'),('ec','Ecuador'),('cr','Costa Rica'),('pa','Panamá'),('uy','Uruguay'),
               ('gt','Guatemala'),('do','República Dominicana')) as m(iso, pais)
 where a.id = c.cuenta_id and f.cuenta_id = c.cuenta_id and lower(c.valor) = f.valor
   and m.iso = f.iso and a.pais <> m.pais and c.estado <> 'invalido';

commit;

select count(*) vivos_en_pronovias from abm_canales c join abm_cuentas a on a.id = c.cuenta_id
 where a.nombre like 'Pronovias Monterrey%' and c.estado <> 'invalido';
