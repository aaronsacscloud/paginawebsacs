-- Reporte de ENTREGAS: el segundo documento que recibe el cliente.
--
-- El reporte de trabajo (RT-) cuenta el periodo completo: entregas, soporte,
-- uso, oportunidades. El de entregas (RE-) contesta una sola pregunta —«¿qué
-- me han hecho?»— y por eso trae lo que el otro no puede traer: el VIDEO de
-- cada mejora, para que el cliente vea funcionando lo que pidió.
--
-- Van en la misma tabla porque comparten todo lo que importa: la foto de los
-- hechos congelada al generarlos, la liga pública, el conteo de aperturas y el
-- envío por correo. Lo único que cambia es qué se guarda adentro y cómo se
-- pinta. Dos tablas habrían significado dos veces esa maquinaria.

alter table reportes_trabajo
  add column if not exists tipo text not null default 'trabajo';

comment on column reportes_trabajo.tipo is 'trabajo (RT-) | entregas (RE-)';

-- El folio, ahora por prefijo. Antes contaba todos los reportes juntos: con el
-- de entregas en la misma tabla, el primer RE- habría salido con el número que
-- le tocaba al siguiente RT-, y los folios de cada serie dejarían de ser
-- correlativos justo cuando el cliente los cita por teléfono.
create or replace function siguiente_folio_reporte() returns trigger as $$
declare
  n integer;
  pre text;
begin
  if new.folio is null then
    pre := case when new.tipo = 'entregas' then 'RE-' else 'RT-' end;
    -- `from 9` es la posición del consecutivo en «RT-2026-0001»: tres del
    -- prefijo, cuatro del año y el guion. Los dos prefijos miden lo mismo.
    select coalesce(max(substring(folio from 9)::int), 0) + 1 into n
      from reportes_trabajo
     where folio like pre || to_char(now(), 'YYYY') || '-%';
    new.folio := pre || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists tr_folio_reporte on reportes_trabajo;
create trigger tr_folio_reporte before insert on reportes_trabajo
  for each row execute function siguiente_folio_reporte();
