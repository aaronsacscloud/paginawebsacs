// Pagos — LA CASA DEL DINERO. Un solo módulo con las tres caras del mismo cobro,
// porque son el mismo trabajo visto en tres momentos del ciclo:
//
//   Por cobrar   · lo que falta por entrar: vencidos y próximos, con qué cobrarlos.
//   Recibidos    · lo que ya entró: historial, conciliación y movimiento de MRR.
//   Recuperación · lo vencido que hay que perseguir (era la pestaña "Cobranza").
//
// Antes Cobranza era una pestaña aparte y "Por cobrar" salía DUPLICADO en las dos
// pantallas, con dos diseños y dos criterios: la misma fila con "Abonar" en una y
// con gestión, promesa y parcialidades en la otra. Quien cobraba tenía que
// acordarse de en cuál de las dos estaba la acción que necesitaba.
//
// Las vistas cargan lo suyo cuando se abren: entrar a Pagos ya no dispara seis
// consultas de las que cinco no se van a ver.
import { useState, useEffect } from 'react';
import Cargando from './ui/Cargando';
import { S, RegistrarPagoModal } from './SubscriptionsTab';
import ClienteDrawer360 from './ClienteDrawer360';
import CobranzaTab from './CobranzaTab';
import { useIsMobile } from '../../../lib/ui/mobile';

type Vista = 'cobrar' | 'recibidos' | 'recuperacion';
const VISTAS: { id: Vista; label: string; sub: string }[] = [
  { id: 'cobrar', label: 'Por cobrar', sub: 'lo que falta por entrar' },
  { id: 'recibidos', label: 'Recibidos', sub: 'lo que ya entró' },
  { id: 'recuperacion', label: 'Recuperación', sub: 'lo vencido que hay que perseguir' },
];
/** La vista se lee de la URL para que los enlaces viejos a Cobranza sigan sirviendo. */
function vistaInicial(): Vista {
  if (typeof window === 'undefined') return 'cobrar';
  const v = new URLSearchParams(window.location.search).get('vista');
  return (VISTAS.some(x => x.id === v) ? v : 'cobrar') as Vista;
}

const fmt = (n: number) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);

// `mercadopago` es el método con el que el webhook registra los cobros: sin él
// en estas tablas, el tipo salía crudo y sin filtro propio justo para los pagos
// que más entran solos.
const METODOS = ['mercadopago', 'transferencia', 'tarjeta', 'stripe', 'efectivo', 'oxxo', 'otro'];
const METODO_LABEL: Record<string, string> = { mercadopago: 'Mercado Pago', transferencia: 'Transferencia', tarjeta: 'Tarjeta', stripe: 'Stripe', efectivo: 'Efectivo', oxxo: 'OXXO', otro: 'Otro' };
const METODO_COLOR: Record<string, string> = { mercadopago: '#009ee3', transferencia: '#2563eb', tarjeta: '#7c3aed', stripe: '#635bff', efectivo: '#16a34a', oxxo: '#dc2626', otro: '#6b7280' };

// Semáforo de mora: 1-7 días ámbar, 8-30 naranja, +30 rojo.
function moraBadge(dias: number) {
  const [bg, fg] = dias >= 30 ? ['#fde8e8', '#b93333'] : dias >= 8 ? ['#ffedd5', '#c2410c'] : ['#fef3c7', '#b45309'];
  return { background: bg, color: fg, padding: '2px 8px', borderRadius: 6, fontWeight: 700 as const, fontSize: 11 };
}

