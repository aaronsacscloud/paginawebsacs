-- LLAMADAS INTELIGENTES · poder armar la lista con los filtros de verdad.
--
-- PEDIDO DEL DUEÑO (21-sep-2026): «al crear la llamada inteligente debes darme
-- más opciones de filtros: que pueda seleccionar un giro de las ABM y llamarle
-- a las que ya están verificadas que sí tienen WhatsApp, o las que tienen
-- teléfono sin WhatsApp, o ambas; que pueda seleccionar por sucursales, que de
-- forma general pueda decidir más de X sucursales; que pueda seleccionar uno o
-- varios giros, sea de ABM o de leads normales; que pueda excluir los que he
-- llamado más de X veces y nunca han contestado».
--
-- EL PROBLEMA DE DATOS QUE HAY DEBAJO. Un teléfono del ABM no vive en la
-- cuenta: vive en `abm_canales`, una fila por canal y varias por cuenta —hay
-- 34,670 teléfonos para 30,200 cuentas, más 2,958 WhatsApp de tienda—. Y el
-- WhatsApp «verificado» no es una columna: es `verificado_at` de SU fila. Sin
-- aplanar eso, cada filtro de la pantalla sería un recorrido de dos tablas en
-- el navegador sobre treinta mil cuentas.
--
-- Estas dos vistas son ese aplanado. No guardan nada nuevo: leen lo que ya
-- está, y por eso no se pueden desincronizar.

-- ── 1 · A QUIÉN DEL ABM SE LE PUEDE LLAMAR, Y CÓMO ──────────────────────────
-- Una fila por cuenta, con SU mejor teléfono y SU mejor WhatsApp.
-- «Mejor» = el declarado y no inválido; entre varios, el verificado primero.
create or replace view v_abm_llamables as
select
  c.id, c.nombre, c.giro, c.subgiro, c.ciudad, c.estado_geo, c.pais,
  c.sucursales, c.google_rating, c.google_resenas, c.puntaje, c.etapa,
  c.ya_es_cliente, c.ultimo_toque_at, c.responsable_id, c.sitio, c.instagram,
  c.ruta, c.tamano, c.abierto,
  tel.valor  as telefono,
  wa.valor   as whatsapp,
  (wa.valor is not null)          as tiene_wa,
  (wa.verificado_at is not null)  as wa_verificado,
  -- El teléfono con el que se va a marcar: el fijo si lo hay, si no el WhatsApp.
  coalesce(tel.valor, wa.valor)   as marcar,
  -- ⚠️ `ya_es_cliente` es TEXTO ('sí' o nulo), no booleano. Preguntarle
  -- `is true` desde PostgREST devuelve «argument of IS TRUE must be type
  -- boolean, not type text» y tumba la consulta entera con un 500 — pasó el
  -- primer día. Se expone ya convertido para que nadie más tropiece.
  (c.ya_es_cliente is not null)   as es_cliente
from abm_cuentas c
left join lateral (
  select k.valor from abm_canales k
  where k.cuenta_id = c.id and k.tipo = 'telefono'
    and coalesce(k.estado, '') <> 'invalido' and k.valor is not null
  order by k.created_at limit 1
) tel on true
left join lateral (
  select k.valor, k.verificado_at from abm_canales k
  where k.cuenta_id = c.id and k.tipo = 'whatsapp_tienda'
    and coalesce(k.estado, '') not in ('invalido', 'no_declarado') and k.valor is not null
  order by (k.verificado_at is not null) desc, k.created_at limit 1
) wa on true
where coalesce(tel.valor, wa.valor) is not null
  -- `no_contactar` no es un filtro que se pueda desactivar desde la pantalla.
  -- La lista de bloqueo guarda VALORES (un correo, un número), no cuentas: se
  -- compara contra el teléfono y contra el WhatsApp de la fila.
  and coalesce(c.etapa, '') <> 'no_contactar'
  and not exists (
    select 1 from abm_no_contactar n
    where n.valor is not null and n.valor in (tel.valor, wa.valor)
  );

comment on view v_abm_llamables is
  'Cuentas del ABM con un teléfono al que marcar, aplanado desde abm_canales. Excluye no_contactar.';

-- ── 2 · CUÁNTAS VECES SE LE HA MARCADO A UN TELÉFONO, Y SI ALGUNA CONTESTÓ ──
-- Por TELÉFONO y no por contacto a propósito: una cuenta del ABM no tiene
-- `contact_id`, así que `v_llamadas_contacto` no la ve. El número es lo único
-- que comparten las dos fuentes.
create or replace view v_tel_intentos as
select
  telefono,
  count(*)                                             as intentos,
  count(*) filter (where en_linea_at is not null)      as contestadas,
  max(marcado_at)                                      as ultimo_intento
from tel_sesion_items
where telefono is not null and telefono <> '' and marcado_at is not null
group by telefono;

comment on view v_tel_intentos is
  'Intentos de llamada por número. Es lo que permite «excluir a los que ya llamé N veces y nunca contestaron», que es la regla que evita quemar una lista.';

-- Comprobaciones.
select
  (select count(*) from v_abm_llamables)                                   as abm_llamables,
  (select count(*) from v_abm_llamables where tiene_wa)                    as con_whatsapp,
  (select count(*) from v_abm_llamables where wa_verificado)               as wa_verificado,
  (select count(*) from v_abm_llamables where not tiene_wa)                as solo_telefono,
  (select count(*) from v_tel_intentos where contestadas = 0 and intentos >= 2) as quemados_2;

-- ── 3 · EL CATÁLOGO DE GIROS Y ESTADOS, CONTADO EN LA BASE ──────────────────
-- Por qué una vista y no un `select giro` desde el endpoint: PostgREST corta
-- en 1000 filas SIN avisar (la lección ya pagada del motor de demanda). La
-- primera versión de esta pantalla contaba sobre esas 1000 y decía «marcas
-- (212)» cuando hay miles: un número que miente en el sitio exacto donde se
-- decide a quién llamar.
create or replace view v_abm_giros as
select giro, count(*) as n, count(*) filter (where tiene_wa) as con_wa
from v_abm_llamables where giro is not null and giro <> ''
group by giro order by n desc;

create or replace view v_abm_estados as
select estado_geo as estado, count(*) as n
from v_abm_llamables where estado_geo is not null and estado_geo <> ''
group by estado_geo order by n desc;

grant select on v_abm_giros, v_abm_estados to anon, authenticated, service_role;
notify pgrst, 'reload schema';

select (select count(*) from v_abm_giros) as giros, (select count(*) from v_abm_estados) as estados,
       (select sum(n) from v_abm_giros) as cuentas_con_giro;
