-- Inbox WhatsApp v7: operación real (media entrante, autor, citas, cierre)
alter table wa_mensajes
  add column if not exists media_id text,
  add column if not exists mime text,
  add column if not exists filename text,
  add column if not exists autor_id uuid,
  add column if not exists autor text,
  add column if not exists borrado_at timestamptz;
alter table wa_conversaciones
  add column if not exists cierre_categoria text,
  add column if not exists cierre_nota text;
create table if not exists wa_cierre_categorias (
  id serial primary key,
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);
insert into wa_cierre_categorias (nombre, orden) values
  ('Venta cerrada', 1), ('Cotización enviada', 2), ('Soporte resuelto', 3),
  ('Sin interés', 4), ('No contesta', 5), ('Spam / número equivocado', 6), ('Otro', 99)
on conflict (nombre) do nothing;
