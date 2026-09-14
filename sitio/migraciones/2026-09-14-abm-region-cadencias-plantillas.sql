-- 14-sep-2026 · Segmentación por país del motor ABM (manual §13).
--
-- Por qué: el dueño va a mandar cadencias a diez países de Latinoamérica y
-- luego a Europa, y quiere que México diga México y que cada país reciba
-- su guion. Hasta hoy la cadencia se elegía solo por giro + ruta, o sea
-- que a una tienda de Bogotá le tocaría el correo con «en todo México», la
-- landing con precios en pesos y «XV años». Un guion por REGIÓN (México /
-- Latam / España) y variables por país ({{pais}}, {{xv}}, {{landing}}).
--
-- Se agrega `region` a cadencias y plantillas, con default 'mexico': todo lo
-- que existe hoy es de México y sigue igual. El generador busca primero la
-- cadencia de la región de la cuenta y, si no hay, cae a la de México.
alter table abm_cadencias add column if not exists region text not null default 'mexico'
  check (region in ('mexico', 'latam', 'espana'));
alter table abm_plantillas add column if not exists region text not null default 'mexico'
  check (region in ('mexico', 'latam', 'espana'));
create index if not exists abm_cadencias_region_idx on abm_cadencias (giro, ruta, region) where activa;
create index if not exists abm_plantillas_region_idx on abm_plantillas (giro, ruta, canal, region) where activa;
comment on column abm_cadencias.region is 'mexico | latam | espana: el guion es de la región; el país de la cuenta decide cuál (abm-paises.ts)';
select count(*) filter (where region = 'mexico') as cadencias_mexico from abm_cadencias;
