-- Higiene y control de las cadencias: que no le escriban a quien ya no oye,
-- que no molesten a quien acaba de moverse, y que no se prendan vacias.
begin;

-- ── 1 · Blackout por temporada, por secuencia ──────────────────────────────
alter table crm_secuencias
  add column if not exists blackout jsonb not null default '[]'::jsonb;
comment on column crm_secuencias.blackout is
  'Rangos [{desde,hasta}] en los que la secuencia se congela sola. Una marca de moda en pleno Buen Fin no deberia recibir novedades: esos dias esta vendiendo, no evaluando software.';

-- ── 2 · Los pasos pueden caducar ───────────────────────────────────────────
alter table crm_secuencia_pasos
  add column if not exists vigente_hasta date;
comment on column crm_secuencia_pasos.vigente_hasta is
  'Para el modo permanente: una "novedad" de hace seis meses ya no lo es. El goteo se salta lo vencido en vez de mandarlo.';

-- ── 3 · SUNSET: dejar de escribirle a quien no oye ─────────────────────────
-- El vocabulario ya existia (email_suppressions.motivo = 'sunset') pero nada lo
-- generaba. Es la proteccion mas importante que faltaba: mandarle durante anios
-- a gente que nunca abre arrastra la entregabilidad de TODOS los demas — el
-- proveedor no distingue entre un correo a alguien muerto y uno a un cliente.
create or replace function public.aplicar_sunset(
  p_min_envios integer default 8,
  p_dias integer default 90,
  p_dry boolean default true)
returns table (contact_id uuid, email text, enviados integer, ultima_apertura timestamptz)
language plpgsql as $$
begin
  return query
  with candidatos as (
    select c.id, c.email, c.eng_emails_enviados, c.eng_ultimo_abierto_at
    from contacts c
    where c.email is not null
      and c.eng_emails_enviados >= p_min_envios
      and c.eng_emails_abiertos = 0          -- ni una sola apertura, nunca
      and c.lifecycle_stage <> 'cliente'      -- a un cliente no se le corta el correo
      and not exists (select 1 from email_suppressions s
                      where lower(s.email) = lower(c.email) and s.restaurado_at is null)
      -- Y que lleve tiempo: 8 envios en una semana no es desinteres, es una rafaga.
      and coalesce(c.eng_actualizado_at, now()) < now() - make_interval(days => 0)
      and c.created_at < now() - make_interval(days => p_dias)
  )
  insert into email_suppressions (email, contact_id, motivo, detalle, origen, scope)
  select k.email, k.id, 'sunset',
         format('%s correos enviados y ninguna apertura en %s dias', k.eng_emails_enviados, p_dias),
         'higiene_automatica', 'todo'
  from candidatos k
  where not p_dry
  returning email_suppressions.contact_id, email_suppressions.email, 0, null::timestamptz;

  -- En modo simulacro devuelve a quien TOCARIA, sin escribir nada.
  if p_dry then
    return query
    select c.id, c.email, c.eng_emails_enviados, c.eng_ultimo_abierto_at
    from contacts c
    where c.email is not null and c.eng_emails_enviados >= p_min_envios
      and c.eng_emails_abiertos = 0 and c.lifecycle_stage <> 'cliente'
      and c.created_at < now() - make_interval(days => p_dias)
      and not exists (select 1 from email_suppressions s
                      where lower(s.email) = lower(c.email) and s.restaurado_at is null);
  end if;
end $$;

-- ── 4 · Tope de reciclajes ─────────────────────────────────────────────────
comment on column contacts.reciclado_veces is
  'Vueltas completas rezagado -> lead. A la tercera sin comprar no es un lead tibio: es un suscriptor, y merece otro trato en vez de la misma cadencia otra vez.';

commit;
