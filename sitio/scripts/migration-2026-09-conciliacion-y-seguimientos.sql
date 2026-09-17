-- «En conciliación» + «Pidió seguimiento» — 17-sep-2026
--
-- Pedido del dueño (caso Jose Francisco): un lead perdido que acepta sentarse a
-- negociar no es un perdido más, pero tampoco es una oportunidad todavía. Hoy se
-- queda en «Perdido» y se pierde entre los que ya no van a volver.
--
-- Y aparte: «tengo que darle seguimiento en 30 días» necesita un lugar. Hoy eso
-- vive en la cabeza de quien contestó.
--
-- POR QUÉ UNA TABLA Y NO UN CAMPO en contacts:
-- un lead pide seguimiento más de una vez («márcame en 30 días» … y a los 30
-- días «mejor en enero»). Con un campo, la segunda promesa borra la primera y se
-- pierde el historial de cuántas veces se aplazó — que es justo la señal de que
-- ese lead no va a cerrar.

create table if not exists crm_seguimientos (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  -- La conversación desde la que se pidió, para poder volver al hilo.
  conversation_id uuid,
  -- Qué prometió y para cuándo. `fecha` es DATE y no timestamp: nadie promete
  -- «el 12 a las 15:40», promete «el 12».
  motivo       text not null,
  fecha        date not null,
  -- Se cierra al atenderlo; mientras sea null, está pendiente.
  cumplido_at  timestamptz,
  cumplido_por uuid,
  creado_por   uuid,
  created_at   timestamptz not null default now()
);

-- El filtro del inbox pregunta siempre lo mismo: los pendientes, por fecha.
-- Parcial para que el índice no cargue con los ya cumplidos, que solo se miran
-- en el historial de la ficha.
create index if not exists crm_seguimientos_pendientes_idx
  on crm_seguimientos (fecha, contact_id) where cumplido_at is null;
create index if not exists crm_seguimientos_contacto_idx
  on crm_seguimientos (contact_id, created_at desc);

-- La etapa nueva, si el catálogo de etapas vive en base. Es aditivo: no toca
-- ninguna fila existente ni cambia el orden de las demás.
-- Va entre «Perdido» y «Descalificado»: es un perdido que todavía tiene cuerda.
do $$
begin
  if to_regclass('public.crm_etapas') is not null then
    insert into crm_etapas (id, label, bg, fg, orden, tipo)
    values ('en_conciliacion', 'En conciliación', '#FFF4E5', '#9a6a10', 75, 'abierta')
    on conflict (id) do nothing;
  end if;
end $$;
