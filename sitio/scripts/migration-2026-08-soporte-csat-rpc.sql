-- B3: una sola campaña CSAT singleton (índice único parcial).
create unique index if not exists uq_inapp_csat_soporte
  on inapp_campanas ((meta->>'csat_soporte')) where meta->>'csat_soporte' = 'true';

-- B2: encolar cuenta en incluir_cuentas de forma ATÓMICA (dedup). Devuelve true
-- si la agregó (para saber si hay que re-publicar). Un solo UPDATE = sin carrera.
create or replace function csat_encolar_cuenta(p_campana uuid, p_cuenta text)
returns boolean language plpgsql as $$
begin
  update inapp_campanas
     set audiencia = jsonb_set(coalesce(audiencia,'{}'::jsonb), '{incluir_cuentas}',
           coalesce(audiencia->'incluir_cuentas','[]'::jsonb) || to_jsonb(p_cuenta)),
         updated_at = now()
   where id = p_campana
     and not (coalesce(audiencia->'incluir_cuentas','[]'::jsonb) ? p_cuenta);
  return found;
end $$;

-- B6: quitar cuenta cuando respondió el CSAT (para que un ticket nuevo la re-agregue
-- y no quede encuestando por siempre). Devuelve true si la quitó.
create or replace function csat_quitar_cuenta(p_campana uuid, p_cuenta text)
returns boolean language plpgsql as $$
begin
  update inapp_campanas
     set audiencia = jsonb_set(coalesce(audiencia,'{}'::jsonb), '{incluir_cuentas}',
           coalesce((select jsonb_agg(e) from jsonb_array_elements_text(coalesce(audiencia->'incluir_cuentas','[]'::jsonb)) e where e <> p_cuenta), '[]'::jsonb)),
         updated_at = now()
   where id = p_campana
     and (coalesce(audiencia->'incluir_cuentas','[]'::jsonb) ? p_cuenta);
  return found;
end $$;
