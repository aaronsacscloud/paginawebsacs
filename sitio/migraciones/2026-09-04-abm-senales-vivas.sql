-- D. Las señales del estudio estaban mal tipificadas y todas con la MISMA
--    fecha: el 3-mar-2027 caducarían las 682 el mismo día y 578 cuentas
--    perderían de golpe 8 a 16 puntos de dolor. Además 'apertura' era
--    senal_expansion reescrito (557 con ambos, cero discrepancias), así que el
--    mismo hecho se pagaba dos veces.
--
--    Se separan: lo que es CONTEXTO del estudio pesa poco y no caduca; lo que
--    es un hecho fechado (sitio caído) sigue contando como dolor vivo.
alter table abm_senales add column if not exists vigente boolean default true;
alter table abm_senales add column if not exists origen text default 'estudio';

update abm_senales set tipo='contexto', peso=1
 where tipo='apertura' and origen='estudio'
   and detalle !~* '(abri[oó]|inaugur|nueva sucursal|nuevo local|apertura|expansi[oó]n|franquici)';

update abm_senales set tipo='expansion', peso=4
 where tipo='apertura' and origen='estudio';

-- Sin fecha real, una señal del estudio no puede fingir que pasó hoy.
update abm_senales set fecha = null where origen='estudio' and tipo in ('contexto','expansion','post');
with s as (
  select cuenta_id, sum(case tipo
      when 'expansion' then 10 when 'vacante' then 10 when 'resena_mala' then 8
      when 'sitio_caido' then 8 when 'clic' then 6 when 'apertura_correo' then 4 else 2 end) peso
    from abm_senales where fecha is null or fecha > current_date - 180 group by cuenta_id)
update abm_cuentas c set
  dolor = least(50,
      (case when c.plataforma_web ~* 'shopify|woo|vtex|wix|tiendanube|magento|prestashop|squarespace'
             and coalesce(c.sucursales,2) >= 2 then 16 else 0 end)
    + (case when c.sitio_http = 0 or c.sitio_http >= 400 then 12 else 0 end)
    + (case when c.sitio_carrito is false then 8 else 0 end)
    + (case when c.google_rating < 4.5 and coalesce(c.sucursales,0) >= 3 then 10 else 0 end)
    + coalesce((select peso from s where s.cuenta_id=c.id),0)),
  accesibilidad = least(25, (case when c.tiene_email then 12 else 0 end)
    + (case when c.tiene_wa then 8 else 0 end)
    + (case when exists (select 1 from abm_personas p where p.cuenta_id=c.id) then 5 else 0 end));
update abm_cuentas set puntaje = encaje + dolor;
alter table abm_cuentas add column if not exists revisado_at timestamptz;
create index if not exists abm_cuentas_revisado_ix on abm_cuentas (revisado_at nulls first);
