// Leads: quién llegó, por dónde y qué falta para convertirlo.
//
// Abre en LISTA y no en el tablero. Con cuarenta leads apilados en una sola
// columna, el kanban es una torre que hay que recorrer para leer cuatro datos;
// el pipeline queda como segunda vista, para cuando de verdad se está moviendo
// gente de etapa.
import type { CSSProperties } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import PipelineTab from './PipelineTab';
import LeadDrawer from './LeadDrawer';
import { HISTORIAL_ETIQUETA } from '../../../lib/crm/lead-historial';
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

import { pintaEstatus, ESTATUS_LEAD, ESTATUS_LABEL, GRUPO_DE, COLOR_GRUPO, type EstatusLead } from '../../../lib/crm/estatus-lead';
import { camposLeads, cumpleCondsLead, type CondLead } from '../../../lib/crm/leads-filtros';

// Los 5 grupos del funnel, en el orden en que se trabajan. El color viene del
// mismo lib que pinta la pastilla: inbox y tabla no pueden discrepar.
const FUNNEL = [
  { g: 'pendiente', l: 'Sin tocar' },
  { g: 'activo', l: 'Respondieron' },
  { g: 'comprometido', l: 'Comprometidos' },
  { g: 'frio', l: 'No contestan' },
  { g: 'fuera', l: 'Descartados' },
] as const;

const ETAPAS: Record<string, { l: string; bg: string; fg: string }> = {
  lead: { l: 'Nuevo', bg: '#f4f4f6', fg: '#6B7280' },
  lead_calificado: { l: 'Calificado', bg: '#EEECFE', fg: '#5B4BD6' },
  oportunidad: { l: 'Oportunidad', bg: '#E3EDFD', fg: '#2C5FC4' },
  cliente: { l: 'Cliente', bg: '#EAF8F2', fg: '#1E8A63' },
  churned: { l: 'Perdido', bg: '#FEF0EF', fg: '#C0554E' },
};

// Las 5 pestañas de trabajo + Todos. Cada lead vive en UNA sola (regla
// anti-solape, prioridad Prueba > Oportunidad > Calificados > Campañas >
// Rezagados): un calificado que agenda se va a Oportunidad, un rezagado que
// responde vuelve a Campañas. "Todos" es el único traslape permitido.
const VISTAS = [
  { v: 'camp_nuevas', l: 'Campañas nuevas' },
  { v: 'camp_seguimiento', l: 'Campañas en seguimiento' },
  { v: 'calificados', l: 'Calificados' },
  { v: 'oportunidad', l: 'Oportunidad' },
  { v: 'prueba', l: 'En prueba' },
  { v: 'rezagados', l: 'Rezagados' },
  { v: 'todos', l: 'Todos' },
];

const eDeLead = (c: any) => (c.estatus_lead || 'nuevo');
/** Cuándo llegó DE VERDAD: la fecha original del anuncio si existe, no la del import. */
const llegoReal = (c: any) => c.propiedades?.tiktok?.creado || c.created_at;
const diasDesde = (d?: string | null) => d ? Math.floor((Date.now() - Date.parse(d)) / 86400000) : null;

/** En qué pestaña vive este contacto. null = solo en Todos (clientes, perdidos). */
function pestanaDe(c: any): string | null {
  if (!ABIERTOS.includes(c.lifecycle_stage)) return null;
  if (prueba(c)) return 'prueba';
  if (c.lifecycle_stage === 'oportunidad' || (c.n_reuniones || 0) > 0) return 'oportunidad';
  if (c.lifecycle_stage === 'lead_calificado') return 'calificados';
  // Rezagado: frío (sin señal viva), llegó hace +14 días y nadie lo ha tocado
  // en +14 días. Sale solo de aquí en cuanto se le da seguimiento real.
  const frio = ['nuevo', 'contactado', 'sin_respuesta'].includes(eDeLead(c));
  const viejo = (diasDesde(llegoReal(c)) ?? 0) > 14;
  const abandonado = c.last_contact_at == null || (diasDesde(c.last_contact_at) ?? 0) > 14;
  if (frio && viejo && abandonado) return 'rezagados';
  // Campañas se parte en DOS pestañas: lo nuevo sin contactar (la bandeja
  // del día) y lo que ya se está trabajando.
  return eDeLead(c) === 'nuevo' ? 'camp_nuevas' : 'camp_seguimiento';
}

/** La prueba gratis del lead: vive en `propiedades.prueba_inicio/prueba_fin`.
 *  Una prueba VENCIDA sigue contando como abierta hasta que alguien la cierre —
 *  y es justo la que hay que ver: mientras siga así, nadie sabe si compró, si
 *  se le acabó o si nadie volvió a hablarle. */
const prueba = (c: any) => {
  const p = c?.propiedades || {};
  if (!p.prueba_inicio) return null;
  const restan = p.prueba_fin
    ? Math.ceil((Date.parse(p.prueba_fin + 'T12:00:00') - Date.now()) / 86400000)
    : null;
  return { ini: p.prueba_inicio, fin: p.prueba_fin || null, restan, urge: restan != null && restan <= 3 };
};

/** Los que todavía se pueden convertir. Un perdido de ayer llegó esta semana
 *  pero no es un lead nuevo: ya se cerró. */
const ABIERTOS = ['lead', 'lead_calificado', 'oportunidad'];

