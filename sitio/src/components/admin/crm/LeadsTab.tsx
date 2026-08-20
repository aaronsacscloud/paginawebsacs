// Leads: quién llegó, por dónde y qué falta para convertirlo.
//
// Abre en LISTA y no en el tablero. Con cuarenta leads apilados en una sola
// columna, el kanban es una torre que hay que recorrer para leer cuatro datos;
// el pipeline queda como segunda vista, para cuando de verdad se está moviendo
// gente de etapa.
import { useEffect, useMemo, useState } from 'react';
import PipelineTab from './PipelineTab';
import LeadDrawer from './LeadDrawer';
import ImportarTikTok from './ImportarTikTok';
import { ORIGENES, GRUPOS_ORIGEN, origenDe, origenDeRegistro } from '../../../lib/crm/origenes';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const dias = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(p).replace(/\D/g, '') : '';

// La fecha se compara SIEMPRE en día local. Un lead que entró a las 8 de la
// noche de México cae en el día siguiente si se corta por UTC, y entonces
// "los de hoy" deja de ser lo que uno ve en la pantalla. 'sv-SE' da el formato
// YYYY-MM-DD ya en la zona del navegador, que es la del que está mirando.
const diaLocal = (d?: string | null) => {
  if (!d) return '';
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('sv-SE') : '';
};
const HOY_LOCAL = () => new Date().toLocaleDateString('sv-SE');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "hoy", "ayer" o "14/ago" — y el año solo cuando no es el corriente. */
function fechaCorta(d?: string | null) {
  const dl = diaLocal(d);
  if (!dl) return '';
  const hoy = HOY_LOCAL();
  if (dl === hoy) return 'hoy';
  const ayer = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
  if (dl === ayer) return 'ayer';
  const [y, m, dd] = dl.split('-');
  const esteAno = hoy.slice(0, 4);
  return `${Number(dd)}/${MESES[Number(m) - 1].slice(0, 3)}${y === esteAno ? '' : ' ' + y}`;
}
const horaCorta = (d?: string | null) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
};

