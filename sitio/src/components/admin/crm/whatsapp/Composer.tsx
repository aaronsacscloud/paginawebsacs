// WHATSAPP · Composer PRO (portado de sacs_inbox/ChatArea): card con fila de
// canal, toolbar en el orden exacto [IA | emoji @ snippets 📎 plantillas | mic],
// popups bottom-full, staged files con validación WhatsApp, grabación de voz
// con waveform, modo comentario que REEMPLAZA la card, y degradación total
// cuando la ventana de 24 h está cerrada. Correo es nuestro canal extra.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Corazones } from '../ui/Cargando';
import { useIsMobile } from '../../../../lib/ui/mobile';
import { C, toolBtn, popup } from './estilo';
import ModalInteractivo from './Interactivos';
import MockupWhatsApp from './MockupWhatsApp';
import { optimizarImagen } from '../../../../lib/crm/imagen';
import { IcoVarita, IcoEmoji, IcoArroba, IcoMarcador, IcoClip, IcoMic, IcoEnviar, IcoBuscar, IcoChispas, IcoBurbuja, IcoChevronDer, IcoDoc, IcoCotizacion, IcoCalendario, IcoCamara } from './Iconos';
import { BadgeWhatsApp, BadgeCorreo } from './Iconos';
import { esMP4, mp4OpusAOgg } from '../../../../lib/whatsapp/ogg';
import { marcarReciente, ordenarPorReciente, cuantosRecientes, leerRecientes } from '../../../../lib/crm/recientes';
import { tic, ticListo, ticError } from '../../../../lib/ui/tacto';

type Modo = 'wa' | 'correo' | 'nota';
type Popup = 'cotizacion' | 'agendar' | null | 'ia' | 'emoji' | 'variables' | 'snippets' | 'adjuntar' | 'prueba';

