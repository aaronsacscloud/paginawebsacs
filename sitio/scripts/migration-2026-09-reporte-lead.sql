-- El reporte que recibe un LEAD después de su sesión.
--
-- Es el tercer documento de la casa —entregas y trabajo en curso ya existen—
-- pero contesta otra pregunta: «¿nos entendieron?». Sale de la minuta de
-- descubrimiento que ya se levanta y vive en la misma tabla, porque es el mismo
-- objeto: una FOTO con folio, liga, vistas y reacción. Partirlo en otra tabla
-- sería duplicar el rastreo, el envío y la página pública.
--
-- Dos cosas que la tabla no contemplaba:
--
--   1. Un lead puede NO tener empresa. `company_id` era NOT NULL porque los
--      dos documentos anteriores son de clientes, que siempre la tienen. Ahora
--      se apunta al contacto y la empresa es opcional; un check obliga a que
--      haya al menos uno de los dos, para que ningún reporte quede huérfano.
--   2. El folio. La función solo distinguía «RE-» de «RT-»; el del lead lleva
--      «RL-» y el consecutivo sigue leyéndose desde la posición 9, que es
--      donde empieza en los tres prefijos porque los tres miden lo mismo.

alter table reportes_trabajo
  add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table reportes_trabajo alter column company_id drop not null;

alter table reportes_trabajo drop constraint if exists reportes_trabajo_dueno_chk;
alter table reportes_trabajo add constraint reportes_trabajo_dueno_chk
  check (company_id is not null or contact_id is not null);

create index if not exists reportes_trabajo_contacto on reportes_trabajo (contact_id) where contact_id is not null;

create or replace function siguiente_folio_reporte() returns trigger
language plpgsql as $$
declare
  n integer;
  pre text;
begin
  if new.folio is null then
    pre := case new.tipo
             when 'entregas' then 'RE-'
             when 'lead'     then 'RL-'
             else 'RT-'
           end;
    -- `from 9` es la posición del consecutivo en «RT-2026-0001»: tres del
    -- prefijo, cuatro del año y el guion. Los tres prefijos miden lo mismo.
    select coalesce(max(substring(folio from 9)::int), 0) + 1 into n
      from reportes_trabajo
     where folio like pre || to_char(now(), 'YYYY') || '-%';
    new.folio := pre || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;
