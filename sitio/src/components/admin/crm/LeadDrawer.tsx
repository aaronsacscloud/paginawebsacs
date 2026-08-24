// Ficha del lead.
//
// Misma arquitectura que la del cliente —un cajón sobre la lista, con su X y
// sus pestañas— y, desde ahora, también sus mismas REGLAS. Se apartaba de las
// cuatro y por eso se sentía otra cosa:
//
//   1. La primera pestaña es "quién es", no un revoltijo. Abría en un "Resumen"
//      que mezclaba etapa, evaluación, prueba, agenda, atribución y actividad.
//   2. Nada se dibuja FUERA de las pestañas. La tarjeta Etapa estaba suelta y
//      salía igual en Cotizaciones, en Reuniones y en Señales.
//   3. El contorno dice si se toca: morado lo que se captura, azul lo que solo
//      se mira porque se calcula solo. Estaba al revés en media ficha.
//   4. El secundario es MORADO. El azul es el tercer acento que la ficha del
//      cliente ya se quitó por competir con el color del sistema.
//
// La ruta —llegó → contactado → demo → cotizado → cliente— sigue mandando, pero
// ahora vive en Seguimiento, que es su pestaña. Un lead rara vez se enfría por
// falta de interés; se enfría porque nadie supo cuál era el siguiente paso.
import { useEffect, useMemo, useState } from 'react';
import { ORIGENES, GRUPOS_ORIGEN, origenDe, origenDeRegistro } from '../../../lib/crm/origenes';
import { normalizaEstado } from '../../../lib/crm/reuniones';
import Cargando, { Corazones } from './ui/Cargando';
import SenalesContacto from './email/SenalesContacto';
import { etapaDeLead, siguientePaso as pasoDeEtapa, ETAPA_LABEL, type Etapa } from '../../../lib/crm/lead-etapa';
import { agendaDeEtapa, SLUGS_DE_LEAD } from '../../../lib/crm/lead-agenda';
import { HISTORIAL_ETIQUETA } from '../../../lib/crm/lead-historial';

const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';
const fmtLargo = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '';
const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;
const hoy = () => new Date().toISOString().slice(0, 10);
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(p).replace(/\D/g, '') : '';

