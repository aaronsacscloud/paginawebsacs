-- ═══ Campos personalizados del CRM (E1) ═══
--
-- Información INTERNA de gestión: no se le pide al cliente en ningún formulario
-- público, la captura el equipo para entender y atender mejor la cuenta. Por eso
-- `solo_interno` nace en true: si algún día se expone un campo hacia afuera,
-- tiene que ser una decisión explícita y no un descuido.
--
-- DÓNDE VIVEN LOS VALORES: en `companies.propiedades` (jsonb), no en una tabla
-- llave-valor. Con cientos de clientes es más rápido, se lee de un solo query
-- junto al cliente, y evita que un listado con cinco campos personalizados se
-- convierta en cinco JOINs. La DEFINICIÓN sí va en tabla propia: es lo que se
-- administra desde Configuración.
--
-- Lo que se copia de los grandes:
--   · HubSpot → tipo + GRUPO + descripción obligatoria; sin eso, en un año hay
--     200 campos y ninguno reportable.
--   · Pipedrive → dos niveles: `obligatorio` (no guarda sin él) e `importante`
--     (no bloquea, solo marca que falta). Demasiados obligatorios hacen que se
--     capture basura con tal de poder guardar.
--   · `key` inmutable aparte de la etiqueta: renombrar "Giro" no puede romper
--     las vistas guardadas ni los datos ya capturados.

create table if not exists crm_propiedades (
  id           uuid primary key default gen_random_uuid(),
  entidad      text not null default 'company' check (entidad in ('company','deal','subscription','contact')),
  key          text not null,
  etiqueta     text not null,
  tipo         text not null check (tipo in ('texto','texto_largo','numero','moneda','porcentaje','fecha','booleano','select','multiselect','email','telefono','url')),
  grupo        text,
  descripcion  text,
  opciones     jsonb,          -- [{ v, l }] para select / multiselect
  -- Dependencia entre campos: subgiro depende de giro. Sin esto, el subgiro
  -- sería una lista de 60 opciones donde 55 no aplican.
  depende_de   text,
  opciones_por_padre jsonb,    -- { "<valor del padre>": [{ v, l }] }
  obligatorio  boolean not null default false,
  importante   boolean not null default false,
  solo_interno boolean not null default true,
  orden        int not null default 100,
  archivada_at timestamptz,    -- archivar, NUNCA borrar: el dato capturado se queda
  created_at   timestamptz not null default now()
);
create unique index if not exists crm_propiedades_key_idx on crm_propiedades (entidad, key);
create index if not exists crm_propiedades_activas_idx on crm_propiedades (entidad, orden) where archivada_at is null;
alter table crm_propiedades enable row level security;

alter table companies add column if not exists propiedades jsonb not null default '{}'::jsonb;
create index if not exists companies_propiedades_gin on companies using gin (propiedades);

-- ── Los 5 campos reales ──
insert into crm_propiedades (entidad, key, etiqueta, tipo, grupo, descripcion, opciones, depende_de, opciones_por_padre, orden) values
('company', 'numero_colaboradores', 'Número de colaboradores', 'numero', 'Perfil del negocio',
 'Cuánta gente trabaja en el negocio. Ordena el tamaño real de la cuenta mejor que el número de sucursales.',
 null, null, null, 10),

('company', 'tipo_acompanamiento', 'Tipo de acompañamiento', 'select', 'Gestión de la cuenta',
 'Qué nivel de atención se acordó con este cliente. Define qué esperar de nosotros y qué no.',
 '[{"v":"autogestion","l":"Autogestión"},{"v":"basico","l":"Acompañamiento básico"},{"v":"cercano","l":"Acompañamiento cercano"},{"v":"premium","l":"Premium / dedicado"},{"v":"implementacion","l":"Implementación asistida"},{"v":"via_partner","l":"Lo atiende un socio"}]',
 null, null, 20),

('company', 'giro_negocio', 'Giro de negocio', 'select', 'Perfil del negocio',
 'A qué se dedica. Sustituye al campo de texto libre, que tenía "moda", "Moda" y "Moda y ropa" como si fueran tres giros distintos.',
 '[{"v":"moda","l":"Moda y ropa"},{"v":"calzado","l":"Calzado"},{"v":"accesorios","l":"Accesorios"},{"v":"joyeria","l":"Joyería"},{"v":"alimentos","l":"Alimentos y bebidas"},{"v":"cosmeticos","l":"Cosméticos y belleza"},{"v":"deportes","l":"Deportes"},{"v":"papeleria","l":"Papelería"},{"v":"ferreteria","l":"Ferretería"},{"v":"mascotas","l":"Mascotas"},{"v":"hogar","l":"Hogar y decoración"},{"v":"tecnologia","l":"Tecnología"},{"v":"servicios","l":"Servicios"},{"v":"otro","l":"Otro"}]',
 null, null, 30),

