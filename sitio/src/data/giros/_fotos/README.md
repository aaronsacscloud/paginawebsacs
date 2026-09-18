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

---

## Estado real al 18-sep-2026, 00:30 UTC

**237 de 265 fotos generadas.** Los créditos se acabaron a media cola por segunda
vez. Lo que falta está escrito y listo para correr en `scratchpad/giros/pendientes.sh`:
10 de outlet, 15 de emprendedoras y dos cortinas por rehacer.

| giro | generadas | referee de identidad |
|---|---|---|
| uniformes | 23/23 | **4 de 23** pasan |
| lencería | 20/23 | pendiente |
| renta de vestidos | 22/22 | **1 de 22** pasa |
| ropa infantil | 21/21 | **6 de 21** pasan |
| sastrería | 22/22 | en revisión |
| ópticas | 22/22 | en revisión |
| telas y mercería | 22/22 | **11 de 22** pasan |
| bolsas y piel | 22/22 | pendiente |
| tallas grandes | 22/22 | pendiente |
| maternidad | 22/22 | pendiente |
| outlet | 12/22 | pendiente |
| emprendedoras | 7/22 | pendiente |

## Lo que el referee de identidad reprueba, por orden de frecuencia

Esto es lo que de verdad hay que escribir en los prompts desde el principio. Sale
de cuatro dictámenes seguidos, no de una corazonada.

1. **LA CORTINA. Falla SIEMPRE.** El «después» sale con otra mujer, en otra
   tienda, con otra ropa. Repetir el bloque de personaje palabra por palabra no
   bastó ni una sola vez. **La solución es generar el «después» con el «antes»
   como imagen de referencia** (`gen-ref.mjs` con `ref` y `refNota`), que es lo
   único que ancla la cara. Hacerlo así desde el principio ahorra una vuelta
   entera por giro.
2. **Manos y cuerpos.** Dedos fundidos en mitón, una mano huérfana sin dueño, una
   mujer sin brazo, un cuerpo sin cabeza sosteniendo una gasa, brazos estirados
   imposibles. Hay que pedir manos completas y que se vea quién sostiene cada cosa.
3. **Cosas que flotan.** Una bolsa en el aire, un gancho dentro de una funda sin
   colgar de nada, una pieza de tela de 20 kilos cargada al hombro sin manos.
4. **Texto inventado.** Bordados mal escritos («J. Hennandez»), calendarios con
   números garabateados, billetes con leyendas, logos en la espalda de un
   uniforme. La prohibición hay que repetirla en CADA escena, no solo en la regla
   general.
5. **Pantallas apagadas o de espaldas.** Una tablet en gris, o mostrando su tapa
   trasera, no cuenta como «la pantalla del sistema».
6. **Deja de verse el oficio.** Sale una boutique europea de centro comercial en
   vez de una tienda de uniformes de calle, o camisas de vestir en vez de
   uniformes escolares. Cada escena necesita dos o tres señales concretas del
   giro.
7. **Las fotos de producto no son el mismo producto.** Cuatro colores de la misma
   playera salieron con distinto número de botones y distinto corte. Se generan
   con un prompt base idéntico donde solo cambia la palabra del color.