const D = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 900 },
  // El mismo ancho que la ficha del cliente. A 940 la ficha del lead era la
  // única angosta de la app, y con dos columnas de campos se apretaba igual.
  panel: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: 'min(1240px, 97vw)', background: '#fafafa', zIndex: 901, overflowY: 'auto' as const, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' },
  head: { position: 'sticky' as const, top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #ececec', padding: '16px 22px 0' },
  tab: (act: boolean) => ({
    flexShrink: 0, minHeight: 42, padding: '9px 15px', border: 'none',
    background: act ? '#EEECFE' : 'transparent', borderRadius: act ? '9px 9px 0 0' : 0,
    borderBottom: act ? '2px solid #9B8CFA' : '2px solid transparent',
    color: act ? '#5B4BD6' : '#666', cursor: 'pointer', fontWeight: act ? 800 : 500,
    fontSize: '0.83rem', whiteSpace: 'nowrap' as const, marginBottom: -1, fontFamily: 'inherit',
  }) as const,
  body: { padding: '18px 22px 40px' } as const,
  // Morado = se captura y se gestiona. Azul = solo se mira, se calcula solo.
  // Es la regla de la ficha del cliente; el color contesta "¿esto se toca?"
  // antes de leer una palabra.
  cardM: { background: '#fff', border: '1.5px solid #ddd6fb', borderRadius: 12, padding: '15px 16px', marginBottom: 14 } as const,
  cardA: { background: '#fff', border: '1.5px solid #cfe0fa', borderRadius: 12, padding: '15px 16px', marginBottom: 14 } as const,
  // Título en negro: el contorno ya dice si se captura; teñirlo también eran
  // dos señales para lo mismo.
  h: { fontSize: '0.64rem', fontWeight: 800, color: '#1a1a1a', textTransform: 'uppercase' as const, letterSpacing: '0.9px', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 8 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  fl: { fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 3 } as const,
  fi: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '7px 10px', fontSize: '0.78rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none' } as const,
  btnP: { border: 'none', borderRadius: 9, padding: '7px 13px', background: '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  /* Secundario: fondo blanco, BORDE y LETRA morados — igual que en la ficha del
     cliente. Estaba en azul, que es el tercer acento que allá ya se quitó por
     competir con el color del sistema. */
  btnA: { border: '1.5px solid #9B8CFA', borderRadius: 9, padding: '6px 12px', background: '#fff', fontSize: '0.74rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  /* Gris: para lo que no es acción de venta (cancelar, cerrar, "otro tipo"). */
  btnG: { border: '1px solid #ddd', borderRadius: 9, padding: '6px 12px', background: '#fff', fontSize: '0.74rem', fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnW: { border: '1.5px solid #cdeadd', borderRadius: 9, padding: '6px 12px', background: '#EAF8F2', fontSize: '0.74rem', fontWeight: 700, color: '#1E8A63', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  chip: (bg: string, fg: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, background: bg, color: fg, borderRadius: 20, padding: '3px 10px' }) as const,
};

// El mismo catálogo de puestos que en la ficha del cliente. En texto libre, el
// mismo puesto acaba como "Dueño", "dueño" y "propietario", y después no se
// puede filtrar ni saber con quién se está hablando.
const ROLES = ['Dueño', 'Gerente', 'Facturación', 'Sistemas', 'Compras', 'Otro'];

// El mismo catálogo de giro que la ficha del cliente. Se lee de las propiedades
// del CRM para no tener dos listas que se separen con el tiempo; el subgiro
// depende del giro y sus opciones vienen del padre.
function useGiros() {
  const [g, setG] = useState<{ giros: any[]; subs: Record<string, any[]> }>({ giros: [], subs: {} });
  useEffect(() => {
    fetch('/api/crm/propiedades?entidad=company').then(r => r.json()).then((j: any) => {
      const l = j.data || j.propiedades || [];
      const giro = l.find((x: any) => x.key === 'giro_negocio');
      const sub = l.find((x: any) => x.key === 'subgiro');
      setG({ giros: giro?.opciones || [], subs: sub?.opciones_por_padre || {} });
    }).catch(() => {});
  }, []);
  return g;
}

const ETAPAS: Record<string, { l: string; bg: string; fg: string }> = {
  lead: { l: 'Nuevo', bg: '#f4f4f6', fg: '#6B7280' },
  lead_calificado: { l: 'Calificado', bg: '#EEECFE', fg: '#5B4BD6' },
  oportunidad: { l: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  cliente: { l: 'Cliente', bg: '#EAF8F2', fg: '#1E8A63' },
  churned: { l: 'Perdido', bg: '#FEF0EF', fg: '#C0554E' },
};

export default function LeadDrawer({ contactId, onClose, onChanged }: any) {
  // Abre en "quién es", no en un revoltijo. Es el orden de la conversación con
  // el lead, el mismo criterio con el que están ordenadas las pestañas del
  // cliente: quién es · en qué va · cuándo lo tocamos · cuándo lo vimos · qué
  // le ofrecimos · qué está haciendo él.
  const [tab, setTab] = useState<'info' | 'seguimiento' | 'actividad' | 'reuniones' | 'cotizaciones' | 'senales'>('info');
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  // Cambiar de pestaña o cerrar con algo a medio escribir tira lo capturado sin
  // avisar. Cada sección reporta si tiene cambios pendientes.
  const [sucio, setSucio] = useState<Record<string, boolean>>({});
  const confirmarSalida = () => !Object.values(sucio).some(Boolean) || confirm('Hay cambios sin guardar en esta ficha.\n\n¿Salir y perderlos?');
  const irA = (t: any) => { if (confirmarSalida()) { setSucio({}); setTab(t); } };
  const cerrar = () => { if (confirmarSalida()) onClose(); };

  const cargar = () => fetch(`/api/crm/contacts/${contactId}`).then(r => r.json())
    .then(j => { if (j.error) setErr(j.error); else setC(j); }).catch(() => setErr('No se pudo cargar el lead.'));
  useEffect(() => { setC(null); setErr(''); cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [contactId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [onClose, sucio]);

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

  // ── La etapa ─────────────────────────────────────────────────────────────
  // Cada peldaño se DEDUCE de un hecho, no de una casilla que alguien palomeó:
  // hay toque, hay reunión, hay cotización, pagó. Una etapa capturada a mano se
  // queda vieja; un hecho no. Lo capturado solo puede ADELANTAR (ver
  // lib/crm/lead-etapa.ts, que además está probado aparte).
  const evaluacion = useMemo(() => {
    if (!c) return null;
    const acts: any[] = c.activities || [];
    const books: any[] = (c.bookings || []).map((b: any) => ({ estado: normalizaEstado(b.estado), fecha: b.fecha }));
    const cuenta = (t: string) => acts.filter((a: any) => a.tipo === t).length;
    const esfuerzo = { llamadas: cuenta('llamada'), correos: cuenta('email_enviado'), whatsapp: cuenta('whatsapp_enviado') };
    const toques = esfuerzo.llamadas + esfuerzo.correos + esfuerzo.whatsapp;
    const r = etapaDeLead({
      lifecycle_stage: c.lifecycle_stage, calificacion: c.calificacion, desenlace: c.desenlace,
      toques, last_contact_at: c.last_contact_at, reuniones: books,
      cotizaciones: (c.quotes || []).length, etapa_manual: c.etapa_manual,
    });
    return { ...r, esfuerzo, toques };
  }, [c]);

  const RUTA_VISIBLE: Etapa[] = ['nuevo', 'contactado', 'calificado', 'agendado', 'demo_hecha', 'cotizado', 'negociando', 'cliente'];


  if (err) return (<><div style={D.overlay} onClick={onClose} /><div style={{ ...D.panel, padding: 24 }}><div style={{ color: '#C0554E', fontSize: '0.85rem' }}>{err}</div><button style={{ ...D.btnA, marginTop: 12 }} onClick={onClose}>Cerrar</button></div></>);
  if (!c) return (<><div style={D.overlay} onClick={onClose} /><div style={D.panel}><Cargando texto="Cargando lead…" alto={240} /></div></>);

  const et = ETAPAS[c.lifecycle_stage] || ETAPAS.lead;
  const tel = c.whatsapp || c.telefono;
  const o = origenDe(origenDeRegistro(c));
  const demo = (c.bookings || []).slice().sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)))[0];
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
              <button onClick={cerrar} aria-label="Cerrar"
                style={{ width: 32, height: 32, border: '1px solid #e6e6ea', borderRadius: 9, background: '#fff', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit' }}>✕</button>
            </div>
          </div>
          {/* El orden es el de la conversación con el lead —quién es, en qué va,
              cuándo lo tocamos, cuándo lo vimos, qué le ofrecimos, qué hace él—
              igual que las pestañas del cliente. Señales va al final: se
              consulta cuando ya sabes qué buscas, no al abrir la ficha. */}
          <div style={{ display: 'flex', gap: 2, marginTop: 12, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {([
              ['info', 'Info general', null],
              ['seguimiento', 'Seguimiento', null],
              ['actividad', 'Actividad', (c.activities || []).length],
              ['reuniones', 'Reuniones', (c.bookings || []).length],
              ['cotizaciones', 'Cotizaciones', (c.quotes || []).length],
              ['senales', 'Señales', null],
            ] as const).map(([k, l, n]) => (
              <button key={k} style={D.tab(tab === k)} onClick={() => irA(k)}>
                {l}{n ? ` (${n})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div style={D.body}>
          {msg && <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}

          {/* ── ¿Ya lo conocíamos? ──
              Si este lead ya paga o ya fue cliente, es lo primero que cambia lo
              que haces con él — tres llevaban meses en la lista sin que nada lo
              dijera. Va arriba de Info general, que es la pestaña que se abre:
              suelto sobre las seis pestañas repetía el aviso hasta en
              Cotizaciones, que es justo lo que se está corrigiendo. */}
          {tab === 'info' && c.historial && (() => {
            const h = HISTORIAL_ETIQUETA[c.historial.tipo as keyof typeof HISTORIAL_ETIQUETA];
            return (
              <div style={{ background: h.bg, border: `1px solid ${h.fg}33`, borderRadius: 11, padding: '12px 15px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.05em', background: '#fff', color: h.fg }}>{h.label}</span>
                  <b style={{ fontSize: '0.82rem', color: h.fg }}>{c.historial.titulo}</b>
                </div>
                {c.historial.detalle && <div style={{ fontSize: '0.77rem', color: h.fg, opacity: .88, marginTop: 5, lineHeight: 1.55 }}>{c.historial.detalle}</div>}
              </div>
            );
          })()}

          {/* ── Etapa · se mueve sola ──
              Azul, no morada: no se captura, se deduce de hechos. Y dentro de
              Seguimiento, no encima de las seis pestañas. */}
          {tab === 'seguimiento' && <div style={D.cardA}>
            <div style={D.h}>
              Etapa
              <span style={D.hr}>
                se mueve sola · llegó hace {dias(c.created_at)} días{sinContacto != null ? ` · ${sinContacto} sin contacto` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {RUTA_VISIBLE.map((k, i) => {
                const idx = RUTA_VISIBLE.indexOf(evaluacion?.etapa as Etapa);
                const perdido = evaluacion?.etapa === 'perdido';
                const paso = !!evaluacion?.hitos?.[k];
                // Solo se palomea lo que OCURRIÓ. Un peldaño anterior que nunca
                // pasó se dibuja punteado: el lead se lo saltó, y decir que
                // pasó sería inventar su historia.
                const est = perdido ? 'off' : paso ? 'ok' : i === idx ? 'now' : i < idx ? 'saltado' : 'off';
                const col = est === 'ok' ? '#4FBF95' : est === 'now' ? '#9B8CFA' : '#f1f0f5';
                // El peldaño que un humano adelantó se marca: así se distingue
                // lo que pasó de lo que alguien dijo que pasó.
                const aMano = evaluacion?.manual === k && evaluacion?.porHechos !== k;
                return (
                  <div key={k} style={{ flex: 1, textAlign: 'center', position: 'relative', minWidth: 0 }}>
                    {i > 0 && <span style={{ position: 'absolute', top: 13, left: '-50%', width: '100%', height: 2, background: est === 'off' || est === 'saltado' ? '#f1f0f5' : '#cdeadd' }} />}
                    <div style={{
                      position: 'relative', width: 26, height: 26, borderRadius: 99, margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800,
                      background: est === 'ok' ? col : '#fff',
                      border: est === 'saltado' ? '2px dashed #ded9ea' : `2px solid ${col}`,
                      color: est === 'ok' ? '#fff' : est === 'now' ? '#5B4BD6' : '#c9c4dc',
                    }}>{est === 'ok' ? '✓' : i + 1}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: est === 'now' ? 800 : 700, marginTop: 6, color: est === 'ok' ? '#3f3b4d' : est === 'now' ? '#5B4BD6' : '#a5a2af' }}>{ETAPA_LABEL[k]}</div>
                    {aMano && <div style={{ fontSize: '0.58rem', color: '#b3afbd', marginTop: 1 }}>a mano</div>}
                    {est === 'saltado' && <div style={{ fontSize: '0.58rem', color: '#c9c4dc', marginTop: 1 }}>se saltó</div>}
                  </div>
                );
              })}
            </div>
            {evaluacion?.etapa === 'perdido' && (
              <div style={{ marginTop: 10, background: '#FBECEA', border: '1px solid #C0554E33', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#C0554E' }}>
                Cerrado{c.desenlace ? ` · ${c.desenlace}` : ''}{c.calificacion_motivo ? ` · ${c.calificacion_motivo}` : ''}
              </div>
            )}
            {evaluacion && pasoDeEtapa(evaluacion.etapa) && (
              <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid #f4f3f7', fontSize: '0.77rem', color: '#7d7a88', lineHeight: 1.55 }}>
                {pasoDeEtapa(evaluacion.etapa)}
              </div>
            )}
          </div>}

          {/* ── Seguimiento: la etapa (arriba), lo que se captura y la prueba ── */}
          {tab === 'seguimiento' && <Evaluacion c={c} evaluacion={evaluacion} guardar={guardar} guardando={guardando} setSucio={setSucio} />}
          {tab === 'seguimiento' && <PruebaGratis c={c} guardar={guardar} flash={flash} />}

          {/* ── Info general: quién es y cómo alcanzarlo. Nada más. ── */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, alignItems: 'start' }}>
              <div><Campos c={c} guardar={guardar} guardando={guardando} setSucio={setSucio} /></div>
              <div><DeDondeLlego c={c} /></div>
            </div>
          )}

          {/* Señales: el puntaje de intención y la historia completa de las
              cinco fuentes. Es lo que se lee antes de llamar. */}
          {tab === 'senales' && <div style={{ padding: '4px 0' }}><SenalesContacto contactId={c.id} /></div>}
          {tab === 'actividad' && <Actividad c={c} recargar={cargar} flash={flash} />}

          {/* ── Reuniones: agendar y lo que ya hubo, juntos ──
              Estaban partidos en dos: el botón de agendar vivía en "Resumen" y
              la lista en su propia pestaña. Son la misma cosa. */}
          {tab === 'reuniones' && (
            <>
              <Agendar c={c} etapa={evaluacion?.etapa} flash={flash} onRegistrarPasada={() => setRegistrando(true)} />
              <div style={D.cardA}>
                <div style={D.h}>Las que ya hubo<span style={D.hr}>{(c.bookings || []).length}</span></div>
                {(c.bookings || []).length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Ninguna todavía.</div>}
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
            </>
          )}

          {tab === 'cotizaciones' && (
            <div style={D.cardA}>
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

/* Agendar: el tipo NO se elige, lo pone la etapa.
 *
 * El botón estaba fijo en `/agendar/demo`, y por eso las tres únicas reuniones
 * que hay en la base son las tres «Demo personalizada» — no porque solo se den
 * demos, sino porque era lo único que la ficha sabía ofrecer. A un lead ya
 * cotizado se le seguía proponiendo la demo que ya tuvo.
 *
 * De los siete tipos configurados, cuatro son de cliente firmado
 * (capacitación, consultoría, personalización, configuración) y aquí ni
 * aparecen: ofrecerle una capacitación a alguien que no ha comprado es ruido.
 */
function Agendar({ c, etapa, flash, onRegistrarPasada }: any) {
  const [tipos, setTipos] = useState<any[]>([]);
  const [otro, setOtro] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    fetch('/api/scheduling/event-types?activo=true').then(r => r.json())
      .then(j => setTipos(Array.isArray(j) ? j : (j?.data || []))).catch(() => {});
  }, []);

  const sugerido = agendaDeEtapa(etapa);
  const deLead = tipos.filter((t: any) => SLUGS_DE_LEAD.includes(t.slug));
  const slug = manual || sugerido.slug;
  const tipo = tipos.find((t: any) => t.slug === slug);
  // Sin catálogo cargado todavía el slug sigue sirviendo: /agendar/<slug> es
  // una página pública y no depende de que esta petición haya vuelto.
  const nombre = tipo?.nombre || sugerido.slug;

  const url = (abs: boolean) => {
    const base = (abs && typeof window !== 'undefined' ? window.location.origin : '') + '/agendar/' + slug;
    const q = new URLSearchParams();
    if (c.email) q.set('email', c.email);
    if (c.nombre) q.set('nombre', [c.nombre, c.apellido].filter(Boolean).join(' '));
    return q.toString() ? `${base}?${q}` : base;
  };

  return (
    <div style={D.cardM}>
      <div style={D.h}>Agendar<span style={D.hr}>el tipo lo pone la etapa</span></div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Toca</span>
        <b style={{ fontSize: '0.88rem' }}>{nombre}</b>
        {tipo?.duracion_minutos ? <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>· {tipo.duracion_minutos} min</span> : null}
        {!manual && <span style={{ fontSize: '0.58rem', fontWeight: 800, background: '#FFF4E5', color: '#9a6a10', borderRadius: 5, padding: '2px 8px' }}>POR DEFAULT</span>}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#8a8a8a', lineHeight: 1.55, marginTop: 6 }}>
        {manual ? 'Elegido a mano para este lead.' : `Porque ${sugerido.porque}.`}
      </div>

      {otro && (
        <div style={{ marginTop: 10 }}>
          <div style={D.fl}>Otro tipo</div>
          <select style={D.fi} value={manual} onChange={e => setManual(e.target.value)}>
            <option value="">— el que toca por la etapa —</option>
            {deLead.map((t: any) => <option key={t.id} value={t.slug}>{t.nombre}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
        <a style={D.btnP} href={url(false)} target="_blank" rel="noreferrer">Agendar</a>
        <button style={D.btnA} onClick={() => { navigator.clipboard?.writeText(url(true)); flash('Link de agenda copiado'); }}>Mandarle el link</button>
        {!otro && <button style={D.btnG} onClick={() => setOtro(true)}>Otro tipo</button>}
        {/* Muchas reuniones ya ocurrieron cuando alguien se acuerda de
            apuntarlas. Registrarla después vale igual: la etapa avanza y deja
            de pedir algo que ya pasó. */}
        <button style={D.btnG} onClick={onRegistrarPasada}>Registrar una que ya pasó</button>
      </div>
    </div>
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
      .then(j => {
        const todos = Array.isArray(j) ? j : (j?.data || []);
        // Solo los tres de lead: los otros cuatro son de cliente firmado y
        // registrar una "capacitación" de alguien que no compró es basura.
        const l = todos.filter((t: any) => SLUGS_DE_LEAD.includes(t.slug));
        setTipos(l.length ? l : todos);
        const inicial = (l.length ? l : todos)[0];
        if (inicial) setTipoId(inicial.id);
      })
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
            Queda marcada como <b>se presentó</b> y la etapa avanza sola. Después puedes levantar su minuta desde Reuniones.
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
/**
 * Evaluación: los tres campos que un humano SÍ tiene que llenar, y el esfuerzo
 * que se cuenta solo.
 *
 * Es a mano a propósito. La etapa se deduce de hechos, pero si el lead vale la
 * pena solo lo sabe quien habló con él — y el próximo paso es el campo que hoy
 * está en 0 de 105 leads y el que convierte la lista en trabajo.
 */
function Evaluacion({ c, evaluacion, guardar, guardando, setSucio }: any) {
  const [motivos, setMotivos] = useState<any[]>([]);
  const [f, setF] = useState<any>({});
  const v = (k: string) => (f[k] !== undefined ? f[k] : (c[k] ?? '')) as any;
  const set = (k: string, val: any) => setF((p: any) => ({ ...p, [k]: val }));
  const sucio = Object.keys(f).length > 0;
  useEffect(() => { setSucio?.((p: any) => ({ ...p, evaluacion: sucio })); }, [sucio, setSucio]);

  useEffect(() => {
    fetch('/api/crm/leads/motivos?activos=1').then(r => r.json())
      .then(j => setMotivos(j.motivos || [])).catch(() => {});
  }, []);
  const deDescarte = motivos.filter(m => m.tipo === 'descarte');
  const deDesenlace = motivos.filter(m => m.tipo === 'desenlace');

  const CAL = [
    { k: 'sin_calificar', l: 'Sin calificar' },
    { k: 'bueno', l: 'Bueno' },
    { k: 'a_futuro', l: 'A futuro' },
    { k: 'no_califica', l: 'No califica' },
  ];
  const cal = v('calificacion') || 'sin_calificar';
  const pideMotivo = cal === 'a_futuro' || cal === 'no_califica';

  async function aplicar() {
    const patch: any = {};
    for (const [k, val] of Object.entries(f)) patch[k] = val === '' ? null : val;
    // Calificar sin decir por qué, cuando el veredicto es negativo, es lo que
    // impide aprender después qué canal trae curiosos y cuál compradores.
    if (pideMotivo && !(patch.calificacion_motivo ?? c.calificacion_motivo)) return;
    if (patch.calificacion) { patch.calificacion_at = new Date().toISOString(); }
    if (patch.desenlace) { patch.desenlace_at = new Date().toISOString(); }
    if (await guardar(patch)) setF({});
  }

  const e = evaluacion?.esfuerzo || { llamadas: 0, correos: 0, whatsapp: 0 };
  const kpi = (t: string, n: number) => (
    <div style={{ flex: 1, minWidth: 78, border: '1px solid #f0eff3', borderRadius: 10, padding: '9px 11px' }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 2, color: n ? '#1a1a1a' : '#C0554E' }}>{n}</div>
    </div>
  );

  return (
    <div style={D.cardM}>
      <div style={D.h}>Evaluación<span style={D.hr}>lo que sí se captura a mano</span></div>

      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', marginBottom: 5 }}>¿Vale la pena trabajarlo?</div>
      <div style={{ display: 'inline-flex', border: '1px solid #e2e4e9', borderRadius: 9, overflow: 'hidden', flexWrap: 'wrap' }}>
        {CAL.map(x => (
          <button key={x.k} onClick={() => set('calificacion', x.k)}
            style={{ padding: '6px 13px', fontSize: '0.73rem', fontWeight: 700, border: 'none', borderRight: '1px solid #f1f0f6', cursor: 'pointer', fontFamily: 'inherit',
              background: cal === x.k ? '#EEECFE' : '#fff', color: cal === x.k ? '#5B4BD6' : '#6b7280' }}>{x.l}</button>
        ))}
      </div>

      {pideMotivo && (
        <div style={{ marginTop: 9 }}>
          <div style={D.fl}>Motivo <span style={{ color: '#C0554E' }}>· obligatorio</span></div>
          <select style={D.fi} value={v('calificacion_motivo')} onChange={ev => set('calificacion_motivo', ev.target.value)}>
            <option value="">— elige el motivo —</option>
            {deDescarte.map(m => <option key={m.id} value={m.clave}>{m.label}</option>)}
          </select>
          <div style={{ fontSize: '0.66rem', color: '#b3b1bb', marginTop: 4 }}>¿Falta uno? Se agregan en Configuración → Leads.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 9, marginTop: 11 }}>
        <div><div style={D.fl}>Próximo paso</div><input style={D.fi} placeholder="Llamar y confirmar giro…" value={v('proximo_paso')} onChange={ev => set('proximo_paso', ev.target.value)} /></div>
        <div><div style={D.fl}>Cuándo</div><input type="date" style={D.fi} value={String(v('next_followup') || '').slice(0, 10)} onChange={ev => set('next_followup', ev.target.value)} /></div>
      </div>

      {(evaluacion?.etapa === 'cotizado' || evaluacion?.etapa === 'negociando' || c.desenlace) && (
        <div style={{ marginTop: 9 }}>
          <div style={D.fl}>Desenlace <span style={{ color: '#a5a2af' }}>· solo al cerrar</span></div>
          <select style={D.fi} value={v('desenlace')} onChange={ev => set('desenlace', ev.target.value)}>
            <option value="">— sigue abierto —</option>
            {deDesenlace.map(m => <option key={m.id} value={m.clave}>{m.label}</option>)}
          </select>
        </div>
      )}

      {evaluacion?.etapa === 'cotizado' && !c.etapa_manual && (
        <button onClick={() => set('etapa_manual', 'negociando')} style={{ ...D.btnA, marginTop: 9 }}>Marcar que ya están negociando</button>
      )}

      <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid #f4f3f7' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', marginBottom: 6 }}>Esfuerzo de contacto <span style={{ fontWeight: 500, color: '#b3b1bb' }}>· se cuenta solo</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {kpi('Llamadas', e.llamadas)}{kpi('Correos', e.correos)}{kpi('WhatsApp', e.whatsapp)}
        </div>
        {evaluacion?.toques === 0 && (
          <div style={{ fontSize: '0.71rem', color: '#C0554E', marginTop: 8, lineHeight: 1.55 }}>Nadie lo ha tocado todavía. La etapa avanza sola en cuanto se registre el primer intento.</div>
        )}
      </div>

      {sucio && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={aplicar} disabled={guardando || (pideMotivo && !(f.calificacion_motivo ?? c.calificacion_motivo))} style={D.btnP}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          <button onClick={() => setF({})} style={{ ...D.btnA, borderColor: '#e2e4e9', color: '#666' }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

function PruebaGratis({ c, guardar, flash }: any) {
  const p = c.propiedades || {};
  const [abierto, setAbierto] = useState(false);
  // El inicio también se captura: muchas pruebas se abren días antes de que
  // alguien las registre, y poner "hoy" a fuerza falsea cuándo vence.
  const [ini, setIni] = useState(hoy());
  const [fin, setFin] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const activa = p.prueba_inicio && (!p.prueba_fin || p.prueba_fin >= hoy());
  const restan = p.prueba_fin ? Math.ceil((Date.parse(p.prueba_fin + 'T12:00:00') - Date.now()) / 86400000) : null;

  return (
    /* Morado: las fechas de la prueba las captura una persona. */
    <div style={D.cardM}>
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
            <button style={D.btnA} onClick={() => { setIni(p.prueba_inicio || hoy()); setFin(p.prueba_fin || hoy()); setAbierto(true); }}>Cambiar fechas</button>
            <button style={D.btnA} onClick={() => guardar({ propiedades: { ...p, prueba_fin: null, prueba_inicio: null } }).then(() => flash('Prueba cerrada'))}>Cerrar prueba</button>
          </div>
        </>
      ) : abierto ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><div style={D.fl}>Empieza</div><input type="date" value={ini} onChange={e => setIni(e.target.value)} style={D.fi} /></div>
            <div><div style={D.fl}>Termina</div><input type="date" value={fin} onChange={e => setFin(e.target.value)} style={D.fi} /></div>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 6 }}>
            {ini && fin && fin > ini ? `${Math.round((Date.parse(fin) - Date.parse(ini)) / 86400000)} días de prueba.` : 'La fecha de término tiene que ser posterior al inicio.'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
            <button style={D.btnP} disabled={!(fin > ini)}
              onClick={() => guardar({ propiedades: { ...p, prueba_inicio: ini, prueba_fin: fin } }).then(() => { setAbierto(false); flash('Prueba registrada'); })}>Guardar</button>
            <button style={D.btnA} onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.78rem', color: '#6b6b74', lineHeight: 1.55 }}>
            Sin prueba activa. Si le abres una cuenta de prueba, se registra aquí con su vencimiento.
          </div>
          <div style={{ marginTop: 9 }}><button style={D.btnA} onClick={() => setAbierto(true)}>Registrar prueba gratis</button></div>
        </>
      )}
    </div>
  );
}

/* Los campos, agrupados por PARA QUÉ sirven: para llamarle, o para venderle. */
/**
 * De dónde llegó este lead.
 *
 * El origen ya se pintaba como una etiqueta suelta ("Página de agenda"), que
 * es de dónde LLENÓ el formulario, no de dónde VENÍA. La atribución completa
 * se guarda desde que agenda (propiedades.atribucion) y esto la muestra: la
 * campaña que lo trajo, la página donde cayó y con qué dispositivo.
 */
function DeDondeLlego({ c }: any) {
  const a = c?.propiedades?.atribucion;
  const oBase = origenDe(origenDeRegistro(c));
  // Mismo problema que en el chip de Reuniones: si el utm_source no está
  // catalogado (newsletter, bing, un partner), `origenDeRegistro` cae al
  // genérico por `fuente` y el encabezado dice "Página de agenda" tapando el
  // canal real. Cuando eso pasa y sí hay un utm_source, se muestra tal cual.
  const crudoUtm = String(c?.utm_source || '').trim();
  // Y solo si NADIE lo capturó a mano: `propiedades.origen_cuenta` también
  // produce 'agenda'/'sitio_web', y la regla del catálogo (origenes.ts) es que lo
  // capturado gana. Sin este guard, un vendedor que corrige el origen a "Sitio
  // web" veía la tarjeta seguir diciendo "Partner_x".
  const capturadoAMano = !!c?.propiedades?.origen_cuenta;
  const generico = !capturadoAMano && (!oBase.v || oBase.v === 'agenda' || oBase.v === 'sitio_web');
  const o = generico && crudoUtm
    ? { ...oBase, l: crudoUtm.charAt(0).toUpperCase() + crudoUtm.slice(1) }
    : oBase;
  const p = a?.primer_toque, u = a?.ultimo_toque;
  // El encabezado sale de `c.utm_source`, que se escribió con toqueDeOrigen():
  // el primer toque CON CANAL. Las filas leían el primer toque CRUDO, y con una
  // 1ª visita directa + un anuncio después la tarjeta se contradecía sola:
  // "TikTok" en grande y justo debajo "Llegó sin campaña identificable", con
  // Campaña y Medio vacíos y la campaña real escondida en "Volvió por".
  // `org` es el mismo toque que alimentó las columnas utm_*.
  const conCanal = (t: any) => !!(t?.fuente || t?.campana || (t?.click_ids && Object.keys(t.click_ids).length));
  const org = conCanal(p) ? p : (conCanal(u) ? u : p);
  const hayCampana = !!(org?.fuente || org?.campana || org?.referrer);

  const fila = (l: string, v: any) => v ? (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.75rem' }}>
      <span style={{ color: '#a5a2af', flexShrink: 0, minWidth: 92 }}>{l}</span>
      <span style={{ color: '#3f3b4d', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(v)}>{String(v)}</span>
    </div>
  ) : null;

  return (
    /* Azul: nada de esto se captura, todo lo escribió la atribución al llegar. */
    <div style={D.cardA}>
      <div style={D.h}>De dónde llegó{a?.paginas_vistas ? <span style={D.hr}>{a.paginas_vistas} páginas vistas</span> : null}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: o.color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{o.l}</span>
      </div>
      {!hayCampana && (
        <div style={{ fontSize: '0.72rem', color: '#a5a2af', lineHeight: 1.5, paddingTop: 4 }}>
          Llegó sin campaña identificable (tráfico directo o referrer oculto).
        </div>
      )}
      {fila('Campaña', org?.campana)}
      {fila('Medio', org?.medio)}
      {fila('Contenido', org?.contenido)}
      {fila('Cayó en', org?.landing)}
      {fila('Referido de', org?.referrer)}
      {u && u !== org && (u.fuente !== org?.fuente || u.campana !== org?.campana) && fila('Volvió por', [u.fuente, u.campana].filter(Boolean).join(' · '))}
      {/* Cuando gana el ÚLTIMO toque (1ª visita orgánica + anuncio después, el
          caso típico), todas las filas de arriba cuentan esa segunda visita y la
          primera desaparecía de la tarjeta por completo: una tarjeta que se
          titula "De dónde llegó" acababa contando solo por dónde volvió. */}
      {org === u && p && fila('Primer contacto', [p.campana, p.referrer, p.landing].filter(Boolean).join(' · '))}
      {fila('Dispositivo', [a?.dispositivo, a?.navegador].filter(Boolean).join(' · '))}
      {c.lead_score ? fila('Puntaje', `${c.lead_score}/100`) : null}
    </div>
  );
}

function Campos({ c, guardar, guardando, setSucio }: any) {
  const [f, setF] = useState<any>({});
  const giros = useGiros();
  const v = (k: string) => (f[k] !== undefined ? f[k] : (c[k] ?? '')) as any;
  const set = (k: string, val: any) => setF((p: any) => ({ ...p, [k]: val }));
  const prop = (k: string) => (f[`p_${k}`] !== undefined ? f[`p_${k}`] : (c.propiedades?.[k] ?? '')) as any;
  const sucio = Object.keys(f).length > 0;
  useEffect(() => { setSucio?.((p: any) => ({ ...p, campos: sucio })); }, [sucio, setSucio]);

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
        {/* Teléfono y Puesto llevan 127 leads en blanco. No se quitan —cuando
            hay dato es el que sirve— pero se anuncian como opcionales para que
            una caja vacía no se lea como un pendiente. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 9 }}>
          <div><div style={D.fl}>WhatsApp</div><input style={D.fi} value={v('whatsapp')} onChange={e => set('whatsapp', e.target.value)} placeholder="— agregar" /></div>
          <div><div style={D.fl}>Teléfono</div><input style={D.fi} value={v('telefono')} onChange={e => set('telefono', e.target.value)} placeholder="— agregar" /></div>
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
        <div style={D.h}>El negocio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div>
            <div style={D.fl}>Empresa</div>
            {/* Editable: un lead que llegó sin empresa la gana en la primera
                llamada, y es el dato que después lo convierte en cliente. */}
            <input style={D.fi} value={f.empresa !== undefined ? f.empresa : (c.companies?.nombre || '')}
              onChange={e => set('empresa', e.target.value)} placeholder="sin empresa" />
          </div>
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
          <div>
            <div style={D.fl}>Giro</div>
            <select style={D.fi} value={prop('giro_negocio') || v('giro') || ''} onChange={e => { set('p_giro_negocio', e.target.value); set('giro', e.target.value); set('p_subgiro', ''); }}>
              <option value="">— sin definir —</option>
              {giros.giros.map((x: any) => <option key={x.v} value={x.v}>{x.l}</option>)}
            </select>
          </div>
        </div>
        {/* El subgiro solo aparece cuando su giro ya tiene opciones: preguntar
            un subgiro sin giro es pedir un dato que nadie puede contestar. */}
        {(giros.subs[prop('giro_negocio') || v('giro')] || []).length > 0 && (
          <div style={{ marginTop: 9 }}>
            <div style={D.fl}>Subgiro</div>
            <select style={D.fi} value={prop('subgiro')} onChange={e => set('p_subgiro', e.target.value)}>
              <option value="">— sin definir —</option>
              {(giros.subs[prop('giro_negocio') || v('giro')] || []).map((x: any) => <option key={x.v} value={x.v}>{x.l}</option>)}
            </select>
          </div>
        )}

        {/* Aquí había dos campos que se fueron:
            · "Etapa", un selector para cambiarla a mano justo debajo de una
              tarjeta que dice "se mueve sola". O se deduce de hechos o se
              captura; las dos a la vez enseñan a desconfiar del sistema. Lo
              que sí se puede adelantar a mano vive en Seguimiento
              (etapa_manual), y solo para los peldaños que un humano sabe.
            · "Próximo seguimiento", que es la MISMA columna `next_followup`
              que ya se pide en Evaluación. Se pedía dos veces en dos
              pestañas distintas y la última en guardarse ganaba. */}
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
      {/* Azul: el historial ya no se toca, solo se lee. */}
      <div style={D.cardA}>
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
