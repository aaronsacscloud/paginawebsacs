// WHATSAPP · El inbox del CRM, edición "WOW" (paridad con sacs_inbox):
// sidebar de vistas custom | lista PRO | hilo | detalle. Polling deliberado
// (15 s lista, 5 s hilo, focus; pausa con pestaña oculta). Este componente es
// el dueño de los datos y de todas las acciones.
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { hayBorrador, leerBorrador } from '../../../../lib/crm/borradores';
import { lazySeguro } from '../../../../lib/ui/lazySeguro';
import { S, Aviso } from '../email/ui';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { useIsMobile, useDrawerHistory } from '../../../../lib/ui/mobile';
import { C, L, CSS_INBOX } from './estilo';
import { telefonoLegible } from '../../../../lib/telefono';
import AvisoNuevo from './AvisoNuevo';
import { agregarACola, quitarDeCola, actualizarEnCola, leerCola, colaDe, suscribirCola, marcaUnica, type EnCola } from '../../../../lib/crm/cola-envio';
import SidebarInbox, { useCamposFiltro } from './SidebarInbox';
// REGLA DE VELOCIDAD: lo que no se ve al pintar la bandeja baja después.
const ListaConversaciones = lazySeguro(() => import('./ListaConversaciones'));
const Telefonia = lazySeguro(() => import('./Telefonia'));
const Llamadas = lazySeguro(() => import('./Llamadas'));
const Hilo = lazySeguro(() => import('./Hilo'));
const PanelDetalle = lazySeguro(() => import('./PanelDetalle'));
const NuevoChat = lazySeguro(() => import('./NuevoChat'));
import type { Condicion } from '../../../../lib/whatsapp/filtros';
import { leerSnap, guardarSnap } from '../../../../lib/crm/snapshot';

export type Filtros = { filtro: string; etapa: string; search: string };
export const FILTROS_BASE: Filtros = { filtro: 'todas', etapa: '', search: '' };

