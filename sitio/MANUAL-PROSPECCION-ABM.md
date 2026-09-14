# Manual del motor de prospección (ABM)

Cómo se arma, se enriquece y se contacta una lista de prospectos fríos.

Está escrito para **repetirse en otro país**. México fue el primero y todo lo
que sigue está medido ahí; cada regla dice *por qué* existe, porque al cambiar
de país cambian los datos pero casi nunca la razón.

> **Antes de replicar, lee la sección 9 (Europa).** El correo frío B2B es legal
> en México y no lo es igual en la UE. Eso decide si un país entra por correo o
> solo por otro canal.

---

## 0. La premisa: los mejores, no todos

**Esta sección manda sobre el resto del manual.** Si algo de lo que sigue
contradice esto, esto gana.

### La regla

No queremos cientos de miles de cuentas. Queremos **el top 50–100 de cada
giro**, y de esos queremos saberlo todo: correo, sitio, WhatsApp, Instagram,
Facebook.

Una base de 20,000 negocios de los que no se puede contactar a nadie vale menos
que una de 2,000 con los datos completos. Y una dirección que nadie verificó no
es un contacto: es un rebote esperando su turno.

### El filtro de calidad, en orden

1. **Está en Google Maps con calificación.** Un negocio sin ficha o sin reseñas
   no se puede validar, y probablemente tampoco esté vivo.
2. **Calificación de 3.7 estrellas para arriba.** Debajo de eso el problema del
   negocio no es el software.
3. **Con reseñas suficientes** para que la calificación signifique algo. Un 5.0
   con dos reseñas es ruido; se ordena por número de reseñas, no por estrellas.
4. **Top 100 de su giro.** Si un giro no tiene 100 que cumplan, son los que
   haya. No se rellena con cuentas malas para llegar al número.

### La cascada de enriquecimiento, en ESTE orden

**Google Maps es la fuente principal, no el censo.** Maps valida que el negocio
existe, que opera y que la gente lo califica. El censo no dice nada de eso.

```
1. GOOGLE MAPS       calificación · reseñas · TELÉFONO · SITIO WEB
                     ↑ la ficha es la que decide si la cuenta entra
2. SU SITIO WEB      correo · WhatsApp (wa.me) · Instagram · Facebook
3. SUS REDES         correo de contacto, cuando el sitio no lo trae
4. CENSO (DENUE)     SOLO para rellenar huecos de esas cuentas
5. VERIFICACIÓN      MX de cada correo, tipo de línea de cada teléfono
```

> ⚠️ **El censo va al final y a propósito.** Trae miles de direcciones que nadie
> validó: no sabe si el negocio sigue abierto, si alguien lee ese buzón ni si
> el negocio es bueno. Sirve para **completar** una cuenta que Google ya validó.
> Nunca para elegir a quién contactar.

### Lo que Google Maps sí da y lo que no

| Dato | ¿Lo da la API de Places? |
|---|---|
| Calificación y número de reseñas | Sí |
| Texto de las peores reseñas | Sí — y es señal de dolor |
| Teléfono (`nationalPhoneNumber`) | Sí |
| **Sitio web (`websiteUri`)** | **Sí, y venía saliendo gratis** |
| `place_id` | Sí |
| Correo electrónico | **No.** Ver abajo |
| Instagram / Facebook | No directamente |

> 🚫 **El correo NO es un campo de Google My Business.** Ni Places ni la API de
> Business Profile lo devuelven: no es un campo público de la ficha. Cuando se
> ve un correo en una ficha, viene escrito dentro de la descripción o de una
> publicación, y eso sí se puede rascar del texto — pero como texto, no como
> dato. **El correo se saca del SITIO WEB**, que es el paso 2.

> 💡 **Pedir el sitio y el teléfono no cuesta un peso más.** `websiteUri` y
> `nationalPhoneNumber` son tier Enterprise; `reviews`, que ya pedimos, es
> Enterprise + Atmosphere, más caro. Google cobra al tier más alto del request.
> Estuvimos pagando el caro y tirando los otros dos.

> ⚠️ **Guarda SIEMPRE el `place_id`.** El barrido nacional levantó 44,186 datos
> de Maps y **no guardó ni uno**. Sin él, volver a preguntar por una cuenta es
> una búsqueda por nombre y ciudad: más cara, y a veces trae el negocio de
> junto. Es una columna, y no tenerla obliga a pagar dos veces.

### La medida de si vamos bien

No es cuántas cuentas hay. Es **qué porcentaje del top 100 de cada giro se
puede contactar**.

```
Línea base 14-sep-2026, con el filtro de calidad aplicado:

  2,123  cuentas objetivo (top 100 × 24 giros, ≥3.7 estrellas)
    570  alcanzables por correo o WhatsApp     27%
  1,553  sin ninguna vía                       73%

  de esas 1,553:
    1,516  tienen teléfono de Maps (falta saber si es WhatsApp)
      140  tienen sitio sin raspar
       65  solo redes sociales
    1,348  solo el nombre  ← estas necesitan volver a Google
```

**La meta es ese 27% arriba del 80%**, sobre las mismas 2,123. No sobre más.

### Qué NO hacer, por más tentador que se vea

- **Cargar un censo completo** porque trae muchos correos. Ya pasó: el DENUE
  daba 1,181 correos de casas de novia, sin saber cuáles siguen abiertas.
- **Rellenar el top 100 con cuentas de 3.2 estrellas** para llegar al número.
- **Mandar a una dirección sin verificar** porque "seguro sí llega".
- **Medir el avance en cuentas cargadas.** Se mide en cuentas *contactables*.

---

## 1. El modelo: cuenta, canal, cadencia, toque

| Tabla | Qué guarda |
|---|---|
| `abm_cuentas` | El negocio. Una fila por empresa, con su giro, ciudad, señales y puntaje |
| `abm_canales` | Cómo se le llega: correo, WhatsApp, teléfono, DM |
| `abm_personas` | Quién decide, cuando se sabe |
| `abm_senales` | Lo que duele, con fecha y caducidad |
| `abm_fuentes` | **De dónde salió cada dato.** Campo, valor, método, confianza y agente |
| `abm_plantillas` | El guion, por giro × ruta × canal |
| `abm_cadencias` / `abm_pasos` | El calendario: qué correo va en qué día |
| `abm_toques` | Cada mensaje concreto a cada cuenta, con su estado |
| `abm_config` | Cupo, tope, calentamiento, pausa global |

**`abm_fuentes` no es opcional.** Todo dato que entra deja su fila. Cuando un
correo rebota o un número no tiene WhatsApp, lo primero que se pregunta es de
dónde salió; sin esa tabla no hay forma de saber qué método está sucio y hay
que desconfiar de todo por igual.

---

## 2. El orden correcto, y por qué importa

```
0. FILTRAR       los mejores de cada giro → ≥3.7 estrellas, top 100 (§0)
1. UNIVERSO      quiénes existen          → nombre, ciudad, reseñas
2. ENRIQUECER    cómo se les llega        → correo, WhatsApp, sitio
3. GUION         qué se les dice          → plantillas por giro
4. PERSONALIZAR  adaptarlo a cada uno     → IA sobre el expediente
5. ENVIAR        despacio y midiendo      → rampa + disyuntor
6. APRENDER      y hasta entonces, crecer
```

**El paso 6 no es decorativo.** No se generan cadencias para el siguiente lote
antes de haber enviado el primero. Cada cadencia cuesta IA y queda como
borrador que alguien tiene que aprobar; hacer 500 antes de saber si el guion
funciona es pagar dos veces por el mismo aprendizaje.

---

## 3. Fase 1 — El universo

**Barrido de Google Maps por giro y ciudad.** Da volumen y da calidad de
señal: nombre, dirección, calificación, número de reseñas y **el texto de las
peores**, que es lo que más vale — una reseña que dice "no tenían mi talla" es
el dolor que vendemos, dicho por su cliente y con fecha.

**Lo que el barrido NO da: cómo contactarlos.** Medido en México: 21,107
cuentas levantadas, y al principio solo el 9.6% tenía correo. El barrido
levanta *quién es*, no *cómo se le llega*. Presupuestar el enriquecimiento
como una fase aparte, no como un detalle del barrido.

### La trampa del giro

Un negocio se clasifica por lo que el barrido buscó, no por lo que es. En
México, 556 casas de novia quedaron archivadas como `renta` porque también
rentan, y el segmento `novias` parecía tener 73 negocios cuando tenía 629.

**Regla:** antes de dar por chico un segmento, búscalo por NOMBRE en todos los
giros. Si el nombre dice "novia" y está en `renta`, es una casa de novias.

---

## 4. Fase 2 — Enriquecer, en cascada

De más barato y más confiable a menos. Se para en cuanto un dato entra.

### 4.1 El censo oficial del país ← **el CUARTO paso, no el primero**

