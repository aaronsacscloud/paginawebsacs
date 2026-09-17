-- DEMAND ENGINE · etapa 5: ¿qué de lo que hace el motor trae clientes?
--
-- Hasta aquí el motor publica, calcula y mide su visibilidad. Lo que no sabía
-- es lo único que decide si vale la pena: **cuál de sus activos —qué página,
-- qué herramienta— acabó en un cliente que paga.** Sin esto, el motor optimiza
-- lo que puede contar (publicaciones, menciones) en vez de lo que importa.
--
-- La cadena completa, eslabón por eslabón:
--
--   activo del motor  →  toque anónimo   →  contacto   →  cliente   →  ARR
--   (página o          (sacs_vid en      (contacts.    (subscri-
--    herramienta)       cookie)           visitor_id)   ptions)
--
-- ⚠️ LA COBERTURA HAY QUE DECIRLA SIEMPRE, y por eso `de_atribucion_cobertura`
-- existe y no es opcional. Solo 17 de 388 contactos traen `visitor_id`, porque
-- la mayoría de los leads del CRM NO llegan por la web: llegan por WhatsApp,
-- por el ABM y por los formularios de TikTok, y esa gente nunca tuvo una cookie
-- nuestra. Un número de atribución bajo, sin ese contexto al lado, se lee como
-- «el motor no funciona» cuando en realidad dice «así llega hoy la gente».
-- Enseñar la cifra sin la cobertura sería inventar un fracaso.

-- ── 1 · los toques: todo contacto entre un visitante y un activo del motor ──
--
-- Es una vista y no una tabla: el dato vive en `de_herramienta_usos` y en
-- `contact_visits`, y duplicarlo solo crea dos verdades que se separan.
create or replace view de_toques as
  -- Usos de herramienta
  select
    u.visitor_id,
    'herramienta'::text as tipo,
    u.slug              as activo,
    u.created_at        as at
  from de_herramienta_usos u
  where u.visitor_id is not null and u.ok

  union all

  -- Visitas a páginas que publicó el motor. Se cruza contra `de_contenido`
  -- para no contar las páginas escritas a mano: la pregunta es qué trae EL
  -- MOTOR, no qué trae el sitio.
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

  -- Visitas a las páginas de herramientas (no viven en `de_contenido`).
  select
    v.visitor_id,
    'herramienta'::text,
    replace(rtrim(v.ruta, '/'), '/herramientas/', ''),
    v.created_at
  from contact_visits v
  where v.visitor_id is not null
    and v.ruta like '/herramientas/%'
    and rtrim(v.ruta, '/') <> '/herramientas';

comment on view de_toques is
  'Cada contacto entre un visitante anónimo y un activo del motor. Vista, no tabla: el dato ya vive en de_herramienta_usos y contact_visits, y copiarlo crearía dos verdades.';

-- ── 2 · el recorrido de cada visitante que acabó siendo contacto ────────────
create or replace view de_recorridos as
  select
    ct.id                                   as contact_id,
    ct.visitor_id,
    ct.created_at                           as contacto_at,
    ct.company_id,
    -- El PRIMER activo del motor que tocó: la respuesta a «qué lo trajo».
    (array_agg(t.activo order by t.at))[1]  as primer_activo,
    (array_agg(t.tipo   order by t.at))[1]  as primer_tipo,
    -- El ÚLTIMO antes de dejar sus datos: la respuesta a «qué lo convenció».
    -- Son preguntas distintas y dos presupuestos distintos; por eso van las dos.
    (array_agg(t.activo order by t.at desc))[1] as ultimo_activo,
    (array_agg(t.tipo   order by t.at desc))[1] as ultimo_tipo,
    count(*)                                as toques,
    count(distinct t.activo)                as activos_distintos,
    min(t.at)                               as primer_toque_at,
    -- Cuánto tardó desde que nos conoció hasta que dejó sus datos.
    extract(epoch from (ct.created_at - min(t.at))) / 86400 as dias_hasta_contacto
  from contacts ct
  join de_toques t
    on t.visitor_id = ct.visitor_id
   -- Solo toques ANTERIORES a darse de alta. Lo que navegó DESPUÉS de ser
   -- cliente no lo trajo: contarlo sería atribuirle al motor gente que ya
   -- estaba dentro, que es la forma más fácil de que estos números mientan.
   and t.at <= ct.created_at
  where ct.visitor_id is not null
  group by ct.id, ct.visitor_id, ct.created_at, ct.company_id;

comment on view de_recorridos is
  'Un renglón por contacto con rastro web: qué activo del motor lo trajo y cuál lo convenció. Solo cuenta toques ANTERIORES al alta.';

-- ── 3 · el resumen por activo, que es lo que se mira ───────────────────────
create or replace view de_atribucion as
  select
    r.primer_tipo                           as tipo,
    r.primer_activo                         as activo,
    count(*)                                as leads,
    count(*) filter (where s.id is not null) as clientes,
    coalesce(sum(s.arr) filter (where s.estado in ('activa','programada')), 0) as arr,
    round(avg(r.dias_hasta_contacto)::numeric, 1) as dias_promedio,
    min(r.contacto_at)                      as primer_lead,
    max(r.contacto_at)                      as ultimo_lead
  from de_recorridos r
  left join lateral (
    -- `arr` y no `precio`: el CRM ya tiene UNA definición de ARR (planes base,
    -- sin add-ons ni descuentos duplicados) y usar otra columna aquí crearía un
    -- segundo ARR que se separaría del de las pantallas de finanzas.
    -- «Cliente» según la regla del CRM: activa cuenta, y `programada` también
    -- porque ahí viven las licencias vitalicias. Cancelada no.
    select s.id, s.arr, s.estado
      from subscriptions s
     where s.company_id = r.company_id and s.estado in ('activa','programada')
     order by s.created_at limit 1
  ) s on true
  group by r.primer_tipo, r.primer_activo;

comment on view de_atribucion is
  'Qué activo del motor trae leads y clientes. Atribución al PRIMER toque. Leer SIEMPRE junto a de_atribucion_cobertura.';

-- ── 4 · la cobertura: sin esto, lo de arriba se malinterpreta ──────────────
create or replace view de_atribucion_cobertura as
  select
    count(*)                                          as contactos,
    count(*) filter (where visitor_id is not null)     as con_rastro_web,
    round(100.0 * count(*) filter (where visitor_id is not null) / nullif(count(*), 0), 1) as pct_con_rastro,
    (select count(*) from de_recorridos)               as con_toque_del_motor,
    (select count(distinct visitor_id) from de_toques) as visitantes_tocados
  from contacts;

comment on view de_atribucion_cobertura is
  'Sobre cuántos contactos se puede opinar. La mayoría de los leads llegan por WhatsApp, ABM y TikTok: esa gente nunca tuvo cookie nuestra, así que su ausencia de la atribución NO es un fallo del motor.';