export default function InboxPro() {
  const isMobile = useIsMobile();
  const isCompact = useIsMobile(1200);
  const [yo, setYo] = useState<any>(null);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_BASE);
  const [vistaActiva, setVistaActiva] = useState<any | null>(null);
  const [filtrosAdHoc, setFiltrosAdHoc] = useState<{ logica: 'AND' | 'OR'; condiciones: Condicion[] } | null>(null);
  const [orden, setOrden] = useState('recientes');
  const [mostrar, setMostrar] = useState('conversaciones');
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [buscarAbierto, setBuscarAbierto] = useState(false);   // móvil: buscador de la cabecera
  // ══ Móvil v5 (mockup Inbox): chips Abiertas/Mías/Resueltas y lista seccionada ══
  // «No contestadas» = el cliente escribió y nadie respondió: es la cola de
  // trabajo real, por eso abre el inbox. «Sin respuesta» es el espejo: yo
  // escribí y no me han contestado, para dar seguimiento de corrido.
  const [chipWa, setChipWa] = useState<'nocontestadas' | 'abiertas' | 'sinrespuesta' | 'mias' | 'resueltas'>('nocontestadas');
  useEffect(() => {
    if (!isMobile) return;
    setMostrar(chipWa === 'resueltas' ? 'resueltas' : 'abiertas');
    setFiltros(f => ({ ...f, filtro: chipWa === 'mias' ? 'mias' : 'todas' }));
  }, [isMobile, chipWa]);
  const [lista, setLista] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [activa, setActiva] = useState<{ id: string; wa: string | null; email: string | null } | null>(null);
  const [hilo, setHilo] = useState<any>(null);
  const [detalleMobile, setDetalleMobile] = useState(false);
  // `true` abre el buscador de contactos; un string abre directo el arranque
  // con plantilla para ESE teléfono. Es lo que hace que el botón de WhatsApp de
  // una ficha caiga aquí y no en wa.me: si el contacto nunca ha escrito no hay
  // conversación que abrir, y quedarse en una búsqueda vacía se lee como que el
  // contacto "no está".
  const [nuevoChat, setNuevoChat] = useState<boolean | string>(false);
  const [error, setError] = useState('');
  const campos = useCamposFiltro(equipo);

  useDrawerHistory(isMobile && !!activa, () => setActiva(null));
  // REGLA DE VELOCIDAD: la bandeja pinta el snapshot de la sesión al instante;
  // el polling de siempre trae lo fresco enseguida.
  useEffect(() => {
    const j: any = leerSnap('inbox-lista');
    if (j && Array.isArray(j.conversaciones)) {
      setLista(l => l === null ? j.conversaciones : l);
      setCounts((c: any) => Object.keys(c || {}).length ? c : (j.counts || {}));
    }
  }, []);

  // ── Query de la lista: bandeja + mostrar + vista custom / filtros ad-hoc ──
  const armarQS = useCallback((f: Filtros) => {
    const p = new URLSearchParams();
    p.set('filtro', mostrar === 'pospuestas' ? 'pospuestas' : f.filtro);
    if (f.etapa) p.set('etapa', f.etapa);
    if (f.search) p.set('search', f.search);
    if (mostrar === 'abiertas') p.set('estado', 'abierta');
    if (mostrar === 'resueltas') p.set('estado', 'resuelta');
    const vista = vistaActiva?.config
      || (filtrosAdHoc ? { modo: mostrar === 'todas' ? 'todas' : mostrar === 'solo_contactos' ? 'solo_contactos' : 'con_conversacion', ...filtrosAdHoc } : null)
      || (mostrar === 'todas' ? { modo: 'todas' } : mostrar === 'solo_contactos' ? { modo: 'solo_contactos' } : null);
    if (vista) p.set('vista', JSON.stringify(vista));
    p.set('orden', orden);
    return p.toString();
  }, [mostrar, vistaActiva, filtrosAdHoc, orden]);

  const [totalLista, setTotalLista] = useState(0);
  const [hayMasLista, setHayMasLista] = useState(false);
  const paginasRef = useRef(1);   // cuántas páginas de 50 hay cargadas (el polling las conserva)
  const filtroCambio = useRef(false);   // el ÚLTIMO cambio vino de un filtro/vista (no del polling)
  const cargarLista = useCallback(async (f: Filtros, paginas = paginasRef.current) => {
    const j = await fetch(`/api/crm/whatsapp/inbox?${armarQS(f)}&limit=${50 * paginas}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j) { setError('Sin conexión — revisa tu internet'); return; }
    // ⚠️ UN ERROR NO ES UNA LISTA VACÍA.
    // El servidor se cuelga de forma intermitente (medido en producción: /inbox
    // responde en ~370 ms casi siempre, pero cada tantas peticiones se va a 8 y
    // hasta 30 s). Cuando pasa, el candado de 9 s de conMicroCache devuelve un
    // 504 con JSON VÁLIDO: {error:'El servidor tardó demasiado'}. Eso pasaba de
    // largo el `if (!j)` de arriba y caía en `setLista(j.conversaciones || [])`
    // → la lista se ponía en CERO delante del usuario. Y peor: dos líneas más
    // abajo ese vacío se guardaba en el snapshot, así que la siguiente visita
    // también arrancaba vacía. Un cuelgue de infra dejaba el inbox en blanco de
    // forma pegajosa.
    // Ahora: si la respuesta no trae un arreglo de conversaciones, NO se toca ni
    // lo que se ve ni el snapshot. Se conserva lo último bueno y se avisa bajito.
    if (j.error || !Array.isArray(j.conversaciones)) {
      setError(typeof j.error === 'string' && j.error ? j.error : 'No se pudo actualizar — se muestra lo último cargado');
      return;
    }
    // REGLA DE VELOCIDAD: snapshot para la primera pintura de la próxima visita
    guardarSnap('inbox-lista', { conversaciones: j.conversaciones, counts: j.counts || {} });
    // ── E2.2 · ¿entró algo mientras trabajaba? ──────────────────────────
    // Se compara contra lo que ya teníamos: una conversación con mensaje
    // entrante más nuevo (o que aparece de golpe) es un lead escribiendo.
    // La conversación ABIERTA no avisa: ahí el mensaje simplemente se pinta
    // (E2.4).
    const antes = ultimoAtRef.current;
    const nuevas: any[] = [];
    (j.conversaciones || []).forEach((c: any) => {
      const at = String(c.ultimo_mensaje_at || '');
      const prev = antes.get(c.id);
      if (prev != null && at > prev && c.ultima_direccion === 'entrante' && c.id !== activaRef.current?.id) nuevas.push(c);
      if (at) antes.set(c.id, at);
    });
    if (nuevas.length) setAviso({ conv: nuevas[0], mas: nuevas.length - 1 });

    setError(''); setLista(j.conversaciones || []); setCounts(j.counts || {});
    setTotalLista(j.total_filtrado || 0); setHayMasLista(!!j.hay_mas);
    // Cambió la vista/filtro y el chat abierto ya no pertenece a la lista →
    // se cierra el hilo. Sin esto quedaba un spinner eterno (peor con filas
    // virtuales, que no tienen hilo que cargar).
    if (filtroCambio.current) {
      filtroCambio.current = false;
      const act = activaRef.current;
      if (act && !(j.conversaciones || []).some((c: any) => c.id === act.id)) setActiva(null);
    }
  }, [armarQS]);
  const cargarMasLista = async () => { paginasRef.current += 1; await cargarLista(filtrosRef.current, paginasRef.current); };
  useEffect(() => { paginasRef.current = 1; filtroCambio.current = true; }, [armarQS, filtros.filtro, filtros.etapa, filtros.search]);

  const activaRef = useRef(activa); activaRef.current = activa;
  // Última marca de tiempo conocida por conversación (E2.2). Empieza vacío a
  // propósito: en la primera carga no se avisa de nada, solo se toma la foto.
  const ultimoAtRef = useRef<Map<string, string>>(new Map());
  const [aviso, setAviso] = useState<{ conv: any; mas: number } | null>(null);
  const [nuevosAlAbrir, setNuevosAlAbrir] = useState(0);
  // Con una conversación abierta en el teléfono, la barra de pestañas se va:
  // la CSS del CRM la esconde con este atributo y pone su alto reservado en 0.
  useEffect(() => {
    if (!isMobile) return;
    const raiz = document.documentElement;
    // La altura reservada la escribe BottomNav como estilo EN LÍNEA sobre
    // <html>, así que una regla CSS no la gana: se pone a 0 aquí y se repone
    // al salir del hilo.
    // 56 px + safe-area es lo que escribe BottomNav; se repone tal cual al
    // salir del hilo (quitar la variable dejaría el respaldo de 64 y sobraría
    // una franja).
    const alturaNav = 'calc(56px + env(safe-area-inset-bottom))';
    const reponer = () => { delete raiz.dataset.crmHilo; raiz.style.setProperty('--crm-bottomnav-h', alturaNav); };
    if (activa) { raiz.dataset.crmHilo = '1'; raiz.style.setProperty('--crm-bottomnav-h', '0px'); }
    else reponer();
    return reponer;
  }, [isMobile, !!activa]);
  const hiloRef = useRef<any>(null);
  // E1.1 · Hilos ya cargados. Se guardan los últimos 30 (una jornada completa
  // de inbox cabe de sobra) para que volver a cualquiera sea instantáneo.
  const cacheHilos = useRef<Map<string, any>>(new Map());
  const guardarEnCache = (id: string, j: any) => {
    cacheHilos.current.delete(id);
    cacheHilos.current.set(id, j);
    while (cacheHilos.current.size > 30) cacheHilos.current.delete(cacheHilos.current.keys().next().value as string);
  };
  const cargarHilo = useCallback(async (a: { wa: string | null; email: string | null }) => {
    if (!a.wa && !a.email) return;   // fila virtual: no hay hilo que cargar
    const qs = a.wa ? `id=${a.wa}` : `email_id=${a.email}`;
    // marcar=1: esta es la apertura DE VERDAD (el usuario entró al chat). La
    // precarga usa la misma ruta sin el parámetro justamente para no marcar
    // como leído —ni mandarle palomitas azules al cliente— algo que nadie vio.
    const j = await fetch(`/api/crm/whatsapp/hilo?${qs}&marcar=1`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    // Respuesta tardía de OTRA conversación (el usuario ya cambió de chat):
    // se descarta, si no pisa el hilo nuevo y el composer manda al chat equivocado.
    const act = activaRef.current;
    if (!act || (a.wa && act.wa !== a.wa) || (!a.wa && a.email && act.email !== a.email)) return;
    if (j && !j.error) {
      hiloRef.current = j;
      // E1.1: se guarda para que volver a esta conversación sea instantáneo.
      const id = a.wa || a.email;
      if (id) guardarEnCache(id, j);
    } 
    if (j && !j.error) setHilo((prev: any) => {
      // Conserva los ecos optimistas que el servidor todavía no refleja (evita
      // que tu mensaje "parpadee" si el poll llega antes que el espejo).
      const ecos = (prev?.mensajes || []).filter((m: any) => m._eco && !(j.mensajes || []).some((s: any) => s.cuerpo === m.cuerpo && s.direccion === 'saliente' && Math.abs(new Date(s.created_at).getTime() - new Date(m.created_at).getTime()) < 60e3));
      return ecos.length ? { ...j, mensajes: [...j.mensajes, ...ecos] } : j;
    });
  }, []);

  useEffect(() => {
    const h = () => { if (activaRef.current) cargarHilo(activaRef.current); };
    document.addEventListener('wa-refrescar-hilo', h);
    return () => document.removeEventListener('wa-refrescar-hilo', h);
  }, [cargarHilo]);

  useEffect(() => {
    fetch('/api/auth/yo').then(r => r.json()).then(setYo).catch(() => {});
    fetch('/api/crm/whatsapp/equipo').then(r => r.json()).then(j => setEquipo(j.equipo || [])).catch(() => {});
  }, []);

  const filtrosRef = useRef(filtros); filtrosRef.current = filtros;
  useEffect(() => { cargarLista(filtros); }, [filtros, cargarLista]);
  const [tick, setTick] = useState(0);
  const guardarVistaRef = useRef<((cfg: any) => void) | null>(null);
  // E2.1 · El poll se adapta: 6 s con la pestaña a la vista —para enterarse
  // de un lead casi al instante— y 30 s en segundo plano, que es solo para
  // que el contador esté al día cuando vuelvas.
  useEffect(() => {
    let t: any;
    const armar = () => {
      clearInterval(t);
      t = setInterval(() => { cargarLista(filtrosRef.current); setTick(x => x + 1); }, document.hidden ? 30000 : 6000);
    };
    armar();
    const onFocus = () => { armar(); cargarLista(filtrosRef.current); if (activaRef.current) cargarHilo(activaRef.current); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [cargarLista]);

  useEffect(() => {
    if (!activa) { setHilo(null); return; }
    // E1.1 · Si el hilo ya está en memoria NO se borra la pantalla: se deja lo
    // que `abrir` ya pintó y el fetch de abajo solo lo refresca. Borrarlo aquí
    // era lo que hacía parpadear en blanco cada conversación ya visitada.
    const enMemoria = cacheHilos.current.get((activa.wa || activa.email) as string);
    if (enMemoria) { hiloRef.current = enMemoria; setHilo(enMemoria); } else setHilo(null);
    if (activa.wa || activa.email) cargarHilo(activa);
    const t = setInterval(() => {
      if (!document.hidden && activaRef.current) {
        cargarHilo(activaRef.current);
        if (activaRef.current.wa) fetch('/api/crm/whatsapp/presencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: activaRef.current.wa }) }).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(t);
  }, [activa?.id, cargarHilo]);

  // ── Tiempo real percibido: beep + título + Notification ──
  const prevNoLeidas = useRef<number | null>(null);
  useEffect(() => {
    const n = counts?.no_leidas ?? null;
    if (n == null) return;
    if (prevNoLeidas.current != null && n > prevNoLeidas.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 880; g.gain.value = 0.04;
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12);
      } catch { /* sin audio */ }
      // E7.3 · Vibración corta con la app abierta. Es lo que hace que te
      // enteres con el teléfono en la mano y en silencio.
      try { navigator.vibrate?.(30); } catch { /* el escritorio no vibra */ }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try { new Notification('WhatsApp · CRM SACS', { body: 'Tienes mensajes nuevos en el inbox' }); } catch { /* nada */ }
      }
    }
    prevNoLeidas.current = n;
    document.title = n > 0 ? `(${n}) Inbox — Sacs CRM` : 'Sacs CRM';
    // E7.2 · El número en el ícono de la PWA: se ve sin abrir la app.
    try {
      const nav: any = navigator;
      if (n > 0) nav.setAppBadge?.(n); else nav.clearAppBadge?.();
    } catch { /* navegador sin badge */ }
  }, [counts?.no_leidas]);

  // Permiso de notificaciones: se pide en el primer gesto del usuario (el
  // navegador lo exige); sin esto la rama de Notification era código muerto.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const pedir = () => { Notification.requestPermission().catch(() => {}); window.removeEventListener('pointerdown', pedir); };
    window.addEventListener('pointerdown', pedir, { once: true });
    return () => window.removeEventListener('pointerdown', pedir);
  }, []);

  // Atajos globales: j/k navegan la lista, Escape cierra el hilo (en móvil, vuelve).
  const listaRef = useRef<any[] | null>(null); listaRef.current = lista;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const l = listaRef.current || [];
      if (e.key === 'n' && activaRef.current) {
        e.preventDefault();
        const sig = l.filter((c: any) => c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta' && c.id !== activaRef.current?.id)[0];
        if (sig) abrir(sig);
      } else if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const i = l.findIndex((c: any) => c.id === activaRef.current?.id);
        const n = e.key === 'j' ? Math.min(l.length - 1, i + 1) : Math.max(0, i - 1);
        if (l[n]) abrir(l[n]);
      } else if (e.key === 'Escape' && activaRef.current && !document.querySelector('[role="dialog"]')) {
        setActiva(null);
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  // Deep-links: ?wa_conv=<id> | ?wa_search=<tel> (una sola vez).
  const deepLink = useRef(false);
  useEffect(() => {
    if (deepLink.current || lista === null) return;
    deepLink.current = true;
    try {
      const p = new URLSearchParams(window.location.search);
      const conv = p.get('wa_conv');
      const tel = p.get('wa_search');
      if (conv) {
        // Llegar por link (la campana, un push) también tiene que enseñar
        // dónde empieza lo no leído: sin esto la marca solo salía al abrir
        // desde la lista.
        const fila = (lista || []).find((c: any) => c.wa_id === conv || c.id === conv);
        setNuevosAlAbrir(Number(fila?.no_leidos || 0));
        setActiva({ id: fila?.id || conv, wa: conv, email: null });
      }
      else if (tel) {
        const limpio = tel.replace(/\D/g, '');
        // Con menos de 10 dígitos NO se busca por teléfono. `endsWith('')` es
        // cierto para todos: un `wa_search=Amado` hacía "match" con la primera
        // conversación de la lista y abría el chat de otra persona.
        const hit = limpio.length >= 10
          ? lista.find((c: any) => String(c.telefono || '').replace(/\D/g, '').endsWith(limpio.slice(-10)))
          : null;
        if (hit) { setNuevosAlAbrir(Number(hit.no_leidos || 0)); setActiva({ id: hit.id, wa: hit.wa_id, email: hit.email_id }); }
        // Sin conversación previa no hay nada que buscar: se arranca. Un
        // contacto recién agregado NUNCA tiene conversación, y dejar la
        // búsqueda vacía hacía parecer que el contacto no existía.
        else if (p.get('wa_nuevo') === '1') setNuevoChat(tel);
        else setFiltros(f => ({ ...f, search: tel }));
      }
    } catch { /* SSR o URL rara */ }
  }, [lista]);

  // ══ Abrir rápido ══════════════════════════════════════════════════════
  // Abrir una conversación costaba ~3.6 s porque hasta ese momento se
  // descargaban los chunks del hilo y del composer (137 KB) Y se pedía el
  // hilo al servidor. Ahora las dos cosas pasan ANTES: el código se precarga
  // en cuanto hay lista, y el hilo de la conversación se trae al primer
  // contacto del dedo (pointerdown) o al asomarse la fila.
  const precargados = useRef<Set<string>>(new Set());
  // Últimos mensajes de las 50 recientes, traídos de un viaje por /precarga.
  // No es el hilo completo (sin notas, eventos ni presencia): es lo que hace
  // falta para que el chat APAREZCA al instante mientras /hilo trae el resto.
  //
  // Se HIDRATA de sessionStorage al montar y se guarda tras cada precarga. Sin
  // esto, salir del inbox y volver tiraba los mensajes y la primera apertura
  // volvía a pagar /hilo completo — que en producción se cuelga de forma
  // intermitente hasta 30 s. Con el snapshot, volver y abrir es instantáneo
  // aunque el servidor esté teniendo un mal momento.
  const mensajesPre = useRef<Map<string, any[]>>((() => {
    // 12 h: pasado ese punto los mensajes viejos ya no ayudan a nadie y solo
    // ocupan cuota. Igual /hilo refresca al abrir.
    const g = leerSnap<Record<string, any[]>>('inbox-mensajes', 12 * 3600e3);
    return new Map<string, any[]>(g ? Object.entries(g) : []);
  })());
  const guardarPre = () => {
    // Solo las 50 más recientes: el snapshot no es un archivo histórico.
    const obj: Record<string, any[]> = {};
    [...mensajesPre.current.entries()].slice(-50).forEach(([k, v]) => { obj[k] = v; });
    guardarSnap('inbox-mensajes', obj);
  };
  const precargarHilo = useCallback((c: any) => {
    const id = c?.wa_id || c?.email_id;
    if (!id || precargados.current.has(id)) return;
    // Si ya vino en la precarga masiva, NO se pide el hilo completo: abrirla ya
    // pinta al instante desde esos mensajes y /hilo llega solo al abrirla de
    // verdad. Sin este corte, abrir una conversación disparaba /hilo por sus
    // cuatro vecinas —medido: una ráfaga de 5 peticiones por cada apertura—
    // trayendo notas, eventos y 150 mensajes de chats que nadie pidió.
    if (c?.wa_id && mensajesPre.current.has(c.wa_id)) return;
    precargados.current.add(id);
    const qs = c.wa_id ? `id=${c.wa_id}` : `email_id=${c.email_id}`;
    fetch(`/api/crm/whatsapp/hilo?${qs}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j && !j.error) guardarEnCache(id, j); }).catch(() => {});
  }, []);

  const abrir = (c: any) => {
    // Si el hilo ya se cargó antes, se pinta AL INSTANTE y el fetch de siempre
    // solo lo refresca detrás. Es lo que hace que moverse entre conversaciones
    // no tenga espera después de la primera.
    const id = c?.wa_id || c?.email_id;
    const listo = id ? cacheHilos.current.get(id) : null;
    const pre = id ? mensajesPre.current.get(id) : null;
    if (listo) { hiloRef.current = listo; setHilo(listo); }
    else if (pre && pre.length) {
      // Provisional: se pintan los mensajes YA y el panel de detalle aparece
      // cuando /hilo responde (la vista usa encadenamiento opcional, así que
      // `conversacion: null` no la rompe). Es preferible a un spinner: el
      // usuario ve su conversación de inmediato.
      const prov = { conversacion: null, mensajes: pre, notas: [], eventos: [], precargado: true };
      hiloRef.current = prov; setHilo(prov);
    }
    else { hiloRef.current = null; setHilo(null); }
    // E6.1 · Se apunta cuántos traía sin leer ANTES de ponerlos en cero: es lo
    // que dice dónde va la marca «Mensajes nuevos».
    setNuevosAlAbrir(Number(c?.no_leidos || 0));
    setActiva({ id: c.id, wa: c.wa_id ?? null, email: c.email_id ?? null });
    setLista(l => (l || []).map(x => x.id === c.id ? { ...x, no_leidos: 0 } : x));
    // E1.3: las vecinas de la lista son las que se abren enseguida.
    const arr = (listaRef.current || []).filter((x: any) => !x.virtual);
    const i = arr.findIndex((x: any) => x.id === c.id);
    [arr[i - 2], arr[i - 1], arr[i + 1], arr[i + 2]].forEach(v => { if (v) precargarHilo(v); });
  };

  // El código del hilo pesa 137 KB entre Hilo y Composer: se trae mientras el
  // usuario mira la lista, no cuando ya tocó una conversación.
  useEffect(() => {
    if (!lista || !lista.length) return;
    const traer = () => { import('./Hilo'); import('./Composer'); import('./PanelDetalle'); };
    const w: any = window;
    const t = w.requestIdleCallback ? w.requestIdleCallback(traer, { timeout: 2500 }) : setTimeout(traer, 900);
    return () => { if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(t); else clearTimeout(t as any); };
  }, [!!(lista && lista.length)]);

  // Y los datos de las primeras conversaciones de la cola: son las que se
  // abren en el 90% de los casos.
  useEffect(() => {
    if (!lista || !lista.length) return;
    const w: any = window;
    // E1: la primera pantalla puede tardar un poco más — lo que no puede
    // tardar es abrir. Se traen las 5 primeras en cuanto el hilo principal
    // tiene un respiro.
    // Ojo: la lista se PINTA en otro orden que el arreglo (en móvil arranca
    // en «No contestadas»), así que se precargan los dos frentes: las
    // primeras del arreglo y las primeras que esperan respuesta, que son las
    // que el usuario ve arriba.
    const vivas = (lista as any[]).filter(c => !c.virtual);
    // UNA petición para las 50 más recientes, no una por conversación.
    // Antes esto llamaba a /hilo diez veces (5 que esperan respuesta + 5 del
    // arreglo). Medido al entrar: 7 llamadas, 4.9 s de red, compitiendo con la
    // lista que el usuario está esperando ver — y cada /hilo trae notas,
    // eventos, presencia y 150 mensajes cuando para PINTAR bastan los últimos.
    // /precarga resuelve las 50 de un golpe con una window function: 11.5 ms.
    const traer = () => {
      // Solo lo que AÚN no está en memoria, y ordenado: la lista se recarga
      // varias veces al entrar (filtros, refresco) y sin esto se volvían a
      // pedir las mismas 50 conversaciones en cada pasada — medido: 3 viajes
      // y 467 KB para traer tres veces lo mismo. Ordenar los ids además hace
      // que el micro-caché del servidor reconozca la petición repetida.
      const ids = vivas.map(c => c.wa_id).filter(Boolean)
        .filter(id => !mensajesPre.current.has(id)).slice(0, 50).sort();
      if (!ids.length) return;
      fetch(`/api/crm/whatsapp/precarga?ids=${ids.join(',')}&k=15`)
        .then(r => r.json())
        .then(j => {
          if (!j?.mensajes) return;
          for (const [id, msjs] of Object.entries(j.mensajes)) mensajesPre.current.set(id, msjs as any[]);
          guardarPre();
        }).catch(() => {});
    };
    const t = w.requestIdleCallback ? w.requestIdleCallback(traer, { timeout: 1200 }) : setTimeout(traer, 600);
    return () => { if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(t); else clearTimeout(t as any); };
  }, [lista, precargarHilo]);

  const refrescar = () => { if (activaRef.current) cargarHilo(activaRef.current); cargarLista(filtrosRef.current); };

  // ══ E3 · Cola de envío ═══════════════════════════════════════════════════
  // Un mensaje sale de la cola solo cuando el servidor confirma. Si no hubo
  // respuesta (sin señal, pestaña muerta a medias) se queda y se reintenta.
  const [colaTick, setColaTick] = useState(0);
  const mandarDeLaCola = useCallback(async (it: EnCola) => {
    const r = await fetch('/api/crm/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // `idem` es el candado del servidor: si este mensaje ya se espejó, no
      // se manda otra vez aunque el reintento llegue tarde.
      body: JSON.stringify({ conversation_id: it.conv, texto: it.texto, cita: it.cita || undefined, idem: it.id }),
    }).then(x => x.json()).catch(() => null);
    if (r === null) {   // no hubo respuesta: es la red, no el mensaje
      const n = it.intentos + 1;
      actualizarEnCola(it.id, { intentos: n, error: n >= 5 ? 'No se pudo enviar. Toca Reintentar cuando tengas señal.' : null });
      setColaTick(x => x + 1);
      return { ok: true, encolado: true };
    }
    // Error del servidor (ventana cerrada, plantilla, número): reintentarlo a
    // ciegas no lo arregla — se saca de la cola y el composer lo explica.
    quitarDeCola(it.id); setColaTick(x => x + 1);
    return r;
  }, []);

  const vaciando = useRef(false);
  const vaciarCola = useCallback(async () => {
    if (vaciando.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    vaciando.current = true;
    try {
      for (const it of leerCola()) {
        if (it.intentos >= 5) continue;   // ya no insiste solo: espera el toque
        await mandarDeLaCola(it);
      }
    } finally { vaciando.current = false; }
    if (activaRef.current) cargarHilo(activaRef.current);
  }, [mandarDeLaCola, cargarHilo]);

  useEffect(() => {
    const unir = suscribirCola(() => setColaTick(x => x + 1));
    const alVolverLaRed = () => vaciarCola();
    window.addEventListener('online', alVolverLaRed);
    const t = setInterval(() => { if (leerCola().length) vaciarCola(); }, 20000);
    if (leerCola().length) vaciarCola();   // lo que quedó de la sesión anterior
    return () => { unir(); window.removeEventListener('online', alVolverLaRed); clearInterval(t); };
  }, [vaciarCola]);
  const waId = () => activaRef.current?.wa || null;

  const api = {
    quitarDeMasivo: async (broadcastId: string) => {
      const tel = (listaRef.current || []).find((c: any) => c.id === activaRef.current?.id)?.telefono || hiloRef.current?.conversacion?.telefono;
      const r = await fetch('/api/crm/whatsapp/broadcasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'quitar_destinatario', id: broadcastId, telefono: tel }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (!r?.error) refrescar();
      return r;
    },
    enviarTexto: async (texto: string, cita?: string | null) => {
      // E3 · El mensaje entra a la cola ANTES de salir a la red. Así, si la
      // red falla o el navegador se muere a media petición, el texto sigue
      // ahí: se ve pendiente en el hilo y se reintenta solo.
      const conv = waId();
      if (!conv) return { error: 'Esta conversación no tiene WhatsApp' };
      const it = agregarACola({ id: marcaUnica(), conv, texto, cita: cita || null, autor: yo?.nombre || null });
      setColaTick(x => x + 1);
      const r = await mandarDeLaCola(it);
      refrescar();
      return r;
    },
    escribiendo: () => {
      const a = activaRef.current; if (!a?.wa) return;
      fetch('/api/crm/whatsapp/presencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: a.wa, escribiendo: true }) }).catch(() => {});
    },
    programar: async (o: { tipo: 'envio' | 'recordatorio'; ejecutar_at: string; payload: any }) => {
      const r = await fetch('/api/crm/whatsapp/programados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: waId(), ...o }) })
        .then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    cancelarProgramado: async (id: string) => {
      await fetch('/api/crm/whatsapp/programados', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
      refrescar();
    },
    listarProgramados: async () => fetch(`/api/crm/whatsapp/programados?conversation_id=${waId()}`).then(x => x.json()).then(j => j.programados || []).catch(() => []),
    reenviar: async (m: any, destinoConvId: string) => {
      const body: any = { conversation_id: destinoConvId };
      if (m.media_url) Object.assign(body, { media_url: m.media_url, clase: m.tipo === 'sticker' ? 'image' : m.tipo, nombre: m.filename || m.cuerpo || 'archivo', caption: m.filename ? undefined : m.cuerpo, mime: m.mime });
      else body.texto = m.transcript || m.cuerpo;
      if (!body.texto && !body.media_url) return { error: 'Este mensaje no se puede reenviar (la media vive solo en Meta)' };
      return fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    },
    listaActual: () => lista || [],
    yo: () => yo,
    accionKapso: async (o: any) => {
      const r = await fetch('/api/crm/whatsapp/contacto-kapso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: waId(), ...o }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (o.accion === 'gdpr' && !r?.error) { setActiva(null); setHilo(null); }
      refrescar(); return r;
    },
    enviarInteractivo: async (interactivo: any) => {
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: waId(), interactivo }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    reaccionar: async (wamid: string, emoji: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: waId(), reaccion: { wamid, emoji } }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    siguienteSinResponder: () => {
      const l = (lista || []).filter((c: any) => c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta' && c.id !== activaRef.current?.id);
      if (l[0]) abrir(l[0]);
      return !!l[0];
    },
    cargarMasHilo: async (before: string) => {
      const a = activaRef.current; if (!a?.wa) return;
      const j = await fetch(`/api/crm/whatsapp/hilo?id=${a.wa}&before=${encodeURIComponent(before)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
      if (!j || j.error) return;
      setHilo((h: any) => h ? { ...h, mensajes: [...(j.mensajes || []), ...(h.mensajes || [])], hay_mas: !!j.hay_mas } : h);
    },
    reintentar: async (m: any) => {
      // De la cola: se reintenta el mismo mensaje con su marca, así que si el
      // envío anterior sí había salido, el servidor no lo duplica.
      if (m?._cola) {
        const it = leerCola().find(x => x.id === m._cola);
        if (!it) { refrescar(); return { ok: true }; }
        actualizarEnCola(it.id, { intentos: 0, error: null });
        const r = await mandarDeLaCola({ ...it, intentos: 0 });
        refrescar(); return r;
      }
      // Vuelve a mandar el mismo contenido como mensaje nuevo (Meta no reintenta por wamid).
      const body: any = { conversation_id: waId() };
      if (m.tipo === 'text' || m.tipo === 'template') body.texto = m.cuerpo;
      else if (m.media_url) Object.assign(body, { media_url: m.media_url, clase: m.tipo, nombre: m.filename || m.cuerpo || 'archivo', caption: m.filename ? undefined : m.cuerpo, mime: m.mime });
      else return { error: 'Este mensaje no se puede reintentar' };
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    enviarPlantilla: async (plantilla: any, telefono?: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telefono ? { telefono, plantilla } : { conversation_id: waId(), plantilla }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (r.conversation_id && r.conversation_id !== activaRef.current?.wa) setActiva({ id: r.conversation_id, wa: r.conversation_id, email: null });
      refrescar(); return r;
    },
    refrescar,
    enviarArchivo: async (file: File, caption?: string, voz?: boolean, cita?: string | null) => {
      const esAudio = voz || file.type.startsWith('audio/');
      // Archivos grandes (> 4 MB): directo del navegador a Storage con URL
      // firmada y luego se manda por link — la función serverless no los aguanta.
      if (!esAudio && file.size > 4 * 1024 * 1024) {
        const firma = await fetch('/api/crm/whatsapp/subir-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: file.name, mime: file.type, conversation_id: waId() }),
        }).then(x => x.json()).catch(e => ({ error: String(e) }));
        if (firma?.error || !firma?.signed_url) return { error: firma?.error || 'No se pudo preparar la subida' };
        const up = await fetch(firma.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file }).catch(() => null);
        if (!up || !up.ok) return { error: `La subida directa falló (${up?.status || 'sin red'})` };
        const clase = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
        const r = await fetch('/api/crm/whatsapp/enviar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: waId(), media_url: firma.public_url, clase, nombre: file.name, mime: file.type, caption: caption || undefined, cita: cita || undefined }),
        }).then(x => x.json()).catch(e => ({ error: String(e) }));
        refrescar(); return r;
      }
      const fd = new FormData();
      fd.append('file', file); fd.append('conversation_id', waId() || '');
      if (caption) fd.append('caption', caption);
      if (voz) fd.append('voz', '1');
      if (cita) fd.append('cita', cita);
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', body: fd })
        .then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    crearNota: async (texto: string) => {
      const r = await fetch('/api/crm/whatsapp/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: waId(), texto }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    enviarCorreo: async (o: { texto: string; asunto?: string }) => {
      const r = await fetch('/api/crm/whatsapp/enviar-correo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wa_id: waId(),
          email_conversation_id: hilo?.canales?.correo?.conversation_id || activaRef.current?.email || null,
          texto: o.texto, asunto: o.asunto || undefined,
        }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    ia: async (o: { accion: string; canal?: string; texto?: string; instruccion?: string }) => {
      return fetch('/api/crm/whatsapp/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...o, wa_id: waId(), email_id: waId() ? null : activaRef.current?.email }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
    },
    patchConversacion: async (cambios: any) => {
      const r = await fetch('/api/crm/whatsapp/hilo', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: waId(), ...cambios }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (Array.isArray(r?.avisos) && r.avisos.length) setError(r.avisos.join(' · '));
      refrescar(); return r;
    },
    guardarContacto: async (contactId: string, cambios: any) => {
      const r = await fetch('/api/crm/contacts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactId, ...cambios }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
    },
    crearContacto: async (datos: { empresa: string; contacto: string; email?: string }) => {
      const tel = hilo?.conversacion?.telefono;
      const r = await fetch('/api/crm/buscar-cliente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, whatsapp: tel }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (r.ok && (r.contact_id || r.company_id)) {
        await api.patchConversacion({ contact_id: r.contact_id || null, company_id: r.company_id || null });
      }
      return r;
    },
    marcarUsoRespuesta: async (id: string) => {
      fetch('/api/crm/whatsapp/respuestas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uso: id }),
      }).catch(() => {});
    },
  };

  // E3.2 · Lo que está en la cola se ve EN el hilo, con su estado: reloj
  // mientras espera, error rojo con «Reintentar» cuando ya insistió 5 veces.
  const hiloConCola = useMemo(() => {
    const pend = colaDe(activa?.wa || null);
    if (!hilo || !pend.length) return hilo;
    const burbujas = pend.map(it => ({
      id: `cola-${it.id}`, kapso_message_id: null, direccion: 'saliente', tipo: 'text',
      cuerpo: it.texto, status: it.intentos >= 5 ? 'failed' : 'pending',
      error: it.intentos >= 5 ? (it.error || 'No se pudo enviar') : null,
      created_at: it.creado_at, enviado_at: it.creado_at, autor: it.autor || null,
      metadata: it.cita ? { cita: { wamid: it.cita } } : null, _eco: true, _cola: it.id,
    }));
    return { ...hilo, mensajes: [...(hilo.mensajes || []), ...burbujas] };
  }, [hilo, activa?.wa, colaTick]);

  if (error && lista === null) return <div style={S.wrap}><Aviso tono="malo">{error}</Aviso></div>;
  if (lista === null) return <Cargando texto="Cargando el inbox de WhatsApp…" />;

  const conv = hilo?.conversacion || null;
  const filaActiva = (lista || []).find(c => c.id === activa?.id) || null;


  const propsLista = {
    lista, counts, filtros, setFiltros, activaId: activa?.id || null, onAbrir: abrir,
    equipo, yo, onNuevo: () => setNuevoChat(true), orden, setOrden, mostrar, setMostrar,
    campos, filtrosAdHoc, setFiltrosAdHoc,
    onMasivo: () => { window.location.href = '/admin/crm?tab=wa-masivos'; },
    totalLista, hayMasLista, cargarMasLista,
    onGuardarVista: (cfg: any) => guardarVistaRef.current?.(cfg),
    onAsignar: async (c: any, asignadoA: string | null) => {
      await fetch('/api/crm/whatsapp/hilo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.wa_id, asignado_a: asignadoA }) }).catch(() => null);
      refrescar();
    },
  };

  // ── Móvil: lista → hilo apilado; sidebar y detalle en Sheets ──
  if (isMobile) {
    return (
      <div className="m-lienzo" style={{ background: '#fff', minHeight: 'calc(100dvh - 64px - var(--crm-bottomnav-h, 64px))' }}>
        <style>{CSS_INBOX}</style>
        {!activa ? (
          (() => {
            const todas = (lista || []).filter((c: any) => !c.virtual);
            // Espera respuesta: el último mensaje es del cliente y no está
            // resuelta. Es el indicador que pidió el usuario para saber de un
            // vistazo a quién le debe contestación.
            const esperaRespuesta = (c: any) => c.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta';
            const sinRespuestaDeEllos = (c: any) => c.ultima_direccion === 'saliente' && c.estado_crm !== 'resuelta';
            const convs = chipWa === 'nocontestadas' ? todas.filter(esperaRespuesta)
              : chipWa === 'sinrespuesta' ? todas.filter(sinRespuestaDeEllos)
              : todas;
            const nPendientes = todas.filter(esperaRespuesta).length;
            const nSinResp = todas.filter(sinRespuestaDeEllos).length;
            const horaV5 = (iso: string | null) => {
              if (!iso) return '';
              const d = new Date(iso); const hoy = new Date();
              const dd = (x: Date) => x.toISOString().slice(0, 10);
              const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
              if (dd(d) === dd(hoy)) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
              if (dd(d) === dd(ayer)) return 'ayer';
              return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\./g, '');
            };
            // En «Abiertas» lo que espera respuesta va ARRIBA: es la única
            // sección accionable; lo demás es historial que ya se atendió.
            const pendientes = chipWa === 'abiertas' ? convs.filter(esperaRespuesta) : [];
            const resto = chipWa === 'abiertas' ? convs.filter((c: any) => !esperaRespuesta(c)) : convs;
            const sinLeer = resto.filter((c: any) => c.no_leidos > 0);
            const previas = resto.filter((c: any) => !(c.no_leidos > 0));
            const conSec = chipWa !== 'resueltas' && sinLeer.length > 0;
            const fila = (c: any) => {
              const noLeida = c.no_leidos > 0;
              // Un número sin contacto se lee mejor separado, y es el mismo
              // formato que usa la cabecera del hilo.
              const nom = c.contacto?.nombre || (c.telefono ? telefonoLegible(String(c.telefono)) : '—');
              const emp = c.contacto?.empresa_nombre || c.contacto?.companies?.nombre || null;
              const stop = ['de', 'del', 'la', 'los', 'las', 'para', 'y', 'e'];
              const ws = String(nom).split(/\s+/).filter((w: string) => w && !stop.includes(w.toLowerCase()));
              // Un teléfono sin contacto no tiene iniciales: icono de persona.
              const esTel = /^\+?\d/.test(String(nom));
              const ini = esTel
                ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8f8d98" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                : (ws.length >= 2 ? ws[0][0] + ws[1][0] : String(nom).slice(0, 2)).toUpperCase();
              return (
                <div key={c.id} className="m-row" onPointerDown={() => precargarHilo(c)} onClick={() => abrir(c)}>
                  <div className="m-ini">{ini}</div>
                  <div className="m-tx">
                    <div className="m-n1" style={noLeida ? { fontWeight: 700 } : undefined}>
                      {[nom.split(' ')[0].length > 2 && emp ? nom.split(' ')[0] : nom, emp].filter(Boolean).join(' · ')}
                      {/* E8.1 · Alguien del equipo dejó una nota interna aquí.
                          Hay que saberlo ANTES de abrir, no después de leer
                          toda la conversación. */}
                      {c.tiene_notas && <span className="m-nota" title="Tiene notas internas del equipo">nota</span>}
                    </div>
                    <div className="m-n2" style={!c.ultimo_mensaje_texto ? { fontStyle: 'italic' } : undefined}>
                      {/* Un borrador a medias es trabajo empezado: si la lista no
                          lo dice, se olvida y el cliente se queda esperando. */}
                      {hayBorrador(c.id) ? <span style={{ color: '#a06600', fontWeight: 600 }}>Borrador: {leerBorrador(c.id)}</span>
                        : c.ultimo_mensaje_texto ? `${c.ultima_direccion === 'saliente' ? 'Tú: ' : ''}${c.ultimo_mensaje_texto}` : 'Sin mensajes'}
                    </div>
                  </div>
                  <div className="m-fin">
                    <div className="m-m1" style={noLeida ? { color: '#5B4BD6', fontWeight: 700 } : { fontWeight: 500, color: '#8f8d98', fontSize: '0.85rem' }}>{horaV5(c.ultimo_mensaje_at)}</div>
                    {/* Ventana de 24 h por cerrarse: pasado ese punto ya solo se
                        puede mandar plantilla, así que se avisa ANTES. */}
                    {(() => {
                      if (c.ultima_direccion !== 'entrante' || !c.ultimo_mensaje_at) return null;
                      const restan = 24 * 3600e3 - (Date.now() - new Date(c.ultimo_mensaje_at).getTime());
                      if (restan <= 0 || restan > 2 * 3600e3) return null;
                      const h = Math.floor(restan / 3600e3), m = Math.round((restan % 3600e3) / 60000);
                      return <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a06600', whiteSpace: 'nowrap' }}>cierra en {h > 0 ? `${h} h` : `${m} min`}</div>;
                    })()}
                    {/* Punto morado = te toca contestar. Es la señal que se
                        busca al abrir el inbox, y por eso va a la derecha,
                        donde el pulgar ya está mirando la hora. */}
                    {esperaRespuesta(c) && <span className="m-pend" title="Espera tu respuesta" />}
                  </div>
                </div>
              );
            };
            return (
              <div>
                <div className="m-hdr">
                  <div className="m-tt">Inbox</div>
                  {/* Dos acciones y ninguna más: buscar (por número, nombre o
                      texto del mensaje) y abrir conversación. Lo demás vive en
                      la propia conversación. */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="m-cta" aria-label="Buscar conversación"
                      onClick={() => { setBuscarAbierto(v => !v); if (buscarAbierto) setFiltros(f => ({ ...f, search: '' })); }}
                      style={{ padding: '0 6px' }}>
                      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" />
                      </svg>
                    </button>
                    <button className="m-cta" onClick={() => setNuevoChat(true)}>＋ Nuevo</button>
                  </span>
                </div>
                {buscarAbierto && (
                  <div style={{ padding: '0 24px 8px' }}>
                    <input autoFocus value={filtros.search}
                      onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))}
                      placeholder="Número, contacto o texto del mensaje…"
                      className="m-buscar"
                      style={{ width: '100%', minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid #dddce3', background: '#fff', color: '#1a1a1a', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                )}
                <div className="m-chips">
                  {([['nocontestadas', 'No contestadas'], ['abiertas', 'Abiertas'], ['sinrespuesta', 'Sin respuesta'], ['mias', 'Mías'], ['resueltas', 'Resueltas']] as const).map(([v, l]) => {
                    const on = chipWa === v;
                    // El conteo de las dos vistas de trabajo se ve SIEMPRE, no
                    // solo cuando están activas: es el número que dice si hay
                    // algo que hacer sin tener que tocar nada.
                    const n = v === 'nocontestadas' ? nPendientes : v === 'sinrespuesta' ? nSinResp : on && lista ? convs.length : null;
                    return (
                      <button key={v} className={'m-chip' + (on ? ' on' : '') + (v === 'nocontestadas' && nPendientes > 0 && !on ? ' urge' : '')} onClick={() => setChipWa(v)}>
                        {l}{n ? ' ' + n : ''}
                      </button>
                    );
                  })}
                </div>
                {lista === null && <div style={{ padding: '28px 24px', color: '#8f8d98', fontSize: '0.86rem' }}>Cargando…</div>}
                {lista !== null && convs.length === 0 && (
                  <div style={{ padding: '28px 24px', color: '#8f8d98', fontSize: '0.86rem' }}>
                    {chipWa === 'mias' ? 'Nada asignado a ti. Bandeja limpia.' : chipWa === 'resueltas' ? 'Aún no hay conversaciones resueltas.' : 'Sin conversaciones abiertas. Bandeja limpia.'}
                  </div>
                )}
                {pendientes.length > 0 && <div className="m-sec">Esperan tu respuesta</div>}
                {pendientes.map(fila)}
                {conSec && <div className="m-sec">Sin leer</div>}
                {(conSec ? sinLeer : resto).map(fila)}
                {conSec && previas.length > 0 && <div className="m-sec">Anteriores</div>}
                {conSec && previas.map(fila)}
              </div>
            );
          })()
        ) : (
          <Suspense fallback={<Cargando texto="Abriendo conversación…" />}>
            <Hilo hilo={hiloConCola} nuevosAlAbrir={nuevosAlAbrir} filaActiva={filaActiva} equipo={equipo} api={api} mobile
              onBack={() => setActiva(null)} onVerDetalle={() => setDetalleMobile(true)} />
            <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
              {conv && <PanelDetalle hilo={hilo} api={api} />}
            </Sheet>
          </Suspense>
        )}
        {nuevoChat && <Suspense fallback={<Cargando texto="Abriendo…" alto={180} />}><NuevoChat lista={lista} api={api} telefono={typeof nuevoChat === 'string' ? nuevoChat : undefined} onAbrir={abrir} onClose={() => setNuevoChat(false)} /></Suspense>}
        {aviso && (
          <AvisoNuevo conv={aviso.conv} mas={aviso.mas} movil={true}
            onAbrir={() => { abrir(aviso.conv); setAviso(null); }} onCerrar={() => setAviso(null)} />
        )}
        <Sheet open={filtrosMobile} onClose={() => setFiltrosMobile(false)} title="Vistas y filtros" width={320}>
          <SidebarInbox counts={counts} filtros={filtros} setFiltros={f => setFiltros(f)} yo={yo} tick={tick}
            vistaActiva={vistaActiva} onVista={v => { setVistaActiva(v); setFiltrosMobile(false); }} equipo={equipo} onGuardarVistaExterna={fn => { guardarVistaRef.current = fn; }} />
        </Sheet>
      </div>
    );
  }

  // ── Escritorio: 4 zonas + railito del detalle ──
  return (
    <div style={{ width: '100%' }}>
      <style>{CSS_INBOX}</style>
      <div style={{
        display: 'flex', background: '#fff', borderTop: `1px solid ${C.g200}`,
        overflow: 'hidden', height: '100dvh', minHeight: 480,
      }}>
        <Suspense fallback={null}>
        <Llamadas onAbrir={(id) => setActiva({ id, wa: id, email: null })} />
        <Telefonia />
        </Suspense>
        <SidebarInbox counts={counts} filtros={filtros} setFiltros={setFiltros} yo={yo} tick={tick}
          vistaActiva={vistaActiva} onVista={setVistaActiva} equipo={equipo} onGuardarVistaExterna={fn => { guardarVistaRef.current = fn; }} />
        <Suspense fallback={<Cargando texto="Cargando conversaciones…" />}><ListaConversaciones {...propsLista} /></Suspense>
        {activa ? (
          <Suspense fallback={<Cargando texto="Abriendo conversación…" />}><Hilo hilo={hiloConCola} nuevosAlAbrir={nuevosAlAbrir} filaActiva={filaActiva} equipo={equipo} api={api}
            onVerDetalle={isCompact ? () => setDetalleMobile(true) : undefined} /></Suspense>
        ) : (
          <VacioHilo onNuevo={() => setNuevoChat(true)} total={totalLista} conFiltro={!!(vistaActiva || filtros.etapa || filtros.search || (filtrosAdHoc?.condiciones?.length))} onLimpiar={() => { setVistaActiva(null); setFiltrosAdHoc(null); setFiltros(f => ({ ...f, etapa: '', search: '', filtro: 'todas' })); }} />
        )}
        {!isCompact && (
          <div className="wa-scroll" style={{ width: L.detalle, flexShrink: 0, borderLeft: `1px solid ${C.g200}`, overflowY: 'auto', background: '#fff' }}>
            {conv || filaActiva?.virtual ? <Suspense fallback={<Cargando texto="Cargando…" alto={180} />}><PanelDetalle hilo={hilo} api={api} filaActiva={filaActiva} /></Suspense>
              : <div style={{ padding: 18, color: C.g400, fontSize: 12 }}>El detalle del cliente aparece aquí.</div>}
          </div>
        )}
      </div>
      {isCompact && (
        <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
          {conv && <Suspense fallback={<Cargando texto="Cargando…" alto={180} />}><PanelDetalle hilo={hilo} api={api} /></Suspense>}
        </Sheet>
      )}
      {nuevoChat && <Suspense fallback={<Cargando texto="Abriendo…" alto={180} />}><NuevoChat lista={lista} api={api} telefono={typeof nuevoChat === 'string' ? nuevoChat : undefined} onAbrir={abrir} onClose={() => setNuevoChat(false)} /></Suspense>}
      {aviso && (
        <AvisoNuevo conv={aviso.conv} mas={aviso.mas}
          onAbrir={() => { abrir(aviso.conv); setAviso(null); }} onCerrar={() => setAviso(null)} />
      )}
    </div>
  );
}

/** Empty state del hilo con atajos en <kbd> (portado). */
function VacioHilo({ onNuevo, total = -1, conFiltro = false, onLimpiar }: { onNuevo: () => void; total?: number; conFiltro?: boolean; onLimpiar?: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'n') onNuevo();
    };
    window.addEventListener('keydown', tecla); return () => window.removeEventListener('keydown', tecla);
  }, [onNuevo]);
  const kbd: React.CSSProperties = {
    background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 5, minWidth: 22, height: 20,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
    color: C.g500, padding: '0 5px', fontFamily: 'inherit',
  };
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.g50, borderLeft: `1px solid ${C.g200}` }}>
      <div style={{
        width: 80, height: 80, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(155,140,250,0.10), rgba(125,166,245,0.14))',
        border: '1.5px solid rgba(155,140,250,0.18)', fontSize: 30,
      }}>💬</div>
      {total === 0 ? (
        <>
          <p style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', margin: '14px 0 4px', color: C.g900 }}>
            {conFiltro ? 'Esta vista no tiene contactos' : 'Aún no hay conversaciones'}
          </p>
          <p style={{ fontSize: 12, color: C.g400, marginBottom: 14, maxWidth: 340, textAlign: 'center', lineHeight: 1.5 }}>
            {conFiltro ? 'Ningún contacto cumple los filtros de esta vista en este momento. Ajusta los filtros o vuelve a Todas.' : 'Cuando un cliente te escriba (o inicies un chat) aparecerá aquí.'}
          </p>
          {conFiltro && onLimpiar && (
            <button onClick={onLimpiar} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#9B8CFA', color: '#fff', fontSize: 12, fontWeight: 700,
            }}>Ver todas las conversaciones</button>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', margin: '14px 0 4px', color: C.g900 }}>Ningún contacto seleccionado</p>
          <p style={{ fontSize: 12, color: C.g400, marginBottom: 14, maxWidth: 340, textAlign: 'center', lineHeight: 1.5 }}>
            {total > 0 ? `Elige uno de los ${total === 1 ? 'contactos' : total + ' contactos'} de la lista para ver su conversación y su información.` : 'Elige un contacto de la lista o empieza una conversación nueva.'}
          </p>
        </>
      )}
      <p style={{ display: 'flex', gap: 14, fontSize: 11, color: C.g500, marginTop: 4 }}>
        <span><span style={kbd}>N</span>&nbsp; Nuevo chat</span>
      </p>
    </div>
  );
}
