# Prospección en frío para Sacscloud: el proceso

Documento vivo. Aquí se escribe cómo llenamos, limpiamos y trabajamos las
**Cuentas objetivo** del CRM (motor Account-Based, tablas `abm_*`), y cómo
les vamos a escribir. Cada vez que una corrida enseñe algo, se anota en la
bitácora del final y se corrige el paso correspondiente: el objetivo es que
la siguiente réplica (otro giro, otro país, otra vertical) arranque desde lo
aprendido y no desde cero.

Las herramientas viven junto a este archivo, en `barrido/`. Se corren desde
esa carpeta.

---

## 0. Qué es y qué no es

- Un **prospecto** es un negocio de moda con el que nadie de Sacscloud ha
  hablado. Vive en `abm_cuentas`. **Nunca** entra a `companies` ni a
  `subscriptions`: eso es el ARR y dejaría de significar algo.
- Cada dato guarda su **procedencia** en `abm_fuentes` (url, método,
  confianza, quién lo cargó). Si no sabemos de dónde salió, no vale.
- **Investigado ≠ confirmado.** Un teléfono de Maps es el del mostrador; un
  correo de gmail nunca es confianza alta; un WhatsApp sin probar dice
  «sin confirmar» en la ficha.
- **Nada sale sin aprobación humana**, y una respuesta del prospecto
  cancela la cadencia.

## 1. El mapa del proceso

```
 giro nuevo
   │
   ▼
 [1] definir el giro        giros_config.py   (stems, categorías, filtros de nombre, subgiro)
   │
   ▼
 [2] barrer Google Maps     cola.py → barrido.sh (4 workers × maps.js)   ≈ 10 s por consulta
   │
   ▼
 [3] limpiar y agrupar      giro-carga.py prep <giro>  → <giro>-fusion.json + sqlout/*-cuentas-*.sql
   │
   ▼
 [4] revisar a ojo          revisar.py <giro>  → ajustar filtros → volver a [3]
   │
   ▼
 [5] cargar                 cargar.sh <giro>   (cuentas → canales + fuentes → conteo)
   │
   ▼
 [6] enriquecer             correo, dueño, señales (crons abm-enriquecer / vigilante, cola de llamadas)
   │
   ▼
 [7] verificar correos      ZeroBounce (abm-verificar-correos)
   │
   ▼
 [8] cadencia               7 correos (días 1·3·7·11·16·22·30) por ruta demo/diagnóstico + WhatsApp + llamada
   │
   ▼
 [9] respuesta → reunión → cotización (ya es el CRM normal)
```

Estado al 9-sep-2026: [1]–[5] hechos para 19 giros → **20,288 cuentas, 24
giros, 26,764 canales, 44,418 fuentes**. Casi todo es teléfono (22,088);
con correo hay ~1,300 cuentas. [6]–[8] están construidos pero el cartero
sigue **pausado** (`abm_config.pausado = 'si'`).

---

## 2. Definir el giro (`barrido/giros_config.py`)

Cada giro es una entrada del diccionario `GIROS`:

| llave | qué es | ejemplo (trajes de baño) |
|---|---|---|
| `stems` | frases que se buscan en Maps, una por ciudad | `'tienda de trajes de baño'`, `'trajes de baño'` |
| `cat_ok` | categorías de Maps que SÍ son el giro | `tienda de trajes de baño`, `tienda de artículos de natación`, `tienda de lencería`… |
| `cat_fuera` | categorías que descartan de plano | `alberca`, `escuela de natación`, `centro comercial`, `hotel` |
| `nombre_fuera` | regex: nombres que descartan (marcas, cadenas, lo que no es tienda) | `speedo\|women.{0,3}secret\|yamamay\|^ba[nñ]os\b\|sanitari…` |
| `nombre_ok` | regex: palabras del ramo en el nombre | `ba[nñ]o\|bikini\|swim\|beach\|playa\|pareo…` |
| `nombre_ok_obligatorio` | si `True`, nombre+categoría DEBEN tocar `nombre_ok` (giros sucios) | `True` |
| `subgiro` | `_sub([(regex, subgiro)…], default)` | bikinis / lencería y baño / ropa de playa |

**Cómo decidir los filtros.** Se escribe una primera versión razonable, se
barre, y se ajusta MIRANDO la muestra (paso 4). No hay filtro que salga bien
a la primera; el ciclo prep → revisar → ajustar → prep dura minutos porque
no vuelve a raspar nada.

