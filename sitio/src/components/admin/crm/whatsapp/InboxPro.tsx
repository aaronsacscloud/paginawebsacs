// WHATSAPP · El inbox propio del CRM (reemplaza al iframe de Kapso).
//
// Cuatro zonas en escritorio — rail de filtros | lista | hilo | detalle — y
// flujo apilado en móvil (lista → hilo, detalle en Sheet). El tiempo real es
// polling deliberado (15 s lista, 5 s hilo abierto, refresh al focus, pausa
// con la pestaña oculta): no hay realtime en el CRM y el auth es cookie
// propia; ver el plan del inbox v2.
//
// Este componente ES el dueño de los datos (lista, counts, hilo) y de todas
// las acciones; Rail/Lista/Hilo/Panel solo pintan y avisan.
import { useCallback, useEffect, useRef, useState } from 'react';
import { S, Aviso } from '../email/ui';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { useIsMobile, useDrawerHistory } from '../../../../lib/ui/mobile';
import RailInbox from './RailInbox';
import ListaConversaciones from './ListaConversaciones';
import Hilo from './Hilo';
import PanelDetalle from './PanelDetalle';
import NuevoChat from './NuevoChat';

export type Filtros = {
  filtro: string; etapa: string; search: string;
  // Filtros "de cliente" (mismos catálogos que la sección Clientes):
  tipo: string; plan: string; etiqueta: string; asignado: string; estado: string; sin_contacto: string;
};
export const FILTROS_BASE: Filtros = { filtro: 'todas', etapa: '', search: '', tipo: '', plan: '', etiqueta: '', asignado: '', estado: '', sin_contacto: '' };

