-- ════════════════════════════════════════════════════════════════════════════
-- SACS DEMAND ENGINE · Etapa 0 · Cimientos
--
-- Crea el estado mínimo del motor de demanda: configuración, matriz de
-- autonomía, conectores, LA COLA, ciclos, taxonomía del journey, ICP, pesos
-- del score, memoria (lo que no funcionó) y salud.
--
-- ADITIVA: no toca ninguna tabla existente. Idempotente: se puede correr dos
-- veces sin fallar ni duplicar semillas.
--
-- Plan: sitio/PLAN-DEMAND-ENGINE.md · Análisis: sitio/ANALISIS-DEMAND-ENGINE.md
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · CONFIGURACIÓN (una sola fila) ───────────────────────────────────────
create table if not exists de_config (
  id                        int primary key default 1 check (id = 1),
  -- 0 observar · 1 recomendar · 2 redactar · 3 ejecutar reversible · 4 autónomo
  autonomia_global          int  not null default 2,
  presupuesto_mensual_usd   numeric(10,2) not null default 150,
  gasto_mes_usd             numeric(12,6) not null default 0,
  mes_en_curso              text,
  -- Corta TODO lo que escribe. La lectura sigue: apagar no puede cegar.
  kill_switch               boolean not null default false,
  -- 'normal' | 'simulacion' (corre el ciclo sin escribir nada: N15)
  modo                      text not null default 'normal',
  mercados                  text[] not null default array['MX'],
  idiomas                   text[] not null default array['es'],
  umbrales                  jsonb not null default '{}'::jsonb,
  pesos_version             int  not null default 1,
  dueno_whatsapp            text,
  arrancado_at              timestamptz,
  actualizado_at            timestamptz not null default now()
);

insert into de_config (id) values (1) on conflict (id) do nothing;

-- Umbrales por defecto (solo si nadie los ha tocado todavía).
update de_config set umbrales = jsonb_build_object(
  'similitud_cluster',       0.85,   -- une una consulta a un cluster
  'similitud_duplicado',     0.92,   -- considera dos cosas la misma
  'gsc_impresiones_min',     50,     -- piso para mirar una consulta
  'seo_posicion_desde',      4,      -- ventana de oportunidad…
  'seo_posicion_hasta',      20,     -- …posición 4-20
  'caida_posicion_alerta',   3,
  'caida_trafico_pct',       30,
  'decay_pct',               25,
  'oportunidad_envejece_dias', 60,
  'aviso_presupuesto_pct',   80,
  'programaticas_por_semana', 5,
  'auditoria_minima',        9,
  'anomalia_desvio_pct',     70
) where umbrales = '{}'::jsonb;

-- ── 2 · MATRIZ DE AUTONOMÍA ─────────────────────────────────────────────────
-- Una fila por TIPO de acción. `inmutable` marca los guardrails que ningún
-- agente puede mover: son la diferencia entre un motor que aprende y uno que
-- se suelta.
create table if not exists de_politicas (
  tipo_accion         text primary key,
  nivel               int  not null default 4,       -- nivel de autonomía que EXIGE
  riesgo              text not null default 'LOW',   -- LOW|MEDIUM|HIGH|CRITICAL
  requiere_aprobacion boolean not null default false,
  tope_dia            int,
  max_intentos        int  not null default 3,
  inmutable           boolean not null default false,
  notas               text,
  actualizado_at      timestamptz not null default now(),
  constraint de_politicas_riesgo_ck check (riesgo in ('LOW','MEDIUM','HIGH','CRITICAL')),
  constraint de_politicas_nivel_ck  check (nivel between 0 and 4)
);

insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas) values
  -- Sistema
  ('sistema.noop',          4,'LOW',     false, null, 1, false,'Prueba de vida de la cola'),
  ('sistema.ciclo',         4,'LOW',     false, null, 2, false,'Abre y arma la cadena del ciclo'),
  ('sistema.cerrar_ciclo',  4,'LOW',     false, null, 2, false,'Cierra el ciclo con resumen y TOP 5'),
  ('sistema.salud',         4,'LOW',     false, null, 2, false,'Latido: ciclos, conectores, cola, presupuesto'),
  -- Ingesta (leer nunca es riesgoso)
  ('ingerir.gsc',           4,'LOW',     false, null, 3, false,'Search Console'),
  ('ingerir.ga4',           4,'LOW',     false, null, 3, false,'Analítica'),
  ('ingerir.crm',           4,'LOW',     false, null, 3, false,'Demanda de primera mano del propio CRM'),
  ('ingerir.autocomplete',  4,'LOW',     false,  300, 3, false,'Sugerencias de búsqueda'),
  ('ingerir.reddit',        4,'LOW',     false,  200, 3, false,'Comunidades'),
  ('ingerir.youtube',       4,'LOW',     false,  200, 3, false,'Videos y comentarios del ramo'),
  ('ingerir.serp',          4,'LOW',     false,  200, 3, false,'Proveedor de SERP y volumen'),
  ('ingerir.competidor',    4,'LOW',     false, null, 3, false,'Sitemaps y páginas de competidores'),
  -- Proceso
  ('normalizar',            4,'LOW',     false, null, 3, false,'Consulta cruda a consulta normalizada'),
  ('agrupar',               4,'LOW',     false, null, 3, false,'Clusters semánticos'),
  ('clasificar',            4,'LOW',     false, null, 3, false,'Categoría, etapa, ICP, intención'),
  ('puntuar',               4,'LOW',     false, null, 3, false,'Score de oportunidades'),
  ('detectar.seo',          4,'LOW',     false, null, 3, false,'Movimientos de buscadores'),
  ('detectar.decay',        4,'LOW',     false, null, 3, false,'Contenido que decae'),
  ('detectar.tecnico',      4,'LOW',     false, null, 3, false,'Rastreo y auditoría técnica'),
  ('detectar.competidor',   4,'LOW',     false, null, 3, false,'Cambios relevantes de competidores'),
  ('oportunidad.crear',     4,'LOW',     false, null, 3, false,'Alta o fusión de oportunidad'),
  ('metricas.calcular',     4,'LOW',     false, null, 3, false,'DCS, SVS, AVS y series'),
  ('atribucion.procesar',   4,'LOW',     false, null, 3, false,'Toques y conversiones'),
  -- Visibilidad en IA
  ('geo.muestrear',         4,'LOW',     false,  400, 2, false,'Preguntar a las plataformas de IA'),
  ('geo.extraer',           4,'LOW',     false, null, 3, false,'Leer la respuesta y sacar menciones'),
  ('geo.score',             4,'LOW',     false, null, 3, false,'AI Visibility Score'),
  -- Contenido
  ('contenido.brief',       4,'LOW',     false,   20, 3, false,'Brief a partir de una oportunidad'),
  ('contenido.borrador',    4,'LOW',     false,   10, 3, false,'Redacción del borrador'),
  ('contenido.auditar',     4,'LOW',     false, null, 3, false,'Las nueve auditorías'),
  ('contenido.publicar',    2,'MEDIUM',  true,     5, 2, false,'Sube a nivel 3 con la rampa (E6.1)'),
  ('contenido.actualizar',  3,'MEDIUM',  false,    5, 2, false,'Refrescar lo que el motor publicó: reversible'),
  ('contenido.programatica',2,'MEDIUM',  true,     5, 2, false,'Página programática: exige sustancia'),
  ('contenido.revertir',    4,'LOW',     false, null, 2, false,'Volver a la versión anterior siempre se puede'),
  -- Enlazado
  ('enlaces.calcular',      4,'LOW',     false, null, 3, false,'Grafo interno y huérfanas'),
  ('enlaces.aplicar',       4,'LOW',     false,   30, 3, false,'Solo en contenido dinámico del motor'),
  -- Aprendizaje
  ('aprender.evaluar',      4,'LOW',     false, null, 3, false,'Predicho contra real'),
  ('aprender.recalibrar',   1,'MEDIUM',  true,  null, 2, false,'Propone pesos; aplicarlos es del dueño'),
  ('experimento.leer',      4,'LOW',     false, null, 3, false,'Lectura honesta, sin ganador anticipado'),
  -- Trabajo de código: lo toma el operador, el push del dueño es la aprobación
  ('codigo.tecnico',        2,'MEDIUM',  false,   10, 1, false,'Arreglo técnico en el repo'),
  ('codigo.pagina',         2,'MEDIUM',  false,    5, 1, false,'Página estática nueva o retocada'),
  ('codigo.schema',         2,'MEDIUM',  false,    5, 1, false,'Datos estructurados y entidad'),
  ('codigo.herramienta',    2,'HIGH',    true,     2, 1, false,'Herramienta gratis nueva'),
  -- Hacia afuera: nunca solo
  ('terceros.alta',         1,'HIGH',    true,     5, 1, false,'Directorios y comparadores: ficha lista, la manda el dueño'),
  ('pr.outreach',           1,'HIGH',    true,     3, 1, true, 'Mensajes a personas de fuera: jamás masivo ni automático'),
  ('pagina.critica',        1,'HIGH',    true,     2, 1, true, 'Home, planes, enterprise, navegación'),
  -- Nunca autónomo
  ('precio.cambiar',        0,'CRITICAL',true,     1, 1, true, 'Precios: solo el dueño, siempre'),
  ('contenido.borrar',      0,'CRITICAL',true,     1, 1, true, 'Borrar contenido publicado'),
  ('pesos.aplicar',         0,'CRITICAL',true,     1, 1, true, 'Cambiar los pesos vigentes del score'),
  ('db.destructivo',        0,'CRITICAL',true,     1, 1, true, 'Cualquier cambio destructivo de datos')