Reglas aprendidas:
- **Las cadenas y marcas van a `nombre_fuera`** (Levi's, Optima, Zara,
  Speedo…). Ellas no compran un sistema de tienda por Maps; llenan la lista
  con 20 sucursales del mismo nombre.
- **Las cadenas MEXICANAS chicas se quedan** (Bari Swimwear, Aquazone, The
  Swim Store, Eleczion): son exactamente el cliente con dolor de inventario
  entre sucursales.
- **Los giros sucios llevan `nombre_ok_obligatorio`**: jeans, trajes de
  baño, disfraces, sublimado. Sin eso Maps regresa «tienda de ropa» de
  cualquier cosa.
- **Categoría no siempre es la que uno espera.** Google pone casi toda
  tienda de trajes de baño como «Tienda de artículos de natación»; tenerla
  en `cat_fuera` tiró 1,157 filas. Ver la tabla de «fuera por filtro» que
  imprime `prep` ANTES de dar por bueno un giro: si una sola categoría se
  lleva cientos, hay que abrirla y separar por nombre.
- Un nombre genérico (`^tienda de jeans$`, `^trajes de baño$`) se descarta:
  no se puede llamar y decir «¿hablo con Trajes de baño?».
- Hay una lista global (`NOMBRE_FUERA` en `giro-carga.py`) con
  departamentales, plazas, marketplaces, casas de empeño, joyería de lujo,
  etc. Lo que aplica a todos va ahí, no en cada giro.

## 3. Barrer Google Maps (`cola.py`, `barrido.sh`, `worker.sh`, `maps.js`)

```bash
cd docs/prospeccion/barrido
python3 cola.py jeans trajesbano > cola.tsv        # stems × 92 ciudades (ciudades.txt)
systemd-run --user --scope -p MemoryMax=4G --unit=barrido-<nombre> nice -n 10 bash barrido.sh
ls pool-jeans | wc -l                               # avance: archivos = consultas hechas
```

- `ciudades.txt`: 92 ciudades (todas las capitales + las ciudades grandes de
  cada estado + zona metropolitana de CDMX/GDL/MTY). Para otro país se
  cambia el archivo y el mapa `CIU` de `giro-carga.py`.
- `maps.js` abre Maps con Playwright (`hl=es&gl=MX`), hace 4 scrolls del
  panel y saca por resultado: nombre, rating, reseñas, url de Maps, sitio,
  teléfono y el texto de la tarjeta (de ahí sale la categoría).
- `worker.sh w n` toma las líneas `i % n == w` de `cola.tsv` y escribe
  `pool-<giro>/<md5 de la consulta>.json`. **Si el archivo ya existe no
  vuelve a raspar**: se puede matar y relanzar sin perder nada.
- 4 workers en paralelo, 3,772 consultas en ~6 h. `MemoryMax=4G` y `nice`
  porque Chromium × 4 tumbó sesiones cuando el servidor tenía swap chica.
- Al terminar escribe `barrido-fin.txt`.

## 4. Limpiar y agrupar (`giro-carga.py prep <giro>`)

Lo que hace, en orden:

1. Lee todos los json del pool. Descarta por `cat_fuera`, por `cat_ok`
   (si no toca ni la categoría ni `nombre_ok`), por `nombre_ok_obligatorio`
   y por `nombre_fuera` (global + del giro). Imprime **«fuera por filtro»**
   con las 8 razones más frecuentes: esa tabla es el termómetro.
2. **Sin teléfono se ELIMINA.** No hay manera de trabajar una cuenta sin
   canal, y correo casi nunca viene de Maps.
3. Normaliza el teléfono a `+52 XX XXXX XXXX` y deduplica por nombre+tel.
4. **Agrupa sucursales**: mismo dominio, o misma marca distintiva (nombre
   sin genéricos del ramo: `GENERICOS` en `giro-carga.py`), o misma
   marca+ciudad. De ahí sale `sucursales`, `ciudades` y la lista de
   sucursales con su teléfono cada una.
5. Cruza contra `abm_cuentas` por `(lower(nombre), ciudad)` → «ya en la
   base» vs «nuevas a cargar». Una tienda de mezclilla que ya estaba en
   boutiques NO se vuelve a cargar como jeans.