// ── Catálogos portados ──
const EMOJI_CATS: { id: string; icono: string; nombre: string; lista: string[] }[] = [
  { id: 'frecuentes', icono: '🕐', nombre: 'Frecuentes', lista: ['👍', '❤️', '😂', '🙏', '😊', '🎉', '👏', '🔥', '✅', '😍', '🙌', '💪', '👌', '😅', '🤝', '💯', '🥳', '😉', '🙂', '☺️'] },
  { id: 'smileys', icono: '😀', nombre: 'Smileys', lista: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😔', '😕', '🙁', '☹️', '😖', '😞', '😟', '😤', '😢', '😭', '😩', '🥺', '😬', '🤯', '😳', '🥵', '🥶', '😱', '😨'] },
  { id: 'manos', icono: '👋', nombre: 'Manos', lista: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'] },
  { id: 'corazones', icono: '❤️', nombre: 'Corazones', lista: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'] },
  { id: 'animales', icono: '🐶', nombre: 'Animales', lista: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝', '🦋', '🐙', '🐳', '🦉'] },
  { id: 'comida', icono: '🍕', nombre: 'Comida', lista: ['🍕', '🍔', '🌮', '🌯', '🍟', '🍗', '🥗', '🍰', '🎂', '🍩', '🍪', '☕', '🍺', '🍷', '🥤', '🍎', '🍌', '🍇', '🍓', '🥑'] },
  { id: 'actividades', icono: '⚽', nombre: 'Actividades', lista: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎯', '🎮', '🎲', '🎸', '🎤', '🎧', '🎬', '🎨', '🏆', '🥇', '🎁', '🎈', '🎊', '🎉'] },
  { id: 'viajes', icono: '🚗', nombre: 'Viajes', lista: ['🚗', '🚕', '🚌', '🚚', '✈️', '🚀', '🛳️', '🏠', '🏢', '🏪', '🏬', '🏦', '🗺️', '📍', '🌎', '🌙', '☀️', '⛅', '🌧️', '⚡'] },
  { id: 'objetos', icono: '💡', nombre: 'Objetos', lista: ['💡', '📱', '💻', '⌚', '📷', '📦', '📄', '📝', '📌', '📎', '✂️', '🔑', '🔒', '💳', '💰', '💵', '🛒', '🛍️', '🎟️', '📣'] },
  { id: 'simbolos', icono: '✅', nombre: 'Símbolos', lista: ['✅', '❌', '⚠️', '❗', '❓', '💯', '🔴', '🟢', '🟡', '🔵', '⭐', '✨', '💫', '🔔', '🔕', '➡️', '⬅️', '🔄', '🆕', '🆓'] },
];

const VARIABLES = [
  { key: 'nombre', l: 'Nombre' }, { key: 'primer_nombre', l: 'Primer nombre' }, { key: 'email', l: 'Email' },
  { key: 'telefono', l: 'Teléfono' }, { key: 'empresa', l: 'Empresa' }, { key: 'plan', l: 'Plan' }, { key: 'etapa', l: 'Etapa' },
];

const IA_ACCIONES = [
  { id: 'tono', l: 'Cambiar tono', sub: ['Profesional', 'Amigable', 'Casual', 'Formal', 'Empático'] },
  { id: 'traducir', l: 'Traducir', sub: ['Inglés', 'Español', 'Portugués', 'Francés'] },
  { id: 'ortografia', l: 'Corregir ortografía y gramática' },
  { id: 'simplificar', l: 'Simplificar lenguaje' },
];

/* Estos popovers los monta media pantalla y no reciben `movil` por props; se
   le pregunta al aparato. Sirve para NO levantar el teclado al abrirlos. */
const esTactil = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

const LIMITES: Record<string, number> = { image: 5, video: 16, audio: 16, document: 100 };  // MB
const claseDe = (mime: string) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
const emojiTipo: Record<string, string> = { image: '🖼️', video: '🎬', audio: '🎵', document: '📄' };

export default function Composer({ ventana, api, telefono, equipo = [], canales, contacto, cita, onQuitarCita, borradorInicial, onBorrador, onEscribir, siguiente, sugerencias = [], movil, alerta }: {
  ventana: any; api: any; telefono: string; equipo?: any[]; canales?: any; contacto?: any;
  cita?: any; onQuitarCita?: () => void;
  borradorInicial?: string; onBorrador?: (t: string) => void;
  onEscribir?: () => void;                 // 6) presencia "escribiendo…"
  siguiente?: () => boolean;               // 2) abrir la siguiente sin responder
  sugerencias?: any[];                     // L4: temas relevantes de la etapa del contacto
  /** En el teléfono: caja de escritura alta, tipografía de 16 (iOS no hace
   *  zoom) y solo tres herramientas a la vista; el resto, tras «Más». */
  movil?: boolean;
  /** La alerta de la conversación (límite de Meta, etc.). Con la ventana
   *  cerrada se pinta AQUÍ, en el mismo panel, en vez de en una segunda banda
   *  ámbar arriba. */
  alerta?: string | null;
}) {
  const [preselTema, setPreselTema] = useState<string | null>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const ultimoPingRef = useRef(0);
  const pingEscribir = () => { const t = Date.now(); if (t - ultimoPingRef.current > 4000) { ultimoPingRef.current = t; onEscribir?.(); } };
  const [remotos, setRemotos] = useState<{ url: string; nombre: string; clase: string; mime?: string }[]>([]);   // 8) adjuntos por URL (snippets/biblioteca)
  const [popProgramar, setPopProgramar] = useState(false);
  const [modalInteractivo, setModalInteractivo] = useState(false);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  useEffect(() => { fetch('/api/crm/whatsapp/ajustes').then(r => r.json()).then(j => setCatalogId(j?.catalog_id || null)).catch(() => {}); }, []);
  const [programados, setProgramados] = useState<any[]>([]);
  const [sugerirSiguiente, setSugerirSiguiente] = useState(false);
  const cargarProgramados = () => { api.listarProgramados?.().then((l: any[]) => setProgramados(l || [])); };
  // Elegir un snippet (desde "/" o desde el popup): texto + su adjunto si lo tiene.
  const usarSnippet = (r: any) => {
    tic();
    setTexto(r.texto);
    if (r.media_url) setRemotos(rs => rs.some(x => x.url === r.media_url) ? rs : [...rs, { url: r.media_url, nombre: r.titulo || r.atajo || 'archivo', clase: r.media_tipo || 'document' }]);
    api.marcarUsoRespuesta?.(r.id); setPop(null); areaRef.current?.focus();
  };
  useEffect(() => { cargarProgramados(); }, [canales?.wa_id]);
  const waDisponible = canales?.whatsapp !== false;
  const correoOk = !!canales?.correo?.ok;
  const [texto, setTextoRaw] = useState(borradorInicial || '');
  // Borrador por conversación: lo que se teclea sobrevive a cambiar de chat.
  const setTexto = (v: string | ((t: string) => string)) => setTextoRaw(t => { const n = typeof v === 'function' ? v(t) : v; onBorrador?.(n); return n; });
  useEffect(() => { if (cita) areaRef.current?.focus(); }, [cita]);
  const [asunto, setAsunto] = useState('');
  const [modo, setModo] = useState<Modo>(waDisponible ? 'wa' : 'correo');
  const [comentario, setComentario] = useState(false);     // modo comentario (reemplaza la card)
  const [ocupado, setOcupado] = useState(false);
  const [error, setErrorRaw] = useState('');
  const [errorDet, setErrorDet] = useState<any>(null);
  const setError = (m: string, det: any = null) => { setErrorRaw(m); setErrorDet(det); };
  const [aviso, setAviso] = useState('');
  // Un mensaje que quedó en cola NO es un éxito verde: se dice en ámbar, que
  // es «atención, todavía no sale».
  const [avisoTono, setAvisoTono] = useState<'ok' | 'espera'>('ok');
  // E4 · Las 3 plantillas que se usaron más recientemente. Es el atajo del
  // caso donde más conversaciones se mueren: la ventana de 24 h ya cerró y hay
  // que reabrir con plantilla. Se piden solo cuando hacen falta.
  const [recientes, setRecientes] = useState<any[]>([]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);
  const [escribiendoMovil, setEscribiendoMovil] = useState(false);  // móvil: al enfocar, la caja crece
  // El dedo va a la barra de herramientas: el `blur` del textarea llega ANTES
  // del click y encogía el composer justo debajo del pulgar, así que el toque
  // caía en el vacío (pasaba con el clip, con el micrófono y con «Más»).
  const tocandoBarra = useRef(false);
  const [masHerramientas, setMasHerramientas] = useState(false);    // móvil: el resto de la barra
  const [pop, setPop] = useState<Popup>(null);
  const [modalPlantilla, setModalPlantilla] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const [staged, setStaged] = useState<{ file: File; url: string; errores: string[] }[]>([]);
  // Qué adjunto va saliendo y por dónde. Antes solo se deshabilitaba el botón:
  // una foto de 5 MB por datos son ~20 segundos sin saber si avanza o si ya se
  // murió, que es la diferencia entre esperar y no saber si esperar.
  const [envio, setEnvio] = useState<{ i: number; n: number; pct: number | null } | null>(null);
  // BUG QUE ESTO ARREGLA: la barra del composer se escondía en reposo mirando
  // SOLO si había texto. Con una foto adjunta y sin escribir nada, en el
  // teléfono no aparecía el botón de enviar por ningún lado: se podía elegir la
  // foto y no había forma de mandarla salvo escribir algo primero. Un adjunto
  // en cola ya es «algo que mandar», con o sin letras.
  const hayQueMandar = () => !!texto || staged.length > 0 || remotos.length > 0;
  const [resumen, setResumen] = useState<any>(null);
  const [iaProcesando, setIaProcesando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!waDisponible && modo === 'wa') setModo('correo'); }, [waDisponible]);
  // Escape cierra popups del composer y NO debe llegar al atajo global que
  // cierra el chat: se captura antes (fase capture) solo cuando hay algo abierto.
  const hayAlgoAbierto = !!pop || popProgramar || comentario || modalPlantilla || biblioteca || modalInteractivo;
  const abiertoRef = useRef(hayAlgoAbierto); abiertoRef.current = hayAlgoAbierto;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !abiertoRef.current) return;
      e.stopPropagation();
      setPop(null); setPopProgramar(false); setModalPlantilla(false); setBiblioteca(false); setModalInteractivo(false);
      setComentario(false);
    };
    window.addEventListener('keydown', esc, true); return () => window.removeEventListener('keydown', esc, true);
  }, []);
  useEffect(() => {
    const abrir = () => setModalPlantilla(true);
    const correo = () => { if (correoOk) { setModo('correo'); areaRef.current?.focus(); } };
    document.addEventListener('wa-abrir-plantillas', abrir); document.addEventListener('wa-modo-correo', correo);
    return () => { document.removeEventListener('wa-abrir-plantillas', abrir); document.removeEventListener('wa-modo-correo', correo); };
  }, [correoOk]);

  // Snippets (respuestas rápidas completas)
  const [snippets, setSnippets] = useState<any[]>([]);
  const [nuevoSnippet, setNuevoSnippet] = useState<{ atajo: string; texto: string } | null>(null);
  const cargarSnippets = () => fetch('/api/crm/whatsapp/respuestas').then(r => r.json()).then(j => setSnippets(j.respuestas || [])).catch(() => {});
  useEffect(() => { cargarSnippets(); }, []);
  const slash = modo !== 'nota' && !comentario && texto.startsWith('/')
    ? snippets.filter(r => `/${r.atajo}`.startsWith(texto.toLowerCase().split(' ')[0])).slice(0, 6) : [];
  const arroba = comentario ? (texto.match(/@([\wáéíóúñ]*)$/i)?.[1] ?? null) : null;
  const sugerenciasEquipo = arroba != null ? equipo.filter((m: any) => m.nombre.toLowerCase().startsWith(arroba.toLowerCase())).slice(0, 5) : [];

  // Variables resueltas contra el contacto real (preview de snippets)
  const datosVar: Record<string, string> = useMemo(() => ({
    nombre: contacto?.nombre || '', primer_nombre: (contacto?.nombre || '').split(' ')[0] || '',
    email: contacto?.email || '', telefono: telefono || '', empresa: contacto?.empresa || '',
    plan: contacto?.plan || '', etapa: contacto?.etapa || '',
  }), [contacto, telefono]);
  const resolver = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_m, k) => datosVar[k] ?? `{{${k}}}`);

  const cerrada = ventana && !ventana.abierta;
  const bloqueadoWa = modo === 'wa' && !comentario && (cerrada || !waDisponible);
  const bloqueadoCorreo = modo === 'correo' && !comentario && !correoOk;
  const necesitaAsunto = modo === 'correo' && !canales?.correo?.conversation_id;

  const insertarEnCursor = (frag: string) => {
    const el = areaRef.current;
    if (!el) { setTexto(t => t + frag); return; }
    const ini = el.selectionStart ?? texto.length, fin = el.selectionEnd ?? texto.length;
    const nuevo = texto.slice(0, ini) + frag + texto.slice(fin);
    setTexto(nuevo);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + frag.length; });
  };

  const validar = (f: File): string[] => {
    const cls = claseDe(f.type);
    const lim = LIMITES[cls]; const mb = f.size / 1048576;
    const errs: string[] = [];
    if (mb > lim) errs.push(`Archivo excede ${lim} MB (límite para ${cls})`);
    return errs;
  };
  const agregarArchivos = async (files: FileList | null) => {
    if (!files) return;
    setPop(null);
    for (const f of Array.from(files)) {
      let file = f;
      if (/^image\//.test(f.type) && !/svg|gif/.test(f.type)) {
        // Optimiza en el navegador: llega ligera a WhatsApp y no topa el límite de 5 MB.
        try { const o = await optimizarImagen(f, 'libre'); file = new File([o.blob], o.nombre, { type: o.mime }); } catch { /* se manda tal cual */ }
      }
      setStaged(s => [...s, { file, url: URL.createObjectURL(file), errores: validar(file) }]);
    }
  };

  // La hoja del menú puede pedir una nota interna: con la ventana cerrada no
  // hay barra de herramientas donde tocarla, y es justo cuando hace falta.
  useEffect(() => {
    const h = () => { setComentario(true); setTexto(''); setTimeout(() => areaRef.current?.focus(), 60); };
    document.addEventListener('wa-nota-interna', h);
    return () => document.removeEventListener('wa-nota-interna', h);
  }, []);

  useEffect(() => {
    if (!cerrada || modo !== 'wa') return;
    fetch('/api/crm/whatsapp/plantillas?recientes=1').then(r => r.json())
      .then(j => setRecientes(j.plantillas || [])).catch(() => {});
  }, [cerrada, modo]);

  const enviar = async () => {
    const t = resolver(texto.trim());
    if (ocupado) return;
    if (comentario) {
      if (!t) return;
      setOcupado(true); const r = await api.crearNota(t); setOcupado(false);
      if (r?.error) { setError(r.error, r.error_detalle || null); return; }
      setTexto(''); setComentario(false); return;
    }
    if (!t && !staged.length && !remotos.length) return;
    setOcupado(true); setError(''); setAviso(''); setSugerirSiguiente(false);
    let r: any;
    if (modo === 'correo') {
      if (necesitaAsunto && !asunto.trim()) { setOcupado(false); setError('Un correo nuevo necesita asunto.'); return; }
      r = await api.enviarCorreo({ texto: t, asunto: asunto.trim() || undefined });
      if (r?.ok) { setAvisoTono('ok'); setAviso('Correo enviado.'); setAsunto(''); }
    } else if (staged.length) {
      if (staged.some(s => s.errores.length)) { setOcupado(false); setError('Corrige los archivos marcados en rojo.'); return; }
      // Solo el primer archivo lleva el caption (regla de WhatsApp).
      for (let i = 0; i < staged.length; i++) {
        setEnvio({ i, n: staged.length, pct: 0 });
        r = await api.enviarArchivo(staged[i].file, i === 0 ? t : undefined, false, i === 0 ? (cita?.kapso_message_id || null) : null,
          (pct: number | null) => setEnvio(e => (e && e.i === i ? { ...e, pct } : e)));
        if (r?.error) break;
      }
      if (!r?.error) setStaged([]);
    } else if (remotos.length) {
      // 8) adjuntos por URL (snippet con archivo / biblioteca): el caption va en el primero.
      for (let i = 0; i < remotos.length; i++) {
        const a = remotos[i];
        r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: canales?.wa_id || undefined, telefono, media_url: a.url, clase: a.clase, nombre: a.nombre, mime: a.mime, caption: i === 0 ? (t || undefined) : undefined, cita: i === 0 ? (cita?.kapso_message_id || undefined) : undefined }) })
          .then(x => x.json()).catch(e => ({ error: String(e) }));
        if (r?.error) break;
      }
      if (!r?.error) { setRemotos([]); api.refrescar?.(); }
    } else r = await api.enviarTexto(t, cita?.kapso_message_id || null);
    setOcupado(false); setEnvio(null);   // aquí y no dentro de una rama: si falla
                                         // a media subida, la barra se congelaba.

    // El resultado se confirma también por el dedo: mandar es la acción que más
    // se repite del día y mirar la pantalla para saber si entró es el impuesto
    // que se está quitando. Dos golpes = falló, y eso se distingue sin ver.
    if (r?.error) ticError(); else ticListo();
    if (!r?.error) { onQuitarCita?.(); if (modo === 'wa' && siguiente && !r?.encolado) setSugerirSiguiente(true); }
    if (r?.ventana_cerrada) { setModalPlantilla(true); return; }
    if (r?.error) { setError(r.error, r.error_detalle || null); return; }
    // Quedó en la cola: el texto se limpia igual (el mensaje ya no vive aquí,
    // vive en el hilo como pendiente) pero se dice lo que pasó.
    if (r?.encolado) { setAvisoTono('espera'); setAviso('Sin conexión: el mensaje se manda solo cuando vuelva la señal.'); }
    setTexto(''); areaRef.current?.focus();
  };

  const transformar = async (instruccion: string) => {
    if (!texto.trim()) { setError('Escribe algo primero para que la IA lo edite.'); return; }
    setPop(null); setIaProcesando(true); setError('');
    const r = await api.ia({ accion: 'transformar', texto, instruccion });
    setIaProcesando(false);
    if (r?.error) { setError(r.error, r.error_detalle || null); return; }
    if (r?.texto) setTexto(r.texto);
  };
  const resumir = async () => {
    setIaProcesando(true); setError('');
    const r = await api.ia({ accion: 'resumir' });
    setIaProcesando(false);
    if (r?.error) { setError(r.error, r.error_detalle || null); return; }
    setResumen(r);
  };

  // ── Fila de canal ──
  // En el teléfono esta fila era pura etiqueta: «WhatsApp Sacscloud · a +52…»
  // ocupaba el ancho entero y empujaba «Resumir» fuera de la pantalla. Queda
  // el icono del canal (que sí informa por dónde sale el mensaje), el selector
  // cuando hay dos canales, y la acción.
  const FilaCanal = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: movil ? '6px 12px' : '8px 12px', borderBottom: `1px solid ${C.g100}` }}>
      {/* En el teléfono, el badge verde repetía lo que el selector de al lado ya
          dice con letras; era el único verde decorativo que quedaba. */}
      {movil ? (modo === 'correo' ? <BadgeCorreo size={16} /> : null) : (modo === 'correo' ? <BadgeCorreo size={16} /> : <BadgeWhatsApp size={16} />)}
      {!movil && <span style={{ fontSize: 12, fontWeight: 600, color: C.g700, whiteSpace: 'nowrap', flexShrink: 0 }}>{modo === 'correo' ? 'Correo' : 'WhatsApp'} Sacscloud</span>}
      {!movil && <span style={{ fontSize: 11, color: C.g400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '0 1 auto' }}>· a {modo === 'correo' ? (canales?.correo?.email || '—') : telefono}</span>}
      {(waDisponible && correoOk) && (
        <select value={modo} onChange={e => setModo(e.target.value as Modo)}
          style={{ border: `1px solid ${C.g200}`, borderRadius: movil ? 10 : 6, minHeight: movil ? 44 : undefined, fontSize: movil ? 13 : 11, padding: movil ? '0 10px' : '2px 4px', fontFamily: 'inherit', color: C.g500, background: '#fff', cursor: 'pointer' }}>
          <option value="wa">WhatsApp</option><option value="correo">Correo</option>
        </select>
      )}
      <span style={{ flex: 1 }} />
      {/* «Resumir» es ayuda, no la acción de la pantalla: en el teléfono
          competía con Enviar (borde morado, negritas y chispa, del mismo peso).
          Queda como texto morado a secas. */}
      <button onClick={resumir} disabled={iaProcesando}
        style={{ border: movil ? 'none' : `1px solid #c9bcf7`, borderRadius: 8, minHeight: movil ? 44 : undefined, padding: movil ? '0 8px' : '3px 10px', background: movil ? 'none' : '#fff', color: movil ? C.morado : C.moradoTinta, fontSize: movil ? 12.5 : 11, fontWeight: movil ? 600 : 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {!movil && <IcoChispas size={12} />} Resumir
      </button>
    </div>
  );

  // ── Modo comentario: reemplaza la card entera ──
  if (comentario) {
    return (
      <div style={{ padding: '10px 16px 12px', background: '#fff', borderTop: `1px solid ${C.g100}` }}>
        <div style={{ border: `2px solid ${C.ambar300}`, background: 'rgba(255,251,235,.6)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: C.ambar400, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>Yo</span>
            <textarea ref={areaRef} autoFocus value={texto} rows={2}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Usa @ para mencionar. Solo visible para tu equipo."
              style={{ flex: 1, resize: 'none', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }} />
            <button onClick={() => { setComentario(false); setTexto(''); }} title="Salir del comentario"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.ambar700, fontSize: 14 }}>✕</button>
          </div>
          {sugerenciasEquipo.length > 0 && (
            <div style={{ margin: '6px 0 0 38px', border: `1px solid ${C.ambar200}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              {sugerenciasEquipo.map((m: any) => (
                <button key={m.id} onClick={() => { setTexto(texto.replace(/@[\wáéíóúñ]*$/i, `@${m.nombre.split(' ')[0]} `)); areaRef.current?.focus(); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 10px', fontSize: 12, color: C.ambar700, fontWeight: 600 }}>@{m.nombre}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 8, paddingLeft: 38 }}>
            <button style={{ ...toolBtn(pop === 'emoji'), padding: 4 }} onClick={() => setPop(pop === 'emoji' ? null : 'emoji')}><IcoEmoji size={16} /></button>
            <button style={{ ...toolBtn(pop === 'variables'), padding: 4 }} onClick={() => setPop(pop === 'variables' ? null : 'variables')}><IcoArroba size={16} /></button>
            <span style={{ flex: 1 }} />
            <button onClick={enviar} disabled={!texto.trim() || ocupado}
              style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: texto.trim() ? C.ambar500 : C.g200, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {ocupado ? <Corazones size={8} color="#fff" /> : <IcoEnviar size={14} />}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            {pop === 'emoji' && <PopEmoji onElegir={e => insertarEnCursor(e)} left={38} />}
            {pop === 'variables' && <PopVariables onElegir={k => insertarEnCursor(`{{${k}}}`)} left={70} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 16px 8px', background: '#fff', borderTop: `1px solid ${C.g100}` }}>
      {resumen && (
        <div style={{ background: C.azulAgua, border: `1px solid ${C.azulBorde}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, fontSize: 12, position: 'relative' }}>
          <b style={{ fontSize: 11, color: C.azulTinta, display: 'block', marginBottom: 4 }}>Resumen de conversación · sentimiento {resumen.sentimiento}</b>
          {(resumen.resumen || []).map((r: string, i: number) => <div key={i} style={{ color: C.g700, lineHeight: 1.5 }}>• {r}</div>)}
          {(resumen.pendientes || []).length > 0 && <div style={{ marginTop: 4, color: C.ambar700 }}>Pendientes: {resumen.pendientes.join(' · ')}</div>}
          <button onClick={() => setResumen(null)} style={{ position: 'absolute', top: 6, right: 8, border: 'none', background: 'none', cursor: 'pointer', color: C.azulTinta }}>✕</button>
        </div>
      )}

      {/* Los chips de sugerencias («Temas de la etapa») se quitaron a pedido
          del usuario: estaban de más sobre el composer. */}
      {/* En el teléfono la tarjeta NO recorta: los menús del composer (adjuntar,
          IA, snippets) salen hacia arriba y con `overflow:hidden` se cortaban a
          la mitad. En escritorio se conserva para redondear las esquinas. */}
      {/* En reposo el composer es una línea; al enfocarlo aparecen la fila de
          canal y la de acciones, y la caja crece 118 px DE GOLPE. Medido a
          390 px: ese salto es lo que el usuario describió como "hace un efecto
          todo raro". La altura se anima para que crezca en vez de saltar —
          160 ms, lo justo para que el ojo lo siga sin sentir que va lento. Quien
          pide menos movimiento no ve animación, solo el resultado. */}
      <div className="wa-comp-caja" style={{ border: `1px solid ${C.g200}`, borderRadius: 12, background: '#fff', position: 'relative', overflow: movil ? 'visible' : 'hidden' }}>
        {/* La fila de canal («WhatsApp · Resumir») también se guarda mientras
            no se escribe: en reposo el composer es una línea y ya. */}
        {(!movil || escribiendoMovil || !!texto) && <FilaCanal />}
        {cita && modo === 'wa' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: C.emerald50, borderBottom: `1px solid #A7F3D0`, fontSize: 11 }}>
            <span style={{ width: 3, alignSelf: 'stretch', background: C.emerald500, borderRadius: 2 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: 'block', fontSize: 10, color: C.emerald700 }}>Respondiendo a {cita.direccion === 'saliente' ? (cita.autor || 'Equipo SACS') : 'cliente'}</b>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.g500 }}>{cita.transcript || cita.cuerpo || cita.filename || cita.tipo}</span>
            </span>
            <button onClick={onQuitarCita} aria-label="Quitar cita" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 13 }}>✕</button>
          </div>
        )}

        {modo === 'wa' && cerrada && (
          /* Que hayan pasado 24 h es operación normal, no un error del sistema:
             el panel usa la superficie del composer y basta el triángulo como
             señal. En ámbar completo era el objeto más brillante de la app. */
          <div className="wa-cerrada" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: movil ? '#fff' : C.ambar50, borderBottom: `1px solid ${movil ? C.g100 : C.ambar200}`, padding: '8px 12px', fontSize: 12, color: movil ? C.g700 : C.ambar700 }}>
            <span>⚠</span>
            {/* En el teléfono la frase larga empujaba los atajos fuera de la
                pantalla: ahí basta con nombrar el problema. */}
            <span style={{ flex: 1, minWidth: movil ? 0 : 160 }}>
              {movil ? <>Ventana de 24 h cerrada — usa una <b>plantilla</b>.</>
                : <>Ventana de 24h cerrada. Usa una <b>plantilla</b> para reiniciar la conversación{correoOk ? ' o cambia a correo' : ''}.</>}
              {/* Sin recorte: cortado a dos líneas nadie se enteraba de cuál era
                  el límite ni hasta cuándo. Con el botón abajo hay ancho de
                  sobra para leerlo. */}
              {movil && alerta && <span style={{ display: 'block', marginTop: 3, color: C.g700 }}>{alerta}</span>}
            </span>
            <button className="wa-cta-plantilla" onClick={() => setModalPlantilla(true)} style={{ border: 'none', borderRadius: movil ? 10 : 8, minHeight: movil ? 44 : undefined, width: movil ? '100%' : undefined, padding: movil ? '0 16px' : '5px 12px', background: movil ? C.morado : C.ambar200, color: movil ? '#fff' : C.ambar700, fontSize: movil ? 13.5 : 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Enviar plantilla</button>
            {correoOk && <button onClick={() => setModo('correo')} style={{ border: `1px solid ${C.ambar200}`, borderRadius: 8, padding: '5px 12px', background: '#fff', color: C.ambar700, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cambiar a correo</button>}
            {recientes.length > 0 && (
              <span className="wa-recientes" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                {!movil && <span style={{ fontSize: 11, color: C.ambar700, alignSelf: 'center', whiteSpace: 'nowrap', flex: 'none' }}>Últimas usadas:</span>}
                {/* En el teléfono, dos completas antes que tres cortadas: la
                    tercera quedaba rebanada por el marco a media palabra. */}
                {(movil ? recientes.slice(0, 2) : recientes).map((p: any) => (
                  <button key={p.nombre + p.idioma} onClick={() => { setPreselTema(p.nombre); setModalPlantilla(true); }}
                    title={p.cuerpo || p.nombre}
                    style={{ border: `1px solid ${movil ? C.g200 : C.ambar200}`, borderRadius: 999, padding: '0 12px', minHeight: 32, background: '#fff', color: movil ? C.g700 : C.ambar700, fontSize: 11.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit', flex: movil ? '1 1 0' : undefined, minWidth: 0, maxWidth: movil ? undefined : 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(p.nombre).replace(/_/g, ' ')}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}
        {bloqueadoCorreo && <div style={{ padding: '8px 12px', fontSize: 12, color: C.ambar700, background: C.ambar50, borderBottom: `1px solid ${C.ambar200}` }}>{canales?.correo?.motivo || 'El canal de correo no está disponible.'}</div>}
        {modo === 'correo' && necesitaAsunto && correoOk && (
          <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto del correo…"
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: `1px solid ${C.azulBorde}`, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fbfdff', outline: 'none' }} />
        )}

        {/* Textarea / grabación */}
        <Grabadora activa={modo === 'wa' && !bloqueadoWa} onEnviar={async (blob) => {
          setOcupado(true); setError('');
          let f = new File([blob], 'voz.ogg', { type: blob.type || 'audio/ogg' });
          const r = await api.enviarArchivo(f, undefined, true);
          setOcupado(false);
          if (r?.ventana_cerrada) setModalPlantilla(true); else if (r?.error) setError(r.error, r.error_detalle || null);
        }} onMicError={m => setError(m)}>
          {({ grabando, iniciar }) => (<>
            {!grabando && (
              <textarea ref={areaRef} value={texto} rows={1}
                onFocus={() => { if (movil) setEscribiendoMovil(true); }}
                onBlur={() => { if (!movil || texto) return; setTimeout(() => { if (!tocandoBarra.current) setEscribiendoMovil(false); }, 140); }}
                onChange={e => {
                  setTexto(e.target.value); pingEscribir();
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, movil ? (escribiendoMovil ? 168 : 44) : 120) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder={
                  bloqueadoWa ? 'Ventana de 24h cerrada — envía una plantilla'
                    : bloqueadoCorreo ? 'Canal de correo no disponible'
                      : staged.some(s => claseDe(s.file.type) === 'audio') ? 'Los audios no soportan caption'
                        : modo === 'correo' ? 'Escribe el correo… (Enter envía)'
                          : "Escribe un mensaje... usa '/' para snippets"}
                disabled={bloqueadoWa || bloqueadoCorreo}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'none', border: 'none', padding: movil ? '12px 14px' : '10px 12px', fontSize: movil ? 16 : 13, fontFamily: 'inherit', outline: 'none', background: (bloqueadoWa || bloqueadoCorreo) ? C.g50 : '#fff', lineHeight: 1.5, minHeight: movil ? 44 : undefined, maxHeight: movil ? (escribiendoMovil ? 168 : 44) : 120, borderRadius: 0 }} />
            )}
            {/* Staged files */}
            {staged.length > 0 && !grabando && (
              <div style={{ display: 'flex', gap: 8, padding: '4px 12px 8px', flexWrap: 'wrap' }}>
                {staged.map((s, i) => {
                  const cls = claseDe(s.file.type);
                  return (
                    <div key={i} className="wa-staged" style={{ position: 'relative', width: 80 }}>
                      {/* `relative` aquí: el velo de progreso se ancla a la
                          MINIATURA. Colgado del contenedor tapaba también el
                          nombre del archivo, que es lo único que distingue un
                          adjunto de otro mientras suben. */}
                      <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', background: C.g100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: s.errores.length ? `0 0 0 2px ${C.rojo300}` : 'none' }}>
                        {cls === 'image' ? <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : cls === 'video' ? <video src={s.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : emojiTipo[cls]}
                        {envio && envio.i === i && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,.58)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: '#fff' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                              {envio.pct == null ? 'Enviando…' : `${envio.pct}%`}
                            </span>
                            <span style={{ width: 52, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.3)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', width: `${envio.pct ?? 35}%`, background: '#fff', borderRadius: 999, transition: 'width 140ms linear' }} />
                            </span>
                            {envio.n > 1 && <span style={{ fontSize: 9.5, opacity: .85 }}>{envio.i + 1} de {envio.n}</span>}
                          </div>
                        )}
                        {envio && envio.i > i && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.emerald700, fontSize: 18, fontWeight: 800 }}>✓</div>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{s.file.name}</div>
                      {!envio && <button className="wa-x-hover" onClick={() => setStaged(st => st.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: 'none', background: C.g900, color: '#fff', fontSize: 11, cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>✕</button>}
                      {s.errores.length > 0 && <span title={s.errores.join('\n')} style={{ position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderRadius: 999, background: C.rojo500, color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>!</span>}
                      {s.errores.map((e, j) => <div key={j} style={{ fontSize: 10, color: C.rojo500, lineHeight: 1.3 }}>{e}</div>)}
                    </div>
                  );
                })}
              </div>
            )}
            {error && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: C.rojo700, background: C.rojo50, borderTop: `1px solid ${C.rojo200}`, lineHeight: 1.45 }}>
                {errorDet ? (<>
                  <b style={{ display: 'block', fontSize: 12 }}>{errorDet.titulo}{errorDet.codigo ? <span style={{ fontWeight: 400, color: C.rojo500, marginLeft: 6, fontSize: 10 }}>Meta {errorDet.codigo}</span> : null}</b>
                  <span style={{ display: 'block' }}>{errorDet.que_paso}</span>
                  <span style={{ display: 'block', color: C.g700 }}><b>Qué hacer:</b> {errorDet.que_hacer}</span>
                  <details style={{ marginTop: 3 }}><summary style={{ cursor: 'pointer', fontSize: 10, color: C.g400 }}>Detalle técnico</summary><code style={{ fontSize: 10, color: C.g500, wordBreak: 'break-all' }}>{errorDet.crudo}</code></details>
                </>) : error}
                <button onClick={() => setError('')} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer', color: C.rojo500 }}>✕</button>
              </div>
            )}
            {aviso && <div style={{ padding: '6px 12px', fontSize: 11, color: avisoTono === 'espera' ? '#9a6a10' : C.emerald700, background: avisoTono === 'espera' ? '#FFF4E5' : C.emerald50 }}>{aviso}</div>}
            {sugerirSiguiente && siguiente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 11, color: C.moradoTinta, background: C.moradoAgua }}>
                <span>Enviado.</span>
                <button onClick={() => { if (!siguiente()) setAviso('No quedan conversaciones sin responder.'); setSugerirSiguiente(false); }}
                  style={{ border: 'none', background: C.morado, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Siguiente sin responder</button>
                <kbd style={{ fontSize: 9, border: `1px solid ${C.g200}`, borderRadius: 4, padding: '0 4px', color: C.g500, background: '#fff' }}>n</kbd>
                <button onClick={() => setSugerirSiguiente(false)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.g400 }}>✕</button>
              </div>
            )}
            {programados.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 12px', background: C.g50, borderBottom: `1px solid ${C.g100}` }}>
                {programados.map(p => (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 999, padding: '2px 8px', color: C.g700 }}>
                    {p.tipo === 'envio' ? 'Programado' : 'Recordatorio'} · {new Date(p.ejecutar_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {p.tipo === 'envio' && <span style={{ color: C.g400, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.payload?.texto || p.payload?.nombre}</span>}
                    <button onClick={() => { api.cancelarProgramado(p.id); setProgramados(l => l.filter(x => x.id !== p.id)); }} title="Cancelar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, padding: 0 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            {remotos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 12px 0' }}>
                {remotos.map((a, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, background: C.emerald50, border: `1px solid #A7F3D0`, borderRadius: 999, padding: '3px 9px', color: C.emerald700 }}>
                    <IcoClip size={12} /> {a.nombre}
                    <button onClick={() => setRemotos(r => r.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.emerald700, padding: 0 }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* Toolbar. Con la ventana cerrada no se pinta nada: el banner de
                arriba ya trae "Enviar plantilla" y repetirlo abajo era ruido. */}
            {/* En reposo el composer es una sola línea: la conversación es lo
                que se viene a leer, y la barra de herramientas ocupaba un
                tercio de la pantalla sin que nadie la estuviera usando. Al
                tocar la caja, crece y aparecen las herramientas. */}
            {/* ══ EN REPOSO: lo que NO necesita que escribas, a un solo toque ══
                Antes, con el composer cerrado no había ni un icono: para mandar
                una foto había que enfocar el campo (abriendo el teclado), tocar
                el clip, elegir "cámara"… tres pasos y un teclado de por medio
                para algo que no lleva texto.
                Estas cuatro acciones se completan SIN escribir una letra, así
                que viven arriba: foto, adjuntar, plantilla y voz. Lo demás —IA,
                emoji, variables, interactivos— sí modifica el texto y aparece
                cuando hay texto que modificar. */}
            {/* `relative` en la barra a propósito: los popups se anclan con
                position:absolute y sin eso se colgarían de un ancestro más
                arriba, apareciendo lejos del icono que los abrió. */}
            {!grabando && !bloqueadoWa && movil && !escribiendoMovil && !hayQueMandar() && (
              <div className="wa-barra" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderTop: `1px solid ${C.g100}`, position: 'relative' }}>
                <button title="Enviar una foto" aria-label="Enviar una foto" style={toolBtn(false)}
                  onClick={() => camaraRef.current?.click()}><IcoCamara size={19} /></button>
                {modo === 'wa' && <button title="Adjuntar" aria-label="Adjuntar" style={toolBtn(pop === 'adjuntar')}
                  onClick={() => setPop(pop === 'adjuntar' ? null : 'adjuntar')}><IcoClip size={19} /></button>}
                {modo === 'wa' && <button title="Plantillas" aria-label="Plantillas" style={toolBtn(false)}
                  onClick={() => setModalPlantilla(true)}><IcoDoc size={19} /></button>}
                {/* El snippet TAMPOCO se escribe: se elige y ya queda el texto
                    puesto. Estaba dos toques más adentro —abrir el teclado,
                    tocar «Más», tocar el marcador—, que es todo lo contrario a
                    lo que sirve: la respuesta guardada existe justamente para
                    no teclear. */}
                {snippets.length > 0 && <button title="Snippets" aria-label="Snippets" style={toolBtn(pop === 'snippets')}
                  onClick={() => setPop(pop === 'snippets' ? null : 'snippets')}><IcoMarcador size={19} /></button>}
                <button title="Grabar nota de voz" aria-label="Grabar nota de voz" style={toolBtn(false)}
                  onClick={iniciar}><IcoMic size={19} /></button>

                {/* ══ LOS DOS QUE CIERRAN VENTAS, APARTE ═══════════════════
                    Mandar la cotización y mandar el link para agendar vivían
                    dentro del popover de adjuntar, mezclados con «tomar una
                    foto» y «elegir un archivo». Pero no son adjuntos: son los
                    dos movimientos que hacen avanzar una venta, y se usan
                    varias veces al día. Estaban a dos toques y detrás de una
                    lista que hay que leer.
                    El divisor no es adorno: separa «mandar algo» de «mover la
                    venta», que son dos intenciones distintas, y evita que la
                    fila se lea como seis botones iguales. */}
                {modo === 'wa' && (<>
                  <span aria-hidden="true" style={{ width: 1, height: 20, background: C.g200, margin: '0 3px', flexShrink: 0 }} />
                  <button title="Mandar una cotización" aria-label="Mandar una cotización" style={toolBtn(pop === 'cotizacion')}
                    onClick={() => setPop(pop === 'cotizacion' ? null : 'cotizacion')}><IcoCotizacion size={19} /></button>
                  <button title="Mandar el link para agendar" aria-label="Mandar el link para agendar" style={toolBtn(pop === 'agendar')}
                    onClick={() => setPop(pop === 'agendar' ? null : 'agendar')}><IcoCalendario size={19} /></button>
                </>)}

                {pop === 'adjuntar' && (
                  <PopAdjuntar onSubir={() => fileRef.current?.click()} onBiblioteca={() => { setPop(null); setBiblioteca(true); }}
                    onCamara={() => { setPop(null); camaraRef.current?.click(); }}
                    onPrueba={contacto?.contact_id ? () => setPop('prueba') : undefined}
                    pruebaSub={contacto?.prueba_estado === 'activa' ? 'Ya tiene una activa' : 'Crea la cuenta y escribe el mensaje'} />
                )}
                {pop === 'prueba' && <PopPrueba contacto={contacto} onCerrar={() => setPop(null)} onListo={(txt) => { setTexto(txt); setPop(null); }} />}
                {pop === 'snippets' && (
                  <PopSnippets snippets={snippets} resolver={resolver} onElegir={usarSnippet}
                    onNuevo={() => { setPop(null); setNuevoSnippet({ atajo: '', texto: '' }); }} />
                )}
              </div>
            )}
            {!grabando && (bloqueadoWa ? null : (movil && !escribiendoMovil && !hayQueMandar()) ? null : (
              <div className="wa-barra" onPointerDown={() => { tocandoBarra.current = true; setTimeout(() => { tocandoBarra.current = false; }, 600); }}
                style={{ display: 'flex', alignItems: 'center', gap: movil ? 4 : 2, padding: '6px 10px', borderTop: `1px solid ${C.g100}`, position: 'relative',
                  // Al tocar «Más herramientas» aparecen cinco iconos más EN LA
                  // MISMA fila, y en 390 px el último quedaba cortado contra el
                  // borde derecho: se veía media herramienta y no había forma de
                  // tocarla. Envuelve a un segundo renglón en vez de salirse.
                  // Nada de scroll horizontal aquí: una barra de acciones que se
                  // desliza esconde opciones sin decir que existen, y el botón
                  // de enviar —que vive al final— dejaría de estar a la mano.
                  ...(movil ? { flexWrap: 'wrap' as const, rowGap: 2 } : {}) }}>
                {/* En el teléfono la barra deja a la vista lo que se usa en cada
                    mensaje —IA, adjuntar, plantilla, voz— y esconde el resto
                    tras «Más». Nueve iconos de 18 px en 390 px eran una fila
                    imposible de acertar con el pulgar. */}
                <button title="AI Prompts" style={toolBtn(pop === 'ia', true)} onClick={() => setPop(pop === 'ia' ? null : 'ia')}><IcoVarita size={18} /></button>
                {!movil && <span style={{ width: 1, height: 18, background: C.g200, margin: '0 4px' }} />}
                {(!movil || masHerramientas) && <button title="Emoji" style={toolBtn(pop === 'emoji')} onClick={() => setPop(pop === 'emoji' ? null : 'emoji')}><IcoEmoji size={18} /></button>}
                {(!movil || masHerramientas) && <button title="Variables" style={toolBtn(pop === 'variables')} onClick={() => setPop(pop === 'variables' ? null : 'variables')}><IcoArroba size={18} /></button>}
                {(!movil || masHerramientas) && <button title="Snippets" style={toolBtn(pop === 'snippets')} onClick={() => setPop(pop === 'snippets' ? null : 'snippets')}><IcoMarcador size={18} /></button>}
                {movil && masHerramientas && waDisponible && <button title="Comentario interno" aria-label="Comentario interno" style={toolBtn(false)} onClick={() => { setComentario(true); setTexto(''); }}><IcoBurbuja size={18} /></button>}
                {modo === 'wa' && <button title="Adjuntar" style={toolBtn(pop === 'adjuntar')} onClick={() => setPop(pop === 'adjuntar' ? null : 'adjuntar')}><IcoClip size={18} /></button>}
                {/* Era el mismo logo verde de WhatsApp que ya está en el
                    selector de canal tres controles antes: se leía como
                    decoración, no como «plantillas». */}
                {modo === 'wa' && <button title="Plantillas" aria-label="Plantillas" style={toolBtn(false)} onClick={() => setModalPlantilla(true)}><IcoDoc size={18} /></button>}
                {modo === 'wa' && !bloqueadoWa && (!movil || masHerramientas) && <button title="Mensaje interactivo: botones, lista, link, ubicación, contacto, carrusel, producto" aria-label="Interactivo" style={toolBtn(false)} onClick={() => setModalInteractivo(true)}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="14" width="8" height="6" rx="2" /><rect x="13" y="14" width="8" height="6" rx="2" /></svg>
                </button>}
                {modo === 'wa' && (<>
                  {!movil && <span style={{ width: 1, height: 18, background: C.g200, margin: '0 4px' }} />}
                  <button title="Grabar nota de voz" style={toolBtn(false)} onClick={iniciar}><IcoMic size={18} /></button>
                </>)}
                {movil && (
                  <button onClick={() => setMasHerramientas(v => !v)} aria-label={masHerramientas ? 'Menos herramientas' : 'Más herramientas'}
                    title={masHerramientas ? 'Menos' : 'Más'} style={toolBtn(masHerramientas)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      {masHerramientas ? <path d="M6 15l6-6 6 6" /> : <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>}
                    </svg>
                  </button>
                )}
                <span style={{ flex: 1 }} />
                {iaProcesando && <span style={{ fontSize: 11, color: C.moradoTinta, marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Corazones size={8} /> Procesando con IA…</span>}
                <span className="wa-solo-desktop" style={{ fontSize: 11, color: C.g400, marginRight: 6 }}>Presiona "Enter"</span>
                {modo === 'wa' && canales?.wa_id && (!movil || masHerramientas) && (
                  <button onClick={() => setPopProgramar(p => !p)} title="Programar envío / recordarme si no contesta" aria-label="Programar"
                    style={{ width: 26, height: 32, borderRadius: 8, border: `1px solid ${popProgramar ? C.morado : C.g200}`, background: popProgramar ? C.moradoAgua : '#fff', color: popProgramar ? C.moradoTinta : C.g500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                )}
                {/* aria-label: es un círculo de 32 px con un icono y nada más;
                    sin esto, un lector de pantalla lo anuncia como "botón". */}
                <button onClick={enviar} aria-label="Enviar mensaje" title="Enviar" disabled={ocupado || (!texto.trim() && !staged.length && !remotos.length) || bloqueadoCorreo}
                  style={{ width: 32, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (texto.trim() || staged.length || remotos.length) && !bloqueadoCorreo ? C.morado : C.g200, color: (texto.trim() || staged.length || remotos.length) && !bloqueadoCorreo ? '#fff' : C.g400 }}>
                  {ocupado ? <Corazones size={8} color="#fff" /> : <IcoEnviar size={15} />}
                </button>

                {/* Popups */}
                {pop === 'ia' && <PopIA onAccion={transformar} />}
                {pop === 'cotizacion' && <PopCotizaciones waId={canales?.wa_id} onElegir={(txt) => { insertarEnCursor((texto.trim() ? '\n' : '') + txt); setPop(null); }} />}
                {pop === 'agendar' && <PopAgendar contacto={contacto} telefono={telefono} onElegir={(txt) => { insertarEnCursor((texto.trim() ? '\n' : '') + txt); setPop(null); }} />}
                {popProgramar && <PopProgramar soloRecordatorio={!texto.trim() && !staged.length && !remotos.length} onCerrar={() => setPopProgramar(false)}
                  onProgramar={async (tipo, cuando, nota) => {
                    const payload = tipo === 'envio' ? (remotos[0] ? { media_url: remotos[0].url, clase: remotos[0].clase, nombre: remotos[0].nombre, caption: resolver(texto.trim()) || null } : { texto: resolver(texto.trim()), cita: cita?.kapso_message_id || null }) : { nota };
                    const r = await api.programar({ tipo, ejecutar_at: cuando, payload });
                    if (r?.error) { setError(r.error, r.error_detalle || null); return; }
                    setPopProgramar(false); cargarProgramados();
                    if (tipo === 'envio') { setTexto(''); setRemotos([]); onQuitarCita?.(); setAviso('Mensaje programado.'); } else setAviso('Te avisamos si no contesta.');
                  }} />}
                {pop === 'emoji' && <PopEmoji onElegir={e => insertarEnCursor(e)} left={32} />}
                {pop === 'variables' && <PopVariables onElegir={k => insertarEnCursor(`{{${k}}}`)} left={60} />}
                {pop === 'snippets' && (
                  <PopSnippets snippets={snippets} resolver={resolver}
                    onElegir={usarSnippet}
                    onNuevo={() => { setPop(null); setNuevoSnippet({ atajo: '', texto: '' }); }} />
                )}
                {pop === 'adjuntar' && (
                  <PopAdjuntar onSubir={() => fileRef.current?.click()} onBiblioteca={() => { setPop(null); setBiblioteca(true); }}
                    onCamara={movil ? () => { setPop(null); camaraRef.current?.click(); } : undefined}
                    onCotizacion={() => setPop('cotizacion')} onAgendar={() => setPop('agendar')}
                    onPrueba={contacto?.contact_id ? () => setPop('prueba') : undefined}
                    pruebaSub={contacto?.prueba_estado === 'activa' ? 'Ya tiene una activa' : 'Crea la cuenta y escribe el mensaje'} />
                )}
                {/* Reemplaza el borrador en vez de insertar en el cursor: los
                    datos de acceso no se mezclan con lo que se estaba
                    escribiendo, se dictan enteros o no se dictan. */}
                {pop === 'prueba' && <PopPrueba contacto={contacto} onCerrar={() => setPop(null)} onListo={(txt) => { setTexto(txt); setPop(null); }} />}
              </div>
            ))}
          </>)}
        </Grabadora>
      </div>

      {/* Slash inline (debajo de la card, como nuestra v2) */}
      {slash.length > 0 && (
        <div style={{ marginTop: 6, border: `1px solid #e2dcfb`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(40,20,90,.08)', background: '#fff' }}>
          {slash.map(r => (
            <button key={r.id} onClick={() => usarSnippet(r)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px', borderBottom: `1px solid ${C.g50}` }}>
              <b style={{ fontSize: 12, color: C.moradoTinta }}>/{r.atajo}</b>
              <span style={{ display: 'block', fontSize: 12, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resolver(r.texto)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Acciones inferiores. En el teléfono NO van aquí: eran una cuarta
          banda apilada bajo el composer (tabs + composer + barra + esto) y se
          comían medio hilo. El comentario interno vive en la barra, tras
          «Más». */}
      {!movil && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, gap: 8 }}>
          {waDisponible && (
            <button onClick={() => { setComentario(true); setTexto(''); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: C.g500, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 6 }}>
              <IcoBurbuja size={14} /> Añadir comentario
            </button>
          )}
          <span style={{ flex: 1 }} />
        </div>
      )}

      <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.doc,.docx,.csv,.xlsx" hidden onChange={e => agregarArchivos(e.target.files)} />
      {/* E5 · La cámara es su propio input: `capture` abre la cámara trasera
          directamente, sin pasar por el explorador de archivos. */}
      <input ref={camaraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { agregarArchivos(e.target.files); e.currentTarget.value = ''; }} />
      {modalPlantilla && <SelectorPlantilla telefono={telefono} api={api} onClose={() => { setModalPlantilla(false); setPreselTema(null); }} contacto={contacto} preseleccion={preselTema} />}
      {modalInteractivo && <ModalInteractivo equipo={equipo} yo={api.yo?.()} contacto={contacto} catalogId={catalogId} onCerrar={() => setModalInteractivo(false)}
        onEnviar={async (body) => {
          const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: canales?.wa_id || undefined, telefono, cita: cita?.kapso_message_id || undefined, ...body }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
          if (!r?.error) { onQuitarCita?.(); api.refrescar?.(); if (modo === 'wa' && siguiente) setSugerirSiguiente(true); }
          return r;
        }} />}
      {biblioteca && <Biblioteca onClose={() => setBiblioteca(false)} onElegir={async (a) => {
        setBiblioteca(false); setOcupado(true);
        const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a.categoria === 'sticker' || /\.webp(\?|$)/i.test(a.url) && a.tipo === 'image'
            ? { conversation_id: canales?.wa_id || undefined, telefono, sticker_url: a.url }
            : { conversation_id: canales?.wa_id || undefined, telefono, media_url: a.url, clase: a.tipo, nombre: a.nombre, caption: texto.trim() || undefined }) })
          .then(x => x.json()).catch(e => ({ error: String(e) }));
        fetch('/api/crm/whatsapp/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uso: a.id }) }).catch(() => {});
        setOcupado(false);
        if (r?.ventana_cerrada) setModalPlantilla(true); else if (r?.error) setError(r.error, r.error_detalle || null); else { setTexto(''); api.refrescar?.(); }
      }} />}
      {nuevoSnippet && (
        <ModalSnippetRapido inicial={nuevoSnippet} onClose={() => setNuevoSnippet(null)} onGuardado={() => { setNuevoSnippet(null); cargarSnippets(); }} />
      )}
    </div>
  );
}

// ───────────────────────────── Popups ─────────────────────────────
function PopIA({ onAccion }: { onAccion: (instr: string) => void }) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const lista = IA_ACCIONES.filter(a => !q || a.l.toLowerCase().includes(q.toLowerCase()));
  const instrDe = (a: any, sub?: string) =>
    a.id === 'tono' ? `Cambia el tono a ${sub}` : a.id === 'traducir' ? `Traduce al ${sub}` : a.id === 'ortografia' ? 'Corrige ortografía y gramática' : 'Simplifica el lenguaje';
  return (
    <div className="wa-pop" style={popup(288, 0)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderBottom: `1px solid ${C.g100}` }}>
        <IcoVarita size={15} style={{ color: C.moradoTinta }} /><b style={{ fontSize: 13 }}>AI Prompts</b>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ position: 'relative' }}>
          <IcoBuscar size={13} style={{ position: 'absolute', left: 8, top: 8, color: C.g400 }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar acción…"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 8px 6px 26px', fontSize: 12, fontFamily: 'inherit' }} />
        </div>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', paddingBottom: 6 }}>
        {!lista.length && <div style={{ padding: 12, fontSize: 12, color: C.g400 }}>Sin resultados</div>}
        {lista.map(a => (
          <div key={a.id}>
            <button onClick={() => a.sub ? setAbierto(abierto === a.id ? null : a.id) : onAccion(instrDe(a))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 13, color: C.g700 }}>
              <IcoChispas size={14} style={{ color: C.moradoTinta }} />
              <span style={{ flex: 1 }}>{a.l}</span>
              {a.sub && <span style={{ transform: abierto === a.id ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'inline-flex', color: C.g400 }}><IcoChevronDer size={13} /></span>}
            </button>
            {a.sub && abierto === a.id && (
              <div style={{ marginLeft: 28, paddingLeft: 12, borderLeft: `2px solid #e2dcfb` }}>
                {a.sub.map(s => (
                  <button key={s} onClick={() => onAccion(instrDe(a, s))}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 8px', fontSize: 12, color: C.g700 }}>{s}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PopEmoji({ onElegir, left }: { onElegir: (e: string) => void; left: number }) {
  const [cat, setCat] = useState('frecuentes');
  const [q, setQ] = useState('');
  const c = EMOJI_CATS.find(x => x.id === cat)!;
  // «Frecuentes» era una lista FIJA: se llamaba frecuentes y nunca aprendía de
  // nadie. Ahora son de verdad los últimos que usaste, y la lista de fábrica
  // solo rellena lo que falta para que la pestaña nunca se vea vacía el primer
  // día. Se lee al abrir (no en cada tecla) porque toca localStorage.
  const mios = useMemo(() => (cat === 'frecuentes' ? leerRecientes('emoji') : []), [cat]);
  const frecuentes = [...mios, ...c.lista.filter(e => !mios.includes(e))];
  const lista = q
    ? EMOJI_CATS.flatMap(x => x.lista).filter((e, i, a) => a.indexOf(e) === i).slice(0, 60)
    : (cat === 'frecuentes' ? frecuentes : c.lista);
  return (
    <div className="wa-pop" style={popup(320, left)}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.g100}` }}>
        {EMOJI_CATS.map(x => (
          <button key={x.id} onClick={() => { setCat(x.id); setQ(''); }} title={x.nombre}
            style={{ flex: 1, border: 'none', background: cat === x.id ? C.moradoSuave : 'none', cursor: 'pointer', padding: '7px 0 5px', fontSize: 14, position: 'relative' }}>
            {x.icono}
            {cat === x.id && <span style={{ position: 'absolute', bottom: 0, left: 6, right: 6, height: 2, background: C.morado, borderRadius: 999 }} />}
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 10px 0' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit' }} />
      </div>
      <div style={{ padding: '6px 10px 2px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>{q ? 'Resultados' : c.nombre}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, padding: '0 10px 10px', maxHeight: 200, overflowY: 'auto' }}>
        {lista.map((e, i) => (
          <button key={`${e}-${i}`} onClick={() => { marcarReciente('emoji', e, 16); onElegir(e); }}
            style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, borderRadius: 6 }}
            onMouseEnter={ev => (ev.currentTarget.style.background = C.g100)} onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function PopVariables({ onElegir, left }: { onElegir: (k: string) => void; left: number }) {
  return (
    <div className="wa-pop" style={popup(256, left)}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.g100}`, fontSize: 13, fontWeight: 700 }}>Variables del contacto</div>
      {VARIABLES.map(v => (
        <button key={v.key} onClick={() => onElegir(v.key)}
          style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.g700, flex: 1 }}>{v.l}</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.g400 }}>{`{{${v.key}}}`}</span>
        </button>
      ))}
    </div>
  );
}

function PopSnippets({ snippets, resolver, onElegir, onNuevo }: { snippets: any[]; resolver: (t: string) => string; onElegir: (s: any) => void; onNuevo: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');
  const tactil = esTactil();
  const cats = [...new Set(snippets.map(s => s.categoria).filter(Boolean))];
  const filtrados = snippets.filter(s => (cat === 'todos' || s.categoria === cat) &&
    (!q || `${s.titulo || ''} ${s.atajo} ${s.texto}`.toLowerCase().includes(q.toLowerCase())));
  // Los últimos que usé, arriba. Al BUSCAR no: ahí el orden lo manda lo que
  // escribí, y reacomodar bajo el dedo mientras se teclea marea.
  const lista = q ? filtrados : ordenarPorReciente('snippets', filtrados, s => s.id);
  const nRec = q ? 0 : Math.min(cuantosRecientes('snippets', filtrados, s => s.id), lista.length);
  return (
    <div className="wa-pop" style={popup(320, 88)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderBottom: `1px solid ${C.g100}` }}>
        <IcoMarcador size={15} style={{ color: C.moradoTinta }} /><b style={{ fontSize: 13 }}>Snippets</b>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '1px 7px' }}>{snippets.length}</span>
      </div>
      {cats.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '8px 10px 0', flexWrap: 'wrap' }}>
          {['todos', ...cats].map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ border: 'none', borderRadius: 999, padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: cat === c ? C.moradoAgua : C.g100, color: cat === c ? C.moradoTinta : C.g500, textTransform: 'capitalize' }}>{c}</button>
          ))}
        </div>
      )}
      {/* En el teléfono el buscador NO se enfoca solo: levantar el teclado al
          abrir tapa la lista, que es exactamente lo que se venía a mirar, y
          elegir un snippet no requiere escribir nada. En escritorio sí, que es
          donde de verdad se busca tecleando. */}
      <div style={{ padding: '8px 10px' }}>
        <input autoFocus={!tactil} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar snippet…"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: tactil ? '9px 11px' : '6px 8px', fontSize: tactil ? 16 : 12, fontFamily: 'inherit' }} />
      </div>
      <div style={{ maxHeight: tactil ? '46vh' : 260, overflowY: 'auto' }}>
        {!lista.length && <div style={{ padding: 12, fontSize: 12, color: C.g400 }}>{snippets.length ? 'No se encontraron snippets' : 'No hay snippets configurados'}</div>}
        {lista.map((s, i) => (
          <div key={s.id}>
            {/* La raya solo aparece si de verdad hay dos grupos: sin historial
                todavía, o cuando ya se usaron todos, sobra y solo estorba. */}
            {!q && nRec > 0 && (i === 0 || i === nRec) && lista.length > nRec && (
              <div style={{ padding: '7px 12px 3px', fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: C.g400 }}>
                {i === 0 ? 'Recientes' : 'Todos'}
              </div>
            )}
          <button onClick={() => { marcarReciente('snippets', s.id); onElegir(s); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: tactil ? '12px' : '9px 12px', borderBottom: `1px solid ${C.g50}` }}
            onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ fontSize: 13, color: C.g900 }}>{s.titulo || s.atajo}</b>
              {s.media_tipo && s.media_tipo !== 'text' && <span style={{ fontSize: 11 }}>{emojiTipo[s.media_tipo] || '📎'}</span>}
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 4, padding: '1px 5px' }}>/{s.atajo}</span>
              {(s.usage_count || 0) >= 10 && <span style={{ fontSize: 9, fontWeight: 700, color: C.emerald700, background: C.emerald50, borderRadius: 999, padding: '1px 6px' }}>Popular</span>}
            </span>
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: C.g500, marginTop: 2, lineHeight: 1.45 }}>{resolver(s.texto)}</span>
          </button>
          </div>
        ))}
      </div>
      {/* alignItems: los dos textos caían en líneas base distintas —el <a> no
          hereda la caja del <button>— y el pie se veía chueco. Y con 11 px sin
          alto mínimo, en el teléfono eran dos blancos de menos de 20 px. */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.g100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <button onClick={onNuevo} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: tactil ? 12 : 11, fontWeight: 700, color: C.moradoTinta, minHeight: tactil ? 40 : undefined, padding: 0, display: 'inline-flex', alignItems: 'center' }}>+ Nuevo snippet</button>
        <a href="/admin/crm?tab=wa-config&sec=snippets" style={{ fontSize: tactil ? 12 : 11, fontWeight: 700, color: C.emerald700, textDecoration: 'none', minHeight: tactil ? 40 : undefined, display: 'inline-flex', alignItems: 'center' }}>Gestionar snippets →</a>
      </div>
    </div>
  );
}