on conflict (tipo_accion) do nothing;

-- ── 3 · CONECTORES ──────────────────────────────────────────────────────────
-- `falta` e `impacto` existen para que el motor pueda DECIR qué le hace falta
-- y qué se pierde sin ello (pantalla «Lo que me falta», N17).
create table if not exists de_conectores (
  id                text primary key,
  nombre            text not null,
  grupo             text not null,       -- first_party|busqueda|comunidad|competencia|ia|terceros
  activo            boolean not null default false,
  disponible        boolean not null default false,
  falta             text,
  impacto           text,
  config            jsonb not null default '{}'::jsonb,
  cadencia          text not null default 'diaria',
  cuota_dia         int,
  uso_dia           int not null default 0,
  uso_dia_fecha     date,
  naturaleza        text not null default 'observada',
  ultimo_ok_at      timestamptz,
  ultimo_intento_at timestamptz,
  ultimo_error      text,
  fallos_seguidos   int not null default 0,
  diagnostico       jsonb,
  filas_ultima      int,
  orden             int not null default 100,
  actualizado_at    timestamptz not null default now(),
  constraint de_conectores_naturaleza_ck check (naturaleza in ('observada','inferida','estimada','generada'))
);

insert into de_conectores (id, nombre, grupo, naturaleza, cadencia, cuota_dia, orden, impacto) values
  ('crm',          'CRM de Sacs (leads, pérdidas, soporte, WhatsApp)','first_party','observada','diaria', null, 10,'Sin esto se pierde la demanda que solo nosotros vemos'),
  ('gsc',          'Google Search Console',                          'busqueda',   'observada','diaria', null, 20,'Sin esto no hay demanda observada de buscadores ni ranking real'),
  ('ga4',          'Analítica del sitio',                            'busqueda',   'observada','diaria', null, 30,'Sin esto no se sabe qué hace la gente al llegar'),
  ('autocomplete', 'Sugerencias de búsqueda',                        'busqueda',   'observada','diaria',  300, 40,'Sin esto se pierden las formas reales de preguntar'),
  ('serp',         'Proveedor de SERP y volumen',                    'busqueda',   'estimada', 'semanal', 200, 50,'Sin esto el volumen queda estimado por señales y no hay AI Overview'),
  ('pagespeed',    'Velocidad y Core Web Vitals',                    'busqueda',   'observada','semanal', 100, 60,'Sin esto no se mide la experiencia de página'),
  ('reddit',       'Reddit',                                         'comunidad',  'observada','diaria',  200, 70,'Sin esto se pierden las preguntas de comunidad'),
  ('youtube',      'YouTube',                                        'comunidad',  'observada','diaria',  200, 80,'Sin esto se pierde lo que el ramo busca en video'),
  ('competidores', 'Sitios de competidores',                         'competencia','observada','semanal', null, 90,'Sin esto no se detecta lo que lanzan'),
  ('ia_openai',    'ChatGPT',                                        'ia',         'observada','diaria',  200,100,'Sin esto no se mide la plataforma de IA más usada'),
  ('ia_gemini',    'Gemini',                                         'ia',         'observada','diaria',  200,110,'Sin esto no se mide la IA de Google'),
  ('ia_anthropic', 'Claude',                                         'ia',         'observada','diaria',  200,120,'Sin esto no se mide Claude'),
  ('ia_perplexity','Perplexity',                                     'ia',         'observada','diaria',  200,130,'Sin esto no se mide el buscador de IA que más cita fuentes'),
  ('ia_xai',       'Grok',                                           'ia',         'observada','diaria',  200,140,'Sin esto no se mide Grok'),
  ('terceros',     'Directorios y comparadores',                     'terceros',   'observada','semanal', null,150,'Sin esto no se sabe dónde nos falta estar para que las IAs nos citen')
