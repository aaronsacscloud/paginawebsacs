-- ── 1. Duplicados entre lotes ────────────────────────────────────────────
-- El mismo negocio entró dos veces desde barridos distintos ("Vertiche" de
-- Tuxtla y de Zacatecas es la MISMA cadena). Se queda la fila con más datos y
-- la otra dona sus canales.
with pares as (
  select lower(regexp_replace(nombre,'[^a-zA-Z0-9]','','g')) k,
         (array_agg(id order by canales_n desc, coalesce(sucursales,0) desc, created_at))[1] queda,
         array_agg(id) todos
    from abm_cuentas group by 1 having count(*) > 1),
mover as (
  update abm_canales x set cuenta_id = p.queda
    from pares p where x.cuenta_id = any(p.todos) and x.cuenta_id <> p.queda
  returning 1)
delete from abm_cuentas c using pares p
 where c.id = any(p.todos) and c.id <> p.queda;

-- ── 2. Conteos imposibles ────────────────────────────────────────────────
-- Un fabricante de calzado con 113 tiendas es un número mal leído del stand o
-- del producto, no un dato. Mejor sin número que con uno inventado.
update abm_cuentas set sucursales = null, sucursales_confianza = 'baja'
 where giro in ('fabricantes','distribuidores') and sucursales > 40;

-- ── 3. Un correo que sirve a dos cuentas ─────────────────────────────────
-- Suelen ser el mismo grupo con dos marcas. No se borra —la cuenta existe—
-- pero se marca, para que el cartero no le escriba dos veces al mismo buzón.
update abm_canales x set confianza = 'media'
 where tipo like 'email%' and lower(valor) in (
   select lower(valor) from abm_canales where tipo like 'email%'
   group by lower(valor) having count(distinct cuenta_id) > 1);

-- ── 4. La ciudad, normalizada ────────────────────────────────────────────
-- "CDMX", "Ciudad de Mexico" y "Ciudad de México" partían los filtros en tres.
update abm_cuentas set ciudad = 'Ciudad de México'
 where ciudad in ('CDMX','Ciudad de Mexico','Cdmx','cdmx','Ciudad de México / Edo. de México');
update abm_cuentas set ciudad = 'Guadalajara' where ciudad in ('Guadalajara, Jalisco','GDL');
update abm_cuentas set ciudad = 'Monterrey' where ciudad in ('Monterrey, Nuevo León','MTY');
update abm_cuentas set ciudad = 'León' where ciudad in ('León, Guanajuato','Leon');
update abm_cuentas set ciudad = null where ciudad in ('México','Mexico','MX','');
update abm_cuentas set ya_es_cliente=null where ya_es_cliente is not null;
update abm_cuentas set etapa='sin_tocar' where etapa='no_contactar' and pausa_motivo is null;
update abm_cuentas set ya_es_cliente='sí', etapa='no_contactar' where id in ('e6b22156-b810-4910-8079-05b76dacc2a0','96378b12-0bcb-4f93-83aa-0001a6c7a610','726d0718-6bc7-461d-b630-f881b7e78938','2b324d95-8681-4b03-aa8d-30672795ed92','3749c5b4-7505-4fc1-a758-11829ac9466a','6704d71f-0302-4531-bfcf-e5343b5e1c01','c81333cd-3f77-48b0-ad83-e994927b1313','96dc8369-a9c6-4cd1-b9c7-fbfdab525033','a4e263fb-25fc-4fe3-b1e5-a0885dc085de','d58b53fb-077e-42f2-97cf-82352463144b','83910747-8ac2-454d-b7f1-d41f3cd8060b');
update abm_cuentas set nota = coalesce(nota,'') || ' · ⚠ ¿Es el cliente "Sugar store"? Verificar antes de escribirle.' where id='03f8d276-8627-4aa1-a560-40cec6d9cbc9';