/** Llegó dentro de los últimos 7 días (hoy incluido). */
const esDeLaSemana = (c: any) => {
  const d = diaLocal(c.created_at);
  if (!d) return false;
  return d >= new Date(Date.now() - 6 * 86400000).toLocaleDateString('sv-SE');
};

// Renglones del ⋮, con el mismo lenguaje del resto del CRM.
const D_MI: CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: '0.79rem', fontWeight: 700, color: '#241d43', cursor: 'pointer', fontFamily: 'inherit' };
const D_MISUB: CSSProperties = { display: 'block', fontSize: '0.66rem', fontWeight: 400, color: '#a5a2af', marginTop: 1 };

const S = {
  wrap: WRAP,
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
  /* Tres vistas, no una pantalla apilada. Antes esto arrancaba con cuatro
     tarjetas, seguía con los canales y la lista salía hasta abajo: para ver un
     lead había que pasar por un reporte entero. La Lista enseña leads, el
     Dashboard enseña cómo va la entrada, y el Pipeline se mueve. */
  const [vista, setVista] = useState<'lista' | 'dashboard' | 'pipeline'>('lista');
  // Importar, exportar y el link de captura se usan una vez al mes: eran dos
  // flechas sueltas junto al botón de crear, y ahora viven en el ⋮ con su
  // nombre escrito y qué hacen.
  const [menuMas, setMenuMas] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState('camp_nuevas');
  const [origen, setOrigen] = useState('todo');
  // Cuándo llegó. 'todo' | 'hoy' | 'ayer' | '7' | '30' | 'YYYY-MM' | 'rango'
  const [cuando, setCuando] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  // Lo nuevo primero. Es el orden natural de una bandeja: lo de hoy arriba.
  const [orden, setOrden] = useState<'reciente' | 'frio'>('reciente');
  const [sinContacto, setSinContacto] = useState('');   // '' | '7' | '14' | '30'
  const [estatusF, setEstatusF] = useState('');   // '' | 'g:<grupo>' | '<estatus fino>'
  const [reunionF, setReunionF] = useState('');   // '' | agendada | asistio | no_asistio | cancelada | sin_reagendar | nunca
  const [conds, setConds] = useState<CondLead[]>([]);          // filtro condicional del builder
  const [logicaF, setLogicaF] = useState<'AND' | 'OR'>('AND');
  const [vistasLeads, setVistasLeads] = useState<any[]>([]);   // guardadas en crm_vistas tabla 'leads'
  const [vistaId, setVistaId] = useState('');
  const [calificando, setCalificando] = useState<any>(null);   // mini-modal "Calificar"
  const [motivoCal, setMotivoCal] = useState('');
  const [panelFiltros, setPanelFiltros] = useState(false);
  // El menú de la fila se ancla con coordenadas de pantalla: dentro de una
  // tabla con scroll, un menú en flujo se recorta contra el borde.
  const [menu, setMenu] = useState<{ c: any; x: number; y: number } | null>(null);
  const [verContacto, setVerContacto] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<any>(null);
  const [nuevo, setNuevo] = useState(false);
  const [importTikTok, setImportTikTok] = useState(false);

  function exportar() {
    const cols = ['Llegó', 'Nombre', 'Empresa', 'Correo', 'Teléfono', 'Canal', 'Sucursales', 'Etapa', 'Estatus', 'Sin contacto (días)'];
    const filas = lista.map((c: any) => [
      diaLocal(c.created_at),
      [c.nombre, c.apellido].filter(Boolean).join(' '), c.companies?.nombre || '', c.email || '',
      c.whatsapp || c.telefono || '', origenDe(origenDeRegistro(c)).l,
      c.sucursales_interes || c.companies?.sucursales || '', (ETAPAS[c.lifecycle_stage] || ETAPAS.lead).l,
      pintaEstatus(c.estatus_lead, c.retenido_hasta).label,
      dias(c.last_contact_at || c.created_at) ?? '',
    ]);
    const csv = [cols, ...filas].map(f => f.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  const cargar = () => {
    fetch('/api/crm/contacts?limit=500&con_etapa=1').then(r => r.json())
      .then(j => setRows(j.data || j.contacts || [])).catch(() => setRows([]));
    fetch('/api/crm/leads/resumen?dias=30').then(r => r.json()).then(setRes).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    fetch('/api/crm/vistas?tabla=leads').then(r => r.json()).then(j => setVistasLeads(j.data || [])).catch(() => {});
  }, []);

  const listaBase = useMemo(() => {
    let r = (rows || []);
    if (etapa !== 'todos') r = r.filter((c: any) => pestanaDe(c) === etapa);
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

  // El estatus filtra AL FINAL para que los chips del funnel cuenten sobre la
  // lista ya filtrada por pestaña/canal/búsqueda: "Respondieron 12" con TikTok
  // puesto son los 12 de TikTok, igual que hacen los contadores de pestañas.
  const eDe = (c: any): EstatusLead => (c.estatus_lead || 'nuevo') as EstatusLead;
  const lista = useMemo(() => {
    let r = listaBase;
    if (estatusF) r = estatusF.startsWith('g:') ? r.filter((c: any) => GRUPO_DE[eDe(c)] === estatusF.slice(2)) : r.filter((c: any) => eDe(c) === estatusF);
    if (reunionF) r = r.filter((c: any) => {
      const x = c.reunion;
      return reunionF === 'nunca' ? !x
        : reunionF === 'agendada' ? !!x?.proxima
        : reunionF === 'sin_reagendar' ? !!x?.sin_reagendar
        : reunionF === 'cancelada' ? (x?.canceladas || 0) > 0
        : x?.ultima_estado === reunionF;
    });
    if (conds.length) r = r.filter((c: any) => cumpleCondsLead(c, conds, logicaF));
    // En las pestañas de campaña manda la fecha REAL de llegada (la del
    // anuncio si existe), lo más reciente arriba: es la bandeja del día.
    if (etapa === 'camp_nuevas' || etapa === 'camp_seguimiento') {
      r = [...r].sort((a: any, b: any) => Date.parse(llegoReal(b)) - Date.parse(llegoReal(a)));
    }
    return r;
  }, [listaBase, estatusF, reunionF, conds, logicaF, etapa]);
  // Para la tarjeta del Dashboard: el funnel del pool ABIERTO completo, sin
  // los filtros de la lista — es la foto del negocio, no de la vista.
  const conteosFunnel = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of rows || []) {
      if (!ABIERTOS.includes(c.lifecycle_stage)) continue;
      const g = GRUPO_DE[eDe(c)] || 'pendiente'; out[g] = (out[g] || 0) + 1;
    }
    return out;
  }, [rows]);

  // Los contadores de las pestañas cuentan con los OTROS filtros ya puestos:
  // "Nuevos 71" con el canal en TikTok tiene que decir cuántos nuevos de TikTok
  // hay, no cuántos nuevos hay en total.
  const conteos = useMemo(() => {
    let base = rows || [];
    if (origen !== 'todo') base = base.filter((c: any) => (origenDeRegistro(c) || 'sin_definir') === origen);
    const t = busca.trim().toLowerCase();
    if (t) base = base.filter((c: any) => `${c.nombre || ''} ${c.apellido || ''} ${c.email || ''} ${c.companies?.nombre || ''}`.toLowerCase().includes(t));
    const cae = (c: any, k: string) => k === 'todos' ? true : pestanaDe(c) === k;
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
    (estatusF && !estatusF.startsWith('g:')) && { k: 'est', l: `Estatus: ${ESTATUS_LABEL[estatusF as EstatusLead] || estatusF}`, quitar: () => setEstatusF('') },
    (estatusF && estatusF.startsWith('g:')) && { k: 'estg', l: 'Funnel filtrado', quitar: () => setEstatusF('') },
    reunionF && { k: 'reu', l: `Reunión: ${({ agendada: 'agendada', asistio: 'asistió', no_asistio: 'no asistió', cancelada: 'cancelada', sin_reagendar: 'sin reagendar', nunca: 'nunca' } as any)[reunionF]}`, quitar: () => setReunionF('') },
    conds.length > 0 && { k: 'conds', l: vistaId ? `Vista: ${vistasLeads.find(v => v.id === vistaId)?.nombre || 'guardada'}` : `${conds.length} condición${conds.length === 1 ? '' : 'es'}`, quitar: () => { setConds([]); setVistaId(''); } },
  ].filter(Boolean) as { k: string; l: string; quitar: () => void }[];
  const nFiltros = chips.length;
  const limpiarFiltros = () => { setCuando('todo'); setDesde(''); setHasta(''); setOrigen('todo'); setSinContacto(''); setEstatusF(''); setReunionF(''); setConds([]); setVistaId(''); };

  if (rows === null) return <Cargando texto="Cargando leads…" />;

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.015em' }}>Leads</h1>
          <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>
            {vista === 'dashboard' ? 'Cómo va la entrada de leads y por dónde se están cayendo'
              : vista === 'pipeline' ? `${res?.abiertos ?? 0} abiertos, repartidos por etapa`
              /* `conteos.todos` y no `res.total`: el resumen no trae un total
                 —cuenta abiertos, nuevos y convertidos— y sin él el subtítulo
                 caía al largo de la lista filtrada y decía "102 en total" con
                 la pestaña Abiertos puesta, teniendo 252. */
              : <>{conteos.todos ?? lista.length} en total · {lista.length} en vista</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Segmentado, no tres botones sueltos: son la MISMA cosa vista de
              tres formas, y eso se dice con una sola pieza. */}
          <div style={{ display: 'inline-flex', background: '#f5f4f8', borderRadius: 10, padding: 3 }}>
            {([['lista', 'Lista'], ['dashboard', 'Dashboard'], ['pipeline', 'Pipeline']] as const).map(([v, l]) => {
              const on = vista === v;
              return (
                <button key={v} onClick={() => setVista(v)}
                  style={{
                    border: 'none', background: on ? '#fff' : 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '7px 15px', borderRadius: 8, fontSize: '0.81rem', fontWeight: 700,
                    color: on ? '#5B4BD6' : '#6b7280', boxShadow: on ? '0 1px 3px rgba(36,29,67,.1)' : 'none',
                  }}>{l}</button>
              );
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <button title="Importar, exportar y link de captura"
              onClick={() => setMenuMas(m => !m)}
              style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #eeeef1', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>⋮</button>
            {menuMas && (
              <>
                <div onClick={() => setMenuMas(false)} style={{ position: 'fixed', inset: 0, zIndex: 1400 }} />
                <div style={{ position: 'absolute', right: 0, top: 44, zIndex: 1401, width: 256, background: '#fff', border: '1px solid #eeeef1', borderRadius: 11, boxShadow: '0 12px 32px rgba(16,24,40,.18)', padding: 6, textAlign: 'left' }}>
                  {/* El lead de un formulario instantáneo de TikTok nunca pasa
                      por el sitio: capturado a mano se pierde la campaña que lo
                      pagó. */}
                  <button style={D_MI} onClick={() => { setMenuMas(false); setImportTikTok(true); }}>
                    Importar de TikTok Ads<span style={D_MISUB}>Los formularios instantáneos no pasan por el sitio</span>
                  </button>
                  {/* Exportar arma el CSV con lo que está en pantalla —filtros
                      incluidos—: bajar todo y filtrar en Excel es hacer dos
                      veces el mismo trabajo. */}
                  <button style={D_MI} onClick={() => { setMenuMas(false); exportar(); }}>
                    Exportar lo que estás viendo<span style={D_MISUB}>Se lleva los filtros puestos</span>
                  </button>
                  <div style={{ height: 1, background: '#f5f4f8', margin: '5px 4px' }} />
                  <button style={D_MI} onClick={() => { setMenuMas(false); navigator.clipboard?.writeText(`${window.location.origin}/contacto?ref=crm`); alert('Link de captura copiado.\n\nQuien lo llene cae directo en esta lista con su origen puesto.'); }}>
                    Copiar link de captura<span style={D_MISUB}>Quien lo llene cae aquí con su origen puesto</span>
                  </button>
                </div>
              </>
            )}
          </div>
          <button style={S.btnP} onClick={() => setNuevo(true)}>+ Nuevo lead</button>
        </div>
      </div>

      {vista === 'pipeline' ? <PipelineTab /> : vista === 'dashboard' ? (<>
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

        {/* El funnel operativo: en qué está el pool abierto. Los números
            cliqueables llevan a la Lista ya filtrada — aquí vive el desglose
            que en la Lista sería una fila más de pastillas. */}
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={S.kl}>Funnel operativo</div>
          <div style={{ display: 'flex', gap: 0, marginTop: 10, borderRadius: 9, overflow: 'hidden', border: '1px solid #ececec' }}>
            {FUNNEL.filter(f => f.g !== 'fuera').map((f, i) => {
              const n = conteosFunnel[f.g] || 0;
              const col = COLOR_GRUPO[f.g];
              return (
                <button key={f.g} onClick={() => { setEstatusF(`g:${f.g}`); setEtapa('abiertos'); setVista('lista'); }}
                  title={`Ver los ${n} en la lista`}
                  style={{ flex: `${Math.max(n, 1)} 1 0`, minWidth: 128, border: 'none', borderLeft: i ? '1px solid #ececec' : 'none',
                    background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#8a8a92', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: col.tinta, opacity: .8 }} />{f.l}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: col.tinta, marginTop: 2 }}>{n}</div>
                  <div style={{ height: 4, borderRadius: 4, background: col.fondo, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', background: col.tinta, opacity: .55 }} />
                  </div>
                </button>
              );
            })}
          </div>
          {(() => {
            const conR = (rows || []).filter((c: any) => ABIERTOS.includes(c.lifecycle_stage) && c.reunion);
            if (!conR.length) return null;
            const asis = conR.filter((c: any) => c.reunion.ultima_estado === 'asistio').length;
            const noAsis = conR.filter((c: any) => c.reunion.ultima_estado === 'no_asistio').length;
            const prox = conR.filter((c: any) => c.reunion.proxima).length;
            const tasa = asis + noAsis > 0 ? Math.round((asis / (asis + noAsis)) * 100) : null;
            return (
              <div style={{ fontSize: '0.72rem', color: '#5c5966', marginTop: 10 }}>
                Reuniones del pool: <b style={{ color: '#1E8A63' }}>{asis} completadas</b> · <b style={{ color: '#C0554E' }}>{noAsis} no asistieron</b> · {prox} próximas{tasa != null && <> · asistencia <b>{tasa}%</b></>}
              </div>
            );
          })()}
          <div style={{ ...S.ke, marginTop: 8 }}>Se calcula solo, de los hechos: mensajes, llamadas, reuniones y cotizaciones. Click en un número para ver quiénes son.</div>
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
      </>) : (<>

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

          {etapa === 'oportunidad' && (() => {
            // Los contadores de reuniones cuentan sobre la pestaña ya filtrada
            // (mismo criterio que el Funnel): cada uno filtra al hacer click y
            // los huecos ("sin reagendar") se vacían cuando el trabajo está hecho.
            const n = (f: (r: any) => boolean) => listaBase.filter((c: any) => f(c.reunion)).length;
            const grupos = [
              { v: 'agendada', l: 'Agendadas', n: n(r => !!r?.proxima), bg: '#E3EDFD', fg: '#2C5FC4' },
              { v: 'asistio', l: 'Completadas', n: n(r => r?.ultima_estado === 'asistio'), bg: '#EAF8F2', fg: '#1E8A63' },
              { v: 'no_asistio', l: 'No asistieron', n: n(r => r?.ultima_estado === 'no_asistio'), bg: '#FEF0EF', fg: '#C0554E' },
              { v: 'sin_reagendar', l: 'Sin reagendar', n: n(r => !!r?.sin_reagendar), bg: '#FFF4E5', fg: '#9a6a10' },
              { v: 'cancelada', l: 'Canceladas', n: n(r => (r?.canceladas || 0) > 0), bg: '#f4f4f6', fg: '#6B7280' },
            ];
            return (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {grupos.map(g => {
                  const on = reunionF === g.v;
                  return (
                    <button key={g.v} onClick={() => setReunionF(on ? '' : g.v)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: on ? 800 : 600,
                      border: `1px solid ${on ? g.fg : '#e6e5ec'}`, background: on ? g.bg : '#fff',
                      color: on ? g.fg : g.n === 0 ? '#c4c4cc' : '#5c5966', whiteSpace: 'nowrap',
                    }}>{g.l}<span style={{ fontWeight: 800, fontSize: '0.68rem' }}>{g.n}</span></button>
                  );
                })}
              </div>
            );
          })()}

          {/* Búsqueda + un solo botón de filtros. Antes eran tres desplegables
              creciendo hacia la derecha: cada filtro nuevo empeoraba la barra.
              Lo aplicado se ve en pastillas que se quitan con la ✕. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nombre, empresa o correo…"
                style={{ width: '100%', height: 36, border: '1px solid #e2e4e9', borderRadius: 9, padding: '0 12px 0 34px', fontSize: '0.79rem', background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
            </div>

            {vistasLeads.length > 0 && (
              <select value={vistaId} onChange={e => {
                const v = vistasLeads.find(x => x.id === e.target.value);
                setVistaId(e.target.value);
                setConds(v?.config?.condiciones || []);
                setLogicaF(v?.config?.logica === 'OR' ? 'OR' : 'AND');
              }} style={{ height: 36, border: '1px solid #e2e4e9', borderRadius: 9, padding: '0 10px', fontSize: '0.78rem', background: '#fff', fontFamily: 'inherit', color: vistaId ? '#5B4BD6' : '#666', fontWeight: vistaId ? 700 : 500, maxWidth: 210 }}>
                <option value="">Vistas guardadas…</option>
                {vistasLeads.map(v => <option key={v.id} value={v.id}>{v.config?.emoji ? v.config.emoji + ' ' : ''}{v.nombre}</option>)}
              </select>
            )}
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

                    <div style={S.fk}>Estatus del lead</div>
                    <select value={estatusF.startsWith('g:') ? '' : estatusF} onChange={e => setEstatusF(e.target.value)} style={S.fsel}>
                      <option value="">Cualquiera</option>
                      {ESTATUS_LEAD.map(e => <option key={e} value={e}>{ESTATUS_LABEL[e]}</option>)}
                    </select>

                    <div style={S.fk}>Sin contacto</div>
                    <select value={sinContacto} onChange={e => setSinContacto(e.target.value)} style={S.fsel}>
                      <option value="">Cualquiera</option>
                      <option value="7">Más de 7 días</option>
                      <option value="14">Más de 14 días</option>
                      <option value="30">Más de 30 días</option>
                    </select>

                    <div style={S.fk}>Reunión</div>
                    <select value={reunionF} onChange={e => setReunionF(e.target.value)} style={S.fsel}>
                      <option value="">Cualquiera</option>
                      <option value="agendada">Tiene agendada</option>
                      <option value="asistio">Asistió a la última</option>
                      <option value="no_asistio">No asistió</option>
                      <option value="sin_reagendar">No asistió y sin reagendar</option>
                      <option value="cancelada">Tuvo cancelada</option>
                      <option value="nunca">Nunca ha tenido</option>
                    </select>

                    {/* El builder: condiciones campo·operador·valor con Y/O.
                        Lo raro se arma una vez y se guarda como vista; lo
                        diario ya está en el select de vistas guardadas. */}
                    <div style={{ ...S.fk, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Condiciones
                      {conds.length > 1 && (
                        <button onClick={() => setLogicaF(logicaF === 'AND' ? 'OR' : 'AND')} style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 999, padding: '1px 9px', fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>{logicaF === 'AND' ? 'Y (todas)' : 'O (alguna)'}</button>
                      )}
                    </div>
                    {conds.map((k, i) => {
                      const catalogo = camposLeads({
                        campanas: [...new Set((rows || []).map((c: any) => c.campana).filter(Boolean))] as string[],
                        giros: [...new Set((rows || []).map((c: any) => c.giro || c.companies?.giro).filter(Boolean))] as string[],
                      });
                      const campo = catalogo.find(x => x.id === k.campo);
                      const pon = (parte: Partial<CondLead>) => { const n2 = [...conds]; n2[i] = { ...n2[i], ...parte }; setConds(n2); setVistaId(''); };
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 5, marginBottom: 6 }}>
                          <div style={{ display: 'grid', gap: 5 }}>
                            <select value={k.campo} onChange={e => { const c2 = catalogo.find(x => x.id === e.target.value); pon({ campo: e.target.value, op: c2?.ops[0]?.id || 'es', valor: '' }); }} style={S.fsel}>
                              <option value="">Elegir campo…</option>
                              {catalogo.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                            </select>
                            {campo && (
                              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 5 }}>
                                <select value={k.op} onChange={e => pon({ op: e.target.value })} style={S.fsel}>
                                  {campo.ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                                {campo.valores.length
                                  ? <select value={k.valor} onChange={e => pon({ valor: e.target.value })} style={S.fsel}><option value="">Elegir…</option>{campo.valores.map(v => <option key={v.v} value={v.v}>{v.l}</option>)}</select>
                                  : <input value={k.valor} onChange={e => pon({ valor: e.target.value })} placeholder="Valor…" style={S.fsel} />}
                              </div>
                            )}
                          </div>
                          <button onClick={() => { setConds(conds.filter((_, j) => j !== i)); setVistaId(''); }} aria-label="Quitar condición" style={{ border: 'none', background: 'none', color: '#a5a2af', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', alignSelf: 'start', marginTop: 6 }}>✕</button>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConds([...conds, { campo: '', op: 'es', valor: '' }])} style={{ ...S.mini }}>+ Añadir condición</button>
                      {conds.some(k => k.campo && k.valor !== '') && (
                        <button onClick={async () => {
                          const nombre = window.prompt('Nombre de la vista:');
                          if (!nombre?.trim()) return;
                          const r = await fetch('/api/crm/vistas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabla: 'leads', nombre: nombre.trim(), config: { condiciones: conds.filter(k => k.campo), logica: logicaF }, compartida: true }) }).then(x => x.json()).catch(() => null);
                          if (r?.data?.id || r?.id) { setVistasLeads([...vistasLeads, r.data || r]); setVistaId((r.data || r).id); }
                        }} style={{ ...S.mini, color: '#5B4BD6', fontWeight: 700 }}>Guardar como vista</button>
                      )}
                    </div>

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
                  {/* 92 px no alcanzaban para "09:45 p.m.": la hora se partía
                      en otro renglón y cada fila crecía de alto. 130 la deja en
                      una línea, y el ancho sale del correo, que traía 190 para
                      un dato que casi siempre se trunca igual. */}
                  <th style={{ ...S.th, width: 130 }}>Llegó</th>
                  <th style={{ ...S.th, minWidth: 150 }}>Lead</th>
                  <th style={{ ...S.th, minWidth: 140 }}>Empresa</th>
                  <th style={{ ...S.th, minWidth: 210 }}>Correo</th>
                  <th style={{ ...S.th, minWidth: 140 }}>Teléfono</th>
                  <th style={{ ...S.th, width: 120 }}>Canal</th>
                  <th style={{ ...S.th, width: 56 }}>Suc.</th>
                  <th style={{ ...S.th, width: etapa === 'todos' ? 100 : 130 }}>{
                    (etapa === 'camp_nuevas' || etapa === 'camp_seguimiento') ? 'Campaña' : etapa === 'calificados' ? 'Señal'
                    : etapa === 'oportunidad' ? 'Reunión' : etapa === 'prueba' ? 'Prueba'
                    : etapa === 'rezagados' ? 'Último intento' : 'Etapa'}</th>
                  <th style={{ ...S.th, width: 118 }}>Estatus</th>
                  <th style={{ ...S.th, width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td style={{ ...S.td, color: '#c9c7d0' }} colSpan={10}>Nada con estos filtros.</td></tr>
                )}
                {lista.map((c: any, iFila: number) => {
                  const o = origenDe(origenDeRegistro(c));
                  const tel = c.whatsapp || c.telefono;
                  const d = dias(c.last_contact_at || c.created_at);
                  const et = ETAPAS[c.lifecycle_stage] || ETAPAS.lead;
                  return (
                    <Fragment key={c.id}>
                    <tr>
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
                        {c.historial && (() => {
                          const h = HISTORIAL_ETIQUETA[c.historial.tipo as keyof typeof HISTORIAL_ETIQUETA];
                          return <span title={c.historial.titulo} style={{ display: 'inline-block', marginTop: 3, fontSize: '0.55rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.05em', background: h.bg, color: h.fg }}>{h.label}</span>;
                        })()}
                        {/* La alerta de la prueba viaja pegada al nombre, no en
                            una columna suya: es un reloj corriendo y tiene que
                            verse en TODAS las vistas, no solo en "En prueba". */}
                        {(() => {
                          const pr = prueba(c);
                          if (!pr) return null;
                          const [bg, fg, txt] = pr.restan == null ? ['#EEECFE', '#5B4BD6', 'en prueba']
                            : pr.restan < 0 ? ['#FBECEA', '#C0554E', `prueba vencida hace ${Math.abs(pr.restan)} d`]
                            : pr.restan === 0 ? ['#FFF4E5', '#9a6a10', 'prueba termina hoy']
                            : pr.urge ? ['#FFF4E5', '#9a6a10', `prueba: ${pr.restan} d`]
                            : ['#EAF8F2', '#1E8A63', `prueba: ${pr.restan} d`];
                          return <span title={pr.fin ? `Termina el ${pr.fin}` : 'Sin fecha de término'}
                            style={{ display: 'inline-block', marginTop: 3, marginLeft: c.historial ? 5 : 0, fontSize: '0.55rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.05em', background: bg, color: fg }}>{txt}</span>;
                        })()}
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
                      <td style={S.td}>{(() => {
                        // La columna cuenta lo que ESA pestaña necesita saber
                        // de cada renglón; en "Todos" vuelve a ser la Etapa.
                        if (etapa === 'camp_nuevas' || etapa === 'camp_seguimiento') return c.campana
                          ? <div><span style={S.tag('#E3EDFD', '#2C5FC4')}>{c.campana}</span>{c.propiedades?.tiktok?.anuncio && <div style={{ fontSize: '0.62rem', color: '#a5a2af', marginTop: 3 }}>{c.propiedades.tiktok.anuncio}</div>}</div>
                          : <span style={{ color: '#c9c7d0' }}>orgánico</span>;
                        if (etapa === 'calificados') return c.calificacion_motivo
                          ? <span style={{ fontSize: '0.72rem', color: '#4a4a52' }}>{c.calificacion_motivo}</span>
                          : <span style={{ color: '#c9c7d0' }}>sin motivo capturado</span>;
                        if (etapa === 'oportunidad') {
                          const r = c.reunion;
                          if (!r) return <span style={{ color: '#c9c7d0' }}>—</span>;
                          if (r.proxima) return <span style={S.tag('#E3EDFD', '#2C5FC4')}>{fechaCorta(r.proxima) === 'hoy' ? 'HOY' : r.proxima.slice(5)}</span>;
                          if (r.ultima_estado === 'asistio') return <span style={S.tag('#EAF8F2', '#1E8A63')}>Asistió</span>;
                          if (r.ultima_estado === 'no_asistio') return <div><span style={S.tag('#FEF0EF', '#C0554E')}>No asistió</span>{r.sin_reagendar && <div style={{ fontSize: '0.62rem', color: '#C0554E', marginTop: 3 }}>sin reagendar</div>}</div>;
                          return <span style={S.tag('#f4f4f6', '#6B7280')}>{r.ultima_estado || 'cancelada'}</span>;
                        }
                        if (etapa === 'prueba') {
                          const pr = prueba(c);
                          if (!pr) return <span style={{ color: '#c9c7d0' }}>—</span>;
                          const ini = Date.parse((c.propiedades?.prueba_inicio || '') + 'T12:00:00');
                          const fin = c.propiedades?.prueba_fin ? Date.parse(c.propiedades.prueba_fin + 'T12:00:00') : null;
                          const dia = Math.max(1, Math.floor((Date.now() - ini) / 86400000) + 1);
                          const total = fin ? Math.max(1, Math.round((fin - ini) / 86400000)) : 3;
                          const vencida = fin != null && fin < Date.now();
                          return <div>
                            <span style={S.tag(vencida ? '#FEF0EF' : '#FFF4E5', vencida ? '#C0554E' : '#9a6a10')}>{vencida ? `venció hace ${Math.floor((Date.now() - fin!) / 86400000)} d` : `día ${Math.min(dia, total)} de ${total}`}</span>
                            <div style={{ height: 4, borderRadius: 4, background: '#f1f1f4', marginTop: 4, overflow: 'hidden', maxWidth: 90 }}><div style={{ height: '100%', width: `${Math.min(100, (dia / total) * 100)}%`, background: vencida ? '#EF7A72' : '#E8A838' }} /></div>
                          </div>;
                        }
                        if (etapa === 'rezagados') {
                          const t = c.esfuerzo?.total || 0;
                          const u = diasDesde(c.last_contact_at);
                          return <div style={{ fontSize: '0.72rem', color: '#4a4a52' }}>{t === 0 ? 'nunca contactado' : `${t} toque${t === 1 ? '' : 's'}`}{u != null && <div style={{ fontSize: '0.62rem', color: '#a5a2af', marginTop: 2 }}>último hace {u} d</div>}</div>;
                        }
                        return <span style={S.tag(et.bg, et.fg)}>{et.l}</span>;
                      })()}</td>
                      <td style={S.td}>
                        {(() => {
                          // La pastilla del estatus operativo (la misma del
                          // inbox) y, debajo, los días sin contacto: qué tan
                          // viva está la relación y hace cuánto no la tocamos.
                          const pe = pintaEstatus(c.estatus_lead, c.retenido_hasta);
                          const ef = eDe(c);
                          const activa = estatusF === ef;
                          return (
                            <div>
                              {/* La pastilla ES el filtro: un click deja solo
                                  este estatus (y sale como pastilla removible
                                  en la fila de filtros); otro click lo quita.
                                  Cero chrome extra en la barra. */}
                              <span role="button" title={activa ? 'Quitar el filtro' : `Ver solo "${pe.label}"`}
                                onClick={() => setEstatusF(activa ? '' : ef)}
                                style={{ ...S.tag(pe.fondo, pe.tinta), cursor: 'pointer', boxShadow: activa ? `inset 0 0 0 1px ${pe.tinta}` : 'none' }}>{pe.label}</span>
                              {d != null && d > 0 && (
                                <div style={{ fontSize: '0.62rem', color: d > 14 ? '#C0554E' : '#a5a2af', marginTop: 3 }}>{d} d sin contacto</div>
                              )}
                            </div>
                          );
                        })()}
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* Anclado con coordenadas de pantalla: dentro de una tabla con scroll,
          un menú en flujo se recorta contra el borde de la tarjeta. */}
      {calificando && (
        <>
          <div onClick={() => setCalificando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,12,48,.35)', zIndex: 400 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, width: 'min(400px, 92vw)', background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(40,20,90,.25)', padding: '20px 22px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Calificar a {[calificando.nombre, calificando.apellido].filter(Boolean).join(' ') || 'este lead'}</div>
            <div style={{ fontSize: '0.76rem', color: '#8a8a92', marginTop: 4, lineHeight: 1.5 }}>Pasa a <b>Calificados</b>. El motivo es la señal que vio el equipo — una frase basta.</div>
            <input autoFocus value={motivoCal} onChange={e => setMotivoCal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setCalificando(null); }}
              placeholder="Ej. 3 sucursales y ya usa punto de venta…"
              style={{ width: '100%', boxSizing: 'border-box', height: 38, border: '1px solid #e2e4e9', borderRadius: 9, padding: '0 12px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', marginTop: 12 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setCalificando(null)} style={{ border: '1px solid #e2e4e9', background: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#666' }}>Cancelar</button>
              <button onClick={async () => {
                await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                  id: calificando.id, lifecycle_stage: 'lead_calificado', calificacion: 'califica',
                  calificacion_motivo: motivoCal.trim() || null, calificacion_at: new Date().toISOString(),
                }) }).catch(() => {});
                setCalificando(null); cargar();
              }} style={{ border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 9, padding: '8px 16px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Calificar</button>
            </div>
          </div>
        </>
      )}

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
              {c.lifecycle_stage === 'lead' && (
                <button style={{ ...opcion, color: '#5B4BD6', fontWeight: 700 }} onClick={() => { setCalificando(c); setMotivoCal(''); setMenu(null); }}>Calificar como buen lead</button>
              )}
              {tel && <a style={{ ...opcion, color: '#1E8A63' }} href={waLink(tel)} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>Escribir por WhatsApp</a>}
              {c.email && <a style={opcion} href={`mailto:${c.email}`} onClick={() => setMenu(null)}>Mandar correo</a>}
              {/* En rojo "outline", como en la ficha del cliente: visible sin
                  esconderse en un submenú, pero sin competir con lo que sí se
                  hace todos los días. El candado lo pone el modal. */}
              <div style={{ height: 1, background: '#f5f4f8', margin: '5px 4px' }} />
              <button style={{ ...opcion, color: '#c0392b' }}
                onClick={() => { setBorrando(c); setMenu(null); }}>Eliminar lead</button>
            </div>
          </>
        );
      })()}

      {verContacto && <LeadDrawer contactId={verContacto} onClose={() => setVerContacto(null)} onChanged={cargar}
        onAbrirOtro={(id: string) => setVerContacto(id)} />}
      {borrando && <EliminarLead c={borrando} onCerrar={() => setBorrando(null)}
        onListo={() => { setBorrando(null); cargar(); }} />}
      {nuevo && <NuevoLead onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); cargar(); }} />}
      {importTikTok && <ImportarTikTok onCerrar={() => setImportTikTok(false)} onListo={cargar} />}
    </div>
  );
}

/* Borrar un lead.
 *
 * Nació de los leads de prueba —"Zapatería QA 3 (borrar)"— que se quedaban en
 * la lista para siempre porque no había por dónde sacarlos.
 *
 * El candado NO es el mismo para todos: un lead de prueba sin nada detrás no
 * merece que le escribas el nombre, y uno con una cotización de $47,900 no
 * merece un solo clic. Quién pide qué lo decide el inventario que devuelve el
 * servidor, no el botón.
 */
function EliminarLead({ c, onCerrar, onListo }: any) {
  const [inv, setInv] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/crm/leads/eliminar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: c.id, ensayo: true }),
    }).then(r => r.json()).then(j => { if (j.error) setError(j.error); else setInv(j); })
      .catch(() => setError('No se pudo revisar qué tiene este lead.'));
  }, [c.id]);

  const nombre = inv?.nombre || [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || 'este lead';
  const pide = !!inv?.pide_confirmacion;
  const listo = !pide || texto.trim().toLowerCase() === String(nombre).trim().toLowerCase();

  async function borrar() {
    setBusy(true); setError('');
    const r = await fetch('/api/crm/leads/eliminar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: c.id, ensayo: false, confirmar: texto }),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo borrar.'); return; }
    onListo();
  }

  const fi: CSSProperties = { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.79rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 'min(460px, 96vw)' }}>
        <div style={{ padding: '15px 19px', background: '#fff6f4', borderBottom: '1px solid #f7c9c5', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, flex: 1, color: '#c0392b' }}>Eliminar a {nombre}</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '16px 19px 19px' }}>
          {!inv && !error && <Cargando texto="Revisando qué tiene…" alto={110} />}

          {inv && (
            <>
              {(inv.inventario || []).length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#3f3b4d', lineHeight: 1.6 }}>
                  No tiene nada colgando: ni actividades, ni reuniones, ni cotizaciones. Se va limpio.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#3f3b4d', marginBottom: 9 }}>Se borra también:</div>
                  {(inv.inventario || []).map((f: any) => (
                    <div key={f.label} style={{ display: 'flex', gap: 10, fontSize: '0.79rem', padding: '6px 0', borderTop: '1px solid #f4f4f4' }}>
                      <span style={{ color: f.pesa ? '#c0392b' : '#6b6b74' }}>{f.label}</span>
                      <b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: f.pesa ? '#c0392b' : '#241d43' }}>{f.n}</b>
                    </div>
                  ))}
                </>
              )}

              <div style={{ marginTop: 13, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 10, padding: '10px 13px', fontSize: '0.76rem', color: '#C0554E', lineHeight: 1.55 }}>
                Esto no se puede deshacer. No es archivar: la ficha desaparece de la base.
              </div>

              {pide && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    Este trae dinero de por medio · escribe «{nombre}»
                  </div>
                  <input autoFocus style={fi} value={texto} onChange={e => setTexto(e.target.value)} placeholder={nombre} />
                </div>
              )}
            </>
          )}

          {error && <div style={{ marginTop: 11, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#C0554E' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button disabled={!inv || busy || !listo} onClick={borrar}
              style={{ border: 'none', borderRadius: 9, padding: '8px 15px', background: '#c0392b', color: '#fff', fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !inv || busy || !listo ? .5 : 1 }}>
              {busy ? 'Borrando…' : 'Eliminar'}
            </button>
            <button onClick={onCerrar} style={{ border: '1px solid #ddd', borderRadius: 9, padding: '8px 15px', background: '#fff', fontSize: '0.79rem', fontWeight: 600, color: '#333', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          </div>
        </div>
      </div>
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
