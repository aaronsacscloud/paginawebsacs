import { useEffect, useState } from 'react';
import { computarSenales } from '../../../lib/crm/senales';

/* ═══ Cliente 360 — drawer ancho con pestañas, TODO editable ═══
 * Pestañas: Resumen · Cliente & SACS · Contactos · Suscripciones · Actividad.
 * Reemplaza al ClienteDrawer angosto/solo-lectura. Autocontenido (estilos y
 * badges propios) para no crear ciclos de import con SubscriptionsTab. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Formato WhatsApp Meta (+52…, sin el "1" de móvil) — igual que lib/kapso.ts.
function metaWa(p: string): string {
  let c = String(p || '').replace(/[^\d+]/g, '');
  if (!c) return '';
  if (!c.startsWith('+')) c = c.startsWith('52') ? '+' + c : '+52' + c;
  if (c.startsWith('+521') && c.length === 14) c = '+52' + c.slice(4);
  return c;
}
const waLink = (p?: string | null) => p ? 'https://wa.me/' + String(metaWa(p)).replace(/\D/g, '') : '';

const D = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 900 } as const,
  panel: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(940px, 97vw)', background: '#fafafa', zIndex: 901, overflowY: 'auto' as const, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' },
  head: { position: 'sticky' as const, top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #ececec', padding: '16px 22px 0' },
  tabbar: { display: 'flex', gap: 2, marginTop: 12, flexWrap: 'wrap' as const },
  tab: (act: boolean) => ({ padding: '9px 14px', border: 'none', borderBottom: act ? '2.5px solid #1a1a1a' : '2.5px solid transparent', background: 'none', cursor: 'pointer', fontWeight: act ? 800 : 600, fontSize: '0.83rem', color: act ? '#1a1a1a' : '#777' }) as const,
  body: { padding: 22 } as const,
  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 14 } as const,
  h: { fontSize: '0.72rem', fontWeight: 800, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 },
  kpi: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '12px 14px', minWidth: 130, flex: 1 } as const,
  kl: { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' as const },
  kv: { fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', marginTop: 2 } as const,
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.83rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 14px', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', background: '#1a1a1a', color: '#fff' } as const,
  btnG: { padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' } as const,
  badge: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  th: { textAlign: 'left' as const, padding: '7px 9px', fontSize: '0.66rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, borderBottom: '1px solid #eee' },
  td: { padding: '8px 9px', fontSize: '0.8rem', color: '#333', borderBottom: '1px solid #f4f4f4', fontVariantNumeric: 'tabular-nums' as const },
};

function EstadoBadge({ e }: { e: string }) {
  const map: Record<string, [string, string]> = {
    activa: ['rgba(42,181,160,.15)', '#1A8F7A'], programada: ['rgba(75,123,229,.12)', '#3764c4'],
    pendiente_pago: ['rgba(232,168,56,.16)', '#a06600'], cancelada: ['rgba(229,75,75,.1)', '#b93333'],
    pausada: ['rgba(26,26,26,.08)', '#555'],
  };
  const [bg, color] = map[e] || ['#f3f4f6', '#555'];
  return <span style={{ ...D.badge, background: bg, color }}>{e || '—'}</span>;
}

const CICLOS = ['anual', 'mensual', 'vitalicia'];
const ESTADOS_SUB = ['activa', 'programada', 'pendiente_pago', 'pausada', 'cancelada'];
const ROLES = ['Dueño', 'Gerente', 'Facturación', 'Sistemas', 'Compras', 'Otro'];

export default function ClienteDrawer360({ companyId, onClose, onChanged }: { companyId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'resumen' | 'info' | 'sacs' | 'contactos' | 'subs' | 'act'>('resumen');
  const [msg, setMsg] = useState('');

  async function load() {
    setErr('');
    try {
      const r = await fetch('/api/crm/arr/company360?id=' + companyId);
      const j = await r.json();
      if (j.error) setErr(j.error); else setData(j);
    } catch (e: any) { setErr(e?.message || 'No se pudo cargar'); }
  }
  useEffect(() => { setData(null); setTab('resumen'); load(); }, [companyId]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2600); }

  const co = data?.company;
  const contactos: any[] = data?.contacts || [];
  const principal = contactos.find(c => c.es_principal) || contactos[0] || null;
  const subs: any[] = data?.subscriptions || [];
  const res = data?.resumen || {};
  const act = co?.actividad || null;

  return (
    <>
      <div style={D.overlay} onClick={onClose} />
      <div style={D.panel}>
        {!data && !err && <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando cliente…</div>}
        {err && <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{err} <button style={D.btnG} onClick={load}>Reintentar</button></div>}
        {data && co && (
          <>
            <div style={D.head}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{co.nombre}</div>
                  <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
                    {co.sacs_account ? <>Cuenta SACS: <b>{co.sacs_account}</b></> : <span style={{ color: '#c62828' }}>Sin cuenta SACS ligada</span>}
                    {principal ? <> · {principal.nombre}{principal.email ? ` · ${principal.email}` : ''}</> : null}
                  </div>
                </div>
                {principal?.whatsapp && (
                  <a href={waLink(principal.whatsapp)} target="_blank" rel="noreferrer" style={{ ...D.btnG, textDecoration: 'none', color: '#1A8F7A', borderColor: '#bfe8df', fontWeight: 700 }}>💬 WhatsApp</a>
                )}
                <button style={{ ...D.btnG, border: 'none', fontSize: '1rem' }} onClick={onClose}>✕</button>
              </div>
              <div style={D.tabbar}>
                <button style={D.tab(tab === 'resumen')} onClick={() => setTab('resumen')}>Resumen</button>
                <button style={D.tab(tab === 'info')} onClick={() => setTab('info')}>Info general</button>
                <button style={D.tab(tab === 'sacs')} onClick={() => setTab('sacs')}>Actividad en SACS</button>
                <button style={D.tab(tab === 'contactos')} onClick={() => setTab('contactos')}>Contactos ({contactos.length})</button>
                <button style={D.tab(tab === 'subs')} onClick={() => setTab('subs')}>Suscripciones ({subs.length})</button>
                <button style={D.tab(tab === 'act')} onClick={() => setTab('act')}>Actividad</button>
              </div>
            </div>
            <div style={D.body}>
              {msg && <div style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}
              {tab === 'resumen' && <TabResumen res={res} co={co} act={act} subs={subs} />}
              {tab === 'info' && <TabInfoGeneral co={co} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'sacs' && <TabSacs co={co} act={act} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'contactos' && <TabContactos companyId={companyId} contactos={contactos} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'subs' && <TabSubs companyId={companyId} subs={subs} reload={() => { load(); onChanged(); }} flash={flash} />}
              {tab === 'act' && <TabActividad companyId={companyId} data={data} reload={() => { load(); onChanged(); }} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─────────── 📊 Resumen ─────────── */
