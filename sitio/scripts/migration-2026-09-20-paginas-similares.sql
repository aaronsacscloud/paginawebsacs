create table if not exists de_paginas_similares (
  id uuid primary key default gen_random_uuid(),
  contenido_id uuid references de_contenido(id) on delete cascade,
  url text not null,
  titulo text,
  tipo text,
  palabras_aprox int,
  h2 jsonb default '[]',
  tiene_faq boolean, tiene_tabla_o_pasos boolean, menciona_precios boolean,
  cubre_bien jsonb default '[]', le_falta jsonb default '[]', por_que_rankea text,
  analizada_at timestamptz not null default now(),
  unique (contenido_id, url)
);
comment on table de_paginas_similares is 'Las paginas que hoy contestan la misma pregunta que una pieza nuestra, leidas por el modelo con web_search (este servidor esta bloqueado por Cloudflare para leerlas directo). Es contra lo que el referee compara: una pagina nuestra se aprueba solo si es mejor que estas en lo concreto.';
create index if not exists de_paginas_similares_contenido_idx on de_paginas_similares(contenido_id);
