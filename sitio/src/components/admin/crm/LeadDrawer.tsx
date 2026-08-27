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
import { minutaLlena, normalizaEstado, siguientes } from '../../../lib/crm/reuniones';
import MinutaLead from './MinutaLead';
import Cargando, { Corazones } from './ui/Cargando';
import SenalesContacto from './email/SenalesContacto';
import { useIsMobile, useDrawerHistory } from '../../../lib/ui/mobile';
import { etapaDeLead, siguientePaso as pasoDeEtapa, ETAPA_LABEL, type Etapa } from '../../../lib/crm/lead-etapa';
import { pintaEstatus } from '../../../lib/crm/estatus-lead';
import { agendaDeEtapa, SLUGS_DE_LEAD } from '../../../lib/crm/lead-agenda';
import { HISTORIAL_ETIQUETA } from '../../../lib/crm/lead-historial';
import { CANALES, RESULTADOS, resultadoDe, tipoActividad, tituloToque, quienLoHizo, esRuido, type Canal } from '../../../lib/crm/lead-toques';

const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '').replace('-', ' ') : '';
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

/* Colores de la etapa DEDUCIDA, la de la ruta.
 *
 * La pastilla del encabezado salía de `lifecycle_stage`, que es una columna
 * capturada y se queda vieja: un lead con dos cotizaciones encima seguía
 * anunciándose como "Nuevo" mientras la ruta lo tenía en Cotizado y la agenda
 * ya le ofrecía la reunión de cotización. Tres lugares contando tres historias
 * del mismo lead. Ahora los tres leen lo mismo. */
const COLOR_ETAPA: Record<Etapa, { bg: string; fg: string }> = {
  nuevo: { bg: '#f4f4f6', fg: '#6B7280' },
  contactado: { bg: '#EEECFE', fg: '#5B4BD6' },
  calificado: { bg: '#EEECFE', fg: '#5B4BD6' },
  agendado: { bg: '#E3EDFD', fg: '#2C5FC4' },
  demo_hecha: { bg: '#E3EDFD', fg: '#2C5FC4' },
  cotizado: { bg: '#FFF4E5', fg: '#9a6a10' },
  negociando: { bg: '#FFF4E5', fg: '#9a6a10' },
  cliente: { bg: '#EAF8F2', fg: '#1E8A63' },
  perdido: { bg: '#FEF0EF', fg: '#C0554E' },
};

