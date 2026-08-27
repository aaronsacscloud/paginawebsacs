import { useState, useEffect, useRef } from 'react';
import { useToast, Toast, logStageChange, SlaBadge, ActivityChips, KanbanSkeleton } from './crmHelpers';
import { useIsMobile, useDrawerHistory } from '../../../lib/ui/mobile';
import Sheet from './ui/Sheet';
import ActionSheet from './ui/ActionSheet';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import SugerenciasOportunidad from './SugerenciasOportunidad';
import Etiquetas, { ChipsEtiquetas, FiltroEtiquetas, useCatalogoEtiquetas, useMapaEtiquetas } from './Etiquetas';

// ─── Types ───
interface Deal {
  id: string; created_at: string; updated_at: string;
  nombre: string; contact_id: string; company_id: string | null;
  plan: string | null; sucursales: number; billing_period: string | null;
  valor_mensual: number; valor_total: number;
  stage: string; stage_changed_at: string; probabilidad: number;
  motivo_perdida: string | null; competidor: string | null;
  fecha_cierre_esperada: string | null; closed_at: string | null;
  days_in_pipeline: number | null; quote_id: string | null;
  // v2/v3/v4: líneas, tipo de dinero, categoría y siguiente paso.
  items?: any[] | null; mrr?: number | null; valor_unico?: number | null; descuento_pct?: number | null;
  tipo_ingreso?: string | null; categoria?: string | null; origen?: string | null; es_sugerencia?: boolean | null;
  proximo_paso?: string | null; proximo_paso_at?: string | null; referrer_partner_id?: string | null;
  owner_id: string | null; archived_at: string | null;
  contacts: { id: string; nombre: string; email: string | null; whatsapp: string | null } | null;
  companies: { id: string; nombre: string; plan: string | null } | null;
}

interface ContactOption {
  id: string; nombre: string; email: string | null; whatsapp: string | null;
  company_id: string | null;
  companies: { id: string; nombre: string } | null;
}

interface Activity {
  id: string; created_at: string; tipo: string; titulo: string | null;
  descripcion: string | null; metadata: any; automatico: boolean;
}

// ─── Constants ───
// STAGES es mutable: por defecto trae el pipeline base y se REEMPLAZA con el
// pipeline "oportunidad" configurable al montar (Configuración → Pipelines).
let STAGES: { id: string; label: string; prob: number; color: string }[] = [
  { id: 'calificacion', label: 'Calificación', prob: 20, color: '#6C5CE7' },
  { id: 'demo_agendada', label: 'Demo agendada', prob: 40, color: '#4B7BE5' },
  { id: 'demo_realizada', label: 'Demo realizada', prob: 60, color: '#E8A838' },
  { id: 'cotizacion_enviada', label: 'Cotización enviada', prob: 70, color: '#F39C12' },
  { id: 'negociacion', label: 'Negociación', prob: 80, color: '#2AB5A0' },
  { id: 'cerrada_ganada', label: 'Cerrada ganada', prob: 100, color: '#2e7d32' },
  { id: 'cerrada_perdida', label: 'Cerrada perdida', prob: 0, color: '#999' },
];

const PLAN_PRICES: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 2800 };

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};
const stageColor = (s: string) => STAGES.find(st => st.id === s)?.color || '#ccc';
const stageLabel = (s: string) => STAGES.find(st => st.id === s)?.label || s;

// Etapas de cierre detectadas por KEY (robusto a que renombren el label). Las
// keys del pipeline oportunidad conservan 'ganad'/'perdid'. La conversión a
// cliente + comisión en el server (deals.ts) también se dispara con esas keys.
const isWonKey = (k: string) => /ganad/i.test(k);
const isLostKey = (k: string) => /perdid/i.test(k);
const isClosedKey = (k: string) => isWonKey(k) || isLostKey(k);
function probFor(key: string, arr: { key: string }[]): number {
  if (isWonKey(key)) return 100;
  if (isLostKey(key)) return 0;
  const opens = arr.filter(s => !isClosedKey(s.key));
  const pos = opens.findIndex(s => s.key === key);
  return pos >= 0 ? Math.min(95, Math.round((pos + 1) / (opens.length + 1) * 100)) : 50;
}

