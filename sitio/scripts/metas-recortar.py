#!/usr/bin/env python3
"""Recorta las 41 meta descripciones que pasaban de 160 caracteres.

Google enseña unos 155-160 y corta el resto a media palabra. Una meta de 280
caracteres no es «más completa»: es una de la que el buscador muestra la
mitad, y la mitad que se pierde siempre es la de la derecha.

La regla al recortar: se conserva el vocabulario del ramo que distingue a cada
giro —la corrida, la copa, el colorway, el lote— y se quita lo enumerativo.
Nada se reescribe desde cero: cada texto es el original con menos.

Cada reemplazo exige que el texto viejo exista EXACTAMENTE UNA VEZ en el archivo.
Si no, no toca nada y lo dice. Es lo que impide que un `desc` parecido en otro
sitio del archivo se reescriba por accidente.

    python3 scripts/metas-recortar.py            # aplica
    python3 scripts/metas-recortar.py --check    # solo comprueba largos
"""
import sys, re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOPE = 160

# (archivo, texto viejo, texto nuevo)
CAMBIOS = [
  # ── description="…" literal en .astro ────────────────────────────────────
  ('src/pages/contacto.astro',
   'Agenda una demo de 30 minutos. Cargamos tus productos y datos reales en Sacs para que veas punto de venta, inventario, CRM y reportes funcionando con tu negocio.',
   'Agenda una demo de 30 minutos con tus productos y datos reales: punto de venta, inventario por talla y color, CRM y reportes funcionando con tu negocio.'),
  ('src/pages/giros/bolsas-y-accesorios.astro',
   'Sistema para marcas y tiendas de bolsas y accesorios de piel: el lote con su costo por decímetro, el consumo de cada modelo, el vale de piel del taller, modelo por color y por piel, la reparación y el grabado como servicio, el mayoreo con su piso de precio y la tienda en línea.',
   'Sistema para bolsas y accesorios de piel: lote con costo por decímetro, consumo por modelo, vale de piel del taller, modelo por color y piel, y mayoreo.'),
  ('src/pages/giros/emprendedoras.astro',
   'Sistema para emprendedoras que venden en digital: apartados con fecha que se liberan solos, la fila de las que también preguntaron, una sola existencia para todos tus canales, cobros y comprobantes dentro de la conversación, guías y paquetes desde el mismo pedido.',
   'Sistema para emprendedoras que venden en digital: apartados que se liberan solos, una sola existencia para todos tus canales y cobros dentro de la conversación.'),
  ('src/pages/giros/lenceria.astro',
   'Punto de venta e inventario para lencería: la pared por número y copa, la talla hermana en la caja, la talla de cada clienta en su ficha, vendedoras de catálogo con cartera y campaña, tripacks que no se abren y la regla de higiene en el ticket.',
   'Punto de venta para lencería: la pared por número y copa, la talla hermana en la caja, la talla de cada clienta en su ficha y tripacks que no se abren.'),
  ('src/pages/giros/maternidad.astro',
   'Sistema para boutiques de maternidad y lactancia: la ficha con la fecha probable de parto, el surtido por trimestre y no por temporada, el aviso que sale a tiempo y se puede pausar sin borrar a la clienta, la maleta del hospital y el cruce a lactancia y postparto.',
   'Sistema para boutiques de maternidad y lactancia: la ficha con fecha probable de parto, surtido por trimestre, avisos que salen a tiempo y el cruce a lactancia.'),
  ('src/pages/giros/opticas.astro',
   'Sistema para ópticas: el expediente del paciente con su receta y su reloj de 12 meses, la orden al laboratorio con su fecha prometida, el lensómetro que aprueba contra el número, el cajón de listos con aviso por WhatsApp y el muro de armazones por modelo, color y calibre.',
   'Sistema para ópticas: expediente con receta y reloj de 12 meses, orden al laboratorio con fecha prometida y armazones por modelo, color y calibre.'),
  ('src/pages/giros/outlet.astro',
   'Sistema para outlets y tiendas de saldos: el lote con su costo puesto en el piso, la clasificación al recibir, la bajada que corre sola por tanda, el precio con su descuento sobre el original, la pieza única que no se repone y el cierre del lote con lo que de verdad dejó.',
   'Sistema para outlets y saldos: el lote con su costo puesto en el piso, la bajada de precio que corre sola por tanda y la pieza única que no se repone.'),
  ('src/pages/giros/renta-de-vestidos.astro',
   'Sistema para renta de vestidos de fiesta y trajes: el calendario de cada vestido con sus días de lavado, apartado con anticipo amarrado a la fecha, depósito en garantía con foto de entrega y devolución, la cola de la costurera y el WhatsApp que contesta si está disponible.',
   'Sistema para renta de vestidos y trajes: calendario por vestido con días de lavado, apartado amarrado a la fecha, depósito con foto de entrega y devolución.'),
  ('src/pages/giros/ropa-infantil.astro',
   'Punto de venta e inventario para ropa infantil y bebés: tallas en meses y años ordenadas por edad, la ficha del hijo con su última talla, ticket de regalo sin precio que se cambia en enero, aviso de talla siguiente por WhatsApp y curva por edad para la maquila.',
   'Punto de venta para ropa infantil: tallas en meses y años por edad, la ficha del hijo con su última talla, ticket de regalo sin precio y curva por edad.'),
  ('src/pages/giros/sastreria.astro',
   'Sistema para sastrerías y trajes a la medida: la ficha de medidas del cliente que no se vuelve a tomar, la orden de taller con sus pruebas contra la fecha del evento, la pieza que se descuenta en metros al cortar, el vale de tela del maquilero y las composturas con su contraseña.',
   'Sistema para sastrerías y trajes a la medida: ficha de medidas que no se vuelve a tomar, orden de taller con pruebas contra la fecha y tela en metros.'),
  ('src/pages/giros/tallas-grandes.astro',
   'Sistema para marcas y boutiques de tallas grandes: la corrida de la 36 a la 52 con sus dos patrones base, el motivo del cambio como diagnóstico del patrón, la guía por medidas reales, la orden a la maquila con el consumo por talla y el cambio en línea sin perder a la clienta.',
   'Sistema para tallas grandes: la corrida de la 36 a la 52 con dos patrones base, guía por medidas reales y la orden a la maquila con consumo por talla.'),
  ('src/pages/giros/telas-y-merceria.astro',
   'Sistema para tiendas de telas y mercerías: venta por metro con fracción, la pieza con sus metros restantes y su baño, el saldo que avisa antes de volverse retazo, los avíos por pieza, docena y gruesa, los cuatro precios con medio mayoreo y el fiado de la costurera.',
   'Sistema para telas y mercerías: venta por metro con fracción, la pieza con sus metros restantes, avíos por pieza y docena, y medio mayoreo.'),
  ('src/pages/giros/trajes-de-bano.astro',
   'Punto de venta e inventario para trajes de baño: top y bottom por su lado, sets que descuentan dos piezas, apartados desde Instagram y WhatsApp, tienda en línea con el mismo inventario y el remate a tiempo antes del regreso a clases.',
   'Punto de venta para trajes de baño: top y bottom por su lado, sets que descuentan dos piezas, apartados desde Instagram y WhatsApp y el remate a tiempo.'),
  ('src/pages/giros/uniformes.astro',
   'Punto de venta e inventario para uniformes escolares, empresariales y médicos: listas por escuela que arman el pedido, apartados con anticipo y saldo, el módulo de regreso a clases cobrando sin internet, bordado como orden de servicio y relación de tallas por empleado para facturar.',
   'Punto de venta para uniformes: listas por escuela que arman el pedido, apartados con anticipo, regreso a clases sin internet y bordado como servicio.'),
  ('src/pages/giros/western.astro',
   'Punto de venta e inventario para botas, texanas y ropa vaquera: corridas por número con medios números y horma ancha, texanas por talla, cintos por medida, apartados, la carpa de la feria sin internet y el WhatsApp conectado al inventario.',
   'Punto de venta para botas, texanas y ropa vaquera: corridas por número con medios números y horma ancha, apartados y la carpa de la feria sin internet.'),
  ('src/pages/partners/index.astro',
   'Programa de alianzas de Sacs para fashion retail: orquestadores certificados, consultores y especialistas, referidos con 40 % de por vida y proveedores de tecnología con API y MCP.',
   'Programa de alianzas de Sacs para fashion retail: orquestadores certificados, consultores, referidos con 40 % de por vida y proveedores con API y MCP.'),
  ('src/pages/producto/index.astro',
   'Las ${total} funciones de Sacs para el retail de moda, agrupadas en cuatro etapas: vender, controlar, fidelizar y automatizar. Punto de venta, inventario por talla y color, tienda en línea, mayoreo y más.',
   'Las ${total} funciones de Sacs para moda en cuatro etapas: vender, controlar, fidelizar y automatizar. Inventario por talla y color, tienda en línea y mayoreo.'),

  # ── const desc = '…' en .astro ────────────────────────────────────────────
  ('src/pages/giros/activewear.astro',
   'El sistema para marcas de activewear: drops por colorway con un solo inventario, sets que no se rompen, cambios de talla sin drama y el lote siguiente pedido con datos.',
   'El sistema para marcas de activewear: drops por colorway con un solo inventario, sets que no se rompen, cambios de talla sin drama y el lote con datos.'),
  ('src/pages/giros/boutique-multimarca.astro',
   'El sistema para boutiques multimarca: cada prenda con su marca y su proveedor, consigna separada de lo firme, etiquetado al recibir y el corte que dice qué marca te deja.',
   'El sistema para boutiques multimarca: cada prenda con su marca y proveedor, consigna separada de lo firme, etiquetado al recibir y el corte por marca.'),
  ('src/pages/giros/consignacion.astro',
   'El sistema para consignación y segunda mano: cada pieza con su dueña y su comisión por contrato, Lives con piezas contadas, estado de cuenta y saldo a favor de cada consignante.',
   'El sistema para consignación y segunda mano: cada pieza con su dueña y comisión por contrato, Lives con piezas contadas y estado de cuenta por consignante.'),
  ('src/pages/giros/joyeria.astro',
   'El sistema para joyerías: precio por gramo con tu colchón del fino, factor por quilataje, costo histórico inmutable, repreciar en masa y apartados con precio congelado.',
   'El sistema para joyerías: precio por gramo con tu colchón del fino, factor por quilataje, costo histórico inmutable y apartados con precio congelado.'),
  ('src/pages/giros/merchandising-eventos.astro',
   'El sistema del merch en vivo: POS sin internet, un almacén por módulo, traspasos durante el show, fila con entrega por escáner y el corte por fecha — probado en giras de 100+ puntos de venta.',
   'El sistema del merch en vivo: POS sin internet, un almacén por módulo, traspasos durante el show y corte por fecha. Probado en giras de 100+ puntos de venta.'),
  ('src/pages/giros/novias-y-fiesta.astro',
   'El sistema para novias, XV años y fiesta: apartados con abonos y fecha de evento, muestras que no se venden por error, el taller por etapas y la semana de entregas en una vista.',
   'El sistema para novias, XV años y fiesta: apartados con abonos y fecha de evento, muestras que no se venden por error y el taller por etapas.'),
  ('src/pages/giros/papeleria-y-arte.astro',
   'El sistema para papelerías y tiendas de arte: listas escolares por colegio y grado, kits que el papá desglosa, existencia de toda la cadena en el mostrador y la orden de compra que sale de las listas.',
   'El sistema para papelerías y tiendas de arte: listas escolares por colegio y grado, kits que el papá desglosa y la orden de compra que sale de las listas.'),

  # ── novias por país: una plantilla, once páginas ──────────────────────────
  ('src/pages/giros/novias-y-fiesta/[pais].astro',
   'El sistema para novias, ${pais.xv} y fiesta en ${pais.nombre}: apartados con abonos y fecha de evento, muestras que no se venden por error, el taller por etapas y la semana de entregas en una vista.',
   'El sistema para novias, ${pais.xv} y fiesta en ${pais.nombre}: apartados con abonos y fecha de evento, muestras que no se venden por error y el taller por etapas.'),

  # ── herramientas: la descripción vive en el registro de cada una ──────────
  ('src/lib/demanda/herramientas/curva.ts',
   'Calcula qué proporción de cada talla comprar, corrigiendo por los días que cada talla estuvo agotada. Una talla que vendió poco no es lo mismo que una talla que no estuvo.',
   'Calcula qué proporción de cada talla comprar, corrigiendo por los días que cada talla estuvo agotada. Vender poco no es lo mismo que no haber estado.'),
  ('src/lib/demanda/herramientas/nivelar.ts',
   'Te dice qué piezas mover de qué tienda a cuál para reparar las corridas rotas. No empareja existencias: repara el máximo de corridas con las menos piezas movidas, que es lo que de verdad devuelve ventas.',
   'Te dice qué piezas mover de qué tienda a cuál para reparar corridas rotas. No empareja existencias: repara más corridas moviendo menos piezas.'),
  ('src/lib/demanda/herramientas/temporada.ts',
   'Toma tu sell-through y contesta lo que el porcentaje no dice: si el estilo sale antes de que acabe la temporada, cuántas piezas te van a sobrar si no, y cuál es la última semana útil para hacer algo.',
   'Toma tu sell-through y contesta lo que el porcentaje no dice: si el estilo sale antes de fin de temporada, cuántas piezas sobran si no, y la última semana útil.'),

  # ── buddy: plantilla con variables ────────────────────────────────────────
  ('src/pages/buddy.astro',
   'Regala el primer año del Plan Vende a un amigo empresario. Cuando lo active ganas ${pct}% del valor en créditos Sacs (${fmt(GIFT_ACTIVATION_BONUS_MXN)}), y otro ${pct}% cuando pague su plan. Redímelo en plugins y consultorías.',
   'Regala el primer año del Plan Vende a un amigo empresario y gana ${pct}% del valor en créditos Sacs cuando lo active, y otro ${pct}% cuando pague su plan.'),

  # ── blog: frontmatter de los dos posts ────────────────────────────────────
  ('src/content/blog/machina.md',
   'La marca mexicana que transforma la moda al integrar tecnologia de punta para disenar ropa inteligente y revolucionaria. Descubre su historia, la colaboracion con Nike y estrategias para tu negocio.',
   'Machina, la marca mexicana que integra tecnología en la ropa: su historia, la colaboración con Nike y qué puede aprender de ella una tienda de moda.'),
  ('src/content/blog/bershka.md',
   'La nueva tienda de Bershka en Ciudad de México combina realidad aumentada, espejos inteligentes, pagos contactless y diseño sostenible para transformar el panorama del retail de moda.',
   'La nueva tienda de Bershka en CDMX: realidad aumentada, espejos inteligentes y pagos contactless. Qué puede tomar de ahí una tienda de moda mexicana.'),
]

solo_check = '--check' in sys.argv
ok = fallos = 0
for archivo, viejo, nuevo in CAMBIOS:
    # Las plantillas con ${…} se miden sin la variable: lo que Google ve es el
    # texto renderizado, y un país o un porcentaje son pocos caracteres.
    largo = len(re.sub(r'\$\{[^}]+\}', 'XXX', nuevo))
    if largo > TOPE:
        print(f'  !! {largo} > {TOPE}: {archivo}'); fallos += 1; continue
    if solo_check:
        print(f'  {largo:>3}  {archivo}'); ok += 1; continue

    p = RAIZ / archivo
    s = p.read_text(encoding='utf-8')
    n = s.count(viejo)
    if n != 1:
        print(f'  !! el texto viejo aparece {n} veces (esperaba 1): {archivo}'); fallos += 1; continue
    p.write_text(s.replace(viejo, nuevo, 1), encoding='utf-8')
    print(f'  {largo:>3}  {archivo}'); ok += 1

print(f'\n  {ok} {"comprobadas" if solo_check else "recortadas"} · {fallos} con problema')
sys.exit(1 if fallos else 0)
