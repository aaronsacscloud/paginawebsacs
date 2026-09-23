# Estado del módulo de llamadas — cierre del 21/22-sep-2026

**Léeme primero si vas a tocar Llamadas inteligentes, la cabina, las minutas o
los seguimientos.** Esto es dónde quedó todo, qué falta y qué decisiones están
abiertas. Todo lo de abajo está **en producción** salvo donde diga lo contrario.

---

## 1 · La pantalla de Llamadas inteligentes cambió de forma

Antes: cinco tarjetas de listas + seis cifras de 30 días + dos listas planas
(compromisos y jornadas). Ahora: las cinco tarjetas (siguen), y debajo **una
tabla con cinco pestañas** (`TableroLlamadas.tsx` ← `api/crm/telefonia/tablero`).

| Pestaña | Qué contesta | Cómo decide qué entra |
|---|---|---|
| **Reuniones** | ¿A quién voy a ver? | `origen='llamada'` **o** hubo conversación real antes de crearse la cita |
| **Seguimientos** | ¿A quién le dije que llamo? | `ti_tareas` `de_llamada`, **hoy y 7 días**; lo vencido, aparte |
| **Oportunidades** | ¿Quién avanzó por llamarle? | habló **>20 s** y no fue máquina, y está en oportunidad/cotización/cliente |
| **Descalificados** | ¿A quién descarté, y por qué? | lo mismo, en descalificado/perdido; el porqué sale de la nota del cierre |
| **Listas** | ¿Qué jornada dejé a medias? | `tel_sesiones` no archivadas; «falta por marcar» = items pendientes |

**La regla que manda:** una fila entra sólo si se rastrea hasta una llamada de
la cabina. Si se relaja, esto se convierte en otro tablero general.

**Las cifras de 30 días ya no se pintan aquí** (decisión del dueño: «lo
satura»). Siguen vivas en `api/crm/telefonia/informe`, de donde come Reportes.

## 2 · Armar la lista: la prospección es una fuente más

`ArmadorLista.tsx` ← `api/crm/telefonia/candidatos`. Tres bloques: de dónde
salen (CRM · prospección · las dos) y por dónde hablarles · cómo son (giro,
tiendas, estado, calidad) · a quién NO llamar.

Debajo hay cuatro vistas (`migration-2026-09-21-llamables.sql`):
`v_abm_llamables` (aplana `abm_canales`: 29,770 cuentas con teléfono),
`v_tel_intentos` (intentos **por número**, que es lo único que comparten las dos
fuentes), `v_abm_giros` y `v_abm_estados` (contadas **en la base**: PostgREST
corta en 1000 y los conteos salían falsos).

**Tres filtros vienen puestos de fábrica** y protegen: no repetir a quien ignoró
3 llamadas, no llamar a clientes, no llamar a quien ya tiene cita.

## 3 · Seguimientos prometidos: el ciclo completo

1. En la llamada se acuerda «márcame el jueves a las 11» → tarea + cita + el
   item vuelve a la lista con `volver_at`.
2. **Una sala nueva recoge sola** las promesas de hoy (`crearSesion`), cada una
   a su hora, sin empujar a nadie. Un teléfono, un renglón.
3. Al marcarle, la cabina enseña en grande **«Llamando por seguimiento previo
   de X»**.
4. Si **no contesta**: la tarea se cierra (`seguimiento_desenlace`) y se le manda
   un WhatsApp **distinto** (`lib/telefonia/seguimiento-aviso.ts`). No se
   reintenta — ni por el camino del buzón.
5. Si **responde** ese WhatsApp, el seguimiento **renace** (tarea nueva). Tope:
   a la tercera promesa fallida deja de renacer solo.
6. Lo que no se llegó a marcar sale en la pestaña con su hora acordada y un
   botón **«Llamar ahora»** (abre la cabina con una lista de uno).

## 4 · Minutas de llamada

Viven en `wa_llamadas.minuta` / `minuta_cliente` + dos PDF. Se pueden **rehacer
sin volver a bajar el audio**:
`POST /api/crm/telefonia/minuta-pdf {call_id, redactar:true, enviar:false}`.

⚠️ **`enviar:false` importa**: sin él ese endpoint *manda el PDF al cliente*.

Si algo falla, el motivo se guarda en `wa_llamadas.minuta_error` y la ficha del
contacto lo enseña con un botón para regenerar. Los nombres propios se corrigen
en `lib/telefonia/terminos.ts` (Whisper oye «Sax» por Sacs y «Odo» por Odoo).

