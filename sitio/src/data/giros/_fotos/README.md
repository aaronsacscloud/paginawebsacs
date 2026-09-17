# Las colas de fotos de los giros (17-sep-2026)

Cada JSON es la lista de escenas de un giro, en el formato que come el generador:
`[{ "file": "<prefijo>-<nombre>", "escena": "<prompt en inglés>" }]`. Están aquí, en el repo,
porque **costaron cuatro referees cada una** y porque el scratchpad de una sesión se borra.

| Archivo | Giro | Fotos |
|---|---|---|
| `un-pend.json` | Uniformes (las 12 que faltaron cuando se acabaron los créditos) | 12 |
| `fix-r4.json` | Refotos de las 7 páginas viejas que no pasaron el referee | 3 |
| `le.json` | Lencería y ropa interior | 23 |
| `re.json` | Renta de vestidos y trajes | 22 |
| `ri.json` | Ropa infantil y bebés | 21 |
| `sa.json` | Sastrería y trajes a la medida | 22 |
| `op.json` | Ópticas | 22 |
| `tm.json` | Telas y mercería | 22 |
| `bo.json` | Bolsas y accesorios de piel | 22 |
| `tg.json` | Tallas grandes | 22 |
| `ma.json` | Maternidad y lactancia | 22 |
| `ou.json` | Outlet y saldos | 22 |
| `em.json` | Emprendedoras que venden en digital | 22 |

**Total: 257 fotos** esperando créditos de OpenAI.

**El nombre del archivo manda.** Cada `file` corresponde, sin el prefijo, al nombre que la página
ya espera en `/images/giros/<slug>/<nombre>.webp`. Si se renombra una escena aquí, la página se
queda sin esa foto.

**Reglas que ya cobraron su precio en este proyecto:**

- Las dos escenas de la cortina (antes y después) llevan **el bloque de personaje y el de cámara
  repetidos palabra por palabra**. Decir "the same employee" no basta: salen dos personas distintas.
- gpt-image-2 **rechaza por seguridad** probadores con poca ropa, ropa interior puesta y menores sin
  ropa. Las clientas van vestidas y fuera del probador; los niños, vestidos y acompañados.
- Nada de texto legible, logotipos ni marcas, tampoco en las pantallas: se describen como interfaz
  sin palabras.
- Las `prod-*` son foto de producto sobre fondo blanco, sin modelo.

Cómo se corren: `scratchpad/giros/reanudar.sh` (las doce colas en orden), y luego por cada giro
`instala.sh <prefijo> <slug>`, que las deja en `public/images/giros/<slug>/` a 1600 px y calidad 82.