> Antes esta sección decía «empieza SIEMPRE aquí». **Estaba mal y la premisa
> (§0) manda.** El censo no sabe si un negocio sigue abierto ni si es bueno:
> sirve para COMPLETAR una cuenta que Google Maps ya validó, nunca para elegir
> a quién contactar.

En México es el **DENUE del INEGI**: 5 millones de establecimientos con
`telefono`, `correoelec` y `www`, por clase de actividad. Oficial, gratis y
legal de usar.

**No uses su API.** Tiene token, el token del portal de desarrolladores es de
*otra* API (Banco de Indicadores) y el propio INEGI enlaza mal su página. Los
datos se bajan en bruto y sin registro:

```
https://www.inegi.org.mx/contenidos/masiva/denue/denue_00_<RANGO>_csv.zip
```

`denue_00_46321-46531_csv.zip` — 56 MB, 648,578 establecimientos — cubre ropa
(179,669), calzado (45,379), joyería (17,506) y bisutería. Casi todos nuestros
giros en un archivo.

**Verifica la clase SCIAN, no la supongas.** Di por hecho que novias era
463215 y resultó ser bisutería. La correcta es **463214**, "disfraces,
vestimenta regional y vestidos de novia", 10,169 establecimientos. Se
comprueba filtrando `nombre_act` por la palabra del giro.

Cobertura real de esa clase: teléfono 36%, correo 11%, web 3%.

**Equivalentes a buscar en cada país nuevo** (verificar antes de asumir que
existen y que permiten uso comercial):

| País | Registro | Nota |
|---|---|---|
| México | DENUE (INEGI) | Descarga masiva libre, sin token |
| Colombia | RUES (Confecámaras) | |
| Chile | SII / Registro de Empresas | |
| Perú | SUNAT | |
| España | INE / Registro Mercantil | |
| Resto UE | Registros mercantiles nacionales | El acceso masivo suele ser de pago |

### 4.2 El sitio propio del negocio

Dos pasadas, en este orden:

**a) `fetch` directo.** Baja la portada y `/contacto`, `/pages/contacto`,
`/contact`, `/nosotros`.

> ⚠️ **El tope de descarga tiene que ser de al menos 6 MB.** Con 600 KB perdí
> la mitad de los hallazgos: las páginas de Shopify pesan ~2 MB y el enlace de
> WhatsApp de una tienda estaba en el byte 1,122,790. Subir el tope pasó el
> rendimiento de 6 a 12 sobre las mismas 33 cuentas.

**b) Navegador (Playwright) para las que salieron vacías.** Shopify, Wix y
React inyectan el contacto con JS: el botón flotante de WhatsApp, el pie, el
widget de chat no están en el HTML del servidor. Se leen tres fuentes de la
página ya pintada: los `href`, el texto visible y el JSON incrustado del tema.
Bloquea imágenes y fuentes en la ruta — son el 90% del peso y no traen
teléfonos.

Rinde poco pero es barato: de 21 vacías, 4 dieron contacto.

**Un sitio caído es un dato, no un hueco.** HTTP 000, un 404, o una página de
169 bytes significan que el negocio ya no mantiene su web. Eso es **señal de
dolor** y sube el puntaje. En el barrido de 1,089 cuentas salieron **208
sitios caídos** — casi uno de cada cinco.

### 4.3 Listas del ramo

Padrones de expositores de ferias y cámaras. En México funcionó SAPICA
(calzado) y existen las expos de novias. Son listas públicas de negocios ya
establecidos, con el sesgo correcto: quien paga un stand tiene tamaño.

### 4.4 Lo que NO se hace

**No raspar directorios comerciales de terceros** (Bodas.com.mx, The Knot,
Páginas Amarillas y equivalentes). Tienen los datos, y raspar su directorio
viola sus términos. El censo oficial da lo mismo sin ese riesgo.

---

## 5. Las reglas de verificación

Todas salieron de un error real. Ninguna es teórica.

### 5.1 Correo

1. **MX obligatorio.** Un dominio sin registro MX no recibe correo: es un
   rebote duro garantizado. `mivestido@tiscaeno.mx` iba a salir así (y el
   dominio real era `tiscarenobride.com` — le faltaba una letra). En el cruce
   del DENUE, 4 de 61 correos se cayeron en esta prueba.
2. **Nunca corregir una dirección a mano.** Si el dominio está mal escrito, se
   descarta y se busca la buena. Inventar la versión plausible es cómo se
   junta un rebote.
3. **Lista negra de proveedores.** Fundidoras de tipografía, CDN, hosting,
   analítica, plantillas. `team@latofonts.com` entró como el correo de una
   casa de novias porque se raspó el crédito de tipografía del sitio — y tenía
   MX, o sea que habría entregado.
4. **Prioridad: dominio propio > correo gratuito > cualquier otro.** Un
   dominio ajeno se descarta salvo que no haya nada más.
5. **`webmaster@`, `admin@`, `postmaster@`, `no-reply@` entran con confianza
   baja.** Son direcciones de rol del panel de hosting, no del negocio.

### 5.2 Teléfono y WhatsApp

1. **Formato del país, verosímil.** En México: 52 + 10 dígitos, lada válida.
   Un `wa.me` de 8 dígitos o de otro país es de un plugin, no de la tienda.
2. **Se queda el número MÁS REPETIDO del sitio.** El de la tienda aparece en
   todas las páginas; el del que hizo la web, una sola vez.
3. **Un número que aparece en dos cuentas se usa en una sola.** Es conmutador
   compartido o error de datos; mandar el mismo mensaje dos veces al mismo
   teléfono es la forma más rápida de que reporten la línea.
4. **800 / 900 nunca llevan WhatsApp.** Fuera.

### 5.3 Cruce entre fuentes

Para completar una cuenta que ya existe con datos de otra fuente, en este
orden, parando en el primero que pega:

| Vía | Firmeza | Resultado en novias |
|---|---|---|
| Teléfono exacto (10 dígitos) | Dos fuentes independientes dando el mismo número | 72 |
| Dominio del sitio | Exacta | 19 |
| Nombre normalizado + **mismo municipio** | Solo si el nombre es **único** ahí | 89 |

**Nunca por nombre a secas.** "NOVIAS KARLA" hay en varios estados. Normalizar
quitando acentos, mayúsculas y las palabras de relleno del ramo (`tienda`,
`casa`, `boutique`, `vestidos`, `de`, `la`).

Empataron 180 de 629. **Las 449 que no empataron se quedan sin dato**: es
preferible a meterle a una cuenta el correo del negocio equivocado.

---

## 6. Confianza: observado vs. inferido

Un dato **visto** y un dato **supuesto** no valen lo mismo y no pueden
guardarse igual.

```
confianza  alta    censo oficial, o el propio sitio del negocio
           media   raspado con verificación
           baja    inferido, o dirección de rol

metodo     directorio              censo oficial
           sitio_propio            raspado de su web
           inferido_del_telefono   suposición razonable, NO verificada
```

**Caso concreto:** en este ramo el mostrador contesta por WhatsApp, no por
correo — medido: de 33 casas de novia con sitio, **una** publica correo y el
resto pone `wa.me`.

---

## 6 bis. WhatsApp: SOLO a quien lo publicó él mismo

> **Esta es la regla más estricta del manual y está puesta con candado en la
> base de datos.** Vale para todos los países.

### La regla

**Solo se le manda WhatsApp a un número que el propio negocio publicó como
WhatsApp** — un enlace `wa.me` en su ficha de Google Maps, en su sitio, en su
Instagram. Ese enlace es el negocio diciendo *"escríbeme por WhatsApp aquí"*, y
es el único permiso que aceptamos.

**Todo lo demás se queda como teléfono y se trabaja por llamada.**

### Por qué, con lo medido

Es tentador dar de alta el teléfono de cada cuenta como WhatsApp: en México el
número que publica una tienda muchas veces es el mismo. Se probó y **no
alcanza**:

- De los números **inferidos del teléfono**, la mitad resultó **línea fija**
  (15 de 30 en el segundo lote de novias). Una línea fija no tiene WhatsApp.
- Y aun los que salen móviles **pueden no tenerlo**. No hay forma de
  preguntarlo: Meta quitó a propósito el endpoint `contacts` del API viejo
  —que sí respondía si un número estaba registrado— porque se usaba justo para
  validar listas. **Hoy responde siempre "válido"**, tenga o no tenga. La Cloud
  API nunca lo tuvo.
- Cualquier servicio que ofrezca esa validación está corriendo un cliente **no
  oficial** de WhatsApp. Viola sus términos y el baneo cae en la cuenta que lo
  usa. **No se usa.**

Y el costo de equivocarse no es simétrico: cada mensaje a un número sin
WhatsApp cuenta contra la calificación de calidad de la línea, y escribirle a
un negocio que nunca publicó ese canal es exactamente lo que provoca que
reporten el número. Se pierde la línea de ventas entera por unos cuantos
contactos de más.

