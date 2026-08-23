// WHATSAPP · El hilo: header con asignación, burbujas con estados ✓✓,
// separadores por día, notas internas intercaladas (ámbar) y el composer.
import { useEffect, useMemo, useRef, useState } from 'react';
import Cargando from '../ui/Cargando';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';
import { Avatar, IconoCanal } from './ListaConversaciones';
import Composer from './Composer';

// Palomitas SVG (sin emoji): una = enviado, dos = entregado, dos azules = leído.
function Checks({ status }: { status: string }) {
  if (status === 'failed') return <span style={{ color: '#C0554E', fontSize: '0.62rem', fontWeight: 800 }}>falló</span>;
  const doble = status === 'delivered' || status === 'read';
  const color = status === 'read' ? '#2C5FC4' : '#a5a2af';
  return (
    <svg width="15" height="10" viewBox="0 0 18 12" fill="none" aria-label={status}>
      <path d="M1 6.5 4 9.5 9.5 2.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {doble && <path d="M7 6.5 10 9.5 15.5 2.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const diaDe = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const esImagen = (url?: string | null, tipo?: string | null) =>
  tipo === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

export default function Hilo({ hilo, equipo, api, mobile, onBack, onVerDetalle }: {
  hilo: any; equipo: any[]; api: any; mobile?: boolean;
  onBack?: () => void; onVerDetalle?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const conv = hilo?.conversacion;

  // Mensajes y notas en UNA línea de tiempo.
  const timeline = useMemo(() => {
    if (!hilo) return [];
    const msjs = (hilo.mensajes || []).map((m: any) => ({ ...m, _clase: 'mensaje', _t: m.enviado_at || m.created_at }));
    const notas = (hilo.notas || []).map((n: any) => ({ ...n, _clase: 'nota', _t: n.created_at }));
    const correos = (hilo.correos || []).flatMap((h: any) => (h.mensajes || []).map((m: any) => ({
      ...m, _clase: 'correo', _t: m.created_at, _asunto: m.asunto || h.conversacion?.asunto || '',
    })));
    const eventos = (hilo.eventos || []).map((e: any) => ({ ...e, _clase: 'evento', _t: e.created_at }));
    // Desempate por created_at: dos mensajes en el mismo segundo (texto + nota
    // de voz seguidos) se veían en orden aleatorio.
    return [...msjs, ...notas, ...correos, ...eventos].sort((a, b) =>
      String(a._t).localeCompare(String(b._t)) || String(a.created_at).localeCompare(String(b.created_at)));
  }, [hilo]);

  // Auto-scroll al fondo cuando cambia el número de items (mensaje nuevo).
  const nRef = useRef(0);
  useEffect(() => {
    if (timeline.length !== nRef.current) {
      nRef.current = timeline.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [timeline.length]);

  if (!hilo) return <div style={{ borderLeft: '1px solid #f0eff3' }}><Cargando texto="Abriendo conversación…" /></div>;

  const etapa = lifecycleDe(conv?.contacts?.lifecycle_stage);
  const nombre = conv?.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : null;
  let diaPrevio = '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderLeft: mobile ? 'none' : '1px solid #f0eff3', height: mobile ? 'calc(100dvh - 64px)' : undefined }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid #f0eff3', background: '#fdfcff', flexWrap: 'wrap' }}>
        {onBack && (
          <button onClick={onBack} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.05rem', minWidth: 40, height: 40 }}>←</button>
        )}
        <Avatar nombre={nombre} telefono={conv.telefono} size={36} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: '0.95rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
            {nombre || telefonoLegible(conv.telefono)}
          </b>
          <span style={{ fontSize: '0.7rem', color: '#8a8a92' }}>{telefonoLegible(conv.telefono)}</span>
        </span>
        {etapa && <span style={{ fontSize: '0.58rem', fontWeight: 800, background: etapa.bg, color: etapa.fg, borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>{etapa.label}</span>}
        {conv.id && <select value={conv.asignado_a || ''} onChange={e => api.patchConversacion({ asignado_a: e.target.value || null })}
          aria-label="Asignar a"
          style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '5px 7px', fontSize: '0.7rem', fontFamily: 'inherit', background: '#fff', color: '#555', maxWidth: 118, flexShrink: 0 }}>
          <option value="">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>}
        {conv.id && <select value={conv.estado_crm || 'abierta'} onChange={e => api.patchConversacion({ estado_crm: e.target.value })}
          aria-label="Estado" title="Estado de la conversación"
          style={{
            border: '1px solid', borderRadius: 8, padding: '5px 7px', fontSize: '0.7rem', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
            borderColor: conv.estado_crm === 'resuelta' ? '#bfe6d6' : conv.estado_crm === 'pendiente' ? '#f3e3bd' : '#e2e4e9',
            background: conv.estado_crm === 'resuelta' ? '#EAF8F2' : conv.estado_crm === 'pendiente' ? '#FFF6E3' : '#fff',
            color: conv.estado_crm === 'resuelta' ? '#1E8A63' : conv.estado_crm === 'pendiente' ? '#9A6B15' : '#555',
          }}>
          <option value="abierta">Abierta</option>
          <option value="pendiente">Pendiente</option>
          <option value="resuelta">Resuelta</option>
        </select>}
        {conv.id && <MenuSnooze conv={conv} api={api} />}
        {onVerDetalle && (
          <button onClick={onVerDetalle} style={{ border: '1.5px solid #7DA6F5', borderRadius: 8, padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, background: '#fff', color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' }}>
            Detalle
          </button>
        )}
      </div>

      {/* ── Mensajes ── */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px', background: '#faf9fd', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {timeline.map((item: any) => {
          const dia = diaDe(item._t);
          const sep = dia !== diaPrevio; diaPrevio = dia;
          return (
            <span key={`${item._clase}-${item.id}`} style={{ display: 'contents' }}>
              {sep && (
                <span style={{ alignSelf: 'center', fontSize: '0.62rem', fontWeight: 700, color: '#8a8a92', background: '#fff', border: '1px solid #eeeef1', borderRadius: 20, padding: '3px 12px', margin: '6px 0' }}>
                  {dia}
                </span>
              )}
              {item._clase === 'evento' ? (
                <span style={{ alignSelf: 'center', fontSize: '0.66rem', color: '#a5a2af', padding: '2px 0', fontStyle: 'italic' }}>
                  {item.detalle}{item.autor ? ` · ${item.autor}` : ''}
                </span>
              ) : item._clase === 'correo' ? (
                <span style={{
                  alignSelf: item.direccion === 'entrante' ? 'flex-start' : 'flex-end',
                  maxWidth: 'min(82%, 620px)', borderRadius: 12, padding: '9px 12px', fontSize: '0.82rem', lineHeight: 1.55,
                  background: '#fff', border: '1px solid #cfdefa',
                  borderLeft: item.direccion === 'entrante' ? '3px solid #7DA6F5' : '1px solid #cfdefa',
                  borderRight: item.direccion === 'saliente' ? '3px solid #7DA6F5' : '1px solid #cfdefa',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <IconoCanal canal="email" />
                    <b style={{ fontSize: '0.74rem', color: '#2C5FC4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._asunto || 'Correo'}</b>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap', display: 'block', maxHeight: 220, overflow: 'hidden' }}>{(item.cuerpo_texto || '').slice(0, 1200)}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
                    {item.autor && <span style={{ fontSize: '0.6rem', color: '#8a8a92' }}>{item.autor}</span>}
                    <span style={{ fontSize: '0.58rem', color: '#a5a2af' }}>{horaDe(item._t)}</span>
                    {item.direccion === 'saliente' && <span style={{ fontSize: '0.56rem', fontWeight: 800, background: '#E3EDFD', color: '#2C5FC4', borderRadius: 20, padding: '1px 7px' }}>correo</span>}
                  </span>
                </span>
              ) : item._clase === 'nota' ? (
                <span style={{ alignSelf: 'center', maxWidth: '86%', background: '#FFF6E3', border: '1px solid #f3e3bd', borderRadius: 10, padding: '7px 12px', fontSize: '0.75rem', color: '#7a5a15', lineHeight: 1.5 }}>
                  <b style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 2 }}>Nota interna · {item.autor}</b>
                  {item.texto}
                </span>
              ) : (
                <span style={{
                  alignSelf: item.direccion === 'entrante' ? 'flex-start' : 'flex-end',
                  maxWidth: 'min(78%, 560px)', borderRadius: 12, padding: '9px 12px', fontSize: '0.84rem', lineHeight: 1.55,
                  background: item.direccion === 'entrante' ? '#fff' : '#EEECFE',
                  border: '1px solid', borderColor: item.direccion === 'entrante' ? '#eeeef1' : '#e2dcfb',
                }}>
                  {item.transcript ? (<>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#5B4BD6', display: 'block' }}>NOTA DE VOZ · transcripción</span>
                    {item.media_url && <audio controls preload="none" src={item.media_url} style={{ width: 230, height: 34, display: 'block', margin: '4px 0' }} />}
                    <span style={{ whiteSpace: 'pre-wrap' }}>{item.transcript}</span>
                  </>) : item.tipo === 'audio' && item.media_url ? (
                    <audio controls preload="none" src={item.media_url} style={{ width: 230, height: 34, display: 'block' }} />
                  ) : null}
                  {item.media_url && esImagen(item.media_url, item.tipo) && (
                    <a href={item.media_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: item.cuerpo ? 6 : 0 }}>
                      <img src={item.media_url} alt="imagen" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, display: 'block' }} />
                    </a>
                  )}
                  {item.media_url && !esImagen(item.media_url, item.tipo) && (
                    <a href={item.media_url} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eeeef1', borderRadius: 8, padding: '8px 10px', textDecoration: 'none', color: '#2C5FC4', fontSize: '0.75rem', fontWeight: 700, marginBottom: item.cuerpo ? 6 : 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2h8l4 4v16H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                      {item.cuerpo || 'Documento'}
                    </a>
                  )}
                  {!item.transcript && item.cuerpo && !(item.media_url && !esImagen(item.media_url, item.tipo)) && (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{item.cuerpo}</span>
                  )}
                  {!item.transcript && !item.cuerpo && !item.media_url && (
                    <span style={{ color: '#8a8a92' }}>[{item.tipo || 'mensaje'}]</span>
                  )}
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 }}>
                    <span style={{ fontSize: '0.58rem', color: '#a5a2af' }}>{horaDe(item._t)}</span>
                    {item.direccion === 'saliente' && <Checks status={item.status} />}
                  </span>
                  {item.error && <span style={{ display: 'block', fontSize: '0.66rem', color: '#C0554E', marginTop: 2 }}>{item.error}</span>}
                </span>
              )}
            </span>
          );
        })}
        {!timeline.length && (
          <span style={{ alignSelf: 'center', marginTop: 30, fontSize: '0.78rem', color: '#a5a2af' }}>Todavía no hay mensajes.</span>
        )}
      </div>

      {/* ── Composer ── */}
      <Composer ventana={hilo.ventana} api={api} telefono={conv.telefono} equipo={equipo} canales={hilo.canales} />
    </div>
  );
}

