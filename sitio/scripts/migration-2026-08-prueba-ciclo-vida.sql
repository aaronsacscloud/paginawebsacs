-- El ciclo de vida de una prueba gratis, en un solo lugar.
--
-- EL PROBLEMA QUE ARREGLA
-- Había DOS lugares para lo mismo y no se hablaban:
--
--   · `contacts.prueba_inicio` (columna) — la que sella el trigger al mover a
--     alguien a la etapa, y la que la cadencia de onboarding usa como ancla.
--   · `contacts.propiedades.prueba_inicio` / `prueba_fin` (jsonb) — lo que
--     escribía el panel «Prueba gratis» de la ficha, con 3 días por defecto.
--
-- Resultado: quien registraba la prueba desde la ficha llenaba el jsonb, la
-- cadencia miraba la columna, y el lead NO entraba a la secuencia. Sin error y
-- sin aviso. Con 14 correos cargados, cero personas los recibían.
--
-- Aquí queda una sola verdad —las columnas— y el jsonb se migra y se abandona.
--
-- LO QUE SE AGREGA
--   prueba_fin        cuándo termina. Calculado al sellar, no recalculado en
--                     cada pantalla (así es como salen dos fechas distintas
--                     para la misma prueba).
--   prueba_dias       los días otorgados. Se guarda porque una prueba extendida
--                     ya no dura lo que decía el plan.
--   prueba_estado     activa | terminada | convertida | cancelada.
--                     NULL = nunca tuvo prueba, que no es lo mismo que
--                     «terminada»: una es ausencia y la otra es un hecho.
--   prueba_cuenta     el slug de la cuenta en SACS. Es la liga con el producto:
--                     sin él no se puede bloquear ni consultar su uso.
--   prueba_bloqueada_at  cuándo SACS le puso el aviso de fin de prueba. Se
--                     separa de `prueba_estado` porque el bloqueo puede fallar
--                     (cuenta borrada, API caída) y hay que poder reintentarlo
--                     sin volver a marcar la prueba como terminada.
begin;

alter table contacts add column if not exists prueba_fin           timestamptz;
alter table contacts add column if not exists prueba_dias          int;
alter table contacts add column if not exists prueba_estado        text;
alter table contacts add column if not exists prueba_cuenta        text;
alter table contacts add column if not exists prueba_bloqueada_at  timestamptz;

alter table contacts drop constraint if exists contacts_prueba_estado_chk;
alter table contacts add constraint contacts_prueba_estado_chk
  check (prueba_estado is null or prueba_estado in ('activa','terminada','convertida','cancelada'));

-- El cron de vencimientos barre por aquí todas las madrugadas.
create index if not exists idx_contacts_prueba_activa
  on contacts (prueba_fin) where prueba_estado = 'activa';

-- Para resolver «¿de quién es esta cuenta?» al vuelo desde el inbox.
create index if not exists idx_contacts_prueba_cuenta
  on contacts (prueba_cuenta) where prueba_cuenta is not null;

-- ── Migrar lo que vivía en el jsonb ──────────────────────────────────────────
-- Las fechas del panel eran texto 'YYYY-MM-DD'. Se anclan a mediodía para que
-- el cambio de huso no mueva el día: a medianoche UTC, una prueba que termina
-- el 5 se ve terminando el 4 en México.
update contacts set
  prueba_inicio = coalesce(prueba_inicio, (propiedades->>'prueba_inicio')::date + time '12:00'),
  prueba_fin    = coalesce(prueba_fin,    (propiedades->>'prueba_fin')::date   + time '12:00'),
  prueba_estado = coalesce(prueba_estado, 'activa')
where propiedades->>'prueba_inicio' is not null;

update contacts
  set propiedades = propiedades - 'prueba_inicio' - 'prueba_fin'
where propiedades ?| array['prueba_inicio','prueba_fin'];

-- ── El trigger, ahora completo ───────────────────────────────────────────────
-- Antes solo sellaba el inicio. Sin fecha de fin no hay vencimiento, y sin
-- vencimiento la prueba se muere sola sin que nadie llame — que es exactamente
-- lo que este módulo existe para evitar.
--
-- Sigue sellando SOLO la primera vez: si alguien sale y vuelve a la etapa, su
-- prueba no empieza de nuevo porque se movió un chip en el CRM.
create or replace function public.sellar_prueba_inicio()
returns trigger language plpgsql as $$
declare dias int;
begin
  if new.lifecycle_stage = 'prueba_gratis'
     and (old.lifecycle_stage is distinct from new.lifecycle_stage)
     and new.prueba_inicio is null then
    dias := coalesce(new.prueba_dias, 14);
    new.prueba_inicio := now();
    new.prueba_dias   := dias;
    -- Solo si nadie la puso ya: crear la cuenta desde el CRM sella la fecha
    -- exacta que SACS grabó en la cuenta, y esa manda sobre este cálculo.
    if new.prueba_fin is null then
      new.prueba_fin := now() + (dias || ' days')::interval;
    end if;
    new.prueba_estado := coalesce(new.prueba_estado, 'activa');
  end if;
  return new;
end $$;

commit;
