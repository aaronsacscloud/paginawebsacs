// LAS FRASES QUE PIDEN UNA ACCIÓN · la mitad PURA de `acciones.ts`.
//
// Aquí no hay base de datos, ni red, ni efectos: sólo «de esta frase, qué se
// está pidiendo». Vive aparte por dos razones:
//
//  1. **Se puede probar sin nada** (`acciones-frases.test.ts`, en `npm test`).
//     Lo que dispara un WhatsApp a un cliente tiene que tener prueba, y una
//     prueba que necesita credenciales no se corre nunca.
//  2. **Corre dentro del webhook de la transcripción**, varias veces por
//     minuto y por llamada. Nada que tarde puede vivir en este camino.
//
// El orden del catálogo importa: gana el primero que caza, así que lo
// específico va antes que lo general («mándame la cotización» antes que
// «mándame la info»).
import { sinAcentos } from './oidos';

export type AccionId =
  | 'mandar_cotizacion' | 'mandar_material' | 'mandar_info' | 'volver_a_llamar'
  | 'agendar_demo' | 'ahorita_no' | 'soporte' | 'otro_contacto' | 'corregir_dato' | 'no_llamar';

/** «El jueves a las 4», «en una hora», «mañana temprano» → fecha y hora reales.
 *  Sin esto, «volver a llamar» es una promesa sin fecha: la que ya nos costó
 *  gente. La zona es la DEL CONTACTO: «a las 10» en Tijuana no son las 10 aquí. */
export function interpretarCuando(fraseCruda: string, zona = 'America/Mexico_City', ahoraD = new Date()): { fecha: string; hora: string } | null {
  const f = sinAcentos(fraseCruda);
  const enZona = (d: Date) => fechaHoraEn(zona, d);

  /* Los números se dicen con letra por teléfono («en diez minutos»), y la
     transcripción los deja así: pedir dígitos era pedirle a la gente que
     hablara como un formulario. */
  const NUMERO: Record<string, number> = {
    un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, media: 0.5,
  };
  const enMin = f.match(new RegExp(`en\\s+(${Object.keys(NUMERO).join('|')}|\\d{1,3})\\s*(minuto|minutos|hora|horas)`));
  if (enMin) {
    const n = NUMERO[enMin[1]] ?? Number(enMin[1]);
    const mins = /hora/.test(enMin[2]) ? n * 60 : n;
    return enZona(new Date(ahoraD.getTime() + mins * 60000));
  }
  if (/(ahorita|al rato|mas tarde|en un rato|en un ratito)/.test(f) && !/manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo/.test(f)) {
    return enZona(new Date(ahoraD.getTime() + 2 * 3600e3));
  }

  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const hm = f.match(/a\s+la[s]?\s+(\d{1,2})(?:[:\s](\d{2}))?\s*(de la (?:manana|tarde|noche)|am|pm)?/);
  let hora: string | null = null;
  if (hm) {
    let h = Number(hm[1]); const mi = Number(hm[2] || 0);
    const tarde = /tarde|noche|pm/.test(hm[3] || '');
    if (tarde && h < 12) h += 12;
    // «a las 3» en horario de oficina es la tarde: nadie agenda a las 3 a. m.
    else if (!hm[3] && h >= 1 && h <= 7) h += 12;
    if (h <= 23 && mi <= 59) hora = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  } else if (/temprano|en la manana/.test(f)) hora = '09:00';
  else if (/en la tarde/.test(f)) hora = '16:00';
  else if (/al mediodia/.test(f)) hora = '12:00';

  const hoyZ = enZona(ahoraD);
  const suma = (dias: number) => enZona(new Date(ahoraD.getTime() + dias * 86400e3)).fecha;
  let fecha: string | null = null;
  if (/pasado manana/.test(f)) fecha = suma(2);
  else if (/\bmanana\b/.test(f) && !/(en|por) la manana/.test(f)) fecha = suma(1);
  else {
    const d = DIAS.findIndex(n => new RegExp(`\\b(el\\s+)?${n}\\b`).test(f));
    if (d >= 0) {
      const hoyDia = new Date(`${hoyZ.fecha}T12:00:00Z`).getUTCDay();
      let delta = (d - hoyDia + 7) % 7;
      if (delta === 0) delta = 7;                                  // «el jueves» dicho en jueves es el que viene
      if (/la (otra|proxima|siguiente) semana/.test(f) && delta < 7) delta += 7;
      fecha = suma(delta);
    } else if (/la (otra|proxima|siguiente) semana/.test(f)) fecha = suma(7);
    else if (/hoy|mas tarde|al rato|esta tarde/.test(f)) fecha = hoyZ.fecha;
  }
  if (!fecha && !hora) return null;
  // Dijo hora sin día: hoy si aún no pasa, mañana si ya pasó.
  if (!fecha) fecha = hora && hora > hoyZ.hora ? hoyZ.fecha : suma(1);
  return { fecha, hora: hora || '10:00' };
}

