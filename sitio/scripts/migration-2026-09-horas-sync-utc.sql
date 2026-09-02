-- ═══ Reparar las horas que el sync de Google reescribió en UTC ═══════════
--
-- QUÉ PASÓ. `/api/scheduling/google/sync` leía la hora del evento con
-- `getHours()`, que devuelve la hora del SERVIDOR — y en Vercel el servidor
-- es UTC. La columna `hora_inicio`, en cambio, es SIEMPRE hora del centro de
-- México (`inicioMs` le pega el -06:00 y los recordatorios la anuncian tal
-- cual). Resultado: a los pocos segundos de agendarse, cada reunión que el
-- sync alcanzaba a ver se reescribía +6 horas y quedaba anotada como si el
-- cliente la hubiera movido («Demo reagendada (Google Calendar sync)»).
--
-- MEDIDO: 14 saltos desde el 9 de mayo de 2026, sobre 12 reuniones. Todos de
-- +6:00 exactas salvo el de una invitada en America/Chicago, que fue de +5:00
-- porque ahí se sumaba además el otro bug (el evento de Google se creaba en
-- la zona del INVITADO en vez de la del anfitrión; ver book.ts).
--
-- EL CASO QUE LO DESTAPÓ. Natalia Salido agendó el 30-ago a las 4:00 p.m.
-- para el 1-sep. El registro quedó en 21:00. Sus tres recordatorios le
-- anunciaron «9:00 p.m.» y salieron seis horas después de que su reunión ya
-- había pasado; al final escribió «Hola nunca confirme».
--
-- ALCANCE DE ESTE ARCHIVO. Solo se corrige lo que TODAVÍA no ocurre: las
-- reuniones pasadas se dejan como están, porque su registro es la evidencia
-- de lo que de verdad se le dijo al cliente. Al 2-sep-2026 la única viva
-- dañada era la de Melissa (3-sep): 21:00 → 15:00.
--
-- Reversible: `respaldo_horas_sync_20260902` guarda la hora anterior.

begin;

create table if not exists respaldo_horas_sync_20260902 (
  booking_id uuid primary key, fecha_ant date, hora_inicio_ant time,
  hora_fin_ant time, hecho_at timestamptz not null default now());

insert into respaldo_horas_sync_20260902 (booking_id, fecha_ant, hora_inicio_ant, hora_fin_ant)
select id, fecha, hora_inicio, hora_fin from bookings
where id = 'dd8f1280-c31a-4f13-a98d-da23d1b25db2'
on conflict (booking_id) do nothing;

-- El `and hora_inicio = '21:00:00'` es a propósito: si alguien ya la arregló
-- a mano, esto no la vuelve a mover.
update bookings set hora_inicio = '15:00:00', hora_fin = '16:00:00', updated_at = now()
where id = 'dd8f1280-c31a-4f13-a98d-da23d1b25db2'
  and hora_inicio = '21:00:00';

commit;

-- Aplicado el 2-sep-2026: Melissa · 3-sep · 21:00 → 15:00.

-- ── PARA DESHACER ────────────────────────────────────────────────────────
-- update bookings b set fecha = r.fecha_ant, hora_inicio = r.hora_inicio_ant,
--        hora_fin = r.hora_fin_ant
--   from respaldo_horas_sync_20260902 r where r.booking_id = b.id;

-- ── CÓMO VOLVER A BUSCAR DAÑO ────────────────────────────────────────────
-- select to_char(created_at,'YYYY-MM-DD HH24:MI') cuando,
--        metadata->>'old_hora_inicio' antes, metadata->>'new_hora_inicio' despues
--   from activities
--  where titulo like 'Demo reagendada (Google Calendar sync)%'
--  order by created_at desc;
-- Un salto de exactamente +6:00 (o +5:00 con invitado en otra zona) es este bug,
-- no un cliente moviendo su reunión.