export default function PagosTab() {
  const isMobile = useIsMobile();
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [summary, setSummary] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [porTipo, setPorTipo] = useState<Record<string, { count: number; monto: number }>>({});
  const [total, setTotal] = useState(0);
  const [recon, setRecon] = useState<any>(null);
  // Cobros de Mercado Pago que NO terminaron en un pago: rebotes y dinero sin
  // dueño. Viven en su propia bitácora, así que aquí no se ven si no se piden.
  const [mp, setMp] = useState<any>(null);
  const [mrrMov, setMrrMov] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPago, setShowPago] = useState(false);
  const [pagoPrefill, setPagoPrefill] = useState<any>(null);
  const [drawerCompany, setDrawerCompany] = useState<string | null>(null);
  const [fMetodo, setFMetodo] = useState('');
  const [fQ, setFQ] = useState('');
  const [toast, setToast] = useState('');

  // Dunning — genera un link de pago Stripe para el cobro y lo copia/abre.
  const linkPago = async (subscription_id: string, monto: number) => {
    setToast('Generando link de pago…');
    try {
      const r = await fetch('/api/crm/arr/stripe-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id, monto }) });
      const d = await r.json();
      if (d.url) {
        try { await navigator.clipboard.writeText(d.url); } catch { /* clipboard puede fallar sin https/permiso */ }
        window.open(d.url, '_blank');
        setToast('Link de pago copiado y abierto en otra pestaña.');
      } else setToast(d.error || 'No se pudo generar el link (¿Stripe configurado?).');
    } catch { setToast('Error generando el link de pago.'); }
    setTimeout(() => setToast(''), 4000);
  };

  // Conciliación — liga los pagos sin contacto al contacto principal de su empresa.
  const ligarHuerfanos = async () => {
    setToast('Ligando pagos a sus contactos…');
    try {
      const r = await fetch('/api/crm/arr/ligar-huerfanos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      setToast(d.ok ? `${d.ligados} pago(s) ligado(s)${d.sin_contacto_empresa ? ` · ${d.sin_contacto_empresa} sin contacto en su empresa` : ''}.` : (d.error || 'No se pudo ligar.'));
      loadAll();
    } catch { setToast('Error al ligar.'); }
    setTimeout(() => setToast(''), 4500);
  };

  const loadPayments = () => {
    const p = new URLSearchParams();
    if (fMetodo) p.set('metodo', fMetodo);
    if (fQ) p.set('q', fQ);
    p.set('limit', '200');
    return fetch('/api/crm/arr/payments?' + p.toString()).then(r => r.json()).then(d => {
      setPayments(d.payments || []); setPorTipo(d.porTipo || {}); setTotal(d.total || 0);
    }).catch(() => {});
  };

  // Lo que SIEMPRE hace falta: los KPIs y el conteo de cada vista salen de aquí.
  const loadBase = () => Promise.all([
    fetch('/api/crm/arr/summary').then(r => r.json()).then(setSummary).catch(() => {}),
    fetch('/api/crm/arr/subscriptions').then(r => r.json()).then(d => setSubs(d.data || [])).catch(() => {}),
    // Sin escanear=1: lectura barata de la bitácora, no una salida a MP.
    fetch('/api/crm/arr/mp-cobros?dias=90').then(r => r.json()).then(setMp).catch(() => {}),
  ]);

  // Lo de "Recibidos": solo cuando esa vista se abre.
  const loadRecibidos = () => Promise.all([
    loadPayments(),
    fetch('/api/crm/arr/reconciliacion').then(r => r.json()).then(setRecon).catch(() => {}),
    fetch('/api/crm/arr/mrr-movimiento?meses=6').then(r => r.json()).then(setMrrMov).catch(() => {}),
  ]);

  const loadAll = () => {
    setLoading(true);
    const tareas: Promise<any>[] = [loadBase()];
    if (vista === 'recibidos') tareas.push(loadRecibidos());
    Promise.all(tareas).finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); loadBase().finally(() => setLoading(false)); }, []);
  // Al abrir "Recibidos" por primera vez se traen sus datos; después ya están.
  useEffect(() => { if (vista === 'recibidos' && !recon) loadRecibidos(); }, [vista]);
  useEffect(() => { if (vista !== 'recibidos') return; const t = setTimeout(loadPayments, 300); return () => clearTimeout(t); }, [fMetodo, fQ, vista]);

  // La vista viaja en la URL: se puede compartir el enlace y el botón "atrás"
  // del navegador hace lo que se espera.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    if (vista === 'cobrar') u.searchParams.delete('vista'); else u.searchParams.set('vista', vista);
    window.history.replaceState({}, '', u);
  }, [vista]);

  const vencidas: any[] = summary?.vencidas || [];
  const proximos: any[] = (summary?.meses?.[0]?.cobros || []).filter((c: any) => c.fecha >= today());
  const totalPorCobrar = [...vencidas, ...proximos].reduce((a, v) => a + (Number(v.monto) || 0), 0);

  // Por qué está vencida. Una suscripción domiciliada que aparece vencida casi
  // siempre es una tarjeta que rebotó, no un cliente que no quiso pagar: sin el
  // motivo aquí, se le persigue por teléfono cuando lo que hay que hacer es
  // pedirle otra tarjeta. Se toma el rebote más reciente de esa suscripción.
  const rechazos: any[] = mp?.rechazos || [];
  const rechazoDe = (subscription_id: string) => rechazos
    .filter(r => r.subscription_id === subscription_id)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
  const sinIdentificar: any[] = mp?.sin_identificar || [];

  // Quién es, con lo mejor que haya: el cliente ligado, si no el titular de la
  // tarjeta, si no el correo, si no lo que diga el cobro en Mercado Pago.
  // "sin identificar" solo cuando de verdad no hay NADA.
  const quienEs = (c: any) => c.companies?.nombre || c.payer_nombre || c.payer_email || c.descripcion || 'sin identificar';

  // Le pregunta a Mercado Pago por los cobros anónimos: correo del pagador,
  // titular, últimos 4 y de qué suscripción salió.
  const [identificando, setIdentificando] = useState(false);
  const identificarEnMP = async () => {
    setIdentificando(true);
    try {
      const d = await fetch('/api/crm/arr/mp-cobros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enriquecer: true, dias: 90 }),
      }).then(r => r.json());
      setToast(d.error ? d.error
        : `Revisé ${d.revisados} cobro(s) · ${d.con_datos} con datos del pagador · ${d.ligados} ligado(s) a su suscripción.`);
      loadAll();
    } catch { setToast('No se pudo consultar Mercado Pago.'); }
    setIdentificando(false);
    setTimeout(() => setToast(''), 6000);
  };

  const abonar = (subscription_id: string) => { setPagoPrefill({ subscription_id }); setShowPago(true); };

  if (loading && !summary) return <Cargando texto="Cargando pagos…" />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Pagos</h2>
          <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>El dinero de las licencias, de principio a fin: lo que falta por entrar, lo que ya entró y lo que hay que perseguir.</div>
        </div>
        <button onClick={() => { setPagoPrefill(null); setShowPago(true); }} style={{ ...S.btn, background: '#2AB5A0', color: '#fff' }}>+ Registrar pago</button>
      </div>

      {/* ── Las tres vistas del mismo cobro ──
          Con su conteo al lado: el número es lo que decide a cuál entrar. */}
      <div className="crm-scroll-x" style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #ececf2', paddingBottom: 0 }}>
        {VISTAS.map(v => {
          const activa = vista === v.id;
          const badge = v.id === 'cobrar' ? (vencidas.length + proximos.length) || null
            : v.id === 'recuperacion' ? (vencidas.length || null)
            : null;
          return (
            <button key={v.id} onClick={() => setVista(v.id)} title={v.sub}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                padding: '9px 4px', marginRight: 10, display: 'flex', alignItems: 'center', gap: 7,
                fontSize: '0.86rem', fontWeight: activa ? 800 : 600,
                color: activa ? '#5B4BD6' : '#83808e',
                borderBottom: activa ? '2px solid #9B8CFA' : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap',
              }}>
              {v.label}
              {badge ? (
                <span style={{
                  background: v.id === 'recuperacion' ? '#FEF0EF' : '#EEECFE',
                  color: v.id === 'recuperacion' ? '#C0554E' : '#5B4BD6',
                  borderRadius: 20, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 800,
                }}>{badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Recuperación: la antigua pestaña de Cobranza, ya adentro ── */}
      {vista === 'recuperacion' && <CobranzaTab embebido />}

      {/* ── KPIs / pronóstico ── */}
      {vista === 'cobrar' && summary?.kpis && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={S.kpi}>
            <div style={S.kLabel}>ARR activo</div>
            <div style={S.kValue}>{fmt(summary.kpis.arr_activo || 0)}</div>
            {summary.meta?.monto ? <div style={S.kSub}>{Math.round(100 * (summary.kpis.arr_activo || 0) / Number(summary.meta.monto))}% de la meta {fmt(Number(summary.meta.monto))}</div> : null}
          </div>
          <div style={S.kpi}>
            <div style={S.kLabel}>Por cobrar</div>
            <div style={S.kValue}>{fmt(totalPorCobrar)}</div>
            <div style={{ ...S.kSub, color: vencidas.length ? '#b93333' : '#999' }}>{fmt(vencidas.reduce((a, v) => a + (Number(v.monto) || 0), 0))} vencido · {vencidas.length} cuentas</div>
          </div>
          <div style={S.kpi}>
            <div style={S.kLabel}>Cobranza esperada · 12m</div>
            <div style={S.kValue}>{fmt((summary.meses || []).reduce((a: number, m: any) => a + (Number(m.contratado) || 0), 0))}</div>
            <div style={S.kSub}>proyección de suscripciones activas</div>
          </div>
        </div>
      )}

      {/* ── Por cobrar (vencidos + próximos) ── */}
      {vista === 'cobrar' && (
      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Por cobrar
          <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}> · {vencidas.length + proximos.length} cobros · {fmt(totalPorCobrar)}</span>
        </div>
        {(vencidas.length === 0 && proximos.length === 0) ? (
          <div style={{ color: '#16a34a', fontSize: 14 }}>✓ No hay cobros pendientes ni vencidos.</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vencidas.map((v) => (
              <div key={'v' + v.subscription_id} style={{ border: '1px solid #f0e0e0', borderRadius: 10, padding: 12, background: '#fffafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={moraBadge(v.dias_vencida)}>Vencido {v.dias_vencida}d</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1rem' }}>{fmt(v.monto)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.empresa}</div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>{v.plan} · {v.ciclo}{v.cuenta && v.cuenta !== v.empresa ? ` · ${v.cuenta}` : ''} · vence {fmtDate(v.vencida_desde)}</div>
                {(() => { const r = rechazoDe(v.subscription_id); return r ? (
                  <div style={{ fontSize: '0.72rem', color: '#b93333', marginTop: 4 }}>🔁 Mercado Pago no pudo cobrarle: {r.motivo || 'tarjeta rechazada'}</div>
                ) : null; })()}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => abonar(v.subscription_id)} style={{ ...S.btnSmall, flex: 1, minHeight: 44, background: '#2AB5A0', color: '#fff', border: 'none' }}>Abonar</button>
                  <button onClick={() => linkPago(v.subscription_id, v.monto)} style={{ ...S.btnSmall, minHeight: 44, padding: '0 16px' }} title="Generar link de pago Stripe">🔗 Link</button>
                </div>
              </div>
            ))}
            {proximos.map((c) => (
              <div key={'p' + c.subscription_id} style={{ border: '1px solid #eef0f4', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ background: '#eef4ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>Próximo</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1rem' }}>{fmt(c.monto)}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.empresa}</div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>{c.plan} · {c.ciclo}{c.cuenta && c.cuenta !== c.empresa ? ` · ${c.cuenta}` : ''} · {fmtDate(c.fecha)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => abonar(c.subscription_id)} style={{ ...S.btnSmall, flex: 1, minHeight: 44, background: '#eef7f5', color: '#2AB5A0', border: '1px solid #cdeae4' }}>Abonar</button>
                  <button onClick={() => linkPago(c.subscription_id, c.monto)} style={{ ...S.btnSmall, minHeight: 44, padding: '0 16px' }} title="Generar link de pago Stripe">🔗 Link</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="crm-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Estado', 'Empresa', 'Concepto', 'Vence', 'Monto', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {vencidas.map((v) => (
                <tr key={'v' + v.subscription_id}>
                  <td style={S.td}><span style={moraBadge(v.dias_vencida)}>Vencido {v.dias_vencida}d</span></td>
                  <td style={S.td}>{v.empresa}{v.cuenta && v.cuenta !== v.empresa ? <div style={{ fontSize: '0.7rem', color: '#999' }}>{v.cuenta}</div> : null}</td>
                  <td style={S.td}>{v.plan} <span style={{ color: '#999' }}>· {v.ciclo}</span>
                    {(() => { const r = rechazoDe(v.subscription_id); return r ? (
                      <div style={{ fontSize: '0.7rem', color: '#b93333' }} title={r.detalle_estado || ''}>🔁 MP no pudo cobrarle: {r.motivo || 'tarjeta rechazada'}</div>
                    ) : null; })()}
                  </td>
                  <td style={{ ...S.td, color: '#b93333' }}>{fmtDate(v.vencida_desde)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(v.monto)}</td>
                  <td style={S.td}><div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abonar(v.subscription_id)} style={{ ...S.btnSmall, background: '#2AB5A0', color: '#fff', border: 'none' }}>Abonar</button>
                    <button onClick={() => linkPago(v.subscription_id, v.monto)} style={S.btnSmall} title="Generar link de pago Stripe">🔗 Link</button>
                  </div></td>
                </tr>
              ))}
              {proximos.map((c) => (
                <tr key={'p' + c.subscription_id}>
                  <td style={S.td}><span style={{ background: '#eef4ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>Próximo</span></td>
                  <td style={S.td}>{c.empresa}{c.cuenta && c.cuenta !== c.empresa ? <div style={{ fontSize: '0.7rem', color: '#999' }}>{c.cuenta}</div> : null}</td>
                  <td style={S.td}>{c.plan} <span style={{ color: '#999' }}>· {c.ciclo}</span></td>
                  <td style={S.td}>{fmtDate(c.fecha)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.monto)}</td>
                  <td style={S.td}><div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abonar(c.subscription_id)} style={{ ...S.btnSmall, background: '#eef7f5', color: '#2AB5A0', border: '1px solid #cdeae4' }}>Abonar</button>
                    <button onClick={() => linkPago(c.subscription_id, c.monto)} style={S.btnSmall} title="Generar link de pago Stripe">🔗 Link</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      )}

      {/* ── Cobros de Mercado Pago que NO entraron ──
          Un rebote no aparece en el historial (no hubo pago) ni en "por cobrar"
          hasta que la fecha se pasa. Ese hueco es donde se pierden: el cargo
          falló hoy y nadie se entera hasta que alguien cuadra el mes. */}
      {vista === 'cobrar' && (rechazos.length > 0 || sinIdentificar.length > 0) && (
        <div style={{ ...S.card, borderLeft: '4px solid #b93333' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Cobros de Mercado Pago que no entraron
            <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}> · últimos 90 días</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ color: '#888', fontSize: 12.5, flex: '1 1 320px' }}>
              Lo que la pasarela intentó y falló, más el dinero que llegó sin dueño. Se resuelve en Cobro con Mercado Pago.
            </div>
            {/* Un rebote que no dice de quién es no se puede cobrar. Esto le
                pregunta a Mercado Pago por el titular, la tarjeta y de qué
                suscripción salió — el aviso del webhook trae menos que el pago. */}
            <button onClick={identificarEnMP} disabled={identificando}
              style={{ ...S.btnSmall, background: '#009ee3', color: '#fff', border: 'none', padding: '7px 12px' }}
              title="Va a Mercado Pago por el correo, el titular, los últimos 4 y la suscripción de cada cobro anónimo">
              {identificando ? 'Preguntando a Mercado Pago…' : '🔎 Identificar en Mercado Pago'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={S.kpi}><div style={S.kLabel}>Rebotado</div><div style={{ ...S.kValue, color: rechazos.length ? '#b93333' : '#999' }}>{fmt(mp?.total_rechazado || 0)}</div>
              <div style={S.kSub}>{rechazos.length} intento(s) · {mp?.clientes_con_rechazo || 0} cliente(s) identificado(s)
                {mp?.rechazos_sin_dueno ? <span style={{ color: '#c2410c' }}> · {mp.rechazos_sin_dueno} sin dueño</span> : null}</div>
            </div>
            <div style={S.kpi}><div style={S.kLabel}>Cobrado sin dueño</div><div style={{ ...S.kValue, color: sinIdentificar.length ? '#c2410c' : '#999' }}>{fmt(mp?.total_sin_identificar || 0)}</div><div style={S.kSub}>{sinIdentificar.length} pago(s) por asignar</div></div>
          </div>
          {rechazos.slice(0, 8).map((r: any) => (
            <div key={r.id} onClick={() => r.company_id && setDrawerCompany(r.company_id)}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid #f4f4f4', cursor: r.company_id ? 'pointer' : 'default' }}>
              <span style={{ background: '#fde8e8', color: '#b93333', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, marginTop: 1 }}>Rebotó</span>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{quienEs(r)}</div>
                <div style={{ fontSize: 12.5, color: '#888' }}>
                  {r.subscriptions?.nombre_plan || r.descripcion || 'sin plan ligado'} · {r.motivo || 'rechazado'}
                  {r.tarjeta ? ` · ${r.tarjeta}` : ''}
                </div>
                {/* Contacto: lo único que convierte "rebotó $8,500" en algo que
                    se puede trabajar hoy. */}
                {(r.payer_email || r.payer_nombre) && (
                  <div style={{ fontSize: 12, color: '#666' }}>{[r.payer_nombre, r.payer_email].filter(Boolean).join(' · ')}</div>
                )}
                {!r.company_id && r.candidatos?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#c2410c' }}>Probablemente {r.candidatos[0].cliente} ({r.candidatos[0].porque.join(', ')})</div>
                )}
                {!r.company_id && !r.candidatos?.length && !r.payer_email && !r.payer_nombre && (
                  <div style={{ fontSize: 12, color: '#999' }}>Sin datos del pagador — dale a “Identificar en Mercado Pago”.</div>
                )}
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 'auto' }}>{fmt(r.monto)}</span>
              <span style={{ fontSize: 12, color: '#aaa', width: 74, textAlign: 'right' }}>{fmtDate(String(r.fecha || '').slice(0, 10))}</span>
            </div>
          ))}
          {sinIdentificar.slice(0, 6).map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid #f4f4f4' }}>
              <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, marginTop: 1 }}>Sin dueño</span>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{quienEs(c)}</div>
                <div style={{ fontSize: 12.5, color: '#888' }}>
                  {c.descripcion || 'sin descripción'}{c.tarjeta ? ` · ${c.tarjeta}` : ''}
                  {c.candidatos?.length ? ` · ${c.candidatos.length} candidato(s)` : ''}
                </div>
                {c.candidatos?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#c2410c' }}>Probablemente {c.candidatos[0].cliente} ({c.candidatos[0].porque.join(', ')})</div>
                )}
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 'auto' }}>{fmt(c.monto)}</span>
              <span style={{ fontSize: 12, color: '#aaa', width: 74, textAlign: 'right' }}>{fmtDate(String(c.fecha || '').slice(0, 10))}</span>
            </div>
          ))}
          {(rechazos.length > 8 || sinIdentificar.length > 6) && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Se muestran los más recientes · el resto está en Cobro con Mercado Pago.</div>
          )}
        </div>
      )}

      {/* ── Historial de pagos ── */}
      {vista === 'recibidos' && (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Historial de pagos <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}>· {total}</span></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...(isMobile ? { width: '100%' } : {}) }}>
            <input placeholder="Buscar referencia…" value={fQ} onChange={e => setFQ(e.target.value)} style={{ ...S.input, ...(isMobile ? { flex: '1 1 100%', width: '100%' } : { width: 170 }) }} />
            <select value={fMetodo} onChange={e => setFMetodo(e.target.value)} style={{ ...S.input, ...(isMobile ? { flex: 1 } : {}) }}>
              <option value="">Todos los tipos</option>
              {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
          </div>
        </div>

        {/* resumen por tipo (clic = filtra) */}
        {Object.keys(porTipo).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(porTipo).sort((a, b) => b[1].monto - a[1].monto).map(([m, v]) => (
              <span key={m} onClick={() => setFMetodo(fMetodo === m ? '' : m)}
                style={{ cursor: 'pointer', border: `1px solid ${fMetodo === m ? (METODO_COLOR[m] || '#888') : '#e5e7eb'}`, background: fMetodo === m ? (METODO_COLOR[m] || '#888') + '14' : '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 12 }}>
                <b style={{ color: METODO_COLOR[m] || '#374151' }}>{METODO_LABEL[m] || m}</b> · {v.count} · {fmt(v.monto)}
              </span>
            ))}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>Sin pagos con estos filtros.</div>
            ) : payments.map((p) => {
              const contacto = p.contacts ? `${p.contacts.nombre || ''} ${p.contacts.apellido || ''}`.trim() : '';
              const empresa = p.companies?.nombre || '';
              const compId = p.companies?.id;
              return (
                <div key={p.id} onClick={() => compId && setDrawerCompany(compId)} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 12, cursor: compId ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.78rem', color: '#666' }}>{fmtDate(p.fecha)}</span>
                    <span style={{ color: METODO_COLOR[p.metodo] || '#374151', fontWeight: 700, fontSize: 12 }}>{METODO_LABEL[p.metodo] || p.metodo}</span>
                    {p.metodo === 'mercadopago' && p.subscriptions?.mp_preapproval_id && (
                      <span style={{ background: 'rgba(0,158,227,0.10)', color: '#0284c7', padding: '1px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 }}>🔁 auto</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '0.95rem' }}>{fmt(p.monto)}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', marginTop: 4 }}>{contacto || empresa || '—'}{contacto && empresa ? <span style={{ color: '#999', fontWeight: 400 }}> · {empresa}</span> : null}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, fontSize: '0.75rem', color: '#888' }}>
                    <span>{p.subscriptions?.nombre_plan || '—'}{p.subscriptions?.ciclo ? ` · ${p.subscriptions.ciclo}` : ''}</span>
                    <span style={{ marginLeft: 'auto' }}>{p.numero_acuse
                      ? <a href={`/acuse/${p.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'none' }} title="Ver / imprimir recibo">🧾 {p.numero_acuse}</a>
                      : <span>Ref: {p.referencia || '—'}</span>}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Fecha', 'Contacto / Empresa', 'Tipo', 'Concepto', 'Referencia', 'Monto'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999', padding: 24 }}>Sin pagos con estos filtros.</td></tr>
            ) : payments.map((p) => {
              const contacto = p.contacts ? `${p.contacts.nombre || ''} ${p.contacts.apellido || ''}`.trim() : '';
              const empresa = p.companies?.nombre || '';
              const compId = p.companies?.id;
              return (
                <tr key={p.id} onClick={() => compId && setDrawerCompany(compId)} style={{ cursor: compId ? 'pointer' : 'default' }}>
                  <td style={S.td}>{fmtDate(p.fecha)}</td>
                  <td style={S.td}>{contacto || empresa || '—'}{contacto && empresa ? <span style={{ color: '#999' }}> · {empresa}</span> : null}</td>
                  <td style={S.td}>
                    <span style={{ color: METODO_COLOR[p.metodo] || '#374151', fontWeight: 700, fontSize: 12 }}>{METODO_LABEL[p.metodo] || p.metodo}</span>
                    {/* Se cobró solo: la sub está domiciliada, nadie mandó un link. */}
                    {p.metodo === 'mercadopago' && p.subscriptions?.mp_preapproval_id && (
                      <span style={{ marginLeft: 6, background: 'rgba(0,158,227,0.10)', color: '#0284c7', padding: '1px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 }} title="Cargo automático: el cliente autorizó la domiciliación">🔁 auto</span>
                    )}
                  </td>
                  <td style={S.td}>{p.subscriptions?.nombre_plan || '—'}{p.subscriptions?.ciclo ? <span style={{ color: '#999' }}> · {p.subscriptions.ciclo}</span> : null}</td>
                  <td style={S.td}>{p.numero_acuse
                    ? <a href={`/acuse/${p.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2563eb', textDecoration: 'none' }} title="Ver / imprimir recibo">🧾 {p.numero_acuse}</a>
                    : <span style={{ color: '#888' }}>{p.referencia || '—'}</span>}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(p.monto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        )}
      </div>
      )}

      {/* ── Conciliación (proveniencia: manual vs Stripe + huérfanos) ── */}
      {vista === 'recibidos' && recon && (
        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Conciliación de pagos <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}>· {recon.total} en total</span></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={S.kpi}><div style={S.kLabel}>Registrados a mano</div><div style={S.kValue}>{fmt(recon.por_fuente.manual.monto)}</div><div style={S.kSub}>{recon.por_fuente.manual.count} pagos</div></div>
            <div style={S.kpi}><div style={S.kLabel}>Vía Stripe</div><div style={S.kValue}>{fmt(recon.por_fuente.stripe.monto)}</div><div style={S.kSub}>{recon.por_fuente.stripe.count} pagos</div></div>
          </div>
          {recon.n_stripe_sin_sub > 0 ? (
            <div style={{ marginBottom: 10, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 6 }}>⚠️ {recon.n_stripe_sin_sub} pago(s) de Stripe sin licencia ligada</div>
              {recon.stripe_sin_sub.slice(0, 8).map((p: any) => (
                <div key={p.id} style={{ fontSize: 12.5, color: '#92400e', padding: '3px 0' }}>{fmtDate(p.fecha)} · {p.companies?.nombre || '—'} · {fmt(p.monto)}</div>
              ))}
            </div>
          ) : null}
          {recon.n_sin_contacto > 0 ? (
            <div style={{ fontSize: 13, color: '#b45309', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>⚠️ {recon.n_sin_contacto} pago(s) sin contacto ligado — no aparecen en el 360 de un contacto.</span>
              <button onClick={ligarHuerfanos} style={{ ...S.btnSmall, background: '#2563eb', color: '#fff', border: 'none' }}>Ligar automáticamente</button>
            </div>
          ) : null}
          {recon.n_stripe_sin_sub === 0 && recon.n_sin_contacto === 0 && (
            <div style={{ color: '#16a34a', fontSize: 14 }}>✓ Todo conciliado: cada pago tiene fuente, licencia y contacto.</div>
          )}
        </div>
      )}

      {/* ── Movimiento de MRR (nuevo / churn / neto) ── */}
      {vista === 'recibidos' && mrrMov?.meses?.length ? (() => {
        const meses = mrrMov.meses;
        const max = Math.max(1, ...meses.map((m: any) => Math.max(m.nuevo, m.churn)));
        const mesLabel = (ym: string) => new Date(ym + '-15T12:00:00').toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        return (
          <div style={S.card}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Movimiento de MRR <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}>· últimos {meses.length} meses</span></div>
            <div style={{ color: '#888', fontSize: 12.5, marginBottom: 14 }}>Nuevo (altas) vs churn (bajas) por mes. Neto = crecimiento recurrente real.</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={S.kpi}><div style={S.kLabel}>Nuevo · periodo</div><div style={{ ...S.kValue, color: '#16a34a' }}>+{fmt(mrrMov.totales.nuevo)}</div></div>
              <div style={S.kpi}><div style={S.kLabel}>Churn · periodo</div><div style={{ ...S.kValue, color: '#b93333' }}>−{fmt(mrrMov.totales.churn)}</div></div>
              <div style={S.kpi}><div style={S.kLabel}>Neto · periodo</div><div style={{ ...S.kValue, color: mrrMov.totales.neto >= 0 ? '#16a34a' : '#b93333' }}>{mrrMov.totales.neto >= 0 ? '+' : '−'}{fmt(Math.abs(mrrMov.totales.neto))}</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 120, borderBottom: '1px solid #eee', paddingBottom: 2 }}>
              {meses.map((m: any) => (
                <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                    <div title={`Nuevo ${fmt(m.nuevo)}`} style={{ width: 14, height: Math.round(100 * m.nuevo / max), background: '#16a34a', borderRadius: '3px 3px 0 0', minHeight: m.nuevo ? 2 : 0 }} />
                    <div title={`Churn ${fmt(m.churn)}`} style={{ width: 14, height: Math.round(100 * m.churn / max), background: '#dc2626', borderRadius: '3px 3px 0 0', minHeight: m.churn ? 2 : 0 }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>{mesLabel(m.mes)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#666' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#16a34a', borderRadius: 2, marginRight: 5 }} />Nuevo</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#dc2626', borderRadius: 2, marginRight: 5 }} />Churn</span>
            </div>
          </div>
        );
      })() : null}

      {showPago && <RegistrarPagoModal subs={subs as any} prefill={pagoPrefill} onClose={() => { setShowPago(false); setPagoPrefill(null); }} onDone={() => { setShowPago(false); setPagoPrefill(null); loadAll(); }} />}
      {drawerCompany && <ClienteDrawer360 companyId={drawerCompany} onClose={() => setDrawerCompany(null)} onChanged={loadAll} />}
      {toast && <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{toast}</div>}
    </div>
  );
}