6. Calcula `tamano` (micro <2 suc · chica 2–4 · mediana 5–14 · grande 15+),
   `ruta` (`diagnostico` si ≥5 sucursales, si no `demo`), `subgiro`,
   `puntaje` (encaje por sucursales + dolor si rating <4.5 con ≥3 tiendas;
   la accesibilidad NO suma) y una `nota` con reseñas, sucursales y la
   consulta que lo encontró.
7. Escribe `<giro>-fusion.json` y `sqlout/<giro>-cuentas-NN.sql` (150 por
   archivo, `on conflict (lower(nombre), coalesce(ciudad,'')) do nothing`).

## 5. Revisar a ojo (`revisar.py <giro>`)

Imprime 45 nuevas al azar y las 25 con más sucursales. Se lee la lista
completa buscando tres cosas:

- **Marcas y cadenas que se colaron** → `nombre_fuera` del giro.
- **Negocios de otro ramo** con nombre engañoso («Baños Río» era de
  sanitarios) → `nombre_fuera` o quitar la palabra de `nombre_ok`.
- **Muchas sucursales del mismo nombre en muchas ciudades** → casi siempre
  cadena/franquicia extranjera; si es mexicana chica se queda.

Se ajusta `giros_config.py`, se corre `prep` otra vez, se vuelve a mirar.
Dos o tres vueltas por giro es lo normal.

## 6. Cargar (`cargar.sh <giro>`)

```bash
./cargar.sh trajesbano
```

Borra los `sqlout` viejos del giro (una carga con SQL rancio metió 104
filas de charro con el filtro flojo), corre `prep`, **verifica que
`giros_config.py` compile** (un `sed` rompió comillas dos veces), carga
cuentas, genera hijos con los ids reales (`giro-carga.py hijos`), carga
canales + fuentes y cierra con el conteo `cuentas / tels / fuentes`.

- Canales: un `telefono` por sucursal, `confianza='alta'`,
  `estado='sin_probar'`, `es_de_la_tienda=true`. El índice único
  `abm_canales_unico (cuenta_id, tipo, lower(valor))` evita duplicados y el
  cargador pone `on conflict do nothing`.
- Fuentes: teléfono (url de Maps), `google_rating`, y si hay sitio, lo que
  se sacó del sitio. `agente = 'carga <giro> <año-mes>'`: con eso se puede
  deshacer una carga completa si salió mal.
- Después de cargar: `select count(*) from abm_cuentas c where not exists
  (select 1 from abm_canales k where k.cuenta_id=c.id)` debe dar 0 para el
  giro.

**Si una carga salió mal**: se borran los hijos por `agente`, y las cuentas
por `giro` + `created_at` de esa corrida sin hijos. No se toca lo que ya
tenía etapa distinta de `sin_tocar`.

## 7. Enriquecer: de teléfono a correo y a dueño

Del barrido sale teléfono, no correo. El correo (y el celular del dueño)
se consigue después, por tres vías, en este orden de rendimiento:

1. **Cola de llamadas** (`/api/crm/abm/cola?giro=`): las cuentas sin correo
   ordenadas por puntaje, con guion por giro. La llamada NO vende: pregunta
   `cómo llevan <lo que duele en ese giro>`, con quién platicar y su correo.
   Cada giro tiene su gancho en `cola.ts` (`guion()`).
2. **Sitio / aviso de privacidad / Facebook Info**: el bloque de
   «responsable de datos personales» trae nombre y correo de quien manda;
   la pestaña Información de Facebook leída como texto trae celulares. Es
   lo que hizo `giro-sitios.py` para boutiques (lee `web` del pool).
   `abm-enriquecer` lo hace en cron cuando hay `GOOGLE_PLACES_API_KEY` e
   `INEGI_DENUE_TOKEN`.
3. **Nunca adivinar patrones** (`nombre@dominio`): un rebote duro cuesta el
   dominio de envío.

Canales que se guardan: `email_generico` (contacto@, ventas@ — confianza
media, se usa), `email_direccion` (persona), `whatsapp_tienda`,
`whatsapp_dueno`, `dm_ig`, `dm_fb`. La ficha muestra WhatsApp «sin
confirmar» cuando cae al teléfono.

## 8. Verificar correos (ZeroBounce)

