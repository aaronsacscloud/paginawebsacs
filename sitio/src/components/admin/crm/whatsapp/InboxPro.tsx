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

export type Filtros = { filtro: string; etapa: string; search: string };

export default function InboxPro() {
  const isMobile = useIsMobile();
  const isCompact = useIsMobile(1200);       // sin detalle fijo entre 900 y 1200
  const [yo, setYo] = useState<any>(null);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ filtro: 'todas', etapa: '', search: '' });
  const [lista, setLista] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<any>({});
  const [activaId, setActivaId] = useState<string | null>(null);
  const [hilo, setHilo] = useState<any>(null);           // { conversacion, mensajes, notas, ventana }
  const [detalleMobile, setDetalleMobile] = useState(false);
  const [nuevoChat, setNuevoChat] = useState(false);
  const [error, setError] = useState('');

  // En móvil el hilo es una vista APILADA: el botón atrás físico debe regresar
  // a la lista, no sacar del CRM. (El Sheet del detalle ya trae su propio
  // useDrawerHistory; este cubre la transición lista→hilo.)
  useDrawerHistory(isMobile && !!activaId, () => setActivaId(null));

  // ── Carga ──
  const cargarLista = useCallback(async (f: Filtros) => {
    const qs = new URLSearchParams({ filtro: f.filtro, etapa: f.etapa, search: f.search }).toString();
    const j = await fetch(`/api/crm/whatsapp/inbox?${qs}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!j) { setError('Sin conexión — revisa tu internet'); return; }
    setError(''); setLista(j.conversaciones || []); setCounts(j.counts || {});
  }, []);

  const cargarHilo = useCallback(async (id: string) => {
    const j = await fetch(`/api/crm/whatsapp/hilo?id=${id}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
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
  const activaRef = useRef(activaId); activaRef.current = activaId;
  useEffect(() => {
    if (!activaId) { setHilo(null); return; }
    setHilo(null);
    cargarHilo(activaId);
    const t = setInterval(() => { if (!document.hidden && activaRef.current) cargarHilo(activaRef.current); }, 5000);
    return () => clearInterval(t);
  }, [activaId, cargarHilo]);

  // Deep-links: ?wa_conv=<id> | ?wa_search=<tel> (una sola vez).
  const deepLink = useRef(false);
  useEffect(() => {
    if (deepLink.current || lista === null) return;
    deepLink.current = true;
    try {
      const p = new URLSearchParams(window.location.search);
      const conv = p.get('wa_conv');
      const tel = p.get('wa_search');
      if (conv) setActivaId(conv);
      else if (tel) {
        const limpio = tel.replace(/\D/g, '');
        const hit = lista.find((c: any) => c.telefono.replace(/\D/g, '').endsWith(limpio.slice(-10)));
        if (hit) setActivaId(hit.id);
        else setFiltros(f => ({ ...f, search: tel }));
      }
    } catch { /* SSR o URL rara: el inbox abre normal */ }
  }, [lista]);

  const abrir = (id: string) => {
    setActivaId(id);
    // Optimista: el badge se apaga al abrir, sin esperar el GET.
    setLista(l => (l || []).map(c => c.id === id ? { ...c, no_leidos: 0 } : c));
  };

  // ── Acciones (las ejecuta el dueño de los datos) ──
  const refrescar = () => { if (activaRef.current) cargarHilo(activaRef.current); cargarLista(filtrosRef.current); };

  const api = {
    enviarTexto: async (texto: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activaId, texto }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    enviarPlantilla: async (plantilla: any, telefono?: string) => {
      const r = await fetch('/api/crm/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telefono ? { telefono, plantilla } : { conversation_id: activaId, plantilla }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      if (r.conversation_id && r.conversation_id !== activaId) setActivaId(r.conversation_id);
      refrescar();
      return r;
    },
    enviarArchivo: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file); fd.append('conversation_id', activaId || '');
      const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', body: fd })
        .then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    crearNota: async (texto: string) => {
      const r = await fetch('/api/crm/whatsapp/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activaId, texto }),
      }).then(x => x.json()).catch(e => ({ error: String(e) }));
      refrescar();
      return r;
    },
    patchConversacion: async (cambios: any) => {
      const r = await fetch('/api/crm/whatsapp/hilo', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activaId, ...cambios }),
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
        {!activaId ? (
          <ListaConversaciones lista={lista} counts={counts} filtros={filtros} setFiltros={setFiltros}
            activaId={null} onAbrir={abrir} mobile equipo={equipo} yo={yo} onNuevo={() => setNuevoChat(true)} />
        ) : (
          <>
            <Hilo hilo={hilo} equipo={equipo} api={api} mobile
              onBack={() => setActivaId(null)} onVerDetalle={() => setDetalleMobile(true)} />
            <Sheet open={detalleMobile} onClose={() => setDetalleMobile(false)} title="Detalle del cliente" width={420}>
              {conv && <PanelDetalle hilo={hilo} api={api} />}
            </Sheet>
          </>
        )}
        {nuevoChat && <NuevoChat lista={lista} api={api} onAbrir={abrir} onClose={() => setNuevoChat(false)} />}
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
        <RailInbox counts={counts} filtros={filtros} setFiltros={setFiltros} />
        <ListaConversaciones lista={lista} counts={counts} filtros={filtros} setFiltros={setFiltros}
          activaId={activaId} onAbrir={abrir} equipo={equipo} yo={yo} onNuevo={() => setNuevoChat(true)} />
        {activaId ? (
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
