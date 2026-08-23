// WHATSAPP · Panel 360: TODA la data del cliente/lead que ya vive en el CRM,
// colapsada por secciones para dar seguimiento sin salir del chat.
//
// La fuente son los endpoints que ya existen — company360 cuando hay empresa
// (ARR/MRR, suscripciones, cotizaciones, reuniones, timeline) y contacts/[id]
// cuando hay contacto (ficha + oportunidades). Aquí no se inventan datos:
// se leen los del CRM y lo editable (email, puesto, etapa, seguimiento) se
// guarda con el MISMO PUT que usa la sección Leads.
import { useEffect, useRef, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { LIFECYCLE, lifecycleDe } from '../../../../lib/crm/lifecycle';
import Etiquetas from '../Etiquetas';
import ClienteDrawer360 from '../ClienteDrawer360';
import { Avatar } from './ListaConversaciones';
import { Corazones } from '../ui/Cargando';

const L: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 3 };
const V: React.CSSProperties = { fontSize: '0.8rem', color: '#1a1a1a', lineHeight: 1.5 };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '7px 10px', fontSize: '0.78rem', fontFamily: 'inherit', background: '#fdfcff' };
const btnP: React.CSSProperties = { border: 'none', borderRadius: 9, padding: '8px 14px', background: '#9B8CFA', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnA: React.CSSProperties = { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '7px 12px', background: '#fff', fontSize: '0.73rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' };
const tag = (bg: string, fg: string): React.CSSProperties => ({ fontSize: '0.57rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' });

const money = (n: any) => (n || n === 0) ? `$${Math.round(Number(n)).toLocaleString('es-MX')}` : '—';
const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Acordeón con memoria (localStorage): cada quien deja abierto lo suyo ──
const LS_KEY = 'wa_panel_secciones';
function leerAbiertas(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function Seccion({ id, titulo, n, abiertaDefault, children }: {
  id: string; titulo: string; n?: number | null; abiertaDefault?: boolean; children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<boolean>(() => {
    const m = leerAbiertas();
    return id in m ? m[id] : !!abiertaDefault;
  });
  const toggle = () => {
    const v = !abierta; setAbierta(v);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ...leerAbiertas(), [id]: v })); } catch { /* modo privado */ }
  };
  return (
    <div style={{ borderBottom: '1px solid #f5f4f8' }}>
      <button onClick={toggle} aria-expanded={abierta}
        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 16px' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#8a8a92', textTransform: 'uppercase', letterSpacing: '.06em' }}>{titulo}</span>
        {n != null && n > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#EEECFE', color: '#5B4BD6', borderRadius: 20, padding: '1px 7px' }}>{n}</span>}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="m5 9 7 7 7-7" stroke="#a5a2af" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierta && <div style={{ padding: '0 16px 13px' }}>{children}</div>}
    </div>
  );
}