/** Copia local de `fechaHoraEn` para no arrastrar más módulos a este camino. */
function fechaHoraEn(zona: string, cuando: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(cuando).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** Las frases DEL CLIENTE que piden cada acción. Sin acentos y en minúsculas. */
export const PATRONES: { id: AccionId; res: RegExp[] }[] = [
  {
    id: 'mandar_cotizacion',
    res: [
      /(mandame|enviame|pasame|mandeme|envieme|mandamela|pasamela|me (puedes|podrias) (mandar|enviar|pasar)).{0,25}(cotizacion|presupuesto|propuesta)/,
      /(cotizacion|presupuesto|propuesta) (por|al) (whats|whatsapp|correo|mail)/,
      /(mandame|pasame|enviame).{0,20}(los |el )?precios?/,
      /(cuanto (cuesta|sale|vale)|que precio tiene).{0,40}(mandam|pasam|enviam|por escrito)/,
    ],
  },
  {
    id: 'mandar_material',
    res: [
      /(mandame|enviame|pasame|mandeme|envieme).{0,25}(el |la |los |las )?(catalogo|video|manual|demo grabada|presentacion|ficha tecnica|folleto)/,
      /me (puedes|podrias) (mandar|enviar|pasar).{0,25}(el |la )?(catalogo|video|manual|presentacion|liga|link)/,
    ],
  },
  {
    id: 'mandar_info',
    res: [
      /(mandame|enviame|pasame|mandeme|envieme|mandamela|pasamela|mandamelo|pasamelo).{0,25}(la |toda la |mas |el )?(informacion|info|datos|material)/,
      /me (puedes|podrias|podria) (mandar|enviar|pasar).{0,25}(la |toda la )?(informacion|info)/,
      /(informacion|info) (por|al) (whats|whatsapp|mensaje|correo|mail)/,
      /(mandamelo|mandamela|pasamelo|pasamela|enviamelo) por (whats|whatsapp|mensaje|correo)/,
      /(tienes|tiene|tendras) algo (por escrito|escrito)/,
    ],
  },
  {
    id: 'volver_a_llamar',
    res: [
      /(marcame|llamame|hablame|marqueme|llameme).{0,30}(luego|despues|mas tarde|manana|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)|la (otra|proxima) semana|en (un|una|dos|tres|media|\d))/,
      /me (puedes|podrias) (marcar|llamar|hablar).{0,30}(luego|despues|mas tarde|manana|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)|en (un|una|dos|\d))/,
      /(hablamos|nos hablamos|lo vemos|nos vemos) (manana|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)|la (otra|proxima) semana|mas tarde)/,
    ],
  },
  {
    id: 'agendar_demo',
    res: [
      /(agendame|agendemos|programemos|apartame|separame|sepa?rame).{0,25}(la |una |el )?(demo|demostracion|cita|reunion|junta|videollamada)/,
      /(quiero|queremos|me gustaria|nos gustaria) (ver|conocer) (el sistema|la plataforma|como funciona|la demo)/,
      /cuando (me|nos) (lo|la) (puedes|podrias) (ensenar|mostrar)/,
      /(hagamos|tengamos) (una|la) (demo|reunion|junta|videollamada)/,
    ],
  },
  {
    id: 'ahorita_no',
    res: [
      /(estoy|ando) (manejando|conduciendo|en una junta|en junta|ocupado|ocupada|comiendo|en el super|en la calle)/,
      /(ahorita no puedo|no puedo hablar|no es buen momento|estoy en algo|estoy atendiendo)/,
      /(marcame|llamame) en (un rato|un ratito|diez|quince|media hora|una hora)/,
    ],
  },
  {
    id: 'soporte',
    res: [
      /(ya soy|ya somos|soy) cliente/,
      /(tengo|tenemos) un (problema|error|detalle|bronca|fallo) con (el sistema|sacs|la plataforma|el programa|mi cuenta)/,
      /(no me (funciona|sirve|carga|abre)|se me (traba|cierra|cae)) (el sistema|sacs|la plataforma|el programa)/,
      /necesito (soporte|ayuda con el sistema)/,
    ],
  },
  {
    id: 'otro_contacto',
    res: [
      /(hablalo|habla|veelo|velo|tratalo|trata) con (mi|el|la) (socio|socia|esposo|esposa|hermano|hermana|papa|mama|dueno|duena|gerente|contador|administrador|jefe)/,
      /(el|la) que (ve|lleva|decide) (eso|esto|las compras|el sistema)/,
      /(pasame|comunicame|te paso) con (mi|el|la)/,
      /yo no (decido|veo eso|soy (el|la) que decide)/,
    ],
  },
  {
    id: 'corregir_dato',
    res: [
      /(mi|el) (correo|mail|email) es/,
      /(anotame|apuntame|toma nota de|anota) (mi|el) (correo|mail|numero|telefono|whats)/,
      /(cambiame|corrigeme|actualizame) (el|mi) (correo|mail|numero|telefono)/,
      /(ese|este) (correo|numero|telefono) ya no (existe|es|sirve)/,
      /mejor (mandamelo|mandalo|enviamelo) a(l)? (otro )?(correo|numero)/,
    ],
  },
  {
    id: 'no_llamar',
    res: [
      /no (me |nos )?(vuelvas?|vuelvan|vuelva|vuelvo) a (llamar|marcar|hablar|contactar)/,
      /no (me |nos )(llame|llamen|llames|marque|marquen|marques|hablen|contacten|busquen)/,
      /ya no (me |nos )?(llame|llamen|llames|marque|marquen|marques|contacten)/,
      /(quitame|borrame|sacame|eliminame|dame de baja) de (su|la|tu) (lista|base|sistema)/,
      /(dejen de|deja de|dejenme de) (llamarme|marcarme|molestar|estar llamando)/,
      /no (estoy|estamos) interesad[oa]s?.{0,30}(no me (llamen|marquen)|gracias)/,
    ],
  },
];

