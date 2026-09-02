-- ═══ Que la actividad se entienda sin ser del equipo que la escribió ══════
--
-- Dos disparadores escribían en jerga y con los valores crudos de la base.
-- Quien lee esto es un consultor abriendo la ficha de un cliente, no alguien
-- que sepa que `cerrada_ganada` es una etapa.
--
--   antes: «Deal: calificacion → cerrada_ganada»
--   ahora: «Oportunidad: Calificación → Ganada»
--
--   antes: «Estatus del lead: agendado → cotizado (recálculo por hechos)»
--   ahora: «El lead pasó de Agendado a Cotizado — lo movió el sistema al
--           revisar lo que ya pasó (reuniones, cotizaciones, respuestas)»
--
-- Medido en 30 días: 255 del primero y 462 del segundo. Los históricos se
-- dejan como están: son el registro de lo que se anotó en su momento.
--
-- «Deal» además ya no es el nombre del módulo: se llama Oportunidades.

create or replace function public.etiqueta_etapa_deal(s text) returns text
language sql immutable as $$
  select coalesce(nullif(case s
    when 'calificacion'       then 'Calificación'
    when 'demo_agendada'      then 'Demo agendada'
    when 'demo_realizada'     then 'Demo realizada'
    when 'cotizacion_enviada' then 'Cotización enviada'
    when 'negociacion'        then 'Negociación'
    when 'cerrada_ganada'     then 'Ganada'
    when 'cerrada_perdida'    then 'Perdida'
    else '' end, ''),
    -- Una etapa que no conocemos se enseña legible en vez de en crudo, y NO
    -- se inventa: se limpia el guion bajo y ya.
    initcap(replace(coalesce(s, 'sin etapa'), '_', ' ')));
$$;

create or replace function public.log_deal_stage_change()
returns trigger language plpgsql as $function$
  BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      NEW.stage_changed_at = now();
      NEW.probabilidad = CASE NEW.stage
        WHEN 'calificacion' THEN 20
        WHEN 'demo_agendada' THEN 40
        WHEN 'demo_realizada' THEN 60
        WHEN 'cotizacion_enviada' THEN 70
        WHEN 'negociacion' THEN 80
        WHEN 'cerrada_ganada' THEN 100
        WHEN 'cerrada_perdida' THEN 0
        ELSE NEW.probabilidad
      END;
      INSERT INTO activities (contact_id, company_id, deal_id, tipo, titulo, metadata, automatico)
      VALUES (
        NEW.contact_id, NEW.company_id, NEW.id, 'stage_change',
        'Oportunidad: ' || public.etiqueta_etapa_deal(OLD.stage) || ' → ' || public.etiqueta_etapa_deal(NEW.stage),
        jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage, 'object_type', 'deal'),
        true
      );
      IF NEW.stage IN ('cerrada_ganada', 'cerrada_perdida') THEN
        NEW.closed_at = now();
        NEW.days_in_pipeline = EXTRACT(DAY FROM (now() - NEW.created_at))::int;
      END IF;
    END IF;
    RETURN NEW;
  END;
$function$;
