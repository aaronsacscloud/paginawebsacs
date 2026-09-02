-- Recursos del agente: la galería crece a imágenes, PDF y video; una respuesta puede llevar varios adjuntos.
alter table ia_imagenes add column if not exists tipo text not null default 'image',   -- image | document | video
  add column if not exists mime text, add column if not exists bytes bigint, add column if not exists archivo text;
alter table ti_envios add column if not exists adjuntos jsonb not null default '[]'::jsonb;
alter table ia_ejemplos add column if not exists adjuntos jsonb not null default '[]'::jsonb;
-- lo ya existente en imagen_id pasa a adjuntos
update ti_envios e set adjuntos = jsonb_build_array(jsonb_build_object('id', i.id, 'tipo', 'image', 'url', i.url, 'nombre', i.nombre)) from ia_imagenes i where e.imagen_id = i.id and e.adjuntos = '[]'::jsonb;
update ia_ejemplos e set adjuntos = jsonb_build_array(jsonb_build_object('id', i.id, 'tipo', 'image', 'url', i.url, 'nombre', i.nombre)) from ia_imagenes i where e.imagen_id = i.id and e.adjuntos = '[]'::jsonb;
