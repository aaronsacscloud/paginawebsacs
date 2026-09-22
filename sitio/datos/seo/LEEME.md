# SEO de sacscloud.com · dónde quedó todo (19 y 20-sep-2026)

Esta carpeta es el estado del trabajo de posicionamiento. Vive en el repo y no
en una carpeta temporal a propósito: cualquier sesión o cualquier persona del
equipo tiene que poder retomarlo sin depender de una conversación.

> **Para retomar: empieza por [`DONDE-NOS-QUEDAMOS.md`](DONDE-NOS-QUEDAMOS.md).**
> Ahí está el estado al 22-sep-2026 y qué sigue, por orden de impacto.

## Para retomar el trabajo

Empieza por este archivo, luego `geo.md`, que es el diagnóstico más reciente.

| Archivo | Qué trae |
|---|---|
| `alta-capterra-g2.md` | **Lo accionable ahora.** Campo por campo del formulario de Capterra y de G2, listo para copiar. Los mensajes para pedir reseñas (WhatsApp, correo y recordatorio). Qué tener a la mano antes de empezar. |
| `fichas-externas.md` | La ficha maestra: descripciones de 50, 150 y 500 palabras, categorías, diferenciadores, precios con su base. Es la fuente para que TODAS las altas digan lo mismo, que es lo que hace que una IA reconozca la entidad. |
| `geo.md` | Qué le falta al sitio para que ChatGPT, Claude, Perplexity y Gemini lo citen. Separa lo que se arregla dentro del sitio de lo que depende de terceros. |
| `contenido.md` | Mapa de intención de búsqueda, las 30 búsquedas que más importan y los 12 contenidos a escribir, con su URL y a qué enlazan. |
| `tecnico.md` | Auditoría técnica: títulos, descripciones, encabezados, canónicas, sitemap, enlazado, huérfanas. Casi todo aplicado ya. |
| `estructurados.md` | Los datos estructurados por tipo de página, con el JSON-LD. Aplicado. |
| `indexacion.md` | Mediciones: sitemaps, estado HTTP, contenido delgado, Lighthouse móvil. |
| `decision-subdominios.md` | Los subdominios que gastan los enlaces secundarios de Google y qué hacer con cada uno. **Parado por decisión del dueño.** |

## Estado de las altas

| Destino | Estado |
|---|---|
| Crunchbase | **Hecho (20-sep-2026).** Ficha reclamada y corregida: descripción, industrias, domicilio, logo y fundador. Las ediciones entran a revisión de Crunchbase y tardan de un día a dos semanas en verse. |
| G2 | **Perfil aprobado (20-sep-2026).** G2 asigna las categorías él mismo: cuando llegue el correo con la liga del perfil, hay que revisar que sean de retail de moda y no de software genérico. |
| Capterra (con GetApp y Software Advice) | Pendiente. Alta gratuita en `capterra.com/vendors`. El texto está en `alta-capterra-g2.md`. |
| Reseñas | Pendiente. Es lo que hace que las fichas sirvan: sin reseñas no rankean ni las citan. |
| LinkedIn (perfil de Aaron y página de empresa) | **Hecho (20-sep-2026).** Titular, «Acerca de» y descripción del puesto reescritos en español y en inglés, en contexto de moda. Página de empresa con eslogan, información, especialidades, botón al calendario propio (`/agendar/demo`, ya no el de HubSpot de otra persona) y dato de credibilidad con el 4.7 de Google. Publicación fija escrita. |
| Página de agendado | **Rediseñada (20-sep-2026).** `/agendar/<slug>` lleva panel de marca con logo, las tres pruebas verificables y qué pasa en la llamada. El anfitrión y la duración salen del evento, así que sirve para las 13 rutas. |

## Lo que falta y depende del dueño

1. **Número de empleados** para las fichas. Son 5 de equipo propio más
   consultores externos recurrentes; falta el total para elegir el rango. No se
   inventa: el dato se cruza con LinkedIn y una mentira ahí tumba la
   credibilidad de todo lo demás.
2. **A quién pedirle reseña** en La Bella Pandita, Casa Maca y Sandmade. Los
   casos publicados solo dicen «equipo», sin persona. El único con nombre es
   Liveshow.
3. **Las altas**: Crunchbase (la ficha ya existe y la descripción la pinta como
   ERP genérico, hay que reclamarla y corregirla), G2 y Capterra. Piden cuenta
   y verificación de dominio, así que las hace el dueño.
4. **La ficha de Google de la empresa** anuncia un teléfono retirado (55 3663
   4392); el vigente es el 55 9302 7234.

## Reglas que no se negocian en este trabajo

- La marca se escribe «Sacs», nunca «SACS».
- Todo el contenido se escribe en contexto de moda, con el lenguaje del ramo
  como se habla en México, aunque el tema sea genérico.
- Los precios y las cifras tienen que ser verdad y coincidir con
  `src/data/plans.ts`. De las funciones se habla como existentes; de los
  números, no.
- Las 113 reseñas de Google **no** se marcan como datos estructurados propios:
  marcar una calificación de un tercero como tuya va contra las reglas de Google
  y arriesga los resultados enriquecidos de todo el sitio.
- Nunca se ofrece nada a cambio de una reseña. Capterra y G2 lo prohíben y
  pueden retirar la ficha completa.
