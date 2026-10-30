# Vende Tu Clóset — Flujos de trabajo por área

Documentos de consultoría de Sacs × Andy Araujo Consultorías para Vende Tu Clóset
(cuenta `vendetucloset`). Son páginas HTML autocontenidas: se abren directo en el navegador.

| Archivo | Qué es |
|---|---|
| `flujos-y-mejoras-contempladas-vtc-para-firma-2026-10-30.html` | **Versión para firma (vigente).** «Flujos de trabajo y mejoras contempladas para VTC», visita del 19 al 24 de octubre de 2026, con firmas de conformidad de Sacs y de Regina Alarcón. Organizada por área: cada área trae su avance, flujo, mejoras, flujos integrales y lo que falta decidir. 59 mejoras sin duplicados (CON-03 y PRE-10 → PRE-02, DIR-03 → VEN-07, LOG-03 → LOG-01, PayPal de CTB-03 → ECO-03), 60 flujos y 25 decisiones (16 preguntas + 13 reglas, unificadas). Tablero de gestión con checks compartidos: se guardan en la base del artefacto, colección `seguimiento` (ids `m-CLAVE`, `f-NN`, `d-con|pre|eco|ven|log|ctb|dir-N`). Sección «Revisión por puntos»: los 144 puntos numerados por área (1.1, 1.2…) con «Se queda / Se va» y comentario; se guardan en los mismos documentos, campos `revision` (`queda`|`va`) y `nota`. Publicada en `claude.ai/artifact/CHn51BVMgkK1AN6BEQjqJC`: ahí se firma en línea (las firmas quedan guardadas en la base del artefacto, colección `firmas`, documentos `sacs` y `vtc`). Este archivo local muestra las líneas para firmar a mano. |
| `flujos-por-area-v2-2026-10-30.html` | Versión 2. La v1 + el modelo integral de 60 flujos, 13 decisiones de dirección, 7 criterios de aceptación y el anexo de los 77 hallazgos. |
| `flujos-por-area-v1-2026-10-21.html` | Versión anterior (reuniones del 20 y 21 de octubre): 7 áreas, 56 mejoras, 16 reglas por confirmar. Copia de lo que estaba publicado en `claude.ai/artifact/X2Krr8v6cLo6J3detjo6Ty`. |
| `fuentes/` | Documentos fuente: modelo integral (PDF, v1.0 del 29 oct), requerimientos de mejoras operativas (O), flujos de taller puntos 1 al 8 (T), requerimiento de alta del consignante (A) y la mejora de sugerencia de precios (P). |
| `generador/` | Cómo se arma la v2 desde la v1 y el PDF, para no transcribir a mano. |

## Regenerar

Versión para firma: `build_v3.py` (portada y firmas) sobre la v2 luego `build_v4.py` (mejoras de T, A y P) `build_v5.py` (por área, sin duplicados, tablero y checks) y `build_v8.py` (revisión por puntos + Consignación consolidada: un punto por tema; reemplaza a build_v5–v7), cada uno sobre la salida completa del anterior.

### v2

```bash
pdftotext fuentes/modelo-integral-flujos-v1.0-2026-10-29.pdf /tmp/plano.txt
python3 generador/parse.py /tmp/plano.txt /tmp/flujos.json   # 60 flujos, 13 decisiones, 7 criterios
# (los 77 hallazgos del anexo ya vienen en generador/modelo-integral-flujos.json)
python3 generador/build.py <v1 con la línea del runtime> generador/modelo-integral-flujos.json salida.html
```

`build.py` espera la v1 tal como la devuelve el artefacto publicado (la línea 1 es el runtime de la
plataforma y se descarta). Para cambios de contenido, lo directo es editar el HTML de la versión vigente.