on conflict (id) do nothing;

-- ── 4 · LA COLA ─────────────────────────────────────────────────────────────
-- Un solo carril para todo el trabajo del motor: se ve, se aprueba, se
-- reintenta y sobrevive a un despliegue.
create table if not exists de_acciones (
  id               uuid primary key default gen_random_uuid(),
  clave_idem       text not null unique,
  tipo             text not null,
  prioridad        int  not null default 50,
  estado           text not null default 'pendiente',
  payload          jsonb not null default '{}'::jsonb,
  agente           text,
  intentos         int  not null default 0,
  max_intentos     int  not null default 3,
  programada_at    timestamptz not null default now(),
  iniciada_at      timestamptz,
  terminada_at     timestamptz,
  lease_hasta      timestamptz,
  error            jsonb,
  resultado        jsonb,
  creada_por       text not null default 'motor',
  depende_de       uuid references de_acciones(id) on delete set null,
  ciclo_id         uuid,
  run_id           uuid,
  riesgo           text not null default 'LOW',
  nivel_requerido  int  not null default 4,
  costo_usd        numeric(12,6) not null default 0,
  aprobada_por     uuid,
  aprobada_at      timestamptz,
  motivo           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint de_acciones_estado_ck check (estado in
    ('pendiente','lista','necesita_aprobacion','aprobada','rechazada',
     'corriendo','terminada','fallida','muerta','para_operador','cancelada'))
);

create index if not exists de_acciones_listas_idx
  on de_acciones (estado, prioridad desc, programada_at)
  where estado in ('lista','pendiente');
create index if not exists de_acciones_corriendo_idx on de_acciones (lease_hasta) where estado = 'corriendo';
create index if not exists de_acciones_ciclo_idx     on de_acciones (ciclo_id);
create index if not exists de_acciones_tipo_dia_idx  on de_acciones (tipo, created_at desc);
create index if not exists de_acciones_estado_idx    on de_acciones (estado, created_at desc);

-- ── 5 · CICLOS ──────────────────────────────────────────────────────────────
create table if not exists de_ciclos (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null,           -- diario|semanal|mensual|evento|manual
  clave_idem         text unique,
  objetivo           text,
  inicio             timestamptz not null default now(),
  fin                timestamptz,
  estado             text not null default 'corriendo',
  resumen            jsonb not null default '{}'::jsonb,
  top5               jsonb not null default '[]'::jsonb,
  costo_usd          numeric(12,6) not null default 0,
  acciones_creadas   int not null default 0,
  acciones_ok        int not null default 0,
  acciones_fallidas  int not null default 0,
  simulacion         boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint de_ciclos_estado_ck check (estado in ('corriendo','ok','parcial','fallido','cancelado'))
);
create index if not exists de_ciclos_tipo_idx on de_ciclos (tipo, inicio desc);

-- ── 6 · TAXONOMÍA DEL RECORRIDO DEL CLIENTE ─────────────────────────────────
create table if not exists de_taxonomia (
  id            text primary key,
  nombre        text not null,
  etapa_macro   text not null,   -- crear|publicar|promocionar|vender|operar|comprar|distribuir|retener|analizar|descubrir
  descripcion   text,
  activa        boolean not null default true,
  propuesta_por text,
  orden         int not null default 100,
  created_at    timestamptz not null default now()
);