const ETAPAS: Record<string, { l: string; bg: string; fg: string }> = {
  lead: { l: 'Nuevo', bg: '#f4f4f6', fg: '#6B7280' },
  lead_calificado: { l: 'Calificado', bg: '#EEECFE', fg: '#5B4BD6' },
  oportunidad: { l: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  cliente: { l: 'Cliente', bg: '#EAF8F2', fg: '#1E8A63' },
  churned: { l: 'Perdido', bg: '#FEF0EF', fg: '#C0554E' },
};

// Las pestañas de la lista. "Abiertos" primero porque es el trabajo del día:
// lo que todavía se puede convertir.
const VISTAS = [
  { v: 'abiertos', l: 'Abiertos' },
  { v: 'lead', l: 'Nuevos' },
  { v: 'lead_calificado', l: 'Calificados' },
  { v: 'oportunidad', l: 'Oportunidad' },
  { v: 'churned', l: 'Perdidos' },
  { v: 'todos', l: 'Todos' },
];

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
  fk: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' as const, color: '#a5a2af', margin: '4px 0 7px' } as const,
  fsel: { width: '100%', border: '1px solid #e2e4e9', borderRadius: 9, padding: '8px 10px', fontFamily: 'inherit', fontSize: '0.78rem', background: '#fff', marginBottom: 10 } as const,
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
  // Cuándo llegó. 'todo' | 'hoy' | 'ayer' | '7' | '30' | 'YYYY-MM' | 'rango'
  const [cuando, setCuando] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  // Lo nuevo primero. Es el orden natural de una bandeja: lo de hoy arriba.
  const [orden, setOrden] = useState<'reciente' | 'frio'>('reciente');
  const [sinContacto, setSinContacto] = useState('');   // '' | '7' | '14' | '30'
  const [panelFiltros, setPanelFiltros] = useState(false);
  // El menú de la fila se ancla con coordenadas de pantalla: dentro de una
  // tabla con scroll, un menú en flujo se recorta contra el borde.
  const [menu, setMenu] = useState<{ c: any; x: number; y: number } | null>(null);
  const [verContacto, setVerContacto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [importTikTok, setImportTikTok] = useState(false);

  function exportar() {
    const cols = ['Llegó', 'Nombre', 'Empresa', 'Correo', 'Teléfono', 'Canal', 'Sucursales', 'Etapa', 'Sin contacto (días)'];
    const filas = lista.map((c: any) => [
      diaLocal(c.created_at),
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

    // Cuándo llegó. Todo se resuelve comparando cadenas YYYY-MM-DD en día
    // local: sin husos de por medio, "agosto" es agosto.
    if (cuando !== 'todo') {
      const hoy = HOY_LOCAL();
      let ini = '', fin = '';
      if (cuando === 'hoy') { ini = fin = hoy; }
      else if (cuando === 'ayer') { ini = fin = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE'); }
      else if (cuando === '7' || cuando === '30') {
        ini = new Date(Date.now() - (Number(cuando) - 1) * 86400000).toLocaleDateString('sv-SE'); fin = hoy;
      } else if (cuando === 'rango') { ini = desde; fin = hasta; }
      else if (/^\d{4}-\d{2}$/.test(cuando)) { ini = cuando + '-01'; fin = cuando + '-31'; }
      r = r.filter((c: any) => {
        const d = diaLocal(c.created_at);
        if (!d) return false;
        return (!ini || d >= ini) && (!fin || d <= fin);
      });
    }

    if (sinContacto) {
      const min = Number(sinContacto);
      r = r.filter((c: any) => (dias(c.last_contact_at || c.created_at) ?? 0) > min);
    }

    return r.sort((a: any, b: any) => orden === 'reciente'
      // Lo que llegó hoy, arriba: es la bandeja del día.
      ? Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)
      // Lo más frío arriba: el lead sin contacto es la fuga más cara.
      : (dias(b.last_contact_at || b.created_at) || 0) - (dias(a.last_contact_at || a.created_at) || 0));
  }, [rows, etapa, origen, busca, cuando, desde, hasta, orden, sinContacto]);

  // Los contadores de las pestañas cuentan con los OTROS filtros ya puestos:
  // "Nuevos 71" con el canal en TikTok tiene que decir cuántos nuevos de TikTok
  // hay, no cuántos nuevos hay en total.
  const conteos = useMemo(() => {
    let base = rows || [];
    if (origen !== 'todo') base = base.filter((c: any) => (origenDeRegistro(c) || 'sin_definir') === origen);
    const t = busca.trim().toLowerCase();
    if (t) base = base.filter((c: any) => `${c.nombre || ''} ${c.apellido || ''} ${c.email || ''} ${c.companies?.nombre || ''}`.toLowerCase().includes(t));
    const cae = (c: any, k: string) => k === 'todos' ? true
      : k === 'abiertos' ? ['lead', 'lead_calificado', 'oportunidad'].includes(c.lifecycle_stage)
      : c.lifecycle_stage === k;
    const out: Record<string, number> = {};
    for (const v of VISTAS) out[v.v] = base.filter((c: any) => cae(c, v.v)).length;
    return out;
  }, [rows, origen, busca]);

  // Los meses que existen de verdad en los datos, del más nuevo al más viejo:
  // ofrecer "marzo" cuando no llegó nadie en marzo es ruido.
  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const c of rows || []) { const d = diaLocal(c.created_at); if (d) set.add(d.slice(0, 7)); }
    return [...set].sort().reverse();
  }, [rows]);

  // Lo aplicado, en pastillas: un filtro que no se ve es un filtro que se
  // olvida, y luego "faltan leads" es en realidad un mes puesto la semana pasada.
  const etiquetaCuando = () => {
    if (cuando === 'hoy') return 'Hoy';
    if (cuando === 'ayer') return 'Ayer';
    if (cuando === '7') return 'Últimos 7 días';
    if (cuando === '30') return 'Últimos 30 días';
    if (cuando === 'rango') return `${desde || '…'} a ${hasta || '…'}`;
    const [y, mm] = cuando.split('-');
    return `${MESES[Number(mm) - 1]} ${y}`;
  };
  const chips = [
    cuando !== 'todo' && { k: 'cuando', l: etiquetaCuando(), quitar: () => { setCuando('todo'); setDesde(''); setHasta(''); } },
    origen !== 'todo' && { k: 'origen', l: origen === 'sin_definir' ? 'Sin definir' : origenDe(origen).l, quitar: () => setOrigen('todo') },
    sinContacto && { k: 'sc', l: `Sin contacto +${sinContacto} d`, quitar: () => setSinContacto('') },
  ].filter(Boolean) as { k: string; l: string; quitar: () => void }[];
  const nFiltros = chips.length;
  const limpiarFiltros = () => { setCuando('todo'); setDesde(''); setHasta(''); setOrigen('todo'); setSinContacto(''); };

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
          {/* El lead de un formulario instantáneo de TikTok nunca pasa por el
              sitio: si se captura a mano, se pierde la campaña que lo pagó. */}
          <button style={S.ico} title="Importar leads de TikTok Ads" onClick={() => setImportTikTok(true)}>⤒</button>
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
          {/* Las etapas son PESTAÑAS con contador, como las vistas de
              Cotizaciones: cuántos hay en cada una se ve de golpe y se cambia
              con un clic, no abriendo un desplegable. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #eeeef1', marginBottom: 12, overflowX: 'auto' }}>
            {VISTAS.map(v => {
              const on = etapa === v.v;
              const n = conteos[v.v] ?? 0;
              return (
                <button key={v.v} onClick={() => setEtapa(v.v)} style={{
                  padding: '10px 15px', background: on ? '#EEECFE' : 'transparent',
                  borderRadius: on ? '9px 9px 0 0' : 0, border: 'none',
                  borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent',
                  color: on ? '#5B4BD6' : '#666', fontWeight: on ? 800 : 500,
                  fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1,
                }}>
                  {v.l}
                  <span style={{
                    marginLeft: 6, fontSize: '0.66rem', fontWeight: on ? 800 : 700,
                    background: on ? '#fff' : '#f3f3f6', color: on ? '#5B4BD6' : n === 0 ? '#c4c4cc' : '#8a8a92',
                    borderRadius: 20, padding: '2px 8px',
                  }}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* Búsqueda + un solo botón de filtros. Antes eran tres desplegables
              creciendo hacia la derecha: cada filtro nuevo empeoraba la barra.
              Lo aplicado se ve en pastillas que se quitan con la ✕. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nombre, empresa o correo…"
                style={{ width: '100%', height: 36, border: '1px solid #e2e4e9', borderRadius: 9, padding: '0 12px 0 34px', fontSize: '0.79rem', background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
            </div>

            <div style={{ position: 'relative' }}>
              <button onClick={() => setPanelFiltros(!panelFiltros)} style={{
                height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.78rem', fontWeight: 700, padding: '0 14px',
                background: nFiltros ? '#EEF1FE' : '#fff', border: `1px solid ${nFiltros ? '#d8e2fb' : '#e2e4e9'}`, color: nFiltros ? '#2C5FC4' : '#555',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Filtros {nFiltros > 0 && <span style={{ background: '#2C5FC4', color: '#fff', fontSize: '0.62rem', borderRadius: 10, padding: '1px 6px' }}>{nFiltros}</span>}
              </button>

              {panelFiltros && (
                <>
                  <div onClick={() => setPanelFiltros(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
                  <div style={{ position: 'absolute', top: 42, left: 0, zIndex: 40, background: '#fff', border: '1px solid #e6e2f3', borderRadius: 12, padding: 14, width: 320, boxShadow: '0 12px 34px rgba(40,20,90,.16)' }}>
                    <div style={S.fk}>Cuándo llegó</div>
                    <select value={cuando} onChange={e => setCuando(e.target.value)} style={S.fsel}>
                      <option value="todo">Todo el tiempo</option>
                      <option value="hoy">Hoy</option>
                      <option value="ayer">Ayer</option>
                      <option value="7">Últimos 7 días</option>
                      <option value="30">Últimos 30 días</option>
                      {meses.length > 0 && (
                        <optgroup label="Por mes">
                          {meses.map(m => {
                            const [y, mm] = m.split('-');
                            return <option key={m} value={m}>{MESES[Number(mm) - 1]} {y}</option>;
                          })}
                        </optgroup>
                      )}
                      <option value="rango">Rango de fechas…</option>
                    </select>
                    {cuando === 'rango' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.fsel} />
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.fsel} />
                      </div>
                    )}

                    <div style={S.fk}>Canal</div>
                    <select value={origen} onChange={e => setOrigen(e.target.value)} style={S.fsel}>
                      <option value="todo">Todos los canales</option>
                      {GRUPOS_ORIGEN.map(g => (
                        <optgroup key={g} label={g}>
                          {ORIGENES.filter(o => o.grupo === g).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </optgroup>
                      ))}
                      <option value="sin_definir">Sin definir</option>
                    </select>

                    <div style={S.fk}>Sin contacto</div>
                    <select value={sinContacto} onChange={e => setSinContacto(e.target.value)} style={S.fsel}>
                      <option value="">Cualquiera</option>
                      <option value="7">Más de 7 días</option>
                      <option value="14">Más de 14 días</option>
                      <option value="30">Más de 30 días</option>
                    </select>

                    {nFiltros > 0 && (
                      <button onClick={limpiarFiltros} style={{ ...S.mini, marginTop: 4 }}>Quitar todos</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {chips.map(ch => (
              <span key={ch.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, borderRadius: 20, padding: '0 6px 0 11px', fontSize: '0.72rem', fontWeight: 700, background: '#EEF1FE', color: '#2C5FC4', border: '1px solid #d8e2fb' }}>
                {ch.l}
                <span onClick={ch.quitar} title="Quitar filtro"
                  style={{ width: 18, height: 18, borderRadius: 99, background: 'rgba(44,95,196,.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.68rem' }}>✕</span>
              </span>
            ))}

            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <select value={orden} onChange={e => setOrden(e.target.value as 'reciente' | 'frio')} title="El orden de la lista"
                style={{ height: 36, border: '1px solid #e2e4e9', borderRadius: 9, padding: '0 10px', fontSize: '0.77rem', fontFamily: 'inherit', background: '#fff' }}>
                <option value="reciente">Más recientes primero</option>
                <option value="frio">Más fríos primero</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#a5a2af' }}>{lista.length} leads</span>
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="lead-tabla">
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 92 }}>Llegó</th>
                  <th style={{ ...S.th, minWidth: 180 }}>Lead</th>
                  <th style={{ ...S.th, minWidth: 150 }}>Empresa</th>
                  <th style={{ ...S.th, minWidth: 190 }}>Correo</th>
                  <th style={{ ...S.th, minWidth: 120 }}>Teléfono</th>
                  <th style={{ ...S.th, minWidth: 110 }}>Canal</th>
                  <th style={{ ...S.th, width: 80 }}>Sucursales</th>
                  <th style={{ ...S.th, width: 100 }}>Etapa</th>
                  <th style={{ ...S.th, width: 90 }}>Sin contacto</th>
                  <th style={{ ...S.th, width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td style={{ ...S.td, color: '#c9c7d0' }} colSpan={10}>Nada con estos filtros.</td></tr>
                )}
                {lista.map((c: any) => {
                  const o = origenDe(origenDeRegistro(c));
                  const tel = c.whatsapp || c.telefono;
                  const d = dias(c.last_contact_at || c.created_at);
                  const et = ETAPAS[c.lifecycle_stage] || ETAPAS.lead;
                  return (
                    <tr key={c.id}>
                      {/* Cuándo entró a SACS. Lo de hoy se marca para que la
                          bandeja del día se lea sin contar renglones. */}
                      <td style={S.td}>
                        {c.created_at ? (
                          <span title={new Date(c.created_at).toLocaleString('es-MX')}>
                            <span style={{ fontWeight: fechaCorta(c.created_at) === 'hoy' ? 800 : 600, color: fechaCorta(c.created_at) === 'hoy' ? '#1E8A63' : '#4a4a52', fontSize: '0.76rem' }}>
                              {fechaCorta(c.created_at)}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.66rem', color: '#b3b1bb' }}>{horaCorta(c.created_at)}</span>
                          </span>
                        ) : <span style={{ color: '#c9c7d0' }}>—</span>}
                      </td>
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
                      {/* Las acciones viven en el menú de tres puntos, como en
                          Cotizaciones y Cobranza. Dos botones sueltos se comían
                          130 px en todos los renglones para dos acciones que se
                          usan de vez en cuando. */}
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <button aria-label="Acciones"
                          onClick={e => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenu(menu?.c?.id === c.id ? null : { c, x: r.right, y: r.bottom });
                          }}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid transparent', background: menu?.c?.id === c.id ? '#f6f4fb' : 'none', color: menu?.c?.id === c.id ? '#5B4BD6' : '#a5a2af', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}>⋮</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* Anclado con coordenadas de pantalla: dentro de una tabla con scroll,
          un menú en flujo se recorta contra el borde de la tarjeta. */}
      {menu && (() => {
        const c = menu.c;
        const tel = c.whatsapp || c.telefono;
        const ancho = 210;
        const izq = Math.max(10, Math.min(menu.x - ancho, (typeof window !== 'undefined' ? window.innerWidth : 1200) - ancho - 10));
        const opcion = { display: 'block', width: '100%', textAlign: 'left' as const, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '0.79rem', color: '#3f3b4d', padding: '9px 12px', cursor: 'pointer', textDecoration: 'none', borderRadius: 8 };
        return (
          <>
            <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
            <div style={{ position: 'fixed', left: izq, top: menu.y + 6, zIndex: 301, width: ancho, background: '#fff', border: '1px solid #eceaf4', borderRadius: 11, boxShadow: '0 12px 34px rgba(40,20,90,.18)', padding: 6 }}>
              <div style={{ padding: '7px 12px 8px', borderBottom: '1px solid #f5f4f8', marginBottom: 4 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{[c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</div>
                <div style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{c.companies?.nombre || 'sin empresa'}</div>
              </div>
              <button style={opcion} onClick={() => { setVerContacto(c.id); setMenu(null); }}>Abrir ficha</button>
              {tel && <a style={{ ...opcion, color: '#1E8A63' }} href={waLink(tel)} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>Escribir por WhatsApp</a>}
              {c.email && <a style={opcion} href={`mailto:${c.email}`} onClick={() => setMenu(null)}>Mandar correo</a>}
            </div>
          </>
        );
      })()}

      {verContacto && <LeadDrawer contactId={verContacto} onClose={() => setVerContacto(null)} onChanged={cargar} />}
      {nuevo && <NuevoLead onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); cargar(); }} />}
      {importTikTok && <ImportarTikTok onCerrar={() => setImportTikTok(false)} onListo={cargar} />}
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