> 💡 **Sobre "llamar para ver si timbra":** que un teléfono timbre prueba que la
> **línea existe**, no que tenga WhatsApp — un fijo timbra y no lo tiene. Son
> dos cosas distintas. Twilio Lookup da esa misma información y más (móvil,
> fijo, VoIP, 800) sin marcarle a nadie y sin que el dueño se entere.

### Los estados del canal de WhatsApp

```
declarado      el negocio publicó ese wa.me    → SE LE ESCRIBE
valido         ya se le entregó un mensaje     → SE LE ESCRIBE
no_declarado   nadie lo declaró (inferido,
               o solo "parece celular")        → NO. Se trabaja por llamada
invalido       rebotó, o el número no existe   → NO
opt_out        pidió que no le escribamos      → NO, nunca más
```

### Cómo se hace cumplir

Tres capas, porque una convención no basta:

1. **Al cargar** — un canal de WhatsApp nace `declarado` solo si su fuente es
   un enlace `wa.me`. Cualquier otro origen nace `no_declarado`.
2. **La vista `v_whatsapp_contactable`** es la única puerta para armar listas
   de trabajo. Filtra a `declarado` y `valido`.
3. **Un trigger en `abm_toques`** rechaza la inserción de cualquier toque de
   WhatsApp cuyo destino no sea un número declarado de esa cuenta:

   ```
   ERROR: WhatsApp bloqueado: 525500000000 no es un numero declarado
          por la cuenta. Solo se escribe a quien publico su wa.me.
   ```

   La vista es una convención —basta que alguien escriba otra consulta para
   saltársela—; el trigger es el candado.

### Auditoría, para correr después de cada carga

```sql
-- los tres tienen que dar CERO
select
 (select count(*) from abm_toques t where t.canal='whatsapp'
    and not exists (select 1 from abm_canales x where x.cuenta_id=t.cuenta_id
      and x.tipo like 'whatsapp%' and x.estado in ('declarado','valido')
      and regexp_replace(x.valor,'\D','','g')=regexp_replace(t.destino,'\D','','g')))
   as toques_prohibidos,
 (select count(*) from abm_cuentas c where c.tiene_wa
    and not exists (select 1 from abm_canales x where x.cuenta_id=c.id
      and x.tipo like 'whatsapp%' and x.estado in ('declarado','valido')))
   as bandera_mentirosa,
 (select count(*) from v_whatsapp_contactable v
    where not exists (select 1 from abm_fuentes f where f.cuenta_id=v.cuenta_id
      and f.campo in ('whatsapp','whatsapp_enlace')
      and f.metodo in ('google_maps','sitio_propio')))
   as sin_respaldo;
```

### El valor se guarda en dígitos, nunca como URL

El canal llegó a guardar `https://wa.me/525525301345` junto a `525593027234`.
Eso rompía tres cosas en silencio: el dedupe (el mismo número en dos formas son
dos canales), el cruce con `abm_fuentes` —que guarda `+52 55 2530 1345` con
espacios— y cualquier envío por API. **Se normaliza a dígitos al cargar**, y el
enlace original se guarda en `abm_fuentes` como `whatsapp_enlace`, que además
es la prueba de que fue declarado.

> ⚠️ Al normalizar, **borra primero las filas que van a colisionar** y normaliza
> después. Hay una restricción única `(cuenta_id, tipo, lower(valor))` y
> hacerlo al revés tira la migración entera.

### Twilio Lookup: dónde sigue sirviendo

Ya no decide a quién se le escribe —eso lo decide el `wa.me`—, pero sirve para
**la lista de llamadas**: separa móviles de fijos, detecta números que no
existen, y dice el operador. Un número que Lookup marca inexistente se va a
`invalido` y deja de aparecer en cualquier lista.

Endpoint: `/api/cron/abm-validar-whatsapp?cuantas=&giro=`. Se dispara por cron
o por un operador con su sesión del CRM.

---

### El recuento tiene que mirar el estado

`tiene_email` / `tiene_wa` / `canales_n` son banderas desnormalizadas que
alimentan el puntaje de accesibilidad, los filtros de la pantalla y el orden
de la cola. **Un canal `invalido` o `rebote` no es un canal.** El trigger las
contaba sin mirar el estado, así que dos cuentas con el correo ya invalidado
seguían sumando +12 de accesibilidad y colándose arriba de la cola — y la
pantalla las mostraba como contactables mientras el generador las rechazaba
con 409. La pantalla y el motor tienen que decir lo mismo de la misma cuenta.

---

## 7. Fase 3 — El guion

### 7.1 Estructura

Plantillas por **giro × ruta × canal**. Dos rutas:

- **`demo`** — la mayoría. Cierra pidiendo una demo.
- **`diagnostico`** — cuentas grandes (varias sucursales). No vende demo:
  ofrece quince minutos con los números del prospecto y entrega el resultado
  aunque no compren.

> **El botón tiene que pedir lo mismo que el cuerpo.** Los botones de la ruta
> `diagnostico` se habían copiado de `demo`, así que el correo cerraba con
> "¿Le sacamos el diagnóstico con sus números?" y abajo decía "Ver una demo de
> 20 minutos". Pedir una cosa y ofrecer otra hace dudar justo a quien ya iba a
> dar clic.

### 7.2 El primer correo explica por qué llega

Obligatorio, y es el único con enlaces. Contiene, en este orden:

1. **Por qué le llega.** Con la verdad: los buscamos nosotros.
2. **Lo que encontramos de ellos** — reseñas, sucursales, su plataforma de
   e-commerce. Es lo que prueba que no es un envío automático.
3. **Las funciones específicas del giro**, y que eso es solo una parte.
4. **Dos vías de respuesta:** WhatsApp directo y el botón de agendar.

> 🚫 **JAMÁS escribir que se registró, pidió información o dejó sus datos.** No
> pasó. Se comprobó contra `abm_fuentes` antes de escribir el guion. Además de
> ser mentira, es lo que convierte un correo frío en una queja de spam.

### 7.3 Qué toca la IA y qué no

La IA adapta **el texto** al expediente de la cuenta. **No toca** la imagen, el
botón ni el calendario — esos salen de la plantilla y del paso.

```
correo 1      hasta 200 palabras, el único con enlaces
correo 2+     máximo 90 palabras, sin enlaces
```

Si la IA falla, la cadencia **sale igual** con la plantilla rellenada. Eso es
correcto, pero **tiene que avisar**: el fallo viaja en la respuesta
(`ia_error`), no solo al log. Sin eso, 19 cadencias salieron sin personalizar
y solo se notó al contarlas. La causa era saldo agotado del proveedor de IA, y
se veía igual que cualquier otro fallo.

Dimensiona `max_tokens` para el número de correos: 8 correos no caben en 4000.

### 7.4 Los días salen de los pasos

Nunca de un arreglo escrito en el código. Un `[1,3,7,11,16,22,30]` fijo puso el
octavo correo *antes* que el séptimo en cuanto la cadencia creció.

### 7.5 El diseño vive fuera del cuerpo

El cuerpo del correo es **texto plano**; el HTML lo arma una función aparte
(`abm-correo.ts`). Tres razones:

1. La versión de texto y la HTML tienen que decir lo mismo — la discrepancia la
   puntúan los filtros.
2. La IA reescribe el cuerpo; si trajera HTML lo rompería.
3. Cambiar el diseño ahí cambia los correos ya armados, sin regenerar ni
   volver a pagar IA.

**Técnica de correo, no de página.** Outlook renderiza con el motor de Word:
nada de flex, grid, degradados CSS ni webp. Todo tabla con `bgcolor`, estilos
en línea, JPEG, 600 px, y VML para los botones. Un degradado de marca se hace
con tres celdas sólidas.


### 7.6 El primer mensaje de WhatsApp en frío

Vale para **todos los giros y todos los países**. Un correo frío lo ignoran; un
WhatsApp frío mal escrito lo **reportan**, y eso cuesta la línea.

El guion de novias tuvo que reescribirse entero porque abría con
*"Le escribo a {{nombre}} de parte de Sacs… ¿con quién puedo ver ese tema?"*:
pedía un dato sin haber dicho quiénes somos, de dónde salió su número ni qué
ofrecemos. **Pide antes de dar, y a un desconocido que llega pidiendo se le
reporta.**

Los siete elementos, en este orden:

1. **Quiénes somos**, en una línea y concreto.
2. **De dónde salió su contacto.** La verdad: los encontramos en Google Maps,
   nadie nos pasó nada. Es lo primero que piensa quien recibe el mensaje, y no
   responderlo se siente como base comprada.
3. **Su nombre y algo real de ellos** — ciudad, reseñas. Es la prueba de que no
   es un envío masivo.