export default function LeadDrawer({ contactId, onClose, onChanged, onAbrirOtro }: any) {
  // ⚠️ Hooks SIEMPRE antes de los returns tempranos de carga/error — si van
  // después, React truena con "Rendered more hooks than during the previous
  // render" en cuanto la ficha pasa de 'cargando' a 'con datos'.
  const esMovil = useIsMobile();
  useDrawerHistory(esMovil, onClose);
  // Abre en "quién es", no en un revoltijo. Es el orden de la conversación con
  // el lead, el mismo criterio con el que están ordenadas las pestañas del
  // cliente: quién es · en qué va · cuándo lo tocamos · cuándo lo vimos · qué
  // le ofrecimos · qué está haciendo él.
  // Actividad dejó de ser pestaña: registrar el toque y la historia van DENTRO
  // de Seguimiento, porque son la misma conversación. Verlas aparte obligaba a
  // cambiar de pestaña para contestar "¿ya le hablé?" mientras leías la etapa.
  const [tab, setTab] = useState<'info' | 'seguimiento' | 'reuniones' | 'cotizaciones' | 'senales'>('info');
  // La minuta que se está levantando o consultando. Vive aquí y no dentro del
  // renglón para que al guardar se pueda refrescar la ficha entera.
  const [minutaDe, setMinutaDe] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [uniendo, setUniendo] = useState(false);
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

  // La pastilla dice la etapa DEDUCIDA, la misma que la ruta y la que decide
  // qué reunión toca. `lifecycle_stage` solo entra si todavía no hay evaluación.
  const eta = evaluacion?.etapa as Etapa | undefined;
  const et = eta
    ? { l: ETAPA_LABEL[eta], ...COLOR_ETAPA[eta] }
    : (ETAPAS[c.lifecycle_stage] || ETAPAS.lead);
  // Select con el acabado del input: el chevron nativo del navegador
  // desentonaba junto a los campos de texto.
  const selE = { ...D.fi, appearance: 'none' as const, WebkitAppearance: 'none' as const,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a5a2af' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 26 };
  const tel = c.whatsapp || c.telefono;
  const o = origenDe(origenDeRegistro(c));
  const demo = (c.bookings || []).slice().sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)))[0];
  const sinContacto = dias(c.last_contact_at || c.created_at);

  return (
    <>
      <div style={D.overlay} onClick={onClose} />
      <div style={esMovil ? { ...D.panel, width: '100%', boxShadow: 'none' } : D.panel}>
        {esMovil && (
          <div style={{ background: '#fff', padding: '6px 12px 0' }}>
            <button onClick={cerrar} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', padding: '8px 12px 8px 8px', fontSize: '0.95rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Volver
            </button>
          </div>
        )}
        <div style={D.head}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                {[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                <span style={D.chip(et.bg, et.fg)}>{et.l}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#8a8a8a', marginTop: 2 }}>
                {/* En Info general el héroe ya cuenta quién es: repetir correo y
                    teléfono a 10 px era el mismo dato dos veces. En las demás
                    pestañas el header sí carga la identidad completa. */}
                {(tab === 'info' ? [c.companies?.nombre] : [c.companies?.nombre, c.email, tel]).filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
              {!esMovil && tel && <a style={D.btnW} href={waLink(tel)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {!esMovil && c.email && <a style={D.btnA} href={`mailto:${c.email}`}>Correo</a>}
              {!esMovil && <button style={D.btnP} onClick={() => window.open('/admin/revenue?nueva=1&empresa=' + encodeURIComponent(c.companies?.nombre || ''), '_blank', 'noopener')}>Cotizar</button>}
              {!esMovil && <button onClick={cerrar} aria-label="Cerrar"
                style={{ width: 32, height: 32, border: '1px solid #e6e6ea', borderRadius: 9, background: '#fff', color: '#9c99a6', cursor: 'pointer', fontSize: '1.05rem', fontFamily: 'inherit' }}>✕</button>}
            </div>
          </div>
          {/* ══ M3 · Fila de acciones al pulgar (solo móvil): WhatsApp primaria
              en morado, llamar y cotizar con targets ≥44px. ══ */}
          {esMovil && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 0 2px' }}>
              {tel && <a href={waLink(tel)} target="_blank" rel="noreferrer" style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#5B4BD6', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}>WhatsApp</a>}
              {tel && <a href={'tel:' + String(tel).replace(/\D/g, '')} style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#1a1a1a', border: '1px solid #dddce3', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}>Llamar</a>}
              <button onClick={() => window.open('/admin/revenue?nueva=1&empresa=' + encodeURIComponent(c.companies?.nombre || ''), '_blank', 'noopener')} style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#1a1a1a', border: '1px solid #dddce3', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cotizar</button>
            </div>
          )}
          {/* El orden es el de la conversación con el lead —quién es, en qué va,
              cuándo lo tocamos, cuándo lo vimos, qué le ofrecimos, qué hace él—
              igual que las pestañas del cliente. Señales va al final: se
              consulta cuando ya sabes qué buscas, no al abrir la ficha. */}
          <div style={{ display: 'flex', gap: 2, marginTop: 12, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)' }}>
            {([
              ['info', 'Info general', null],
              ['seguimiento', 'Seguimiento', null],
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
                {/* Detectar el duplicado sin poder resolverlo es medio trabajo:
                    el aviso decía "conviene fusionarlas" y no había con qué. */}
                {(c.historial.tipo === 'ficha_repetida' || c.historial.tipo === 'volvio_a_escribir') && (
                  <button style={{ ...D.btnP, marginTop: 10 }} onClick={() => setUniendo(true)}>Unir las fichas</button>
                )}
              </div>
            );
          })()}

          {/* ── Seguimiento: por dónde va, registrar, y todo lo que ha pasado ── */}
          {tab === 'seguimiento' && <RielEtapas c={c} evaluacion={evaluacion} ruta={RUTA_VISIBLE} sinContacto={sinContacto} />}
          {/* La prueba gratis va ARRIBA, no al final: es un reloj corriendo. Al
              fondo de la pestaña, debajo de la línea de tiempo, había que
              acordarse de bajar para enterarse de que vencía pasado mañana. */}
          {tab === 'seguimiento' && <PruebaGratis c={c} guardar={guardar} flash={flash} />}
          {tab === 'seguimiento' && <RegistrarToque c={c} recargar={cargar} flash={flash} />}
          {tab === 'seguimiento' && <LineaDeTiempo c={c} />}
          {tab === 'seguimiento' && <Evaluacion c={c} evaluacion={evaluacion} guardar={guardar} guardando={guardando} setSucio={setSucio} />}

          {/* ── Info general: quién es y cómo alcanzarlo. Nada más. ── */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, alignItems: 'start' }}>
              <div><Campos c={c} guardar={guardar} guardando={guardando} setSucio={setSucio} /></div>
              <div>
                <DeDondeLlego c={c} />
                <SiguientePaso c={c} guardar={guardar} guardando={guardando} />
                <LoUltimo c={c} />
              </div>
            </div>
          )}

          {/* Señales: el puntaje de intención y la historia completa de las
              cinco fuentes. Es lo que se lee antes de llamar. */}
          {tab === 'senales' && <div style={{ padding: '4px 0' }}><SenalesContacto contactId={c.id} /></div>}

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
                  <RenglonReunion key={b.id} b={b} onMinuta={() => setMinutaDe(b)} onCambio={cargar} />
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
        {uniendo && (
          <UnirFichas c={c} onCerrar={() => setUniendo(false)}
            onListo={(n: number, principalId: string) => {
              setUniendo(false); onChanged?.();
              // Si la que se quedó es OTRA, este cajón está mostrando una ficha
              // que se acaba de archivar: se queda leyendo algo que ya no
              // existe, con el aviso de duplicado todavía puesto. Hay que
              // saltar a la que sobrevivió, que es donde está la historia.
              if (principalId && principalId !== contactId && onAbrirOtro) onAbrirOtro(principalId);
              else { cargar(); flash(`Se unieron ${n} fichas`); }
            }} />
        )}
        {minutaDe && (
          <MinutaLead reunion={minutaDe} lead={c}
            soloLectura={normalizaEstado(minutaDe.estado) !== 'asistio'}
            onClose={() => setMinutaDe(null)}
            onGuardado={() => { setMinutaDe(null); cargar(); }} />
        )}
        {registrando && (
          <ReunionPasada c={c} onCerrar={() => setRegistrando(false)} onListo={() => { setRegistrando(false); flash('Reunión registrada'); cargar(); }} />
        )}
      </div>
    </>
  );
}

/* ═══ Unir fichas duplicadas ═══
 *
 * El aviso ya sabía decir "conviene fusionarlas" y no había con qué: detectar
 * el duplicado sin poder resolverlo es medio trabajo.
 *
 * Lo que motivó el diseño salió de mirar los duplicados reales: casi todos son
 * el MISMO correo con distinta mayúscula —Riverosbrayan154@ y
 * riverosbrayan154@, o los tres OETDALAG/oetdalag de Ronaldo—, y la historia
 * está partida entre las fichas: la de Brayan que tiene la reunión agendada no
 * es la que tiene las actividades. Por eso unir no es limpiar, es recuperar la
 * mitad de la historia que no estabas viendo.
 */
function UnirFichas({ c, onCerrar, onListo }: any) {
  const [grupo, setGrupo] = useState<any[] | null>(null);
  const [principal, setPrincipal] = useState('');
  const [ensayo, setEnsayo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/crm/leads/unir?id=${c.id}`).then(r => r.json())
      .then(j => { setGrupo(j.grupo || []); setPrincipal(j.sugerida || ''); })
      .catch(() => setError('No se pudo cargar el grupo de fichas.'));
  }, [c.id]);

  // El ensayo lo calcula la MISMA función que después une, en modo dry_run: si
  // la vista previa la hiciera el navegador por su cuenta, podría prometer algo
  // distinto de lo que acaba pasando.
  const otras = (grupo || []).filter(f => f.id !== principal).map(f => f.id);
  useEffect(() => {
    if (!principal || !otras.length) { setEnsayo(null); return; }
    fetch('/api/crm/leads/unir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principal_id: principal, otras_ids: otras, ensayo: true }),
    }).then(r => r.json()).then(j => setEnsayo(j.resumen || null)).catch(() => setEnsayo(null));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [principal, grupo]);

  async function unir() {
    setBusy(true); setError('');
    const r = await fetch('/api/crm/leads/unir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principal_id: principal, otras_ids: otras }),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudieron unir.'); return; }
    onListo(otras.length + 1, principal);
  }

  const laPrincipal = (grupo || []).find(f => f.id === principal);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 'min(660px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '15px 19px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, flex: 1 }}>
            Unir las fichas de {[c.nombre, c.apellido].filter(Boolean).join(' ') || 'este lead'}
          </h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '17px 19px 19px' }}>
          {!grupo && <Cargando texto="Buscando las fichas repetidas…" alto={140} />}
          {grupo && grupo.length < 2 && (
            <div style={{ fontSize: '0.82rem', color: '#6b6b74', lineHeight: 1.6 }}>
              Ya no hay otra ficha con este correo ni con este teléfono. Puede que alguien las haya unido antes.
            </div>
          )}

          {grupo && grupo.length >= 2 && (
            <>
              <div style={D.fl}>¿Cuál se queda?</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))`, gap: 11 }}>
                {grupo.map(f => {
                  const sel = f.id === principal;
                  return (
                    <button key={f.id} onClick={() => setPrincipal(f.id)}
                      style={{
                        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                        border: `1.5px solid ${sel ? '#9B8CFA' : '#e6e3ef'}`, borderRadius: 11, padding: '12px 13px',
                        background: sel ? '#fcfbff' : '#fff', boxShadow: sel ? '0 0 0 3px rgba(155,140,250,.13)' : 'none',
                      }}>
                      <b style={{ fontSize: '0.82rem', display: 'block', wordBreak: 'break-all' }}>{f.email || f.whatsapp || 'Sin correo'}</b>
                      <div style={{ fontSize: '0.71rem', color: '#8a8a8a', marginTop: 3 }}>
                        Llegó el {fmtLargo(f.created_at)}
                        {f.id === c.id ? ' · la que estás viendo' : ''}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#3f3b4d', marginTop: 8, paddingTop: 7, borderTop: '1px solid #f3f1f8' }}>
                        {f.historia === 0 ? 'Sin historia' : [
                          f.actividades ? `${f.actividades} ${f.actividades === 1 ? 'actividad' : 'actividades'}` : null,
                          f.reuniones ? `${f.reuniones} ${f.reuniones === 1 ? 'reunión' : 'reuniones'}` : null,
                          f.cotizaciones ? `${f.cotizaciones} ${f.cotizaciones === 1 ? 'cotización' : 'cotizaciones'}` : null,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  );
                })}
              </div>

              {ensayo && (
                <div style={{ ...D.cardA, marginTop: 15, marginBottom: 0 }}>
                  <div style={D.h}>Cómo queda la ficha</div>
                  {[
                    ['Correo', laPrincipal?.email, 'de la que se queda'],
                    ['Llegó', fmtLargo(ensayo.llego), 'la más vieja de las dos'],
                    ['Actividades', `+${ensayo.actividades}`, 'se suman'],
                    ['Reuniones', `+${ensayo.reuniones}`, 'se suman'],
                    ['Cotizaciones', `+${ensayo.cotizaciones}`, 'se suman'],
                  ].filter(([, v]) => v && v !== '+0').map(([k, v, de]: any) => (
                    <div key={k} style={{ display: 'flex', gap: 10, fontSize: '0.78rem', padding: '6px 0', borderTop: '1px solid #f4f4f4', alignItems: 'center' }}>
                      <span style={{ color: '#a5a2af', minWidth: 108, flexShrink: 0 }}>{k}</span>
                      <span style={{ color: '#241d43', minWidth: 0, wordBreak: 'break-all' }}>{v}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#a5a2af', flexShrink: 0 }}>{de}</span>
                    </div>
                  ))}
                  {(ensayo.campos_llenados || []).length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#1E8A63', marginTop: 9, paddingTop: 8, borderTop: '1px solid #f4f4f4', lineHeight: 1.5 }}>
                      Se llenan campos que estaban vacíos: {[...new Set(ensayo.campos_llenados)].join(', ')}.
                    </div>
                  )}
                  {(ensayo.correos_alternos || []).length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#9a6a10', marginTop: 8, lineHeight: 1.5 }}>
                      El otro correo no se pierde, se guarda como alterno: {ensayo.correos_alternos.join(', ')}.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 13, background: '#FFF4E5', border: '1px solid #f0d9ab', borderRadius: 10, padding: '10px 13px', fontSize: '0.76rem', color: '#9a6a10', lineHeight: 1.55 }}>
                {otras.length === 1 ? 'La otra ficha' : `Las otras ${otras.length} fichas`} no se {otras.length === 1 ? 'borra' : 'borran'}: se {otras.length === 1 ? 'archiva' : 'archivan'} apuntando a esta. Dejan de salir en la lista y en los conteos, pero si esto sale mal se pueden devolver.
              </div>

              {error && (
                <div style={{ marginTop: 11, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#C0554E' }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 9, marginTop: 14, alignItems: 'center' }}>
                <button style={{ ...D.btnP, opacity: busy || !principal ? .6 : 1 }} disabled={busy || !principal} onClick={unir}>
                  {busy ? 'Uniendo…' : `Unir ${otras.length + 1} fichas`}
                </button>
                <button style={D.btnG} onClick={onCerrar}>Cancelar</button>
                <span style={{ marginLeft: 'auto', fontSize: '0.71rem', color: '#a5a2af' }}>Queda en la historia de la ficha.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
  const [fin, setFin] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); });   // la prueba estándar dura 3 días
  // "Activa" incluye la VENCIDA a propósito: una prueba que terminó sigue
  // siendo una prueba abierta hasta que alguien la cierre, y es justo la que
  // hay que ver. Lo que cambia es el color, no si aparece.
  const activa = !!p.prueba_inicio;
  const restan = p.prueba_fin ? Math.ceil((Date.parse(p.prueba_fin + 'T12:00:00') - Date.now()) / 86400000) : null;
  const urge = restan != null && restan <= 3;

  return (
    /* Morado: las fechas de la prueba las captura una persona. */
    <div style={{ ...D.cardM, ...(activa && urge ? { borderColor: '#f0c4bd', background: '#fffbfa' } : null) }}>
      <div style={D.h}>
        Prueba gratis
        {activa && restan != null && (
          <span style={{ ...D.chip(restan < 0 ? '#FBECEA' : urge ? '#FFF4E5' : '#EAF8F2', restan < 0 ? '#C0554E' : urge ? '#9a6a10' : '#1E8A63'), letterSpacing: 0, textTransform: 'none' }}>
            {restan < 0 ? `venció hace ${Math.abs(restan)} d` : restan === 0 ? 'termina hoy' : `quedan ${restan} d`}
          </span>
        )}
      </div>
      {/* El orden de las ramas importa y era el bug: estaba `activa ? … :
          abierto ? …`, así que con una prueba activa la rama del formulario
          NUNCA se alcanzaba. "Cambiar fechas" prendía un estado que nadie
          dibujaba, y el botón se veía muerto. El formulario va primero. */}
      {abierto ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><div style={D.fl}>Empieza</div><input type="date" value={ini} onChange={e => setIni(e.target.value)} style={D.fi} /></div>
            <div><div style={D.fl}>Termina</div><input type="date" value={fin} onChange={e => setFin(e.target.value)} style={D.fi} /></div>
          </div>
          <div style={{ fontSize: '0.68rem', color: fin > ini ? '#a5a2af' : '#C0554E', marginTop: 6 }}>
            {ini && fin && fin > ini ? `${Math.round((Date.parse(fin) - Date.parse(ini)) / 86400000)} días de prueba.` : 'La fecha de término tiene que ser posterior al inicio.'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
            <button style={{ ...D.btnP, opacity: fin > ini ? 1 : .5 }} disabled={!(fin > ini)}
              onClick={() => guardar({ propiedades: { ...p, prueba_inicio: ini, prueba_fin: fin } }).then(() => { setAbierto(false); flash(activa ? 'Fechas actualizadas' : 'Prueba registrada'); })}>Guardar</button>
            <button style={D.btnG} onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </>
      ) : activa ? (
        <>
          <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
            Activa desde el {fmtLargo(p.prueba_inicio)}
          </div>
          <div style={{ fontSize: '0.75rem', color: urge ? '#C0554E' : '#6b6b74', marginTop: 3 }}>
            {restan != null ? (restan >= 0 ? `Termina el ${fmtLargo(p.prueba_fin)} · ${restan} ${restan === 1 ? 'día' : 'días'}` : `Venció el ${fmtLargo(p.prueba_fin)}, hace ${Math.abs(restan)} días`) : 'Sin fecha de término'}
          </div>
          {/* Una prueba vencida sin cerrar es la que se olvida: el sistema no
              sabe si compró, si se le acabó o si nadie volvió a hablarle. */}
          {restan != null && restan < 0 && (
            <div style={{ marginTop: 9, background: '#FBECEA', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 12px', fontSize: '0.76rem', color: '#C0554E', lineHeight: 1.5 }}>
              La prueba ya terminó y sigue abierta. Ciérrala o extiéndela: mientras siga así, nadie sabe en qué quedó.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button style={D.btnA} onClick={() => { setIni(p.prueba_inicio || hoy()); setFin(p.prueba_fin || hoy()); setAbierto(true); }}>Cambiar fechas</button>
            <button style={D.btnG} onClick={() => guardar({ propiedades: { ...p, prueba_fin: null, prueba_inicio: null } }).then(() => flash('Prueba cerrada'))}>Cerrar prueba</button>
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
/* El siguiente paso es LA pregunta al abrir una ficha: qué sigue y cuándo.
   Vivía solo en Seguimiento; aquí es una captura de dos campos sin salir. */
function SiguientePaso({ c, guardar, guardando }: any) {
  const [paso, setPaso] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const vPaso = paso !== null ? paso : (c.proximo_paso || '');
  const vFecha = fecha !== null ? fecha : (c.next_followup || '');
  const sucio = paso !== null || fecha !== null;
  const vencido = c.next_followup && c.next_followup < new Date().toISOString().slice(0, 10);
  return (
    <div style={D.cardM}>
      <div style={D.h}>Siguiente paso{vencido && <span style={{ ...D.hr, background: '#FEF0EF', color: '#C0554E' }}>vencido</span>}</div>
      {/* Captura rápida a propósito (la excepción a "se lee escrita"): el
          siguiente paso se apunta en caliente, sin entrar a editar. La fecha
          NO usa el date nativo del navegador (mm/dd/yyyy gringo, fuera de
          tokens): chips de atajo + dd/mm/aaaa escrito. */}
      <div style={D.fl}>Qué sigue</div>
      <input style={D.fi} value={vPaso} onChange={e => setPaso(e.target.value)} placeholder="ej. mandarle la cotización…" />
      <div style={D.fl}>Para cuándo</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
        {[['Mañana', 1], ['En 3 días', 3], ['Próx. semana', 7]].map(([l, n]) => {
          const d = new Date(); d.setDate(d.getDate() + (n as number));
          const iso = d.toISOString().slice(0, 10);
          const on = vFecha === iso;
          return <button key={l as string} onClick={() => setFecha(iso)} style={{
            border: `1px solid ${on ? '#9B8CFA' : '#e6e5ec'}`, background: on ? '#EEECFE' : '#fff',
            color: on ? '#5B4BD6' : '#5c5966', borderRadius: 999, padding: '4px 11px',
            fontSize: '0.7rem', fontWeight: on ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{l}</button>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ ...D.fi, width: 130 }} placeholder="dd/mm/aaaa" inputMode="numeric"
          value={vFecha ? vFecha.split('-').reverse().join('/') : ''}
          onChange={e => {
            const m = e.target.value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
            if (!e.target.value) setFecha('');
            else if (m) {
              const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(new Date().getFullYear());
              setFecha(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
            } else setFecha(vFecha);   // no rompe lo ya elegido mientras teclea
          }} />
        <button style={{ ...D.btnP, opacity: sucio ? 1 : .45 }} disabled={!sucio || guardando}
          onClick={async () => { if (await guardar({ proximo_paso: vPaso || null, next_followup: vFecha || null })) { setPaso(null); setFecha(null); } }}>
          {guardando ? '…' : 'Guardar paso'}</button>
      </div>
    </div>
  );
}

/* Lo último que pasó: la ficha responde "¿en qué quedamos?" sin cambiar de
   pestaña. La historia completa sigue viviendo en Seguimiento. */
function LoUltimo({ c }: any) {
  const acts = (c.activities || []).filter((a: any) => !esRuido(a))
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
  const tel = c.whatsapp || c.telefono;
  // El vacío con propósito: si no ha pasado nada, la tarjeta empuja el
  // primer toque en vez de quedarse callada.
  if (!acts.length) return (
    <div style={D.cardA}>
      <div style={D.h}>Lo último</div>
      <div style={{ fontSize: '0.78rem', color: '#8a8590', lineHeight: 1.5 }}>
        Aún no hay actividad con este lead.
        {tel && <> El primer toque es el que abre todo — <a href={waLink(tel)} target="_blank" rel="noreferrer" style={{ color: '#5B4BD6', fontWeight: 700, textDecoration: 'none' }}>mándale el primer WhatsApp →</a></>}
      </div>
    </div>
  );
  return (
    <div style={D.cardA}>
      <div style={D.h}>Lo último</div>
      {acts.map((a: any) => (
        <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', borderTop: '1px solid #f7f7fa' }}>
          <span style={{ fontSize: '0.66rem', color: '#a5a2af', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(a.created_at)}</span>
          <span style={{ fontSize: '0.78rem', color: '#3f3b4d', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.titulo || ''}>{a.titulo || tipoActividad(a.tipo)}</span>
        </div>
      ))}
    </div>
  );
}

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

  // En móvil, si el origen es "Sin definir" y no hay campaña ni actividad,
  // la card entera es redundante: los chips de arriba ya lo dicen.
  const esMovilO = useIsMobile();
  if (esMovilO && o.l === 'Sin definir' && !hayCampana && !a?.paginas_vistas) return null;
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
      {/* El bloque crudo de TikTok: el anuncio y el formulario EXACTOS que lo
          trajeron, y la fecha real del lead (la del anuncio, no la del import).
          Si entró por hoja sin fecha, se dice — adivinar es peor. */}
      {c.propiedades?.tiktok?.anuncio ? fila('Anuncio', c.propiedades.tiktok.anuncio) : null}
      {c.propiedades?.tiktok?.formulario ? fila('Formulario', c.propiedades.tiktok.formulario) : null}
      {c.propiedades?.tiktok ? fila('Registro real', c.propiedades.tiktok.creado
        ? new Date(c.propiedades.tiktok.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'sin fecha original (entró por hoja)') : null}
      {c.lead_score ? fila('Puntaje', `${c.lead_score}/100`) : null}
    </div>
  );
}

function Campos({ c, guardar, guardando, setSucio }: any) {
  const esMovilC = useIsMobile();
  const [verVacios, setVerVacios] = useState(false);
  // La ficha se LEE escrita (patrón de la ficha del cliente): héroe con chips,
  // la franja de lo derivado, y los datos como texto. Los inputs solo salen al
  // pedir Editar — ocho cajas abiertas para venir a LEER eran puro ruido.
  const [f, setF] = useState<any>({});
  const [editando, setEditando] = useState(false);
  const [accion, setAccion] = useState<'' | 'pausa' | 'descarte'>('');
  const [pausaHasta, setPausaHasta] = useState('');
  const [pausaRazon, setPausaRazon] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [motivoDesc, setMotivoDesc] = useState('');
  const [equipo, setEquipo] = useState<any[]>([]);
  const [cfg, setCfg] = useState<Record<string, { v: string; l: string }[]>>({});
  const [copiado, setCopiado] = useState('');
  const giros = useGiros();
  const v = (k: string) => (f[k] !== undefined ? f[k] : (c[k] ?? '')) as any;
  const set = (k: string, val: any) => setF((p: any) => ({ ...p, [k]: val }));
  const prop = (k: string) => (f[`p_${k}`] !== undefined ? f[`p_${k}`] : (c.propiedades?.[k] ?? '')) as any;
  const sucio = Object.keys(f).length > 0;
  useEffect(() => { setSucio?.((p: any) => ({ ...p, campos: sucio })); }, [sucio, setSucio]);
  useEffect(() => {
    fetch('/api/crm/whatsapp/equipo').then(r => r.json()).then(j => setEquipo(j.equipo || [])).catch(() => {});
    fetch('/api/crm/campos-config').then(r => r.json()).then(j => setCfg(j.campos || {})).catch(() => {});
  }, []);
  const opciones = (campo: string, def: { v: string; l: string }[]) => (cfg[campo]?.length ? cfg[campo] : def);
  const etiqueta = (campo: string, val: any) => opciones(campo, []).find(o => o.v === val)?.l || null;

  async function aplicar() {
    const patch: any = {};
    Object.entries(f).forEach(([k, val]) => { if (!k.startsWith('p_')) patch[k] = val === '' ? null : val; });
    const props = { ...(c.propiedades || {}) };
    Object.entries(f).forEach(([k, val]) => { if (k.startsWith('p_')) props[k.slice(2)] = val || null; });
    if (Object.keys(f).some(k => k.startsWith('p_'))) patch.propiedades = props;
    if (await guardar(patch)) setF({});
  }

  const copiar = (txt: string, k: string) => {
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(k); setTimeout(() => setCopiado(''), 1400); }).catch(() => {});
  };

  /* Un dato escrito, no una caja. Lo vacío se dice ("sin capturar") en gris. */
  // Lo vacío es un guion quieto (title dice "sin capturar"): seis letreros de
  // "sin capturar" en gris eran una letanía. Lo largo (correo) se corta con
  // puntos suspensivos y el valor completo vive en el title y en "copiar".
  const leido = (k: string, val: any, extra?: any) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' as const, color: '#a5a2af' }}>{k}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: val ? 700 : 500, marginTop: 3, color: val ? '#241d43' : '#c9c7d0', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span title={val ? String(val) : 'sin capturar'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{val || '—'}</span>
        {extra}
      </div>
    </div>
  );
  const dato = (k: string, val: any, color?: string, sub?: string) => (
    <div>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: '#9c99a6' }}>{k}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: 3, color: color || '#241d43' }}>{val}</div>
      {sub && <div style={{ fontSize: '0.66rem', color: '#8a8590' }}>{sub}</div>}
    </div>
  );
  const chip = (txt: any, bg = '#f4f3f7', col = '#6b7280', title?: string) => (
    <span title={title} style={{ fontSize: '0.66rem', fontWeight: 700, borderRadius: 20, padding: '3px 10px', background: bg, color: col, whiteSpace: 'nowrap' as const }}>{txt}</span>
  );
  const btnCopiar = (txt: string, k: string) => (
    <button onClick={() => copiar(txt, k)} title="Copiar"
      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 800, color: copiado === k ? '#1E8A63' : '#b3b1bb', fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' }}>
      {copiado === k ? 'copiado ✓' : 'copiar'}
    </button>
  );

  // ── Lo que el héroe cuenta ──
  const estP = pintaEstatus(c.estatus_lead, c.retenido_hasta);
  const llegoRealF = c.propiedades?.tiktok?.creado || c.created_at;
  const o = origenDe(origenDeRegistro(c));
  const toques = (c.activities || []).filter((a: any) => ['llamada', 'email_enviado', 'whatsapp_enviado'].includes(a.tipo)).length;
  const sinC = dias(c.last_contact_at || c.created_at);
  const iniciales = String([c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || '?').trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const giroTxt = (giros.giros.find((x: any) => x.v === (prop('giro_negocio') || c.giro))?.l) || null;
  const dueno = equipo.find(m => m.id === c.owner_id)?.nombre || null;
  const rejilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px 16px' } as const;
  const separador = { marginTop: 14, borderTop: '1px solid #f4f3f7', paddingTop: 12 } as const;
  // Select con el acabado del input: el chevron nativo del navegador
  // desentonaba junto a los campos de texto.
  const selE = { ...D.fi, appearance: 'none' as const, WebkitAppearance: 'none' as const,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a5a2af' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 26 };
  const tel = c.whatsapp || c.telefono;
  const pausaActiva = c.retenido_hasta && new Date(c.retenido_hasta) > new Date();

  return (
    <>
      <div style={D.cardM}>
        {/* ── Héroe: quién es, en una mirada ── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {!esMovilC && <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEECFE', color: '#4536BE', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.05rem', flexShrink: 0 }}>{iniciales}</div>}
          <div style={{ flex: 1, minWidth: 190 }}>
            {!esMovilC && (<>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#241d43', letterSpacing: '-.015em', lineHeight: 1.2 }}>
              {[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 3 }}>
              {[c.companies?.nombre, giroTxt].filter(Boolean).join(' · ') || 'sin empresa capturada'}
            </div>
            </>)}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: esMovilC ? 0 : 8, alignItems: 'center' }}>
              {chip(estP.label, estP.fondo, estP.tinta, 'Estatus del lead (derivado de hechos)')}
              {o.l === 'Sin definir'
                ? <span title="Por dónde llegó" style={{ fontSize: '0.72rem', color: '#a5a2af' }}>origen sin definir</span>
                : chip(o.l, '#E3EDFD', '#2C5FC4', 'Por dónde llegó')}
              {/* La campaña ya vive en "De dónde llegó": repetirla aquí era ruido. */}
              {pausaActiva && c.retenido_razon ? chip(`pausa: ${c.retenido_razon}`, '#FFF4E5', '#9a6a10') : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* El mismo lugar en los dos modos: Editar se vuelve Guardar/Cancelar
                y nada se recorre. El commit es inequívoco. */}
            {!editando ? (<>
              <button style={D.btnA} onClick={() => setEditando(true)}>Editar</button>
              <button style={{ ...D.btnA, color: '#9a6a10', borderColor: '#f0dcb0' }} onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + 14);
                setAccion(accion === 'pausa' ? '' : 'pausa'); setPausaHasta(d.toISOString().slice(0, 10)); setPausaRazon('');
              }}>Pidió tiempo</button>
              {c.calificacion !== 'no_califica' && (
                <button style={{ ...D.btnA, color: '#C0554E', borderColor: '#f0c4bd' }} onClick={() => { setAccion(accion === 'descarte' ? '' : 'descarte'); setCatDesc(''); setMotivoDesc(''); }}>No le interesa</button>
              )}
            </>) : (<>
              {/* Mismo rincón en los dos modos; a media captura las acciones de
                  estatus no aplican y solo estorbarían. */}
              <button style={{ ...D.btnP, opacity: sucio ? 1 : .45 }} disabled={!sucio || guardando}
                onClick={async () => { await aplicar(); setEditando(false); }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
              <button style={D.btnA} onClick={() => { setF({}); setEditando(false); }}>Cancelar</button>
            </>)}
          </div>
        </div>

        {/* ── Acciones inline (sin modal sobre el cajón) ── */}
        {accion === 'pausa' && (
          <div style={{ ...separador, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div style={D.fl}>Volver a marcarle el</div><input type="date" style={{ ...D.fi, width: 160 }} value={pausaHasta} onChange={e => setPausaHasta(e.target.value)} /></div>
            <div style={{ flex: '1 1 200px' }}><div style={D.fl}>Razón</div><input style={D.fi} value={pausaRazon} onChange={e => setPausaRazon(e.target.value)} placeholder="ej. abre sucursal en octubre…" /></div>
            <button style={{ ...D.btnP, background: '#E8A838' }} onClick={async () => {
              if (await guardar({ retenido_hasta: pausaHasta + 'T12:00:00Z', retenido_razon: pausaRazon.trim() || null })) setAccion('');
            }}>Pausar</button>
            {c.retenido_hasta && <button style={D.btnA} onClick={async () => { if (await guardar({ retenido_hasta: null, retenido_razon: null })) setAccion(''); }}>Quitar pausa</button>}
          </div>
        )}
        {accion === 'descarte' && (
          <div style={{ ...separador, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><div style={D.fl}>¿Por qué?</div>
              <select style={{ ...selE, width: 210 }} value={catDesc} onChange={e => setCatDesc(e.target.value)}>
                <option value="">— elegir categoría —</option>
                {opciones('descarte_categoria', []).map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}><div style={D.fl}>Motivo</div><input style={D.fi} value={motivoDesc} onChange={e => setMotivoDesc(e.target.value)} placeholder="una frase basta…" /></div>
            <button style={{ ...D.btnP, background: '#EF7A72' }} onClick={async () => {
              if (await guardar({ calificacion: 'no_califica', calificacion_motivo: motivoDesc.trim() || null, calificacion_at: new Date().toISOString(), descarte_categoria: catDesc || 'otro', estatus_lead: 'descartado', estatus_lead_at: new Date().toISOString() })) setAccion('');
            }}>Confirmar descarte</button>
          </div>
        )}

        {/* ── La franja derivada: números que NO se capturan ── */}
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', ...separador }}>
          {dato('Llegó', fmtDate(llegoRealF), undefined, c.propiedades?.tiktok?.creado ? 'fecha real del anuncio' : undefined)}
          {dato('Último contacto', c.last_contact_at ? `hace ${sinC} d` : 'nunca', c.last_contact_at && sinC != null && sinC > 14 ? '#C0554E' : undefined)}
          {dato('Toques', toques || '—')}
          {dato('Reuniones', (c.bookings || []).length || '—')}
          {dato('Cotizaciones', (c.quotes || []).length || '—')}
          {c.lead_score ? dato('Señal web', `${c.lead_score}/100`, '#5B4BD6', c.page_count ? `${c.page_count} páginas vistas` : undefined) : null}
        </div>

        {/* ── Los datos, ESCRITOS (los inputs salen al Editar) ── */}
        {!editando ? (() => {
          // En móvil los campos en "—" se colapsan: pantalla para lo que SÍ hay.
          const pares: [string, any][] = [
            ['Teléfono', c.telefono], ['Puesto', c.rol || c.puesto], ['Empresa', c.companies?.nombre],
            ['Sucursales', c.sucursales_interes || c.companies?.sucursales], ['Giro', giroTxt],
            ['Sistema actual', etiqueta('sistema_actual', prop('sistema_actual'))],
            ['Urgencia', etiqueta('urgencia', prop('urgencia'))], ['Dueño', dueno],
          ];
          const vacios = pares.filter(x => !x[1]);
          const visibles = (esMovilC && !verVacios) ? pares.filter(x => x[1]) : pares;
          return (
          <div style={{ ...separador, ...rejilla }}>
            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>{leido('Correo', c.email, c.email && btnCopiar(c.email, 'email'))}</div>
            <div style={{ gridColumn: esMovilC ? 'span 2' : undefined, minWidth: 0 }}>{leido('WhatsApp', c.whatsapp, c.whatsapp && <>{btnCopiar(c.whatsapp, 'wa')}<a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" style={{ fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6', textDecoration: 'none', whiteSpace: 'nowrap' }}>abrir</a></>)}</div>
            {visibles.map(([l2, v2]) => <span key={l2}>{l2 === 'Teléfono' ? leido('Teléfono', c.telefono, c.telefono && btnCopiar(c.telefono, 'tel')) : leido(l2, v2)}</span>)}
            {esMovilC && vacios.length > 0 && (
              <button onClick={() => setVerVacios(x => !x)} style={{ gridColumn: 'span 2', border: 'none', background: 'none', padding: '6px 0', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
                {verVacios ? 'Ocultar campos vacíos' : `Mostrar campos vacíos (${vacios.length})`}
              </button>
            )}
          </div>
          );
        })() : (
          <div style={separador}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div><div style={D.fl}>Nombre</div><input style={D.fi} value={v('nombre')} onChange={e => set('nombre', e.target.value)} /></div>
              <div><div style={D.fl}>Apellido</div><input style={D.fi} value={v('apellido')} onChange={e => set('apellido', e.target.value)} /></div>
              <div><div style={D.fl}>Correo</div><input style={D.fi} value={v('email')} onChange={e => set('email', e.target.value)} /></div>
              <div><div style={D.fl}>WhatsApp</div><input style={D.fi} value={v('whatsapp')} onChange={e => set('whatsapp', e.target.value)} placeholder="— agregar" /></div>
              <div><div style={D.fl}>Teléfono</div><input style={D.fi} value={v('telefono')} onChange={e => set('telefono', e.target.value)} placeholder="— agregar" /></div>
              <div><div style={D.fl}>Puesto</div>
                <select style={selE} value={v('rol') || v('puesto') || ''} onChange={e => { set('rol', e.target.value); set('puesto', e.target.value); }}>
                  <option value="">— sin definir —</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><div style={D.fl}>Empresa</div><input style={D.fi} value={f.empresa !== undefined ? f.empresa : (c.companies?.nombre || '')} onChange={e => set('empresa', e.target.value)} placeholder="sin empresa" /></div>
              <div><div style={D.fl}>Sucursales</div><input style={D.fi} value={v('sucursales_interes')} onChange={e => set('sucursales_interes', e.target.value)} /></div>
              <div><div style={D.fl}>Giro</div>
                <select style={selE} value={prop('giro_negocio') || v('giro') || ''} onChange={e => { set('p_giro_negocio', e.target.value); set('giro', e.target.value); set('p_subgiro', ''); }}>
                  <option value="">— sin definir —</option>
                  {giros.giros.map((x: any) => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
              </div>
              {(giros.subs[prop('giro_negocio') || v('giro')] || []).length > 0 && (
                <div><div style={D.fl}>Subgiro</div>
                  <select style={selE} value={prop('subgiro')} onChange={e => set('p_subgiro', e.target.value)}>
                    <option value="">— sin definir —</option>
                    {(giros.subs[prop('giro_negocio') || v('giro')] || []).map((x: any) => <option key={x.v} value={x.v}>{x.l}</option>)}
                  </select>
                </div>
              )}
              {/* Los dos campos que CALIFICAN de verdad: qué usa hoy y para
                  cuándo quiere. Sus opciones viven en crm_campos_config (se
                  agregan más desde la tabla de Leads, ⚙ Configurar). */}
              <div><div style={D.fl}>Sistema actual</div>
                <select style={selE} value={prop('sistema_actual')} onChange={e => set('p_sistema_actual', e.target.value)}>
                  <option value="">— sin definir —</option>
                  {opciones('sistema_actual', []).map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
              </div>
              <div><div style={D.fl}>Urgencia</div>
                <select style={selE} value={prop('urgencia')} onChange={e => set('p_urgencia', e.target.value)}>
                  <option value="">— sin definir —</option>
                  {opciones('urgencia', []).map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
              </div>
              <div><div style={D.fl}>Dueño</div>
                <select style={selE} value={v('owner_id') || ''} onChange={e => set('owner_id', e.target.value)}>
                  <option value="">— sin dueño —</option>
                  {equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
            </div>
            <details style={separador}>
              <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: '0.74rem', fontWeight: 700, color: '#5B4BD6' }}>Corregir el origen</summary>
              <div style={{ marginTop: 10, maxWidth: 320 }}>
                <select style={selE} value={prop('origen_cuenta')} onChange={e => set('p_origen_cuenta', e.target.value)}>
                  <option value="">— sin definir —</option>
                  {GRUPOS_ORIGEN.map(g => (
                    <optgroup key={g} label={g}>
                      {ORIGENES.filter(x => x.grupo === g).map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </details>

          </div>
        )}
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

/* ═══ El riel de etapas ═══
 *
 * Eran ocho puntitos en fila con una etiqueta de 11 px debajo. Decían DÓNDE va
 * el lead y nada más; para saber por qué estaba en "Cotizado" había que salirse
 * a Cotizaciones, y para saber quién lo contactó, a Actividad.
 *
 * Ahora cada peldaño enseña el HECHO que lo movió y cuándo. Deja de ser una
 * barra de progreso y se vuelve el expediente: se lee de arriba abajo como la
 * historia del lead, que es como se cuenta en voz alta.
 */
function pruebaDeHito(k: Etapa, c: any): { cuando?: string | null; porque?: string | null } {
  const acts: any[] = c.activities || [];
  const books: any[] = c.bookings || [];
  const quotes: any[] = c.quotes || [];
  // El más VIEJO de cada clase: el peldaño lo movió el primero, no el último.
  const primero = (l: any[], f: (x: any) => boolean, fecha: (x: any) => any) =>
    l.filter(f).sort((a, b) => String(fecha(a)).localeCompare(String(fecha(b))))[0];

  switch (k) {
    case 'nuevo': {
      const o = origenDe(origenDeRegistro(c));
      return { cuando: c.created_at, porque: o?.l ? `Entró por ${o.l}` : 'Entró al CRM' };
    }
    case 'contactado': {
      const a = primero(acts, x => ['llamada', 'whatsapp_enviado', 'email_enviado'].includes(String(x.tipo)), x => x.created_at);
      if (a) return { cuando: a.created_at, porque: a.titulo || 'Primer toque' };
      // `last_contact_at` sin actividad detrás: alguien lo tocó antes de que
      // esto se registrara. Se dice así en vez de inventar el canal.
      return c.last_contact_at ? { cuando: c.last_contact_at, porque: 'Marcado como contactado' } : {};
    }
    case 'calificado':
      return c.calificacion === 'bueno' ? { cuando: c.calificacion_at, porque: 'Lo marcaste como «Bueno»' } : {};
    case 'agendado': {
      const b = primero(books, () => true, x => x.fecha);
      return b ? { cuando: b.fecha, porque: b.event_types?.nombre || b.asunto || 'Reunión agendada' } : {};
    }
    case 'demo_hecha': {
      const b = primero(books, x => normalizaEstado(x.estado) === 'asistio', x => x.fecha);
      return b ? { cuando: b.fecha, porque: `Se presentó · ${b.event_types?.nombre || b.asunto || 'reunión'}` } : {};
    }
    case 'cotizado': {
      const q = primero(quotes, () => true, x => x.created_at);
      return q ? { cuando: q.created_at, porque: `${q.numero} · $${Math.round(Number(q.total || 0)).toLocaleString('es-MX')}` } : {};
    }
    case 'negociando':
      return c.etapa_manual === 'negociando' ? { porque: 'Lo marcaste a mano' } : {};
    case 'cliente':
      return c.lifecycle_stage === 'cliente' ? { porque: 'Ya paga' } : {};
    default: return {};
  }
}

function RielEtapas({ c, evaluacion, ruta, sinContacto }: any) {
  const idx = ruta.indexOf(evaluacion?.etapa as Etapa);
  const perdido = evaluacion?.etapa === 'perdido';
  // El peldaño "ahora" es el SIGUIENTE al de la etapa actual.
  //
  // Se marcaba con la etapa misma, y la etapa deducida ES el último hito
  // cumplido: las dos condiciones no coinciden nunca, así que nadie quedaba en
  // "ahora" y la línea de qué falta —la única de la ficha que dice qué hacer—
  // desaparecía justo después de trabajar el lead.
  //
  // Y tampoco es "el primer peldaño pendiente": un lead que se saltó la demo y
  // ya está cotizado tiene "Calificado" pendiente, y ahí la frase quedaba
  // contando lo que toca hacer con una cotización. Lo que sigue es lo que sigue
  // a donde está.
  const idxAhora = idx >= 0 ? idx + 1 : -1;
  return (
    <div style={D.cardA}>
      <div style={D.h}>
        Por dónde va
        <span style={D.hr}>
          se mueve sola con los hechos · llegó hace {dias(c.created_at)} días{sinContacto != null ? ` · ${sinContacto} sin contacto` : ''}
        </span>
      </div>
      <div style={{ position: 'relative', paddingLeft: 30 }}>
        <span style={{ position: 'absolute', left: 9, top: 6, bottom: 12, width: 2, background: '#efedf5' }} />
        {ruta.map((k: Etapa, i: number) => {
          const paso = !!evaluacion?.hitos?.[k];
          const est = perdido ? 'off' : paso ? 'ok' : i === idxAhora ? 'now' : i < idx ? 'saltado' : 'off';
          const { cuando, porque } = paso ? pruebaDeHito(k, c) : {};
          // El peldaño que un humano adelantó se marca: así se distingue lo que
          // pasó de lo que alguien dijo que pasó.
          const aMano = evaluacion?.manual === k && evaluacion?.porHechos !== k;
          const esUltimo = i === ruta.length - 1;
          return (
            <div key={k} style={{ position: 'relative', paddingBottom: esUltimo ? 0 : 15 }}>
              <div style={{
                position: 'absolute', left: -30, top: 1, width: 20, height: 20, borderRadius: 99,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800,
                background: est === 'ok' ? '#4FBF95' : '#fff',
                border: est === 'saltado' ? '2px dashed #ded9ea' : `2px solid ${est === 'ok' ? '#4FBF95' : est === 'now' ? '#9B8CFA' : '#e8e5f0'}`,
                color: est === 'ok' ? '#fff' : est === 'now' ? '#5B4BD6' : '#c4bfd4',
                boxShadow: est === 'now' ? '0 0 0 4px rgba(155,140,250,.16)' : 'none',
              }}>{est === 'ok' ? '✓' : i + 1}</div>
              {cuando && <span style={{ float: 'right', fontSize: '0.7rem', color: '#b6b2c2', fontWeight: 600 }}>{fmtDate(cuando)}</span>}
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: est === 'ok' ? '#241d43' : est === 'now' ? '#5B4BD6' : '#c0bccd' }}>
                {ETAPA_LABEL[k]}
                {aMano && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#b3afbd', marginLeft: 7 }}>a mano</span>}
                {est === 'saltado' && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#c9c4dc', marginLeft: 7 }}>se saltó</span>}
              </div>
              {/* En el peldaño ACTUAL no va el hecho —todavía no hay— sino lo
                  que falta para el siguiente. Es la única línea de la ficha que
                  dice qué hacer. */}
              {est === 'now' && evaluacion?.etapa && pasoDeEtapa(evaluacion.etapa) && (
                <div style={{ fontSize: '0.76rem', color: '#5B4BD6', opacity: .85, marginTop: 2, lineHeight: 1.5 }}>{pasoDeEtapa(evaluacion.etapa)}</div>
              )}
              {est !== 'now' && porque && <div style={{ fontSize: '0.76rem', color: '#8a8a8a', marginTop: 2 }}>{porque}</div>}
            </div>
          );
        })}
      </div>
      {perdido && (
        <div style={{ marginTop: 12, background: '#FBECEA', border: '1px solid #C0554E33', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#C0554E' }}>
          Cerrado{c.desenlace ? ` · ${c.desenlace}` : ''}{c.calificacion_motivo ? ` · ${c.calificacion_motivo}` : ''}
        </div>
      )}
    </div>
  );
}

/* ═══ Registrar un toque ═══
 *
 * Era una pastilla de tipo, una caja de texto y un botón. No guardaba lo único
 * que importa de una llamada: si contestaron. Marcarle cuatro veces y que
 * siempre mande a buzón se veía IGUAL que hablar cuatro veces con el dueño,
 * porque las dos cosas eran "llamada" con una nota escrita a mano — y esa nota
 * no se puede contar ni filtrar.
 *
 * Ahora se captura canal, cuándo, resultado y nota (opcional). El resultado es
 * lo que convierte el historial en un dato: "le marqué 3 veces, 2 a buzón".
 */
function RegistrarToque({ c, recargar, flash }: any) {
  const [canal, setCanal] = useState<Canal>('llamada');
  const [resultado, setResultado] = useState('');
  const [cuando, setCuando] = useState(() => {
    // Local, no UTC: `toISOString` en México adelanta seis horas y una llamada
    // de las 8 de la noche se guardaba al día siguiente.
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  });
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);

  const opciones = RESULTADOS[canal] || [];
  const r = resultadoDe(canal, resultado);

  // Cuántas veces se le ha marcado y cómo acabó cada vez. Es el dato que
  // convierte "no contesta" en una decisión: a la quinta, ya no es el horario.
  const intentos = useMemo(() => {
    const tipo = tipoActividad(canal);
    const l = (c.activities || []).filter((a: any) => a.tipo === tipo);
    const porResultado: Record<string, number> = {};
    for (const a of l) {
      const v = a.metadata?.resultado;
      if (v) porResultado[v] = (porResultado[v] || 0) + 1;
    }
    return { total: l.length, porResultado, ultima: l[0]?.metadata?.ocurrio_at || l[0]?.created_at || null };
  }, [c.activities, canal]);

  async function registrar() {
    if (!resultado) return;
    setBusy(true);
    const ocurrio = new Date(cuando).toISOString();
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: c.id, company_id: c.company_id,
        // El tipo canónico, el que SÍ cuenta como toque. La ficha guardaba
        // `whatsapp` y `email`, que no los cuenta nadie: registrar un WhatsApp
        // no movía la etapa ni subía el contador de esfuerzo.
        tipo: tipoActividad(canal),
        titulo: tituloToque(canal, resultado),
        descripcion: nota || null,
        metadata: { canal, resultado, ocurrio_at: ocurrio, hablamos: !!r?.hablamos },
      }),
    }).catch(() => {});
    // Registrar un toque ES contactarlo: si no se apunta, el lead aparece "sin
    // seguimiento" al día siguiente de haberle marcado. Cuenta el intento, haya
    // contestado o no — el esfuerzo se hizo.
    await fetch('/api/crm/contacts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, last_contact_at: ocurrio }),
    }).catch(() => {});
    setBusy(false); setNota(''); setResultado('');
    flash(r?.hablamos ? 'Contacto registrado' : 'Intento registrado');
    recargar();
  }

  const pastilla = (act: boolean, color = '#9B8CFA'): any => ({
    border: '1.5px solid', borderColor: act ? color : '#e2e2e8',
    background: act ? color : '#fff', color: act ? '#fff' : '#3f3b4d',
    borderRadius: 10, padding: '7px 13px', fontSize: '0.77rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  });

  return (
    <div style={D.cardM}>
      <div style={D.h}>Registrar contacto<span style={D.hr}>lo que pasó, no solo que pasó</span></div>

      <div style={D.fl}>Cómo lo contactaste</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CANALES.map(x => (
          <button key={x.v} onClick={() => { setCanal(x.v); setResultado(''); }} style={pastilla(canal === x.v)}>{x.l}</button>
        ))}
      </div>

      {/* El contador va aquí y no al final: antes de apuntar la quinta llamada,
          saber que ya van cuatro a buzón cambia lo que haces. */}
      {intentos.total > 0 && (
        <div style={{ marginTop: 10, background: '#f8f7fc', borderRadius: 9, padding: '8px 11px', fontSize: '0.75rem', color: '#6b6b74', lineHeight: 1.5 }}>
          <b style={{ color: '#241d43' }}>
            {CANALES.find(x => x.v === canal)?.verbo} {intentos.total} {intentos.total === 1 ? 'vez' : 'veces'}
          </b>
          {Object.keys(intentos.porResultado).length > 0 && (
            <> · {Object.entries(intentos.porResultado)
              .map(([v, n]) => `${n} ${(resultadoDe(canal, v)?.l || v).toLowerCase()}`).join(' · ')}</>
          )}
          {intentos.ultima ? <> · la última hace {dias(intentos.ultima)} días</> : null}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, marginTop: 12, alignItems: 'start' }}>
        <div>
          <div style={D.fl}>Cuándo fue</div>
          <input type="datetime-local" style={D.fi} value={cuando} onChange={e => setCuando(e.target.value)} />
        </div>
        <div>
          <div style={D.fl}>Qué pasó <span style={{ color: '#C0554E' }}>· obligatorio</span></div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {opciones.map(o => (
              <button key={o.v} onClick={() => setResultado(o.v)}
                style={pastilla(resultado === o.v, o.hablamos ? '#4FBF95' : o.malDato ? '#EF7A72' : '#E8A838')}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* El dato malo no es desinterés: el lead está muerto por el teléfono, y
          eso se arregla buscando otro, no insistiendo. */}
      {r?.malDato && (
        <div style={{ marginTop: 10, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 12px', fontSize: '0.76rem', color: '#C0554E', lineHeight: 1.5 }}>
          Con el dato malo no hay por dónde. Búscale otro teléfono o correo antes de seguir insistiendo — o márcalo como «No califica» en la evaluación.
        </div>
      )}

      <div style={{ marginTop: 11 }}>
        <div style={D.fl}>Notas <span style={{ color: '#b3b1bb' }}>· opcional</span></div>
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
          placeholder="Se le marcó dos veces y mandó directo a buzón…"
          style={{ ...D.fi, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 11, alignItems: 'center' }}>
        <button style={{ ...D.btnP, opacity: busy || !resultado ? .5 : 1 }} disabled={busy || !resultado} onClick={registrar}>
          {busy ? 'Guardando…' : 'Registrar'}
        </button>
        {!resultado && <span style={{ fontSize: '0.72rem', color: '#b3b1bb' }}>Falta decir qué pasó.</span>}
      </div>
    </div>
  );
}

/* ═══ Todo lo que ha pasado ═══
 *
 * Una sola línea de tiempo. Eran dos, en dos pestañas: la que escribe una
 * persona (Actividad) y la que se escribe sola (las visitas y clics de
 * Señales). Ninguna de las dos contestaba por separado la pregunta de antes de
 * llamar —¿quién movió la última ficha, él o yo?— porque para eso hay que ver
 * las dos en el mismo orden.
 */
function LineaDeTiempo({ c }: any) {
  const eventos = useMemo(() => {
    const l = (c.activities || []).filter((a: any) => !esRuido(a));
    return l.map((a: any) => ({
      id: a.id,
      quien: quienLoHizo(a),
      titulo: a.titulo || a.tipo,
      detalle: a.descripcion || null,
      // `ocurrio_at` es cuándo pasó de verdad; `created_at`, cuándo se apuntó.
      // Una llamada del lunes registrada el jueves va el lunes.
      cuando: a.metadata?.ocurrio_at || a.created_at,
    })).sort((x: any, y: any) => String(y.cuando).localeCompare(String(x.cuando)));
  }, [c.activities]);

  const marca = (quien: string) => ({
    width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800,
    background: quien === 'el' ? '#E3EDFD' : '#EEECFE', color: quien === 'el' ? '#2C5FC4' : '#5B4BD6',
  });

  let diaAnterior = '';
  return (
    <div style={D.cardA}>
      <div style={D.h}>Todo lo que ha pasado<span style={D.hr}>lo tuyo y lo suyo, en una sola línea</span></div>
      {eventos.length === 0 && <div style={{ fontSize: '0.79rem', color: '#a5a2af' }}>Todavía no hay nada registrado.</div>}
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {eventos.map((e: any) => {
          const dia = fmtLargo(e.cuando);
          const nuevoDia = dia !== diaAnterior;
          diaAnterior = dia;
          return (
            <div key={e.id}>
              {nuevoDia && (
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#b6b2c2', letterSpacing: '.06em', textTransform: 'uppercase', padding: '11px 0 3px' }}>{dia}</div>
              )}
              <div style={{ display: 'flex', gap: 11, padding: '7px 0', alignItems: 'flex-start' }}>
                <span style={marca(e.quien)}>{e.quien === 'el' ? 'ÉL' : 'TÚ'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{e.titulo}</div>
                  {e.detalle && <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 1, lineHeight: 1.5 }}>{e.detalle}</div>}
                </div>
                <span style={{ fontSize: '0.69rem', color: '#b6b2c2', whiteSpace: 'nowrap' }}>
                  {new Date(e.cuando).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {eventos.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.72rem', color: '#8a8a8a', marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8' }}>
          <span><span style={{ ...marca('tu'), display: 'inline-flex', width: 19, height: 19, marginRight: 6, verticalAlign: '-4px' }}>TÚ</span>lo que hiciste tú</span>
          <span><span style={{ ...marca('el'), display: 'inline-flex', width: 19, height: 19, marginRight: 6, verticalAlign: '-4px' }}>ÉL</span>lo que hizo él solo</span>
        </div>
      )}
    </div>
  );
}

/* Un renglón de la lista de reuniones del lead.
 *
 * Antes solo pintaba el estado. El problema es que la reunión de un lead casi
 * siempre se marca DESPUÉS —nadie abre el CRM mientras está en la llamada—, y
 * sin poder marcarla aquí no había manera de llegar a la minuta.
 *
 * En cuanto se marca "se presentó" aparece el botón de levantar la minuta:
 * es el momento en que la persona todavía se acuerda de qué se habló. */
function RenglonReunion({ b, onMinuta, onCambio }: any) {
  const [guardando, setGuardando] = useState(false);
  const e = normalizaEstado(b.estado);
  const esFutura = String(b.fecha || '') > new Date().toISOString().slice(0, 10);
  const tieneMinuta = minutaLlena(b.minuta);

  async function marcar(nuevo: string) {
    setGuardando(true);
    try {
      await fetch('/api/scheduling/reuniones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, estado: nuevo }),
      });
      await onCambio?.();
    } finally { setGuardando(false); }
  }

  return (
    <div style={{ display: 'flex', gap: 11, padding: '11px 0', borderTop: '1px solid #f5f4f8', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{b.asunto || b.event_types?.nombre || 'Reunión'}</div>
        <div style={{ fontSize: '0.7rem', color: '#a5a2af' }}>
          {fmtLargo(b.fecha)} · {String(b.hora_inicio || '').slice(0, 5)}{b.event_types?.nombre ? ` · ${b.event_types.nombre}` : ''}
        </div>
        {tieneMinuta && Array.isArray(b.minuta?.requerimientos) && b.minuta.requerimientos.length > 0 && (
          <div style={{ fontSize: '0.69rem', color: '#5B4BD6', fontWeight: 700, marginTop: 5 }}>
            {b.minuta.requerimientos.filter((r: any) => r.incluir).length} concepto(s) para cotizar
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={D.chip(e === 'asistio' ? '#EAF8F2' : e === 'no_asistio' ? '#FEF0EF' : '#f4f4f6',
                            e === 'asistio' ? '#1E8A63' : e === 'no_asistio' ? '#C0554E' : '#6B7280')}>
          {e === 'asistio' ? 'se presentó' : e === 'no_asistio' ? 'no se presentó' : e}
        </span>
        {/* Sin marcar y ya pasó: es el caso normal, por eso los dos botones
            están a la mano y no escondidos en un menú. */}
        {!esFutura && (e === 'agendada' || e === 'confirmada') && (
          <>
            <button style={{ ...D.btnA, padding: '5px 10px', fontSize: '0.7rem', opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => marcar('asistio')}>Sí llegó</button>
            <button style={{ ...D.btnG, padding: '5px 10px', fontSize: '0.7rem', opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => marcar('no_asistio')}>No llegó</button>
          </>
        )}
        {e === 'asistio' && !tieneMinuta && (
          <button style={{ ...D.btnP, padding: '5px 11px', fontSize: '0.7rem' }} onClick={onMinuta}>Levantar minuta</button>
        )}
        {tieneMinuta && (
          <button style={{ ...D.btnA, padding: '5px 11px', fontSize: '0.7rem' }} onClick={onMinuta}>Ver minuta</button>
        )}
      </div>
    </div>
  );
}
