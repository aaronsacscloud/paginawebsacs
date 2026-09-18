// LLAMADAS INTELIGENTES · La cabina.
//
// Vive dentro del inbox, en el lugar de la lista + el hilo. El vendedor arma
// la lista con los filtros que ya tiene puestos, escribe cómo se presenta,
// se pone los audífonos y la central marca por él. Él solo habla cuando del
// otro lado hay una persona.
//
// El servidor manda (src/lib/telefonia/marcador.ts). Esta pantalla:
//   1. arma la lista paginando el inbox con el MISMO query string de la lista,
//   2. pide al Telefonia.tsx que entre a la sala (evento `tel-sala`),
//   3. pregunta cada segundo cómo va (`GET ?id=`) y pinta el item actual,
//   4. cuando el item pasa a `en_linea`, suena un aviso y abre el micrófono
//      (`tel-mute {mute:false}`); al cerrarse, lo vuelve a cerrar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from './estilo';
import AccionesLlamada from './AccionesLlamada';
import { confirmar } from '../../../../lib/ui/confirmar';
import { S } from '../email/ui';
import Cargando from '../ui/Cargando';
import { IcoTelefono, IcoMic, IcoReloj, IcoUsuario, IcoX } from './Iconos';
import { telefonoLegible } from '../../../../lib/telefono';

type Props = {
  /** El query string de la lista tal como la ve el vendedor (armarQS). */
  qs: string;
  /** Cómo se llama lo que tiene filtrado: «Vista Leads calientes», «Míos · etapa lead»… */
  descripcion: string;
  /** Cuántas filas tiene la lista según el inbox (para avisar antes de armar). */
  total: number;
  yo?: any;
  /** Abrir directo en una jornada ya existente, sin pasar por elegir lista.
      Lo usa la pantalla propia de Llamadas inteligentes, donde las sesiones
      anteriores se ven ANTES de entrar: sin esto había que elegir una lista
      cualquiera sólo para llegar al botón de «Abrir» de la jornada de ayer. */
  sesionInicial?: string | null;
  onAbrirConversacion?: (conversationId: string) => void;
  onCerrar: () => void;
  movil?: boolean;
};

const post = (body: any) => fetch('/api/crm/telefonia/marcador', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json()).catch(() => ({ error: 'Sin conexión' }));

const ETIQUETA_ITEM: Record<string, string> = {
  pendiente: 'En espera', marcando: 'Marcando', timbrando: 'Timbrando', escuchando: 'Escuchando quién contesta',
  portero: 'Pasando la contestadora', en_linea: 'En línea', cierre: 'Cierre', hecho: 'Hecha', saltado: 'Saltada', excluido: 'Fuera de la lista',
};
/* Las etapas que se pueden poner al colgar. NO es el catálogo entero: `cliente`
   pide cuenta ligada y `evangelista` se gana con el tiempo — ninguna de las dos
   se decide en una llamada de prospección. Éstas sí. */
const ETAPAS_CIERRE: { id: string; l: string }[] = [
  { id: 'lead_calificado', l: 'Calificado — encaja y sigue' },
  { id: 'oportunidad', l: 'Oportunidad — hay trato en camino' },
  { id: 'rezagado', l: 'Rezagado — no ahora, más adelante' },
  { id: 'descalificado', l: 'Descalificado — no encaja' },
  { id: 'perdido_definitivo', l: 'Perdido definitivo — dijo que no vuelve' },
];

const ETIQUETA_RESULTADO: Record<string, string> = {
  contesto: 'Contestó', buzon: 'Buzón de voz', portero: 'Contestadora', no_contesto: 'No contestó', ocupado: 'Ocupado', invalido: 'Número inválido',
  volver_llamar: 'Volver a llamar', no_interesa: 'No le interesa', dieron_datos: 'Dio datos', saltado: 'Saltada', cancelado: 'Cancelada',
  colgo_rapido: 'Colgó sin que hablaras',
};
const TONO_RESULTADO: Record<string, { bg: string; fg: string }> = {
  contesto: { bg: '#EAF8F2', fg: '#1E8A63' }, dieron_datos: { bg: '#EAF8F2', fg: '#1E8A63' }, volver_llamar: { bg: '#FFF4E5', fg: '#9a6a10' },
  no_interesa: { bg: '#FEF0EF', fg: '#C0554E' }, invalido: { bg: '#FEF0EF', fg: '#C0554E' },
  colgo_rapido: { bg: '#FFF4E5', fg: '#9a6a10' },
};
const tono = (r?: string | null) => TONO_RESULTADO[r || ''] || { bg: C.g100, fg: '#4B5563' };

const btnS: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: `1.5px solid #9B8CFA`, borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' };
const btnT: React.CSSProperties = { ...S.btnG, display: 'inline-flex', alignItems: 'center', gap: 5 };
const btnD: React.CSSProperties = { border: '1px solid #f0c4bd', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#C0554E', cursor: 'pointer', fontFamily: 'inherit' };
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 9, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.g900 };
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: C.g500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 };
const tarjeta = (franja: string): React.CSSProperties => ({ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px' });

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Un timbre corto, dos veces: «ya hay una persona, habla». Sin archivos. */
function avisar() {
  try {
    const A = (window as any).AudioContext || (window as any).webkitAudioContext; if (!A) return;
    const ctx = new A();
    [0, 0.22].forEach(t => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* sin audio */ }
}

const guardarLocal = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privado */ } };
const leerLocal = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardarSesion = (k: string, v: string) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch { /* privado */ } };
const leerSesion = (k: string, d: string): string => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };

/* AGENDAR SIN SALIR DEL CIERRE. Los mismos huecos que enseña la sala de la
   llamada manual (`available-slots`, que cruza la agenda con Google y devuelve
   los libres de verdad). Se piden al TOCAR el botón y no al abrir el cierre:
   la mayoría de las llamadas no acaban en cita, y pedirlos siempre sería pagar
   una consulta por cada una que no lleva a nada. */