function PopAdjuntar({ onSubir, onBiblioteca, onCotizacion, onAgendar, onCamara, onPrueba, pruebaSub }: { onSubir: () => void; onBiblioteca: () => void; onCotizacion?: () => void; onAgendar?: () => void; onCamara?: () => void; onPrueba?: () => void; pruebaSub?: string }) {
  const item = (icono: React.ReactNode, t: string, s: string, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 12px' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {icono}
      <span><b style={{ fontSize: 12, display: 'block', color: C.g900 }}>{t}</b><span style={{ fontSize: 11, color: C.g400 }}>{s}</span></span>
    </button>
  );
  return (
    <div className="wa-pop" style={popup(224, 116)}>
      {/* En el teléfono, la foto del producto o del comprobante se toma en el
          momento: la cámara va primero y el explorador después. */}
      {onCamara && item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoCamara size={15} /></span>, 'Tomar una foto', 'Abre la cámara', onCamara)}
      {item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoClip size={15} /></span>, onCamara ? 'Elegir un archivo' : 'Subir desde computadora', onCamara ? 'De la galería o de archivos' : 'Selecciona un archivo', onSubir)}
      {item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.emerald50, color: C.emerald700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoMarcador size={15} /></span>, 'Biblioteca de medios', 'Archivos pre-configurados', onBiblioteca)}
      {onCotizacion && item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.azulAgua, color: C.azulTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoDoc size={15} /></span>, 'Cotización del CRM', 'Manda el link de una cotización', onCotizacion)}
      {onAgendar && item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.ambar100, color: C.ambar700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoCalendario size={15} /></span>, 'Link para agendar', 'Prellenado con sus datos', onAgendar)}
      {/* La prueba gratis se abría en otra pestaña: salir del inbox, buscar al
          lead, crear la cuenta, volver y escribir los datos de memoria. Cuatro
          pasos con el cliente esperando del otro lado. Aquí es uno, y el
          mensaje sale escrito con la cuenta y la contraseña ya adentro. */}
      {onPrueba && item(<span style={{ width: 30, height: 30, borderRadius: 8, background: C.moradoAgua, color: C.moradoTinta, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎁</span>, 'Prueba gratis', pruebaSub || 'Crea la cuenta y escribe el mensaje', onPrueba)}
    </div>
  );
}

