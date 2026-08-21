/**
 * Contenido de la Suite para Joyerías.
 *
 * Lo que hace distinto a este giro: el producto no tiene precio fijo. Vale lo
 * que pesa por lo que vale el gramo hoy — y el gramo se mueve. El SKU real es
 * MODELO × METAL × PUREZA, y la unidad es el gramo, no la pieza.
 *
 * Todo lo que se afirma aquí existe en la Suite Joyería de SACS. Ver
 * sacs3/documentacion/PLAN_PRECIO_DINAMICO_JOYERIA_V2.md: precio del fino
 * (colchón), factor por quilataje con merma, costo de adquisición histórico
 * inmutable, repricing con simulación y reetiquetado, apartados con precio
 * congelado, COGS congelado al vender, margen con permisos, y reparaciones con
 * merma sobre el mismo precio del gramo.
 *
 * OJO CON EL MODELO COMERCIAL: la Suite Joyería es un complemento que se
 * cotiza aparte, NO viene dentro de los cuatro planes. En el catálogo del CRM
 * es `plugin_joyeria`, a la medida. La página no puede decir "incluida desde
 * Fideliza" como las de moda o calzado.
 *
 * Vocabulario del piso: fino, colchón, ley, quilataje, factor, merma, hechura,
 * rodinado, gramaje, apartado, empeño no (eso es otro negocio).
 */

const est = {
  wrap: 'font-family:var(--font-body);',
  h: 'font-size:11px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
};

export interface SuiteSeccion {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  bullets?: string[];
  visual: string;
}