function AgendarEnCierre({ contactId, nombre, telefono }: { contactId?: string | null; nombre?: string | null; telefono?: string | null }) {
  const [slots, setSlots] = useState<any[] | null>(null);
  const [puesto, setPuesto] = useState('');
  const [yendo, setYendo] = useState(false);
  const [err, setErr] = useState('');
  const traer = async () => {
    setSlots([]);
    const hoy = new Date().toISOString().slice(0, 10);
    const hasta = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const j = await fetch(`/api/scheduling/available-slots?slug=demo&from=${hoy}&to=${hasta}`).then(r => r.json()).catch(() => null);
    const l = Object.entries(j?.dates || {}).flatMap(([fecha, horas]: any) => (horas || []).map((hora: string) => ({ fecha, hora })));
    setSlots(l.slice(0, 10));
  };
  const agendar = async (h: any) => {
    setYendo(true);
    /* `/api/scheduling/book` y NO `agenda-oferta`: el segundo le MANDA los
       horarios al cliente para que elija, y aquí el cliente ya está al
       teléfono diciendo cuál quiere. Reservar directo es lo que cierra la
       cita; mandarle una lista a alguien que te está hablando es devolverle
       la pelota. Y `book` corre la cadena entera —Google Calendar, correo de
       confirmación, recordatorios— igual que si hubiera agendado él. */
    const r = await fetch('/api/scheduling/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type_slug: 'demo', fecha: h.fecha, hora_inicio: h.hora,
        nombre: nombre || 'Contacto', whatsapp: telefono || undefined,
        notas: 'Quedó en la llamada', timezone: 'America/Mexico_City',
      }),
    }).then(x => x.json()).catch(() => ({ error: 'No se pudo agendar' }));
    setYendo(false);
    if (r?.error) { setErr(r.error); return; }
    setPuesto(`${h.fecha} ${h.hora}`);
  };
  if (puesto) return (
    <div style={{ marginTop: 12, background: '#EAF8F2', color: '#1E8A63', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, fontWeight: 700 }}>
      Cita puesta para el {puesto}. Queda en la agenda y en el calendario.
    </div>
  );
  return (
    <div style={{ marginTop: 12, background: '#FFF8EC', border: '1px solid #f3d9a4', borderRadius: 10, padding: '10px 13px' }}>
      <div style={{ fontSize: 12.5, color: '#9a6a10', fontWeight: 700, marginBottom: slots ? 8 : 0 }}>
        No quedó ninguna cita ni compromiso de esta llamada.
      </div>
      {err && <div style={{ fontSize: 12, color: '#C0554E', fontWeight: 700, marginBottom: 7 }}>{err}</div>}
      {slots === null ? (
        <button onClick={traer} style={{ border: '1px solid #e0c99a', background: '#fff', color: '#9a6a10', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
          Ponerle una ahora
        </button>
      ) : !slots.length ? (
        <div style={{ fontSize: 12, color: '#9a6a10' }}>No tienes huecos libres esta semana.</div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {slots.map((h, i) => (
            <button key={i} disabled={yendo} onClick={() => agendar(h)}
              style={{ border: '1px solid #e0c99a', background: '#fff', color: '#9a6a10', borderRadius: 999, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: yendo ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {new Date(`${h.fecha}T${h.hora}:00`).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Cabina({ qs, descripcion, total, yo, sesionInicial, onAbrirConversacion, onCerrar, movil }: Props) {
  const [sesionId, setSesionId] = useState<string | null>(() => sesionInicial || leerLocal('cabina.sesion', null));
  const [est, setEst] = useState<any>(null);           // { sesion, actual, pendientes, ahora }
  const [items, setItems] = useState<any[]>([]);
  const [previas, setPrevias] = useState<any[]>([]);
  const [telefonia, setTelefonia] = useState<{ ok: boolean; faltantes: string[]; fernanda: boolean } | null>(null);
  const [enSala, setEnSala] = useState(false);
  const [micAbierto, setMicAbierto] = useState(false);
  const [recienAbierto, setRecienAbierto] = useState(false);
  /* El nivel lo mide `Telefonia.tsx`, que es quien tiene el stream; aquí sólo
     se escucha. Duplicar el AnalyserNode sería abrir el micrófono dos veces. */
  const [nivelVoz, setNivelVoz] = useState(0);
  useEffect(() => {
    const h = (e: any) => setNivelVoz(Number(e?.detail?.nivel || 0));
    document.addEventListener('tel-nivel', h);
    return () => document.removeEventListener('tel-nivel', h);
  }, []);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [armando, setArmando] = useState<{ leidas: number; total: number } | null>(null);
  // La presentación se recuerda entre sesiones: es la misma casi siempre.
  const [pres, setPres] = useState(() => leerLocal('cabina.presentacion', {
    nombre: yo?.nombre ? `${String(yo.nombre).split(' ')[0]} de Sacscloud` : '', motivo: 'le llamo para dar seguimiento a su solicitud de información', buzon: false, auto: true, wrapup: 8, modo: 'manual', lineas: 1, reintentos: 0,
  }));
  /* Al abrir una sesión que ya existe, el control del buzón adopta lo que esa
     sesión tenga guardado (una vez, no en cada latido: si no, pisaría el clic
     que acabas de dar mientras el servidor todavía contesta). */
  const buzonAdoptado = useRef<string | null>(null);
  useEffect(() => {
    const cfg = est?.sesion?.config;
    if (!sesionId || !cfg || buzonAdoptado.current === sesionId) return;
    buzonAdoptado.current = sesionId;
    if (cfg.reintentos_buzon != null) setPres((x: any) => ({ ...x, reintentos: Number(cfg.reintentos_buzon) || 0 }));
  }, [sesionId, est?.sesion?.config]);

  const [nota, setNota] = useState('');
  const [noLlamar, setNoLlamar] = useState(false);
  // La etapa que se tocó en ESTE cierre; se limpia al pasar al siguiente.
  const [etapaTocada, setEtapaTocada] = useState('');
  const notaItem = useRef<string | null>(null);
  const [tab, setTab] = useState<'lista' | 'hechas' | 'compromisos'>('lista');
  /* ══ LOS COMPROMISOS DE LA JORNADA ══════════════════════════════════════
     Pedido del dueño (18-sep-2026): «una pestaña específica que diga
     compromisos, con las agendas que se generaron al hablar… que sea fácil ver
     fecha y hora en que se quedó, y si ya está en Google Calendar o no».
     Se piden aparte y sólo al abrir la pestaña: una consulta que cruza citas y
     contactos no puede ir en el pulso de cada segundo. */
  const [compromisos, setCompromisos] = useState<any[]>([]);

  const sesion = est?.sesion;
  const actual = est?.actual;
  // La etapa tocada es de ESTA llamada: al pasar al siguiente se limpia, o el
  // «Listo: quedó en…» del anterior se leería como si fuera del nuevo.
  useEffect(() => { setEtapaTocada(''); }, [actual?.id]);
  // Quién habla en esta sesión: 'manual' (yo), 'ia' (Fernanda sola) o 'asistido' (Fernanda abre, yo puedo tomar la llamada).
  const modo: 'manual' | 'ia' | 'asistido' = sesion?.modo && sesion.modo !== 'manual' ? sesion.modo : 'manual';
  const fernanda = modo !== 'manual';
  const sola = modo === 'ia';
  const fase: 'armar' | 'lista' | 'viva' | 'fin' = !sesionId || !sesion ? 'armar'
    : ['borrador', 'lista'].includes(sesion.estado) ? 'lista'
    : ['activa', 'pausada'].includes(sesion.estado) ? 'viva' : 'fin';

  useEffect(() => { guardarLocal('cabina.presentacion', pres); }, [pres]);
  useEffect(() => { guardarLocal('cabina.sesion', sesionId); }, [sesionId]);

  const cargarPrevias = useCallback(() => {
    fetch('/api/crm/telefonia/marcador?lista=1', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setPrevias(j.sesiones || []);
      setTelefonia({ ok: !!j.telefonia, faltantes: j.faltantes || [], fernanda: !!j.fernanda });
    }).catch(() => {});
  }, []);
  useEffect(() => { cargarPrevias(); }, [cargarPrevias]);

  /* ══ EL PULSO: POR QUÉ LA TARJETA DEL CENTRO SE CONGELABA ═══════════════
     REPORTE DEL DUEÑO (17-sep-2026): «no me aparece en pantalla realmente a
     quién está marcando; mandan a buzón, pasa al siguiente, pero no se
     actualiza el contacto que aparece en medio… y le doy clic en pausar y
     parece que no hace nada».

     Los tres síntomas eran UN bug, y estaba en estas cuatro líneas. El guard
     anti-desorden comparaba contra la última petición LANZADA
     (`n !== seqEst.current`), no contra la última APLICADA. Con el pulso a
     400 ms mientras la central decide —y un `latir` de servidor que hace
     trabajo de verdad: cuelga items vencidos, cobra llamadas, rescata
     cierres— casi ninguna respuesta vuelve en menos de 400 ms. Y entonces,
     cuando llega, ya se lanzó otra: `n !== seqEst.current` y se tira.

     O sea que NINGUNA respuesta se aplicaba justo mientras más rápido latía,
     que es exactamente cuando está marcando. El centro se quedaba clavado en
     el contacto de hace cuatro, la lista de la derecha —que late cada 5 s y
     sí alcanzaba a aplicarse— iba adelantada, y «Pausar» parecía no hacer
     nada porque la acción SÍ salía pero el estado ya no se repintaba.

     Dos arreglos, y los dos hacen falta:
      · se aplica si la respuesta es MÁS NUEVA que la última aplicada
        (`n > aplicadoEst.current`), que es lo que de verdad evita el
        desorden sin tirar lo bueno;
      · y no se lanza otra mientras una sigue en vuelo, para no encolar
        peticiones contra un servidor que tarda más que el intervalo. */
  const seqEst = useRef(0), seqItems = useRef(0);
  const aplicadoEst = useRef(0), aplicadoItems = useRef(0);
  const enVueloEst = useRef(false), enVueloItems = useRef(false);
  const latir = useCallback(async () => {
    if (!sesionId || enVueloEst.current) return;
    const n = ++seqEst.current;
    enVueloEst.current = true;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => null)
      .finally(() => { enVueloEst.current = false; });
    if (!j || n <= aplicadoEst.current) return;
    aplicadoEst.current = n;
    if (j.error) { setSesionId(null); setEst(null); return; }
    setEst(j);
  }, [sesionId]);
  const cargarItems = useCallback(async () => {
    if (!sesionId || enVueloItems.current) return;
    const n = ++seqItems.current;
    enVueloItems.current = true;
    const j = await fetch(`/api/crm/telefonia/marcador?id=${sesionId}&items=1`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => null)
      .finally(() => { enVueloItems.current = false; });
    if (j?.items && n > aplicadoItems.current) { aplicadoItems.current = n; setItems(j.items); }
  }, [sesionId]);

  // El pulso: cada 400 ms mientras la central decide quién contestó (ahí cada
  // décima cuenta para el «Hola»), cada segundo el resto de la sesión viva,
  // cada 6 s si está parada.
  const decidiendo = ['marcando', 'timbrando', 'escuchando', 'portero'].includes(String(est?.actual?.estado || ''));
  useEffect(() => {
    if (!sesionId) return;
    let vivo = true;
    latir(); cargarItems();
    const t = setInterval(() => { if (vivo && document.visibilityState === 'visible') latir(); }, fase === 'viva' ? (decidiendo ? 400 : 1000) : 6000);
    const t2 = setInterval(() => { if (vivo && document.visibilityState === 'visible') cargarItems(); }, fase === 'viva' ? 5000 : 15000);
    return () => { vivo = false; clearInterval(t); clearInterval(t2); };
  }, [sesionId, fase, decidiendo, latir, cargarItems]);

  // Lo que dice el teléfono (Telefonia.tsx): si estoy en la sala y con el mic abierto.
  useEffect(() => {
    const h = (ev: any) => {
      const d = ev.detail || {};
      if (d.sesion_id && sesionId && d.sesion_id !== sesionId) return;
      setEnSala(!!d.en_sala);
      if (d.mute !== undefined) setMicAbierto(!d.mute);
      if (d.error) setError(d.error);
    };
    document.addEventListener('tel-sala-estado', h);
    document.dispatchEvent(new CustomEvent('tel-sala-consulta'));
    return () => document.removeEventListener('tel-sala-estado', h);
  }, [sesionId]);

  // EL MOMENTO: el item pasa a en_linea → timbre + micrófono abierto. Al
  // salir de en_linea → micrófono cerrado. Se decide por el id del item para
  // no abrir dos veces si el polling repite el estado.
  const abiertoPara = useRef<string | null>(null);
  useEffect(() => {
    /* ══ 🔴 EL AVISO VA EN EL DESCUELGUE, NO EN EL VEREDICTO (18-sep-2026) ══
       Medido en la llamada de Kike: contestó a las 17:04:52.6 y el item no pasó
       a `en_linea` hasta las 17:04:54.3. El pitido y el destello verde —lo
       único que de verdad se nota— sólo miraban `en_linea`, así que durante
       1.7 s el micrófono ya estaba abierto y en la pantalla no pasaba nada.
       Él dijo «bueno» a los 3.2 s y colgó a los 5.5 s sin oír una palabra
       nuestra: en toda la llamada no se transcribió ni una sílaba del vendedor.

       `escuchando` ES el momento en que descolgaron —lo que sigue es sólo la
       IA decidiendo si era persona o grabadora—, y el micrófono ya se abre ahí
       desde el arreglo del 17-sep. Que el aviso llegara después era la última
       pieza que faltaba: ahora suena en cuanto hay alguien del otro lado.

       Si resulta ser una contestadora se habrán dicho dos palabras a una
       máquina. El error contrario cuesta el contacto entero. */
    const id = ['en_linea', 'escuchando', 'portero'].includes(String(actual?.estado)) ? actual.id : null;
    if (id && abiertoPara.current !== id) {
      abiertoPara.current = id;
      avisar();
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: false } }));
      setMicAbierto(true);
      /* ══ «YA TE OYEN, HABLA» ════════════════════════════════════════════
         El micrófono se abría en silencio y la única señal era una pastilla
         gris arriba a la derecha. Fernando contestó, tú hablaste al aire y
         colgó a los cuatro segundos — el caso está medido en la base: una
         línea en lo oído, suya, y ninguna tuya.
         Medio segundo de verde en toda la tarjeta no se puede no ver, y es el
         medio segundo que decide si la primera frase llega. */
      setRecienAbierto(true);
      setTimeout(() => setRecienAbierto(false), 2500);
    } else if (!id && abiertoPara.current) {
      abiertoPara.current = null;
      document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: true } }));
      setMicAbierto(false);
    }
  }, [actual?.id, actual?.estado]);

  /* ══ EL MICRÓFONO SE ABRE SOLO EN CUANTO CONTESTAN ═══════════════════════
     REPORTE DEL DUEÑO (17-sep-2026): «por más que hablaba, el usuario no me
     escuchaba; quita lo de la barra espaciadora, que yo me escuche automático
     al momento que me pases la llamada».

     Qué pasaba: al contestar, el item entra en `escuchando` mientras el
     detector decide si es persona o contestadora. En ese rato el vendedor OÍA
     pero seguía MUDO, y solo la barra espaciadora lo abría. Si no la apretabas
     —o no sabías que existía— hablabas al vacío durante los primeros segundos,
     que son justo los que deciden la llamada.

     Ahora, en cuanto alguien descuelga (`escuchando` o `portero`), se toma la
     llamada sola: micrófono abierto y aviso a la central. El costo de
     equivocarse es asimétrico y por eso se prefiere abrir: si resultó ser una
     contestadora, se habló solo unos segundos a una máquina; si era una
     persona, se salvó la llamada.

     Se quitó el atajo de la barra espaciadora: con la apertura automática ya no
     hace falta, y dos mecanismos para lo mismo es justo lo que produjo el
     malentendido — creer que estabas al aire cuando no lo estabas. */
  const actualRef = useRef<any>(null);
  useEffect(() => { actualRef.current = actual; }, [actual]);
  const tomadoPara = useRef<string | null>(null);
  useEffect(() => {
    if (fase !== 'viva') return;
    const it = actual;
    if (!it || !['escuchando', 'portero'].includes(it.estado)) return;
    if (tomadoPara.current === it.id) return;      // ya se tomó para este item
    tomadoPara.current = it.id;
    document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: false } }));
    setMicAbierto(true);
    post({ accion: 'tomar', id: sesionId }).then(r => {
      if (r?.ok) { abiertoPara.current = it.id; }   // el efecto de `en_linea` ya no lo reabre
      else { document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: true } })); setMicAbierto(false); tomadoPara.current = null; }
      latir();
    });
  }, [fase, actual?.id, actual?.estado, sesionId, latir]);

  // SALA QUE NO SE CAE: si la sesión está activa y el teléfono se salió de la
  // sala (se cayó la red, se durmió la pestaña), se vuelve a entrar solo, con
  // pausas crecientes. Si tras varios intentos no entra, queda el botón.
  const [reintentos, setReintentos] = useState(0);
  useEffect(() => { if (enSala) setReintentos(0); }, [enSala]);
  useEffect(() => {
    if (fase !== 'viva' || enSala || sesion?.estado !== 'activa' || !sesionId) return;
    if (reintentos >= 4) return;
    const espera = [3000, 5000, 9000, 15000][reintentos] || 15000;   // 3 s: si saliste tú, el servidor alcanza a pausar antes
    const t = setTimeout(() => {
      setReintentos(n => n + 1);   // en estado, no en ref: así el siguiente intento se programa aunque nada más cambie
      document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId, silencioso: true } }));
    }, espera);
    return () => clearTimeout(t);
  }, [fase, enSala, sesion?.estado, sesionId, reintentos]);

  // El apunte sigue al item: cambia de item, se guarda lo escrito y se limpia.
  useEffect(() => {
    const id = actual?.id || null;
    if (notaItem.current && notaItem.current !== id) {
      const texto = nota.trim();
      if (texto) post({ accion: 'nota', id: sesionId, item: notaItem.current, nota: texto });
      setNota(''); setNoLlamar(false);
    }
    notaItem.current = id;
    if (id && actual?.nota && !nota) setNota(actual.nota);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id]);

  // ── Armar la lista con los filtros del inbox ──────────────────────────
  const armar = async () => {
    setError(''); setOcupado('armar');
    try {
      const filas: any[] = [];
      let offset = 0; let hayMas = true; let tot = total;
      while (hayMas && filas.length < 500) {
        const j = await fetch(`/api/crm/whatsapp/inbox?${qs}&limit=200&offset=${offset}`, { cache: 'no-store' }).then(r => r.json());
        const lote: any[] = j?.conversaciones || [];
        filas.push(...lote); offset += lote.length; hayMas = !!j?.hay_mas && lote.length > 0;
        tot = Number(j?.total_filtrado ?? tot);
        setArmando({ leidas: filas.length, total: tot });
      }
      const items = filas.map(c => ({
        contact_id: c.contact_id || null, company_id: c.company_id || null,
        conversation_id: c.virtual ? null : (c.wa_id || null),
        nombre: c.contacto?.nombre || null, empresa: c.empresa?.nombre || null,
        telefono: c.telefono || '',
      })).filter(i => i.telefono && !/@/.test(i.telefono));
      if (!items.length) { setError('Ninguna fila de esta lista tiene teléfono.'); return; }
      const r = await post({
        accion: 'crear', items, nombre: descripcion.slice(0, 120),
        origen: { qs, descripcion, filas: filas.length, total: tot },
        presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon,
        config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8, lineas: Number(pres.lineas) || 1, reintentos_buzon: Number(pres.reintentos) || 0 }, modo: pres.modo,
      });
      if (r?.error) { setError(r.error); return; }
      setSesionId(r.id); setTab('lista');
      cargarPrevias();
    } catch (e: any) { setError(e?.message || 'No se pudo armar la lista'); }
    finally { setOcupado(''); setArmando(null); }
  };

  const accion = async (a: string, extra: any = {}) => {
    if (!sesionId) return;
    setError(''); setOcupado(a);
    const desde = Date.now();
    const r = await post({ accion: a, id: sesionId, ...extra });
    // 600 ms mínimo «trabajando»: una respuesta instantánea no se ve, y lo que
    // no se ve se vuelve a picar.
    const falta = 600 - (Date.now() - desde);
    if (falta > 0) await new Promise(res => setTimeout(res, falta));
    setOcupado('');
    if (r?.error) { setError(r.error + (r.faltantes?.length ? ` (faltan: ${r.faltantes.join(', ')})` : '')); return null; }
    /* LA RESPUESTA DEL BOTÓN NO ESPERA AL SIGUIENTE LATIDO. Si el servidor ya
       contestó cómo quedó la sesión, se pinta YA: «Pausar» tiene que cambiar
       la pantalla en el momento en que se aprieta. Con el pulso congelado eso
       tardaba segundos o no llegaba, y parecía que el botón no hacía nada —que
       es justo lo que reportó el dueño—. El latido sigue detrás para lo demás.

       Se salta el guard de secuencia a propósito: esto no es una carrera entre
       sondeos, es la respuesta directa a lo que acabas de pedir. */
    if (r?.sesion) setEst((prev: any) => ({ ...(prev || {}), ...r }));
    latir(); cargarItems();
    return r;
  };

  const empezar = async () => {
    // Guardar la presentación por si la editó, luego arrancar y entrar a la sala.
    const ok1 = await accion('presentacion', { presentacion_nombre: pres.nombre, presentacion_motivo: pres.motivo, buzon_dejar_mensaje: pres.buzon, config: { auto_continuar: pres.auto, wrapup_seg: Number(pres.wrapup) || 8, lineas: Number(pres.lineas) || 1, reintentos_buzon: Number(pres.reintentos) || 0 }, modo: pres.modo });
    if (!ok1) return;
    const r = await accion(sesion?.estado === 'pausada' ? 'reanudar' : 'iniciar');
    // Con Fernanda sola no hay sala que abrir: la central marca y ella habla.
    if (r && pres.modo !== 'ia') document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } }));
  };
  const entrarSala = () => { setError(''); setReintentos(0); document.dispatchEvent(new CustomEvent('tel-sala', { detail: { sesion_id: sesionId } })); };
  const terminar = async () => {
    await accion('terminar');
    document.dispatchEvent(new CustomEvent('tel-colgar-sala'));
  };
  const guardarResultado = async (resultado: string) => {
    if (!actual) return;
    await accion('resultado', { item: actual.id, resultado, no_llamar: resultado === 'no_interesa' && noLlamar });
  };
  const guardarNota = async () => {
    // Sin `ocupado`: se dispara al salir del textarea y no debe desactivar el botón que el vendedor va a picar.
    if (!actual || !nota.trim()) return;
    const r = await post({ accion: 'nota', id: sesionId, item: actual.id, nota: nota.trim() });
    if (r?.error) setError(r.error);
  };
  const relanzar = async (id: string) => {
    setError(''); setOcupado('relanzar');
    const r = await post({ accion: 'relanzar', id });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    if (!r?.total) { setError('No quedó nadie a quien volver a llamar.'); return; }
    setSesionId(r.id); setTab('lista'); cargarPrevias();
  };
  const salirDeSesion = () => {
    // Los contadores se reinician con la sesión: si no, la primera respuesta de
    // la sesión nueva llega con n=1 contra un `aplicado` de 800 y se tira.
    seqEst.current = 0; aplicadoEst.current = 0; seqItems.current = 0; aplicadoItems.current = 0;
    setSesionId(null); setEst(null); setItems([]); cargarPrevias();
  };

  // ── Cálculos de pantalla ──────────────────────────────────────────────
  const hechos = useMemo(() => items.filter(i => ['hecho', 'saltado'].includes(i.estado)), [items]);
  const pendientes = useMemo(() => items.filter(i => i.estado === 'pendiente'), [items]);
  const excluidos = useMemo(() => items.filter(i => i.estado === 'excluido'), [items]);
  const segCierre = actual?.estado === 'cierre' && actual.terminado_at && est?.ahora
    ? Math.max(0, Number(sesion?.config?.wrapup_seg ?? 8) - Math.round((new Date(est.ahora).getTime() - new Date(actual.terminado_at).getTime()) / 1000)) : null;
  const propuesta = actual?.estado === 'cierre' ? actual?.cierre_ia?.propuesta : null;
  /* ══ CONTESTÓ UNA PERSONA: LA LISTA TE ESPERA ══════════════════════════
     Pedido del dueño (17-sep-2026): «hablé con ella, me pidió que le marcara
     más tarde… ahí ya no debe seguir a la siguiente: ahí debe aparecerme la
     interfaz con las decisiones, y ya al tomar la decisión me pasa a la otra».
     El motor hace su parte (no avanza ni aplica nada); aquí se DICE, porque un
     proceso que se para sin avisar se siente igual que uno atorado. */
  const esperaTuDecision = actual?.estado === 'cierre' && ['persona', 'duda'].includes(String(actual?.veredicto || '')) && !sola;
  const enviosAbiertos: any[] = (propuesta?.envios || []).filter((e: any) => e.estado === 'falta');
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  useEffect(() => {
    if (tab !== 'compromisos' || !sesionId) return;
    let vivo = true;
    const traer = () => fetch(`/api/crm/telefonia/marcador?id=${sesionId}&compromisos=1`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (vivo) setCompromisos(j.compromisos || []); }).catch(() => {});
    traer();
    const t = setInterval(traer, 15000);   // se llena conforme cuelgas: no hace falta más seguido
    return () => { vivo = false; clearInterval(t); };
  }, [tab, sesionId, hechos.length]);
  /* ══ LO QUE HACE FALTA PARA DECIDIR RÁPIDO Y BIEN (17-sep-2026) ══════════
     Las diez mejoras del momento de colgar viven aquí: corregir la propuesta,
     rechazarla, leer lo que se dijo, saber por qué la IA no pudo, las salidas
     en un clic, la hora de la llamada de vuelta, deshacer, quién sigue, el
     teclado y la grabación. */
  const [editando, setEditando] = useState<Record<number, { fecha: string; hora: string }>>({});
  const [deshacer, setDeshacer] = useState<{ item: string; hasta: number } | null>(null);
  const [deshecho, setDeshecho] = useState<string[] | null>(null);
  const [verDicho, setVerDicho] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [cuando, setCuando] = useState<{ fecha: string; hora: string }>({ fecha: '', hora: '' });
  const responderEnvio = async (envioId: string) => {
    const texto = (respuestas[envioId] || '').trim();
    if (texto.length < 10) { setError('Escribe al menos una línea de lo que se le manda.'); return; }
    const r = await accion('cierre_respuesta', { envio: envioId, texto });
    if (r && !r.ok) setError(r.motivo || 'No se pudo mandar');
  };
  /* ══ LAS LÍNEAS QUE ESTÁN MARCANDO ═══════════════════════════════════════
     Se pinta en DOS sitios y por eso vive aquí: dentro de la tarjeta de la
     llamada cuando ya hay alguien, y en el hueco del centro mientras nadie ha
     contestado todavía —que con varias líneas es la mayor parte del tiempo, y
     antes era un «Marcando al siguiente…» que no decía a quién—.

     «Yo vería a quiénes se les está marcando.» Una columna, renglones grandes:
     igual en la compu y en el teléfono. */
  const bloqueLineas = (est?.vivos || []).length > 1 && !actual?.veredicto ? (
    <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
      <span style={etiqueta}>Marcando a {est.vivos.length} a la vez</span>
      {est.vivos.map((v: any) => (
        <div key={v.id} style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 10,
          border: `1px solid ${v.veredicto === 'persona' || v.estado === 'en_linea' ? '#9fdcc2' : C.g200}`,
          background: v.veredicto === 'persona' || v.estado === 'en_linea' ? '#EAF8F2' : '#fff',
        }}>
          <span className={['marcando', 'timbrando'].includes(v.estado) ? 'wa-pulso' : undefined} style={{
            width: 9, height: 9, borderRadius: 999, flexShrink: 0,
            background: v.estado === 'en_linea' ? '#1E8A63' : v.veredicto === 'buzon' ? '#9a6a10' : '#9B8CFA',
          }} />
          <b style={{ fontSize: 13, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.nombre || telefonoLegible(v.telefono)}
            {v.empresa && <span style={{ fontWeight: 500, color: C.g500 }}> · {v.empresa}</span>}
          </b>
          <span style={{ fontSize: 11.5, color: v.estado === 'en_linea' ? '#1E8A63' : C.g500, fontWeight: 700, flexShrink: 0 }}>
            {v.veredicto === 'buzon' ? 'Buzón' : ETIQUETA_ITEM[v.estado] || v.estado}
            {['marcando', 'timbrando'].includes(v.estado) && v.segundos > 0 ? ` · ${v.segundos}s` : ''}
          </span>
        </div>
      ))}
      <span style={{ fontSize: 11, color: C.g400, lineHeight: 1.5 }}>
        Te pasamos con el primero que conteste; a los demás se les cuelga mientras todavía timbran.
        {est.abandonadas > 0 && ` · ${est.abandonadas} contestaron cuando ya estabas en otra llamada (se les vuelve a marcar).`}
      </span>
    </div>
  ) : null;

  const confirmarYSeguir = async () => {
    if (!actual) return;
    const item = actual.id;
    // Primero el cierre con lo que el vendedor ajustó (chip y apunte), luego el siguiente. Si el cierre falla, no se avanza a ciegas.
    if (propuesta) { const r = await accion('cierre', { item, nota: nota.trim() || undefined }); if (!r) return; }
    /* DOS MINUTOS PARA DESHACER. Es lo que tarda uno en darse cuenta de que
       confirmó de más — y para entonces el siguiente ya está timbrando, que es
       justo cuando no se puede ir a cancelar una cita a mano. */
    if (propuesta) { setDeshacer({ item, hasta: Date.now() + 120000 }); setDeshecho(null); }
    await accion('siguiente');
  };
  /* Una salida en un clic: se anota y se ejecuta en el mismo viaje, por el
     motor de acciones (el mismo que atiende lo que el cliente pidió). */
  const rapida = async (cual: string, params: any = {}) => {
    if (!actual?.call_sid) { setError('Esta llamada no tiene con qué: no se registró en el espejo.'); return; }
    setOcupado(cual);
    const r = await fetch('/api/crm/telefonia/sala', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: actual.call_sid, accion: 'rapida', cual, params }),
    }).then(x => x.json()).catch(() => ({ error: 'Sin red' }));
    setOcupado('');
    if (r?.error) setError(r.error);
    else if (r?.ok === false && r?.dicho) setError(r.dicho);
    else { setError(''); latir(); }
  };
  /** «Márcame más tarde», con hora de verdad. Sin hora la promesa se agenda a
   *  las 10 por omisión, y ésa es justo la que se rompe. */
  const volverA = (horas: number | null, dia?: 'manana' | 'lunes') => {
    const d = new Date();
    // En MINUTOS, para que «en 5 min» sea en cinco minutos y no en cinco horas:
    // los atajos cortos son fracciones (5/60) y `setHours` las tiraba al suelo.
    if (horas) d.setTime(d.getTime() + Math.round(horas * 60) * 60000);
    if (dia === 'manana') { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); }
    if (dia === 'lunes') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(10, 0, 0, 0); }
    const fecha = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return rapida('volver_a_llamar', { fecha, hora });
  };
  const editarCierre = (cambios: any) => accion('cierre_editar', { item: actual?.id, cambios });
  const descartarPropuesta = async () => {
    if (!(await confirmar('¿Tirar lo que propuso la IA? Se cierra la llamada con lo que tú digas.'))) return;
    await accion('cierre_descartar', { item: actual?.id });
  };
  const pedirGrabacion = async () => {
    setOcupado('audio');
    const r = await post({ accion: 'grabacion', id: sesionId, item: actual?.id });
    setOcupado('');
    if (r?.url) setAudio(r.url); else setError(r?.motivo || r?.error || 'No hay grabación todavía');
  };
  const deshacerCierre = async () => {
    if (!deshacer) return;
    setOcupado('deshacer');
    const r = await post({ accion: 'cierre_deshacer', id: sesionId, item: deshacer.item });
    setOcupado('');
    if (r?.error) { setError(r.error); return; }
    setDeshecho(r.deshecho || []); setDeshacer(null);
  };

  /* ══ EL TECLADO, EN EL MOMENTO DE DECIDIR ════════════════════════════════
     1-5 eligen cómo quedó, Enter confirma y pasa al siguiente. En una jornada
     de cincuenta llamadas, ir al ratón para cada chip es lo que convierte diez
     minutos de trabajo en una hora. Nunca secuestra el teclado mientras se
     escribe: si el foco está en un campo, las teclas son del campo. */
  const RES_TECLA = ['contesto', 'volver_llamar', 'dieron_datos', 'no_interesa', 'buzon'];
  useEffect(() => {
    if (!esperaTuDecision) return;
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const r = RES_TECLA[Number(e.key) - 1];
        if (r && actual) post({ accion: 'resultado', id: sesionId, item: actual.id, resultado: r }).then(() => latir());
      } else if (e.key === 'Enter') {
        e.preventDefault(); confirmarYSeguir();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [esperaTuDecision, actual?.id, propuesta, nota]);

  // Lo que se está escribiendo para un envío sobrevive al recargar (por id de envío) y le avisa a la central que espere.
  useEffect(() => {
    if (!enviosAbiertos.length) return;
    setRespuestas(r => {
      const n = { ...r };
      for (const e of enviosAbiertos) if (!n[e.id]) { const v = leerSesion(`cabina.envio.${e.id}`, ''); if (v) n[e.id] = v; }
      return n;
    });
  }, [enviosAbiertos.map((e: any) => e.id).join(',')]);
  useEffect(() => { for (const [id, v] of Object.entries(respuestas)) guardarSesion(`cabina.envio.${id}`, v); }, [respuestas]);
  const escribiendo = enviosAbiertos.some((e: any) => (respuestas[e.id] || '').trim().length > 0);
  useEffect(() => {
    if (!escribiendo || !actual?.id || actual.estado !== 'cierre') return;
    const tick = () => post({ accion: 'cierre_escribiendo', id: sesionId, item: actual.id });
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, [escribiendo, actual?.id, actual?.estado, sesionId]);
  const conversaciones = Number(sesion?.contestadas || 0);
  const costoSesion = Number(sesion?.costo_usd || 0);

  const cab = (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: `1px solid ${C.g200}`, flexShrink: 0, background: '#fff' }}>
      <IcoTelefono size={16} style={{ color: C.moradoTinta }} />
      <b style={{ fontSize: 14, letterSpacing: '-0.01em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Llamadas inteligentes{sesion?.nombre ? <span style={{ fontWeight: 500, color: C.g500 }}> · {sesion.nombre}</span> : null}
      </b>
      {/* El marcador del partido, de reojo: conversaciones · costo · sin
          contacto. Sin tarjetas, sin etiquetas largas, sin robarle sitio a la
          llamada. Se esconde en el teléfono, donde el header ya va lleno. */}
      {fase === 'viva' && sesion && !movil && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.g500, fontVariantNumeric: 'tabular-nums' }}>
          <span title="Conversaciones de verdad"><b style={{ color: '#1E8A63', fontSize: 12.5 }}>{conversaciones}</b> conv</span>
          <span title="Lo que llevas hablado">{fmt(sesion.segundos_hablados || 0)}</span>
          <span title="Costo de la jornada"><b style={{ color: C.moradoTinta, fontSize: 12.5 }}>US$ {costoSesion.toFixed(2)}</b></span>
          <span title="Buzón · sin contestar · contestadora">{Number(sesion.buzon || 0) + Number(sesion.sin_contestar || 0) + Number(sesion.porteros || 0)} sin contacto</span>
        </span>
      )}
      {fase === 'viva' && fernanda && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '3px 9px' }}>
          {sola ? 'Habla Fernanda' : 'Fernanda y tú'}
        </span>
      )}
      {fase === 'viva' && !sola && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: enSala ? (micAbierto ? '#1E8A63' : C.moradoTinta) : '#9a6a10', background: enSala ? (micAbierto ? '#EAF8F2' : C.moradoAgua) : '#FFF4E5', borderRadius: 999, padding: '3px 9px' }}>
          <IcoMic size={12} />{enSala ? (micAbierto ? 'Te oyen' : 'En la sala, mudo') : 'Fuera de la sala'}
        </span>
      )}
      {sesionId && fase !== 'viva' && <button onClick={salirDeSesion} style={{ ...btnT, padding: '5px 10px' }}>Otra lista</button>}
      <button onClick={onCerrar} title="Volver al inbox" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 4 }}><IcoX size={16} /></button>
    </div>
  );

  const errorBox = error ? (
    <div role="alert" style={{ margin: '0 0 12px', background: '#FEF0EF', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, display: 'flex', gap: 8 }}>
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C0554E', fontFamily: 'inherit', fontWeight: 700 }}>x</button>
    </div>
  ) : null;

  const formPresentacion = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <label style={etiqueta}>Quién llama (lo que oye la contestadora)</label>
        <input value={pres.nombre} onChange={e => setPres((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="Aarón de Sacscloud" style={campo} />
      </div>
      <div>
        <label style={etiqueta}>Motivo de la llamada</label>
        <input value={pres.motivo} onChange={e => setPres((p: any) => ({ ...p, motivo: e.target.value }))} placeholder="le llamo para dar seguimiento a su solicitud" style={campo} />
        <span style={{ fontSize: 11, color: C.g400, display: 'block', marginTop: 4 }}>Se dice así: «Soy {pres.nombre || '…'}, {pres.motivo || '…'}. Busco a {'{nombre}'}. Gracias.»</span>
      </div>
      {telefonia?.fernanda && (
        <div>
          <label style={etiqueta}>Quién habla</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['manual', 'Yo', 'Marco y hablo yo; la IA solo escucha y cierra.'], ['ia', 'Fernanda', 'La voz de la IA hace toda la llamada y agenda sola. No hace falta que estés en la sala.'], ['asistido', 'Fernanda y yo', 'Fernanda abre y conversa; yo escucho y puedo tomar la llamada cuando quiera.']] as const).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setPres((p: any) => ({ ...p, modo: v }))} title={d} disabled={!!sesionId && !['borrador', 'lista', 'pausada'].includes(sesion?.estado)} style={{
                border: `1.5px solid ${pres.modo === v ? '#9B8CFA' : C.g200}`, background: pres.modo === v ? '#9B8CFA' : '#fff', color: pres.modo === v ? '#fff' : C.g700,
                borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.g400, display: 'block', marginTop: 4 }}>
            {pres.modo === 'ia' ? 'Fernanda se presenta, entiende el negocio, agenda la reunión y sigue con el siguiente. Tú ves la transcripción en vivo.' : pres.modo === 'asistido' ? 'Fernanda habla primero; tú estás en la sala mudo y puedes tomar la llamada con «Hablar yo».' : 'Tú hablas. La IA escucha, detecta buzones y contestadoras, y hace el cierre.'}
          </span>
        </div>
      )}
      {/* ══ CUÁNTAS LLAMADAS A LA VEZ ══════════════════════════════════════
          El tiempo de una jornada no se va hablando: se va TIMBRANDO. Contesta
          uno de cada cinco y cada intento cuesta media vuelta de reloj. Con dos
          o tres líneas sólo oyes a los que contestaron.
          Lo que se paga a cambio está escrito abajo sin adornos: con una línea
          oyes el timbre y el buzón; con varias, no — y de vez en cuando alguien
          contesta cuando ya estás hablando con otro. */}
      {pres.modo === 'manual' && (
        <div>
          <label style={etiqueta}>Cuántas llamadas a la vez</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([[1, 'Una'], [2, 'Dos'], [3, 'Tres']] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setPres((p: any) => ({ ...p, lineas: v }))}
                disabled={!!sesionId && !['borrador', 'lista', 'pausada'].includes(sesion?.estado)}
                style={{
                  border: `1.5px solid ${Number(pres.lineas || 1) === v ? '#9B8CFA' : C.g200}`, background: Number(pres.lineas || 1) === v ? '#9B8CFA' : '#fff',
                  color: Number(pres.lineas || 1) === v ? '#fff' : C.g700, borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.g400, display: 'block', marginTop: 4, lineHeight: 1.5 }}>
            {Number(pres.lineas || 1) === 1
              ? 'Una por una: oyes el timbre, el buzón y todo lo que pasa. Es lo más tranquilo y lo más lento.'
              : `Se marca a ${pres.lineas} a la vez y te pasamos al PRIMERO que conteste; a los demás se les cuelga mientras todavía timbra. No oyes el timbre —serían ${pres.lineas} audios encimados— y, muy de vez en cuando, alguien contesta justo cuando ya estás con otro: a ése se le dice que le marcamos en un momento y vuelve a la lista.`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 12.5, color: C.g700 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.buzon} onChange={e => setPres((p: any) => ({ ...p, buzon: e.target.checked }))} /> Dejar recado en el buzón de voz</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!pres.auto} onChange={e => setPres((p: any) => ({ ...p, auto: e.target.checked }))} /> Seguir solo con el siguiente</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Pausa entre llamadas <input type="number" min={3} max={60} value={pres.wrapup} onChange={e => setPres((p: any) => ({ ...p, wrapup: e.target.value }))} style={{ ...campo, width: 62, padding: '4px 6px' }} /> s</label>
      </div>
    </div>
  );

  // ── 1 · ARMAR ─────────────────────────────────────────────────────────
  if (fase === 'armar') {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            {telefonia && !telefonia.ok && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '8px 12px', fontSize: 12.5 }}>
                La telefonía no está configurada (faltan {telefonia.faltantes.length} datos). Puedes armar la lista, pero no marcar.
              </div>
            )}
            <div style={tarjeta('#9B8CFA')}>
              <span style={etiqueta}>La lista</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.g900 }}>{descripcion}</div>
              <div style={{ fontSize: 12.5, color: C.g500, marginTop: 2 }}>
                {total > 0 ? `${total} ${total === 1 ? 'contacto' : 'contactos'} con los filtros de ahora` : 'Sin filas con los filtros de ahora'}{total > 500 ? ' · se toman los primeros 500' : ''}.
                Se quitan solos los que no tienen teléfono, los marcados «no llamar» y los que ya se intentaron 3 veces esta semana.
              </div>
              {armando && <div style={{ marginTop: 8, fontSize: 12, color: C.moradoTinta, fontWeight: 600 }}>Leyendo la lista… {armando.leidas}{armando.total ? ` de ${armando.total}` : ''}</div>}
            </div>
            <div style={tarjeta('#7DA6F5')}>
              <span style={etiqueta}>Cómo te presentas</span>
              {formPresentacion}
            </div>
            {/* SI SUENA Y SE VA AL BUZÓN, ¿SE VUELVE A INTENTAR?
                Un teléfono que SUENA está encendido y con alguien cerca: no
                contestó ahora, puede contestar en veinte minutos. Uno que va
                derecho al buzón está apagado, y reintentarlo es quemar llamadas
                contra una grabadora. Por eso la opción sólo aplica al primero —
                el motor los distingue por cuánto tardó en «contestar». */}
            <div style={tarjeta('#E8A838')}>
              <span style={etiqueta}>Si suena y se va al buzón</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {/* ══ 🔴 ERA UN BOTÓN MUERTO (18-sep-2026) ═══════════════════
                    Reporte del dueño: «intento escoger "1 vez más" y no me lo
                    selecciona». No era el pintado: es que este control era el
                    ÚNICO de esta pantalla que guardaba con `accion()`, y
                    `accion()` empieza con `if (!sesionId) return` — aquí la
                    sesión todavía no existe, se crea al armar la lista. El clic
                    se iba al vacío, sin error y sin cambiar nada.

                    Ahora vive en `pres`, como el resto de lo que se decide
                    antes de arrancar (auto-continuar, wrap-up, líneas, quién
                    habla): se pinta al instante, se recuerda en el navegador y
                    viaja en el `config` al crear o al empezar. Si la sesión YA
                    existe —se entró a cambiarlo a media jornada— además se
                    guarda en el momento, que era la intención original. */}
                {[0, 1, 2, 3].map(v => {
                  /* Se pinta desde `pres` y NO desde la sesión, aunque haya
                     sesión: el clic tiene que verse en el momento, y la sesión
                     no se refresca hasta el siguiente latido (hasta 6 s). El
                     efecto de abajo adopta el valor guardado al abrir una
                     sesión, así que las dos cosas no se pelean. */
                  const elegido = Number(pres.reintentos || 0) === v;
                  return (
                  <button key={v} onClick={() => {
                    setPres((x: any) => { const n = { ...x, reintentos: v }; guardarLocal('cabina.presentacion', n); return n; });
                    if (sesionId) accion('presentacion', { config: { reintentos_buzon: v } });
                  }}
                    style={{ border: `1px solid ${elegido ? '#E8A838' : C.g200}`,
                      background: elegido ? '#FFF8EC' : '#fff',
                      color: elegido ? '#9a6a10' : C.g500,
                      borderRadius: 999, padding: '5px 13px', fontSize: 12.5,
                      fontWeight: elegido ? 800 : 600,
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v === 0 ? 'No reintentar' : `${v} ${v === 1 ? 'vez' : 'veces'} más`}
                  </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: C.g500, marginTop: 7, lineHeight: 1.5 }}>
                Se reintenta a los 25 minutos. Al que va DIRECTO al buzón no se le
                reintenta nunca: ese teléfono está apagado.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={armar} disabled={!!ocupado || total === 0} style={{ ...S.btnP, opacity: !!ocupado || total === 0 ? 0.6 : 1 }}>
                {ocupado === 'armar' ? 'Armando…' : 'Armar la lista con los filtros actuales'}
              </button>
              <span style={{ fontSize: 11.5, color: C.g400 }}>Después la revisas antes de marcar.</span>
            </div>

            {previas.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={etiqueta}>Sesiones anteriores</span>
                <div style={{ display: 'grid', gap: 6 }}>
                  {previas.map(p => (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.g900 }}>{p.nombre || 'Sesión'}</div>
                        <div style={{ fontSize: 11.5, color: C.g500 }}>
                          {String(p.created_at).slice(0, 10)} · {p.total} en lista · {p.contestadas} contestaron · {p.buzon} buzón · {p.sin_contestar} sin contestar{p.porteros ? ` · ${p.porteros} contestadora` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: ['activa', 'pausada'].includes(p.estado) ? '#EAF8F2' : C.g100, color: ['activa', 'pausada'].includes(p.estado) ? '#1E8A63' : '#4B5563' }}>{p.estado}</span>
                      <button onClick={() => { setSesionId(p.id); setTab(p.estado === 'terminada' ? 'hechas' : 'lista'); }} style={btnS}>{['terminada', 'cancelada'].includes(p.estado) ? 'Ver' : 'Abrir'}</button>
                      {['terminada', 'cancelada'].includes(p.estado) && (p.sin_contestar + p.buzon + p.porteros) > 0 && (
                        <button onClick={() => relanzar(p.id)} disabled={ocupado === 'relanzar'} style={btnT}>Relanzar</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filaItem = (i: any, conAcciones: boolean, compacto = false) => (
    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.g100}`, background: i.id === actual?.id ? C.moradoSuave : '#fff', opacity: i.estado === 'excluido' ? 0.55 : 1 }}>
      <span style={{ width: 22, fontSize: 11, color: C.g400, textAlign: 'right', flexShrink: 0 }}>{i.orden + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nombre || telefonoLegible(i.telefono)}{i.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {i.empresa}</span> : null}</div>
        <div style={{ fontSize: 11.5, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{telefonoLegible(i.telefono)}{i.intentos ? ` · ${i.intentos} ${i.intentos === 1 ? 'intento' : 'intentos'}` : ''}{i.duracion_seg ? ` · ${fmt(i.duracion_seg)}` : ''}{i.motivo_exclusion ? ` · ${i.motivo_exclusion}` : ''}</div>
        {i.nota && <div style={{ fontSize: 11.5, color: '#4B5563', marginTop: 2, fontStyle: 'italic' }}>{i.nota}</div>}
        {/* ══ QUÉ QUEDÓ HECHO EN ESTA LLAMADA ══════════════════════════════
            Pedido del dueño (18-sep-2026): «en el resumen de las terminadas
            debe decirme si se hizo corrección de datos, si se agendó demo, si
            se agendó discovery y así, para que yo pueda ver si todo se agendó
            en orden y bien».

            Antes sólo había una píldora con el desenlace («Hablamos») y había
            que abrir la conversación para saber si de verdad quedó la cita, si
            el PDF salió y si los datos se guardaron. Ahora está en la fila,
            con la misma frase que dejó el cierre al ejecutarlo — incluida la
            confirmación por WhatsApp de la reunión, que es lo que faltaba. */}
        {(i.hecho || []).length > 0 && (
          <div style={{ marginTop: 3, display: 'grid', gap: 1 }}>
            {i.hecho.map((h: string, n: number) => (
              <div key={n} style={{ fontSize: 11, lineHeight: 1.45, color: /no se pudo|no salió|no se le pudo|sin fecha|tarea:/i.test(h) ? '#9a6a10' : '#1E8A63' }}>
                {/no se pudo|no salió|no se le pudo/i.test(h) ? '⚠️' : '✓'} {h}
              </div>
            ))}
          </div>
        )}
        {/* Y si la IA no pudo cerrarla, se dice aquí mismo: una llamada sin
            nada hecho y sin explicación se lee como que el sistema falló. */}
        {i.estado === 'hecho' && !(i.hecho || []).length && i.cierre_motivo && (
          <div style={{ fontSize: 11, color: '#9a6a10', marginTop: 3 }}>La IA no la cerró: {i.cierre_motivo}</div>
        )}
      </div>
      {i.estado === 'hecho' || i.estado === 'saltado'
        ? <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...tono(i.resultado), background: tono(i.resultado).bg, color: tono(i.resultado).fg }}>{ETIQUETA_RESULTADO[i.resultado] || ETIQUETA_ITEM[i.estado]}</span>
        : <span style={{ fontSize: 11, color: i.volver_at ? C.moradoTinta : C.g500, fontWeight: i.volver_at ? 700 : 400 }}>{i.estado === 'pendiente' && fase === 'fin' ? 'Sin marcar' : i.estado === 'pendiente' && i.volver_at ? `A las ${new Date(i.volver_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}` : (ETIQUETA_ITEM[i.estado] || i.estado)}</span>}
      {/* LLAMAR A ESTE, YA. Pedido del dueño (17-sep-2026): la lista sabe a
          quién hay que marcar, pero para llamarle a UNO en concreto —el que te
          interesa, el que te devolvió la llamada— había que esperar a que la
          corrida llegara a él o buscarlo en el inbox. Reusa el evento
          `tel-llamar` que ya escucha Telefonia.tsx: es el mismo camino que un
          enlace `tel:` del hilo, así que la barra de llamada, la grabación y la
          minuta funcionan igual sin código nuevo. */}
      {!compacto && i.telefono && (
        <button onClick={() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: i.telefono, nombre: i.nombre || null } }))}
          title={`Llamar a ${i.nombre || telefonoLegible(i.telefono)} ahora`}
          style={{ ...btnT, padding: '3px 8px', fontSize: 11, borderColor: '#c9bcf7', color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcoTelefono size={11} /> Llamar
        </button>
      )}
      {!compacto && i.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(i.conversation_id)} title="Ver la conversación" style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Chat</button>}
      {conAcciones && i.estado === 'pendiente' && <button onClick={() => accion('excluir', { item: i.id })} title="Quitar de la lista" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2 }}><IcoX size={14} /></button>}
      {conAcciones && !compacto && i.estado === 'excluido' && <button onClick={() => accion('incluir', { item: i.id })} style={{ ...btnT, padding: '3px 8px', fontSize: 11 }}>Volver a meter</button>}
    </div>
  );

  // ── 2 · LA LISTA, ANTES DE MARCAR ─────────────────────────────────────
  if (fase === 'lista') {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ ...tarjeta('#9B8CFA'), flex: 1, minWidth: 140 }}><span style={etiqueta}>En la lista</span><div style={{ fontSize: 22, fontWeight: 800, color: C.moradoTinta }}>{pendientes.length}</div></div>
              <div style={{ ...tarjeta('#E8A838'), flex: 1, minWidth: 140 }}><span style={etiqueta}>Fuera</span><div style={{ fontSize: 22, fontWeight: 800, color: '#9a6a10' }}>{excluidos.length}</div><div style={{ fontSize: 11, color: C.g500 }}>sin teléfono, no llamar o repetidos</div></div>
            </div>
            <div style={tarjeta('#7DA6F5')}>
              <span style={etiqueta}>Cómo te presentas</span>
              {formPresentacion}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={empezar} disabled={!!ocupado || pendientes.length === 0 || (telefonia ? !telefonia.ok : false)} style={{ ...S.btnP, opacity: !!ocupado || pendientes.length === 0 ? 0.6 : 1 }}>
                {ocupado ? (pres.modo === 'ia' ? 'Arrancando…' : 'Abriendo la sala…') : pres.modo === 'ia' ? 'Que Fernanda empiece a marcar' : 'Empezar a marcar'}
              </button>
              <span style={{ fontSize: 11.5, color: C.g400 }}>{pres.modo === 'ia' ? 'Fernanda marca y habla sola; puedes cerrar esta ventana y volver cuando quieras.' : pres.modo === 'asistido' ? 'Ponte los audífonos: entras mudo, Fernanda habla y tú tomas la llamada cuando quieras.' : 'Ponte los audífonos: entras mudo y solo hablas cuando conteste una persona.'}</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => accion('terminar')} style={btnD}>Descartar lista</button>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.length === 0 ? <Cargando texto="Leyendo la lista…" alto={120} /> : items.map(i => filaItem(i, true))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 4 · TERMINADA ─────────────────────────────────────────────────────
  if (fase === 'fin') {
    const s = sesion;
    const kpi = (franja: string, et: string, v: any, color: string, sub?: string) => (
      <div style={{ ...tarjeta(franja), flex: 1, minWidth: 120 }}><span style={etiqueta}>{et}</span><div style={{ fontSize: 22, fontWeight: 800, color }}>{v}</div>{sub && <div style={{ fontSize: 11, color: C.g500 }}>{sub}</div>}</div>
    );
    const relanzables = items.filter(i => ['no_contesto', 'ocupado', 'buzon', 'portero', 'volver_llamar'].includes(i.resultado) || i.estado === 'pendiente').length;
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
        {cab}
        <div className="wa-scroll" style={{ flex: 1, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
            {errorBox}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {kpi('#4FBF95', 'Contestaron', s.contestadas, '#1E8A63', `${fmt(s.segundos_hablados || 0)} hablados`)}
              {kpi('#E8A838', 'Buzón', s.buzon, '#9a6a10')}
              {kpi('#9B8CFA', 'Sin contestar', s.sin_contestar, C.moradoTinta)}
              {kpi('#7DA6F5', 'Contestadora', s.porteros, '#2C5FC4')}
              {kpi('#EF7A72', 'Inválidos', s.invalidos, '#C0554E')}
              {kpi('#D1D5DB', 'Sin marcar', items.filter(i => i.estado === 'pendiente').length, '#4B5563')}
              {kpi('#9B8CFA', 'Costo', `US$ ${Number(s.costo_usd || 0).toFixed(2)}`, C.moradoTinta, s.contestadas ? `US$ ${(Number(s.costo_usd || 0) / s.contestadas).toFixed(2)} por conversación` : 'solo llamadas')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => relanzar(s.id)} disabled={!relanzables || ocupado === 'relanzar'} style={{ ...S.btnP, opacity: relanzables ? 1 : 0.6 }}>Volver a llamar a los {relanzables} que faltan</button>
              <button onClick={salirDeSesion} style={btnS}>Armar otra lista</button>
            </div>
            <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden' }}>
              {items.map(i => filaItem(i, false))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3 · LA CABINA VIVA ────────────────────────────────────────────────
  const pausada = sesion.estado === 'pausada';
  const aviso = sesion.config?.aviso;
  const estadoActual = actual?.estado;
  const colorEstado = estadoActual === 'en_linea' ? '#4FBF95' : estadoActual === 'cierre' ? '#7DA6F5' : estadoActual === 'portero' ? '#E8A838' : '#9B8CFA';
  const chipRes = (r: string, texto: string) => (
    <button key={r} onClick={() => guardarResultado(r)} style={{
      border: `1.5px solid ${actual?.resultado === r ? '#9B8CFA' : C.g200}`, background: actual?.resultado === r ? C.moradoAgua : '#fff',
      color: actual?.resultado === r ? C.moradoTinta : C.g700, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    }}>{texto}</button>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
      {cab}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: movil ? 'column' : 'row' }}>
        {/* Izquierda: el item actual */}
        <div className="wa-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: movil ? '14px 14px 110px' : 22 }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 12 }}>
            {errorBox}
            {!enSala && !sola && (
              <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>
                  {pausada && sesion.pausa_motivo === 'caida' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se cortó tu conexión</b>}
                  {pausada && sesion.pausa_motivo === 'disyuntor' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se detuvo sola</b>}
                  {pausada && sesion.pausa_motivo === 'horario' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fuera de horario</b>}
                  {aviso || (reintentos > 0 && reintentos < 4 && sesion.estado === 'activa' ? 'Se cortó la sala: volviendo a entrar…' : 'No estás en la sala: la central no marca hasta que entres.')}
                </span>
                <button onClick={pausada ? empezar : entrarSala} disabled={!!ocupado} style={S.btnP}>{pausada ? 'Reanudar y entrar a la sala' : 'Entrar a la sala'}</button>
              </div>
            )}
            {(enSala || sola) && pausada && (
              <div style={{ background: sesion.pausa_motivo === 'disyuntor' ? '#FEF0EF' : '#FFF4E5', border: `1px solid ${sesion.pausa_motivo === 'disyuntor' ? '#f0c4bd' : '#f3d9a4'}`, color: sesion.pausa_motivo === 'disyuntor' ? '#C0554E' : '#9a6a10', borderRadius: 9, padding: '10px 12px', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>
                  {sesion.pausa_motivo === 'horario' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fuera de horario</b>}
                  {sesion.pausa_motivo === 'disyuntor' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se detuvo sola</b>}
                  {sesion.pausa_motivo === 'caida' && <b style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Se cortó tu conexión</b>}
                  {aviso || 'Sesión en pausa.'}
                </span>
                {sesion.pausa_motivo !== 'horario' && <button onClick={() => accion('reanudar')} disabled={!!ocupado} style={S.btnP}>{sesion.pausa_motivo === 'disyuntor' ? 'Ya lo revisé, seguir' : 'Reanudar'}</button>}
              </div>
            )}
            {est?.proximo && !actual && (
              <div style={{ background: C.moradoAgua, color: C.moradoTinta, borderRadius: 9, padding: '9px 12px', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>
                <IcoReloj size={13} />
                <span>Compromiso: <b>{est.proximo.nombre || telefonoLegible(est.proximo.telefono)}</b> a las {new Date(est.proximo.volver_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}{new Date(est.proximo.volver_at).toDateString() !== new Date().toDateString() ? ` del ${new Date(est.proximo.volver_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })}` : ''}. Se marca sola a esa hora.</span>
              </div>
            )}

            {/* ══ LOS TRES NÚMEROS, ARRIBA ══════════════════════════════════
                Pedido del dueño (17-sep-2026): «estos igual que aparezcan
                arriba por favor».

                Vivían debajo de la tarjeta del contacto, y la tarjeta crece
                —contexto, transcripción, cierre— así que en media jornada los
                números quedaban fuera de pantalla: para saber cuántas
                conversaciones llevabas había que bajar. Son el marcador del
                partido; van donde se ven sin buscarlos. */}
            {/* ══ Y DE AHÍ AL HEADER, EN CHICO (18-sep-2026) ════════════════
                «Estos KPIs en cuadros vas a ponerlos en el header hasta arriba
                y en muy chico, para que no estorben mientras estoy en la sala.»

                Tenía razón: tres tarjetas de 140 px empujaban la llamada —lo
                único que importa mientras hablas— media pantalla hacia abajo.
                Son el marcador del partido: se miran de reojo, no se leen.
                Arriba y chiquitos mientras la jornada está viva; en tamaño
                normal cuando termina, que es cuando sí se estudian. */}
            {fase !== 'viva' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['#4FBF95', 'Conversaciones', conversaciones, '#1E8A63', `${fmt(sesion.segundos_hablados || 0)} hablados`],
                  ['#9B8CFA', 'Costo', `US$ ${costoSesion.toFixed(2)}`, C.moradoTinta, conversaciones ? `US$ ${(costoSesion / conversaciones).toFixed(2)} por conversación` : 'llamadas, sin transcripción'],
                  ['#E8A838', 'Sin contacto', Number(sesion.buzon || 0) + Number(sesion.sin_contestar || 0) + Number(sesion.porteros || 0), '#9a6a10', `${sesion.buzon || 0} buzón · ${sesion.sin_contestar || 0} sin contestar · ${sesion.porteros || 0} contestadora`],
                  /* El cuarto sólo aparece cuando hay alguno, y aparece en rojo
                     a propósito: cada uno es alguien que SÍ descolgó y colgó sin
                     oír una palabra nuestra. Es el número más caro de la jornada
                     —contacto hecho y perdido en tres segundos— y el único que
                     dice si el hueco entre «contestaron» y tu primera frase se
                     está cerrando. Ya se les vuelve a marcar solos en 10 min. */
                  ...(Number(est?.colgaron_en_silencio || 0) > 0
                    ? [['#C0554E', 'Colgaron sin que hablaras', Number(est.colgaron_en_silencio), '#C0554E', 'descolgaron y colgaron en silencio · se les marca de nuevo en 10 min']]
                    : []),
                ].map(([franja, et, v, color, sub]: any) => (
                  <div key={et} style={{ ...tarjeta(franja), flex: 1, minWidth: 140, padding: '9px 12px' }}><span style={etiqueta}>{et}</span><div style={{ fontSize: 17, fontWeight: 800, color }}>{v}</div><div style={{ fontSize: 10.5, color: C.g500 }}>{sub}</div></div>
                ))}
              </div>
            )}
            {actual ? (
              <div style={{ ...tarjeta(colorEstado), padding: '16px 18px', position: 'relative',
                ...(recienAbierto ? { boxShadow: '0 0 0 3px #4FBF95', transition: 'box-shadow .15s' } : null) }}>
                {recienAbierto && (
                  <div style={{ position: 'absolute', top: -13, left: 16, background: '#1E8A63', color: '#fff', borderRadius: 999, padding: '3px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '.02em' }}>
                    Ya te oyen — habla
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className={['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) ? 'wa-pulso' : undefined} style={{ width: 10, height: 10, borderRadius: 999, background: colorEstado, flexShrink: 0 }} />
                  {/* EL MEDIDOR DE TU PROPIA VOZ, en la línea que sí se mira.
                      Si no se mueve mientras hablas, estás mudo — y esa es la
                      comprobación que ningún aviso sustituye. Vivía en el
                      widget chico de la esquina, que es justo donde no miras
                      cuando estás hablando. */}
                  {estadoActual === 'en_linea' && (
                    <span title={micAbierto ? 'Así te están oyendo' : 'Tu micrófono está cerrado'} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14, flexShrink: 0 }}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <span key={i} style={{ width: 3, borderRadius: 2, height: 4 + i * 2.5,
                          background: micAbierto && nivelVoz * 5 > i ? '#1E8A63' : '#dcdce2', transition: 'background .08s' }} />
                      ))}
                    </span>
                  )}
                  <b style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: estadoActual === 'en_linea' ? '#1E8A63' : '#4B5563' }}>
                    {/* ══ QUÉ ESTÁ PASANDO, DICHO ENTERO ══════════════════
                        Pedido del dueño (17-sep-2026): «en vez de que diga
                        micrófono mudo, pon en el centro qué está pasando: que
                        diga marcando, cuántas veces ya marcó, cuando entre a
                        buzón que lo diga, y de ahí lo que va a pasar después —
                        pero todo automático, sin que yo haga clics».

                        Antes decía sólo «TIMBRANDO» y el resto había que
                        deducirlo de la lista de la derecha. Ahora la misma
                        línea lleva el intento y, cuando cae en buzón, lo dice
                        con todas sus letras y anuncia el salto: la certeza de
                        que la máquina sigue sola es lo que deja al vendedor
                        mirar en vez de vigilar. */}
                    {ETIQUETA_ITEM[estadoActual] || estadoActual}
                    {['marcando', 'timbrando'].includes(estadoActual) && actual.intentos > 1 ? ` · intento ${actual.intentos}` : ''}
                    {estadoActual === 'en_linea' && actual.segundos_en_linea > 0 ? ` · ${fmt(actual.segundos_en_linea)}` : ''}
                    {estadoActual === 'cierre' && (
                      esperaTuDecision ? ' · te toca decidir'
                      : sesion.config?.auto_continuar !== false && segCierre !== null
                        ? (enviosAbiertos.length ? ' · esperando tu respuesta' : !actual.cierre_estado || actual.cierre_estado === 'proponiendo' ? ' · la IA está cerrando' : ` · siguiente en ${segCierre} s`)
                        : '')}
                  </b>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: C.g400 }}>{actual.orden + 1} de {sesion.total}{est?.pendientes ? ` · ${est.pendientes} por marcar` : ''}</span>
                </div>

                {/* CAYÓ EN BUZÓN: se dice, y se dice qué sigue. El salto ya era
                    automático —lo hace el servidor— pero en pantalla no se veía
                    nada y parecía que se había atorado. Un proceso que avanza
                    solo sin decirlo se siente igual que uno roto. */}
                {/* ══ «QUIERO OÍR QUÉ PASA» ════════════════════════════════
                    Pedido del dueño: «otra opción que con un clic puedas
                    escuchar la parte si timbra o qué está pasando, para que
                    sepas cómo manejarlo».

                    Y resulta que YA SE PUEDE: estando en la sala oyes la
                    llamada entera —el tono, el buzón, el «bueno»— sin que te
                    oigan. Lo que faltaba no era la función, era decirlo: la
                    etiqueta vivía arriba a la derecha, lejos de donde miras
                    mientras marca, y nadie relaciona «En la sala, mudo» con
                    «esto que oigo es esta llamada». Se dice aquí, en la línea
                    de lo que está pasando, y si NO estás dentro se ofrece
                    entrar de un clic en vez de explicarlo. */}
                {['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && (
                  <div style={{ fontSize: 12, color: enSala ? '#1E8A63' : C.moradoTinta, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {enSala ? 'Lo estás oyendo en vivo — te oyen sólo si abres el micrófono.' : (
                      <>
                        <span>No estás en la sala: no oyes lo que pasa.</span>
                        <button onClick={entrarSala} style={{ ...btnT, padding: '4px 10px' }}>Entrar a escuchar</button>
                      </>
                    )}
                  </div>
                )}

                {/* EL BUZÓN SE CUENTA SOLO. «No hay nada que hacer»: se le
                    avisa por WhatsApp y se sigue. Lo que cambia es que ahora se
                    VE en qué va ese aviso, sin abrir la conversación. */}
                {actual.veredicto === 'buzon' && (
                  <div style={{ background: '#FFF4E5', border: '1px solid #f3d9a4', color: '#9a6a10', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
                    Cayó en el buzón{actual.veredicto_fuente ? ` (${actual.veredicto_fuente})` : ''}.
                    {sesion.buzon_dejar_mensaje ? ' Se le está dejando el mensaje y' : ''} pasamos solos al siguiente — no tienes que tocar nada.
                    {String(actual.nota || '').startsWith('Buzón') && (
                      <div style={{ fontWeight: 600, marginTop: 4, color: /enviado/.test(String(actual.nota)) ? '#1E8A63' : '#9a6a10' }}>
                        {/enviado/.test(String(actual.nota)) ? '✓ ' : '⏳ '}{String(actual.nota).replace(/^Buzón · /, '')}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 999, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcoUsuario size={22} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', color: C.g900 }}>{actual.nombre || 'Sin nombre'}</div>
                    <div style={{ fontSize: 12.5, color: C.g500 }}>{[actual.empresa, telefonoLegible(actual.telefono), actual.hora_local ? `allá son las ${actual.hora_local}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {actual.conversation_id && onAbrirConversacion && <button onClick={() => onAbrirConversacion(actual.conversation_id)} style={btnT}>Ver chat</button>}
                </div>

                {/* ══ ¿Y ESTO MORADO QUÉ ES? (18-sep-2026) ════════════════════
                    Lo preguntó el dueño viendo la tarjeta de Gabriela, y la
                    pregunta ES el defecto: era una frase suelta en morado, sin
                    rótulo, en medio de la ficha. Es tu primera frase —la que se
                    arma con el nombre y el motivo que pusiste al crear la
                    sesión— y hay que reconocerla de un vistazo mientras el otro
                    ya está diciendo «bueno». Dos palabras encima lo resuelven. */}
                {actual.apertura && ['escuchando', 'portero', 'en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 12, background: C.moradoSuave, borderRadius: 9, padding: '9px 12px' }}>
                    <div style={{ ...etiqueta, color: C.morado, marginBottom: 3 }}>Lo que dices al contestar</div>
                    <div style={{ fontSize: 13.5, color: C.moradoTinta, fontWeight: 600 }}>{actual.apertura}</div>
                  </div>
                )}
                {actual.resumen && (
                  <div style={{ marginTop: 10 }}>
                    <span style={etiqueta}>Lo que hay que saber</span>
                    <div style={{ fontSize: 12.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{actual.resumen}</div>
                  </div>
                )}
                {actual.oido_texto && !fernanda && !['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.g500, fontStyle: 'italic' }}>Se oye: «{String(actual.oido_texto).slice(-160)}»</div>
                )}
                {fernanda && ['escuchando', 'portero', 'en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 12 }}>
                    <span style={etiqueta}>La llamada, en vivo</span>
                    <div className="wa-scroll" style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 5, fontSize: 12.5, lineHeight: 1.5 }}>
                      {actual.dialogo
                        ? String(actual.dialogo).split('\n').map((l: string, i: number) => {
                            const mia = l.startsWith('Vendedor:');
                            return <div key={i} style={{ justifySelf: mia ? 'end' : 'start', maxWidth: '88%', background: mia ? C.moradoAgua : '#fff', border: mia ? 'none' : `1px solid ${C.g200}`, color: mia ? C.moradoTinta : C.g700, borderRadius: 10, padding: '6px 10px' }}>{l.replace(/^(Vendedor|Cliente):\s*/, '')}</div>;
                          })
                        : <div style={{ fontSize: 12, color: C.g400, fontStyle: 'italic' }}>{estadoActual === 'en_linea' || estadoActual === 'cierre' ? 'Sin transcripción todavía.' : 'Fernanda está escuchando quién contesta…'}</div>}
                    </div>
                  </div>
                )}
                {actual.veredicto && ['en_linea', 'cierre'].includes(estadoActual) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: C.g400 }}>Contestó {actual.veredicto === 'persona' ? 'una persona' : actual.veredicto} · lo dijo {actual.veredicto_fuente === 'reglas' ? 'la voz' : actual.veredicto_fuente}{actual.veredicto_ms ? ` a los ${(actual.veredicto_ms / 1000).toFixed(1)} s` : ''}</div>
                )}

                {/* Acciones del item según su momento */}
                {/* ══ ¿ESTOY AL AIRE? ══════════════════════════════════════
                    Reporte del dueño: «la pantalla debe ser más clara, mostrarme
                    un punto verde o algo que muestre que está activo». Antes la
                    única pista de que el micrófono estaba abierto era el texto
                    del botón de silenciar —al final de una fila de botones—, así
                    que se hablaba sin saber si salía o no.
                    Dos estados y nada más: verde con punto latiendo = te oyen;
                    gris = no. Es la primera cosa que hay que poder contestar sin
                    leer. */}
                {['escuchando', 'portero', 'en_linea'].includes(estadoActual) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginTop: 14,
                    padding: '9px 13px', borderRadius: 10,
                    background: micAbierto ? '#EAF8F2' : C.g50,
                    border: `1px solid ${micAbierto ? '#9fdcc2' : C.g200}`,
                  }}>
                    <span style={{
                      width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
                      background: micAbierto ? '#1E8A63' : C.g400,
                      animation: micAbierto ? 'cab-late 1.25s ease-in-out infinite' : undefined,
                    }} />
                    <b style={{ fontSize: 13, color: micAbierto ? '#1E8A63' : C.g500, letterSpacing: '-0.01em' }}>
                      {micAbierto ? 'Estás al aire — te escuchan' : 'Micrófono cerrado — no te escuchan'}
                    </b>
                    {micAbierto && estadoActual !== 'en_linea' && (
                      <span style={{ fontSize: 11, color: '#1E8A63', opacity: .8 }}>· tu micrófono se abrió solo al contestar</span>
                    )}
                  </div>
                )}
                <style>{`@keyframes cab-late{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}@keyframes cab-gira{to{transform:rotate(360deg)}}`}</style>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {['marcando', 'timbrando', 'escuchando', 'portero'].includes(estadoActual) && !sola && (
                    <>
                      <button onClick={() => accion('tomar')} disabled={!!ocupado} style={btnS}>{ocupado === 'tomar' ? <><Cargador chico />Abriendo el micrófono…</> : <><IcoMic size={13} />Hablar yo</>}</button>
                      <button onClick={() => accion('saltar')} disabled={!!ocupado} style={btnT}>{ocupado === 'saltar' ? <><Cargador chico />Saltando…</> : 'Saltar'}</button>
                    </>
                  )}
                  {estadoActual === 'en_linea' && (
                    <>
                      {fernanda && !sola && enSala && !actual.voz?.handoff && <button onClick={() => accion('tomar')} disabled={!!ocupado} style={S.btnP}><IcoMic size={13} />Tomar la llamada</button>}
                      <button onClick={() => accion('colgar')} disabled={!!ocupado} style={{ ...btnD, background: '#C0554E', color: '#fff', border: 'none', opacity: ocupado === 'colgar' ? .85 : 1 }}>
                        {ocupado === 'colgar' ? <><Cargador chico />Colgando…</> : 'Colgar'}
                      </button>
                      {(!fernanda || actual.voz?.handoff) && <button onClick={() => document.dispatchEvent(new CustomEvent('tel-mute', { detail: { mute: micAbierto } }))} style={btnT}>{micAbierto ? 'Silenciarme' : 'Abrir micrófono'}</button>}
                    </>
                  )}
                  {/* Cuando te toca decidir, el botón NO va aquí arriba: va al
                      final, después de lo que la IA propone. Confirmar algo que
                      todavía no leíste es exactamente lo que se quería evitar. */}
                  {estadoActual === 'cierre' && !esperaTuDecision && (
                    <button onClick={confirmarYSeguir} disabled={!!ocupado} style={propuesta ? S.btnP : btnS}>
                      {propuesta ? 'Confirmar lo de la IA y seguir' : 'Siguiente ahora'}
                    </button>
                  )}
                </div>

                {/* ══ MIENTRAS HABLAS: lo mínimo, para no estorbar ══════════
                    Los chips y el apunte sirven DURANTE la llamada (se pica al
                    vuelo). Todo lo demás —etapa, seguimiento, solicitudes— se
                    decide al colgar, y vive abajo en colapsables. */}
                {estadoActual === 'en_linea' && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    <span style={etiqueta}>Cómo quedó</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {chipRes('contesto', 'Hablamos')}
                      {chipRes('volver_llamar', 'Volver a llamar')}
                      {chipRes('dieron_datos', 'Dio datos')}
                      {chipRes('no_interesa', 'No le interesa')}
                      {chipRes('buzon', 'Era buzón')}
                    </div>
                    <textarea value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota} placeholder="Apunte de la llamada (se guarda en la conversación)" rows={2} style={{ ...campo, resize: 'vertical' }} />
                  </div>
                )}

                {bloqueLineas}

                {/* ══ DESHACER, DOS MINUTOS ═════════════════════════════════
                    Confirmaste y el siguiente ya está timbrando: ir a cancelar
                    una cita a mano en ese momento no pasa. Aquí sí. */}
                {deshacer && Date.now() < deshacer.hasta && !deshecho && (
                  <div style={{ marginTop: 12, background: '#FFF4E5', border: '1px solid #f3d9a4', borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: '#9a6a10', fontWeight: 700, flex: 1, minWidth: 180 }}>Se aplicó el cierre de la llamada anterior.</span>
                    <button onClick={deshacerCierre} disabled={!!ocupado} style={{ ...btnT, padding: '5px 11px', fontSize: 12 }}>Deshacer</button>
                  </div>
                )}
                {deshecho && (
                  <div style={{ marginTop: 12, background: '#EAF8F2', border: '1px solid #9fdcc2', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#1E8A63', lineHeight: 1.6 }}>
                    {deshecho.length ? deshecho.map((d, i) => <div key={i}>✓ {d}</div>) : <div>No había nada que deshacer.</div>}
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    AL COLGAR: LA PANTALLA DE DECIDIR (18-sep-2026)

                    Rediseñada entera con lo que pidió el dueño, y el principio
                    que lo ordena todo es suyo: «dando prioridad a la
                    información que la IA ya obtuvo, para que sea más rápido el
                    proceso».

                     1. Lo que la IA entendió va ARRIBA y primero. Si entendió,
                        el 90% de las veces basta con confirmar.
                     2. Lo demás son COLAPSABLES cerrados: «¿Cómo quedó?»,
                        «Etapa», «Seguimiento», «Solicitudes extras». Cada uno
                        enseña en el título lo que ya está decidido, así que se
                        abre sólo lo que se quiere cambiar. Antes eran cuatro
                        bloques abiertos, dos campos de texto y tres avisos de
                        colores compitiendo por la misma mirada.
                     3. Los avisos de «no quedó ninguna cita» y «la IA no
                        alcanzó a leer» se fueron: el primero al final de la
                        sesión, el segundo a la basura. Si la IA no entendió, no
                        hay nada que explicar — se decide y ya.
                     4. Y abajo, en grande, la única salida: pasar a la
                        siguiente. */}
                {esperaTuDecision && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    {actual.cierre_estado === 'proponiendo' && <Cargando texto="Leyendo la llamada…" alto={48} />}

                    {/* 1 · LO QUE LA IA ENTENDIÓ — primero, porque es lo que
                           permite cerrar en un clic. */}
                    {propuesta && (
                      <div style={{ background: C.moradoAgua, borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={etiqueta}>La IA entendió · no ha hecho nada todavía</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: tono(propuesta.resultado).bg, color: tono(propuesta.resultado).fg }}>{ETIQUETA_RESULTADO[propuesta.resultado] || propuesta.resultado}</span>
                        </div>
                        {propuesta.nota && <div style={{ fontSize: 12.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{propuesta.nota}</div>}
                        {propuesta.siguiente_paso && <div style={{ fontSize: 12.5, color: C.moradoTinta, fontWeight: 700 }}>Siguiente paso: {propuesta.siguiente_paso}</div>}
                        {(propuesta.compromisos?.length > 0 || propuesta.datos?.length > 0 || propuesta.envios?.length > 0 || propuesta.etapa) && (
                          <div style={{ display: 'grid', gap: 4, fontSize: 12, color: C.g700 }}>
                            <span style={{ ...etiqueta, marginBottom: 0 }}>Al seguir se deja hecho</span>
                            {(propuesta.compromisos || []).map((cp: any, i: number) => (
                              <div key={`c${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span>· {cp.tipo === 'reunion' ? `Reunión (${cp.reunion_tipo})` : 'Llamada'}{cp.motivo ? `: ${cp.motivo}` : ''} →</span>
                                <input type="date" value={editando[i]?.fecha ?? cp.fecha} min={new Date().toISOString().slice(0, 10)}
                                  onChange={e => setEditando(v => ({ ...v, [i]: { fecha: e.target.value, hora: v[i]?.hora ?? cp.hora } }))}
                                  style={{ ...campo, width: 140, padding: '4px 7px', fontSize: 12 }} />
                                <input type="time" value={editando[i]?.hora ?? cp.hora}
                                  onChange={e => setEditando(v => ({ ...v, [i]: { fecha: v[i]?.fecha ?? cp.fecha, hora: e.target.value } }))}
                                  style={{ ...campo, width: 110, padding: '4px 7px', fontSize: 12 }} />
                                {editando[i] && (editando[i].fecha !== cp.fecha || editando[i].hora !== cp.hora) && (
                                  <button disabled={!!ocupado} onClick={() => { editarCierre({ compromisos: [{ i, ...editando[i] }] }); setEditando(v => { const n = { ...v }; delete n[i]; return n; }); }}
                                    style={{ ...btnS, padding: '4px 9px', fontSize: 11.5 }}>Cambiar la hora</button>
                                )}
                                <button disabled={!!ocupado} onClick={() => editarCierre({ compromisos: [{ i, quitar: true }] })}
                                  style={{ ...btnT, padding: '3px 8px', fontSize: 11, color: '#C0554E' }}>Quitar</button>
                              </div>
                            ))}
                            {(propuesta.datos || []).map((d: any, i: number) => (
                              <div key={`d${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>· {d.corrige ? 'Corregir' : 'Llenar'} <b>{d.campo}</b>: {String(d.valor)}</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ quitar_datos: [i] })}
                                  style={{ ...btnT, padding: '2px 7px', fontSize: 10.5, color: '#C0554E' }}>No</button>
                              </div>
                            ))}
                            {propuesta.etapa === 'lead_calificado' && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>· Pasa a lead calificado</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ etapa: null })} style={{ ...btnT, padding: '2px 7px', fontSize: 10.5, color: '#C0554E' }}>No</button>
                              </div>
                            )}
                            {propuesta.etapa === 'descalificado' && (
                              <div style={{ color: '#C0554E', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>· Se descalifica, sale de la cadencia del agente y de todas las secuencias</span>
                                <button disabled={!!ocupado} onClick={() => editarCierre({ etapa: null })} style={{ ...btnT, padding: '2px 7px', fontSize: 10.5 }}>No lo bajes</button>
                              </div>
                            )}
                            {(propuesta.envios || []).filter((e: any) => e.estado !== 'falta').map((e: any) => (
                              <div key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span>· Mandarle <b>{e.tema}</b> en PDF por WhatsApp{e.estado === 'enviado' ? ' — ya salió' : e.estado === 'pendiente_ventana' ? ' — sale cuando conteste' : e.estado === 'omitido' ? ' — no' : e.estado === 'sin_via' || e.estado === 'fallo' ? ' — quedó como tarea' : ''}</span>
                                {['listo', 'pendiente_ventana'].includes(String(e.estado)) && (
                                  <button disabled={!!ocupado} onClick={() => editarCierre({ quitar_envios: [e.id] })} style={{ ...btnT, padding: '2px 7px', fontSize: 10.5, color: '#C0554E' }}>No mandarlo</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {enviosAbiertos.map((e: any) => (
                          <div key={e.id} style={{ background: '#fff', border: '1px solid #f3d9a4', borderRadius: 9, padding: '10px 12px', display: 'grid', gap: 6 }}>
                            <b style={{ fontSize: 12.5, color: '#9a6a10' }}>Quedaste de mandarle {e.tema}. ¿Qué le mandamos?</b>
                            {e.detalle && <span style={{ fontSize: 11.5, color: C.g500 }}>Pidió: {e.detalle}</span>}
                            <textarea value={respuestas[e.id] || ''} onChange={ev => setRespuestas(r => ({ ...r, [e.id]: ev.target.value }))} rows={3} placeholder="Escribe el contenido: se arma en PDF con la marca, se le manda por WhatsApp y queda guardado para la próxima vez que alguien pida lo mismo." style={{ ...campo, resize: 'vertical' }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => responderEnvio(e.id)} disabled={!!ocupado} style={S.btnP}>Mandar en PDF</button>
                              <button onClick={() => accion('cierre_omitir', { envio: e.id })} disabled={!!ocupado} style={btnT}>No mandar</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: C.g400, flex: 1, minWidth: 160 }}>Lo que piques abajo manda sobre lo que entendió la IA.</span>
                          <button disabled={!!ocupado} onClick={descartarPropuesta} style={{ ...btnT, padding: '4px 10px', fontSize: 11.5, color: '#C0554E' }}>No fue eso: descartar</button>
                        </div>
                      </div>
                    )}

                    {/* 2 · LOS COLAPSABLES. Cerrados, con lo decidido en el
                           título: se abre sólo lo que se quiere cambiar. */}
                    <Colapsable titulo="¿Cómo quedó?" resumen={ETIQUETA_RESULTADO[actual.resultado] || (propuesta ? `la IA dice: ${ETIQUETA_RESULTADO[propuesta.resultado] || propuesta.resultado}` : 'sin decidir')}
                      alerta={!actual.resultado && !propuesta} abiertoDefecto={!actual.resultado && !propuesta}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {chipRes('contesto', 'Hablamos')}
                        {chipRes('volver_llamar', 'Volver a llamar')}
                        {chipRes('dieron_datos', 'Dio datos')}
                        {chipRes('no_interesa', 'No le interesa')}
                        {chipRes('buzon', 'Era buzón')}
                      </div>
                      <textarea value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota} placeholder="Apunte de la llamada (se guarda en la conversación)" rows={2} style={{ ...campo, resize: 'vertical', marginTop: 8 }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setVerDicho(v => !v)} style={{ ...btnT, padding: '4px 10px', fontSize: 11.5 }}>{verDicho ? 'Ocultar lo que se dijo' : 'Ver lo que se dijo'}</button>
                        {!audio && <button onClick={pedirGrabacion} disabled={!!ocupado} style={{ ...btnT, padding: '4px 10px', fontSize: 11.5 }}>Oír la llamada</button>}
                        {audio && <audio controls src={audio} style={{ height: 30, maxWidth: 240 }} />}
                      </div>
                      {verDicho && String(actual.dialogo || '').trim() && (
                        <div className="wa-scroll" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 5, fontSize: 12.5, lineHeight: 1.5 }}>
                          {String(actual.dialogo).split('\n').map((l: string, i: number) => {
                            const mia = l.startsWith('Vendedor:');
                            return <div key={i} style={{ justifySelf: mia ? 'end' : 'start', maxWidth: '88%', background: mia ? C.moradoAgua : '#fff', border: mia ? 'none' : `1px solid ${C.g200}`, color: mia ? C.moradoTinta : C.g700, borderRadius: 10, padding: '6px 10px' }}>{l.replace(/^(Vendedor|Cliente):\s*/, '')}</div>;
                          })}
                        </div>
                      )}
                    </Colapsable>

                    {actual.contact_id && (
                      <Colapsable titulo="En qué etapa queda" resumen={ETAPAS_CIERRE.find(x => x.id === etapaTocada)?.l || (propuesta?.etapa ? `la IA dice: ${propuesta.etapa.replace(/_/g, ' ')}` : 'se queda como está')}>
                        <select value={etapaTocada || ''} disabled={!!ocupado}
                          onChange={async e => {
                            const v = e.target.value; if (!v) return;
                            setEtapaTocada(v); setOcupado('etapa');
                            const r = await fetch('/api/crm/whatsapp/etapa', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accion: 'etapa', contact_id: actual.contact_id, etapa: v }),
                            }).then(x => x.json()).catch(() => ({ error: 'No se pudo' }));
                            setOcupado('');
                            if (r?.error) { setError(r.error); setEtapaTocada(''); return; }
                          }}
                          style={{ ...campo, cursor: 'pointer' }}>
                          <option value="">Déjala como está</option>
                          {ETAPAS_CIERRE.map(e => <option key={e.id} value={e.id}>{e.l}</option>)}
                        </select>
                        {etapaTocada && <span style={{ fontSize: 11.5, color: '#1E8A63', fontWeight: 700 }}>Listo: quedó en «{ETAPAS_CIERRE.find(x => x.id === etapaTocada)?.l}».</span>}
                      </Colapsable>
                    )}

                    {/* SEGUIMIENTO · las cinco salidas que de verdad existen
                        después de una llamada, dichas como se dicen en voz
                        alta. Pedido del dueño (18-sep): demo, discovery, meter
                        otra llamada a la cola en 5/10/15 minutos, y no llamarle
                        más sacándolo de la lista. */}
                    <Colapsable titulo="Seguimiento" resumen={(propuesta?.compromisos || []).length ? 'la IA ya puso una fecha' : 'qué sigue con esta persona'}
                      abiertoDefecto={!propuesta}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div>
                          <span style={{ ...etiqueta, marginBottom: 4 }}>Volver a marcarle</span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => volverA(5 / 60)} disabled={!!ocupado} style={btnS}>En 5 min</button>
                            <button onClick={() => volverA(10 / 60)} disabled={!!ocupado} style={btnS}>10 min</button>
                            <button onClick={() => volverA(15 / 60)} disabled={!!ocupado} style={btnS}>15 min</button>
                            <button onClick={() => volverA(1)} disabled={!!ocupado} style={btnS}>1 h</button>
                            <button onClick={() => volverA(null, 'manana')} disabled={!!ocupado} style={btnS}>Mañana 10:00</button>
                            <button onClick={() => volverA(null, 'lunes')} disabled={!!ocupado} style={btnS}>El lunes</button>
                          </div>
                        </div>
                        <div>
                          <span style={{ ...etiqueta, marginBottom: 4 }}>Agendar reunión</span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <label style={{ fontSize: 10.5, color: C.g400, fontWeight: 700 }}>
                              <span style={{ display: 'block', marginBottom: 2 }}>Día</span>
                              <input type="date" value={cuando.fecha} min={new Date().toISOString().slice(0, 10)}
                                onChange={e => setCuando(c => ({ ...c, fecha: e.target.value }))} style={{ ...campo, width: 148 }} />
                            </label>
                            <label style={{ fontSize: 10.5, color: C.g400, fontWeight: 700 }}>
                              <span style={{ display: 'block', marginBottom: 2 }}>Hora</span>
                              <input type="time" value={cuando.hora} onChange={e => setCuando(c => ({ ...c, hora: e.target.value }))} style={{ ...campo, width: 118 }} />
                            </label>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('agendar_demo', { ...cuando, reunion_tipo: 'demo' })}
                              style={{ ...btnS, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Demo</button>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('agendar_demo', { ...cuando, reunion_tipo: 'llamada-discovery' })}
                              style={{ ...btnS, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Discovery</button>
                            <button disabled={!!ocupado || !cuando.fecha || !cuando.hora} onClick={() => rapida('volver_a_llamar', cuando)}
                              style={{ ...btnT, opacity: cuando.fecha && cuando.hora ? 1 : .5 }}>Sólo llamarle</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => rapida('mandar_info')} disabled={!!ocupado} style={btnS}>Mandarle la info</button>
                          <button onClick={() => rapida('soporte')} disabled={!!ocupado} style={btnS}>Es cliente: soporte</button>
                          {/* Sale de la lista Y no se le vuelve a llamar: las dos
                              cosas juntas, porque quien dice «no me llamen» no
                              quiere que mañana le marque otra jornada. */}
                          <button onClick={async () => { if (await confirmar('¿Sacarlo de la lista y no volver a llamarle nunca?')) { await rapida('no_llamar'); await accion('excluir', { item: actual.id }); } }}
                            disabled={!!ocupado} style={{ ...btnT, color: '#C0554E', borderColor: '#f0c4bd' }}>No llamarle más</button>
                        </div>
                      </div>
                    </Colapsable>

                    <Colapsable titulo="Solicitudes extras · lo que la IA no leyó"
                      resumen={`${((est?.acciones_abiertas ?? 0) || 0) > 0 ? `${est.acciones_abiertas} sin hacer` : 'agrega lo que te pidió'}`}>
                      {actual.call_sid && <AccionesLlamada callId={actual.call_sid} compacto fraseCliente={String(actual.oido_texto || '').slice(-200) || null} />}
                    </Colapsable>

                    {/* 3 · LA SALIDA, EN GRANDE */}
                    <button onClick={confirmarYSeguir} disabled={!!ocupado}
                      style={{ ...S.btnP, width: '100%', padding: '13px 18px', fontSize: 14.5, fontWeight: 800, justifyContent: 'center', opacity: ocupado ? .85 : 1 }}>
                      {ocupado ? <><Cargador />{ocupado === 'cierre' ? 'Aplicando lo que decidiste…' : 'Marcando al siguiente…'}</> : (propuesta ? 'Confirmar y pasar a la siguiente' : 'Ya decidí · pasar a la siguiente')}
                    </button>
                    {est?.siguiente_item && (
                      <div style={{ fontSize: 11.5, color: C.g500, textAlign: 'center' }}>
                        Sigue <b style={{ color: C.g700 }}>{est.siguiente_item.nombre || telefonoLegible(est.siguiente_item.telefono)}</b>
                        {est.siguiente_item.empresa ? ` · ${est.siguiente_item.empresa}` : ''} · teclas 1-5 y Enter
                      </div>
                    )}
                  </div>
                )}

                {/* Con Fernanda sola no hay nadie decidiendo: el cierre se
                    aplica solo y aquí sólo se enseña lo que hizo. */}
                {estadoActual === 'cierre' && !esperaTuDecision && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={confirmarYSeguir} disabled={!!ocupado} style={propuesta ? S.btnP : btnS}>
                      {propuesta ? 'Confirmar lo de la IA y seguir' : 'Siguiente ahora'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...tarjeta('#9B8CFA'), textAlign: 'center', padding: '28px 18px' }}>
                {pausada ? <div style={{ fontSize: 14, color: '#4B5563' }}>En pausa. {est?.pendientes || 0} por marcar.</div>
                  : (est?.vivos || []).length > 0 ? <div style={{ textAlign: 'left' }}>{bloqueLineas}</div>
                  : enSala ? <><Cargando texto={est?.pendientes ? 'Marcando al siguiente…' : 'Cerrando la lista…'} alto={80} /></>
                  : <div style={{ fontSize: 14, color: '#4B5563' }}>Entra a la sala para que la central empiece a marcar.</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!pausada
                ? <button onClick={() => accion('pausar')} disabled={!!ocupado} style={btnT}><IcoReloj size={13} />Pausar</button>
                : null}
              <span style={{ flex: 1 }} />
              <button onClick={terminar} disabled={!!ocupado} style={btnD}>Terminar la sesión</button>
            </div>
          </div>
        </div>

        {/* Derecha: la lista con su estado */}
        <div className="wa-scroll" style={{ width: movil ? '100%' : 340, flexShrink: 0, borderLeft: movil ? 'none' : `1px solid ${C.g200}`, borderTop: movil ? `1px solid ${C.g200}` : 'none', background: '#fff', overflowY: 'auto', maxHeight: movil ? 260 : 'none' }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.g200}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            {(['lista', 'hechas', 'compromisos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 10px', fontSize: 12.5,
                background: tab === t ? C.moradoAgua : 'transparent', color: tab === t ? C.moradoTinta : '#4B5563', fontWeight: tab === t ? 800 : 500,
                borderBottom: tab === t ? '2px solid #9B8CFA' : '2px solid transparent',
              }}>{t === 'lista' ? `Por marcar (${pendientes.length})` : t === 'hechas' ? `Hechas (${hechos.length})` : `Compromisos${compromisos.length ? ` (${compromisos.length})` : ''}`}</button>
            ))}
          </div>
          {tab !== 'compromisos' && (tab === 'lista' ? items.filter(i => !['hecho', 'saltado', 'excluido'].includes(i.estado)) : hechos).map(i => filaItem(i, tab === 'lista', true))}
          {tab === 'hechas' && hechos.length === 0 && <div style={{ padding: 18, fontSize: 12, color: C.g400 }}>Aún no hay llamadas hechas.</div>}

          {/* ══ COMPROMISOS ══════════════════════════════════════════════════
              Lo que prometiste al hablar, en un solo sitio y en orden de cuándo
              toca: las reuniones que se agendaron y las llamadas de vuelta.
              Con la fecha y la hora grandes —es lo que se viene a buscar— y
              diciendo si YA está en Google Calendar, que es la diferencia entre
              una cita que le va a sonar al cliente y una que sólo existe aquí. */}
          {tab === 'compromisos' && compromisos.length === 0 && (
            <div style={{ padding: 18, fontSize: 12, color: C.g400 }}>Todavía no hay compromisos. Aparecen aquí en cuanto quedas de algo en una llamada.</div>
          )}
          {tab === 'compromisos' && compromisos.map((c: any) => {
            const cuando = new Date(`${c.fecha}T${c.hora || '10:00'}:00`);
            /* Hoy y mañana EN LA HORA DEL CENTRO. Con `toISOString` (que es
               UTC) toda la tarde mexicana ya es «mañana» en Greenwich, y la
               etiqueta mentía justo en las horas en que más se llama. */
            const enCdmx = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
            const hoy = enCdmx(new Date());
            const dia = c.fecha === hoy ? 'hoy'
              : c.fecha === enCdmx(new Date(Date.now() + 86400e3)) ? 'mañana'
              : cuando.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
            const paso = c.fecha < hoy;
            return (
              <div key={`${c.tipo}-${c.id}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderBottom: `1px solid ${C.g100}`, opacity: paso ? .6 : 1 }}>
                <span style={{
                  flexShrink: 0, width: 62, textAlign: 'center', borderRadius: 10, padding: '6px 4px',
                  background: c.tipo === 'reunion' ? C.moradoAgua : '#FFF4E5', color: c.tipo === 'reunion' ? C.moradoTinta : '#9a6a10',
                }}>
                  <b style={{ display: 'block', fontSize: 14, lineHeight: 1.1 }}>{c.hora}</b>
                  <span style={{ fontSize: 10.5, fontWeight: 700 }}>{dia}</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.g900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nombre || telefonoLegible(c.telefono)}{c.empresa ? <span style={{ fontWeight: 400, color: C.g500 }}> · {c.empresa}</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.g500 }}>{c.titulo}{c.motivo ? ` · ${c.motivo}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                    {c.tipo === 'reunion' ? (
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: c.en_google ? '#EAF8F2' : '#FFF4E5', color: c.en_google ? '#1E8A63' : '#9a6a10' }}>
                        {c.en_google ? 'En Google Calendar' : 'No está en Google Calendar'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: C.moradoAgua, color: C.moradoTinta }}>La marca sola a esa hora</span>
                    )}
                    {c.meet && <a href={c.meet} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.moradoTinta, fontWeight: 700 }}>Meet</a>}
                    {paso && <span style={{ fontSize: 10.5, color: '#C0554E', fontWeight: 700 }}>ya pasó</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ══ NINGÚN BOTÓN SE QUEDA MUDO ══════════════════════════════════════════════
   Pedido del dueño (18-sep-2026): «al darle clic en colgar que me muestre un
   loader o algo, que se quede como trabajando y de ahí haga la acción; siempre
   el botón debe tener interacción».

   Y es más que estética: colgar, confirmar el cierre o agendar tardan entre
   medio segundo y tres —van a Twilio, a Google, a Meta—. Un botón que no cambia
   en ese rato se lee como que no registró el clic, y la reacción natural es
   volver a picarle: dos cierres, dos citas, dos WhatsApps. El spinner no es
   adorno, es lo que evita el doble clic.

   `minimo` existe porque una respuesta instantánea tampoco se ve: el estado de
   «trabajando» se sostiene 600 ms aunque el servidor conteste antes. */
function Cargador({ chico }: { chico?: boolean }) {
  const d = chico ? 11 : 13;
  return (
    <span aria-hidden style={{
      width: d, height: d, borderRadius: 999, flexShrink: 0, display: 'inline-block',
      border: '2px solid currentColor', borderTopColor: 'transparent', opacity: .85,
      animation: 'cab-gira .7s linear infinite',
    }} />
  );
}

/* ══ UN COLAPSABLE QUE DICE LO QUE ESCONDE ═══════════════════════════════════
   Pedido del dueño (18-sep-2026): «en vez de tantos botones y tantos campos
   abiertos… un título "¿Cómo quedó?" y, al darle clic, ya yo decido».

   La diferencia con un acordeón cualquiera está en `resumen`: el título dice lo
   que YA está decidido («Hablamos», «la IA dice: volver a llamar»), así que se
   abre sólo lo que se quiere cambiar. Un colapsable que no dice qué hay dentro
   obliga a abrirlos todos, y entonces no sirvió de nada. */
function Colapsable({ titulo, resumen, alerta, abiertoDefecto, children }: { titulo: string; resumen?: string; alerta?: boolean; abiertoDefecto?: boolean; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(!!abiertoDefecto);
  return (
    <div style={{ border: `1px solid ${alerta && !abierto ? '#f0c4bd' : C.g200}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(a => !a)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ fontSize: 11, color: C.g400, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
        <b style={{ fontSize: 12.5, color: C.g900 }}>{titulo}</b>
        <span style={{ flex: 1 }} />
        {resumen && <span style={{ fontSize: 11.5, color: alerta ? '#C0554E' : C.g500, fontWeight: alerta ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{resumen}</span>}
      </button>
      {abierto && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
}