export default function InboxPro() {
  const isMobile = useIsMobile();
  const isCompact = useIsMobile(1200);       // sin detalle fijo entre 900 y 1200
  const [yo, setYo] = useState<any>(null);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_BASE);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [lista, setLista] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<any>({});
  // La conversación activa es OMNICANAL: ancla de WhatsApp y/o hilo de correo.
  const [activa, setActiva] = useState<{ id: string; wa: string | null; email: string | null } | null>(null);
  const [hilo, setHilo] = useState<any>(null);           // { conversacion, mensajes, notas, ventana }
  const [detalleMobile, setDetalleMobile] = useState(false);
  const [nuevoChat, setNuevoChat] = useState(false);
  const [error, setError] = useState('');

  // En móvil el hilo es una vista APILADA: el botón atrás físico debe regresar
  // a la lista, no sacar del CRM. (El Sheet del detalle ya trae su propio
  // useDrawerHistory; este cubre la transición lista→hilo.)
  useDrawerHistory(isMobile && !!activa, () => setActiva(null));

  // ── Carga ──
  const cargarLista = useCallback(async (f: Filtros) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as any).toString();
    const j = await fetch(`/api/crm/whatsapp/inbox?${qs}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j) { setError('Sin conexión — revisa tu internet'); return; }
    setError(''); setLista(j.conversaciones || []); setCounts(j.counts || {});
  }, []);

  const cargarHilo = useCallback(async (a: { wa: string | null; email: string | null }) => {
    const qs = a.wa ? `id=${a.wa}` : `email_id=${a.email}`;
    const j = await fetch(`/api/crm/whatsapp/hilo?${qs}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (j && !j.error) setHilo(j);
  }, []);

  useEffect(() => {
    fetch('/api/auth/yo').then(r => r.json()).then(setYo).catch(() => {});
    fetch('/api/crm/whatsapp/equipo').then(r => r.json()).then(j => setEquipo(j.equipo || [])).catch(() => {});
  }, []);

  // Lista: al cambiar filtros + polling 15 s + focus.
  const filtrosRef = useRef(filtros); filtrosRef.current = filtros;
  useEffect(() => { cargarLista(filtros); }, [filtros, cargarLista]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) cargarLista(filtrosRef.current); }, 15000);
    const onFocus = () => cargarLista(filtrosRef.current);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [cargarLista]);

  // Hilo activo: carga + polling 5 s.
  const activaRef = useRef(activa); activaRef.current = activa;
  useEffect(() => {
    if (!activa) { setHilo(null); return; }
    setHilo(null);
    cargarHilo(activa);
    const t = setInterval(() => { if (!document.hidden && activaRef.current) cargarHilo(activaRef.current); }, 5000);
    return () => clearInterval(t);
  }, [activa?.id, cargarHilo]);

  // ── Tiempo real percibido: beep + título cuando suben los no-leídos ──
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
    } catch { /* SSR o URL rara: el inbox abre normal */ }
  }, [lista]);

  const abrir = (c: any) => {
    setActiva({ id: c.id, wa: c.wa_id ?? c.id, email: c.email_id ?? null });
    // Optimista: el badge se apaga al abrir, sin esperar el GET.
    setLista(l => (l || []).map(x => x.id === c.id ? { ...x, no_leidos: 0 } : x));
  };

  // ── Acciones (las ejecuta el dueño de los datos) ──
  const refrescar = () => { if (activaRef.current) cargarHilo(activaRef.current); cargarLista(filtrosRef.current); };
  const waId = () => activaRef.current?.wa || null;

  const api = {
    enviarTexto: async (texto: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: waId(), texto }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    enviarPlantilla: async (plantilla: any, telefono?: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telefono ? { telefono, plantilla } : { conversation_id: waId(), plantilla }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (r.conversation_id && r.conversation_id !== activaRef.current?.wa) setActiva({ id: r.conversation_id, wa: r.conversation_id, email: null });
      refrescar();
      return r;
    },
    enviarArchivo: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file); fd.append('conversation_id', waId() || '');
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', body: fd })
        .then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    crearNota: async (texto: string) => {
      const r = await fetch('/api/crm/whatsapp/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: waId(), texto }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    patchConversacion: async (cambios: any) => {
      const r = await fetch('/api/crm/whatsapp/hilo', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: waId(), ...cambios }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    guardarContacto: async (contactId: string, cambios: any) => {
      const r = await fetch('/api/crm/contacts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactId, ...cambios }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
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
  };

  if (error && lista === null) return <div style={S.wrap}><Aviso tono="malo">{error}</Aviso></div>;
  if (lista === null) return <Cargando texto="Cargando el inbox de WhatsApp…" />;

  const conv = hilo?.conversacion || null;

  // ── Móvil: apilado lista → hilo; detalle en Sheet ──
  if (isMobile) {
    return (
      <div style={{ background: '#fff', minHeight: 'calc(100dvh - 120px)' }}>
        {!activa ? (
          <ListaConversaciones lista={lista} counts={counts} filtros={filtros} setFiltros={setFiltros}
            activaId={null} onAbrir={abrir} mobile equipo={equipo} yo={yo} onNuevo={() => setNuevoChat(true)}
            onFiltros={() => setFiltrosMobile(true)} />
        ) : (
          <>
            <Hilo hilo={hilo} equipo={equipo} api={api} mobile
              onBack={() => setActiva(null)} onVerDetalle={() => setDetalleMobile(true)} />
            <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
              {conv && <PanelDetalle hilo={hilo} api={api} />}
            </Sheet>
          </>
        )}
        {nuevoChat && <NuevoChat lista={lista} api={api} onAbrir={abrir} onClose={() => setNuevoChat(false)} />}
        <Sheet open={filtrosMobile} onClose={() => setFiltrosMobile(false)} title="Filtros y vistas" width={340}>
          <RailInbox counts={counts} filtros={filtros} setFiltros={f => { setFiltros(f); }} equipo={equipo} />
        </Sheet>
      </div>
    );
  }

  // ── Escritorio: 4 zonas (3 si el ancho no da para el detalle) ──
  // Pantalla COMPLETA: el inbox es una app, no una tarjeta — ocupa todo lo
  // que el shell deja (paddingTop 22 del contenido) sin marco ni sub-tabs.
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid', gap: 0, background: '#fff', borderTop: '1px solid #eeeef1',
        overflow: 'hidden', height: 'calc(100dvh - 22px)', minHeight: 480,
        gridTemplateColumns: isCompact ? '212px 320px minmax(0,1fr)' : '224px 348px minmax(0,1fr) 336px',
      }}>
        <RailInbox counts={counts} filtros={filtros} setFiltros={setFiltros} equipo={equipo} />
        <ListaConversaciones lista={lista} counts={counts} filtros={filtros} setFiltros={setFiltros}
          activaId={activa?.id || null} onAbrir={abrir} equipo={equipo} yo={yo} onNuevo={() => setNuevoChat(true)} />
        {activa ? (
          <Hilo hilo={hilo} equipo={equipo} api={api}
            onVerDetalle={isCompact ? () => setDetalleMobile(true) : undefined} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5a2af', fontSize: '0.85rem', borderLeft: '1px solid #f0eff3' }}>
            Elige una conversación para leerla y responder.
          </div>
        )}
        {!isCompact && (
          <div style={{ borderLeft: '1px solid #f0eff3', overflowY: 'auto' }}>
            {conv ? <PanelDetalle hilo={hilo} api={api} />
              : <div style={{ padding: 18, color: '#a5a2af', fontSize: '0.78rem' }}>El detalle del cliente aparece aquí.</div>}
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
