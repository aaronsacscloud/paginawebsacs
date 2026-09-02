-- Galería del agente SDR: imágenes que el agente puede mandar (y que el dueño adjunta al aprobar/corregir).
create table if not exists ia_imagenes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  url text not null,
  descripcion text,            -- qué muestra (para que el agente decida)
  cuando text,                 -- cuándo conviene mandarla
  giros text[] not null default '{}',
  temas text[] not null default '{}',
  activa boolean not null default true,
  usos int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table ti_envios add column if not exists imagen_id uuid, add column if not exists imagen_url text;
alter table ia_ejemplos add column if not exists imagen_id uuid;
insert into ia_imagenes (nombre, url, descripcion, cuando, temas)
select 'SACS en tablet (punto de venta)', 'https://www.sacscloud.com/images/hero-sacs-tablet.webp', 'El punto de venta de Sacs en una tablet, en una tienda de ropa.', 'Cuando el lead pregunta cómo se ve el sistema o si funciona en tablet.', '{sistema,pos}'
where not exists (select 1 from ia_imagenes);
