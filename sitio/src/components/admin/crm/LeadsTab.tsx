// Leads: quién llegó, por dónde y qué falta para convertirlo.
//
// Abre en LISTA y no en el tablero. Con cuarenta leads apilados en una sola
// columna, el kanban es una torre que hay que recorrer para leer cuatro datos;
// el pipeline queda como segunda vista, para cuando de verdad se está moviendo
// gente de etapa.
import { useEffect, useMemo, useState } from 'react';
import PipelineTab from './PipelineTab';
import LeadDrawer from './LeadDrawer';
import { ORIGENES, GRUPOS_ORIGEN, origenDe, origenDeRegistro } from '../../../lib/crm/origenes';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(p).replace(/\D/g, '') : '';

const ETAPAS: Record<string, { l: string; bg: string; fg: string }> = {
  lead: { l: 'Nuevo', bg: '#f4f4f6', fg: '#6B7280' },
  lead_calificado: { l: 'Calificado', bg: '#EEECFE', fg: '#5B4BD6' },
  oportunidad: { l: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  cliente: { l: 'Cliente', bg: '#EAF8F2', fg: '#1E8A63' },
  churned: { l: 'Perdido', bg: '#FEF0EF', fg: '#C0554E' },
};

const S = {
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 24 } as const,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '16px 18px', marginBottom: 14 } as const,
  kl: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.06em' } as const,
  kv: { fontSize: '1.75rem', fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', lineHeight: 1 } as const,
  ks: { fontSize: '0.7rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.45 } as const,
  ke: { fontSize: '0.66rem', color: '#b3b1bb', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f5f4f8', lineHeight: 1.4 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 } as const,
  th: { fontSize: '0.56rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase' as const, letterSpacing: '.07em', textAlign: 'left' as const, padding: '8px 10px', borderBottom: '1px solid #f0eff3' } as const,
  td: { padding: '11px 10px', fontSize: '0.79rem', borderBottom: '1px solid #f7f6fa', verticalAlign: 'middle' as const } as const,
  chip: (on: boolean) => ({
    border: '1px solid', borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? '#f7f4ff' : '#fff',
    color: on ? '#5B4BD6' : '#555', borderRadius: 9, padding: '7px 12px', fontSize: '0.77rem',
    fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit',
  }) as const,
  ico: { width: 34, height: 34, border: '1px solid #e2e4e9', borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8a92', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' } as const,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnA: { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' } as const,
  mini: { border: '1px solid #e2e4e9', borderRadius: 7, padding: '3px 8px', fontSize: '0.67rem', fontWeight: 700, color: '#555', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  tag: (bg: string, fg: string) => ({ fontSize: '0.57rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const }) as const,
};

export default function LeadsTab() {
  const [vista, setVista] = useState<'lista' | 'pipeline'>('lista');
  const [rows, setRows] = useState<any[] | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState('abiertos');
  const [origen, setOrigen] = useState('todo');
  const [verContacto, setVerContacto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  function exportar() {
    const cols = ['Nombre', 'Empresa', 'Correo', 'Teléfono', 'Canal', 'Sucursales', 'Etapa', 'Sin contacto (días)'];
    const filas = lista.map((c: any) => [
      [c.nombre, c.apellido].filter(Boolean).join(' '), c.companies?.nombre || '', c.email || '',
      c.whatsapp || c.telefono || '', origenDe(origenDeRegistro(c)).l,
      c.sucursales_interes || c.companies?.sucursales || '', (ETAPAS[c.lifecycle_stage] || ETAPAS.lead).l,
      dias(c.last_contact_at || c.created_at) ?? '',
    ]);
    const csv = [cols, ...filas].map(f => f.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  const cargar = () => {
    fetch('/api/crm/contacts?limit=500').then(r => r.json())
      .then(j => setRows(j.data || j.contacts || [])).catch(() => setRows([]));
    fetch('/api/crm/leads/resumen?dias=30').then(r => r.json()).then(setRes).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  const lista = useMemo(() => {
    let r = (rows || []).filter((c: any) => c.lifecycle_stage !== 'cliente' || etapa === 'todos');
    if (etapa === 'abiertos') r = r.filter((c: any) => ['lead', 'lead_calificado', 'oportunidad'].includes(c.lifecycle_stage));
    else if (etapa !== 'todos') r = r.filter((c: any) => c.lifecycle_stage === etapa);
    if (origen !== 'todo') r = r.filter((c: any) => (origenDeRegistro(c) || 'sin_definir') === origen);
    const t = busca.trim().toLowerCase();
    if (t) r = r.filter((c: any) => `${c.nombre || ''} ${c.apellido || ''} ${c.email || ''} ${c.companies?.nombre || ''}`.toLowerCase().includes(t));
    // Lo más frío arriba: el lead sin contacto es la fuga más cara.
    return r.sort((a: any, b: any) => (dias(b.last_contact_at || b.created_at) || 0) - (dias(a.last_contact_at || a.created_at) || 0));
  }, [rows, etapa, origen, busca]);

  if (rows === null) return <div style={{ ...S.wrap, color: '#999', fontSize: '0.85rem' }}>Cargando leads…</div>;

  const topOrigenes = (res?.origenes || []).filter((o: any) => o.v !== 'sin_definir').slice(0, 6);
  const maxOrigen = Math.max(1, ...topOrigenes.map((o: any) => o.n));

  return (
    <div style={S.wrap}>
      <style>{`
        .lead-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
        @media (max-width: 1100px) { .lead-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 620px)  { .lead-4 { grid-template-columns:1fr; } }
        .lead-tabla { width:100%; border-collapse:collapse; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Leads</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Quién llegó, por dónde y qué falta para convertirlo</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={S.chip(vista === 'lista')} onClick={() => setVista('lista')}>Lista</button>
          <button style={S.chip(vista === 'pipeline')} onClick={() => setVista('pipeline')}>Pipeline</button>
          {/* Exportar, importar y etapas bajan a iconos: se usan una vez al mes
              y ocupaban el mismo espacio que lo que se usa todos los días. */}
          {/* Exportar arma el CSV con lo que está en pantalla —filtros
              incluidos—: bajar "todos los leads" y filtrar en Excel es hacer
              dos veces el mismo trabajo. */}
          <button style={S.ico} title="Exportar lo que estás viendo" onClick={exportar}>⤓</button>
          <button style={S.btnA} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/contacto?ref=crm`); alert('Link de captura copiado.\n\nQuien lo llene cae directo en esta lista con su origen puesto.'); }}>
            Link de captura
          </button>
          <button style={S.btnP} onClick={() => setNuevo(true)}>+ Nuevo lead</button>
        </div>
      </div>

      {vista === 'pipeline' ? <PipelineTab /> : (<>
        <div className="lead-4" style={{ marginBottom: 14 }}>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Leads nuevos</div>
            <div style={S.kv}>{res?.nuevos ?? '—'}</div>
            <div style={S.ks}>en 30 días · <b style={{ color: '#3f3b4d' }}>{res?.abiertos ?? 0}</b> abiertos en total</div>
            <div style={S.ke}>Gente que dejó sus datos y todavía no es cliente.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Convertidos</div>
            <div style={{ ...S.kv, color: '#1E8A63' }}>{res?.convertidos ?? '—'}</div>
            <div style={S.ks}>a cliente en 30 días{res?.arr_convertido ? <> · <b style={{ color: '#1E8A63' }}>{money(res.arr_convertido)}</b> de ARR</> : ''}</div>
            <div style={S.ke}>Cuenta cuando nace su primera suscripción, no cuando se marca a mano.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Conversión</div>
            <div style={{ ...S.kv, color: '#5B4BD6' }}>{res?.conversion != null ? `${res.conversion}%` : '—'}</div>
            <div style={S.ks}>de {res?.cohorte ?? 0} leads que llegaron hace 60 días o más</div>
            <div style={S.ke}>Los de esta semana no entran: todavía no tuvieron tiempo de decidir.</div>
          </div>
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div style={S.kl}>Sin seguimiento</div>
            <div style={{ ...S.kv, color: (res?.sin_seguimiento || 0) > 0 ? '#C0554E' : '#1a1a1a' }}>{res?.sin_seguimiento ?? '—'}</div>
            <div style={S.ks}>sin contacto en más de 7 días</div>
            <div style={S.ke}>Es la fuga más cara: ya pagaste por traerlos.</div>
          </div>
        </div>

        {topOrigenes.length > 0 && (
          <div style={S.card}>
            <div style={S.h}>De dónde están llegando
              <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#a5a2af' }}>leads y clientes · mismo catálogo</span>
            </div>
            {topOrigenes.map((o: any) => {
              const info = origenDe(o.v);
              return (
                <div key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.79rem' }}>
                  <span style={{ fontWeight: 700, width: 170, flexShrink: 0 }}>{info.l}</span>
                  <span style={{ flex: 1, height: 8, background: '#f4f3f7', borderRadius: 9, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 9, background: info.color, width: `${Math.max(3, (o.n / maxOrigen) * 100)}%` }} />
                  </span>
                  <span style={{ width: 36, textAlign: 'right', fontWeight: 800 }}>{o.n}</span>
                  <span style={{ width: 104, textAlign: 'right', fontSize: '0.68rem', color: o.pct >= 40 ? '#1E8A63' : '#a5a2af', fontWeight: o.pct >= 40 ? 700 : 400 }}>
                    convierte {o.pct}%
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8' }}>
              Volumen y cierre juntos: el canal que más trae no siempre es el que mejor cierra, y ahí está la decisión de dónde poner el dinero.
            </div>
          </div>
        )}

        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nombre, empresa o correo…"
              style={{ border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 12px', fontSize: '0.78rem', background: '#fdfcff', fontFamily: 'inherit', minWidth: 250 }} />
            <select value={etapa} onChange={e => setEtapa(e.target.value)}
              style={{ border: '1px solid #e2e4e9', borderRadius: 9, padding: '7px 11px', fontSize: '0.77rem', fontFamily: 'inherit', background: '#fff' }}>
              <option value="abiertos">Abiertos</option>
              <option value="lead">Nuevos</option>
              <option value="lead_calificado">Calificados</option>
              <option value="oportunidad">Oportunidad</option>
              <option value="churned">Perdidos</option>
              <option value="todos">Todos</option>
            </select>
            <select value={origen} onChange={e => setOrigen(e.target.value)}
              style={{ border: '1px solid #e2e4e9', borderRadius: 9, padding: '7px 11px', fontSize: '0.77rem', fontFamily: 'inherit', background: '#fff' }}>
              <option value="todo">Todos los canales</option>
              {GRUPOS_ORIGEN.map(g => (
                <optgroup key={g} label={g}>
                  {ORIGENES.filter(o => o.grupo === g).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </optgroup>
              ))}
              <option value="sin_definir">Sin definir</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#a5a2af' }}>{lista.length} leads</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="lead-tabla">
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth: 180 }}>Lead</th>
                  <th style={{ ...S.th, minWidth: 150 }}>Empresa</th>
                  <th style={{ ...S.th, minWidth: 190 }}>Correo</th>
                  <th style={{ ...S.th, minWidth: 120 }}>Teléfono</th>
                  <th style={{ ...S.th, minWidth: 110 }}>Canal</th>
                  <th style={{ ...S.th, width: 80 }}>Sucursales</th>
                  <th style={{ ...S.th, width: 100 }}>Etapa</th>
                  <th style={{ ...S.th, width: 90 }}>Sin contacto</th>
                  <th style={{ ...S.th, width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td style={{ ...S.td, color: '#c9c7d0' }} colSpan={9}>Nada con estos filtros.</td></tr>
                )}
                {lista.map((c: any) => {
                  const o = origenDe(origenDeRegistro(c));
                  const tel = c.whatsapp || c.telefono;
                  const d = dias(c.last_contact_at || c.created_at);
                  const et = ETAPAS[c.lifecycle_stage] || ETAPAS.lead;
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setVerContacto(c.id)}>
                          {[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                        </div>
                        {c.puesto && <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{c.puesto}</div>}
                      </td>
                      <td style={S.td}>{c.companies?.nombre || <span style={{ color: '#c9c7d0' }}>—</span>}</td>
                      <td style={{ ...S.td, fontSize: '0.72rem', color: '#6b6b74' }}>{c.email || <span style={{ color: '#c9c7d0' }}>sin correo</span>}</td>
                      <td style={S.td}>{tel || <span style={{ fontSize: '0.72rem', color: '#c9c7d0' }}>sin teléfono</span>}</td>
                      <td style={S.td}>
                        <span style={{ ...S.tag('#f6f5f9', '#4a4a52'), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: o.color, display: 'inline-block' }} />{o.l}
                        </span>
                      </td>
                      <td style={S.td}>{c.sucursales_interes || c.companies?.sucursales || <span style={{ color: '#c9c7d0' }}>—</span>}</td>
                      <td style={S.td}><span style={S.tag(et.bg, et.fg)}>{et.l}</span></td>
                      <td style={S.td}>
                        {d == null ? <span style={{ color: '#c9c7d0' }}>—</span>
                          : <span style={S.tag(d > 14 ? '#FEF0EF' : d > 7 ? '#FEF6E7' : '#EAF8F2', d > 14 ? '#C0554E' : d > 7 ? '#9a6a10' : '#1E8A63')}>
                              {d === 0 ? 'hoy' : `${d} d`}
                            </span>}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {tel && <a style={{ ...S.mini, borderColor: '#cdeadd', color: '#1E8A63', background: '#EAF8F2' }} href={waLink(tel)} target="_blank" rel="noreferrer">WhatsApp</a>}
                          <button style={S.mini} onClick={() => setVerContacto(c.id)}>Abrir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {verContacto && <LeadDrawer contactId={verContacto} onClose={() => setVerContacto(null)} onChanged={cargar} />}
      {nuevo && <NuevoLead onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); cargar(); }} />}
    </div>
  );
}

/* Alta a mano: el lead que llegó por WhatsApp o en una feria y no pasó por
 * ningún formulario. Pide lo mínimo para poder llamarle. */
function NuevoLead({ onCerrar, onListo }: any) {
  const [f, setF] = useState<any>({ nombre: '', apellido: '', email: '', whatsapp: '', empresa: '', origen_cuenta: '', sucursales_interes: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  async function guardar() {
    if (!f.nombre.trim() || (!f.email.trim() && !f.whatsapp.trim())) {
      setError('Pon al menos el nombre y una forma de contactarlo: correo o WhatsApp.');
      return;
    }
    setGuardando(true); setError('');
    const r = await fetch('/api/crm/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: f.nombre, apellido: f.apellido, email: f.email || null, whatsapp: f.whatsapp || null,
        lifecycle_stage: 'lead', fuente: 'captura_manual',
        sucursales_interes: f.sucursales_interes || null,
        propiedades: f.origen_cuenta ? { origen_cuenta: f.origen_cuenta } : {},
        empresa: f.empresa || null,
      }),
    }).then(x => x.json()).catch(() => null);
    setGuardando(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo guardar.'); return; }
    onListo();
  }

  const inp = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.79rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' };
  const lbl = { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 440, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Nuevo lead</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            <div><span style={lbl}>Nombre</span><input value={f.nombre} onChange={e => set('nombre', e.target.value)} style={inp} autoFocus /></div>
            <div><span style={lbl}>Apellido</span><input value={f.apellido} onChange={e => set('apellido', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><span style={lbl}>Empresa</span><input value={f.empresa} onChange={e => set('empresa', e.target.value)} style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
            <div><span style={lbl}>Correo</span><input value={f.email} onChange={e => set('email', e.target.value)} style={inp} /></div>
            <div><span style={lbl}>WhatsApp</span><input value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 9, marginBottom: 12 }}>
            <div>
              <span style={lbl}>De dónde llegó</span>
              <select value={f.origen_cuenta} onChange={e => set('origen_cuenta', e.target.value)} style={inp}>
                <option value="">— sin definir —</option>
                {GRUPOS_ORIGEN.map(g => (
                  <optgroup key={g} label={g}>
                    {ORIGENES.filter(o => o.grupo === g).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div><span style={lbl}>Sucursales</span><input type="number" value={f.sucursales_interes} onChange={e => set('sucursales_interes', e.target.value)} style={inp} /></div>
          </div>
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardar} disabled={guardando} style={{ ...S.btnP, opacity: guardando ? .6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar lead'}</button>
            <button onClick={onCerrar} style={{ ...S.mini, padding: '8px 14px', fontSize: '0.78rem' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
