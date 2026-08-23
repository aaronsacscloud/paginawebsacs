// WHATSAPP · El hilo: header con asignación, burbujas con estados ✓✓,
// separadores por día, notas internas intercaladas (ámbar) y el composer.
import { useEffect, useMemo, useRef } from 'react';
import Cargando from '../ui/Cargando';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe } from '../../../../lib/crm/lifecycle';
import { Avatar } from './ListaConversaciones';
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
    return [...msjs, ...notas].sort((a, b) => String(a._t).localeCompare(String(b._t)));
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderLeft: mobile ? 'none' : '1px solid #f0eff3', height: mobile ? 'calc(100dvh - 120px)' : undefined }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: '1px solid #f0eff3', background: '#fdfcff', flexWrap: 'wrap' }}>
        {onBack && (
          <button onClick={onBack} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.05rem', minWidth: 40, height: 40 }}>←</button>
        )}
        <Avatar nombre={nombre} telefono={conv.telefono} size={32} />
        <span style={{ minWidth: 0 }}>
          <b style={{ fontSize: '0.84rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre || telefonoLegible(conv.telefono)}
          </b>
          <span style={{ fontSize: '0.66rem', color: '#8a8a92' }}>{telefonoLegible(conv.telefono)}</span>
        </span>
        {etapa && <span style={{ fontSize: '0.58rem', fontWeight: 800, background: etapa.bg, color: etapa.fg, borderRadius: 20, padding: '2px 8px' }}>{etapa.label}</span>}
        <span style={{ flex: 1 }} />
        <select value={conv.asignado_a || ''} onChange={e => api.patchConversacion({ asignado_a: e.target.value || null })}
          aria-label="Asignar a"
          style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '5px 7px', fontSize: '0.7rem', fontFamily: 'inherit', background: '#fff', color: '#555', maxWidth: 130 }}>
          <option value="">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <button onClick={() => api.patchConversacion({ estado: conv.estado === 'active' ? 'ended' : 'active' })}
          style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, background: '#fff', color: conv.estado === 'active' ? '#555' : '#1E8A63', cursor: 'pointer', fontFamily: 'inherit' }}>
          {conv.estado === 'active' ? 'Cerrar' : 'Reabrir'}
        </button>
        {onVerDetalle && (
          <button onClick={onVerDetalle} style={{ border: '1.5px solid #7DA6F5', borderRadius: 8, padding: '5px 10px', fontSize: '0.7rem', fontWeight: 700, background: '#fff', color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' }}>
            Detalle
          </button>
        )}
      </div>

      {/* ── Mensajes ── */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', background: '#faf9fd', display: 'flex', flexDirection: 'column', gap: 7 }}>
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
              {item._clase === 'nota' ? (
                <span style={{ alignSelf: 'center', maxWidth: '86%', background: '#FFF6E3', border: '1px solid #f3e3bd', borderRadius: 10, padding: '7px 12px', fontSize: '0.75rem', color: '#7a5a15', lineHeight: 1.5 }}>
                  <b style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 2 }}>Nota interna · {item.autor}</b>
                  {item.texto}
                </span>
              ) : (
                <span style={{
                  alignSelf: item.direccion === 'entrante' ? 'flex-start' : 'flex-end',
                  maxWidth: '78%', borderRadius: 12, padding: '8px 11px', fontSize: '0.81rem', lineHeight: 1.5,
                  background: item.direccion === 'entrante' ? '#fff' : '#EEECFE',
                  border: '1px solid', borderColor: item.direccion === 'entrante' ? '#eeeef1' : '#e2dcfb',
                }}>
                  {item.transcript ? (<>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#5B4BD6', display: 'block' }}>NOTA DE VOZ · transcripción</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{item.transcript}</span>
                  </>) : null}
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
      <Composer ventana={hilo.ventana} api={api} telefono={conv.telefono} />
    </div>
  );
}
