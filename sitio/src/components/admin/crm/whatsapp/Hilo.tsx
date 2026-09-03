// WHATSAPP · El hilo PRO (portado de sacs_inbox): burbujas emerald/blancas
// con cola, separadores de día y de conversación-resuelta, estados ✓✓ con
// tooltip de error en español, player de audio propio, lightbox, linkify,
// reacciones como chips y búsqueda en el hilo tipo Cmd+F.
import { useEffect, useMemo, useRef, useState } from 'react';
import AccionesVenta from './AccionesVenta';
import { leerBorrador, guardarBorrador } from '../../../../lib/crm/borradores';
import { EsqueletoChat } from './Esqueletos';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe, useLifecycle } from '../../../../lib/crm/lifecycle';
import { C, L, burbuja, separador, etiquetaDia } from './estilo';
import { IcoBuscar, IcoPuntos, IcoChevronArriba, IcoChevronAbajo } from './Iconos';
import { Avatar, IconoCanal } from './ListaConversaciones';
import Composer, { SelectorPlantilla } from './Composer';
import VisorMedia from './VisorMedia';
import BurbujaMensaje, { horaDe, Resaltado, resumenMensaje } from './Burbuja';
import { BotonLlamar } from './Llamadas';
import { confirmar } from '../../../../lib/ui/confirmar';
import ActionSheet from '../ui/ActionSheet';
import DrawerSecuencia from './DrawerSecuencia';
import DrawerCorreo from './DrawerCorreo';
import { useGestoAtras } from '../../../../lib/ui/gestoAtras';
import { tic, ticListo } from '../../../../lib/ui/tacto';

// Borradores por conversación (viven mientras la pestaña esté abierta).


// Posición de lectura por conversación (E1.5). Vive fuera del componente para
// sobrevivir a que el hilo se desmonte al cambiar de conversación.
const memoriaScroll = new Map<string, number>();