// ───────────────────────── Grabadora de voz ─────────────────────────
function Grabadora({ activa, onEnviar, onMicError, children }: {
  activa: boolean; onEnviar: (blob: Blob) => Promise<void>; onMicError: (m: string) => void;
  children: (p: { grabando: boolean; iniciar: () => void }) => React.ReactNode;
}) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<any>(null);
  const descartar = useRef(false);

  const parar = (descarte: boolean) => { descartar.current = descarte; recRef.current?.stop(); };
  const iniciar = async () => {
    if (!activa) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/ogg;codecs=opus', 'audio/mp4;codecs=opus', 'audio/webm;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; descartar.current = false;
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timer.current); setGrabando(false); setSeg(0);
        if (descartar.current) return;
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || 'audio/ogg' });
        await onEnviar(blob);
      };
      rec.start(250); recRef.current = rec; setGrabando(true); setSeg(0);
      timer.current = setInterval(() => setSeg(s => { if (s + 1 >= 300) { parar(false); } return s + 1; }), 1000);
    } catch { onMicError('No se pudo acceder al micrófono. Verifica los permisos.'); }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (<>
    {grabando && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <span style={{ position: 'relative', width: 10, height: 10, display: 'inline-block' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: C.rojo500, animation: 'ping 1s cubic-bezier(0,0,.2,1) infinite' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: C.rojo500 }} />
        </span>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600 }}>{fmt(seg)}<span style={{ color: C.g400 }}> / 05:00</span></span>
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} style={{ width: 3, borderRadius: 999, background: C.rojo300, height: 6 + Math.abs(Math.sin((i + seg * 3) / 2.3)) * 14 + (i < (seg % 40) ? 2 : 0), opacity: .5 + ((i + seg) % 5) * .1 }} />
          ))}
        </span>
        <button onClick={() => parar(true)} title="Descartar" style={{ border: 'none', background: C.rojo50, color: C.rojo500, borderRadius: 8, padding: 6, cursor: 'pointer' }}>🗑</button>
        <button onClick={() => parar(false)} title="Enviar nota de voz" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: C.emerald600, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoEnviar size={15} /></button>
      </div>
    )}
    {children({ grabando, iniciar })}
  </>);
}