/** Los datos que se pueden sacar de la propia frase, sin preguntarle a nadie. */
export const LEER: Partial<Record<AccionId, (frase: string) => Record<string, any>>> = {
  mandar_cotizacion: () => ({ tema: 'la cotización de Sacs' }),
  mandar_info: () => ({ tema: 'la información de Sacs' }),
  mandar_material: (f) => {
    const m = sinAcentos(f).match(/(catalogo|video|manual|presentacion|ficha tecnica|folleto|demo grabada)/);
    return { tema: m ? `el ${m[1]}` : 'lo que pidió en la llamada' };
  },
  volver_a_llamar: (f) => interpretarCuando(f) || {},
  agendar_demo: (f) => interpretarCuando(f) || {},
  ahorita_no: (f) => ({ cuando: interpretarCuando(f) }),
  soporte: (f) => ({ detalle: f.slice(0, 200) }),
  otro_contacto: (f) => ({ detalle: f.slice(0, 200) }),
  corregir_dato: (f) => {
    const correo = f.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
    return correo ? { campo: 'email', valor: correo, detalle: f.slice(0, 200) } : { detalle: f.slice(0, 200) };
  },
  no_llamar: (f) => ({ evidencia: f.slice(0, 200) }),
};

export type Detectada = { accion: AccionId | string; frase: string; origen: 'regla' | 'aprendida'; confianza: number; params: Record<string, any> };

/** Qué pide esta frase, según el catálogo. Vacío casi siempre, y está bien. */
export function detectarCatalogo(fraseCruda: string): Detectada[] {
  const frase = sinAcentos(fraseCruda);
  if (frase.trim().length < 6) return [];
  const salida: Detectada[] = [];
  for (const a of PATRONES) {
    if (a.res.some(re => re.test(frase))) {
      salida.push({ accion: a.id, frase: fraseCruda.slice(0, 300), origen: 'regla', confianza: 0.9, params: LEER[a.id]?.(fraseCruda) || {} });
    }
  }
  /* «Ahorita estoy manejando, márcame en un rato» es UNA petición, no dos.
     Las dos reglas la cazan —«en un rato» también es volver a llamar— y en
     pantalla salían dos tarjetas para lo mismo. Gana `ahorita_no`, que además
     ya deja el recordatorio solo; `volver_a_llamar` se queda sólo cuando dijo
     un día concreto («márcame el jueves»), que es otra cosa. */
  if (salida.some(d => d.accion === 'ahorita_no')) {
    const conDia = /\b(manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana)\b/.test(frase);
    if (!conDia) return salida.filter(d => d.accion !== 'volver_a_llamar');
  }
  return salida;
}