export default function Hilo({ hilo, filaActiva, equipo, api, mobile, onBack, onVerDetalle, nuevosAlAbrir }: {
  hilo: any; filaActiva?: any; equipo: any[]; api: any; mobile?: boolean;
  onBack?: () => void; onVerDetalle?: () => void;
  nuevosAlAbrir?: number;   // cuántos entrantes traía sin leer al abrirla (E6)
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const conv = hilo?.conversacion;
  /* «Agente IA» asignado = piloto automático: se pinta morado para que el asesor lo vea de un vistazo. */
  const esAgente = !!(conv?.asignado_a && (equipo || []).some((m: any) => m.id === conv.asignado_a && m.es_agente));
  const [agenteEstado, setAgenteEstado] = useState<any>(null);
  const [composerN, setComposerN] = useState(0);
  const [lightbox, setLightbox] = useState<any>(null);   // ahora es el MENSAJE completo, no solo la URL
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  // Búsqueda EN EL ARCHIVO: lo cargado en pantalla es una ventana; si el
  // término no aparece ahí, el servidor busca en todo el historial del hilo.
  const [archivo, setArchivo] = useState<any[] | null>(null);
  const [buscandoArchivo, setBuscandoArchivo] = useState(false);
  useEffect(() => {
    setArchivo(null);
    if (!buscando || q.trim().length < 2 || !conv?.id) return;
    const t = setTimeout(async () => {
      setBuscandoArchivo(true);
      const j = await fetch(`/api/crm/whatsapp/buscar?q=${encodeURIComponent(q.trim())}&conversation_id=${conv.id}`)
        .then(r => r.json()).catch(() => null);
      setBuscandoArchivo(false);
      setArchivo(j?.resultados || []);
    }, 450);
    return () => clearTimeout(t);
  }, [q, buscando, conv?.id]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [acciones, setAcciones] = useState(false);   // móvil: hoja de cotizar/agendar
  const [cita, setCita] = useState<any>(null);            // mensaje que se va a citar al responder
  const [cierre, setCierre] = useState(false);            // modal de nota de cierre
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modalPlantillaVirtual, setModalPlantillaVirtual] = useState<{ presel?: string | null } | false>(false);
  const etapasCat = useLifecycle();
  const sugerenciasDe = (stage?: string | null) => (etapasCat.find(e => e.id === stage) as any)?.sugerencias || [];
  const [reenviar, setReenviar] = useState<any>(null);       // 12) mensaje a reenviar
  const [mejorar, setMejorar] = useState<any>(null);         // mensaje del agente SDR que se va a corregir (lección)
  // Mensaje sobre el que se mantuvo el dedo. Una sola hoja para todo el hilo:
  // montar una por burbuja multiplicaría el árbol por cada mensaje en pantalla.
  const [accionesMsg, setAccionesMsg] = useState<any>(null);
  // El correo que se está mirando. Sus datos ya vinieron con el hilo, así que
  // abrirlo no cuesta un viaje.
  const [correoAbierto, setCorreoAbierto] = useState<any>(null);
  /* La secuencia que se está mirando desde un comentario interno. Se abre
     AQUÍ: salir del inbox a buscarla es el paso que hace que no se mire. */
  const [secuenciaAbierta, setSecuenciaAbierta] = useState<{ id?: string | null; nombre?: string | null } | null>(null);
  /* Con qué acción abre el panel de ventas. El composer lo pide por evento
     —no puede llamar aquí directo— y así los dos iconos nuevos entran al MISMO
     flujo que el menú ⋮, en vez de tener su propia versión a medias. */
  const [accionInicial, setAccionInicial] = useState<'cotizar' | 'agendar' | null>(null);
  useEffect(() => {
    const h = (e: any) => { setAccionInicial(e?.detail === 'agendar' ? 'agendar' : 'cotizar'); setAcciones(true); };
    document.addEventListener('wa-acciones', h);
    return () => document.removeEventListener('wa-acciones', h);
  }, []);

  // ── VOLVER ─────────────────────────────────────────────────────────────
  // El hilo ya se cerraba con el botón físico y con el gesto del sistema
  // (abrirlo empuja al historial), pero sin que la pantalla se moviera: el
  // gesto era invisible y el cambio, un corte seco. Aquí la pantalla sigue al
  // dedo, y el botón ← hace la MISMA salida, para que ir hacia atrás se vea
  // igual venga de donde venga.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const volver = () => {
    const el = panelRef.current;
    if (!mobile || !el || !onBack) { onBack?.(); return; }
    el.style.transition = 'transform 200ms cubic-bezier(.22,.61,.36,1)';
    el.style.transform = `translateX(${el.getBoundingClientRect().width || window.innerWidth}px)`;
    setTimeout(() => onBack(), 195);
  };
  useGestoAtras(panelRef, !!mobile && !!onBack, () => onBack?.());
  const [, setReloj] = useState(0);                            // 5) re-render del contador de ventana
  useEffect(() => { const t = setInterval(() => setReloj(x => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setCita(null); }, [hilo?.conversacion?.id]);

  // Línea de tiempo unificada: mensajes + correos + notas + eventos + reacciones.
  const { timeline, reacciones, porWamid } = useMemo(() => {
    if (!hilo) return { timeline: [], reacciones: new Map(), porWamid: new Map() };
    const msjsCrudos = (hilo.mensajes || []);
    const reac = new Map<string, { emoji: string; dir: string }[]>();
    const msjs: any[] = [];
    for (const m of msjsCrudos) {
      if (m.tipo === 'reaction' && m.metadata?.reacciona_a) {
        // Una reacción nueva de la misma dirección reemplaza la anterior (así lo hace WhatsApp); emoji vacío = quitar.
        const arr = (reac.get(m.metadata.reacciona_a) || []).filter((x: any) => x.dir !== m.direccion);
        if (m.cuerpo && !m.metadata?.quitar) arr.push({ emoji: m.cuerpo, dir: m.direccion });
        reac.set(m.metadata.reacciona_a, arr);
        continue;
      }
      msjs.push({ ...m, _clase: 'mensaje', _t: m.enviado_at || m.created_at });
    }
    const notas = (hilo.notas || []).map((n: any) => ({ ...n, _clase: 'nota', _t: n.created_at }));
    const correos = (hilo.correos || []).flatMap((h: any) => (h.mensajes || []).map((m: any) => ({
      ...m, _clase: 'correo', _t: m.created_at, _asunto: m.asunto || h.conversacion?.asunto || '',
    })));
    const eventos = (hilo.eventos || []).map((e: any) => ({ ...e, _clase: 'evento', _t: e.created_at }));
    // Orden estable: hora real → created_at (ms) → id. Los timestamps de WhatsApp
    // van al SEGUNDO: sin el desempate fino, tu envío y la respuesta del cliente
    // dentro del mismo segundo se volteaban entre un poll y otro.
    const crudo = [...msjs, ...notas, ...correos, ...eventos].sort((a, b) =>
      String(a._t).localeCompare(String(b._t)) || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    // Eventos de sistema idénticos y seguidos se colapsan en uno con su
    // cuenta: cinco «Recordatorio si no contesta: 30 ago» seguidos se comían
    // un tercio de la pantalla y no decían nada más que el primero.
    const timeline: any[] = [];
    for (const it of crudo) {
      const prev = timeline[timeline.length - 1];
      if (it._clase === 'evento' && prev?._clase === 'evento' && prev.tipo === it.tipo && prev.detalle === it.detalle) {
        prev._veces = (prev._veces || 1) + 1;
        continue;
      }
      timeline.push(it._clase === 'evento' ? { ...it } : it);
    }
    return { timeline, reacciones: reac, porWamid: new Map<string, any>(msjs.filter(m => m.kapso_message_id).map(m => [m.kapso_message_id, m])) };
  }, [hilo]);

  // Búsqueda en el hilo (Cmd+F portado).
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return timeline.filter((it: any) =>
      it._clase !== 'evento' && String(it.cuerpo || it.cuerpo_texto || it.transcript || it.texto || '').toLowerCase().includes(ql));
  }, [timeline, q]);
  useEffect(() => { setMatchIdx(0); }, [q]);
  // Cada item del hilo cuelga de un <span display:contents>, que NO tiene caja
  // propia: `scrollIntoView` sobre él no mueve nada. Se desplaza su primer
  // hijo, que sí la tiene.
  const irAItem = (clave: string) => {
    const el = document.getElementById(`wa-item-${clave}`);
    const caja = (el?.firstElementChild as HTMLElement) || el;
    caja?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const irAMatch = (idx: number) => {
    const it = matches[idx]; if (!it) return;
    irAItem(`${it._clase}-${it.id}`);
    setResaltada(`${it._clase}-${it.id}`);
    setTimeout(() => setResaltada(null), 2000);
  };
  useEffect(() => { if (matches.length) irAMatch(matchIdx); }, [matchIdx, matches.length]);

  const ultimoRef = useRef('');
  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  useEffect(() => {
    const ult = timeline.length ? `${timeline[timeline.length - 1]._clase}-${timeline[timeline.length - 1].id}` : '';
    if (ult === ultimoRef.current) return;
    const primeraVez = !ultimoRef.current;
    ultimoRef.current = ult;
    if (buscando) return;
    const el = scrollRef.current; if (!el) return;
    // E6.2 · Si estás leyendo hacia arriba, un mensaje nuevo NO te arranca de
    // donde ibas: se avisa con un botón y bajas tú.
    const alFinal = primeraVez || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (alFinal) { el.scrollTo({ top: el.scrollHeight }); setNuevosAbajo(0); }
    else setNuevosAbajo(n => n + 1);
  }, [timeline]);

  // ── E1.5 · La posición de lectura se recuerda por conversación ──────────
  // Si te quedaste a media conversación leyendo algo y te vas a otra, al
  // volver apareces donde estabas y no al final. Si estabas hasta abajo (el
  // caso normal), no se guarda nada y se comporta como siempre.
  const convId = String(conv?.id || filaActiva?.id || '');
  const restauradoRef = useRef('');
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !convId || !timeline.length || restauradoRef.current === convId) return;
    restauradoRef.current = convId;
    const y = memoriaScroll.get(convId);
    el.scrollTop = y != null ? Math.min(y, el.scrollHeight) : el.scrollHeight;
    ultimoRef.current = `${timeline[timeline.length - 1]._clase}-${timeline[timeline.length - 1].id}`;
  }, [convId, timeline.length]);
  // Cuando el composer crece —al enfocarlo, al añadir líneas, al aparecer la
  // barra ámbar— le quita alto al hilo. Si estabas al final, te quedas al
  // final: si no, el composer tapa justo el mensaje al que respondes.
  const cajaComposerRef = useRef<HTMLDivElement>(null);
  // Ojo: «estabas al final» tiene que leerse del scroll EN VIVO, no de lo que
  // valía en el resize anterior; si no, después de subir a leer, la siguiente
  // línea que escribas te arrastra al fondo.
  const alFinalRef = useRef(true);
  useEffect(() => {
    const caja = cajaComposerRef.current, el = scrollRef.current;
    if (!caja || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (alFinalRef.current) el.scrollTop = el.scrollHeight; });
    ro.observe(caja);
    return () => ro.disconnect();
  }, [conv?.id]);

  const guardarScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const alFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    alFinalRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (alFinal && nuevosAbajo) setNuevosAbajo(0);
    if (!convId) return;
    if (alFinal) memoriaScroll.delete(convId); else memoriaScroll.set(convId, el.scrollTop);
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLightbox(null); setBuscando(false); } };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, []);

  // Fila virtual (contacto sin conversación): héroe + elegir plantilla.
  if (!hilo && filaActiva?.virtual) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: C.g50 }}>
        <div style={{ height: L.header, display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
          {onBack && <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, minWidth: 36 }}>←</button>}
          <Avatar nombre={filaActiva.contacto?.nombre} telefono={String(filaActiva.telefono || '?')} size={28} canal="crm" />
          <b style={{ fontSize: 13 }}>{filaActiva.contacto?.nombre || filaActiva.telefono}</b>
          {filaActiva.contacto?.de_perfil && (
            <span title="Nombre de su perfil de WhatsApp — todavía no es contacto del CRM"
              style={{ fontSize: 9, fontWeight: 700, background: C.emerald50, color: C.emerald700, borderRadius: 999, padding: '1px 6px' }}>de WhatsApp</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '2px 8px' }}>Sin conversación</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 76, height: 76, borderRadius: 999, background: 'linear-gradient(135deg, #A7F3D0, #34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconoCanal canal="wa" size={34} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 4px' }}>Inicia una conversación</p>
          <div style={{ maxWidth: 380, background: 'rgba(236,253,245,.6)', border: `1px solid #A7F3D0`, borderRadius: 12, padding: '14px 16px', marginTop: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.g500, lineHeight: 1.55, margin: '0 0 10px' }}>
              WhatsApp solo permite iniciar con una <b>plantilla aprobada</b>; cuando el contacto responda, el chat queda abierto 24 horas.
            </p>
            <button onClick={() => setModalPlantillaVirtual({})}
              style={{ border: 'none', borderRadius: 8, padding: '9px 18px', background: C.emerald600, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Elegir plantilla
            </button>
            {/* Los «Temas de su etapa» se quitaron a pedido del usuario. */}
          </div>
        </div>
        {modalPlantillaVirtual && (
          <SelectorPlantilla telefono={String(filaActiva.telefono || '')} api={api} onClose={() => setModalPlantillaVirtual(false)} preseleccion={(modalPlantillaVirtual as any).presel || null} contacto={{ nombre: filaActiva.contacto?.nombre, email: filaActiva.contacto?.email, empresa: filaActiva.empresa?.nombre, plan: filaActiva.empresa?.plan, telefono: String(filaActiva.telefono || '') }} />
        )}
      </div>
    );
  }

  // E1.2 · Cabecera optimista. Abrir una conversación nunca debe mostrar una
  // pantalla vacía: el nombre y el teléfono ya los tenemos en la fila de la
  // lista, así que la cabecera se pinta de inmediato y solo el cuerpo espera.
  if (!hilo) {
    const nom = filaActiva?.contacto?.nombre
      ? `${filaActiva.contacto.nombre} ${filaActiva.contacto.apellido || ''}`.trim()
      : (filaActiva?.telefono ? telefonoLegible(String(filaActiva.telefono)) : '');
    return (
      <div ref={panelRef} className={mobile ? 'wa-hilo-m wa-hilo-entra' : undefined} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: mobile ? '#fff' : C.g50, height: mobile ? 'calc(100dvh - 64px)' : undefined }}>
        <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
          {onBack && <button onClick={volver} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, minWidth: 44, height: 44, marginLeft: -10, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>←</button>}
          {nom
            ? <b style={{ fontSize: mobile ? 17 : 13, letterSpacing: mobile ? '-0.015em' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{nom}</b>
            : <span style={{ flex: 1, height: 13, maxWidth: 160, borderRadius: 6, background: C.g100 }} />}
        </div>
        {/* La cabecera de arriba ya quedó pintada con el nombre real; aquí va
            la forma del hilo —burbujas y composer— para que al llegar los
            mensajes ocupen exactamente este sitio y nada salte. */}
        <div style={{ flex: 1, minHeight: 0 }}><EsqueletoChat mobile={mobile} /></div>
      </div>
    );
  }

  const etapa = lifecycleDe(conv?.contacts?.lifecycle_stage);
  const nombre = conv?.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : null;
  const ventanaViva = !!hilo?.ventana?.expira_at && new Date(hilo.ventana.expira_at) > new Date();
  let diaPrevio = '';
  // E6.1 · La marca «Mensajes nuevos» va justo antes del primero que no
  // habías leído: al abrir con 8 pendientes se ve dónde empieza lo tuyo, en
  // vez de aterrizar al final y subir a ciegas.
  const claveNuevos = (() => {
    const n = Number(nuevosAlAbrir || 0);
    if (!n || !timeline.length) return null;
    let vistos = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
      const it: any = timeline[i];
      if (it._clase !== 'mensaje' || it.direccion !== 'entrante') continue;
      vistos++;
      if (vistos === n) return `${it._clase}-${it.id}`;
    }
    return null;
  })();

  return (
    <div className={mobile ? 'wa-hilo-m' : undefined} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: mobile ? '#fff' : C.g50, height: mobile ? 'calc(100dvh - 64px)' : undefined }}>
      {/* ── Header ──
          DOS RENGLONES en escritorio, no uno. En 44 px de alto cabían el
          nombre, la etapa, el teléfono, el contador de la ventana, el estado
          del Agente IA, dos selectores y tres iconos: todo salía recortado
          —«Sin asig», «● I», el contador partido— y había que adivinar por el
          tooltip. Más alto no cuesta nada; no poder leer el estado del agente
          ni a quién está asignada, sí.

          Se deja que envuelva: en una pantalla ancha caben en una línea, y en
          una angosta los controles bajan solos en vez de aplastarse. */}
      <div style={{ minHeight: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: mobile ? 'nowrap' : 'wrap', rowGap: 6, gap: 10, padding: mobile ? '0 16px' : '7px 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
        {onBack && <button onClick={volver} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, minWidth: 44, height: 44, marginLeft: -10, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>←</button>}
        {/* `overflow:hidden` no es cosmético: este bloque toma el espacio que
            sobra, pero sus pastillas llevan `flex-shrink:0` y se salían de su
            caja pintándose ENCIMA de lo que va a la derecha. Con esto, lo que
            no cabe se recorta dentro de su propio carril en vez de invadir el
            contador de la ventana. */}
        <span style={{ minWidth: 100, flex: '1 1 240px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 9 }}>
          <b style={{ fontSize: mobile ? 17 : 13, letterSpacing: mobile ? '-0.015em' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, maxWidth: mobile ? undefined : 200, flex: mobile ? 1 : '0 1 auto' }}>{nombre || telefonoLegible(conv.telefono)}</b>
          {etapa && !mobile && <span style={{ fontSize: 9, fontWeight: 700, background: etapa.bg, color: etapa.fg, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{etapa.label}</span>}
          {hilo?.web_en_vivo && !mobile && (
            <span title={`Está viendo ${hilo.web_en_vivo} en este momento: es EL mejor momento para escribirle`}
              style={{ fontSize: 9, fontWeight: 800, background: C.emerald50, color: C.emerald700, borderRadius: 999, padding: '2px 8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="wa-pulso" style={{ width: 6, height: 6, borderRadius: 99, background: C.emerald500, display: 'inline-block' }} />
              en el sitio: {String(hilo.web_en_vivo).slice(0, 24)}
            </span>
          )}
          {/* El teléfono solo se repite si arriba va un NOMBRE; si el título ya
              es el número, mostrarlo dos veces solo quitaba aire al header. */}
          {!mobile && nombre && <span style={{ fontSize: 10, color: C.g400, flexShrink: 0 }}>{telefonoLegible(conv.telefono)}</span>}
          {hilo.marketing?.stopped && <span title="El cliente pidió no recibir mensajes de marketing (Meta lo registra). Solo plantillas de utilidad o responder cuando él escriba." style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>Sin marketing</span>}
          {(hilo.presencia || []).map((p: any) => (
            <span key={p.user_id} title={p.escribiendo ? `${p.nombre} está escribiendo…` : `${p.nombre} también tiene abierto este chat`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, background: p.escribiendo ? C.moradoAgua : C.g100, color: p.escribiendo ? C.moradoTinta : C.g500, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: p.escribiendo ? C.morado : C.g400 }} className={p.escribiendo ? 'wa-pulso' : ''} />
              {(p.nombre || '').split(' ')[0]}{p.escribiendo ? ' escribe…' : ''}
            </span>
          ))}
        </span>
        {/* ══ LA VENTANA DE 24 H, FUERA DEL BLOQUE QUE SE ENCOGE ══
            Vivía junto al nombre, dentro del `flex:1` que absorbe el sobrante.
            Con un nombre largo el contador se comía el espacio y se recortaba a
            media palabra: «quedan 13 h 5». Y es el dato que decide si puedes
            escribir libremente o necesitas plantilla — el que menos puede
            quedar a medias. Aquí es hermano de los selects, con su lugar
            propio, y lo que se acorta es el nombre. */}
          {conv.id && !hilo.ventana?.expira_at && (
          <span title="Sin ventana abierta: solo plantilla" style={{ fontSize: 10, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '4px 11px', flexShrink: 0, whiteSpace: 'nowrap' }}>{mobile ? 'Cerrada' : 'Ventana cerrada'}</span>
        )}
        {conv.id && hilo.ventana?.expira_at && (() => {
          const ms = new Date(hilo.ventana.expira_at).getTime() - Date.now();
          if (ms <= 0) return <span title="Ventana de 24 h cerrada: solo plantilla" style={{ fontSize: 10, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '4px 11px', flexShrink: 0, whiteSpace: 'nowrap' }}>{mobile ? 'Cerrada' : 'Ventana cerrada'}</span>;
          const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60000);
          const urgente = ms < 4 * 3600e3;
          return <span title={`Puedes escribir libremente hasta ${new Date(hilo.ventana.expira_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
            /* Con horas de sobra, la píldora era lo más brillante del header y
               pesaba más que el nombre del contacto. Queda de contorno; se
               rellena en ámbar solo cuando la ventana está por cerrarse. */
            style={{ fontSize: 10, fontWeight: 700, background: urgente ? C.ambar100 : 'transparent', border: urgente ? '1px solid transparent' : `1px solid ${C.emerald300}`, color: urgente ? C.ambar700 : C.emerald700, borderRadius: 999, padding: '4px 10px', flexShrink: 0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            {mobile
              ? (h > 0 ? `${h} h` : `${m} min`)
              : <>{urgente ? 'cierra en ' : 'quedan '}{h > 0 ? `${h} h ` : ''}{m} min</>}
          </span>;
        })()}
        {conv.id && !mobile && <select value={conv.asignado_a || ''} onChange={e => api.patchConversacion({ asignado_a: e.target.value || null })}
          aria-label="Asignar a"
          /* Estos dos SÍ se encogen. El orden de quién cede es a propósito:
             primero los selects, que se leen igual acortados; después el
             nombre, que ya lleva puntos suspensivos; el contador nunca, porque
             a medias no sirve de nada. */
          style={{ border: `1px solid ${esAgente ? C.morado : C.g200}`, borderRadius: 8, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: esAgente ? C.moradoAgua : '#fff', color: esAgente ? C.morado : C.g500, fontWeight: esAgente ? 800 : undefined, maxWidth: mobile ? 78 : 110, minWidth: 74, flexShrink: 1, cursor: 'pointer' }}>
          <option value="">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>}
        {conv.id && conv.contact_id && <PildoraAgente contactId={conv.contact_id} conversationId={conv.id} mobile={!!mobile} onEstado={setAgenteEstado} />}
        {conv.id && !mobile && <select value={conv.estado_crm || 'abierta'} onChange={e => e.target.value === 'resuelta' ? setCierre(true) : api.patchConversacion({ estado_crm: e.target.value })}
          aria-label="Estado" title="Estado de la conversación"
          style={{
            border: '1px solid', borderRadius: 8, padding: '4px 6px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, minWidth: 96, maxWidth: mobile ? 84 : undefined,
            borderColor: conv.estado_crm === 'resuelta' ? '#A7F3D0' : conv.estado_crm === 'pendiente' ? C.ambar200 : C.g200,
            background: conv.estado_crm === 'resuelta' ? C.emerald50 : conv.estado_crm === 'pendiente' ? C.ambar50 : '#fff',
            color: conv.estado_crm === 'resuelta' ? C.emerald700 : conv.estado_crm === 'pendiente' ? C.ambar700 : C.g500,
          }}>
          <option value="abierta">Abierta</option>
          <option value="pendiente">Pendiente</option>
          <option value="resuelta">Resuelta</option>
        </select>}
        {conv.id && !mobile && <BotonLlamar conversationId={conv.id} telefono={conv.telefono} nombre={nombre} api={api} />}
        {/* Buscar dentro del hilo también en el teléfono: encontrar un monto o
            una dirección subiendo a mano por cien mensajes es justo lo que no
            se puede hacer con el pulgar. */}
        {!mobile && <button onClick={() => setBuscando(b => !b)} title="Buscar en la conversación"
          style={{ border: 'none', background: buscando ? C.moradoAgua : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: buscando ? C.moradoTinta : C.g400 }}>
          <IcoBuscar size={mobile ? 19 : 15} />
        </button>}
        {conv.id && <MenuHilo conv={conv} api={api} abierto={menu} setAbierto={setMenu} equipo={mobile ? equipo : undefined} onResolver={() => setCierre(true)} movil={mobile}
          onAcciones={() => setAcciones(true)} onBuscar={() => setBuscando(b => !b)}
          notas={(hilo?.notas || []).length}
          onVerNotas={() => {
            const ult = [...timeline].reverse().find((t: any) => t._clase === 'nota');
            if (!ult) return;
            const clave = `nota-${ult.id}`;
            irAItem(clave);
            setResaltada(clave); setTimeout(() => setResaltada(null), 2500);
          }} />}
        {/* Acciones (cotizar, agendar) a un toque: en el teléfono estaban
            enterradas dentro de la ficha, y son lo que se hace DURANTE la
            conversación. */}
        {onVerDetalle && (
          mobile
            ? <button onClick={onVerDetalle} aria-label="Ficha del contacto" title="Ficha del contacto"
                style={{ border: 'none', background: 'none', padding: '8px 2px 8px 8px', color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </button>
            : <button onClick={onVerDetalle} style={{ border: `1px solid ${C.azulBorde}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: '#fff', color: C.azulTinta, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Detalle</button>
        )}
      </div>

      {/* ── Barra de búsqueda del hilo ── */}
      {buscando && (
        <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'rgba(249,250,251,.7)', borderBottom: `1px solid ${C.g100}` }}>
          <IcoBuscar size={13} style={{ color: C.g400 }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setMatchIdx(i => (i + 1) % Math.max(matches.length, 1)); }}
            placeholder="Buscar en la conversación…"
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ fontSize: 11, color: C.g400, fontVariantNumeric: 'tabular-nums' }}>{matches.length ? `${matchIdx + 1}/${matches.length}` : '0/0'}</span>
          <button disabled={!matches.length} onClick={() => setMatchIdx(i => (i - 1 + matches.length) % matches.length)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, opacity: matches.length ? 1 : .3 }}><IcoChevronArriba size={13} /></button>
          <button disabled={!matches.length} onClick={() => setMatchIdx(i => (i + 1) % matches.length)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 2, opacity: matches.length ? 1 : .3 }}><IcoChevronAbajo size={13} /></button>
          <button onClick={() => { setBuscando(false); setQ(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 13 }}>✕</button>
        </div>
      )}
      {buscando && q.trim().length >= 2 && (archivo?.length || 0) > matches.length && (
        <div style={{ flexShrink: 0, background: C.moradoAgua, borderBottom: `1px solid #e2dcfb`, padding: '6px 14px', fontSize: 11.5, color: C.moradoTinta }}>
          {buscandoArchivo ? 'Buscando en todo el historial…' : (<>
            <b>{archivo!.length}</b> coincidencia{archivo!.length === 1 ? '' : 's'} en TODO el historial (en pantalla solo {matches.length}):
            <span style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {archivo!.slice(0, 4).map((r: any) => (
                <span key={r.id} style={{ fontSize: 11, color: C.g700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b style={{ color: C.moradoTinta }}>{new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })}</b> · {r.es_transcripcion ? '🎙 ' : ''}{r.fragmento}
                </span>
              ))}
            </span>
          </>)}
        </div>
      )}

      {(hilo?.campanas_proximas || []).map((cp: any) => (
        <div key={cp.destinatario_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: C.moradoAgua, borderBottom: `1px solid #e2dcfb`, fontSize: 12, color: C.moradoTinta }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>Está en el masivo «{cp.nombre}»</b> programado para {new Date(cp.scheduled_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{cp.plantilla ? ` · plantilla ${cp.plantilla}` : ''}
          </span>
          <button onClick={async () => { if (await confirmar(`¿Quitar a este contacto del masivo «${cp.nombre}»? Ya no le llegará ese envío.`)) { const r = await api.quitarDeMasivo?.(cp.broadcast_id); if (r?.error) alert(r.error); } }}
            style={{ border: '1px solid #cfc5f6', background: '#fff', color: C.moradoTinta, borderRadius: 999, padding: '3px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Quitarlo de ese envío</button>
        </div>
      ))}
      {/* El rojo es para lo que YA se rompió: número bloqueado o inalcanzable.
          Un límite de Meta o una restricción temporal es atención, y va en
          ámbar; si no, el rojo deja de alarmar cuando de verdad importa.
          En el teléfono el texto se corta a dos líneas: junto con el aviso de
          ventana cerrada eran 200 px de cromo sobre el hilo. */}
      {conv.alerta && (() => {
        const roto = /bloquead|no alcanzable|inexistente|no existe/i.test(conv.alerta);
        // Con la ventana cerrada, el panel del composer ya dice qué hacer y
        // trae el botón: dos avisos ámbar seguidos diciendo casi lo mismo solo
        // hacen dudar cuál obedecer. El texto viaja al panel.
        if (mobile && !roto && !ventanaViva) return null;
        const fondo = roto ? C.rojo50 : C.ambar50, borde = roto ? C.rojo200 : C.ambar200, tinta = roto ? C.rojo700 : C.ambar700;
        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 16px', background: fondo, borderBottom: `1px solid ${borde}`, fontSize: 12, lineHeight: 1.45, color: tinta, flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <span title={conv.alerta} style={{ flex: 1, ...(mobile ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' } : null) }}>{conv.alerta}</span>
            {hilo.canales?.correo?.ok && <button onClick={() => document.dispatchEvent(new CustomEvent('wa-modo-correo'))} style={{ border: `1px solid ${borde}`, background: '#fff', color: tinta, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Escribir por correo</button>}
          </div>
        );
      })()}
      {/* ══ Con quién hablas, sin abrir la ficha (móvil) ══════════════════
          Etapa, empresa y de dónde llegó, en una línea. Contestar sin saber si
          es un lead nuevo o un cliente de años es la diferencia entre atinar y
          escribir de más; la ficha completa está a un toque, pero esto se ve
          sin toques. */}
      {mobile && (etapa || conv.companies?.nombre_comercial || conv.companies?.nombre || conv.contacts?.origen) && (
        /* Sin banda gris y con tinta de texto real: sobre el gris claro, el
           origen («One Way») quedaba a 2.5:1 de contraste, ilegible. */
        <div className="wa-ctx" style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '7px 16px', background: 'transparent', borderBottom: `1px solid ${C.g100}`, flexShrink: 0, fontSize: 12.5, color: C.g700 }}>
          {etapa && <span style={{ fontWeight: 700, background: etapa.bg, color: etapa.fg, borderRadius: 999, padding: '3px 10px' }}>{etapa.label}</span>}
          {(conv.companies?.nombre_comercial || conv.companies?.nombre) && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{conv.companies?.nombre_comercial || conv.companies?.nombre}</span>
          )}
          {conv.contacts?.origen && (
            /* Antes iba como texto suelto al lado de un chip: dos etiquetas
               hermanas con tratamiento distinto se leen como error. */
            <span style={{ fontWeight: 600, background: C.g100, color: C.g700, borderRadius: 999, padding: '3px 10px' }}>
              {String(conv.contacts.origen).slice(0, 22)}
            </span>
          )}
        </div>
      )}
      {/* ── Mensajes ── */}
      {nuevosAbajo > 0 && (
        <button className="wa-bajar" onClick={() => { const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setNuevosAbajo(0); }}>
          {nuevosAbajo === 1 ? '1 mensaje nuevo' : `${nuevosAbajo} mensajes nuevos`} ↓
        </button>
      )}
      <div ref={scrollRef} onScroll={guardarScroll} data-hilo-scroll className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hilo.hay_mas && (
          <button disabled={cargandoMas} onClick={async () => {
            const primero = (hilo.mensajes || [])[0];
            if (!primero || !api.cargarMasHilo) return;
            const el = scrollRef.current; const h0 = el?.scrollHeight || 0;
            setCargandoMas(true); await api.cargarMasHilo(primero.created_at); setCargandoMas(false);
            requestAnimationFrame(() => { if (el) el.scrollTop += (el.scrollHeight - h0); });
          }} style={{ alignSelf: 'center', border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 11, fontWeight: 700, color: C.g500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {cargandoMas ? 'Cargando…' : 'Cargar mensajes anteriores'}
          </button>
        )}
        {timeline.map((item: any, idx: number) => {
          const dia = etiquetaDia(item._t);
          const sepDia = dia !== diaPrevio; diaPrevio = dia;
          // Boundary: al pasar por un evento "resuelta", el siguiente bloque abre nueva etapa.
          const esBoundary = item._clase === 'evento' && item.tipo === 'estado' && /resuelta/i.test(item.detalle || '');
          const clave = `${item._clase}-${item.id}`;
          const conRing = resaltada === clave;
          const chips = item._clase === 'mensaje' && item.kapso_message_id ? reacciones.get(item.kapso_message_id) : null;
          const prevItem = timeline[idx - 1];
          const mismoAutor = !!prevItem && prevItem._clase === 'mensaje' && item._clase === 'mensaje'
            && prevItem.direccion === item.direccion && (prevItem.autor || '') === (item.autor || '') && !sepDia;
          const sep = separador(false);
          const sepOscuro = separador(true);
          return (
            <span key={clave} id={`wa-item-${clave}`} style={{ display: 'contents' }}>
              {sepDia && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sep.linea} /><span style={sep.chip}>{dia}</span><span style={sep.linea} />
                </span>
              )}
              {clave === claveNuevos && (
                <span className="wa-nuevos" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 2px' }}>
                  <span style={{ flex: 1, height: 1, background: '#c9bcf7' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.moradoTinta }}>Mensajes nuevos</span>
                  <span style={{ flex: 1, height: 1, background: '#c9bcf7' }} />
                </span>
              )}
              {esBoundary ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sepOscuro.linea} />
                  <span style={{ ...sepOscuro.chip, maxWidth: 520, whiteSpace: 'normal', textAlign: 'center' }}>✓ Resuelta{item.autor ? ` por ${item.autor}` : ''}{String(item.detalle || '').replace(/^Marcada como resuelta/i, '')}</span>
                  <span style={sepOscuro.linea} />
                </span>
              ) : item._clase === 'evento' && item.tipo === 'minuta' ? (
                <MinutaCard item={item} />
              ) : item._clase === 'evento' ? (
                /* «Sin actividad» salió de la lista de pastillas ámbar: es un
                   separador de sistema, no algo que atender, y en ámbar competía
                   con el aviso de ventana cerrada. */
                <span style={{ alignSelf: 'center', maxWidth: '92%', textAlign: 'center', fontSize: 11, color: item.tipo === 'reunion' ? C.azulTinta : item.tipo === 'llamada' ? C.emerald700 : item.tipo === 'campana' ? C.moradoTinta : ['identidad', 'bloqueo'].includes(item.tipo) ? C.ambar700 : C.g500, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 8, lineHeight: 1.6, margin: '4px 0', background: item.tipo === 'reunion' ? C.azulAgua : item.tipo === 'llamada' ? C.emerald50 : item.tipo === 'campana' ? C.moradoAgua : ['identidad', 'bloqueo'].includes(item.tipo) ? C.ambar50 : 'transparent', borderRadius: 999, padding: ['reunion', 'llamada', 'campana', 'identidad', 'bloqueo'].includes(item.tipo) ? '5px 14px' : 0 }}>
                  {item.detalle}{item._veces > 1 ? ` · ${item._veces} veces` : ''}{item.autor ? ` · ${item.autor}` : ''}
                  {item.meet && <a href={item.meet} target="_blank" rel="noreferrer" style={{ color: C.azulTinta, fontWeight: 700, fontStyle: 'normal' }}>Meet</a>}
                  {/* «Le mandamos un correo y lo abrió» está bien para enterarse,
                      pero para RETOMAR hace falta saber cuál. Se abre aquí
                      mismo: salir del inbox a buscarlo es el paso que hace que
                      no se mire, y entonces se responde sin el contexto. */}
                  {/* Enlace, no botón: es una salida discreta dentro de una
                      línea de sistema, y un botón ahí competía con el mensaje.
                      Abre el mismo cajón, sin salir de la conversación. */}
                  {item.correo && (
                    <span role="link" tabIndex={0} onClick={() => setCorreoAbierto(item.correo)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCorreoAbierto(item.correo); } }}
                      style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, fontStyle: 'normal',
                        color: C.moradoTinta, textDecoration: 'underline', textUnderlineOffset: 3, whiteSpace: 'nowrap' }}>
                      ver correo
                    </span>
                  )}
                </span>
              ) : item._clase === 'nota' ? (
                /* DOS clases de nota, y no se ven igual a propósito.
                   El ámbar es «alguien del equipo escribió algo»: pide leerse.
                   Lo que anota el SISTEMA —secuencias, agenda— es contexto, no
                   un recado; en ámbar competía con los recados de verdad y, con
                   seis seguidas, el hilo entero parecía una alerta. Va en
                   morado, que es el color del sistema en todo el CRM. */
                (() => {
                  const sistema = ['Secuencias', 'Agenda', 'Sistema'].includes(String(item.autor || ''));
                  const secId = item.metadata?.secuencia_id || null;
                  /* Las notas viejas no traen metadata: el nombre se saca del
                     texto entre comillas, que es como se escribieron siempre. */
                  const secNombre = item.metadata?.secuencia
                    || (String(item.texto || '').match(/secuencia "([^"]+)"|de "([^"]+)"/) || []).slice(1).find(Boolean) || null;
                  const tinta = sistema ? C.moradoTinta : C.ambar700;
                  return (
                <span style={{ ...burbuja.nota,
                  ...(sistema ? { background: C.moradoSuave, border: `1.5px solid ${C.moradoAgua}`, color: '#3a3357' } : {}),
                  boxShadow: conRing ? `0 0 0 2px ${C.morado}` : 'none', transition: 'box-shadow .3s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: sistema ? C.morado : C.ambar400, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(item.autor || 'E')[0].toUpperCase()}
                    </span>
                    <b style={{ fontSize: 11, color: tinta }}>{sistema ? item.autor : `Comentario interno · ${item.autor}`}</b>
                    <span style={{ fontSize: 9, fontWeight: 700, background: sistema ? C.moradoAgua : C.ambar100, color: tinta, borderRadius: 999, padding: '1px 7px' }}>Solo equipo</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: sistema ? '#9a93c4' : C.ambar500 }}>{horaDe(item._t)}</span>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.texto} q={q} /></span>
                  {/* El nombre de una secuencia no le dice nada a nadie: lo que
                      hace falta es qué manda y qué sigue. Se abre aquí mismo. */}
                  {(secId || secNombre) && (
                    <span role="link" tabIndex={0}
                      onClick={() => setSecuenciaAbierta({ id: secId, nombre: secNombre })}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSecuenciaAbierta({ id: secId, nombre: secNombre }); } }}
                      style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: C.moradoTinta, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                      Ver qué manda y qué sigue
                    </span>
                  )}
                </span>
                  );
                })()
              ) : item._clase === 'correo' ? (
                <span style={{ ...burbuja.correo(item.direccion === 'saliente'), boxShadow: conRing ? `0 0 0 2px ${C.morado}` : 'none', transition: 'box-shadow .3s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <IconoCanal canal="email" />
                    <b style={{ fontSize: 12, color: C.azulTinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._asunto || 'Correo'}</b>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap', display: 'block', maxHeight: 220, overflow: 'hidden' }}>
                    <Resaltado texto={(item.cuerpo_texto || '').slice(0, 1200)} q={q} />
                  </span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                    {item.autor && <span style={{ fontSize: 10, color: C.g400 }}>{item.autor}</span>}
                    <span style={{ fontSize: 10, color: C.g400 }}>{horaDe(item._t)}</span>
                    {item.direccion === 'saliente' && <span style={{ fontSize: 9, fontWeight: 800, background: C.azulAgua, color: C.azulTinta, borderRadius: 999, padding: '1px 7px' }}>correo</span>}
                  </span>
                </span>
              ) : (
                <BurbujaMensaje item={item} q={q} conRing={conRing} chips={chips} porWamid={porWamid}
                  mismoAutorQueElAnterior={mismoAutor}
                  onLightbox={setLightbox} onCitar={conv.id ? setCita : undefined} onReenviar={conv.id ? setReenviar : undefined}
                  onReintentar={api.reintentar ? (m: any) => api.reintentar(m) : undefined}
                  onMejorar={conv.id ? setMejorar : undefined}
                  onReaccionar={conv.id && api.reaccionar ? (m: any, emoji: string) => api.reaccionar(m.kapso_message_id, emoji) : undefined}
                  onMantener={mobile && !item.borrado_at ? setAccionesMsg : undefined}
                  onIrACita={(id: string) => {
                    const clave = `mensaje-${id}`;
                    irAItem(clave);
                    setResaltada(clave); setTimeout(() => setResaltada(null), 2500);
                  }} />
              )}
            </span>
          );
        })}
        {!timeline.length && (
          <span style={{ alignSelf: 'center', marginTop: 30, fontSize: 12, color: C.g400 }}>Todavía no hay mensajes.</span>
        )}
        {conv.estado_crm === 'resuelta' && timeline.length > 0 && !(timeline[timeline.length - 1]._clase === 'evento' && /resuelta/i.test(timeline[timeline.length - 1].detalle || '')) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <span style={separador(true).linea} /><span style={separador(true).chip}>✓ Conversación resuelta</span><span style={separador(true).linea} />
          </span>
        )}
      </div>

      {/* ── Composer ── */}
      {mobile && acciones && (
        <>
          <div onClick={() => { setAcciones(false); setAccionInicial(null); }} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(8,7,12,.62)' }} />
          <div className="menu-hoja" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 951, background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '86dvh', overflowY: 'auto', boxShadow: '0 -14px 40px rgba(12,11,18,.3)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            <span style={{ display: 'block', width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '10px auto 4px' }} />
            <AccionesVenta
              contacto={conv?.contacts || null}
              empresa={conv?.companies || null}
              conv={conv}
              ventanaAbierta={!!hilo?.ventana?.expira_at && new Date(hilo.ventana.expira_at) > new Date()}
              abrirFicha={() => { setAcciones(false); onVerDetalle?.(); }}
              accionInicial={accionInicial}
              refrescar={() => api.refrescar?.()}
            />
          </div>
        </>
      )}
      {agenteEstado?.sugerencias?.length > 0 && (
        <div style={{ margin: '0 12px 6px', border: '1px solid #d9d4ea', background: '#fbfaff', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5B4BD6', marginBottom: 4 }}>Sugerencia del agente (no se ha mandado)</div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{agenteEstado.sugerencias[0].mensaje}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={async () => { const sg = agenteEstado.sugerencias[0]; guardarBorrador(conv.id, sg.mensaje); setComposerN(n => n + 1); await fetch('/api/crm/ti/agente-hilo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: conv.contact_id, accion: 'usar_sugerencia', envio_id: sg.id }) }).then(r => r.json()).then(setAgenteEstado).catch(() => {}); }} style={{ border: 'none', background: '#5B4BD6', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Usar en el compositor</button>
            <button onClick={async () => { const sg = agenteEstado.sugerencias[0]; await fetch('/api/crm/ti/agente-hilo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: conv.contact_id, accion: 'descartar_sugerencia', envio_id: sg.id }) }).then(r => r.json()).then(setAgenteEstado).catch(() => {}); }} style={{ border: '1px solid #e8e5f0', background: '#fff', color: '#6b6580', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Descartar</button>
          </div>
        </div>
      )}
      <div ref={cajaComposerRef}>
      <Composer key={`${conv.id || conv.email_only_id}-${composerN}`} ventana={hilo.ventana} api={api} telefono={conv.telefono} equipo={equipo} movil={mobile}
        cita={cita} onQuitarCita={() => setCita(null)} onEscribir={api.escribiendo} siguiente={api.siguienteSinResponder}
        alerta={conv.alerta || null}
        sugerencias={sugerenciasDe(conv?.contacts?.lifecycle_stage)}
        borradorInicial={leerBorrador(conv.id || conv.email_only_id)} onBorrador={t => guardarBorrador(conv.id || conv.email_only_id, t)}
        canales={{ ...hilo.canales, wa_id: conv.id }}
        contacto={{ nombre, email: conv.contacts?.email, empresa: conv.companies?.nombre_comercial || conv.companies?.nombre, plan: conv.companies?.plan, etapa: etapa?.label, telefono: telefonoLegible(conv.telefono), mrr: conv.companies?.mrr, fecha_renovacion: conv.companies?.fecha_renovacion, sucursales: conv.companies?.sucursales,
          /* Para crear la prueba gratis desde el composer. El `contact_id` es
             lo que decide si el botón aparece: una conversación sin contacto
             ligado no puede crear una cuenta a nombre de nadie. */
          contact_id: conv.contacts?.id || null, prueba_estado: conv.contacts?.prueba_estado || null, prueba_cuenta: conv.contacts?.prueba_cuenta || null }} />
      </div>

      {/* ── Lightbox ── */}
      {reenviar && <ModalReenviar mensaje={reenviar} api={api} actualId={conv.id} onCerrar={() => setReenviar(null)} />}
      {mejorar && <PanelMejorar mensaje={mejorar} api={api} onCerrar={() => setMejorar(null)} />}

      {/* ══ EL CORREO, SIN SALIR DEL INBOX ═══════════════════════════════ */}
      <DrawerSecuencia abierto={!!secuenciaAbierta} onCerrar={() => setSecuenciaAbierta(null)}
        secuenciaId={secuenciaAbierta?.id} nombre={secuenciaAbierta?.nombre} contactId={conv?.contact_id || null} />

      <DrawerCorreo correo={correoAbierto} onCerrar={() => setCorreoAbierto(null)}
        onVerSecuencia={o => { setCorreoAbierto(null); setSecuenciaAbierta(o); }} />

      {/* ══ ACCIONES DEL MENSAJE (táctil) ══════════════════════════════════
          Lo que en escritorio son tres iconos al pasar el ratón. El orden no
          es decorativo: «Responder» primero porque es el 90% de los casos, y
          las reacciones ARRIBA de la lista —como fila de emojis— porque son de
          un solo toque y no merecen leerse como renglón de menú. */}
      <ActionSheet
        open={!!accionesMsg}
        onClose={() => setAccionesMsg(null)}
        title={accionesMsg ? (
          <span style={{ display: 'block' }}>
            {/* textTransform en 'none' a propósito: el título de la hoja va en
                mayúsculas por diseño, pero aquí lo que se cita son las palabras
                del cliente y ponerlas a gritar se lee mal y además se entiende
                peor. Es una etiqueta de contexto, no un encabezado. */}
            <span style={{ display: 'block', fontSize: 12.5, color: C.g500, textTransform: 'none', letterSpacing: 0, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resumenMensaje(accionesMsg) || 'Mensaje'}
            </span>
            {conv.id && api.reaccionar && accionesMsg.direccion === 'entrante' && accionesMsg.kapso_message_id && (
              <span style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'space-between' }}>
                {['👍', '❤️', '😂', '😮', '🙏', '✅'].map(e => (
                  <button key={e} onClick={() => { ticListo(); api.reaccionar(accionesMsg.kapso_message_id, e); setAccionesMsg(null); }}
                    style={{ flex: 1, minHeight: 46, border: `1px solid ${C.g200}`, borderRadius: 12, background: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>{e}</button>
                ))}
              </span>
            )}
          </span>
        ) : undefined}
        items={accionesMsg ? [
          ...(conv.id && accionesMsg.kapso_message_id ? [{
            label: 'Responder',
            onClick: () => { tic(); setCita(accionesMsg); setAccionesMsg(null); },
          }] : []),
          // Copiar existe porque el gesto largo apaga el menú nativo de iOS,
          // que era de donde se copiaba antes. Se devuelve lo que se quitó.
          ...(resumenMensaje(accionesMsg) ? [{
            label: 'Copiar texto',
            onClick: async () => {
              const t = accionesMsg.cuerpo || accionesMsg.transcript || '';
              try { await navigator.clipboard.writeText(t); ticListo(); } catch { /* sin permiso de portapapeles */ }
              setAccionesMsg(null);
            },
          }] : []),
          ...(conv.id && (accionesMsg.cuerpo || accionesMsg.transcript || accionesMsg.media_url) ? [{
            label: 'Reenviar a otra conversación',
            onClick: () => { tic(); setReenviar(accionesMsg); setAccionesMsg(null); },
          }] : []),
          ...(accionesMsg.status === 'failed' && api.reintentar ? [{
            label: 'Reintentar envío',
            onClick: () => { tic(); api.reintentar(accionesMsg); setAccionesMsg(null); },
          }] : []),
        ] : []}
      />
      {cierre && <ModalCierre onCerrar={() => setCierre(false)} onResolver={async (categoria: string, nota: string) => {
        const r = await api.patchConversacion({ estado_crm: 'resuelta', cierre_categoria: categoria, cierre_nota: nota });
        if (!r?.error) setCierre(false);
        return r;
      }} />}
      {lightbox && typeof lightbox === 'object' && <VisorMedia m={lightbox} onCerrar={() => setLightbox(null)} />}
      {false && lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 20, border: 'none', background: 'none', color: '#fff', fontSize: 26, cursor: 'pointer' }}>✕</button>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/** Menú ⋯ del hilo: posponer / exportar. */
function MenuHilo({ conv, api, abierto, setAbierto, equipo, onResolver, movil, onAcciones, onBuscar, notas, onVerNotas }: { conv: any; api: any; abierto: boolean; setAbierto: (v: boolean) => void; equipo?: any[]; onResolver?: () => void; movil?: boolean; onAcciones?: () => void; onBuscar?: () => void; notas?: number; onVerNotas?: () => void }) {
  const posponer = async (hasta: Date) => { setAbierto(false); await api.patchConversacion({ snooze_until: hasta.toISOString(), no_leidos: 0 }); };
  const manana9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const lunes9 = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; };
  const dormida = conv.snooze_until && new Date(conv.snooze_until) > new Date();
  // E9 · «Recuérdame si no contesta» estaba enterrado tras el reloj de la barra
  // de herramientas (y en el teléfono, además, tras «Más»): es de lo que más se
  // usa para cerrar el ciclo, así que vive aquí.
  const [recordar, setRecordar] = useState(false);
  const [avisoRec, setAvisoRec] = useState('');
  const aLas9 = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(9, 0, 0, 0); return d; };
  const elLunes = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; };
  const recordarme = async (cuando: Date, etiqueta: string) => {
    setAvisoRec('…');
    const r = await api.programar({ tipo: 'recordatorio', ejecutar_at: cuando.toISOString(), payload: { nota: `Sin respuesta — ${etiqueta}` } });
    setAvisoRec(r?.error ? 'No se pudo programar' : 'Listo, te avisamos');
    if (!r?.error) setTimeout(() => { setAbierto(false); setRecordar(false); setAvisoRec(''); }, 900);
  };
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setAbierto(!abierto)} title="Más acciones"
        style={{ border: 'none', background: dormida ? C.ambar50 : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: dormida ? C.ambar700 : C.g400 }}>
        <IcoPuntos size={16} />
      </button>
      {abierto && <span onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 940, background: movil ? 'rgba(8,7,12,.62)' : 'transparent' }} />}
      {abierto && (
        /* En el teléfono, un volado con siete grupos tapaba la conversación
           entera. Es una hoja que sube desde abajo, con su asa, y el pulgar
           llega a todo. */
        <span className={movil ? 'menu-hoja' : undefined} style={movil
          ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 941, background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -14px 40px rgba(12,11,18,.3)', display: 'block', maxHeight: '78dvh', overflowY: 'auto', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }
          : { position: 'absolute', right: 0, top: '112%', zIndex: 941, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', minWidth: 190, display: 'block', overflow: 'hidden' }}>
          {movil && <span style={{ display: 'block', width: 40, height: 5, borderRadius: 99, background: '#e2e1e8', margin: '10px auto 6px' }} />}
          {movil && (<>
            {/* Lo que se hace DURANTE la conversación, primero: cotizar,
                agendar y buscar en el hilo. La cabecera se queda con el
                nombre, que es lo que dice con quién hablas. */}
            <span style={{ display: 'block', padding: '4px 20px 12px' }}>
              <button onClick={() => { setAbierto(false); onAcciones?.(); }}
                style={{ display: 'block', width: '100%', minHeight: 48, border: 'none', borderRadius: 12, background: C.morado, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>Cotizar o agendar</button>
            </span>
            <button onClick={() => { setAbierto(false); onBuscar?.(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '12px 20px', fontSize: 15, color: C.g700 }}>Buscar en la conversación</button>
            <button onClick={() => { setAbierto(false); document.dispatchEvent(new CustomEvent('wa-nota-interna')); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '12px 20px', fontSize: 15, color: C.g700 }}>Escribir nota interna</button>
            {/* E8.2 · Las notas del equipo viven mezcladas en el hilo; desde
                aquí se salta a la última sin buscarla a mano. */}
            {!!notas && (
              <button onClick={() => { setAbierto(false); onVerNotas?.(); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '12px 20px', fontSize: 15, color: C.g700 }}>
                Notas internas ({notas})
              </button>
            )}
            <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          </>)}
          {/* «Agendar reunión» salió de aquí: es el mismo botón que ya está en
              la barra del composer, y también estaba en la columna derecha.
              Tres caminos al mismo sitio no dan más opciones, dan la duda de si
              hacen lo mismo. «Recuérdame si no contesta» salió por lo mismo que
              lo demás: el menú tenía nueve cosas y solo tres se usan.
              Decisión del dueño (2-sep-2026). */}
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          {!movil && !!notas && (
            <button onClick={() => { setAbierto(false); onVerNotas?.(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 14px', fontSize: 12, color: C.g700 }}>
              Notas internas ({notas})
            </button>
          )}
          {equipo && (<>
            <span style={{ display: 'block', padding: '8px 12px 3px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Estado</span>
            <span style={{ display: 'flex', gap: 4, padding: '0 10px 6px' }}>
              {(['abierta', 'pendiente', 'resuelta'] as const).map(e => (
                <button key={e} onClick={() => { setAbierto(false); e === 'resuelta' ? onResolver?.() : api.patchConversacion({ estado_crm: e }); }}
                  style={{ flex: 1, border: `1px solid ${(conv.estado_crm || 'abierta') === e ? C.morado : C.g200}`, background: (conv.estado_crm || 'abierta') === e ? C.moradoAgua : '#fff', color: (conv.estado_crm || 'abierta') === e ? C.moradoTinta : C.g500, borderRadius: 999, padding: '4px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{e}</button>
              ))}
            </span>
            <span style={{ display: 'block', padding: '4px 12px 3px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Asignar a</span>
            <span style={{ display: 'block', padding: '0 10px 6px' }}>
              <select value={conv.asignado_a || ''} onChange={e => { setAbierto(false); api.patchConversacion({ asignado_a: e.target.value || null }); }}
                style={{ width: '100%', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Sin asignar</option>
                {(equipo || []).map((m: any) => <option key={m.id} value={m.id}>{m.es_agente ? '● ' : ''}{m.nombre}</option>)}
              </select>
            </span>
            <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          </>)}
          <span style={{ display: 'block', padding: movil ? '10px 20px 4px' : '8px 12px 3px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Posponer hasta</span>
          {/* Tres chips en una fila, como ESTADO: en columna se comían ~100 px
              de la hoja y empujaban lo destructivo hasta el filo de la
              pantalla, medio tapado y sin señal de que había más abajo. */}
          <span style={{ display: 'flex', gap: 8, padding: movil ? '0 20px 10px' : '0 12px 8px' }}>
            {[{ l: 'En 3 horas', f: () => new Date(Date.now() + 3 * 3600e3) }, { l: 'Mañana', f: manana9 }, { l: 'Lunes', f: lunes9 }].map(o => (
              <button key={o.l} onClick={() => posponer(o.f())}
                style={{ flex: 1, minHeight: movil ? 44 : 32, border: `1px solid ${C.g200}`, borderRadius: 999, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: movil ? 12.5 : 11.5, fontWeight: 600, color: C.g700 }}>{o.l}</button>
            ))}
          </span>
          {dormida && (
            <button onClick={() => { setAbierto(false); api.patchConversacion({ snooze_until: null }); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: movil ? '13px 20px' : '7px 12px', fontSize: movil ? 15 : 12, color: C.ambar700, fontWeight: 700 }}>Despertar ahora</button>
          )}
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          <a href={`/api/crm/whatsapp/exportar?id=${conv.id}`} download onClick={() => setAbierto(false)}
            style={{ display: 'block', padding: movil ? '13px 20px' : '9px 12px', fontSize: movil ? 15 : 12, color: C.g700, fontWeight: movil ? 500 : 600, textDecoration: 'none' }}>Exportar conversación (.txt)</a>
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          {/* Se quedaron solo tres: posponer, exportar y bloquear.
              Fuera: «Sacar del inbox», «Enviar datos del CRM a Kapso» y
              «Eliminar chat y todo su historial». */}
          <button onClick={async () => { setAbierto(false); if (!await confirmar('¿Bloquear este número en WhatsApp? Dejará de poder escribirte y la conversación se marca como spam.')) return; const r = await api.accionKapso?.({ accion: 'bloquear' }); if (r?.error) alert(r.error); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: movil ? '13px 20px' : '7px 12px', fontSize: movil ? 15 : 12, color: C.rojo700 }}>Bloquear número (spam)</button>
        </span>
      )}
    </span>
  );
}

/** Modal de cierre: categoría obligatoria + nota opcional (alimenta métricas). */
function ModalCierre({ onCerrar, onResolver }: { onCerrar: () => void; onResolver: (categoria: string, nota: string) => Promise<any> }) {
  const [cats, setCats] = useState<{ id: number; nombre: string }[]>([]);
  const [cat, setCat] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/crm/whatsapp/cierre-categorias').then(r => r.json()).then(j => setCats(j.categorias || [])).catch(() => {});
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, []);
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(440px, 100%)', padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <b style={{ fontSize: 14, display: 'block' }}>Resolver conversación</b>
        <p style={{ fontSize: 12, color: C.g500, margin: '4px 0 14px' }}>¿Cómo terminó? La categoría alimenta las métricas del inbox.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {cats.map(c => (
            <button key={c.id} onClick={() => setCat(c.nombre)}
              style={{ border: `1px solid ${cat === c.nombre ? C.emerald500 : C.g200}`, background: cat === c.nombre ? C.emerald50 : '#fff', color: cat === c.nombre ? C.emerald700 : C.g700, borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{c.nombre}</button>
          ))}
        </div>
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Nota de cierre (opcional): qué se acordó, qué sigue…"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
        {error && <p style={{ color: C.rojo500, fontSize: 11, margin: '6px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onCerrar} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button disabled={!cat || ocupado} onClick={async () => { setOcupado(true); setError(''); const r = await onResolver(cat, nota.trim()); setOcupado(false); if (r?.error) setError(r.error); }}
            style={{ border: 'none', background: !cat ? C.g200 : C.emerald600, color: '#fff', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: !cat ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {ocupado ? 'Resolviendo…' : 'Marcar resuelta'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 12) Reenviar un mensaje a otra conversación del inbox. */
function ModalReenviar({ mensaje, api, onCerrar, actualId }: { mensaje: any; api: any; onCerrar: () => void; actualId?: string | null }) {
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string[]>([]);
  const [error, setError] = useState('');
  const lista: any[] = (api.listaActual?.() || []).filter((c: any) => c.wa_id && c.wa_id !== actualId);
  const filtrada = lista.filter(c => !q.trim() || `${c.contacto?.nombre || ''} ${c.empresa?.nombre || ''} ${c.telefono}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);
  return (
    <div role="dialog" onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(440px, 100%)', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '14px 18px 8px' }}>
          <b style={{ fontSize: 14 }}>Reenviar a…</b>
          <div style={{ marginTop: 6, fontSize: 11, color: C.g500, background: C.g50, borderRadius: 8, padding: '6px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumenMensaje(mensaje)}</div>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar conversación…"
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          {error && <p style={{ color: C.rojo500, fontSize: 11, margin: '6px 0 0' }}>{error}</p>}
        </div>
        <div className="wa-scroll" style={{ overflowY: 'auto', padding: '0 8px 8px' }}>
          {filtrada.map(c => (
            <button key={c.id} disabled={!!ocupado || hecho.includes(c.id)} onClick={async () => {
              setOcupado(c.id); setError('');
              const r = await api.reenviar(mensaje, c.wa_id); setOcupado(null);
              if (r?.error) setError(r.ventana_cerrada ? `${c.contacto?.nombre || c.telefono}: ventana cerrada, necesita plantilla` : r.error); else setHecho(h => [...h, c.id]);
            }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: hecho.includes(c.id) ? C.emerald50 : 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Avatar nombre={c.contacto?.nombre} telefono={String(c.telefono || '?')} size={28} canal="wa" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contacto?.nombre || telefonoLegible(c.telefono)}</b>
                <span style={{ fontSize: 10, color: C.g400 }}>{c.empresa?.nombre || telefonoLegible(c.telefono)}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: hecho.includes(c.id) ? C.emerald700 : C.moradoTinta }}>{hecho.includes(c.id) ? 'Enviado' : ocupado === c.id ? 'Enviando…' : 'Enviar'}</span>
            </button>
          ))}
          {!filtrada.length && <div style={{ padding: 16, fontSize: 12, color: C.g400, textAlign: 'center' }}>Sin conversaciones que coincidan.</div>}
        </div>
      </div>
    </div>
  );
}


/** Minuta de llamada en el hilo: resumen colapsado, click para leerla entera. */
function MinutaCard({ item }: { item: any }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ alignSelf: 'center', width: 'min(560px, 92%)', margin: '2px 0' }}>
      <div style={{ background: '#fff', border: `1px solid #d9e9e2`, borderLeft: `3px solid ${C.emerald500}`, borderRadius: 12, overflow: 'hidden' }}>
        <button onClick={() => setAbierta(a => !a)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 13px', textAlign: 'left' }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, background: C.emerald50, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" stroke={C.emerald700} strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 12, color: C.g900, display: 'block' }}>{item.detalle}</b>
            <span style={{ fontSize: 10.5, color: C.g400 }}>{abierta ? 'Ocultar minuta' : 'Ver la minuta completa'}{item.autor ? ` · atendió ${item.autor}` : ''}</span>
          </span>
          <span style={{ color: C.g300, fontSize: 11, flexShrink: 0 }}>{abierta ? '▲' : '▼'}</span>
        </button>
        {abierta && (
          <div style={{ borderTop: `1px solid ${C.g100}`, padding: '10px 14px', fontSize: 12, color: C.g700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {String(item.minuta || '').replace(/^## /gm, '').replace(/^- /gm, '• ')}
          </div>
        )}
        {item.siguiente_paso && (
          <div style={{ borderTop: `1px solid ${C.g100}`, background: C.moradoAgua, padding: '7px 14px', fontSize: 11.5, color: C.moradoTinta }}>
            <b>Siguiente paso:</b> {item.siguiente_paso}
          </div>
        )}
      </div>
    </div>
  );
}


/** «Mejorar respuesta» sobre un mensaje del agente SDR ya enviado. Lo que
 *  escribes queda como ejemplo aprobado del estado de ese mensaje (lección de
 *  máxima prioridad) y, si quieres, sale ahora como continuación natural. */
function PanelMejorar({ mensaje, api, onCerrar }: { mensaje: any; api: any; onCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const [criterio, setCriterio] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState('');
  const envioId = mensaje?.metadata?.envio_id || null;
  const guardar = async (enviar: boolean) => {
    if (texto.trim().length < 2 || ocupado) return;
    setOcupado(true);
    const r = await fetch('/api/crm/ti/correccion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ envio_id: envioId, respuesta: texto.trim(), criterio: criterio.trim() || undefined, situacion: 'Corrección desde el inbox sobre un mensaje ya enviado del agente' }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setListo('No se guardó: ' + r.error); setOcupado(false); return; }
    if (enviar && api?.enviarTexto) await api.enviarTexto(texto.trim());
    setListo(enviar ? 'Guardado como ejemplo y enviado.' : 'Guardado como ejemplo: el agente lo usa desde el siguiente mensaje de ese estado.');
    setOcupado(false);
    setTimeout(onCerrar, 1800);
  };
  return (
    <div role="dialog" aria-label="Mejorar respuesta del agente" style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(560px, 100%)', padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280' }}>Mejorar respuesta del agente</div>
        <div style={{ fontSize: 13, color: '#374151', margin: '6px 0 10px', background: '#f3f4f6', borderRadius: 10, padding: '8px 12px', whiteSpace: 'pre-wrap' }}>{String(mensaje?.cuerpo || '').slice(0, 600)}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Escribe cómo debió responder. Queda como ejemplo del agente para este tipo de momento{envioId ? '' : ' (mensaje sin envío ligado: se guarda igual como ejemplo)'}.</div>
        <textarea autoFocus value={texto} onChange={e => setTexto(e.target.value)} rows={4} placeholder="Tu versión…" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', font: 'inherit', fontSize: 14, lineHeight: 1.45, resize: 'vertical' }} />
        <div style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 4px' }}>Qué debe considerar el agente (opcional): la regla detrás de tu cambio, para que aprenda el criterio y no solo el texto.</div>
        <textarea value={criterio} onChange={e => setCriterio(e.target.value)} rows={2} placeholder="Ej.: si hace varias preguntas, contéstalas todas en un solo mensaje y cierra con una sola pregunta" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
        {listo && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: listo.startsWith('No') ? '#7f1d1d' : '#14532d' }}>{listo}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button disabled={ocupado || texto.trim().length < 2} onClick={() => guardar(false)} style={{ border: 'none', background: '#4c1d95', color: '#fff', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Solo aprender</button>
          <button disabled={ocupado || texto.trim().length < 2 || !api?.enviarTexto} onClick={() => guardar(true)} style={{ border: '1px solid #4c1d95', background: '#fff', color: '#4c1d95', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Aprender y mandarla ahora</button>
          <button onClick={onCerrar} style={{ border: 'none', background: 'transparent', color: '#6b7280', padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}


/* ═══ Píldora del agente en la conversación ═══
 * Tres estados a la vista y un clic para cambiarlos: ACTIVO (piloto automático, morado), OBSERVANDO
 * (hilo del consultor, modo sugerencia o sombra) y APAGADO AQUÍ. «Que me sugiera» deja borradores sin mandar. */
function PildoraAgente({ contactId, conversationId, mobile, onEstado }: { contactId: string; conversationId: string; mobile: boolean; onEstado: (e: any) => void }) {
  const [e, setE] = useState<any>(null);
  const [abierto, setAbierto] = useState(false);
  const cargar = () => fetch(`/api/crm/ti/agente-hilo?contact_id=${contactId}`).then(r => r.json()).then(x => { setE(x); onEstado(x); }).catch(() => {});
  useEffect(() => { setE(null); cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t); }, [contactId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return null;
  const col = e.estado === 'activo' ? { bg: '#EEECFE', fg: '#4c1d95', bd: '#c9c1ea' } : e.estado === 'observando' ? { bg: '#f3f4f6', fg: '#4a4658', bd: '#e5e7eb' } : { bg: '#fff1f2', fg: '#7f1d1d', bd: '#fecdd3' };
  const label = e.estado === 'activo' ? 'Agente IA activo' : e.estado === 'observando' ? (e.modo_sugerencia ? 'Agente IA sugiere' : 'Agente IA observando') : 'Agente IA apagado aquí';
  const accion = async (a: string) => { setAbierto(false); const r = await fetch('/api/crm/ti/agente-hilo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, conversation_id: conversationId, accion: a }) }).then(x => x.json()).catch(() => null); if (r && !r.error) { setE(r); onEstado(r); } };
  /* YA NO se encoge. Antes cedía espacio como los selects y acababa en «● I»
     con el texto cortado: había que pasar el ratón para saber si el agente
     estaba contestando solo, sugiriendo o apagado — y eso es lo primero que
     necesitas saber antes de escribirle a este lead. El header ahora envuelve,
     así que hay dónde ponerlo entero. */
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setAbierto(a => !a)} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${col.bd}`, background: col.bg, color: col.fg, borderRadius: 999, padding: mobile ? '3px 8px' : '5px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: col.fg, opacity: .9, flexShrink: 0 }} />{e.estado === 'activo' ? 'IA activa' : e.estado === 'observando' ? (e.modo_sugerencia ? 'IA sugiere' : 'IA observa') : 'IA apagada'}
      </button>
      {abierto && (
        <span style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, background: '#fff', border: '1px solid #e8e5f0', borderRadius: 12, boxShadow: '0 10px 30px rgba(16,24,40,.14)', padding: 8, minWidth: 250, display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8e88a8', padding: '2px 6px' }}>{label} · en esta conversación</span>
          {[['activar', 'Activar: que conteste solo', e.estado === 'activo' && !e.modo_sugerencia], ['sugerir', 'Que me sugiera (no manda nada)', e.modo_sugerencia], ['apagar', 'Apagar aquí: no vuelve a tocar este lead', e.estado === 'apagado']].map(([a, l, on]: any) => (
            <button key={a} onClick={() => accion(a)} style={{ textAlign: 'left', border: 'none', background: on ? '#EEECFE' : 'transparent', color: on ? '#4c1d95' : '#241d43', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontWeight: on ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
          {e.sombra && <span style={{ fontSize: 10.5, color: '#8e88a8', padding: '4px 6px' }}>El agente está en modo sombra: solo manda a números de prueba.</span>}
          {e.asignado === 'humano' && !e.modo_sugerencia && <span style={{ fontSize: 10.5, color: '#8e88a8', padding: '4px 6px' }}>El hilo es de un consultor: el agente observa hasta que lo actives.</span>}
        </span>
      )}
    </span>
  );
}