// ───────────────────────── Biblioteca de medios ─────────────────────────
function Biblioteca({ onClose, onElegir }: { onClose: () => void; onElegir: (a: any) => void }) {
  const [archivos, setArchivos] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todas');
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cargar = () => fetch('/api/crm/whatsapp/media').then(r => r.json()).then(j => setArchivos(j.archivos || [])).catch(() => setArchivos([]));
  useEffect(() => { cargar(); }, []);
  const cats = [...new Set((archivos || []).map(a => a.categoria).filter(Boolean))];
  const lista = (archivos || []).filter(a => (cat === 'todas' || a.categoria === cat) && (!q || `${a.nombre} ${a.descripcion || ''}`.toLowerCase().includes(q.toLowerCase())));
  const fmtB = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const subir = async (f: File | null) => {
    if (!f) return; setSubiendo(true);
    // Las imágenes se optimizan en el navegador antes de subir (nada de 8 MB
    // de una foto de celular ocupando la biblioteca y tardando en enviarse).
    let blob: Blob = f, nombre = f.name;
    if (/^image\//.test(f.type) && !/svg/.test(f.type)) {
      try { const o = await optimizarImagen(f, 'libre'); blob = o.blob; nombre = o.nombre; } catch { /* si falla, se sube tal cual */ }
    }
    const fd = new FormData(); fd.append('file', new File([blob], nombre, { type: blob.type || f.type })); fd.append('nombre', nombre);
    await fetch('/api/crm/whatsapp/media', { method: 'POST', body: fd }).catch(() => {});
    setSubiendo(false); cargar();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(448px, 94vw)', maxHeight: '70dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.g100}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14, flex: 1 }}>Biblioteca de medios</b>
          <button onClick={() => fileRef.current?.click()} disabled={subiendo} style={{ border: 'none', borderRadius: 8, padding: '5px 12px', background: C.emerald600, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{subiendo ? 'Subiendo…' : '+ Subir'}</button>
          <input ref={fileRef} type="file" hidden onChange={e => subir(e.target.files?.[0] || null)} />
        </div>
        <div style={{ padding: '10px 18px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['todas', ...cats].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ border: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: cat === c ? C.emerald50 : C.g100, color: cat === c ? C.emerald700 : C.g500, textTransform: 'capitalize' }}>{c}</button>
          ))}
        </div>
        <div style={{ padding: '10px 18px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar archivo…" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }} />
        </div>
        <div className="wa-scroll" style={{ overflowY: 'auto', flex: 1, padding: '0 8px 10px' }}>
          {archivos === null && <div style={{ padding: 16, fontSize: 12, color: C.g400 }}>Cargando…</div>}
          {archivos !== null && !lista.length && <div style={{ padding: 16, fontSize: 12, color: C.g400 }}>Sin archivos. Sube el primero con “+ Subir”.</div>}
          {lista.map(a => (
            <button key={a.id} onClick={() => onElegir(a)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <span style={{ width: 36, height: 36, borderRadius: 8, background: C.g100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, overflow: 'hidden' }}>
                {a.tipo === 'image' ? <img src={a.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emojiTipo[a.tipo]}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</b>
                <span style={{ fontSize: 10, color: C.g400 }}>{a.categoria ? `${a.categoria} · ` : ''}{fmtB(a.bytes || 0)}{a.usage_count ? ` · ${a.usage_count} usos` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalSnippetRapido({ inicial, onClose, onGuardado }: { inicial: { atajo: string; texto: string }; onClose: () => void; onGuardado: () => void }) {
  const [atajo, setAtajo] = useState(inicial.atajo);
  const [texto, setTexto] = useState(inicial.texto);
  const vars = [...new Set([...texto.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: 'min(440px, 94vw)' }}>
        <b style={{ fontSize: 14 }}>Nuevo snippet</b>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.g400, margin: '12px 0 4px' }}>Atajo (se escribe /atajo)</label>
        <input autoFocus value={atajo} onChange={e => setAtajo(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit' }} />
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.g400, margin: '10px 0 4px' }}>Texto <span style={{ fontWeight: 400, color: texto.length > 1024 ? C.rojo500 : C.g400 }}>{texto.length}/1024</span></label>
        <textarea value={texto} rows={4} onChange={e => setTexto(e.target.value)} placeholder="Hola {{primer_nombre}}, …"
          style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${texto.length > 1024 ? C.rojo300 : C.g200}`, borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
        {vars.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: C.g500 }}>Variables: {vars.map(v => <span key={v} style={{ fontSize: 10, background: C.moradoAgua, color: C.moradoTinta, borderRadius: 999, padding: '1px 7px', marginRight: 4 }}>{`{{${v}}}`}</span>)}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button disabled={!atajo || !texto.trim() || texto.length > 1024}
            onClick={async () => { await fetch('/api/crm/whatsapp/respuestas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atajo, texto }) }).catch(() => {}); onGuardado(); }}
            style={{ border: 'none', borderRadius: 8, padding: '8px 16px', background: C.morado, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!atajo || !texto.trim() || texto.length > 1024) ? .5 : 1 }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Selector de plantillas ─────────────────────────
/** Resuelve el dato del CRM que va en una variable (variables_map de la plantilla). */
export function valorVariable(campo: string, contacto: any, yo: any): string {
  const c = contacto || {};
  switch (campo) {
    case 'primer_nombre': return String(c.nombre || '').split(' ')[0] || '';
    case 'nombre': return c.nombre || ''; case 'empresa': return c.empresa || ''; case 'plan': return c.plan || ''; case 'email': return c.email || '';
    case 'telefono': return c.telefono || ''; case 'etapa': return c.etapa || ''; case 'mrr': return c.mrr != null ? `$${Number(c.mrr).toLocaleString('es-MX')}` : '';
    case 'fecha_renovacion': return c.fecha_renovacion ? new Date(c.fecha_renovacion + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '';
    case 'sucursales': return c.sucursales != null ? String(c.sucursales) : ''; case 'agente': return yo?.nombre || '';
    default: return '';
  }
}

export function SelectorPlantilla({ telefono, api, onClose, contacto, preseleccion }: { telefono: string; api: any; onClose: () => void; contacto?: any; preseleccion?: string | null }) {
  // Este selector se abre desde el composer, que en el teléfono es lo que más
  // se usa. No recibe `movil` por props porque lo montan tres pantallas
  // distintas; se pregunta solo.
  const movilPl = useIsMobile();
  const [headerUrl, setHeaderUrl] = useState('');
  const [otp, setOtp] = useState('');
  const [lista, setLista] = useState<any[] | null>(null);
  const [tab, setTab] = useState<'aprobadas' | 'todas'>('aprobadas');
  const [q, setQ] = useState('');
  const [idioma, setIdioma] = useState('');
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<any>(null);
  const [params, setParams] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/crm/whatsapp/plantillas').then(r => r.json()).then(j => {
      const l = j.plantillas || []; setLista(l);
      // Tema de etapa: llega preseleccionada y con las variables ya resueltas.
      const pre = preseleccion ? l.find((p: any) => p.nombre === preseleccion && p.status === 'APPROVED') : null;
      if (pre) { setSel(pre); setHeaderUrl(pre.header_media_url || ''); setParams(Array.from({ length: pre.variables || 0 }, (_, i) => valorVariable((pre.variables_map || [])[i] || '', contacto, api.yo?.()))); }
    }).catch(() => setLista([]));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, []);
  const idiomas = [...new Set((lista || []).map(p => p.idioma))];
  const cats = [...new Set((lista || []).map(p => p.categoria))];
  const coinciden = (lista || []).filter(p => (tab === 'todas' || p.status === 'APPROVED') && (!idioma || p.idioma === idioma) && (!cat || p.categoria === cat)
    && (!q || `${p.nombre} ${p.cuerpo}`.toLowerCase().includes(q.toLowerCase())));
  // Las últimas que mandé, arriba. Una cuenta con 30 plantillas aprobadas usa
  // tres; sin esto había que buscarlas escribiendo cada vez. Al BUSCAR se
  // respeta el orden natural: reacomodar mientras se teclea confunde.
  const visibles = q ? coinciden : ordenarPorReciente('plantillas', coinciden, p => p.nombre);
  const nRecPl = q ? 0 : Math.min(cuantosRecientes('plantillas', coinciden, p => p.nombre), visibles.length);
  const enviar = async () => {
    setOcupado(true); setError('');
    const r = await api.enviarPlantilla({ nombre: sel.nombre, idioma: sel.idioma, params, header_media_url: headerUrl || undefined, otp: otp || undefined }, telefono);
    setOcupado(false);
    if (r?.error) { setError(r.error_detalle ? `${r.error_detalle.titulo}. ${r.error_detalle.que_hacer}` : r.error); return; }
    // Reciente = la que SÍ salió. Marcarla al seleccionarla llenaría la lista
    // de plantillas que se abrieron, se leyeron y se descartaron.
    marcarReciente('plantillas', sel.nombre);
    onClose();
  };
  return (
    // En el teléfono esto es una HOJA que sube desde abajo, no una tarjeta
    // flotando en medio. Una tarjeta centrada con márgenes desperdicia el ancho
    // justo donde menos sobra, deja la lista de plantillas en una rendija, y el
    // pulgar queda lejos de todo. Pegada abajo y a pantalla casi completa se
    // lee entera y se alcanza con una mano. En escritorio se queda como estaba.
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)', zIndex: 960, display: 'flex', alignItems: movilPl ? 'flex-end' : 'center', justifyContent: 'center', padding: movilPl ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff',
        borderRadius: movilPl ? '16px 16px 0 0' : 16,
        width: movilPl ? '100%' : 'min(672px, 94vw)',
        maxHeight: movilPl ? '92dvh' : '80dvh',
        paddingBottom: movilPl ? 'env(safe-area-inset-bottom)' : 0,
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '14px 20px 0', borderBottom: `1px solid ${C.g100}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BadgeWhatsApp size={20} />
            <span><b style={{ fontSize: 14, display: 'block' }}>Enviar plantilla de mensaje</b><span style={{ fontSize: 11, color: C.g400 }}>Solo se envían plantillas aprobadas por Meta.</span></span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {(['aprobadas', 'todas'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 0', color: tab === t ? C.moradoTinta : C.g400, borderBottom: `2px solid ${tab === t ? C.morado : 'transparent'}`, textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
        {/* Envuelve. Con tres controles en una sola fila —buscar, idioma y
            categoría— el tercero se salía por la derecha en 390 px: se veía
            media palabra y no había forma de tocarlo. El buscador se queda con
            todo el primer renglón y los dos selectores bajan al siguiente. */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 20px', flexWrap: 'wrap' }}>
          {/* SIN autoFocus en el teléfono. Enfocar el buscador al abrir levanta
              el teclado, que se come media pantalla y tapa justo la lista que
              se venía a mirar: para elegir una plantilla de la lista había que
              cerrar el teclado primero. En escritorio no estorba y ahí se
              queda, porque ahí sí se busca escribiendo. */}
          <input autoFocus={!movilPl} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar plantilla…" style={{ flex: movilPl ? '1 0 100%' : 1, minWidth: 0, border: `1px solid ${C.g200}`, borderRadius: 8, padding: movilPl ? '10px 12px' : '7px 10px', fontSize: movilPl ? 16 : 12, fontFamily: 'inherit' }} />
          <select value={idioma} onChange={e => setIdioma(e.target.value)} style={{ flex: movilPl ? 1 : undefined, minWidth: 0, border: `1px solid ${C.g200}`, borderRadius: 8, padding: movilPl ? '9px 10px' : '6px 8px', fontSize: movilPl ? 16 : 12, minHeight: movilPl ? 40 : undefined, fontFamily: 'inherit' }}><option value="">Idioma</option>{idiomas.map(i => <option key={i} value={i}>{i}</option>)}</select>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ flex: movilPl ? 1 : undefined, minWidth: 0, border: `1px solid ${C.g200}`, borderRadius: 8, padding: movilPl ? '9px 10px' : '6px 8px', fontSize: movilPl ? 16 : 12, minHeight: movilPl ? 40 : undefined, fontFamily: 'inherit' }}><option value="">Categoría</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        {error && <div style={{ margin: '0 20px 8px', fontSize: 12, color: C.rojo500 }}>{error}</div>}
        <div className="wa-scroll" style={{ overflowY: 'auto', flex: 1, padding: '0 12px 12px' }}>
          {lista === null && <div style={{ padding: 16, fontSize: 12, color: C.g400 }}>Cargando plantillas…</div>}
          {lista !== null && !visibles.length && <div style={{ padding: 16, fontSize: 12, color: C.g400 }}>No se encontraron plantillas.</div>}
          {visibles.map((p, i) => {
            const ok = p.status === 'APPROVED';
            return (
              <div key={p.id}>
              {/* Solo si de verdad hay dos grupos que separar. */}
              {!q && nRecPl > 0 && (i === 0 || i === nRecPl) && visibles.length > nRecPl && (
                <div style={{ padding: '8px 6px 4px', fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: C.g400 }}>
                  {i === 0 ? 'Recientes' : 'Todas'}
                </div>
              )}
              <button disabled={!ok} onClick={() => { setSel(p); setHeaderUrl(p.header_media_url || ''); setOtp(''); setParams(Array.from({ length: p.variables || 0 }, (_, i) => valorVariable((p.variables_map || [])[i] || '', contacto, api.yo?.()))); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit', borderRadius: 10, padding: movilPl ? '12px' : '9px 12px', opacity: ok ? 1 : .5, border: sel?.id === p.id ? `2px solid ${C.morado}` : `1px solid ${C.g200}`, background: sel?.id === p.id ? C.moradoSuave : '#fff', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b style={{ fontSize: 13 }}>{p.nombre}</b>
                  <span style={{ fontSize: 10, color: C.g400 }}>{p.idioma} ·</span>
                  <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: p.categoria === 'MARKETING' ? '#F3E8FF' : '#E0F2FE', color: p.categoria === 'MARKETING' ? '#7E22CE' : '#0369A1' }}>{p.categoria}</span>
                  {!ok && <span style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '1px 7px' }}>{p.status}</span>}
                </span>
                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, color: C.g500, marginTop: 3 }}>{p.cuerpo}</span>
              </button>
              </div>
            );
          })}
          {sel && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(sel.header_tipo || '').toUpperCase()) && (
            <div style={{ margin: '8px 4px 0' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.g400, display: 'block', marginBottom: 3 }}>{sel.header_tipo === 'IMAGE' ? 'Imagen' : sel.header_tipo === 'VIDEO' ? 'Video' : 'Documento'} del encabezado (URL pública)</label>
              <input value={headerUrl} onChange={e => setHeaderUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${headerUrl ? C.g200 : C.rojo300}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }} />
            </div>
          )}
          {sel && sel.tipo_especial === 'otp' ? (
            <div style={{ margin: '8px 4px 0' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.g400, display: 'block', marginBottom: 3 }}>Código a enviar</label>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\s/g, '').slice(0, 15))} placeholder="123456" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }} />
            </div>
          ) : sel && params.map((v, i) => {
            const campo = (sel.variables_map || [])[i];
            return (
              <div key={i} style={{ margin: '8px 4px 0' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.g400, display: 'block', marginBottom: 3 }}>{`Variable {{${i + 1}}}`}{campo && <span style={{ fontWeight: 500, color: C.emerald700, marginLeft: 6 }}>· del CRM ({campo.replace(/_/g, ' ')})</span>}</label>
                <input value={v} onChange={e => { const p = [...params]; p[i] = e.target.value; setParams(p); }} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${!v.trim() ? C.rojo300 : C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
            );
          })}
          {sel && (
            <div style={{ margin: '12px 4px 0' }}>
              <MockupWhatsApp header={sel.header_tipo === 'TEXT' ? sel.header : null} headerMedia={['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(String(sel.header_tipo || '').toUpperCase()) ? { tipo: sel.header_tipo, url: headerUrl } : null}
                cuerpo={(sel.tipo_especial === 'otp' ? [otp || '{{1}}'] : params).reduce((t: string, v: string, i: number) => t.replaceAll(`{{${i + 1}}}`, v || `{{${i + 1}}}`), sel.cuerpo || '')} footer={sel.footer} botones={sel.botones || []} />
            </div>
          )}
        </div>
        <div className="hoja-pie" style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.g100}`, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button disabled={!sel || ocupado || (sel?.tipo_especial === 'otp' ? !otp.trim() : params.some(v => !String(v || '').trim())) || (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(sel?.header_tipo || '').toUpperCase()) && !/^https?:\/\//.test(headerUrl))}
            title={sel && params.some(v => !String(v || '').trim()) ? 'Llena todas las variables' : ''}
            onClick={enviar} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', background: C.emerald600, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: sel && !params.some(v => !String(v || '').trim()) ? 1 : .5 }}>
            {ocupado ? <Corazones size={8} color="#fff" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 9) Cotizaciones del CRM ─────────────────────────
function PopCotizaciones({ waId, onElegir }: { waId?: string | null; onElegir: (texto: string) => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  useEffect(() => {
    if (!waId) { setLista([]); return; }
    fetch(`/api/crm/whatsapp/panel?wa_id=${waId}`).then(r => r.json()).then(j => setLista(j.cotizaciones || [])).catch(() => setLista([]));
  }, [waId]);
  const money = (n: any, m?: string) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}${m && m !== 'MXN' ? ` ${m}` : ''}`;
  const est: Record<string, string> = { borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', pagada: 'Pagada', vencida: 'Vencida' };
  return (
    <div className="wa-pop" style={popup(340, 150)}>
      <div style={{ padding: '10px 12px 6px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Cotizaciones de esta cuenta</div>
      {lista === null && <div style={{ padding: '6px 12px 12px', fontSize: 12, color: C.g400 }}>Cargando…</div>}
      {lista?.length === 0 && <div style={{ padding: '6px 12px 12px', fontSize: 12, color: C.g400 }}>No hay cotizaciones. Créala desde el panel (Acciones → Nueva cotización).</div>}
      {(lista || []).map(c => (
        <button key={c.id} onClick={() => onElegir(`Te comparto la cotización ${c.numero || ''} por ${money(c.total, c.moneda)}${c.plan ? ` (${c.plan})` : ''}: https://www.sacscloud.com/cotizacion/${c.id}${c.link_pago ? `\nPuedes pagar aquí: ${c.link_pago}` : ''}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 12, display: 'block' }}>{c.numero || 'Cotización'} · {money(c.total, c.moneda)}</b>
            <span style={{ fontSize: 10, color: C.g400 }}>{new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}{c.plan ? ` · ${c.plan}` : ''}{c.vigencia ? ` · vigente al ${new Date(c.vigencia + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''}</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, background: c.estado === 'aceptada' || c.estado === 'pagada' ? C.emerald50 : C.g100, color: c.estado === 'aceptada' || c.estado === 'pagada' ? C.emerald700 : C.g500, borderRadius: 999, padding: '1px 7px' }}>{est[c.estado] || c.estado}</span>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── 10 bis) Prueba gratis ─────────────────────────
/**
 * Crear la cuenta de prueba SIN salir de la conversación.
 *
 * El flujo que reemplaza: abrir otra pestaña, buscar al lead, crear la cuenta,
 * volver, y escribir de memoria los datos de acceso. Cuatro pasos con el
 * cliente esperando — y el paso de «escribir de memoria» es donde nacía el
 * error más caro: dictar el identificador como si fuera una dirección web.
 *
 * Al terminar deja el mensaje escrito en el composer, no lo manda: quien
 * atiende lo lee, le agrega lo suyo y lo envía. Un mensaje con la contraseña
 * de alguien no se dispara solo.
 *
 * El identificador se PROPONE a partir de la empresa o el nombre. Se propone y
 * no se decide porque es visible para el cliente para siempre: una heurística
 * que se equivoca deja un nombre feo que ya no se cambia.
 */
function PopPrueba({ contacto, onListo, onCerrar }: { contacto?: any; onListo: (texto: string) => void; onCerrar: () => void }) {
  const sugerido = String(contacto?.empresa || contacto?.nombre || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '').slice(0, 24);
  const [cuenta, setCuenta] = useState(sugerido);
  const [dias, setDias] = useState(14);
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const yaTiene = contacto?.prueba_estado === 'activa';

  const crear = async () => {
    if (!contacto?.contact_id) { setErr('Esta conversación no está ligada a un contacto del CRM.'); return; }
    setOcupado(true); setErr(null);
    const r = await fetch('/api/crm/sacs-prueba', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contacto.contact_id, cuenta: cuenta.trim().toLowerCase(), dias }),
    }).then(x => x.json()).catch(() => ({ error: 'Sin conexión' }));
    setOcupado(false);
    if (r.error) { setErr(r.error); return; }
    onListo(
      `Ya te dejé lista tu prueba de ${dias} días 🎁\n\n` +
      `Entra en app.sacscloud.com\n` +
      `Cuenta: ${r.cuenta}\n` +
      `Usuario: ${r.email}\n` +
      `Contraseña: ${r.password_temporal}\n\n` +
      `La contraseña la puedes cambiar en cuanto entres. Cualquier duda me escribes por aquí.`
    );
  };

  return (
    /* Overlay fijo y NO un popup del composer.
     *
     * Los popups se anclan con `bottom:100%` dentro de `.wa-comp-caja`, que
     * tiene `overflow:hidden` — medido: la tarjeta empieza en y=832 y este
     * formulario mide 173 px, así que sus dos campos y su título quedaban
     * FUERA. Un menú de cuatro renglones aguanta ese recorte; un formulario en
     * el que hay que escribir el identificador de una cuenta, no.
     *
     * Además resuelve el teléfono de una vez: centrado y sin depender del
     * ancho de la barra. */
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(360px, 94vw)', boxShadow: '0 24px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 8px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Prueba gratis · se crea y se escribe sola
      </div>
      {yaTiene ? (
        <div style={{ padding: '4px 12px 12px', fontSize: 12, color: C.g400, lineHeight: 1.6 }}>
          Este contacto <b>ya tiene una prueba activa</b>{contacto?.prueba_cuenta ? <> en <b>{contacto.prueba_cuenta}</b></> : null}. Para extenderla o cerrarla, entra a su ficha.
        </div>
      ) : (
        <div style={{ padding: '4px 12px 12px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, marginBottom: 3 }}>IDENTIFICADOR</div>
              <input value={cuenta} onChange={e => setCuenta(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mimarca" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ width: 62 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, marginBottom: 3 }}>DÍAS</div>
              <input type="number" min={1} max={60} value={dias} onChange={e => setDias(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>
          {err && <div style={{ fontSize: 11, color: '#C0554E', marginTop: 6, lineHeight: 1.5 }}>{err}</div>}
          <button onClick={crear} disabled={ocupado || cuenta.trim().length < 3}
            style={{ marginTop: 8, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: C.moradoTinta, color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: ocupado || cuenta.trim().length < 3 ? 'default' : 'pointer', opacity: ocupado || cuenta.trim().length < 3 ? .5 : 1 }}>
            {ocupado ? 'Creando la cuenta…' : 'Crear y escribir el mensaje'}
          </button>
          <div style={{ fontSize: 10, color: C.g400, marginTop: 6, lineHeight: 1.5 }}>
            Pasa a la etapa <b>Prueba gratis</b> y entra solo a la cadencia de 14 días.
          </div>
        </div>
      )}
      <div style={{ padding: '0 16px 14px' }}>
        <button onClick={onCerrar} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: C.g700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Cancelar</button>
      </div>
    </div>
    </div>
  );
}

// ───────────────────────── 10) Link para agendar ─────────────────────────
function PopAgendar({ contacto, telefono, onElegir }: { contacto?: any; telefono: string; onElegir: (texto: string) => void }) {
  const [tipos, setTipos] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/crm/whatsapp/agendar-links').then(r => r.json()).then(j => setTipos(j.tipos || [])).catch(() => setTipos([])); }, []);
  const qs = new URLSearchParams();
  if (contacto?.nombre) qs.set('nombre', contacto.nombre);
  if (contacto?.email) qs.set('email', contacto.email);
  if (telefono) qs.set('whatsapp', telefono.replace(/\D/g, ''));
  if (contacto?.empresa) qs.set('empresa', contacto.empresa);
  qs.set('utm_source', 'whatsapp'); qs.set('utm_medium', 'inbox');
  return (
    <div className="wa-pop" style={popup(320, 150)}>
      <div style={{ padding: '10px 12px 6px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Agendar · el link ya lleva sus datos</div>
      {tipos === null && <div style={{ padding: '6px 12px 12px', fontSize: 12, color: C.g400 }}>Cargando…</div>}
      {(tipos || []).map(t => (
        <button key={t.slug} onClick={() => onElegir(`Agenda aquí tu ${t.nombre.toLowerCase()}${t.duracion ? ` (${t.duracion} min)` : ''}: https://www.sacscloud.com/agendar/${t.slug}?${qs.toString()}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: C.ambar100, color: C.ambar700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoCalendario size={14} /></span>
          <span style={{ minWidth: 0 }}><b style={{ fontSize: 12, display: 'block' }}>{t.nombre}</b><span style={{ fontSize: 10, color: C.g400 }}>{t.duracion ? `${t.duracion} min · ` : ''}{t.host || ''}</span></span>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── 3/4) Programar / recordatorio ─────────────────────────
function PopProgramar({ soloRecordatorio, onCerrar, onProgramar }: { soloRecordatorio: boolean; onCerrar: () => void; onProgramar: (tipo: 'envio' | 'recordatorio', cuandoISO: string, nota: string) => Promise<void> }) {
  const [tipo, setTipo] = useState<'envio' | 'recordatorio'>(soloRecordatorio ? 'recordatorio' : 'envio');
  const [custom, setCustom] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const opciones = (() => {
    const ahora = new Date();
    const a = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
    const manana = new Date(ahora); manana.setDate(manana.getDate() + 1);
    const lunes = new Date(ahora); lunes.setDate(lunes.getDate() + ((8 - lunes.getDay()) % 7 || 7));
    const en2h = new Date(ahora.getTime() + 2 * 3600e3);
    const en2d = new Date(ahora); en2d.setDate(en2d.getDate() + 2);
    return tipo === 'envio'
      ? [{ l: 'En 2 horas', d: en2h }, { l: 'Mañana 9:00', d: a(manana, 9) }, { l: 'Mañana 17:00', d: a(manana, 17) }, { l: 'Lunes 9:00', d: a(lunes, 9) }]
      : [{ l: 'Si no contesta mañana', d: a(manana, 9) }, { l: 'En 2 días', d: a(en2d, 9) }, { l: 'El lunes', d: a(lunes, 9) }];
  })();
  const fmt = (d: Date) => d.toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ir = async (d: Date) => { setOcupado(true); await onProgramar(tipo, d.toISOString(), nota.trim()); setOcupado(false); };
  return (
    <div style={{ ...popup(300, 80), right: 0, left: 'auto' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.g100}` }}>
        {(['envio', 'recordatorio'] as const).map(t => (
          <button key={t} disabled={t === 'envio' && soloRecordatorio} onClick={() => setTipo(t)}
            style={{ flex: 1, border: 'none', borderBottom: `2px solid ${tipo === t ? C.morado : 'transparent'}`, background: 'none', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: tipo === t ? C.moradoTinta : (t === 'envio' && soloRecordatorio ? C.g300 : C.g500), cursor: 'pointer', fontFamily: 'inherit' }}>
            {t === 'envio' ? 'Enviar después' : 'Si no contesta'}
          </button>
        ))}
      </div>
      <div style={{ padding: 10 }}>
        {tipo === 'envio' && soloRecordatorio && <div style={{ fontSize: 11, color: C.g400, marginBottom: 6 }}>Escribe el mensaje primero.</div>}
        {tipo === 'recordatorio' && (
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Qué te recordamos (ej. insistir con la cotización)"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
        )}
        {opciones.map(o => (
          <button key={o.l} disabled={ocupado} onClick={() => ir(o.d)}
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 6px', fontSize: 12, color: C.g700, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = C.g50)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <b>{o.l}</b><span style={{ color: C.g400, fontSize: 11 }}>{fmt(o.d)}</span>
          </button>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <input type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)}
            style={{ flex: 1, border: `1px solid ${C.g200}`, borderRadius: 8, padding: '5px 8px', fontSize: 11, fontFamily: 'inherit' }} />
          <button disabled={!custom || ocupado} onClick={() => custom && ir(new Date(custom))}
            style={{ border: 'none', background: custom ? C.morado : C.g200, color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: custom ? 'pointer' : 'default', fontFamily: 'inherit' }}>OK</button>
        </div>
        <div style={{ fontSize: 10, color: C.g400, marginTop: 6 }}>{tipo === 'envio' ? 'Si la ventana de 24 h ya cerró a esa hora, no se envía y te avisamos en el hilo.' : 'Se cancela solo si el cliente contesta antes.'}</div>
      </div>
    </div>
  );
}
