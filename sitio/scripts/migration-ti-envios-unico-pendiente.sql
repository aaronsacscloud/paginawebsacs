-- Un solo envío PENDIENTE por lead: dos ticks del observador traslapados proponían dos veces la misma respuesta
-- (caso 2026-09-02 21:32: dos tarjetas gemelas con 7 s de diferencia; el dueño aprobó una y «la otra no se quitaba»).
update ti_envios e set estado='reemplazado', motivo_veto='gemela: ya había un pendiente para este lead', updated_at=now()
 where estado='pendiente' and exists (select 1 from ti_envios n where n.contact_id=e.contact_id and n.estado='pendiente' and n.created_at > e.created_at);
create unique index if not exists uq_ti_envios_pendiente_por_lead on ti_envios(contact_id) where estado='pendiente';
