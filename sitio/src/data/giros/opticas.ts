/**
 * Contenido de la landing de ÓPTICAS (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/opticas.md), aprobada por un óptico con 30 años de oficio y 20
 * sucursales: armazón (no montura), micas (no cristales), la receta, el gabinete, el muro, la
 * charola, el tallador, el lensómetro, las delgaditas, el cajón de listos, la fuga de receta, la
 * nota, el acuse de entrega, vista cansada y su caja. En el gabinete es paciente; en el mostrador
 * y en la boca del dueño es cliente, y aquí se alterna a propósito.
 *
 * Verdades del oficio que no se pueden contradecir: el seguro de gastos médicos en México es por
 * REEMBOLSO (el cliente paga todo aquí y él le cobra a su aseguradora); el rayado por uso NO es
 * garantía —lo que sí entra es el antirreflejo craquelado, el eje mal tallado y el defecto de
 * fábrica—; buena parte del ticket alto llega con receta del oftalmólogo, no del gabinete; y el
 * armazón se vende solo (contar cuántos salen solos es contar la fuga de receta).
 *
 * El eje de la página: la receta manda. El trabajo se aprueba contra un número —el lensómetro dice
 * si la mica dio -2.25 eje 90 o no dio— y la receta trae un reloj de 12 meses que dice cuándo
 * vuelve el paciente. Más el cajón de listos: lentes terminados que nadie recoge.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): almacén "en lab", consignación y
 * comodato del muro, canje de colección, cobranza por abonos, expediente del cliente con su
 * receta, receta del oftalmólogo con la foto de la hoja, expediente como dato de salud con
 * permisos, cédula y responsable por sucursal, agenda del gabinete con turnos, orden de trabajo al
 * laboratorio con estados, revisión en lensómetro como paso obligado, "ya están listos" disparado
 * por la orden, los pendientes de entrega, acuse de entrega firmado, motivo de garantía
 * tipificado, los 30 días de adaptación del progresivo, recordatorio por fecha de receta,
 * pupilentes con lote y caducidad, armazón con y sin micas, precio de convenio por empresa e
 * institución, descripción y separación por concepto en la factura, comisión por mica y
 * tratamiento amarrada a metas, costo real por orden, cuántos compran de cada diez examinados y
 * las señales de IA del giro.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/opticas';

export const bannerOP = {
  eyebrow: 'SACS · Ópticas',
  titulo: 'La receta manda.',
  resalte: 'Y trae fecha.',
  sub: 'El expediente con su receta —esfera, cilindro, eje, adición, DIP y quién la firmó—, la orden de trabajo al lab con su fecha de entrega, el lensómetro que aprueba antes de avisarle a nadie, el “ya están listos” con el saldo que debe, el cajón de listos con los días sin recoger y la lista de a quién le toca su examen este mes.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Óptica moderna en México con el muro de armazones iluminado y la orden de trabajo en la tablet del mostrador',
  avisos: [
    { modulo: 'Ya están listos', texto: 'Sra. Ruiz · progresivo con antirreflejo · revisado en lensómetro · debe $1,450', pos: 1 as const, tono: 'verde' as const, sello: 'Hoy' },
    { modulo: 'El cajón', texto: '14 pares sin recoger · 6 pasan de 15 días · te deben $12,600', pos: 2 as const, tono: 'rojo' as const, sello: 'Agosto' },
    { modulo: 'Le toca su examen', texto: '38 recetas cumplen 12 meses este mes · el WhatsApp sale con su nombre', pos: 3 as const, tono: 'azul' as const, sello: 'Septiembre' },
  ],
};

export const manifiestoOP = {
  intro: 'Sabemos cómo se trabaja en una óptica',
  frases: [
    'Traes <b>doce pares en el cajón</b>, ya le pagaste las micas al lab y el cliente ni contesta el WhatsApp.',
    'La graduación se la tomaste hace <b>año y medio</b> y nadie le ha hablado. Se fue a hacer sus lentes con el de enfrente.',
    'Le subiste progresivo y <b>no se adaptó</b>. Dos retallados, acabaste poniéndole bifocal y el costo te lo comiste tú.',
    'Llegó con la <b>receta del doctor</b>, se copió mal el eje, y el lab dice que él hizo lo que decía la orden. El retallado lo pagas tú.',
    'Vendiste el mismo armazón por <b>WhatsApp y en el piso</b> el mismo día. Y el que ya iba en la ruta del martes seguía apareciendo en existencia.',
    'La receta está en el <b>cuaderno de la optometrista</b>. Si ella falta, nadie sabe qué pedirle al lab.',
    'En regreso a clases el lab se satura, la <b>fecha de entrega se corre</b> y tú no sabes a quién ya le prometiste qué día.',
    'No sabes cuánto le ganas de verdad a una orden: el armazón sí, pero la <b>mica, el antirreflejo y el flete</b> se te pierden.',
  ],
  cierre: 'Ningún punto de venta entiende que aquí el producto no se aprueba contra un gusto sino contra un número —quedó en -2.25 eje 90 o no quedó, y lo dice el lensómetro—, que el armazón sale del muro días antes de que el cliente lo tenga, ni que la receta es un activo con fecha. Sacs sí: cada pantalla que sigue funciona igual en el gabinete, en el mostrador, en el lab y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el “ya están listos”, el recordatorio a los 7, 15 y 30 días sin recoger y el “le toca su examen” a los 12 meses.',
};

export const variantesOP = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el armazón negro”.',
  sub: 'Un armazón no es un artículo: es modelo, color y medida. El mismo modelo vive en cuatro o seis colores y en dos o tres calibres, y el 52 se pide tres veces más que el 46 y el 56. Y el armazón no trae código pegado: se cuenta charola por charola, leyendo la varilla.',
  ejeA: ['46', '48', '50', '52', '54', '56'],
  filas: [
    { nombre: 'Metal · negro', img: `${IMG}/prod-metal.webp`, alt: 'Armazón de metal negro con varillas delgadas' },
    { nombre: 'Pasta · carey', img: `${IMG}/prod-pasta.webp`, alt: 'Armazón de pasta color carey' },
    { nombre: 'Solar · café', img: `${IMG}/prod-sol.webp`, alt: 'Armazón solar con mica café degradada' },
    { nombre: 'Infantil · azul', img: `${IMG}/prod-infantil.webp`, alt: 'Armazón infantil azul flexible' },
  ],
  matriz: [
    [3, 4, 2, 0, 1, 4],
    [2, 3, 3, 0, 0, 3],
    [1, 2, 4, 1, 2, 5],
    [5, 4, 3, 2, 0, 0],
  ],
  unidad: 'armazones',
  genero: 'm' as const,
  leyendas: ['Con existencia', 'Quedan pocos', 'Agotado'] as [string, string, string],
  remate: 'El 52 y el 54 ya se fueron y quedan los calibres de las puntas. Y falta el estado que ningún reporte enseña: el armazón que ya salió del muro porque va en la ruta del martes. El sistema decía que tenías tres; en la pared hay uno.',
};

export const cortinaOP = {
  titulo: '“¿Ya están mis lentes?”',
  pieAntes: 'El cuaderno de la optometrista,<br />y el cajón lleno bajo el mostrador.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedora de una óptica buscando en el cuaderno de recetas y en el montón de órdenes de trabajo si ya llegaron unos lentes del laboratorio',
  altDespues: 'La misma vendedora mostrando en la tablet la orden de trabajo revisada en lensómetro y el aviso de listos por WhatsApp',
  libreta: ['Sra. Ruiz — ¿ya llegó del lab?', 'Eje del doctor — ¿90 o 190?', 'Niño Pérez — ¿cuánto debe?'],
  filas: [
    { que: '“¿Ya están mis lentes?”', donde: 'La orden de trabajo', dato: 'Llegó del lab el martes y pasó el lensómetro ayer: dio -2.25 eje 90. Debe $1,450 y el “ya están listos” salió solo' },
    { que: '¿Qué decía la receta?', donde: 'El expediente del cliente', dato: 'Esfera, cilindro, eje, adición, DIP y altura, con su fecha, quién la firmó y la foto de la hoja del oftalmólogo' },
    { que: '¿En cuál sucursal está el negro 52?', donde: 'Existencias por sucursal', dato: 'En la otra tienda hay dos; el de aquí ya salió del muro y está marcado “en lab”, no en existencia' },
    { que: '¿A quién no le hemos hablado?', donde: 'El cajón de listos', dato: '14 pares sin recoger, 6 pasan de 15 días y te deben $12,600; el mensaje sale con su nombre y su saldo' },
  ],
  pieDespues: 'La misma vendedora, el mismo cliente. Ya no busca en el cuaderno: abre la orden.',
};

export const casosOP = [
  {
    id: 'escolar',
    titulo: 'Agosto: regreso a clases, cuando el lab se atrasa',
    texto: 'Cien órdenes en dos semanas, casi todas de niño con policarbonato. El lab se satura, la fecha de entrega se corre y el papá se enoja. El tablero de órdenes en proceso ordena por fecha de entrega, pinta en rojo las vencidas y manda el aviso de “se va a tardar dos días más” antes de que el cliente pregunte.',
    remate: 'La óptica que avisó conserva al cliente; la que no, lo pierde. Y el cajón de esa sucursal se llena con 40 a 60 pares al mismo tiempo.',
    img: `${IMG}/caso-escolar.webp`,
    alt: 'Campaña de examen de la vista en una escuela en agosto, con niños formados y la lista de alumnos en la tablet',
  },
  {
    id: 'progresivo',
    titulo: 'Diciembre: aguinaldo, vale que vence y factura con RFC',
    texto: 'El mes de más caja: el que aplazó todo el año viene por su progresivo, el vale de la empresa caduca el 31 y todos quieren su factura bien hecha. La caja factura al momento con la descripción correcta y separada del solar, y las órdenes se ordenan contra el cierre del lab.',
    remate: 'El lab cierra una semana entre Navidad y Año Nuevo: lo que no salió antes del 24 se va a enero.',
    img: `${IMG}/caso-progresivo.webp`,
    alt: 'Cliente de unos cincuenta años pagando sus lentes progresivos en diciembre y pidiendo su factura con RFC en el mostrador de una óptica',
  },
  {
    id: 'solar',
    titulo: 'Marzo y abril: el solar que se compró en enero',
    texto: 'Se vende en dos semanas lo que se pidió con dos meses de anticipación. Qué modelo, en qué color y en qué medida se está vendiendo y cuál ya se durmió, por sucursal, con el traspaso a la tienda donde sí sale y el aviso de cuándo se cierra la ventana de canje con el proveedor.',
    remate: 'Lo que no salió en Semana Santa se queda un año en la charola — o se canjea a tiempo por modelo nuevo.',
    img: `${IMG}/caso-solar.webp`,
    alt: 'Señora probándose lentes solares graduados frente al exhibidor junto a la ventana de una óptica en primavera',
  },
  {
    id: 'pupilentes',
    titulo: 'Todo el año: al que le toca su examen y al que se le acaba su caja',
    texto: 'Es el dinero más barato de la óptica: ya lo conoces, ya sabes qué armazón usa y ya sabes que a los 45 le toca vista cansada. A los 11 meses de la receta entra a la lista de “le toca”, y el de pupilentes entra cuando se le van a acabar sus cajas, con su graduación, su lote y su caducidad.',
    remate: 'Si les hablas, buena parte vuelve; si nadie les habla, casi ninguno. Nadie mide cuántos, y ése es el punto.',
    img: `${IMG}/caso-pupilentes.webp`,
    alt: 'Optometrista entregando su caja de lentes de contacto a una clienta joven en el gabinete de una óptica',
  },
];

export const seccionesOP: SuiteSeccion[] = [
  {
    id: 'receta', tag: 'Expediente',
    titulo: 'La receta, con su fecha y quién la firmó',
    texto: 'Esfera, cilindro, eje, adición, DIP y altura, con la receta de hoy y la de hace dos años para ver cómo cambió. Si vino del oftalmólogo se captura igual, se guarda la foto de la hoja y de quién viene, y su reloj es el que dijo el médico. Y como es dato de salud, se sabe quién puede verla y con qué permiso.',
    bullets: ['La receta firmada por quien tiene cédula: es tu respaldo cuando el cliente reclama', 'Receta del oftalmólogo con la foto de la hoja; ese cliente no quiere examen, quiere sus lentes', 'Cédula y responsable por sucursal: qué optometrista está en qué tienda y qué recetas firmó'],
    visual: mockTicket('Expediente · Sra. Ruiz · 14 de agosto', [['Ojo derecho', '−2.25  −0.75 × 90'], ['Ojo izquierdo', '−2.00  −0.50 × 85'], ['Adición (vista cansada)', '+1.75'], ['DIP · altura', '62 mm · 18 mm'], ['Firmó', 'Optometrista · cédula vigente']], ['Le toca otra vez', 'Agosto del año que entra'], 'Su receta de hace dos años: −1.75 y sin adición. Por eso hoy le toca progresivo'),
  },
  {
    id: 'muro', tag: 'El muro',
    titulo: 'Modelo, color y medida — y el que ya va en la ruta del lab',
    texto: 'Cada armazón es modelo, color y medida, y el muro es tu inventario a la vista. Cuando se ordena, el armazón sale del muro pero todavía no se entregó: queda “en lab”. Sin ese estado el muro miente. Y lo que se vende en Instagram y en la tienda en línea sale de este mismo muro.',
    bullets: ['Existencia por color y calibre, por sucursal: “¿lo tienes en café, en 52?”', 'Traspaso entre tiendas: el armazón dormido en una plaza se vende en otra', 'Consignación y comodato: lo que está en tu pared pero no es tuyo, con lo que hay que liquidar, devolver o canjear'],
    visual: mockMatriz('Armazón de metal · existencia por calibre', ['46', '48', '50', '52', '54', '56'], [['Negro', [3, 4, 2, 0, 1, 4]], ['Carey', [2, 3, 3, 0, 0, 3]]], 'El 52 y el 54 en cero: justo los que más se piden. Dos están “en lab”, no en el muro', [0, 3]),
  },
  {
    id: 'orden', tag: 'Laboratorio',
    titulo: 'La orden de trabajo y la fecha de entrega',
    texto: 'Armazón, micas, tratamientos, la receta completa y la fecha de entrega en una sola hoja que va al lab, con su estado: ordenado, en lab, llegó, revisado, listo, entregado. La ruta pasa martes y jueves; con biseladora propia el terminado de stock sale el mismo día. En agosto y en diciembre todo se corre, y el sistema lo dice antes que el cliente.',
    bullets: ['La receta se relee antes de mandar la orden: ahí se cachan los ejes', 'Órdenes por fecha de entrega, con las vencidas en rojo y el aviso listo', 'Costo real por orden: armazón, mica, tratamientos, flete del lab y retallados'],
    visual: mockCalendario('Órdenes y ruta del lab', 'Agosto', 31, { 4: 'ok', 5: 'lleno', 7: 'lleno', 11: 'aviso', 12: 'lleno', 14: 'lleno', 18: 'aviso', 19: 'lleno', 21: 'lleno', 22: 'aviso', 25: 'aviso', 26: 'lleno', 28: 'lleno' }, 'Martes y jueves sale y regresa la ruta; el 22 y el 25 hay entregas prometidas que el lab ya corrió'),
  },
  {
    id: 'lensometro', tag: 'Lensómetro',
    titulo: 'Nadie avisa hasta que el lensómetro dice que dio',
    texto: 'Aquí el trabajo no se aprueba a ojo: la mica se pone en el lensómetro y se compara contra la receta. Dio o no dio. La orden no pasa a “listo” hasta que alguien capturó que el número salió, y si no salió se retalla y se registra el motivo: no adaptación, antirreflejo craquelado, eje o armazón.',
    bullets: ['Retallado con su causa y su responsable: si el error fue de la orden lo pagas tú, si fue del lab se le reclama con datos', 'El antirreflejo craquelado es garantía de un año y lo paga el lab; el rayado por uso no entra, y si se da es cortesía una sola vez', 'Los 30 días de adaptación del progresivo: quién está en ventana y a quién hay que hablarle antes de que se venza'],
    visual: mockBarras('Retallados del mes · por motivo', [['Eje', '9 · 41%', 100], ['AR craquelado', '6 · 27%', 66], ['No adaptación', '5 · 23%', 55], ['Armazón', '2 · 9%', 22]], '22 retallados de 214 órdenes. Catorce los pagó el laboratorio porque el motivo estaba registrado'),
  },
  {
    id: 'cajon', tag: 'Pendientes de entrega',
    titulo: 'El cajón de listos: lo que te deben bajo el mostrador',
    texto: 'Cada bolsita es una venta a medias: te deben el saldo y la mica ya se le pagó al lab. Días sin recoger, saldo pendiente y a quién falta hablarle, con el recordatorio a los 7, a los 15 y la decisión a los 30. Y cuando por fin viene: se los pones, se le ajustan en la cara, saldo, factura y firma el acuse de entrega.',
    bullets: ['“Ya están listos, debe $X” sale solo cuando la orden se marca revisada', 'Acuse de entrega firmado contra la orden: es lo que te salva del “yo nunca los recogí”', 'Una óptica de una sucursal trae 10 a 15 pares al mismo tiempo; una sucursal de cadena en agosto, 40 a 60'],
    visual: mockTicket('El cajón · lo que te deben hoy', [['Sra. Ruiz · progresivo + AR · 23 días', '$1,450'], ['Niño Pérez · policarbonato · 16 días', '$620'], ['Sr. Andrade · monofocal + AR · 9 días', '$380'], ['Otros 11 pares listos', '$10,150']], ['14 pares sin recoger', '$12,600'], 'Seis pasan de 15 días y a cuatro nadie les ha hablado. Si cobraste la mitad, el anticipo ya pagó la mica'),
  },
  {
    id: 'caja', tag: 'Caja y convenios',
    titulo: 'El anticipo, el abono, el convenio y la factura que sí sirve',
    texto: 'Mínimo la mitad al ordenar, y todo si es progresivo, alto índice o armazón del cliente — esa mica no le sirve a nadie más. El que viene cada semana paga su abono con su saldo a la vista. Y la factura sale al momento con la descripción correcta, con los lentes oftálmicos graduados separados del solar y de los accesorios.',
    bullets: ['Precio de convenio por empresa, sindicato, escuela o institución, con el tope del vale y su cuenta por cobrar a 30 o 60 días', 'El seguro de gastos médicos es por reembolso: el cliente paga todo aquí y con esa factura le cobra él a su aseguradora; si le falta la descripción, te la regresa', 'Pago mixto, meses sin intereses del Buen Fin y cobro con y sin internet, porque en plaza se cae la señal'],
    visual: mockLista('Cobranza de convenios · hoy', [['Vale de empresa · 14 pares entregados y firmados · a 60 días', 'Por cobrar', 'aviso'], ['Sindicato · lista autorizada de 9 · falta que recojan 2', 'Detenida', 'gris'], ['Abonos semanales · 23 clientes al corriente', 'Al día', 'ok'], ['Factura del seguro · descripción y diagnóstico completos', 'Entregada', 'ok']], 'La cuenta por cobrar del convenio depende de que recoja y firme el acuse'),
  },
  {
    id: 'reloj', tag: 'El reloj de 12 meses',
    titulo: 'A quién le toca este mes',
    texto: 'La receta es un activo con fecha: a los 12 meses el cliente vuelve porque su graduación cambió, y el que vino del oftalmólogo vuelve cuando dijo su médico. A los 11 meses entra a la lista de “le toca su examen”, y el de pupilentes entra cuando se le van a acabar sus cajas.',
    bullets: ['Recordatorio del examen por fecha de receta, con su WhatsApp listo para mandar', 'Su caja de pupilentes con su graduación, su lote y su caducidad: se le habla antes de que se le acabe', 'De cada diez que examinas, cuántos te compran: cada óptica tiene su número y casi nadie lo mide'],
    visual: mockLista('Le toca · septiembre', [['Sra. Ruiz · receta de agosto del año pasado · 47 años', 'Le toca progresivo', 'aviso'], ['Sr. Andrade · mensuales −3.00 · última caja hace 3 meses', 'Su caja en 9 días', 'aviso'], ['Niño Pérez · receta del oftalmólogo · revisión a los 6 meses', 'Aviso enviado', 'ok'], ['Sra. Molina · progresivo entregado hace 21 días', 'En sus 30 días', 'gris']], '38 recetas cumplen 12 meses este mes; a 12 nadie les ha hablado'),
  },
];

export const planoOP = [
  {
    id: 'muro', nombre: 'El muro y el piso de venta', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-muro.webp`, alt: 'Muro iluminado de armazones en rieles dentro de una óptica, cada pieza con su etiqueta colgante',
    pie: 'Por marca o por precio, cada pieza con su etiqueta colgante; el solar en su propia sección.',
    pregunta: '¿Lo tienes en café, en 52?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Existencia por modelo, color y medida, con el hueco del calibre que más se pide' },
      { t: 'El armazón que ya se ordenó pasa a “en lab”: sale del muro y deja de contar como existencia' },
      { t: 'Consignación y comodato: qué es tuyo, qué se liquida y qué se devuelve al proveedor', plan: 'Controla' },
      { t: 'Qué se durmió más de 12 meses y cuándo cierra la ventana de canje con el proveedor', plan: 'Controla' },
      { t: 'Lo que se vende en Instagram y en la tienda en línea sale de este mismo muro' },
    ],
  },
  {
    id: 'gabinete', nombre: 'El gabinete', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-gabinete.webp`, alt: 'Gabinete pequeño de una óptica con el foróptero, el autorrefractómetro y la cartilla iluminada al fondo',
    pie: 'Es un cuartito: el foróptero, el autorrefractómetro, la silla y la cartilla. De aquí sale la receta con fecha.',
    pregunta: '¿De cada diez que examino, cuántos me compran?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Expediente con esfera, cilindro, eje, adición, DIP, altura, fecha y quién la firmó', plan: 'Fideliza' },
      { t: 'Receta del oftalmólogo capturada, con la foto de la hoja y de quién viene' },
      { t: 'Cita para examen y turnos de la optometrista: a 5 sucursales el sábado se satura' },
      { t: 'El examen como servicio en el ticket: gratis, con costo o bonificado en la compra' },
      { t: 'Es dato de salud: aviso de privacidad, consentimiento y quién puede ver la receta' },
    ],
  },
  {
    id: 'listos', nombre: 'El cajón de listos y la bodega chica', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-listos.webp`, alt: 'Cajón bajo el mostrador de una óptica abierto y lleno de bolsitas con lentes terminados, cada una con su nombre',
    pie: 'Las bolsitas con los lentes listos, cada una con su nombre y su saldo; atrás, las cajas de pupilentes por cliente.',
    pregunta: '¿Cuánto me deben en el cajón?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Días sin recoger, saldo pendiente y a quién falta hablarle', plan: 'Controla' },
      { t: '“Ya están listos, debe $X” por WhatsApp cuando la orden se marca revisada', plan: 'Automatiza' },
      { t: 'Recordatorio a los 7 y a los 15 días, y la decisión a los 30' },
      { t: 'Cajas de pupilentes por cliente con su lote y su caducidad' },
      { t: 'El solar de temporada que aún no sube al muro y el armazón en consignación por devolver' },
    ],
  },
  {
    id: 'mostrador', nombre: 'El mostrador con el espejo y la caja', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador con espejo redondo de una óptica, con la charola de armazones elegidos y la tablet de la cotización',
    pie: 'El espejo redondo, la charola con los elegidos, el anticipo, y aquí mismo la entrega con el calentador.',
    pregunta: '¿Con antirreflejo en cuánto le queda?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Cotización de armazón, micas y tratamientos, y la nota con su fecha de entrega' },
      { t: 'Anticipo mínimo del 50%, y el 100% en progresivo, alto índice o armazón del cliente' },
      { t: 'Abonos semanales o quincenales con su saldo; pago mixto y meses sin intereses' },
      { t: 'Factura con RFC al momento, con la descripción correcta y separada del solar' },
      { t: 'Entrega: ajuste en la cara, saldo, acuse firmado y la comisión de la vendedora contra su meta', plan: 'Controla' },
    ],
  },
  {
    id: 'taller', nombre: 'El laboratorio y la mesa de órdenes', fuera: true, simbolo: 'armado' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Laboratorio de una óptica con el tallador en la biseladora, las charolas de micas de stock y el lensómetro en la mesa',
    pie: 'La biseladora, el lensómetro, las charolas de mica de stock y la bolsa de trabajo que se va con el mensajero.',
    pregunta: '¿Dio el número o no dio?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Orden de trabajo con estado: ordenado, en lab, llegó, revisado, listo, entregado' },
      { t: 'La ruta del mensajero de martes y jueves, y el terminado del mismo día si hay biseladora propia' },
      { t: 'Revisión en lensómetro como paso obligado: sin ella la orden no pasa a listo' },
      { t: 'Retallado con su motivo y su responsable, por optometrista, por sucursal y por laboratorio', plan: 'Controla' },
      { t: 'Costo de la mica por orden y lo que se le paga al lab a 15 o 30 días' },
    ],
  },
];

export const pasosOP = [
  { cuando: 'Día 1', titulo: 'Tu muro y tus expedientes, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Armazones por modelo, color y medida con la existencia real de cada tienda, lo que está en consignación, y los expedientes con su receta y su fecha si ya los tienes.', img: `${IMG}/proceso-examen.webp`, alt: 'Optometrista tomando la graduación con el foróptero mientras el expediente se captura en la computadora del gabinete' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus laboratorios, tus tiempos, tus convenios y tus reglas de anticipo.', detalle: 'Los días de ruta, la fecha de entrega por tipo de mica, quién autoriza un descuento o una garantía, el tope del vale de cada empresa y la descripción de la factura.', img: `${IMG}/proceso-orden.webp`, alt: 'Armando la orden de trabajo con el armazón y la receta en la mesa de recepción del laboratorio' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Capturar la receta y levantar una orden de trabajo se aprende en media hora.', detalle: 'Y se practica lo de todos los días: marcar revisado en el lensómetro, mandar el “ya están listos” y cobrar el saldo con el acuse firmado.', img: `${IMG}/proceso-lensometro.webp`, alt: 'Tallador comparando la mica terminada contra la receta en el lensómetro antes de marcar la orden como revisada' },
  { cuando: 'Día 4', titulo: 'Arranca una sucursal', texto: 'La primera óptica vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con las órdenes vivas y el cajón de listos ya migrados: ningún cliente llega por sus lentes y se encuentra con que su orden no existe.', img: `${IMG}/proceso-entrega.webp`, alt: 'Vendedora ajustando los lentes nuevos en la cara de la clienta con el calentador y recabando la firma del acuse' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de armazones entre sucursales y la lista de “le toca su examen” ya corren desde la primera semana.', img: `${IMG}/proceso-campana.webp`, alt: 'Dueño de una cadena de ópticas revisando en la tablet la campaña de recordatorio de examen antes de mandarla' },
];
export const ticketOP = { lineas: [{ n: 'Armazón metal negro · 52-18-140', p: '$1,290' }, { n: 'Micas progresivas · alto índice + antirreflejo', p: '$3,450' }, { n: 'Anticipo recibido', p: '−$2,370' }], total: '$2,370 · se liquida al recoger' };

export const escalaOP = [
  { n: '1 sucursal', nombre: 'La óptica de barrio', cambia: ['El dueño lo hace todo: examen, venta, orden al lab, cobro y WhatsApp', 'La receta en un cuaderno y la venta a abonos en libreta', 'Lab externo, mensajero martes y jueves, entrega en 5 a 8 días'], sistema: ['El expediente con la receta y su fecha: el cuaderno que no se pierde', 'La orden de trabajo con su estado y el “ya están listos” que sale solo', 'El cajón de listos con días sin recoger y saldo, desde el celular'], dato: { valor: '10 a 15', rotulo: 'pares sin recoger al mismo tiempo en una óptica de una sucursal' } },
  { n: '5 sucursales', nombre: 'Las ópticas de la ciudad', cambia: ['Encargada por tienda y una optometrista por turno; el sábado se satura', 'Aparece la biseladora propia para el stock; lo tallado sigue externo', 'El armazón que se vende aquí está allá, y los convenios se reparten por sucursal'], sistema: ['Existencias por sucursal y traspasos, con el estado “en lab”', 'Agenda del gabinete con citas y turnos, tienda por tienda', 'Las cinco desde el celular: caja, órdenes atrasadas y lo que se durmió en el muro'], dato: { valor: '1 agenda', rotulo: 'del gabinete para las cinco tiendas, con el sábado a la vista' } },
  { n: '50 sucursales', nombre: 'La cadena con lab central', cambia: ['Lab propio que surte por ruta dos veces por semana', 'Compras centralizadas e importación, más el muro en consignación que hay que liquidar y canjear', 'Convenios con empresas grandes, sindicatos e instituciones: cartera a 60 días y más'], sistema: ['La orden de trabajo viaja de tienda a lab a tienda y se sabe en qué paso está', 'La garantía se vuelve un número: motivo, sucursal, optometrista y laboratorio', 'El expediente es dato de salud de miles de personas: quién lo ve y con qué permiso'], dato: { valor: '40 a 60', rotulo: 'pares en el cajón de una sucursal de cadena en agosto' } },
  { n: '150 sucursales', nombre: 'La operación nacional', cambia: ['Dos o tres labs regionales, bodega central y resurtido del muro por rotación', 'Buena parte suele ser franquicia: precio sugerido, compra al corporativo y regalías', 'El examen se estandariza: misma hoja, mismo protocolo, cédula vigente por sucursal'], sistema: ['Los números de cada tienda: ticket promedio, % de progresivo, % de antirreflejo, días en el cajón', 'La tienda que se descarrila sale sola: la que no sube antirreflejo o la que duplica retallados', 'Campañas de regreso a clases con miles de niños en escuelas, con su lista y su seguimiento'], dato: { valor: '1 número', rotulo: 'que ningún otro giro tiene: % de retallado por optometrista, sucursal y laboratorio' } },
];

export const problemasOP = {
  doc1: {
    membrete: 'Punto de venta general', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-0482', b: 'ARMAZÓN METAL NEGRO', c: '3' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿en qué calibre?', '¿y el que va en la ruta?'],
    sello: 'NO VE<br />LA RECETA',
    notas: [
      'Te dice que hay <b>tres</b>. Dos ya salieron a tallar: en el muro hay uno.',
      'No sabe qué es un <b>eje</b>, ni una adición, ni una DIP. La receta acaba en un cuaderno.',
      'Marca la venta como hecha, pero la mica <b>todavía no existe</b> y nadie la ha aprobado en el lensómetro.',
      'No sabe cuántos pares llevan <b>quince días en el cajón</b> ni cuánto te deben.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'EXPEDIENTE CON RECETA', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ AGOSTO', tachado: true },
      { a: 'REVISIÓN EN LENSÓMETRO', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó diciembre'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y el expediente con la receta quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tus meses son agosto y diciembre.',
      'Cada cambio chico —separar el solar en la factura— es <b>una cotización nueva</b>.',
      'No trae el “ya están listos” ni los días sin recoger. En agosto, <b>el cajón se vacía a mano</b>.',
    ],
  },
  filas: [
    { que: 'Expediente con la receta, su fecha y quién la firmó', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Orden de trabajo al lab con estado y fecha de entrega', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Revisión en lensómetro antes de avisar que están listos', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'El armazón “en lab”: sale del muro y no cuenta como existencia', generico: 'A medias', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Días sin recoger, saldo del cajón y acuse firmado', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda óptica que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un punto de venta que dice “hay tres” y no sabe qué es un eje, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las ópticas y cadenas de óptica que ya la usan',
};

export const cifrasOP = {
  foto: `${IMG}/escala.webp`,
  alt: 'Laboratorio central de una cadena de ópticas con las órdenes de trabajo por sucursal y las charolas de micas listas para salir en la ruta',
  frase: 'Desde la óptica de barrio hasta la cadena con laboratorio propio y ruta a las sucursales.',
  encuadre: 'center 45%',
};
