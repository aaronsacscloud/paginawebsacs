-- ═══ Pasar un acuerdo incumplido a la junta de hoy, con un clic ═══════════
--
-- Pedido del dueño (5-sep-2026): al abrir la sala, lo primero que se ve es lo
-- que quedó de la junta pasada; y si algo no se cumplió, con UN CLIC pasa a ser
-- acuerdo de la reunión de hoy. Así el ciclo se cierra dentro de la plataforma
-- en vez de terminar en «lo vemos la próxima» dicho en voz alta.
--
-- POR QUÉ HACE FALTA UNA COLUMNA:
-- Sin ella, «pasarlo» sería crear un acuerdo nuevo con el mismo texto y dejar
-- el viejo vivo: el mismo compromiso contado DOS veces en pendientes, y a la
-- tercera junta serían tres. Con `reemplazado_por`, el viejo sale de pendientes
-- y queda apuntando al que lo continúa.
--
-- No se borra ni se marca hecho: no se hizo. Se archiva señalando su heredero,
-- que es lo que permite contestar «¿cuántas veces se ha arrastrado esto?» —la
-- pregunta que de verdad importa cuando algo lleva un mes sin cumplirse.
--
-- Aditiva y reversible:
--   alter table espacio_acuerdos drop column reemplazado_por;

alter table espacio_acuerdos
  add column if not exists reemplazado_por uuid references espacio_acuerdos(id) on delete set null;

-- Para listar pendientes sin barrer la tabla: los pendientes son los que NO
-- están hechos y NO fueron reemplazados.
create index if not exists espacio_acuerdos_vivos
  on espacio_acuerdos (sesion_id) where hecho_at is null and reemplazado_por is null;

select count(*) acuerdos,
       count(*) filter (where hecho_at is null) sin_hacer,
       count(*) filter (where reemplazado_por is not null) ya_arrastrados
  from espacio_acuerdos;
