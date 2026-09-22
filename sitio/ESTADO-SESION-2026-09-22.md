# Dónde quedó la sesión · 22-sep-2026

Para retomar sin releer nada. Todo lo de abajo es del CRM (`sitio/`).

---

## 1. Lo que YA ESTÁ EN PRODUCCIÓN y verificado

**Taller**
- Las 4 tarjetas de arriba son el único filtro: Total · Por arrancar · En desarrollo · En espera de tu OK.
- Abajo solo el buscador y `+ Nueva orden`; al lado, una **cajita de filtro**: sin fecha asignada, vencidos, sin dueño, solo mías.
- Dentro de una cuenta: **4 fases** (Por arrancar · En análisis · En desarrollo · **Entregado**), pestañas con el formato de Cotizaciones.
  «Entregado» lee de `mejoras` (lo que el cliente recibió), no de órdenes en etapa entregada — por eso antes salía en 0 mientras el encabezado decía «12 ya entregadas».
- **Selección múltiple en rosa** (el degradado lila→rosa de la casa): casilla blanca con borde morado→rosa que solo aparece al pasar por el renglón, y barra de lote con **Fecha de entrega · Reunión de origen · Módulo · Cortesía o cobro**.
- Columnas alineadas: reunión 168 px, módulo 132 px.
- Menú ⋮ por fila con **Editar / Eliminar**; volver es un icono.
- El drawer de la orden: **1040 px**, velo al 58 %, el **encargo arriba** (resumen + video que dejaste + qué debe mostrar el video de entrega) y **Preguntas** pegadas al folio que caen en Mi bandeja.
- **Los dos reportes también desde el taller** (Trabajo en curso · Reporte de entregas), con los mismos componentes que en la ficha.
- `+ Nueva orden` sabe dónde estás: dentro de un proyecto dice «para Rubens» y trae la cuenta puesta.

**Módulos**
- El catálogo es el **menú real de SACS** (`sacs3/src/elem/lateral/lateral.js`), 16 familias / ~130 entradas, con la suite de **Joyería** completa. Siempre de selección, con la familia del giro arriba.
- Son DOS listas a propósito: `MODULOS_SACS` (vocabulario del puente, 17 nombres, alimenta el Outbound) y `MENU_SACS` (dónde se trabaja). `esModuloValido()` acepta las dos.

**Documentos del cliente**
- **Reporte de entregas**: piel verde, filtro por módulo antes de generar, y el subtítulo dice «solo Reparaciones / taller» cuando va acotado.
- **Trabajo en curso**: modular por módulo, con «Qué pasa hoy» + «Qué va a cambiar», el botón **«Ver lo que pedimos»** (el video del encargo) y piel rosa.
- **Estrellas opción C** en los dos: portada, banda de cifras y banda de cada módulo, con el sello **«Aquí se pule cada estrella»**.

---

## 2. Lo que está COMMITEADO Y SIN SUBIR

```
ffaca6f9  El reporte del lead: la migración, los hechos, el API y el documento
acbddd2a  La ficha del lead: cada cosa en su lugar, y lo que se habló por fuera
c7540441  Cola: el link de consultoría con horarios y calendario
```

**La ficha del lead (acbddd2a) está terminada y probada.** Opción A:
- Pestaña nueva **«Cómo llegó»** con todo lo de adquisición (salió de Info general).
- Info general = **tres tarjetas** como las del cliente: El negocio · Quién decide · Qué necesita.
- Reuniones con chip **Demo / Consultoría / Seguimiento** y «Se acordó:» + «Siguiente:» leídos de la minuta.
- Pestaña nueva **«Conversaciones»**: lo que se habló por fuera del CRM (otro número, grupo, llamada). Se guarda como actividad con `metadata.fuera_crm`, así que cuenta como toque.

---

## 3. LO QUE FALTA — por aquí se retoma

### 3.1 · Terminar el reporte del lead  ← lo primero
Está hecho: la migración (corrida y verificada), `reunirLead()`, el API (`tipo:'lead'` + `booking_id`) y `_Lead.astro` con su piel `.doc-lead` verde→rosa.

**Falta:**
1. El **botón que lo genera** desde la ficha del lead, en la pestaña Reuniones, en cada junta que tenga minuta. Un modal chico con dos campos: **porcentaje** (35 por defecto) y **vigencia** (hoy + 14 días), y el botón Generar → liga + copiar + enviar, como `ReporteEntregas.tsx`.
2. **QA de punta a punta**: generar uno con la minuta real de Jeen (`contacts.nombre ilike '%jeen%'`), abrir la liga, revisar el degradado y borrar el reporte de prueba.

El diseño aprobado está en `/opt/sacs/shots/reporte-lead.html` y en
https://code.sacscloud.com/shots/322166a073ecd202.png
Dos reglas del dueño ya aplicadas: **verde → rosa**, y el **cupón al cierre**, nunca a media lectura.

### 3.2 · El link de consultoría (en `COLA.md`)
> «necesito que en esta sección puedas darme la opción para mandar a los clientes al link de consultoría para que lo puedan agendar y aparezca en mi calendario de lunandreajagmail.com, necesito configurar los horarios de atención y tiene que estar ligado a mi calendario para que no agende en las cosas que ya tengo»

Es la pantalla de **Reuniones** (las tarjetas por tipo). Antes de escribir código hay que ver qué tanto ya existe: `event_types`, la página pública de agenda y la conexión de Google Calendar por `host_id` (memoria `crm-agenda-identidad-google`).

### 3.3 · Pendiente viejo
- **El faro de Clientes**: la tarjeta KPI en degradado lila de la lista de Clientes es la única que queda con degradado. ¿Blanca como las demás o excepción de marca?
- De `COLA.md`: la banda de destellos en Onboarding, Churn, Cobranza y Renovaciones.

---

## 4. Trampas que ya costaron caro — no repetirlas

1. **`_estilos.ts` es un template literal.** Un backtick dentro de un comentario corta la cadena y el error sale como `Expected ";" but found "aria"`, a cincuenta líneas del problema. Ahí las comillas van « ».
2. **Un `.astro` con guion bajo dentro de `src/pages/` no se puede importar**: Astro lo saca del grafo y el import muere con «failed to load module for SSR». Por eso `ChispasDoc.astro` vive en `components/reporte/`.
3. **Veed no se deja incrustar** (`X-Frame-Options: sameorigin`). YouTube, Vimeo, Loom y los `.mp4` sí.
4. **El servidor se queda sin memoria**: cada `astro dev` que se deja vivo se come ~2 GB y el siguiente muere con «Cannot read properties of undefined» en `navigation.ts`. Levantar uno nuevo en otro puerto y no acumularlos.
5. **Otras sesiones trabajan el mismo repo** y hacen `git add -A`: varios commits míos salieron dentro de los suyos con otro SHA. Verificar con `git log -S` que el código está en `origin/main`, no que el SHA exista.

---

## 5. Cómo se trabaja aquí (recordatorio)

- Prototipo primero → el dueño elige → se implementa → QA con navegador y sesión real → commit → push **solo cuando él diga** «sube».
- Los prototipos se mandan **como PNG** (`SendUserFile` + `shot`): el `shot` de un `.html` lo sirve con tipo `image/png` y el navegador no lo abre.
- Todo QA contra la base de producción se **revierte** al terminar, incluidas las líneas de bitácora.
