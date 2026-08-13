import { useState, useEffect, useRef } from 'react';
import CotizacionActividad from './crm/CotizacionActividad';
import CamposConfig from './crm/CamposPersonalizados';
import CotizacionesDashboard from './crm/CotizacionesDashboard';
import RegistrarPagoModal, { resumenCierre } from './crm/RegistrarPagoModal';
import { plans as plansData } from '../../data/plans';
import { PLANS, PLAN_PRICES, IMPL_PRICES, METODOS, COMISION_CATEGORIAS, COMISION_LABELS, COMISION_RATES, fmt, fmtDate } from '../../lib/quotes/constants';
import { parseMeta, serializeMeta, addTimelineEvent } from '../../lib/quotes/meta';

// ─── Gama del módulo ───
// Dos familias con trabajos distintos.
//
// MORADO #9B8CFA y AZUL CIELO #7DA6F5 son los protagonistas: visten los botones
// importantes y todo lo estructural. Sus versiones aguadas rellenan las
// pastillas y sus versiones oscuras dan el texto que va encima — no son colores
// nuevos, es el mismo tono subido o bajado de luz.
//
// VERDE y ROJO están reservados al dinero y a nada más: verde un monto que ya
// se pagó, rojo lo vencido o eliminado. Por eso "por qué se pierden" va en azul
// y no en rojo — perder por precio no es una urgencia de hoy.
const M = {
  violeta: '#9B8CFA', azul: '#7DA6F5',
  violetaAgua: '#EEECFE', azulAgua: '#E3EDFD', azulAgua2: '#DDE8FC',
  violetaTinta: '#5B4BD6', azulTinta: '#2C5FC4', violetaHondo: '#4536BE',
  // Pastel en la FORMA —punto, franja, barra— y tinta en la CIFRA. El color
  // suave es decoración; la cantidad de dinero es información y si se despinta
  // hay que acercarse a la pantalla para leerla, docenas de veces al día.
  verde: '#4FBF95', verdeTinta: '#1E8A63', verdeAgua: '#EAF8F2',
  rojo: '#EF7A72', rojoTinta: '#C0554E', rojoAgua: '#FEF0EF',
  gris: '#E5E3EA', grisAgua: '#F4F4F6', grisTinta: '#6B7280', grisPunto: '#C9C7D0',
} as const;
import { PLANTILLAS_ROI, PLANES_SIN_PLANTILLA, driversParaPlanes, costoHoraParaPlanes, calcularRoi, payback, textoSupuestos, type Driver } from '../../lib/quotes/roi';

// ── Cuándo la vieron ──
// El número de vistas dice que hay interés; CUÁNDO fue la última dice si el
// interés es de ahora o de la semana pasada — que es lo que decide si vale la
// pena llamar hoy. Se arma el detalle completo para el hover y un "hace X"
// visible sin tener que pasar el mouse.
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
function haceTexto(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'hace segundos';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); return d === 1 ? 'ayer' : `hace ${d} d`;
}
function detalleVistas(meta: any): string {
  const n = meta?.views || 0;
  if (!n) return 'Nadie la ha abierto todavía.';
  const eventos = (meta.timeline || []).filter((t: any) => t.event === 'viewed' && t.at).map((t: any) => t.at).reverse();
  const lineas = [
    `${n} ${n === 1 ? 'vista' : 'vistas'}`,
    meta.first_viewed_at ? `Primera: ${fechaHora(meta.first_viewed_at)}` : '',
    meta.last_viewed_at ? `Última: ${fechaHora(meta.last_viewed_at)} (${haceTexto(meta.last_viewed_at)})` : '',
  ].filter(Boolean);
  if (eventos.length > 1) {
    lineas.push('', 'Cada vez que la abrió:');
    // Las 10 más recientes: el histórico completo de una cotización muy vista
    // no cabe en un tooltip y tampoco se lee.
    for (const at of eventos.slice(0, 10)) lineas.push('· ' + fechaHora(at));
    if (eventos.length > 10) lineas.push(`… y ${eventos.length - 10} más`);
  }
  return lineas.join('\n');
}
import { calcQuoteTotals } from '../../lib/quotes/totals';

interface Client {
  id: string; empresa: string; contacto: string; email: string; whatsapp: string;
  plan: string; sucursales: number; precio_mensual: number; metodo_pago: string;
  fecha_inicio: string; fecha_renovacion: string; estado: string; notas: string;
}

type Tab = 'dashboard' | 'cotizaciones' | 'config';

interface RevenueHubProps {
  _initialTab?: Tab;
  _hideNav?: boolean;
}