4. **Por qué ellos:** estamos buscando a los mejores del ramo y salieron ahí.
   Se siente distinto que ser uno más de una lista.
5. **Qué tenemos que es específico de SU giro**, con dos o tres cosas
   concretas. "Un sistema de inventario" no le mueve a nadie; "apartados con la
   fecha de la boda y el muestrario marcado aparte" sí.
6. **Algo que damos:** la demo gratis por videollamada, sin compromiso.
7. **Una pregunta fácil de contestar.** Nunca *"pásame el correo de tu jefe"*.

Los tres mensajes tienen papeles distintos: **presentar** (los siete de
arriba), **aportar** algo nuevo del giro y repetir la oferta, y **cerrar** sin
culpa, dejando la puerta abierta y una vía de autoservicio.

**Con cuánto se saluda.** Solo el nombre de pila, nunca el apellido: *"Buen
día, Cielo"*, jamás *"Buen día, Cielo Inzunza"* — eso delata una base comprada.
Pero cortar siempre en la primera palabra destroza los compuestos, y a Juan
Carlos nadie le dice Juan. La señal que sirve: en un compuesto **la segunda
palabra también es un nombre de pila** ("Carlos" lo es, "Medina" no), así que
la lista es de segundos elementos, no de apellidos — los apellidos son
infinitos. Ante la duda, una sola palabra: equivocarse acortando es una
familiaridad de más; equivocarse alargando es saludar a un extraño por su
apellido. Va en `src/lib/crm/nombre.ts`, con su prueba.

**Y no basta con la variable.** `{{persona}}` ya cortaba bien, pero el
EXPEDIENTE le entregaba a la IA el nombre completo — y la IA escribe lo que ve.
Salió un correo que abría *"Hola Juan Carlos"*. Al modelo se le pasa ya cortado:
**una regla que puede desobedecer es peor que un dato que no tiene.**

> ⚠️ **El motor de plantillas no tiene negación.** No existe `[[si no var]]`.
> Escribir `[[si persona]]…le[[/si]][[si nombre]]Le[[/si]]` imprime **los dos**
> cuando hay persona — salió *"Cielo Inzunza, leLe escribo"*. Cada condicional
> tiene que ser una frase completa que se pueda borrar entera sin romper la de
> afuera. Se cachó renderizando contra cuentas reales, que es exactamente para
> lo que se hace.

---

### 7.7 Las prácticas del contacto en frío

Qué hace que contesten y qué hace que reporten. Aplica a correo y a WhatsApp,
en cualquier giro y cualquier país. Lo marcado **[medido]** salió de este
motor; lo demás es oficio y se corrige cuando los números digan otra cosa.

#### El principio: la respuesta se gana, no se pide

Nadie le debe una respuesta a un desconocido. Cada mensaje tiene que dejar algo
—una idea útil del giro, un dato de su propio negocio, una oferta concreta—
aunque nunca contesten. Un mensaje que solo pide (*"¿con quién veo este tema?"*,
*"¿me pasa el correo del dueño?"*) es una carga, y a la carga se le reporta.

Regla práctica: **si al borrar la pregunta final el mensaje ya no dice nada,
está mal escrito.**

#### Lo que sí va

1. **Quiénes somos**, en una línea y en concreto.
2. **De dónde salimos.** La verdad, siempre: los buscamos nosotros. Es lo
   primero que piensa quien recibe, y no responderlo se siente como base
   comprada. **[medido]** El correo 1 de novias existe solo para esto.
3. **Algo real de ellos** que se vea investigado: sus reseñas, sus sucursales,
   en qué plataforma tienen la tienda. Es la prueba de que no es un envío
   masivo.
4. **Por qué ellos:** buscábamos a los mejores del ramo y salieron. Se siente
   distinto que ser uno más de una lista.
5. **Lo específico de su giro**, con dos o tres cosas concretas. "Sistema de
   inventario" no le mueve a nadie; "apartados con la fecha de la boda y el
   muestrario marcado aparte" sí.
6. **Algo que damos**: la demo por videollamada, el diagnóstico con sus
   números. Gratis y sin compromiso, dicho así.
7. **Una pregunta fácil**, de sí o no, contestable desde el celular.

#### Lo que nunca va

- **Inventar un registro que no pasó.** Ni "se registró", ni "pidió
  información", ni "dejó sus datos". Además de mentira, es lo que convierte un
  correo frío en una queja.
- **Saludar con apellido.** *"Buen día, Cielo Inzunza"* delata la base de
  datos. Solo el nombre de pila, respetando los compuestos (§7.6).
- **Cifras de resultados inventadas.** Un solo caso real, citado igual siempre.
- **Restregar una reseña mala.** Se alude al problema del giro, nunca se cita
  ni se dice que leímos sus reseñas.
- **Vocabulario de folleto:** "solución integral", "potenciar", "revolucionar",
  "líder en el mercado", "no dude en contactarnos".
- **Pedirle que reenvíe a alguien más** en el primer mensaje.
- **Emoji y signos de admiración** en el asunto.

#### Largo y ritmo

| | Correo 1 | Correo 2+ | WhatsApp 1 | WhatsApp 2-3 |
|---|---|---|---|---|
| Tope | 200 palabras | 90 palabras | ~750 caracteres | ~600 |
| Enlaces | los dos del guion | ninguno | uno, al final | uno |
| Trabajo | explicar por qué llega | avanzar un tema | presentarse y ofrecer | aportar y cerrar |

**Cada mensaje avanza.** Si el 4 se puede leer sin el 3, alguno de los dos
sobra. Repetir lo mismo con otras palabras es lo que cansa y hace que reporten.

**El último no reclama.** Cierra agradeciendo, deja la puerta abierta y una vía
de autoservicio (la liga para agendar solos). Nada de *"último intento"* ni
*"veo que no le interesó"*: eso deja mal sabor en el único mensaje que se lee
completo.

#### Personalización de verdad vs. teatro

Meter `{{nombre}}` no es personalizar: es un combinado de correspondencia con
otro nombre. Personalizar es que **el mensaje no sirva para otro negocio**. Si
cambiando el nombre le queda igual de bien a cualquier tienda del giro, no está
personalizado.

Lo que sí personaliza: la calificación y sus reseñas, el número de sucursales,
la plataforma de su tienda en línea, algo que publicaron, la ciudad y cómo se
trabaja ahí.

**Y el dato se le entrega al modelo ya listo, no como instrucción.** Si el
expediente trae el nombre completo, la IA lo va a escribir por más que la regla
diga lo contrario. **[medido]** Pasó con *"Hola Juan Carlos"*. Una regla que el
modelo puede desobedecer es peor que un dato que no tiene.

#### Cuándo se para

- **Pidió que no le escribamos** → `opt_out`, y no se le vuelve a tocar por
  ningún canal. Sin excepciones y sin "un último correo".
- **Contestó** → la cadencia se detiene. Sigue una persona.
- **Rebotó duro** → canal `invalido`, no se reintenta (§5.1).
- **Se acabó la cadencia sin respuesta** → se deja descansar. Si se retoma, es
  en otra temporada y con otro motivo, no con el mismo guion.

#### Cuándo se manda

Días hábiles y horario de oficina del **huso del prospecto**, no del nuestro.
Nada de lunes a primera hora ni viernes por la tarde. En WhatsApp esto pesa más
que en correo: un mensaje de trabajo a las 9 de la noche molesta de verdad.

#### Qué se mira, y en qué orden

1. **Quejas de spam.** Es lo único que apaga el motor, y con una basta
   **[medido]**. Si aparece una, no se sube el volumen: se revisa el guion.
2. **Rebotes.** Arriba del 5% hay un problema de datos, no de copy.
3. **Respuestas**, separando las buenas de las molestas. Una molesta vale por
   varias neutras como señal.
4. **Aperturas**, al final y con desconfianza: los primeros tres correos van
   sin rastreo a propósito (§8.1), así que el dato está incompleto por diseño.

**No se toca el guion y el volumen a la vez.** Si se mueven los dos, no se sabe
cuál movió el resultado.

#### Antes de encender una cadencia nueva

1. ¿Se renderizó contra **cuentas reales**, no contra una de ejemplo? Ahí
   salieron *"con sus 1 sucursales"*, *"leLe escribo"* y *"Buen día, Cielo
   Inzunza"* — ninguno se veía en la plantilla.
2. ¿El botón pide lo mismo que el cuerpo? (§7.1)
3. ¿El mensaje 1 tiene los siete elementos? (§7.6)
4. ¿Algún mensaje se puede leer sin el anterior?
5. ¿El último cierra sin reclamar?
6. ¿Hay algún dato inventado que no esté en el expediente?

---

## 8. Fase 4 — Enviar

### 8.1 Correo

```
cupo del día = min(tope, cupo_inicial × 1.3^⌊días_con_envíos / 3⌋)
```

