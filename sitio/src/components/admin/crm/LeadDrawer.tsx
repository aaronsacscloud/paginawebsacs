// Ficha del lead.
//
// Misma arquitectura que la del cliente: un cajón que se abre ENCIMA de la
// lista, con su X y sus pestañas. La anterior era una pantalla completa que
// tapaba el menú, y por eso se sentía que no había regreso.
//
// Arriba va la RUTA: llegó → contactado → demo agendada → se presentó → prueba
// → cotizado → cliente. Un lead rara vez se enfría por falta de interés; se
// enfría porque nadie supo cuál era el siguiente paso. Por eso debajo de la
// ruta hay una sola frase que lo dice, con el botón para resolverlo ahí mismo.
import { useEffect, useMemo, useState } from 'react';
import { ORIGENES, GRUPOS_ORIGEN, origenDe, origenDeRegistro } from '../../../lib/crm/origenes';
import { normalizaEstado } from '../../../lib/crm/reuniones';

const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';
const fmtLargo = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '';
const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;
const hoy = () => new Date().toISOString().slice(0, 10);
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(p).replace(/\D/g, '') : '';

const D = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 900 },
  panel: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 'min(940px, 97vw)', background: '#fafafa', zIndex: 901, overflowY: 'auto' as const, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' },
  head: { position: 'sticky' as const, top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #ececec', padding: '15px 22px 0' },
  tab: (act: boolean) => ({
    flexShrink: 0, minHeight: 42, padding: '9px 15px', border: 'none',
    background: act ? '#EEECFE' : 'transparent', borderRadius: act ? '9px 9px 0 0' : 0,
    borderBottom: act ? '2px solid #9B8CFA' : '2px solid transparent',
    color: act ? '#5B4BD6' : '#666', cursor: 'pointer', fontWeight: act ? 800 : 500,
    fontSize: '0.83rem', whiteSpace: 'nowrap' as const, marginBottom: -1, fontFamily: 'inherit',
  }) as const,
  body: { padding: '18px 22px 40px' } as const,
  cardM: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: '15px 16px', marginBottom: 14 } as const,
  cardA: { background: '#fff', border: '1.5px solid #cfe0fa', borderRadius: 12, padding: '15px 16px', marginBottom: 14 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 8 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  fl: { fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 3 } as const,
  fi: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '7px 10px', fontSize: '0.78rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none' } as const,
  btnP: { border: 'none', borderRadius: 9, padding: '7px 13px', background: '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnA: { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '6px 12px', background: '#fff', fontSize: '0.74rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnW: { border: '1.5px solid #cdeadd', borderRadius: 9, padding: '6px 12px', background: '#EAF8F2', fontSize: '0.74rem', fontWeight: 700, color: '#1E8A63', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  chip: (bg: string, fg: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, background: bg, color: fg, borderRadius: 20, padding: '3px 10px' }) as const,
};

// El mismo catálogo de puestos que en la ficha del cliente. En texto libre, el
// mismo puesto acaba como "Dueño", "dueño" y "propietario", y después no se
// puede filtrar ni saber con quién se está hablando.
const ROLES = ['Dueño', 'Gerente', 'Facturación', 'Sistemas', 'Compras', 'Otro'];