export default function RevenueHub({ _initialTab, _hideNav }: RevenueHubProps = {}) {
  const [tab, setTab] = useState<Tab>(_initialTab || 'dashboard');
  const [dash, setDash] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quoteForm, setQuoteForm] = useState<any>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankForm, setBankForm] = useState<any>({});
  const [altaBanco, setAltaBanco] = useState<any>(null);
  const [recup, setRecup] = useState<any>(null);
  const [condicionesTpl, setCondicionesTpl] = useState<any[]>([]);
  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [partnersById, setPartnersById] = useState<Record<string, { nombre: string; email?: string }>>({});

  const load = async () => {
    // Aparte del Promise.all de abajo: meterlo ahí corría las posiciones del
    // destructuring y las cotizaciones se cargaban con los datos del banco.
    fetch('/api/revenue/condiciones').then(r => r.json())
      .then(x => setCondicionesTpl(Array.isArray(x) ? x : [])).catch(() => {});
    const [d, ba, q, p] = await Promise.all([
      fetch('/api/revenue/dashboard').then(r => r.json()),
      fetch('/api/revenue/bank-accounts').then(r => r.json()),
      fetch('/api/revenue/quotes').then(r => r.json()),
      fetch('/api/revenue/partners-list').then(r => r.json()).catch(() => []),
    ]);
    setDash(d);
    setBankAccounts(Array.isArray(ba) ? ba : []);
    setAllQuotes(Array.isArray(q) ? q : []);
    const map: Record<string, { nombre: string; email?: string }> = {};
    (Array.isArray(p) ? p : []).forEach((row: any) => {
      if (row?.id) map[row.id] = { nombre: row.nombre || 'Partner', email: row.email };
    });
    setPartnersById(map);
  };

  useEffect(() => { load(); }, []);

  const [dashCot, setDashCot] = useState(false);

  // Sync tab when controlled by CrmDashboard
  useEffect(() => {
    if (_initialTab && _initialTab !== tab) setTab(_initialTab);
  }, [_initialTab]);

  // ─── Dashboard ───
  const DashboardView = () => {
    if (!dash) return <div style={S.empty}>Cargando...</div>;
    const chartData = Object.entries(dash.monthlyRevenue || {}).map(([month, amount]) => ({
      month: month.slice(5),
      amount,
    }));

    return (
      <div>
        {/* KPIs */}
        <div style={S.kpiRow}>
          {[
            { label: 'MRR', value: fmt(dash.mrr), color: '#4B7BE5' },
            { label: 'ARR', value: fmt(dash.arr), color: '#2AB5A0' },
            { label: 'Clientes activos', value: dash.activeClients, color: '#6C5CE7' },
            { label: 'Churn', value: dash.churnRate + '%', color: dash.churnRate > 5 ? '#E54B4B' : '#2AB5A0' },
          ].map(k => (
            <div key={k.label} style={S.kpi}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 500, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Ingresos mensuales</h3>
          {/* CSS bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
            {chartData.map((d: any, i: number) => {
              const max = Math.max(...chartData.map((x: any) => x.amount as number), 1);
              const h = ((d.amount as number) / max) * 180;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={fmt(d.amount as number)} style={{ width: '100%', height: h, background: '#4B7BE5', borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.3s ease' }} />
                  <span style={{ fontSize: '0.5625rem', color: '#aaa' }}>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Overdue */}
          <div style={S.card}>
            <h3 style={{ ...S.cardTitle, color: '#E54B4B' }}>Vencidos ({(dash.overdue || []).length})</h3>
            {(dash.overdue || []).length === 0 ? <div style={S.empty}>Sin vencidos</div> :
              (dash.overdue || []).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {c.plan}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E54B4B' }}>Venció: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>

          {/* Next renewals */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Próximas renovaciones</h3>
            {(dash.nextRenewals || []).length === 0 ? <div style={S.empty}>Sin renovaciones próximas</div> :
              (dash.nextRenewals || []).slice(0, 10).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {fmt(c.precio_mensual * (c.sucursales || 1))}/mes</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E8A838' }}>Renueva: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* By plan */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Distribución por plan</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {Object.entries(dash.byPlan || {}).map(([plan, data]: any) => (
              <div key={plan} style={{ flex: '1 0 120px', background: '#f8f9fb', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.6875rem', color: '#999', textTransform: 'capitalize' as const }}>{plan}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>{data.count}</div>
                <div style={{ fontSize: '0.6875rem', color: '#4B7BE5' }}>{fmt(data.mrr)}/mes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline funnel */}
        {allQuotes.length > 0 && (() => {
          const total = allQuotes.length;
          const sent = allQuotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted' || q.estado === 'paid');
          const viewed = allQuotes.filter((q: any) => { const { meta } = parseMeta(q.notas); return (meta.views || 0) > 0; });
          const accepted = allQuotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid');
          const paid = allQuotes.filter((q: any) => q.estado === 'paid');
          const stages = [
            { label: 'Creadas', count: total, amount: allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#999', width: 100 },
            { label: 'Enviadas', count: sent.length, amount: sent.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#4B7BE5', width: total > 0 ? Math.max((sent.length / total) * 100, 20) : 20 },
            { label: 'Vistas', count: viewed.length, amount: viewed.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#6C5CE7', width: total > 0 ? Math.max((viewed.length / total) * 100, 15) : 15 },
            { label: 'Aceptadas', count: accepted.length, amount: accepted.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2AB5A0', width: total > 0 ? Math.max((accepted.length / total) * 100, 10) : 10 },
            { label: 'Pagadas', count: paid.length, amount: paid.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2e7d32', width: total > 0 ? Math.max((paid.length / total) * 100, 8) : 8 },
          ];
          return (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Pipeline de cotizaciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {stages.map((st, i) => {
                  const prevCount = i > 0 ? stages[i - 1].count : st.count;
                  const rate = prevCount > 0 ? Math.round((st.count / prevCount) * 100) : 0;
                  return (
                    <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 70, fontSize: '0.6875rem', fontWeight: 600, color: '#666', textAlign: 'right' as const }}>{st.label}</div>
                      <div style={{ flex: 1, position: 'relative' as const }}>
                        <div style={{ width: `${st.width}%`, height: 32, background: st.color, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8, transition: 'width 0.4s ease', margin: '0 auto' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#fff' }}>{st.count}</span>
                          <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)' }}>{fmt(st.amount)}</span>
                        </div>
                      </div>
                      <div style={{ width: 40, fontSize: '0.625rem', fontWeight: 600, color: i === 0 ? 'transparent' : st.count > 0 ? '#2AB5A0' : '#ccc' }}>{i > 0 ? `${rate}%` : ''}</div>
                    </div>
                  );
                })}
              </div>
              {total > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Tasa de cierre: <strong style={{ color: accepted.length > 0 ? '#2AB5A0' : '#ccc' }}>{total > 0 ? Math.round((accepted.length / total) * 100) : 0}%</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Valor pipeline: <strong style={{ color: '#4B7BE5' }}>{fmt(sent.reduce((s: number, q: any) => s + (q.total || 0), 0))}</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Ticket promedio: <strong style={{ color: '#1a1a1a' }}>{fmt(total > 0 ? allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / total : 0)}</strong></div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Quotes ───
  const QuotesView = () => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [qf, setQf] = useState<any>({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida en planes de pago. Soporte por chat SACS y WhatsApp incluido. Sin contratos de permanencia.' });
    const [qSearch, setQSearch] = useState('');
    const [qFilter, setQFilter] = useState<string>('all');
    const [qSort, setQSort] = useState<{ col: string; asc: boolean }>({ col: 'created_at', asc: false });
    const [qPage, setQPage] = useState(0);
    // HubSpot-style: saved views, advanced filters, bulk selection, column customization, density
    const [qView, setQView] = useState<string>(() => typeof window !== 'undefined' ? (localStorage.getItem('sacs_q_view') || 'all') : 'all');
    const [qPageSize, setQPageSize] = useState<number>(() => typeof window !== 'undefined' ? (parseInt(localStorage.getItem('sacs_q_pagesize') || '25') || 25) : 25);
    const [qSelected, setQSelected] = useState<Set<string>>(new Set());
    const [qDensity, setQDensity] = useState<'compact' | 'comfortable'>(() => typeof window !== 'undefined' ? ((localStorage.getItem('sacs_q_density') as any) || 'comfortable') : 'comfortable');
    const [qVisibleCols, setQVisibleCols] = useState<Set<string>>(() => {
      const defaults = ['numero', 'created_at', 'empresa', 'origen', 'total', 'abonado', 'estado', 'views', 'actions'];
      if (typeof window === 'undefined') return new Set(defaults);
      const saved = localStorage.getItem('sacs_q_cols');
      return new Set(saved ? JSON.parse(saved) : defaults);
    });
    const [qShowColsMenu, setQShowColsMenu] = useState(false);
    const [qShowFilterPopover, setQShowFilterPopover] = useState(false);
    const [qFilters, setQFilters] = useState<Array<{ field: string; op: string; value: any }>>([]);
    const [qMenuRow, setQMenuRow] = useState<string | null>(null);
    // Eliminar una cotización pide MOTIVO: es un documento que se le mandó al
    // cliente con folio y precio, y borrarlo sin explicación es lo que después
    // impide saber por qué se le cotizó dos veces.
    const [aEliminar, setAEliminar] = useState<any[]>([]);
    const [verActividad, setVerActividad] = useState<string | null>(null);
    // Los 5 números del mes se calculan en el servidor: dos de ellos necesitan
    // los ABONOS, y aquí solo hay cotizaciones. Calcularlos en el front daría un
    // "pendiente" que ignora los anticipos.
    const [kpis, setKpis] = useState<any>(null);
    const cargarKpis = () => fetch('/api/revenue/quotes/kpis').then(r => r.json()).then(setKpis).catch(() => {});
    useEffect(() => { cargarKpis(); }, []);
    // El archivo se carga aparte: son pocas y no tienen por qué pesar en la
    // vista de todos los días.
    const [archivadas, setArchivadas] = useState<any[]>([]);
    const cargarArchivadas = () => fetch('/api/revenue/quotes?archivadas=1').then(r => r.json())
      .then(d => setArchivadas(Array.isArray(d) ? d : [])).catch(() => {});
    const PER_PAGE = qPageSize;
    // Transcript analysis
    const [showTranscriptModal, setShowTranscriptModal] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [showReview, setShowReview] = useState(false);
    // Manual accept modal
    const [acceptForm, setAcceptForm] = useState<any>(null); // { quoteId, numero, nombre, method, nota }
    const [acceptSaving, setAcceptSaving] = useState(false);
    // Reject modal
    const [rejectForm, setRejectForm] = useState<any>(null); // { quoteId, numero, motivo, detalle }
    const [rejectSaving, setRejectSaving] = useState(false);
    // Minuta IA
    const [formattingMinuta, setFormattingMinuta] = useState(false);
    const [minutaError, setMinutaError] = useState<string | null>(null);
    // Extender vigencia
    const [extendForm, setExtendForm] = useState<any>(null); // { id, numero, vigencia, days }
    const [extending, setExtending] = useState(false);

    useEffect(() => {
      fetch('/api/revenue/quotes').then(r => r.json()).then(d => setQuotes(Array.isArray(d) ? d : []));
    }, []);

    // Close row menu / popovers on outside click
    useEffect(() => {
      const close = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-q-menu]') && !target.closest('button[title="Más acciones"]')) setQMenuRow(null);
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, []);

    // Ensure items is always an array
    const items = Array.isArray(qf.items) ? qf.items : [];
    const [cobrando, setCobrando] = useState<any>(null);
    const [verMasOpc, setVerMasOpc] = useState(false);

    // ─── Paquetes: el cliente elige ENTRE opciones, no si compra ───
    // La maquinaria ya existía —la cotización pública pinta las pestañas y
    // recalcula el total de cada una— pero solo el portal de partners podía
    // armarlas. Desde aquí no había forma, así que la plantilla Interactiva
    // habría salido vacía.
    const paquetes: any[] = Array.isArray(qf.paquetes) ? qf.paquetes : [];
    const paquetesOn = paquetes.length >= 2;
    const togglePaquetes = () => {
      if (paquetesOn) {
        // Al apagar, los conceptos vuelven a ser de todos: dejarlos marcados
        // los escondería si mañana se vuelve a encender con otras opciones.
        setQf({ ...qf, paquetes: [], items: items.map((it: any) => { const { paquete: _p, ...r } = it; return r; }) });
      } else {
        setQf({ ...qf, paquetes: [{ id: 'a', nombre: 'Opción Esencial' }, { id: 'b', nombre: 'Opción Completa' }] });
      }
    };
    const totalDePaquete = (pid: string) => calcQuoteTotals({
      items: items.filter((it: any) => !it.paquete || it.paquete === pid),
      descuento_global: qf.descuento_global, descuento_tipo: qf.descuento_tipo, iva_mode: ivaMode,
    }).grandTotal;

    const addPlanItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'plan', nombre: 'controla', sucursales: 1, precio_unitario: 900, periodo: 'mensual', descuento_pct: 0, subtotal: 900 }] });
    };

    const addExtraItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };

    // Cada botón guarda su categoria_comision. No es cosmético: licencia,
    // plugin, personalizacion y hardware son las categorías con las que YA se
    // calcula la comisión del partner (35 / 25 / 20 / 5 %). Metiendo todo como
    // "Extra" sin categoría, el sistema la ADIVINABA leyendo el nombre del
    // concepto — un plugin llamado "conector con Shopify" pegaba de casualidad,
    // y uno llamado "enlace con su ERP" se comisionaba como personalización.
    const addPluginItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', categoria_comision: 'plugin', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };
    const addPersonalizacionItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', categoria_comision: 'personalizacion', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };

    // Una sola tarjeta de concepto. Se extrae de la lista porque ahora hay dos
    // listas —conceptos y promociones— y las dos pintan lo mismo. El índice que
    // recibe es el REAL dentro de items: filtrar y reindexar haría que borrar
    // una promoción borrara el concepto que quedó en esa posición.
    const renderItem = (item: any, idx: number) => (
                  <div key={idx} style={{ background: item.es_promocion ? '#ecfdf5' : '#f8f9fb', borderRadius: 10, padding: 12, marginBottom: 8, position: 'relative' as const, border: item.es_promocion ? '1.5px solid #2AB5A0' : 'none' }}>
                    <button onClick={() => removeItem(idx)} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                    {item.tipo === 'plan' ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Plan</label><select value={item.nombre} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]})</option>)}</select></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Sucursales</label><input type="number" value={item.sucursales} onChange={e => updateItem(idx, 'sucursales', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Período</label><select value={item.periodo} onChange={e => updateItem(idx, 'periodo', e.target.value)} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual (2 meses gratis)</option></select></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Desc. %</label><input type="number" value={item.descuento_pct || 0} onChange={e => updateItem(idx, 'descuento_pct', e.target.value)} style={S.input} /></div>
                        </div>
                        <div style={{ marginTop: 6 }}><input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                      </div>
                    ) : item.es_promocion ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Promocion</span>
                          <span style={{ fontSize: '0.5625rem', color: '#999' }}>Al contratar plan anual</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6, marginBottom: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Valor original</label><input type="number" value={item.precio_original || ''} onChange={e => updateItem(idx, 'precio_original', parseFloat(e.target.value) || 0)} style={S.input} /></div>
                          <div style={{ gridColumn: '1/-1' }}><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 600 }}>{fmt(item.precio_original || 0)}</span>
                          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>$0</span>
                          <span style={{ fontSize: '0.625rem', color: '#999', marginLeft: 4 }}>Gratis al contratar plan anual</span>
                        </div>
                        <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} placeholder="Ej. Implementación" style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Monto</label><input type="number" value={item.monto || ''} onChange={e => updateItem(idx, 'monto', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Periodo</label><select value={item.periodo_extra || (item.recurrente ? 'mensual' : 'unico')} onChange={e => updateItem(idx, 'periodo_extra', e.target.value)} style={S.input}><option value="unico">Unico</option><option value="mensual">Mensual</option><option value="anual">Anual (×10 meses)</option></select></div>
                        </div>
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                          {/* Visible y corregible: de esta categoría depende la
                              comisión del partner. Si se deja vacía, el sistema
                              la adivina leyendo el nombre — que es lo que pasaba
                              con todo antes de separar los botones. */}
                          {paquetesOn && (
                            <select value={item.paquete || ''} onChange={e => updateItem(idx, 'paquete', e.target.value || undefined)}
                              title="¿En qué opción aparece este concepto?" style={{ ...S.input, fontSize: '0.6875rem' }}>
                              <option value="">En todas las opciones</option>
                              {paquetes.map((p: any) => <option key={p.id} value={p.id}>Solo {p.nombre}</option>)}
                            </select>
                          )}
                          {!item.es_promocion && (
                            <select value={item.categoria_comision || ''} onChange={e => updateItem(idx, 'categoria_comision', e.target.value)}
                              title="Define la comisión del partner" style={{ ...S.input, fontSize: '0.6875rem' }}>
                              <option value="">Categoría: automática</option>
                              {COMISION_CATEGORIAS.map(c => <option key={c} value={c}>{COMISION_LABELS[c]} · {COMISION_RATES[c]}%</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )}
                    {!item.es_promocion && <div style={{ textAlign: 'right' as const, fontSize: '0.875rem', fontWeight: 700, color: '#2AB5A0', marginTop: 6 }}>{fmt(item.subtotal || item.monto || 0)}</div>}
                  </div>
    );

    const updateItem = (idx: number, field: string, value: any) => {
      const arr = [...items];
      arr[idx] = { ...arr[idx], [field]: value };
      if (arr[idx].tipo === 'plan') {
        const p = PLAN_PRICES[arr[idx].nombre] || 0;
        arr[idx].precio_unitario = p;
        const suc = parseInt(arr[idx].sucursales) || 1;
        const isAnn = arr[idx].periodo === 'anual';
        const sub = p * suc * (isAnn ? 10 : 1);
        const disc = sub * (parseFloat(arr[idx].descuento_pct || 0) / 100);
        arr[idx].subtotal = sub - disc;
      } else if (!arr[idx].es_promocion) {
        const base = parseFloat(arr[idx].monto) || 0;
        const pe = arr[idx].periodo_extra || (arr[idx].recurrente ? 'mensual' : 'unico');
        arr[idx].recurrente = pe === 'mensual' || pe === 'anual';
        arr[idx].subtotal = pe === 'anual' ? base * 10 : base;
      }
      setQf({ ...qf, items: arr });
    };

    const removeItem = (idx: number) => {
      setQf({ ...qf, items: items.filter((_: any, i: number) => i !== idx) });
    };

    // iva_mode: 'sin' = sin IVA, 'suma' = IVA sumado al total, 'incluido' = IVA ya incluido en precios
    const ivaMode = qf.iva_mode || (qf.iva_incluido ? 'suma' : 'sin');
    const { itemsSubtotal, globalDisc, afterDisc, ivaMonto, grandTotal } = calcQuoteTotals({
      items,
      descuento_global: qf.descuento_global,
      descuento_tipo: qf.descuento_tipo,
      iva_mode: ivaMode,
    });

    const createQuote = async () => {
      // Validate required fields for TikTok tracking
      if (!qf.empresa?.trim() || !qf.email?.trim() || !qf.whatsapp?.trim()) {
        alert('Empresa, Email y WhatsApp son obligatorios');
        return;
      }
      setSaving(true);
      const isEdit = !!qf.id;
      // Store logo_url in meta, add timeline events
      let notas = qf.notas || '';
      const { text, meta } = parseMeta(notas);
      if (qf.logo_url) meta.logo_url = qf.logo_url;
      else delete meta.logo_url;
      meta.iva_mode = ivaMode;
      meta.mostrar_timer = qf.mostrar_timer !== undefined ? qf.mostrar_timer : true;
      meta.mostrar_features = qf.mostrar_features !== undefined ? qf.mostrar_features : true;
      meta.mostrar_desglose = qf.mostrar_desglose !== undefined ? qf.mostrar_desglose : true;
      meta.mostrar_condiciones = qf.mostrar_condiciones !== undefined ? qf.mostrar_condiciones : true;
      meta.mostrar_key_points = qf.mostrar_key_points !== undefined ? qf.mostrar_key_points : true;
      meta.mostrar_roi = qf.mostrar_roi || false;
      meta.mostrar_antes_despues = qf.mostrar_antes_despues || false;
      meta.mostrar_firma = qf.mostrar_firma !== undefined ? qf.mostrar_firma : true;
      meta.mostrar_qr = qf.mostrar_qr !== undefined ? qf.mostrar_qr : true;
      meta.mostrar_animaciones = qf.mostrar_animaciones !== undefined ? qf.mostrar_animaciones : true;
      meta.mostrar_timeline = qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true;
      meta.timeline_tipo = qf.timeline_tipo || '1suc';
      meta.mostrar_porque_sacs = qf.mostrar_porque_sacs !== undefined ? qf.mostrar_porque_sacs : true;
      meta.mostrar_implementacion = qf.mostrar_implementacion !== undefined ? qf.mostrar_implementacion : true;
      if (qf.promo_label?.trim()) meta.promo_label = qf.promo_label.trim();
      else delete meta.promo_label;
      // El plan de parcialidades viaja con la cotización: es parte del trato.
      if (Array.isArray(qf.plan_pagos) && qf.plan_pagos.length) {
        meta.plan_pagos = qf.plan_pagos
          .filter((x: any) => Number(x.monto) > 0 && x.fecha)
          .map((x: any, i: number) => ({ id: x.id || 'p' + i, fecha: String(x.fecha).slice(0, 10), monto: Number(x.monto), concepto: String(x.concepto || `Parcialidad ${i + 1}`).slice(0, 80) }))
          .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
      } else delete meta.plan_pagos;
      if (qf.minuta_raw?.trim()) meta.minuta_raw = qf.minuta_raw.trim();
      else delete meta.minuta_raw;
      if (paquetes.length >= 2) meta.paquetes = paquetes;
      else delete meta.paquetes;
      if (qf.key_points?.length) meta.key_points = qf.key_points;
      else delete meta.key_points;
      if (qf.roi) meta.roi = qf.roi;
      else delete meta.roi;
      if (qf.antes_despues?.length) meta.antes_despues = qf.antes_despues;
      else delete meta.antes_despues;

      // Version tracking — full snapshot for navigation
      if (!meta.versions) meta.versions = [];
      const snapshot = {
        at: new Date().toISOString(), total: Math.round(grandTotal),
        items_count: items.length, moneda: qf.moneda || 'MXN',
        items: JSON.parse(JSON.stringify(items)),
        subtotal: itemsSubtotal, iva_monto: Math.round(ivaMonto),
        descuento_global: parseFloat(qf.descuento_global) || 0,
        descuento_tipo: qf.descuento_tipo || 'pct',
        condiciones: qf.condiciones || '',
      };
      if (!isEdit) {
        meta.versions.push({ v: 1, ...snapshot });
      } else {
        const nextV = (meta.versions.length || 0) + 1;
        meta.versions.push({ v: nextV, ...snapshot });
      }

      notas = serializeMeta(text, meta);
      if (!isEdit) {
        notas = addTimelineEvent(notas, 'created');
        notas = addTimelineEvent(notas, 'sent');
      } else {
        notas = addTimelineEvent(notas, 'edited');
      }
      // Remove frontend-only fields
      const { _custom_days, _es_cliente, _ctx_n, _ctx_ultima, logo_url, iva_mode: _im, _pago_mode, mostrar_timer: _mt, mostrar_features: _mf, mostrar_desglose: _md, mostrar_condiciones: _mc, mostrar_key_points: _mkp, key_points: _kp, roi: _roi, antes_despues: _ad, mostrar_roi: _mr, mostrar_antes_despues: _mad, mostrar_firma: _msf, mostrar_qr: _mq, mostrar_animaciones: _ma, mostrar_timeline: _mtl, timeline_tipo: _tt, mostrar_implementacion: _mi, implementacion_nota: _in, mostrar_porque_sacs: _mps, promo_label: _pl, minuta_raw: _mr2, paquetes: _pq, ...rest } = qf;
      const folioOffset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sacs_folio_offset') || '0') || 0 : 0;
      // Con opciones, el documento se guarda con el total de la PRIMERA: sumar los
      // conceptos de todas daría un total que no corresponde a nada que el cliente
      // pueda comprar. Cuando elija otra y acepte, el servidor lo recalcula.
      const tCot = paquetes.length >= 2
        ? calcQuoteTotals({ items: items.filter((it: any) => !it.paquete || it.paquete === paquetes[0].id), descuento_global: qf.descuento_global, descuento_tipo: qf.descuento_tipo, iva_mode: ivaMode })
        : { itemsSubtotal, ivaMonto, grandTotal };
      const body = { ...rest, notas, subtotal: tCot.itemsSubtotal, iva_incluido: ivaMode !== 'sin', iva_monto: Math.round(tCot.ivaMonto), total: Math.round(tCot.grandTotal), estado: rest.estado || 'sent', _folio_offset: folioOffset };

      // Save quote first
      const res = await fetch('/api/revenue/quotes', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const savedQuote = await res.json();

      // Generate Stripe link if mode is stripe
      if (_pago_mode === 'stripe' && savedQuote.id && Math.round(grandTotal) > 0) {
        const stripeRes = await fetch('/api/revenue/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_id: savedQuote.id,
            numero: savedQuote.numero,
            empresa: savedQuote.empresa,
            email: savedQuote.email,
            total: Math.round(grandTotal),
            moneda: savedQuote.moneda || 'MXN',
            items: Array.isArray(savedQuote.items) ? savedQuote.items : [],
            vigencia: savedQuote.vigencia,
          }),
        });
        const stripeData = await stripeRes.json();
        if (stripeData.url) {
          await fetch('/api/revenue/quotes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: savedQuote.id, link_pago: stripeData.url }),
          });
        }
      }

      setShowDrawer(false);
      setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.', ...(() => { const d = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0]; return d ? { bank_account_id: d.id, mostrar_banco: true } : {}; })() });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // Abre el modal. Los dos prompt() encadenados se escribían a mano —un typo
    // en "transferencia" y el reporte por método deja de cuadrar— y en celular
    // eran impracticables. Tampoco decían que cobrar cierra la oportunidad y
    // convierte al lead en cliente.
    const markQuotePaid = (q: any) => setCobrando(q);

    const trasCobrar = async (data: any) => {
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setCobrando(null);
      const extra = resumenCierre(data?.cierre);
      const linea = extra ? '\n' + extra.charAt(0).toUpperCase() + extra.slice(1) + '.' : '';
      if (data?.acuse_url) {
        const goNow = confirm(`✓ Pago registrado.${linea}\n\nAcuse: ${data.acuse_url}\n${data?.acuse_email?.ok ? 'Email enviado al cliente.' : 'No se pudo enviar el email — abre el acuse y reenvíalo.'}\n\n¿Abrir el acuse ahora?`);
        if (goNow) window.open(data.acuse_url + '?admin', '_blank');
      } else {
        alert(`✓ Pago registrado.${linea}`);
      }
    };

    const formatMinuta = async () => {
      const raw = (qf.minuta_raw || '').trim();
      setMinutaError(null);
      if (raw.length < 30) {
        setMinutaError('Escribe al menos 30 caracteres con los puntos de la llamada.');
        return;
      }
      // Warn before overwriting existing manual edits
      const existing = (qf.key_points || []).length;
      if (existing > 0) {
        const ok = confirm(`Ya tienes ${existing} ${existing === 1 ? 'punto' : 'puntos'} en la minuta. Procesar con IA reemplazará todos los puntos actuales. ¿Continuar?`);
        if (!ok) return;
      }
      setFormattingMinuta(true);
      try {
        const res = await fetch('/api/revenue/format-minuta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* non-JSON response */ }
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        const newPoints = Array.isArray(data.key_points) ? data.key_points : [];
        if (newPoints.length === 0) {
          setMinutaError('No se pudieron extraer puntos. Agrega más detalle a las notas y vuelve a intentar.');
        } else {
          // La IA también propone los números del ROI cuando la minuta los
          // menciona. Se PRELLENAN, no se dan por buenos: el bloque queda
          // visible con sus renglones para revisarlos antes de mandar.
          const r = data.roi;
          const patch: any = { key_points: newPoints };
          if (r) {
            const planes = Array.from(new Set(items.filter((i: any) => i.tipo === 'plan').map((i: any) => i.nombre)))
              .filter((x: any) => !PLANES_SIN_PLANTILLA.includes(x)) as string[];
            const drivers = driversParaPlanes(planes);
            const entradas = {
              ventas_mes: r.ventas_mes || undefined, stock_valor: r.stock_valor || undefined,
              compras_mes: r.compras_mes || undefined, clientes_activos: r.clientes_activos || undefined,
              ticket_promedio: r.ticket_promedio || undefined, costo_hora: costoHoraParaPlanes(planes),
            };
            // Si dijo cuántas horas gasta, se respeta ese número en vez del de
            // la plantilla: es dato del cliente contra un supuesto nuestro.
            if (r.horas_admin) for (const d of drivers) if (d.tipo === 'horas') d.valor = r.horas_admin;
            const c = calcularRoi(entradas, drivers);
            if (c.mensual > 0) {
              patch.roi = { ...(qf.roi || {}), ...entradas, drivers, problema: r.problema || qf.roi?.problema || '', ahorro_mensual: c.mensual };
              patch.mostrar_roi = true;
            }
          }
          setQf({ ...qf, ...patch });
        }
      } catch (e: any) {
        setMinutaError(e?.message || 'Error de red al procesar la minuta');
      } finally {
        setFormattingMinuta(false);
      }
    };

    const openExtendModal = (q: any) => {
      setExtendForm({ id: q.id, numero: q.numero, vigencia: q.vigencia, days: 2 });
    };

    const submitExtend = async () => {
      if (!extendForm) return;
      const days = parseInt(extendForm.days);
      if (!Number.isFinite(days) || days < 1) { alert('Días inválidos'); return; }
      setExtending(true);
      try {
        const res = await fetch('/api/revenue/extend-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: extendForm.id, days }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al extender');
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setExtendForm(null);
      } catch (e: any) {
        alert(e.message || 'Error al extender la cotización');
      } finally {
        setExtending(false);
      }
    };

    const openAcceptModal = (q: any) => {
      setAcceptForm({ quoteId: q.id, numero: q.numero, nombre: q.contacto || q.empresa || '', method: 'whatsapp', nota: '' });
    };

    const openRejectModal = (q: any) => {
      setRejectForm({ quoteId: q.id, numero: q.numero, empresa: q.empresa, motivo: '', detalle: '' });
    };

    const confirmReject = async () => {
      if (!rejectForm) return;
      if (!rejectForm.motivo) { alert('Selecciona el motivo'); return; }
      setRejectSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId: rejectForm.quoteId,
            motivo: rejectForm.motivo,
            detalle: rejectForm.detalle || '',
            from: 'admin',
          }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al marcar como rechazada'); setRejectSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setRejectForm(null);
      } finally {
        setRejectSaving(false);
      }
    };

    const confirmAccept = async () => {
      if (!acceptForm) return;
      const nombre = String(acceptForm.nombre || '').trim();
      if (!nombre) { alert('Ingresa el nombre con el que se firmará'); return; }
      setAcceptSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-accepted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: acceptForm.quoteId, aceptado_por: nombre, method: acceptForm.method, nota_interna: acceptForm.nota }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al aceptar la cotización'); setAcceptSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setAcceptForm(null);
      } finally {
        setAcceptSaving(false);
      }
    };

    const duplicateQuote = async (q: any) => {
      const copy = { ...q, id: undefined, numero: undefined, estado: 'draft', created_at: undefined };
      setSaving(true);
      await fetch('/api/revenue/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // ─── Filter, search, sort, paginate ───
    const estadoLabels: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', paid: 'Pagada', expired: 'Vencida', rejected: 'Rechazada', parcial: 'Parcial', deleted: 'Eliminado' };
    const estadoColors: Record<string, { bg: string; fg: string; dot: string }> = {
      // Fondo aguado y punto saturado: se distinguen a un metro sin que la
      // tabla se vuelva un semáforo. Solo pagada y vencida salen de la familia
      // morado/azul, porque son las dos que hablan de dinero.
      draft:    { bg: M.grisAgua,    fg: M.grisTinta,    dot: M.grisPunto },
      sent:     { bg: M.azulAgua,    fg: M.azulTinta,    dot: M.azul },
      parcial:  { bg: M.violetaAgua, fg: M.violetaTinta, dot: M.violeta },
      accepted: { bg: M.violetaAgua, fg: M.violetaHondo, dot: M.violetaTinta },
      paid:     { bg: M.verdeAgua,   fg: M.verdeTinta,   dot: M.verde },
      expired:  { bg: M.rojoAgua,    fg: M.rojoTinta,    dot: M.rojo },
      rejected: { bg: M.grisAgua,    fg: M.grisTinta,    dot: M.grisPunto },
      deleted:  { bg: M.rojoAgua,    fg: M.rojoTinta,    dot: M.rojo },
    };

    /**
     * El estado que se MUESTRA. "Enviada" con un anticipo encima es falso: ya
     * pagó una parte. Y una enviada que el cliente abrió no es lo mismo que una
     * que quizá ni le llegó — la primera se persigue, la segunda se reenvía.
     */
    const estadoVisual = (q: any, _vistas: number): string => {
      const abonado = Number(q.abonado || 0);
      const total = Number(q.total || 0);
      if (q.estado !== 'paid' && abonado > 0 && abonado < total - 0.01) return 'parcial';
      return q.estado;
    };

    // Saved views (HubSpot-style presets)
    const savedViews = [
      { id: 'all', label: 'Todas' },
      { id: 'active', label: 'Activas' },              // draft + sent
      { id: 'closing', label: 'En cierre' },           // accepted sin pagar
      { id: 'paid', label: 'Pagadas' },
      { id: 'expiring', label: 'Por vencer' },         // sent con ≤ 5 días
      { id: 'stale', label: 'Sin actividad' },         // sent > 7 días sin vistas
      { id: 'hot', label: 'Más vistas' },              // views ≥ 5
      { id: 'rejected', label: 'Rechazadas' },         // estado=rejected
      { id: 'archivadas', label: 'Archivadas' },     // eliminadas, con su motivo
    ];

    const now = Date.now();
    const daysSince = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (now - t) / 86400000;
    };
    const daysUntil = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (t - now) / 86400000;
    };

    const matchesView = (q: any, view: string, viewsCount: number) => {
      if (view === 'all') return true;
      if (view === 'active') return q.estado === 'draft' || q.estado === 'sent';
      if (view === 'closing') return q.estado === 'accepted';
      if (view === 'paid') return q.estado === 'paid';
      if (view === 'expiring') return q.estado === 'sent' && daysUntil(q.vigencia) >= 0 && daysUntil(q.vigencia) <= 5;
      if (view === 'stale') return q.estado === 'sent' && daysSince(q.created_at) > 7 && viewsCount === 0;
      if (view === 'hot') return viewsCount >= 5;
      if (view === 'rejected') return q.estado === 'rejected';
      // El archivo se cuenta y se lista aparte (la lista activa nunca trae
      // archivadas). Sin esta línea caía en el `return true` de abajo y la
      // pestaña anunciaba 32 archivadas cuando había 3.
      if (view === 'archivadas') return q.estado === 'deleted';
      return true;
    };

    const matchesAdvFilter = (q: any, f: { field: string; op: string; value: any }) => {
      const val = q[f.field];
      if (f.field === 'total') {
        const n = Number(q.total || 0);
        const v = Number(f.value);
        if (f.op === 'gt') return n > v;
        if (f.op === 'lt') return n < v;
        if (f.op === 'eq') return n === v;
      }
      if (f.field === 'created_at' || f.field === 'vigencia') {
        const d = daysSince(val);
        const v = Number(f.value);
        if (f.op === 'within') return d <= v;
        if (f.op === 'older') return d > v;
      }
      if (f.field === 'estado') {
        const list = Array.isArray(f.value) ? f.value : [f.value];
        return list.includes(q.estado);
      }
      return true;
    };

    const fuente = qView === 'archivadas' ? archivadas : quotes;
    const filtered = fuente
      .map((q: any) => ({ q, views: parseMeta(q.notas).meta.views || 0 }))
      .filter(({ q, views }) => {
        if (qView !== 'archivadas' && !matchesView(q, qView, views)) return false;
        if (qFilter !== 'all' && q.estado !== qFilter) return false;
        for (const f of qFilters) { if (!matchesAdvFilter(q, f)) return false; }
        if (!qSearch) return true;
        const s = qSearch.toLowerCase();
        return (q.numero || '').toLowerCase().includes(s) ||
          (q.empresa || '').toLowerCase().includes(s) ||
          (q.contacto || '').toLowerCase().includes(s) ||
          (q.email || '').toLowerCase().includes(s) ||
          (q.whatsapp || '').toLowerCase().includes(s) ||
          String(q.total || '').includes(s);
      })
      .sort((a, b) => {
        const dir = qSort.asc ? 1 : -1;
        if (qSort.col === 'total') return ((a.q.total || 0) - (b.q.total || 0)) * dir;
        if (qSort.col === 'abonado') return ((a.q.abonado || 0) - (b.q.abonado || 0)) * dir;
        if (qSort.col === 'views') return (a.views - b.views) * dir;
        const va = a.q[qSort.col] || '';
        const vb = b.q[qSort.col] || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });

    const filteredQuotes = filtered.map(x => x.q);
    const filteredViewsMap = new Map(filtered.map(x => [x.q.id, x.views]));

    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PER_PAGE));
    const safePage = Math.min(qPage, totalPages - 1);
    const paginated = filteredQuotes.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

    // Count by estado + view
    const counts: Record<string, number> = { all: quotes.length };
    quotes.forEach((q: any) => { counts[q.estado] = (counts[q.estado] || 0) + 1; });
    const viewCounts: Record<string, number> = {};
    savedViews.forEach(v => {
      viewCounts[v.id] = v.id === 'archivadas'
        ? archivadas.length
        : quotes.filter((q: any) => matchesView(q, v.id, parseMeta(q.notas).meta.views || 0)).length;
    });

    // KPI stats
    const totalPending = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted').reduce((s: number, q: any) => s + (q.total || 0), 0);
    const totalPaidThisMonth = quotes.filter((q: any) => {
      if (q.estado !== 'paid') return false;
      const d = new Date(q.updated_at || q.created_at);
      const nd = new Date();
      return d.getMonth() === nd.getMonth() && d.getFullYear() === nd.getFullYear();
    }).reduce((s: number, q: any) => s + (q.total || 0), 0);
    const activeCount = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'draft').length;
    const avgTicket = quotes.length ? Math.round(quotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / quotes.length) : 0;
    const acceptedOrPaidCount = quotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid').length;
    const sentOrBetter = quotes.filter((q: any) => ['sent', 'accepted', 'paid', 'expired'].includes(q.estado)).length;
    const conversionRate = sentOrBetter > 0 ? Math.round((acceptedOrPaidCount / sentOrBetter) * 100) : 0;

    // Persist preferences
    useEffect(() => { try { localStorage.setItem('sacs_q_view', qView); } catch {} }, [qView]);
    // Se pide solo cuando se entra al archivo, y al volver de archivar algo.
    useEffect(() => { cargarArchivadas(); }, []);
    useEffect(() => { if (qView === 'archivadas') cargarArchivadas(); }, [qView]);
    useEffect(() => { try { localStorage.setItem('sacs_q_pagesize', String(qPageSize)); } catch {} }, [qPageSize]);
    useEffect(() => { try { localStorage.setItem('sacs_q_density', qDensity); } catch {} }, [qDensity]);
    useEffect(() => { try { localStorage.setItem('sacs_q_cols', JSON.stringify(Array.from(qVisibleCols))); } catch {} }, [qVisibleCols]);

    // Bulk helpers
    const toggleSelect = (id: string) => {
      const next = new Set(qSelected);
      if (next.has(id)) next.delete(id); else next.add(id);
      setQSelected(next);
    };
    const toggleSelectAll = () => {
      const visible = paginated.map((q: any) => q.id);
      const allSelected = visible.every(id => qSelected.has(id));
      const next = new Set(qSelected);
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      setQSelected(next);
    };
    const clearSelection = () => setQSelected(new Set());

    const bulkMarkPaid = async () => {
      if (qSelected.size === 0) return;
      if (!confirm(`¿Marcar ${qSelected.size} cotización(es) como pagada(s)?`)) return;
      setSaving(true);
      for (const id of Array.from(qSelected)) {
        await fetch('/api/revenue/mark-paid', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: id }),
        }).catch(() => {});
      }
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      clearSelection();
      setSaving(false);
    };

    const exportCsv = () => {
      const rows = [['#', 'Fecha', 'Empresa', 'Contacto', 'Email', 'WhatsApp', 'Total', 'Moneda', 'Estado', 'Vigencia', 'Vistas']];
      filteredQuotes.forEach((q: any) => {
        const views = filteredViewsMap.get(q.id) || 0;
        rows.push([
          q.numero || '',
          (q.created_at || '').slice(0, 10),
          q.empresa || '',
          q.contacto || '',
          q.email || '',
          q.whatsapp || '',
          String(q.total || 0),
          q.moneda || 'MXN',
          estadoLabels[q.estado] || q.estado || '',
          q.vigencia || '',
          String(views),
        ]);
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizaciones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    const allColumns = [
      { id: 'numero', label: '#' },
      { id: 'created_at', label: 'Fecha' },
      { id: 'empresa', label: 'Empresa' },
      { id: 'origen', label: 'Origen' },
      { id: 'total', label: 'Total' },
      { id: 'abonado', label: 'Abonado' },
      { id: 'vigencia', label: 'Vigencia' },
      { id: 'estado', label: 'Estado' },
      { id: 'views', label: 'Vistas' },
      { id: 'actions', label: 'Acciones' },
    ];

    const rowPad = qDensity === 'compact' ? '6px 12px' : '12px 14px';

    // Ancho fijo por columna: sin esto el navegador reparte a ojo y la tabla
    // baila cada vez que cambia el contenido — es lo que hacía que se vieran
    // cuadradas y descuadradas entre sí.
    const anchoCol: Record<string, number | undefined> = {
      numero: 92, created_at: 96, empresa: undefined, origen: 110,
      total: 114, abonado: 104, vigencia: 114, estado: 112, views: 60, actions: 104,
    };
    const alinCol: Record<string, 'left' | 'right' | 'center'> = { total: 'right', abonado: 'right', views: 'center', actions: 'right' };

    const SortHeader = ({ col, label }: { col: string; label: string }) => (
      <th style={{ ...S.th, cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, width: anchoCol[col], textAlign: (alinCol[col] || 'left') as any }} onClick={() => setQSort({ col, asc: qSort.col === col ? !qSort.asc : col === 'total' || col === 'abonado' || col === 'views' ? false : true })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ color: qSort.col === col ? '#1a1a1a' : '#ddd', fontSize: '0.75rem' }}>{qSort.col === col ? (qSort.asc ? '↑' : '↓') : '⇅'}</span>
        </span>
      </th>
    );

    const removeFilter = (idx: number) => setQFilters(qFilters.filter((_, i) => i !== idx));
    const addFilter = (f: { field: string; op: string; value: any }) => { setQFilters([...qFilters, f]); setQShowFilterPopover(false); setQPage(0); };
    const allSelected = paginated.length > 0 && paginated.every((q: any) => qSelected.has(q.id));
    const someSelected = paginated.some((q: any) => qSelected.has(q.id));

    return (
      <div>
        {cobrando && <RegistrarPagoModal quote={cobrando} onCerrar={() => setCobrando(null)} onListo={trasCobrar} />}
        {/* ─── Top header: title + actions ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Cotizaciones</h2>
            <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>{quotes.length} totales · {filteredQuotes.length} en vista</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Exportar y Transcripción quedan como ÍCONOS: son herramientas, no
                acciones del día. Con `title` dicen qué hacen al pasar el mouse.
                El ⟳ se fue: la lista ya se recarga sola después de cada acción,
                que es cuando de verdad cambia algo. */}
            <button onClick={exportCsv} title="Exportar a CSV" aria-label="Exportar a CSV"
              style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', width: 38, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button onClick={() => { setTranscript(''); setAnalysisResult(null); setShowTranscriptModal(true); }}
              title="Analizar transcripción de una llamada" aria-label="Analizar transcripción"
              style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', width: 38, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            </button>
            {/* Dashboard antes de crear y sin ícono: la fila termina en la
                acción, no en el destino. Con los dos al mismo peso visual el ojo
                dudaba cuál apretar; ahora "Nueva cotización" cierra y manda. */}
            <button onClick={() => setDashCot(true)}
              style={{ ...S.btn, background: '#fff', color: M.azulTinta, border: `1.5px solid ${M.azul}`, borderRadius: 12, padding: '9px 20px', fontWeight: 700 }}>
              Dashboard
            </button>
            <button onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.', ...(() => { const d = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0]; return d ? { bank_account_id: d.id, mostrar_banco: true } : {}; })() }); setShowDrawer(true); }}
              style={{ ...S.btn, background: M.violeta, color: '#fff', padding: '8px 18px', fontWeight: 700 }}>+ Nueva cotización</button>
          </div>
        </div>

        {/* ─── KPI stats row ─── */}
        {/* Mismo diseño de siempre: título, dato grande, línea secundaria. Sin
            gráficas y sin una palabra de más — se leen de un vistazo o no
            sirven. Todo el bloque mira SOLO el mes en curso. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {(() => {
            const k = kpis;
            const card = (titulo: string, valor: string, sec: React.ReactNode, color = '#1a1a1a', onClick?: () => void, franja: string = M.violeta) => (
              <div onClick={onClick} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, padding: '14px 16px', borderRadius: 10, cursor: onClick ? 'pointer' : 'default' }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{titulo}</div>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
                <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>{sec}</div>
              </div>
            );
            // La variación se pinta sola: verde arriba, rojo abajo. Y cuando no
            // hay mes anterior con qué comparar NO se inventa un "+100%".
            const varTxt = (v: number | null) => (v === null || v === undefined)
              ? <span style={{ color: '#bbb' }}>sin mes anterior</span>
              : <span style={{ color: v > 0 ? M.verdeTinta : v < 0 ? M.azulTinta : '#888', fontWeight: 700 }}>{v > 0 ? '↑' : v < 0 ? '↓' : '='} {Math.abs(v)}%</span>;

            if (!k) return [0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${M.violetaAgua}`, padding: '14px 16px', borderRadius: 10 }}>
                <div style={{ height: 9, width: '55%', background: '#f0f0f0', borderRadius: 4 }} />
                <div style={{ height: 20, width: '70%', background: '#f0f0f0', borderRadius: 4, marginTop: 8 }} />
                <div style={{ height: 9, width: '85%', background: '#f6f6f6', borderRadius: 4, marginTop: 8 }} />
              </div>
            ));

            return (
              <>
                {card('Cotizado este mes', fmt(k.cotizado.monto),
                  <>{varTxt(k.cotizado.variacion)} vs. mes anterior · Mes anterior {fmt(k.cotizado.mes_anterior)}</>,
                  '#1a1a1a', undefined, M.azul)}
                {card('Pendiente de pago del mes', fmt(k.pendiente.monto),
                  <>{k.pendiente.activas} activas{k.pendiente.con_parcial ? ` · ${k.pendiente.con_parcial} con pago parcial` : ''}</>,
                  k.pendiente.monto > 0 ? '#1a1a1a' : M.verdeTinta,
                  () => setQView('active'), M.violeta)}
                {card('Pagado este mes', fmt(k.pagado.monto),
                  <>{k.pagado.cotizaciones} cotizaci{k.pagado.cotizaciones === 1 ? 'ón' : 'ones'} con pagos este mes</>,
                  M.verdeTinta, () => setQView('paid'), M.verde)}
                {card('Cotizaciones activas del mes', String(k.activas.total),
                  'Draft + enviadas + aceptadas pendientes', '#1a1a1a', () => setQView('active'), M.violeta)}
                {/* Ventana de 7 días, no del mes: una cotización de marzo que
                    vence el jueves es urgente HOY. Es el único número de la
                    fila que dice a quién llamarle antes del viernes. */}
                {card('Vencen esta semana', fmt(k.vencen?.monto || 0),
                  (k.vencen?.total || 0) === 0
                    ? 'Nada por vencer en 7 días'
                    : <>{k.vencen.total} cotizaci{k.vencen.total === 1 ? 'ón' : 'ones'} enviada{k.vencen.total === 1 ? '' : 's'}{k.vencen.urgentes ? <span style={{ color: M.rojoTinta, fontWeight: 800 }}> · {k.vencen.urgentes} hoy o mañana</span> : ''}</>,
                  (k.vencen?.total || 0) > 0 ? M.rojoTinta : '#1a1a1a',
                  () => setQView('expiring'), M.rojo)}
              </>
            );
          })()}
        </div>

        {/* ─── Saved views tabs ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e5e5e5', marginBottom: 12, overflowX: 'auto' as const }}>
          {savedViews.map(v => {
            const active = qView === v.id;
            return (
              <button key={v.id} onClick={() => { setQView(v.id); setQPage(0); clearSelection(); }} style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
                color: active ? '#1a1a1a' : '#666',
                fontWeight: active ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap' as const,
                marginBottom: -1,
              }}>
                {v.label}
                <span style={{ marginLeft: 6, fontSize: '0.6875rem', color: active ? '#1a1a1a' : '#aaa', fontWeight: 500 }}>{viewCounts[v.id] || 0}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Search + filter + column tools ─── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center', position: 'relative' as const }}>
          <div style={{ position: 'relative' as const, flex: '1 1 280px', maxWidth: 440 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(0); }} placeholder="Buscar por empresa, contacto, email, WhatsApp, folio o monto..." style={{ ...S.input, paddingLeft: 36, height: 36, fontSize: '0.8125rem' }} />
            {qSearch && (
              <button onClick={() => { setQSearch(''); setQPage(0); }} style={{ position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: 4 }}>✕</button>
            )}
          </div>

          {/* Advanced filter button */}
          <div style={{ position: 'relative' as const }}>
            <button onClick={() => setQShowFilterPopover(!qShowFilterPopover)} style={{ ...S.btnSmall, padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, background: qFilters.length > 0 ? '#e8f0fe' : '#fff', color: qFilters.length > 0 ? '#1a56db' : '#555', borderColor: qFilters.length > 0 ? '#93c5fd' : '#e0e0e0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filtros {qFilters.length > 0 && <span style={{ background: '#1a56db', color: '#fff', fontSize: '0.625rem', borderRadius: 10, padding: '1px 6px' }}>{qFilters.length}</span>}
            </button>
            {qShowFilterPopover && (
              <div style={{ position: 'absolute' as const, top: 42, left: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agregar filtro</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => addFilter({ field: 'total', op: 'gt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &gt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'total', op: 'lt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &lt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 7 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 7 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 30 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'older', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada hace más de 30 días</button>
                  <button onClick={() => addFilter({ field: 'estado', op: 'in', value: ['sent', 'accepted'] })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Enviadas + Aceptadas</button>
                </div>
                <button onClick={() => setQShowFilterPopover(false)} style={{ ...S.btnSmall, width: '100%', marginTop: 10, background: '#f5f5f5' }}>Cerrar</button>
              </div>
            )}
          </div>

          {/* Los chips de estado vivían aquí y duplicaban las pestañas de
              arriba (Pagadas y Rechazadas salían dos veces). Se quitaron: las
              vistas mandan, y este renglón queda para buscar y filtrar. */}
        </div>

        {/* ─── Bulk selection bar (appears when 1+ selected) ─── */}
        {qSelected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1a1a', color: '#fff', borderRadius: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{qSelected.size} cotización(es) seleccionada(s)</span>
            <div style={{ flex: 1 }}></div>
            <button onClick={bulkMarkPaid} style={{ ...S.btnSmall, background: M.verdeAgua, color: M.verdeTinta, borderColor: 'transparent' }}>Marcar como pagadas</button>
            {qView === 'archivadas' ? (
              <button onClick={async () => {
                if (!confirm(`¿Restaurar ${qSelected.size} cotización(es)? Vuelven al estado que tenían antes de archivarse.`)) return;
                await fetch('/api/revenue/quotes/eliminar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(qSelected), restaurar: true }) });
                clearSelection(); cargarArchivadas();
                const d = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d)) setQuotes(d);
              }} style={{ ...S.btnSmall, background: '#fff', color: '#1a1a1a', borderColor: 'transparent' }}>↩️ Restaurar</button>
            ) : (
              /* Varias hacia la MISMA cotización nueva: el caso de dos que se
                 fusionan en una tercera. Se archivan juntas y la nueva queda
                 apuntada por las dos. */
              <button onClick={() => setAEliminar(filteredQuotes.filter((q: any) => qSelected.has(q.id)))}
                style={{ ...S.btnSmall, background: '#fdeaea', color: '#b93333', borderColor: 'transparent', fontWeight: 700 }}>
                🗑 Eliminar ({qSelected.size})
              </button>
            )}
            <button onClick={exportCsv} style={{ ...S.btnSmall, background: '#fff', color: '#1a1a1a', borderColor: 'transparent' }}>Exportar selección</button>
            <button onClick={clearSelection} style={{ ...S.btnSmall, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Deseleccionar</button>
          </div>
        )}

        {/* ─── Table ─── */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            {/* `fixed` hace que los anchos de arriba se respeten y que la
                columna sin ancho (Empresa) absorba lo que sobre: al 80% ya no
                queda hueco a la derecha y al 100% no se desborda cortando
                Acciones. `minWidth` es el piso antes de permitir scroll. */}
            <table style={{ ...S.table, tableLayout: 'fixed' as const, minWidth: 1040 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 36, padding: '8px 0 8px 16px', position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2 }}>
                    <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleSelectAll} />
                  </th>
                  {qVisibleCols.has('numero') && <SortHeader col="numero" label="#" />}
                  {qVisibleCols.has('created_at') && <SortHeader col="created_at" label="Fecha" />}
                  {qVisibleCols.has('empresa') && <SortHeader col="empresa" label="Empresa" />}
                  {qVisibleCols.has('origen') && <th style={{ ...S.th, width: anchoCol.origen, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, whiteSpace: 'nowrap' as const }}>Origen</th>}
                  {qVisibleCols.has('total') && <SortHeader col="total" label="Total" />}
                  {qVisibleCols.has('abonado') && <SortHeader col="abonado" label="Abonado" />}
                  {qVisibleCols.has('vigencia') && <SortHeader col="vigencia" label="Vigencia" />}
                  {qVisibleCols.has('estado') && <SortHeader col="estado" label="Estado" />}
                  {qVisibleCols.has('views') && <SortHeader col="views" label="Vistas" />}
                  {qVisibleCols.has('actions') && <th style={{ ...S.th, width: anchoCol.actions, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, textAlign: 'right' as const }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={Array.from(qVisibleCols).length + 1} style={{ ...S.td, textAlign: 'center' as const, color: '#aaa', padding: 48 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>∅</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#666' }}>Sin resultados</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>Prueba limpiar los filtros o ajustar la búsqueda.</div>
                  </td></tr>
                )}
                {paginated.map((q: any) => {
                  const views = filteredViewsMap.get(q.id) || 0;
                  const estVis = estadoVisual(q, views);
                  const ec = estadoColors[estVis] || estadoColors.draft;
                  const isSel = qSelected.has(q.id);
                  const days = q.vigencia ? Math.ceil(daysUntil(q.vigencia)) : null;
                  const qMeta = parseMeta(q.notas).meta;
                  return (
                    <tr key={q.id} style={{ background: isSel ? '#f0f7ff' : 'transparent', transition: 'background 0.12s' }} onMouseEnter={e => { if (!isSel) (e.currentTarget.style.background = '#f8f9fb'); }} onMouseLeave={e => { if (!isSel) (e.currentTarget.style.background = 'transparent'); }}>
                      <td style={{ padding: `${rowPad.split(' ')[0]} 0 ${rowPad.split(' ')[0]} 16px`, borderBottom: '1px solid #f0f0f0' }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(q.id)} />
                      </td>
                      {qVisibleCols.has('numero') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a' }}>{q.numero || '-'}</td>}
                      {qVisibleCols.has('created_at') && <td style={{ ...S.td, padding: rowPad, color: '#666', whiteSpace: 'nowrap' as const }}>{fmtDate(q.created_at)}</td>}
                      {qVisibleCols.has('empresa') && <td style={{ ...S.td, padding: rowPad }}>
                        {/* Una línea por dato y recortado con "…": el correo
                            largo partía el renglón y descuadraba toda la fila. */}
                        <div style={{ fontWeight: 600, color: '#1a1a1a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{q.empresa || '—'}</div>
                        {(q.contacto || q.email) && <div title={`${q.contacto || ''}${q.contacto && q.email ? ' · ' : ''}${q.email || ''}`} style={{ fontSize: '0.6875rem', color: '#999', marginTop: 1, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{q.contacto}{q.contacto && q.email ? ' · ' : ''}{q.email}</div>}
                      </td>}
                      {qVisibleCols.has('origen') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, overflow: 'hidden' }}>
                        {q.partner_id ? (
                          <span title={`Partner: ${partnersById[q.partner_id]?.nombre || 'Partner'}`}
                            style={{ display: 'inline-block', maxWidth: '100%', padding: '3px 8px', borderRadius: 999, background: '#EEF2FB', color: '#3764C4', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' }}>
                            P: {partnersById[q.partner_id]?.nombre || 'Partner'}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#f0f0f0', color: '#666', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.02em' }}>SACS</span>
                        )}
                      </td>}
                      {qVisibleCols.has('total') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' as const, textAlign: 'right' as const }}>{fmt(q.total || 0)} <span style={{ fontSize: '0.625rem', color: '#aaa', fontWeight: 500 }}>{q.moneda || 'MXN'}</span></td>}
                      {/* Lo abonado en verde SIEMPRE, sin importar el estado de
                          la cotización: es un monto que ya se pagó. Una vencida
                          con anticipo lleva pastilla roja y cifra verde — los
                          dos hechos son ciertos y ahora se ven juntos. */}
                      {qVisibleCols.has('abonado') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, textAlign: 'right' as const, fontWeight: Number(q.abonado || 0) >= Number(q.total || 0) - 0.01 && Number(q.abonado || 0) > 0 ? 800 : 700, color: Number(q.abonado || 0) > 0 ? M.verdeTinta : '#c9c7d0' }}>{Number(q.abonado || 0) > 0 ? fmt(q.abonado) : '—'}</td>}
                      {qVisibleCols.has('vigencia') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, color: days !== null && days < 0 ? M.rojoTinta : '#8a8a8a', fontWeight: days !== null && days < 0 ? 700 : 400 }}>
                        {/* Solo el número: gris = sigue vigente, rojo = ya
                            venció. El color hace el trabajo del texto y la
                            columna deja de robar espacio. */}
                        {q.vigencia ? (days === 0 ? 'Hoy' : `${Math.abs(days as number)} ${Math.abs(days as number) === 1 ? 'día' : 'días'}`) : '—'}
                      </td>}
                      {qVisibleCols.has('estado') && <td style={{ ...S.td, padding: rowPad }}>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, alignItems: 'flex-start' }}>
                          {/* La columna de ESTADO muestra el estado y nada más.
                              Todo lo demás —a quién reemplaza, por qué se
                              archivó— vive en el panel de actividad: meterlo
                              aquí rompía la lectura de la tabla, que es para
                              barrer 35 cotizaciones de un vistazo. */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: ec.bg, color: ec.fg }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ec.dot }}></span>
                            {estadoLabels[estVis] || estVis}
                          </span>

                        </div>
                      </td>}
                      {qVisibleCols.has('views') && <td style={{ ...S.td, padding: rowPad, textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>
                        {(() => {
                          const mv = parseMeta(q.notas).meta;
                          return views > 0 ? (
                            /* Solo el ojo y el número: el "hace 2 min" no cabía
                               y partía la celda en tres renglones. El detalle
                               completo sigue en el hover y en el panel. */
                            <span onClick={(e) => { e.stopPropagation(); setVerActividad(q.id); }}
                              title={detalleVistas(mv) + '\n\nClic para ver toda la actividad'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: views >= 5 ? '#6C5CE7' : '#666', cursor: 'pointer' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                              {views}
                            </span>
                          ) : <span title="Nadie la ha abierto todavía." style={{ color: '#ddd', fontSize: '0.75rem', cursor: 'help' }}>—</span>;
                        })()}
                      </td>}
                      {qVisibleCols.has('actions') && <td style={{ ...S.td, padding: `${rowPad.split(' ')[0]} 12px ${rowPad.split(' ')[0]} 2px`, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, position: 'relative' as const }}>
                        <a href={`/cotizacion/${q.id}?admin=1`} target="_blank" rel="noopener" style={{ ...S.btnSmall, textDecoration: 'none', display: 'inline-flex', marginRight: 4, padding: '4px 9px' }}>Ver</a>

                        <button onClick={(e) => { e.stopPropagation(); setQMenuRow(qMenuRow === q.id ? null : q.id); }} style={{ ...S.btnSmall, background: '#fff', padding: '4px 8px', marginRight: 0 }} title="Más acciones">⋮</button>
                        {qMenuRow === q.id && (
                          <div data-q-menu style={{ position: 'absolute' as const, right: 0, top: 34, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 6, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, textAlign: 'left' as const }}>
                            <button onClick={() => { const { meta: m } = parseMeta(q.notas); setQf({ ...q, items: Array.isArray(q.items) ? q.items : [], logo_url: m.logo_url || '', iva_mode: m.iva_mode || (q.iva_incluido ? 'suma' : 'sin'), mostrar_timer: m.mostrar_timer !== undefined ? m.mostrar_timer : true, mostrar_features: m.mostrar_features !== undefined ? m.mostrar_features : true, mostrar_desglose: m.mostrar_desglose !== undefined ? m.mostrar_desglose : true, mostrar_condiciones: m.mostrar_condiciones !== undefined ? m.mostrar_condiciones : true, mostrar_key_points: m.mostrar_key_points !== undefined ? m.mostrar_key_points : true, key_points: m.key_points || [], roi: m.roi || null, antes_despues: m.antes_despues || [], mostrar_roi: m.mostrar_roi || false, mostrar_antes_despues: m.mostrar_antes_despues || false, mostrar_firma: m.mostrar_firma !== undefined ? m.mostrar_firma : true, mostrar_qr: m.mostrar_qr !== undefined ? m.mostrar_qr : true, mostrar_animaciones: m.mostrar_animaciones !== undefined ? m.mostrar_animaciones : true, mostrar_timeline: m.mostrar_timeline !== undefined ? m.mostrar_timeline : true, timeline_tipo: m.timeline_tipo || '1suc', mostrar_implementacion: m.mostrar_implementacion !== undefined ? m.mostrar_implementacion : true, implementacion_nota: m.implementacion_nota || '', mostrar_porque_sacs: m.mostrar_porque_sacs !== undefined ? m.mostrar_porque_sacs : true, promo_label: m.promo_label || '', minuta_raw: m.minuta_raw || '', plan_pagos: m.plan_pagos || [], paquetes: Array.isArray(m.paquetes) ? m.paquetes : [] }); setShowDrawer(true); setMinutaError(null); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex' }}>
                              ✏️ Editar
                            </button>
                            <button onClick={() => { setVerActividad(q.id); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 4, justifyContent: 'flex-start', border: '1px solid #e6e6e6', background: '#fafafa', padding: '9px 10px', display: 'flex', fontWeight: 700, color: '#1a1a1a' }}>
                              Ver actividad y pagos
                            </button>
                            <button onClick={() => { const { meta: m } = parseMeta(q.notas); setQf({ ...q, items: Array.isArray(q.items) ? q.items : [], logo_url: m.logo_url || '', iva_mode: m.iva_mode || (q.iva_incluido ? 'suma' : 'sin'), mostrar_timer: m.mostrar_timer !== undefined ? m.mostrar_timer : true, mostrar_features: m.mostrar_features !== undefined ? m.mostrar_features : true, mostrar_desglose: m.mostrar_desglose !== undefined ? m.mostrar_desglose : true, mostrar_condiciones: m.mostrar_condiciones !== undefined ? m.mostrar_condiciones : true, mostrar_key_points: m.mostrar_key_points !== undefined ? m.mostrar_key_points : true, key_points: m.key_points || [], roi: m.roi || null, antes_despues: m.antes_despues || [], mostrar_roi: m.mostrar_roi || false, mostrar_antes_despues: m.mostrar_antes_despues || false, mostrar_firma: m.mostrar_firma !== undefined ? m.mostrar_firma : true, mostrar_qr: m.mostrar_qr !== undefined ? m.mostrar_qr : true, mostrar_animaciones: m.mostrar_animaciones !== undefined ? m.mostrar_animaciones : true, mostrar_timeline: m.mostrar_timeline !== undefined ? m.mostrar_timeline : true, timeline_tipo: m.timeline_tipo || '1suc', mostrar_implementacion: m.mostrar_implementacion !== undefined ? m.mostrar_implementacion : true, implementacion_nota: m.implementacion_nota || '', mostrar_porque_sacs: m.mostrar_porque_sacs !== undefined ? m.mostrar_porque_sacs : true, promo_label: m.promo_label || '', minuta_raw: m.minuta_raw || '', plan_pagos: m.plan_pagos || [], paquetes: Array.isArray(m.paquetes) ? m.paquetes : [] }); setShowDrawer(true); setMinutaError(null); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Editar</button>
                            <button onClick={() => { duplicateQuote(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Duplicar</button>
                            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '9px 10px 3px' }}>Compartir</div>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Cotización ${q.numero}: https://www.sacscloud.com/cotizacion/${q.id}`)}`} target="_blank" rel="noopener" onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Enviar por WhatsApp</a>
                            <a href={`mailto:${q.email || ''}?subject=${encodeURIComponent(`Cotización ${q.numero} - Sacs`)}&body=${encodeURIComponent(`Hola ${q.contacto || ''},\n\nTe comparto tu cotización:\nhttps://www.sacscloud.com/cotizacion/${q.id}\n\nQuedo al pendiente.\nSaludos`)}`} onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Enviar por correo</a>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Copiar liga</button>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}/implementacion`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Copiar liga del proceso</button>
                            <div style={{ height: 1, background: '#f0f0f0', margin: '6px 4px' }}></div>
                            <button onClick={() => { setAEliminar([q]); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: M.rojoTinta }}>Eliminar cotización</button>
                          </div>
                        )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {verActividad && (
            <CotizacionActividad quoteId={verActividad} onClose={() => setVerActividad(null)}
              onCambio={async () => {
                const d2 = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d2)) setQuotes(d2);
                cargarArchivadas();
              }} />
          )}
          {aEliminar.length > 0 && (
            <EliminarCotizacionModal
              seleccion={aEliminar}
              quotes={quotes}
              onClose={() => setAEliminar([])}
              onDone={async (msg: string) => {
                setAEliminar([]); clearSelection();
                const d = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d)) setQuotes(d);
                alert(msg);
              }}
            />
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: '#666' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Por página:
                <select value={qPageSize} onChange={e => { setQPageSize(parseInt(e.target.value)); setQPage(0); }} style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span>
                {filteredQuotes.length === 0 ? '0' : `${safePage * PER_PAGE + 1}–${Math.min((safePage + 1) * PER_PAGE, filteredQuotes.length)}`} de <strong>{filteredQuotes.length}</strong>
              </span>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button disabled={safePage === 0} onClick={() => setQPage(0)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>«</button>
                <button disabled={safePage === 0} onClick={() => setQPage(safePage - 1)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>‹ Anterior</button>
                <span style={{ fontSize: '0.75rem', color: '#666', padding: '0 10px' }}>Página <strong>{safePage + 1}</strong> de {totalPages}</span>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(safePage + 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>Siguiente ›</button>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(totalPages - 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>»</button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Accept Quote Modal (admin manual acceptance) ─── */}
        {acceptForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !acceptSaving) setAcceptForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Aceptar cotización {acceptForm.numero}</h3>
                <button onClick={() => !acceptSaving && setAcceptForm(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 16px', lineHeight: 1.5 }}>
                El cliente cerró pero no firmó en la página. Se marcará como aceptada y se generará la firma automáticamente con el nombre que ingreses.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nombre que firma</label>
                <input
                  type="text"
                  value={acceptForm.nombre}
                  onChange={e => setAcceptForm({ ...acceptForm, nombre: e.target.value })}
                  placeholder="Ej. Mariana López"
                  style={S.input}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Método de aceptación</label>
                <select value={acceptForm.method} onChange={e => setAcceptForm({ ...acceptForm, method: e.target.value })} style={S.input}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="verbal">Verbal / Llamada</option>
                  <option value="email">Email</option>
                  <option value="reunion">Reunión presencial</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nota interna (opcional)</label>
                <textarea
                  value={acceptForm.nota}
                  onChange={e => setAcceptForm({ ...acceptForm, nota: e.target.value })}
                  placeholder="Ej. Confirmó por WhatsApp el 15/abr a las 3pm"
                  style={{ ...S.input, height: 70, resize: 'vertical' as const, fontSize: '0.75rem' }}
                />
                <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 4 }}>Solo tú la ves. No se muestra al cliente.</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Vista previa de firma</label>
                <div style={{ border: '1px dashed #e0e0e0', borderRadius: 8, padding: '12px 16px', background: '#fafafa', minHeight: 72, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Dancing Script','Brush Script MT','Lucida Handwriting','Segoe Script','Apple Chancery',cursive", fontSize: '2rem', fontStyle: 'italic', color: '#1a1a1a', transform: 'rotate(-3deg)', display: 'inline-block' }}>
                    {acceptForm.nombre || 'Firma del cliente'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcceptForm(null)} disabled={acceptSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmAccept} disabled={acceptSaving || !acceptForm.nombre} style={{ ...S.btn, background: acceptSaving || !acceptForm.nombre ? '#bbb' : '#00695c', color: '#fff', cursor: acceptSaving || !acceptForm.nombre ? 'not-allowed' : 'pointer' }}>
                  {acceptSaving ? 'Firmando…' : 'Confirmar aceptación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reject Quote Modal ─── */}
        {rejectForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !rejectSaving) setRejectForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Marcar como rechazada — {rejectForm.numero}</h3>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 16px', lineHeight: 1.55 }}>Registra el motivo del rechazo. El deal asociado se moverá a <strong>Cerrada perdida</strong> con este motivo.</p>

              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Motivo</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { v: 'precio', l: 'No aceptó el monto' },
                    { v: 'competidor', l: 'Contrató otro sistema' },
                    { v: 'timing', l: 'No era el momento' },
                    { v: 'no_fit', l: 'Le faltaba una función que necesitaba' },
                    { v: 'sin_respuesta', l: 'Nunca respondió' },
                    { v: 'cancelo_proyecto', l: 'Canceló el proyecto / cerró el negocio' },
                    { v: 'otro', l: 'Otro motivo' },
                  ].map(opt => {
                    const sel = rejectForm.motivo === opt.v;
                    return (
                      <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${sel ? '#c62828' : '#e0e0e0'}`, borderRadius: 6, cursor: 'pointer', background: sel ? '#fff5f5' : '#fff', fontSize: '0.8125rem' }}>
                        <input
                          type="radio"
                          name="admin-reject-motivo"
                          value={opt.v}
                          checked={sel}
                          onChange={() => setRejectForm({ ...rejectForm, motivo: opt.v })}
                        />
                        <span style={{ color: sel ? '#c62828' : '#555', fontWeight: sel ? 600 : 500 }}>{opt.l}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Detalle interno (opcional)</label>
                <textarea
                  value={rejectForm.detalle}
                  onChange={e => setRejectForm({ ...rejectForm, detalle: e.target.value })}
                  rows={3}
                  placeholder="Ej. comentario del cliente o análisis competitivo"
                  style={{ ...S.input, resize: 'vertical' as const, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmReject} disabled={rejectSaving || !rejectForm.motivo} style={{ ...S.btn, background: rejectSaving || !rejectForm.motivo ? '#bbb' : '#c62828', color: '#fff', cursor: rejectSaving || !rejectForm.motivo ? 'not-allowed' : 'pointer' }}>
                  {rejectSaving ? 'Guardando…' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Extender vigencia Modal ─── */}
        {extendForm && (() => {
          const today = new Date(); today.setHours(12,0,0,0);
          const baseDate = extendForm.vigencia ? new Date(extendForm.vigencia + 'T12:00:00') : today;
          const fromDate = baseDate < today ? today : baseDate;
          const days = parseInt(extendForm.days) || 0;
          const newDate = days > 0 ? new Date(fromDate.getTime() + days * 86400000) : fromDate;
          const fmtLong = (d: Date) => {
            const wd = d.toLocaleDateString('es-MX', { weekday: 'long' });
            return `${wd[0].toUpperCase() + wd.slice(1)} ${d.getDate()} de ${d.toLocaleDateString('es-MX', { month: 'long' })}`;
          };
          const isExpired = baseDate < today;
          return (
            <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !extending) setExtendForm(null); }}>
              <div style={{ ...S.modal, maxWidth: 460 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>⏱️ Extender vigencia — {extendForm.numero}</h3>
                  <button onClick={() => setExtendForm(null)} disabled={extending} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 14px', lineHeight: 1.55 }}>
                  {isExpired
                    ? <>Esta cotización <strong>está vencida</strong>. Al extenderla volverá a estado <em>enviada</em> con la nueva fecha desde hoy.</>
                    : <>Vigencia actual: <strong>{fmtLong(baseDate)}</strong>. Suma días sobre esa fecha.</>}
                </p>

                <label style={S.label}>Días de extensión</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[2, 3, 5, 7].map(opt => {
                    const sel = parseInt(extendForm.days) === opt;
                    return (
                      <button key={opt} onClick={() => setExtendForm({ ...extendForm, days: opt })} style={{ flex: 1, padding: '10px 8px', border: `1.5px solid ${sel ? '#1d4ed8' : '#e0e0e0'}`, background: sel ? '#eff6ff' : '#fff', color: sel ? '#1d4ed8' : '#555', borderRadius: 6, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                        +{opt}d
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={extendForm.days}
                  onChange={e => setExtendForm({ ...extendForm, days: e.target.value })}
                  placeholder="Personalizado (1–60)"
                  style={{ ...S.input, marginBottom: 14 }}
                />

                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.6875rem', color: '#0c4a6e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>Nueva vigencia</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0c4a6e' }}>{fmtLong(newDate)}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#0369a1', marginTop: 2 }}>El cliente verá el contador y los precios con promoción hasta esa fecha.</div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setExtendForm(null)} disabled={extending} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                  <button onClick={submitExtend} disabled={extending || !days || days < 1} style={{ ...S.btn, background: extending || !days ? '#bbb' : '#1d4ed8', color: '#fff', cursor: extending || !days ? 'not-allowed' : 'pointer' }}>
                    {extending ? 'Extendiendo…' : `Extender +${days || 0} días`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── Transcript Modal ─── */}
        {showTranscriptModal && !showReview && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowTranscriptModal(false); }}>
            <div style={{ ...S.modal, maxWidth: 640 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Generar cotización desde transcripción</h3>
                <button onClick={() => setShowTranscriptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#999', margin: '0 0 12px' }}>Pega la transcripción de tu llamada. La IA extraerá los datos del cliente, recomendará un plan y generará los puntos clave.</p>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Pega aquí la transcripción completa de la llamada..." style={{ ...S.input, height: 320, resize: 'vertical' as const, fontSize: '0.75rem', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: '0.625rem', color: '#ccc' }}>{transcript.length.toLocaleString()} caracteres</span>
                <button onClick={async () => {
                  if (transcript.length < 100) { alert('La transcripción es muy corta. Mínimo 100 caracteres.'); return; }
                  setAnalyzing(true);
                  try {
                    const res = await fetch('/api/revenue/analyze-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) });
                    const data = await res.json();
                    if (data.error) { alert(data.error); setAnalyzing(false); return; }
                    setAnalysisResult(data);
                    setShowReview(true);
                  } catch { alert('Error de conexión. Intenta de nuevo.'); }
                  setAnalyzing(false);
                }} disabled={analyzing || transcript.length < 100} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', opacity: analyzing || transcript.length < 100 ? 0.5 : 1 }}>
                  {analyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Analysis Review Screen ─── */}
        {showReview && analysisResult && (
          <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Resultado del análisis</h3>
                {analysisResult.confidence != null && (
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: analysisResult.confidence >= 0.7 ? '#2AB5A0' : '#E8A838', background: analysisResult.confidence >= 0.7 ? 'rgba(42,181,160,0.08)' : 'rgba(232,168,56,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                    Confianza: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const r = analysisResult;
                  const rec = r.recommendation || {};
                  const planPrice = PLAN_PRICES[rec.plan] || 900;
                  const discPct = parseFloat(rec.descuento_pct) || 0;
                  const suc = parseInt(rec.sucursales) || 1;
                  const isAnn = rec.periodo === 'anual';
                  const planSub = planPrice * suc * (isAnn ? 10 : 1);
                  const planDisc = planSub * (discPct / 100);
                  const planItems: any[] = [{
                    tipo: 'plan', nombre: rec.plan || 'controla',
                    sucursales: suc, precio_unitario: planPrice,
                    periodo: rec.periodo || 'mensual',
                    descuento_pct: discPct,
                    subtotal: planSub - planDisc,
                  }];
                  const extraItems = (rec.extras || []).map((e: any) => ({
                    tipo: 'extra', nombre: e.nombre, monto: e.monto || 0,
                    descripcion: e.descripcion || '', nota: e.nota || '',
                    periodo_extra: e.periodo_extra || 'unico',
                    recurrente: e.periodo_extra === 'mensual' || e.periodo_extra === 'anual',
                    subtotal: e.periodo_extra === 'anual' ? (e.monto || 0) * 10 : (e.monto || 0),
                  }));
                  // Promoción
                  const promo = rec.promocion;
                  if (promo?.aplicar) {
                    extraItems.push({
                      tipo: 'extra', nombre: promo.nombre || 'Implementación y configuración',
                      descripcion: promo.descripcion || 'Setup inicial, migración y capacitación. Aplica al contratar plan anual.',
                      monto: 0, precio_original: promo.precio_original || IMPL_PRICES[rec.plan] || 4000,
                      es_promocion: true, recurrente: false, subtotal: 0,
                    });
                  }
                  // IVA mode
                  const ivaMode = rec.iva_mode || 'sin';
                  // Notas extra → condiciones
                  const notasExtra = (r.notas_extra || []).filter(Boolean);
                  const condBase = 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.';
                  const condiciones = notasExtra.length > 0 ? condBase + '\n\n' + notasExtra.join('\n') : condBase;
                  setQf({
                    empresa: r.client?.empresa || '', contacto: r.client?.contacto || '',
                    email: r.client?.email || '', whatsapp: r.client?.whatsapp || '',
                    items: [...planItems, ...extraItems],
                    iva_incluido: ivaMode !== 'sin', iva_mode: ivaMode,
                    descuento_global: 0, descuento_tipo: 'pct',
                    moneda: 'MXN', template: 'modern', condiciones,
                    key_points: r.key_points || [], mostrar_key_points: true,
                    roi: r.roi || null, mostrar_roi: !!(r.roi?.ahorro_mensual),
                    antes_despues: r.antes_despues || [], mostrar_antes_despues: (r.antes_despues || []).length > 0,
                    mostrar_firma: true, mostrar_qr: true, mostrar_animaciones: true,
                  });
                  setShowReview(false); setShowTranscriptModal(false); setShowDrawer(true);
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Aplicar al formulario</button>
                <button onClick={() => { setShowReview(false); setShowTranscriptModal(false); }} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Descartar</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gap: 16 }}>
                {/* Client info */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Cliente detectado</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Empresa</label><input value={analysisResult.client?.empresa || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, empresa: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Contacto</label><input value={analysisResult.client?.contacto || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, contacto: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Email</label><input value={analysisResult.client?.email || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, email: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>WhatsApp</label><input value={analysisResult.client?.whatsapp || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, whatsapp: e.target.value } })} style={S.input} /></div>
                  </div>
                </div>

                {/* Plan recommendation */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Plan recomendado</h3>
                  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' as const }}>{analysisResult.recommendation?.reasoning}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Plan</label><select value={analysisResult.recommendation?.plan || 'controla'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, plan: e.target.value } })} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]}/mes)</option>)}</select></div>
                    <div><label style={S.label}>Sucursales</label><input type="number" value={analysisResult.recommendation?.sucursales || 1} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, sucursales: parseInt(e.target.value) || 1 } })} style={S.input} /></div>
                    <div><label style={S.label}>Periodo</label><select value={analysisResult.recommendation?.periodo || 'mensual'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, periodo: e.target.value } })} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></div>
                  </div>
                  {(analysisResult.recommendation?.extras || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={S.label}>Extras sugeridos</div>
                      {analysisResult.recommendation.extras.map((ex: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <span style={{ flex: 1, fontSize: '0.8125rem' }}><strong>{ex.nombre}</strong> — {ex.descripcion} <span style={{ color: '#2AB5A0', fontWeight: 700 }}>{fmt(ex.monto || 0)}</span></span>
                          <button onClick={() => { const extras = [...analysisResult.recommendation.extras]; extras.splice(i, 1); setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, extras } }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* IVA, Descuento, Promo */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div><label style={S.label}>IVA</label><select value={analysisResult.recommendation?.iva_mode || 'sin'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, iva_mode: e.target.value } })} style={S.input}><option value="sin">Sin IVA</option><option value="suma">Sumar 16%</option><option value="incluido">Incluido en precios</option></select></div>
                    <div><label style={S.label}>Descuento plan (%)</label><input type="number" value={analysisResult.recommendation?.descuento_pct || 0} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, descuento_pct: parseFloat(e.target.value) || 0 } })} style={S.input} /></div>
                  </div>
                  {analysisResult.recommendation?.promocion?.aplicar && (
                    <div style={{ marginTop: 10, padding: 10, background: '#ecfdf5', borderRadius: 8, border: '1px solid #2AB5A0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>PROMO</span>
                        <strong style={{ fontSize: '0.8125rem' }}>{analysisResult.recommendation.promocion.nombre}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 8 }}><s>{fmt(analysisResult.recommendation.promocion.precio_original || 0)}</s> → $0</span>
                      </div>
                      <button onClick={() => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, promocion: { ...analysisResult.recommendation.promocion, aplicar: false } } })} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  )}
                </div>

                {/* Notas extra */}
                {(analysisResult.notas_extra || []).length > 0 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>Notas extra</h3>
                    <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 8px' }}>Observaciones adicionales que se agregan a las condiciones de la cotización</p>
                    {analysisResult.notas_extra.map((nota: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <input value={nota} onChange={e => { const n = [...analysisResult.notas_extra]; n[i] = e.target.value; setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} />
                        <button onClick={() => { const n = [...analysisResult.notas_extra]; n.splice(i, 1); setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key points (Minuta) */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Minuta de la reunión ({(analysisResult.key_points || []).length})</h3>
                  <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 12px' }}>Estos puntos aparecerán en la cotización como "Minuta de la reunión"</p>
                  {(analysisResult.key_points || []).map((kp: any, i: number) => (
                    <div key={i} style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: `3px solid ${M.violeta}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <input value={kp.title} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.input, fontWeight: 700, marginBottom: 4 }} />
                          <textarea value={kp.detail} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} rows={2} style={{ ...S.input, fontSize: '0.75rem' }} />
                        </div>
                        <button onClick={() => { const kps = [...analysisResult.key_points]; kps.splice(i, 1); setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', flexShrink: 0 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setAnalysisResult({ ...analysisResult, key_points: [...(analysisResult.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Quote Drawer ─── */}
        {showDrawer && (
          <div className="rh-quote-drawer" style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            {/* Top bar */}
            <div className="rh-quote-topbar" style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{qf.id ? `Editar ${qf.numero || 'cotización'}` : 'Nueva cotización'}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={createQuote} disabled={saving || !items.length || !qf.empresa} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', fontSize: '0.75rem', padding: '6px 16px' }}>{saving ? 'Guardando...' : qf.id ? 'Guardar cambios' : 'Crear y enviar'}</button>
                <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
            </div>
            {/* Split layout */}
            <div className="rh-quote-split" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: Form */}
            <div className="rh-quote-form" style={{ width: 640, flexShrink: 0, background: '#fff', overflowY: 'auto' as const, padding: 24, borderRight: '1px solid #eee' }}>

              {/* ── Cliente ──
                  Un buscador sobre clientes Y leads a la vez: quien cotiza no
                  sabe —ni tiene por qué— en qué tabla está esa persona. Elegir
                  aquí es lo que LIGA la cotización; escribiéndola a mano nace
                  desconectada y no aparece en la ficha de nadie (es lo que pasó
                  con las 32 que hay hoy). */}
              <div style={S.label}>Cliente</div>
              {qf.company_id ? (
                <div style={{ background: '#f7f9fc', border: '1px solid #e2e8f2', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {qf.empresa}
                        {(() => {
                          const cl = qf._clase || (qf._es_cliente ? 'cliente' : 'lead');
                          const est: Record<string, any> = {
                            cliente: { t: 'Cliente', bg: '#f0e9ff', fg: '#6d4bc7' },
                            lead: { t: 'Lead', bg: '#e8f0fd', fg: '#3764c4' },
                            excliente: { t: 'Excliente', bg: '#f4f5f7', fg: '#5b6472' },
                          };
                          const e = est[cl] || est.lead;
                          return <span style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: e.bg, color: e.fg }}>{e.t}</span>;
                        })()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#888' }}>{[qf.contacto, qf.email, qf.whatsapp].filter(Boolean).join(' · ') || 'sin contacto'}</div>
                      {qf._ctx_n ? (
                        <div style={{ fontSize: '0.72rem', color: '#a06600', marginTop: 2 }}>
                          Ya tiene {qf._ctx_n} cotización{qf._ctx_n === 1 ? '' : 'es'}{qf._ctx_ultima ? ` · última ${qf._ctx_ultima}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => setQf({ ...qf, company_id: null, contact_id: null, _es_cliente: false, _clase: '', _ctx_n: 0, _ctx_ultima: '' })}
                      style={{ ...S.btnSmall, marginRight: 0 }}>Cambiar</button>
                  </div>
                  {/* Decirlo explícito: si no, no hay forma de saber si el clic
                      en el buscador sí agarró. */}
                  <div style={{ fontSize: '0.7rem', color: '#0f7a56', marginTop: 6 }}>
                    Ligada — ya aparece en su ficha y en su historial.
                  </div>
                </div>
              ) : (
                <ClienteBuscador
                  valorInicial={qf.empresa || ''}
                  datos={{ empresa: qf.empresa, contacto: qf.contacto, email: qf.email, whatsapp: qf.whatsapp }}
                  onElegir={(r: any) => setQf({
                    ...qf, company_id: r.company_id, contact_id: r.contact_id || null,
                    empresa: r.empresa || r.contacto, contacto: r.contacto || '',
                    email: r.email || qf.email || '', whatsapp: r.whatsapp || qf.whatsapp || '',
                    _es_cliente: !!r.es_cliente, _clase: r.clase || (r.es_cliente ? 'cliente' : 'lead'), _ctx_n: r.n || 0,
                    _ctx_ultima: r.ultima ? `${r.ultima.numero} · $${Number(r.ultima.total || 0).toLocaleString('es-MX')} · ${r.ultima.estado}` : '',
                  })}
                />
              )}
              {/* Estos cuatro son lo que se IMPRIME. Se pueden cambiar sin
                  tocar la ficha del cliente: un contacto distinto para esta
                  cotización es un caso real y no debe editar el CRM. */}
              <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#a3a3a3', textTransform: 'uppercase' as const, letterSpacing: '.07em', margin: '14px 0 7px' }}>
                Datos que salen en la cotización
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={qf.empresa || ''} onChange={e => setQf({ ...qf, empresa: e.target.value })} placeholder="Empresa *" required style={{ ...S.input, borderColor: !qf.empresa ? '#fca5a5' : undefined }} />
                <input value={qf.contacto || ''} onChange={e => setQf({ ...qf, contacto: e.target.value })} placeholder="Contacto" style={S.input} />
                <input value={qf.email || ''} onChange={e => setQf({ ...qf, email: e.target.value })} placeholder="Email *" required type="email" style={{ ...S.input, borderColor: !qf.email ? '#fca5a5' : undefined }} />
                <input value={qf.whatsapp || ''} onChange={e => setQf({ ...qf, whatsapp: e.target.value })} placeholder="WhatsApp *" required type="tel" style={{ ...S.input, borderColor: !qf.whatsapp ? '#fca5a5' : undefined }} />
              </div>
              {/* Aviso, no candado: cotizar rápido en una llamada es un caso real
                  y bloquear el guardado haría que se escriba cualquier cosa con
                  tal de avanzar. El candado va al aceptar o cobrar. */}
              {!qf.company_id && (qf.empresa || '').trim().length > 1 && (
                <div style={{ fontSize: '0.7rem', color: '#b45309', marginBottom: 8 }}>
                  ⚠ Sin cliente ligado: no va a aparecer en su ficha ni en su historial. Búscalo arriba o créalo.
                </div>
              )}

              {/* Client logo */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Logo del cliente (opcional)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {qf.logo_url ? (
                    <div style={{ position: 'relative' as const, width: 48, height: 48, borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden', flexShrink: 0, background: '#fafafa' }}>
                      <img src={qf.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' as const }} />
                      <button onClick={() => setQf({ ...qf, logo_url: '' })} style={{ position: 'absolute' as const, top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#E54B4B', color: '#fff', border: 'none', fontSize: '0.625rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ) : null}
                  <label style={{ ...S.btnSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flex: qf.logo_url ? undefined : 1, justifyContent: 'center' as const }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {qf.logo_url ? 'Cambiar' : 'Subir logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (data.url) setQf({ ...qf, logo_url: data.url });
                      else alert(data.error || 'Error al subir');
                      e.target.value = '';
                    }} />
                  </label>
                  {qf.logo_url && <input value={qf.logo_url} onChange={e => setQf({ ...qf, logo_url: e.target.value })} placeholder="URL del logo" style={{ ...S.input, flex: 1, fontSize: '0.6875rem' }} />}
                </div>
              </div>

              {/* Items */}
              {/* ── Minuta de la reunión ──
                  Va ANTES de los conceptos porque es la que dice qué se acordó:
                  cuántas sucursales, qué le urge, qué descuento se prometió.
                  Estaba hasta el fondo, después de los toggles, y ahí se llenaba
                  —si se llenaba— cuando la cotización ya estaba armada. */}
              {(qf.mostrar_key_points !== false) && (
                <div style={{ marginTop: 12, background: '#fafbfd', border: '1px solid #e8eaf0', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={S.label}>Minuta de la reunión</div>
                    <div style={{ fontSize: '0.625rem', color: '#999' }}>{(qf.key_points || []).length} {((qf.key_points || []).length === 1 ? 'punto' : 'puntos')}</div>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#777', marginBottom: 8, lineHeight: 1.5 }}>
                    Pega aquí los puntos raw que platicaste con el cliente. Después da clic en <strong>Estructurar con IA</strong> y lo acomodamos en una minuta profesional.
                  </div>
                  <textarea
                    value={qf.minuta_raw || ''}
                    onChange={e => setQf({ ...qf, minuta_raw: e.target.value })}
                    placeholder="Ej. cliente tiene 3 sucursales, le urge controlar inventario porque pierde 200 piezas al mes; quiere migrar de microsip; le gusta lealtad por whatsapp; presupuesto ~25k; cierra en mayo; pidió descuento si paga anual..."
                    rows={5}
                    style={{ ...S.input, fontSize: '0.75rem', resize: 'vertical' as const, minHeight: 100, fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' as const }}>
                    <button
                      onClick={formatMinuta}
                      disabled={formattingMinuta || !(qf.minuta_raw || '').trim()}
                      style={{ ...S.btnSmall, background: '#1a1a1a', color: '#fff', padding: '6px 14px', opacity: formattingMinuta || !(qf.minuta_raw || '').trim() ? 0.5 : 1, cursor: formattingMinuta || !(qf.minuta_raw || '').trim() ? 'not-allowed' : 'pointer' }}
                    >
                      {formattingMinuta ? '⏳ Procesando…' : '✨ Estructurar con IA'}
                    </button>
                    {(qf.key_points || []).length > 0 && (
                      <button
                        onClick={() => { if (confirm('¿Borrar los puntos actuales y dejar el editor vacío?')) setQf({ ...qf, key_points: [] }); }}
                        style={{ ...S.btnSmall, color: '#999' }}
                      >
                        Limpiar puntos
                      </button>
                    )}
                    <span style={{ fontSize: '0.625rem', color: '#bbb' }}>Mín. 30 caracteres</span>
                  </div>
                  {minutaError && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, fontSize: '0.6875rem', color: '#c53030' }}>
                      {minutaError}
                    </div>
                  )}

                  {(qf.key_points || []).length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e0e3eb' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Puntos estructurados</div>
                      {qf.key_points.map((kp: any, i: number) => (
                        <div key={i} style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: `3px solid ${M.violeta}`, display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <input value={kp.title} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Título" style={{ ...S.input, fontWeight: 700, fontSize: '0.75rem', marginBottom: 4 }} />
                            <input value={kp.detail} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Detalle" style={{ ...S.input, fontSize: '0.6875rem' }} />
                          </div>
                          <button onClick={() => { const kps = [...qf.key_points]; kps.splice(i, 1); setQf({ ...qf, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', alignSelf: 'flex-start' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => setQf({ ...qf, key_points: [...(qf.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto manual</button>
                    </div>
                  )}
                </div>
              )}


              <div style={S.label}>Conceptos</div>
              {items.map((it: any, i: number) => [it, i] as [any, number]).filter((par: [any, number]) => !par[0].es_promocion).map((par: [any, number]) => renderItem(par[0], par[1]))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <button onClick={addPlanItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plan SACS</button>
                <button onClick={addPluginItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plugin</button>
                <button onClick={addPersonalizacionItem} style={{ ...S.btnSmall, flex: 1 }}>+ Personalización</button>
                <button onClick={addExtraItem} style={{ ...S.btnSmall, flex: 1 }}>+ Extra</button>
              </div>

              {/* ── Promociones y cortesías ──
                  Sección aparte, no un botón más en la fila de conceptos. Una
                  promoción no es un concepto: es un concepto con precio tachado.
                  Revueltos, se escoge por color y se acaba metiendo una cortesía
                  donde iba un cobro. */}
              <div style={S.label}>Promociones y cortesías</div>
              {items.map((it: any, i: number) => [it, i] as [any, number]).filter((par: [any, number]) => par[0].es_promocion).map((par: [any, number]) => renderItem(par[0], par[1]))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button onClick={() => {
                  const mainPlan = items.find((i: any) => i.tipo === 'plan')?.nombre || 'controla';
                  const precio = IMPL_PRICES[mainPlan] || 4000;
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: 'Implementacion y configuracion', descripcion: 'Setup inicial, migracion de datos y capacitacion. Aplica al contratar plan anual.', monto: 0, precio_original: precio, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Implementación de cortesía</button>
                <button onClick={() => {
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', descripcion: '', monto: 0, precio_original: 0, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Promoción libre</button>
              </div>
              {/* Cuánto se está regalando, en un solo número. Hoy no aparecía en
                  ningún lado: se veía concepto por concepto y nunca el total. */}
              {(() => {
                const regalado = items.filter((i: any) => i.es_promocion)
                  .reduce((a: number, i: number | any) => a + (Number(i.precio_original || 0) - Number(i.monto || 0)), 0);
                if (regalado <= 0) return null;
                return (
                  <div style={{ fontSize: '0.72rem', color: '#1A8F7A', background: '#eefaf7', borderRadius: 7, padding: '8px 10px', marginBottom: 16, fontWeight: 600 }}>
                    Estás regalando {fmt(regalado)} en esta cotización
                  </div>
                );
              })()}

              {/* ── Paquetes ──
                  Cambia la pregunta: de "¿compras?" a "¿cuál?". Solo tiene
                  sentido con la plantilla Interactiva, así que se enciende sola
                  al elegirla y se avisa si falta una de las dos cosas. */}
              <div style={{ marginBottom: 14, borderTop: '1px solid #f0f0f2', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={paquetesOn} onChange={togglePaquetes} />
                  Ofrecer 2–3 opciones al cliente
                </label>
                {paquetesOn && (
                  <div style={{ marginTop: 10, background: '#f8f9fb', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: '0.71rem', color: '#777', marginBottom: 8, lineHeight: 1.5 }}>
                      Asigna cada concepto a una opción con el selector de su tarjeta, o déjalo en todas.
                    </div>
                    {paquetes.map((p: any, pi: number) => {
                      const n = items.filter((it: any) => !it.paquete || it.paquete === p.id).length;
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <input value={p.nombre}
                            onChange={e => setQf({ ...qf, paquetes: paquetes.map((x: any, i: number) => i === pi ? { ...x, nombre: e.target.value } : x) })}
                            style={{ ...S.input, maxWidth: 200 }} />
                          <span style={{ fontSize: '0.72rem', color: '#888' }}>{n} concepto{n === 1 ? '' : 's'} · <b style={{ color: '#1a1a1a' }}>{fmt(totalDePaquete(p.id))}</b></span>
                          {paquetes.length > 2 && (
                            <button onClick={() => setQf({ ...qf, paquetes: paquetes.filter((_: any, i: number) => i !== pi), items: items.map((it: any) => it.paquete === p.id ? { ...it, paquete: undefined } : it) })}
                              style={{ background: 'none', border: 'none', color: '#E54B4B', cursor: 'pointer' }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                    {paquetes.length < 3 && (
                      <button onClick={() => {
                        const usados = paquetes.map((p: any) => p.id);
                        const next = ['a', 'b', 'c'].find(x => !usados.includes(x)) || 'c';
                        setQf({ ...qf, paquetes: [...paquetes, { id: next, nombre: 'Opción Premium' }] });
                      }} style={S.btnSmall}>+ Otra opción</button>
                    )}
                    <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 8 }}>
                      El total de la cotización es el de la primera opción. Cuando el cliente elija otra y acepte, el documento se queda con esa.
                    </div>
                  </div>
                )}
                {/* Las dos mitades tienen que ir juntas: paquetes sin plantilla
                    Interactiva se ven como una lista más, y la plantilla sin
                    paquetes no tiene nada que ofrecer. */}
                {paquetesOn && qf.template !== 'interactiva' && (
                  <div style={{ fontSize: '0.71rem', color: '#b45309', marginTop: 8 }}>
                    Tienes opciones armadas pero la plantilla no es la Interactiva.
                    <button onClick={() => setQf({ ...qf, template: 'interactiva' })} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontWeight: 700, fontSize: '0.71rem' }}>Cambiar a Interactiva</button>
                  </div>
                )}
                {!paquetesOn && qf.template === 'interactiva' && (
                  <div style={{ fontSize: '0.71rem', color: '#b45309', marginTop: 8 }}>
                    La plantilla Interactiva necesita opciones para que el cliente elija.
                    <button onClick={togglePaquetes} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontWeight: 700, fontSize: '0.71rem' }}>Crear dos opciones</button>
                  </div>
                )}
              </div>

              {/* Totals & Config */}
              <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 8 }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700 }}>{fmt(itemsSubtotal)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Desc. global</label><input type="number" value={qf.descuento_global || 0} onChange={e => setQf({ ...qf, descuento_global: e.target.value })} style={S.input} /></div>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Tipo</label><select value={qf.descuento_tipo} onChange={e => setQf({ ...qf, descuento_tipo: e.target.value })} style={S.input}><option value="pct">Porcentaje %</option><option value="fijo">Monto fijo $</option></select></div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...S.label, marginTop: 0 }}>IVA</label>
                  <select value={ivaMode} onChange={e => setQf({ ...qf, iva_mode: e.target.value })} style={S.input}>
                    <option value="sin">Sin IVA</option>
                    <option value="suma">Sumar IVA 16% al total</option>
                    <option value="incluido">IVA incluido en precios</option>
                  </select>
                </div>
                {ivaMode !== 'sin' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                    <span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span>
                    <span>{fmt(ivaMonto)}</span>
                  </div>
                )}
                {ivaMode === 'incluido' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#999', marginBottom: 4 }}>
                    <span>Subtotal sin IVA</span>
                    <span>{fmt(afterDisc / 1.16)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                </div>
              </div>

              {/* ── Parcialidades ──
                  Cuando se pacta en pagos, las FECHAS se acuerdan al cotizar, no
                  después: son parte del trato. Guardarlas aquí es lo que permite
                  saber qué debería entrar cada mes y cobrar a tiempo, en vez de
                  descubrir el vencimiento cuando ya pasó. */}
              {(() => {
                const plan: any[] = Array.isArray(qf.plan_pagos) ? qf.plan_pagos : [];
                const setPlan = (p: any[]) => setQf({ ...qf, plan_pagos: p });
                const sumado = plan.reduce((a, x) => a + (Number(x.monto) || 0), 0);
                const totalQ = Number(qf.total || 0);
                const fin = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
                return (
                  <div style={{ marginTop: 12, background: '#fafbfd', border: '1px solid #e8eaf0', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label style={{ ...S.label, marginTop: 0, marginBottom: 0, flex: 1 }}>Plan de pagos (parcialidades)</label>
                      <button onClick={() => setPlan([...plan, { id: 'p' + Date.now().toString(36) + plan.length, fecha: fin(plan.length), monto: '', concepto: plan.length === 0 ? 'Anticipo' : `Parcialidad ${plan.length + 1}` }])}
                        style={{ ...S.btnSmall, marginRight: 0 }}>+ Parcialidad</button>
                      {plan.length === 0 && totalQ > 0 && (
                        <button onClick={() => setPlan([
                          { id: 'p1', fecha: fin(0), monto: Math.round(totalQ / 2), concepto: 'Anticipo 50%' },
                          { id: 'p2', fecha: fin(1), monto: totalQ - Math.round(totalQ / 2), concepto: 'Liquidación 50%' },
                        ])} style={{ ...S.btnSmall, marginRight: 0 }}>50 / 50</button>
                      )}
                    </div>
                    {plan.length === 0 ? (
                      <div style={{ fontSize: '0.7rem', color: '#999' }}>Sin parcialidades: se cobra en un solo pago.</div>
                    ) : plan.map((x: any, i: number) => (
                      <div key={x.id || i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                        <input value={x.concepto || ''} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, concepto: e.target.value } : y))}
                          placeholder="concepto" style={{ ...S.input, flex: 1, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <input type="date" value={x.fecha || ''} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, fecha: e.target.value } : y))}
                          style={{ ...S.input, width: 140, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <input type="number" value={x.monto} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, monto: e.target.value } : y))}
                          placeholder="monto" style={{ ...S.input, width: 110, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <button onClick={() => setPlan(plan.filter((_, j) => j !== i))} style={{ ...S.btnSmall, marginRight: 0, color: '#b93333' }}>✕</button>
                      </div>
                    ))}
                    {plan.length > 0 && (
                      /* El descuadre se avisa, no se corrige solo: puede ser
                         intencional (un saldo que se define después) y ajustar
                         a la fuerza cambiaría lo pactado sin avisar. */
                      <div style={{ fontSize: '0.7rem', marginTop: 4, color: Math.abs(sumado - totalQ) < 1 ? '#2e7d32' : '#b45309' }}>
                        Suman {fmt(sumado)} de {fmt(totalQ)}
                        {Math.abs(sumado - totalQ) >= 1 ? ` · faltan ${fmt(totalQ - sumado)} por repartir` : ' · cuadra'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Plantilla ──
                  Escondida en un <select> junto a la moneda, nadie la cambiaba:
                  no se veía qué hacía cada una. Aquí se elige viendo el nombre y
                  para qué sirve, y la vista previa de la derecha cambia al
                  instante. */}
              <div style={{ marginBottom: 14 }}>
                <div style={S.label}>Plantilla</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {[
                    { id: 'modern', n: 'Moderna', d: 'Color de marca y contador. La de siempre.' },
                    { id: 'dark', n: 'Oscura', d: 'La misma, en fondo negro.' },
                    { id: 'interactiva', n: 'Interactiva', d: 'El cliente elige entre 2–3 opciones.' },
                    { id: 'ejecutiva', n: 'Ejecutiva', d: 'Una pantalla: problema, número y arranque.' },
                  ].map(t => {
                    const on = (qf.template || 'modern') === t.id;
                    return (
                      <button key={t.id} onClick={() => setQf({ ...qf, template: t.id })}
                        style={{ textAlign: 'left' as const, cursor: 'pointer', borderRadius: 9, padding: '9px 11px',
                          border: '1.5px solid', borderColor: on ? '#1a1a1a' : '#e2e2e8', background: on ? '#1a1a1a' : '#fff' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: on ? '#fff' : '#1a1a1a' }}>{t.n}</div>
                        <div style={{ fontSize: '0.65rem', color: on ? 'rgba(255,255,255,.6)' : '#9a9a9a', marginTop: 1, lineHeight: 1.35 }}>{t.d}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><label style={S.label}>Moneda</label><select value={qf.moneda} onChange={e => setQf({ ...qf, moneda: e.target.value })} style={S.input}><option value="MXN">MXN</option><option value="USD">USD</option></select></div>
                <div />
              </div>

              {/* Promo label */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Etiqueta de promoción <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  value={qf.promo_label || ''}
                  onChange={e => setQf({ ...qf, promo_label: e.target.value.toUpperCase().slice(0, 40) })}
                  placeholder="Ej. VERANO -20%, OFERTA MAYO, FUNDADORES SACS"
                  style={S.input}
                />
                <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: 4 }}>
                  Aparece junto al contador en la cotización del cliente. Máx. 40 caracteres.
                </div>
              </div>

              {/* Alta rápida de cuenta: salir a Configuración a medio cotizar
                  es la razón por la que la cotización se manda sin datos de pago. */}
              {altaBanco && (
                <div style={{ background: '#fafbfd', border: '1px dashed #cfd6e4', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', marginBottom: 8 }}>Nueva cuenta bancaria</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={altaBanco.alias} onChange={e => setAltaBanco({ ...altaBanco, alias: e.target.value })} placeholder="Alias — ej. BBVA pesos" style={S.input} />
                    <input value={altaBanco.banco} onChange={e => setAltaBanco({ ...altaBanco, banco: e.target.value })} placeholder="Banco *" style={S.input} />
                    <input value={altaBanco.titular} onChange={e => setAltaBanco({ ...altaBanco, titular: e.target.value })} placeholder="Titular" style={S.input} />
                    <input value={altaBanco.cuenta} onChange={e => setAltaBanco({ ...altaBanco, cuenta: e.target.value })} placeholder="Cuenta" style={S.input} />
                    <input value={altaBanco.clabe} onChange={e => setAltaBanco({ ...altaBanco, clabe: e.target.value })} placeholder="CLABE" style={S.input} />
                    <input value={altaBanco.rfc} onChange={e => setAltaBanco({ ...altaBanco, rfc: e.target.value })} placeholder="RFC" style={S.input} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={async () => {
                      if (!altaBanco.banco.trim()) { alert('El banco es obligatorio.'); return; }
                      const r = await fetch('/api/revenue/bank-accounts', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...altaBanco, activa: true, es_default: bankAccounts.length === 0 }),
                      }).then(x => x.json()).catch(() => null);
                      if (!r?.id) { alert('No se pudo guardar la cuenta.'); return; }
                      setBankAccounts([...bankAccounts, r]);
                      // Se selecciona sola: se dio de alta para usarla ahora.
                      setQf({ ...qf, bank_account_id: r.id, mostrar_banco: true });
                      setAltaBanco(null);
                    }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Guardar y usar</button>
                    <button onClick={() => setAltaBanco(null)} style={{ ...S.btnSmall, marginRight: 0 }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Bank account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={S.label}>Cuenta bancaria</label>
                  <select value={qf.bank_account_id || ''} onChange={e => setQf({ ...qf, bank_account_id: e.target.value || null, mostrar_banco: !!e.target.value })} style={S.input}>
                    <option value="">Sin cuenta bancaria</option>
                    {/* El alias primero: con dos cuentas del mismo banco, "BBVA
                        - 1234" y "BBVA - 5678" no se distinguen de un vistazo. */}
                    {bankAccounts.map((ba: any) => (
                      <option key={ba.id} value={ba.id}>
                        {ba.alias ? `${ba.alias} · ` : ''}{ba.banco}{ba.cuenta ? ` - ${ba.cuenta}` : ''}{ba.es_default ? ' (predeterminada)' : ''}
                      </option>
                    ))}
                  </select>
                  {bankAccounts.length === 0 ? (
                    // Antes solo decía "Sin cuenta bancaria" y parecía roto. No
                    // lo está: no hay ninguna capturada.
                    <button onClick={() => setAltaBanco({ banco: '', alias: '', titular: '', cuenta: '', clabe: '', rfc: '' })}
                      style={{ ...S.btnSmall, marginTop: 6, marginRight: 0, width: '100%' }}>
                      No hay cuentas capturadas · + Agregar una
                    </button>
                  ) : (
                    <button onClick={() => setAltaBanco({ banco: '', alias: '', titular: '', cuenta: '', clabe: '', rfc: '' })}
                      style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, padding: '4px 0 0' }}>
                      + Agregar cuenta
                    </button>
                  )}
                </div>
                <div>
                  <label style={S.label}>Vigencia</label>
                  <select value={qf.urgencia || 'normal'} onChange={e => {
                    const v = e.target.value;
                    const daysMap: Record<string, number> = { normal: 15, urgente: 5, oferta: 3 };
                    const days = daysMap[v];
                    if (days) {
                      const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
                      setQf({ ...qf, urgencia: v, vigencia: date });
                    } else {
                      setQf({ ...qf, urgencia: v });
                    }
                  }} style={S.input}>
                    <option value="normal">Normal (15 dias)</option>
                    <option value="urgente">Urgente (5 dias)</option>
                    <option value="oferta">Oferta limitada (3 dias)</option>
                    <option value="custom">Personalizada</option>
                  </select>
                </div>
              </div>

              {/* Custom vigencia */}
              {qf.urgencia === 'custom' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Dias de vigencia</label>
                    <input type="number" min="1" placeholder="Ej. 30" value={qf._custom_days || ''} onChange={e => {
                      const days = parseInt(e.target.value) || 0;
                      const date = days > 0 ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : '';
                      setQf({ ...qf, _custom_days: e.target.value, vigencia: date });
                    }} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>O fecha exacta</label>
                    <input type="date" value={qf.vigencia || ''} onChange={e => {
                      const date = e.target.value;
                      const days = date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000) : 0;
                      setQf({ ...qf, vigencia: date, _custom_days: days > 0 ? String(days) : '' });
                    }} style={S.input} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: -8, marginBottom: 12 }}>
                  Vence: {fmtDate(qf.vigencia)}
                </div>
              )}

              {/* Link de pago */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Link de pago</label>
                <select value={qf._pago_mode || (qf.link_pago ? 'manual' : 'none')} onChange={e => {
                  const v = e.target.value;
                  if (v === 'none') setQf({ ...qf, _pago_mode: v, link_pago: '' });
                  else setQf({ ...qf, _pago_mode: v });
                }} style={S.input}>
                  <option value="none">Sin link de pago</option>
                  <option value="stripe">Stripe (automatico)</option>
                  <option value="manual">Link manual</option>
                </select>
                {(qf._pago_mode || (qf.link_pago ? 'manual' : 'none')) === 'manual' && (
                  <input value={qf.link_pago || ''} onChange={e => setQf({ ...qf, link_pago: e.target.value })} placeholder="https://..." style={{ ...S.input, marginTop: 6 }} />
                )}
                {(qf._pago_mode || '') === 'stripe' && (
                  <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 6 }}>
                    Se generara un link de Stripe Checkout al guardar la cotización
                  </div>
                )}
              </div>

              {/* Visibility toggles */}
              <div style={{ marginBottom: 12 }}>
                {/* ── Mostrar en cotización ──
                    Trece casillas en fila hacían que ninguna se leyera. Arriba
                    quedan las tres que sí se deciden por cliente; el resto vive
                    detrás de "Ver más" porque se pone una vez y no se vuelve a
                    tocar. */}
                <div style={S.label}>Mostrar en cotización</div>
                {(() => {
                  const OPCIONES = [
                    { key: 'mostrar_timer', label: 'Contador de tiempo (urgencia)', default: true, principal: true },
                    { key: 'mostrar_features', label: 'Detalle del plan (qué incluye)', default: true, principal: true },
                    { key: 'mostrar_firma', label: 'Firma digital', default: true, principal: true },
                    { key: 'mostrar_desglose', label: 'Resumen de pagos', default: true },
                    { key: 'mostrar_condiciones', label: 'Condiciones', default: true },
                    { key: 'mostrar_key_points', label: 'Minuta de la reunión', default: true },
                    { key: 'mostrar_roi', label: 'Calculadora de ROI', default: false },
                    { key: 'mostrar_antes_despues', label: 'Antes vs Después', default: false },
                    { key: 'mostrar_timeline', label: 'Timeline de implementación', default: true },
                    { key: 'mostrar_implementacion', label: 'Proceso de implementación', default: true },
                    { key: 'mostrar_porque_sacs', label: '¿Por qué SACS? (historia, casos de éxito)', default: true },
                    { key: 'mostrar_qr', label: 'Código QR', default: true },
                    { key: 'mostrar_animaciones', label: 'Números animados', default: true },
                  ];
                  const val = (o: any) => (qf[o.key] !== undefined ? qf[o.key] : o.default);
                  const secundarias = OPCIONES.filter(o => !o.principal);
                  // Cuántas de las de abajo están apagadas: si alguien las movió,
                  // hay que poder verlo sin abrir el bloque.
                  const apagadas = secundarias.filter(o => !val(o)).length;
                  const fila = (o: any) => (
                    <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                      <input type="checkbox" checked={val(o)} onChange={e => setQf({ ...qf, [o.key]: e.target.checked })} />
                      {o.label}
                    </label>
                  );
                  return (
                    <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                        {OPCIONES.filter(o => o.principal).map(fila)}
                      </div>
                      <button onClick={() => setVerMasOpc(!verMasOpc)}
                        style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: '8px 0 0' }}>
                        {verMasOpc ? 'Ver menos' : `Ver más (${secundarias.length})`}
                        {!verMasOpc && apagadas > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}> · {apagadas} apagada{apagadas === 1 ? '' : 's'}</span>}
                      </button>
                      {verMasOpc && (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid #ecedf1' }}>
                          {secundarias.map(fila)}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Timeline type selector */}
                {(qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true) && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...S.label, marginTop: 0 }}>Tipo de timeline</label>
                    <select value={qf.timeline_tipo || '1suc'} onChange={e => setQf({ ...qf, timeline_tipo: e.target.value })} style={S.input}>
                      <option value="1suc">1 sucursal — Arrancando su primera tienda</option>
                      <option value="2a5suc">2–5 sucursales — Creciendo y necesita orden</option>
                      <option value="5massuc">5+ sucursales — Operación compleja, automatización</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Condiciones ──
                  El texto vivía escrito a mano en cada cotización, así que cada
                  quien mandaba su versión. Ahora se elige una plantilla y el
                  texto queda COPIADO en la cotización: cambiar la plantilla
                  después no altera lo que un cliente ya recibió. */}
              <div>
                <label style={S.label}>Condiciones</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                  {condicionesTpl.map((t: any) => (
                    <button key={t.id} onClick={() => setQf({ ...qf, condiciones: t.texto })}
                      title={t.texto}
                      style={{ border: '1px solid', borderColor: qf.condiciones === t.texto ? '#1a1a1a' : '#dcdce2',
                        background: qf.condiciones === t.texto ? '#1a1a1a' : '#fff', color: qf.condiciones === t.texto ? '#fff' : '#555',
                        borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                      {t.nombre}{t.es_default ? ' ·' : ''}
                    </button>
                  ))}
                  <button onClick={async () => {
                    const texto = (qf.condiciones || '').trim();
                    if (texto.length < 10) { alert('Escribe primero las condiciones que quieres guardar.'); return; }
                    const nombre = prompt('Nombre de la plantilla:', '');
                    if (!nombre?.trim()) return;
                    const r = await fetch('/api/revenue/condiciones', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nombre: nombre.trim(), texto }),
                    }).then(x => x.json()).catch(() => null);
                    if (r?.id) setCondicionesTpl([...condicionesTpl, r]);
                    else alert(r?.error || 'No se pudo guardar la plantilla.');
                  }} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                    Guardar esta como plantilla
                  </button>
                </div>
                <textarea value={qf.condiciones || ''} onChange={e => setQf({ ...qf, condiciones: e.target.value })} style={{ ...S.input, height: 60 }} />
              </div>

              {/* ── Calculadora de ROI ──
                  Antes eran cuatro campos de texto y lo único automático era
                  multiplicar por 12; nadie la usaba porque inventar el número
                  cuesta más que capturarlo. Ahora se capturan tres datos que el
                  cliente ya dijo y la plantilla del plan hace el resto. */}
              {qf.mostrar_roi && (() => {
                const planesCotizados = Array.from(new Set(items.filter((i: any) => i.tipo === 'plan').map((i: any) => i.nombre)))
                  .filter((p: any) => !PLANES_SIN_PLANTILLA.includes(p)) as string[];
                const r = qf.roi || {};
                // Los drivers se guardan en la cotización: si mañana cambian las
                // plantillas, una cotización vieja sigue explicando SU número.
                const drivers: Driver[] = Array.isArray(r.drivers) && r.drivers.length ? r.drivers : driversParaPlanes(planesCotizados);
                const entradas = {
                  ventas_mes: r.ventas_mes, costo_hora: r.costo_hora || costoHoraParaPlanes(planesCotizados),
                  stock_valor: r.stock_valor, compras_mes: r.compras_mes,
                  clientes_activos: r.clientes_activos, ticket_promedio: r.ticket_promedio,
                };
                const calc = calcularRoi(entradas, drivers);
                const setRoi = (patch: any) => {
                  // Se recalcula y se guarda el resultado: la vista previa y la
                  // cotización del cliente leen ahorro_mensual, no los drivers.
                  const c2 = calcularRoi({ ...entradas, ...patch }, drivers);
                  setQf({ ...qf, roi: { ...r, drivers, ...patch, ahorro_mensual: c2.mensual } });
                };
                const setDriver = (i: number, patch: any) => {
                  const ds = drivers.map((d, j) => j === i ? { ...d, ...patch } : d);
                  const c2 = calcularRoi(entradas, ds);
                  setQf({ ...qf, roi: { ...r, drivers: ds, ahorro_mensual: c2.mensual } });
                };
                // Contra el costo RECURRENTE, no contra el total: la
                // implementación es un pago único y mezclarla infla los días.
                const mensualPlan = items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion)
                  .reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0);
                const pb = payback(calc.mensual, mensualPlan);
                const necesitaVentas = drivers.some(d => d.on && ['pct_ventas'].includes(d.tipo)) && !(Number(r.ventas_mes) > 0);

                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={S.label}>Calculadora de ROI</div>
                    {planesCotizados.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: '#8a6212', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px' }}>
                        Agrega un plan a los conceptos y aquí aparece su plantilla de ahorros.
                        Los planes a la medida y la póliza de soporte no traen plantilla: se venden por alcance.
                      </div>
                    ) : (
                      <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.7rem', color: '#5b30c4', background: '#f4efff', borderRadius: 6, padding: '6px 9px', marginBottom: 10 }}>
                          Plantilla: <b>{planesCotizados.map(p => PLANTILLAS_ROI[p]?.titulo || p).join(' + ')}</b> — se eligió por el plan cotizado
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Ventas al mes ($)</label>
                            <input type="number" value={r.ventas_mes || ''} onChange={e => setRoi({ ventas_mes: parseFloat(e.target.value) || 0 })} placeholder="Ej. 600000" style={{ ...S.input, borderColor: necesitaVentas ? '#fca5a5' : undefined }} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Costo de la hora ($)</label>
                            <input type="number" value={entradas.costo_hora} onChange={e => setRoi({ costo_hora: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          {drivers.some(d => d.on && d.tipo === 'pct_stock') && (
                            <div><label style={{ ...S.label, marginTop: 0 }}>Valor del inventario ($)</label>
                              <input type="number" value={r.stock_valor || ''} onChange={e => setRoi({ stock_valor: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          )}
                          {drivers.some(d => d.on && d.tipo === 'pct_compras') && (
                            <div><label style={{ ...S.label, marginTop: 0 }}>Compras al mes ($)</label>
                              <input type="number" value={r.compras_mes || ''} onChange={e => setRoi({ compras_mes: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          )}
                          {drivers.some(d => d.on && d.tipo === 'clientes_dormidos') && (<>
                            <div><label style={{ ...S.label, marginTop: 0 }}>Clientes activos</label>
                              <input type="number" value={r.clientes_activos || ''} onChange={e => setRoi({ clientes_activos: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                            <div><label style={{ ...S.label, marginTop: 0 }}>Ticket promedio ($)</label>
                              <input type="number" value={r.ticket_promedio || ''} onChange={e => setRoi({ ticket_promedio: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          </>)}
                        </div>

                        <div style={{ ...S.label, marginTop: 4 }}>De dónde sale el ahorro</div>
                        {drivers.map((d, i) => {
                          const ren = calc.renglones.find(x => x.key === d.key);
                          return (
                            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 92px', gap: 6, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f1f4', opacity: d.on ? 1 : 0.45 }}>
                              <label style={{ fontSize: '0.73rem', display: 'flex', gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
                                <input type="checkbox" checked={d.on} onChange={e => setDriver(i, { on: e.target.checked })} style={{ marginTop: 3 }} />
                                <span>{d.label}<small style={{ display: 'block', color: '#9a9a9a', fontSize: '0.66rem' }}>{d.detalle}</small></span>
                              </label>
                              <input type="number" step="0.1" value={d.valor} onChange={e => setDriver(i, { valor: parseFloat(e.target.value) || 0 })}
                                title={d.tipo === 'horas' ? 'Horas al mes' : 'Porcentaje'}
                                style={{ ...S.input, textAlign: 'center' as const, fontSize: '0.72rem', padding: '5px 4px' }} />
                              <div style={{ textAlign: 'right' as const, fontWeight: 800, color: ren ? '#1A8F7A' : '#ccc', fontSize: '0.75rem' }}>
                                {ren ? fmt(ren.monto) : '—'}
                              </div>
                            </div>
                          );
                        })}

                        <div style={{ display: 'flex', gap: 20, background: '#f4f2f8', borderRadius: 9, padding: '11px 13px', marginTop: 10 }}>
                          <div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Ahorro al mes</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED' }}>{fmt(calc.mensual)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Al año</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmt(calc.anual)}</div></div>
                          {pb && (<div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Se paga en</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{pb}</div></div>)}
                        </div>

                        {necesitaVentas && (
                          // Preferible no mostrar ROI que mostrar uno inventado:
                          // el dato es del cliente y hay que preguntarlo.
                          <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: 8 }}>
                            Falta cuánto vende al mes. Sin ese dato el bloque no se imprime en la cotización.
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <label style={{ ...S.label, marginTop: 0 }}>Problema del cliente (opcional)</label>
                          <input value={r.problema || ''} onChange={e => setRoi({ problema: e.target.value })} placeholder="Ej. Pierden 200 piezas al mes por falta de control" style={{ ...S.input, fontSize: '0.72rem' }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Antes/Después editor */}
              {qf.mostrar_antes_despues && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.label}>Antes vs Después</div>
                  {(qf.antes_despues || []).map((row: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 4, marginBottom: 4 }}>
                      <input value={row.aspecto || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], aspecto: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Aspecto" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <input value={row.antes || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], antes: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Hoy" style={{ ...S.input, fontSize: '0.6875rem', color: '#ccc' }} />
                      <input value={row.despues || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], despues: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Con SACS" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <button onClick={() => { const a = [...(qf.antes_despues || [])]; a.splice(i, 1); setQf({ ...qf, antes_despues: a }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setQf({ ...qf, antes_despues: [...(qf.antes_despues || []), { aspecto: '', antes: '', despues: '' }] })} style={S.btnSmall}>+ Agregar fila</button>
                </div>
              )}

              {/* Timeline */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const timeline = meta.timeline || [];
                const views = meta.views || 0;
                const eventLabels: Record<string, string> = { created: 'Creada', sent: 'Enviada', viewed: 'Vista', accepted: 'Aceptada', paid: 'Pagada', comment: 'Comentario', reply: 'Respuesta', edited: 'Editada' };
                const eventColors: Record<string, string> = { created: '#999', sent: '#4B7BE5', viewed: '#6C5CE7', accepted: '#2AB5A0', paid: '#2e7d32', comment: '#E8A838', reply: '#4B7BE5', edited: '#E8A838' };
                // Deduplicate: show only first occurrence of each event type (except viewed which shows count)
                const uniqueEvents: any[] = [];
                const seen = new Set<string>();
                for (const t of timeline) {
                  if (t.event === 'viewed') {
                    if (!seen.has('viewed')) { uniqueEvents.push({ ...t, count: views }); seen.add('viewed'); }
                  } else {
                    if (!seen.has(t.event)) { uniqueEvents.push(t); seen.add(t.event); }
                  }
                }
                return uniqueEvents.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Historial</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12 }}>
                      {uniqueEvents.map((t: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < uniqueEvents.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: eventColors[t.event] || '#ccc', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>
                              {eventLabels[t.event] || t.event}
                              {t.event === 'viewed' && t.count > 1 && <span style={{ color: '#6C5CE7', marginLeft: 4 }}>({t.count} veces)</span>}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.625rem', color: '#aaa' }}>{fmtDate(t.at)} {new Date(t.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Comments */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const comments = meta.comments || [];
                return comments.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Comentarios del cliente ({comments.length})</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, maxHeight: 240, overflowY: 'auto' as const }}>
                      {comments.map((c: any, i: number) => (
                        <div key={i} style={{ marginBottom: 12, padding: '8px 10px', background: c.from === 'admin' ? '#f0f0f0' : '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                          <div style={{ fontSize: '0.8125rem', color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{c.text}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: c.from === 'admin' ? '#2AB5A0' : '#999', textTransform: 'uppercase' as const }}>{c.from === 'admin' ? 'Sacs' : c.name || 'Cliente'}</span>
                            <span style={{ fontSize: '0.5625rem', color: '#ccc' }}>{fmtDate(c.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <input id="admin-reply-input" placeholder="Responder al cliente..." style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-admin-reply')?.click(); } }} />
                      <button id="btn-admin-reply" onClick={async () => {
                        const input = document.getElementById('admin-reply-input') as HTMLInputElement;
                        const text = input?.value.trim();
                        if (!text) return;
                        await fetch('/api/revenue/quote-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: qf.id, from: 'admin', name: 'Sacs', text }) });
                        input.value = '';
                        const res = await fetch(`/api/revenue/quotes?id=${qf.id}`).then(r => r.json());
                        setQf({ ...qf, notas: res.notas, items: Array.isArray(qf.items) ? qf.items : [] });
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', fontSize: '0.75rem', padding: '6px 14px' }}>Enviar</button>
                    </div>
                  </div>
                ) : null;
              })()}

            </div>
            {/* Right: Preview */}
            <div className={`rh-quote-preview rh-prev-${qf.template || 'modern'}`} style={{ flex: 1, overflowY: 'auto' as const, padding: 32 }}>
              <div className="rh-doc" style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {/* Preview Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '28px 32px 18px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.5rem', fontWeight: 700 }}>Sacs</span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#4B7BE5', background: 'rgba(75,123,229,0.08)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Cotización</span>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{qf.numero || 'COT-XXX'}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#999' }}>Vigencia: {fmtDate(qf.vigencia)}</div>
                  </div>
                </div>

                {/* Preview Client */}
                <div style={{ padding: '16px 32px' }}>
                  <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>Cotización para:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>{qf.empresa || 'Empresa'}</div>
                  {qf.contacto && <div style={{ fontSize: '0.75rem', color: '#888' }}>{qf.contacto}</div>}
                  {qf.email && <div style={{ fontSize: '0.75rem', color: '#888' }}>{qf.email}</div>}
                </div>

                {/* Encabezado de la plantilla Ejecutiva, también en la vista
                    previa: elegir plantilla sin ver el cambio es elegir a ciegas. */}
                {qf.template === 'ejecutiva' && (
                  <div style={{ margin: '0 32px 14px', border: '1px solid #e6e6ea', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#0f7a56', color: '#fff', padding: '7px 11px', fontSize: '0.6rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Recomendación</span>
                      <span>{(() => { const pl = items.find((i: any) => i.tipo === 'plan' && !i.es_promocion); return pl ? `Plan ${String(pl.nombre || '').replace(/_/g, ' ')}` : 'Propuesta SACS'; })()}</span>
                    </div>
                    <div style={{ padding: 11 }}>
                      {qf.roi?.problema && <div style={{ fontSize: '0.58rem', color: '#666', marginBottom: 8, lineHeight: 1.5 }}>{qf.roi.problema}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6 }}>
                        {[
                          ['Inversión mensual', fmt(items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion).reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0)), '#1a1a1a'],
                          ...(qf.roi?.ahorro_mensual > 0 ? [['Ahorro estimado', fmt(qf.roi.ahorro_mensual), '#0f7a56']] : []),
                          ['Arranque', qf.timeline_tipo === '5massuc' ? '4 semanas' : qf.timeline_tipo === '2a5suc' ? '3 semanas' : '2 semanas', '#1a1a1a'],
                        ].map(([k, v, c]: any) => (
                          <div key={k} style={{ background: '#f7f8fa', borderRadius: 7, padding: 7 }}>
                            <div style={{ fontSize: '0.46rem', color: '#9a9a9a', textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{k}</div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: c }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Las opciones, cuando la cotización las ofrece */}
                {paquetesOn && (
                  <div style={{ margin: '0 32px 14px', display: 'flex', gap: 6 }}>
                    {paquetes.map((p: any, i: number) => (
                      <div key={p.id} style={{ flex: 1, border: '2px solid', borderColor: i === 0 ? '#7C3AED' : '#e5e5e5', background: i === 0 ? '#7C3AED' : '#fff', color: i === 0 ? '#fff' : '#1a1a1a', borderRadius: 9, padding: '8px 9px' }}>
                        <div style={{ fontSize: '0.55rem', opacity: 0.75 }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800 }}>{fmt(totalDePaquete(p.id))}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Contador. Vivía solo en la cotización real: se prendía la
                    casilla y en la vista previa no pasaba nada, así que parecía
                    que el interruptor estaba muerto. */}
                {(qf.mostrar_timer !== false) && (
                  <div className="rh-warn" style={{ margin: '0 32px 14px', background: '#fff6ed', border: '1px solid #fde3c7', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#b45309' }}>
                      {(() => { const d = daysUntil(qf.vigencia); return d === null ? 'Vigencia por definir' : d < 0 ? 'Vigencia vencida' : d === 0 ? 'Vence hoy' : `Faltan ${d} día${d === 1 ? '' : 's'}`; })()}
                    </span>
                    <span style={{ fontSize: '0.5625rem', color: '#c88a4a' }}>· cuenta regresiva en vivo para el cliente</span>
                  </div>
                )}

                {/* Preview Key Points */}
                {(qf.key_points || []).length > 0 && (qf.mostrar_key_points !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Minuta de la reunión</div>
                    {qf.key_points.map((kp: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'flex-start' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" stroke="#4B7BE5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <div>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1a1a1a' }}>{kp.title}</div>
                          <div style={{ fontSize: '0.5625rem', color: '#999' }}>{kp.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr>
                      {['Concepto', 'Detalle', 'Precio', 'Subtotal'].map(h => (
                        <th key={h} style={{ fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', padding: '8px 12px', textAlign: h === 'Precio' || h === 'Subtotal' ? 'right' as const : 'left' as const, background: '#fafafa', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' as const, color: '#ddd', fontSize: '0.75rem' }}>Agrega conceptos al formulario</td></tr>}
                    {items.map((item: any, i: number) => {
                      const isP = item.tipo === 'plan';
                      const isPromo = item.es_promocion;
                      const suc = parseInt(item.sucursales) || 1;
                      const isAnn = item.periodo === 'anual';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: isPromo ? 'rgba(42,181,160,0.02)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                            {isPromo && <span style={{ display: 'inline-block', fontSize: '0.4375rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' as const, marginBottom: 2, marginRight: 4 }}>Promo</span>}
                            <strong style={{ color: '#1a1a1a' }}>{isP ? (item.titulo || `Plan ${item.nombre}`) : (item.nombre || '—')}</strong>
                            {isP && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{fmt(item.precio_unitario || 0)}/suc × {suc} suc. × {isAnn ? '10 meses' : '1 mes'}</div>}
                            {item.descripcion && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{item.descripcion}</div>}
                            {item.nota && <div style={{ fontSize: '0.5625rem', color: '#4B7BE5', fontStyle: 'italic' as const }}>{item.nota}</div>}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', color: '#888' }}>{isPromo ? 'Promo' : isP ? (isAnn ? 'Anual' : 'Mensual') : item.periodo_extra === 'anual' ? 'Anual' : item.recurrente ? 'Mensual' : 'Único'}</td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span style={{ textDecoration: 'line-through', color: '#ccc' }}>{fmt(item.precio_original || 0)}</span> : fmt(item.precio_unitario || item.monto || 0)}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span className="rh-money" style={{ color: '#2AB5A0', fontWeight: 800 }}>$0</span> : fmt(item.subtotal || item.monto || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Preview Totals */}
                <div style={{ padding: '16px 32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}><span>Subtotal</span><span>{fmt(itemsSubtotal)}</span></div>
                  {parseFloat(qf.descuento_global) > 0 && <div className="rh-money" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#2AB5A0', marginBottom: 4 }}><span>Descuento</span><span>-{fmt(globalDisc)}</span></div>}
                  {ivaMode !== 'sin' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}><span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span><span>{fmt(ivaMonto)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                    <span>Total {ivaMode === 'incluido' ? '(IVA incl.)' : ''}</span><span className="rh-money" style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                  </div>
                </div>

                {/* Preview ROI — lo que ve el cliente */}
                {qf.mostrar_roi && qf.roi?.ahorro_mensual > 0 && (() => {
                  const rr = qf.roi || {};
                  const ds: Driver[] = Array.isArray(rr.drivers) ? rr.drivers : [];
                  const c = calcularRoi(rr, ds);
                  const supuestos = textoSupuestos(c.renglones);
                  const mensualPlan = items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion)
                    .reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0);
                  const pb = payback(rr.ahorro_mensual, mensualPlan);
                  return (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Retorno de inversión estimado</div>
                      {rr.problema && <div style={{ fontSize: '0.5625rem', color: '#999', marginBottom: 8 }}>{rr.problema}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                          <div className="rh-money" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(rr.ahorro_mensual)}</div>
                          <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro mensual</div>
                        </div>
                        <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                          <div className="rh-money" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(rr.ahorro_mensual * 12)}</div>
                          <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro anual</div>
                        </div>
                      </div>
                      {pb && (
                        <div style={{ background: '#f4f2f8', borderRadius: 8, padding: 9, textAlign: 'center' as const, marginTop: 8, fontSize: '0.6875rem', fontWeight: 800, color: '#5b30c4' }}>
                          Se paga solo en {pb} de operación
                        </div>
                      )}
                      {/* El supuesto se imprime junto al número. Un ahorro sin
                          decir de dónde sale es lo primero que el cliente pone
                          en duda; con el desglose, se discute — que es lo que
                          se busca que pase en la junta. */}
                      {supuestos && (
                        <div style={{ fontSize: '0.5rem', color: '#999', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid #f4f4f6', paddingTop: 6 }}>
                          <b>Cómo se estima:</b> {supuestos}. Supuestos conservadores, sujetos a la operación real del negocio.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preview Antes vs Después */}
                {qf.mostrar_antes_despues && (qf.antes_despues || []).length > 0 && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Antes vs Después</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.5625rem' }}>
                      <thead><tr>
                        <th style={{ padding: '4px 6px', textAlign: 'left' as const, color: '#aaa', fontWeight: 600 }}>Aspecto</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', fontWeight: 600 }}>Hoy</th>
                        <th className="rh-money" style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#2AB5A0', fontWeight: 600 }}>Con SACS</th>
                      </tr></thead>
                      <tbody>
                        {(qf.antes_despues || []).map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '4px 6px', fontWeight: 700, color: '#1a1a1a' }}>{row.aspecto}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', textDecoration: 'line-through' }}>{row.antes}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, fontWeight: 600 }}>{row.despues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Preview Payment Breakdown */}
                {(qf.mostrar_desglose !== false) && items.some((i: any) => i.tipo === 'plan') && (() => {
                  const pPlans = items.filter((i: any) => i.tipo === 'plan');
                  const pUnique = items.filter((i: any) => i.tipo === 'extra' && !i.recurrente && !i.es_promocion);
                  const pMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual');
                  const pAnnualPlans = pPlans.filter((i: any) => i.periodo === 'anual');
                  const pMonthlyPlans = pPlans.filter((i: any) => i.periodo === 'mensual');
                  return (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Resumen de pagos</div>
                      <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                        <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Primer pago</div>
                        {pPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre} ({i.periodo})</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        {pUnique.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #e0e0e0', paddingTop: 4, marginTop: 4 }}><span>Total primer pago</span><span>{fmt(grandTotal)} {qf.moneda}</span></div>
                      </div>
                      {(pMonthlyPlans.length > 0 || pMonthly.length > 0) && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Pago mensual recurrente</div>
                          {pMonthlyPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                          {pMonthly.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        </div>
                      )}
                      {pAnnualPlans.length > 0 && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Renovación anual</div>
                          {pAnnualPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preview Plan Features */}
                {(qf.mostrar_features !== false) && items.filter((i: any) => i.tipo === 'plan').length > 0 && (() => {
                  const planItems = items.filter((i: any) => i.tipo === 'plan');
                  const features = planItems.map((pi: any) => {
                    const pd = plansData.find(p => p.id === pi.nombre?.toLowerCase());
                    if (!pd) return null;
                    const allF: { category: string; items: string[] }[] = [];
                    let cur: typeof pd | undefined = pd;
                    const visited = new Set<string>();
                    while (cur && !visited.has(cur.id)) {
                      visited.add(cur.id);
                      for (const f of cur.features) { if (typeof f === 'object' && 'category' in f) allF.push(f); }
                      cur = cur.inheritsFrom ? plansData.find(p => p.name === cur!.inheritsFrom) : undefined;
                    }
                    return { name: pd.name, features: allF.reverse(), services: pd.services };
                  }).filter(Boolean);
                  return features.length > 0 ? (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>Que incluye tu plan</div>
                      {features.map((pf: any, fi: number) => (
                        <div key={fi}>
                          <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#4B7BE5', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>Plan {pf.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 10 }}>
                            {pf.features.map((cat: any, ci: number) => (
                              <div key={ci}>
                                <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, marginBottom: 2 }}>{cat.category}</div>
                                {cat.items.map((item: string, ii: number) => (
                                  <div key={ii} style={{ display: 'flex', gap: 4, fontSize: '0.5rem', color: '#666', padding: '1px 0', alignItems: 'flex-start' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" stroke="#2AB5A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          {pf.services.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                              {pf.services.map((s: string, si: number) => (
                                <span key={si} style={{ fontSize: '0.5rem', fontWeight: 600, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 10 }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Preview Conditions */}
                {(qf.mostrar_condiciones !== false) && qf.condiciones && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>Condiciones</div>
                    <div style={{ fontSize: '0.625rem', color: '#999', lineHeight: 1.6, whiteSpace: 'pre-line' as const }}>{qf.condiciones}</div>
                  </div>
                )}

                {/* Timeline de implementación */}
                {(qf.mostrar_timeline !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Timeline de implementación</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(qf.timeline_tipo === '5massuc' ? ['Kickoff', 'Migración', 'Configuración', 'Capacitación', 'Go live']
                        : qf.timeline_tipo === '2a5suc' ? ['Kickoff', 'Migración', 'Capacitación', 'Go live']
                        : ['Kickoff', 'Configuración', 'Go live']).map((paso, i) => (
                        <div key={paso} style={{ flex: 1, textAlign: 'center' as const }}>
                          <div style={{ height: 4, background: i === 0 ? '#4B7BE5' : '#e6ecf8', borderRadius: 3 }} />
                          <div style={{ fontSize: '0.5rem', color: '#999', marginTop: 4 }}>{paso}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proceso de implementación */}
                {(qf.mostrar_implementacion !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>Proceso de implementación</div>
                    <div style={{ fontSize: '0.5625rem', color: '#999', lineHeight: 1.7 }}>
                      Alta de la cuenta · Carga de catálogo e inventario · Configuración de sucursales y usuarios · Capacitación del equipo · Acompañamiento en el arranque
                    </div>
                  </div>
                )}

                {/* ¿Por qué SACS? */}
                {(qf.mostrar_porque_sacs !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>¿Por qué SACS?</div>
                    <div style={{ fontSize: '0.5625rem', color: '#999', lineHeight: 1.7 }}>Historia, casos de éxito y respaldo del equipo.</div>
                  </div>
                )}

                {/* Firma digital y QR */}
                {((qf.mostrar_firma !== false) || (qf.mostrar_qr !== false)) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                    {(qf.mostrar_firma !== false) && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Firma digital</div>
                        <div style={{ borderBottom: '1px solid #dcdce2', height: 26 }} />
                        <div style={{ fontSize: '0.5rem', color: '#bbb', marginTop: 4 }}>El cliente firma desde la liga y queda registrada con fecha</div>
                      </div>
                    )}
                    {(qf.mostrar_qr !== false) && (
                      <div style={{ textAlign: 'center' as const }}>
                        <div style={{ width: 46, height: 46, borderRadius: 6, background: 'repeating-conic-gradient(#1a1a1a 0% 25%, #fff 0% 50%) 0 0/9px 9px', border: '1px solid #e6e6ea' }} />
                        <div style={{ fontSize: '0.5rem', color: '#bbb', marginTop: 4 }}>QR</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Números animados no tiene bloque: es un efecto que solo
                    existe en la cotización viva. Se dice, en vez de dejar la
                    casilla sin ningún eco visible. */}
                {(qf.mostrar_animaciones !== false) && (
                  <div style={{ padding: '8px 32px', fontSize: '0.5rem', color: '#c4c4c4', borderTop: '1px solid #f6f6f6' }}>
                    Los montos se animan al abrir la cotización.
                  </div>
                )}

                {/* Preview Footer */}
                <div className="rh-soft rh-mute" style={{ padding: '14px 32px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: '#bbb' }}>
                  <span><strong style={{ color: '#1a1a1a', fontFamily: "'Clash Display',sans-serif" }}>Sacs</strong> Sistema operativo para retailers</span>
                  <span>www.sacscloud.com</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Layout ───
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8' }}>
      <style dangerouslySetInnerHTML={{ __html: REVENUE_HUB_MOBILE_CSS }} />
      {/* Nav */}
      {!_hideNav && (
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', marginRight: 32 }}>
            <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Sacs</span>
            <span className="rh-money" style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Revenue</span>
          </div>
          {(['dashboard', 'cotizaciones', 'config'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 16px', fontSize: '0.8125rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? '#1a1a1a' : '#999', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', textTransform: 'capitalize' as const }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/leads" style={{ ...S.btn, background: '#f5f5f5', color: '#555', textDecoration: 'none' }}>CRM</a>
          <button onClick={load} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>↻</button>
        </div>
      </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        {tab === 'dashboard' && <DashboardView />}
        {/* El dashboard ocupa el lugar de la lista, no se encima: como panel
            flotante quedaba por debajo del menú lateral y se cortaba al
            abrirlo. Así el ancho lo decide el contenedor de siempre. */}
        {tab === 'cotizaciones' && (dashCot
          ? <CotizacionesDashboard onCerrar={() => setDashCot(false)} />
          : <QuotesView />)}
        {tab === 'config' && (
          <div>
            {/* Campos personalizados del cliente: información interna de
                gestión. Va primero porque es lo que se toca seguido; el folio
                de cotizaciones se configura una vez y no se vuelve a mirar. */}
            <div style={{ marginBottom: 28 }}><CamposConfig entidad="company" /></div>

            {/* Folio config */}
            {/* ── Recuperación de una sola vez ──
                Las cotizaciones que se ligaron a un cliente cuando YA estaban
                cobradas nunca generaron oportunidad, porque el puente solo corría
                para borrador / enviada / aceptada. Ya está arreglado hacia
                adelante; esto repara lo que quedó atrás. */}
            {/* ── Plantillas de condiciones ── */}
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Términos y condiciones</h2>
            <div style={{ ...S.card, marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 12, lineHeight: 1.6 }}>
                La marcada como <b>predeterminada</b> es la que trae una cotización nueva. Al elegir una plantilla, su texto
                queda <b>copiado</b> en la cotización: cambiarla aquí no altera lo que un cliente ya recibió.
              </div>
              {condicionesTpl.map((t: any) => (
                <div key={t.id} style={{ border: '1px solid #ececec', borderRadius: 9, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input value={t.nombre} onChange={e => setCondicionesTpl(condicionesTpl.map((x: any) => x.id === t.id ? { ...x, nombre: e.target.value } : x))}
                      style={{ ...S.input, fontWeight: 700, maxWidth: 220 }} />
                    {t.es_default
                      ? <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Predeterminada</span>
                      : <button onClick={async () => {
                          await fetch('/api/revenue/condiciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, es_default: true }) });
                          setCondicionesTpl(condicionesTpl.map((x: any) => ({ ...x, es_default: x.id === t.id })));
                        }} style={S.btnSmall}>Hacer predeterminada</button>}
                    <span style={{ flex: 1 }} />
                    <button onClick={async () => {
                      await fetch('/api/revenue/condiciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, nombre: t.nombre, texto: t.texto }) });
                      alert('Plantilla guardada.');
                    }} style={S.btnSmall}>Guardar</button>
                    <button onClick={async () => {
                      if (!confirm(`¿Quitar la plantilla "${t.nombre}"?\n\nLas cotizaciones que ya la usaron conservan su texto.`)) return;
                      await fetch('/api/revenue/condiciones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
                      setCondicionesTpl(condicionesTpl.filter((x: any) => x.id !== t.id));
                    }} style={{ ...S.btnSmall, color: '#E54B4B' }}>Quitar</button>
                  </div>
                  <textarea value={t.texto} onChange={e => setCondicionesTpl(condicionesTpl.map((x: any) => x.id === t.id ? { ...x, texto: e.target.value } : x))}
                    style={{ ...S.input, height: 64, fontSize: '0.75rem', resize: 'vertical' as const }} />
                </div>
              ))}
              <button onClick={async () => {
                const r = await fetch('/api/revenue/condiciones', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nombre: 'Nueva plantilla', texto: 'Escribe aquí los términos y condiciones.' }),
                }).then(x => x.json()).catch(() => null);
                if (r?.id) setCondicionesTpl([...condicionesTpl, r]);
              }} style={S.btnSmall}>+ Nueva plantilla</button>
            </div>

            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Oportunidades que faltan</h2>
            <div style={{ ...S.card, marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 12, lineHeight: 1.6 }}>
                Genera la oportunidad de las cotizaciones que ya están <b>cobradas, vencidas o rechazadas</b> y se quedaron
                sin ella. Se crean ya cerradas y <b>con su fecha real</b> — una venta de julio no aparece como cerrada hoy.
                Solo se tocan las que tienen cliente ligado: sin empresa, la oportunidad no aparecería en ninguna ficha.
                Correrlo dos veces no duplica nada.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <button onClick={async () => {
                  const r = await fetch('/api/revenue/quotes/recuperar-oportunidades', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry: true }),
                  }).then(x => x.json()).catch(() => null);
                  setRecup(r);
                }} style={S.btnSmall}>Ver qué se recuperaría</button>
                <button onClick={async () => {
                  if (!confirm('Se van a crear las oportunidades faltantes de las cotizaciones ya cobradas, vencidas y rechazadas.\n\n¿Continuar?')) return;
                  const r = await fetch('/api/revenue/quotes/recuperar-oportunidades', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry: false }),
                  }).then(x => x.json()).catch(() => null);
                  setRecup(r);
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Recuperar ahora</button>
              </div>
              {recup && (
                <div style={{ marginTop: 12, fontSize: '0.76rem', lineHeight: 1.6 }}>
                  <b>{recup.dry ? 'Se recuperarían' : 'Se recuperaron'} {recup.recuperadas}</b>
                  {' '}({recup.ganadas} ganadas · {recup.perdidas} perdidas)
                  {(recup.detalle || []).length > 0 && (
                    <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto' as const, background: '#fafafa', borderRadius: 7, padding: 9 }}>
                      {recup.detalle.map((x: any) => (
                        <div key={x.numero} style={{ fontSize: '0.72rem', color: '#555' }}>
                          {x.numero} · {x.empresa} · {fmt(x.total)} — {x.etapa === 'cerrada_ganada' ? 'ganada' : 'perdida'} el {String(x.closed_at || '').slice(0, 10)}
                        </div>
                      ))}
                    </div>
                  )}
                  {(recup.sin_cliente_ligado || []).length > 0 && (
                    <div style={{ marginTop: 10, background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px', color: '#8a6212' }}>
                      <b>{recup.sin_cliente_ligado.length} no se pueden recuperar todavía</b> porque no tienen cliente ligado.
                      Lígalas desde la lista y su oportunidad nace sola:
                      <div style={{ marginTop: 5, fontSize: '0.72rem' }}>
                        {recup.sin_cliente_ligado.map((x: any) => `${x.numero} (${x.empresa || 'sin nombre'})`).join(' · ')}
                      </div>
                    </div>
                  )}
                  {(recup.fallidas || []).length > 0 && (
                    <div style={{ marginTop: 8, color: '#b4302f', fontSize: '0.73rem' }}>
                      Fallaron {recup.fallidas.length}: {recup.fallidas.map((f: any) => `${f.numero} (${f.motivo})`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Folio de cotizaciones</h2>
            <div style={{ ...S.card, marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 12 }}>Este número se usa como <b>folio inicial</b>. A partir de él, cada cotización nueva se numera de forma consecutiva y nunca se repite.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Siguiente numero de folio</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#999' }}>COT-</span>
                    <input id="folio-input" type="number" min="1" placeholder="Ej. 100" defaultValue="" style={S.input} />
                  </div>
                </div>
                <button onClick={async () => {
                  const input = document.getElementById('folio-input') as HTMLInputElement;
                  const val = parseInt(input?.value);
                  if (!val || val < 1) { alert('Ingresa un numero valido'); return; }
                  // Validar contra el folio más alto existente (no contra el conteo de filas)
                  const res = await fetch('/api/revenue/quotes');
                  const all = await res.json();
                  let maxExisting = 0;
                  if (Array.isArray(all)) {
                    for (const q of all) {
                      const m = String(q?.numero || '').match(/(\d+)\s*$/);
                      if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
                    }
                  }
                  if (val <= maxExisting) { alert(`El folio más alto usado es COT-${String(maxExisting).padStart(3, '0')}. El siguiente debe ser mayor a ${maxExisting}.`); return; }
                  // Guardamos offset = val-1 para mantener la convención (folioStart = offset + 1)
                  localStorage.setItem('sacs_folio_offset', String(val - 1));
                  alert(`Listo. La próxima cotización será COT-${String(val).padStart(3, '0')}. Las siguientes serán consecutivas.`);
                  input.value = '';
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Guardar</button>
              </div>
              {typeof window !== 'undefined' && localStorage.getItem('sacs_folio_offset') && (
                <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 8 }}>Offset configurado: +{localStorage.getItem('sacs_folio_offset')}</div>
              )}
            </div>

            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Cuentas bancarias</h2>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={S.label}>Alias</label><input value={bankForm.alias || ''} onChange={e => setBankForm({ ...bankForm, alias: e.target.value })} placeholder="Ej. BBVA pesos" style={S.input} /></div>
                <div><label style={S.label}>Banco</label><input value={bankForm.banco || ''} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} placeholder="Ej. BBVA" style={S.input} /></div>
                <div><label style={S.label}>Cuenta</label><input value={bankForm.cuenta || ''} onChange={e => setBankForm({ ...bankForm, cuenta: e.target.value })} placeholder="Número de cuenta" style={S.input} /></div>
                <div><label style={S.label}>CLABE</label><input value={bankForm.clabe || ''} onChange={e => setBankForm({ ...bankForm, clabe: e.target.value })} placeholder="18 dígitos" style={S.input} /></div>
                <div><label style={S.label}>RFC</label><input value={bankForm.rfc || ''} onChange={e => setBankForm({ ...bankForm, rfc: e.target.value })} placeholder="RFC" style={S.input} /></div>
                <div><label style={S.label}>Titular</label><input value={bankForm.titular || ''} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} placeholder="Nombre" style={S.input} /></div>
                <button onClick={async () => {
                  if (!bankForm.banco) return;
                  await fetch('/api/revenue/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bankForm, es_default: bankAccounts.length === 0 }) });
                  setBankForm({});
                  load();
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Agregar</button>
              </div>
            </div>
            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>{['Banco', 'Cuenta', 'CLABE', 'RFC', 'Titular', 'Default', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {bankAccounts.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#ccc', padding: 32 }}>Sin cuentas bancarias</td></tr>}
                  {bankAccounts.map((ba: any) => (
                    <tr key={ba.id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{ba.banco}</td>
                      <td style={S.td}>{ba.cuenta}</td>
                      <td style={S.td}>{ba.clabe}</td>
                      <td style={S.td}>{ba.rfc}</td>
                      <td style={S.td}>{ba.titular}</td>
                      <td style={S.td}>{ba.es_default ? <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Default</span> : <button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id, es_default: true }) }); load(); }} style={S.btnSmall}>Hacer default</button>}</td>
                      <td style={S.td}><button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id }) }); load(); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───
const S: Record<string, React.CSSProperties> = {
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  kpi: { background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #f0f0f0' },
  card: { background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #f0f0f0', marginBottom: 16 },
  cardTitle: { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8125rem' },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', color: '#555', borderBottom: '1px solid #f8f8f8' },
  tr: { cursor: 'default' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', color: '#666', cursor: 'pointer', marginRight: 4 },
  badge: { fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  input: { width: '100%', padding: '8px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' as const },
  listItem: { padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.8125rem' },
  empty: { textAlign: 'center' as const, padding: 32, color: '#ccc', fontSize: '0.875rem' },
};

// CSS responsive — drawer del editor de cotizaciones mobile-friendly
const REVENUE_HUB_MOBILE_CSS = `
  /* ── Tema de la vista previa según la plantilla ──
     El documento está pintado con estilos inline, así que teñirlo por plantilla
     solo se puede con !important acotado a esta clase. Los acentos se devuelven
     por CLASE y no por selector de atributo: React serializa los colores inline
     a rgb(), así que [style*="#2AB5A0"] nunca casa. */
  .rh-prev-dark { background: #0f0f12; border-radius: 12px; }
  .rh-prev-dark .rh-doc { background: #17171c !important; box-shadow: none !important; }
  .rh-prev-dark .rh-doc,
  .rh-prev-dark .rh-doc div, .rh-prev-dark .rh-doc span,
  .rh-prev-dark .rh-doc td, .rh-prev-dark .rh-doc th,
  .rh-prev-dark .rh-doc strong, .rh-prev-dark .rh-doc small,
  .rh-prev-dark .rh-doc s { color: #e9e9ee !important; border-color: rgba(255,255,255,0.09) !important; }
  .rh-prev-dark .rh-doc .rh-mute, .rh-prev-dark .rh-doc .rh-mute * { color: rgba(255,255,255,0.45) !important; }
  .rh-prev-dark .rh-doc .rh-money, .rh-prev-dark .rh-doc .rh-money * { color: #2AB5A0 !important; }
  .rh-prev-dark .rh-doc .rh-soft { background: rgba(255,255,255,0.05) !important; }
  .rh-prev-dark .rh-doc .rh-warn, .rh-prev-dark .rh-doc .rh-warn * { color: #fdba74 !important; }
  .rh-prev-dark .rh-doc .rh-warn { background: rgba(253,186,116,0.10) !important; border-color: rgba(253,186,116,0.28) !important; }

  .rh-prev-interactiva { background: #f7f4ff; border-radius: 12px; }
  .rh-prev-ejecutiva { background: #f3f8f6; border-radius: 12px; }

  @media (max-width: 900px) {
    .rh-quote-topbar { padding: 10px 14px !important; }
    .rh-quote-topbar h3 { font-size: 0.875rem !important; }
    .rh-quote-split { flex-direction: column !important; overflow-y: auto !important; }
    .rh-quote-form { width: 100% !important; padding: 16px !important; border-right: none !important; border-bottom: 1px solid #eee !important; }
    .rh-quote-form > div[style*="grid-template-columns"],
    .rh-quote-form div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
    .rh-quote-preview { padding: 18px !important; }
    .rh-quote-preview > div[style*="max-width: 640"],
    .rh-quote-preview > div[style*="maxWidth: 640"] { max-width: 100% !important; }
  }
`;

/* ═══ Eliminar cotización ═══
 *
 * No borra: archiva y deja escrito POR QUÉ, QUIÉN y CUÁNDO. Una cotización es
 * un documento que salió al cliente con folio, precio y vigencia; que se esfume
 * sin rastro es lo que después impide explicar por qué se le cotizó dos veces o
 * por qué cambió el precio.
 *
 * Cuando el motivo es "se generó una nueva", se elige cuál la reemplaza —solo
 * cotizaciones DEL MISMO CLIENTE, porque ligar la de otro rompe los dos
 * historiales— y el vínculo queda en las dos direcciones.
 */
const MOTIVOS_ELIMINAR: { v: string; l: string }[] = [
  { v: 'nueva_cotizacion', l: 'Se generó una nueva cotización' },
  { v: 'error_captura', l: 'Me equivoqué al generar la cotización' },
  { v: 'duplicada', l: 'La cotización está duplicada' },
  { v: 'cambios_cliente', l: 'El cliente solicitó cambios' },
  { v: 'operacion_cancelada', l: 'La operación fue cancelada' },
  { v: 'otro', l: 'Otro' },
];

function EliminarCotizacionModal({ seleccion, quotes, onClose, onDone }: {
  seleccion: any[]; quotes: any[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const quote = seleccion[0];
  const varias = seleccion.length > 1;
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [reemplazo, setReemplazo] = useState('');
  const [busy, setBusy] = useState(false);

  // Del mismo cliente: por empresa ligada o, si no la hay, por correo. Se
  // excluyen las que se están archivando y lo ya archivado.
  const ids = seleccion.map((q: any) => q.id);
  const delCliente = (quotes || []).filter((q: any) => {
    if (ids.includes(q.id) || q.estado === 'deleted') return false;
    if (quote.company_id && q.company_id) return q.company_id === quote.company_id;
    if (quote.email && q.email) return String(q.email).toLowerCase() === String(quote.email).toLowerCase();
    return false;
  });
  // Archivar juntas cotizaciones de clientes distintos hacia UNA nueva no tiene
  // sentido: se avisa en vez de dejar que el servidor lo rechace al final.
  const mezcla = varias && seleccion.some((q: any) => (quote.company_id && q.company_id)
    ? q.company_id !== quote.company_id
    : String(q.email || '').toLowerCase() !== String(quote.email || '').toLowerCase());

  async function confirmar() {
    if (!motivo) { alert('Elige el motivo de la eliminación.'); return; }
    if (motivo === 'otro' && !detalle.trim()) { alert('Escribe el motivo: "Otro" a secas no explica nada después.'); return; }
    if (motivo === 'nueva_cotizacion' && !reemplazo) { alert('Indica cuál cotización reemplaza a esta.'); return; }
    setBusy(true);
    const j = await fetch('/api/revenue/quotes/eliminar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, motivo, motivo_detalle: detalle.trim() || null, reemplazada_por_id: reemplazo || null }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo archivar' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    onDone(`${j.eliminadas} cotización(es) archivada(s): ${(j.numeros || []).join(', ')}`
      + (j.reemplazada_por ? ` · las reemplaza la ${j.reemplazada_por.numero}` : ''));
  }

  const inp: React.CSSProperties = { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 14px', overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 'min(560px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{varias ? `Archivar ${seleccion.length} cotizaciones` : `Eliminar cotización ${quote.numero}`}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
          {varias
            ? <>{seleccion.map((q: any) => q.numero).join(', ')} · {quote.empresa || quote.contacto}. Se archivan con el MISMO motivo.</>
            : <>{quote.empresa || quote.contacto} · ${Number(quote.total || 0).toLocaleString('es-MX')}.</>}
          {' '}No se borran: pasan al archivo y quedan en el historial del cliente con el motivo, quién y cuándo. Se pueden restaurar.
        </div>
        {mezcla && (
          <div style={{ fontSize: '0.78rem', color: '#b93333', background: '#fdeaea', border: '1px solid #f5c6c6', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            Hay cotizaciones de clientes distintos en la selección. Se pueden archivar juntas, pero no apuntarlas a una misma cotización nueva.
          </div>
        )}

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>MOTIVO DE ELIMINACIÓN *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
          {MOTIVOS_ELIMINAR.map(m => (
            <label key={m.v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: motivo === m.v ? '#f5f7ff' : 'transparent', border: '1px solid ' + (motivo === m.v ? '#d8e0fb' : 'transparent') }}>
              <input type="radio" name="motivo-eliminar" checked={motivo === m.v} onChange={() => setMotivo(m.v)} />
              {m.l}
            </label>
          ))}
        </div>

        {motivo === 'nueva_cotizacion' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 3 }}>{varias ? '¿QUÉ COTIZACIÓN LAS REEMPLAZA? *' : '¿QUÉ COTIZACIÓN REEMPLAZA A ESTA? *'}</label>
            {delCliente.length ? (
              <>
                <select value={reemplazo} onChange={e => setReemplazo(e.target.value)} style={inp}>
                  <option value="">— elegir —</option>
                  {delCliente.map((q: any) => (
                    <option key={q.id} value={q.id}>
                      {q.numero} · ${Number(q.total || 0).toLocaleString('es-MX')} · {q.estado} · {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </option>
                  ))}
                </select>
                {reemplazo && (
                  <div style={{ fontSize: '0.76rem', color: '#1A8F7A', marginTop: 6 }}>
                    {seleccion.map((q: any) => q.numero).join(' + ')} → reemplazada{varias ? 's' : ''} por {delCliente.find((q: any) => q.id === reemplazo)?.numero}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#a06600', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: 10 }}>
                Este cliente no tiene otra cotización a la cual apuntar. Créala primero, o elige otro motivo.
              </div>
            )}
          </div>
        )}

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 3 }}>
          {motivo === 'otro' ? 'CUÉNTAME EL MOTIVO *' : 'NOTA (opcional)'}
        </label>
        <input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="lo que ayude a entenderlo dentro de tres meses" style={{ ...inp, marginBottom: 16 }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={busy || !motivo || (motivo === 'nueva_cotizacion' && !reemplazo)}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#b93333', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: (busy || !motivo || (motivo === 'nueva_cotizacion' && !reemplazo)) ? 0.5 : 1 }}>
            {busy ? 'Archivando…' : (varias ? `Confirmar archivado de ${seleccion.length}` : 'Confirmar eliminación')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Buscador de cliente para la cotización ═══
 *
 * Busca en clientes Y leads a la vez. Elegir aquí es lo que liga la cotización
 * al CRM; escribir el nombre a mano la deja huérfana y fuera de la ficha del
 * cliente — que es como quedaron las 32 que existen hoy.
 *
 * Si no existe, se crea en el momento sin salir del editor. Y antes de crear,
 * avisa si ya hay algo parecido: detectar el duplicado cuesta un query, y
 * fusionarlo después cuesta una tarde.
 */
function ClienteBuscador({ valorInicial, datos, onElegir }: { valorInicial?: string; datos?: any; onElegir: (r: any) => void }) {
  // La caja arranca VACÍA aunque la cotización ya traiga nombre: prellenada se
  // leía como un campo más que ya está lleno y nadie la tocaba. Lo escrito se
  // ofrece en una pastilla de un clic, debajo.
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState<any>(null);
  const [dupes, setDupes] = useState<any>(null);
  const [filtro, setFiltro] = useState<'todos' | 'cliente' | 'lead' | 'excliente'>('todos');
  const [cursor, setCursor] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = (texto: string) => {
    setQ(texto); setAbierto(true);
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) { setRes([]); return; }
    // 250 ms: teclear rápido no puede disparar una consulta por letra.
    timer.current = setTimeout(async () => {
      setBuscando(true);
      const j = await fetch('/api/crm/buscar-cliente?q=' + encodeURIComponent(texto)).then(r => r.json()).catch(() => ({}));
      setRes(j?.resultados || []); setCursor(0); setBuscando(false);
    }, 250);
  };

  async function abrirAlta() {
    // Se arrastra lo que ya está capturado en la cotización: volver a teclear
    // correo y teléfono es justo el momento en que se abandona y se deja sin ligar.
    setCreando({
      empresa: q.trim() || datos?.empresa || '', contacto: datos?.contacto || '',
      email: datos?.email || '', whatsapp: datos?.whatsapp || '', tipo: 'lead',
    });
    setAbierto(false);
    const nombre = q.trim() || datos?.empresa || '';
    const j = await fetch(`/api/crm/buscar-cliente?duplicado=${encodeURIComponent(nombre)}&email=${encodeURIComponent(datos?.email || '')}`).then(r => r.json()).catch(() => ({}));
    setDupes(j);
  }

  async function crear() {
    if (!creando.empresa.trim()) { alert('El cliente es la EMPRESA: escribe su nombre.'); return; }
    const j = await fetch('/api/crm/buscar-cliente', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creando),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo crear' }));
    if (j?.error) { alert(j.error); return; }
    onElegir({ ...j, contacto: creando.contacto, email: creando.email, whatsapp: creando.whatsapp, es_cliente: creando.tipo === 'cliente', clase: creando.tipo, n: 0 });
    setCreando(null); setDupes(null);
  }

  if (creando) {
    return (
      <div style={{ background: '#fafbfd', border: '1px dashed #cfd6e4', borderRadius: 8, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', marginBottom: 6 }}>Nuevo cliente</div>
        {dupes && (dupes.empresas_parecidas?.length > 0 || dupes.contactos_mismo_correo?.length > 0) && (
          <div style={{ fontSize: '0.72rem', color: '#b45309', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 7, padding: '7px 9px', marginBottom: 8 }}>
            Ya existe algo parecido — ¿es alguno de estos?
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
              {(dupes.empresas_parecidas || []).map((x: any) => (
                <button key={x.id} onClick={() => { onElegir({ company_id: x.id, empresa: x.nombre, es_cliente: x.estado_cuenta === 'activo' }); setCreando(null); setDupes(null); }}
                  style={{ ...S.btnSmall, marginRight: 0 }}>{x.nombre}</button>
              ))}
              {(dupes.contactos_mismo_correo || []).map((x: any) => (
                <button key={x.id} onClick={() => { const co = Array.isArray(x.companies) ? x.companies[0] : x.companies; onElegir({ company_id: co?.id || null, contact_id: x.id, empresa: co?.nombre || x.nombre, contacto: x.nombre, email: x.email }); setCreando(null); setDupes(null); }}
                  style={{ ...S.btnSmall, marginRight: 0 }}>{x.nombre} ({x.email})</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input value={creando.empresa} onChange={e => setCreando({ ...creando, empresa: e.target.value })} placeholder="Empresa *" style={S.input} />
          <input value={creando.contacto} onChange={e => setCreando({ ...creando, contacto: e.target.value })} placeholder="Contacto (persona)" style={S.input} />
          <input value={creando.email} onChange={e => setCreando({ ...creando, email: e.target.value })} placeholder="Correo" style={S.input} />
          <input value={creando.whatsapp} onChange={e => setCreando({ ...creando, whatsapp: e.target.value })} placeholder="WhatsApp" style={S.input} />
        </div>
        {/* Nace como lead salvo que se diga lo contrario: casi siempre se cotiza
            a alguien que todavía no compra, y marcarlo cliente de entrada
            ensucia la cuenta de cuántas cuentas nuevas trajiste. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ display: 'inline-flex', background: '#f2f3f5', borderRadius: 20, padding: 3, gap: 3 }}>
            {(['lead', 'cliente'] as const).map(t => (
              <button key={t} onClick={() => setCreando({ ...creando, tipo: t })}
                style={{ border: 'none', cursor: 'pointer', borderRadius: 20, padding: '3px 12px', fontSize: '0.68rem', fontWeight: 800,
                  background: creando.tipo === t ? '#3764c4' : 'transparent', color: creando.tipo === t ? '#fff' : '#6b7280' }}>
                {t === 'lead' ? 'Lead' : 'Cliente'}
              </button>
            ))}
          </span>
          <span style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>se guarda así en su ficha</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={crear} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Crear y ligar</button>
          <button onClick={() => { setCreando(null); setDupes(null); }} style={{ ...S.btnSmall, marginRight: 0 }}>Cancelar</button>
        </div>
      </div>
    );
  }

  const clases: Record<string, { txt: string; bg: string; fg: string }> = {
    cliente:   { txt: 'Cliente',   bg: '#f0e9ff', fg: '#6d4bc7' },
    lead:      { txt: 'Lead',      bg: '#e8f0fd', fg: '#3764c4' },
    excliente: { txt: 'Excliente', bg: '#f4f5f7', fg: '#5b6472' },
  };
  const estadoTxt: Record<string, string> = { sent: 'enviada', draft: 'borrador', accepted: 'aceptada', paid: 'pagada', expired: 'vencida', rejected: 'rechazada' };
  const estadoCol: Record<string, string> = { sent: '#a15c07', accepted: '#2c5fc4', paid: '#0f7a56', expired: '#b4302f', rejected: '#5b6472', draft: '#8a8a8a' };

  const visibles = res.filter((r: any) => filtro === 'todos' || r.clase === filtro);
  const elegir = (r: any) => { onElegir(r); setAbierto(false); setCursor(0); };

  // ↑↓ para moverse y ↵ para elegir: quien está capturando una cotización no
  // suelta el teclado para tomar el mouse.
  const teclas = (e: any) => {
    if (!abierto) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, visibles.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && visibles[cursor]) { e.preventDefault(); elegir(visibles[cursor]); }
    else if (e.key === 'Escape') { setAbierto(false); }
  };

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, border: '1.5px solid #b9a0f0', borderRadius: 9, padding: '0 12px', background: '#fbfaff' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={e => buscar(e.target.value)} onFocus={() => setAbierto(true)} onKeyDown={teclas}
            placeholder="Buscar cliente o lead…"
            title="Empresa, contacto, correo, teléfono, cuenta SACS o folio"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 0', fontSize: '0.85rem', fontFamily: 'inherit' }} />
        </div>
        <button onClick={abrirAlta} style={{ ...S.btnSmall, marginRight: 0, whiteSpace: 'nowrap' as const, padding: '0 14px', fontWeight: 700 }}>+ Nuevo</button>
      </div>
      {/* Lo que ya estaba escrito en la cotización, a un clic: es el caso más
          común —abrir una vieja sin ligar— y obliga a retecleárselo. */}
      {!q && (valorInicial || '').trim().length > 1 && (
        <button onClick={() => buscar((valorInicial || '').trim())}
          style={{ border: '1px solid #e6e2ef', background: '#f4f2f8', color: '#5b4a91', borderRadius: 20, padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
          Buscar “{(valorInicial || '').trim()}”
        </button>
      )}
      {abierto && q.trim().length >= 2 && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 41, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', maxHeight: 340, overflowY: 'auto' }}>
            {res.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #f2f2f2', background: '#fcfcfd', position: 'sticky' as const, top: 0 }}>
                {([['todos', 'Todos'], ['cliente', 'Clientes'], ['lead', 'Leads'], ['excliente', 'Exclientes']] as const).map(([k, t]) => {
                  const n = k === 'todos' ? res.length : res.filter((r: any) => r.clase === k).length;
                  if (!n && k !== 'todos') return null;
                  return (
                    <button key={k} onClick={() => { setFiltro(k); setCursor(0); }}
                      style={{ border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: filtro === k ? '#1a1a1a' : '#f2f3f5', color: filtro === k ? '#fff' : '#6b7280' }}>
                      {t} <span style={{ opacity: 0.55 }}>{n}</span>
                    </button>
                  );
                })}
                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#b8b8b8', alignSelf: 'center' }}>↑↓ mover · ↵ elegir</span>
              </div>
            )}
            {buscando && <div style={{ padding: 10, fontSize: '0.78rem', color: '#999' }}>Buscando…</div>}
            {!buscando && visibles.length === 0 && <div style={{ padding: 10, fontSize: '0.78rem', color: '#999' }}>Sin resultados.</div>}
            {visibles.map((r: any, i: number) => {
              const cl = clases[r.clase] || clases.lead;
              return (
                <div key={i} onClick={() => elegir(r)} onMouseEnter={() => setCursor(i)}
                  style={{ padding: '9px 10px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: cursor === i ? '#f7f7fa' : '#fff' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                    {r.empresa || r.contacto}
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: cl.bg, color: cl.fg }}>{cl.txt}</span>
                    {r.sacs_account && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#f4f5f7', color: '#5b6472' }}>{r.sacs_account}</span>}
                    {r.dup && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fdecec', color: '#b4302f' }}>posible duplicado</span>}
                    {r.via_folio && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#eef2ff', color: '#3764c4' }}>por {r.via_folio}</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>{[r.contacto, r.email, r.whatsapp].filter(Boolean).join(' · ')}</div>
                  {r.n ? (
                    <div style={{ fontSize: '0.7rem', color: '#8a8a8a', marginTop: 2 }}>
                      {r.n} cotización{r.n === 1 ? '' : 'es'}
                      {r.ultima ? <> · última {r.ultima.numero} por ${Number(r.ultima.total || 0).toLocaleString('es-MX')} — <b style={{ color: estadoCol[r.ultima.estado] || '#8a8a8a' }}>{estadoTxt[r.ultima.estado] || r.ultima.estado}</b></> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button onClick={abrirAlta} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: '#fafafa', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a' }}>
              + Crear "{q.trim()}" como cliente nuevo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