Arranca en **15** y sube ~30% cada 3 días hasta **120**. Un dominio nuevo que
manda 500 el primer día va directo a spam.

**El disyuntor corta con UNA queja de spam.** No tres. Gmail corta arriba de
0.3%, que con 120 correos al día es menos de una queja diaria. Rebotes: corta
al 5% del cupo, mínimo 3. La pausa se levanta sola al día siguiente.

**Los primeros 3 correos van sin rastreo** (`sinRastreo` para `orden < 3`): sin
píxel y sin envolver enlaces. El rastreo en un primer contacto frío es
exactamente la señal que buscan los filtros.

**Una queja suprime a nivel de CUENTA, no de campaña.**

### 8.2 WhatsApp

**Solo a los `declarado`.** Ver la sección 6 bis: es la regla más estricta del
manual y está con candado en la base. Un número que nadie declaró no recibe
mensaje, punto — se trabaja por llamada.

Aun dentro de los declarados, se va por tandas y midiendo la calificación de
calidad de la línea entre una y otra.

**Y todo primer contacto es MARKETING**, no hay respaldo utility que abarate el
frío: ver §8.5.

**Desde el 13-sep-2026 el WhatsApp va dentro de la cadencia y lo manda el cron**
(`lib/crm/abm-whatsapp.ts`), no a mano. Lo que hizo falta para que eso fuera
seguro, y que no se quita:

- **Plantilla aprobada por Meta.** Fuera de la ventana de 24 h solo se puede
  abrir conversación con plantilla. Cada plantilla de WhatsApp del ABM tiene su
  nombre en Meta (`abm_plantillas.meta_nombre`, p. ej. `abm_mayoristas_abre`);
  se registra desde la pestaña Envíos progresivos («Registrar plantillas en
  Meta») y **hasta que Meta la apruebe el toque se queda en la fila**, sin
  fallar. El texto que sale es el que Meta aprobó: por eso en la ficha se
  aprueba o se quita, pero no se edita.
  **Sin condicionales**: una plantilla de Meta es texto fijo con huecos, así que
  `[[si …]]` no existe ahí y en el envío automático no viaja persona ni
  calificación —solo `{{nombre}}` y `{{ciudad}}`, que toda cuenta tiene—. Las
  tres de novias se reescribieron por eso el 14-sep-2026. **Los botones van en
  `boton_texto` / `boton_url`** de la misma fila: con URL es un botón de enlace;
  sin URL son respuestas rápidas separadas por « | » («Sí, muéstrenme | Ahora
  no»). Un «no» también abre la ventana y frena la cadencia —mejor eso que un
  reporte—. Y la muestra que Meta exige por hueco sale de una cuenta real del
  giro, no de un mayorista de Villa Hidalgo.
- **La línea manda.** Sale por la línea que el CRM tenga para «prospección»
  (`wa_reglas_linea`; si no hay regla, la default). Si `wa-salud` pausó la
  línea por calidad, no sale nada. Además: tope propio al día
  (`abm_config.wa_tope_dia`, 10), la presión de 24 h entre WhatsApps al mismo
  número (la misma de todo el CRM) y **un solo toque por negocio al día** —si
  hoy ya le salió un correo, el WhatsApp se recorre a mañana.
- **Los días no chocan con los correos.** Abre al día 2 (un día después del
  primer correo), sigue al 16 y cierra al 36, después del último correo.
- **Contestar por WhatsApp frena TODA la cadencia**, igual que contestar el
  correo: el cron cruza el espejo `wa_mensajes` y cancela lo que quede con
  motivo «contestó por WhatsApp».
- **Los toques de WhatsApp no cuentan** en el cupo de correo ni en el «siete
  correos sin apertura» del ritmo: cada canal lleva su propia cuenta.

### 8.3 Nada sale sin que una persona apruebe

Los toques nacen `borrador`. El motor arranca `pausado = si`. Aprobar y
despausar es decisión de una persona, siempre.

### 8.4 Envíos progresivos (el goteo)

Cuando la base es una **comunidad** (Villa Hidalgo, un tianguis, un pasillo del
mismo mercado) no se le manda a todos el mismo día: se preguntan de dónde salió
la lista, se lo comentan y se cierra la puerta. Para eso existe el goteo
(`abm_goteo`), que vive en la pestaña **Envíos progresivos** de Cuentas objetivo.

Un goteo es *una cadencia + N cuentas por día + un filtro opcional (ciudad,
subgiro)*. Cada día hábil el cron (`abm-cadencias`, después del disyuntor y
antes de enviar) toma las N cuentas **mejor puntuadas** que todavía no tienen
ningún correo, les genera su cadencia con IA, y deja el correo 0 programado para
hoy y los demás con sus días. Verifica el MX de cada correo al enrolar y marca
`invalido` el que no tenga (nunca se corrige a mano, §5.1). Si quedan más de N
correos aprobados de ese goteo sin salir, ese día no enrola (no se apila
atraso). Cuando ya no hay elegibles, se marca `terminado`.

Si la cadencia lleva pasos de WhatsApp, el goteo también los escribe (solo si
la cuenta tiene un `wa.me` declarado; si no, entra solo con correo) y los deja
aprobados con la misma firma. A las cuentas que entraron antes de que la
cadencia llevara WhatsApp se les completa desde la pantalla («Completar sus
WhatsApp»).

**Cómo casa con §8.3:** la persona que enciende el goteo firma de una vez la
aprobación de todos los correos y WhatsApp que genere (`aprobado_por = creado_por`). Es
decisión humana, tomada una sola vez y con nombre. Encender el goteo NO
enciende el cartero: `pausado = si` sigue mandando sobre todo, y el goteo
tampoco enrola mientras el motor esté pausado.

---

### 8.5 Cómo sale un WhatsApp: plantilla, categoría y ventana

En WhatsApp no se manda lo que uno quiere cuando quiere. Hay tres caminos y hay
que saber en cuál se está.

#### Los tres caminos

| Camino | Cuándo | Necesita plantilla | Costo |
|---|---|---|---|
| **A mano, desde el teléfono** | siempre | **No** | cero |
| **Plantilla aprobada (HSM)** | para ABRIR conversación | **Sí**, aprobada por Meta | por mensaje |
| **Ventana de 24 h** | después de que ELLOS contestan | No, texto libre | incluido |

**Hoy el ABM va por el primero.** `/api/crm/abm/whatsapp` arma el mensaje con
los datos de la cuenta y una persona lo manda desde el teléfono de la tienda.
No necesita permiso de Meta ni plantilla, y hay una razón de fondo para que sea
así: **el número que contestamos es el de la tienda**, donde una vendedora está
atendiendo clientas. Un pitch automático ahí es la forma más rápida de perder
el número.

#### Marketing y utility no se eligen: se deducen

- **MARKETING** — promociones, ofertas, invitaciones, **y todo primer contacto
  en frío**. Se cobra por mensaje.
- **UTILITY** — da seguimiento a algo que el cliente **ya inició**: confirmar
  una cita que agendó, recordarle la demo que aceptó, avisarle de su pedido.
- **AUTHENTICATION** — códigos. No aplica aquí.

> 🚫 **No existe un "respaldo utility" para el contacto en frío.** La categoría
> la revisa Meta según el CONTENIDO, no según lo que uno declare: una plantilla
> de prospección enviada como utility se **recategoriza sola** a marketing, y
> repetirlo castiga la calidad de la cuenta. Si alguien nunca pidió nada,
> escribirle es marketing. Punto.
>
> **Utility aparece DESPUÉS del sí**, no antes: cuando el prospecto agenda la
> demo, el recordatorio de esa demo sí es utility legítimo, porque la reunión
> la pidió él.

#### Cómo queda la cadencia de novias

```
mensaje 1  (frío, abre)        MARKETING   plantilla, o a mano
mensaje 2  (frío, insiste)     MARKETING   plantilla, o a mano
mensaje 3  (frío, cierra)      MARKETING   plantilla, o a mano
   ↓ si contesta
cualquier cosa, 24 h           sin categoría, texto libre, sin costo extra
   ↓ si agenda demo
recordatorio de la demo        UTILITY     ti_preparacion_utility_v1
recordatorio "ya empieza"      UTILITY     reunion_recordatorio_ya
```

Los tres primeros son marketing **los tres**. No hay forma de abaratarlos
cambiándoles la etiqueta, y el intento se paga con calidad de la cuenta.

#### ⚠️ Las plantillas de contacto en frío que ya existen NO sirven para el ABM

De las 20 aprobadas, las dos que parecían servir para abrir en frío dicen:

> *"Te escribo por **el registro que dejaste**"* — `primer_contacto_moda`,
> `apertura_pregunta_moda`