## 5 · Mejoras CRM del 22-sep-2026 (#1 descalificados, #2 minuta >3 min, #3 más información)

**#1 · A quien se descalificó UNA VEZ no se le vuelve a llamar en automático**,
diga lo que diga su etapa hoy. La regla vive en un sello que pone la base y
que nada borra: `contacts.descalificado_at` (trigger `trg_sellar_descalificado`;
en el ABM, `abm_cuentas.descalificada_at` al pasar a `perdida`). Se aplica al
GENERAR, no al pintar:
- `crearSesion` (toda lista: armador, inbox, «volver a llamar», Fernanda) y las
  promesas del día — una promesa vieja NO revive a un descalificado.
- `marcarSiguiente`: último candado justo antes de marcar (si se descalificó
  después de armar la lista, el item pasa a `excluido` con su motivo).
- `candidatos` (armador) y `v_abm_llamables` / cola del ABM: por contacto y por
  NÚMERO (últimos 10 dígitos, vista `v_tel_vetados`), porque el mismo teléfono
  llega como cuenta del ABM o como contacto duplicado.
- `ti_tareas` tipo `llamada`: el trigger `trg_vetar_llamada_descalificado` las
  recibe y las deja `retirada` / `descalificado_previo` (salvo `origen='manual'`).
  Al descalificar se retiran las pendientes. Así da igual cuál de los ocho
  lugares que crean tareas de llamada lo intente.
- Semáforo de WhatsApp (`puedeAutomatico`): bloquea `descalificado_previo`
  salvo aprobación humana o si ÉL volvió a escribir después.
- Levantar el veto = una persona, a propósito: `descalificado_levantado_at`
  (todavía sin botón en la ficha; hoy es por SQL).
- Helper: `lib/telefonia/veto.ts` (`cargarVetos`, `vetoDe`, `vetoDeUno`). Falla
  CERRADO: si no puede leer los vetos, no arma la lista.

**#2 · Minuta sólo si la llamada dura MÁS de 3:00** (`MINUTA_MIN_SEG` en
`lib/whatsapp/minuta.lib.ts`). Aplica a todo lo que pasa por
`generarMinutaDesdeAudio`: Twilio (centro de llamadas, llamada normal,
entrantes) y WhatsApp. Duración = `wa_llamadas.duracion_seg`; si aún no llegó,
la de la grabación / la que midió el navegador. La grabación se guarda SIEMPRE;
lo que no corre es Whisper ni Claude. El porqué queda en
`wa_llamadas.minuta_omitida`. El «rehacer minuta» manual no tiene umbral.

**#3 · «¿Me mandan más información?»** → `lib/crm/ti/info-sacs.ts`. Regla de
frases antes del modelo + `pide_info` en la salida del agente. Sale mensaje
personalizado + liga + `public/info/sacs-informacion.pdf`, SOLO aunque el
agente esté en sombra (interruptor propio `info_sacs`), una vez cada 72 h.
Ventana cerrada → familia de plantillas `info` (Marketing con el PDF de
encabezado → Utility con el mismo PDF). En llamadas, el tema «la información
de Sacs» de `tel_conocimiento` apunta al mismo PDF. Fuente del PDF:
`scripts/info-sacs/` (`node scripts/info-sacs/generar.mjs`).

## 6 · La llamada manual = la cabina (22-sep-2026)

Llamada desde la ficha o cualquier `tel:` (`Telefonia.tsx` + `SalaLlamada.tsx`,
item en la sesión fantasma de `suelta.ts`):
- La sala va en un **portal a `document.body`**: dentro de la barra (que lleva
  `transform`) el `fixed` salía pegado arriba y sin ✕ visible.
- Al colgar (quien sea) arranca **solo** el cierre con IA —el mismo
  `proponerCierre`/`aplicarCierre` de la cabina—; elegir «qué pasó» es
  opcional y se traduce al vocabulario del cierre (`volver`→`volver_llamar`…:
  antes un «Volver a llamar» manual nunca programaba la vuelta). Si nadie
  aplica, `rescatarCierres` lo aplica a los 2 min.
- Si había un **seguimiento prometido** de hoy (o vencido), la llamada manual lo
  cumple (`cerrarLlamadaSuelta` cierra la tarea): antes la sala del día le
  volvía a marcar. La sala lo avisa arriba, y también si el lead **se
  descalificó** (a mano sí se le puede llamar).
- **Todavía NO está probado con una llamada real** (el dev local marca de verdad).

## 7 · La lista como tablero: rondas y acciones masivas (22-sep-2026)

