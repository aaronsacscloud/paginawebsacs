// CotizacionesTab — Partners crean y gestionan sus propias cotizaciones.
// Reusa la tabla `quotes` del CRM. POST/PUT/GET via /api/revenue/quotes.
//
// Paridad funcional con el editor admin (RevenueHub). Lo ÚNICO que el partner NO
// tiene (por diseño, es lo financiero de SACS) es:
// - Sin bank account selector (el cobro es de SACS)
// - Sin Stripe link manual (SACS lo genera)
// - Sin folio offset (admin only)
// - Sin IA analyze-transcript de audio (sí tiene format-minuta por texto)
// - Descuento global y por línea capeados a 15% (anti revenue-leak; planes fijos)
// Sí tiene: extras/hardware/consultoría libres, plantilla, promo_label, IVA 3 modos,
// eliminar/archivar, IA de minuta por texto, ROI, antes/después, timeline, toggles.

import { useEffect, useMemo, useState } from 'react';
import { SS, C, stagePillStyle } from './styles';
import { Icon } from './icons';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet, copyToClipboard } from './utils';
import { demoQuotes } from '../../../data/partner-portal-demo';
import { PLAN_PRICES, IMPL_PRICES, PLANS, COMISION_CATEGORIAS, COMISION_RATES, COMISION_LABELS } from '../../../lib/quotes/constants';
import { calcComision, calcComisionQuote, categoriaDeItem, defaultCategoria } from '../../../lib/quotes/commissions';
import { plans as PLANS_DATA } from '../../../data/plans';
import { CASOS_GIRO } from '../../../data/casos-giro';
import { calcQuoteTotals } from '../../../lib/quotes/totals';
import { parseMeta, serializeMeta } from '../../../lib/quotes/meta';
import { PARTNER_EXTRAS_CATALOG } from '../../../lib/quotes/partner-catalog';
import { PARTNER_MAX_DISCOUNT_PCT } from '../../../lib/quotes/permissions';

type Estado = 'draft' | 'sent' | 'accepted' | 'paid' | 'rejected' | 'expired' | 'plantilla';

interface Quote {
  id: string;
  numero: string;
  created_at: string;
  updated_at?: string;
  empresa: string;
  contacto: string;
  email: string;
  whatsapp: string;
  items: any[];
  estado: Estado;
  subtotal: number;
  iva_monto?: number;
  total: number;
  moneda: string;
  vigencia: string;
  partner_id?: string | null;
  descuento_global?: number;
  descuento_tipo?: 'pct' | 'monto';
  iva_incluido?: boolean;
  condiciones?: string;
  notas?: string;
  aceptado_por?: string;
  aceptado_fecha?: string;
}

const ESTADO_LABELS: Record<Estado, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  paid: 'Pagada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  plantilla: 'Plantilla',
};

const ESTADO_COLORS: Record<Estado, string> = {
  draft: C.muted,
  sent: C.brand,
  accepted: C.green,
  paid: C.greenDark,
  rejected: C.red,
  expired: C.mutedLight,
  plantilla: C.amber,
};

const PLAN_LABELS_ES: Record<string, string> = {
  vende: 'Vende',
  controla: 'Controla',
  fideliza: 'Fideliza',
  automatiza: 'Automatiza',
};

// Descripción auto-generada del plan. Solo se regenera al cambiar plan/sucursales
// si el partner NO la personalizó (si aún matchea el patrón auto).
const autoPlanDesc = (nombre: string, suc: number) =>
  `Plan ${PLAN_LABELS_ES[nombre] || nombre} · ${suc} sucursal${suc > 1 ? 'es' : ''}`;
const isAutoPlanDesc = (desc: string | undefined | null) =>
  !desc || /^Plan .+ · \d+ sucursal(es)?$/.test(desc);

// Nombre visible de un item de plan: título personalizado del partner o el del catálogo.
const planDisplayName = (it: any) =>
  it.titulo || `Plan ${PLAN_LABELS_ES[it.nombre] || it.nombre}`;

// ─── Plantillas de TÉRMINOS Y CONDICIONES ───────────────────────────────────
// Sugeridas (hardcode) + las que el partner guarda. Las guardadas persisten como
// filas estado='plantilla' en la tabla quotes con meta.tc_template=true —
// mismo mecanismo que las plantillas de cotización, CERO cambios de backend.
const TC_SUGERIDAS: Array<{ nombre: string; texto: string }> = [
  {
    nombre: 'Licencia mensual',
    texto: 'Precios en MXN más IVA salvo que se indique "IVA incluido". La licencia se cobra por adelantado cada mes e incluye actualizaciones y soporte estándar. El servicio puede suspenderse por falta de pago. Esta cotización es válida hasta la vigencia indicada.',
  },
  {
    nombre: 'Licencia anual',
    texto: 'El plan anual equivale a 12 meses al precio de 10 (2 meses gratis) y se cobra en una sola exhibición al inicio del periodo. La renovación se realiza al precio vigente en la fecha de renovación. No es reembolsable una vez activada la licencia. Precios en MXN más IVA salvo indicarse "IVA incluido".',
  },
  {
    nombre: 'Hardware / equipo',
    texto: 'Los precios de hardware están sujetos a disponibilidad y pueden variar por tipo de cambio. La garantía es la del fabricante. No incluye instalación en sitio salvo que se indique como concepto. Tiempo de entrega estimado: 5 a 10 días hábiles a partir de la confirmación del pago.',
  },
  {
    nombre: 'Implementación / personalización',
    texto: 'Los trabajos de implementación y personalización requieren 50% de anticipo para agendar y 50% contra entrega. Los tiempos estimados corren a partir del anticipo y de la entrega completa de la información por parte del cliente. Incluye 2 rondas de ajustes; cambios de alcance se cotizan por separado.',
  },
  {
    nombre: 'Condiciones comerciales estándar',
    texto: 'Cotización válida hasta la vigencia indicada en el documento. Precios en MXN más IVA salvo indicarse "IVA incluido". El pago de esta cotización confirma la aceptación de los términos aquí descritos. Los conceptos marcados como promoción aplican únicamente dentro de la vigencia.',
  },
];

export interface TcTemplate { id: string; nombre: string; texto: string }

// Casos de éxito / testimonios que la cotización pública muestra AUTOMÁTICAMENTE
// (misma data que la sección "Marcas que crecen con Sacs" de cotizacion/[id].astro).
const PREVIEW_CASES = [
  {
    img: '/images/case-shakira-merch.webp', tag: 'Entretenimiento', tagBg: '#E84393', tagColor: '#fff',
    name: 'Liveshow Merchandising',
    desc: '1,500+ puntos de venta implementados para conciertos de Shakira, Metallica y Karol G en toda Latinoamérica.',
    metrics: ['150K+ transacciones', '75% más rápido'],
    quote: '"Con SACS no perdemos una sola venta, ni en el concierto más grande."',
  },
  {
    img: '/images/case-bella-pandita.webp', tag: 'Moda y hogar', tagBg: '#6C5CE7', tagColor: '#fff',
    name: 'La Bella Pandita',
    desc: 'De 1 tienda piloto a 42 sucursales sincronizadas en 3 años.',
    metrics: ['+300% lifetime value', '45% clientes leales'],
    quote: '"Dejamos de ser solo retail físico para convertirnos en una operación omnicanal integrada."',
  },
  {
    img: '/images/case-casa-maca.webp', tag: 'Moda consciente', tagBg: '#E8A838', tagColor: '#1a1a1a',
    name: 'Casa Maca',
    desc: 'Moda sustentable desde Guadalajara. 2 boutiques + e-commerce + social commerce conectados.',
    metrics: ['-80% trabajo manual', '+25% ticket promedio'],
    quote: '"Casa Maca diseña desde la intuición, pero ahora opera con datos."',
  },
];

const isLocked = (estado: string) => ['accepted', 'paid', 'rejected'].includes(estado);

// Estado EFECTIVO: en la BD una cotización vencida sigue como 'sent' (el vencimiento
// se deriva de `vigencia`, igual que en la página pública). Sin esto, las vencidas
// aparecen como "activas" para siempre en la lista, los filtros y el pipeline.
const effectiveEstado = (q: Pick<Quote, 'estado' | 'vigencia'>): Estado => {
  if (q.estado === 'sent' && q.vigencia) {
    const end = new Date(q.vigencia.length === 10 ? q.vigencia + 'T23:59:59' : q.vigencia);
    if (!isNaN(end.getTime()) && end.getTime() < Date.now()) return 'expired';
  }
  return q.estado;
};

// ─── Engagement helpers ────────────────────────────────────────────────────
// Backend trackea views/timeline en meta dentro de `notas` (POST /api/revenue/quote-view
// cada vez que el cliente abre el link público). Aquí solo leemos.

type QuoteAnalytics = {
  views: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  timeline: Array<{ event: string; at: string; [k: string]: any }>;
};

function getQuoteAnalytics(q: Pick<Quote, 'notas'>): QuoteAnalytics {
  const meta = parseMeta(q.notas || '').meta || {};
  return {
    views: Number(meta.views) || 0,
    firstViewedAt: meta.first_viewed_at || null,
    lastViewedAt: meta.last_viewed_at || null,
    timeline: Array.isArray(meta.timeline) ? meta.timeline : [],
  };
}

const TIMELINE_LABELS: Record<string, string> = {
  viewed: 'Cliente abrió la cotización',
  accepted: 'Cliente aceptó',
  rejected: 'Cliente rechazó',
  paid: 'Cliente pagó',
  extended: 'Vigencia extendida',
  sent: 'Cotización enviada',
  comment: 'Cliente comentó',
  reply: 'Respuesta enviada',
  reminder: 'Recordatorio automático enviado',
  reactivation_requested: 'Cliente pidió reactivarla',
};

// Fecha de PAGO de una quote: el evento 'paid' del timeline (lo escribe tanto el
// pago del cliente como el botón "Marcar como pagada"); fallbacks para quotes
// viejas sin evento.
function getPaidAt(q: Pick<Quote, 'notas' | 'aceptado_fecha' | 'updated_at' | 'created_at'>): string | null {
  const tl = getQuoteAnalytics(q as any).timeline;
  for (let i = tl.length - 1; i >= 0; i--) {
    if (tl[i].event === 'paid' && tl[i].at) return tl[i].at;
  }
  return q.aceptado_fecha || q.updated_at || q.created_at || null;
}

const TIMELINE_COLORS: Record<string, string> = {
  viewed: C.brand,
  accepted: C.green,
  rejected: C.red,
  paid: C.greenDark,
  extended: C.amber,
  sent: C.muted,
  comment: C.brand,
  reply: C.muted,
  reminder: C.muted,
  reactivation_requested: C.amber,
};