/** Campo editable inline: texto que al clic se vuelve input y guarda al salir. */
function Editable({ valor, placeholder, onGuardar, type = 'text' }: {
  valor?: string | null; placeholder: string; onGuardar: (v: string) => void; type?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor || '');
  useEffect(() => { setV(valor || ''); }, [valor]);
  if (!editando) {
    return (
      <button onClick={() => setEditando(true)} title="Editar"
        style={{ ...V, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', color: valor ? '#1a1a1a' : '#b3b1bb' }}>
        {type === 'date' && valor ? fecha(valor) : (valor || placeholder)}
      </button>
    );
  }
  return (
    <input autoFocus style={inp} value={v} type={type}
      onChange={e => setV(e.target.value)}
      onBlur={() => { setEditando(false); if (v !== (valor || '')) onGuardar(v); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(valor || ''); setEditando(false); } }} />
  );
}

const ESTADO_SUB: Record<string, [string, string]> = {
  activa: ['#EAF8F2', '#1E8A63'], pausada: ['#FFF6E3', '#9A6B15'], cancelada: ['#FEF0EF', '#C0554E'],
};

export default function PanelDetalle({ hilo, api }: { hilo: any; api: any }) {
  const conv = hilo.conversacion;
  const contactoBase = conv?.contacts || null;
  const [ficha, setFicha] = useState(false);
  const [alta, setAlta] = useState<{ empresa: string; contacto: string; email: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  // La data 360 del CRM: company360 si hay empresa; contacts/[id] si hay contacto.
  const [d360, setD360] = useState<any>(null);
  const [dCon, setDCon] = useState<any>(null);
  const cacheId = useRef<string | null>(null);

  useEffect(() => {
    if (!conv?.id || cacheId.current === conv.id) return;
    cacheId.current = conv.id; setD360(null); setDCon(null);
    if (conv.company_id) {
      fetch(`/api/crm/arr/company360?id=${conv.company_id}`).then(r => r.json()).then(setD360).catch(() => {});
    }
    if (conv.contact_id) {
      fetch(`/api/crm/contacts/${conv.contact_id}`).then(r => r.json()).then(setDCon).catch(() => {});
    }
  }, [conv?.id, conv?.company_id, conv?.contact_id]);

  const contacto = dCon?.contact || dCon || contactoBase;   // contacts/[id] puede envolver o no
  const empresa = d360?.company || conv?.companies || null;
  const nombre = contactoBase ? `${contactoBase.nombre || ''} ${contactoBase.apellido || ''}`.trim() : null;
  const etapa = lifecycleDe(contactoBase?.lifecycle_stage);

  const subs: any[] = (d360?.subscriptions || []).filter(Boolean);
  const deals: any[] = (dCon?.deals || []).filter((d: any) => !['ganado', 'perdido', 'won', 'lost'].includes(String(d.stage || d.etapa || '').toLowerCase()));
  const quotes: any[] = (d360?.quotes || dCon?.quotes || []).slice(0, 5);
  const bookings: any[] = (d360?.bookings || dCon?.bookings || []);
  const proxima = bookings.filter(b => new Date(b.fecha) >= new Date(Date.now() - 86400000))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] || null;
  const pasadas = bookings.filter(b => b !== proxima).slice(-3).reverse();
  const timeline: any[] = (d360?.timeline || dCon?.activities || []).slice(0, 8);
  const resumen = d360?.resumen || null;

  const crear = async () => {
    if (!alta?.empresa.trim()) { setMsg('El nombre de la empresa es obligatorio.'); return; }
    setOcupado(true); setMsg('');
    const r = await api.crearContacto({ empresa: alta.empresa.trim(), contacto: alta.contacto.trim(), email: alta.email.trim() || undefined });
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setAlta(null); cacheId.current = null;
  };
  const guardar = (campo: string) => (v: string) => {
    if (contactoBase?.id) api.guardarContacto(contactoBase.id, { [campo]: v || null });
  };

  return (
    <div>
      {/* ── Identidad (fija) ── */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f5f4f8' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <Avatar nombre={nombre} telefono={conv.telefono} size={46} />
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: '0.95rem', display: 'block', letterSpacing: '-.01em' }}>{nombre || 'Número desconocido'}</b>
            <span style={{ fontSize: '0.72rem', color: '#8a8a92' }}>{telefonoLegible(conv.telefono)}</span>
            {etapa && <span style={{ ...tag(etapa.bg, etapa.fg), marginLeft: 7, display: 'inline-block' }}>{etapa.label}</span>}
          </div>
        </div>
        {(empresa || contactoBase) && (
          <div style={{ marginTop: 10 }}>
            <Etiquetas entidad={empresa ? 'company' : 'contact'} id={empresa?.id || contactoBase?.id} compacto />
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <label style={L}>Etiquetas de la conversación</label>
          <Etiquetas entidad="wa_conversacion" id={conv.id} compacto />
        </div>
        {contacto?.wa_optout && (
          <div style={{ marginTop: 8 }}>
            <span style={tag('#FEF0EF', '#C0554E')}>Pidió no recibir marketing</span>
          </div>
        )}
      </div>

      {/* ── Desconocido: alta mínima ── */}
      {!contactoBase && !empresa && (
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f5f4f8' }}>
          {!alta ? (
            <>
              <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: '#8a8a92', lineHeight: 1.55 }}>
                Este número no está en el CRM. Créalo como lead para ligarle la conversación, el historial y el seguimiento.
              </p>
              <button style={btnP} onClick={() => setAlta({ empresa: '', contacto: '', email: '' })}>Crear contacto</button>
            </>
          ) : (
            <>
              <label style={L}>Empresa *</label>
              <input style={inp} value={alta.empresa} onChange={e => setAlta({ ...alta, empresa: e.target.value })} />
              <label style={{ ...L, marginTop: 9 }}>Nombre del contacto</label>
              <input style={inp} value={alta.contacto} onChange={e => setAlta({ ...alta, contacto: e.target.value })} />
              <label style={{ ...L, marginTop: 9 }}>Email</label>
              <input style={inp} value={alta.email} onChange={e => setAlta({ ...alta, email: e.target.value })} />
              {msg && <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#C0554E' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                <button style={btnP} disabled={ocupado} onClick={crear}>{ocupado ? <Corazones size={9} color="#fff" /> : 'Crear y ligar'}</button>
                <button style={{ ...btnA, borderColor: '#e2e4e9', color: '#555' }} onClick={() => setAlta(null)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Contacto ── */}
      {contactoBase && (
        <Seccion id="contacto" titulo="Contacto" abiertaDefault>
          <label style={L}>Email</label>
          <Editable valor={contacto?.email || contactoBase.email} placeholder="Agregar email" onGuardar={guardar('email')} />
          <label style={{ ...L, marginTop: 9 }}>Puesto</label>
          <Editable valor={contacto?.puesto} placeholder="Agregar puesto" onGuardar={guardar('puesto')} />
          <label style={{ ...L, marginTop: 9 }}>Etapa del ciclo de vida</label>
          <select value={contactoBase.lifecycle_stage || ''}
            onChange={e => api.guardarContacto(contactoBase.id, { lifecycle_stage: e.target.value || null })}
            style={{ ...inp, cursor: 'pointer' }}>
            <option value="">Sin etapa</option>
            {LIFECYCLE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Seccion>
      )}

      {/* ── Empresa ── */}
      {empresa && (
        <Seccion id="empresa" titulo="Empresa" abiertaDefault>
          <div style={{ ...V, fontWeight: 700 }}>{empresa.nombre_comercial || empresa.nombre}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 12px', marginTop: 9 }}>
            <div><label style={L}>Plan</label><div style={V}>{empresa.plan || '—'}</div></div>
            <div><label style={L}>Estado</label><div style={V}>{empresa.estado_cuenta || '—'}</div></div>
            <div><label style={L}>MRR</label><div style={{ ...V, color: '#1E8A63', fontWeight: 800 }}>{money(resumen?.mrr ?? empresa.mrr)}</div></div>
            <div><label style={L}>ARR</label><div style={{ ...V, color: '#1E8A63', fontWeight: 800 }}>{money(resumen?.arr ?? empresa.arr)}</div></div>
            <div><label style={L}>Sucursales</label><div style={V}>{empresa.sucursales ?? '—'}</div></div>
            <div><label style={L}>Giro</label><div style={V}>{empresa.giro || '—'}</div></div>
            {empresa.sacs_account && <div style={{ gridColumn: '1 / -1' }}><label style={L}>Cuenta SACS</label><div style={V}>{empresa.sacs_account}</div></div>}
          </div>
        </Seccion>
      )}

      {/* ── Suscripciones ── */}
      {empresa && (
        <Seccion id="subs" titulo="Suscripciones" n={subs.length}>
          {!subs.length && <div style={{ fontSize: '0.73rem', color: '#b3b1bb' }}>Sin suscripciones.</div>}
          {subs.map((su: any) => {
            const [bg, fg] = ESTADO_SUB[su.estado] || ['#f4f4f6', '#6B7280'];
            return (
              <div key={su.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', fontSize: '0.76rem' }}>
                <b>{su.nombre_plan}</b>
                <span style={tag(bg, fg)}>{su.estado}</span>
                <span style={{ marginLeft: 'auto', color: '#1E8A63', fontWeight: 700 }}>{money(su.precio)}<span style={{ color: '#a5a2af', fontWeight: 500 }}>/{su.ciclo === 'anual' ? 'año' : 'mes'}</span></span>
              </div>
            );
          })}
        </Seccion>
      )}

      {/* ── Oportunidades ── */}
      {contactoBase && (
        <Seccion id="deals" titulo="Oportunidades" n={deals.length}>
          {!deals.length && <div style={{ fontSize: '0.73rem', color: '#b3b1bb' }}>Sin oportunidades abiertas.</div>}
          {deals.slice(0, 5).map((d: any) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', fontSize: '0.76rem' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre || d.title || 'Oportunidad'}</span>
              {(d.pipeline_stage || d.stage) && <span style={tag('#E3EDFD', '#2C5FC4')}>{d.pipeline_stage || d.stage}</span>}
              <span style={{ color: '#1E8A63', fontWeight: 700 }}>{money(d.monto ?? d.amount)}</span>
            </div>
          ))}
        </Seccion>
      )}

      {/* ── Cotizaciones ── */}
      {(quotes.length > 0) && (
        <Seccion id="quotes" titulo="Cotizaciones" n={quotes.length}>
          {quotes.map((q: any) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', fontSize: '0.76rem' }}>
              <span>{q.numero || q.id?.slice(0, 6)}</span>
              {q.estado && <span style={tag(q.estado === 'aceptada' ? '#EAF8F2' : '#f4f4f6', q.estado === 'aceptada' ? '#1E8A63' : '#6B7280')}>{q.estado}</span>}
              <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{money(q.total)}</span>
            </div>
          ))}
        </Seccion>
      )}

      {/* ── Reuniones ── */}
      {(contactoBase || empresa) && (
        <Seccion id="reuniones" titulo="Reuniones" n={bookings.length}>
          {proxima ? (
            <div style={{ background: '#EEECFE', borderRadius: 9, padding: '8px 11px', fontSize: '0.76rem', marginBottom: 7 }}>
              <b style={{ color: '#5B4BD6' }}>Próxima:</b> {fecha(proxima.fecha)} {proxima.hora_inicio ? `· ${proxima.hora_inicio}` : ''}
              <div style={{ color: '#555' }}>{proxima.asunto || proxima.event_types?.nombre || 'Reunión'}</div>
            </div>
          ) : <div style={{ fontSize: '0.73rem', color: '#b3b1bb', marginBottom: 5 }}>Sin reunión agendada.</div>}
          {pasadas.map((b: any) => (
            <div key={b.id} style={{ display: 'flex', gap: 7, padding: '3px 0', fontSize: '0.73rem', color: '#666' }}>
              <span>{fecha(b.fecha)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.asunto || b.event_types?.nombre || 'Reunión'}</span>
              {b.estado && <span style={{ color: '#a5a2af' }}>{b.estado}</span>}
            </div>
          ))}
        </Seccion>
      )}

      {/* ── Actividad reciente ── */}
      {timeline.length > 0 && (
        <Seccion id="actividad" titulo="Actividad reciente">
          {timeline.map((t: any, i: number) => (
            <div key={t.id || i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '0.73rem', lineHeight: 1.45 }}>
              <span style={{ color: '#a5a2af', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fecha(t.fecha || t.created_at)}</span>
              <span style={{ minWidth: 0, color: '#555' }}>{t.titulo}</span>
            </div>
          ))}
        </Seccion>
      )}

      {/* ── Seguimiento ── */}
      {contactoBase && (
        <Seccion id="seguimiento" titulo="Seguimiento" abiertaDefault>
          <label style={L}>Próximo paso</label>
          <Editable valor={contacto?.proximo_paso} placeholder="¿Qué sigue con esta persona?" onGuardar={guardar('proximo_paso')} />
          <label style={{ ...L, marginTop: 9 }}>Siguiente seguimiento</label>
          <Editable valor={contacto?.next_followup ? String(contacto.next_followup).slice(0, 10) : ''} type="date" placeholder="Agendar fecha" onGuardar={guardar('next_followup')} />
          {(hilo.notas || []).length > 0 && (<>
            <label style={{ ...L, marginTop: 10 }}>Notas de esta conversación</label>
            {(hilo.notas || []).slice(-3).map((n: any) => (
              <div key={n.id} style={{ background: '#FFF6E3', borderRadius: 8, padding: '6px 9px', fontSize: '0.72rem', color: '#7a5a15', marginBottom: 5, lineHeight: 1.45 }}>
                {n.texto}
              </div>
            ))}
          </>)}
        </Seccion>
      )}

      {/* ── Acciones (fijas al pie) ── */}
      {(empresa || contactoBase) && (
        <div style={{ padding: '13px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {empresa && <button style={btnA} onClick={() => setFicha(true)}>Ficha completa</button>}
          {empresa && (
            <a href={`/admin/crm?tab=clientes`} style={{ ...btnA, textDecoration: 'none', display: 'inline-block' }}>Ver en Clientes</a>
          )}
        </div>
      )}

      {ficha && empresa && (
        <ClienteDrawer360 companyId={empresa.id} onClose={() => setFicha(false)} onChanged={() => {}} />
      )}
    </div>
  );
}
