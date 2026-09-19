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

---

## Estado al 18-sep-2026, 22:15 UTC — 265 de 265 generadas, tres rondas

| giro | ronda 1 | ronda 2 (tras correcciones) | cortina |
|---|---|---|---|
| uniformes | 4 de 23 | 14 de 23 · 9 recompuestas en ronda 3 · **las 23 aprobadas en ronda 4** | **resuelta** |
| renta de vestidos | 1 de 22 | 19 de 22 · 3 recompuestas en ronda 3 · **las 22 aprobadas en ronda 4** | **resuelta a 10** |
| telas y mercería | 11 de 22 | 21 de 22 · prod-negro aprobado en ronda 6 · prod-azul en ronda 8 con el prompt exacto del negro (al arreglar uno, otro hermano quedó desentonado: los cuatro deben salir del MISMO prompt) | **resuelta** |
| ópticas | 5 de 22 | 21 de 22 · 1 recompuesta | **resuelta** |
| sastrería | 1 de 22 | 21 de 22 · caso-regresa reprobada seis veces por manos; en ronda 8 se quita a la gente del cuadro (saco listo en el gancho, cliente desenfocado en la puerta) | **resuelta** |
| ropa infantil | 6 de 21 | 17 de 21 · 4 en ronda 3 · **las 21 aprobadas** | **resuelta** |
| bolsas y piel | 4 de 22 | 21 de 22 · el «antes» rehecho en ronda 3 · **las 22 aprobadas** | **resuelta, par confirmado** |
| maternidad | 0 de 22 (2 retiradas por dignidad) | **las 22 aprobadas · cero fallas de dignidad** | **resuelta** |
| tallas grandes | 9 de 22 | **las 22 aprobadas en ronda 2** · 4 rehechas con discos en blanco (aprobadas en ronda 7); el giro queda 38-52 + discos lisos, ya sin 14-24 | **resuelta, par confirmado** |
| outlet | 10 de 22 | **las 22 aprobadas en ronda 2** | **resuelta, par confirmado** |
| emprendedoras | 9 de 22 | **las 22 aprobadas en ronda 2** · el cuarteto de blusas salió parejo a la primera (altura 899-914 px en las cuatro) | **resuelta, par confirmado** (mismo cuarto de casa) |
| lencería | 7 de 23 (2 retiradas por dignidad) | **las 23 aprobadas en ronda 2** · cero fallas de dignidad · calcetería recortada por el borde izquierdo (dos empaques desenfocados que a 5x parecían un torso) · vino, blanco y nude del cuarteto rehechos con el negro como imagen de referencia (al emparejar tres, el cuarto quedó de primo: el cuarteto se rehace COMPLETO o no se rehace) · probador recompuesto (la prenda ya no se encima con el cuerpo) | **resuelta, par confirmado** |

**Lo que se retiró de producción por dignidad, y por qué.** Cuatro fotos en total:
dos de maternidad (empaques y un cartel impresos con mujeres en ropa interior) y
dos de lencería (catálogos impresos con modelos en ropa interior). Las mujeres
reales de las escenas iban todas vestidas: el problema era lo IMPRESO en el
decorado. Se sustituyeron por una foto limpia del mismo giro el mismo día y se
regeneran con la escena cambiada (catálogos cerrados o de canto, empaques lisos).

## Lo que enseñaron las tres rondas

**1. La cortina se resuelve con imagen de referencia, y con nada más.** Falló en
los siete giros con el bloque de personaje repetido palabra por palabra. Con el
«antes» pasado como referencia al generador (`gen-ref.mjs`), salió resuelta en
los siete a la primera. En renta salió a 10: misma cara, mismo chongo, misma
cinta métrica, la misma pulsera de chaquira. **Desde el próximo giro, el
«después» se genera así desde el principio.**

**2. Cuando el generador repite un defecto, prohibirlo no sirve: hay que cambiar
la escena.** Doce fotos fallaron dos veces seguidas con EXACTAMENTE el mismo
error aunque el prompt corregido lo prohibía (la tablet de espaldas, el bordado
con nombre mal escrito, la bolsa flotando, la corrida de tallas absurda). No era
el prompt: el modelo insiste. La tercera ronda las recompuso para que el error
no tuviera dónde aparecer —la tablet se volvió una laptop abierta hacia la
cámara, el bordado un escudo geométrico sin letras, la bolsa quedó en las dos
manos de la empleada— y así pasaron.

**3. Las portadas van en vertical.** El banner las dibuja en 4/5 y se generaban
apaisadas: el navegador recortaba media escena. El generador ya respeta
`"vertical": true` por escena.

**4. Los cuatro productos se generan con un prompt base idéntico donde solo cambia
la palabra del color**, y se fija la escala («fills 70 percent of the frame
height») para que no salgan de tamaños distintos.

**5. Lo impreso dentro del cuadro también cuenta.** Dos fotos de maternidad
traían empaques y un cartel con mujeres en ropa interior. La regla de dignidad
tiene que decir explícitamente que ninguna imagen impresa en la escena (cajas,
carteles, pantallas, catálogos) puede mostrar cuerpos descubiertos.