`/api/cron/abm-verificar-correos?cuantas=&giro=` (con `CRON_SECRET`), NO
está en `vercel.json`: cuesta créditos (~US$0.008 c/u), se corre a mano
desde el dev server contra prod. Mapa: valid → válido; role_based →
válido con confianza media (es el buzón del mostrador, no se descarta);
invalid/spamtrap/abuse → inválido; catch-all/unknown → sigue `sin_probar`
con confianza baja. Solo lo `valido` entra a cadencia.

## 9. Cómo vamos a mandar los correos

### 9.1 La cadencia

- Por giro hay **dos cadencias**: `demo` (negocio de 1–4 tiendas: le
  enseñamos el sistema) y `diagnostico` (5+ tiendas: le ofrecemos medir
  su dinero parado antes de hablar de sistema). La ruta la asigna la carga.
- Cada cadencia son **7 correos en los días 1 · 3 · 7 · 11 · 16 · 22 · 30**
  (`abm_pasos`), escritos por giro en `abm_plantillas` (14 correos + 3
  WhatsApp por giro; respaldados en `migraciones/*abm-plantillas*.sql` y
  `*cadencias*`). Los correos 1–3 van **sin pixel ni enlaces envueltos**:
  texto de una persona.
- **Giros sin plantillas hoy: jeans y trajesbano** (los 22 restantes las
  tienen). Antes de meterlos a cadencia hay que redactarlas siguiendo el
  patrón de los demás: correo 1 = lo que duele en su ramo + una pregunta;
  correos 2–5 = un caso, el método en una hoja, la objeción «no le paso mi
  base»; 6–7 = cierre corto.
- La IA (Sonnet) solo **pule** la plantilla ya rellenada con los datos de la
  cuenta (nombre, ciudad, sucursales, la queja de Google si la hay —se
  ALUDE, nunca se cita); si falla, sale la plantilla tal cual.
- Lo que se manda queda en `abm_toques` (`borrador → aprobado → enviado`);
  hoy hay 28 borradores esperando aprobación.

### 9.2 El cartero (`/api/cron/abm-cadencias`, 10 y 13 h CDMX, L–V)

Cuatro frenos, en orden. Se niega, no falla en silencio:

1. **Pausa manual** desde la base: `abm_config.pausado='si'` (así está
   hoy). Tampoco manda si falta `abm_config.tenant_slug` (hoy falta) o
   `EMAIL_REPLY_DOMAIN`.
2. **Rampa de calentamiento**: cupo diario que empieza en 15
   (`cupo_inicial`) y sube ~30% cada tres **días con envíos reales** (no de
   calendario) hasta 120 (`tope_diario`). Un dominio nuevo que manda 300 el
   primer día va a spam.
3. **Uno por negocio al día** (`tope_por_cuenta_dia=1`); un buzón = una
   cadencia; nunca dos correos a la misma cuenta el mismo día.
4. **Disyuntor**: 1 queja de spam o 5% de rebotes en el día → pausa `auto`
   que se levanta sola al día siguiente.

Se manda por el **mismo pipeline que las campañas** (`categoria: 'abm'`),
no por `sendEmail`: es el que pone la liga de baja, `List-Unsubscribe`, el
`Reply-To` con el id del envío (para que la respuesta vuelva y frene la
cadencia) y la medición. La categoría `abm` se salta la regla de «no a
buzones de rol» (contacto@ es el 48% de la base) y la presión semanal.

### 9.3 Qué pasa después de mandar

- **Respuesta** (`inbound.ts`): cancela la cadencia por `send_id` o por
  dirección; la cuenta pasa a `respondio` y aparece en Mi día.
- **Ritmo** (`/api/cron/abm-ritmo`): 3 aperturas sin contestar → se
  detiene el correo y la cuenta sube a la **cola de llamadas** con guion de
  «le mandé un par de correos…»; 7 correos sin una apertura → `en_pausa`
  90 días («no ahora» no es «no»). Una señal (vacante, reseña mala, feria)
  la despierta antes.
- **Rebote duro** → canal `invalido`, nunca se reintenta.

### 9.4 Orden de encendido (lo que falta del dueño, ver `/encender/`)

1. Dominio de envío dedicado con SPF/DKIM/DMARC y `EMAIL_REPLY_DOMAIN`.
2. `abm_config.tenant_slug`.
3. Créditos de ZeroBounce (~1,300) y verificar lo que tiene correo.
4. Plantillas de jeans y trajes de baño.
5. Aprobar los primeros borradores en la pestaña ABM.
6. `pausado='no'`. Los primeros 3 días son de 15 correos: se leen las
   respuestas y los rebotes antes de dejar correr la rampa.