const ETAPAS: Record<string, { l: string; bg: string; fg: string }> = {
  lead: { l: 'Nuevo', bg: '#f4f4f6', fg: '#6B7280' },
  lead_calificado: { l: 'Calificado', bg: '#EEECFE', fg: '#5B4BD6' },
  oportunidad: { l: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  cliente: { l: 'Cliente', bg: '#EAF8F2', fg: '#1E8A63' },
  churned: { l: 'Perdido', bg: '#FEF0EF', fg: '#C0554E' },
};

export default function LeadDrawer({ contactId, onClose, onChanged }: any) {
  const [tab, setTab] = useState<'resumen' | 'actividad' | 'reuniones' | 'cotizaciones'>('resumen');
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const cargar = () => fetch(`/api/crm/contacts/${contactId}`).then(r => r.json())
    .then(j => { if (j.error) setErr(j.error); else setC(j); }).catch(() => setErr('No se pudo cargar el lead.'));
  useEffect(() => { setC(null); setErr(''); cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [contactId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2400); }

  async function guardar(patch: any) {
    setGuardando(true);
    const r = await fetch('/api/crm/contacts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contactId, ...patch }),
    }).then(x => x.json()).catch(() => null);
    setGuardando(false);
    if (!r || r.error) { flash(r?.error || 'No se pudo guardar'); return false; }
    await cargar(); onChanged?.(); return true;
  }

  // ── La ruta ──────────────────────────────────────────────────────────────
  // Cada paso se DEDUCE de un hecho, no de una casilla que alguien palomeó:
  // la reunión existe, la cotización existe, la suscripción existe. Una etapa
  // capturada a mano se queda vieja; un hecho no.
  const ruta = useMemo(() => {
    if (!c) return [];
    const acts: any[] = c.activities || [];
    const books: any[] = c.bookings || [];
    const quotes: any[] = c.quotes || [];
    const props = c.propiedades || {};
    const contacto = c.last_contact_at || acts.find((a: any) => ['llamada', 'whatsapp', 'email', 'nota'].includes(a.tipo))?.created_at;
    const demo = books.slice().sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)))[0];
    const asistio = books.find((b: any) => normalizaEstado(b.estado) === 'asistio');
    const prueba = props.prueba_inicio || null;
    const cotizada = quotes.slice().sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const esCliente = c.lifecycle_stage === 'cliente';
    return [
      { k: 'llego', l: 'Llegó', f: c.created_at, ok: true },
      { k: 'contactado', l: 'Contactado', f: contacto, ok: !!contacto },
      { k: 'demo', l: 'Demo agendada', f: demo?.fecha, ok: !!demo, extra: demo },
      { k: 'asistio', l: 'Se presentó', f: asistio?.fecha, ok: !!asistio, pendiente: !!demo && !asistio && String(demo.fecha) < hoy() },
      { k: 'prueba', l: 'Prueba gratis', f: prueba, ok: !!prueba },
      { k: 'cotizado', l: 'Cotizado', f: cotizada?.created_at, ok: !!cotizada },
      { k: 'cliente', l: 'Cliente', f: esCliente ? c.updated_at : null, ok: esCliente },
    ];
  }, [c]);

  const paso = ruta.findIndex(p => !p.ok);
  const actual = paso === -1 ? ruta.length - 1 : paso;

  if (err) return (<><div style={D.overlay} onClick={onClose} /><div style={{ ...D.panel, padding: 24 }}><div style={{ color: '#C0554E', fontSize: '0.85rem' }}>{err}</div><button style={{ ...D.btnA, marginTop: 12 }} onClick={onClose}>Cerrar</button></div></>);
  if (!c) return (<><div style={D.overlay} onClick={onClose} /><div style={{ ...D.panel, padding: 24, color: '#999', fontSize: '0.85rem' }}>Cargando…</div></>);

  const et = ETAPAS[c.lifecycle_stage] || ETAPAS.lead;
  const tel = c.whatsapp || c.telefono;
  const o = origenDe(origenDeRegistro(c));
  const demo = ruta.find(p => p.k === 'demo')?.extra;
  const sinContacto = dias(c.last_contact_at || c.created_at);

  return (
    <>
      <div style={D.overlay} onClick={onClose} />
      <div style={D.panel}>
        <div style={D.head}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                {[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                <span style={D.chip(et.bg, et.fg)}>{et.l}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#8a8a8a', marginTop: 2 }}>
                {[c.companies?.nombre, c.email, tel].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
              {tel && <a style={D.btnW} href={waLink(tel)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {c.email && <a style={D.btnA} href={`mailto:${c.email}`}>Correo</a>}
              <button style={D.btnP} onClick={() => window.open('/admin/revenue?nueva=1&empresa=' + encodeURIComponent(c.companies?.nombre || ''), '_blank', 'noopener')}>Cotizar</button>
              <button onClick={onClose} aria-label="Cerrar"
                style={{ width: 32, height: 32, border: '1px solid #e6e6ea', borderRadius: 9, background: '#fff', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 12, overflowX: 'auto' }}>
            {([['resumen', 'Resumen'], ['actividad', 'Actividad'], ['reuniones', 'Reuniones'], ['cotizaciones', 'Cotizaciones']] as const).map(([k, l]) => (
              <button key={k} style={D.tab(tab === k)} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>

        <div style={D.body}>
          {msg && <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}

          {/* ── Ruta del lead ── */}
          <div style={D.cardM}>
            <div style={D.h}>
              Ruta del lead
              <span style={D.hr}>
                llegó hace {dias(c.created_at)} días{sinContacto != null ? ` · ${sinContacto} sin contacto` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {ruta.map((p: any, i: number) => {
                const est = p.ok ? 'ok' : i === actual ? 'now' : 'off';
                const col = est === 'ok' ? '#4FBF95' : est === 'now' ? '#9B8CFA' : '#f1f0f5';
                return (
                  <div key={p.k} style={{ flex: 1, textAlign: 'center', position: 'relative', minWidth: 0 }}>
                    {i > 0 && <span style={{ position: 'absolute', top: 13, left: '-50%', width: '100%', height: 2, background: p.ok || est === 'now' ? '#cdeadd' : '#f1f0f5' }} />}
                    <div style={{
                      position: 'relative', width: 26, height: 26, borderRadius: 99, margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800,
                      background: est === 'ok' ? col : '#fff', border: `2px solid ${col}`,
                      color: est === 'ok' ? '#fff' : est === 'now' ? '#5B4BD6' : '#b3afbd',
                    }}>{est === 'ok' ? '✓' : i + 1}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: est === 'now' ? 800 : 700, marginTop: 6, color: est === 'ok' ? '#3f3b4d' : est === 'now' ? '#5B4BD6' : '#a5a2af' }}>{p.l}</div>
                    <div style={{ fontSize: '0.62rem', color: '#c2c0c9', marginTop: 2 }}>{p.f ? fmtDate(p.f) : p.pendiente ? 'falta marcar' : '—'}</div>
                  </div>
                );
              })}
            </div>

            {/* Qué falta AHORA, en una frase, con el botón para resolverlo. */}
            <SiguientePaso c={c} ruta={ruta} demo={demo} guardar={guardar} flash={flash} recargar={cargar} />
          </div>

          {tab === 'resumen' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14, alignItems: 'start' }}>
              <div>
                <Campos c={c} guardar={guardar} guardando={guardando} />
              </div>
              <div>
                <div style={D.cardA}>
                  <div style={D.h}>Agenda<span style={D.hr}>ligada a Reuniones</span></div>
                  {(c.bookings || []).length === 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#8a8a8a', lineHeight: 1.55 }}>Sin reuniones. Mándale el link para que elija horario o agéndala tú.</div>
                  )}
                  {(c.bookings || []).slice(0, 3).map((b: any) => (
                    <div key={b.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f4f8' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.79rem', fontWeight: 700 }}>{b.asunto || b.event_types?.nombre || 'Reunión'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{fmtDate(b.fecha)} · {String(b.hora_inicio || '').slice(0, 5)}</div>
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#c2c0c9', whiteSpace: 'nowrap' }}>
                        {normalizaEstado(b.estado) === 'asistio' ? 'se presentó' : String(b.fecha) < hoy() ? 'pasó' : 'próxima'}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <a style={D.btnP} href="/agendar/demo" target="_blank" rel="noreferrer">Agendar demo</a>
                    <button style={D.btnA} onClick={() => {
                      const u = `${window.location.origin}/agendar/demo?email=${encodeURIComponent(c.email || '')}&nombre=${encodeURIComponent(c.nombre || '')}`;
                      navigator.clipboard?.writeText(u); flash('Link de agenda copiado');
                    }}>Mandar link de agenda</button>
                    {/* Muchas demos ya ocurrieron cuando alguien se acuerda de
                        apuntarlas. Registrarla después vale igual: la ruta
                        avanza y deja de pedir algo que ya pasó. */}
                    <button style={D.btnA} onClick={() => setRegistrando(true)}>Registrar una que ya pasó</button>
                  </div>
                </div>

                <PruebaGratis c={c} guardar={guardar} flash={flash} />

                <div style={D.cardM}>
                  <div style={D.h}>Lo último<span style={D.hr}>ver todo en Actividad</span></div>
                  {(c.activities || []).slice(0, 4).map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid #f5f4f8' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{a.titulo || a.tipo}</div>
                        {a.descripcion && <div style={{ fontSize: '0.68rem', color: '#a5a2af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</div>}
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#c2c0c9', whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</span>
                    </div>
                  ))}
                  {(c.activities || []).length === 0 && <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>Sin actividad registrada.</div>}
                </div>
              </div>
            </div>
          )}

          {tab === 'actividad' && <Actividad c={c} recargar={cargar} flash={flash} />}

          {tab === 'reuniones' && (
            <div style={D.cardM}>
              <div style={D.h}>Reuniones<span style={D.hr}>{(c.bookings || []).length}</span></div>
              {(c.bookings || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Sin reuniones agendadas.</div>}
              {(c.bookings || []).map((b: any) => (
                <div key={b.id} style={{ display: 'flex', gap: 11, padding: '10px 0', borderTop: '1px solid #f5f4f8' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{b.asunto || b.event_types?.nombre || 'Reunión'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{fmtLargo(b.fecha)} · {String(b.hora_inicio || '').slice(0, 5)}{b.event_types?.nombre ? ` · ${b.event_types.nombre}` : ''}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', ...D.chip(normalizaEstado(b.estado) === 'asistio' ? '#EAF8F2' : '#f4f4f6', normalizaEstado(b.estado) === 'asistio' ? '#1E8A63' : '#6B7280') }}>
                    {normalizaEstado(b.estado) === 'asistio' ? 'se presentó' : normalizaEstado(b.estado)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'cotizaciones' && (
            <div style={D.cardM}>
              <div style={D.h}>Cotizaciones<span style={D.hr}>{(c.quotes || []).length}</span></div>
              {(c.quotes || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Todavía no se le ha cotizado nada.</div>}
              {(c.quotes || []).map((q: any) => (
                <div key={q.id} style={{ display: 'flex', gap: 11, padding: '10px 0', borderTop: '1px solid #f5f4f8', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{q.numero}</div>
                    <div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{fmtDate(q.created_at)} · {q.estado}</div>
                  </div>
                  <b style={{ marginLeft: 'auto' }}>${Math.round(Number(q.total || 0)).toLocaleString('es-MX')}</b>
                  <a style={D.btnA} href={`/cotizacion/${q.id}`} target="_blank" rel="noreferrer">Abrir</a>
                </div>
              ))}
            </div>
          )}
        </div>
        {registrando && (
          <ReunionPasada c={c} onCerrar={() => setRegistrando(false)} onListo={() => { setRegistrando(false); flash('Reunión registrada'); cargar(); }} />
        )}
      </div>
    </>
  );
}

/* Registrar una reunión que YA ocurrió: la que se acordó por WhatsApp, se dio,
 * y nadie alcanzó a agendar en el sistema. */
function ReunionPasada({ c, onCerrar, onListo }: any) {
  const [tipos, setTipos] = useState<any[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState('10:00');
  const [asunto, setAsunto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/scheduling/event-types?activo=true').then(r => r.json())
      .then(j => { const l = Array.isArray(j) ? j : (j?.data || []); setTipos(l); if (l[0]) setTipoId(l[0].id); })
      .catch(() => {});
  }, []);

  async function guardar() {
    if (!tipoId) { setError('No hay tipos de reunión activos.'); return; }
    setBusy(true); setError('');
    const r = await fetch('/api/scheduling/reuniones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type_id: tipoId, fecha, hora_inicio: hora, asunto: asunto || null,
        contact_id: c.id, company_id: c.company_id || null,
        invitee_nombre: [c.nombre, c.apellido].filter(Boolean).join(' '), invitee_email: c.email || null,
        estado: 'asistio',
      }),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo registrar.'); return; }
    onListo();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 400 }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Registrar reunión que ya pasó</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={D.fl}>Tipo</div>
          <select style={D.fi} value={tipoId} onChange={e => setTipoId(e.target.value)}>
            {tipos.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 9 }}>
            <div><div style={D.fl}>Cuándo fue</div><input type="date" style={D.fi} value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)} /></div>
            <div><div style={D.fl}>Hora</div><input type="time" style={D.fi} value={hora} onChange={e => setHora(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 9 }}><div style={D.fl}>De qué se habló</div>
            <input style={D.fi} value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Demo del punto de venta" /></div>
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 7, lineHeight: 1.45 }}>
            Queda marcada como <b>se presentó</b> y la ruta avanza. Después puedes levantar su minuta desde Reuniones.
          </div>
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginTop: 9 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ ...D.btnP, opacity: busy ? .6 : 1 }} disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Registrar'}</button>
            <button style={D.btnA} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* La frase que dice qué falta y el botón que lo resuelve. */
function SiguientePaso({ c, ruta, demo, guardar, flash, recargar }: any) {
  const [busy, setBusy] = useState(false);
  const faltaAsistencia = ruta.find((p: any) => p.k === 'asistio')?.pendiente;
  const sinContacto = dias(c.last_contact_at || c.created_at);

  async function marcar(estado: string) {
    setBusy(true);
    await fetch('/api/scheduling/reuniones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: demo.id, estado }),
    }).catch(() => {});
    setBusy(false); flash(estado === 'asistio' ? 'Marcada como presentada' : 'Marcada como inasistencia'); recargar();
  }

  let texto: any = null, acciones: any = null;
  if (faltaAsistencia && demo) {
    texto = <>La demo fue el <b>{fmtLargo(demo.fecha)}</b> y nadie marcó si se presentó.</>;
    acciones = (<>
      <button style={D.btnW} disabled={busy} onClick={() => marcar('asistio')}>Sí se presentó</button>
      <button style={{ ...D.btnA, color: '#C0554E', borderColor: '#f7c9c5' }} disabled={busy} onClick={() => marcar('no_asistio')}>No llegó</button>
    </>);
  } else if (!c.last_contact_at) {
    texto = <>Nadie lo ha contactado desde que llegó, hace <b>{dias(c.created_at)} días</b>.</>;
    acciones = <button style={D.btnP} onClick={() => guardar({ last_contact_at: new Date().toISOString() })}>Marcar contactado</button>;
  } else if (sinContacto != null && sinContacto > 7) {
    texto = <>Lleva <b>{sinContacto} días</b> sin contacto. Se está enfriando.</>;
    acciones = <button style={D.btnP} onClick={() => guardar({ last_contact_at: new Date().toISOString() })}>Ya lo contacté</button>;
  } else if (!(c.bookings || []).length) {
    texto = <>Sin demo agendada. Es el paso que más mueve la aguja.</>;
    acciones = <a style={D.btnP} href="/agendar/demo" target="_blank" rel="noreferrer">Agendar demo</a>;
  } else if (!(c.quotes || []).length) {
    texto = <>Ya lo viste en la demo. Falta ponerle precio.</>;
    acciones = <button style={D.btnP} onClick={() => window.open('/admin/revenue?nueva=1&empresa=' + encodeURIComponent(c.companies?.nombre || ''), '_blank', 'noopener')}>Hacer cotización</button>;
  }
  if (!texto) return null;

  return (
    <div style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid #f5f4f8', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.78rem', color: '#6b6b74' }}>{texto}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>{acciones}</span>
    </div>
  );
}

/* Prueba gratis: se guarda en las propiedades del contacto, sin tabla nueva. */
function PruebaGratis({ c, guardar, flash }: any) {
  const p = c.propiedades || {};
  const [abierto, setAbierto] = useState(false);
  const [fin, setFin] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const activa = p.prueba_inicio && (!p.prueba_fin || p.prueba_fin >= hoy());
  const restan = p.prueba_fin ? Math.ceil((Date.parse(p.prueba_fin + 'T12:00:00') - Date.now()) / 86400000) : null;

  return (
    <div style={D.cardA}>
      <div style={D.h}>Prueba gratis</div>
      {activa ? (
        <>
          <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
            Activa desde el {fmtLargo(p.prueba_inicio)}
          </div>
          <div style={{ fontSize: '0.75rem', color: restan != null && restan <= 3 ? '#C0554E' : '#6b6b74', marginTop: 3 }}>
            {restan != null ? (restan >= 0 ? `Termina el ${fmtLargo(p.prueba_fin)} · ${restan} días` : `Venció hace ${Math.abs(restan)} días`) : 'Sin fecha de término'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button style={D.btnA} onClick={() => guardar({ propiedades: { ...p, prueba_fin: null, prueba_inicio: null } }).then(() => flash('Prueba cerrada'))}>Cerrar prueba</button>
          </div>
        </>
      ) : abierto ? (
        <>
          <div style={D.fl}>¿Hasta cuándo?</div>
          <input type="date" value={fin} onChange={e => setFin(e.target.value)} style={D.fi} />
          <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
            <button style={D.btnP} onClick={() => guardar({ propiedades: { ...p, prueba_inicio: hoy(), prueba_fin: fin } }).then(() => { setAbierto(false); flash('Prueba registrada'); })}>Guardar</button>
            <button style={D.btnA} onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.78rem', color: '#6b6b74', lineHeight: 1.55 }}>
            Sin prueba activa. Si le abres una cuenta de prueba, se registra aquí con su vencimiento y aparece en la ruta.
          </div>
          <div style={{ marginTop: 9 }}><button style={D.btnA} onClick={() => setAbierto(true)}>Registrar prueba gratis</button></div>
        </>
      )}
    </div>
  );
}

/* Los campos, agrupados por PARA QUÉ sirven: para llamarle, o para venderle. */
function Campos({ c, guardar, guardando }: any) {
  const [f, setF] = useState<any>({});
  const v = (k: string) => (f[k] !== undefined ? f[k] : (c[k] ?? '')) as any;
  const set = (k: string, val: any) => setF((p: any) => ({ ...p, [k]: val }));
  const prop = (k: string) => (f[`p_${k}`] !== undefined ? f[`p_${k}`] : (c.propiedades?.[k] ?? '')) as any;
  const sucio = Object.keys(f).length > 0;

  async function aplicar() {
    const patch: any = {};
    Object.entries(f).forEach(([k, val]) => { if (!k.startsWith('p_')) patch[k] = val === '' ? null : val; });
    const props = { ...(c.propiedades || {}) };
    Object.entries(f).forEach(([k, val]) => { if (k.startsWith('p_')) props[k.slice(2)] = val || null; });
    if (Object.keys(f).some(k => k.startsWith('p_'))) patch.propiedades = props;
    if (await guardar(patch)) setF({});
  }

  return (
    <>
      <div style={D.cardM}>
        <div style={D.h}>Cómo contactarlo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div><div style={D.fl}>Nombre</div><input style={D.fi} value={v('nombre')} onChange={e => set('nombre', e.target.value)} /></div>
          <div><div style={D.fl}>Apellido</div><input style={D.fi} value={v('apellido')} onChange={e => set('apellido', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 9 }}><div style={D.fl}>Correo</div><input style={D.fi} value={v('email')} onChange={e => set('email', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 9 }}>
          <div><div style={D.fl}>WhatsApp</div><input style={D.fi} value={v('whatsapp')} onChange={e => set('whatsapp', e.target.value)} /></div>
          <div><div style={D.fl}>Teléfono</div><input style={D.fi} value={v('telefono')} onChange={e => set('telefono', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 9 }}>
          <div style={D.fl}>Puesto</div>
          <select style={D.fi} value={v('rol') || v('puesto') || ''} onChange={e => { set('rol', e.target.value); set('puesto', e.target.value); }}>
            <option value="">— sin definir —</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div style={D.cardM}>
        <div style={D.h}>Qué sabemos del negocio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div><div style={D.fl}>Empresa</div><div style={{ ...D.fi, background: '#f7f6fa', color: c.companies?.nombre ? '#1a1a1a' : '#a5a2af' }}>{c.companies?.nombre || 'sin empresa'}</div></div>
          <div><div style={D.fl}>Sucursales</div><input style={D.fi} value={v('sucursales_interes')} onChange={e => set('sucursales_interes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 9 }}>
          <div>
            <div style={D.fl}>De dónde llegó</div>
            <select style={D.fi} value={prop('origen_cuenta')} onChange={e => set('p_origen_cuenta', e.target.value)}>
              <option value="">— sin definir —</option>
              {GRUPOS_ORIGEN.map(g => (
                <optgroup key={g} label={g}>
                  {ORIGENES.filter(x => x.grupo === g).map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><div style={D.fl}>Giro</div><input style={D.fi} value={v('giro')} onChange={e => set('giro', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 9 }}>
          <div>
            <div style={D.fl}>Etapa</div>
            <select style={D.fi} value={v('lifecycle_stage')} onChange={e => set('lifecycle_stage', e.target.value)}>
              {Object.entries(ETAPAS).map(([k, x]) => <option key={k} value={k}>{x.l}</option>)}
            </select>
          </div>
          <div><div style={D.fl}>Próximo seguimiento</div><input type="date" style={D.fi} value={String(v('next_followup') || '').slice(0, 10)} onChange={e => set('next_followup', e.target.value)} /></div>
        </div>
      </div>

      {sucio && (
        <div style={{ position: 'sticky', bottom: 12, display: 'flex', gap: 8, alignItems: 'center', background: '#EEECFE', border: '1px solid #ddd6fb', borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#5B4BD6' }}>Hay cambios sin guardar</span>
          <button style={{ ...D.btnP, marginLeft: 'auto' }} disabled={guardando} onClick={aplicar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          <button style={D.btnA} onClick={() => setF({})}>Descartar</button>
        </div>
      )}
    </>
  );
}

/* Actividad: registrar y ver. Lo mismo que había, sin la columna de campos. */
function Actividad({ c, recargar, flash }: any) {
  const [tipo, setTipo] = useState('nota');
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);

  async function registrar() {
    if (!txt.trim()) return;
    setBusy(true);
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: c.id, company_id: c.company_id, tipo, titulo: txt.slice(0, 80), descripcion: txt }),
    }).catch(() => {});
    // Registrar una actividad ES contactarlo: si no se apunta aquí, el lead
    // aparece "sin seguimiento" al día siguiente de haberle hablado.
    await fetch('/api/crm/contacts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, last_contact_at: new Date().toISOString() }),
    }).catch(() => {});
    setBusy(false); setTxt(''); flash('Actividad registrada'); recargar();
  }

  return (
    <>
      <div style={D.cardM}>
        <div style={D.h}>Registrar</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
          {[['nota', 'Nota'], ['llamada', 'Llamada'], ['whatsapp', 'WhatsApp'], ['email', 'Correo'], ['reunion', 'Reunión']].map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)}
              style={{ border: '1.5px solid', borderColor: tipo === k ? '#9B8CFA' : '#e2e2e8', background: tipo === k ? '#9B8CFA' : '#fff', color: tipo === k ? '#fff' : '#555', borderRadius: 20, padding: '5px 12px', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={3} placeholder="Qué pasó…"
          style={{ ...D.fi, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ marginTop: 9 }}>
          <button style={{ ...D.btnP, opacity: busy || !txt.trim() ? .5 : 1 }} disabled={busy || !txt.trim()} onClick={registrar}>Registrar</button>
        </div>
      </div>
      <div style={D.cardM}>
        <div style={D.h}>Historial<span style={D.hr}>{(c.activities || []).length}</span></div>
        {(c.activities || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Sin actividad.</div>}
        {(c.activities || []).map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 11, padding: '9px 0', borderTop: '1px solid #f5f4f8' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{a.titulo || a.tipo}</div>
              {a.descripcion && <div style={{ fontSize: '0.72rem', color: '#71717a', lineHeight: 1.5, marginTop: 2 }}>{a.descripcion}</div>}
            </div>
            <span style={{ fontSize: '0.66rem', color: '#c2c0c9', whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