Eso es exactamente la mentira que prohíbe §7.2. Están escritas para leads
**entrantes**, gente que sí se registró. Usarlas con una cuenta que salió de un
barrido de Google Maps es afirmar algo falso en el primer renglón, que es lo que
convierte un mensaje en un reporte.

**Para el ABM en frío hay que dar de alta plantillas nuevas**, con el texto de
§7.6 —quiénes somos, de dónde salió su contacto, algo real de ellos, lo
específico de su giro, lo que damos, una pregunta fácil— y en categoría
MARKETING.

#### Escribir una plantilla que Meta acepte

Los límites que tumban una plantilla, todos aprendidos a golpes:

- **El valor de una variable NO puede llevar salto de línea**, tabulador ni más
  de cuatro espacios seguidos. El envío falla con **132012**. Por eso una lista
  de funciones va como frase de corrido dentro del hueco y **nunca** como
  viñetas: las viñetas necesitan saltos. Los saltos viven en el texto FIJO.
- **Una variable no puede quedar al principio ni al final del cuerpo.** Meta
  rechazó nuestra apertura por cerrar con `{{5}}?` — el signo de interrogación
  no cuenta como texto suficiente. Tiene que haber palabras después.
- **Cuerpo máximo 1024 caracteres**, contando los huecos.
- **Meta exige un ejemplo por hueco** al dar de alta.
- **Las plantillas no se editan.** Se crea una versión nueva (`_v2`).

**Una plantilla por PASO, no por giro.** Con los huecos cargando lo del giro son
3 aprobaciones; una por giro serían 22 × 3 = 66, cada una con su revisión y su
riesgo de rechazo. Agregar un giro nuevo no necesita permiso de nadie.

**Los botones no son adorno: son el mecanismo.** Un toque en una respuesta
rápida **abre la ventana de 24 horas**, y ahí dentro ya no hacen falta
plantillas — texto libre, la IA conversando de verdad y sin costo por mensaje.
La plantilla no tiene que vender: **solo tiene que lograr un toque.**

#### Antes de mandar el primer WhatsApp de una cadencia nueva

1. ¿El número está **declarado**? (§6 bis — sin esto no sale nada)
2. ¿Va a mano o por plantilla? Si es plantilla, ¿está APROBADA y en MARKETING?
3. ¿El texto de la plantilla afirma algo que no pasó (un registro, una
   solicitud)? Si sí, no se usa.
4. ¿Se está mandando en horario de oficina del huso del prospecto?
5. ¿La tanda es chica y se va a medir la calidad de la línea antes de la
   siguiente?

---

## 9. Replicar en otro país

### 9.1 Lo que cambia

| Pieza | Qué revisar |
|---|---|
| **Censo oficial** | ¿Existe? ¿Descarga masiva o API? ¿Trae correo y web? |
| **Clases de actividad** | SCIAN en México, CIIU/NACE en otros. **Verificar el código, no suponerlo** |
| **Formato telefónico** | Largo, prefijo internacional, cómo se detecta un móvil |
| **Mezcla de canales** | En México manda WhatsApp. En Europa el correo pesa más y WhatsApp menos |
| **Idioma del guion** | No traducir: reescribir en cómo habla esa gente en ese país |
| **Taxonomía de giros** | Los giros mexicanos no se exportan tal cual |
| **Legalidad** | ⚠️ ver abajo |

### 9.2 Europa: el correo frío NO es libre

En México el correo frío B2B es legal. **En la UE no es igual y varía por
país.** Algunos exigen consentimiento previo incluso entre empresas; otros lo
permiten con interés legítimo, siempre con baja inmediata e identificación
clara del remitente. El RGPD además obliga a decir de dónde se sacaron los
datos cuando no los dio el titular — que es justo nuestro caso.

**Esto se resuelve con un abogado por país ANTES de mandar el primer correo,
no después.** Un país donde el correo frío no proceda puede seguir
trabajándose por WhatsApp, teléfono o LinkedIn, pero es una decisión legal,
no técnica, y no la toma el motor.

### 9.3 Lo que NO cambia

- La cascada de enriquecimiento y su orden.
- Las reglas de verificación de la sección 5 — todas.
- Observado vs. inferido.
- La rampa, el disyuntor y el "nada sale sin aprobar".
- El primer correo explica por qué llega, y no miente sobre cómo llegamos.

### 9.4 Antes de dar por bueno un país nuevo

1. ¿El universo está clasificado por lo que el negocio **es**, o por lo que
   buscó el barrido?
2. ¿Se agotó el censo oficial antes de ponerse a raspar?
3. ¿Todo correo pasó por MX? ¿Ninguno se corrigió a mano?
4. ¿Los datos inferidos están marcados como inferidos?
5. ¿Las banderas de canal miran el estado?
6. ¿El botón pide lo mismo que el cuerpo?
7. ¿Se renderizó un correo real contra una cuenta real antes de generar los
   demás? *(así se cacharon "con sus 1 sucursales" y una línea duplicada)*
8. ¿Está resuelta la legalidad del correo frío en ese país?

---

## 10. La línea base de México

Para comparar cuando se replique.

**Motor completo:** 21,107 cuentas · 26 giros · 22 con guion escrito ·
310 plantillas de correo + 66 de WhatsApp.

**Novias, el primer segmento trabajado de punta a punta:**

| | Al empezar | Al terminar |
|---|---|---|
| Cuentas | 629 | 629 |
| Con correo | 34 | 93 |
| Con WhatsApp **declarado** | 62 | 57 |
| Con teléfono (para llamada) | 627 | 627 |
| Cadencias listas | 0 | 30 |

Sin importar un solo negocio nuevo. De los 59 correos ganados: **3** del sitio
propio, **56** del censo.

El WhatsApp **bajó** de 62 a 57 a propósito: llegué a inferir 554 números del
teléfono y se descartaron todos al cerrar la regla de solo-declarados. En todo
el motor quedaron **1,495 declarados** y **737 no declarados**, y estos últimos
se trabajan por llamada con su canal `telefono`, que nunca se perdió.

**Rendimiento del raspado de sitios** (1,089 cuentas, todos los giros):
WhatsApp 161 · teléfono 144 · correo 152 · **sitios caídos 208**.

---

## 11. Los errores que originaron cada regla

| Error | Regla que salió |
|---|---|
| `team@latofonts.com` como correo de una casa de novias | Lista negra de proveedores; dominio propio primero |
| `mivestido@tiscaeno.mx`, dominio inexistente | MX obligatorio; nunca corregir a mano |
| Segmento de 73 cuando eran 629 | Buscar por nombre en todos los giros |
| Tope de 600 KB escondía la mitad | Mínimo 6 MB al bajar una página |
| Clase SCIAN 463215 supuesta (era bisutería) | Verificar el código contra `nombre_act` |
| Token del portal de INEGI rechazado por DENUE | Preferir descarga masiva a la API |
| 19 cadencias sin IA por saldo agotado | El fallo viaja en la respuesta, no solo al log |
| `[1,3,7,11,16,22,30]` fijo | Los días salen de los pasos |
| Botón "demo" en la ruta `diagnostico` | El botón pide lo mismo que el cuerpo |
| `tiene_email` true con el correo invalidado | El recuento mira el estado |
| "con sus 1 sucursales" en 14 plantillas | Renderizar contra cuentas reales antes de generar |
| 83 "menciones de WhatsApp" que eran nombres de foto | Contar enlaces, no coincidencias de texto |
| WhatsApp que pedía un dato sin presentarse | Los 7 elementos del primer mensaje (sec. 7.6) |
| `[[si persona]]le[[/si]][[si nombre]]Le[[/si]]` → "leLe" | No hay negación: el condicional es frase completa |
| El expediente daba el nombre completo a la IA | Pasarle el dato ya cortado, no una instrucción |
| Prueba escrita en vitest, que el repo no usa | Seguir el runner del proyecto, o nadie la corre |
| 554 números inferidos listos para salir a ciegas | WhatsApp solo a quien publicó su `wa.me` (sec. 6 bis) |
| El canal guardaba `https://wa.me/…` y no el número | Normalizar a dígitos al cargar |
| 1,703 canales "sin procedencia" que sí la tenían | Cruzar por valor NORMALIZADO, no exacto |
| Un `unknown` de Lookup atoraba el lote en bucle | Filtrar por `verificado_at`, no solo por estado |
| `tiene_wa` true sin canal declarado (710 cuentas) | La bandera cuenta lo CONTACTABLE, no lo que existe |

---

## 12. Dónde está cada cosa