export const seccionesJoyeria: SuiteSeccion[] = [
  {
    id: 'fino',
    tag: 'Precio',
    titulo: 'Lo que se cobra es el metal, no la báscula',
    texto:
      'Una pieza pesa una cosa y cobra otra. Del peso bruto se descuenta la piedra para llegar al neto, y del neto sale el fino según su ley: la circonia no se cobra a precio de oro y el diamante se cotiza aparte, no al gramo.',
    bullets: [
      'Tu colchón por metal y por pureza, con su historial de cuándo y quién lo movió',
      'El spot de oro y plata a la vista, como alerta y no como automatismo',
      'El precio sale del peso NETO del metal: la piedra no se cobra dos veces',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Precio del fino · oro</p>
      <div style="display:flex;gap:10px;margin-bottom:14px;">
        <div style="flex:1;border:1px solid #EEF1F5;border-radius:11px;padding:12px;">
          <div style="font-size:10.5px;color:#94A3B8;font-weight:700;">SPOT · 16 JUL 2026</div>
          <div style="font-size:19px;font-weight:800;color:#64748B;font-variant-numeric:tabular-nums;">$2,678<span style="font-size:11px;font-weight:600;"> /g</span></div>
        </div>
        <div style="flex:1;border:1.5px solid #E8A838;background:#FFFBEF;border-radius:11px;padding:12px;">
          <div style="font-size:10.5px;color:#8A6D14;font-weight:800;">TU COLCHÓN</div>
          <div style="font-size:19px;font-weight:800;color:#0F172A;font-variant-numeric:tabular-nums;">$2,900<span style="font-size:11px;font-weight:600;"> /g</span></div>
        </div>
      </div>
      ${[['Oro 10K','0.445','$1,291'],['Oro 14K','0.620','$1,798'],['Oro 18K','0.780','$2,262']]
        .map(([m,f,p]:any)=>`<div style="display:flex;align-items:center;gap:11px;border-bottom:1px solid #F1F5F9;padding:10px 0;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${m}</div>
          <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">factor ${f}</div></div>
          <span style="font-size:13.5px;font-weight:800;color:#0F172A;font-variant-numeric:tabular-nums;">${p} /g</span>
        </div>`).join('')}
      <p style="margin:12px 0 0;font-size:11px;color:#94A3B8;">El factor es tuyo: va por arriba del teórico porque absorbe merma de taller y hechura</p>
    </div>`,
  },
  {
    id: 'historico',
    tag: 'Costo real',
    titulo: 'Lo que te costó ese oro no cambia nunca',
    texto:
      'Compraste el metal a un precio, en una fecha. Ese costo es el que manda para saber tu margen real — no el precio de hoy. Si el sistema recalcula el costo con el oro de esta mañana, tu utilidad es un número inventado.',
    bullets: [
      'Costo de adquisición del fino por pieza, inmutable',
      'Al vender, la línea congela ese costo: el margen del mes no se mueve después',
      'Utilidad y margen visibles solo para quien tú autorices',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Esclava oro 14K · 18.4 g</p>
      ${[['Costo del fino cuando lo compraste','12 feb 2025 · 10.73 g de fino × $1,740','$18,670','#0F172A'],['Hechura y acabados','mano de obra + rodinado','$2,400','#0F172A'],['Costo histórico total','no se mueve con el mercado','$21,070','#0F172A']]
        .map(([a,b,c,col]:any)=>`<div style="display:flex;align-items:center;gap:11px;border-bottom:1px solid #F1F5F9;padding:11px 0;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:${col};">${a}</div>
          <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${b}</div></div>
          <span style="font-size:13.5px;font-weight:800;color:${col};font-variant-numeric:tabular-nums;">${c}</span>
        </div>`).join('')}
      <div style="background:#F0FDF9;border:1px solid #A7F3D0;border-radius:11px;padding:12px;margin-top:12px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#065F46;">
          <span>Precio de venta hoy</span><span>$33,100</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#047857;margin-top:5px;">
          <span>Margen real</span><span>36% · $12,030</span>
        </div>
      </div>
    </div>`,
  },
  {
    id: 'repricing',
    tag: 'Repreciar',
    titulo: 'Mover el colchón sin romper la tienda',
    texto:
      'Subir el precio del gramo toca cientos de piezas a la vez. Antes de aplicar, ves la simulación completa: qué sube, cuánto, qué queda bajo tu margen mínimo y cuánto dinero está en juego. Y si algo sale mal, se revierte.',
    bullets: [
      'Simulación antes de aplicar, con semáforo por margen',
      'Reetiquetado con código de barras de lo que cambió de precio',
      'Los apartados quedan fuera: lo que ya pactaste no se toca',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Simulación · colchón $2,900 → $3,085</p>
      ${[['Oro 14K · 386 piezas','+6.4% de precio','#047857'],['Oro 10K · 212 piezas','+6.4% de precio','#047857'],['Oro 18K · 94 piezas','+6.4% de precio','#047857'],['Bajo margen mínimo','14 piezas para revisar','#B45309'],['Apartados congelados','23 piezas sin tocar','#2563EB']]
        .map(([a,b,c]:any)=>`<div style="display:flex;align-items:center;gap:11px;border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:7px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${a}</div></div>
          <span style="font-size:11.5px;font-weight:700;color:${c};">${b}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed #E5E7EB;margin-top:10px;padding-top:11px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:800;color:#0F172A;">Lo que sube el catálogo</span>
        <span style="font-size:15px;font-weight:800;color:#0F172A;">$316,200</span>
      </div>
    </div>`,
  },
  {
    id: 'apartados',
    tag: 'Apartados',
    titulo: 'El anillo apartado a precio de hace tres meses',
    texto:
      'En joyería el apartado es largo: se pacta un precio y se abona hasta liquidar. Si en el camino subes el colchón, esa pieza no puede repreciarse — pero tampoco puede desaparecer de tu inventario ni venderse otra vez.',
    bullets: [
      'Precio congelado desde el día que se pactó, con su anticipo mínimo',
      'Fuera de las actualizaciones masivas de precio',
      'La pieza sale de disponible: no se le vende a nadie más',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Apartados vigentes</p>
      ${[['Anillo solitario 14K','pactado 8 mar · $28,400','3 de 6 abonos','#047857'],['Esclava 10K','pactado 22 mar · $12,900','5 de 6 abonos','#047857'],['Juego de argollas','pactado 2 feb · $34,100','2 de 6 abonos','#B45309']]
        .map(([a,b,c,col]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${a}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${b}</div></div>
            <span style="font-size:11px;font-weight:800;color:${col};">${c}</span>
          </div>
        </div>`).join('')}
      <div style="background:#EFF6FF;border:1px solid #C7DAFB;border-radius:11px;padding:11px 13px;">
        <div style="font-size:11.5px;font-weight:800;color:#1D4ED8;">El oro subió 6.4% desde marzo</div>
        <div style="font-size:11.5px;color:#1E40AF;margin-top:3px;">Ninguno de los tres se repreció. Lo pactado es lo pactado.</div>
      </div>
    </div>`,
  },
  {
    id: 'sucursales',
    tag: 'Multisucursal',
    titulo: 'Una casa, un precio del gramo',
    texto:
      'Si cada sucursal cotiza con su propio precio del oro, el mismo anillo vale distinto según dónde entre el cliente. El colchón es de la casa, no del mostrador.',
    bullets: [
      'El precio del fino y los factores son de la cuenta, no de cada tienda',
      'Existencia real por sucursal, con lo apartado descontado',
      'Traspasos entre tiendas con su costo histórico intacto',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Anillo liso 14K · 3.2 g</p>
      ${[['Centro','Matriz',2,true],['Plaza','a 15 min',1,false],['Galerías','a 40 min',0,false],['Norte','a 25 min',0,false]]
        .map(([n,s,q,aqui]:any)=>`<div style="border:1px solid ${aqui?'#E8A838':'#EEF1F5'};background:${aqui?'#FFFBEF':'#fff'};border-radius:11px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
          <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${s}</div></div>
          <span style="font-size:14px;font-weight:800;color:${q>0?'#10B981':'#CBD5E1'};">${q}</span>
          ${aqui?'<span style="background:#E8A838;color:#1A1508;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">AQUÍ</span>':''}
        </div>`).join('')}
      <div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-top:4px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;color:#0F172A;">Precio en las cuatro</span>
        <span style="font-size:13.5px;font-weight:800;color:#0F172A;">$5,750</span>
      </div>
    </div>`,
  },
];

export const cortinaJoyeria = {
  eyebrow: 'La misma pregunta, dos veces',
  titulo: '“¿En cuánto me la deja?”',
  sub: 'Arrastra la línea. A la izquierda, cómo se cotiza hoy. A la derecha, con el precio del gramo que tú fijaste.',
  fotoAntes: '/images/suite-joy-hoy.webp',
  fotoDespues: '/images/suite-joy-resuelto.webp',
  altAntes: 'Vendedora pesando una cadena y sacando el precio con calculadora',
  altDespues: 'Vendedora presentando una pieza con el sistema en la tablet',
  libreta: ['14K · 18.4 g × ?', 'oro hoy… ¿2,540?'],
  pieAntes: 'Calculadora, memoria<br />y el precio de la semana pasada.',
  filas: [
    { que: 'Esclava 14K · 18.4 g', donde: 'Tu colchón', dato: '$33,100' },
    { que: 'Anillo liso 14K · 3.2 g', donde: 'Tu colchón', dato: '$5,750' },
    { que: 'Cadena 10K · 9.7 g', donde: 'Tu colchón', dato: '$12,520' },
  ],
  pieDespues: 'El mismo gramo para toda la casa.',
};

export const sucursalesJoyeria = [
  { nombre: 'Centro', venta: '$684,200', llena: 100, ticket: '$8,940', margen: '31%', delta: '+6%' },
  { nombre: 'Plaza', venta: '$521,700', llena: 76, ticket: '$7,120', margen: '29%', delta: '+2%' },
  { nombre: 'Galerías', venta: '$438,900', llena: 64, ticket: '$6,480', margen: '27%', delta: '+1%' },
  {
    nombre: 'Norte', venta: '$214,300', llena: 31, ticket: '$4,210', margen: '19%', delta: '−14%',
    alerta: true,
    nota: 'Ahí se está regateando abajo del piso de margen: uno de cada tres tickets salió con descuento autorizado a la carrera, y el margen se comió ocho puntos.',
  },
];

export const reglasJoyeria = [
  { si: 'El precio baja del margen mínimo', entonces: 'no se cobra sin permiso', detalle: 'En joyería el regateo es parte de la venta. El piso de margen lo pones tú, y quien quiera bajarlo pide autorización.' },
  { si: 'Se cancela una venta ya cobrada', entonces: 'queda firmada', detalle: 'Quién, cuándo y por qué. Con piezas de este valor, el rastro no es opcional.' },
  { si: 'El corte de caja no cuadra', entonces: 'no cierra', detalle: 'El faltante se registra a nombre de quien cerró, y tú lo ves el mismo día — no a fin de mes.' },
];





export const documentosJoyeria = {
  titulo: 'Ya lo intentaste<br />de las dos formas.',
  entrada:
    'Casi toda joyería que llega con nosotros trae uno de estos dos documentos en el cajón. Ninguno de los dos fue una tontería. Los dos fallan — por motivos distintos.',
  doc1: {
    membrete: 'Sistema genérico',
    sub: 'Ficha de producto',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'PRECIO'],
    lineas: [
      { a: 'ART-0912', b: 'ESCLAVA ORO 14K', c: '$28,900' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y si sube el oro?', '¿cuánto pesa?'],
    sello: 'PRECIO<br />FIJO',
    notas: [
      'Un precio escrito a mano. <b>No sabe qué pesa la pieza</b> ni de qué ley es.',
      'Cuando el oro sube, alguien reprecia <b>a mano, pieza por pieza</b>.',
      'Y como no guarda a cuánto compraste ese metal, <b>el margen que te enseña es un número inventado</b>.',
      'Y el taller cotiza con otro precio del gramo, por su cuenta.',
    ],
  },
  doc2: {
    membrete: 'Hoja de cálculo del dueño',
    sub: 'Costeo · versión 11',
    cab: ['CONCEPTO', 'ESTADO'],
    lineas: [
      { a: 'LA ARMÓ', b: 'EL DUEÑO' },
      { a: 'LA ENTIENDE', b: 'EL DUEÑO', tachado: true },
      { a: 'SI SE PIERDE', b: 'NO HAY OTRA' },
    ],
    margen: ['+ 3 versiones', 'nadie más la abre'],
    sello: 'UN SOLO<br />DUEÑO',
    notas: [
      'Funciona… <b>mientras el dueño esté</b> y se acuerde de las fórmulas.',
      'Los precios de la hoja y los del sistema <b>no coinciden desde hace meses</b>.',
      'Cada sucursal terminó con su propia copia y su propio precio del gramo.',
      'Y el día que se corrompe el archivo, <b>se pierde el costeo completo</b>.',
    ],
  },
  filas: [
    { que: 'Precio por gramo de fino, con tu colchón', generico: 'No existe', tonoGenerico: 'no', medida: 'En la hoja', tonoMedida: 'medio', sacs: 'En la Suite' },
    { que: 'Factor por quilataje con merma', generico: 'No existe', tonoGenerico: 'no', medida: 'En la hoja', tonoMedida: 'medio', sacs: 'En la Suite' },
    { que: 'Costo histórico inmutable del metal', generico: 'No existe', tonoGenerico: 'no', medida: 'No existe', tonoMedida: 'no', sacs: 'En la Suite' },
    { que: 'Repreciar en masa con simulación y reversa', generico: 'No existe', tonoGenerico: 'no', medida: 'A mano', tonoMedida: 'no', sacs: 'En la Suite' },
    { que: 'Apartados con precio congelado', generico: 'A medias', tonoGenerico: 'medio', medida: 'A mano', tonoMedida: 'no', sacs: 'En la Suite' },
    { que: 'Un inventario para piso, línea y WhatsApp', generico: 'A medias', tonoGenerico: 'medio', medida: 'No existe', tonoMedida: 'no', sacs: 'Uno solo' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', tonoGenerico: 'medio', medida: 'Tú, cada vez', tonoMedida: 'no', sacs: 'Nosotros, a diario' },
  ],
};

/* ── Momentos reales del giro, con su escena ──
   No son funciones: son las horas concretas en que una joyería gana o pierde
   dinero. El peso, la etiqueta, el apartado y el cierre de vitrina. */
export const casosJoyeria = [
  {
    id: 'pesar',
    titulo: 'Diez de mayo: la vitrina se vacía en cinco días',
    texto:
      'La pieza se pesa y el precio sale con tu colchón del gramo y el factor de su quilataje — el mismo para toda la casa, sin calculadora ni memoria. Y el peso que entra a la cuenta es el neto: la piedra no se cobra dos veces.',
    remate: 'Del 6 al 10 de mayo se hace hasta la sexta parte del año. El precio no lo puede decidir quien esté en el mostrador ese día.',
    img: '/images/caso-joy-pesar.webp',
    alt: 'Joyera pesando una cadena de oro en una báscula sobre el mostrador',
  },
  {
    id: 'etiquetar',
    titulo: 'Subió el oro en plena temporada y hay que reetiquetar',
    texto:
      'Antes de aplicar el precio nuevo ves la simulación completa: qué sube, cuánto, qué queda bajo tu margen mínimo y cuánto dinero está en juego. Se imprime solo lo que cambió, con su código de barras.',
    remate: 'Entre un lunes de abril y uno de junio está el 10 de mayo. Repreciar tarde te cuesta la temporada; repreciar de más te la apaga.',
    img: '/images/caso-joy-etiquetar.webp',
    alt: 'Empleada colocando etiquetas de precio a anillos de oro sobre una charola',
  },
  {
    id: 'apartado',
    titulo: 'Las argollas que se apartan en enero para la boda de agosto',
    texto:
      'En joyería el apartado es largo —medio año o más, abonado por quincena— y el juego de argollas además se fabrica semanas después. El precio queda congelado desde el día que se pactó y la pieza sale de disponible: no se le vende a nadie más. Aunque el oro suba tres veces en el camino, ese apartado no se reprecia.',
    remate: 'En joyería el apartado es largo. Lo pactado es lo pactado.',
    img: '/images/caso-joy-apartado.webp',
    alt: 'Vendedor entregando el comprobante de un apartado a una clienta en el mostrador',
  },
  {
    id: 'vitrina',
    titulo: 'Se acabó el Buen Fin: contar la vitrina sin que se vaya la noche',
    texto:
      'La charola se cuenta desde el celular, sin cerrar y sin avisar. Si falta una pieza te enteras ese día, con el nombre de quién la movió por última vez.',
    remate: 'Aquí una pieza que falta no es un descuadre de centavos: es el ticket promedio de la semana.',
    img: '/images/caso-joy-vitrina.webp',
    alt: 'Dos empleados contando piezas de joyería de una charola al cierre de la tienda',
  },
];

/** Los cinco días de la implementación, en lenguaje de joyería. */
export const pasosJoyeria = [
  {
    cuando: 'Día 1', titulo: 'Tu catálogo, cargado',
    texto: 'Nos das tu archivo o tu base actual y lo subimos nosotros. No capturas nada.',
    detalle: 'Modelo, metal y pureza — con el peso de cada pieza y su costo histórico, que es el que no se debe mover nunca.',
    img: '/images/proc-joy-1.webp',
    alt: 'Consultor con laptop y una vendedora revisando una charola de cadenas de oro sobre el mostrador',
  },
  {
    cuando: 'Día 2', titulo: 'Tu operación, configurada',
    texto: 'Queda como ya trabajas, no como el sistema quiere que trabajes.',
    detalle: 'Tu precio del gramo, el factor de cada quilataje, quién puede dar descuento y hasta cuánto puede bajar.',
    img: '/images/proc-joy-2.webp',
    alt: 'Dueña de una joyería y un consultor revisando la configuración en la oficina',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Cobrar y buscar una pieza se aprende en la primera media hora.',
    detalle: 'Y se practica lo que se usa a diario: el apartado con abonos, el descuento con autorización y el corte.',
    img: '/images/proc-joy-3.webp',
    alt: 'Equipo de una joyería en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4', titulo: 'Abre una sucursal',
    texto: 'Arranca la primera vitrina, acompañada. Si algo se atora, estamos en la línea.',
    detalle: 'Ese día se cobra, se aparta, se factura y se cierra la caja como cualquier otro — pero con alguien al lado.',
    img: '/images/proc-joy-4.webp',
    alt: 'Vendedora empacando una pieza en su estuche acompañada por una compañera el primer día',
  },
  {
    cuando: 'Día 5', titulo: 'Abren las demás',
    texto: 'Con lo aprendido en la primera, las otras entran el mismo día.',
    detalle: 'Y desde ese momento el precio del gramo se cambia una vez y baja a todas tus vitrinas.',
    img: '/images/proc-joy-5.webp',
    alt: 'Dueña de una cadena de joyerías recorriendo las vitrinas con su tablet',
  },
];

/**
 * El plano de la joyería.
 *
 * Las zonas son las del oficio, y aquí el eje no es la corrida ni la talla:
 * es el metal y la llave. Casi todo lo que importa se pesa, se guarda bajo
 * llave o se derrite. Por eso el taller es zona de venta —una pieza opaca no
 * es un clavo, es una pieza sucia— y por eso la caja fuerte es la única hora
 * del día en que el inventario entero pasa por las manos de alguien.
 *
 * OJO con lo que NO está aquí: la mesa de compra de oro es una zona real y de
 * las más rentables del giro, pero SACS no tiene ese módulo. Ver el README.
 */
export const planoJoyeria = [
  {
    id: 'vitrinas',
    nombre: 'Vitrinas',
    simbolo: 'vitrinas',
    foto: '/images/plano-joy-vitrinas.webp',
    alt: 'Línea de vitrinas iluminadas de una joyería con charolas de oro ordenadas',
    pie: 'Cada pieza sabe cuánto pesa, de qué ley es y desde cuándo lleva ahí.',
    pregunta: '«Ese juego de argollas lleva ahí desde antes del 10 de mayo. ¿Cuánto oro tengo parado en esa charola?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Precio por gramo con tu colchón del fino, no con el spot', suite: true },
      { t: 'Peso bruto, neto y fino de cada pieza, con su ley', suite: true },
      { t: 'Existencia por modelo, metal y quilataje, en cada vitrina', plan: 'Controla' },
      { t: 'Cuántos meses lleva cada pieza sin venderse en toda la casa', plan: 'Automatiza' },
      { t: 'Repreciar cientos de piezas viendo antes qué cambia', suite: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-joy-mostrador.webp',
    alt: 'Vendedora explicando una pieza sobre la vitrina a un cliente de pie en el mostrador',
    pie: 'Aquí se regatea, se autoriza y se cobra. Y aquí se decide si dejó dinero.',
    pregunta: '«Le hice quince por ciento de descuento… ¿sí ganamos algo o se la vendí abajo del oro?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Punto de venta que sigue cobrando sin conexión' },
      { t: 'Descuento con autorización: quién puede bajar, y hasta dónde', plan: 'Automatiza' },
      { t: 'Apartado con anticipo y abonos, con el precio congelado', suite: true },
      { t: 'Factura desde la caja, sin anotar el RFC en una libreta' },
      { t: 'Corte de caja y arqueo automáticos al cerrar' },
    ],
  },
  {
    id: 'taller',
    nombre: 'Taller',
    ambito: 'Detrás del mostrador',
    simbolo: 'banco',
    foto: '/images/plano-joy-taller.webp',
    alt: 'Banco de joyero con su media luna, el motor colgante y las herramientas en fila',
    pie: 'Una pieza opaca no está muerta: está sucia. Aquí vuelve a la vitrina.',
    pregunta: '«El anillo de la señora entró con 4.1 gramos y salió con 3.8. ¿Y los 0.3 dónde quedaron?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Orden de taller con pesada de entrada y de salida: si no cuadra el gramaje, la pieza no se libera', suite: true },
      { t: 'Soldadura, cambio de medida, rodinado y pulido, cada uno con su costo', suite: true },
      { t: 'La pieza sale de disponible mientras está en el banco', suite: true },
      { t: 'Quién recibió, quién trabajó y quién entregó', suite: true },
      { t: 'Registro de empleados, horarios, turnos y asistencia', otro: true },
    ],
  },
  {
    id: 'caja',
    nombre: 'Bóveda y trastienda',
    ambito: 'Al cerrar y al abrir',
    simbolo: 'boveda',
    foto: '/images/plano-joy-caja.webp',
    alt: 'Caja fuerte de piso abierta con charolas de terciopelo en sus anaqueles',
    pie: 'La única hora del día en que el inventario entero pasa por las manos de alguien.',
    pregunta: '«Ya guardamos. ¿Alguien contó la charola de compromiso o nomás la metimos?»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Corte de vitrina: se cuenta charola por charola, desde el celular', plan: 'Controla' },
      { t: 'Traspaso entre sucursales, con la pieza en tránsito hasta que se recibe', plan: 'Controla' },
      { t: 'Kardex y trazabilidad de cada pieza', plan: 'Controla' },
      { t: 'Permisos por usuario y por sucursal', plan: 'Controla' },
      { t: 'Auditoría: quién canceló, quién cambió, quién autorizó', plan: 'Controla' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-joy-linea.webp',
    alt: 'Rincón de fotografía de una joyería con tripié, aro de luz y cadenas sobre el paño',
    pie: 'La foto se manda con el peso escrito encima. Y sale del mismo inventario.',
    pregunta: '«La aparté por WhatsApp y Plaza ya la había vendido. ¿Ahora quién le llama a la clienta?»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el mismo inventario del mostrador' },
      { t: 'Apartado y pedido especial también desde el canal en línea', plan: 'Fideliza' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'Perfil del cliente con lo que compró y en qué ley', plan: 'Fideliza' },
      { t: 'Monedero, puntos y campañas', plan: 'Fideliza' },
    ],
  },
];
