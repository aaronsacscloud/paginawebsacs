import { useEffect, useMemo, useState } from 'react';
import { useCampos } from './CamposPersonalizados';
import { Users, TrendingUp, Wallet, AlertTriangle, Plus, ChevronDown, Link2, MessageCircle, Download, Settings2, LayoutGrid, Table2, Building2, Infinity as InfinityIcon } from 'lucide-react';
import { S } from './SubscriptionsTab';
import ClienteDrawer360 from './ClienteDrawer360';
import NuevoClienteModal from './NuevoClienteModal';
import PipelineKanban from './PipelineKanban';
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import NombresEmpresaModal from './NombresEmpresaModal';
import { useToast, Toast, logStageChange } from './crmHelpers';
import EnriquecerWhatsApp from './EnriquecerWhatsApp';
import RevisarRelaciones from './RevisarRelaciones';
import { SENAL_LABEL } from '../../../lib/crm/senales';
import { useIsMobile } from '../../../lib/ui/mobile';
import HealthScoreBadge from './HealthScoreBadge';

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
function KpiCard({ franja, label, value, valueColor, sub, style }: { franja: string; label: string; value: any; valueColor?: string; sub: any; style?: any }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ececf0', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '13px 15px', ...style }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: '#9c99a6' }}>{label}</div>
      <div style={{ fontSize: '1.32rem', fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', color: valueColor || '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: '0.66rem', color: '#a5a2af', marginTop: 3, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

export default function ClientesTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { props: campos } = useCampos('company');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [modo, setModo] = useState<'tabla' | 'kanban'>('tabla');
  const [stages, setStages] = useState<{ key: string; label: string; color: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNombres, setShowNombres] = useState(false);
  const isMobile = useIsMobile();
  const { toast, show } = useToast();

  // Cierra "Más acciones" con click fuera o Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onClick = () => setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick); };
  }, [menuOpen]);

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
    setLoading(true); setError(null);
    try {
      const [j, pj] = await Promise.all([
        fetch('/api/crm/arr/clientes').then(r => r.json()),
        fetch('/api/crm/pipelines').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      if (j.error) throw new Error(j.error);
      setData(j.data || []); setTot(j.tot || null);
      const cli = (pj.data || []).find((p: any) => p.tipo === 'cliente');
      setStages(cli?.stages || []);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
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
  const dataEtiquetada = data;

  const cols: ColDef[] = [
    {
      key: 'cliente', label: 'Cliente', width: 188, fija: true, ftype: 'text',
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
      key: 'contacto', label: 'Contacto', width: 116, ftype: 'text',
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
      key: 'datos_contacto', label: 'Datos de contacto', width: 174, ftype: 'text',
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
      key: 'plan', label: 'Plan', width: 104, ftype: 'select',
      options: Object.entries(PLAN_BADGE).map(([v, b]) => ({ v, l: b.label })),
      val: c => c.plan || '',
      // Solo el tipo de suscripción. El estado de la cuenta vivía pegado abajo
      // y las dos etiquetas juntas hacían que no se leyera ninguna; se filtra
      // por estado desde los filtros, que es donde sirve.
      render: c => {
        const b = PLAN_BADGE[c.plan] || null;
        return (
          <td style={{ ...T.td, ...T.ell }}>
            {b ? <span style={{ ...T.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}
          </td>
        );
      },
    },
    {
      key: 'renovacion', label: 'Renovación', width: 98, ftype: 'date', val: c => c.proxima_factura || '',
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
      key: 'estado_pago', label: 'Estado de pago', width: 116, ftype: 'select',
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
      key: 'arr', label: 'ARR', width: 100, num: true, ftype: 'number', val: c => Number(c.arr || 0),
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
      key: 'pagado', label: 'Pagado', width: 94, num: true, ftype: 'number', val: c => Number(c.total_pagado || 0),
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
      key: 'actividad', label: 'Actividad', width: 104, ftype: 'number',
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
      key: 'ventas30', label: 'Ventas 30d', width: 106, num: true, ftype: 'number', val: c => Number(c.total_30d || 0),
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
      key: 'salud', label: 'Salud', width: 112, ftype: 'number',
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
    {
      // Cómo se le cobra. En la lista y no solo en la ficha: es lo que contesta
      // "¿a cuántos les cobro a mano?" sin abrir 218 clientes uno por uno.
      key: 'cobro', label: 'Cobro', width: 88, ftype: 'select',
      options: [{ v: 'auto', l: 'Automático (MP)' }, { v: 'manual', l: 'Manual' }, { v: 'rechazo', l: 'Con rechazo' }, { v: 'desfase', l: 'Con desfase' }],
      val: c => c.mp?.rechazos ? 'rechazo' : c.mp?.desfase ? 'desfase' : c.mp?.domiciliadas ? 'auto' : 'manual',
      render: c => {
        const m = c.mp || {};
        return (
          <td style={T.td}>
            {m.domiciliadas ? (
              <span style={{ ...T.badge, background: 'rgba(42,181,160,.15)', color: '#1A8F7A' }}
                title={'Se le cobra solo por Mercado Pago' + (m.correo ? ' · paga ' + m.correo : '') + (m.manuales ? ` · ${m.manuales} más a mano` : '')}>
                auto{m.manuales ? ` +${m.manuales}` : ''}
              </span>
            ) : <span style={{ fontSize: '0.72rem', color: '#c4c8cf' }} title="No tiene ninguna suscripción domiciliada">manual</span>}
            {m.rechazos ? (
              <div style={{ fontSize: '0.66rem', color: '#E54B4B', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}
                title={`${m.rechazos} cobros rechazados en 60 días por ${money(m.rechazo_monto)}${m.rechazo_ultimo ? ' · último ' + m.rechazo_ultimo : ''}`}>
                ⚠ {m.rechazos} rechazo{m.rechazos > 1 ? 's' : ''}
              </div>
            ) : null}
            {m.desfase ? (
              <div style={{ fontSize: '0.66rem', color: '#E54B4B', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}
                title="Mercado Pago cobra un monto distinto al de su suscripción: el ARR de este cliente está mal.">
                ⚠ desfase
              </div>
            ) : null}
          </td>
        );
      },
    },
    {
      key: 'senal', label: 'Señal', width: 100, ftype: 'select',
      options: Object.keys(SENAL_LABEL).map(t => ({ v: t, l: SENAL_LABEL[t] })),
      val: c => c.senal_peso || 0,     // ordena por urgencia/valor
      render: c => (
        <td style={T.td}>
          {c.senal_tipo ? (
            <span title={c.senal_titulo || ''} style={{ ...T.badge, display: 'inline-flex', alignItems: 'center', background: c.senal_nivel === 'riesgo' ? '#fdecea' : '#e6f6f2', color: c.senal_nivel === 'riesgo' ? '#b93333' : '#1A8F7A', maxWidth: '100%', overflow: 'hidden' }}>
              <span style={{ ...T.ell }}>{SENAL_LABEL[c.senal_tipo] || c.senal_tipo}</span>
            </span>
          ) : <span style={{ color: '#c4c8cf' }}>—</span>}
        </td>
      ),
    },
    /* Campos SOLO para "Más filtros" (sin columna visible). */
    { key: 'etapa', label: 'Etapa', ftype: 'select', options: stages.map(s => ({ v: s.key, l: s.label })), val: c => c.pipeline_stage || '' },
    { key: 'vitalicia', label: 'Licencia', ftype: 'select', options: [{ v: 'si', l: 'Vitalicia' }, { v: 'no', l: 'Recurrente' }], val: c => c.vitalicia ? 'si' : 'no' },
    { key: 'senal_nivel', label: 'Señal (nivel)', ftype: 'select', options: [{ v: 'oportunidad', l: 'Oportunidad' }, { v: 'riesgo', l: 'Riesgo' }, { v: '', l: 'Sin señal' }], val: c => c.senal_nivel || '' },
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
    { key: 'sucursales', label: 'Sucursales', ftype: 'number',
      val: c => c.sucursales == null ? null : Number(c.sucursales),
      render: c => <td style={T.td}>{c.sucursales == null ? <span style={{ color: '#ddd' }}>—</span> : (Number(c.sucursales) > 50 ? `Más de 50 (${c.sucursales})` : c.sucursales)}</td> },

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
        render: (c: any) => <td style={{ ...T.td, ...T.ell }} title={texto(c) || undefined}>{texto(c) || <span style={{ color: '#ddd' }}>—</span>}</td>,
      };
    }),
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

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando clientes reales…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  const cabeceraAcciones = (<>
            <button onClick={() => setShowNuevo(true)} title="Alta completa: cliente + contacto + cuenta SACS + suscripción"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: isMobile ? 44 : 36, flex: isMobile ? 1 : undefined, minWidth: 0, padding: '0 16px', border: 'none', borderRadius: 10, background: CL.violeta, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.10)', whiteSpace: 'nowrap' }}>
              <Plus size={15} strokeWidth={2.5} /> Nuevo cliente
            </button>
            <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: isMobile ? 44 : 36, padding: isMobile ? '0 12px' : '0 14px', border: '1px solid #e2e4e9', borderRadius: 10, background: menuOpen ? '#f7f8fa' : '#fff', color: '#333', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {isMobile ? 'Más' : 'Más acciones'} <ChevronDown size={14} strokeWidth={2} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {menuOpen && isMobile && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 949 }} />}
              {menuOpen && (
                <div style={isMobile
                  ? { position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.18)', padding: '8px 8px calc(12px + env(safe-area-inset-bottom))', zIndex: 950 }
                  : { position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 236, background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, boxShadow: '0 4px 6px -2px rgba(16,24,40,0.05), 0 12px 24px -4px rgba(16,24,40,0.12)', padding: 6, zIndex: 50 }}>
                  <RevisarRelaciones onDone={() => { setMenuOpen(false); load(); }} trigger={open => (
                    <button className="te-item" style={T.menuItem} onClick={open}><Link2 size={15} color="#8a8f98" /> Revisar relaciones</button>
                  )} />
                  {/* Nombres de empresa: 40 de las 83 cuentas quedaron con el
                      slug capitalizado porque no son palabras separables. Aquí
                      se escriben todas de corrido en vez de entrar a 40 fichas. */}
                  <button className="te-item" style={T.menuItem} onClick={() => { setMenuOpen(false); setShowNombres(true); }}>
                    <Building2 size={15} color="#8a8f98" /> Nombres de las empresas
                  </button>
                  <EnriquecerWhatsApp onDone={() => { setMenuOpen(false); load(); }} trigger={open => (
                    <button className="te-item" style={T.menuItem} onClick={open}><MessageCircle size={15} color="#8a8f98" /> Enriquecer WhatsApp</button>
                  )} />
                  <div style={{ height: 1, background: '#f1f2f5', margin: '6px 4px' }} />
                  <a className="te-item" style={T.menuItem} href="/api/crm/arr/export-clientes" onClick={() => setMenuOpen(false)}><Download size={15} color="#8a8f98" /> Exportar clientes</a>
                  <div style={{ height: 1, background: '#f1f2f5', margin: '6px 4px' }} />
                  <button className="te-item" style={T.menuItem} onClick={() => { setMenuOpen(false); onConfig?.(); }}><Settings2 size={15} color="#8a8f98" /> Configurar etapas</button>
                  <button className="te-item" style={T.menuItem} onClick={() => { setMenuOpen(false); setModo(m => m === 'tabla' ? 'kanban' : 'tabla'); }}>
                    {modo === 'tabla' ? <LayoutGrid size={15} color="#8a8f98" /> : <Table2 size={15} color="#8a8f98" />}
                    {modo === 'tabla' ? 'Ver como Kanban' : 'Ver como Tabla'}
                  </button>
                </div>
              )}
            </div>
</>);

  return (
    // Mismo contenedor que Cotizaciones: sin esto la tabla se estira de orilla a
    // orilla del monitor y las dos pantallas del mismo módulo se ven de sistemas
    // distintos.
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
      <style>{`
        .ct360 tbody tr { transition: background .12s ease; }
        .ct360 tbody tr:hover td { background: #f7f9fc; }
        .ct360 .ct-pencil { opacity: 0; transition: opacity .15s ease; }
        .ct360 tbody tr:hover .ct-pencil, .ct360 .ct-pencil:focus { opacity: .65; }
      `}</style>

      {/* Encabezado: título y acciones ARRIBA, y debajo los KPIs. Los botones
          vivían dentro de la barra de la tabla, junto al buscador, así que
          "Nuevo cliente" competía con un campo de texto en vez de encabezar la
          pantalla. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Clientes</h1>
          <div style={{ fontSize: '0.75rem', color: '#9c99a6', marginTop: 2 }}>
            {tot?.clientes ?? 0} totales · {tot?.activos ?? 0} con ARR activo
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
          sub={<>{tot?.activos ?? 0} con ARR activo · {Math.max(0, (tot?.clientes || 0) - (tot?.activos || 0))} sin ARR</>} />
        <KpiCard style={kStyle} franja={CL.verde} label="ARR" value={money(tot?.arr)} valueColor={CL.verdeTinta}
          sub={kpis.arrPend > 0 ? <>{money(kpis.arrPend)} pendiente de activar</> : 'todo activo'} />
        <KpiCard style={kStyle} franja={CL.rojo} label="Requieren atención" value={kpis.riesgo + kpis.vencidas} valueColor={CL.rojoTinta}
          sub={<>{kpis.riesgo} sin vender 3+ días · {kpis.vencidas} con renovación vencida</>} />
        <KpiCard style={kStyle} franja={CL.azul} label="Licencias vitalicias" value={tot?.vitalicias ?? 0}
          sub={<>{money(tot?.vitalicias_pagado)} cobrado · fuera del ARR</>} />
        </>); })()}
      </div>

      <div style={{ ...S.card, padding: '20px 22px', borderRadius: 14, border: '1px solid #e9eaee', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
        <TablaEnterprise
          tabla="clientes"
          data={dataEtiquetada}
          cols={cols}
          quick={quick}
          vistasBase={vistasBase}
          sinVistas
          searchText={c => [c.nombre_comercial, c.nombre, ...(c.cuentas || [c.sacs_account]), c.contacto?.nombre, c.contacto?.email, c.contacto?.whatsapp].filter(Boolean).join(' ')}
          searchPlaceholder="Buscar cliente, cuenta o contacto…"
          minWidth={1500}
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
              : <PipelineKanban
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
                />
          )) : null}

        />
      </div>

      {detailId && <ClienteDrawer360 companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      {showNuevo && <NuevoClienteModal onClose={() => setShowNuevo(false)} onCreated={(id) => { setShowNuevo(false); load(); if (id) setDetailId(id); }} />}
      {showNombres && <NombresEmpresaModal onCerrar={() => setShowNombres(false)} onGuardado={load} />}
      <Toast toast={toast} />
    </div>
  );
}