```
src/lib/crm/abm.lib.ts                  puntaje, variables, rellenar(), apuntar()
src/lib/crm/abm-correo.ts               el HTML del correo (diseño fuera del cuerpo)
src/lib/crm/abm-giros.ts                catálogo de giros
src/lib/crm/abm-generar.ts              expediente + REGLAS + la IA que redacta la cadencia
src/lib/crm/abm-goteo.ts                envíos progresivos: elegibles, lote diario, MX
src/lib/crm/abm-whatsapp.ts             el WhatsApp de la cadencia: plantillas en Meta, envío por línea, respuestas
src/pages/api/crm/abm/cadencias.ts      generar / aprobar / cancelar
src/pages/api/crm/abm/goteo.ts          crear/pausar/enrolar un goteo, encender el cartero, registrar plantillas en Meta
src/pages/api/cron/abm-cadencias.ts     el envío: rampa, disyuntor, goteo, cupo, WhatsApp
scripts/abm-verificar-mx.mjs            marca valido/invalido por MX los correos sin_probar de un giro
scripts/generate-mail-<giro>.mjs        las 8 fotos de los correos de un giro (gpt-image-2, 600×300); hay novias, mayoristas, calzado, marcas
src/pages/api/cron/abm-enriquecer.ts    Places y DENUE (necesita llaves)
sitio/migraciones/                      cada carga de datos, con su porqué

── Por país (§13) ──
src/lib/crm/abm-paises.ts               PAISES (iso, región, gl, LADA, moneda, tz, «XV», landing, legal), paisDe(), alcanceDe()
src/pages/giros/novias-y-fiesta/[pais].astro   la landing de novias por país: moneda, vestido de ejemplo, «15 años», soporte «en español»
src/components/giros/NoviaFecha.astro   el simulador de abonos acepta moneda/locale/rango (sin props = pesos mexicanos)
src/components/suite/SuitePlanes.astro  prop `moneda`: los planes en la moneda de data/plans.ts que se le pida
docs/prospeccion/barrido/pais/          el barrido fuera de México (§13.7): paises.py (LADA, largos, e164),
                                        cola-pais.py, maps-pais.js + barrido-pais.sh (feed hl=en), lugar-pais.js +
                                        fichas-pais.sh (ficha gl=US: teléfono E.164, reseñas, categoría en inglés),
                                        carga-pais.py (filtro, cadenas, carga SQL), sitios-pais.py (correo, wa.me, IG)
```

Las cadencias escritas hasta hoy, por giro (cada una en su migración, con el
porqué de cada correo y la lista de lo que se afirma verificado en el sistema):

```
novias        2026-09-04-abm-plantillas.sql + 2026-09-13-abm-novias-correo0*.sql   demo + diagnóstico, correo + WhatsApp manual
mayoristas    2026-09-13-abm-mayoristas-cadencia.sql   Villa Hidalgo: listas de precio, foto a venta, tallas sueltas, crédito · + WhatsApp automático
calzado       2026-09-13-abm-calzado-cadencia.sql      SAPICA: matriz por número, corrida rota, pedidos por matriz, precio por cliente, crédito · SOLO correo
marcas        2026-09-13-abm-intermoda-cadencia.sql    Intermoda: pedido de feria, curva por talla y color, reposición entre ferias, precio por cliente, crédito · SOLO correo
```

Una cadencia nueva de un giro que vende a tiendas (no al público) sale de la
de mayoristas cambiando el vocabulario del ramo —lo que compra, cómo se cuenta,
cómo pide su cliente— y quitando de la base a quien el guion no le habla (en
calzado: proveedores de la industria, sombreros y marroquinería quedaron en
pausa; un competidor de software en no_contactar; en marcas, 81 proveedores
de telas, avíos y maquinaria en pausa y 14 ajenos o competidores fuera). Antes
de encender, se renderiza contra una cuenta real con IA y se borra el borrador
(§7.7). Si la base mezcla productos con talla y sin talla (Intermoda: ropa con
joyería y bolsas), la decisión de «tallas» o «modelo y color» se toma en el
expediente por el subgiro (abm-generar.ts, `sinTalla`), no en el objetivo de
cada correo: puesta ahí como «si vende joyería…», la IA se la aplicó también a
una marca de ropa. Y si el subgiro nombra las dos cosas («trajes y accesorios
de caballero»), manda la ropa: el pedido se levanta por talla.

Y una regla de calendario que costó un lote: **un arreglo del guion que no
está desplegado antes de las 10:00 CDMX no existe para el goteo de ese día.**
El 14-sep-2026 el goteo de Intermoda escribió 40 cadencias con el código
viejo (se desplegó a las 13:45) y diez marcas de joyería, bolsas y velos
recibieron un guion de tallas. Se arregló borrando sus toques y devolviéndolas
a sin_tocar para que el goteo las tomara al día siguiente con el código bueno
(migración 2026-09-14-abm-intermoda-relanzar-sin-talla.sql); no se les escribe
la cadencia a mano. Si un goteo nuevo depende de código nuevo, o se pide el
push antes de la hora o se enciende el goteo al día siguiente.

Las migraciones se escriben explicando **por qué** se hizo el cambio, no qué
hace el SQL. Una migración dice lo que pasó ese día — no lo que es cierto hoy.

---

## 13. Segmentar por país: el aprendizaje de México y cómo se replica

Escrito el 14-sep-2026, cuando el dueño pidió «con esta misma estrategia,
documéntala bien y vamos a empezar a segmentar por país»: México deja claro
que es México; luego los 10 países más aptos de Latinoamérica; después Europa.
Esta sección es el guion completo para que una base nueva de cualquier país
siga **exactamente el mismo proceso** que novias en México.

### 13.1 Lo que se hizo con novias en México, de punta a punta

El orden importa; cada paso salió de un error del anterior (§11).

1. **Universo.** Censo oficial primero (DENUE, clase SCIAN verificada contra
   `nombre_act`), después el barrido de Google Maps por ciudad y consulta
   (`docs/prospeccion/barrido/`: `cola.py` → `barrido.sh` con 4 workers →
   `maps.js` en Playwright con `hl=es&gl=MX`). El barrido de Maps trae
   **nombre, categoría, calificación, número de reseñas, teléfono y sitio**;
   la calificación y las reseñas son el primer filtro de calidad (la base se
   ordena por ellas) y el sitio es la puerta al correo.
2. **Limpieza y carga** (`giro-carga.py prep|hijos`): sin teléfono se
   elimina, las cadenas se agrupan por nombre normalizado, el CIU se
   canoniza, y se carga con `on conflict do nothing` sobre
   `(lower(nombre), coalesce(ciudad,''))`. Cada cuenta deja su procedencia
   en `abm_fuentes`.
3. **Enriquecimiento del sitio propio** (`giro-sitios.py`): home + contacto +
   aviso, mínimo 6 MB por página; correos (`mailto:` y texto), `wa.me`
   **declarado** (el único WhatsApp que se manda), Instagram/Facebook,
   plataforma web y carrito. Nada se infiere del teléfono.
4. **Verificación**: todo correo por MX (`scripts/abm-verificar-mx.mjs
   <giro>`), nunca corregido a mano; ZeroBounce solo con OK del dueño.
5. **Puntaje** (`calcularPuntaje`): encaje por giro + tamaño (reseñas ≥300 o
   seguidores ≥30k suman) + dolor (e-commerce, sitio caído, sin carrito).
6. **Guion**: dos rutas —`demo` y `diagnostico`—, 8 correos (días 1, 4, 6,
   10, 14, 19, 25, 33) + 3 WhatsApp a quien lo declaró, una pieza
   descargable, fotos propias (600×300, gpt-image-2). La IA personaliza con
   el expediente (`abm-generar.ts`); lo que el correo AFIRMA del sistema está
   listado en la migración y verificado.
7. **Landing propia del giro**: el correo manda a `/giros/novias-y-fiesta`,
   nunca al home (regla del dueño, `PAGINA_GIRO`).
8. **Goteo**: 10 cuentas/día (novias), con IA, pausado hasta que el dueño
   enciende; el cartero tiene rampa, disyuntor y tope diario (320).
9. **Render real antes de generar**: una cadencia contra una cuenta real,
   se lee, se borra el borrador.

### 13.2 Lo que enseñó abrir la puerta a España (commit `fa97c654`)

El primer país fuera de México no fue una base nueva: fue una novia de
Madrid que quiso agendar. Todo lo que se rompió es lo que hay que revisar
**antes** de mandar un correo a cualquier otro país:

- **La agenda vive en hora CDMX y el invitado la ve en la suya**
  (`src/lib/scheduling/zona.ts`): selector de zona completo, horarios en 24 h
  con la zona escrita, y la FECHA del invitado (las 17:00 CDMX son la 1:00 del
  día siguiente en Madrid). El `.ics`/Google Calendar lleva zona; los correos
  de confirmación (invitado y vendedor) muestran las dos horas.
- **El cierre del correo no puede sonar a «solo somos de México»**:
  `ALCANCE` en `abm-correo.ts` dice «Atendemos negocios de moda en México,
  Latinoamérica y España por videollamada, en su horario». Con países
  segmentados esa frase se vuelve la del país (§13.5).
