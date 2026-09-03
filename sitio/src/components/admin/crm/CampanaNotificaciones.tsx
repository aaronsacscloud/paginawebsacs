import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ClienteDrawer360 from './ClienteDrawer360';
import { useIsMobile } from '../../../lib/ui/mobile';

/* ═══ Campana de notificaciones del CRM ═══
 *
 * Lo que se cobra solo también hay que verlo solo. Un cargo domiciliado de
 * Mercado Pago entra de madrugada, se registra el pago y la próxima factura
 * avanza sin que nadie toque nada: perfecto para el cliente, invisible para
 * quien lleva el negocio. Aquí caen esos hechos —el cobro que entró, el que
 * rebotó, el dinero que llegó sin dueño— con un clic al cliente.
 *
 * Se refresca cada 60 s y al volver a la pestaña: los cobros no llegan mientras
 * miras, llegan mientras no.
 */

/* ═══ La clasificación ═══
 *
 * El panel era una lista sola: 40 avisos de cinco naturalezas distintas en el
 * mismo montón, del más nuevo al más viejo. Un mensaje de WhatsApp, un ticket
 * de soporte y un lead que acaba de entrar no son la misma cosa y no los atiende
 * la misma persona, pero se leían igual y había que clasificarlos con la vista,
 * uno por uno, cada vez.
 *
 * Las familias salen de los tipos que de verdad existen en la tabla (medido
 * sobre crm_notificaciones, no inventado): los wa_ son conversación, los
 * ticket_ y soporte_sla son soporte, los lead_, cotizacion_, demo_ y prueba_
 * son venta, y los pago_ y cobro_ son dinero. Lo que no case cae en "Otras" — y que exista esa
 * bolsa es a propósito: si mañana nace un tipo nuevo, aparece en el drawer en
 * vez de desaparecer sin que nadie se entere. */
export const FAMILIAS = [
  { id: 'venta', l: 'Ventas', casa: (t: string) => /^(lead_|cotizacion_|demo_|prueba_)/.test(t), color: '#5B4BD6' },
  { id: 'conversacion', l: 'Conversaciones', casa: (t: string) => /^wa_/.test(t), color: '#1A8F7A' },
  { id: 'soporte', l: 'Soporte', casa: (t: string) => /^(ticket_|soporte_)/.test(t), color: '#C2410C' },
  { id: 'dinero', l: 'Dinero', casa: (t: string) => /^(pago_|cobro_|suscripcion_|factura_)/.test(t), color: '#1E8A63' },
  /* Churn tiene familia propia: no es venta ni soporte. Mezclarlo con ventas
     escondería el aviso más caro del CRM entre los leads del día. */
  { id: 'churn', l: 'Churn', casa: (t: string) => /^churn_/.test(t), color: '#C0554E' },
];
/* SISTEMA es otra cosa: no es un hecho del negocio (un lead, un cobro) sino algo que
   la automatización NO pudo resolver sola —o resolvió y avisa— y que pide una acción
   concreta de una persona. Va en su propia pestaña, con un «qué hacer» explícito. */
export const esSistema = (t?: string | null) => /^sistema_/.test(String(t || ''));
const familiaDe = (t?: string | null) => FAMILIAS.find(f => f.casa(String(t || '')))?.id || 'otras';
const colorFamilia = (t?: string | null) => FAMILIAS.find(f => f.casa(String(t || '')))?.color || '#7d7a8a';

/* Y el otro eje: cuándo pasó. Con 40 avisos seguidos no se sabe si lo de arriba
   es de hace 10 minutos o de la semana pasada. */
function bloqueDe(iso: string): string {
  const d = new Date(iso); const hoy = new Date();
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const difDias = Math.round((dia(hoy) - dia(d)) / 86400000);
  if (difDias <= 0) return 'Hoy';
  if (difDias === 1) return 'Ayer';
  if (difDias < 7) return 'Esta semana';
  return 'Antes';
}

