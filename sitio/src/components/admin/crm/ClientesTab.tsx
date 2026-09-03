import { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react';
import { lazySeguro } from '../../../lib/ui/lazySeguro';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import { useCampos } from './CamposPersonalizados';
import { Users, TrendingUp, Wallet, AlertTriangle, Plus, ChevronDown, Link2, MessageCircle, Download, Settings2, LayoutGrid, Table2, Building2, Infinity as InfinityIcon } from 'lucide-react';
import { S } from './SubscriptionsTab';
// REGLA DE VELOCIDAD: los overlays pesados bajan al abrirse, no con la lista.
const ClienteDrawer360 = lazySeguro(() => import('./ClienteDrawer360'));
const NuevoClienteModal = lazySeguro(() => import('./NuevoClienteModal'));
const PipelineKanban = lazySeguro(() => import('./PipelineKanban'));
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import FiltroRenovacion, { type RangoRenov } from './FiltroRenovacion';
import { useToast, Toast, logStageChange } from './crmHelpers';
import { SENAL_LABEL } from '../../../lib/crm/senales';
import { useIsMobile } from '../../../lib/ui/mobile';
import HealthScoreBadge from './HealthScoreBadge';
import { swrGet } from '../../../lib/crm/swr';
import VistaRapida, { HojaEsqueleto } from './ui/VistaRapida';
import FilaDeslizable from './ui/FilaDeslizable';
import EstadoVacio from './ui/EstadoVacio';

/* ═══ Clientes REALES — primer datatable sobre el estándar TablaEnterprise ═══
 * (proyecto "Datatables Enterprise", estilo HubSpot: filtros → buscador → tabs
 * de vistas guardadas → tabla ordenable con paginación). */

// Los mismos tonos de Cotizaciones: morado y azul para lo estructural, verde
// solo para montos pagados y rojo solo para lo vencido o en riesgo.
const CL = {
  violeta: '#9B8CFA', azul: '#7DA6F5', violetaTinta: '#5B4BD6',
  verde: '#4FBF95', verdeTinta: '#1E8A63', rojo: '#EF7A72', rojoTinta: '#C0554E',
} as const;

const PLAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  vende:           { bg: 'rgba(75,123,229,0.12)',  color: '#3764c4', label: 'Vende' },
  controla:        { bg: 'rgba(42,181,160,0.14)',  color: '#1A8F7A', label: 'Controla' },
  fideliza:        { bg: 'rgba(108,92,231,0.12)',  color: '#6C5CE7', label: 'Fideliza' },
  automatiza:      { bg: 'rgba(232,168,56,0.16)',  color: '#a06600', label: 'Automatiza' },
  personalizada:   { bg: 'rgba(26,26,26,0.08)',    color: '#1a1a1a', label: 'Personalizada' },
  soporte_premium: { bg: 'rgba(229,75,75,0.10)',   color: '#b93333', label: 'Soporte premium' },
};

/* Estado de la relación, de un vistazo. Una vitalicia NO es "sin suscripción":
 * pagó de por vida, solo que no es recurrente — marcarla como inactiva haría
 * ver como muerto a un cliente vivo. */
