-- Reporte de trabajo del periodo: el documento que el cliente abre por liga.
--
-- Se guarda una FOTO de los hechos (`hechos` jsonb) al generarlo, no una
-- consulta viva. Es a propósito: el cliente puede abrir su liga en diciembre y
-- tiene que ver lo que se le reportó en septiembre. Un documento que cambia
-- solo no se puede defender en una junta.
--
-- El folio es legible y correlativo por año (RT-2026-0001): es lo que se cita
-- por WhatsApp y por teléfono.

create table if not exists reportes_trabajo (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  folio         text unique,
  desde         date not null,
  hasta         date not null,
  hechos        jsonb not null default '{}'::jsonb,
  narrativa     jsonb,
  estado        text not null default 'borrador',   -- borrador | enviado
  creado_por    text,
  enviado_at    timestamptz,
  enviado_a     text,
  vistas        integer not null default 0,
  primera_vista_at timestamptz,
  ultima_vista_at  timestamptz,
  reaccion      text,                                -- si | mas | dudas
  reaccion_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ix_reportes_trabajo_company on reportes_trabajo(company_id, created_at desc);

-- Cada apertura, para poder decir "lo abrió 3 veces y estuvo 4 minutos".
-- Misma forma que `quote_vistas`, que ya resolvió este problema.
create table if not exists reporte_vistas (
  id          uuid primary key default gen_random_uuid(),
  reporte_id  uuid not null references reportes_trabajo(id) on delete cascade,
  contact_id  uuid,
  visitor_id  text,
  segundos    integer,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists ix_reporte_vistas_rep on reporte_vistas(reporte_id, created_at desc);

-- El folio correlativo por año. Se calcula en el insert para que no haya dos
-- iguales aunque se generen dos reportes en el mismo segundo.
create or replace function siguiente_folio_reporte() returns trigger as $$
declare n integer;
begin
  if new.folio is null then
    select coalesce(max(substring(folio from 9)::int), 0) + 1 into n
      from reportes_trabajo
     where folio like 'RT-' || to_char(now(), 'YYYY') || '-%';
    new.folio := 'RT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists tr_folio_reporte on reportes_trabajo;
create trigger tr_folio_reporte before insert on reportes_trabajo
  for each row execute function siguiente_folio_reporte();