const NIVEL: Record<string, { punto: string; fondo: string }> = {
  urgente: { punto: '#b93333', fondo: '#fff6f6' },
  alerta:  { punto: '#c2410c', fondo: '#fffaf3' },
  info:    { punto: '#1A8F7A', fondo: '#fff' },
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

/* Los títulos vienen con emoji desde quien crea el aviso ("🔴 Lead sin primer
   toque…", "⏰ …"). En pantalla sobran: el nivel ya lo dice el punto de color y
   la familia el filo de la izquierda, así que el emoji solo repite en dibujito
   lo que la interfaz ya codificó — y el estándar del producto es sin iconos
   decorativos. Se limpia al pintar, no en la base: el dato que mandó el
   servidor se queda como está. */
const sinEmoji = (t?: string | null) => String(t || '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
  .replace(/\s{2,}/g, ' ').trim();

function hace(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

/* `abiertoDesdeFuera` existe por el mobile: ahí el menú es una hoja de opciones
   que solo acepta renglones de datos, así que no puede montar este componente
   como botón. La hoja abre el panel y la campana se dibuja SIN su renglón. */
export default function CampanaNotificaciones({ onIrA, abiertoDesdeFuera, onCerrar }: {
  onIrA?: (tab: string) => void; abiertoDesdeFuera?: boolean; onCerrar?: () => void;
}) {
  const isMobile = useIsMobile();
  const controlado = abiertoDesdeFuera !== undefined;
  const [abiertoLocal, setAbiertoLocal] = useState(false);
  const abierto = controlado ? !!abiertoDesdeFuera : abiertoLocal;
  const setAbierto = (v: boolean | ((a: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(abierto) : v;
    if (controlado) { if (!next) onCerrar?.(); return; }
    setAbiertoLocal(next);
  };
  const [data, setData] = useState<any[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [cliente, setCliente] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const j = await fetch('/api/crm/notificaciones?limit=40', { cache: 'no-store' }).then(r => r.json());
      setData(j.data || []);
      setNoLeidas(j.no_leidas || 0);
    } catch { /* la campana nunca rompe la pantalla */ }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [cargar]);

  async function marcarLeida(n: any) {
    if (n.leida_at) return;
    // Optimista: el contador tiene que bajar en el clic, no en el siguiente poll.
    setData(prev => prev.map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x));
    setNoLeidas(c => Math.max(0, c - 1));
    await fetch('/api/crm/notificaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
  }
  async function marcarTodas() {
    setData(prev => prev.map(x => x.leida_at ? x : { ...x, leida_at: new Date().toISOString() }));
    setNoLeidas(0);
    await fetch('/api/crm/notificaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) }).catch(() => {});
    cargar();
  }

  /* A DÓNDE LLEVA UN AVISO. De lo más concreto a lo más vago: si el aviso
     sabe de qué conversación habla, el clic tiene que caer en ESA
     conversación, no en la bandeja; si sabe de qué lead, en su ficha.
     Antes ganaba `company_id`, que casi todos los avisos traen, así que un
     «WhatsApp de Fulano: quiero saber el costo» abría la ficha 360 de la
     cuenta —con el dato de la conversación ahí mismo, en metadata, sin usar—
     y para contestar había que volver a buscar el hilo a mano. Y los avisos
     de lead sin primer toque no traen destino ni empresa: no hacían
     absolutamente nada al tocarlos. */
  function abrir(n: any) {
    marcarLeida(n);
    setAbierto(false);
    const m = n.metadata || {};
    if (m.churn_caso_id && onIrA) { onIrA(`churn?caso=${m.churn_caso_id}`); return; }
    if (m.conversation_id && onIrA) { onIrA(`whatsapp?wa_conv=${m.conversation_id}`); return; }
    if (m.contact_id && onIrA) { onIrA(`pipeline?lead=${m.contact_id}`); return; }
    if (n.company_id) { setCliente(n.company_id); return; }
    if (n.destino && onIrA) onIrA(n.destino);
  }

  // Abierto desde la hoja del mobile nadie llamó a `cargar`: se hace aquí.
  useEffect(() => { if (controlado && abierto) cargar(); }, [controlado, abierto, cargar]);

  /* CAJÓN POR LA DERECHA, no un globo pegado al botón. El globo nacía en la
     esquina de abajo a la izquierda, medía 400×72vh y se le acababa el alto a
     la mitad de la lista; además tapaba el menú, que es justo donde uno va
     después de leer un aviso. Por la derecha entra sobre el contenido, cabe
     completo de arriba abajo y se cierra sin tocar nada del menú. */
  const panel: any = {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: isMobile ? '100%' : 'min(430px, 92vw)',
  };

  const alternar = () => {
    setAbierto(a => !a);
    if (!abierto) cargar();
  };

  // Escape cierra: es un cajón, y de un cajón se sale sin buscar la X.
  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('keydown', onTecla);
    return () => document.removeEventListener('keydown', onTecla);
  });

  /* El filtro por familia y lo no leído. `filtro` vacío = todas. */
  const [filtro, setFiltro] = useState<string>('');
  const [soloNuevas, setSoloNuevas] = useState(false);
  /* Dos pestañas arriba de todo: ACTIVIDAD (lo que pasa en el negocio) y SISTEMA (lo que la
     automatización necesita de una persona). Si hay algo del sistema sin leer, se abre ahí. */
  const [vista, setVista] = useState<'actividad' | 'sistema'>('actividad');
  const sistema = data.filter((n: any) => esSistema(n.tipo));
  const actividad = data.filter((n: any) => !esSistema(n.tipo));
  const sistemaNuevas = sistema.filter((n: any) => !n.leida_at).length;
  const actividadNuevas = actividad.filter((n: any) => !n.leida_at).length;
  useEffect(() => { if (abierto && sistemaNuevas > 0 && actividadNuevas === 0) setVista('sistema'); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = vista === 'sistema' ? sistema : actividad;
  const visibles = base.filter((n: any) =>
    (vista === 'sistema' || !filtro || familiaDe(n.tipo) === filtro) && (!soloNuevas || !n.leida_at));
  const cuantas = (id: string) => actividad.filter((n: any) => familiaDe(n.tipo) === id).length;
  /* Agrupadas por cuándo, en el orden en que ya vienen (la consulta las trae de
     la más nueva a la más vieja), así que basta recorrer y cortar. */
  const bloques: { t: string; items: any[] }[] = [];
  for (const n of visibles) {
    const b = bloqueDe(n.created_at);
    if (bloques[bloques.length - 1]?.t !== b) bloques.push({ t: b, items: [] });
    bloques[bloques.length - 1].items.push(n);
  }

  // Alguna sin leer que de verdad urge: solo entonces el contador se pinta rojo.
  const hayUrgente = data.some((n: any) => !n.leida_at && n.nivel === 'urgente');

  const icono = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );

  return (
    <>
      {/* La campana es un RENGLÓN del menú, con el mismo alto y la misma letra
          que los demás. Hubo una versión flotante —fija arriba a la derecha
          cuando el menú estaba plegado o en mobile— y se eliminó: tapaba el
          contenido de la pantalla que se estaba usando. Un aviso no puede
          estorbarle al trabajo que anuncia. */}
      {!controlado && (
        <button onClick={alternar} aria-label="Notificaciones"
          style={{
            display: 'flex', alignItems: 'center', gap: 11, width: 'calc(100% - 16px)', minHeight: 38, textAlign: 'left',
            background: abierto ? '#EEECFE' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            margin: '1px 8px', padding: '7px 10px', borderRadius: 9,
            fontSize: '0.79rem', fontWeight: 700, color: '#5a5a63',
          }}>
          {/* Lo urgente lo dice un PUNTO en la campana, no el color de toda la
              pastilla. La regla original era buena —rojo solo si hay algo
              urgente— pero con 99+ sin leer siempre hay algo urgente, así que
              el rojo estaba puesto de forma permanente: un bloque rojo fijo en
              la esquina del menú, que ya no avisa de nada y ensucia todo el
              pie. Un punto dice lo mismo y cabe en 6 píxeles. */}
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0, color: '#9B8CFA' }}>
            {icono}
            {hayUrgente && noLeidas > 0 && (
              <span title="Hay algo urgente sin leer"
                style={{ position: 'absolute', top: -1, right: -2, width: 6, height: 6, borderRadius: 99, background: '#C0554E', boxShadow: '0 0 0 1.5px #F8F6FE' }} />
            )}
          </span>
          Notificaciones
          {noLeidas > 0 && (
            <span style={{
              marginLeft: 'auto', minWidth: 20, textAlign: 'center', borderRadius: 20,
              background: '#EEECFE', color: '#5B4BD6',
              fontSize: '0.63rem', fontWeight: 800, padding: '2px 7px',
            }}>{noLeidas > 99 ? '99+' : noLeidas}</span>
          )}
        </button>
      )}

      {/* Va por PORTAL al body. Un elemento fijo se posiciona contra el
          viewport… salvo que algún ancestro tenga transform, filter o
          will-change: entonces ESE se vuelve su marco de referencia. La campana
          vive dentro del menú, así que `right: 0` colocaba el cajón en la
          orilla derecha DEL MENÚ — medido: salía en x = −211, casi todo fuera
          de la pantalla. Colgándolo del body, la orilla vuelve a ser la orilla. */}
      {abierto && typeof document !== 'undefined' && createPortal(
        <>
          <style>{`
            @keyframes notif-entra { from { transform: translateX(24px); opacity: .4; } to { transform: none; opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .notif-cajon { animation: none !important; } }
          `}</style>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 107, background: 'rgba(16,24,40,.28)' }} />
          <div className="notif-cajon" role="dialog" aria-modal="true" aria-label="Notificaciones" style={{
            ...panel, zIndex: 109, background: '#fff', borderLeft: '1px solid #eae7f2',
            boxShadow: '-14px 0 44px rgba(16,24,40,.16)', display: 'flex', flexDirection: 'column',
            animation: 'notif-entra 180ms ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 16px 12px', borderBottom: '1px solid #f3f1f8' }}>
              <b style={{ fontSize: '1rem', color: '#241d43', letterSpacing: '-.01em' }}>Notificaciones</b>
              {noLeidas > 0 && (
                <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#fff', background: hayUrgente ? '#C0554E' : '#9B8CFA', borderRadius: 20, padding: '2px 8px' }}>
                  {noLeidas > 99 ? '99+' : noLeidas} sin leer
                </span>
              )}
              <div style={{ flex: 1 }} />
              {noLeidas > 0 && <button onClick={marcarTodas} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#5B4BD6', fontWeight: 700, fontFamily: 'inherit' }}>Marcar todas</button>}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e88a8', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Actividad | Sistema */}
            <div role="tablist" aria-label="Tipo de avisos" style={{ display: 'flex', borderBottom: '1px solid #f3f1f8', padding: '0 16px' }}>
              {([['actividad', 'Actividad del CRM', actividadNuevas], ['sistema', 'Sistema', sistemaNuevas]] as const).map(([id, l, n]) => {
                const on = vista === id;
                return (
                  <button key={id} role="tab" aria-selected={on} onClick={() => setVista(id)} style={{
                    background: 'none', border: 'none', borderBottom: `2px solid ${on ? (id === 'sistema' ? '#B7791F' : '#5B4BD6') : 'transparent'}`,
                    padding: '10px 12px 9px', marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.78rem', fontWeight: on ? 800 : 600, color: on ? '#241d43' : '#7d7a8a', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {l}
                    {n > 0 && <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: id === 'sistema' ? '#B7791F' : '#9B8CFA', borderRadius: 20, padding: '1px 7px' }}>{n}</span>}
                  </button>
                );
              })}
            </div>

            {/* Los filtros: cada familia con su cuenta, y solo si tiene algo.
                Una pestaña vacía es una promesa rota — se ve, se toca y no hay
                nada; mejor que no esté. */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px', borderBottom: '1px solid #f3f1f8' }}>
              {vista === 'sistema' && (
                <span style={{ fontSize: '0.72rem', color: '#7d7a8a', lineHeight: 1.45, paddingRight: 8 }}>
                  Lo que la automatización no pudo resolver sola. Cada aviso dice qué hacer; el clic abre el hilo o el lead.
                </span>
              )}
              <button onClick={() => setSoloNuevas(v => !v)} style={{
                flexShrink: 0, border: '1px solid', borderColor: soloNuevas ? '#5B4BD6' : '#e8e5f0',
                background: soloNuevas ? '#EEECFE' : '#fff', color: soloNuevas ? '#5B4BD6' : '#5a5a63',
                borderRadius: 20, padding: '5px 11px', fontSize: '0.72rem', fontWeight: soloNuevas ? 800 : 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Sin leer</button>
              {vista === 'actividad' && <span style={{ width: 1, background: '#eeebf6', flexShrink: 0, margin: '2px 2px' }} />}
              {vista === 'actividad' && [{ id: '', l: 'Todas', n: actividad.length, color: '#5a5a63' },
                ...FAMILIAS.map(f => ({ id: f.id, l: f.l, n: cuantas(f.id), color: f.color })),
                { id: 'otras', l: 'Otras', n: cuantas('otras'), color: '#7d7a8a' }]
                .filter(f => f.id === '' || f.n > 0)
                .map(f => {
                  const on = filtro === f.id;
                  return (
                    <button key={f.id || 'todas'} onClick={() => setFiltro(f.id)} style={{
                      flexShrink: 0, border: '1px solid', borderColor: on ? f.color : '#e8e5f0',
                      background: on ? f.color : '#fff', color: on ? '#fff' : '#5a5a63',
                      borderRadius: 20, padding: '5px 11px', fontSize: '0.72rem', fontWeight: on ? 800 : 600,
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      {f.l}
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, opacity: on ? 0.85 : 0.55 }}>{f.n}</span>
                    </button>
                  );
                })}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {visibles.length === 0 ? (
                <div style={{ padding: '40px 26px', textAlign: 'center', color: '#8e88a8', fontSize: '0.83rem', lineHeight: 1.6 }}>
                  {cargando ? 'Cargando…'
                    : filtro || soloNuevas ? 'Nada con este filtro.'
                    : vista === 'sistema' ? 'Todo en orden. Aquí aparece lo que el agente o los procesos automáticos no pudieron resolver solos: una cita que no se pudo agendar, una liga de Meet que faltó, un reintento que se agotó.'
                    : 'Nada nuevo. Aquí van a caer los leads que entran, los mensajes de WhatsApp, los tickets de soporte y los cobros.'}
                </div>
              ) : bloques.map(b => (
                <div key={b.t}>
                  {/* El rótulo del bloque se queda pegado mientras se recorre:
                      bajando 40 avisos, sin él se pierde de cuándo son. */}
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 1, background: '#FBFAFF',
                    padding: '6px 16px', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: '#8e88a8', borderBottom: '1px solid #f3f1f8',
                  }}>{b.t}</div>
                  {b.items.map((n: any) => {
                    const cfg = NIVEL[n.nivel] || NIVEL.info;
                    const empresa = Array.isArray(n.companies) ? n.companies[0] : n.companies;
                    const cf = colorFamilia(n.tipo);
                    return (
                      <div key={n.id} onClick={() => abrir(n)} role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') abrir(n); }}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid #f6f5fa', cursor: 'pointer',
                          background: n.leida_at ? '#fff' : cfg.fondo,
                          /* La familia se ve en el filo de la izquierda: dice de
                             qué va el aviso antes de leer una sola palabra. */
                          borderLeft: `3px solid ${n.leida_at ? 'transparent' : cf}`,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FBFAFF'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.leida_at ? '#fff' : cfg.fondo; }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: n.leida_at ? '#ddd' : cfg.punto, marginTop: 6, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.83rem', fontWeight: n.leida_at ? 500 : 700, color: '#1a1a1a', lineHeight: 1.35 }}>{sinEmoji(n.titulo)}</div>
                            {n.detalle && <div style={{ fontSize: '0.74rem', color: '#71707C', lineHeight: 1.45, marginTop: 2 }}>{n.detalle}</div>}
                            {esSistema(n.tipo) && n.metadata?.que_hacer && (
                              <div style={{ marginTop: 7, padding: '7px 9px', borderRadius: 7, background: n.leida_at ? '#FAF8F2' : '#FFF7E6', border: '1px solid #F1E3C2', fontSize: '0.74rem', color: '#4a3d1c', lineHeight: 1.45 }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B7791F', display: 'block', marginBottom: 2 }}>Qué hacer</span>
                                {n.metadata.que_hacer}
                                <span style={{ display: 'block', marginTop: 5, fontWeight: 700, color: '#5B4BD6' }}>
                                  {n.metadata?.conversation_id ? 'Abrir la conversación' : n.metadata?.contact_id ? 'Ver el lead' : 'Abrir'} →
                                </span>
                              </div>
                            )}
                            <div style={{ fontSize: '0.68rem', color: '#8e88a8', marginTop: 4 }}>
                              {empresa?.nombre ? empresa.nombre + ' · ' : ''}{hace(n.created_at)}
                            </div>
                          </div>
                          {n.monto != null && <div style={{ fontSize: '0.83rem', fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(n.monto)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}

      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={cargar} />}
    </>
  );
}