insert into de_taxonomia (id, nombre, etapa_macro, orden) values
  ('descubrir_negocio','Empezar el negocio','descubrir',10),
  ('crear_producto','Crear producto','crear',20),
  ('datos_producto','Datos del producto','crear',30),
  ('fotografia','Fotografía de producto','crear',40),
  ('modelos_ia','Modelos con IA','crear',50),
  ('video','Video','crear',60),
  ('contenido','Contenido','crear',70),
  ('catalogo','Catálogo','publicar',80),
  ('ecommerce','Tienda en línea','publicar',90),
  ('social_commerce','Venta por redes','publicar',100),
  ('marketing','Marketing','promocionar',110),
  ('ads','Publicidad','promocionar',120),
  ('influencers','Influencers','promocionar',130),
  ('whatsapp','WhatsApp','promocionar',140),
  ('atencion_cliente','Atención a clientes','promocionar',150),
  ('punto_de_venta','Punto de venta','vender',160),
  ('vender','Vender','vender',170),
  ('inventario','Inventario','operar',180),
  ('variantes','Variantes','operar',190),
  ('tallas','Tallas y curva','operar',200),
  ('colores','Colores','operar',210),
  ('multi_tienda','Varias tiendas','operar',220),
  ('traspasos','Traspasos y nivelación','operar',230),
  ('surtido','Surtido y entrega','operar',240),
  ('pedidos','Gestión de pedidos','operar',250),
  ('devoluciones','Devoluciones','operar',260),
  ('compras','Compras','comprar',270),
  ('proveedores','Proveedores','comprar',280),
  ('mayoreo','Mayoreo y B2B','distribuir',290),
  ('pronostico','Pronóstico de demanda','comprar',300),
  ('reposicion','Reposición','comprar',310),
  ('merchandising','Acomodo y exhibición','operar',320),
  ('precios','Precios','operar',330),
  ('promociones','Promociones','promocionar',340),
  ('lealtad','Lealtad','retener',350),
  ('crm','Clientes y CRM','retener',360),
  ('analitica','Analítica','analizar',370),
  ('rentabilidad','Rentabilidad','analizar',380),
  ('inventario_muerto','Inventario muerto','analizar',390),
  ('personal','Personal','operar',400),
  ('comisiones','Comisiones','operar',410),
  ('contabilidad','Contabilidad y fiscal','analizar',420),
  ('logistica','Logística y envíos','distribuir',430),
  ('automatizacion_ia','Automatización con IA','operar',440),
  ('expansion','Crecer y abrir','analizar',450),
  ('produccion','Producción y maquila','crear',460),
  ('consignacion','Consignación','vender',470),
  ('marketplaces','Marketplaces','publicar',480),
  ('importacion','Importación','comprar',490),
  ('franquicias','Franquicias','analizar',500)
on conflict (id) do nothing;

-- ── 7 · ICP ─────────────────────────────────────────────────────────────────
create table if not exists de_icp (
  id         text primary key,
  nombre     text not null,
  eje        text not null,      -- tamano|modelo|mercancia|canal
  prioridad  int not null default 50,
  activo     boolean not null default true,
  notas      text,
  created_at timestamptz not null default now()
);

insert into de_icp (id, nombre, eje, prioridad) values
  ('solo','Emprende solo','tamano',40),
  ('tienda_1','Una tienda','tamano',80),
  ('tiendas_2_5','2 a 5 sucursales','tamano',95),
  ('tiendas_6_10','6 a 10 sucursales','tamano',90),
  ('tiendas_11_50','11 a 50 sucursales','tamano',85),
  ('tiendas_50','Más de 50 sucursales','tamano',60),
  ('enterprise','Corporativo','tamano',55),
  ('boutique','Boutique','modelo',85),
  ('marca_propia','Marca propia','modelo',90),
  ('dtc','Venta directa al consumidor','modelo',75),
  ('cadena','Cadena','modelo',90),
  ('mayorista','Mayorista','modelo',80),
  ('fabricante','Fabricante','modelo',70),
  ('distribuidor','Distribuidor','modelo',65),
  ('multimarca','Multimarca','modelo',80),
  ('consignacion','Consignación y segunda mano','modelo',60),
  ('ropa','Ropa','mercancia',95),
  ('calzado','Calzado','mercancia',90),
  ('accesorios','Accesorios','mercancia',70),
  ('joyeria','Joyería','mercancia',80),
  ('novias','Novias y fiesta','mercancia',75),
  ('activewear','Deportivo','mercancia',65),
  ('infantil','Infantil','mercancia',60),
  ('omnicanal','Omnicanal','canal',85),
  ('solo_fisico','Solo piso de venta','canal',70),
  ('solo_linea','Solo en línea','canal',60),
  ('redes','Vende por redes','canal',75)
on conflict (id) do nothing;

