# Manual del Motor de Demanda

Para operarlo, no para entenderlo por dentro. Si buscas cómo está construido,
eso está en `PLAN-DEMAND-ENGINE.md`; si buscas en qué punto va, en
`ESTADO-DEMAND-ENGINE.md`.

Esto contesta cuatro preguntas: **¿está vivo?**, **¿qué está haciendo?**,
**¿cómo lo paro?** y **¿qué hago cuando algo falla?**

---

## Lo primero: cómo se apaga

CRM → Motor de demanda → Sistema → Ajustes → **«Apagar el motor»**.

Deja de escribir en el momento. Sigue leyendo y midiendo, así que no te quedas
a ciegas — y eso es a propósito: apagar el motor no debería costarte también la
capacidad de ver qué estaba pasando.

Si prefieres que siga decidiendo pero sin tocar nada, usa **«Modo simulación»**:
hace todo el trabajo y, donde publicaría, escribe qué habría publicado.

> Los dos interruptores pasan por el mismo guardián (`src/lib/demanda/salida.ts`).
> Si agregas una función que escriba hacia afuera y no la haces pasar por ahí,
> los dos interruptores se vuelven mentira para esa función. Ya pasó una vez.

---

## ¿Está vivo?

**CRM → Motor de demanda → Sistema.** Arriba de todo hay un punto verde o rojo.

Verde no quiere decir «va bien»: quiere decir **«no está callado»**. Son cosas
distintas y el motor tiene otras pantallas para la primera.

En rojo, el panel dice qué signo falla y —cuando puede— por qué:

| Lo que dice | Qué significa | Qué hacer |
|---|---|---|
| El worker no termina trabajo | Hay acciones esperando y hace más de 30 min que no se cierra ninguna | Mira si el cron `de-worker` corre (Vercel → Crons). Un despliegue en curso se come invocaciones: si acaba de desplegarse, espera 10 min. |
| El ciclo diario no abre | Más de 26 h sin ciclo | Puede ser un despliegue justo a las 6 am. Si van dos días, el cron `de-ciclo` no está corriendo. |
| Algo se queda colgado | Acciones «corriendo» con el plazo vencido | El vigilante las recupera solo. Verlo **una vez** no es nada; verlo **siempre** significa que algo mata al worker cada vuelta — mira qué tipo de acción es. |
| El motor está APAGADO | Alguien apretó el apagador | Enciéndelo si no fuiste tú. |

El latido corre **cada 30 minutos por su cuenta**, fuera de la cola: un vigilante
que dependiera de la cola no podría avisar cuando la muerta es la cola.

Avisa por la campana **como mucho una vez al día**.

---

## ¿Qué está haciendo?

- **Resumen** — qué sabe del mercado: cuántas señales, qué pide más la gente.
- **Explorador** — los problemas que ha encontrado, ordenados por su score.
- **Oportunidades** — qué propone hacer al respecto.
- **SEO técnico** — qué encontró mal en el sitio.
- **Visibilidad en IA** — el número del objetivo: ¿aparece Sacs cuando le
  preguntan a una IA?
- **¿Qué trae clientes?** — la atribución. **Lee siempre el recuadro de cobertura
  de arriba**: la mayoría de los leads llegan por WhatsApp y ABM, gente que nunca
  tuvo una cookie nuestra. Un número bajo ahí no dice que el motor no sirva.
- **Sistema** — la sala de máquinas.

---

## Lo que espera tu OK

**Sistema → Aprobaciones.** Cada acción dice qué es, qué riesgo tiene y por qué
te la están preguntando.

Lo que apruebas y lo que rechazas **enseña al motor**:

- **Dos rechazos del mismo tipo en 14 días y ese tipo pierde autonomía solo.**
  No hace falta que hagas nada más: el freno se aplica en el ciclo siguiente.
- Para subir de nivel, el motor reúne evidencia y te la enseña en
  **Sistema → Ajustes → «Qué se ha ganado el motor»**. El botón «Concederlo»
  solo aparece cuando cumple todos los criterios, y aun así el servidor los
  vuelve a comprobar antes de conceder.

Si nunca apruebas ni rechazas nada, el motor **no sube de nivel**. Cero rechazos
sobre cero decisiones no es un buen historial: es un historial vacío.

---

## Cuando algo falla

### «Se rindió» una acción

Sistema → Cola. Las muertas traen su error. Los tres que más salen:

| Error | Qué es | Arreglo |
|---|---|---|
| `DELETE/UPDATE requires a WHERE clause` | Supabase bloquea UPDATE y DELETE sin WHERE, **también dentro de funciones y sobre tablas temporales** | Ponle WHERE, o `truncate` si de verdad quieres vaciar. Ya pasó dos veces. |
| `429` / `quota` / `credit balance` | Un proveedor de IA sin saldo o pasado de cuota | El motor cambia de proveedor solo. Si fallan todos, revisa saldos. |
| `falta CREDENCIAL` | Una fuente sin llave | Sistema → «Lo que me falta» lo dice con el nombre exacto de la variable. |

### El motor gasta de más

Sistema → Ajustes → Presupuesto del mes. Al llegar al tope, **lo que cuesta
modelo se difiere** y lo gratis sigue corriendo. No se apaga solo: se hace más
barato.

### Publicó algo que no debía

Hay dos caminos y son distintos:

- **Retirar** — lo saca del sitio. Es lo correcto si la página entera sobra.
- **Revertir** — la devuelve a su versión anterior. Es lo correcto si el
  problema es el último cambio.

`revertir` **nunca pide permiso de autonomía**: deshacer un daño no puede
necesitar aprobación. Sí respeta el apagador.

---

## El tablero de cifras

| Dónde | Qué mira |
|---|---|
| Visibilidad en IA | **AVS**: 0 a 100. Mención 40%, cita de URL 25%, estar en el top 3 un 35%. Hoy va en 0 — Sacs todavía no aparece. |
| ¿Qué trae clientes? | Leads y ARR por activo del motor, con su cobertura al lado. |
| Sistema | Salud (0-100), gasto del mes, cola. |

**Una plataforma que no se pudo consultar se guarda como `NO_DISPONIBLE`, nunca
como cero.** Un cero se promedia y arrastra el resultado; un hueco declarado se
ve y se arregla. Si alguna vez ves que el AVS baja sin explicación, lo primero
que hay que mirar es si una plataforma dejó de responder.

---

## Para quien vaya a tocar el código

Cuatro reglas que salieron de errores reales, no de teoría:

1. **Toda escritura a Supabase mira su error.** Si el fallo pierde trabajo ya
   pagado, lanza; si ya estás manejando un error, avisa por consola y sigue.
2. **Toda lectura que cuenta, promedia o agrupa usa `traerTodo()`**
   (`paginar.ts`). PostgREST corta en 1000 filas **sin avisar**: no hay error,
   solo un resultado más corto. Eso ya falseó los scores del motor entero.
3. **Todo efecto hacia afuera pasa por `frenoDeSalida()`** (`salida.ts`), o los
   interruptores de apagado y simulación se vuelven mentira para tu función.
4. **UPDATE y DELETE siempre llevan WHERE.**

Y una de forma: **un componente con `client:*` va escrito, nunca desde una
variable**. Astro no puede empaquetar la hidratación de algo que llega en un
mapa: la página sale 200, completa y sin la herramienta.

### Correrlo desde la terminal

```bash
PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH \
  node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/de-probar.mjs resumen      # o: cola, worker, ciclo, geo N, agrupar…
```

`npm run build:local` en vez de `astro build`: el segundo build seguido falla
con `EEXIST` por un directorio que deja el anterior.
