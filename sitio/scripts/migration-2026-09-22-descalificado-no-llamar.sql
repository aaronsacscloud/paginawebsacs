-- ══ MEJORA CRM #1 · A QUIEN YA SE DESCALIFICÓ NO SE LE VUELVE A LLAMAR (22-sep-2026) ══
--
-- Pedido del dueño: «si un lead ha sido descalificado previamente en cualquier
-- momento, no debe volver a ser incluido automáticamente en ninguna lista, cola
-- o proceso de llamadas, independientemente de cuál sea su estatus actual».
--
-- El filtro que había miraba la etapa de HOY (`lifecycle_stage`). Y la etapa
-- se mueve sola: la reactivación la regresa a `lead`, un cambio de responsable
-- o de etapa desde la ficha también. En cuanto dejaba de decir «descalificado»,
-- el lead volvía a la lista de llamadas.
--
-- La regla ahora vive en un SELLO que no se borra: `contacts.descalificado_at`.
-- Lo pone la base (trigger), no el código — así da igual por qué camino se
-- descalifique (ficha, IA de la llamada, veredicto de la Torre, API) — y nada
-- lo quita. Lo único que lo levanta es una persona, a propósito, desde la ficha.

-- 1 · El sello ─────────────────────────────────────────────────────────────
alter table contacts add column if not exists descalificado_at timestamptz;
alter table contacts add column if not exists descalificado_levantado_at timestamptz;
alter table contacts add column if not exists descalificado_levantado_por uuid;
alter table abm_cuentas add column if not exists descalificada_at timestamptz;

create or replace function sellar_descalificado() returns trigger language plpgsql as $$
begin
  if new.lifecycle_stage = 'descalificado' and new.descalificado_at is null then
    new.descalificado_at := now();
    new.descalificado_levantado_at := null;
    new.descalificado_levantado_por := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_sellar_descalificado on contacts;
create trigger trg_sellar_descalificado before insert or update of lifecycle_stage on contacts
  for each row execute function sellar_descalificado();

-- En el ABM, `perdida` es su «descalificado» (la cola de teléfono la pone con «no le interesa»).
create or replace function sellar_abm_descalificada() returns trigger language plpgsql as $$
begin
  if new.etapa = 'perdida' and new.descalificada_at is null then new.descalificada_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_sellar_abm_descalificada on abm_cuentas;
create trigger trg_sellar_abm_descalificada before insert or update of etapa on abm_cuentas
  for each row execute function sellar_abm_descalificada();

-- 2 · El historial que ya existía ──────────────────────────────────────────
-- La fecha de la PRIMERA vez que se descalificó (la bitácora `stage_change`);
-- si no hay rastro y hoy está descalificado, ahora.
update contacts c set descalificado_at = h.primera
from (
  select contact_id, min(created_at) primera from activities
  where contact_id is not null and tipo in ('stage_change', 'etapa', 'etapa_cambio')
    and (metadata->>'new_stage' = 'descalificado' or titulo ilike '%→ descalificado%' or titulo ilike '%a «descalificado»%')
  group by contact_id
) h
where h.contact_id = c.id and c.descalificado_at is null;
update contacts set descalificado_at = coalesce(updated_at, now())
where lifecycle_stage = 'descalificado' and descalificado_at is null;
update abm_cuentas set descalificada_at = coalesce(updated_at, now()) where etapa = 'perdida' and descalificada_at is null;

-- 3 · Los teléfonos vetados, en un solo lugar ──────────────────────────────
-- El número es lo único que comparten el CRM y el ABM (una cuenta del ABM no
-- tiene contact_id). Se comparan los últimos 10 dígitos: el CRM guarda
-- `+5255…` y el ABM `5255…` o `55 …`.
create or replace view v_tel_vetados as
select c.id as contact_id,
       right(regexp_replace(t.tel, '\D', '', 'g'), 10) as tel10,
       case when c.descalificado_at is not null and c.descalificado_levantado_at is null then 'descalificado' else 'no_llamar' end as motivo,
       c.descalificado_at
from contacts c
cross join lateral (values (c.whatsapp), (c.telefono)) t(tel)
where ((c.descalificado_at is not null and c.descalificado_levantado_at is null) or c.no_llamar is true)
  and t.tel is not null and length(regexp_replace(t.tel, '\D', '', 'g')) >= 10;