-- ── 8 · PESOS DEL SCORE ─────────────────────────────────────────────────────
create table if not exists de_pesos (
  version      int primary key,
  pesos        jsonb not null,
  motivo       text,
  evidencia    jsonb not null default '{}'::jsonb,
  vigente      boolean not null default false,
  creada_por   text,
  aprobada_por uuid,
  created_at   timestamptz not null default now()
);

insert into de_pesos (version, pesos, motivo, vigente, creada_por) values
 (1, jsonb_build_object(
    'demanda',        20,
    'relevancia',     15,
    'intencion',      15,
    'conversion',     15,
    'capacidad',      10,
    'distribucion',   10,
    'ventaja',        10,
    'eficiencia',      5
  ), 'Pesos de arranque del plan. Se recalibran con resultados reales (E5.5).', true, 'plan')
on conflict (version) do nothing;

-- ── 9 · MEMORIA DEL MOTOR (N3) ──────────────────────────────────────────────
-- Lo que ya se intentó y no funcionó, y lo que el dueño rechazó. Se consulta
-- ANTES de proponer: sin esto el motor vuelve a sugerir lo mismo cada mes.
create table if not exists de_memoria (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,        -- rechazo|fallo|no_funciono|regla|preferencia
  clave          text,
  leccion        text not null,
  sujeto_tipo    text,
  sujeto_id      uuid,
  evidencia      jsonb not null default '{}'::jsonb,
  embedding      vector(1536),
  vigente        boolean not null default true,
  veces_aplicada int not null default 0,
  creada_por     text,
  created_at     timestamptz not null default now()
);
create index if not exists de_memoria_clave_idx on de_memoria (clave) where vigente;

-- ── 10 · SALUD Y ANOMALÍAS (N1, N2, N14) ────────────────────────────────────
create table if not exists de_salud (
  fecha       date primary key,
  score       int,
  detalle     jsonb not null default '{}'::jsonb,
  incidencias jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists de_anomalias (
  id            uuid primary key default gen_random_uuid(),
  conector      text,
  tipo          text not null,
  esperado      jsonb,
  recibido      jsonb,
  accion_tomada text,
  resuelta      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists de_anomalias_abiertas_idx on de_anomalias (created_at desc) where not resuelta;

-- ── 11 · TOMA DE TRABAJO CON CANDADO ────────────────────────────────────────
-- Tres cosas en una transacción, por orden:
--   1. libera las acciones cuyo worker murió (lease vencido) — N14;
--   2. promueve a 'lista' las que esperaban una dependencia ya terminada;
--   3. toma hasta N con FOR UPDATE SKIP LOCKED, para que dos workers
--      simultáneos jamás ejecuten la misma acción.
create or replace function de_tomar_acciones(n int default 5, lease_seg int default 600)
returns setof de_acciones
language plpgsql
as $$
begin
  -- 1 · el worker anterior se cayó o el despliegue lo cortó
  update de_acciones
     set estado = 'lista', lease_hasta = null, updated_at = now()
   where estado = 'corriendo' and lease_hasta is not null and lease_hasta < now();

  -- 2 · dependencias cumplidas
  update de_acciones a
     set estado = 'lista', updated_at = now()
   where a.estado = 'pendiente'
     and (a.depende_de is null
          or exists (select 1 from de_acciones d where d.id = a.depende_de and d.estado = 'terminada'));

  -- 3 · reparte trabajo
  return query
  with tomadas as (
    select id from de_acciones
     where estado = 'lista' and programada_at <= now()
     order by prioridad desc, programada_at asc
     limit greatest(n, 0)
     for update skip locked
  )
  update de_acciones a
     set estado = 'corriendo',
         iniciada_at = now(),
         lease_hasta = now() + make_interval(secs => lease_seg),
         intentos = a.intentos + 1,
         updated_at = now()
    from tomadas t
   where a.id = t.id
  returning a.*;
end;
$$;

-- ── 12 · RLS ────────────────────────────────────────────────────────────────
-- Como el resto del CRM: encendida y sin políticas. Todo el acceso es desde el
-- servidor con la llave de servicio (que la salta); nada queda expuesto al
-- navegador ni al rol anónimo.
do $$
declare t text;
begin
  foreach t in array array[
    'de_config','de_politicas','de_conectores','de_acciones','de_ciclos',
    'de_taxonomia','de_icp','de_pesos','de_memoria','de_salud','de_anomalias'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