export default function CotizacionesTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todas' | 'activas' | 'aceptadas' | 'pagadas' | 'cerradas'>('todas');
  // Resultados por periodo (pagado + comisión)
  const [periodo, setPeriodo] = useState<'mes' | 'mes_pasado' | 'anio' | 'todo' | 'custom'>('mes');
  const [rangoDesde, setRangoDesde] = useState('');
  const [rangoHasta, setRangoHasta] = useState('');
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editing, setEditing] = useState<Partial<Quote> | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await apiGet<Quote[]>('/api/revenue/quotes', isDemoMode() ? (demoQuotes as any) : undefined);
    setQuotes(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Las plantillas viven en la misma tabla (estado='plantilla') pero NO son
  // cotizaciones: van en su propia sección y fuera de lista/stats/filtros.
  // Las de meta.tc_template son plantillas de TÉRMINOS Y CONDICIONES (solo texto),
  // no de cotización completa — se usan dentro del editor.
  const esTcTemplate = (q: Quote) => !!parseMeta(q.notas || '').meta?.tc_template;
  const plantillas = useMemo(() => (quotes || []).filter((q) => q.estado === 'plantilla' && !esTcTemplate(q)), [quotes]);
  const tcTemplates = useMemo<TcTemplate[]>(
    () => (quotes || [])
      .filter((q) => q.estado === 'plantilla' && esTcTemplate(q))
      .map((q) => ({ id: q.id, nombre: q.empresa || 'Plantilla', texto: q.condiciones || '' })),
    [quotes],
  );
  const reales = useMemo(() => (quotes || []).filter((q) => q.estado !== 'plantilla'), [quotes]);

  const visible = useMemo(() => {
    return reales.filter((q) => {
      const est = effectiveEstado(q);
      if (filter === 'todas') return true;
      if (filter === 'activas') return ['draft', 'sent'].includes(est);
      if (filter === 'aceptadas') return ['accepted', 'paid'].includes(est);
      if (filter === 'pagadas') return est === 'paid';
      if (filter === 'cerradas') return ['rejected', 'expired'].includes(est);
      return true;
    });
  }, [reales, filter]);

  const stats = useMemo(() => {
    if (!reales.length) return { total: 0, enviadas: 0, aceptadas: 0, valorPipeline: 0, sinAbrir: 0, tasa: null as number | null, diasCierre: null as number | null, pctAbiertas: null as number | null, pagadas: 0, totalPagado: 0, comisionPagada: 0 };
    // Estado efectivo: las 'sent' con vigencia pasada cuentan como vencidas,
    // no como activas (antes inflaban "Enviadas activas" y el pipeline por siempre).
    const enviadasArr = reales.filter((q) => effectiveEstado(q) === 'sent');
    const aceptadasArr = reales.filter((q) => ['accepted', 'paid'].includes(q.estado));
    // Métricas de cierre: sobre cotizaciones que ya tuvieron desenlace o están en juego
    const decididas = reales.filter((q) => ['accepted', 'paid', 'rejected', 'expired'].includes(effectiveEstado(q)));
    const tasa = decididas.length >= 3 ? Math.round((aceptadasArr.length / decididas.length) * 100) : null;
    const conCierre = aceptadasArr.filter((q) => q.aceptado_fecha && q.created_at);
    const diasCierre = conCierre.length > 0
      ? Math.round(conCierre.reduce((s, q) => s + Math.max(0, (new Date(q.aceptado_fecha!).getTime() - new Date(q.created_at).getTime()) / 86400000), 0) / conCierre.length)
      : null;
    const enviadasTodas = reales.filter((q) => q.estado !== 'draft');
    const pctAbiertas = enviadasTodas.length >= 3
      ? Math.round((enviadasTodas.filter((q) => getQuoteAnalytics(q).views > 0).length / enviadasTodas.length) * 100)
      : null;
    // Pagadas: ingresos confirmados + comisión generada (tasas por categoría)
    const pagadasArr = reales.filter((q) => q.estado === 'paid');
    return {
      total: reales.length,
      enviadas: enviadasArr.length,
      sinAbrir: enviadasArr.filter((q) => getQuoteAnalytics(q).views === 0).length,
      aceptadas: aceptadasArr.length,
      valorPipeline: reales
        .filter((q) => ['sent', 'draft'].includes(effectiveEstado(q)))
        .reduce((s, q) => s + (q.total || 0), 0),
      tasa, diasCierre, pctAbiertas,
      pagadas: pagadasArr.length,
      totalPagado: pagadasArr.reduce((s, q) => s + (q.total || 0), 0),
      comisionPagada: pagadasArr.reduce((s, q) => s + calcComisionQuote(q).total, 0),
    };
  }, [reales]);

  // ─── Resultados del periodo: pagado + comisión, filtrados por fecha de pago ───
  const periodStats = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (periodo === 'mes') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (periodo === 'mes_pasado') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodo === 'anio') start = new Date(now.getFullYear(), 0, 1);
    else if (periodo === 'custom') {
      if (rangoDesde) start = new Date(rangoDesde + 'T00:00:00');
      if (rangoHasta) end = new Date(rangoHasta + 'T23:59:59');
    }
    const pagadas = reales.filter((q) => q.estado === 'paid').filter((q) => {
      if (!start && !end) return true;
      const raw = getPaidAt(q);
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
    const porCategoria: Record<string, number> = {};
    let comision = 0;
    for (const q of pagadas) {
      const com = calcComisionQuote(q);
      comision += com.total;
      for (const cat of COMISION_CATEGORIAS) {
        if (com.porCategoria[cat].comision > 0) porCategoria[cat] = (porCategoria[cat] || 0) + com.porCategoria[cat].comision;
      }
    }
    return {
      count: pagadas.length,
      totalPagado: pagadas.reduce((s, q) => s + (q.total || 0), 0),
      comision,
      porCategoria,
    };
  }, [reales, periodo, rangoDesde, rangoHasta]);

  // "Mis conceptos": extras que el partner ya usó antes (dedupe por nombre,
  // conserva el precio más reciente) → botones de un clic en el editor.
  const conceptosPrevios = useMemo(() => {
    const map = new Map<string, any>();
    for (const q of reales) {
      for (const it of Array.isArray(q.items) ? q.items : []) {
        if (it?.tipo !== 'extra' || it?.es_promocion) continue;
        const nombre = String(it.nombre || '').trim();
        if (!nombre || nombre === 'Servicio adicional') continue;
        if (!map.has(nombre.toLowerCase())) {
          map.set(nombre.toLowerCase(), {
            nombre,
            precio: Number(it.precio_unitario) || Number(it.monto) || 0,
            recurrente: !!it.recurrente,
            periodo_extra: it.periodo_extra || 'unico',
            descripcion: it.descripcion || '',
          });
        }
      }
    }
    return Array.from(map.values()).slice(0, 12);
  }, [reales]);

  if (loading) return <div style={SS.loading}>Cargando cotizaciones…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
        <div>
          <h1 style={SS.h1Small}>Cotizaciones</h1>
          <p style={SS.leadSm}>
            Crea y envía cotizaciones a tus prospectos. Aparecen con tu nombre como asesor y el cobro lo procesa SACS.
          </p>
        </div>
        <button
          onClick={() => setEditing({
            empresa: '', contacto: '', email: '', whatsapp: '',
            items: [],
            moneda: 'MXN',
            descuento_global: 0,
            descuento_tipo: 'pct',
            iva_incluido: true,
            vigencia: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
            condiciones: '',
            estado: 'draft',
          })}
          style={SS.btn}
        >
          + Nueva cotización
        </button>
      </div>

      {/* Stats */}
      <div style={SS.statGrid}>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Total</div>
          <div style={SS.statValueSm}>{stats.total}</div>
          <div style={SS.statHint}>cotizaciones creadas</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Enviadas activas</div>
          <div style={SS.statValueSm}>{stats.enviadas}</div>
          <div style={SS.statHint}>
            {stats.sinAbrir > 0
              ? <span style={{ color: C.amber, fontWeight: 600 }}>{stats.sinAbrir} sin abrir</span>
              : stats.enviadas > 0
                ? 'todas vistas por el cliente'
                : 'esperando respuesta'}
          </div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Aceptadas</div>
          <div style={SS.statValueSm}>{stats.aceptadas}</div>
          <div style={SS.statHint}>convertidas en clientes</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Pipeline</div>
          <div style={SS.statValueSm}>{fmt(stats.valorPipeline)}</div>
          <div style={SS.statHint}>valor cotizado en activas</div>
        </div>
        <div style={SS.statCard}>
          <div style={SS.statLabel}>Total pagado</div>
          <div style={{ ...SS.statValueSm, color: C.greenDark }}>{fmt(stats.totalPagado)}</div>
          <div style={SS.statHint}>
            {stats.pagadas > 0
              ? <>{stats.pagadas} pagada{stats.pagadas !== 1 ? 's' : ''} · comisión ≈ <strong style={{ color: C.greenDark }}>{fmt(stats.comisionPagada)}</strong></>
              : 'ingresos confirmados'}
          </div>
        </div>
      </div>

      {/* Métricas de cierre — aparecen cuando hay historial suficiente */}
      {(stats.tasa !== null || stats.diasCierre !== null || stats.pctAbiertas !== null) && (
        <div style={{ ...SS.statGrid, marginTop: 0 }}>
          {stats.tasa !== null && (
            <div style={SS.statCard}>
              <div style={SS.statLabel}>Tasa de cierre</div>
              <div style={{ ...SS.statValueSm, color: stats.tasa >= 40 ? C.green : stats.tasa >= 20 ? C.amber : C.red }}>{stats.tasa}%</div>
              <div style={SS.statHint}>de las decididas, aceptadas</div>
            </div>
          )}
          {stats.diasCierre !== null && (
            <div style={SS.statCard}>
              <div style={SS.statLabel}>Días a cierre</div>
              <div style={SS.statValueSm}>{stats.diasCierre}</div>
              <div style={SS.statHint}>promedio de envío a aceptación</div>
            </div>
          )}
          {stats.pctAbiertas !== null && (
            <div style={SS.statCard}>
              <div style={SS.statLabel}>Apertura</div>
              <div style={SS.statValueSm}>{stats.pctAbiertas}%</div>
              <div style={SS.statHint}>de tus cotizaciones son abiertas</div>
            </div>
          )}
        </div>
      )}

      {/* ─── Resultados del periodo: pagado real + comisión generada ─── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Resultados del periodo
          </span>
          {([
            ['mes', 'Este mes'],
            ['mes_pasado', 'Mes pasado'],
            ['anio', 'Este año'],
            ['todo', 'Todo'],
            ['custom', 'Rango…'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              style={{
                ...SS.pill, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: periodo === key ? C.brand : C.borderSoft,
                color: periodo === key ? '#fff' : C.text,
              }}
            >
              {label}
            </button>
          ))}
          {periodo === 'custom' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={rangoDesde} onChange={(e) => setRangoDesde(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 12 }} />
              <span style={{ fontSize: 12, color: C.muted }}>a</span>
              <input type="date" value={rangoHasta} onChange={(e) => setRangoHasta(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 12 }} />
            </span>
          )}
        </div>
        <div style={SS.statGrid}>
          <div style={SS.statCard}>
            <div style={SS.statLabel}>Pagado en el periodo</div>
            <div style={{ ...SS.statValueSm, color: C.greenDark }}>{fmt(periodStats.totalPagado)}</div>
            <div style={SS.statHint}>{periodStats.count} cotización{periodStats.count !== 1 ? 'es' : ''} pagada{periodStats.count !== 1 ? 's' : ''}</div>
          </div>
          <div style={SS.statCard}>
            <div style={SS.statLabel}>Comisión del periodo</div>
            <div style={{ ...SS.statValueSm, color: C.greenDark }}>≈ {fmt(periodStats.comision)}</div>
            <div style={SS.statHint}>
              {Object.keys(periodStats.porCategoria).length > 0
                ? (COMISION_CATEGORIAS.filter((c) => periodStats.porCategoria[c] > 0)
                    .map((c) => `${COMISION_LABELS[c]} ${fmt(periodStats.porCategoria[c])}`)
                    .join(' · '))
                : 'según categoría de cada concepto'}
            </div>
          </div>
        </div>
      </div>


      {/* Mis plantillas — arranca cada cotización al 80% */}
      {plantillas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Mis plantillas
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plantillas.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.borderSoft, borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.empresa || 'Plantilla'}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{fmt(p.total)}</span>
                <button
                  onClick={() => {
                    // Usar plantilla → nueva cotización draft con los datos precargados
                    const pMeta = parseMeta(p.notas || '').meta;
                    const { views: _v, first_viewed_at: _f, last_viewed_at: _l, timeline: _tl, extensions: _ex, ...cleanMeta } = pMeta;
                    setEditing({
                      empresa: '', contacto: '', email: '', whatsapp: '',
                      items: Array.isArray(p.items) ? p.items.map((it: any) => ({ ...it })) : [],
                      moneda: p.moneda || 'MXN',
                      descuento_global: p.descuento_global || 0,
                      descuento_tipo: p.descuento_tipo || 'pct',
                      iva_incluido: p.iva_incluido !== false,
                      vigencia: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
                      condiciones: p.condiciones || '',
                      notas: serializeMeta('', cleanMeta),
                      estado: 'draft',
                    });
                  }}
                  style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 10px' }}
                >
                  Usar
                </button>
                <button
                  onClick={async () => {
                    if (isDemoMode()) return;
                    await fetch(`/api/revenue/quotes?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                    load();
                  }}
                  title="Eliminar plantilla"
                  style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {([
          ['todas', 'Todas'],
          ['activas', 'Activas'],
          ['aceptadas', 'Aceptadas'],
          ['pagadas', 'Pagadas'],
          ['cerradas', 'Cerradas'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              ...SS.pill,
              padding: '7px 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              background: filter === key ? C.brand : C.borderSoft,
              color: filter === key ? '#fff' : C.text,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div style={SS.empty}>
          {filter === 'todas'
            ? 'Aún no has creado cotizaciones. Crea la primera con el botón de arriba.'
            : 'No hay cotizaciones en este estado.'}
        </div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Folio</th>
                <th style={SS.th}>Empresa</th>
                <th style={SS.th}>Total</th>
                <th style={SS.th}>Estado</th>
                <th style={SS.th}>Vigencia</th>
                <th style={SS.th}>Creada</th>
                <th style={SS.th}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const a = getQuoteAnalytics(q);
                const est = effectiveEstado(q);
                const showEng = ['sent', 'accepted', 'paid', 'rejected', 'expired'].includes(est);
                return (
                <tr
                  key={q.id}
                  onClick={() => setSelected(q)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.borderSoft)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={SS.td}><strong>{q.numero || '—'}</strong></td>
                  <td style={SS.td}>
                    <div style={{ fontWeight: 600 }}>{q.empresa || '—'}</div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {q.contacto || ''}
                      {showEng && <EngagementBadge analytics={a} />}
                    </div>
                  </td>
                  <td style={SS.td}>
                    <strong>{fmt(q.total)}</strong> <span style={{ color: C.muted, fontSize: 12 }}>{q.moneda || 'MXN'}</span>
                  </td>
                  <td style={SS.td}>
                    <span style={stagePillStyle(ESTADO_COLORS[est] || C.muted)}>
                      {ESTADO_LABELS[est] || est}
                    </span>
                  </td>
                  <td style={SS.td}>{fmtDate(q.vigencia)}</td>
                  <td style={SS.td}>{fmtDate(q.created_at)}</td>
                  <td style={SS.td}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(q);
                      }}
                      style={{ ...SS.btnGhost, padding: '6px 12px', fontSize: 12 }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer detalle */}
      {selected && (
        <QuoteDetail
          quote={selected}
          user={user}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onDuplicate={() => {
            const src = selected;
            // Limpia notas: conserva texto + meta de personalización; borra analytics/extensiones
            // (views, timeline, first/last_viewed_at, extensions) — pertenecen al original.
            const { text, meta } = parseMeta(src.notas || '');
            const { views: _v, first_viewed_at: _f, last_viewed_at: _l, timeline: _tl, extensions: _ex, ...cleanMeta } = meta;
            const cleanNotas = serializeMeta(text || '', cleanMeta);
            // Copia limpia: borra ids/folios/timestamps/acepts → vuelve a ser draft.
            const copy: Partial<Quote> = {
              empresa: src.empresa,
              contacto: src.contacto,
              email: src.email,
              whatsapp: src.whatsapp,
              items: Array.isArray(src.items)
                ? src.items.map((it: any) => ({ ...it }))
                : [],
              moneda: src.moneda || 'MXN',
              descuento_global: src.descuento_global || 0,
              descuento_tipo: src.descuento_tipo || 'pct',
              iva_incluido: src.iva_incluido !== false,
              vigencia: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
              condiciones: src.condiciones || '',
              notas: cleanNotas,
              estado: 'draft',
            };
            setEditing(copy);
            setSelected(null);
          }}
          onReload={load}
        />
      )}

      {/* Drawer editor */}
      {editing && (
        <QuoteEditor
          initial={editing}
          user={user}
          conceptosPrevios={conceptosPrevios}
          tcTemplates={tcTemplates}
          onTcChanged={load}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────────────────

function QuoteDetail({
  quote,
  user,
  onClose,
  onEdit,
  onDuplicate,
  onReload,
}: {
  quote: Quote;
  user: { id: string; nombre: string; email: string };
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onReload: () => void;
}) {
  const locked = isLocked(quote.estado);
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cotizacion/${quote.id}`
    : `/cotizacion/${quote.id}`;
  const [copied, setCopied] = useState(false);
  const [extending, setExtending] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  // Borrado: aceptada/pagada NO se pueden (ya hay comisión/factura). draft se borra
  // de verdad; el resto se archiva (reversible). Espeja canPartnerDeleteQuote del backend.
  const canDelete = quote.estado !== 'accepted' && quote.estado !== 'paid';
  const deleteIsPermanent = quote.estado === 'draft';

  const doDelete = async () => {
    if (isDemoMode()) {
      alert('En modo demo no se modifican cotizaciones.');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/revenue/quotes?id=${encodeURIComponent(quote.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Error: ' + (err.error || res.statusText));
        return;
      }
      onReload();
      onClose();
    } finally {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  // Extension status — partner puede extender +15d una vez por quote
  const meta = useMemo(() => parseMeta(quote.notas || '').meta, [quote.notas]);
  const extensions: any[] = Array.isArray(meta.extensions) ? meta.extensions : [];
  const canExtend = !locked && quote.estado !== 'rejected' && quote.estado !== 'draft' && extensions.length === 0;
  const wasExtended = extensions.length > 0;

  // ─── Hilo de comentarios con el cliente (mismo canal que la página pública) ───
  const [comments, setComments] = useState<any[]>(Array.isArray(meta.comments) ? meta.comments : []);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const sendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    if (isDemoMode()) { alert('En modo demo no se envían respuestas.'); return; }
    setSendingReply(true);
    try {
      const res = await fetch('/api/revenue/quote-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quote.id, from: 'admin', name: user.nombre || 'Tu asesor', text }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.comments)) setComments(data.comments);
        setReplyText('');
      }
    } finally {
      setSendingReply(false);
    }
  };

  // ─── Solicitud de reactivación pendiente (cliente la pidió desde la pública) ───
  const reactivationPending = !!meta.reactivation_requested_at && !meta.reactivation_resolved_at;

  const extend = async () => {
    if (isDemoMode()) {
      alert('En modo demo no se modifican cotizaciones.');
      return;
    }
    if (!confirm('Extender la vigencia +15 días? Solo se puede hacer una vez por cotización.')) return;
    setExtending(true);
    try {
      const res = await fetch('/api/revenue/extend-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quote.id, days: 15 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Error: ' + (err.error || res.statusText));
        return;
      }
      onReload();
      onClose();
    } finally {
      setExtending(false);
    }
  };

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              {quote.numero || 'Sin folio'}
            </div>
            <h2 style={{ ...SS.h3, margin: 0 }}>{quote.empresa || '—'}</h2>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{quote.contacto || ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22 }}>
            ×
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={stagePillStyle(ESTADO_COLORS[effectiveEstado(quote)] || C.muted)}>
            {ESTADO_LABELS[effectiveEstado(quote)] || quote.estado}
          </span>
        </div>

        {reactivationPending && (
          <div style={{ background: '#FEF6E7', border: `1px solid ${C.amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
            <strong style={{ color: '#9A6B1F' }}>⏰ ¡El cliente pidió reactivar esta cotización!</strong>
            <div style={{ color: '#9A6B1F', marginTop: 4 }}>
              {meta.reactivation_message ? `“${meta.reactivation_message}” — ` : ''}
              Usa <strong>Extender vigencia</strong> para reactivarla y avísale que ya está lista.
            </div>
          </div>
        )}

        <div style={{ background: C.borderSoft, padding: '18px 20px', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: C.muted }}>Total</span>
            <strong style={{ fontSize: 18 }}>{fmt(quote.total)} {quote.moneda || 'MXN'}</strong>
          </div>
          {(() => {
            const com = calcComisionQuote(quote);
            if (com.total <= 0) return null;
            const isPaid = quote.estado === 'paid';
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: C.muted }}>{isPaid ? 'Tu comisión generada' : 'Tu comisión (si se paga)'}</span>
                <strong style={{ color: C.greenDark }}>≈ {fmt(com.total)}</strong>
              </div>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted }}>
            <span>Vigencia</span>
            <span>
              {fmtDate(quote.vigencia)}
              {wasExtended && (
                <span style={{ fontSize: 11, color: C.amber, marginLeft: 6, fontWeight: 600 }}>
                  (extendida +{extensions.reduce((s, ex) => s + (Number(ex.days) || 0), 0)}d)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Actividad del cliente · solo si está enviada o en estado terminal */}
        {quote.estado !== 'draft' && <QuoteActivity quote={quote} />}

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Conceptos</h3>
        <div style={{ marginBottom: 24 }}>
          {(quote.items || []).map((it: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}`, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{(it.tipo === 'plan' && it.titulo) || it.descripcion || it.nombre || 'Item'}</div>
                <div style={{ color: C.mutedLight, fontSize: 11, marginTop: 2 }}>
                  {it.tipo === 'plan' ? `Plan recurrente · ${it.periodo === 'anual' ? 'anual' : 'mensual'}` : it.recurrente ? `Recurrente · ${it.periodo_extra || 'mensual'}` : 'Único'}
                </div>
              </div>
              <strong>{fmt(it.subtotal || it.monto || 0)}</strong>
            </div>
          ))}
        </div>

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Cliente</h3>
        <div style={{ fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
          <div><strong>Email:</strong> {quote.email || '—'}</div>
          <div><strong>WhatsApp:</strong> {quote.whatsapp || '—'}</div>
          {quote.aceptado_por && (
            <div style={{ marginTop: 8, color: C.green }}>
              <strong>Aceptada por:</strong> {quote.aceptado_por} ({fmtDate(quote.aceptado_fecha)})
            </div>
          )}
        </div>

        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Link público</h3>
        <div style={{ background: C.brandSoft, padding: 14, borderRadius: 10, marginBottom: 24 }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 11, wordBreak: 'break-all', color: C.brandDark, marginBottom: 10 }}>
            {publicUrl}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                await copyToClipboard(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              style={{ ...SS.btnSm, background: C.brand }}
            >
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            {quote.whatsapp && (
              <a
                href={`https://wa.me/${quote.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${quote.contacto || ''}, te comparto la cotización: ${publicUrl}`)}`}
                target="_blank"
                rel="noopener"
                style={{ ...SS.btnSm, background: '#25D366', textDecoration: 'none', display: 'inline-block' }}
              >
                Enviar por WhatsApp
              </a>
            )}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener"
              style={{ ...SS.btnGhost, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}
            >
              Abrir vista cliente
            </a>
            <a
              href={`${publicUrl}?print=1`}
              target="_blank"
              rel="noopener"
              style={{ ...SS.btnGhost, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}
              title="Abre la cotización y dispara el diálogo de impresión (Guardar como PDF)"
            >
              Descargar PDF
            </a>
          </div>
        </div>

        {/* Hilo de preguntas del cliente — responder rápido mantiene la venta caliente */}
        {(comments.length > 0 || quote.estado === 'sent') && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Conversación con el cliente
            </div>
            {comments.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Sin preguntas aún. Si el cliente comenta en la cotización, te llega un correo y aparece aquí.</div>
            )}
            {comments.map((cm: any, i: number) => (
              <div key={i} style={{
                background: cm.from === 'prospect' ? C.borderSoft : '#EEF2FB',
                borderRadius: 10, padding: '8px 12px', marginBottom: 6, fontSize: 13, lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
                  <strong>{cm.name || (cm.from === 'prospect' ? 'Cliente' : 'Tú')}</strong> · {fmtRel(cm.at)}
                </div>
                {cm.text}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                placeholder="Responde al cliente…"
                style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
              />
              <button onClick={sendReply} disabled={sendingReply || !replyText.trim()} style={{ ...SS.btnGhost, fontSize: 12, opacity: sendingReply ? 0.6 : 1 }}>
                {sendingReply ? 'Enviando…' : 'Responder'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!locked && (
            <button onClick={onEdit} style={SS.btn}>
              Editar cotización
            </button>
          )}
          <button onClick={onDuplicate} style={SS.btnGhost}>
            Duplicar
          </button>
          {['sent', 'accepted'].includes(quote.estado) && (
            confirmPaid ? (
              <button
                onClick={async () => {
                  if (isDemoMode()) { alert('En modo demo no se modifican cotizaciones.'); setConfirmPaid(false); return; }
                  setMarkingPaid(true);
                  try {
                    const res = await fetch('/api/revenue/quotes', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: quote.id, estado: 'paid' }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert('Error: ' + (err.error || res.statusText));
                      return;
                    }
                    onReload();
                    onClose();
                  } finally {
                    setMarkingPaid(false);
                    setConfirmPaid(false);
                  }
                }}
                disabled={markingPaid}
                style={{ ...SS.btnGhost, borderColor: C.green, color: C.greenDark, fontWeight: 700, opacity: markingPaid ? 0.6 : 1 }}
              >
                {markingPaid ? 'Marcando…' : '¿Seguro? Sí, ya pagó'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setConfirmPaid(true);
                  setTimeout(() => setConfirmPaid(false), 4000);
                }}
                style={{ ...SS.btnGhost, borderColor: C.green, color: C.greenDark }}
                title="El total pasa a ingresos confirmados y genera tu comisión"
              >
                💰 Marcar como pagada
              </button>
            )
          )}
          {canExtend && (
            <button onClick={extend} disabled={extending} style={{ ...SS.btnGhost, opacity: extending ? 0.6 : 1 }}>
              {extending ? 'Extendiendo…' : 'Extender +15 días'}
            </button>
          )}
          {!locked && quote.estado !== 'rejected' && (
            <button
              onClick={async () => {
                if (isDemoMode()) {
                  alert('En modo demo no se modifican cotizaciones.');
                  return;
                }
                const motivo = prompt('Motivo de rechazo (precio / timing / competidor / no_fit / otro)', 'otro');
                if (!motivo) return;
                const detalle = prompt('Detalle (opcional)', '');
                const res = await fetch('/api/revenue/mark-rejected', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ quoteId: quote.id, motivo, detalle, from: 'partner' }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  alert('Error: ' + (err.error || res.statusText));
                  return;
                }
                onReload();
                onClose();
              }}
              style={SS.btnGhost}
            >
              Marcar rechazada
            </button>
          )}
          {canDelete && (
            confirmDel ? (
              <button
                onClick={doDelete}
                disabled={deleting}
                style={{ ...SS.btnGhost, borderColor: C.red || '#dc2626', color: C.red || '#dc2626', fontWeight: 700, opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Eliminando…' : (deleteIsPermanent ? '¿Seguro? Sí, eliminar' : '¿Seguro? Sí, archivar')}
              </button>
            ) : (
              <button
                onClick={() => {
                  setConfirmDel(true);
                  // auto-reset del "armado" a los 4s para no dejar el botón peligroso activo
                  setTimeout(() => setConfirmDel(false), 4000);
                }}
                style={{ ...SS.btnGhost, color: C.muted }}
                title={deleteIsPermanent ? 'Elimina el borrador de forma permanente' : 'Archiva la cotización (reversible)'}
              >
                Eliminar
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ─── Engagement UI ─────────────────────────────────────────────────────────

function EngagementBadge({ analytics }: { analytics: QuoteAnalytics }) {
  const { views, lastViewedAt } = analytics;
  if (views <= 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.mutedLight, padding: '2px 7px', background: C.borderSoft, borderRadius: 999, fontWeight: 500 }}>
        Sin abrir
      </span>
    );
  }
  return (
    <span
      title={lastViewedAt ? `Última vista: ${fmtRel(lastViewedAt)}` : `${views} vista${views === 1 ? '' : 's'}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.brandDark, padding: '2px 7px', background: C.brandSoft, borderRadius: 999, fontWeight: 600 }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {views} {views === 1 ? 'vista' : 'vistas'}
      {lastViewedAt && <span style={{ color: C.brand, fontWeight: 500 }}>· {fmtRel(lastViewedAt)}</span>}
    </span>
  );
}

function QuoteActivity({ quote }: { quote: Quote }) {
  const a = getQuoteAnalytics(quote);
  // Eventos del timeline relevantes para mostrar (más recientes primero, máx 6)
  const events = [...a.timeline]
    .filter((e) => e?.event && e?.at)
    .sort((x, y) => (new Date(y.at).getTime() - new Date(x.at).getTime()))
    .slice(0, 6);
  return (
    <div style={{ background: '#fafbfd', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...SS.h3, fontSize: 13, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 }}>
          Actividad del cliente
        </h3>
        <EngagementBadge analytics={a} />
      </div>
      {a.views === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          El cliente aún no abre la cotización. Si ya la enviaste, considera reenviársela por WhatsApp.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: events.length ? 14 : 0 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Primera vista</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtRel(a.firstViewedAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Última vista</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtRel(a.lastViewedAt)}</div>
            </div>
          </div>
          {events.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                Eventos recientes
              </div>
              <ul style={{ listStyle: 'none' as const, padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {events.map((ev, idx) => {
                  const label = TIMELINE_LABELS[ev.event] || ev.event;
                  const color = TIMELINE_COLORS[ev.event] || C.muted;
                  return (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSoft }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{label}</span>
                      <span style={{ color: C.mutedLight, fontSize: 11 }}>{fmtRel(ev.at)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Editor drawer ─────────────────────────────────────────────────────────

function QuoteEditor({
  initial,
  user: _user,
  conceptosPrevios = [],
  tcTemplates = [],
  onTcChanged,
  onClose,
  onSaved,
}: {
  initial: Partial<Quote>;
  user: { id: string; nombre: string; email: string };
  conceptosPrevios?: Array<{ nombre: string; precio: number; recurrente: boolean; periodo_extra: string; descripcion: string }>;
  tcTemplates?: TcTemplate[];
  onTcChanged?: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Parse meta del initial (logo_url, mostrar_*, key_points, roi, antes_despues, promo_label, minuta_raw)
  const initialMeta = useMemo(() => {
    if (!initial?.notas) return {};
    return parseMeta(initial.notas).meta;
  }, [initial?.notas]);

  const [form, setForm] = useState<Partial<Quote> & Record<string, any>>(() => ({
    moneda: 'MXN',
    template: 'modern',
    descuento_global: 0,
    descuento_tipo: 'pct',
    iva_incluido: true,
    // IVA de 3 estados: 'suma' (16% aparte) | 'incluido' (dentro del precio) | 'sin'.
    // Se respeta meta.iva_mode al editar para NO reinterpretar 'incluido' como 'suma'
    // (eso inflaba el total 16% vs. lo que muestra la cotización impresa/pública).
    iva_mode: initialMeta.iva_mode || ((initial && initial.iva_incluido === false) ? 'sin' : 'suma'),
    // Meta-derived (controlados aquí, serializados al guardar)
    logo_url: initialMeta.logo_url || '',
    key_points: Array.isArray(initialMeta.key_points) ? initialMeta.key_points : [],
    roi: initialMeta.roi || null,
    antes_despues: Array.isArray(initialMeta.antes_despues) ? initialMeta.antes_despues : [],
    promo_label: initialMeta.promo_label || '',
    minuta_raw: initialMeta.minuta_raw || '',
    mostrar_timer: initialMeta.mostrar_timer !== undefined ? initialMeta.mostrar_timer : true,
    mostrar_features: initialMeta.mostrar_features !== undefined ? initialMeta.mostrar_features : true,
    mostrar_desglose: initialMeta.mostrar_desglose !== undefined ? initialMeta.mostrar_desglose : true,
    mostrar_condiciones: initialMeta.mostrar_condiciones !== undefined ? initialMeta.mostrar_condiciones : true,
    mostrar_firma: initialMeta.mostrar_firma !== undefined ? initialMeta.mostrar_firma : true,
    mostrar_key_points: initialMeta.mostrar_key_points !== undefined ? initialMeta.mostrar_key_points : true,
    mostrar_roi: !!initialMeta.mostrar_roi,
    mostrar_antes_despues: !!initialMeta.mostrar_antes_despues,
    mostrar_timeline: initialMeta.mostrar_timeline !== undefined ? initialMeta.mostrar_timeline : true,
    mostrar_implementacion: initialMeta.mostrar_implementacion !== undefined ? initialMeta.mostrar_implementacion : true,
    mostrar_porque_sacs: initialMeta.mostrar_porque_sacs !== undefined ? initialMeta.mostrar_porque_sacs : true,
    mostrar_qr: initialMeta.mostrar_qr !== undefined ? initialMeta.mostrar_qr : true,
    mostrar_animaciones: initialMeta.mostrar_animaciones !== undefined ? initialMeta.mostrar_animaciones : true,
    timeline_tipo: initialMeta.timeline_tipo || '1suc',
    implementacion_nota: initialMeta.implementacion_nota || '',
    // Personalización extendida (meta)
    giro: initialMeta.giro || '',
    video_url: initialMeta.video_url || '',
    attachments: Array.isArray(initialMeta.attachments) ? initialMeta.attachments : [],
    paquetes: Array.isArray(initialMeta.paquetes) ? initialMeta.paquetes : [],
    ...initial,
    // Re-normalizar subtotales de PLANES al cargar: cotizaciones guardadas antes del fix
    // del periodo anual (o drafts de IA) pueden traer subtotal stale → el total de abajo
    // y el preview deben mostrar SIEMPRE el monto real con la regla vigente.
    items: (Array.isArray(initial?.items) ? initial.items : []).map((it: any) => {
      if (!it || it.tipo !== 'plan') return it;
      const sub = computeItemSubtotal(it);
      return { ...it, subtotal: sub, monto: sub };
    }),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formattingMinuta, setFormattingMinuta] = useState(false);
  const [minutaError, setMinutaError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const isEdit = !!initial?.id;

  // ─── Plantillas de términos y condiciones ───
  // Copia local para que una plantilla recién guardada aparezca sin recargar.
  const [tcLocal, setTcLocal] = useState<TcTemplate[]>(tcTemplates);
  const [savingTc, setSavingTc] = useState(false);

  const insertTc = (texto: string) => {
    const actual = (form.condiciones || '').trim();
    setForm({ ...form, condiciones: actual ? actual + '\n\n' + texto : texto });
  };

  const saveTcTemplate = async () => {
    const texto = (form.condiciones || '').trim();
    if (!texto) return;
    if (isDemoMode()) { alert('En modo demo no se guardan plantillas.'); return; }
    const nombre = prompt('Nombre de la plantilla de términos (ej. "Licencia anual + hardware")', '');
    if (!nombre) return;
    setSavingTc(true);
    try {
      const res = await fetch('/api/revenue/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: nombre, contacto: '', email: 'plantilla@sacscloud.com', whatsapp: '—',
          items: [], estado: 'plantilla', condiciones: texto,
          subtotal: 0, iva_monto: 0, total: 0, moneda: form.moneda || 'MXN',
          notas: serializeMeta('', { tc_template: true }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.id) {
        setTcLocal([...tcLocal, { id: data.id, nombre, texto }]);
        if (onTcChanged) onTcChanged();
      } else {
        setError(data?.error || 'No se pudo guardar la plantilla de términos');
      }
    } finally {
      setSavingTc(false);
    }
  };

  const deleteTc = async (tid: string) => {
    setTcLocal(tcLocal.filter((t) => t.id !== tid)); // optimista: quitar de inmediato
    if (isDemoMode()) return;
    try {
      await fetch(`/api/revenue/quotes?id=${encodeURIComponent(tid)}`, { method: 'DELETE' });
      if (onTcChanged) onTcChanged();
    } catch (e) { /* best-effort: reaparece al recargar si falló */ }
  };

  const items: any[] = Array.isArray(form.items) ? form.items : [];

  const updateItem = (idx: number, patch: any) => {
    const arr = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    arr[idx].subtotal = computeItemSubtotal(arr[idx]);
    arr[idx].monto = arr[idx].subtotal;
    setForm({ ...form, items: arr });
  };

  const removeItem = (idx: number) => {
    setForm({ ...form, items: items.filter((_, i) => i !== idx) });
  };

  const addPlan = () => {
    const nombre = 'controla';
    setForm({
      ...form,
      items: [...items, {
        tipo: 'plan',
        nombre,
        precio_unitario: PLAN_PRICES[nombre],
        periodo: 'mensual',
        sucursales: 1,
        descuento_pct: 0,
        subtotal: PLAN_PRICES[nombre],
        monto: PLAN_PRICES[nombre],
        recurrente: true,
        periodo_extra: 'mensual',
        descripcion: autoPlanDesc(nombre, 1),
        categoria_comision: 'licencia',
      }],
    });
  };

  const addExtraFromCatalog = (nombre: string) => {
    const def = PARTNER_EXTRAS_CATALOG.find((e) => e.nombre === nombre);
    if (!def) return;
    setForm({
      ...form,
      items: [...items, {
        tipo: 'extra',
        nombre: def.nombre,
        precio_unitario: def.precio_default,
        monto: def.precio_default,
        subtotal: def.precio_default,
        recurrente: def.recurrente,
        periodo_extra: def.periodo_extra,
        descripcion: def.descripcion || def.nombre,
        categoria_comision: defaultCategoria({ nombre: def.nombre, descripcion: def.descripcion }),
      }],
    });
  };

  const addExtraCustom = () => {
    setForm({
      ...form,
      items: [...items, {
        tipo: 'extra',
        nombre: 'Servicio adicional',
        precio_unitario: 0,
        monto: 0,
        subtotal: 0,
        recurrente: false,
        periodo_extra: 'unico',
        descripcion: '',
        categoria_comision: 'personalizacion',
      }],
    });
  };

  const addPromoImpl = () => {
    // Promo de implementación gratis (basado en plan principal)
    const mainPlan = items.find((i) => i.tipo === 'plan')?.nombre || 'controla';
    const valor = IMPL_PRICES[mainPlan] || 4000;
    setForm({
      ...form,
      items: [...items, {
        tipo: 'extra',
        es_promocion: true,
        nombre: `Implementación gratis (Plan ${PLAN_LABELS_ES[mainPlan]})`,
        precio_unitario: 0,
        monto: 0,
        subtotal: 0,
        precio_original: valor,
        recurrente: false,
        periodo_extra: 'unico',
        descripcion: `Setup, capacitación y migración inicial. Valor regular: $${valor.toLocaleString('es-MX')}`,
      }],
    });
  };

  const addPromoCustom = () => {
    setForm({
      ...form,
      items: [...items, {
        tipo: 'extra',
        es_promocion: true,
        nombre: 'Promoción especial',
        precio_unitario: 0,
        monto: 0,
        subtotal: 0,
        precio_original: 0,
        recurrente: false,
        periodo_extra: 'unico',
        descripcion: '',
      }],
    });
  };

  const setVigenciaPreset = (days: number) => {
    const d = new Date(Date.now() + days * 86400000);
    setForm({ ...form, vigencia: d.toISOString().slice(0, 10), urgencia: days <= 5 ? 'urgente' : days <= 3 ? 'oferta' : 'normal' });
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setForm({ ...form, logo_url: data.url });
      else setError(data.error || 'Error al subir logo');
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatMinuta = async () => {
    const raw = (form.minuta_raw || '').trim();
    setMinutaError(null);
    if (raw.length < 30) {
      setMinutaError('Escribe al menos 30 caracteres con los puntos de la llamada.');
      return;
    }
    const existing = (form.key_points || []).length;
    if (existing > 0) {
      const ok = confirm(`Ya tienes ${existing} ${existing === 1 ? 'punto' : 'puntos'} en la minuta. Procesar con IA reemplazará los puntos actuales. ¿Continuar?`);
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
      try { data = await res.json(); } catch (e) { /* respuesta no-JSON */ }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      const newPoints = Array.isArray(data.key_points) ? data.key_points : [];
      if (newPoints.length === 0) {
        setMinutaError('No se pudieron extraer puntos. Agrega más detalle y reintenta.');
      } else {
        setForm({ ...form, key_points: newPoints });
      }
    } catch (e: any) {
      setMinutaError(e?.message || 'Error de red al procesar la minuta');
    } finally {
      setFormattingMinuta(false);
    }
  };

  // ─── IA: transcripción → borrador completo de cotización (items+minuta+roi) ───
  const draftWithAI = async () => {
    const transcript = (form.minuta_raw || '').trim();
    setMinutaError(null);
    if (transcript.length < 80) {
      setMinutaError('Pega la transcripción o tus notas de la llamada (mínimo unas líneas) en el campo de arriba.');
      return;
    }
    if (items.length > 0) {
      const ok = confirm(`Ya tienes ${items.length} concepto(s). El borrador con IA los REEMPLAZARÁ (junto con minuta y ROI). ¿Continuar?`);
      if (!ok) return;
    }
    setDrafting(true);
    try {
      const res = await fetch('/api/revenue/draft-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      let data: any = {};
      try { data = await res.json(); } catch (e) { /* respuesta no-JSON */ }
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      const d = data.draft || {};
      setForm({
        ...form,
        // Solo llenar identidad si está vacía (no pisar lo que el partner ya escribió)
        empresa: form.empresa || d.empresa || '',
        contacto: form.contacto || d.contacto || '',
        giro: d.giro && CASOS_GIRO.some((c) => c.label.toLowerCase().includes(String(d.giro).toLowerCase()))
          ? (CASOS_GIRO.find((c) => c.label.toLowerCase().includes(String(d.giro).toLowerCase()))?.id || form.giro)
          : form.giro,
        items: Array.isArray(d.items) ? d.items : [],
        key_points: Array.isArray(d.key_points) ? d.key_points : form.key_points,
        roi: d.roi || form.roi,
        mostrar_roi: d.roi ? true : form.mostrar_roi,
        condiciones: form.condiciones || d.condiciones || '',
        descuento_global: d.descuento_global || form.descuento_global || 0,
      });
    } catch (e: any) {
      setMinutaError(e?.message || 'Error al generar el borrador');
    } finally {
      setDrafting(false);
    }
  };

  // ─── Mis conceptos: re-usar un extra de cotizaciones anteriores ───
  const addConceptoPrevio = (c: { nombre: string; precio: number; recurrente: boolean; periodo_extra: string; descripcion: string }) => {
    setForm({
      ...form,
      items: [...items, {
        tipo: 'extra', nombre: c.nombre,
        precio_unitario: c.precio, monto: c.precio, subtotal: c.precio,
        recurrente: c.recurrente, periodo_extra: c.periodo_extra || 'unico',
        descripcion: c.descripcion || '',
        categoria_comision: defaultCategoria(c),
      }],
    });
  };

  // ─── Paquetes A/B: el cliente elige entre 2-3 opciones ───
  const paquetesOn = Array.isArray(form.paquetes) && form.paquetes.length >= 2;
  const togglePaquetes = () => {
    if (paquetesOn) {
      // Apagar: los items vuelven a ser de "todos"
      setForm({ ...form, paquetes: [], items: items.map((it) => { const { paquete: _p, ...rest } = it; return rest; }) });
    } else {
      setForm({ ...form, paquetes: [ { id: 'a', nombre: 'Opción Esencial' }, { id: 'b', nombre: 'Opción Completa' } ] });
    }
  };
  const itemsDePaquete = (pid: string) => items.filter((it: any) => !it.paquete || it.paquete === pid);
  const totalesDePaquete = (pid: string) => calcQuoteTotals({
    items: itemsDePaquete(pid),
    descuento_global: form.descuento_global,
    descuento_tipo: form.descuento_tipo,
    iva_mode: ivaMode,
  });

  // ─── Guardar como plantilla (arranca la próxima cotización al 80%) ───
  const [savingTemplate, setSavingTemplate] = useState(false);
  const saveAsTemplate = async () => {
    if (isDemoMode()) { alert('En modo demo no se guardan plantillas.'); return; }
    if (items.length === 0) { setError('Agrega al menos un concepto antes de guardar la plantilla.'); return; }
    const nombre = prompt('Nombre de la plantilla (ej. "Boutique 1 sucursal con hardware")', form.empresa || 'Mi plantilla');
    if (!nombre) return;
    setSavingTemplate(true);
    try {
      const { text } = parseMeta(form.notas || '');
      const meta: Record<string, any> = { iva_mode: ivaMode };
      if (form.giro) meta.giro = form.giro;
      if (Array.isArray(form.paquetes) && form.paquetes.length >= 2) meta.paquetes = form.paquetes;
      const res = await fetch('/api/revenue/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: nombre, contacto: '', email: 'plantilla@sacscloud.com', whatsapp: '—',
          items, iva_incluido: ivaMode !== 'sin',
          descuento_global: form.descuento_global, descuento_tipo: form.descuento_tipo,
          moneda: form.moneda, template: form.template || 'modern',
          condiciones: form.condiciones, estado: 'plantilla',
          subtotal: totals.itemsSubtotal, iva_monto: Math.round(totals.ivaMonto), total: Math.round(totals.grandTotal),
          notas: serializeMeta(text || '', meta),
        }),
      });
      if (res.ok) { onSaved(); }
      else { const err = await res.json().catch(() => ({})); setError(err.error || 'No se pudo guardar la plantilla'); }
    } finally {
      setSavingTemplate(false);
    }
  };

  const addKeyPoint = () => {
    const kp = [...(form.key_points || []), { title: '', detail: '' }];
    setForm({ ...form, key_points: kp });
  };
  const updateKeyPoint = (idx: number, patch: any) => {
    const kp = (form.key_points || []).map((p: any, i: number) => i === idx ? { ...p, ...patch } : p);
    setForm({ ...form, key_points: kp });
  };
  const removeKeyPoint = (idx: number) => {
    setForm({ ...form, key_points: (form.key_points || []).filter((_: any, i: number) => i !== idx) });
  };

  const addAntesDespues = () => {
    const ad = [...(form.antes_despues || []), { aspecto: '', antes: '', despues: '' }];
    setForm({ ...form, antes_despues: ad });
  };
  const updateAntesDespues = (idx: number, patch: any) => {
    const ad = (form.antes_despues || []).map((p: any, i: number) => i === idx ? { ...p, ...patch } : p);
    setForm({ ...form, antes_despues: ad });
  };
  const removeAntesDespues = (idx: number) => {
    setForm({ ...form, antes_despues: (form.antes_despues || []).filter((_: any, i: number) => i !== idx) });
  };

  const ivaMode: 'sin' | 'suma' | 'incluido' = form.iva_mode || (form.iva_incluido ? 'suma' : 'sin');
  const totals = calcQuoteTotals({
    items,
    descuento_global: form.descuento_global,
    descuento_tipo: form.descuento_tipo,
    iva_mode: ivaMode,
  });

  // Desglose pagos: primer pago (no recurrentes + primer pago de recurrentes), mensual recurrente, anual
  const breakdown = useMemo(() => {
    const monthlyPlan = items.filter((i) => i.tipo === 'plan' && i.periodo === 'mensual')
      .reduce((s, i) => s + (i.subtotal || 0), 0);
    const annualPlan = items.filter((i) => i.tipo === 'plan' && i.periodo === 'anual')
      .reduce((s, i) => s + (i.subtotal || 0), 0);
    const recurMonthly = items.filter((i) => i.tipo === 'extra' && i.recurrente && i.periodo_extra === 'mensual')
      .reduce((s, i) => s + (i.subtotal || 0), 0);
    const recurAnnual = items.filter((i) => i.tipo === 'extra' && i.recurrente && i.periodo_extra === 'anual')
      .reduce((s, i) => s + (i.subtotal || 0), 0);
    const oneTime = items.filter((i) => i.tipo === 'extra' && !i.recurrente)
      .reduce((s, i) => s + (i.subtotal || 0), 0);
    return {
      mensualRecurrente: monthlyPlan + recurMonthly,
      anualRecurrente: annualPlan + recurAnnual,
      primerPago: monthlyPlan + recurMonthly + annualPlan + recurAnnual + oneTime,
      unicoSetup: oneTime,
    };
  }, [items]);

  const save = async (estado: Estado = 'sent') => {
    setError(null);

    if (!form.empresa?.trim() || !form.email?.trim() || !form.whatsapp?.trim()) {
      setError('Empresa, email y WhatsApp son obligatorios');
      return;
    }
    if (items.length === 0) {
      setError('Agrega al menos un plan o extra');
      return;
    }
    const descPct = Number(form.descuento_global) || 0;
    if (form.descuento_tipo === 'pct' && descPct > PARTNER_MAX_DISCOUNT_PCT) {
      setError(`Descuento máximo permitido: ${PARTNER_MAX_DISCOUNT_PCT}%`);
      return;
    }

    if (isDemoMode()) {
      alert('En modo demo no se guardan cotizaciones. Sal del modo demo para crear cotizaciones reales.');
      onClose();
      return;
    }

    setSaving(true);
    let savedOk = false;
    try {
      // Build meta JSON con todo lo customizable
      const { text } = parseMeta(form.notas || '');
      const meta: Record<string, any> = {
        iva_mode: ivaMode,
        mostrar_timer: form.mostrar_timer,
        mostrar_features: form.mostrar_features,
        mostrar_desglose: form.mostrar_desglose,
        mostrar_condiciones: form.mostrar_condiciones,
        mostrar_firma: form.mostrar_firma,
        mostrar_key_points: form.mostrar_key_points,
        mostrar_roi: !!form.mostrar_roi,
        mostrar_antes_despues: !!form.mostrar_antes_despues,
        mostrar_timeline: form.mostrar_timeline,
        mostrar_implementacion: form.mostrar_implementacion,
        mostrar_porque_sacs: form.mostrar_porque_sacs,
        mostrar_qr: form.mostrar_qr,
        mostrar_animaciones: form.mostrar_animaciones,
        timeline_tipo: form.timeline_tipo || '1suc',
      };
      if (form.logo_url) meta.logo_url = form.logo_url;
      if (form.giro) meta.giro = form.giro; else delete meta.giro;
      if (form.video_url?.trim()) meta.video_url = form.video_url.trim(); else delete meta.video_url;
      if (Array.isArray(form.attachments) && form.attachments.length) meta.attachments = form.attachments; else delete meta.attachments;
      if (paquetesOn) {
        // Persistir paquetes CON su total precalculado (la página pública los muestra)
        meta.paquetes = (form.paquetes as any[]).map((p: any) => ({
          ...p, total: Math.round(totalesDePaquete(p.id).grandTotal),
        }));
      } else {
        delete meta.paquetes;
      }
      if (form.promo_label?.trim()) meta.promo_label = form.promo_label.trim();
      if (form.minuta_raw?.trim()) meta.minuta_raw = form.minuta_raw.trim();
      if (form.implementacion_nota?.trim()) meta.implementacion_nota = form.implementacion_nota.trim();
      const validKP = (form.key_points || []).filter((k: any) => k.title?.trim() || k.detail?.trim());
      if (validKP.length) meta.key_points = validKP;
      if (form.roi && (form.roi.ahorro_mensual > 0 || form.roi.problema || form.roi.detalle)) {
        meta.roi = form.roi;
      }
      const validAD = (form.antes_despues || []).filter((a: any) => a.aspecto?.trim() || a.antes?.trim() || a.despues?.trim());
      if (validAD.length) meta.antes_despues = validAD;

      const notasFinal = serializeMeta(text || '', meta);

      // Body: solo campos de DB + notas con meta serializada
      const body: any = {
        id: form.id,
        empresa: form.empresa,
        contacto: form.contacto,
        email: form.email,
        whatsapp: form.whatsapp,
        items,
        iva_incluido: ivaMode !== 'sin',
        descuento_global: form.descuento_global,
        descuento_tipo: form.descuento_tipo,
        moneda: form.moneda,
        template: form.template || 'modern',
        condiciones: form.condiciones,
        vigencia: form.vigencia,
        urgencia: form.urgencia,
        estado,
        // Con paquetes activos, el total del documento = el de la PRIMERA opción
        // (la recomendada); al aceptar, el server fija los del paquete elegido.
        subtotal: paquetesOn ? totalesDePaquete((form.paquetes as any[])[0].id).itemsSubtotal : totals.itemsSubtotal,
        iva_monto: Math.round(paquetesOn ? totalesDePaquete((form.paquetes as any[])[0].id).ivaMonto : totals.ivaMonto),
        total: Math.round(paquetesOn ? totalesDePaquete((form.paquetes as any[])[0].id).grandTotal : totals.grandTotal),
        notas: notasFinal,
      };

      const res = await fetch('/api/revenue/quotes', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Error ${res.status}`);
        return;
      }
      savedOk = true;
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      // En éxito el componente se desmonta vía onSaved → setSaving es benigno.
      // En error nos quedamos en el drawer y el botón debe volver a estar habilitado.
      setSaving(false);
    }
    if (savedOk) onSaved();
  };

  return (
    <>
      {/* Editor FULLSCREEN con topbar + split form/preview — MISMO layout que el editor admin (RevenueHub) */}
      <div className="cq-drawer" style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar: título + guardar siempre a la vista (como el admin) */}
        <div className="cq-topbar" style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 10 }}>
          <h2 style={{ ...SS.h3, margin: 0, fontSize: 15 }}>
            {isEdit ? `Editar ${form.numero || 'cotización'}` : 'Nueva cotización'}
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => save('sent')} disabled={saving} style={{ ...SS.btn, fontSize: 12, padding: '7px 16px' }}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear y enviar'}
            </button>
            <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 26, padding: '0 4px', lineHeight: 1 }} aria-label="Cerrar">
              ×
            </button>
          </div>
        </div>
        <div className="cq-split">
        <div className="cq-form-col">

        {error && (
          <div style={{ background: '#fde8e8', color: C.red, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ───── 1. Cliente ───── */}
        <Section title="Cliente" defaultOpen>
          <Field label="Empresa *">
            <input value={form.empresa || ''} onChange={(e) => setForm({ ...form, empresa: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Contacto">
            <input value={form.contacto || ''} onChange={(e) => setForm({ ...form, contacto: e.target.value })} style={inputStyle} />
          </Field>
          <div className="cq-row-2">
            <Field label="Email *">
              <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="WhatsApp *">
              <input value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} style={inputStyle} placeholder="+52 442 555 0101" />
            </Field>
          </div>
          <Field label="Logo del cliente (opcional)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {form.logo_url && (
                <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', background: '#fafafa' }}>
                  <img src={form.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <button onClick={() => setForm({ ...form, logo_url: '' })} style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', lineHeight: '16px' }}>×</button>
                </div>
              )}
              <label style={{ ...SS.btnGhost, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {uploadingLogo ? 'Subiendo…' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
          </Field>
        </Section>

        {/* ───── 2. Minuta (key points) ───── */}
        <Section title="Minuta de la llamada">
          <Field label="Transcripción / notas crudas (opcional)">
            <textarea
              value={form.minuta_raw || ''}
              onChange={(e) => setForm({ ...form, minuta_raw: e.target.value })}
              rows={4}
              placeholder="Pega aquí tus notas o la transcripción de la llamada con el cliente. No es visible al cliente — es solo tu referencia."
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </Field>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={formatMinuta} disabled={formattingMinuta || drafting} style={{ ...SS.btnGhost, fontSize: 12, opacity: formattingMinuta ? 0.6 : 1 }}>
              {formattingMinuta ? 'Estructurando…' : '✨ Estructurar con IA'}
            </button>
            <button
              onClick={draftWithAI}
              disabled={drafting || formattingMinuta}
              title="Analiza tus notas y arma la cotización completa: plan, extras, minuta y ROI"
              style={{ ...SS.btnGhost, fontSize: 12, borderColor: C.brand, color: C.brand, fontWeight: 600, opacity: drafting ? 0.6 : 1 }}
            >
              {drafting ? 'Generando borrador…' : '🤖 Generar cotización completa con IA'}
            </button>
          </div>
          {minutaError && <div style={{ color: C.red, fontSize: 12, marginTop: -4, marginBottom: 10 }}>{minutaError}</div>}
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Puntos clave (visibles al cliente)
          </div>
          {(form.key_points || []).map((kp: any, idx: number) => (
            <div key={idx} style={{ background: C.borderSoft, padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={kp.title || ''}
                  onChange={(e) => updateKeyPoint(idx, { title: e.target.value })}
                  placeholder="Título"
                  style={{ ...inputStyle, fontWeight: 600 }}
                />
                <button onClick={() => removeKeyPoint(idx)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, padding: '0 6px' }}>×</button>
              </div>
              <textarea
                value={kp.detail || ''}
                onChange={(e) => updateKeyPoint(idx, { detail: e.target.value })}
                placeholder="Detalle"
                rows={2}
                style={{ ...inputStyle, fontFamily: 'inherit', fontSize: 12, resize: 'vertical' }}
              />
            </div>
          ))}
          <button onClick={addKeyPoint} style={{ ...SS.btnGhost, fontSize: 12 }}>+ Agregar punto clave</button>
        </Section>

        {/* ───── 3. Conceptos ───── */}
        <Section title={`Conceptos (${items.length})`} defaultOpen>
          {items.map((it, idx) => (
            <div key={idx} style={{
              border: it.es_promocion ? `1.5px solid ${C.green}` : `1px solid ${C.border}`,
              borderRadius: 10, padding: 12, marginBottom: 10,
              background: it.es_promocion ? '#ecfdf5' : C.borderSoft,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {it.es_promocion && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: C.green, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Promoción</span>
                  )}
                  <strong style={{ fontSize: 13 }}>
                    {it.tipo === 'plan' ? planDisplayName(it) : it.nombre || 'Extra'}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {paquetesOn && (
                    <select
                      value={it.paquete || ''}
                      onChange={(e) => updateItem(idx, { paquete: e.target.value || undefined })}
                      title="¿En qué opción aparece este concepto?"
                      style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 11 }}
                    >
                      <option value="">En todas las opciones</option>
                      {(form.paquetes as any[]).map((p: any) => (
                        <option key={p.id} value={p.id}>Solo {p.nombre}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}>Quitar</button>
                </div>
              </div>
              {it.tipo === 'plan' ? (
                <>
                  <div className="cq-row-3">
                    <Field label="Plan" small>
                      <select value={it.nombre} onChange={(e) => {
                        const n = e.target.value;
                        const patch: any = { nombre: n, precio_unitario: PLAN_PRICES[n] };
                        if (isAutoPlanDesc(it.descripcion)) patch.descripcion = autoPlanDesc(n, it.sucursales || 1);
                        updateItem(idx, patch);
                      }} style={inputStyle}>
                        {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS_ES[p]} (${PLAN_PRICES[p]}/mes · ${(PLAN_PRICES[p] * 10).toLocaleString('es-MX')}/año)</option>)}
                      </select>
                    </Field>
                    <Field label="Sucursales" small>
                      <input type="number" min={1} value={it.sucursales || 1} onChange={(e) => {
                        const suc = Math.max(1, Number(e.target.value) || 1);
                        const patch: any = { sucursales: suc };
                        if (isAutoPlanDesc(it.descripcion)) patch.descripcion = autoPlanDesc(it.nombre, suc);
                        updateItem(idx, patch);
                      }} style={inputStyle} />
                    </Field>
                    <Field label="Periodo" small>
                      <select value={it.periodo || 'mensual'} onChange={(e) => updateItem(idx, { periodo: e.target.value })} style={inputStyle}>
                        <option value="mensual">Mensual</option>
                        <option value="anual">Anual (2 meses gratis)</option>
                      </select>
                    </Field>
                  </div>
                  {it.periodo === 'anual' && (
                    <div style={{ fontSize: 11, color: C.greenDark, marginTop: 6 }}>
                      Anual: {fmt(PLAN_PRICES[it.nombre] * (it.sucursales || 1))}/mes × 10 meses = {fmt(PLAN_PRICES[it.nombre] * (it.sucursales || 1) * 10)}/año · el cliente ahorra {fmt(PLAN_PRICES[it.nombre] * (it.sucursales || 1) * 2)} (2 meses gratis)
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <Field label="Nombre en la cotización (opcional)" small>
                      <input value={it.titulo || ''} onChange={(e) => updateItem(idx, { titulo: e.target.value || undefined })} style={inputStyle} placeholder={`Ej. Plan ${PLAN_LABELS_ES[it.nombre] || it.nombre} — Punto de venta + Facturación`} />
                    </Field>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Field label="Qué incluye / beneficios (visible al cliente)" small>
                      <input value={it.descripcion || ''} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} style={inputStyle} placeholder="Ej. POS ilimitado, inventarios, facturación y soporte" />
                    </Field>
                  </div>
                  <div className="cq-row-2" style={{ marginTop: 6 }}>
                    <Field label={`Desc. (máx ${PARTNER_MAX_DISCOUNT_PCT}%)`} small>
                      <input type="number" min={0} max={PARTNER_MAX_DISCOUNT_PCT} value={it.descuento_pct || 0} onChange={(e) => {
                        const d = Math.min(PARTNER_MAX_DISCOUNT_PCT, Math.max(0, Number(e.target.value) || 0));
                        updateItem(idx, { descuento_pct: d });
                      }} style={inputStyle} />
                    </Field>
                    <Field label="Nota (opcional)" small>
                      <input value={it.nota || ''} onChange={(e) => updateItem(idx, { nota: e.target.value })} style={inputStyle} placeholder="Ej. precio especial" />
                    </Field>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    Categoría de comisión: <strong>Licencia · {COMISION_RATES.licencia}%</strong> (los planes siempre son licencia)
                  </div>
                </>
              ) : it.es_promocion ? (
                <>
                  <div className="cq-row-2">
                    <Field label="Concepto" small>
                      <input value={it.nombre || ''} onChange={(e) => updateItem(idx, { nombre: e.target.value })} style={inputStyle} />
                    </Field>
                    <Field label="Valor original" small>
                      <input type="number" min={0} value={it.precio_original || 0} onChange={(e) => updateItem(idx, { precio_original: Number(e.target.value) || 0 })} style={inputStyle} />
                    </Field>
                  </div>
                  <Field label="Descripción" small>
                    <input value={it.descripcion || ''} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} style={inputStyle} placeholder="Qué incluye la promoción" />
                  </Field>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                    Las promociones se muestran al cliente con el valor original tachado y $0 como precio.
                  </div>
                </>
              ) : (
                <>
                  <div className="cq-row-2">
                    <Field label="Concepto" small>
                      <input value={it.nombre || ''} onChange={(e) => updateItem(idx, { nombre: e.target.value })} style={inputStyle} placeholder="Ej. Terminal punto de venta, Consultoría, Migración…" />
                    </Field>
                    <Field label="Monto" small>
                      <input type="number" min={0} value={it.precio_unitario || 0} onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        updateItem(idx, { precio_unitario: v, monto: v });
                      }} style={inputStyle} />
                    </Field>
                  </div>
                  <Field label="Descripción" small>
                    <input value={it.descripcion || ''} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} style={inputStyle} />
                  </Field>
                  <div className="cq-row-2" style={{ marginTop: 6 }}>
                    <Field label="Tipo" small>
                      <select value={it.recurrente ? 'recurrente' : 'unico'} onChange={(e) => {
                        const recur = e.target.value === 'recurrente';
                        updateItem(idx, { recurrente: recur, periodo_extra: recur ? 'mensual' : 'unico' });
                      }} style={inputStyle}>
                        <option value="unico">Único</option>
                        <option value="recurrente">Recurrente</option>
                      </select>
                    </Field>
                    {it.recurrente && (
                      <Field label="Frecuencia" small>
                        <select value={it.periodo_extra || 'mensual'} onChange={(e) => updateItem(idx, { periodo_extra: e.target.value })} style={inputStyle}>
                          <option value="mensual">Mensual</option>
                          <option value="anual">Anual</option>
                        </select>
                      </Field>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Field label="Categoría (define tu comisión)" small>
                      <select value={categoriaDeItem(it)} onChange={(e) => updateItem(idx, { categoria_comision: e.target.value })} style={inputStyle}>
                        {COMISION_CATEGORIAS.map((c) => (
                          <option key={c} value={c}>{COMISION_LABELS[c]} · {COMISION_RATES[c]}% de comisión</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </>
              )}
              <div style={{ marginTop: 8, fontSize: 13, textAlign: 'right' }}>
                <span style={{ color: C.muted, marginRight: 8 }}>Subtotal:</span>
                <strong style={{ color: it.es_promocion ? C.green : C.text }}>
                  {it.es_promocion ? 'GRATIS' : fmt(it.subtotal)}
                  {it.tipo === 'plan' ? (it.periodo === 'anual' ? '/año' : '/mes') : ''}
                </strong>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={addPlan} style={{ ...SS.btnGhost, fontSize: 12 }}>+ Plan</button>
            <button onClick={addExtraCustom} style={{ ...SS.btnGhost, fontSize: 12 }}>+ Extra</button>
            <button onClick={addPromoImpl} style={{ ...SS.btnGhost, fontSize: 12, borderColor: C.green, color: C.greenDark }}>+ Promo impl.</button>
            <button onClick={addPromoCustom} style={{ ...SS.btnGhost, fontSize: 12, borderColor: C.green, color: C.greenDark }}>+ Promo custom</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
            Catálogo SACS:
            {PARTNER_EXTRAS_CATALOG.map((e) => (
              <button key={e.nombre} onClick={() => addExtraFromCatalog(e.nombre)} style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 8px', marginLeft: 6, marginTop: 4 }}>+ {e.nombre}</button>
            ))}
          </div>
          {conceptosPrevios.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
              Mis conceptos (usados antes):
              {conceptosPrevios.map((c) => (
                <button key={c.nombre} onClick={() => addConceptoPrevio(c)} title={`${c.descripcion || c.nombre} · ${fmt(c.precio)}`} style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 8px', marginLeft: 6, marginTop: 4, borderColor: C.brand, color: C.brand }}>
                  + {c.nombre} {c.precio > 0 ? `(${fmt(c.precio)})` : ''}
                </button>
              ))}
            </div>
          )}

          {/* ─── Paquetes A/B: el cliente elige su opción y acepta ─── */}
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={paquetesOn} onChange={togglePaquetes} />
              Ofrecer 2–3 opciones al cliente (paquetes)
            </label>
            {paquetesOn && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
                  El cliente ya no decide <em>si</em> compra sino <em>cuál</em> opción. Asigna cada concepto a una opción (o déjalo "en todas") con el selector de cada tarjeta.
                </div>
                {(form.paquetes as any[]).map((p: any, pi: number) => {
                  const pt = totalesDePaquete(p.id);
                  const nItems = itemsDePaquete(p.id).length;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <input
                        value={p.nombre}
                        onChange={(e) => {
                          const arr = (form.paquetes as any[]).map((x: any, i: number) => i === pi ? { ...x, nombre: e.target.value } : x);
                          setForm({ ...form, paquetes: arr });
                        }}
                        style={{ ...inputStyle, maxWidth: 220 }}
                      />
                      <span style={{ fontSize: 12, color: C.muted }}>{nItems} concepto{nItems !== 1 ? 's' : ''} · <strong style={{ color: C.text }}>{fmt(pt.grandTotal)}</strong></span>
                      {(form.paquetes as any[]).length > 2 && (
                        <button
                          onClick={() => {
                            const arr = (form.paquetes as any[]).filter((_: any, i: number) => i !== pi);
                            setForm({ ...form, paquetes: arr, items: items.map((it: any) => it.paquete === p.id ? { ...it, paquete: undefined } : it) });
                          }}
                          style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}
                        >×</button>
                      )}
                    </div>
                  );
                })}
                {(form.paquetes as any[]).length < 3 && (
                  <button
                    onClick={() => {
                      const usados = (form.paquetes as any[]).map((p: any) => p.id);
                      const nextId = ['a', 'b', 'c'].find((x) => !usados.includes(x)) || 'c';
                      setForm({ ...form, paquetes: [...(form.paquetes as any[]), { id: nextId, nombre: 'Opción Premium' }] });
                    }}
                    style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 10px' }}
                  >
                    + Agregar tercera opción
                  </button>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ───── 4. ROI ───── */}
        <Section title="ROI (retorno de inversión)">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.mostrar_roi} onChange={(e) => setForm({ ...form, mostrar_roi: e.target.checked })} />
            Mostrar sección de ROI al cliente
          </label>
          {form.mostrar_roi && (
            <>
              <Field label="Problema actual del cliente">
                <input
                  value={form.roi?.problema || ''}
                  onChange={(e) => setForm({ ...form, roi: { ...(form.roi || {}), problema: e.target.value } })}
                  style={inputStyle}
                  placeholder="Ej. Pierde 8 horas/semana cuadrando inventario"
                />
              </Field>
              <Field label="Ahorro mensual estimado (MXN)">
                <input
                  type="number" min={0}
                  value={form.roi?.ahorro_mensual || 0}
                  onChange={(e) => setForm({ ...form, roi: { ...(form.roi || {}), ahorro_mensual: Number(e.target.value) || 0, ahorro_anual: (Number(e.target.value) || 0) * 12 } })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Detalle">
                <textarea
                  value={form.roi?.detalle || ''}
                  onChange={(e) => setForm({ ...form, roi: { ...(form.roi || {}), detalle: e.target.value } })}
                  rows={2}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Field>
            </>
          )}
        </Section>

        {/* ───── 5. Antes vs Después ───── */}
        <Section title="Antes vs Después">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.mostrar_antes_despues} onChange={(e) => setForm({ ...form, mostrar_antes_despues: e.target.checked })} />
            Mostrar comparación al cliente
          </label>
          {form.mostrar_antes_despues && (
            <>
              {(form.antes_despues || []).map((ad: any, idx: number) => (
                <div key={idx} style={{ background: C.borderSoft, padding: 10, borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={ad.aspecto || ''} onChange={(e) => updateAntesDespues(idx, { aspecto: e.target.value })} placeholder="Aspecto (ej. Inventario)" style={inputStyle} />
                    <button onClick={() => removeAntesDespues(idx)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, padding: '0 6px' }}>×</button>
                  </div>
                  <div className="cq-row-2">
                    <Field label="Antes" small>
                      <input value={ad.antes || ''} onChange={(e) => updateAntesDespues(idx, { antes: e.target.value })} style={inputStyle} placeholder="Situación actual" />
                    </Field>
                    <Field label="Después" small>
                      <input value={ad.despues || ''} onChange={(e) => updateAntesDespues(idx, { despues: e.target.value })} style={inputStyle} placeholder="Con SACS" />
                    </Field>
                  </div>
                </div>
              ))}
              <button onClick={addAntesDespues} style={{ ...SS.btnGhost, fontSize: 12 }}>+ Agregar comparación</button>
            </>
          )}
        </Section>

        {/* ───── 6. Configuración ───── */}
        <Section title="Configuración" defaultOpen>
          <div className="cq-row-2">
            <Field label={`Descuento global (% max ${PARTNER_MAX_DISCOUNT_PCT})`}>
              <input type="number" min={0} max={PARTNER_MAX_DISCOUNT_PCT} value={form.descuento_global || 0} onChange={(e) => {
                const d = Math.min(PARTNER_MAX_DISCOUNT_PCT, Math.max(0, Number(e.target.value) || 0));
                setForm({ ...form, descuento_global: d, descuento_tipo: 'pct' });
              }} style={inputStyle} />
            </Field>
            <Field label="IVA">
              <select value={ivaMode} onChange={(e) => setForm({ ...form, iva_mode: e.target.value, iva_incluido: e.target.value !== 'sin' })} style={inputStyle}>
                <option value="suma">Suma 16% al total</option>
                <option value="incluido">IVA incluido en el precio</option>
                <option value="sin">Sin IVA</option>
              </select>
            </Field>
          </div>
          <div className="cq-row-2">
            <Field label="Moneda">
              <select value={form.moneda || 'MXN'} onChange={(e) => setForm({ ...form, moneda: e.target.value })} style={inputStyle}>
                <option value="MXN">MXN — Pesos</option>
                <option value="USD">USD — Dólares</option>
              </select>
            </Field>
            <Field label="Plantilla de diseño">
              <select value={form.template || 'modern'} onChange={(e) => setForm({ ...form, template: e.target.value })} style={inputStyle}>
                <option value="modern">Moderna</option>
                <option value="dark">Oscura</option>
                <option value="classic">Clásica</option>
              </select>
            </Field>
          </div>
          <Field label="Vigencia">
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setVigenciaPreset(15)} style={{ ...SS.btnGhost, fontSize: 11, padding: '6px 10px' }}>Normal (15 días)</button>
              <button onClick={() => setVigenciaPreset(5)} style={{ ...SS.btnGhost, fontSize: 11, padding: '6px 10px', borderColor: C.amber, color: C.amber }}>Urgente (5 días)</button>
              <button onClick={() => setVigenciaPreset(3)} style={{ ...SS.btnGhost, fontSize: 11, padding: '6px 10px', borderColor: C.red, color: C.red }}>Oferta (3 días)</button>
            </div>
            <input type="date" value={form.vigencia || ''} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Etiqueta de promoción (opcional)">
            <input value={form.promo_label || ''} onChange={(e) => setForm({ ...form, promo_label: e.target.value })} placeholder="Ej. OFERTA MAYO -20%" maxLength={40} style={inputStyle} />
          </Field>
          <div className="cq-row-2">
            <Field label="Giro del cliente (muestra un caso de éxito del giro)">
              <select value={form.giro || ''} onChange={(e) => setForm({ ...form, giro: e.target.value })} style={inputStyle}>
                <option value="">— Sin caso de éxito —</option>
                {CASOS_GIRO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Video personal (YouTube/Loom/Vimeo, opcional)">
              <input
                value={form.video_url || ''}
                onChange={(e) => setForm({ ...form, video_url: e.target.value.trim() })}
                placeholder="Ej. https://www.loom.com/share/…"
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Documentos adjuntos (specs de hardware, brochure — máx 3, PDF/imagen 5MB)">
            <div>
              {(form.attachments || []).map((a: any, ai: number) => (
                <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {a.name || 'documento'}</span>
                  <button onClick={() => setForm({ ...form, attachments: (form.attachments || []).filter((_: any, i: number) => i !== ai) })} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              ))}
              {(form.attachments || []).length < 3 && (
                <label style={{ ...SS.btnGhost, fontSize: 12, display: 'inline-block', cursor: 'pointer', opacity: uploadingAttachment ? 0.6 : 1 }}>
                  {uploadingAttachment ? 'Subiendo…' : '+ Adjuntar documento'}
                  <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files && e.target.files[0];
                    e.target.value = '';
                    if (!file) return;
                    if (isDemoMode()) { alert('En modo demo no se suben archivos.'); return; }
                    setUploadingAttachment(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/revenue/upload-attachment', { method: 'POST', body: fd });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.url) {
                        setForm({ ...form, attachments: [...(form.attachments || []), { name: file.name, url: data.url }] });
                      } else {
                        setError(data.error || 'No se pudo subir el archivo');
                      }
                    } finally {
                      setUploadingAttachment(false);
                    }
                  }} />
                </label>
              )}
            </div>
          </Field>
          <Field label="Condiciones / notas">
            <textarea
              value={form.condiciones || ''}
              onChange={(e) => setForm({ ...form, condiciones: e.target.value })}
              rows={3}
              placeholder="Términos especiales, qué incluye, qué no, plazos, etc."
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
            />
            {/* Plantillas de términos y condiciones: un clic las inserta */}
            <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
              Plantillas:
              {tcLocal.map((t) => (
                <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, marginTop: 4 }}>
                  <button onClick={() => insertTc(t.texto)} title={t.texto} style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 8px', borderColor: C.brand, color: C.brand, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
                    + {t.nombre}
                  </button>
                  <button
                    onClick={() => deleteTc(t.id)}
                    title="Eliminar esta plantilla"
                    style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 6px', borderColor: C.brand, color: C.muted, borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {TC_SUGERIDAS.map((t) => (
                <button key={t.nombre} onClick={() => insertTc(t.texto)} title={t.texto} style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 8px', marginLeft: 6, marginTop: 4 }}>
                  + {t.nombre}
                </button>
              ))}
            </div>
            {(form.condiciones || '').trim().length > 10 && (
              <button onClick={saveTcTemplate} disabled={savingTc} style={{ ...SS.btnGhost, fontSize: 11, padding: '4px 10px', marginTop: 8, opacity: savingTc ? 0.6 : 1 }}>
                {savingTc ? 'Guardando…' : '💾 Guardar estas condiciones como plantilla'}
              </button>
            )}
          </Field>
        </Section>

        {/* ───── 7. Visibilidad ───── */}
        <Section title="Qué ve el cliente">
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <Toggle label="Contador de vigencia (urgencia)" checked={!!form.mostrar_timer} onChange={(v) => setForm({ ...form, mostrar_timer: v })} />
            <Toggle label="Detalle del plan (qué incluye)" checked={!!form.mostrar_features} onChange={(v) => setForm({ ...form, mostrar_features: v })} />
            <Toggle label="Desglose de pagos" checked={!!form.mostrar_desglose} onChange={(v) => setForm({ ...form, mostrar_desglose: v })} />
            <Toggle label="Puntos clave (minuta)" checked={!!form.mostrar_key_points} onChange={(v) => setForm({ ...form, mostrar_key_points: v })} />
            <Toggle label="Condiciones / notas" checked={!!form.mostrar_condiciones} onChange={(v) => setForm({ ...form, mostrar_condiciones: v })} />
            <Toggle label="Timeline de implementación" checked={!!form.mostrar_timeline} onChange={(v) => setForm({ ...form, mostrar_timeline: v })} />
            <Toggle label="Proceso de implementación (pasos operativos)" checked={!!form.mostrar_implementacion} onChange={(v) => setForm({ ...form, mostrar_implementacion: v })} />
            <Toggle label="¿Por qué SACS? (historia, casos de éxito)" checked={!!form.mostrar_porque_sacs} onChange={(v) => setForm({ ...form, mostrar_porque_sacs: v })} />
            <Toggle label="Firma del cliente" checked={!!form.mostrar_firma} onChange={(v) => setForm({ ...form, mostrar_firma: v })} />
            <Toggle label="Código QR" checked={!!form.mostrar_qr} onChange={(v) => setForm({ ...form, mostrar_qr: v })} />
            <Toggle label="Números animados" checked={!!form.mostrar_animaciones} onChange={(v) => setForm({ ...form, mostrar_animaciones: v })} />
          </div>
          {form.mostrar_timeline && (
            <Field label="Tipo de timeline">
              <select value={form.timeline_tipo || '1suc'} onChange={(e) => setForm({ ...form, timeline_tipo: e.target.value })} style={inputStyle}>
                <option value="1suc">1 sucursal — Arrancando su primera tienda</option>
                <option value="2a5suc">2–5 sucursales — Creciendo y necesita orden</option>
                <option value="5massuc">5+ sucursales — Operación compleja, automatización</option>
              </select>
            </Field>
          )}
          {form.mostrar_implementacion && (
            <Field label="Nota en proceso de implementación (opcional)">
              <textarea
                value={form.implementacion_nota || ''}
                onChange={(e) => setForm({ ...form, implementacion_nota: e.target.value })}
                rows={2}
                placeholder="Ej. Tu migración incluye integración con SAP"
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          )}
        </Section>

        {/* ───── 8. Totales + Desglose ───── */}
        <div style={{ background: C.brandSoft, padding: 16, borderRadius: 12, marginTop: 18 }}>
          <Row label="Subtotal" value={fmt(totals.itemsSubtotal)} muted />
          {totals.globalDisc > 0 && <Row label="Descuento" value={`-${fmt(totals.globalDisc)}`} muted />}
          {ivaMode === 'suma' && <Row label="IVA (16%)" value={fmt(totals.ivaMonto)} muted />}
          {ivaMode === 'incluido' && <Row label="IVA incluido (16%)" value={fmt(totals.ivaMonto)} muted />}
          <div style={{ borderTop: `1px solid ${C.brandTint}`, marginTop: 8, paddingTop: 8 }}>
            {paquetesOn ? (
              <>
                {(form.paquetes as any[]).map((p: any) => (
                  <Row key={p.id} label={`Total ${p.nombre}`} value={`${fmt(totalesDePaquete(p.id).grandTotal)} ${form.moneda || 'MXN'}`} bold />
                ))}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>El cliente elige su opción al abrir la cotización.</div>
              </>
            ) : (
              <Row label={ivaMode === 'incluido' ? 'Total (IVA incluido)' : 'Total'} value={`${fmt(totals.grandTotal)} ${form.moneda || 'MXN'}`} bold />
            )}
          </div>
          {(() => {
            // Comisión por CATEGORÍA de concepto (licencia 35 / plugin 25 / personalización 20 / hardware 5)
            const comItems = paquetesOn ? itemsDePaquete((form.paquetes as any[])[0].id) : items;
            const com = calcComision(comItems, { descuento_global: form.descuento_global, descuento_tipo: form.descuento_tipo });
            if (com.total <= 0) return null;
            return (
              <div style={{ background: '#E9F7F1', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                <Row label="Tu comisión estimada" value={`≈ ${fmt(com.total)}`} bold />
                {COMISION_CATEGORIAS.filter((c) => com.porCategoria[c].base > 0).map((c) => (
                  <Row key={c} label={`${COMISION_LABELS[c]} · ${COMISION_RATES[c]}% de ${fmt(com.porCategoria[c].base)}`} value={fmt(com.porCategoria[c].comision)} muted />
                ))}
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  Se confirma cuando la cotización se marca como pagada. Cada punto de descuento también descuenta tu comisión; el IVA no comisiona.{paquetesOn ? ' Calculada sobre la primera opción.' : ''}
                </div>
              </div>
            );
          })()}
          {(breakdown.mensualRecurrente > 0 || breakdown.anualRecurrente > 0 || breakdown.unicoSetup > 0) && (
            <div style={{ borderTop: `1px solid ${C.brandTint}`, marginTop: 12, paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Desglose de pagos</div>
              {!paquetesOn && <Row label="Primer pago (hoy)" value={`${fmt(totals.grandTotal)} ${form.moneda || 'MXN'}`} bold />}
              {breakdown.unicoSetup > 0 && <Row label="Pago único (setup)" value={fmt(breakdown.unicoSetup)} muted />}
              {breakdown.mensualRecurrente > 0 && <Row label="Después, mensual recurrente" value={`${fmt(breakdown.mensualRecurrente)}/mes`} muted />}
              {breakdown.anualRecurrente > 0 && <Row label="Renovación anual" value={`${fmt(breakdown.anualRecurrente)}/año`} muted />}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="cq-actions" style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => save('sent')} disabled={saving} style={SS.btn}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear y enviar'}
          </button>
          <button onClick={() => save('draft')} disabled={saving} style={SS.btnGhost}>
            Guardar como borrador
          </button>
          <button onClick={saveAsTemplate} disabled={saving || savingTemplate} title="Guarda estos conceptos y configuración para arrancar la próxima cotización al 80%" style={{ ...SS.btnGhost, opacity: savingTemplate ? 0.6 : 1 }}>
            {savingTemplate ? 'Guardando…' : '⭐ Guardar como plantilla'}
          </button>
        </div>
        </div>
        {/* Columna derecha: preview en tiempo real de cómo verá el cliente la cotización */}
        <div className="cq-preview-col">
          <QuotePreviewLive form={form} ivaMode={ivaMode} />
        </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: COTIZADOR_MOBILE_CSS }} />
    </>
  );
}

// ─── Preview en tiempo real (paridad con el editor admin / RevenueHub) ─────
// Muestra la cotización como la verá el cliente, con los MONTOS REALES
// (mismos cálculos que la página pública: calcQuoteTotals + subtotales por item).

function QuotePreviewLive({ form, ivaMode }: { form: any; ivaMode: 'sin' | 'suma' | 'incluido' }) {
  const allItems: any[] = Array.isArray(form.items) ? form.items : [];
  const paquetes: any[] = Array.isArray(form.paquetes) && form.paquetes.length >= 2 ? form.paquetes : [];
  const [pSel, setPSel] = useState('');
  const activePid = paquetes.length ? (paquetes.some((p: any) => p.id === pSel) ? pSel : paquetes[0].id) : null;
  const items = activePid ? allItems.filter((it: any) => !it.paquete || it.paquete === activePid) : allItems;

  const totals = calcQuoteTotals({
    items,
    descuento_global: form.descuento_global,
    descuento_tipo: form.descuento_tipo,
    iva_mode: ivaMode,
  });

  const pPlans = items.filter((i: any) => i.tipo === 'plan');
  const pMonthlyPlans = pPlans.filter((i: any) => i.periodo !== 'anual');
  const pAnnualPlans = pPlans.filter((i: any) => i.periodo === 'anual');
  const pUnique = items.filter((i: any) => i.tipo === 'extra' && !i.recurrente && !i.es_promocion);
  const pRecurMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual');
  const pRecurAnnual = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra === 'anual');

  // Caso del giro (aparece automático en la cotización pública al elegir giro)
  const casoGiro = form.giro ? CASOS_GIRO.find((c) => c.id === form.giro) || null : null;

  // Features del plan desde el catálogo (misma lógica de herencia que la página pública)
  const features = (form.mostrar_features !== false) ? pPlans.map((pi: any) => {
    const pd = PLANS_DATA.find((p) => p.id === String(pi.nombre || '').toLowerCase());
    if (!pd) return null;
    const allF: { category: string; items: string[] }[] = [];
    let cur: typeof pd | undefined = pd;
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      for (const f of cur.features) { if (typeof f === 'object' && 'category' in f) allF.push(f); }
      cur = cur.inheritsFrom ? PLANS_DATA.find((p) => p.name === cur!.inheritsFrom) : undefined;
    }
    return { name: pd.name, titulo: pi.titulo || null, features: allF.reverse(), services: pd.services };
  }).filter(Boolean) : [];

  const sectionPad: React.CSSProperties = { padding: '14px 26px', borderTop: '1px solid #f0f0f0' };
  const line = (label: React.ReactNode, value: React.ReactNode, key?: any) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#666', padding: '2px 0' }}>
      <span>{label}</span><span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
        Vista previa en tiempo real — así lo verá el cliente
      </div>

      {paquetes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {paquetes.map((p: any) => (
            <button key={p.id} onClick={() => setPSel(p.id)} style={{
              border: `1.5px solid ${p.id === activePid ? C.brand : C.border}`,
              background: p.id === activePid ? C.brandSoft : '#fff',
              color: p.id === activePid ? C.brand : C.muted,
              borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 26px 14px', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>Sacs</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.brand, background: C.brandSoft, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cotización</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>{form.numero || 'COT-nueva'}</div>
            {form.vigencia && <div style={{ fontSize: 10, color: '#999' }}>Vigencia: {fmtDate(form.vigencia)}</div>}
          </div>
        </div>

        {/* Cliente */}
        <div style={{ padding: '12px 26px' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cotización para:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {form.logo_url && <img src={form.logo_url} alt="" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 6, border: '1px solid #f0f0f0' }} />}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{form.empresa || 'Empresa'}</div>
              {(form.contacto || form.email) && <div style={{ fontSize: 11, color: '#888' }}>{[form.contacto, form.email].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
        </div>

        {/* Minuta */}
        {(form.mostrar_key_points !== false) && (form.key_points || []).length > 0 && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>Minuta de la reunión</div>
            {(form.key_points || []).map((kp: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 7, padding: '3px 0', alignItems: 'flex-start' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>{kp.title}</span>
                  {kp.detail && <span style={{ fontSize: 10, color: '#999' }}> — {kp.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabla de conceptos */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Concepto', 'Detalle', 'Subtotal'].map((h) => (
                <th key={h} style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa', padding: '8px 12px', textAlign: h === 'Subtotal' ? 'right' : 'left', background: '#fafafa', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 22, textAlign: 'center', color: '#ccc', fontSize: 12 }}>Agrega conceptos para ver el preview</td></tr>
            )}
            {items.map((item: any, i: number) => {
              const isP = item.tipo === 'plan';
              const isPromo = item.es_promocion;
              const suc = parseInt(item.sucursales) || 1;
              const isAnn = item.periodo === 'anual';
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: isPromo ? 'rgba(42,181,160,0.04)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>
                    {isPromo && <span style={{ display: 'inline-block', fontSize: 8, fontWeight: 800, color: '#fff', background: C.green, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', marginRight: 4 }}>Promo</span>}
                    <strong style={{ color: '#1a1a1a' }}>{isP ? planDisplayName(item) : (item.nombre || '—')}</strong>
                    {isP && (
                      <div style={{ fontSize: 10, color: '#aaa' }}>
                        {fmt(item.precio_unitario || 0)}/suc × {suc} suc. × {isAnn ? '10 meses' : '1 mes'}
                        {isAnn && <span style={{ color: C.greenDark }}> · ahorra {fmt((item.precio_unitario || 0) * suc * 2)}</span>}
                      </div>
                    )}
                    {item.descripcion && <div style={{ fontSize: 10, color: '#aaa' }}>{item.descripcion}</div>}
                    {item.nota && <div style={{ fontSize: 10, color: C.brand, fontStyle: 'italic' }}>{item.nota}</div>}
                  </td>
                  <td style={{ padding: '9px 8px', fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                    {isPromo ? 'Promoción' : isP ? (isAnn ? 'Anual' : 'Mensual') : item.periodo_extra === 'anual' ? 'Anual' : item.recurrente ? 'Mensual' : 'Único'}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {isPromo ? (
                      <>
                        {(item.precio_original || 0) > 0 && <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 500, marginRight: 5 }}>{fmt(item.precio_original)}</span>}
                        <span style={{ color: C.green, fontWeight: 800 }}>$0</span>
                      </>
                    ) : (
                      <>
                        {(Number(item.descuento_pct) || 0) > 0 && <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 500, marginRight: 5 }}>{fmt((item.precio_unitario || 0) * suc * (isAnn ? 10 : 1))}</span>}
                        {fmt(item.subtotal || item.monto || 0)}{isP ? (isAnn ? '/año' : '/mes') : ''}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totales REALES */}
        <div style={{ padding: '14px 26px' }}>
          {line('Subtotal', fmt(totals.itemsSubtotal))}
          {totals.globalDisc > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.greenDark, padding: '2px 0' }}>
              <span>Descuento{form.descuento_tipo === 'pct' ? ` (${form.descuento_global}%)` : ''}</span><span>-{fmt(totals.globalDisc)}</span>
            </div>
          )}
          {ivaMode !== 'sin' && line(ivaMode === 'incluido' ? 'IVA incluido (16%)' : 'IVA (16%)', fmt(totals.ivaMonto))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#1a1a1a', borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 6 }}>
            <span>Total{ivaMode === 'incluido' ? ' (IVA incl.)' : ''}</span>
            <span style={{ color: C.greenDark }}>{fmt(totals.grandTotal)} {form.moneda || 'MXN'}</span>
          </div>
        </div>

        {/* Resumen de pagos */}
        {(form.mostrar_desglose !== false) && pPlans.length > 0 && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Resumen de pagos</div>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Primer pago (hoy)</div>
              {pPlans.map((i: any, idx: number) => line(`${planDisplayName(i)} (${i.periodo === 'anual' ? 'anual' : 'mensual'})`, fmt(i.subtotal || 0), idx))}
              {[...pUnique, ...pRecurMonthly, ...pRecurAnnual].map((i: any, idx: number) => line(i.nombre, fmt(i.subtotal || i.monto || 0), `x${idx}`))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#1a1a1a', borderTop: '1px solid #e4e4e4', paddingTop: 5, marginTop: 5 }}>
                <span>Total primer pago</span><span>{fmt(totals.grandTotal)} {form.moneda || 'MXN'}</span>
              </div>
            </div>
            {(pMonthlyPlans.length > 0 || pRecurMonthly.length > 0) && (
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Pago mensual recurrente</div>
                {pMonthlyPlans.map((i: any, idx: number) => line(planDisplayName(i), `${fmt(i.subtotal || 0)}/mes`, idx))}
                {pRecurMonthly.map((i: any, idx: number) => line(i.nombre, `${fmt(i.subtotal || i.monto || 0)}/mes`, `m${idx}`))}
              </div>
            )}
            {(pAnnualPlans.length > 0 || pRecurAnnual.length > 0) && (
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Renovación anual</div>
                {pAnnualPlans.map((i: any, idx: number) => line(planDisplayName(i), `${fmt(i.subtotal || 0)}/año`, idx))}
                {pRecurAnnual.map((i: any, idx: number) => line(i.nombre, `${fmt(i.subtotal || i.monto || 0)}/año`, `a${idx}`))}
              </div>
            )}
          </div>
        )}

        {/* ROI */}
        {form.mostrar_roi && form.roi?.ahorro_mensual > 0 && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Retorno de inversión estimado</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.greenDark }}>{fmt(form.roi.ahorro_mensual)}</div>
                <div style={{ fontSize: 8, color: '#999', textTransform: 'uppercase' }}>Ahorro mensual</div>
              </div>
              <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.greenDark }}>{fmt(form.roi.ahorro_mensual * 12)}</div>
                <div style={{ fontSize: 8, color: '#999', textTransform: 'uppercase' }}>Ahorro anual</div>
              </div>
            </div>
          </div>
        )}

        {/* Antes vs Después */}
        {form.mostrar_antes_despues && (form.antes_despues || []).length > 0 && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Antes vs Después</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead><tr>
                <th style={{ padding: '3px 6px', textAlign: 'left', color: '#aaa', fontWeight: 600 }}>Aspecto</th>
                <th style={{ padding: '3px 6px', textAlign: 'center', color: '#ccc', fontWeight: 600 }}>Hoy</th>
                <th style={{ padding: '3px 6px', textAlign: 'center', color: '#2AB5A0', fontWeight: 600 }}>Con SACS</th>
              </tr></thead>
              <tbody>
                {(form.antes_despues || []).map((row: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '3px 6px', fontWeight: 700, color: '#1a1a1a' }}>{row.aspecto}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', color: '#ccc', textDecoration: 'line-through' }}>{row.antes}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 600, color: '#666' }}>{row.despues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Caso del giro — aparece AUTOMÁTICO al elegir giro (igual que la página pública) */}
        {casoGiro && (
          <div style={sectionPad}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Resultados en {casoGiro.label}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 6 }}><strong style={{ color: '#1a1a1a' }}>El reto típico:</strong> {casoGiro.dolor}</div>
                <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}><strong style={{ color: '#1a1a1a' }}>Con SACS:</strong> {casoGiro.solucion}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2AB5A0', letterSpacing: '-0.02em' }}>{casoGiro.stat}</div>
                <div style={{ fontSize: 9, color: '#999', lineHeight: 1.4 }}>{casoGiro.statLabel}</div>
              </div>
            </div>
          </div>
        )}

        {/* ¿Por qué Sacs? — sección AUTOMÁTICA de la cotización pública */}
        {(form.mostrar_porque_sacs !== false) && (
          <div style={{ ...sectionPad, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>¿Por qué Sacs?</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Más de 3,000 marcas en México y Latinoamérica ya operan con Sacs</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 10 }}>
              {[['3,000+', 'Marcas operando'], ['42M+', 'Transacciones procesadas'], ['8', 'Países en LATAM']].map(([num, lbl]) => (
                <div key={lbl} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.brand }}>{num}</div>
                  <div style={{ fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Casos de éxito / testimonios — AUTOMÁTICOS (carrusel "Marcas que crecen con Sacs") */}
        {(form.mostrar_porque_sacs !== false) && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Marcas que crecen con Sacs</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {PREVIEW_CASES.map((c) => (
                <div key={c.name} style={{ flex: '0 0 180px', border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <img src={c.img} alt={c.name} loading="lazy" width="180" height="80" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 8 }}>
                    <span style={{ display: 'inline-block', fontSize: 7, fontWeight: 800, color: c.tagColor, background: c.tagBg, padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', marginBottom: 3 }}>{c.tag}</span>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1a1a1a' }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: '#888', lineHeight: 1.4, margin: '3px 0' }}>{c.desc}</div>
                    <div style={{ fontSize: 8, color: '#666', fontWeight: 700 }}>{c.metrics.join(' · ')}</div>
                    <div style={{ fontSize: 9, color: '#999', fontStyle: 'italic', marginTop: 3, lineHeight: 1.4 }}>{c.quote}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qué incluye tu plan */}
        {features.length > 0 && (
          <div style={sectionPad}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Qué incluye tu plan</div>
            {features.map((pf: any, fi: number) => (
              <div key={fi} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.brand, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
                  {pf.titulo || `Plan ${pf.name}`}{pf.titulo ? ` — incluye todo el Plan ${pf.name}` : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px' }}>
                  {pf.features.map((cat: any, ci: number) => (
                    <div key={ci}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 1 }}>{cat.category}</div>
                      {cat.items.map((f: string, ii: number) => (
                        <div key={ii} style={{ display: 'flex', gap: 4, fontSize: 9, color: '#666', padding: '1px 0', alignItems: 'flex-start' }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" stroke="#2AB5A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Condiciones */}
        {(form.mostrar_condiciones !== false) && form.condiciones && (
          <div style={sectionPad}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Condiciones</div>
            <div style={{ fontSize: 10, color: '#999', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{form.condiciones}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 26px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb' }}>
          <span><strong style={{ color: '#1a1a1a' }}>Sacs</strong> Sistema operativo para retailers</span>
          <span>www.sacscloud.com</span>
        </div>
      </div>
    </div>
  );
}

// ─── UI helpers locales ───────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 12 : 0,
        fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ fontSize: 16, color: C.muted, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cq-toggle" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '8px 4px', borderRadius: 6, lineHeight: 1.3 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ minWidth: 18, minHeight: 18, accentColor: C.accent }} />
      <span>{label}</span>
    </label>
  );
}

// CSS responsive del editor (drawer mobile-friendly)
const COTIZADOR_MOBILE_CSS = `
  .cq-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cq-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .cq-toggle:hover { background: #f4f5f7; }

  /* Split form + preview en vivo — calcado del editor admin (.rh-quote-split) */
  .cq-split { display: flex; flex: 1; overflow: hidden; }
  .cq-form-col { width: 520px; flex-shrink: 0; background: #fff; overflow-y: auto; padding: 24px 28px 56px; border-right: 1px solid #eee; box-sizing: border-box; }
  .cq-preview-col { flex: 1; overflow-y: auto; padding: 26px 28px 48px; box-sizing: border-box; }

  @media (max-width: 1024px) {
    /* Apilado como el admin en móvil: form arriba, preview abajo, todo scrollea junto */
    .cq-split { flex-direction: column; overflow-y: auto; }
    .cq-form-col { width: 100%; border-right: none; border-bottom: 1px solid #eee; overflow: visible; flex-shrink: 0; }
    .cq-preview-col { overflow: visible; }
  }
  @media (max-width: 640px) {
    .cq-topbar { padding: 10px 12px !important; }
    .cq-form-col { padding: 20px 18px 24px !important; }
    .cq-preview-col { padding: 18px 12px calc(40px + env(safe-area-inset-bottom, 0)) !important; }
    .cq-row-2 { grid-template-columns: 1fr; gap: 0; }
    .cq-row-3 { grid-template-columns: 1fr; gap: 0; }
    .cq-toggle { padding: 10px 4px !important; min-height: 40px; }
    .cq-actions {
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
      margin-top: 32px !important;
    }
    .cq-actions > button { width: 100%; padding: 14px 20px; font-size: 14px; }
  }
`;

// ─── helpers ───────────────────────────────────────────────────────────────

function computeItemSubtotal(it: any): number {
  if (it.tipo === 'plan') {
    // Anual = 12 meses al precio de 10 (2 meses gratis) — misma regla que el editor admin
    // y que la página pública (que desglosa "× 10 meses" y calcula el ahorro con ×10).
    const meses = it.periodo === 'anual' ? 10 : 1;
    const base = (PLAN_PRICES[it.nombre] || 0) * (it.sucursales || 1) * meses;
    const disc = (Number(it.descuento_pct) || 0) / 100;
    return Math.round(base * (1 - disc));
  }
  return Number(it.precio_unitario) || Number(it.monto) || 0;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
};

function Field({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{ marginBottom: small ? 0 : 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: muted ? C.muted : C.text, marginBottom: 4 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
