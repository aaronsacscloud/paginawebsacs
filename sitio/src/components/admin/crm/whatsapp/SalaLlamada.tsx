/* LA SALA DE LA LLAMADA · lo que ves mientras hablas, y lo que ves al colgar.
 *
 * PEDIDO DEL DUEÑO (17-sep-2026): «cuando el cliente responda, que me aparezca
 * una pantalla, un modal bonito y grande, con el contexto de lo que se ha
 * hablado con la persona, las sucursales, la marca en grande, si hemos tenido
 * otras llamadas anteriormente, y la parte de agendar una reunión… Todo el
 * proceso similar al que tenemos automatizado en llamadas inteligentes.»
 *
 * Y EL SEGUNDO PEDIDO, el mismo día, después de una llamada real: «me pidió
 * una acción: enviar la información por WhatsApp. En el momento en que alguien
 * pida una acción, la IA tiene que ejecutar esa acción. Debes explicar qué
 * acción hiciste o, si no reconoces qué acción hacer, que yo te explique cuál
 * deberías hacer para que aprendas… Al momento de que yo responda, me tiene
 * que mostrar una pantalla completa con toda esta información.»
 *
 * DE AHÍ SALEN LAS DOS MITADES DE ESTA PANTALLA:
 *  · VIVA: quién es, qué se le ha dicho, lo que se está oyendo ahora mismo, y
 *    las acciones que pidió —hechas o a un clic—, más el campo para dictarle
 *    a la máquina lo que no reconoció (y que ahí aprende).
 *  · AL COLGAR: la misma pantalla se queda y se vuelve el resumen completo —lo
 *    que se hizo, lo que la IA propone cerrar— en vez de desaparecer dejando
 *    un toast. Una llamada que se evapora al colgar es una llamada que se
 *    escribe de memoria media hora después, o no se escribe.
 *
 * POR QUÉ ES UN COMPONENTE APARTE Y NO CÓDIGO DENTRO DE `Telefonia.tsx`.
 * La cabina de Llamadas inteligentes ya resuelve esto mismo para las llamadas
 * en lista. Duplicarlo daría dos salas que en un mes ya no se parecen y cada
 * arreglo habría que hacerlo dos veces. Esta nace fuera de las dos, viviendo
 * sólo de props y de endpoints que ya existen, para que la cabina pueda
 * adoptarla después sin arrastrar nada suyo.
 *
 * LO QUE NO HACE, A PROPÓSITO: no marca, no cuelga y no toca el micrófono. Eso
 * lo sigue haciendo el widget de `Telefonia.tsx`, que es quien tiene el Device
 * de Twilio. Esta sala mira y anota. Dos dueños del mismo audio es cómo se
 * corta una llamada viva.
 */
import { useEffect, useRef, useState } from 'react';
import { C } from './estilo';
import { telefonoLegible } from '../../../../lib/telefono';
import { useIsMobile } from '../../../../lib/ui/mobile';
import AccionesLlamada, { type Accion } from './AccionesLlamada';
import SelectorHorarios from './SelectorHorarios';
import { IcoCalendario, IcoChevronAbajo, IcoClip, IcoLapiz, IcoX } from './Iconos';

type Props = {
  telefono: string;
  /** El CallSid de Twilio: es la llave con la que el servidor encuentra ESTA
      llamada. Sin él la nota y el desenlace no tienen a qué colgarse. */
  callId?: string | null;
  nombre?: string | null;
  segundos: number;
  /** El texto del apunte vive arriba: al colgar tiene que seguir existiendo. */
  nota: string;
  setNota: (v: string) => void;
  onColgar: () => void;
  onSilenciar: () => void;
  mudo: boolean;
  onCerrar: () => void;
  /** Los tonos del conmutador («marque 1 para ventas»): el Device es de
      `Telefonia.tsx`, aquí sólo se pintan las teclas. */
  onTono?: (d: string) => void;
  tonos?: string;
  /** Ya se colgó: la sala se queda, pero como resumen. */
  fin?: boolean;
};

const RESULTADOS: { id: string; l: string; tono: string }[] = [
  { id: 'interesado', l: 'Le interesa', tono: '#1E8A63' },
  { id: 'agendado', l: 'Quedamos de vernos', tono: '#1E8A63' },
  { id: 'volver', l: 'Volver a llamar', tono: '#9a6a10' },
  { id: 'no_interesa', l: 'No le interesa', tono: '#C0554E' },
  { id: 'no_era', l: 'No era él', tono: '#74727F' },
];

/* ══ EL MISMO VOCABULARIO QUE LA CABINA (22-sep-2026) ═══════════════════
   Estos chips guardaban `volver`, `interesado`, `agendado`… y el cierre con IA
   (el mismo de Llamadas inteligentes) habla `volver_llamar`, `contesto`,
   `no_interesa`. Como lo que elige el vendedor MANDA sobre lo que propone la
   IA, un «Volver a llamar» hecho a mano nunca dejaba la llamada de vuelta
   programada. Aquí se traduce al salir; los chips se quedan como están. */
const A_CIERRE: Record<string, string> = { interesado: 'contesto', agendado: 'contesto', volver: 'volver_llamar', no_interesa: 'no_interesa', no_era: 'contesto' };
const DE_CIERRE: Record<string, string> = { contesto: 'Contestó', volver_llamar: 'Volver a llamar', dieron_datos: 'Dio datos', no_interesa: 'No le interesa', buzon: 'Era buzón' };
const aCierre = (r: string) => A_CIERRE[r] || r || '';
const notaCon = (r: string, nota: string) => r === 'no_era' ? `No era la persona que buscábamos.${nota ? `\n${nota}` : ''}` : nota;
/* Las etiquetas de la etapa, las mismas de `ti/ContextoLead.tsx`: «lead» en
   minúsculas es el valor crudo de la base, no algo que se lea en pantalla. */
const ETAPA_L: Record<string, string> = { lead: 'Lead', lead_calificado: 'Lead calificado', oportunidad: 'Oportunidad', cliente: 'Cliente', descalificado: 'Descalificado', rezagado: 'Rezagado', churned: 'Churn', suscriptor: 'Suscriptor' };

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
/* «+52 56 1035 3669» NO es un nombre. Quien llama de fuera llega sin nombre y
   en el camino alguien lo sustituye por el teléfono legible; si eso gana, la
   ficha —que sí tiene el nombre— nunca se enseña. Es exactamente lo que
   reportó el dueño: «me aparecía el nombre de la empresa, no el de la persona». */
