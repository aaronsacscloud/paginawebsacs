-- Folio propio para el reporte de RECOMENDACIONES de una cuenta (22-sep-2026):
-- «RR-2026-0001». Antes cualquier tipo desconocido caía en RT-, y el de
-- recomendaciones se habría confundido con el ejecutivo.
create or replace function public.siguiente_folio_reporte()
 returns trigger
 language plpgsql
as $function$
declare
  n integer;
  pre text;
begin
  if new.folio is null then
    pre := case new.tipo
             when 'entregas'        then 'RE-'
             when 'lead'            then 'RL-'
             when 'recomendaciones' then 'RR-'
             else 'RT-'
           end;
    -- `from 9` es la posición del consecutivo en «RT-2026-0001»: tres del
    -- prefijo, cuatro del año y el guion. Los cuatro prefijos miden lo mismo.
    select coalesce(max(substring(folio from 9)::int), 0) + 1 into n
      from reportes_trabajo
     where folio like pre || to_char(now(), 'YYYY') || '-%';
    new.folio := pre || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $function$;