/** Posponer (snooze) + exportar, en un solo menú compacto. */
function MenuSnooze({ conv, api }: { conv: any; api: any }) {
  const [abierto, setAbierto] = useState(false);
  const posponer = async (hasta: Date) => {
    setAbierto(false);
    await api.patchConversacion({ snooze_until: hasta.toISOString(), no_leidos: 0 });
  };
  const manana9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const lunes9 = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; };
  const dormida = conv.snooze_until && new Date(conv.snooze_until) > new Date();
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setAbierto(a => !a)} title={dormida ? `Pospuesta hasta ${new Date(conv.snooze_until).toLocaleString('es-MX')}` : 'Posponer / más acciones'}
        style={{ border: '1px solid', borderColor: dormida ? '#f3e3bd' : '#e2e4e9', borderRadius: 8, padding: '5px 9px', fontSize: '0.7rem', fontWeight: 700, background: dormida ? '#FFF6E3' : '#fff', color: dormida ? '#9A6B15' : '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
        {dormida ? 'Pospuesta' : '⋯'}
      </button>
      {abierto && (
        <span onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />
      )}
      {abierto && (
        <span style={{ position: 'absolute', right: 0, top: '110%', zIndex: 941, background: '#fff', border: '1px solid #e8e7ee', borderRadius: 10, boxShadow: '0 6px 20px rgba(40,20,90,.12)', minWidth: 190, display: 'block', overflow: 'hidden' }}>
          <span style={{ display: 'block', padding: '7px 12px 3px', fontSize: '0.58rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase', letterSpacing: '.06em' }}>Posponer hasta</span>
          {[
            { l: 'En 3 horas', f: () => new Date(Date.now() + 3 * 3600e3) },
            { l: 'Mañana 9:00', f: manana9 },
            { l: 'Lunes 9:00', f: lunes9 },
          ].map(o => (
            <button key={o.l} onClick={() => posponer(o.f())}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: '0.76rem', color: '#555' }}>
              {o.l}
            </button>
          ))}
          {dormida && (
            <button onClick={() => { setAbierto(false); api.patchConversacion({ snooze_until: null }); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: '0.76rem', color: '#9A6B15', fontWeight: 700 }}>
              Despertar ahora
            </button>
          )}
          <span style={{ display: 'block', borderTop: '1px solid #f0eff3' }} />
          <a href={`/api/crm/whatsapp/exportar?id=${conv.id}`} download onClick={() => setAbierto(false)}
            style={{ display: 'block', padding: '8px 12px', fontSize: '0.76rem', color: '#2C5FC4', fontWeight: 700, textDecoration: 'none' }}>
            Exportar conversación (.txt)
          </a>
        </span>
      )}
    </span>
  );
}