const esNumero = (s?: string | null) => !String(s || '').trim() || /^[+\d\s()\-.]+$/.test(String(s));
const dia = (f: any) => (f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');
/* «2026-09-25 a las 16:00» es la base hablando, no el vendedor: se dice
   «jueves 25 sep, 4:00 p.m.», que es como se le repite al cliente. La fecha
   llega sin zona (día de calendario): se arma a mediodía para que ningún
   huso la corra al día anterior. */
const fechaHumana = (f?: string | null, h?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  if (!m) return [f, h].filter(Boolean).join(' ');
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  const txt = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
  const hm = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  if (!hm) return txt;
  const hh = +hm[1];
  return `${txt}, ${hh % 12 || 12}:${hm[2]} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
};

/* Una sola forma de decir la hora en la hoja: «16:00» que escribe la IA se
   lee «4:00 p.m.», igual que los compromisos de abajo. Sólo formato. */
const horaHumana = (t: string) => String(t || '').replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_m, h, mm) => `${+h % 12 || 12}:${mm}\u00a0${+h < 12 ? 'a.m.' : 'p.m.'}`);

/* El mismo auricular caído de la pantalla oscura (Telefonia.tsx): Colgar se
   reconoce por su forma, no por dónde está. */
const IcoColgar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: 'rotate(135deg)', flexShrink: 0 }}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor" />
  </svg>
);

/* Micrófono y teclado: los mismos trazos de la botonera de la pantalla oscura
   (Telefonia.tsx). Silenciar y Teclas tienen que verse igual al pasar de una
   pantalla a la otra en la misma llamada. */
const IcoMic = ({ apagado }: { apagado?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
    <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    {apagado && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
  </svg>
);
const IcoTeclas = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
    {[5, 12, 19].flatMap(y => [5, 12, 19].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
  </svg>
);

export default function SalaLlamada({ telefono, callId, nombre, segundos, nota, setNota, onColgar, onSilenciar, mudo, onCerrar, onTono, tonos, fin }: Props) {
  /* En el teléfono esto NO es un modal: es la pantalla. Un recuadro centrado
     con el CRM asomando por los bordes, en 390 píxeles, se lee como algo que
     se va a cerrar solo — y aquí es donde se trabaja la llamada. */
  const esMovil = useIsMobile();
  const [ctx, setCtx] = useState<any>(null);
  const [horarios, setHorarios] = useState<any[] | null>(null);
  const [resultado, setResultado] = useState('');
  const [volverEl, setVolverEl] = useState('');
  const [guardado, setGuardado] = useState<'no' | 'guardando' | 'ok'>('no');
  const [msg, setMsg] = useState('');

  /* Lo que el servidor está oyendo y lo que ya detectó que el cliente pidió. */
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [oido, setOido] = useState<any[]>([]);
  const [cierre, setCierre] = useState<any>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [aplicado, setAplicado] = useState<string[] | null>(null);
  const [teclas, setTeclas] = useState(false);
  /* Resumen de la IA al colgar, en el teléfono: tres renglones y «Ver más», como la cabina. */
  const [notaEntera, setNotaEntera] = useState(false);
  /* «Ver» de la barra del cierre: lleva al pendiente y lo marca un momento,
     para que el ojo sepa qué era lo que faltaba. */
  const [resaltar, setResaltar] = useState(false);
  const irAPendientes = () => {
    document.querySelector('[data-sala-acciones]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setResaltar(true);
    setTimeout(() => setResaltar(false), 1600);
  };
  /* LA CABECERA SE ENCOGE AL BAJAR (sólo teléfono). Con reloj, marca y dos
     renglones de nombre y teléfono medía ~112 px fijos: en 360×780, sumada a
     la barra del pulgar, era un cuarto de la pantalla sin contenido. Al hacer
     scroll se queda reloj + marca + Minimizar. Con histéresis (60/12) para
     que el cambio de alto no la haga parpadear en el umbral. */
  const [compacta, setCompacta] = useState(false);
  /* Desde el primer scroll (23-sep-2026): la cabecera ya NO está dentro de lo
     que scrollea, así que encogerla no mueve el contenido y el umbral puede
     ser casi cero. En 360 cada píxel de cabecera es un renglón menos. */
  const alBajar = (e: any) => {
    const y = e.currentTarget.scrollTop;
    setCompacta(c => (c ? y > 2 : y > 12));
  };
  /* CON EL TECLADO ABIERTO LA BARRA DEL PULGAR SE ESCONDE (sólo teléfono).
     Teclado + barra fija de Colgar dejaban el apunte o «Dime qué había que
     hacer» debajo de las dos. Mientras se escribe, Colgar sube a la cabecera
     (en lugar de Minimizar) y la barra vuelve en cuanto se suelta el campo. */
  const [escribiendo, setEscribiendo] = useState(false);
  const esCampo = (el: any) => el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && /^(text|search|tel|email|number|url|)$/.test(el.type || ''));
  const alEnfocar = (e: any) => { if (esCampo(e.target)) setEscribiendo(true); };
  const alSoltar = (e: any) => { if (esCampo(e.target) && !esCampo(e.relatedTarget)) setEscribiendo(false); };
  const barra = esMovil && !escribiendo;
  /* AL COLGAR, EL CUERPO VUELVE ARRIBA: el cierre se pinta primero, y si se
     colgaba con el scroll a media sala (en el apunte, digamos) la pantalla se
     quedaba ahí y lo que había que confirmar quedaba fuera de la vista. */
  const cuerpo = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (fin && cuerpo.current) cuerpo.current.scrollTop = 0; }, [fin]);

  useEffect(() => {
    fetch(`/api/crm/telefonia/contexto?telefono=${encodeURIComponent(telefono)}`)
      .then(r => r.json()).then(j => j?.hay && setCtx(j)).catch(() => {});
  }, [telefono]);

  /* ══ EL PULSO DE LA SALA ═══════════════════════════════════════════════
     Cada 3 s se pregunta qué se ha oído y qué acciones aparecieron. Tres
     segundos es el punto donde una petición («mándame la info») se ve casi
     inmediata sin convertir la pantalla en un ventilador de red. Se para en
     cuanto se cuelga: ahí ya no llega nada nuevo. */
  useEffect(() => {
    if (!callId || fin) return;
    let vivo = true;
    let veces = 0;
    let t: any = null;
    const tira = async () => {
      veces++;
      const j = await fetch(`/api/crm/telefonia/sala?call_id=${encodeURIComponent(callId)}`).then(r => r.json()).catch(() => null);
      if (!vivo) return;
      if (j?.hay) {
        setAcciones(j.acciones || []);
        setOido(j.oido || []);
        setItemId(j.item_id || null);
        if (j.cierre?.estado) setCierre(j.cierre);
      }
      /* Se pregunta cada 3 s los primeros cinco minutos —que es cuando se
         deciden las cosas— y cada 8 s si la llamada se alarga. Una llamada de
         cuarenta minutos a tres segundos son ochocientas consultas para ver lo
         mismo. */
      if (vivo) t = setTimeout(tira, veces > 100 ? 8000 : 3000);
    };
    tira();
    return () => { vivo = false; if (t) clearTimeout(t); };
  }, [callId, fin]);

  /* LA NOTA SE GUARDA SOLA. Un cierre que se pierde por cerrar la pestaña es
     peor que no tener nota: creíste que quedó escrito y no vuelves a mirarlo.
     Cada 4 s de silencio del teclado, no en cada tecla. */
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    if (!nota.trim() || !callId) return;
    setGuardado('guardando');
    const t = setTimeout(() => {
      fetch('/api/crm/telefonia/nota', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, texto: nota }),
      }).then(r => setGuardado(r.ok ? 'ok' : 'no')).catch(() => setGuardado('no'));
    }, 4000);
    return () => clearTimeout(t);
  }, [nota, callId]);

  /* Los horarios REALES, no un «te mando la liga». Se piden al abrir la agenda
     y no al abrir la sala: la mayoría de las llamadas no acaban en cita, y
     traerlos siempre sería pagar una consulta por cada timbrazo. */
  /* El tipo de reunión decide los horarios (22-sep-2026): una discovery de 15
     min y una demo de 30 no tienen los mismos huecos ni la misma agenda. */
  const [tipos, setTipos] = useState<any[]>([]);
  const [tipo, setTipo] = useState<string>(() => { try { return JSON.parse(localStorage.getItem('cabina.tipocita') || '"demo"'); } catch { return 'demo'; } });
  const verHorarios = async (slug: string = tipo) => {
    setHorarios([]); setMsg('');
    if (!tipos.length) fetch('/api/scheduling/event-types?activo=true').then(r => r.json()).then(j => setTipos(Array.isArray(j) ? j : [])).catch(() => {});
    /* `available-slots` y NO `availability`: el segundo devuelve la
       CONFIGURACIÓN de tu agenda (horarios semanales y excepciones), no huecos
       libres. Empecé pidiéndole slots y siempre devolvía la lista vacía sin
       decir por qué — el clásico «no hay horarios» que en realidad es «estás
       preguntando a la puerta equivocada». Éste sí cruza tu agenda con Google
       y devuelve los huecos de verdad. */
    const hoy = new Date().toISOString().slice(0, 10);
    const hasta = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const j = await fetch(`/api/scheduling/available-slots?slug=${encodeURIComponent(slug)}&from=${hoy}&to=${hasta}`)
      .then(r => r.json()).catch(() => null);
    if (j?.error) { setMsg(`No se pudieron traer los horarios: ${j.error}`); setHorarios([]); return; }
    /* La forma que devuelve es `{dates: {"2026-09-18": ["13:00","15:00"]}}`.
       Medido contra el endpoint, no supuesto: la primera versión buscaba
       `slots` y siempre pintaba vacío. */
    const slots = Object.entries(j?.dates || {}).sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([fecha, horas]: any) => (horas || []).map((hora: string) => ({ fecha, hora: String(hora).slice(0, 5) })));
    setHorarios(slots);   // todos: el selector enseña hasta 7 días, día por día
  };

  /* «TE MANDO LA LIGA» DESDE AQUÍ, no después. El «después» es media hora más
     tarde, cuando ya vas por la cuarta llamada y no te acuerdas — y es
     exactamente la cita que se pierde. */
  const [ligaEnviada, setLigaEnviada] = useState(false);
  const mandarLiga = async () => {
    setLigaEnviada(true);
    const r = await fetch('/api/crm/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono, texto: 'Como quedamos, aquí puedes elegir el día y la hora que te acomode: https://www.sacscloud.com/agendar/demo' }),
    }).then(x => x.json()).catch(() => null);
    if (r?.error) { setLigaEnviada(false); setMsg(r.error); }
  };

  /* ══ LO QUE TE PIDIÓ, HECHO EN EL MOMENTO ══════════════════════════════
     Todo pasa por el mismo endpoint y todo vuelve con la lista de acciones ya
     actualizada: una sola fuente de verdad en pantalla, aunque la acción la
     haya disparado el servidor al oírla y no tú. */
  const api = async (cuerpo: any) => {
    const j = await fetch('/api/crm/telefonia/sala', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, ...cuerpo }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo: revisa la conexión' }));
    if (j?.acciones) setAcciones(j.acciones);
    return j;
  };

  /* ══ COLGAR ════════════════════════════════════════════════════════════
     Se cuelga el audio PRIMERO —el cliente no tiene por qué esperar a que el
     CRM escriba— y después se cierra la llamada en el servidor: item cerrado y
     cierre con IA pedido. La pantalla se queda enseñando el resultado. */
  /* ══ COLGAR Y CERRAR, IGUAL QUE LA CABINA (22-sep-2026) ═══════════════
     Pedido del dueño: «al terminar la llamada, en vez de sugerirme las
     acciones como la salida de llamada inteligente, lo tengo que hacer
     manual». Antes no se podía colgar sin elegir «qué pasó», y la IA sólo
     leía la llamada DESPUÉS de eso. Ahora es como en la cabina: se cuelga
     cuando quieras, la IA lee la llamada y PROPONE el resultado, el apunte,
     la etapa, los compromisos y los envíos; tú confirmas o corriges. Elegir
     «qué pasó» sigue sirviendo, pero ya no es un requisito. */
  const pedido = useRef(false);
  const cerrarLlamada = async () => {
    if (pedido.current) return;
    pedido.current = true;
    setMsg(''); setCerrando(true);
    onColgar();
    if (callId) {
      if (nota.trim() || resultado) await fetch('/api/crm/telefonia/nota', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, texto: notaCon(resultado, nota), resultado: aCierre(resultado) || undefined, volver_el: volverEl || null }),
      }).catch(() => {});
      const j = await api({ accion: 'cerrar', resultado: aCierre(resultado) || null, nota: notaCon(resultado, nota) || null });
      if (j?.item_id) setItemId(j.item_id);
      if (j?.cierre) setCierre(j.cierre);
      else if (!j?.ok) setCierre({ estado: null, propuesta: null, motivo: j?.error || null });
    }
    setCerrando(false);
  };
  /* Colgó el cliente (lo normal): el cierre arranca solo, sin esperar a que
     alguien elija nada. Es la mitad que faltaba para que la llamada manual
     haga lo mismo que la de la lista. */
  useEffect(() => {
    if (fin && callId && !cierre && !aplicado) cerrarLlamada();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, callId]);

  const aplicarCierre = async () => {
    setCerrando(true);
    const j = await api({ accion: 'aplicar', item_id: itemId, resultado: aCierre(resultado) || undefined, nota: notaCon(resultado, nota) || undefined });
    setCerrando(false);
    if (j?.hecho) setAplicado(j.hecho);
    else setMsg(j?.error || 'No se pudo aplicar el cierre');
  };

  /* EN EL TELÉFONO, TAMAÑOS DE PULGAR (23-sep-2026). Todo lo que se toca mide
     44 px o más y el texto de cuerpo 14: en plena llamada se lee de reojo y se
     pica con la mano que sostiene el aparato. El escritorio se queda igual. */
  const M = esMovil;
  const FS = M ? 14 : 12.5;             // texto de cuerpo
  const CAJA: any = { background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 14, padding: M ? '14px 14px' : '14px 16px' };
  const ROT: any = { fontSize: M ? 12 : 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: M ? C.g500 : '#999', marginBottom: 7 };
  const BTN: any = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: M ? 12 : 9, padding: M ? '12px 14px' : '8px 12px', fontSize: M ? 15 : 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', ...(M ? { minHeight: 48 } : null) };
  const CHIP: any = { fontSize: M ? 12.5 : 11, fontWeight: 800, borderRadius: 999, padding: M ? '4px 10px' : '3px 9px' };

  /* AL COLGAR, EN EL TELÉFONO, lo que ya se leyó se pliega: la transcripción
     entera y los WhatsApp repetidos empujaban el cierre (lo que hay que
     confirmar) a tres pantallas de scroll. Siguen a un toque. */
  const plegar = M && !!fin;
  const plegable = (titulo: string, cuerpo: any) => (
    <details style={{ ...CAJA, padding: '4px 14px' }}>
      <summary style={{ fontSize: 14, fontWeight: 700, color: C.moradoTinta, cursor: 'pointer' }}>{titulo}</summary>
      <div style={{ paddingBottom: 12 }}>{cuerpo}</div>
    </details>
  );

  /* EL TECLADO DE TONOS: el mismo en la barra del teléfono y en la caja del
     escritorio. Sirve para los conmutadores («marque 1 para ventas»). */
  const teclado = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(d => (
        <button key={d} onClick={() => onTono?.(d)} style={{ border: `1px solid ${C.g200}`, background: '#fff', color: C.g900, borderRadius: M ? 12 : 9, minHeight: M ? 52 : 36, fontSize: M ? 19 : 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{d}</button>
      ))}
    </div>
  );

  /* Quién es, en una sola decisión y no repartida por la pantalla. */
  const persona = ctx?.nombre || (esNumero(nombre) ? null : nombre);
  const titulo = ctx?.marca || ctx?.empresa || persona || telefonoLegible(telefono);
  const hechas = acciones.filter(a => a.estado === 'hecha');
  const abiertas = acciones.filter(a => ['propuesta', 'haciendo', 'pregunta', 'fallo'].includes(a.estado));
  const p = cierre?.propuesta;

  /* Lo que se está oyendo, aparte: en el escritorio va en la columna de la
     izquierda y en el TELÉFONO arriba del todo, pegado a las acciones. Es lo
     único que se mira mientras se habla. */
  /* ══ LO QUE SE ESTÁ OYENDO ═════════════════════════════════════════════
     No es un adorno: es la prueba de que la máquina oye lo mismo que tú.
     Cuando propone una acción rara, aquí se ve por qué. */
  const bloqueOido = (oido.length > 0 || !fin) ? (plegar ? plegable(`Ver lo que se dijo (${oido.length})`, (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {oido.map((o, i) => (
                      <div key={i} style={{ fontSize: FS, lineHeight: 1.45 }}>
                        <b style={{ color: o.quien === 'vendedor' ? C.moradoTinta : '#1E8A63' }}>{o.quien === 'vendedor' ? 'Tú' : 'Él'}</b>
                        <span style={{ color: '#33313d' }}> · {o.texto}</span>
                      </div>
                    ))}
                  </div>
  )) :
              <div style={{ ...CAJA, background: fin ? '#fff' : '#FCFBFF' }}>
                <div style={{ ...ROT, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {fin ? 'Lo que se dijo' : 'Lo que se está oyendo'}
                  {!fin && <span style={{ width: 7, height: 7, borderRadius: 999, background: oido.length ? '#1E8A63' : '#d8d5e4', display: 'inline-block' }} />}
                </div>
                {!oido.length ? (
                  <div style={{ fontSize: FS, color: C.g500 }}>
                    Todavía nada. La transcripción tarda unos segundos en arrancar; si no llega, la llamada igual se graba y la minuta cae al colgar.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 4, maxHeight: fin ? 320 : 180, overflowY: 'auto' }}>
                    {oido.map((o, i) => (
                      <div key={i} style={{ fontSize: FS, lineHeight: 1.45 }}>
                        <b style={{ color: o.quien === 'vendedor' ? C.moradoTinta : '#1E8A63' }}>{o.quien === 'vendedor' ? 'Tú' : 'Él'}</b>
                        <span style={{ color: '#33313d' }}> · {o.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
  ) : null;

  /* LOS CHIPS DE «¿QUÉ PASÓ?» · se usan en dos sitios: en su caja mientras
     hablas, y DENTRO del bloque de cierre cuando colgó el cliente — ahí tienen
     que estar pegados al botón que los necesita, no al final de la columna. */
  const quePaso = (
    <>
      <div style={{ display: 'flex', gap: M ? 8 : 6, flexWrap: 'wrap' }}>
        {RESULTADOS.map(r => (
          <button key={r.id} onClick={() => setResultado(r.id)} aria-pressed={resultado === r.id}
            /* En el teléfono son opción de contenido, como «Cómo quedó» de la
               cabina: contorno lila, texto morado y radio 12; elegida, fondo agua. */
            style={M ? {
              border: '1.5px solid #9B8CFA', background: resultado === r.id ? C.moradoAgua : '#fff', color: C.moradoTinta,
              borderRadius: 12, padding: '0 14px', fontSize: 14, minHeight: 44, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            } : { border: `1px solid ${resultado === r.id ? r.tono : C.g200}`, background: '#fff',
              color: resultado === r.id ? r.tono : C.g500, borderRadius: 999, padding: '6px 12px', fontSize: 12.5,
              fontWeight: resultado === r.id ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{r.l}</button>
        ))}
      </div>
      {/* «Volver a llamar» sin fecha es la promesa que ya nos costó esta gente:
          si se elige, se pide el día. */}
      {resultado === 'volver' && (
        <label style={{ display: 'block', marginTop: 9 }}>
          <span style={{ ...ROT, marginBottom: 4 }}>¿Qué día le vuelves a marcar?</span>
          <input type="date" value={volverEl} min={new Date().toISOString().slice(0, 10)}
            onChange={e => setVolverEl(e.target.value)}
            style={{ border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 11px', fontSize: M ? 16 : 13, fontFamily: 'inherit', ...(M ? { minHeight: 48, width: '100%', boxSizing: 'border-box' } : null) }} />
        </label>
      )}
    </>
  );

  /* LOS AVISOS DE LA CABECERA (de dónde nos conoce, seguimiento, descalificado).
     En el escritorio van bajo el nombre; en el TELÉFONO bajan al cuerpo, arriba
     de todo: dentro de la cabecera fija se comían un tercio de la pantalla y
     empujaban lo que el cliente está pidiendo fuera de la vista. */
  const avisos = ctx && (ctx.origen?.detalle || ctx.seguimiento || ctx.descalificado) ? (
    <>
      {ctx?.origen?.detalle && (
        <span style={{ display: 'block', marginTop: 6, fontSize: M ? 14 : 12.5, fontWeight: 700, background: '#F6F4FF', color: C.moradoTinta, borderRadius: 10, padding: '6px 11px', lineHeight: 1.45 }}>
          ¿De dónde nos conoce? {ctx.origen.detalle}
        </span>
      )}
      {ctx?.seguimiento && (
        <span style={{ display: 'block', marginTop: 6, fontSize: M ? 14 : 12.5, fontWeight: 800, background: '#EEECFE', color: C.moradoTinta, borderRadius: 10, padding: '6px 11px' }}>
          Llamada de seguimiento: le prometiste llamarle ({ctx.seguimiento.hora}). Al colgar queda cumplida.
        </span>
      )}
      {ctx?.descalificado && (
        <span style={{ display: 'block', marginTop: 6, fontSize: M ? 14 : 12.5, fontWeight: 800, background: '#FDEDEB', color: '#C0554E', borderRadius: 10, padding: '6px 11px' }}>
          Ojo: este lead se descalificó el {ctx.descalificado}. Las listas automáticas ya no lo incluyen.
        </span>
      )}
    </>
  ) : null;

  /* El renglón de quién y dónde, bajo el nombre grande. En el escritorio va
     junto al reloj; en el TELÉFONO baja a todo lo ancho de la cabecera: al
     lado del reloj y de «Minimizar» le quedaban 200 px y se partía en cuatro
     renglones. */
  const subtitulo = (
    <>
    <span style={{ display: 'block', fontSize: M ? 14 : 13, color: C.g500, marginTop: 3, lineHeight: 1.35 }}>
      {/* Sin repetir el título: cuando no hay marca, el nombre YA está
          arriba en grande y volver a ponerlo abajo se lee como un error. */}
      {/* El teléfono no se parte: «+52 55 5010 / 0100» en dos renglones
          es un número que ya no se puede dictar. Cada pieza en su span. */}
      {/* En el TELÉFONO, dos renglones fijos: quién (nombre · puesto) y
          dónde (teléfono · ciudad). Seguidos se partían en tres, con el
          «·» colgando al final de cada uno, y la cabecera fija crecía. */}
      {esMovil ? [[persona === titulo ? null : persona, ctx?.puesto], [telefonoLegible(telefono), ctx?.ciudad]].map((r, j) => {
        const fila = r.filter(Boolean) as string[];
        return fila.length ? (
          <span key={j} style={{ display: 'block', overflowWrap: 'anywhere' }}>
            {fila.map((t, i) => <span key={i} style={{ whiteSpace: j === 1 && !i ? 'nowrap' : undefined }}>{i ? ' · ' : ''}{t}</span>)}
          </span>
        ) : null;
      }) : [persona === titulo ? null : persona, ctx?.puesto, telefonoLegible(telefono), ctx?.ciudad].filter(Boolean).map((t, i) => (
        <span key={i} style={{ whiteSpace: t === telefonoLegible(telefono) ? 'nowrap' : undefined }}>{i ? ' · ' : ''}{t}</span>
      ))}
    </span>
    {/* SU HORA, NO LA TUYA. Marcar a Tijuana a las 9 de CDMX es llamar
        a las 7, y esa llamada no se recupera con una disculpa. Sólo se
        enseña si difiere: repetir tu propia hora es ruido. */}
    {ctx?.hora_local && (
      M ? (
        /* En el teléfono es un estado, no un botón: punto y texto, sin pastilla. */
        <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, fontWeight: 600, color: '#9a6a10' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: '#E8A838', flexShrink: 0 }} />
          Allá son las {ctx.hora_local.hora}
        </span>
      ) : (
      <span style={{ display: 'inline-block', marginTop: 5, fontSize: M ? 12.5 : 11.5, fontWeight: 800, background: '#FFF4E5', color: '#9a6a10', borderRadius: 999, padding: '3px 10px' }}>
        Allá son las {ctx.hora_local.hora}
      </span>
      )
    )}
    </>
  );

  return (
    <>
      {!esMovil && <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,11,18,.55)', zIndex: 980 }} />}
      {/* LO QUE PINTAN LOS HIJOS, A TAMAÑO DE PULGAR. `AccionesLlamada` y
          `SelectorHorarios` se comparten con la cabina y traen sus propios
          tamaños de escritorio (botones de 32 px, campos de 36, pegados a 6).
          Aquí, sólo dentro de la sala del teléfono, se suben al mínimo de un
          dedo: 44 px de alto, 8 de aire y 16 en los campos para que iOS no
          haga zoom al tocarlos. El escritorio no ve esta regla. */}
      {esMovil && <style>{`
        [data-sala-m] button, [data-sala-m] input:not([type=checkbox]):not([type=radio]), [data-sala-m] select { min-height: 44px; }
        [data-sala-m] input, [data-sala-m] select, [data-sala-m] textarea { font-size: 16px !important; }
        [data-sala-m] input[type=date], [data-sala-m] input[type=time] { width: 100%; box-sizing: border-box; }
        [data-sala-m] div:has(> button + button) { gap: 8px !important; }
        [data-sala-m] summary { min-height: 44px; display: flex; align-items: center; }
        [data-sala-m] textarea { min-height: 96px; }
        /* Los atajos apagados de «Te pidió algo» (ya están arriba) quedaban a
           1.3:1 de contraste y sin decir por qué. Legibles y con su razón. */
        [data-sala-m] button[disabled][style*="opacity: 0.4"] { opacity: 1 !important; background: #F3F2F7 !important; color: #6E6B7B !important; border-style: dashed !important; }
        [data-sala-m] button[disabled][style*="opacity: 0.4"]::after { content: ' · ya está arriba'; font-weight: 600; }
        /* En el teléfono los atajos que ya están arriba sobran: cuatro renglones
           de chips para decir «esto ya lo tienes» alargaban la sala una pantalla.
           Los que quedan van en rejilla de dos, a lo ancho. */
        [data-sala-m] [data-sala-acciones] button[disabled][style*="opacity: 0.4"] { display: none !important; }
        [data-sala-m] [data-sala-acciones] div[style*="gap: 5px"] { display: grid !important; grid-template-columns: 1fr 1fr; }
        [data-sala-m] [data-sala-acciones] div[style*="gap: 5px"] > button { width: 100%; padding: 8px 10px !important; line-height: 1.2; }
        /* EL TEXTO DE «TE PIDIÓ ALGO», A TAMAÑO DE LECTURA. El panel es el de la
           cabina (12 px, pensado para una columna de escritorio); aquí se lee
           de reojo con el aparato en la mano: cuerpo a 14, título a 15, las
           etiquetas a 12 y los botones a 15 como los de la barra. */
        [data-sala-m] [data-sala-acciones] b { font-size: 15px !important; line-height: 1.3; }
        [data-sala-m] [data-sala-acciones] div[style*="font-size: 11px"],
        [data-sala-m] [data-sala-acciones] div[style*="font-size: 11.5px"],
        [data-sala-m] [data-sala-acciones] div[style*="font-size: 12px"],
        [data-sala-m] [data-sala-acciones] div[style*="font-size: 12.5px"] { font-size: 14px !important; line-height: 1.45; }
        [data-sala-m] [data-sala-acciones] div[style*="font-size: 10px"],
        [data-sala-m] [data-sala-acciones] span[style*="font-size: 10px"],
        [data-sala-m] [data-sala-acciones] label[style*="font-size: 10.5px"] { font-size: 12px !important; }
        [data-sala-m] [data-sala-acciones] button { font-size: 15px !important; }
        /* Los rótulos de «Te pidió algo» y las etiquetas Día/Hora vienen en
           #999 (2.8:1 sobre blanco). En el teléfono van en el gris de rótulo de
           la cabina (#6B7280, 4.8:1): un solo gris para el mismo papel. */
        [data-sala-m] [data-sala-acciones] [style*="color: rgb(153, 153, 153)"],
        [data-sala-m] [data-sala-acciones] [style*="color: rgb(165, 162, 175)"] { color: #6B7280 !important; }
        [data-sala-m] [data-sala-acciones] div[style*="gap: 5px"] > button { font-size: 14px !important; }
        /* Día y Hora: lado a lado, cada uno a la mitad de la tarjeta (el
           minWidth de escritorio los dejaba a dos tercios y sueltos). */
        [data-sala-m] [data-sala-acciones] label { flex: 1 1 130px; min-width: 0; }
        [data-sala-m] [data-sala-acciones] div:has(> label) { gap: 8px !important; }
        /* «Hazlo y apréndelo» / «Mandarlo y guardarlo»: a lo ancho, bajo su campo. */
        [data-sala-m] [data-sala-acciones] textarea + button { width: 100%; margin-top: 8px !important; }
        [data-sala-m] [data-sala-acciones] label input { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
        [data-sala-m] [data-sala-acciones] div:has(> button:first-child + button:last-child) > button { flex: 1 1 0; }
        /* Al colgar, el «Hacerlo» morado de una acción pendiente competía con
           «Aplicar el cierre» de la barra: se vuelve secundario. */
        /* LA MISMA JERARQUÍA EN TODA LA SALA (24-sep-2026): el único principal
           de la pantalla vive en la barra (Colgar o «Aplicar el cierre»). En
           «Te pidió algo», «Hacerlo» es opción de contenido —contorno lila,
           texto morado— igual en la llamada y al colgar; «No era eso» y los
           atajos son secundarios; el acento de la tarjeta es el lila #9B8CFA. */
        [data-sala-m] [data-sala-acciones] button { border-radius: 12px !important; }
        [data-sala-m] [data-sala-acciones] div:has(> button:first-child + button:last-child) > button:first-child:not(:disabled) { background: #fff !important; color: ${C.moradoTinta} !important; border: 1.5px solid #9B8CFA !important; font-weight: 800; }
        [data-sala-m] [data-sala-acciones] div:has(> button:first-child + button:last-child) > button:last-child,
        [data-sala-m] [data-sala-acciones] div[style*="gap: 5px"] > button:not([disabled]) { color: ${C.g700} !important; border: 1px solid ${C.g200} !important; font-weight: 800 !important; }
        [data-sala-m] [data-sala-acciones] textarea + button { border: 1.5px solid #9B8CFA !important; color: ${C.moradoTinta} !important; background: #fff !important; }
        [data-sala-m] [data-sala-acciones] > div[style*="rgb(91, 75, 214)"] { border-color: #9B8CFA !important; }
      `}</style>}
      <div role="dialog" data-sala-m={esMovil ? '' : undefined} data-sala-fin={esMovil && fin ? '' : undefined} aria-label={fin ? 'Resumen de la llamada' : 'Llamada en curso'} onFocus={esMovil ? alEnfocar : undefined} onBlur={esMovil ? alSoltar : undefined} style={esMovil ? {
        /* EN EL TELÉFONO, TRES PISOS QUE NO SE ENCIMAN (23-sep-2026): cabecera,
           cuerpo que scrollea y barra del pulgar. Antes todo scrolleaba junto
           y las barras eran `sticky`: el contenido pasaba POR DEBAJO de la barra
           y un «Hacerlo» quedaba cortado y a 0 px de «Colgar». Ahora el scroll
           termina donde empieza la barra. */
        position: 'fixed', inset: 0, zIndex: 1001, background: C.g50,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      } : {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(1040px, 96vw)', maxHeight: '92vh', overflowY: 'auto', zIndex: 981,
        background: C.g50, borderRadius: 20, boxShadow: '0 24px 70px rgba(12,11,18,.4)',
      }}>
        {/* ══ LA CABECERA EN EL TELÉFONO (24-sep-2026): la misma del armador,
            la cabina y la sala manual. Salir a la izquierda (chevron si la
            llamada sigue, ✕ si ya terminó), la marca como título —a 22 px,
            la única excepción, porque se dice en voz alta— y el reloj como
            texto a la derecha, sin caja. */}
        {esMovil && (
          <div style={{ flexShrink: 0, position: 'relative', zIndex: 2, background: '#fff', borderBottom: `1px solid ${C.g200}`, padding: 'max(6px, env(safe-area-inset-top)) 12px 6px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
              {fin ? (
                <button onClick={onCerrar} aria-label="Cerrar"
                  style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', color: C.g500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                  <IcoX size={20} />
                </button>
              ) : (
                <button onClick={onCerrar} aria-label="Minimizar (la llamada sigue)" title="Minimizar (la llamada sigue)"
                  style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', color: C.g500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                  <IcoChevronAbajo size={20} />
                </button>
              )}
              <b style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: C.g900, overflowWrap: 'anywhere' }}>{titulo}</b>
              {/* Con el teclado abierto la barra de abajo se esconde: Colgar sube
                  aquí para que nunca quede sin salida en plena llamada. */}
              {!fin && escribiendo ? (
                <button onMouseDown={e => e.preventDefault()} onClick={cerrarLlamada} disabled={cerrando} aria-label="Colgar"
                  style={{ minHeight: 44, flexShrink: 0, borderRadius: 12, border: 'none', background: '#C0554E', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '0 14px 0 12px', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  <IcoColgar size={18} />{cerrando ? 'Cerrando…' : 'Colgar'}
                </button>
              ) : (
                <span role="timer" aria-label={`Duración ${reloj(segundos)}`} style={{ flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center', paddingLeft: 8, fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: fin ? C.g500 : C.morado }}>
                  {reloj(segundos)}
                </span>
              )}
            </div>
            {!compacta && <div style={{ minWidth: 0, paddingLeft: 48, marginTop: -4 }}>{subtitulo}</div>}
          </div>
        )}
        {/* ══ LA CABECERA: la marca en grande, que es lo que se pidió primero.
            Es lo que dice en voz alta quien contesta, y equivocarla en el
            saludo cuesta la llamada entera. */}
        {!esMovil && <div style={{
          padding: esMovil ? '12px 16px 10px' : '20px 24px 16px', background: '#fff',
          borderRadius: esMovil ? 0 : '20px 20px 0 0', borderBottom: `1px solid ${C.g200}`,
          display: 'flex', alignItems: 'center', gap: esMovil ? 10 : 16, flexWrap: 'wrap',
          ...(esMovil ? { flexShrink: 0, position: 'relative', zIndex: 2, paddingTop: compacta ? 'max(8px, env(safe-area-inset-top))' : 'max(12px, env(safe-area-inset-top))', paddingBottom: compacta ? 8 : 10 } : {}),
        }}>
          <span style={{ width: M ? 52 : 54, height: M ? 44 : 54, borderRadius: M ? 12 : 16, background: fin ? C.g100 : C.moradoAgua, color: fin ? C.g500 : C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: M ? 17 : 22, fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {reloj(segundos)}
          </span>
          <span style={{ flex: M ? '1 1 0' : '1 1 260px', minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: M ? (compacta ? 19 : 22) : 26, letterSpacing: '-0.03em', lineHeight: 1.1, overflowWrap: 'anywhere' }}>{titulo}</b>
            {/* EL NOMBRE SALE DEL CONTEXTO CUANDO NO VIENE EN LA LLAMADA.
                En una ENTRANTE, Twilio sólo trae el número: `enganchar()` la
                registra con `nombre = null`, así que la sala pintaba la marca
                —que sí viene de la ficha— y a la persona no. Lo reportó el
                dueño: «me aparecía el nombre de la empresa pero no el de la
                persona». El contexto ya lo traía; sólo no se estaba mirando. */}
            {!esMovil && subtitulo}
            {/* Lo mismo que la cabina dice en grande (22-sep-2026): que esta
                llamada cumple una promesa, o que el lead ya se había descartado. */}
            {/* Lo primero que pregunta casi todo el mundo: «¿de dónde?». */}
            {!esMovil && avisos}
          </span>
          <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {/* En el teléfono, Colgar y Silenciar NO viven aquí arriba: se van a
                la barra del pulgar, al final de este mismo componente. Tenerlos
                en la cabecera obligaba a estirar la mano hasta arriba con el
                aparato pegado a la oreja — y «Colgar» es el botón que más se
                pica de todo el CRM. */}
            {!fin && !esMovil && (
              <>
                <button onClick={onSilenciar} style={{ border: `1px solid ${C.g200}`, background: mudo ? '#FFF4E5' : '#fff', color: mudo ? '#9a6a10' : C.g700, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {mudo ? 'Estás en mudo' : 'Silenciar'}
                </button>
                {onTono && (
                  <button onClick={() => setTeclas(t => !t)} aria-pressed={teclas} style={{ border: `1px solid ${teclas ? C.morado : C.g200}`, background: teclas ? '#F6F4FF' : '#fff', color: teclas ? C.moradoTinta : C.g700, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Teclas
                  </button>
                )}
                <button onClick={cerrarLlamada} disabled={cerrando} style={{ border: 'none', background: '#C0554E', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {cerrando ? 'Cerrando…' : 'Colgar'}
                </button>
              </>
            )}
            {/* VOLVER A LA PANTALLA DE LA LLAMADA, siempre a la vista. Antes era
                un enlace al final de 1500 px de scroll. */}
            {!fin && esMovil && !escribiendo && (
              /* MINIMIZAR COMO ÍCONO DE 44×44 (23-sep-2026). La píldora con la
                 palabra medía ~113 px y partía «Boutique Mariana» en dos
                 renglones: la cabecera se comía un cuarto de la pantalla antes
                 de cualquier contenido. Es el mismo chevron de la pantalla
                 oscura, y el aria-label dice que la llamada sigue. */
              <button onClick={onCerrar} aria-label="Minimizar la sala (la llamada sigue)" title="Minimizar la sala (la llamada sigue)"
                style={{ width: 44, height: 44, borderRadius: 999, border: `1px solid ${C.g200}`, background: '#fff', color: C.g700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            {/* Con el teclado abierto la barra de abajo se esconde: Colgar sube
                aquí para que nunca quede sin salida en plena llamada. */}
            {!fin && esMovil && escribiendo && (
              <button onMouseDown={e => e.preventDefault()} onClick={cerrarLlamada} disabled={cerrando} aria-label="Colgar"
                style={{ minHeight: 44, borderRadius: 999, border: 'none', background: C.rojo500, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '0 16px 0 12px', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>
                <IcoColgar size={18} />{cerrando ? 'Cerrando…' : 'Colgar'}
              </button>
            )}
            {/* En el teléfono «Listo» baja a la barra del pulgar, junto a
                «Aplicar el cierre»: arriba quedaba a un estirón de la mano. */}
            {fin && !esMovil && (
              <button onClick={onCerrar} style={{ border: 'none', background: C.morado, color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Listo</button>
            )}
          </span>
          {esMovil && !compacta && <span style={{ flexBasis: '100%', minWidth: 0, marginTop: -6 }}>{subtitulo}</span>}
        </div>}

        <div ref={cuerpo} data-sala-cuerpo={M ? '' : undefined} onScroll={M ? alBajar : undefined} style={{ padding: M ? '14px 16px 20px' : 18, display: 'flex', gap: M ? 12 : 14, flexWrap: 'wrap', alignItems: 'flex-start',
          /* En el teléfono ESTE es el que scrollea, entre cabecera y barra. */
          ...(M ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', alignContent: 'flex-start', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', scrollPaddingTop: 12, scrollPaddingBottom: 16 } : null) }}>
          {/* ── Columna izquierda: quién es y qué ha pasado ── */}
          <div style={{ flex: '1 1 380px', display: 'grid', gap: 12, minWidth: 0 }}>
            {!esMovil && bloqueOido}
            <div style={CAJA}>
              <div style={ROT}>Quién es</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: M ? '10px 18px' : 18 }}>
                {[['Sucursales', ctx?.sucursales ?? '—'], ['Giro', ctx?.giro || '—'], ['Etapa', ctx?.etapa ? (ETAPA_L[ctx.etapa] || ctx.etapa) : '—']].map(([k, v]) => (
                  <span key={String(k)}>
                    <span style={{ display: 'block', fontSize: M ? 12 : 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: M ? C.g500 : '#a5a2af' }}>{k}</span>
                    <b style={{ fontSize: 17 }}>{String(v)}</b>
                  </span>
                ))}
              </div>
              {ctx?.proximoPaso && (M
                /* En el teléfono no va en morado negrita: así se ven los botones
                   de texto, y esto no se toca (guía §6). Como «Siguiente paso» de la cabina. */
                ? <div style={{ fontSize: 14, color: C.g900, marginTop: 9, fontWeight: 600, lineHeight: 1.45 }}><span style={{ color: C.g500 }}>Pendiente: </span>{ctx.proximoPaso}</div>
                : <div style={{ fontSize: FS, color: C.moradoTinta, marginTop: 9, fontWeight: 700 }}>Pendiente: {ctx.proximoPaso}</div>)}
              {/* QUIEN LLAMA SIN FICHA. Pasa seguido en las entrantes y es
                  justo cuando la pantalla parecía vacía: se dice qué es lo que
                  no hay, en vez de enseñar guiones. */}
              {!ctx && <div style={{ fontSize: FS, color: C.g500 }}>Este número no está en el CRM. Al colgar queda la llamada con su grabación; si es alguien que vale, créalo desde el inbox.</div>}
            </div>

            {/* LLAMADAS ANTERIORES con su desenlace, no sólo el conteo: «la
                última cayó al buzón» y «la última habló seis minutos» piden
                saludos distintos. */}
            <div style={CAJA}>
              <div style={ROT}>Lo que ya le llamamos</div>
              {!(ctx?.previas || []).length ? <div style={{ fontSize: M ? 14 : 13, color: C.g500 }}>Es la primera vez.</div> : (
                <div style={{ display: 'grid', gap: 5 }}>
                  {ctx.previas.map((l: any, i: number) => (
                    <div key={i} style={{ fontSize: FS, display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: M ? 'wrap' : undefined }}>
                      <span style={{ color: M ? C.g500 : '#a5a2af', minWidth: 52 }}>{dia(l.started_at)}</span>
                      <b style={{ color: l.duracion_seg > 20 ? '#1E8A63' : C.g500 }}>{l.duracion_seg > 20 ? `habló ${reloj(l.duracion_seg)}` : l.estado}</b>
                      {/* En el teléfono la minuta se envuelve: cortada con «…» se perdía justo lo que dijo. */}
                      <span style={{ color: C.g500, flex: 1, ...(M ? { minWidth: 0 } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>{l.minuta || l.resultado || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LO ÚLTIMO QUE SE LE ESCRIBIÓ, textual. Llamar sin saberlo es cómo
                uno se contradice a los diez segundos de empezar. */}
            {plegar && (ctx?.mensajes || []).length ? plegable(`Ver lo último que se dijeron (${ctx.mensajes.length})`, (
                <div style={{ display: 'grid', gap: 6 }}>
                  {ctx.mensajes.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: FS, lineHeight: 1.45 }}>
                      <b style={{ color: m.direccion === 'entrante' ? '#1E8A63' : C.moradoTinta }}>{m.direccion === 'entrante' ? 'Él' : 'Tú'}</b>
                      <span style={{ color: C.g500 }}> · {dia(m.created_at)} · </span>
                      <span style={{ color: '#33313d' }}>{m.cuerpo || `(${m.tipo})`}</span>
                    </div>
                  ))}
                </div>
            )) :
            <div style={CAJA}>
              <div style={ROT}>Lo último que se dijeron</div>
              {!(ctx?.mensajes || []).length ? <div style={{ fontSize: M ? 14 : 13, color: C.g500 }}>Nada por WhatsApp todavía.</div> : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 210, overflowY: 'auto' }}>
                  {ctx.mensajes.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: FS, lineHeight: 1.45 }}>
                      <b style={{ color: m.direccion === 'entrante' ? '#1E8A63' : C.moradoTinta }}>{m.direccion === 'entrante' ? 'Él' : 'Tú'}</b>
                      <span style={{ color: '#a5a2af' }}> · {dia(m.created_at)} · </span>
                      <span style={{ color: '#33313d' }}>{m.cuerpo || `(${m.tipo})`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>}
          </div>

          {/* ── Columna derecha: lo que haces DURANTE la llamada ──
              En el teléfono va PRIMERO (`order: -1`): con una sola columna, lo
              que el cliente acaba de pedir no puede estar a tres pantallas de
              scroll de distancia. */}
          <div style={{ flex: '1 1 340px', display: 'grid', gap: 12, minWidth: 0, order: esMovil ? -1 : 0 }}>
            {!esMovil && !fin && teclas && onTono && <div style={CAJA}><div style={ROT}>Teclas · {tonos || 'marca las opciones del menú'}</div>{teclado}</div>}
            {esMovil && avisos && <div style={{ display: 'grid', marginTop: -6 }}>{avisos}</div>}
            {esMovil && bloqueOido}
            {/* ══ AL COLGAR: EL CIERRE ════════════════════════════════════
                Lo que la IA leyó de la llamada, propuesto para confirmar. Si no
                hay IA —sin saldo, o la transcripción no alcanzó— se dice con
                todas sus letras en vez de fingir que no había nada que cerrar:
                las acciones que sí se hicieron siguen arriba, hechas. */}
            {/* En el teléfono, al colgar, el cierre va ANTES que todo (`order`):
                es lo que se confirma con «Aplicar el cierre» de la barra, y
                debajo de la transcripción quedaba a tres pantallas. */}
            {fin && (
              /* EN EL TELÉFONO, LA MISMA TARJETA QUE LA CABINA (24-sep-2026): morado
                 agua, «La IA entendió» con el desenlace en su renglón, y ARRIBA de
                 «Te pidió algo». Los pendientes siguen a un toque desde la barra
                 («1 pendiente de lo que pidió · Ver ›»). */
              <div style={{ ...CAJA, ...(M ? { background: C.moradoAgua, border: 'none', borderRadius: 12, padding: 12 } : { borderColor: C.morado }), ...(plegar ? { order: -4 } : null) }}>
                {M && !cerrando && !aplicado && cierre && p ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ ...ROT, marginBottom: 0, lineHeight: 1.4, flex: 1, minWidth: 0, color: C.moradoTinta }}>La IA entendió</span>
                    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.g700, flexShrink: 0, maxWidth: '60%' }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: '#1E8A63', flexShrink: 0 }} />
                      {resultado ? `Tú: ${RESULTADOS.find(r => r.id === resultado)?.l || resultado}` : (DE_CIERRE[p.resultado] || p.resultado)}
                    </span>
                  </div>
                ) : <div style={{ ...ROT, ...(M ? { color: C.moradoTinta } : null) }}>{M ? 'La IA entendió' : 'Cerrar la llamada'}</div>}
                {/* La IA tarda unos diez segundos en leer la llamada entera.
                    Se dice cuánto, o el silencio se lee como que se colgó. */}
                {cerrando && <div style={{ fontSize: FS, color: C.g500 }}>Leyendo la llamada… (unos diez segundos)</div>}
                {/* COLGÓ ÉL Y NADIE CERRÓ. Es el caso NORMAL —el que cuelga
                    suele ser el cliente— y antes dejaba la llamada abierta sin
                    apunte ni compromiso. Se pide el desenlace de arriba y se
                    cierra desde aquí. Si se cierra la pestaña sin hacerlo, el
                    latido la cierra solo a los dos minutos: esto es para que lo
                    haga quien estuvo en la llamada, que sabe más que la IA. */}
                {!cerrando && !aplicado && !cierre && (
                  <button onClick={() => { pedido.current = false; cerrarLlamada(); }}
                    style={{ ...BTN, background: C.morado, color: '#fff', border: 'none', width: '100%' }}>
                    Leer la llamada y proponer el cierre
                  </button>
                )}
                {!cerrando && aplicado && (
                  <div style={{ fontSize: FS, color: '#1E8A63', fontWeight: 700, lineHeight: 1.7 }}>
                    {aplicado.length ? aplicado.map((h, i) => <div key={i}>✓ {h}</div>) : <div>✓ Quedó cerrada.</div>}
                  </div>
                )}
                {!cerrando && !aplicado && cierre && p && (
                  <>
                    {M ? (
                      /* En el teléfono son estados, no botones (como «● Contestó»
                         del cierre de la cabina): punto y texto, sin fondo. */
                      (p.etapa || p.no_llamar) ? <div role="status" style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', marginBottom: 8 }}>
                        {p.etapa && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: p.etapa === 'descalificado' ? '#C0554E' : C.g700 }}>
                            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: p.etapa === 'descalificado' ? '#C0554E' : C.morado, flexShrink: 0 }} />
                            Etapa → {ETAPA_L[p.etapa] || p.etapa}
                          </span>
                        )}
                        {p.no_llamar && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#C0554E' }}>
                            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: '#C0554E', flexShrink: 0 }} />
                            No volver a llamar
                          </span>
                        )}
                      </div> : null
                    ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ ...CHIP, whiteSpace: 'nowrap', background: '#EEECFE', color: C.moradoTinta }}>
                        {resultado ? `Tú: ${RESULTADOS.find(r => r.id === resultado)?.l || resultado}` : `${M ? 'IA' : 'La IA dice'}: ${DE_CIERRE[p.resultado] || p.resultado}`}
                      </span>
                      {p.etapa && <span style={{ ...CHIP, whiteSpace: 'nowrap', background: p.etapa === 'descalificado' ? '#FDEDEB' : '#EAF8F2', color: p.etapa === 'descalificado' ? '#C0554E' : '#1E8A63' }}>Etapa → {ETAPA_L[p.etapa] || p.etapa}</span>}
                      {p.no_llamar && <span style={{ ...CHIP, background: '#FDEDEB', color: '#C0554E' }}>No volver a llamar</span>}
                    </div>
                    )}
                    {M ? (p.nota && (
                      /* Tres renglones y «Ver más» (guía §7), igual que la cabina. */
                      <div>
                        <div style={{ fontSize: 14, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap', ...(notaEntera || String(p.nota).length <= 160 ? null : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{p.nota}</div>
                        {String(p.nota).length > 160 && <button onClick={() => setNotaEntera(v => !v)} aria-expanded={notaEntera} style={{ display: 'block', minHeight: 44, margin: '-6px 0 -10px', border: 'none', background: 'none', padding: '0 2px', textAlign: 'left', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: C.morado, cursor: 'pointer' }}>{notaEntera ? 'Ver menos' : 'Ver más'}</button>}
                      </div>
                    )) : <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p.nota}</div>}
                    {p.siguiente_paso && (M
                      /* «Siguiente paso», como la cabina, y sin morado negrita (guía §6). */
                      ? <div style={{ fontSize: 14, color: C.g900, fontWeight: 600, lineHeight: 1.45, marginTop: 8 }}><span style={{ color: C.g500 }}>Siguiente paso: </span>{horaHumana(p.siguiente_paso)}</div>
                      : <div style={{ fontSize: FS, color: C.moradoTinta, fontWeight: 700, marginTop: 6 }}>Sigue: {horaHumana(p.siguiente_paso)}</div>)}
                    {!!(p.compromisos || []).length && (
                      <div style={{ fontSize: FS, marginTop: 6 }}>{p.compromisos.map((c: any, i: number) => (
                        M ? <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><IcoCalendario size={16} style={{ marginTop: 2, color: C.g500 }} /><span>{c.tipo === 'reunion' ? 'Reunión' : 'Llamada'} el {fechaHumana(c.fecha, c.hora)}</span></div>
                          : <div key={i}>📅 {c.tipo === 'reunion' ? 'Reunión' : 'Llamada'} el {fechaHumana(c.fecha, c.hora)}</div>
                      ))}</div>
                    )}
                    {!!(p.envios || []).length && (
                      <div style={{ fontSize: FS, marginTop: 6 }}>{p.envios.map((e: any, i: number) => (
                        M ? <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><IcoClip size={16} style={{ marginTop: 2, color: C.g500 }} /><span>Mandarle {e.tema}{e.estado === 'falta' ? ' (no sabemos qué: te lo va a preguntar)' : ''}</span></div>
                          : <div key={i}>📎 Mandarle {e.tema}{e.estado === 'falta' ? ' (no sabemos qué: te lo va a preguntar)' : ''}</div>
                      ))}</div>
                    )}
                    {!!(p.datos || []).length && (M
                      ? <div style={{ fontSize: FS, marginTop: 6, ...{ display: 'flex', gap: 8, alignItems: 'flex-start' } }}><IcoLapiz size={16} style={{ marginTop: 2, color: C.g500 }} /><span>Datos: {p.datos.map((d: any) => `${d.campo} = ${d.valor}`).join(' · ')}</span></div>
                      : <div style={{ fontSize: FS, marginTop: 6 }}>✍️ Datos: {p.datos.map((d: any) => `${d.campo} = ${d.valor}`).join(' · ')}</div>)}
                    <details style={{ marginTop: 9 }}>
                      <summary style={{ fontSize: M ? 14 : 12, color: M ? C.moradoTinta : C.g500, cursor: 'pointer', fontWeight: 700 }}>¿La IA se equivocó en qué pasó? Corrígelo</summary>
                      <div style={{ marginTop: 8 }}>{quePaso}</div>
                    </details>
                    {/* En el teléfono este botón vive en la barra del pulgar (abajo). */}
                    {!esMovil && <button onClick={aplicarCierre} style={{ ...BTN, marginTop: 9, background: C.morado, color: '#fff', border: 'none', width: '100%' }}>Aplicar el cierre</button>}
                  </>
                )}
                {!cerrando && !aplicado && cierre && !p && (
                  <div style={{ fontSize: FS, color: C.g500, lineHeight: 1.6 }}>
                    {/* El error de facturación de Anthropic llega en inglés y
                        con su JSON: aquí se dice en una frase lo que significa
                        y qué hay que hacer, que es cargarle saldo. */}
                    {/credit balance|billing|quota/i.test(cierre?.motivo || '')
                      ? 'No hay saldo de IA, así que nadie leyó la llamada por ti (se carga en console.anthropic.com).'
                      : cierre?.motivo ? `La IA no pudo cerrarla: ${cierre.motivo}.`
                      : 'No hubo suficiente conversación transcrita para cerrar con IA.'}
                    {' '}Tu apunte y el desenlace ya quedaron guardados, y lo que se hizo en la llamada está arriba.
                  </div>
                )}
              </div>
            )}

            {/* ══ LO QUE TE PIDIÓ ════════════════════════════════════════
                El corazón del pedido: lo que el cliente pide se hace AHORA y
                queda escrito qué pasó. Vive en `AccionesLlamada.tsx` porque la
                cabina de Llamadas inteligentes enseña exactamente lo mismo al
                colgar, y dos copias de algo que manda WhatsApps a clientes se
                separan en un mes. */}
            {callId && (
              /* CON ALGO PENDIENTE, «TE PIDIÓ ALGO» VA PRIMERO (23-sep-2026).
                 Es lo único que «Aplicar el cierre» no resuelve: debajo del
                 resumen de la IA quedaba bajo el pliegue en 360 y «Hacerlo»
                 salía cortado por la barra. Sin pendientes, el cierre manda. */
              <div data-sala-acciones="" style={{ display: 'grid', minWidth: 0, ...(plegar ? { order: abiertas.length ? -3 : -1 } : null),
                ...(resaltar ? { borderRadius: 16, boxShadow: `0 0 0 3px ${C.morado}`, transition: 'box-shadow .2s' } : { transition: 'box-shadow .6s' }) }}>
              <AccionesLlamada
                callId={callId}
                acciones={acciones}
                onAcciones={setAcciones}
                fraseCliente={[...oido].reverse().find(o => o.quien !== 'vendedor')?.texto || null} />
              </div>
            )}

            <div style={CAJA}>
              <div style={ROT}>{fin ? 'Tu apunte' : 'Apunta mientras hablas'}</div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={fin ? 3 : (M ? 4 : 6)}
                placeholder="Lo que diga, tal cual. Se guarda solo."
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 10, padding: '10px 12px', fontSize: M ? 16 : 13.5, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
              <div style={{ fontSize: M ? 14 : 11, color: guardado === 'ok' ? '#1E8A63' : (M ? C.g500 : '#a5a2af'), marginTop: 5, fontWeight: 700 }}>
                {guardado === 'ok' ? 'Guardado' : guardado === 'guardando' ? 'Guardando…' : 'Se guarda solo mientras escribes'}
              </div>
            </div>

            {/* AGENDAR CON HORARIOS REALES. «Te mando la liga» es donde se
                enfrían las citas: si ya lo tienes al teléfono, la fecha se
                cierra ahí o no se cierra. */}
            {!fin && (
              <div style={CAJA}>
                <div style={ROT}>Agendar</div>
                {horarios === null ? (
                  <>
                    <button onClick={() => verHorarios()} style={{ border: `1.5px solid ${C.morado}`, background: '#fff', color: C.moradoTinta, borderRadius: M ? 12 : 10, padding: '9px 14px', fontSize: M ? 15 : 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', width: '100%', ...(M ? { minHeight: 48 } : null) }}>
                      Ver los horarios que tengo libres
                    </button>
                    <button onClick={mandarLiga} disabled={ligaEnviada}
                      style={{ border: 'none', background: 'none', color: ligaEnviada ? '#1E8A63' : (M ? C.moradoTinta : C.g500), fontSize: M ? 14 : 12.5, fontWeight: 700, cursor: ligaEnviada ? 'default' : 'pointer', fontFamily: 'inherit', padding: M ? 0 : '8px 0 0', width: '100%', ...(M ? { minHeight: 44, marginTop: 8 } : null) }}>
                      {ligaEnviada ? 'Liga enviada por WhatsApp' : 'O mándale la liga por WhatsApp ahora'}
                    </button>
                  </>
                ) : (
                  <>
                    <select value={tipo} onChange={e => { setTipo(e.target.value); try { localStorage.setItem('cabina.tipocita', JSON.stringify(e.target.value)); } catch { /* privado */ } verHorarios(e.target.value); }}
                      style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 9px', fontSize: M ? 16 : 12.5, fontFamily: 'inherit', fontWeight: 700, color: C.moradoTinta, marginBottom: 9, maxWidth: '100%', ...(M ? { width: '100%', minHeight: 48, borderRadius: 10, background: '#fff' } : null) }}>
                      {(tipos.length ? tipos : [{ slug: 'demo', nombre: 'Demo personalizada', duracion_minutos: 30 }]).map((t: any) => (
                        <option key={t.slug} value={t.slug}>{t.nombre} · {t.duracion_minutos} min</option>
                      ))}
                    </select>
                    {!horarios.length
                      ? <div style={{ fontSize: FS, color: C.g500 }}>No hay horarios libres de este tipo en las próximas dos semanas. Prueba otro tipo o queda como «volver a llamar».</div>
                      : <SelectorHorarios huecos={horarios} movil={esMovil} />}
                    <div style={{ fontSize: M ? 14 : 11, color: C.g500, marginTop: 7, lineHeight: 1.4 }}>Léeselos tal cual: son los huecos reales. La cita la agenda el cierre con lo que acuerden.</div>
                  </>
                )}
              </div>
            )}

            {/* NO SE CUELGA SIN DECIR QUÉ PASÓ. El resultado es lo que alimenta
                la etapa, el seguimiento y los informes; pedirlo después, cuando
                ya colgaste y vas por el siguiente, es pedirlo para nunca.
                Cuando colgó el otro, estos mismos chips viven arriba, dentro
                del bloque de cierre. */}
            {!fin && (
              <div style={{ ...CAJA, borderColor: C.g200 }}>
                <div style={{ ...ROT, marginBottom: 2 }}>¿Qué pasó?</div>
                {/* La aclaración en minúsculas: una frase entera en versales se
                    partía en dos renglones y costaba leerla. */}
                <div style={{ fontSize: M ? 14 : 11.5, color: C.g500, marginBottom: M ? 10 : 7, lineHeight: 1.4 }}>Opcional: si no lo eliges, lo propone la IA al colgar.</div>
                {quePaso}
              </div>
            )}

            {!fin && !esMovil && (
              <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: C.g500, fontSize: M ? 14 : 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 6, ...(M ? { minHeight: 48 } : null) }}>
                Esconder la sala (la llamada sigue)
              </button>
            )}
          </div>
        </div>

        {/* ══ LA BARRA DEL PULGAR EN LA SALA (19-sep-2026) ═══════════════════
            Colgar y Silenciar, fijos abajo y sólo en el teléfono. Con el
            aparato en la oreja, la mano sostiene el celular por el medio: lo
            que está a tres centímetros del pulgar se toca sin mirar, lo que
            está arriba pide recolocar la mano — y es el botón que más se pica
            del CRM. Colgar es el grande y el rojo; Silenciar cede sitio.
            Va FUERA del cuerpo que scrollea, así que no tapa nada. Las teclas
            se abren encima de la barra, dentro de ella. */}
        {/* ORDEN Y ROJO DE LA PANTALLA OSCURA (23-sep-2026): Silenciar · Colgar ·
            Teclas, con Colgar al centro y con el mismo ícono. Antes aquí Colgar
            se iba a la derecha y cambiaba de forma: al entrar a la ficha en
            plena llamada, el pulgar lo buscaba donde ya no estaba. */}
        {barra && !fin && (
          <div style={{
            flexShrink: 0, position: 'relative', zIndex: 3,
            padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))',
            /* Blanco opaco: con .97 y blur se leía el texto que pasa por debajo. */
            background: '#fff', borderTop: `1px solid ${C.g200}`, boxShadow: '0 -4px 14px rgba(12,11,18,.06)',
          }}>
            {teclas && onTono && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: C.g500, fontWeight: 700, marginBottom: 8, minHeight: 18, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{tonos || 'Marca las opciones del menú'}</div>
                {teclado}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Ícono arriba y nombre abajo, como los círculos de la pantalla
                  oscura. En mudo se rellena de ámbar y dice «Silenciado»: el
                  estado se lee sin buscar la palabra. */}
              <button onClick={onSilenciar} aria-pressed={mudo} aria-label={mudo ? 'Activar micrófono' : 'Silenciar'}
                style={{ flexShrink: 0, width: 80, border: `1px solid ${mudo ? '#E8A838' : C.g200}`, background: mudo ? '#FFF4E5' : '#fff', color: mudo ? '#9a6a10' : C.g700, borderRadius: 12, padding: '4px 0', minHeight: 52, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, lineHeight: 1.1 }}>
                <IcoMic apagado={mudo} />{mudo ? 'En mudo' : 'Silenciar'}
              </button>
              <button onClick={cerrarLlamada} disabled={cerrando}
                style={{ flex: 1, border: 'none', background: '#C0554E', color: '#fff', borderRadius: 12, padding: '0 12px', minHeight: 52, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IcoColgar size={20} />{cerrando ? 'Cerrando…' : 'Colgar'}
              </button>
              {onTono && (
                <button onClick={() => setTeclas(t => !t)} aria-pressed={teclas} aria-label="Teclado de tonos"
                  style={{ flexShrink: 0, width: 80, border: `1px solid ${teclas ? '#9B8CFA' : C.g200}`, background: teclas ? '#EEECFE' : '#fff', color: teclas ? C.moradoTinta : C.g700, borderRadius: 12, padding: '4px 0', minHeight: 52, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, lineHeight: 1.1 }}>
                  <IcoTeclas />Teclas
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ LA BARRA DEL PULGAR AL COLGAR (23-sep-2026) ════════════════════
            Lo único que se hace aquí es confirmar lo que propuso la IA y salir.
            Antes «Listo» vivía arriba a la derecha (33 px) y «Aplicar el cierre»
            a media caja: ahora los dos van abajo, donde está el pulgar, con el
            primario ancho y morado. Mientras la IA lee, el primario lo dice. */}
        {barra && fin && (
          <div style={{
            flexShrink: 0, position: 'relative', zIndex: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
            padding: '10px 16px max(12px, calc(10px + env(safe-area-inset-bottom)))',
            background: '#fff', borderTop: `1px solid ${C.g200}`, boxShadow: '0 -4px 14px rgba(12,11,18,.06)',
          }}>
            {/* Sin degradado encima: deslavaba «Hacerlo» y «No era eso» justo
                arriba del aviso. La sombra de la barra ya marca el corte. */}
            {/* APLICAR NO RESUELVE LO QUE PIDIÓ. El cierre escribe el apunte, la
                etapa y los compromisos; lo que quedó en «Te pidió algo» sin
                «Hacerlo» ni «No era eso» sigue pendiente. Se dice aquí, junto al
                botón, con un toque para ir a resolverlo. */}
            {!aplicado && cierre && p && abiertas.length > 0 && (
              <button onClick={irAPendientes}
                style={{ flex: '1 0 100%', border: 'none', background: 'none', color: C.g500, borderRadius: 10, padding: '0 2px', margin: '-8px 0 0', minHeight: 44, fontSize: 14, fontWeight: 600, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.3 }}>
                {/* Un renglón de la barra, sin tarjeta propia: con borde y fondo
                    era un piso más y en 360 la barra se comía un quinto. */}
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: '#E8A838', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{abiertas.length === 1 ? '1 pendiente de lo que pidió' : `${abiertas.length} pendientes de lo que pidió`}</span>
                  <b style={{ flexShrink: 0, color: C.morado, fontWeight: 700 }}>Ver ›</b>
                </span>
              </button>
            )}
            {!aplicado && cierre && p ? (
              <>
                <button onClick={onCerrar} title="Salir: el cierre propuesto se aplica solo en unos minutos"
                  style={{ flex: '0 0 auto', border: `1px solid ${C.g200}`, background: '#fff', color: C.g700, borderRadius: 12, padding: '0 14px', minHeight: 52, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.2 }}>
                  {/* «Salir sin aplicar» sonaba a perder la minuta, y no se pierde:
                      el cierre propuesto se queda y el latido lo aplica solo a los
                      pocos minutos si nadie lo toca. */}
                  Ahorita no
                </button>
                <button onClick={aplicarCierre} disabled={cerrando}
                  style={{ flex: '1 1 0', minWidth: 0, border: 'none', background: C.morado, color: '#fff', borderRadius: 12, padding: '0 14px', minHeight: 52, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: cerrando ? .7 : 1 }}>
                  {/* El mismo verbo que la cabina («Confirmar y seguir»): aquí no hay siguiente. */}
                  {cerrando ? 'Aplicando…' : 'Confirmar el cierre'}
                </button>
              </>
            ) : (
              <button onClick={onCerrar}
                style={{ flex: 1, border: 'none', background: cerrando ? '#E0DFE6' : C.morado, color: cerrando ? C.g500 : '#fff', borderRadius: 12, padding: '0 18px', minHeight: 52, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {cerrando ? 'Leyendo la llamada… (puedes salir)' : 'Listo'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