-- 4 · La prospección tampoco los ofrece ────────────────────────────────────
create or replace view v_abm_llamables as
 SELECT c.id, c.nombre, c.giro, c.subgiro, c.ciudad, c.estado_geo, c.pais, c.sucursales,
    c.google_rating, c.google_resenas, c.puntaje, c.etapa, c.ya_es_cliente, c.ultimo_toque_at,
    c.responsable_id, c.sitio, c.instagram, c.ruta, c.tamano, c.abierto,
    tel.valor AS telefono, wa.valor AS whatsapp,
    (wa.valor IS NOT NULL) AS tiene_wa,
    (wa.verificado_at IS NOT NULL) AS wa_verificado,
    COALESCE(tel.valor, wa.valor) AS marcar,
    (c.ya_es_cliente IS NOT NULL) AS es_cliente
   FROM abm_cuentas c
     LEFT JOIN LATERAL ( SELECT k.valor FROM abm_canales k
          WHERE k.cuenta_id = c.id AND k.tipo = 'telefono' AND COALESCE(k.estado, '') <> 'invalido' AND k.valor IS NOT NULL
          ORDER BY k.created_at LIMIT 1) tel ON true
     LEFT JOIN LATERAL ( SELECT k.valor, k.verificado_at FROM abm_canales k
          WHERE k.cuenta_id = c.id AND k.tipo = 'whatsapp_tienda' AND COALESCE(k.estado, '') <> ALL (ARRAY['invalido', 'no_declarado']) AND k.valor IS NOT NULL
          ORDER BY (k.verificado_at IS NOT NULL) DESC, k.created_at LIMIT 1) wa ON true
  WHERE COALESCE(tel.valor, wa.valor) IS NOT NULL
    AND COALESCE(c.etapa, '') <> 'no_contactar'
    AND c.descalificada_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM abm_no_contactar n WHERE n.valor IS NOT NULL AND n.valor = ANY (ARRAY[tel.valor, wa.valor]))
    AND NOT EXISTS (SELECT 1 FROM v_tel_vetados v WHERE v.tel10 IN (
          right(regexp_replace(COALESCE(tel.valor, ''), '\D', '', 'g'), 10),
          right(regexp_replace(COALESCE(wa.valor, ''), '\D', '', 'g'), 10)));

-- 5 · Ninguna automatización crea una llamada para él ──────────────────────
-- Las tareas de llamada nacen en ocho lugares (cadencia, revisión diaria,
-- compromisos, contratación, seguimientos que renacen…). En vez de parchar
-- ocho y rezar por el noveno, la base las recibe y las deja RETIRADAS con su
-- causa: el insert no falla (nadie se rompe) y la tarea nunca llega a la cola.
-- Sólo pasa la que crea una persona a mano (`origen = 'manual'`).
create or replace function vetar_llamada_descalificado() returns trigger language plpgsql as $$
declare d timestamptz;
begin
  if new.tipo = 'llamada' and coalesce(new.estado, 'pendiente') = 'pendiente'
     and new.contact_id is not null and coalesce(new.origen, '') <> 'manual' then
    select descalificado_at into d from contacts
      where id = new.contact_id and descalificado_levantado_at is null;
    if d is not null then
      new.estado := 'retirada';
      new.retirada_causa := 'descalificado_previo';
      new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('retirada_motivo',
        'Se descalificó el ' || to_char(d at time zone 'America/Mexico_City', 'DD/MM/YYYY') || ': no se le vuelve a llamar en automático.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_vetar_llamada_descalificado on ti_tareas;
create trigger trg_vetar_llamada_descalificado before insert on ti_tareas
  for each row execute function vetar_llamada_descalificado();

-- Al descalificar: lo que ya estaba en la cola de llamadas automáticas se retira.
create or replace function retirar_llamadas_al_descalificar() returns trigger language plpgsql as $$
begin
  if new.lifecycle_stage = 'descalificado' and old.lifecycle_stage is distinct from 'descalificado' then
    update ti_tareas set estado = 'retirada', retirada_causa = 'descalificado_previo', updated_at = now()
      where contact_id = new.id and tipo = 'llamada' and estado = 'pendiente' and coalesce(origen, '') <> 'manual';
  end if;
  return new;
end $$;
drop trigger if exists trg_retirar_llamadas_al_descalificar on contacts;
create trigger trg_retirar_llamadas_al_descalificar after update of lifecycle_stage on contacts
  for each row execute function retirar_llamadas_al_descalificar();

-- Y lo que ya estaba pendiente hoy, de los descalificados de antes.
update ti_tareas t set estado = 'retirada', retirada_causa = 'descalificado_previo', updated_at = now()
from contacts c
where c.id = t.contact_id and c.descalificado_at is not null and c.descalificado_levantado_at is null
  and t.tipo = 'llamada' and t.estado = 'pendiente' and coalesce(t.origen, '') <> 'manual';

notify pgrst, 'reload schema';