const ESTADO_SUB = (c: any): { label: string; bg: string; color: string } => {
  if (c.subs_activas > 0) return { label: 'activa', bg: 'rgba(42,181,160,0.15)', color: '#1A8F7A' };
  if (c.subs_pausadas > 0) return { label: 'pausada', bg: 'rgba(232,168,56,0.16)', color: '#a06600' };
  if (c.subs_pendientes > 0) return { label: 'pendiente', bg: 'rgba(232,168,56,0.16)', color: '#a06600' };
  if (c.vitalicia) return { label: 'vitalicia', bg: 'rgba(108,92,231,0.12)', color: '#6C5CE7' };
  return { label: 'sin activa', bg: '#f3f4f6', color: '#9aa0a8' };
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

/* Densidad enterprise de las celdas (estilos propios del tab). */
const T = {
  td: { padding: '12px 14px', fontSize: '0.79rem', color: '#333', borderBottom: '1px solid #f1f2f5', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
  num: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  ell: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as const,
  sub: { fontSize: '0.67rem', color: '#a7abb3', fontWeight: 400, marginTop: 2 } as const,
  muted: { fontSize: '0.74rem', color: '#6b7078' } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  /* Stat-cards del spec UI/UX: chip de icono pastel + valor grande + dual-value con dots. */
  kpiCard: { background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', display: 'flex', flexDirection: 'column' as const, gap: 10 } as const,
  kpiChip: (bg: string) => ({ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }) as const,
  kLabel: { fontSize: '0.68rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const,
  kValue: { fontSize: '1.55rem', fontWeight: 800, color: '#16181d', letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as const } as const,
  dot: (c: string) => ({ width: 7, height: 7, borderRadius: 99, background: c, flexShrink: 0 }) as const,
  dualNum: { fontSize: '0.82rem', fontWeight: 700, color: '#16181d', fontVariantNumeric: 'tabular-nums' as const } as const,
  dualLbl: { fontSize: '0.62rem', fontWeight: 600, color: '#9aa0a8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as const,
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#333', textAlign: 'left' as const, textDecoration: 'none', boxSizing: 'border-box' as const } as const,
};

/* Tarjeta KPI reutilizable (fila: chip+label · valor · dual-value). */
// Misma tarjeta que en Cotizaciones: franja lateral de 3 px, título chico en
// mayúsculas, número grande y una línea secundaria. Sin el ícono en cuadrito de
// color — allá no existe y aquí solo agregaba peso.
/** Con `onClick` la tarjeta es una puerta —cambia lo que se está viendo— y lo
 *  dice al pasar el mouse. Sin él es solo un número. */
function KpiCard({ franja, label, value, valueColor, sub, style, onClick, activo }: { franja: string; label: string; value: any; valueColor?: string; sub: any; style?: any; onClick?: () => void; activo?: boolean }) {
  return (
    <div onClick={onClick}
      onMouseEnter={e => { if (onClick && !activo) (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 12px rgba(16,24,40,.10)'; }}
      onMouseLeave={e => { if (!activo) (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      style={{
        background: '#fff', border: '1px solid #ececf0', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .12s',
        ...(activo ? { boxShadow: `0 0 0 2px ${franja}66` } : {}), ...style,
      }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#9c99a6' }}>{label}</div>
      <div style={{ fontSize: '1.32rem', fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', color: valueColor || '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: '0.66rem', color: '#a5a2af', marginTop: 3, lineHeight: 1.45 }}>
        {sub}{onClick ? <span style={{ color: '#5B4BD6', fontWeight: 700 }}> · {activo ? 'volver a clientes' : 'ver'}</span> : null}
      </div>
    </div>
  );
}

// Catálogo cerrado de motivos de baja — el mismo de todo el CRM.
const RAZONES_BAJA: [string, string][] = [
  ['precio', 'Precio / presupuesto'],
  ['no_implemento', 'No lo implementó'],
  ['no_uso', 'Dejó de usarlo'],
  ['cerro_negocio', 'Cerró el negocio'],
  ['competencia', 'Se fue con la competencia'],
  ['mal_servicio', 'Mal servicio / soporte'],
  ['feature_falta', 'Le faltó una función'],
  ['otro', 'Otro'],
];

/**
 * Capturar de un jalón por qué se fueron varios exclientes.
 *
 * De los 35, 17 se fueron sin motivo: se cancelaron antes de que el campo se
 * pidiera, y entre ellos están los tres que más ARR se llevaron. Hacerlo uno
 * por uno —abrir la ficha, abrir cada licencia— es la razón por la que nunca
 * se hace.
 */
function MotivoBajaMasivo({ ids, onCerrar, onListo }: { ids: string[]; onCerrar: () => void; onListo: (msg: string) => void }) {
  const [razon, setRazon] = useState('');
  const [detalle, setDetalle] = useState('');
  const [sobrescribir, setSobrescribir] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const exigeDetalle = razon === 'otro' || razon === 'competencia';

  async function guardar() {
    if (!razon) { setErr('Elige el motivo.'); return; }
    if (exigeDetalle && !detalle.trim()) { setErr(razon === 'competencia' ? '¿A qué competidor se fueron?' : 'Agrega el detalle.'); return; }
    setBusy(true); setErr('');
    const j = await fetch('/api/crm/arr/motivo-baja', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_ids: ids, razon, detalle: detalle.trim(), sobrescribir }),
    }).then(r => r.json()).catch(() => ({ error: 'Respuesta inválida' }));
    if (j?.error) { setErr(j.error); setBusy(false); return; }
    onListo(j.aviso || `Motivo capturado en ${j.actualizadas} licencia(s) de ${j.cuentas} cuenta(s)` +
      (j.respetadas ? ` · ${j.respetadas} ya tenían motivo y no se tocaron` : ''));
  }

  const inp = { width: '100%', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '9px 11px', fontSize: '0.82rem', fontFamily: 'inherit', background: '#fdfcff', boxSizing: 'border-box' as const };
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(16,24,40,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(520px,100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#C0554E' }}>Por qué se fueron</div>
          <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 5 }}>
            Se aplica a <b>{ids.length}</b> excliente{ids.length === 1 ? '' : 's'} y a todas sus licencias canceladas.
          </div>
        </div>
        <div style={{ padding: '14px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={razon} onChange={e => setRazon(e.target.value)} autoFocus style={inp}>
            <option value="">Elige el motivo…</option>
            {RAZONES_BAJA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={3}
            placeholder={razon === 'competencia' ? '¿A qué competidor se fueron?' : 'Detalle (opcional, pero es lo que sirve después)'}
            style={{ ...inp, resize: 'vertical' }} />
          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={sobrescribir} onChange={e => setSobrescribir(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: '0.79rem', color: '#4a4558', lineHeight: 1.5 }}>
              Sobrescribir los que ya tienen motivo
              <div style={{ color: '#8a8a92', fontSize: '0.73rem' }}>Sin esto solo se llenan los huecos — un motivo capturado es un dato que alguien preguntó.</div>
            </span>
          </label>
          {err && <div style={{ fontSize: '0.82rem', color: '#b93333', fontWeight: 700 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 22px 20px' }}>
          <button onClick={onCerrar} style={{ ...S.btnSmall, minHeight: 40, padding: '0 16px' }}>Cancelar</button>
          <button onClick={guardar} disabled={busy}
            style={{ border: 'none', borderRadius: 9, minHeight: 40, padding: '0 18px', background: '#C0554E', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>
            {busy ? 'Guardando…' : 'Guardar motivo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientesTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { props: campos } = useCampos('company');
  const [rangoRenov, setRangoRenov] = useState<RangoRenov>(null);
  // Qué lista se está viendo. Arranca en clientes: los exclientes se consultan,
  // no se trabajan todos los días.
  const [verExclientes, setVerExclientes] = useState(false);
  // Selección para capturar el motivo de baja de varios de un jalón.
  const [selEx, setSelEx] = useState<Set<string>>(new Set());
  const [motivoMasivo, setMotivoMasivo] = useState(false);
  const [avisoEx, setAvisoEx] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  // Con qué pestaña abrir la ficha. Existe para poder enlazar directo a una
  // sección concreta desde otra pantalla —el triaje de renovaciones manda aquí
  // con `ct=renovacion`— en vez de dejar al usuario buscándola.
  const [detailTab, setDetailTab] = useState<string | undefined>(undefined);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('company');
    if (c) { setDetailId(c); setDetailTab(q.get('ct') || undefined); }
  }, []);
  const [showNuevo, setShowNuevo] = useState(false);
  const [modo, setModo] = useState<'tabla' | 'kanban'>('tabla');
  const isMobile = useIsMobile();
  // ══ Pantalla móvil v5 (mockup Clientes): búsqueda fija + chips + filas ══
  const [buscaM, setBuscaM] = useState('');
  const [chipCl, setChipCl] = useState<'activos' | 'riesgo'>('activos');
  const [arrAsc, setArrAsc] = useState(false);
  // Vista rápida (mock aprobado): el tap abre el sheet mínimo; "Ver todo" la ficha
  const [rapida, setRapida] = useState<any>(null);
  // REGLA DE VELOCIDAD: 40 filas de inicio, el sentinel pide más al scrollear
  const [visMovil, setVisMovil] = useState(40);
  const finListaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isMobile || !finListaRef.current) return;
    const io = new IntersectionObserver(es => { if (es[0]?.isIntersecting) setVisMovil(v => v + 80); }, { rootMargin: '600px' });
    io.observe(finListaRef.current);
    return () => io.disconnect();
  }, [isMobile, chipCl]);
  const { toast, show } = useToast();
  const [stages, setStages] = useState<{ key: string; label: string; color: string }[]>([]);

  // KPIs con dual-value (spec UI/UX): riesgo/vencidas/pagado se derivan de data.
  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const pagado = data.reduce((a, c) => a + Number(c.total_pagado || 0), 0);
    const pagos = data.reduce((a, c) => a + Number(c.pagos_realizados || 0), 0);
    const arrPend = data.reduce((a, c) => a + Number(c.arr_pendiente || 0), 0);
    return {
      pagado, pagos,
      promedio: pagos > 0 ? pagado / pagos : 0,
      arrPend,
      riesgo: data.filter(c => c.dias_sin_venta != null && c.dias_sin_venta >= 3 && c.subs_activas > 0).length,
      vencidas: data.filter(c => c.proxima_factura && c.proxima_factura < hoy).length,
    };
  }, [data]);
  // Edición inline de correo/WhatsApp del contacto.
  const [editId, setEditId] = useState<string | null>(null);
  const [eEmail, setEEmail] = useState('');
  const [eWa, setEWa] = useState('');
  const [saving, setSaving] = useState(false);

  // Formato WhatsApp Meta (+52…, sin el "1" de móvil), igual que lib/kapso.ts.
  function metaWa(p: string): string {
    let c = String(p || '').replace(/[^\d+]/g, '');
    if (!c) return '';
    if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
    if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
    return c;
  }
  function startEdit(c: any) {
    setEditId(c.id);
    setEEmail(c.contacto?.email || '');
    setEWa(c.contacto?.whatsapp || c.contacto?.telefono || '');
  }
  async function saveEdit(c: any) {
    setSaving(true);
    const email = eEmail.trim() || null;
    const whatsapp = eWa.trim() ? metaWa(eWa.trim()) : null;
    try {
      let r: Response;
      if (c.contacto?.id) {
        r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.contacto.id, email, whatsapp }) });
      } else {
        r = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: c.id, nombre: c.contacto?.nombre || c.nombre || 'Contacto', email, whatsapp, tipo: 'cliente', lifecycle_stage: 'cliente' }) });
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) { alert(j.error || 'No se pudo guardar.'); }
      else { setEditId(null); show('Contacto actualizado'); load(); }
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setSaving(false);
  }

  async function load() {
    setError(null);
    // REGLA DE VELOCIDAD: pinta el caché al instante (y apaga el spinner), revalida detrás
    let pinto = false;
    const aplicar = (j: any) => {
      if (j?.error) return;
      setData(j.data || []); setTot(j.tot || null); setLoading(false); pinto = true;
    };
    setLoading(true);
    try {
      const [, pj] = await Promise.all([
        swrGet('/api/crm/arr/clientes', aplicar),
        fetch('/api/crm/pipelines').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      const cli = (pj.data || []).find((p: any) => p.tipo === 'cliente');
      setStages(cli?.stages || []);
    } catch (e: any) { if (!pinto) setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const stageBy = useMemo(() => { const m: Record<string, any> = {}; stages.forEach(s => m[s.key] = s); return m; }, [stages]);
  async function setStage(id: string, key: string) {
    const prev = data.find(c => c.id === id);
    setData(d => d.map(c => c.id === id ? { ...c, pipeline_stage: key } : c));
    try {
      const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, pipeline_stage: key }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); if (j.error) { alert(j.error + '\n¿Corriste migration-2026-07-pipelines.sql?'); load(); return; } }
      const toLabel = stageBy[key]?.label || key;
      logStageChange({ company_id: id, contact_id: prev?.contacto?.id || null, fromLabel: prev?.pipeline_stage ? stageBy[prev.pipeline_stage]?.label : undefined, toLabel });
      show(`Cliente movido a ${toLabel}`);
    } catch { load(); }
  }

  /* ── Definición del datatable estándar ── */
  // Periodo de renovación: se aplica sobre la PRÓXIMA FACTURA, que es la que
  // contesta "¿a quién le toca pagar en este periodo?". Un cliente sin fecha
  // —sin suscripción activa— no puede caer dentro de ningún rango.
  // ── Clientes y exclientes son dos listas, no una ──
  // Un excliente no se borra: su historia es justo lo que hace falta para
  // intentar recuperarlo. Pero tampoco puede contarse ni ordenarse junto a
  // quien te paga: son dos seguimientos distintos.
  const clientes = data.filter((c: any) => !c.es_excliente);
  const exclientes = data.filter((c: any) => c.es_excliente);
  const base = verExclientes ? exclientes : clientes;

  const dataEtiquetada = rangoRenov && !verExclientes
    ? base.filter((c: any) => {
        const f = String(c.proxima_factura || '').slice(0, 10);
        return !!f && f >= rangoRenov.desde && f <= rangoRenov.hasta;
      })
    : base;

  const cols: ColDef[] = [
    {
      key: 'cliente', label: 'Cliente', width: 212, fija: true, ftype: 'text',
      // El cliente es la EMPRESA. El título salía del contacto, así que un
      // renglón decía "Oscar Rivera" cuando la cuenta es Super Carnes Rivera.
      val: c => (c.nombre_comercial || c.sacs_account || c.nombre || '').toLowerCase(),
      render: c => {
        const titulo = c.nombre_comercial || c.sacs_account || c.nombre;
        const cuentas: string[] = c.cuentas?.length ? c.cuentas : (c.sacs_account ? [c.sacs_account] : []);
        return (
          <td style={{ ...T.td, ...T.ell, fontWeight: 700 }}>
            {titulo}
            {/* Con varias cuentas de SACS hay que enseñarlas TODAS: si solo se ve
                una, el renglón parece de otro cliente (y los montos, que son la
                suma de ambas, no cuadran con lo que se ve dentro de esa cuenta). */}
            {cuentas.length > 1 ? (
              <div style={{ ...T.sub, whiteSpace: 'normal', lineHeight: 1.35 }} title={cuentas.join(' · ')}>
                <span style={{ ...T.badge, background: '#eef2fe', color: '#3764c4', fontSize: '0.58rem', marginRight: 5, verticalAlign: 'middle' }}>{cuentas.length} cuentas</span>
                {cuentas.join(' · ')}
              </div>
            ) : (cuentas[0] && cuentas[0] !== titulo ? <div style={{ ...T.sub, ...T.ell }}>{cuentas[0]}</div> : null)}
          </td>
        );
      },
    },
    {
      key: 'contacto', label: 'Contacto', width: 132, ftype: 'text',
      val: c => (c.contacto?.nombre || '').toLowerCase(),
      render: c => (
        <td style={{ ...T.td, ...T.ell }}>
          {c.contacto?.nombre
            ? <><span style={{ fontWeight: 700 }}>{c.contacto.nombre}</span>
                <div style={{ ...T.sub, ...T.ell }}>{c.contacto.rol || (c.contacto.es_principal ? 'contacto principal' : '')}</div></>
            : <span style={{ color: '#c62828' }}>sin contacto</span>}
        </td>
      ),
    },
    {
      // Correo y teléfono aparte: juntos con el nombre, la columna se saturaba
      // y no se leía ninguno de los tres.
      key: 'datos_contacto', label: 'Datos de contacto', width: 202, ftype: 'text',
      val: c => [c.contacto?.email, c.contacto?.whatsapp, c.contacto?.telefono].filter(Boolean).join(' '),
      render: c => (
        <td style={T.td} onClick={e => e.stopPropagation()}>
          {editId === c.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="correo@…" style={{ ...S.input, padding: '4px 6px', fontSize: '0.74rem' }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={eWa} onChange={e => setEWa(e.target.value)} placeholder="+52…" style={{ ...S.input, padding: '4px 6px', fontSize: '0.74rem', flex: 1, minWidth: 0 }} />
                <button title="Guardar" disabled={saving} onClick={() => saveEdit(c)} style={{ ...S.btnSmall, padding: '3px 7px', color: '#1A8F7A', fontWeight: 800 }}>{saving ? '…' : '✓'}</button>
                <button title="Cancelar" onClick={() => setEditId(null)} style={{ ...S.btnSmall, padding: '3px 7px' }}>✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...T.ell, color: c.contacto?.email ? '#444' : '#c4c8cf', fontSize: '0.76rem' }}>
                  {c.contacto?.email || '—'}
                </div>
                <div style={{ ...T.ell, ...T.sub, marginTop: 1 }}>{c.contacto?.whatsapp || c.contacto?.telefono || 'sin teléfono'}</div>
              </div>
              <button className="ct-pencil" title={c.contacto ? 'Editar correo/WhatsApp' : 'Agregar contacto'} onClick={() => startEdit(c)} style={{ ...S.btnSmall, padding: '2px 7px', border: 'none', background: 'none', flexShrink: 0 }}>✏️</button>
            </div>
          )}
        </td>
      ),
    },
    {
      key: 'plan', label: 'Plan', width: 142, ftype: 'select',
      options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })),
      val: c => c.plan || '',
      // Solo el tipo de suscripción. El estado de la cuenta vivía pegado abajo
      // y las dos etiquetas juntas hacían que no se leyera ninguna; se filtra
      // por estado desde los filtros, que es donde sirve.
      render: c => {
        const b = PLAN_BADGE[c.plan] || null;
        return (
          <td style={T.td}>
            {/* Sin ellipsis: "Soporte premium" salía recortado a media palabra.
                La pastilla manda el ancho, no al revés. */}
            {b ? <span style={{ ...T.badge, background: b.bg, color: b.color, whiteSpace: 'nowrap' as const }}>{b.label}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}
          </td>
        );
      },
    },
    {
      key: 'renovacion', label: 'Renovación', width: 108, ftype: 'date', val: c => c.proxima_factura || '',
      render: c => {
        const f = c.proxima_factura;
        if (!f) return <td style={T.td}><span style={{ color: '#c4c8cf' }}>—</span></td>;
        const dias = Math.round((new Date(f + 'T00:00:00').getTime() - Date.now()) / 86400000);
        return (
          <td style={T.td}>
            <div style={{ fontSize: '0.74rem' }}>{fmtDate(f)}</div>
            <div style={{ ...T.sub, color: dias < 0 ? '#C0554E' : '#9aa0a8', fontWeight: dias < 0 ? 700 : 600 }}>
              {dias < 0 ? `venció hace ${Math.abs(dias)} d` : dias === 0 ? 'hoy' : `en ${dias} días`}
            </div>
          </td>
        );
      },
    },
    {
      // ── Estado de pago ──
      // Independiente de la renovación: una cuenta puede renovar en diciembre y
      // traer la mensualidad de este mes vencida. Es la columna que contesta
      // "¿a quién hay que cobrarle hoy?" sin abrir a nadie.
      key: 'estado_pago', label: 'Estado de pago', width: 128, ftype: 'select',
      options: [{ v: 'corriente', l: 'Al corriente' }, { v: 'proximo', l: 'Pago próximo' }, { v: 'vencido', l: 'Pago vencido' }],
      val: c => c.estado_pago || '',
      render: c => {
        const e = c.estado_pago;
        if (!e) return <td style={T.td}><span style={{ color: '#c4c8cf' }}>—</span></td>;
        const cfg: Record<string, { l: string; bg: string; fg: string; dot: string }> = {
          corriente: { l: 'Al corriente', bg: '#EAF8F2', fg: '#1E8A63', dot: '#4FBF95' },
          proximo:   { l: 'Pago próximo', bg: '#FEF6E8', fg: '#A06600', dot: '#E9B949' },
          vencido:   { l: 'Pago vencido', bg: '#FEF0EF', fg: '#C0554E', dot: '#EF7A72' },
        };
        const k = cfg[e];
        return (
          <td style={T.td}>
            <span style={{ ...T.badge, background: k.bg, color: k.fg, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: k.dot }} />{k.l}
            </span>
            {c.mp?.rechazos ? <div style={{ ...T.sub, color: '#C0554E', fontWeight: 700 }}>{c.mp.rechazos} rechazo{c.mp.rechazos > 1 ? 's' : ''} MP</div> : null}
          </td>
        );
      },
    },
    {
      key: 'arr', label: 'ARR', width: 108, num: true, ftype: 'number', val: c => Number(c.arr || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num, fontWeight: 800 }}>
          {money(c.arr)}
          <div style={{ ...T.sub, fontWeight: 600 }}>
            {c.vitalicia
              ? <span style={{ ...T.badge, background: '#f1effd', color: '#6C5CE7', fontWeight: 700 }}>Vitalicia</span>
              : <>{c.subs_activas} sub{c.subs_activas === 1 ? '' : 's'}{c.arr_pendiente > 0 ? <span style={{ color: '#a06600' }}> +{money(c.arr_pendiente)}</span> : ''}</>}
          </div>
        </td>
      ),
    },
    {
      key: 'pagado', label: 'Pagado', width: 102, num: true, ftype: 'number', val: c => Number(c.total_pagado || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num }}>
          <span style={{ fontWeight: 700 }}>{money(c.total_pagado)}</span>
          <div style={{ ...T.sub, fontWeight: 600 }}>{c.pagos_realizados} pago{c.pagos_realizados === 1 ? '' : 's'}</div>
        </td>
      ),
    },
    {
      // ── Actividad ──
      // Un hecho: cuándo vendió por última vez. Iba mezclada con el score de
      // salud en una sola columna llamada "Actividad" que en realidad mostraba
      // la salud; así no se veía el caso importante — el cliente que paga
      // puntual y lleva 41 días sin vender.
      key: 'actividad', label: 'Actividad', width: 114, ftype: 'number',
      val: c => (c.dias_sin_venta == null ? 99999 : Number(c.dias_sin_venta)),
      render: c => {
        const d = c.dias_sin_venta;
        const rojo = d != null && d > 15, ambar = d != null && d >= 3;
        return (
          <td style={T.td}>
            <div style={{ fontSize: '0.74rem', fontWeight: rojo ? 700 : 500, color: rojo ? '#C0554E' : ambar ? '#A06600' : '#444' }}>
              {c.ultima_venta_at ? (d === 0 ? 'hoy' : `hace ${d} día${d === 1 ? '' : 's'}`) : (c.sacs_account ? 'sin datos' : 'sin cuenta')}
            </div>
            <div style={{ ...T.sub, ...T.ell }}>{c.ultima_venta_at ? fmtDate(c.ultima_venta_at) : ''}</div>
          </td>
        );
      },
    },
    {
      key: 'ventas30', label: 'Ventas 30d', width: 118, num: true, ftype: 'number', val: c => Number(c.total_30d || 0),
      render: c => (
        <td style={{ ...T.td, ...T.num }}>
          {c.total_30d != null || c.ventas_30d != null ? (
            <>
              <span style={{ fontWeight: 700 }}>{money(c.total_30d || 0)}</span>
              <div style={{ ...T.sub, fontWeight: 600 }}>{c.ventas_30d || 0} venta{c.ventas_30d === 1 ? '' : 's'}</div>
            </>
          ) : <span style={{ color: '#c4c8cf' }}>—</span>}
        </td>
      ),
    },
    {
      // ── Salud del cliente ──
      // El score ya se calculaba con seis factores guardados (uso, recencia,
      // adopción, equipo, tendencia y crecimiento) pero vivía escondido junto a
      // la actividad. Aquí es su propia columna, con la barra que deja
      // compararlos de un vistazo.
      key: 'salud', label: 'Salud', width: 124, ftype: 'number',
      val: c => c.health_score == null ? null : Number(c.health_score),
      render: c => {
        const h = c.health_score;
        if (h == null) return <td style={T.td}><span style={{ color: '#c4c8cf' }}>—</span></td>;
        const alto = h >= 70, medio = h >= 40;
        const fg = alto ? '#1E8A63' : medio ? '#A06600' : '#C0554E';
        const bg = alto ? '#EAF8F2' : medio ? '#FEF6E8' : '#FEF0EF';
        const barra = alto ? '#4FBF95' : medio ? '#E9B949' : '#EF7A72';
        return (
          <td style={T.td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...T.badge, background: bg, color: fg }}>{h}</span>
              <span style={{ width: 34, height: 5, borderRadius: 3, background: '#eef0f4', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, h))}%`, background: barra, borderRadius: 3 }} />
              </span>
            </div>
            <div style={{ ...T.sub, color: fg, fontWeight: 700 }}>{alto ? 'Salud alta' : medio ? 'Salud media' : 'En riesgo'}</div>
          </td>
        );
      },
    },
    /* Campos SOLO para "Más filtros" (sin columna visible). */
    { key: 'etapa', label: 'Etapa', ftype: 'select', options: stages.map(s => ({ v: s.key, l: s.label })), val: c => c.pipeline_stage || '' },
    { key: 'vitalicia', label: 'Licencia', ftype: 'select', options: [{ v: 'si', l: 'Vitalicia' }, { v: 'no', l: 'Recurrente' }], val: c => c.vitalicia ? 'si' : 'no' },
    { key: 'cobro', label: 'Cobro', ftype: 'select',
      options: [{ v: 'auto', l: 'Automático (MP)' }, { v: 'manual', l: 'Manual' }, { v: 'rechazo', l: 'Con rechazo' }, { v: 'desfase', l: 'Con desfase' }],
      val: c => c.mp?.rechazos ? 'rechazo' : c.mp?.desfase ? 'desfase' : c.mp?.domiciliadas ? 'auto' : 'manual' },
    { key: 'senal_nivel', label: 'Señal', ftype: 'select', options: [{ v: 'oportunidad', l: 'Oportunidad' }, { v: 'riesgo', l: 'Riesgo' }, { v: '', l: 'Sin señal' }], val: c => c.senal_nivel || '' },
    { key: 'cuenta', label: 'Cuenta SACS', ftype: 'text', val: c => (c.cuentas?.length ? c.cuentas.join(' ') : (c.sacs_account || '')) },
    { key: 'correo', label: 'Correo', ftype: 'text', val: c => c.contacto?.email || '' },
    { key: 'telefono', label: 'Teléfono/WhatsApp', ftype: 'text', val: c => c.contacto?.whatsapp || c.contacto?.telefono || '' },
    { key: 'sin_contacto', label: 'Sin contacto', ftype: 'select', options: [{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }], val: c => c.contacto ? 'no' : 'si' },
    { key: 'subs_activas', label: 'Subs activas', ftype: 'number', val: c => Number(c.subs_activas || 0) },
    { key: 'subs_pendientes', label: 'Subs pendientes', ftype: 'number', val: c => Number(c.subs_pendientes || 0) },
    { key: 'arr_pendiente', label: 'ARR pendiente', ftype: 'number', val: c => Number(c.arr_pendiente || 0) },
    { key: 'pagos_realizados', label: 'Núm. de pagos', ftype: 'number', val: c => Number(c.pagos_realizados || 0) },
    { key: 'dias_sin_venta', label: 'Días sin vender', ftype: 'number', val: c => c.dias_sin_venta == null ? null : Number(c.dias_sin_venta) },
    { key: 'ultima_venta', label: 'Última venta SACS', ftype: 'date', val: c => c.ultima_venta_at || '' },
    // Sucursales: filtrable como NÚMERO a propósito, aunque se capture con
    // lista. Así se puede pedir "5 o más" o "entre 2 y 10", que es la pregunta
    // real; con un filtro de lista habría que ir marcando valor por valor.
    // Sucursales sin render: sigue filtrable, sin gastar una columna.
    { key: 'sucursales', label: 'Sucursales', ftype: 'number',
      val: c => c.sucursales == null ? null : Number(c.sucursales) },

    // ── Campos personalizados ──
    // Se inyectan como columnas normales, y con eso heredan TODO lo que la
    // tabla ya sabe hacer: mostrar/ocultar, ordenar, filtros avanzados y vistas
    // guardadas. Ese reúso es lo que hace que capturar un campo sirva de algo:
    // un dato que no se puede filtrar es un dato que nadie vuelve a mirar.
    ...campos.map((p: any): ColDef => {
      const ftype = ['numero', 'moneda', 'porcentaje'].includes(p.tipo) ? 'number'
        : p.tipo === 'fecha' ? 'date'
        : ['select', 'booleano'].includes(p.tipo) ? 'select'
        : 'text';
      const opciones = p.tipo === 'booleano'
        ? [{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }]
        : p.depende_de
          ? Object.values(p.opciones_por_padre || {}).flat().map((o: any) => ({ v: o.v, l: o.l }))
          : (p.opciones || []).map((o: any) => ({ v: o.v, l: o.l }));
      const crudo = (c: any) => (c.propiedades || {})[p.key];
      const texto = (c: any) => {
        const v = crudo(c);
        if (v === undefined || v === null || v === '') return '';
        if (p.tipo === 'booleano') return v ? 'Sí' : 'No';
        if (p.tipo === 'multiselect') return (Array.isArray(v) ? v : [v]).map((x: any) => opciones.find((o: any) => o.v === x)?.l || x).join(', ');
        if (p.tipo === 'select') return opciones.find((o: any) => o.v === v)?.l || String(v);
        return String(v);
      };
      return {
        key: 'prop_' + p.key, label: p.etiqueta, ftype: ftype as any,
        ...(ftype === 'select' ? { options: opciones } : {}),
        // El filtro compara contra el valor CRUDO (la clave de la opción), no
        // contra la etiqueta: renombrar "Moda" no puede romper una vista guardada.
        val: (c: any) => ftype === 'number' ? (crudo(c) == null ? null : Number(crudo(c)))
          : ftype === 'select' ? (p.tipo === 'booleano' ? (crudo(c) === true ? 'si' : crudo(c) === false ? 'no' : '') : (crudo(c) ?? ''))
          : ftype === 'date' ? (crudo(c) || '')
          : texto(c).toLowerCase(),
        // SIN render a propósito: eran las únicas columnas sin ancho asignado,
        // así que la tabla las aplastaba a cero y sus cinco encabezados se
        // encimaban en un borrón gris. Siguen en "Más filtros" y en la ficha.
      };
    }),
  ];

  // ── Las columnas de un excliente son otras ──
  // A quien ya se fue no le preguntas por su próxima factura ni por su salud:
  // le preguntas cuándo se fue, por qué, cuánto se llevó y cuánto llegó a
  // pagar. Eso es lo que decide si vale la pena intentar recuperarlo.
  const alternarSelEx = (id: string) => setSelEx(s2 => { const n = new Set(s2); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const colsExcliente: ColDef[] = [
    {
      key: 'sel', label: '', width: 38, fija: true, ftype: 'text', val: () => '',
      render: c => (
        <td style={{ ...T.td, width: 38 }} onClick={e => { e.stopPropagation(); alternarSelEx(c.id); }}>
          <input type="checkbox" checked={selEx.has(c.id)} onChange={() => {}} style={{ cursor: 'pointer' }} />
        </td>
      ),
    },
    cols[0], // Cliente, con su cuenta SACS
    {
      key: 'baja_at', label: 'Se fue el', width: 120, ftype: 'date',
      val: c => String(c.baja_at || '').slice(0, 10),
      render: c => <td style={T.td}>{c.baja_at ? fmtDate(String(c.baja_at).slice(0, 10)) : '—'}</td>,
    },
    {
      key: 'baja_motivo', label: 'Por qué se fue', width: 300, ftype: 'text',
      val: c => String(c.baja_motivo || '').toLowerCase(),
      render: c => {
        const m = String(c.baja_motivo || '');
        if (!m) return <td style={{ ...T.td, color: '#c0bece' }}>sin motivo capturado</td>;
        // El formato del CRM es "Etiqueta — detalle": la etiqueta se lee de un
        // vistazo y el detalle explica, sin cortar ninguno de los dos.
        const [crudo, ...resto] = m.split('—');
        // Los motivos viejos se guardaron como slug ('no_uso'): se traducen al
        // vuelo en vez de enseñarle al usuario el nombre interno del campo.
        const et = RAZONES_BAJA.find(([v]) => v === crudo.trim())?.[1] || crudo;
        const det = resto.join('—').trim();
        return (
          <td style={T.td} title={m}>
            <div style={{ fontWeight: 600 }}>{et.trim()}</div>
            {det && <div style={{ fontSize: '0.72rem', color: '#8a8a92', lineHeight: 1.4, maxHeight: 34, overflow: 'hidden' }}>{det}</div>}
          </td>
        );
      },
    },
    {
      key: 'arr_perdido', label: 'ARR que se llevó', width: 130, ftype: 'number', num: true,
      val: c => Number(c.arr_perdido || 0),
      render: c => <td style={{ ...T.td, textAlign: 'right', fontWeight: 700, color: '#C0554E' }}>{money(c.arr_perdido)}</td>,
    },
    {
      key: 'pagado_historico', label: 'Llegó a pagar', width: 130, ftype: 'number', num: true,
      val: c => Number(c.pagado_historico || 0),
      render: c => <td style={{ ...T.td, textAlign: 'right' }}>{money(c.pagado_historico)}</td>,
    },
    {
      key: 'subs_canceladas', label: 'Licencias', width: 90, ftype: 'number', num: true,
      val: c => Number(c.subs_canceladas || 0),
      render: c => <td style={{ ...T.td, textAlign: 'right', color: '#8a8a92' }}>{c.subs_canceladas}</td>,
    },
    {
      key: 'ultima_venta', label: 'Última venta en SACS', width: 160, ftype: 'date',
      val: c => String(c.ultima_venta_at || '').slice(0, 10),
      render: c => <td style={{ ...T.td, color: '#8a8a92' }}>{c.ultima_venta_at ? fmtDate(String(c.ultima_venta_at).slice(0, 10)) : '—'}</td>,
    },
  ];

  // Tres filtros afuera y el resto en "Más filtros". Las etiquetas dicen la
  // DIMENSIÓN, no el valor por omisión: "Todos" no contestaba ninguna pregunta.
  const quick: QuickDef[] = [
    {
      key: 'acompanamiento', label: 'Acompañamiento',
      options: (campos.find((p: any) => p.key === 'tipo_acompanamiento')?.opciones || []).map((o: any) => ({ v: o.v, l: o.l })),
      apply: (c, v) => (c.propiedades || {}).tipo_acompanamiento === v,
    },
    { key: 'plan', label: 'Plan', options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })), apply: (c, v) => c.plan === v },
    { key: 'licencia', label: 'Licencia', options: [{ v: 'si', l: 'Vitalicia' }, { v: 'no', l: 'Recurrente' }], apply: (c, v) => (v === 'si') === !!c.vitalicia },
  ];

  /* Sin pestañas de vistas: abre con TODOS los clientes, de mayor a menor ARR.
   * Antes abría en "Con ARR activo" y mostraba 78 de 218 — los otros 140
   * existían y nada en la pantalla decía que estaban escondidos. */
  const vistasBase: VistaDef[] = [
    { key: 'todos', nombre: 'Todos', config: { sort: { key: 'arr', dir: -1 } } },
  ];

  if (loading) return <Cargando texto="Cargando clientes…" />;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  // Un ícono y un botón, como en Cotizaciones: los secundarios son íconos sin
  // texto y solo la acción principal lleva color. El menú "Más acciones"
  // guardaba herramientas de una sola vez que estorbaban todos los días.
  const cabeceraAcciones = (<>
    <a href="/api/crm/arr/export-clientes" title="Exportar clientes" aria-label="Exportar clientes"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '1px solid #e2e4e9', borderRadius: 10, background: '#fff', color: '#666', textDecoration: 'none', flexShrink: 0 }}>
      <Download size={16} strokeWidth={2} />
    </a>
    <button onClick={() => setShowNuevo(true)} title="Alta completa: cliente + contacto + cuenta SACS + suscripción"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: isMobile ? 44 : 36, flex: isMobile ? 1 : undefined, minWidth: 0, padding: '0 16px', border: 'none', borderRadius: 10, background: CL.violeta, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.10)', whiteSpace: 'nowrap' }}>
      <Plus size={15} strokeWidth={2.5} /> Nuevo cliente
    </button>
  </>);

  return (
    // Mismo contenedor que Cotizaciones: sin esto la tabla se estira de orilla a
    // orilla del monitor y las dos pantallas del mismo módulo se ven de sistemas
    // distintos.
    <div style={WRAP}>
      <style>{`
        .ct360 tbody tr { transition: background .12s ease; }
        .ct360 tbody tr:hover td { background: #f7f9fc; }
        .ct360 .ct-pencil { opacity: 0; transition: opacity .15s ease; }
        .ct360 tbody tr:hover .ct-pencil, .ct360 .ct-pencil:focus { opacity: .65; }
      `}</style>

      {/* ══ Pantalla MÓVIL v5 (mockup Clientes): cabecera + búsqueda fija +
          chips (Activos / Riesgo / ARR orden) + filas avatar·nombre·plan·ARR
          con la excepción en color (vencida en rojo, salud baja en ámbar).
          El chrome de escritorio —KPIs, exclientes, TablaEnterprise— no
          existe en el teléfono: la referencia manda. ══ */}
      {isMobile && (() => {
        const hoyIso = new Date().toISOString().slice(0, 10);
        const enRiesgo = (c: any) => (c.proxima_factura && c.proxima_factura < hoyIso)
          || (c.health_score != null && Number(c.health_score) < 60)
          || c.senal_nivel === 'riesgo';
        const t = buscaM.trim().toLowerCase();
        let listaM = clientes.filter((c: any) => !t
          || [c.nombre_comercial, c.nombre, ...(c.cuentas || [c.sacs_account]), c.contacto?.nombre, c.contacto?.email]
            .filter(Boolean).join(' ').toLowerCase().includes(t));
        const nActivos = listaM.length;
        const nRiesgo = listaM.filter(enRiesgo).length;
        if (chipCl === 'riesgo') listaM = listaM.filter(enRiesgo);
        listaM = [...listaM].sort((a: any, b: any) => (arrAsc ? 1 : -1) * (Number(a.arr || 0) - Number(b.arr || 0)));
        const iniciales = (n: string) => {
          const stop = ['de', 'del', 'la', 'los', 'las', 'para', 'y', 'e'];
          const ws = String(n || '').split(/\s+/).filter(w => w && !stop.includes(w.toLowerCase()));
          return (ws.length >= 2 ? ws[0][0] + ws[1][0] : String(n || '??').slice(0, 2)).toUpperCase();
        };
        return (
          <div className="m-bleed">
            <div className="m-hdr">
              <div className="m-tt">Clientes</div>
              <button className="m-cta" onClick={() => setShowNuevo(true)}>＋ Nuevo</button>
            </div>
            <div style={{ margin: '4px 24px 12px', position: 'relative' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a98a4" strokeWidth="2" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={buscaM} onChange={e => setBuscaM(e.target.value)} placeholder="Nombre, cuenta o contacto"
                style={{ width: '100%', height: 44, border: 'none', borderRadius: 10, padding: '0 12px 0 38px', fontSize: '1rem', background: '#f2f2f5', fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div className="m-chips">
              <button className={'m-chip' + (chipCl === 'activos' ? ' on' : '')} onClick={() => setChipCl('activos')}>
                Activos{chipCl === 'activos' ? ' ' + nActivos : ''}
              </button>
              <button className={'m-chip' + (chipCl === 'riesgo' ? ' on' : '')} onClick={() => setChipCl('riesgo')}>
                Riesgo{chipCl === 'riesgo' ? ' ' + nRiesgo : ''}
              </button>
              <button className="m-chip" onClick={() => setArrAsc(v => !v)}>
                ARR {arrAsc ? '↑' : '↓'}
              </button>
            </div>
            <div>
              {/* Tres vacíos distintos, no uno. «Nadie en riesgo» es BUENA
                  noticia y no lleva botón —no hay nada que arreglar—; una
                  búsqueda sin resultados sí, porque la causa es un filtro que
                  uno puso y en el teléfono no hay panel a la vista para
                  deshacerlo. Antes los tres eran el mismo renglón gris. */}
              {listaM.length === 0 && (
                chipCl === 'riesgo' ? (
                  <EstadoVacio tono="bien" titulo="Nadie en riesgo"
                    pista="Ninguna cuenta con pagos vencidos ni señales de baja. Es la buena noticia del día." />
                ) : buscaM.trim() ? (
                  <EstadoVacio titulo={`Sin resultados para “${buscaM.trim()}”`}
                    pista="Se busca por nombre comercial, razón social, cuenta de SACS y datos del contacto."
                    accion="Quitar la búsqueda" onAccion={() => setBuscaM('')} />
                ) : (
                  <EstadoVacio titulo="Todavía no hay clientes"
                    pista="Cuando ganes una oportunidad, el cliente aparece aquí con su plan y su cuenta de SACS." />
                )
              )}
              {listaM.slice(0, visMovil).map((c: any) => {
                // Solo presentación (lección de Leads): "Super carnes rivera" rompe el ritmo.
                const crudo = c.nombre_comercial || c.sacs_account || c.nombre || 'Sin nombre';
                const nombre = crudo.replace(/\S+/g, (w: string) => w[0].toUpperCase() + (w.length > 2 && w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1)));
                const planL = c.plan && PLAN_BADGE[c.plan]
                  ? 'Plan ' + PLAN_BADGE[c.plan].label.replace(/\S+/g, (w: string) => w[0].toUpperCase() + w.slice(1))
                  : 'Sin plan';
                const vDias = c.proxima_factura && c.proxima_factura < hoyIso
                  ? Math.max(1, Math.floor((Date.parse(hoyIso) - Date.parse(String(c.proxima_factura).slice(0, 10))) / 86400000)) : 0;
                const salud = c.health_score == null ? null : Number(c.health_score);
                return (
                  <FilaDeslizable key={c.id}
                    izquierda={{
                      etiqueta: 'Archivado', color: '#C0554E', fondo: '#FEF0EF',
                      onAccion: async () => {
                        // Archivar, NUNCA borrar. Una empresa tiene 57 llaves
                        // foráneas colgando —suscripciones, pagos, cotizaciones,
                        // conversaciones—: borrarla de verdad se lleva el
                        // historial de dinero de ese cliente. Archivada
                        // desaparece de la lista y se puede devolver.
                        await fetch('/api/crm/companies', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: c.id, archived_at: new Date().toISOString() }),
                        }).catch(() => {});
                        load();
                      },
                    }}>
                  <div className="m-row" onClick={() => setRapida(c)}>
                    <div className="m-ini">{iniciales(nombre)}</div>
                    <div className="m-tx">
                      <div className="m-n1">{nombre}</div>
                      <div className="m-n2">{planL}</div>
                    </div>
                    <div className="m-fin">
                      <div className="m-m1">{c.vitalicia ? 'Vitalicia' : money(c.arr)}</div>
                      {vDias > 0
                        ? <div className="m-m2" style={{ color: '#C0554E' }}>vencida {vDias === 1 ? '1 día' : vDias + ' días'}</div>
                        : (salud != null && salud < 60
                          ? <div className="m-m2" style={{ color: '#a06600' }}>salud {salud}</div>
                          : null)}
                    </div>
                  </div>
                  </FilaDeslizable>
                );
              })}
              <div ref={finListaRef} style={{ height: 1 }} />
            </div>
          </div>
        );
      })()}

      {!isMobile && (<>
      {/* Encabezado: título y acciones ARRIBA, y debajo los KPIs. Los botones
          vivían dentro de la barra de la tabla, junto al buscador, así que
          "Nuevo cliente" competía con un campo de texto en vez de encabezar la
          pantalla. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Clientes</h1>
          <div style={{ fontSize: '0.75rem', color: '#9c99a6', marginTop: 2 }}>
            {verExclientes
              ? <>{tot?.exclientes ?? 0} exclientes · {money(tot?.arr_perdido)} de ARR perdido</>
              : <>{tot?.clientes ?? 0} clientes · {tot?.activos ?? 0} con ARR activo</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{cabeceraAcciones}</div>
      </div>

      {/* KPIs: en móvil carrusel scroll-snap (1 visible + peek → no gasta pantalla
          y se ve claro que se desliza); en desktop, grid multi-columna. */}
      <div style={isMobile
        ? { display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', marginBottom: 16, paddingBottom: 4, marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }
        : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 18 }}>
        {(() => { const kStyle = isMobile ? { minWidth: '82vw', scrollSnapAlign: 'start' as const, flexShrink: 0 } : undefined; return (<>
        <KpiCard style={kStyle} franja={CL.violeta} label="Clientes" value={tot?.clientes ?? '—'}
          sub={<>{tot?.activos ?? 0} con ARR activo · {Math.max(0, (tot?.clientes || 0) - (tot?.activos || 0))} sin ARR</>}
          onClick={verExclientes ? () => setVerExclientes(false) : undefined} />
        <KpiCard style={kStyle} franja={CL.verde} label="ARR" value={money(tot?.arr)} valueColor={CL.verdeTinta}
          sub={kpis.arrPend > 0 ? <>{money(kpis.arrPend)} pendiente de activar</> : 'todo activo'} />
        <KpiCard style={kStyle} franja={CL.rojo} label="Requieren atención" value={kpis.riesgo + kpis.vencidas} valueColor={CL.rojoTinta}
          sub={<>{kpis.riesgo} sin vender 3+ días · {kpis.vencidas} con renovación vencida</>} />
        <KpiCard style={kStyle} franja={CL.azul} label="Licencias vitalicias" value={tot?.vitalicias ?? 0}
          sub={<>{money(tot?.vitalicias_pagado)} cobrado · fuera del ARR</>} />
        {/* La tarjeta de EXCLIENTES se retiró de aquí (3-sep-2026): esta
            pantalla es de los clientes que se tienen, y una tarjeta roja con
            ARR perdido en la misma fila que el ARR activo hacía leer las dos
            cifras juntas cuando son mundos distintos.

            La lista NO se borra —dentro está la captura de por qué se fue cada
            uno, y ese trabajo existe— pero baja a una liga discreta: quien
            entra a Clientes viene a ver a los que están. */}
        </>); })()}
      </div>

      {(tot?.exclientes ?? 0) > 0 && !verExclientes && (
        <div style={{ marginBottom: 14, fontSize: 12.5, color: '#6b6580' }}>
          <button onClick={() => { setVerExclientes(true); setSelEx(new Set()); }}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#5B4BD6', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Ver los {tot?.exclientes} exclientes
          </button>
          <span> · {money(tot?.arr_perdido)} de ARR perdido</span>
        </div>
      )}

      {verExclientes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#FEF0EF', border: '1px solid #f7d9d6', borderRadius: 11, padding: '11px 14px', marginBottom: 14 }}>
          <b style={{ fontSize: '0.82rem', color: '#8c2f28' }}>Estás viendo exclientes</b>
          <span style={{ fontSize: '0.78rem', color: '#C0554E' }}>
            Cancelaron todas sus licencias. No cuentan como clientes ni suman al ARR — su historia se conserva para intentar recuperarlos.
          </span>
          <button onClick={() => { setVerExclientes(false); setSelEx(new Set()); }}
            style={{ marginLeft: 'auto', border: '1px solid #f0c4c0', background: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, color: '#8c2f28', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            ← Volver a clientes
          </button>
        </div>
      )}

      {/* ── Captura en lote del motivo de baja ──
          17 de los 35 se fueron sin motivo. Uno por uno —abrir la ficha, abrir
          cada licencia— es la razón por la que nunca se captura. */}
      {verExclientes && (() => {
        const sinMotivo = exclientes.filter((c: any) => !c.baja_motivo);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: selEx.size ? '#EEECFE' : '#fbfaff', border: `1px solid ${selEx.size ? '#ddd6fb' : '#eeecf3'}`, borderRadius: 11, padding: '10px 14px', marginBottom: 14 }}>
            {selEx.size > 0 ? (
              <>
                <b style={{ fontSize: '0.82rem', color: '#5B4BD6' }}>{selEx.size} seleccionado{selEx.size === 1 ? '' : 's'}</b>
                <button onClick={() => setMotivoMasivo(true)}
                  style={{ border: 'none', background: '#C0554E', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Capturar por qué se fueron
                </button>
                <button onClick={() => setSelEx(new Set())}
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#7a6fc9', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Quitar selección</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.79rem', color: '#7a7684' }}>
                  Palomea varios para capturar de un jalón por qué se fueron.
                  {sinMotivo.length > 0 && <> Hoy hay <b style={{ color: '#C0554E' }}>{sinMotivo.length} sin motivo</b>.</>}
                </span>
                {sinMotivo.length > 0 && (
                  <button onClick={() => setSelEx(new Set(sinMotivo.map((c: any) => c.id)))}
                    style={{ marginLeft: 'auto', border: '1px solid #ddd6fb', background: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.76rem', fontWeight: 700, color: '#5B4BD6', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Seleccionar los {sinMotivo.length} sin motivo
                  </button>
                )}
              </>
            )}
          </div>
        );
      })()}

      <div style={{ ...S.card, padding: '20px 22px', borderRadius: 14, border: '1px solid #e9eaee', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
        <TablaEnterprise
          key={verExclientes ? 'exclientes' : 'clientes'}
          tabla={verExclientes ? 'exclientes' : 'clientes'}
          data={dataEtiquetada}
          cols={verExclientes ? colsExcliente : cols}
          quick={verExclientes ? [] : quick}
          vistasBase={vistasBase}
          sinVistas
          quickExtra={verExclientes ? undefined : <FiltroRenovacion valor={rangoRenov} onCambio={setRangoRenov} />}
          searchText={c => [c.nombre_comercial, c.nombre, ...(c.cuentas || [c.sacs_account]), c.contacto?.nombre, c.contacto?.email, c.contacto?.whatsapp].filter(Boolean).join(' ')}
          searchPlaceholder={verExclientes ? 'Buscar excliente, cuenta o motivo…' : 'Buscar cliente, cuenta o contacto…'}
          minWidth={verExclientes ? 1000 : 1400}
          headerTint
          onRowClick={c => { if (editId !== c.id) setDetailId(c.id); }}
          mobileCard={(c: any) => (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre_comercial || c.sacs_account || c.nombre}</div>
                  {(() => { const cs: string[] = c.cuentas?.length ? c.cuentas : (c.sacs_account ? [c.sacs_account] : []); return cs.length ? <div style={{ fontSize: '0.74rem', color: '#8a8f98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cs.join(' · ')}{cs.length > 1 ? ` (${cs.length} cuentas)` : ''}</div> : null; })()}
                </div>
                {c.health_score != null && <HealthScoreBadge score={c.health_score} factors={c.health_factors} size="sm" />}
                <span style={{ color: '#c4c8cf', fontSize: '1.1rem' }}>›</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{c.vitalicia ? <span style={{ ...T.badge, background: '#f1effd', color: '#6C5CE7' }}>Vitalicia</span> : `${money(c.arr)} ARR`}</span>
                {c.plan && PLAN_BADGE[c.plan] && <span style={{ ...T.badge, background: PLAN_BADGE[c.plan].bg, color: PLAN_BADGE[c.plan].color }}>{PLAN_BADGE[c.plan].label}</span>}
                {(() => { const e = ESTADO_SUB(c); return <span style={{ ...T.badge, background: e.bg, color: e.color }}>{e.label}</span>; })()}
                {c.proxima_factura && <span style={{ fontSize: '0.72rem', color: c.proxima_factura < new Date().toISOString().slice(0, 10) ? '#b93333' : '#9aa0a8' }}>renov {fmtDate(c.proxima_factura)}</span>}
                {c.senal_tipo && <span style={{ ...T.badge, background: c.senal_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.senal_nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{SENAL_LABEL[c.senal_tipo] || c.senal_tipo}</span>}
              </div>
              {/* Contacto + edición inline (targets ≥44px) */}
              <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                {editId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="correo@…" style={{ ...S.input, height: 44 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={eWa} onChange={e => setEWa(e.target.value)} placeholder="+52…" style={{ ...S.input, height: 44, flex: 1, minWidth: 0 }} />
                      <button disabled={saving} onClick={() => saveEdit(c)} style={{ ...S.btnSmall, minWidth: 44, height: 44, color: '#1A8F7A', fontWeight: 800 }}>{saving ? '…' : '✓'}</button>
                      <button onClick={() => setEditId(null)} style={{ ...S.btnSmall, minWidth: 44, height: 44 }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.76rem', color: c.contacto?.email ? '#666' : '#c62828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.contacto?.email || c.contacto?.whatsapp || (c.contacto ? '—' : 'sin contacto')}
                    </span>
                    {c.contacto?.whatsapp && (
                      <a href={`https://wa.me/${String(c.contacto.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="WhatsApp"
                        style={{ ...S.btnSmall, minWidth: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#1A8F7A', borderColor: '#bfe8df' }}>💬</a>
                    )}
                    {c.contacto?.whatsapp && (
                      <a href={`tel:${String(c.contacto.whatsapp).replace(/[^\d+]/g, '')}`} onClick={e => e.stopPropagation()} title="Llamar"
                        style={{ ...S.btnSmall, minWidth: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>📞</a>
                    )}
                    <button onClick={e => { e.stopPropagation(); startEdit(c); }} title="Editar contacto" style={{ ...S.btnSmall, minWidth: 44, height: 44 }}>✏️</button>
                  </div>
                )}
              </div>
            </div>
          )}
          customBody={modo === 'kanban' ? ((rows: any[]) => (
            stages.length === 0
              ? <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Configura las etapas del pipeline de Clientes en <b>Configuración → Pipelines</b>.</div>
              : <Suspense fallback={<Cargando texto="Cargando pipeline…" />}><PipelineKanban
                  stages={stages}
                  items={rows}
                  getId={(c: any) => c.id}
                  getStage={(c: any) => c.pipeline_stage || stages[0]?.key}
                  colValue={(its: any[]) => money(its.reduce((s, c) => s + Number(c.arr || 0), 0)) + ' ARR'}
                  onMove={(id, key) => setStage(id, key)}
                  renderCard={(c: any) => (
                    <div onClick={() => setDetailId(c.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{c.sacs_account || c.nombre}</div>
                      {c.contacto?.nombre ? <div style={{ fontSize: '0.72rem', color: '#999' }}>{c.contacto.nombre}</div> : null}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{money(c.arr)}</span>
                        {c.plan && PLAN_BADGE[c.plan] ? <span style={{ ...T.badge, background: PLAN_BADGE[c.plan].bg, color: PLAN_BADGE[c.plan].color }}>{PLAN_BADGE[c.plan].label}</span> : null}
                      </div>
                    </div>
                  )}
                /></Suspense>
          )) : null}

        />
      </div>
      </>)}

      {rapida && (() => {
        const c = rapida;
        const cased = (t: string) => String(t || '').replace(/\S+/g, w => w[0].toUpperCase() + (w.length > 2 && w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1)));
        const nombre = cased(c.nombre_comercial || c.sacs_account || c.nombre || 'Cliente');
        const hoyIso = new Date().toISOString().slice(0, 10);
        const vencida = c.proxima_factura && String(c.proxima_factura).slice(0, 10) < hoyIso;
        const salud = c.health_score == null ? null : Number(c.health_score);
        const tel = c.contacto?.whatsapp || c.contacto?.telefono;
        const acciones = [
          tel ? { label: 'WhatsApp', primaria: true, href: 'https://wa.me/' + String(tel).replace(/\D/g, '') } : null,
          tel ? { label: 'Llamar', href: 'tel:' + String(tel).replace(/[^\d+]/g, '') } : null,
          c.contacto?.email ? { label: 'Correo', href: 'mailto:' + c.contacto.email } : null,
        ].filter(Boolean) as any[];
        if (!acciones.length) acciones.push({ label: 'Abrir ficha', primaria: true, onClick: () => { setRapida(null); setDetailId(c.id); } });
        return (
          <VistaRapida abierta onCerrar={() => setRapida(null)} onVerTodo={() => { setRapida(null); setDetailId(c.id); }}
            nombre={nombre}
            estado={vencida ? 'vencida' : salud != null && salud < 60 ? `salud ${salud}` : salud != null ? 'saludable' : undefined}
            estadoTono={vencida ? 'rojo' : salud != null && salud < 60 ? 'ambar' : salud != null ? 'verde' : undefined}
            contexto={[c.plan && PLAN_BADGE[c.plan] ? 'Plan ' + PLAN_BADGE[c.plan].label : null, c.proxima_factura ? 'renueva ' + fmtDate(c.proxima_factura) : null].filter(Boolean).join(' · ') || c.sacs_account}
            heroLabel="ARR" heroValor={c.vitalicia ? 'Vitalicia' : money(c.arr)}
            heroLectura={<>{vencida ? <span style={{ color: '#C0554E', fontWeight: 700 }}>renovación vencida</span> : 'al corriente'}{salud != null ? <> · <b style={{ color: salud < 60 ? '#a06600' : '#1E8A63' }}>salud {salud}</b></> : null}</>}
            acciones={acciones}
            claves={[
              { k: 'Cuenta SACS', v: (c.cuentas || [c.sacs_account]).filter(Boolean).join(' · ') || '—' },
              { k: 'Contacto', v: c.contacto?.nombre || c.contacto?.email || 'sin contacto', tono: c.contacto ? undefined : 'rojo' as const },
              { k: 'Próxima factura', v: c.proxima_factura ? fmtDate(c.proxima_factura) : '—', tono: vencida ? 'rojo' as const : undefined },
            ]}
            verTodoLabel="Ver ficha completa ›"
            ficha={isMobile ? (
              <Suspense fallback={<HojaEsqueleto />}>
                <ClienteDrawer360 companyId={c.id} embebido onClose={() => setRapida(null)} onChanged={load} />
              </Suspense>
            ) : undefined} />
        );
      })()}
      {detailId && <Suspense fallback={<Cargando texto="Cargando cliente…" alto={260} />}><ClienteDrawer360 companyId={detailId} tabInicial={detailTab} onClose={() => { setDetailId(null); setDetailTab(undefined); }} onChanged={load} /></Suspense>}

      {motivoMasivo && (
        <MotivoBajaMasivo ids={Array.from(selEx)}
          onCerrar={() => setMotivoMasivo(false)}
          onListo={(msg) => {
            setMotivoMasivo(false); setSelEx(new Set());
            setAvisoEx(msg); setTimeout(() => setAvisoEx(''), 6000);
            load();
          }} />
      )}
      {avisoEx && (
        <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 1200, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{avisoEx}</div>
      )}
      {showNuevo && <Suspense fallback={<Cargando texto="Abriendo…" alto={200} />}><NuevoClienteModal onClose={() => setShowNuevo(false)} onCreated={(id) => { setShowNuevo(false); load(); if (id) setDetailId(id); }} /></Suspense>}
      <Toast toast={toast} />
    </div>
  );
}