`lib/telefonia/lista-resumen.ts` + `ResumenLista.tsx` (arriba de la pantalla
final de la cabina). UNA LISTA = la sesión raíz + sus rondas (sesiones con
`origen.lista_raiz` o, en las viejas, `origen.relanzar_de` = raíz). Por
persona (mismo número) junta lo que pasó en cada ronda y la pone en UN grupo:
acción > descalificado > contestó > buzón > contestadora > nunca > sin marcar
> fuera. Acciones (`api/crm/telefonia/marcador`): `lista_resumen`,
`lista_ronda` (sesión nueva «· ronda N» → pasa por todos los candados de
`crearSesion`), `lista_masivo` (descalificar vía `aplicarRechazo`, no_llamar,
plantilla de una variable con `mandarPlantilla`).

---

## LO QUE FALTA

### 🔴 Bloqueado en algo que no es código

**Las dos plantillas de WhatsApp del seguimiento.** Hay que registrarlas en Meta
y esperar el `APPROVED`. El permiso (`seguimiento_llamada`) ya está encendido y
los campos están en `wa_config` (`seguimiento_plantilla_marketing` /
`_utility`). **Hasta entonces no sale ningún mensaje** y el motivo queda escrito
en la tarea — nunca uno equivocado.

Textos propuestos, a falta del OK del dueño:
- *Marketing*: «Hola {{1}}, te marqué a las {{2}} como quedamos y no te
  encontré. ¿Te late que lo intentemos hoy más tarde o prefieres que te cuente
  por aquí? — Sacs»
- *Utility*: «{{1}}, te llamé a las {{2}} como acordamos. Cuando puedas, dime a
  qué hora te marco y lo dejo apartado.»

### ⏳ Decisiones del dueño, pendientes

1. **«Fernando» / «Fernanda».** Whisper oye mal el nombre con el que se
   presenta el equipo. No se corrige automático porque Fernando es un nombre
   real y común entre los prospectos: cambiarlo alteraría el nombre de gente de
   verdad en su propia minuta. Se puede corregir *sólo* cuando aparece pegado a
   «de Sacs» / «soy Fernando de».
2. **Las 15 jornadas archivadas.** Están fuera de la vista, no borradas, porque
   guardan ~130 llamadas reales de las que cuelgan minutas, grabaciones y el
   corpus de voz. **Cinco están de verdad vacías** y se pueden borrar sin perder
   nada; las otras once no.
3. **El filtro del inbox que a veces se queda vacío** («hay veces que me fallan
   los filtros hasta que le doy refresh»). Se puso un candado de secuencia y se
   reprodujo el adelantamiento de respuestas, pero **no se pudo reproducir el
   síntoma completo**: en pruebas el refresco de 6 s repinta solo. La pregunta
   que decide dónde seguir buscando: ¿la lista se queda vacía para siempre, o se
   arregla sola a los pocos segundos?

### 📌 Anotado, no es fallo hoy

La pestaña de Reuniones lee las **próximas 400 citas** y filtra después. Por
encima de esa cifra perdería filas en silencio. Hoy hay 4.

---

## TRAMPAS YA PAGADAS — no las vuelvas a descubrir

- **`Number(null)` es 0, no NaN.** Cada filtro numérico ausente entraba como
  cero y la lista salía vacía con los filtros en blanco.
- **`abm_cuentas.ya_es_cliente` es TEXTO** (`'sí'`/null). `is true` desde
  PostgREST tumba la consulta con un 500. La vista lo expone como `es_cliente`.
- **`permitido()` falla cerrado**: una clave que no esté en
  `wa_automatizaciones` apaga la automatización **en silencio y para siempre**.
  Al crear una clave nueva, darla de alta y meterla en el tipo `ClaveWA`.
- **PostgREST corta en 1000 filas sin avisar.** Cualquier conteo se hace en la
  base, no leyendo filas.
- **Paginar sin desempate repite filas.** Con `last_contact_at` nulo en la
  mayoría, el orden cambia entre páginas. Siempre un `.order('id')` al final.
- **`TablaEnterprise` no aplica su estilo de celda** cuando el `render` de la
  columna devuelve un `<td>`: hay que dar padding y borde a mano (`TD`).
- **El número de un seguimiento vive en `payload.whatsapp`**, no en
  `payload.telefono`.

## Higiene del repo

Hoy **cuatro veces** otra sesión trabajando el mismo repo barrió el árbol con
`git add -A` y se llevó archivos ajenos dentro de commits suyos que no los
mencionan. El código llegó completo, pero la historia queda ilegible. Si se
trabaja en paralelo: **commitear por ruta, nunca `git add -A`**.
