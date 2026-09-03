-- 2026-09-03 · La campana del CRM aprende a avisar a UNA persona.
--
-- crm_notificaciones era global: todo el equipo veía lo mismo. Los avisos de
-- "Equipo" (te mencionaron, te respondieron, te asignaron un acuerdo) son de
-- quien los recibe. `para` NULL = para todos (como hasta hoy).
alter table crm_notificaciones add column if not exists para uuid references team_members(id);
create index if not exists crm_notificaciones_para_idx on crm_notificaciones (para, leida_at) where para is not null;

-- Verificación esperada: 1 fila con data_type uuid.
-- select column_name, data_type from information_schema.columns where table_name='crm_notificaciones' and column_name='para';