function TabResumen({ res, co, act, subs }: any) {
  const dias = co?.dias_sin_venta;
  const senales = computarSenales(co, (subs || []).find((s: any) => s.estado === 'activa'));
  const tend = act && act.tendencia_pct;
  const sucPlan = Number(co.sucursales || 0);
  const sucReales = act ? Number(act.sucursales || 0) : 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Subs activas', res.subs_activas ?? 0], ['ARR', money(res.arr)], ['MRR', money(res.mrr)],
          ['Próx. factura', fmtDate(res.proxima_factura)], ['Pagos', res.pagos_totales ?? 0], ['Total pagado', money(res.total_pagado)]].map(([l, v]) => (
          <div key={String(l)} style={D.kpi}><div style={D.kl}>{l}</div><div style={D.kv}>{v}</div></div>
        ))}
      </div>

      {/* ── Qué venderle (señales reales) ── */}
      {senales.length > 0 && (
        <div style={D.card}>
          <div style={D.h}>💡 Qué venderle / atender</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {senales.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: s.nivel === 'riesgo' ? '#fdf2f2' : '#f0f7f4', border: '1px solid ' + (s.nivel === 'riesgo' ? '#f7d7d7' : '#d6ebe2') }}>
                <span style={{ fontSize: '1rem', lineHeight: 1.2 }}>{s.nivel === 'riesgo' ? '⚠️' : '📈'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: 700, color: s.nivel === 'riesgo' ? '#b93333' : '#1A8F7A' }}>{s.titulo}</div>
                  <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 1 }}>{s.detalle}</div>
                  <div style={{ fontSize: '0.78rem', color: '#16181d', marginTop: 3 }}><b>Acción:</b> {s.accion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Qué está usando (actividad real de SACS) ── */}
      <div style={D.card}>
        <div style={D.h}>Qué está usando en SACS</div>
        {act ? (
          <div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.83rem' }}>
              <span>Última venta: <b style={{ color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#1A8F7A' }}>{fmtDate(co.ultima_venta_at)}{dias != null ? ` (hace ${dias}d)` : ''}</b></span>
              {act.ventas_7d != null && <span>Ventas 7d: <b>{act.ventas_7d}</b></span>}
              {act.ventas_30d != null && <span>Ventas 30d: <b>{act.ventas_30d}</b></span>}
              {act.total_30d != null && <span>Monto 30d: <b>{money(act.total_30d)}</b></span>}
              {tend != null && <span>Tendencia: <b style={{ color: tend >= 0 ? '#1A8F7A' : '#b93333' }}>{tend >= 0 ? '+' : ''}{tend}%</b></span>}
              {act.usuarios != null && <span>Usuarios: <b>{act.usuarios}</b>{act.usuarios_operando != null ? ` (${act.usuarios_operando} operando)` : ''}</span>}
              {(sucReales > 0 || sucPlan > 0) && <span>Sucursales: <b style={{ color: sucReales > sucPlan && sucPlan > 0 ? '#a06600' : '#16181d' }}>{sucReales || sucPlan}{sucPlan > 0 && sucReales > sucPlan ? ` (plan: ${sucPlan})` : ''}</b></span>}
              {co.health_score != null && <span>Salud: <b style={{ color: co.health_score >= 70 ? '#1A8F7A' : co.health_score >= 40 ? '#a06600' : '#b93333' }}>{co.health_score}</b></span>}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Módulos que usa ({(act.modulos || []).length})</div>
              {(act.modulos || []).length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {act.modulos.map((m: string) => <span key={m} style={{ ...D.badge, background: '#eef2ff', color: '#3730a3' }}>{m}</span>)}
                </div>
              ) : <span style={{ color: '#999', fontSize: '0.8rem' }}>Sin módulos con actividad reciente.</span>}
            </div>
          </div>
        ) : <div style={{ color: '#999', fontSize: '0.82rem' }}>{co?.sacs_account ? 'Sin datos sincronizados aún — usa "Sincronizar" en la pestaña Cliente & SACS.' : 'Liga la cuenta SACS en la pestaña Cliente & SACS para ver su actividad real.'}</div>}
      </div>
      <div style={D.card}>
        <div style={D.h}>Suscripciones</div>
        {subs.length === 0 && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin suscripciones — agrégala en la pestaña Suscripciones.</div>}
        {subs.map((s: any) => (
          <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.83rem' }}>
            <b style={{ minWidth: 150 }}>{s.nombre_plan}</b><span style={{ color: '#888' }}>{s.ciclo}</span>
            <span style={{ fontWeight: 700 }}>{money(s.arr)} ARR</span>
            <span style={{ color: '#888' }}>próx: {fmtDate(s.proxima_factura)}</span>
            <span style={{ marginLeft: 'auto' }}><EstadoBadge e={s.estado} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Selector de ETAPA del pipeline de clientes (se movió aquí desde la tabla).
 * Carga el catálogo de etapas de /api/crm/pipelines y guarda pipeline_stage. */
function EtapaSelector({ co, reload, flash }: any) {
  const [stages, setStages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/crm/pipelines').then(r => r.json()).then(pj => {
      if (!alive) return;
      const cli = (pj.data || []).find((p: any) => p.tipo === 'cliente');
      setStages(cli?.stages || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  async function cambiar(key: string) {
    setSaving(true);
    const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id, pipeline_stage: key || null }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo cambiar la etapa.'); else { flash('Etapa actualizada'); reload(); }
  }
  const actual = stages.find(s => s.key === co.pipeline_stage);
  return (
    <div style={D.card}>
      <div style={D.h}>Etapa del cliente</div>
      {stages.length === 0 ? (
        <div style={{ color: '#999', fontSize: '0.82rem' }}>Configura las etapas en Configuración → Pipelines.</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={co.pipeline_stage || ''} disabled={saving} onChange={e => cambiar(e.target.value)}
            style={{ ...D.input, width: 'auto', minWidth: 200, fontWeight: 700, color: actual ? actual.color : '#666', borderColor: actual ? actual.color : '#e3e5e9' }}>
            <option value="">— sin etapa —</option>
            {stages.map(s => <option key={s.key} value={s.key} style={{ color: '#333' }}>{s.label}</option>)}
          </select>
          {saving && <span style={{ color: '#999', fontSize: '0.8rem' }}>guardando…</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────── 📇 Info general (datos editables del cliente) ─────────── */
function TabInfoGeneral({ co, reload, flash }: any) {
  const [f, setF] = useState<any>({ nombre: co.nombre || '', rfc: co.rfc || '', razon_social: co.razon_social || '', giro: co.giro || '', sitio_web: co.sitio_web || '', ciudad: co.ciudad || '', estado_geo: co.estado_geo || '', sucursales: co.sucursales || 1, estado_cuenta: co.estado_cuenta || 'activo' });
  const [saving, setSaving] = useState(false);
  async function guardar() {
    if (!f.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    setSaving(true);
    const r = await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: co.id, ...f, sucursales: parseInt(f.sucursales) || 1 }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { flash('Datos del cliente guardados'); reload(); }
  }
  const campo = (label: string, k: string, ph = '') => (
    <div style={{ flex: '1 1 200px' }}>
      <label style={D.lbl}>{label}</label>
      <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph} style={D.input} />
    </div>
  );
  return (
    <div>
      <EtapaSelector co={co} reload={reload} flash={flash} />
      <div style={D.card}>
        <div style={D.h}>Datos del cliente (editables)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {campo('Nombre *', 'nombre')}
          {campo('Razón social', 'razon_social')}
          {campo('RFC', 'rfc')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {campo('Giro', 'giro', 'boutique, papelería…')}
          {campo('Sitio web', 'sitio_web', 'https://…')}
          {campo('Ciudad', 'ciudad')}
          {campo('Estado', 'estado_geo')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ width: 120 }}>
            <label style={D.lbl}>Sucursales</label>
            <input type="number" min={1} value={f.sucursales} onChange={e => setF({ ...f, sucursales: e.target.value })} style={D.input} />
          </div>
          <div style={{ width: 180 }}>
            <label style={D.lbl}>Estado de la cuenta</label>
            <select value={f.estado_cuenta} onChange={e => setF({ ...f, estado_cuenta: e.target.value })} style={D.input}>
              {['activo', 'prospecto', 'pausado', 'churned'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <button style={{ ...D.btn, marginLeft: 'auto' }} disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : '💾 Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

/* Panorama 360 de la cuenta en SACS (usuarios/sucursales/transacciones/promos +
 * uso profundo: 7 días, programas, administración, módulos nunca activados).
 * Carga on-demand desde /api/crm/sacs-cuenta-360; mientras llega, pinta el uso
 * persistido por el cron (co.uso_sacs). */
function Panorama360({ account, co }: { account: string; co?: any }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true; setD(null); setErr('');
    fetch('/api/crm/sacs-cuenta-360?account=' + encodeURIComponent(account))
      .then(r => r.json()).then(j => { if (!alive) return; if (j.error) setErr(j.error); else setD(j); })
      .catch(() => { if (alive) setErr('x'); });
    return () => { alive = false; };
  }, [account]);

  // uso: preferimos lo recién traído; si aún no llega (o falló), el caché del cron
  const uso = (d && d.uso) || co?.uso_sacs || null;

  if (err && !uso) return null;
  if (!d && !uso) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando panorama de SACS…</div>;

  const u = d?.usuarios || {}, suc = d?.sucursales || {}, tx = d?.ultimas_transacciones || [], pr = d?.promociones || {};
  const lbl: any = { fontSize: '0.68rem', color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' };
  const ell: any = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const usa = (b: boolean, txt: string, extra = '') => (
    <span style={{ ...D.badge, background: b ? '#e6f6f2' : '#fafafa', color: b ? '#1A8F7A' : '#9aa0a8', border: '1px solid ' + (b ? '#bfe8df' : '#e8e8ea') }}>
      <b>{txt}</b>{b ? <> · <b style={{ color: '#1A8F7A' }}>SÍ lo usa</b>{extra ? ` (${extra})` : ''}</> : <> · no lo usa</>}
    </span>
  );
  const le = uso?.lealtad, adm = uso?.administracion, fac = uso?.facturacion, tg = uso?.tarjetas_regalo, tr = uso?.transferencias;
  // Matriz integral de módulos agrupada por familia.
  const familias: any[] = [];
  (uso?.modulos || []).forEach((m: any) => {
    let f = familias.find(x => x.nombre === m.familia);
    if (!f) { f = { nombre: m.familia, items: [] }; familias.push(f); }
    f.items.push(m);
  });
  const nUsa = (uso?.modulos || []).filter((m: any) => m.usa).length;
  const chipMod = (m: any) => (
    <span key={m.modulo} style={{ ...D.badge, background: m.usa ? '#e6f6f2' : '#fafafa', color: m.usa ? '#1A8F7A' : '#9aa0a8', border: '1px solid ' + (m.usa ? '#bfe8df' : '#e8e8ea') }}>
      <b>{m.modulo}</b>{m.usa
        ? <> · <b style={{ color: '#1A8F7A' }}>SÍ</b>{m.docs_7d ? ` · ${m.docs_7d} en 7d` : m.docs_30d ? ` · ${m.docs_30d} en 30d` : ''}{m.total ? ` · ${Number(m.total).toLocaleString()} total` : ''}</>
        : <> · no lo usa</>}
    </span>
  );
  return (
    <>
    {d && <div style={D.card}>
      <div style={D.h}>Panorama en SACS</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={D.kpi}><div style={D.kl}>Usuarios</div><div style={D.kv}>{u.total ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{u.activos ?? 0} activos</div></div>
        <div style={D.kpi}><div style={D.kl}>Sucursales</div><div style={D.kv}>{suc.total ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Promociones</div><div style={D.kv}>{pr.total ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{pr.activas ?? 0} activas</div></div>
      </div>

      {u.por_grupo?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Usuarios por grupo</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {u.por_grupo.map((g: any, i: number) => <span key={i} style={{ ...D.badge, background: '#f3f4f6', color: '#475569' }}>{g.grupo}: {g.n}</span>)}
          </div>
        </div>
      ) : null}

      {suc.nombres?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Sucursales</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suc.nombres.map((n: string, i: number) => <span key={i} style={{ ...D.badge, background: '#e6f6f2', color: '#1A8F7A' }}>{n}</span>)}
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: pr.ultimas?.length ? 12 : 0 }}>
        <div style={lbl}>Últimas transacciones</div>
        {tx.length ? tx.map((t: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
            <b>#{t.folio}</b>
            <span style={{ color: '#888' }}>{fmtDate(t.fecha)}</span>
            {t.sucursal ? <span style={{ color: '#888', ...ell, maxWidth: 120 }}>{t.sucursal}</span> : null}
            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{money(t.total)}</span>
          </div>
        )) : <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin ventas recientes.</div>}
      </div>

      {pr.ultimas?.length ? (
        <div>
          <div style={lbl}>Últimas promociones</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pr.ultimas.map((p: any, i: number) => <span key={i} style={{ ...D.badge, background: p.activa ? '#fff8e1' : '#f3f4f6', color: p.activa ? '#a06600' : '#777' }}>{p.nombre}{p.activa ? ' · activa' : ''}</span>)}
          </div>
        </div>
      ) : null}
    </div>}

    {uso && <div style={D.card}>
      <div style={D.h}>Uso últimos 7 días</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: (tr?.ultimas?.length || uso.conteos?.ultimo) ? 12 : 0 }}>
        <div style={D.kpi}><div style={D.kl}>Transferencias</div><div style={D.kv}>{tr?.total_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Conteos físicos</div><div style={D.kv}>{uso.conteos?.total_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Clientes nuevos</div><div style={D.kv}>{uso.clientes?.nuevos_7d ?? 0}</div><div style={{ fontSize: '0.68rem', color: '#a7abb3' }}>{Number(uso.clientes?.total || 0).toLocaleString()} en total</div></div>
        <div style={D.kpi}><div style={D.kl}>Facturas timbradas</div><div style={D.kv}>{fac?.timbradas_7d ?? 0}</div></div>
        <div style={D.kpi}><div style={D.kl}>Promos creadas</div><div style={D.kv}>{uso.promociones?.creadas_7d ?? 0}</div></div>
      </div>
      {tr?.ultimas?.length ? (
        <div style={{ marginBottom: uso.conteos?.ultimo ? 10 : 0 }}>
          <div style={lbl}>Últimas transferencias</div>
          {tr.ultimas.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.8rem' }}>
              <span style={{ color: '#888' }}>{fmtDate(t.fecha)}</span>
              <span style={{ ...ell, maxWidth: 260 }}><b>{t.origen || '—'}</b> → <b>{t.destino || '—'}</b></span>
              <span style={{ marginLeft: 'auto', ...D.badge, background: /Recibida/.test(t.status) ? '#e6f6f2' : t.status === 'Cancelada' ? '#fdf2f2' : '#fff8e1', color: /Recibida/.test(t.status) ? '#1A8F7A' : t.status === 'Cancelada' ? '#b93333' : '#a06600' }}>{t.status || '—'}</span>
            </div>
          ))}
        </div>
      ) : null}
      {uso.conteos?.ultimo && <div style={{ fontSize: '0.78rem', color: '#666' }}>Último conteo: <b>{fmtDate(uso.conteos.ultimo.fecha)}</b> · {uso.conteos.ultimo.status}</div>}
    </div>}

    {/* ── Matriz INTEGRAL: TODOS los módulos por familia, uso real ── */}
    {familias.length > 0 && (
      <div style={D.card}>
        <div style={D.h}>Uso de módulos ({nUsa}/{uso.modulos.length})</div>
        <div style={{ fontSize: '0.74rem', color: '#999', marginTop: -6, marginBottom: 12 }}>
          <span style={{ color: '#1A8F7A', fontWeight: 700 }}>Verde = lo usa</span> · <span style={{ color: '#9aa0a8', fontWeight: 700 }}>gris = oportunidad de venta</span>
        </div>
        {familias.map((fam: any) => (
          <div key={fam.nombre} style={{ marginBottom: 12 }}>
            <div style={lbl}>{fam.nombre}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fam.items.map((m: any) => chipMod(m))}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ── Detalle de programas (lo que la matriz no cabe: tipo, inscritos, promos) ── */}
    {uso && (le?.activo || fac?.configurada || tg?.usa || uso.promociones?.activas?.length || Number(adm?.cxp_pendientes || 0) > 0) ? (
      <div style={D.card}>
        <div style={D.h}>Detalle de programas y administración</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
          {le?.activo && <div>💎 <b>Lealtad {le.tipo === 'completo' ? 'COMPLETO' : le.tipo === 'basico' ? 'BÁSICO' : ''}</b> — {Number(le.inscritos || 0).toLocaleString()} inscritos{Number(le.nuevos_7d || 0) > 0 ? `, +${le.nuevos_7d} en 7d` : ''}</div>}
          {fac?.configurada && <div>🧾 <b>Facturación configurada</b>{fac.timbradas_7d ? ` — ${fac.timbradas_7d} timbradas en 7d` : ''}</div>}
          {tg?.usa && <div>🎁 <b>Tarjetas de regalo</b>{tg.activas ? ` — ${tg.activas} activas` : ''}</div>}
          {Number(adm?.cxp_pendientes || 0) > 0 && <div>📌 <b>Cuentas por pagar</b> — {adm.cxp_pendientes} pendientes</div>}
        </div>
        {uso.promociones?.activas?.length ? (
          <div style={{ marginTop: 10 }}>
            <div style={lbl}>Promociones activas ahora</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {uso.promociones.activas.map((p: any, i: number) => <span key={i} style={{ ...D.badge, background: '#fff8e1', color: '#a06600' }}>{p.nombre}{p.origen === 'pos' ? ' · POS' : ''}</span>)}
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
    </>
  );
}

/* ─────────── 🏢 SACS (solo información de SACS: ligar cuenta + panorama) ─────────── */
function TabSacs({ co, act, reload, flash }: any) {
  const [cuenta, setCuenta] = useState(co.sacs_account || '');
  const [linking, setLinking] = useState(false);

  async function ligarYSync() {
    const acct = cuenta.trim().toLowerCase();
    if (!acct) { alert('Escribe el subdominio de la cuenta SACS (ej. dibujotecnico).'); return; }
    setLinking(true);
    try {
      const r1 = await fetch('/api/crm/arr/link-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: co.id, sacs_account: acct }) });
      const j1 = await r1.json().catch(() => ({}));
      if (!r1.ok || j1.error) { alert(j1.error || 'No se pudo ligar.'); setLinking(false); return; }
      await fetch('/api/crm/arr/sync-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: co.id }) });
      flash('Cuenta ligada y sincronizada');
      reload();
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setLinking(false);
  }
  async function syncAhora() {
    setLinking(true);
    const r = await fetch('/api/crm/arr/sync-cuenta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: co.id }) });
    const j = await r.json().catch(() => ({}));
    setLinking(false);
    if (j.error) alert(j.error); else { flash('Actividad sincronizada'); reload(); }
  }

  return (
    <div>
      <div style={D.card}>
        <div style={D.h}>Cuenta SACS</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={D.lbl}>Subdominio (ej. dibujotecnico)</label>
            <input value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="cuenta" style={D.input} />
          </div>
          <button style={D.btn} disabled={linking} onClick={ligarYSync}>{linking ? '…' : (co.sacs_account ? 'Cambiar y sincronizar' : 'Ligar y sincronizar')}</button>
          {co.sacs_account && <button style={D.btnG} disabled={linking} onClick={syncAhora}>🔄 Sincronizar ahora</button>}
        </div>
        {co.actividad_sync_at && <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 8 }}>Última sincronización: {new Date(co.actividad_sync_at).toLocaleString('es-MX')}</div>}
        {co.sacs_account && <AccederCuenta account={co.sacs_account} />}
      </div>

      {co.sacs_account && <Panorama360 account={co.sacs_account} co={co} />}
      {co.sacs_account && <UsuariosSacs account={co.sacs_account} />}
    </div>
  );
}

/* Botón "Acceder a la cuenta como Super Admin" — pide a sacs_api un custom token
 * (account-level, sin uid) y abre la página puente en app.sacscloud.com que canjea
 * la sesión Firebase y entra al panel de la cuenta. */
function AccederCuenta({ account, uid, label }: { account: string; uid?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function acceder() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/crm/sacs-impersonar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uid ? { account, uid } : { account }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) { setErr(j.error || 'No se pudo generar el acceso.'); setBusy(false); return; }
      window.open(j.url, '_blank', 'noopener');
      setBusy(false);
    } catch (e: any) { setErr(e?.message || 'Error'); setBusy(false); }
  }
  return (
    <div style={{ marginTop: 12 }}>
      <button style={{ ...D.btn, background: '#6D28D9' }} disabled={busy} onClick={acceder}>
        {busy ? 'Generando acceso…' : (label || '🔓 Acceder a la cuenta como Super Admin')}
      </button>
      {err && <div style={{ color: '#b93333', fontSize: '0.76rem', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/* Usuarios de la cuenta SACS, con filtro por sucursal y orden por último acceso
 * (más reciente primero). Carga on-demand desde /api/crm/sacs-usuarios?account= */
function UsuariosSacs({ account }: { account: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [filtroSuc, setFiltroSuc] = useState('__todas');
  useEffect(() => {
    let alive = true; setD(null); setErr(''); setFiltroSuc('__todas');
    fetch('/api/crm/sacs-usuarios?account=' + encodeURIComponent(account))
      .then(r => r.json()).then(j => { if (!alive) return; if (j.error) setErr(j.error); else setD(j); })
      .catch(() => { if (alive) setErr('x'); });
    return () => { alive = false; };
  }, [account]);

  if (err) return null;
  if (!d) return <div style={{ ...D.card, color: '#999', fontSize: '0.82rem' }}>Cargando usuarios…</div>;

  const usuarios: any[] = d.usuarios || [];
  // Catálogo de sucursales presente en los usuarios (+ opción "sin sucursal").
  const sucsSet = new Set<string>();
  let haySinSuc = false;
  usuarios.forEach(u => {
    const s = u.sucursales_nombres || [];
    if (s.length) s.forEach((x: string) => sucsSet.add(x)); else haySinSuc = true;
  });
  const sucOpciones = Array.from(sucsSet).sort((a, b) => a.localeCompare(b));

  // Filtrar por sucursal seleccionada.
  const ms = (u: any) => { const t = Date.parse(u.ultimo_login || ''); return isNaN(t) ? -1 : t; };
  const filtrados = usuarios.filter(u => {
    if (filtroSuc === '__todas') return true;
    if (filtroSuc === '__sin') return !(u.sucursales_nombres && u.sucursales_nombres.length);
    return (u.sucursales_nombres || []).indexOf(filtroSuc) >= 0;
  }).sort((a, b) => ms(b) - ms(a)); // más reciente primero

  return (
    <div style={D.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...D.h, margin: 0 }}>Usuarios ({filtrados.length}{filtroSuc !== '__todas' ? ` de ${usuarios.length}` : ''})</div>
        <select value={filtroSuc} onChange={e => setFiltroSuc(e.target.value)} style={{ ...D.input, width: 'auto', marginLeft: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}>
          <option value="__todas">Todas las sucursales</option>
          {sucOpciones.map(s => <option key={s} value={s}>{s}</option>)}
          {haySinSuc && <option value="__sin">(sin sucursal asignada)</option>}
        </select>
      </div>
      {filtrados.map((u: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f4f4', fontSize: '0.82rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.nombre}{u.es_super ? <span style={{ ...D.badge, background: '#EDE9FE', color: '#6D28D9', marginLeft: 6 }}>Super Admin</span> : null}{u.activo === false ? <span style={{ ...D.badge, background: '#fdf2f2', color: '#b93333', marginLeft: 6 }}>inactivo</span> : null}
            </div>
            <div style={{ color: '#888', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.grupo_nombre || '(sin grupo)'}{(u.sucursales_nombres && u.sucursales_nombres.length) ? ` · 🏬 ${u.sucursales_nombres.join(', ')}` : ''}{u.email ? ` · ${u.email}` : ''}
            </div>
          </div>
          <div style={{ color: '#999', fontSize: '0.72rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {u.ultimo_login ? <>último acceso<br /><b style={{ color: '#666' }}>{fmtDate(u.ultimo_login)}</b></> : 'sin registro'}
          </div>
        </div>
      ))}
      {!filtrados.length && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin usuarios en esta sucursal.</div>}
      <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 8 }}>Ordenados por último acceso (más reciente primero). El acceso a la cuenta entra como Super Admin (botón arriba).</div>
    </div>
  );
}

/* ─────────── 👤 Contactos (multi-contacto: lista + alta + principal) ─────────── */
function TabContactos({ companyId, contactos, reload, flash }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState<any>({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
  const [busy, setBusy] = useState(false);
  const sinMigracion = contactos.length > 0 && contactos[0].es_principal === undefined;

  function validar(x: any): string | null {
    if (x.email && !EMAIL_RE.test(x.email.trim())) return 'El correo no se ve válido.';
    if (x.whatsapp && metaWa(x.whatsapp).replace(/\D/g, '').length < 12) return 'El WhatsApp debe tener 10 dígitos (se guarda como +52…).';
    return null;
  }

  async function guardarEdit(c: any) {
    const v = validar(f); if (v) { alert(v); return; }
    setBusy(true);
    const upd: any = { id: c.id, nombre: f.nombre, email: f.email.trim() || null, whatsapp: f.whatsapp ? metaWa(f.whatsapp) : null, telefono: f.telefono.trim() || null };
    if (!sinMigracion) upd.rol = f.rol || null;
    const r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upd) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { setEditId(null); flash('Contacto guardado'); reload(); }
  }

  async function agregar() {
    if (!nf.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    const v = validar(nf); if (v) { alert(v); return; }
    setBusy(true);
    try {
      // Dedupe/reasignación: si ya existe un contacto con ese email, se LIGA a esta
      // empresa en lugar de duplicarlo (un contacto puede cambiar de empresa).
      if (nf.email.trim()) {
        const rs = await fetch('/api/crm/contacts?search=' + encodeURIComponent(nf.email.trim()));
        const js = await rs.json().catch(() => ({}));
        const exacto = (js.data || js.contacts || []).find((x: any) => (x.email || '').toLowerCase() === nf.email.trim().toLowerCase());
        if (exacto) {
          const r2 = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: exacto.id, company_id: companyId, whatsapp: nf.whatsapp ? metaWa(nf.whatsapp) : undefined }) });
          const j2 = await r2.json().catch(() => ({}));
          setBusy(false);
          if (!r2.ok || j2.error) { alert(j2.error || 'No se pudo ligar.'); return; }
          setAdding(false); setNf({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
          flash('Ese contacto ya existía — se ligó a este cliente'); reload(); return;
        }
      }
      const body: any = { nombre: nf.nombre.trim(), email: nf.email.trim() || null, whatsapp: nf.whatsapp ? metaWa(nf.whatsapp) : null, telefono: nf.telefono.trim() || null, company_id: companyId, tipo: 'cliente', lifecycle_stage: 'cliente' };
      const r = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok || j.error) { alert(j.error || 'No se pudo crear.'); return; }
      // El POST tiene lista fija de campos (ignora rol) → se guarda con un PUT aparte.
      if (!sinMigracion && nf.rol && j.id) {
        await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id, rol: nf.rol }) }).catch(() => {});
      }
      setAdding(false); setNf({ nombre: '', email: '', whatsapp: '', telefono: '', rol: '' });
      flash('Contacto agregado'); reload();
    } catch (e: any) { setBusy(false); alert('Error: ' + (e?.message || e)); }
  }

  async function marcarPrincipal(c: any) {
    const r = await fetch('/api/crm/contacts/principal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: c.id, company_id: companyId }) });
    const j = await r.json().catch(() => ({}));
    if (j.error) alert(j.error); else { flash('Contacto principal actualizado'); reload(); }
  }
  async function quitar(c: any) {
    if (!confirmar('¿Quitar a "' + c.nombre + '" de este cliente? (el contacto no se borra, solo se desliga)')) return;
    const r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, company_id: null, es_principal: false }) });
    const j = await r.json().catch(() => ({}));
    if (j.error) alert(j.error); else { flash('Contacto desligado'); reload(); }
  }
  // confirm nativo está bien aquí (panel interno admin, no es sacs3).
  function confirmar(m: string) { return window.confirm(m); }

  return (
    <div>
      {sinMigracion && (
        <div style={{ background: '#fff3e0', color: '#a06600', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.78rem' }}>
          ⚠ Para roles y contacto principal, corre <code>scripts/migration-2026-07-contactos-rol.sql</code> en Supabase (una vez).
        </div>
      )}
      <div style={D.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={D.h}>Contactos de este cliente</div>
          <button style={{ ...D.btnG, marginLeft: 'auto' }} onClick={() => setAdding(!adding)}>{adding ? '✕ Cancelar' : '+ Agregar contacto'}</button>
        </div>

        {adding && (
          <div style={{ background: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={nf.nombre} onChange={e => setNf({ ...nf, nombre: e.target.value })} placeholder="Nombre *" style={{ ...D.input, flex: '1 1 160px' }} />
              <input value={nf.email} onChange={e => setNf({ ...nf, email: e.target.value })} placeholder="correo@…" style={{ ...D.input, flex: '1 1 180px' }} />
              <input value={nf.whatsapp} onChange={e => setNf({ ...nf, whatsapp: e.target.value })} placeholder="WhatsApp (+52…)" style={{ ...D.input, flex: '1 1 140px' }} />
              <input value={nf.telefono} onChange={e => setNf({ ...nf, telefono: e.target.value })} placeholder="Tel. fijo (opcional)" style={{ ...D.input, flex: '1 1 130px' }} />
              {!sinMigracion && (
                <select value={nf.rol} onChange={e => setNf({ ...nf, rol: e.target.value })} style={{ ...D.input, flex: '0 1 140px' }}>
                  <option value="">— rol —</option>
                  {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
            </div>
            <button style={D.btn} disabled={busy} onClick={agregar}>{busy ? '…' : 'Guardar contacto'}</button>
            <span style={{ fontSize: '0.72rem', color: '#999', marginLeft: 10 }}>Si el correo ya existe en el CRM, se liga aquí en lugar de duplicarse.</span>
          </div>
        )}

        {contactos.length === 0 && !adding && <div style={{ color: '#999', fontSize: '0.82rem' }}>Este cliente no tiene contactos — agrégale al menos uno.</div>}

        {contactos.map((c: any) => (
          <div key={c.id} style={{ borderBottom: '1px solid #f2f2f2', padding: '10px 0' }}>
            {editId === c.id ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={{ ...D.input, flex: '1 1 150px' }} />
                <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="correo" style={{ ...D.input, flex: '1 1 180px' }} />
                <input value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="+52…" style={{ ...D.input, flex: '1 1 130px' }} />
                <input value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} placeholder="tel fijo" style={{ ...D.input, flex: '1 1 120px' }} />
                {!sinMigracion && (
                  <select value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })} style={{ ...D.input, flex: '0 1 130px' }}>
                    <option value="">— rol —</option>
                    {ROLES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
                <button style={{ ...D.btnG, color: '#1A8F7A', fontWeight: 800 }} disabled={busy} onClick={() => guardarEdit(c)}>{busy ? '…' : '✓ Guardar'}</button>
                <button style={D.btnG} onClick={() => setEditId(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <b>{c.nombre}{c.apellido ? ' ' + c.apellido : ''}</b>
                  {c.es_principal && <span style={{ ...D.badge, background: '#fff8e1', color: '#a06600', marginLeft: 8 }}>★ principal</span>}
                  {c.rol && <span style={{ ...D.badge, background: '#f3f4f6', color: '#555', marginLeft: 6 }}>{c.rol}</span>}
                  <div style={{ fontSize: '0.76rem', color: '#888' }}>{c.email || 'sin correo'} · {c.whatsapp || c.telefono || 'sin teléfono'}</div>
                </div>
                {c.whatsapp && <a href={waLink(c.whatsapp)} target="_blank" rel="noreferrer" style={{ ...D.btnG, textDecoration: 'none', color: '#1A8F7A' }}>💬</a>}
                <button style={D.btnG} onClick={() => { setEditId(c.id); setF({ nombre: c.nombre || '', email: c.email || '', whatsapp: c.whatsapp || '', telefono: c.telefono || '', rol: c.rol || '' }); }}>✏️ Editar</button>
                {!c.es_principal && !sinMigracion && <button style={D.btnG} onClick={() => marcarPrincipal(c)}>★ Hacer principal</button>}
                {contactos.length > 1 && <button style={{ ...D.btnG, color: '#b93333' }} onClick={() => quitar(c)}>Quitar</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── 📋 Suscripciones (lista editable + alta) ─────────── */
function TabSubs({ companyId, subs, reload, flash }: any) {
  const [planes, setPlanes] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState<any>({ plan_slug: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/crm/arr/plans').then(r => r.json()).then(j => setPlanes(j.data || j.plans || [])).catch(() => {}); }, []);

  function pickPlan(slug: string) {
    const p = planes.find((x: any) => x.slug === slug);
    const precio = p ? (nf.ciclo === 'mensual' ? p.precio_mensual : p.precio_anual) : '';
    setNf({ ...nf, plan_slug: slug, nombre_plan: p?.nombre || slug, precio: precio ?? '' });
  }

  async function crear() {
    if (!nf.nombre_plan) { alert('Elige un plan.'); return; }
    setBusy(true);
    const body: any = { company_id: companyId, nombre_plan: nf.nombre_plan, plan_id: nf.plan_slug || null, ciclo: nf.ciclo, precio: parseFloat(nf.precio) || 0, estado: nf.estado };
    if (nf.proxima_factura) body.proxima_factura = nf.proxima_factura;
    const r = await fetch('/api/crm/arr/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo crear.'); else { setAdding(false); setNf({ plan_slug: '', nombre_plan: '', ciclo: 'anual', precio: '', proxima_factura: '', estado: 'programada' }); flash('Suscripción creada'); reload(); }
  }
  async function guardar(s: any) {
    setBusy(true);
    const body: any = { id: s.id, estado: f.estado, ciclo: f.ciclo, nombre_plan: f.nombre_plan, precio: parseFloat(f.precio) || 0 };
    if (f.proxima_factura) body.proxima_factura = f.proxima_factura;
    const r = await fetch('/api/crm/arr/subscriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || j.error) alert(j.error || 'No se pudo guardar.'); else { setEditId(null); flash('Suscripción actualizada'); reload(); }
  }

  return (
    <div>
      <div style={D.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={D.h}>Suscripciones del cliente</div>
          <button style={{ ...D.btnG, marginLeft: 'auto' }} onClick={() => setAdding(!adding)}>{adding ? '✕ Cancelar' : '+ Agregar suscripción'}</button>
        </div>

        {adding && (
          <div style={{ background: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={nf.plan_slug} onChange={e => pickPlan(e.target.value)} style={{ ...D.input, flex: '1 1 200px' }}>
                <option value="">— elegir plan —</option>
                {planes.map((p: any) => <option key={p.slug} value={p.slug}>{p.nombre}{p.precio_anual ? ` ($${p.precio_anual}/año)` : ''}</option>)}
              </select>
              <select value={nf.ciclo} onChange={e => { const c = e.target.value; const p = planes.find((x: any) => x.slug === nf.plan_slug); setNf({ ...nf, ciclo: c, precio: p ? ((c === 'mensual' ? p.precio_mensual : p.precio_anual) ?? nf.precio) : nf.precio }); }} style={{ ...D.input, flex: '0 1 120px' }}>
                {CICLOS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <input type="number" value={nf.precio} onChange={e => setNf({ ...nf, precio: e.target.value })} placeholder="Precio" style={{ ...D.input, flex: '0 1 110px' }} />
              <input type="date" value={nf.proxima_factura} onChange={e => setNf({ ...nf, proxima_factura: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }} title="Próxima factura" />
              <select value={nf.estado} onChange={e => setNf({ ...nf, estado: e.target.value })} style={{ ...D.input, flex: '0 1 150px' }}>
                {ESTADOS_SUB.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <button style={D.btn} disabled={busy} onClick={crear}>{busy ? '…' : 'Crear suscripción'}</button>
          </div>
        )}

        {subs.length === 0 && !adding && <div style={{ color: '#999', fontSize: '0.82rem' }}>Sin suscripciones registradas.</div>}

        <div style={{ overflowX: 'auto' }}>
          {subs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Plan', 'Ciclo', 'Estado', 'Precio/ARR', 'Próx. factura', 'Pagos', 'Acumulado', ''].map(h => <th key={h} style={D.th}>{h}</th>)}</tr></thead>
              <tbody>
                {subs.map((s: any) => (
                  editId === s.id ? (
                    <tr key={s.id}>
                      <td style={D.td}><input value={f.nombre_plan} onChange={e => setF({ ...f, nombre_plan: e.target.value })} style={{ ...D.input, minWidth: 140 }} /></td>
                      <td style={D.td}><select value={f.ciclo} onChange={e => setF({ ...f, ciclo: e.target.value })} style={D.input}>{CICLOS.map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                      <td style={D.td}><select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={D.input}>{ESTADOS_SUB.map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                      <td style={D.td}><input type="number" value={f.precio} onChange={e => setF({ ...f, precio: e.target.value })} style={{ ...D.input, width: 100 }} /></td>
                      <td style={D.td}><input type="date" value={f.proxima_factura} onChange={e => setF({ ...f, proxima_factura: e.target.value })} style={D.input} /></td>
                      <td style={D.td} colSpan={2}></td>
                      <td style={D.td}>
                        <button style={{ ...D.btnG, color: '#1A8F7A', fontWeight: 800 }} disabled={busy} onClick={() => guardar(s)}>✓</button>{' '}
                        <button style={D.btnG} onClick={() => setEditId(null)}>✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td style={{ ...D.td, fontWeight: 700 }}>{s.nombre_plan}</td>
                      <td style={D.td}>{s.ciclo}</td>
                      <td style={D.td}><EstadoBadge e={s.estado} /></td>
                      <td style={D.td}>{money(s.precio || s.arr)}</td>
                      <td style={D.td}>{fmtDate(s.proxima_factura)}</td>
                      <td style={D.td}>{s.pagos_realizados || 0}</td>
                      <td style={D.td}>{money(s.total_pagado)}</td>
                      <td style={D.td}><button style={D.btnG} onClick={() => { setEditId(s.id); setF({ nombre_plan: s.nombre_plan || '', ciclo: s.ciclo || 'anual', estado: s.estado || 'activa', precio: s.precio ?? s.arr ?? '', proxima_factura: s.proxima_factura || '' }); }}>✏️</button></td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── 🕓 Actividad (pagos + notas + timeline) ─────────── */
function TabActividad({ companyId, data, reload }: any) {
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  async function agregarNota() {
    if (!nota.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'nota', titulo: nota.trim().slice(0, 140), descripcion: nota.trim(), company_id: companyId }) });
    setNota(''); setSaving(false); reload();
  }
  return (
    <div>
      <div style={D.card}>
        <div style={D.h}>Pagos ({(data.payments || []).length})</div>
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Fecha', 'Método', 'Monto', ''].map(h => <th key={h} style={D.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.payments || []).map((p: any) => {
                const negativo = Number(p.monto) < 0;
                return (
                  <tr key={p.id} style={{ opacity: p.reembolsado ? 0.5 : 1 }}>
                    <td style={D.td}>{fmtDate(p.fecha)}</td>
                    <td style={{ ...D.td, fontSize: '0.75rem' }}>{p.metodo}{p.migrado ? ' · histórico' : ''}{p.reembolsado ? ' · reembolsado' : ''}{negativo ? ' · ajuste' : ''}</td>
                    <td style={{ ...D.td, fontWeight: 700, color: negativo ? '#b93333' : '#333' }}>{money(p.monto)}</td>
                    <td style={D.td}>
                      {!p.reembolsado && !negativo && !p.migrado && (
                        <button style={{ ...D.btnG, fontSize: '0.7rem' }} onClick={async () => { const m = window.prompt('Motivo del reembolso (opcional):', ''); if (m === null) return; const r = await fetch('/api/crm/arr/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: p.id, motivo: m }) }); const j = await r.json(); if (j.error) alert(j.error); else reload(); }}>Reembolsar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!(data.payments || []).length && <div style={{ color: '#999', fontSize: '0.8rem', padding: 8 }}>Sin pagos registrados.</div>}
        </div>
      </div>
      <div style={D.card}>
        <div style={D.h}>Notas y timeline</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={nota} onChange={e => setNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregarNota(); }} placeholder="Escribe una nota de lo hablado con el cliente…" style={{ ...D.input, flex: 1 }} />
          <button style={{ ...D.btn, opacity: saving || !nota.trim() ? 0.5 : 1 }} onClick={agregarNota} disabled={saving || !nota.trim()}>{saving ? '…' : 'Agregar'}</button>
        </div>
        {(data.activities || []).map((a: any) => (
          <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #f4f4f4' }}>
            <div style={{ fontSize: '0.72rem', color: '#999' }}>{new Date(a.created_at).toLocaleString('es-MX')} · {a.tipo}</div>
            <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{a.titulo}</div>
            {a.descripcion && a.descripcion !== a.titulo && <div style={{ fontSize: '0.76rem', color: '#666' }}>{a.descripcion}</div>}
          </div>
        ))}
        {!(data.activities || []).length && <div style={{ color: '#999', fontSize: '0.8rem' }}>Sin notas todavía — la primera conversación se registra aquí.</div>}
      </div>
    </div>
  );
}
