// WHATSAPP · El hilo PRO (portado de sacs_inbox): burbujas emerald/blancas
// con cola, separadores de día y de conversación-resuelta, estados ✓✓ con
// tooltip de error en español, player de audio propio, lightbox, linkify,
// reacciones como chips y búsqueda en el hilo tipo Cmd+F.
import { useEffect, useMemo, useRef, useState } from 'react';
import Cargando from '../ui/Cargando';
import { telefonoLegible } from '../../../../lib/telefono';
import { lifecycleDe, useLifecycle } from '../../../../lib/crm/lifecycle';
import { C, L, burbuja, separador, etiquetaDia } from './estilo';
import { IcoBuscar, IcoPuntos, IcoChevronArriba, IcoChevronAbajo } from './Iconos';
import { Avatar, IconoCanal } from './ListaConversaciones';
import Composer, { SelectorPlantilla } from './Composer';
import BurbujaMensaje, { horaDe, Resaltado, resumenMensaje } from './Burbuja';
import { BotonLlamar } from './Llamadas';

// Borradores por conversación (viven mientras la pestaña esté abierta).
const BORRADORES = new Map<string, string>();

export default function Hilo({ hilo, filaActiva, equipo, api, mobile, onBack, onVerDetalle }: {
  hilo: any; filaActiva?: any; equipo: any[]; api: any; mobile?: boolean;
  onBack?: () => void; onVerDetalle?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const conv = hilo?.conversacion;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [cita, setCita] = useState<any>(null);            // mensaje que se va a citar al responder
  const [cierre, setCierre] = useState(false);            // modal de nota de cierre
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modalPlantillaVirtual, setModalPlantillaVirtual] = useState<{ presel?: string | null } | false>(false);
  const etapasCat = useLifecycle();
  const sugerenciasDe = (stage?: string | null) => (etapasCat.find(e => e.id === stage) as any)?.sugerencias || [];
  const [reenviar, setReenviar] = useState<any>(null);       // 12) mensaje a reenviar
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
    const timeline = [...msjs, ...notas, ...correos, ...eventos].sort((a, b) =>
      String(a._t).localeCompare(String(b._t)) || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
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
  const irAMatch = (idx: number) => {
    const it = matches[idx]; if (!it) return;
    const el = document.getElementById(`wa-item-${it._clase}-${it.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setResaltada(`${it._clase}-${it.id}`);
    setTimeout(() => setResaltada(null), 2000);
  };
  useEffect(() => { if (matches.length) irAMatch(matchIdx); }, [matchIdx, matches.length]);

  const ultimoRef = useRef('');
  useEffect(() => {
    const ult = timeline.length ? `${timeline[timeline.length - 1]._clase}-${timeline[timeline.length - 1].id}` : '';
    if (ult !== ultimoRef.current) {
      ultimoRef.current = ult;
      if (!buscando) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [timeline]);
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
            {sugerenciasDe(filaActiva.contacto?.lifecycle_stage).filter((t: any) => t.tipo === 'plantilla').length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Temas de su etapa</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {sugerenciasDe(filaActiva.contacto?.lifecycle_stage).filter((t: any) => t.tipo === 'plantilla').slice(0, 4).map((t: any, i: number) => (
                    <button key={i} onClick={() => setModalPlantillaVirtual({ presel: t.ref })}
                      style={{ border: `1px solid #A7F3D0`, background: '#fff', color: C.emerald700, borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.titulo || t.ref}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {modalPlantillaVirtual && (
          <SelectorPlantilla telefono={String(filaActiva.telefono || '')} api={api} onClose={() => setModalPlantillaVirtual(false)} preseleccion={(modalPlantillaVirtual as any).presel || null} contacto={{ nombre: filaActiva.contacto?.nombre, email: filaActiva.contacto?.email, empresa: filaActiva.empresa?.nombre, plan: filaActiva.empresa?.plan, telefono: String(filaActiva.telefono || '') }} />
        )}
      </div>
    );
  }

  if (!hilo) return <div style={{ flex: 1, minWidth: 0, borderLeft: `1px solid ${C.g200}` }}><Cargando texto="Abriendo conversación…" /></div>;

  const etapa = lifecycleDe(conv?.contacts?.lifecycle_stage);
  const nombre = conv?.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : null;
  let diaPrevio = '';

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: mobile ? 'none' : `1px solid ${C.g200}`, background: C.g50, height: mobile ? 'calc(100dvh - 64px)' : undefined }}>
      {/* ── Header h-44 ── */}
      <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#fff', borderBottom: `1px solid ${C.g100}` }}>
        {onBack && <button onClick={onBack} aria-label="Atrás" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, minWidth: 36, height: 36 }}>←</button>}
        <span style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
          <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: mobile ? 90 : 0, flex: mobile ? 1 : undefined }}>{nombre || telefonoLegible(conv.telefono)}</b>
          {etapa && !mobile && <span style={{ fontSize: 9, fontWeight: 700, background: etapa.bg, color: etapa.fg, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>{etapa.label}</span>}
          {!mobile && <span style={{ fontSize: 10, color: C.g400, flexShrink: 0 }}>{telefonoLegible(conv.telefono)}</span>}
          {conv.id && hilo.ventana?.expira_at && (() => {
            const ms = new Date(hilo.ventana.expira_at).getTime() - Date.now();
            if (ms <= 0) return <span title="Ventana de 24 h cerrada: solo plantilla" style={{ fontSize: 9, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>Ventana cerrada</span>;
            const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60000);
            const urgente = ms < 4 * 3600e3;
            return <span title={`Puedes escribir libremente hasta ${new Date(hilo.ventana.expira_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
              style={{ fontSize: 9, fontWeight: 700, background: urgente ? C.ambar100 : C.emerald50, color: urgente ? C.ambar700 : C.emerald700, borderRadius: 999, padding: '2px 7px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: '-1px', marginRight: 3 }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              {urgente ? 'cierra en ' : ''}{h > 0 ? `${h} h ` : ''}{m} min
            </span>;
          })()}
          {hilo.marketing?.stopped && <span title="El cliente pidió no recibir mensajes de marketing (Meta lo registra). Solo plantillas de utilidad o responder cuando él escriba." style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>Sin marketing</span>}
          {(hilo.presencia || []).map((p: any) => (
            <span key={p.user_id} title={p.escribiendo ? `${p.nombre} está escribiendo…` : `${p.nombre} también tiene abierto este chat`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, background: p.escribiendo ? C.moradoAgua : C.g100, color: p.escribiendo ? C.moradoTinta : C.g500, borderRadius: 999, padding: '2px 7px', flexShrink: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: p.escribiendo ? C.morado : C.g400 }} className={p.escribiendo ? 'wa-pulso' : ''} />
              {(p.nombre || '').split(' ')[0]}{p.escribiendo ? ' escribe…' : ''}
            </span>
          ))}
        </span>
        {conv.id && !mobile && <select value={conv.asignado_a || ''} onChange={e => api.patchConversacion({ asignado_a: e.target.value || null })}
          aria-label="Asignar a"
          style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: '#fff', color: C.g500, maxWidth: mobile ? 78 : 110, flexShrink: 0, cursor: 'pointer' }}>
          <option value="">Sin asignar</option>
          {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>}
        {conv.id && !mobile && <select value={conv.estado_crm || 'abierta'} onChange={e => e.target.value === 'resuelta' ? setCierre(true) : api.patchConversacion({ estado_crm: e.target.value })}
          aria-label="Estado" title="Estado de la conversación"
          style={{
            border: '1px solid', borderRadius: 8, padding: '4px 6px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, maxWidth: mobile ? 84 : undefined,
            borderColor: conv.estado_crm === 'resuelta' ? '#A7F3D0' : conv.estado_crm === 'pendiente' ? C.ambar200 : C.g200,
            background: conv.estado_crm === 'resuelta' ? C.emerald50 : conv.estado_crm === 'pendiente' ? C.ambar50 : '#fff',
            color: conv.estado_crm === 'resuelta' ? C.emerald700 : conv.estado_crm === 'pendiente' ? C.ambar700 : C.g500,
          }}>
          <option value="abierta">Abierta</option>
          <option value="pendiente">Pendiente</option>
          <option value="resuelta">Resuelta</option>
        </select>}
        {conv.id && !mobile && <BotonLlamar conversationId={conv.id} telefono={conv.telefono} nombre={nombre} api={api} />}
        <button onClick={() => setBuscando(b => !b)} title="Buscar en la conversación"
          style={{ border: 'none', background: buscando ? C.moradoAgua : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: buscando ? C.moradoTinta : C.g400 }}>
          <IcoBuscar size={15} />
        </button>
        {conv.id && <MenuHilo conv={conv} api={api} abierto={menu} setAbierto={setMenu} equipo={mobile ? equipo : undefined} onResolver={() => setCierre(true)} />}
        {onVerDetalle && (
          <button onClick={onVerDetalle} style={{ border: `1px solid ${C.azulBorde}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: '#fff', color: C.azulTinta, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Detalle</button>
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

      {conv.alerta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', background: C.rojo50, borderBottom: `1px solid ${C.rojo200}`, fontSize: 12, color: C.rojo700, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.rojo500, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{conv.alerta}</span>
          {hilo.canales?.correo?.ok && <button onClick={() => document.dispatchEvent(new CustomEvent('wa-modo-correo'))} style={{ border: `1px solid ${C.rojo200}`, background: '#fff', color: C.rojo700, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Escribir por correo</button>}
        </div>
      )}
      {/* ── Mensajes ── */}
      <div ref={scrollRef} className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        {timeline.map((item: any) => {
          const dia = etiquetaDia(item._t);
          const sepDia = dia !== diaPrevio; diaPrevio = dia;
          // Boundary: al pasar por un evento "resuelta", el siguiente bloque abre nueva etapa.
          const esBoundary = item._clase === 'evento' && item.tipo === 'estado' && /resuelta/i.test(item.detalle || '');
          const clave = `${item._clase}-${item.id}`;
          const conRing = resaltada === clave;
          const chips = item._clase === 'mensaje' && item.kapso_message_id ? reacciones.get(item.kapso_message_id) : null;
          const sep = separador(false);
          const sepOscuro = separador(true);
          return (
            <span key={clave} id={`wa-item-${clave}`} style={{ display: 'contents' }}>
              {sepDia && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sep.linea} /><span style={sep.chip}>{dia}</span><span style={sep.linea} />
                </span>
              )}
              {esBoundary ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <span style={sepOscuro.linea} />
                  <span style={{ ...sepOscuro.chip, maxWidth: 520, whiteSpace: 'normal', textAlign: 'center' }}>✓ Resuelta{item.autor ? ` por ${item.autor}` : ''}{String(item.detalle || '').replace(/^Marcada como resuelta/i, '')}</span>
                  <span style={sepOscuro.linea} />
                </span>
              ) : item._clase === 'evento' ? (
                <span style={{ alignSelf: 'center', fontSize: 11, color: item.tipo === 'reunion' ? C.azulTinta : item.tipo === 'llamada' ? C.emerald700 : ['inactiva', 'identidad', 'bloqueo'].includes(item.tipo) ? C.ambar700 : C.g400, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: 6, background: item.tipo === 'reunion' ? C.azulAgua : item.tipo === 'llamada' ? C.emerald50 : ['inactiva', 'identidad', 'bloqueo'].includes(item.tipo) ? C.ambar50 : 'transparent', borderRadius: 999, padding: ['reunion', 'llamada', 'inactiva', 'identidad', 'bloqueo'].includes(item.tipo) ? '2px 10px' : 0 }}>
                  {item.detalle}{item.autor ? ` · ${item.autor}` : ''}
                  {item.meet && <a href={item.meet} target="_blank" rel="noreferrer" style={{ color: C.azulTinta, fontWeight: 700, fontStyle: 'normal' }}>Meet</a>}
                </span>
              ) : item._clase === 'nota' ? (
                <span style={{ ...burbuja.nota, boxShadow: conRing ? `0 0 0 2px ${C.morado}` : 'none', transition: 'box-shadow .3s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: C.ambar400, color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(item.autor || 'E')[0].toUpperCase()}
                    </span>
                    <b style={{ fontSize: 11, color: C.ambar700 }}>Comentario interno · {item.autor}</b>
                    <span style={{ fontSize: 9, fontWeight: 700, background: C.ambar100, color: C.ambar700, borderRadius: 999, padding: '1px 7px' }}>Solo equipo</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: C.ambar500 }}>{horaDe(item._t)}</span>
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap' }}><Resaltado texto={item.texto} q={q} /></span>
                </span>
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
                  onLightbox={setLightbox} onCitar={conv.id ? setCita : undefined} onReenviar={conv.id ? setReenviar : undefined}
                  onReintentar={api.reintentar ? (m: any) => api.reintentar(m) : undefined}
                  onReaccionar={conv.id && api.reaccionar ? (m: any, emoji: string) => api.reaccionar(m.kapso_message_id, emoji) : undefined} />
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
      <Composer key={conv.id || conv.email_only_id} ventana={hilo.ventana} api={api} telefono={conv.telefono} equipo={equipo}
        cita={cita} onQuitarCita={() => setCita(null)} onEscribir={api.escribiendo} siguiente={api.siguienteSinResponder}
        sugerencias={sugerenciasDe(conv?.contacts?.lifecycle_stage)}
        borradorInicial={BORRADORES.get(conv.id || conv.email_only_id) || ''} onBorrador={t => BORRADORES.set(conv.id || conv.email_only_id, t)}
        canales={{ ...hilo.canales, wa_id: conv.id }}
        contacto={{ nombre, email: conv.contacts?.email, empresa: conv.companies?.nombre_comercial || conv.companies?.nombre, plan: conv.companies?.plan, etapa: etapa?.label, telefono: telefonoLegible(conv.telefono), mrr: conv.companies?.mrr, fecha_renovacion: conv.companies?.fecha_renovacion, sucursales: conv.companies?.sucursales }} />

      {/* ── Lightbox ── */}
      {reenviar && <ModalReenviar mensaje={reenviar} api={api} actualId={conv.id} onCerrar={() => setReenviar(null)} />}
      {cierre && <ModalCierre onCerrar={() => setCierre(false)} onResolver={async (categoria: string, nota: string) => {
        const r = await api.patchConversacion({ estado_crm: 'resuelta', cierre_categoria: categoria, cierre_nota: nota });
        if (!r?.error) setCierre(false);
        return r;
      }} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 20, border: 'none', background: 'none', color: '#fff', fontSize: 26, cursor: 'pointer' }}>✕</button>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/** Menú ⋯ del hilo: posponer / exportar. */
function MenuHilo({ conv, api, abierto, setAbierto, equipo, onResolver }: { conv: any; api: any; abierto: boolean; setAbierto: (v: boolean) => void; equipo?: any[]; onResolver?: () => void }) {
  const posponer = async (hasta: Date) => { setAbierto(false); await api.patchConversacion({ snooze_until: hasta.toISOString(), no_leidos: 0 }); };
  const manana9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const lunes9 = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; };
  const dormida = conv.snooze_until && new Date(conv.snooze_until) > new Date();
  return (
    <span style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setAbierto(!abierto)} title="Más acciones"
        style={{ border: 'none', background: dormida ? C.ambar50 : 'none', borderRadius: 8, cursor: 'pointer', padding: 6, color: dormida ? C.ambar700 : C.g400 }}>
        <IcoPuntos size={16} />
      </button>
      {abierto && <span onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />}
      {abierto && (
        <span style={{ position: 'absolute', right: 0, top: '112%', zIndex: 941, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.12)', minWidth: 190, display: 'block', overflow: 'hidden' }}>
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
                {equipo.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </span>
            <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          </>)}
          <span style={{ display: 'block', padding: '8px 12px 3px', fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em' }}>Posponer hasta</span>
          {[{ l: 'En 3 horas', f: () => new Date(Date.now() + 3 * 3600e3) }, { l: 'Mañana 9:00', f: manana9 }, { l: 'Lunes 9:00', f: lunes9 }].map(o => (
            <button key={o.l} onClick={() => posponer(o.f())}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.g700 }}>{o.l}</button>
          ))}
          {dormida && (
            <button onClick={() => { setAbierto(false); api.patchConversacion({ snooze_until: null }); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.ambar700, fontWeight: 700 }}>Despertar ahora</button>
          )}
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          <a href={`/api/crm/whatsapp/exportar?id=${conv.id}`} download onClick={() => setAbierto(false)}
            style={{ display: 'block', padding: '9px 12px', fontSize: 12, color: C.azulTinta, fontWeight: 700, textDecoration: 'none' }}>Exportar conversación (.txt)</a>
          <span style={{ display: 'block', borderTop: `1px solid ${C.g100}` }} />
          <button onClick={async () => { setAbierto(false); const r = await api.accionKapso?.({ accion: 'resincronizar' }); if (r?.error) alert(r.error); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.g700 }}>Enviar datos del CRM a Kapso</button>
          {/bloqueado/i.test(conv.alerta || '') ? (
            <button onClick={async () => { setAbierto(false); const r = await api.accionKapso?.({ accion: 'desbloquear' }); if (r?.error) alert(r.error); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.emerald700, fontWeight: 700 }}>Desbloquear número</button>
          ) : (
            <button onClick={async () => { setAbierto(false); if (!confirm('¿Bloquear este número en WhatsApp? Dejará de poder escribirte y la conversación se marca como spam.')) return; const r = await api.accionKapso?.({ accion: 'bloquear' }); if (r?.error) alert(r.error); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.rojo700 }}>Bloquear número (spam)</button>
          )}
          <button onClick={async () => { setAbierto(false); if (!confirm('BORRADO GDPR: se eliminan en Kapso y en el CRM todos los mensajes, media, notas y llamadas de este número. No se puede deshacer. ¿Continuar?')) return; const r = await api.accionKapso?.({ accion: 'gdpr' }); if (r?.error) alert(r.error); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 12px', fontSize: 12, color: C.rojo700 }}>Borrar datos del cliente (GDPR)</button>
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
