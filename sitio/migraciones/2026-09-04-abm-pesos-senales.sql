-- El peso de cada señal deja de ser decorativo: el código lo lee de la fila.
update abm_senales set peso = case tipo
  when 'expansion' then 10 when 'vacante' then 10 when 'resena_mala' then 8
  when 'sitio_caido' then 8 when 'clic' then 6 when 'apertura_correo' then 4
  when 'post' then 2 else 2 end
 where peso is null or peso <= 1 or peso is distinct from (case tipo
  when 'expansion' then 10 when 'vacante' then 10 when 'resena_mala' then 8
  when 'sitio_caido' then 8 when 'clic' then 6 when 'apertura_correo' then 4
  when 'post' then 2 else 2 end);

-- Y el dolor se recalcula con la misma regla que el código: el sitio caído se
-- cobra UNA vez (por el dato del escaneo, no otra vez por la señal).
with s as (
  select cuenta_id, sum(peso) peso from abm_senales
   where coalesce(vigente,true)
     and (caduca_at is null or caduca_at >= current_date)
     and (fecha is null or fecha > current_date - 180)
     and tipo <> 'sitio_caido'
   group by cuenta_id)
update abm_cuentas c set dolor = least(50,
      (case when c.plataforma_web ~* 'shopify|woo|vtex|wix|tiendanube|magento|prestashop|squarespace'
             and coalesce(c.sucursales,2) >= 2 then 16 else 0 end)
    + (case when c.sitio_http = 0 or c.sitio_http >= 400 then 12 else 0 end)
    + (case when c.sitio_carrito is false then 8 else 0 end)
    + (case when c.google_rating < 4.5 and coalesce(c.sucursales,0) >= 3 then 10 else 0 end)
    + coalesce((select peso from s where s.cuenta_id=c.id),0));
update abm_cuentas set puntaje = encaje + dolor;
