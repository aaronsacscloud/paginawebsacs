-- Contadores derivados en la cuenta: el tablero no puede contar filas de
-- abm_canales una por una (Supabase corta en 1000 y el conteo salía mentiroso).
alter table abm_cuentas add column if not exists tiene_email boolean default false;
alter table abm_cuentas add column if not exists tiene_wa boolean default false;
alter table abm_cuentas add column if not exists canales_n int default 0;

update abm_cuentas c set
  tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=c.id and x.tipo like 'email%'),
  tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=c.id and x.tipo like 'whatsapp%'),
  canales_n   = (select count(*) from abm_canales x where x.cuenta_id=c.id);

create or replace function abm_recontar_canales() returns trigger language plpgsql as $$
declare cid uuid;
begin
  cid := coalesce(new.cuenta_id, old.cuenta_id);
  update abm_cuentas c set
    tiene_email = exists (select 1 from abm_canales x where x.cuenta_id=cid and x.tipo like 'email%'),
    tiene_wa    = exists (select 1 from abm_canales x where x.cuenta_id=cid and x.tipo like 'whatsapp%'),
    canales_n   = (select count(*) from abm_canales x where x.cuenta_id=cid)
  where c.id = cid;
  return null;
end $$;

drop trigger if exists abm_canales_recontar on abm_canales;
create trigger abm_canales_recontar after insert or update or delete on abm_canales
  for each row execute function abm_recontar_canales();

create index if not exists abm_cuentas_canales_ix on abm_cuentas (tiene_email, tiene_wa, puntaje desc);
