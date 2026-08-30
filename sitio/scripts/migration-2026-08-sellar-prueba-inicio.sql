-- Sella prueba_inicio cuando alguien entra a la etapa "prueba gratis".
--
-- Va como TRIGGER y no dentro de una pantalla a propósito: la etapa se puede
-- cambiar desde la ficha del lead, desde la lista, desde el inbox o desde un
-- endpoint. Poner la lógica en una de esas la deja fuera de las otras tres, y
-- un contacto sin fecha NO entra a la cadencia de onboarding — se perdería en
-- silencio, que es justo el modo de falla que se quiere evitar.
--
-- Solo sella la PRIMERA vez. Si alguien sale y vuelve a entrar a la etapa, se
-- respeta la fecha original: su prueba no empieza de nuevo porque alguien movió
-- un chip en el CRM.
begin;

create or replace function public.sellar_prueba_inicio()
returns trigger language plpgsql as $$
begin
  if new.lifecycle_stage = 'prueba_gratis'
     and (old.lifecycle_stage is distinct from new.lifecycle_stage)
     and new.prueba_inicio is null then
    new.prueba_inicio := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_sellar_prueba_inicio on contacts;
create trigger trg_sellar_prueba_inicio
  before update on contacts
  for each row execute function public.sellar_prueba_inicio();

commit;