- **Los horarios de atención son los de México.** Un correo a Madrid que
  promete «le llamamos hoy» a las 16:00 CDMX está prometiendo medianoche. La
  cadencia se envía a la hora local del país (§13.6) y los WhatsApp respetan
  la ventana local.

### 13.3 El modelo: país → región → guion

Tres capas, para no escribir 10 guiones distintos ni uno solo que no le
hable a nadie:

| Capa | Qué decide | Dónde vive |
|---|---|---|
| **País** (`abm_cuentas.pais`) | moneda, LADA, largo del móvil, zona horaria, palabra para XV, landing, nota legal, `gl` de Maps, ciudades | `src/lib/crm/abm-paises.ts` (sin dependencias de servidor; lo importan API y navegador) |
| **Región** (`mexico` / `latam` / `espana`) | la cadencia y las plantillas que se usan (`abm_cadencias.pais`, `abm_plantillas.pais`), el registro del español (`REGLAS` del generador) | `regionDe(pais)` en `abm-paises.ts`; el generador elige cadencia por giro + ruta + región con caída a México |
| **Cuenta** | nombre, ciudad, subgiro, reseñas, dolor: lo que ya personalizaba la IA | expediente en `abm-generar.ts` |

Regla: **un guion por región, variables por país.** El guion de Latam es uno
(español neutro, `usted`, sin mexicanismos: nada de «checar», «platicar»,
«apartado», «quinceañera» sin más) y las variables `{{pais}}`, `{{xv}}`,
`{{landing}}`, `{{moneda}}` lo aterrizan. México conserva su guion tal cual
y **dice México**: «en todo México», landing de México, precios en MXN.

### 13.4 Los 10 países de Latinoamérica y por qué esos

Criterio del dueño: «los más aptos tecnológicamente y demás como México».
Se midió con cuatro cosas: uso de WhatsApp en negocios, pagos en línea y
e-commerce de moda, penetración de internet, y que el español sea la lengua
del ramo (Brasil queda para una segunda ola en portugués, con guion propio).

| # | País | `gl` | LADA | Móvil (dígitos locales) | Moneda en `plans.ts` | XV | Nota legal del correo frío |
|---|---|---|---|---|---|---|---|
| 1 | Colombia | co | +57 | 10 (empieza en 3) | cop | «15 años» | Ley 1581 (habeas data): identificarse, decir de dónde salió el dato, baja inmediata |
| 2 | Chile | cl | +56 | 9 (empieza en 9) | clp | «15 años» / «fiesta de 15» | Ley 19.496 art. 28 B: asunto sin engaño, remitente identificado, opt-out obligatorio |
| 3 | Argentina | ar | +54 | 10 sin el 0 ni el «15» → se guarda +549… | ars | «15 años» / «quince» | Ley 25.326: opt-out en cada envío, origen del dato |
| 4 | Perú | pe | +51 | 9 (empieza en 9) | pen | «quinceañero» / «15 años» | **Ley 28493: el asunto debe llevar la palabra «PUBLICIDAD»** y datos completos del remitente |
| 5 | Ecuador | ec | +593 | 9 sin el 0 | usd | «15 años» | LOPDP 2021: base legal e información al titular |
| 6 | Costa Rica | cr | +506 | 8 | usd (CRC no existe en plans) | «15 años» | Ley 8968: identificación y baja |
| 7 | Panamá | pa | +507 | 8 | usd | «15 años» | Ley 81/2019 |
| 8 | Uruguay | uy | +598 | 8 sin el 0 (09x) | usd (UYU no existe) | «15 años» | Ley 18.331 + regulación de spam de URSEC: opt-out |
| 9 | República Dominicana | do | +1 | 10 (809/829/849) | usd | «15 años» / «quinceañera» | Ley 172-13 |
| 10 | Guatemala | gt | +502 | 8 | usd | «15 años» | Sin ley específica de datos; aplican las reglas de la casa |

Fuera y por qué: **Brasil** (portugués: segunda ola), **Venezuela**
(pagos y bancarización), **Bolivia y Paraguay** (tamaño del mercado de
moda), **Puerto Rico** (CAN-SPAM de EE. UU., otra jurisdicción), el resto de
Centroamérica (tamaño). Cuando el dueño diga, entran con la misma máquina.

Regla de teléfonos que **no** es la de México: `telefono.ts` y `ui.tsx`
convierten 10 dígitos sueltos en +52. **Un número de Latam se guarda siempre
con su código de país** (`+57…`, `+56 9…`) desde la carga; un número de 10
dígitos sin código en una cuenta de Colombia es un error de carga, no un
número mexicano.

### 13.5 Lo que cambia en el sistema para un país nuevo

- `abm_cadencias.pais` y `abm_plantillas.pais` (default `México`): el
  generador toma la cadencia de la región de la cuenta y, si esa región no
  tiene, la de México (para que nada quede sin guion).
- `abm-goteo.ts` filtra también por `f.pais`: un goteo por país, con su tope.
- Cierre del correo (`abm-correo.ts`, `Cierre.pais`): México → «en todo
  México» + landing MX; Latam → «Atendemos negocios de moda en {País} por
  videollamada, en su horario» + landing del país.
- `paginaDe(giro, sitio, pais)`: `/giros/novias-y-fiesta` para México,
  `/giros/novias-y-fiesta/<pais>` para los demás (precio en su moneda desde
  `plans.ts`, «15 años» en vez de «XV», sin cifras que solo son ciertas en
  México).
- Variables nuevas en `variablesDe`: `{{pais}}`, `{{xv}}`, `{{landing}}`.
- Hora de envío: el cartero corre a las 10 y 13 CDMX; para un país se
  respeta su hora local (§13.6).
- El expediente le dice a la IA el país y el registro: «Español neutro de
  Latinoamérica, trato de usted, nada de mexicanismos», y para México lo de
  siempre.

### 13.6 Hora local y ventanas

Los crons corren en UTC (`vercel.json`: 16 y 19 UTC = 10 y 13 CDMX). Para
que un correo llegue en horario laboral del país se elige el paso del día
según la diferencia: Colombia/Perú/Ecuador/Panamá (UTC−5) son la misma hora
que CDMX ± 0–1 h, así que el cron actual sirve; Chile/Argentina/Uruguay
(UTC−3) reciben a las 13 y 16 locales —bien—; Costa Rica/Guatemala (UTC−6)
igual que CDMX; República Dominicana (UTC−4). **España (UTC+2 en verano) no
cabe**: las 10 CDMX son las 18 de Madrid; ese país necesita su propia hora de
cron antes de encenderse (o el goteo lo enrola y el cartero solo suelta lo
suyo en la corrida de las 13 UTC que habrá que añadir). Nada de esto se
enciende sin que el dueño lo vea.

### 13.7 El proceso para una base nueva, paso a paso

1. Configurar el país en `abm-paises.ts` (todo lo de la tabla de §13.4) y las
   ciudades en `docs/prospeccion/barrido/pais/paises.py`.
2. Barrer Maps con `gl` del país (`barrido-pais.sh <iso> <giro>`): feed +
   ficha de cada lugar (`lugar.js`: web, teléfono, dirección, categoría,
   calificación y reseñas). Guardar cada resultado crudo en el pool.
3. `carga-pais.py prep <iso> <giro>`: filtro por categoría y nombre, sin
   teléfono se elimina, teléfono a E.164 con la LADA del país, cadenas
   agrupadas, revisión a ojo con `revisar.py`, carga con `pais`, `moneda`,
   `google_rating`, `google_resenas`, `sitio`, y `abm_fuentes`.
4. Raspar sitios (`sitios-pais.py`): correo, `wa.me` declarado (con código
   de país), redes, plataforma. MX a todo correo. Recalcular puntaje.
5. Escribir la cadencia de la región si no existe (migración con el porqué
   y la lista de lo afirmado); crear pasos, cadencias y **goteos en pausa**
   por país.
6. Renderizar una cadencia con IA contra una cuenta real de cada país,
   leerla, borrar el borrador.
7. Resolver la legalidad (tabla de §13.4): Perú lleva «PUBLICIDAD» en el
   asunto; todos llevan identificación, origen honesto del dato y baja.
8. Mandarle al dueño el reporte: cuántas cuentas por país, con correo, con
   WhatsApp, qué guion, a qué hora, qué landing, qué precio, qué nota legal.
   **Nada sale hasta que él lo apruebe.**

### 13.8 Lo que NO se replica

- La landing de México con cifras de México («personas de soporte en
  México», «vestido de $28,000») no se muestra en otro país sin adaptar.
- Las plantillas de WhatsApp aprobadas en Meta son por nombre e idioma
  (`es_MX`); una versión neutra se registra aparte y se espera su APPROVED.
- El goteo `abm_frio` no se enciende nunca; los goteos por país se crean en
  pausa y los enciende el dueño.
