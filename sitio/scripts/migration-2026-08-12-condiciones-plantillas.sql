-- Términos y condiciones como plantillas, no como texto tecleado cada vez.
--
-- Hoy el texto va hardcodeado en el componente y se edita a mano en cada
-- cotización: cada quien acaba mandando una versión distinta, y cambiar una
-- cláusula obliga a tocar código. Va en tabla —no en localStorage, como el
-- folio— porque las condiciones son de la empresa, no del navegador de quien
-- cotiza.
create table if not exists quote_condiciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  texto       text not null,
  es_default  boolean not null default false,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Server-only, igual que el resto: se lee y escribe con la service key.
alter table quote_condiciones enable row level security;

-- Solo una predeterminada a la vez. Con dos, cuál gana depende del orden en que
-- las devuelva Postgres, que no está garantizado.
create unique index if not exists quote_condiciones_una_default
  on quote_condiciones (es_default) where es_default;

insert into quote_condiciones (nombre, texto, es_default)
select 'Estándar',
       'Precios en MXN. Migracion incluida en planes de pago. Soporte por chat SACS y WhatsApp incluido. Sin contratos de permanencia.',
       true
where not exists (select 1 from quote_condiciones);