**6. El cuarteto se rehace completo o no se rehace.** «Fills 70 percent of the
frame height» no basta: el generador tira anchos distintos y cambia el gancho o
el rollo. La forma que sí funciona es la misma de la cortina: se aprueba UNO, y
los otros tres se generan con ése como imagen de referencia diciendo «cambia
SOLO el color». Y si se corrige uno solo, el que se quedó fuera se vuelve el
raro: en lencería se emparejaron vino y blanco con el negro y el nude, que nadie
tocó, pasó a desentonar; en telas pasó igual con el azul cuando se arregló el
negro. Se tocan los cuatro en la misma tanda.

**7. Cuando una foto lleva seis rondas reprobada por manos, se quita la gente.**
`sastreria/caso-regresa` falló seis veces por dedos de más, manos sin palma y
brazos huérfanos, con el cliente de frente, de espaldas y con solo las manos del
sastre en cuadro. Pasó a la séptima cuando la escena dejó de tener personas en
foco: el saco terminado colgado en su gancho y el cliente como silueta
desenfocada en la puerta. Dice lo mismo y no tiene dónde equivocarse.

**8. A veces no hay que regenerar, hay que recortar.** En
`lenceria/proceso-calceteria` el problema eran dos empaques desenfocados de la
esquina superior izquierda que a 5x se leían como un torso. Recortar 245 px por
la izquierda lo resolvió sin gastar una imagen, y de paso el 1.26:1 resultante
le queda mejor al marco 4/3 del componente que el 1.5:1 original.

**9. Antes de cerrar un giro, mide la portada.** El banner la dibuja en 4/5
vertical y tres giros (western, trajes de baño y lencería) se habían quedado
apaisadas: el navegador se comía media escena sin avisar. El chequeo es una
línea y vale la pena correrlo sobre todas:

```bash
python3 -c "
from PIL import Image; import glob
for f in sorted(glob.glob('public/images/giros/*/portada.webp')):
    w,h=Image.open(f).size
    if w>=h: print('HORIZONTAL', f)"
```

Y cuidado al regenerar una portada desde el JSON viejo del giro: esos prompts
son de la tanda apaisada y no traen `"vertical": true`. Los verticales están en
`portadas.json`.

**10. La portada tiene que ser el MISMO local que las zonas.** La de lencería
salió boutique europea —muro blanco, herrajes dorados, banco de terciopelo,
espejo arqueado— mientras `zona-mostrador` y `zona-probador` son pared verde,
loseta y mostrador de melamina. Parecían dos negocios. En el prompt de la
portada se nombran los materiales concretos de las zonas ya aprobadas.

**11. En trajes de baño y lencería, el generador viste al maniquí con la
mercancía.** La barrida de dignidad encontró 10 de 22 fotos del giro de trajes
de baño fuera de regla, y seis eran el mismo error: un maniquí, un busto o una
figura de aparador con el bikini puesto, casi siempre en un ventanal o al borde
del cuadro, donde no se busca. Las otras cuatro eran empleadas o clientas con el
traje puesto y un catálogo impreso con cuerpos. Decir «nadie en ropa interior»
no basta: hay que prohibir **el maniquí, el busto, el torso y la figura de
aparador**, en cualquier parte del cuadro, borrosos y a través de ventanales, y
exigir que la mercancía se quede en gancho, doblada, en caja o en bolsa.

El texto que sí funcionó, palabra por palabra, está en `ronda15.json`. Conviene
pegarlo tal cual en todo giro cuya mercancía se usa sobre el cuerpo.

**12. La barrida de dignidad se corre al final, giro por giro, sobre TODAS las
fotos.** El referee de identidad revisa las que se corrigieron; las fallas de
dignidad estaban en fotos que ya habían pasado. Y ojo con dónde viven: los giros
viejos no tienen carpeta, sus fotos están planas en `public/images/` con
prefijos (`hero-`, `suite-`, `caso-`, `proc-`, `plano-`). Ahí aparecieron tres
más: dos laptops de activewear con un catálogo de torsos recortados en la
pantalla y una mujer en bralette en la trastienda de multimarca.

### Barrida de dignidad de todo el sitio, 19-sep-2026

Se revisaron los 24 giros, foto por foto, con la regla completa. Resultado:

| giro | fotos | fuera de regla | qué tenían |
|---|---|---|---|
| trajes de baño | 23 | **12** | seis maniquíes y bustos con el traje puesto, empleadas y clientas con el traje o con recortes en la ropa, un catálogo impreso con cuerpos |
| activewear | 24 | 2 | las dos laptops mostraban en pantalla un catálogo de torsos recortados |
| boutique multimarca | 24 | 1 | la mujer del fondo de la trastienda, en bralette |
| joyería | 19 | 1 | un cuadro al fondo con una figura reclinada desnuda |
| merch de eventos | 22 | 1 | una mujer con malla transparente sobre bralette |
| lencería | 23 | 2 (ya corregidas antes) | catálogos impresos con modelos en ropa interior |
| maternidad | 22 | 2 (ya corregidas antes) | empaques y un cartel con mujeres en ropa interior |
| los otros 17 | — | 0 | — |

Las 19 se rehicieron y las 19 pasaron la revisión. **Criterio que se aplicó y
conviene mantener:** un busto o maniquí VESTIDO en una tienda de ropa es mueble
normal de tienda y no incumple; lo que incumple es el maniquí o busto con la
mercancía puesta cuando esa mercancía va sobre el cuerpo desnudo (traje de baño,
lencería). Por eso los tres bustos vestidos de marcas de ropa se dejaron como
están.
