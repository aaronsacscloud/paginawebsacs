-- ARREGLO · `/herramientas/mcp` no es una herramienta.
--
-- La vista clasificaba como «herramienta» todo lo que colgara de
-- `/herramientas/`, y ahí vive también la página que explica cómo conectar el
-- MCP. Salía en el listado un activo llamado «mcp» junto a `curva-de-tallas` y
-- `nivelar-entre-tiendas`, como si fuera una calculadora más.
--
-- No es cosmético: la pregunta que contesta esta vista es «¿qué trae clientes,
-- las herramientas o los artículos?», y meter una página de documentación en el
-- montón de las herramientas responde mal esa pregunta.
--
-- Se reclasifica en vez de excluirse: esa página SÍ puede traer un lead, y
-- perderla sería el error contrario.
--
-- ⚠️ La regla es estructural y hay que recordarla: cada página nueva bajo
-- `/herramientas/` que NO sea una herramienta tiene que entrar en esta lista.
-- Hoy son dos (`mcp` y el índice); si mañana hay un `/herramientas/precios`,
-- aparecerá como herramienta hasta que alguien lo note.

create or replace view de_toques as
  select
    u.visitor_id,
    'herramienta'::text as tipo,
    u.slug              as activo,
    u.created_at        as at
  from de_herramienta_usos u
  where u.visitor_id is not null and u.ok

  union all

  select
    v.visitor_id,
    'pagina'::text,
    c.seccion || '/' || c.slug,
    v.created_at
  from contact_visits v
  join de_contenido c
    on v.ruta = '/' || c.seccion || '/' || c.slug
    or v.ruta = '/' || c.seccion || '/' || c.slug || '/'
  where v.visitor_id is not null and c.estado = 'publicado'

  union all

  -- Bajo /herramientas/ hay herramientas y hay páginas. Se separan por nombre
  -- porque no hay forma de preguntárselo a la base: el registro de herramientas
  -- vive en TypeScript.
  select
    v.visitor_id,
    case when rtrim(v.ruta, '/') in ('/herramientas', '/herramientas/mcp')
         then 'pagina' else 'herramienta' end,
    case when rtrim(v.ruta, '/') in ('/herramientas', '/herramientas/mcp')
         then ltrim(rtrim(v.ruta, '/'), '/')
         else replace(rtrim(v.ruta, '/'), '/herramientas/', '') end,
    v.created_at
  from contact_visits v
  where v.visitor_id is not null
    and (v.ruta like '/herramientas/%' or rtrim(v.ruta, '/') = '/herramientas');

comment on view de_toques is
  'Cada contacto entre un visitante anónimo y un activo del motor. Bajo /herramientas/ conviven herramientas y páginas: la lista de excepciones se mantiene a mano porque el registro de herramientas vive en TypeScript.';
