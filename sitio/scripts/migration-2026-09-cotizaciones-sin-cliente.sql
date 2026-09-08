-- Liga a su cliente las cotizaciones pagadas que quedaron sin empresa.
--
-- Regla del dueño: toda cotización tiene que estar ligada a un cliente. Sin la
-- liga, el pago que la liquida también nace huérfano y el dinero desaparece de
-- la ficha, del ingreso del año y de la expansión.
--
-- Solo se ligan las que casan por NOMBRE EXACTO contra companies.nombre o
-- companies.nombre_comercial. NO se cruza por correo: 10 cotizaciones tienen el
-- literal 'Sin correo' en ese campo, así que el cruce por email las mandaba
-- todas a la misma empresa (Fancy Dress) — habría movido $67,000 de dinero
-- ajeno a una ficha equivocada.
--
-- El pago hereda la empresa en el mismo movimiento: si no, la cotización queda
-- ligada pero el dinero sigue sin aparecer.

update quotes q
   set company_id = c.id
  from companies c
 where q.company_id is null
   and q.estado = 'paid'
   and (lower(c.nombre) = lower(trim(q.empresa))
        or lower(coalesce(c.nombre_comercial, '@@sin@@')) = lower(trim(q.empresa)));

update payments p
   set company_id = q.company_id,
       contact_id = coalesce(p.contact_id, q.contact_id)
  from quotes q
 where q.id = p.quote_id
   and p.company_id is null
   and q.company_id is not null;
