# Canal de YouTube · lo que quedó pendiente el 18-sep-2026

La cuota diaria de la API son **10,000 unidades** y cada `videos.update` cuesta
**50**: doscientos videos por día como tope duro. Se agotó a media tanda.

## Cuando reinicie la cuota (medianoche hora del Pacífico)

```bash
cd /opt/sacs/paginawebsacs/sitio
node scripts/yt-aplicar.mjs --dry --saltar-revisar   # ver qué falta
node scripts/yt-aplicar.mjs --saltar-revisar         # aplicarlo
```

El script es **idempotente**: salta lo que ya coincide, así que no gasta cuota
reaplicando. Van a salir los 6 que fallaron y nada más.

## Y ocultar este, que el dueño confirmó que ya no está vigente

```bash
node scripts/yt-ocultar.mjs Q8d3jWz4HnI   # 🗺️ Conoce la plataforma · 146 vistas
```

Es un recorrido por el sistema con pantallas que ya cambiaron. Ocultar
(`privacyStatus: private`) y NO borrar: consigue lo mismo —que nadie lo vea— y
se deshace con un clic; borrar en YouTube es definitivo y se lleva las vistas y
cualquier enlace que alguien haya puesto en otro lado.

## Estado al cierre del día

| | |
|---|---|
| Videos del canal | 509 |
| Retitulados y con descripción nueva | **214** |
| Ocultados | 3 (corporativo español e inglés, canal de ayuda) |
| Pendientes de aplicar | 6, por cuota |
| Pendiente de ocultar | 1 (`Q8d3jWz4HnI`) |

## Respaldo

`yt-respaldo-2026-09-18.json` tiene el título, la descripción y las etiquetas
**anteriores** de cada video tocado. La API de YouTube no guarda historial: ese
archivo es el único deshacer que existe.

`/tmp/yt-ocultados.json` tiene la visibilidad anterior de los ocultados — pero
vive en `/tmp`, así que si importa conservarlo hay que moverlo aquí.