('company', 'subgiro', 'Subgiro', 'select', 'Perfil del negocio',
 'El detalle dentro del giro. Las opciones cambian según el giro elegido.',
 '[]', 'giro_negocio',
 '{"moda":[{"v":"boutique","l":"Boutique"},{"v":"infantil","l":"Ropa infantil"},{"v":"novias","l":"Novias y eventos"},{"v":"deportiva","l":"Ropa deportiva"},{"v":"uniformes","l":"Uniformes"},{"v":"lenceria","l":"Lencería"}],
   "calzado":[{"v":"dama","l":"Dama"},{"v":"caballero","l":"Caballero"},{"v":"infantil","l":"Infantil"},{"v":"deportivo","l":"Deportivo"}],
   "joyeria":[{"v":"oro","l":"Oro"},{"v":"plata","l":"Plata"},{"v":"fantasia","l":"Fantasía"},{"v":"relojeria","l":"Relojería"}],
   "alimentos":[{"v":"abarrotes","l":"Abarrotes"},{"v":"restaurante","l":"Restaurante"},{"v":"cafeteria","l":"Cafetería"},{"v":"panaderia","l":"Panadería"},{"v":"carniceria","l":"Carnicería"},{"v":"vinos","l":"Vinos y licores"}],
   "cosmeticos":[{"v":"perfumeria","l":"Perfumería"},{"v":"skincare","l":"Cuidado de la piel"},{"v":"salon","l":"Salón / estética"}],
   "deportes":[{"v":"articulos","l":"Artículos deportivos"},{"v":"suplementos","l":"Suplementos"},{"v":"bicicletas","l":"Bicicletas"}],
   "mascotas":[{"v":"tienda","l":"Tienda"},{"v":"veterinaria","l":"Veterinaria"},{"v":"estetica","l":"Estética canina"}],
   "hogar":[{"v":"muebles","l":"Muebles"},{"v":"decoracion","l":"Decoración"},{"v":"blancos","l":"Blancos"}],
   "tecnologia":[{"v":"celulares","l":"Celulares y accesorios"},{"v":"computo","l":"Cómputo"},{"v":"servicio","l":"Servicio técnico"}],
   "servicios":[{"v":"taller","l":"Taller"},{"v":"consultoria","l":"Consultoría"},{"v":"educacion","l":"Educación"}]}',
 40),

('company', 'origen_cuenta', 'Origen de la cuenta', 'select', 'Gestión de la cuenta',
 'De dónde salió este cliente. Es lo que después dice qué canal trae los clientes que se quedan.',
 '[{"v":"referido_cliente","l":"Referido de otro cliente"},{"v":"partner","l":"Socio / partner"},{"v":"redes","l":"Redes sociales"},{"v":"google","l":"Búsqueda en Google"},{"v":"evento","l":"Evento o feria"},{"v":"prospeccion","l":"Prospección directa"},{"v":"recompra","l":"Reactivación / recompra"},{"v":"otro","l":"Otro"}]',
 null, null, 50)
on conflict (entidad, key) do nothing;

-- ── Migrar el giro viejo (texto libre y sucio) al campo nuevo ──
-- 155 clientes lo tienen vacío y el resto está escrito de seis formas distintas.
-- Lo que no empata con ninguna opción se deja SIN migrar a propósito: inventar
-- una clasificación es peor que no tenerla — se corrige a mano y ya.
update companies set propiedades = coalesce(propiedades, '{}'::jsonb) || jsonb_build_object('giro_negocio',
  case
    when lower(btrim(giro)) in ('moda','ropa','moda y ropa') then 'moda'
    when lower(btrim(giro)) = 'calzado'    then 'calzado'
    when lower(btrim(giro)) = 'accesorios' then 'accesorios'
    when lower(btrim(giro)) = 'alimentos'  then 'alimentos'
    when lower(btrim(giro)) in ('cosmeticos','cosméticos') then 'cosmeticos'
    when lower(btrim(giro)) = 'deportes'   then 'deportes'
    when lower(btrim(giro)) in ('tech','tecnologia','tecnología') then 'tecnologia'
    when lower(btrim(giro)) = 'otro'       then 'otro'
  end)
where giro is not null and btrim(giro) <> ''
  and lower(btrim(giro)) in ('moda','ropa','moda y ropa','calzado','accesorios','alimentos','cosmeticos','cosméticos','deportes','tech','tecnologia','tecnología','otro');
