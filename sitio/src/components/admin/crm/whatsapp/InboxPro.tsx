// WHATSAPP · El inbox del CRM, edición "WOW" (paridad con sacs_inbox):
// sidebar de vistas custom | lista PRO | hilo | detalle. Polling deliberado
// (15 s lista, 5 s hilo, focus; pausa con pestaña oculta). Este componente es
// el dueño de los datos y de todas las acciones.
import { useCallback, useEffect, useRef, useState } from 'react';
import { S, Aviso } from '../email/ui';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { useIsMobile, useDrawerHistory } from '../../../../lib/ui/mobile';
import { C, L, CSS_INBOX } from './estilo';
import SidebarInbox, { useCamposFiltro } from './SidebarInbox';
import ListaConversaciones from './ListaConversaciones';
import Hilo from './Hilo';
import PanelDetalle from './PanelDetalle';
import NuevoChat from './NuevoChat';
import type { Condicion } from '../../../../lib/whatsapp/filtros';

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
  const [lista, setLista] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [activa, setActiva] = useState<{ id: string; wa: string | null; email: string | null } | null>(null);
  const [hilo, setHilo] = useState<any>(null);
  const [detalleMobile, setDetalleMobile] = useState(false);
  const [nuevoChat, setNuevoChat] = useState(false);
  const [error, setError] = useState('');
  const campos = useCamposFiltro(equipo);

  useDrawerHistory(isMobile && !!activa, () => setActiva(null));

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
  const cargarLista = useCallback(async (f: Filtros, paginas = paginasRef.current) => {
    const j = await fetch(`/api/crm/whatsapp/inbox?${armarQS(f)}&limit=${50 * paginas}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j) { setError('Sin conexión — revisa tu internet'); return; }
    setError(''); setLista(j.conversaciones || []); setCounts(j.counts || {});
    setTotalLista(j.total_filtrado || 0); setHayMasLista(!!j.hay_mas);
  }, [armarQS]);
  const cargarMasLista = async () => { paginasRef.current += 1; await cargarLista(filtrosRef.current, paginasRef.current); };
  useEffect(() => { paginasRef.current = 1; }, [armarQS, filtros.filtro, filtros.etapa, filtros.search]);

  const activaRef = useRef(activa); activaRef.current = activa;
  const cargarHilo = useCallback(async (a: { wa: string | null; email: string | null }) => {
    if (!a.wa && !a.email) return;   // fila virtual: no hay hilo que cargar
    const qs = a.wa ? `id=${a.wa}` : `email_id=${a.email}`;
    const j = await fetch(`/api/crm/whatsapp/hilo?${qs}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    // Respuesta tardía de OTRA conversación (el usuario ya cambió de chat):
    // se descarta, si no pisa el hilo nuevo y el composer manda al chat equivocado.
    const act = activaRef.current;
    if (!act || (a.wa && act.wa !== a.wa) || (!a.wa && a.email && act.email !== a.email)) return;
    if (j && !j.error) setHilo(j);
  }, []);

  useEffect(() => {
    fetch('/api/auth/yo').then(r => r.json()).then(setYo).catch(() => {});
    fetch('/api/crm/whatsapp/equipo').then(r => r.json()).then(j => setEquipo(j.equipo || [])).catch(() => {});
  }, []);

  const filtrosRef = useRef(filtros); filtrosRef.current = filtros;
  useEffect(() => { cargarLista(filtros); }, [filtros, cargarLista]);
  const [tick, setTick] = useState(0);
  const guardarVistaRef = useRef<((cfg: any) => void) | null>(null);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { cargarLista(filtrosRef.current); setTick(x => x + 1); } }, 15000);
    const onFocus = () => cargarLista(filtrosRef.current);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [cargarLista]);

  useEffect(() => {
    if (!activa) { setHilo(null); return; }
    setHilo(null);
    if (activa.wa || activa.email) cargarHilo(activa);
    const t = setInterval(() => {
      if (!document.hidden && activaRef.current) {
        cargarHilo(activaRef.current);
        if (activaRef.current.wa) fetch('/api/crm/whatsapp/presencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: activaRef.current.wa }) }).catch(() => {});
      }
    }, 5000);
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
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try { new Notification('WhatsApp · CRM SACS', { body: 'Tienes mensajes nuevos en el inbox' }); } catch { /* nada */ }
      }
    }
    prevNoLeidas.current = n;
    document.title = n > 0 ? `(${n}) Inbox — Sacs CRM` : 'Sacs CRM';
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
      if (conv) setActiva({ id: conv, wa: conv, email: null });
      else if (tel) {
        const limpio = tel.replace(/\D/g, '');
        const hit = lista.find((c: any) => String(c.telefono || '').replace(/\D/g, '').endsWith(limpio.slice(-10)));
        if (hit) setActiva({ id: hit.id, wa: hit.wa_id, email: hit.email_id });
        else setFiltros(f => ({ ...f, search: tel }));
      }
    } catch { /* SSR o URL rara */ }
  }, [lista]);

  const abrir = (c: any) => {
    setActiva({ id: c.id, wa: c.wa_id ?? null, email: c.email_id ?? null });
    setLista(l => (l || []).map(x => x.id === c.id ? { ...x, no_leidos: 0 } : x));
  };

  const refrescar = () => { if (activaRef.current) cargarHilo(activaRef.current); cargarLista(filtrosRef.current); };
  const waId = () => activaRef.current?.wa || null;

  const api = {
    enviarTexto: async (texto: string, cita?: string | null) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: waId(), texto, cita: cita || undefined }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar(); return r;
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
      <div style={{ background: '#fff', minHeight: 'calc(100dvh - 64px - var(--crm-bottomnav-h, 64px))' }}>
        <style>{CSS_INBOX}</style>
        {!activa ? (
          <ListaConversaciones {...propsLista} mobile onFiltros={() => setFiltrosMobile(true)} />
        ) : (
          <>
            <Hilo hilo={hilo} filaActiva={filaActiva} equipo={equipo} api={api} mobile
              onBack={() => setActiva(null)} onVerDetalle={() => setDetalleMobile(true)} />
            <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
              {conv && <PanelDetalle hilo={hilo} api={api} />}
            </Sheet>
          </>
        )}
        {nuevoChat && <NuevoChat lista={lista} api={api} onAbrir={abrir} onClose={() => setNuevoChat(false)} />}
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
        overflow: 'hidden', height: 'calc(100dvh - 22px)', minHeight: 480,
      }}>
        <SidebarInbox counts={counts} filtros={filtros} setFiltros={setFiltros} yo={yo} tick={tick}
          vistaActiva={vistaActiva} onVista={setVistaActiva} equipo={equipo} onGuardarVistaExterna={fn => { guardarVistaRef.current = fn; }} />
        <ListaConversaciones {...propsLista} />
        {activa ? (
          <Hilo hilo={hilo} filaActiva={filaActiva} equipo={equipo} api={api}
            onVerDetalle={isCompact ? () => setDetalleMobile(true) : undefined} />
        ) : (
          <VacioHilo onNuevo={() => setNuevoChat(true)} />
        )}
        {!isCompact && (
          <div className="wa-scroll" style={{ width: L.detalle, flexShrink: 0, borderLeft: `1px solid ${C.g200}`, overflowY: 'auto', background: '#fff' }}>
            {conv ? <PanelDetalle hilo={hilo} api={api} />
              : <div style={{ padding: 18, color: C.g400, fontSize: 12 }}>El detalle del cliente aparece aquí.</div>}
          </div>
        )}
      </div>
      {isCompact && (
        <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
          {conv && <PanelDetalle hilo={hilo} api={api} />}
        </Sheet>
      )}
      {nuevoChat && <NuevoChat lista={lista} api={api} onAbrir={abrir} onClose={() => setNuevoChat(false)} />}
    </div>
  );
}

/** Empty state del hilo con atajos en <kbd> (portado). */
function VacioHilo({ onNuevo }: { onNuevo: () => void }) {
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
      <p style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', margin: '14px 0 4px', color: C.g900 }}>Elige una conversación</p>
      <p style={{ fontSize: 12, color: C.g400, marginBottom: 14 }}>o empieza una nueva con un contacto del CRM</p>
      <p style={{ display: 'flex', gap: 14, fontSize: 11, color: C.g500 }}>
        <span><span style={kbd}>N</span>&nbsp; Nuevo chat</span>
      </p>
    </div>
  );
}
