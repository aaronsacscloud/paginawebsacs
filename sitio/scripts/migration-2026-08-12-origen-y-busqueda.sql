-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · ORIGEN DEL COTIZANTE, CONGELADO
--
-- Sin esto la comparación cliente/lead nunca cuadra: cuando un lead compra se
-- vuelve cliente, y su cotización pasaría a contarse "de cliente" HACIA ATRÁS.
-- El mes en que se cerraron tres cuentas nuevas se vería como si no hubiera
-- entrado nadie. Se guarda lo que era el día que se cotizó y ya no se mueve.
--
-- Las cotizaciones viejas quedan en NULL a propósito: no se puede saber qué era
-- el cliente hace tres meses, y rellenarlo con lo de hoy sería inventar el
-- histórico. El dashboard las deduce al leer y las trata como estimación.
-- ─────────────────────────────────────────────────────────────────────────────
alter table quotes add column if not exists origen_cotizante text
  check (origen_cotizante in ('cliente','lead','excliente','sin_ligar'));
comment on column quotes.origen_cotizante is
  'Qué era el cotizante EL DÍA que se creó la cotización. No se recalcula nunca.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · BÚSQUEDA SIN ACENTOS
--
-- Hoy "rubén" devuelve vacío y "ruben" sí encuentra, así que se escribe el
-- nombre a mano y la cotización nace desligada. unaccent no es IMMUTABLE, y una
-- columna generada exige que lo sea: por eso el envoltorio f_unaccent, que fija
-- el diccionario y con eso ya puede declararse inmutable.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(txt text)
returns text language sql immutable strict parallel safe as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, txt))
$$;

alter table companies add column if not exists nombre_norm text
  generated always as (public.f_unaccent(nombre)) stored;
alter table contacts  add column if not exists nombre_norm text
  generated always as (public.f_unaccent(coalesce(nombre,'') || ' ' || coalesce(apellido,''))) stored;

create index if not exists companies_nombre_norm_idx on companies (nombre_norm);
create index if not exists contacts_nombre_norm_idx  on contacts  (nombre_norm);
