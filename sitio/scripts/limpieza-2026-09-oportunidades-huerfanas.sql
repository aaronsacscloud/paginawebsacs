-- ═══ Oportunidades huérfanas: pipeline que no existe ══════════════════════
--
-- Reporte del dueño (3-sep-2026): «aquí está duplicada muchas veces karina,
-- elimina, creo que ni es real». Tenía razón, y el problema es más grande que
-- Karina.
--
-- LO MEDIDO. 11 oportunidades ABIERTAS cuelgan de una cotización que ya no
-- existe o está archivada — $122,680 de pipeline sin ningún documento detrás:
--
--   karina                          6 · $77,100  · las seis el 28-ago, 19:34 a 20:32
--   Andrea                          1 · $10,440
--   Andrea Gutierrez Araujo         1 · $10,440
--   Mirelle Ibarra García           1 · $11,700
--   Mildred Itzchel Partida Chavez  1 · $ 9,100
--   Juan Orozco                     1 · $ 3,900
--
-- LA CAUSA. Al borrar una cotización, `quotes DELETE` desvinculaba el deal
-- SOLO si `quotes.deal_id` estaba puesto —y ese enlace es de ida y vuelta pero
-- casi siempre solo se escribe de un lado—, y en ningún caso cerraba la
-- oportunidad. Resultado: la cotización se va, la oportunidad se queda, con su
-- monto contando en el forecast y su `quote_id` apuntando a una fila que ya no
-- está. Arreglado en el mismo commit; esto limpia lo que ya quedó.
--
-- ESTE SCRIPT SOLO TOCA LAS 6 DE KARINA. Son inequívocas: mismo contacto, seis
-- cotizaciones en menos de una hora con montos escalando (10,800 → 13,000 →
-- 14,900 → 16,800), todas borradas, cero aperturas del cliente. Es alguien
-- probando el cotizador.
-- Las otras 5 son de contactos distintos, en fechas distintas, y son la ÚNICA
-- oportunidad viva de cada uno: archivarlas los saca del embudo por completo.
-- Eso lo decide el dueño, no este script.
--
-- NO se borra el contacto: karina llegó por tiktok-lead-form el 23-ago con
-- correo y WhatsApp propios. Lo falso son las oportunidades, no la persona.
--
-- Se ARCHIVA (archived_at), no se borra: si alguna resulta buena, se revive
-- con un update. Ver el bloque del final para deshacer.

begin;

create table if not exists respaldo_huerfanas_20260903 (
  deal_id uuid primary key, contact_id uuid, nombre text, stage text,
  valor_total numeric, quote_id uuid, archived_at_ant timestamptz,
  hecho_at timestamptz not null default now());

create temp table _obj as
select d.id
from deals d
left join quotes q on q.id = d.quote_id
left join contacts c on c.id = d.contact_id
where d.quote_id is not null
  and d.archived_at is null
  and d.stage not in ('cerrada_ganada','cerrada_perdida')
  and (q.id is null or q.estado = 'deleted')
  and c.id = '8ce44a23-aec9-4000-a7e8-c4f8c32ab241';   -- karina, por id: el nombre se repite

insert into respaldo_huerfanas_20260903 (deal_id, contact_id, nombre, stage, valor_total, quote_id, archived_at_ant)
select d.id, d.contact_id, d.nombre, d.stage, d.valor_total, d.quote_id, d.archived_at
from deals d join _obj o on o.id = d.id
on conflict (deal_id) do nothing;

update deals
   set archived_at = now(),
       motivo_perdida = coalesce(motivo_perdida, 'cotización borrada: oportunidad sin documento')
 where id in (select id from _obj);

select (select count(*) from _obj) archivadas,
       (select sum(valor_total) from respaldo_huerfanas_20260903) valor_archivado,
       (select count(*) from deals d left join quotes q on q.id=d.quote_id
          where d.quote_id is not null and d.archived_at is null
            and d.stage not in ('cerrada_ganada','cerrada_perdida')
            and (q.id is null or q.estado='deleted')) huerfanas_que_quedan;

commit;

-- ── PARA DESHACER ──────────────────────────────────────────────────────────
-- update deals d set archived_at = r.archived_at_ant
--   from respaldo_huerfanas_20260903 r where r.deal_id = d.id;