// ── Estancamiento (el "rotting" de Pipedrive) ──
// La mayoría de las oportunidades no se pierden: se enfrían. Se mide desde el
// último movimiento REAL (cambio de etapa o edición), y el umbral crece con la
// etapa: una recién calificada aguanta más sin noticias que una en negociación,
// donde 10 días de silencio ya son una señal.
// Umbral por etapa. Se lee de la configuración del pipeline (stages[].rot_dias,
// como el rotting configurable de Pipedrive); si esa etapa no lo define, cae a
// estos valores, que salen de lo que ya se sabía del ciclo de venta.
let ROT_POR_ETAPA: Record<string, number> = {};
const DIAS_ESTANCADA: Record<string, number> = { negociacion: 10, cotizacion_enviada: 14, demo_realizada: 14 };
const DIAS_ESTANCADA_DEFAULT = 21;
const umbralRot = (stage: string) => ROT_POR_ETAPA[stage] ?? DIAS_ESTANCADA[stage] ?? DIAS_ESTANCADA_DEFAULT;
function diasSinMover(d: any): number {
  const t = Math.max(Date.parse(d.stage_changed_at || 0) || 0, Date.parse(d.updated_at || 0) || 0, Date.parse(d.created_at || 0) || 0);
  if (!t) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
function estaEstancada(d: any): boolean {
  if (isClosedKey(d.stage)) return false;
  return diasSinMover(d) >= umbralRot(d.stage);
}

// ── Salud del trato (idea 10) ──
// Un semáforo dice dónde meter la hora que queda del día mejor que una lista
// ordenada por monto: el trato más grande puede estar muerto y el mediano a un
// llamada de cerrarse. Cuatro señales, todas accionables:
//   · lleva días sin moverse        → se está enfriando
//   · no tiene próximo paso         → nadie lo va a mover
//   · el cierre esperado ya pasó    → la fecha era humo o nadie la actualizó
//   · descuento grande pedido       → hay presión de precio sin cerrar
function saludDeal(d: any): { score: number; color: string; label: string; por: string[] } {
  if (isClosedKey(d.stage)) return { score: 100, color: '#999', label: 'cerrada', por: [] };
  let score = 100; const por: string[] = [];
  const dias = diasSinMover(d), umbral = umbralRot(d.stage);
  if (dias >= umbral) { score -= 35; por.push(`${dias} días sin moverse`); }
  else if (dias >= umbral * 0.6) { score -= 15; por.push(`${dias} días sin noticias`); }
  if (!d.proximo_paso) { score -= 25; por.push('sin próximo paso'); }
  else if (d.proximo_paso_at && d.proximo_paso_at < new Date().toISOString().slice(0, 10)) { score -= 20; por.push('el próximo paso ya venció'); }
  if (d.fecha_cierre_esperada && d.fecha_cierre_esperada < new Date().toISOString().slice(0, 10)) { score -= 20; por.push('el cierre esperado ya pasó'); }
  if (Number(d.descuento_pct || 0) >= 20) { score -= 10; por.push(`${d.descuento_pct}% de descuento pedido`); }
  score = Math.max(0, score);
  const color = score >= 70 ? '#1A8F7A' : score >= 40 ? '#E8A838' : '#b93333';
  return { score, color, label: score >= 70 ? 'sana' : score >= 40 ? 'atención' : 'en riesgo', por };
}

// Lo que se gana si se cierra. Un pipeline enseña el valor para la empresa; lo
// que mueve a quien vende es su parte. Se calcula con el mismo 20% por defecto
// que usa createCommissionForDeal, y solo se muestra cuando hay socio referido
// (que es cuando esa comisión existe de verdad).
const COMISION_PCT_DEFAULT = 20;
const comisionDe = (d: any) => d?.referrer_partner_id ? Math.round(Number(d.valor_total || 0) * COMISION_PCT_DEFAULT / 100) : 0;

// Qué dejó el cierre, dicho en el momento. Un "ganada ✓" a secas es lo que
// permitió que una venta de $44,505 quedara ganada sin cliente y sin cobro:
// nadie se entera de lo que NO pasó.
function resumenCierre(j: any): string {
  const c = j?.cierre;
  if (!c) return '🎉 Oportunidad ganada';
  const hechos: string[] = [];
  if (c.cliente_creado) hechos.push('cliente creado');
  if (c.sub_creada) hechos.push('suscripción generada');
  if (c.unico_creado) hechos.push('pago único registrado');
  const base = hechos.length ? `🎉 Ganada · ${hechos.join(' · ')}` : '🎉 Oportunidad ganada';
  return c.avisos?.length ? `${base} · ⚠ ${c.avisos[0]}` : base;
}

// ─── Activity helpers ───
function activityColor(tipo: string): string {
  const colors: Record<string, string> = {
    nota: '#4B7BE5', llamada: '#6C5CE7', whatsapp_enviado: '#25D366',
    email_enviado: '#1565c0', demo_agendada: '#E8A838', demo_realizada: '#F39C12',
    cotizacion_creada: '#2AB5A0', cotizacion_enviada: '#2AB5A0', cotizacion_vista: '#6C5CE7',
    pago_recibido: '#2e7d32', stage_change: '#E8A838', lead_created: '#4B7BE5', sistema: '#ccc',
  };
  return colors[tipo] || '#ccc';
}
function activityLabel(tipo: string): string {
  const labels: Record<string, string> = {
    nota: 'Nota', llamada: 'Llamada', whatsapp_enviado: 'WhatsApp enviado',
    email_enviado: 'Email enviado', demo_agendada: 'Demo agendada', demo_realizada: 'Demo realizada',
    cotizacion_creada: 'Cotización creada', cotizacion_enviada: 'Cotización enviada',
    cotizacion_vista: 'Cotización vista', pago_recibido: 'Pago recibido',
    stage_change: 'Cambio de etapa', lead_created: 'Lead creado', sistema: 'Sistema',
  };
  return labels[tipo] || tipo;
}

// ─── Shared styles ───
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e5e7eb', borderRadius: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const, background: '#fff', appearance: 'auto' };
const td: React.CSSProperties = { padding: '10px 14px', color: '#555' };
const dealBulkBtn: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#b93333', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' };

// ─── Main Component ───
export default function DealsTab({ onConfig, initialDealId, onDealConsumed }: { onConfig?: () => void; initialDealId?: string | null; onDealConsumed?: () => void } = {}) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Deal | null>(null);
  const consumedDealRef = useRef<string | null>(null);

  // Abrir directo el drawer de un deal (ej. desde la búsqueda global mobile).
  // Se consume UNA sola vez por id: al abrirlo se limpia arriba (onDealConsumed)
  // para que navegar fuera/volver o cambiar deals.length NO lo reabra.
  useEffect(() => {
    if (!initialDealId) { consumedDealRef.current = null; return; } // reset → permite re-buscar el mismo deal
    if (initialDealId !== consumedDealRef.current && deals.length) {
      const d = deals.find(x => x.id === initialDealId);
      consumedDealRef.current = initialDealId;
      if (d) setSelected(d);
      onDealConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDealId, deals.length]);
  const [, forceRender] = useState(0);
  const { toast, show } = useToast();

  // Reemplaza STAGES con el pipeline "oportunidad" configurable (si existe).
  useEffect(() => {
    fetch('/api/crm/pipelines').then(r => r.json()).then(j => {
      const op = (j.data || []).find((p: any) => p.tipo === 'oportunidad');
      if (op?.stages?.length) {
        STAGES = op.stages.map((s: any) => ({ id: s.key, label: s.label, color: s.color, prob: probFor(s.key, op.stages) }));
        // rot_dias por etapa: configurable donde se configuran las etapas.
        ROT_POR_ETAPA = Object.fromEntries(op.stages.filter((s: any) => Number(s.rot_dias) > 0).map((s: any) => [s.key, Number(s.rot_dias)]));
        forceRender(x => x + 1);
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/crm/deals');
    const data = await res.json();
    setDeals(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Antes de GANAR: enseñar qué va a pasar. Son dos cierres distintos y hasta
  // ahora se veían igual — si el cliente ya existe solo se le agrega lo vendido,
  // pero si viene de un lead se CREA un registro nuevo con nombre heredado del
  // trato, y eso no puede pasar en silencio.
  const confirmarCierre = async (deal: Deal): Promise<boolean> => {
    let p: any = null;
    try { p = await fetch(`/api/crm/deals/cierre-preview?deal_id=${deal.id}`).then(r => r.json()); } catch { /* si falla, se sigue */ }
    if (!p || p.error) return true;   // nunca bloquear el cierre por el preview
    // Cliente ya registrado: se agrega y ya, sin interrumpir.
    if (!p.convierte_lead) return true;
    const texto = [
      `“${p.cliente}” todavía no es cliente: al ganar esta oportunidad se va a CONVERTIR.`,
      '', 'Esto es lo que va a pasar:',
      ...(p.pasos || []).map((x: string) => '· ' + x),
      '', '¿Confirmas?',
    ].join('\n');
    return confirm(texto);
  };

  const moveStage = async (deal: Deal, newStage: string) => {
    if (deal.stage === newStage) return;
    if (isWonKey(newStage) && !(await confirmarCierre(deal))) return;
    const prob = STAGES.find(s => s.id === newStage)?.prob ?? deal.probabilidad;
    const updates: Record<string, any> = { id: deal.id, stage: newStage, probabilidad: prob };
    if (isClosedKey(newStage)) {
      updates.closed_at = new Date().toISOString();
    }
    // Perder sin decir por qué es lo que impide corregir precio, producto o
    // seguimiento. El servidor lo exige; aquí se pregunta antes para no chocar
    // contra un 400. (Los motivos sugeridos son los que sí se pueden accionar.)
    if (isLostKey(newStage)) {
      const motivo = prompt(
        `¿Por qué se perdió "${deal.nombre}"?\n\nSugeridos: precio · se fue con competidor · no era el momento · falta una función · no contestó · presupuesto`,
        '');
      if (motivo === null) return;                 // cancelar = no mover
      if (!motivo.trim()) { show('Sin motivo no se puede marcar perdida.'); return; }
      updates.motivo_perdida = motivo.trim();
    }
    // Optimista: refleja el movimiento de inmediato en el kanban.
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, stage: newStage, probabilidad: prob } : d));
    const j = await fetch('/api/crm/deals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(r => r.json()).catch(() => ({}));
    const toLabel = stageLabel(newStage);
    logStageChange({ deal_id: deal.id, contact_id: deal.contact_id, company_id: deal.company_id, fromLabel: stageLabel(deal.stage), toLabel });
    if (j?.error) { show(j.error); load(); return; }
    show(isWonKey(newStage) ? resumenCierre(j) : `Movida a ${toLabel}`);
    load();
  };

  // Acciones en lote sobre oportunidades seleccionadas en la tabla.
  const bulkUpdate = async (ids: string[], patch: Record<string, any>, msg: string) => {
    await Promise.all(ids.map(id => fetch('/api/crm/deals', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    })));
    await load();
    show(msg);
  };

  // Borrar de verdad: para la basura de antes del proceso. Distinto de
  // "perdida", que es información real (se compitió y no se ganó).
  const bulkDelete = async (ids: string[]) => {
    const r = await fetch('/api/crm/deals', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    });
    const j = await r.json().catch(() => ({}));
    await load();
    if (!r.ok || j.error) { show(j.error || 'No se pudieron eliminar.'); return; }
    // Las omitidas se dicen SIEMPRE: si se borran 8 de 10 en silencio, el
    // usuario cree que quedó limpio y nunca vuelve a mirar.
    show(`${j.borradas} eliminada(s)` + (j.omitidas?.length ? ` · ${j.omitidas.length} no se pudo: ${j.omitidas[0].motivo}` : ''));
  };

  // Stats
  const openDeals = deals.filter(d => !isClosedKey(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + d.valor_total, 0);
  const weightedValue = openDeals.reduce((s, d) => s + d.valor_total * (d.probabilidad / 100), 0);
  const won = deals.filter(d => isWonKey(d.stage));
  const lost = deals.filter(d => isLostKey(d.stage));

  // ── Lo que mueve al vendedor ──
  // Sumar en la misma bolsa una licencia de $900/mes y una implementación única
  // de $80,000 no dice nada: ni valen lo mismo ni se pronostican igual. Los tres
  // números se separan, y el foco es lo GANADO — el pipeline es promesa, lo
  // ganado es lo que ya se logró.
  const mrrDe = (d: any) => Number(d.mrr ?? d.valor_mensual ?? 0);
  const unicoDe = (d: any) => Number(d.valor_unico ?? (d.billing_period === 'unico' ? d.valor_total : 0) ?? 0);
  const suma = (ds: any[], f: (d: any) => number) => ds.reduce((s, d) => s + f(d), 0);
  const kMrrAbierto = suma(openDeals, mrrDe);
  const kUnicoAbierto = suma(openDeals, unicoDe);
  const kMrrGanado = suma(won, mrrDe);
  const kUnicoGanado = suma(won, unicoDe);
  // MRR nuevo vs expansión: si todo el crecimiento viene de upsell, el motor de
  // adquisición está apagado aunque el ARR suba. Son dos problemas distintos.
  const kMrrNuevo = suma(won.filter((d: any) => (d.categoria || 'nuevo') === 'nuevo'), mrrDe);
  const kMrrCartera = suma(openDeals.filter((d: any) => d.categoria === 'renovacion' || d.categoria === 'retencion'), mrrDe);
  const kMrrExp = kMrrGanado - kMrrNuevo;

  // Filtro por estado: primero se ven todas, pero la pregunta diaria es "¿qué
  // tengo vivo?" y la de fin de mes "¿qué gané?".
  const [filtro, setFiltro] = useState<'todas' | 'abiertas' | 'ganadas' | 'perdidas'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<'' | 'recurrente' | 'unico' | 'mixto'>('');
  const [filtroCat, setFiltroCat] = useState<'' | 'nuevo' | 'upsell' | 'renovacion' | 'retencion'>('');
  // Tablero: venta nueva vs cartera (renovación + retención). HubSpot lo
  // recomienda explícito — renovar tiene otras etapas y otros tiempos, y
  // mezclarlo ensucia las tasas de conversión de los dos.
  const [tablero, setTablero] = useState<'venta' | 'cartera'>('venta');
  const [soloEstancadas, setSoloEstancadas] = useState(false);
  const { cat: catEtiquetas } = useCatalogoEtiquetas();
  const { mapa: etiquetasDeal, recargar: recargarEtiquetas } = useMapaEtiquetas('deal');
  const [selEtiquetas, setSelEtiquetas] = useState<string[]>([]);
  const estancadas = openDeals.filter(estaEstancada);
  const dealsVista = deals.filter(d => {
    if (filtro === 'abiertas' && isClosedKey(d.stage)) return false;
    if (filtro === 'ganadas' && !isWonKey(d.stage)) return false;
    if (filtro === 'perdidas' && !isLostKey(d.stage)) return false;
    if (filtroTipo) {
      const tipo = (d as any).tipo_ingreso || (mrrDe(d) > 0 && unicoDe(d) > 0 ? 'mixto' : mrrDe(d) > 0 ? 'recurrente' : unicoDe(d) > 0 ? 'unico' : null);
      if (tipo !== filtroTipo) return false;
    }
    const cat = (d as any).categoria || 'nuevo';
    const esCartera = cat === 'renovacion' || cat === 'retencion';
    if (tablero === 'venta' ? esCartera : !esCartera) return false;
    if (filtroCat && cat !== filtroCat) return false;
    if (soloEstancadas && !estaEstancada(d)) return false;
    // Y implícita: elegir dos etiquetas deja lo que tiene LAS DOS. Con O el
    // filtro ampliaría, y filtrar es para acotar.
    if (selEtiquetas.length) {
      const ids = (etiquetasDeal[d.id] || []).map((e: any) => e.id);
      if (!selEtiquetas.every(x => ids.includes(x))) return false;
    }
    return true;
  });

  const esMovilD = useIsMobile();
  const [filtrosMov, setFiltrosMov] = useState(false);
  const nFiltrosSec = (tablero !== 'venta' ? 1 : 0) + (filtroTipo ? 1 : 0) + (soloEstancadas ? 1 : 0) + (filtroCat ? 1 : 0) + selEtiquetas.length;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* ══ Móvil: 4 stat-cards en grid 2×2 (label arriba, cifra abajo) en vez
          de la franja corrida que envolvía en 3 líneas ilegibles. ══ */}
      {esMovilD && (
        <div style={{ background: '#fff', padding: '14px 16px 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { l: 'MRR ganado', v: fmt(kMrrGanado), c: '#1E8A63' },
              { l: 'MRR en juego', v: fmt(kMrrAbierto), c: '#1a1a1a' },
              { l: 'Único en juego', v: fmt(kUnicoAbierto), c: '#1a1a1a' },
              { l: 'Estancadas', v: String(estancadas.length), c: estancadas.length ? '#C0554E' : '#1a1a1a' },
            ].map(sK => (
              <div key={sK.l} style={{ border: '1px solid #eeeef1', borderRadius: 12, padding: '10px 12px', minWidth: 0 }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8f8d98', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sK.l}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: sK.c, marginTop: 2 }}>{sK.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowCreate(true)} style={{ ...btn, flex: 1, justifyContent: 'center', minHeight: 44, background: '#5B4BD6', color: '#fff' }}>+ Nueva oportunidad</button>
            <button onClick={() => setView(view === 'kanban' ? 'table' : 'kanban')} style={{ ...btn, minHeight: 44, background: '#f5f5f5', color: '#555' }}>
              {view === 'kanban' ? 'Tabla' : 'Kanban'}
            </button>
          </div>
        </div>
      )}
      {!esMovilD && (<>
      {/* Top stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', overflowX: 'auto' }}>
          {[
            { l: `MRR ganado · ARR ${fmt(kMrrGanado * 12)}`, v: fmt(kMrrGanado), c: '#1A8F7A', t: `Recurrente mensual de las oportunidades GANADAS. ARR = ×12. De ahí, ${fmt(kMrrNuevo)} es de clientes nuevos y ${fmt(kMrrExp)} de expansión.` },
            { l: 'nuevo / expansión', v: `${fmt(kMrrNuevo)} · ${fmt(kMrrExp)}`, c: '#6C5CE7', t: 'MRR de clientes NUEVOS vs de ampliarle a quien ya te compra. Si todo viene de expansión, la adquisición está apagada aunque el ARR suba.' },
            { l: 'Único ganado', v: fmt(kUnicoGanado), c: '#a06600', t: 'Implementaciones, hardware y demás cobros de una sola vez ya ganados. No es ARR.' },
            { l: `MRR en juego · ${openDeals.length} abiertas`, v: fmt(kMrrAbierto), c: '#4B7BE5', t: 'Recurrente mensual de lo que sigue vivo en el pipeline.' },
            { l: 'Único en juego', v: fmt(kUnicoAbierto), c: '#6C5CE7', t: 'Pagos únicos de las oportunidades abiertas.' },
            { l: 'Ponderado 1er año', v: fmt(weightedValue), c: '#2AB5A0', t: 'Valor del primer año (ARR + único) por la probabilidad de cada etapa.' },
            { l: 'MRR en cartera', v: fmt(kMrrCartera), c: '#E8A838', t: 'Recurrente que se está renovando o reteniendo. No es venta nueva: conservarlo no hace crecer, pero perderlo sí encoge.' },
            { l: 'Estancadas', v: String(estancadas.length), c: estancadas.length ? '#b93333' : '#999', t: 'Abiertas sin movimiento: 10 días en negociación, 14 tras demo/cotización, 21 en el resto. No se pierden — se enfrían.' },
            { l: `Ganadas / perdidas`, v: `${won.length}/${lost.length}`, c: '#999', t: `Pipeline abierto a valor de primer año: ${fmt(totalPipeline)}` },
          ].map(s => (
            <div key={s.l} title={s.t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: s.c }}>{s.v}</span>
              <span style={{ fontSize: '0.625rem', color: '#999', fontWeight: 500 }}>{s.l}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowCreate(true)} style={{ ...btn, background: '#5B4BD6', color: '#fff' }}>+ Nueva oportunidad</button>
          <button onClick={() => setView(view === 'kanban' ? 'table' : 'kanban')} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>
            {view === 'kanban' ? '☰ Tabla' : '▦ Kanban'}
          </button>
          <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Oportunidades" style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Etapas</button>
          <button onClick={load} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>↻</button>
        </div>
      </div>

      </>)}
      {/* Lo que el sistema propone solo, en su propia bandeja: aceptar lo mete
          al pipeline, descartar lo quita. Hasta entonces no cuenta en nada. */}
      <SugerenciasOportunidad onCambio={load} />

      {/* Filtros: la lista completa sigue siendo el default (ver todo antes de
          filtrar), pero "qué tengo vivo" y "qué gané" son dos clics distintos. */}
      {esMovilD && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px 0', overflowX: 'auto', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)', maskImage: 'linear-gradient(90deg, #000 calc(100% - 28px), transparent)' }}>
          <button onClick={() => setFiltrosMov(true)} className={'m-chip' + (nFiltrosSec ? ' on' : '')} style={{ whiteSpace: 'nowrap' }}>
            Filtros{nFiltrosSec ? ` · ${nFiltrosSec}` : ''}
          </button>
          {([['todas', `Todas (${deals.length})`], ['abiertas', `Abiertas (${openDeals.length})`], ['ganadas', `Ganadas (${won.length})`], ['perdidas', `Perdidas (${lost.length})`]] as const).map(([k, l]) => (
            <button key={'m' + k} onClick={() => setFiltro(k as any)} className={'m-chip' + (filtro === k ? ' on' : '')} style={{ whiteSpace: 'nowrap' }}>{l}</button>
          ))}
        </div>
      )}
      <div style={{ display: esMovilD ? 'none' : 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 24px 0' }}>
        {([['venta', 'Venta nueva'], ['cartera', 'Cartera (renovación y retención)']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTablero(k as any); setFiltroCat(''); }}
            title={k === 'venta' ? 'Clientes nuevos y upsell' : 'Renovaciones que vienen y clientes a retener: otras etapas, otros tiempos'}
            style={{ ...btn, background: tablero === k ? '#5B4BD6' : '#f5f5f5', color: tablero === k ? '#fff' : '#555' }}>{l}</button>
        ))}
        <span style={{ width: 1, height: 20, background: '#eee' }} />
        {([['todas', `Todas (${deals.length})`], ['abiertas', `Abiertas (${openDeals.length})`], ['ganadas', `Ganadas (${won.length})`], ['perdidas', `Perdidas (${lost.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k as any)}
            style={{ ...btn, background: filtro === k ? '#5B4BD6' : '#f5f5f5', color: filtro === k ? '#fff' : '#555' }}>{l}</button>
        ))}
        <span style={{ width: 1, height: 20, background: '#eee' }} />
        {([['', 'Todo tipo'], ['recurrente', 'Recurrente'], ['unico', 'Pago único'], ['mixto', 'Mixto']] as const).map(([k, l]) => (
          <button key={k || 'all'} onClick={() => setFiltroTipo(k as any)}
            style={{ ...btn, background: filtroTipo === k ? '#5B4BD6' : '#f5f5f5', color: filtroTipo === k ? '#fff' : '#555' }}>{l}</button>
        ))}
        <button onClick={() => setSoloEstancadas(v => !v)}
          title="Abiertas sin movimiento — el 'rotting' de Pipedrive"
          style={{ ...btn, background: soloEstancadas ? '#b93333' : '#f5f5f5', color: soloEstancadas ? '#fff' : '#555' }}>
          Estancadas ({estancadas.length})
        </button>
        <span style={{ width: 1, height: 20, background: '#eee' }} />
        {/* Cliente nuevo vs ampliarle a quien ya te compra: cuestan distinto y
            solo una es crecimiento nuevo. Es el "deal type" de HubSpot. */}
        {([['', 'Todas'], ['nuevo', 'Nuevos'], ['upsell', 'Upsell'], ['renovacion', 'Renovación'], ['retencion', 'Retención']] as const).map(([k, l]) => (
          <button key={'c' + (k || 'all')} onClick={() => setFiltroCat(k as any)}
            style={{ ...btn, background: filtroCat === k ? '#5B4BD6' : '#f5f5f5', color: filtroCat === k ? '#fff' : '#555' }}>{l}</button>
        ))}
        {catEtiquetas.length > 0 && <span style={{ width: 1, height: 20, background: '#eee' }} />}
        <FiltroEtiquetas cat={catEtiquetas} sel={selEtiquetas} onChange={setSelEtiquetas} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 24px', overflow: 'auto' }}>
        {loading ? (
          <KanbanSkeleton cols={5} />
        ) : view === 'kanban' ? (
          <KanbanView deals={dealsVista} onSelect={setSelected} onMove={moveStage} />
        ) : (
          <TableView deals={dealsVista} onSelect={setSelected} onBulk={bulkUpdate} onDelete={bulkDelete} etiquetasFila={etiquetasDeal} />
        )}
      </div>

      {/* Filtros secundarios en Sheet (móvil): el muro de 20 chips en 7 filas
          empujaba el contenido fuera del viewport. */}
      {esMovilD && (
        <Sheet open={filtrosMov} onClose={() => setFiltrosMov(false)} title="Filtros" width={390}>
          <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {([
              ['Tablero', ([['venta', 'Venta nueva'], ['cartera', 'Cartera']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setTablero(k as any); setFiltroCat(''); }} className={'m-chip' + (tablero === k ? ' on' : '')}>{l}</button>
              ))],
              ['Tipo de dinero', ([['', 'Todo tipo'], ['recurrente', 'Recurrente'], ['unico', 'Pago único'], ['mixto', 'Mixto']] as const).map(([k, l]) => (
                <button key={k || 'all'} onClick={() => setFiltroTipo(k as any)} className={'m-chip' + (filtroTipo === k ? ' on' : '')}>{l}</button>
              ))],
              ['Movimiento', [<button key="est" onClick={() => setSoloEstancadas(v => !v)} className={'m-chip' + (soloEstancadas ? ' on' : '')}>Estancadas ({estancadas.length})</button>]],
              ['Categoría', ([['', 'Todas'], ['nuevo', 'Nuevos'], ['upsell', 'Upsell'], ['renovacion', 'Renovación'], ['retencion', 'Retención']] as const).map(([k, l]) => (
                <button key={'c' + (k || 'all')} onClick={() => setFiltroCat(k as any)} className={'m-chip' + (filtroCat === k ? ' on' : '')}>{l}</button>
              ))],
            ] as [string, any][]).map(([titulo, chips]) => (
              <div key={titulo}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8f8d98', marginBottom: 8 }}>{titulo}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chips}</div>
              </div>
            ))}
            {catEtiquetas.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8f8d98', marginBottom: 8 }}>Etiquetas</div>
                <FiltroEtiquetas cat={catEtiquetas} sel={selEtiquetas} onChange={setSelEtiquetas} />
              </div>
            )}
            <button onClick={() => setFiltrosMov(false)} style={{ ...btn, justifyContent: 'center', minHeight: 48, background: '#5B4BD6', color: '#fff' }}>
              Ver resultados
            </button>
          </div>
        </Sheet>
      )}

      {/* Create Modal */}
      {/* CreateDealModal (una línea, un monto) se queda para el alta rápida desde
          el contacto; el alta completa —catálogo, personalizado, descuentos y
          tipo de dinero— vive aquí. */}
      {showCreate && <NuevaOportunidadModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {/* Detail Drawer */}
      {selected && (
        <DealDrawer
          deal={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { load(); }}
          onRefresh={async (id: string) => {
            const res = await fetch('/api/crm/deals');
            const data = await res.json();
            const updated = (Array.isArray(data) ? data : []).find((d: Deal) => d.id === id);
            if (updated) setSelected(updated);
          }}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ─── Kanban View ───
function KanbanView({ deals, onSelect, onMove }: { deals: Deal[]; onSelect: (d: Deal) => void; onMove: (d: Deal, s: string) => void }) {
  const openStages = STAGES.filter(s => !isClosedKey(s.id));
  const closedStages = STAGES.filter(s => isClosedKey(s.id));
  const isMobile = useIsMobile();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const drop = (stageId: string) => { if (drag) { const d = deals.find(x => x.id === drag); if (d) onMove(d, stageId); } setDrag(null); setOver(null); };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 400, paddingBottom: 16, scrollSnapType: isMobile ? 'x mandatory' : undefined, WebkitOverflowScrolling: 'touch' }}>
        {openStages.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          const stageTotal = items.reduce((s, d) => s + d.valor_total, 0);
          return (
            <div key={stage.id} style={{ minWidth: isMobile ? '85vw' : 220, width: isMobile ? '85vw' : undefined, flex: isMobile ? '0 0 85vw' : '1 0 220px', scrollSnapAlign: isMobile ? 'start' : undefined, display: 'flex', flexDirection: 'column' }}
              onDragOver={e => { e.preventDefault(); setOver(stage.id); }}
              onDragLeave={() => setOver(o => o === stage.id ? null : o)}
              onDrop={() => drop(stage.id)}>
              <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.label}</span>
                  <span style={{ fontSize: '0.6875rem', color: '#bbb', fontWeight: 600 }}>{items.length}</span>
                </div>
                {stageTotal > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: stage.color }}>{fmt(stageTotal)}</span>}
              </div>
              <div style={{ flex: 1, background: over === stage.id ? '#eef4ff' : '#f0f1f3', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80, border: over === stage.id ? '1px solid #c3d7ff' : '1px solid transparent', transition: 'background 0.12s' }}>
                {items.map(deal => (
                  <DealCard key={deal.id} deal={deal} onSelect={onSelect} onMove={onMove}
                    dragging={drag === deal.id} onDragStart={() => setDrag(deal.id)} onDragEnd={() => { setDrag(null); setOver(null); }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed deals row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        {closedStages.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          return (
            <div key={stage.id} style={{ flex: 1 }}>
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.label}</span>
                <span style={{ fontSize: '0.6875rem', color: '#bbb', fontWeight: 600 }}>{items.length}</span>
              </div>
              <div style={{ background: '#f0f1f3', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 40 }}>
                {items.slice(0, 5).map(deal => (
                  <div key={deal.id} onClick={() => onSelect(deal)} style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{deal.nombre}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#999', marginLeft: 8 }}>{deal.contacts?.nombre}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: stage.color, fontSize: '0.8125rem' }}>{fmt(deal.valor_total)}</span>
                  </div>
                ))}
                {items.length > 5 && <div style={{ fontSize: '0.6875rem', color: '#999', textAlign: 'center', padding: 4 }}>+{items.length - 5} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, onSelect, onMove, dragging, onDragStart, onDragEnd }: { deal: Deal; onSelect: (d: Deal) => void; onMove: (d: Deal, s: string) => void; dragging?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const isMobile = useIsMobile();
  const [moveOpen, setMoveOpen] = useState(false);
  const currentIdx = STAGES.findIndex(s => s.id === deal.stage);
  const nextStages = STAGES.filter((s, i) => s.id !== deal.stage && i >= currentIdx - 1 && i <= currentIdx + 2 && !isLostKey(s.id)).slice(0, 3);
  // SLA: días en la etapa actual (o en el pipeline si no hay marca de etapa).
  const since = deal.stage_changed_at || deal.created_at;

  return (
    <div draggable={!isMobile} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => onSelect(deal)} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: isMobile ? 'default' : 'grab', boxShadow: dragging ? '0 4px 14px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', fontSize: '0.8125rem', opacity: dragging ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 2, flex: 1, minWidth: 0 }}>{deal.nombre}</div>
        <SlaBadge since={since} umbralAmbar={10} umbralRojo={30} label="en etapa" />
      </div>
      <div style={{ fontSize: '0.6875rem', color: '#999' }}>
        {deal.companies?.nombre || ''}{deal.contacts?.nombre ? ` · ${deal.contacts.nombre}` : ''}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{fmt(deal.valor_total)}</span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(deal.stage) + '18', color: stageColor(deal.stage) }}>
          {deal.probabilidad}%
        </span>
      </div>
      {/* Mover: botón principal (ActionSheet con TODAS las etapas — funciona en
          touch donde el drag no) + quick-moves de atajo (≥12px, ≥32px). */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <button onClick={e => { e.stopPropagation(); setMoveOpen(true); }}
          style={{ minHeight: 32, padding: '4px 10px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fbfbfd', color: '#555', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 700 }}>
          ⇄ Mover
        </button>
        {!isMobile && nextStages.map(s => (
          <button key={s.id} onClick={e => { e.stopPropagation(); onMove(deal, s.id); }}
            style={{ fontSize: '0.75rem', minHeight: 32, padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', color: '#777', cursor: 'pointer', fontFamily: 'inherit' }}>
            → {s.label}
          </button>
        ))}
      </div>
      <ActionSheet open={moveOpen} onClose={() => setMoveOpen(false)} title="Mover a…"
        items={STAGES.map(s => ({
          label: s.label,
          icon: <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />,
          active: s.id === deal.stage,
          onClick: () => onMove(deal, s.id),
        }))} />
    </div>
  );
}

// ─── Table View ───
function TableView({ deals, onSelect, onBulk, onDelete, etiquetasFila }: { deals: Deal[]; onSelect: (d: Deal) => void; onBulk?: (ids: string[], patch: Record<string, any>, msg: string) => void | Promise<void>; onDelete?: (ids: string[]) => void | Promise<void>; etiquetasFila?: Record<string, any[]> }) {
  const [sortCol, setSortCol] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmLost, setConfirmLost] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const lostStage = STAGES.find(s => isLostKey(s.id))?.id;
  const runBulk = async (patch: Record<string, any>, msg: string) => { if (onBulk) await onBulk(ids, patch, msg); setSel(new Set()); };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...deals].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortCol) {
      case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'nombre': return dir * a.nombre.localeCompare(b.nombre);
      case 'empresa': return dir * ((a.companies?.nombre || '').localeCompare(b.companies?.nombre || ''));
      case 'contacto': return dir * ((a.contacts?.nombre || '').localeCompare(b.contacts?.nombre || ''));
      case 'plan': return dir * ((a.plan || '').localeCompare(b.plan || ''));
      case 'valor_total': return dir * (a.valor_total - b.valor_total);
      case 'stage': return dir * a.stage.localeCompare(b.stage);
      case 'probabilidad': return dir * (a.probabilidad - b.probabilidad);
      default: return 0;
    }
  });

  const cols = [
    { key: 'created_at', label: 'Fecha' },
    { key: 'nombre', label: 'Oportunidad' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'plan', label: 'Plan' },
    { key: 'valor_total', label: 'Valor' },
    { key: 'stage', label: 'Etapa' },
    { key: 'salud', label: 'Salud' },
    { key: 'probabilidad', label: 'Prob.' },
  ];

  const allChecked = sorted.length > 0 && sorted.every(d => sel.has(d.id));

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {ids.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1a1a1a', color: '#fff', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{ids.length} seleccionados</span>
          {lostStage && <button onClick={() => {
            if (!confirmLost) { setConfirmLost(true); setTimeout(() => setConfirmLost(false), 2600); return; }
            setConfirmLost(false);
            runBulk({ stage: lostStage, probabilidad: 0, closed_at: new Date().toISOString() }, `${ids.length} marcadas perdidas`);
          }} style={dealBulkBtn}>{confirmLost ? `¿Seguro? marcar ${ids.length} perdidas` : '✕ Marcar perdidas'}</button>}
          {onDelete && (
            <button onClick={async () => {
              // Dos pasos, como "marcar perdidas": esto no se deshace.
              if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return; }
              setConfirmDel(false);
              await onDelete(ids); setSel(new Set());
            }} style={{ ...dealBulkBtn, background: confirmDel ? '#7f1d1d' : 'transparent', border: '1px solid #b93333', color: '#fff' }}>
              {confirmDel ? `¿Seguro? borrar ${ids.length} para siempre` : `🗑 Eliminar ${ids.length}`}
            </button>
          )}
          <button onClick={() => setSel(new Set())} style={{ ...dealBulkBtn, background: 'transparent', border: '1px solid #555' }}>Cancelar</button>
        </div>
      )}
      <div className="crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 8px 10px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}><input type="checkbox" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(sorted.map(d => d.id)))} /></th>
              {cols.map(h =>
              <th key={h.key} onClick={() => toggleSort(h.key)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: sortCol === h.key ? '#1a1a1a' : '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                {h.label} {sortCol === h.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            )}</tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr key={d.id} onClick={() => onSelect(d)} style={{ cursor: 'pointer', borderBottom: '1px solid #f8f8f8', background: sel.has(d.id) ? '#f5f8ff' : undefined }}>
                <td style={{ ...td, cursor: 'default' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(d.id)} onChange={() => toggle(d.id)} /></td>
                <td style={td}>{fmtDate(d.created_at)}</td>
                <td style={{ ...td, fontWeight: 700, color: '#1a1a1a' }}>
                  {d.nombre}
                  {(() => {
                    const cat = (d as any).categoria;
                    const c = cat === 'renovacion' ? ['🔄 Renovación', '#1A8F7A'] : cat === 'upsell' ? ['⬆ Upsell', '#6C5CE7'] : null;
                    return c ? <span style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 700, color: c[1] }}>{c[0]}</span> : null;
                  })()}
                  {estaEstancada(d) && <span title={`${diasSinMover(d)} días sin moverse`} style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 700, color: '#b93333' }}>{diasSinMover(d)}d sin mover</span>}
                  {comisionDe(d) > 0 && <span title={`Comisión estimada al socio referido (${COMISION_PCT_DEFAULT}% del primer año)`} style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 700, color: '#a06600' }}>💰 {fmt(comisionDe(d))}</span>}
                  {etiquetasFila?.[d.id]?.length ? <span style={{ marginLeft: 6 }}><ChipsEtiquetas etiquetas={etiquetasFila[d.id]} max={3} /></span> : null}
                </td>
                <td style={td}>{d.companies?.nombre || '—'}</td>
                <td style={td}>{d.contacts?.nombre || '—'}</td>
                <td style={td}><span style={{ textTransform: 'capitalize' as const }}>{d.plan || '—'}</span></td>
                {/* Valor del primer año, y debajo de qué está hecho: sin eso,
                    $80,000 de implementación y $80,000 de ARR se ven igual. */}
                <td style={{ ...td, fontWeight: 700 }}>{fmt(d.valor_total)}
                  {(() => {
                    const mrr = Number((d as any).mrr ?? d.valor_mensual ?? 0);
                    const uni = Number((d as any).valor_unico ?? (d.billing_period === 'unico' ? d.valor_total : 0) ?? 0);
                    if (!mrr && !uni) return null;
                    return <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#999' }}>
                      {mrr ? `${fmt(mrr)}/mes` : ''}{mrr && uni ? ' + ' : ''}{uni ? `${fmt(uni)} único` : ''}
                    </div>;
                  })()}
                </td>
                <td style={td}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(d.stage) + '18', color: stageColor(d.stage) }}>{stageLabel(d.stage)}</span>
                </td>
                <td style={td}>
                  {(() => {
                    const h = saludDeal(d);
                    return (
                      <span title={h.por.length ? h.por.join(' · ') : 'Sin señales de riesgo'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: h.color }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: h.color }}>{h.score}</span>
                        {d.proximo_paso
                          ? <span style={{ fontSize: '0.62rem', color: '#999', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.proximo_paso}>→ {d.proximo_paso}</span>
                          : <span style={{ fontSize: '0.62rem', color: '#b93333' }}>sin próximo paso</span>}
                      </span>
                    );
                  })()}
                </td>
                <td style={td}><span style={{ fontWeight: 600, color: stageColor(d.stage) }}>{d.probabilidad}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Nueva oportunidad Modal ───
// preset: preselecciona contacto/empresa (para crear desde el detalle del cliente).
const money0 = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
export function CreateDealModal({ onClose, onCreated, preset }: { onClose: () => void; onCreated: () => void; preset?: { contact: ContactOption } }) {
  const isMobile = useIsMobile();
  useDrawerHistory(true, onClose); // atrás cierra el modal
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [contactSearch, setContactSearch] = useState(preset?.contact?.nombre || '');
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(preset?.contact || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [planes, setPlanes] = useState<any[]>([]);
  const [plan, setPlan] = useState('');
  const [sucursales, setSucursales] = useState(1);
  // tipoValor: cómo interpretar el monto → deriva MRR/ARR/total.
  const [tipoValor, setTipoValor] = useState<'mrr' | 'arr' | 'unico'>('mrr');
  const [monto, setMonto] = useState(0);
  const [fechaCierre, setFechaCierre] = useState('');
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {}); }, []);
  useEffect(() => { if (preset?.contact && !nombre) setNombre(preset.contact.companies?.nombre ? `${preset.contact.companies.nombre} – Oportunidad` : `${preset.contact.nombre} – Oportunidad`); }, []);

  // Al elegir plan: prellena el monto según el tipo de valor y sucursales.
  function pickPlan(slug: string) {
    setPlan(slug);
    const p = planes.find((x: any) => x.slug === slug);
    if (!p) return;
    const base = tipoValor === 'arr' ? (p.precio_anual || (p.precio_mensual || 0) * 12) : (p.precio_mensual || 0);
    setMonto(base * sucursales);
  }
  useEffect(() => {
    const p = planes.find((x: any) => x.slug === plan);
    if (!p) return;
    const base = tipoValor === 'arr' ? (p.precio_anual || (p.precio_mensual || 0) * 12) : (p.precio_mensual || 0);
    setMonto(base * sucursales);
  }, [sucursales, tipoValor]);

  // Derivar MRR / ARR / valores a guardar desde (tipoValor, monto).
  const mrr = tipoValor === 'mrr' ? monto : tipoValor === 'arr' ? monto / 12 : 0;
  const arr = tipoValor === 'unico' ? 0 : mrr * 12;
  const valorMensual = Math.round(mrr);
  const valorTotal = tipoValor === 'unico' ? Math.round(monto) : Math.round(arr);
  const billingPeriod = tipoValor === 'arr' ? 'anual' : tipoValor === 'unico' ? 'unico' : 'mensual';

  const searchContacts = (q: string) => {
    setContactSearch(q);
    setSelectedContact(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setContactResults([]); setShowDropdown(false); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/crm/contacts?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setContactResults(data.contacts || []);
      setShowDropdown(true);
    }, 300);
  };

  const pickContact = (c: ContactOption) => {
    setSelectedContact(c);
    setContactSearch(c.nombre);
    setShowDropdown(false);
    if (!nombre) setNombre(c.companies?.nombre ? `${c.companies.nombre} – Oportunidad` : `${c.nombre} – Oportunidad`);
  };

  const submit = async () => {
    if (!nombre || !selectedContact) return;
    setSaving(true);
    await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        descripcion: descripcion.trim() || null,
        contact_id: selectedContact.id,
        company_id: selectedContact.company_id,
        plan: plan || null,
        sucursales,
        billing_period: billingPeriod,
        valor_mensual: valorMensual,
        valor_total: valorTotal,
        fecha_cierre_esperada: fechaCierre || null,
      }),
    });
    setSaving(false);
    onCreated();
  };

  const clienteNombre = selectedContact?.companies?.nombre || selectedContact?.nombre || '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 950, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', overflow: 'auto' }}>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      <div style={isMobile
        ? { position: 'relative', background: '#fff', padding: '18px 16px calc(24px + env(safe-area-inset-bottom))', width: '100%', minHeight: '100dvh', boxSizing: 'border-box' }
        : { position: 'relative', background: '#fff', borderRadius: 12, padding: 28, width: 500, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>Nueva oportunidad</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <Label>Nombre de la oportunidad</Label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Restaurante Oaxaca – Fideliza" style={input} />

        <Label>Descripción</Label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="¿Qué se le va a ofrecer y por qué? (contexto para el equipo)" rows={2} style={{ ...input, resize: 'vertical' as const, fontFamily: 'inherit' }} />

        {preset?.contact ? (
          <div style={{ background: '#f6f7f9', borderRadius: 8, padding: '8px 10px', fontSize: '0.78rem', color: '#555', margin: '4px 0 8px' }}>
            Cliente: <b>{clienteNombre}</b>{selectedContact?.nombre ? ` · ${selectedContact.nombre}` : ''}
          </div>
        ) : (
          <>
            <Label>Contacto / cliente</Label>
            <div style={{ position: 'relative' }}>
              <input value={contactSearch} onChange={e => searchContacts(e.target.value)} placeholder="Buscar contacto por nombre, email..." style={input} />
              {showDropdown && contactResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {contactResults.map(c => (
                    <div key={c.id} onClick={() => pickContact(c)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8125rem', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{c.nombre}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#999' }}>{c.email || ''}{c.companies?.nombre ? ` · ${c.companies.nombre}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
              {selectedContact && (
                <div style={{ fontSize: '0.6875rem', color: '#2AB5A0', fontWeight: 600, marginTop: -4, marginBottom: 8 }}>
                  Cliente: {clienteNombre}
                </div>
              )}
            </div>
          </>
        )}

        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Label>Plan</Label>
            <select value={plan} onChange={e => pickPlan(e.target.value)} style={input}>
              <option value="">Sin plan</option>
              {planes.map((p: any) => <option key={p.slug} value={p.slug}>{p.nombre}{p.precio_mensual ? ` ($${p.precio_mensual}/mes)` : ''}</option>)}
            </select>
          </div>
          <div>
            <Label>Sucursales</Label>
            <input type="number" min={1} value={sucursales} onChange={e => setSucursales(Math.max(1, parseInt(e.target.value) || 1))} style={input} />
          </div>
        </div>

        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Label>Tipo de valor</Label>
            <select value={tipoValor} onChange={e => setTipoValor(e.target.value as any)} style={input}>
              <option value="mrr">Mensual (MRR)</option>
              <option value="arr">Anual (ARR)</option>
              <option value="unico">Pago único</option>
            </select>
          </div>
          <div>
            <Label>{tipoValor === 'mrr' ? 'Monto mensual' : tipoValor === 'arr' ? 'Monto anual' : 'Monto único'}</Label>
            <input type="number" value={monto} onChange={e => setMonto(parseFloat(e.target.value) || 0)} style={input} />
          </div>
        </div>

        {/* Derivados claros */}
        <div style={{ background: '#f0f7f4', border: '1px solid #d6ebe2', borderRadius: 8, padding: '8px 12px', margin: '6px 0 4px', fontSize: '0.82rem', color: '#1A8F7A', fontWeight: 700 }}>
          {tipoValor === 'unico'
            ? <>Pago único: {money0(monto)} <span style={{ color: '#999', fontWeight: 400 }}>· no cuenta como ARR recurrente</span></>
            : <>MRR {money0(mrr)} · ARR {money0(arr)}</>}
        </div>

        <Label>Fecha cierre esperada</Label>
        <input type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} style={input} />

        <button onClick={submit} disabled={saving || !nombre || !selectedContact} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 16, justifyContent: 'center', opacity: (!nombre || !selectedContact) ? 0.5 : 1 }}>
          {saving ? 'Creando...' : 'Crear oportunidad'}
        </button>
      </div>
    </div>
  );
}

// ─── Deal Drawer ───
function DealDrawer({ deal, onClose, onSaved, onRefresh }: { deal: Deal; onClose: () => void; onSaved: () => void; onRefresh: (id: string) => void }) {
  const isMobile = useIsMobile();
  useDrawerHistory(true, onClose); // atrás cierra el drawer del deal
  const [editStage, setEditStage] = useState(deal.stage);
  const [editPaso, setEditPaso] = useState<string>((deal as any).proximo_paso || '');
  const [editPasoAt, setEditPasoAt] = useState<string>((deal as any).proximo_paso_at || '');
  const [notasIA, setNotasIA] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [propuesta, setPropuesta] = useState<any>(null);
  const [editPlan, setEditPlan] = useState(deal.plan || '');
  const [editValorMensual, setEditValorMensual] = useState(deal.valor_mensual);
  const [editValorTotal, setEditValorTotal] = useState(deal.valor_total);
  const [editFechaCierre, setEditFechaCierre] = useState(deal.fecha_cierre_esperada || '');
  const [editMotivoPerdida, setEditMotivoPerdida] = useState(deal.motivo_perdida || '');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditStage(deal.stage);
    setEditPlan(deal.plan || '');
    setEditValorMensual(deal.valor_mensual);
    setEditValorTotal(deal.valor_total);
    setEditFechaCierre(deal.fecha_cierre_esperada || '');
    setEditMotivoPerdida(deal.motivo_perdida || '');
    loadActivities();
  }, [deal.id]);

  const loadActivities = async () => {
    const res = await fetch(`/api/crm/activities?deal_id=${deal.id}&limit=30`);
    const data = await res.json();
    setActivities(Array.isArray(data) ? data : []);
  };

  const save = async () => {
    setSaving(true);
    const updates: Record<string, any> = {
      id: deal.id,
      stage: editStage,
      plan: editPlan || null,
      valor_mensual: editValorMensual,
      valor_total: editValorTotal,
      fecha_cierre_esperada: editFechaCierre || null,
      proximo_paso: editPaso || null,
      proximo_paso_at: editPasoAt || null,
      probabilidad: STAGES.find(s => s.id === editStage)?.prob ?? deal.probabilidad,
    };
    if (isLostKey(editStage)) {
      updates.motivo_perdida = editMotivoPerdida || null;
      updates.closed_at = deal.closed_at || new Date().toISOString();
    }
    if (isWonKey(editStage)) {
      updates.closed_at = deal.closed_at || new Date().toISOString();
    }
    const j = await fetch('/api/crm/deals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(r => r.json()).catch(() => ({}));
    setSaving(false);
    if (j?.error) { alert(j.error); return; }
    if (j?.cierre) alert(resumenCierre(j));
    onSaved();
    onRefresh(deal.id);
  };

  // Idea 9 · pegar las notas de la llamada y que proponga la actualización.
  // NO guarda nada solo: propone y una persona acepta. Un CRM que se mueve
  // solo con lo que entendió de una nota deja de ser confiable.
  const analizarNotas = async () => {
    if (notasIA.trim().length < 30) { alert('Pega las notas de la llamada (al menos un par de frases).'); return; }
    setAnalizando(true);
    const j = await fetch('/api/crm/deals/analizar-notas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: deal.id, notas: notasIA }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo analizar' }));
    setAnalizando(false);
    if (j?.error) { alert(j.error); return; }
    setPropuesta(j);
  };
  const aplicarPropuesta = () => {
    if (!propuesta) return;
    if (propuesta.stage && STAGES.some(s => s.id === propuesta.stage)) setEditStage(propuesta.stage);
    if (propuesta.proximo_paso) setEditPaso(propuesta.proximo_paso);
    if (propuesta.proximo_paso_at) setEditPasoAt(propuesta.proximo_paso_at);
    if (propuesta.fecha_cierre_esperada) setEditFechaCierre(propuesta.fecha_cierre_esperada);
    if (propuesta.motivo_perdida) setEditMotivoPerdida(propuesta.motivo_perdida);
    setPropuesta(null);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: deal.contact_id,
        company_id: deal.company_id,
        deal_id: deal.id,
        tipo: 'nota',
        titulo: 'Nota',
        descripcion: noteText.trim(),
      }),
    });
    setNoteText('');
    await loadActivities();
    setSaving(false);
  };

  // Registro rápido de actividad (chips) ligado a esta oportunidad.
  const logQuick = async (tipo: string, label: string) => {
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: deal.contact_id, company_id: deal.company_id, deal_id: deal.id, tipo, titulo: label }),
    });
    await loadActivities();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      {!isMobile && <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />}
      <div style={isMobile
        ? { width: '100%', height: '100dvh', background: '#fff', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
        : { width: 500, maxWidth: '90vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        {isMobile && (
          <div style={{ padding: '6px 12px 0' }}>
            <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', padding: '8px 12px 8px 8px', fontSize: '0.95rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Volver
            </button>
          </div>
        )}
        <div style={{ padding: isMobile ? '4px 16px 12px' : '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>{deal.nombre}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(deal.stage) + '18', color: stageColor(deal.stage) }}>{stageLabel(deal.stage)}</span>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#888' }}>{STAGES.find(sx => sx.id === deal.stage)?.prob ?? deal.probabilidad}%</span>
              {deal.days_in_pipeline != null && <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#aaa' }}>{deal.days_in_pipeline}d en pipeline</span>}
            </div>
          </div>
          {!isMobile && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>}
        </div>

        <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>
          {/* Deal fields */}
          <Label>Etapa</Label>
          <select value={editStage} onChange={e => setEditStage(e.target.value)} style={input}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.prob}%)</option>)}
          </select>

          {isLostKey(editStage) && (
            <>
              <Label>Motivo de pérdida *</Label>
              <input value={editMotivoPerdida} onChange={e => setEditMotivoPerdida(e.target.value)} placeholder="precio · competidor · no era el momento · falta una función · no contestó" style={input} />
            </>
          )}

          {/* Próximo paso: un trato sin siguiente paso agendado es un trato
              muerto. Por eso se pide aquí y pesa en el score de salud. */}
          <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <Label>Próximo paso</Label>
              <input value={editPaso} onChange={e => setEditPaso(e.target.value)} placeholder="llamarle para cerrar precio…" style={input} />
            </div>
            <div>
              <Label>¿Cuándo?</Label>
              <input type="date" value={editPasoAt} onChange={e => setEditPasoAt(e.target.value)} style={input} />
            </div>
          </div>

          <Label>Etiquetas</Label>
          <div style={{ marginBottom: 10 }}><Etiquetas entidad="deal" id={deal.id} /></div>

          {/* Notas de la llamada → propuesta de actualización (idea 9).
              En su propia card: el CTA es de ESTA zona, no el submit del form. */}
          <div style={{ background: '#F7F7FB', border: '1px solid #ececf3', borderRadius: 12, padding: '12px 14px', margin: '4px 0 12px' }}>
            <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#8f8d98', marginBottom: 8 }}>Asistente IA</div>
            <textarea value={notasIA} onChange={e => setNotasIA(e.target.value)} rows={3}
              placeholder="Pega aquí lo que se habló y te propongo etapa, próximo paso y fecha de cierre."
              style={{ ...input, minHeight: 70, resize: 'vertical' as const }} />
            <button onClick={analizarNotas} disabled={analizando} style={{ ...btn, background: '#fff', border: '1.5px solid #c9bcf7', color: '#5B4BD6' }}>
              {analizando ? 'Leyendo…' : 'Proponer actualización'}
            </button>
          </div>
          {propuesta && (
            <div style={{ background: '#f7f6ff', border: '1px solid #e2ddf9', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: '0.8rem' }}>
              <b>Propuesta</b>
              {propuesta.resumen && <div style={{ color: '#555', margin: '4px 0' }}>{propuesta.resumen}</div>}
              <ul style={{ margin: '6px 0 8px 18px', color: '#555' }}>
                {propuesta.stage && <li>Etapa → <b>{stageLabel(propuesta.stage)}</b></li>}
                {propuesta.proximo_paso && <li>Próximo paso: <b>{propuesta.proximo_paso}</b>{propuesta.proximo_paso_at ? ` (${propuesta.proximo_paso_at})` : ''}</li>}
                {propuesta.fecha_cierre_esperada && <li>Cierre esperado: <b>{propuesta.fecha_cierre_esperada}</b></li>}
                {propuesta.motivo_perdida && <li>Motivo de pérdida: <b>{propuesta.motivo_perdida}</b></li>}
                {propuesta.objeciones?.length ? <li>Objeciones: {propuesta.objeciones.join(' · ')}</li> : null}
              </ul>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={aplicarPropuesta} style={{ ...btn, background: '#5B4BD6', color: '#fff' }}>Aplicar a los campos</button>
                <button onClick={() => setPropuesta(null)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Descartar</button>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 6 }}>Nada se guarda hasta que le des a Guardar: la propuesta solo llena los campos.</div>
            </div>
          )}

          <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Plan</Label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={input}>
                <option value="">Sin plan</option>
                <option value="vende">Vende</option>
                <option value="controla">Controla</option>
                <option value="fideliza">Fideliza</option>
                <option value="automatiza">Automatiza</option>
              </select>
            </div>
            <div>
              <Label>Fecha cierre esperada</Label>
              <input type="date" value={editFechaCierre} onChange={e => setEditFechaCierre(e.target.value)} style={input} />
            </div>
          </div>

          <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Valor mensual</Label>
              <input type="number" value={editValorMensual} onChange={e => setEditValorMensual(parseFloat(e.target.value) || 0)} style={input} />
            </div>
            <div>
              <Label>Valor total</Label>
              <input type="number" value={editValorTotal} onChange={e => setEditValorTotal(parseFloat(e.target.value) || 0)} style={input} />
            </div>
          </div>

          <div style={isMobile ? { position: 'sticky', bottom: 0, background: '#fff', padding: '10px 0 14px', margin: '8px -16px 0', paddingLeft: 16, paddingRight: 16, borderTop: '1px solid #e5e7eb', boxShadow: '0 -6px 16px rgba(16,24,40,.06)' } : undefined}>
            <button onClick={save} disabled={saving} style={{ ...btn, background: '#5B4BD6', color: '#fff', width: '100%', minHeight: 48, marginTop: isMobile ? 0 : 8, justifyContent: 'center' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          {/* Contact info */}
          {deal.contacts && (
            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginTop: 20 }}>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Contacto</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{deal.contacts.nombre}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {deal.contacts.whatsapp && (
                  <a href={`https://wa.me/${deal.contacts.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ ...btn, background: '#e8f5e9', color: '#2e7d32', fontSize: '0.75rem', padding: '6px 10px', textDecoration: 'none' }}>WhatsApp</a>
                )}
                {deal.contacts.email && (
                  <a href={`mailto:${deal.contacts.email}`} style={{ ...btn, background: '#e3f2fd', color: '#1565c0', fontSize: '0.75rem', padding: '6px 10px', textDecoration: 'none' }}>Email</a>
                )}
              </div>
            </div>
          )}

          {/* Company info */}
          {deal.companies && (
            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Empresa</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{deal.companies.nombre}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem' }}>
                {deal.companies.plan && <span style={{ color: '#4B7BE5', fontWeight: 600 }}>Plan: {deal.companies.plan}</span>}
              </div>
            </div>
          )}

          {/* Related quote */}
          {deal.quote_id && (
            <div style={{ marginTop: 12 }}>
              <a href={`/cotizacion/${deal.quote_id}`} target="_blank" rel="noopener" style={{ ...btn, background: '#f5f5f5', color: '#4B7BE5', textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
                Ver cotización →
              </a>
            </div>
          )}

          {/* Registro rápido de actividad */}
          <Label style={{ marginTop: 20 }}>Registrar actividad</Label>
          <ActivityChips onLog={logQuick} disabled={saving} />

          {/* Add note */}
          <Label>Agregar nota</Label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escribir nota..." style={{ ...input, flex: 1, marginBottom: 0 }}
              onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
            <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ ...btn, background: '#5B4BD6', color: '#fff' }}>+</button>
          </div>

          {/* Activity Timeline */}
          <Label>Timeline</Label>
          {activities.length === 0 ? (
            <div style={{ color: '#ccc', fontSize: '0.8125rem', padding: '8px 0' }}>Sin actividades</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activities.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < activities.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: activityColor(a.tipo), flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>{a.titulo || activityLabel(a.tipo)}</div>
                    {a.descripcion && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>{a.descripcion}</div>}
                    <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 2 }}>
                      {fmtDate(a.created_at)} · {new Date(a.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {a.automatico && <span style={{ marginLeft: 6, color: '#ddd' }}>auto</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tiny helpers ───
function Label({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, marginTop: 12, ...s }}>{children}</div>;
}
