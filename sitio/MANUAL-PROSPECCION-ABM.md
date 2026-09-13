# Manual del motor de prospección (ABM)

Cómo se arma, se enriquece y se contacta una lista de prospectos fríos.

Está escrito para **repetirse en otro país**. México fue el primero y todo lo
que sigue está medido ahí; cada regla dice *por qué* existe, porque al cambiar
de país cambian los datos pero casi nunca la razón.

> **Antes de replicar, lee la sección 9 (Europa).** El correo frío B2B es legal
> en México y no lo es igual en la UE. Eso decide si un país entra por correo o
> solo por otro canal.

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

### 4.1 El censo oficial del país ← **empieza SIEMPRE aquí**

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
src/pages/api/cron/abm-enriquecer.ts    Places y DENUE (necesita llaves)
sitio/migraciones/                      cada carga de datos, con su porqué
```

Las migraciones se escriben explicando **por qué** se hizo el cambio, no qué
hace el SQL. Una migración dice lo que pasó ese día — no lo que es cierto hoy.