### 9.5 Por dónde empezar (propuesta)

Con correo verificado hay poco (~1,300 cuentas, la mitad fabricantes y
distribuidores). Para el resto la vía es **llamada primero, correo
después**: se llama, se consigue el correo y el nombre, y esa cuenta entra
a cadencia con `persona` real —que rinde mucho más que contacto@. Orden
sugerido por volumen × dolor: renta, boutiques, joyería, zapaterías,
scrubs; deportiva y sublimado después (menos sucursales por cuenta).

---

## 10. Para replicar a otro giro (checklist)

1. Entrada en `giros_config.py` (stems, cat_ok/cat_fuera, nombre_fuera con
   las marcas del ramo, nombre_ok, subgiro). Agregar los genéricos del ramo
   a `GENERICOS` de `giro-carga.py`.
2. `python3 cola.py <giro> > cola.tsv` y lanzar `barrido.sh` bajo
   `systemd-run` con `MemoryMax`.
3. `prep` → leer «fuera por filtro» → `revisar.py` → ajustar → repetir.
4. `./cargar.sh <giro>`; comprobar cuentas sin canal = 0.
5. Etiqueta del giro en `sitio/src/lib/crm/abm-giros.ts` y gancho de
   llamada en `cola.ts` (`guion()`).
6. Plantillas (14 correos + 3 WhatsApp) en `abm_plantillas` **y** en una
   migración; cadencias demo/diagnóstico en `abm_cadencias`/`abm_pasos`.
7. Actualizar la memoria de Claude y este documento (bitácora).

Para otro **país**: `ciudades.txt`, el mapa `CIU`, `fmt_tel`/`tel10` (lada
y formato), `pais`/`moneda` en `prep`, y `hl`/`gl` de `maps.js`.

---

## 11. Bitácora de mejoras

Se anota la fecha, qué se aprendió y qué se cambió. Lo más nuevo arriba.

- **2026-09-09** · Jeans (619) y trajes de baño (281). Google clasifica
  las tiendas de trajes de baño como «artículos de natación»: se abre la
  categoría y se separa por nombre. `on conflict do nothing` en la carga de
  canales (853 tiendas de mezclilla ya existían en otros giros y el índice
  único tiraba el archivo entero). Etiquetas de giro unificadas en
  `abm-giros.ts`. Herramientas copiadas del scratchpad a
  `docs/prospeccion/barrido/` con rutas relativas y `cola.py`.
- **2026-09-08** · Barrido de 16 giros en un día (3,404 consultas,
  5,013 → 19,388 cuentas). Índice único en `abm_canales` tras hallar 632
  teléfonos repetidos. `cargar.sh` borra `sqlout` viejo y verifica que el
  config compile (dos `sed` rompieron comillas; un `&` en el reemplazo
  insertó el match). 28 cadenas coladas en outlets (Optima, Marshalls,
  T.J. Maxx…) → borradas y a `nombre_fuera`. Supabase subido a Small.
- **2026-09-06/07** · Barrido de renta (3,077). Regla «sin teléfono se
  elimina». Agrupación de sucursales por marca distintiva. WhatsApp cae al
  teléfono con «sin confirmar».
- **2026-09-05** · ZeroBounce integrado; buzones de rol se quedan con
  confianza media. 41 celulares de dueño y 8 correos de persona a mano
  (aviso de privacidad + Facebook Info). Dominios que no reciben correo
  marcados.
- **2026-09-04** · Motor ABM: tablas, cadencias de 7 correos por giro,
  cartero con cuatro frenos, pipeline `categoria: 'abm'`.

### Ideas pendientes (no hechas)

- Segunda pasada de Maps por **colonia** en CDMX/GDL/MTY: el panel corta
  en ~120 resultados por consulta y las metrópolis se quedan cortas.
- Raspar la **ficha** de Maps (no solo el panel) para los que tienen sitio:
  hoy `web` viene vacío en casi todos los pools y el cruce de sitio no corre.
- Marcar automáticamente `cadena` cuando el mismo nombre distintivo aparece
  en 8+ ciudades, en vez de listarlas a mano en `nombre_fuera`.
- Detectar «cerrado permanentemente» desde el texto de la tarjeta.
