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
import KpiCard from './ui/KpiCard';
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

/**
 * Cómo se llama el cliente en pantalla.
 *
 * `nombre` casi siempre trae el slug de la cuenta —"supercarnesriveramx"— en
 * 125 de 142 clientes. `nombre_comercial` ya lo trae partido en palabras
 * ("Super Carnes Rivera") y está lleno en 140 de 142. Se prefiere ese y el slug
 * baja a la segunda línea, que es donde sirve: para reconocer la cuenta.
 */
function nombreEmpresa(co: any): string {
  if (!co) return '';
  const com = String(co.nombre_comercial || '').trim();
  const n = String(co.nombre || '').trim();
  return com || n;
}

// Semáforo de mora: 1-7 días ámbar, 8-30 naranja, +30 rojo.
function moraBadge(dias: number) {
  const [bg, fg] = dias >= 30 ? ['#fde8e8', '#b93333'] : dias >= 8 ? ['#ffedd5', '#c2410c'] : ['#fef3c7', '#b45309'];
  return { background: bg, color: fg, padding: '2px 8px', borderRadius: 6, fontWeight: 700 as const, fontSize: 11 };
}

/**
 * Los tres puntitos de cada pago.
 *
 * La tabla se estaba llenando de columnas (contacto, referencia…) que en
 * realidad son ACCIONES, no datos que se comparen renglón contra renglón. Aquí
 * viven todas: el recibo, el estado de cuenta, mandarlo por WhatsApp, abrir la
 * ficha y dejar registrada la gestión. La tabla se queda con lo que sí se lee
 * de corrido: cuándo, quién, cómo, qué y cuánto.
 */
function BotonAcciones({ pago, onAbrir }: { pago: any; onAbrir: (m: any) => void }) {
  return (
    <button
      title="Más acciones"
      aria-label="Más acciones"
      onClick={(e) => {
        e.stopPropagation();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onAbrir({ pago, x: r.right, y: r.bottom + 4 });
      }}
      style={{
        border: '1px solid #e6e3ee', background: '#fff', borderRadius: 8, cursor: 'pointer',
        width: 30, height: 30, lineHeight: 1, color: '#6f6b7d', fontSize: 15, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>⋮</button>
  );
}

const TIPOS_GESTION = [
  { id: 'llamada', l: 'Llamada' },
  { id: 'whatsapp', l: 'WhatsApp' },
  { id: 'email', l: 'Correo' },
  { id: 'reunion', l: 'Reunión' },
  { id: 'nota', l: 'Nota interna' },
];

/**
 * Registrar una gestión sobre un pago: la llamada que se hizo, lo que el
 * cliente contestó, el acuerdo al que se llegó. Queda en la actividad del
 * cliente —el mismo timeline que ya lee todo el CRM— con el pago referenciado,
 * para que tres meses después se sepa por qué ese cobro fue como fue.
 */
function GestionModal({ pago, onCerrar, onListo }: { pago: any; onCerrar: () => void; onListo: (msg: string) => void }) {
  const [tipo, setTipo] = useState('llamada');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const empresa = nombreEmpresa(pago.companies) || 'este cliente';

  const guardar = async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      const etiqueta = TIPOS_GESTION.find(t => t.id === tipo)?.l || 'Gestión';
      const r = await fetch('/api/crm/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: pago.company_id || pago.companies?.id || null,
          contact_id: pago.contact_id || pago.contacts?.id || null,
          tipo: 'nota',
          titulo: `${etiqueta} sobre el pago de $${Number(pago.monto || 0).toLocaleString('es-MX')} del ${String(pago.fecha || '').slice(0, 10)}`,
          descripcion: texto.trim(),
          metadata: { gestion: tipo, payment_id: pago.id, numero_acuse: pago.numero_acuse || null, monto: pago.monto },
        }),
      });
      if (!r.ok) throw new Error();
      onListo('Gestión registrada en la actividad del cliente.');
      onCerrar();
    } catch { onListo('No se pudo guardar la gestión.'); }
    setGuardando(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 980, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 460, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Registrar gestión</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.78rem', color: '#7c7c86' }}>
            {empresa} · {fmt(pago.monto)} · {fmtDate(String(pago.fecha || '').slice(0, 10))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIPOS_GESTION.map(t => (
              <button key={t.id} onClick={() => setTipo(t.id)}
                style={{
                  border: '1.5px solid', borderColor: tipo === t.id ? '#9B8CFA' : '#e4dffb',
                  background: tipo === t.id ? '#EEECFE' : '#fff', color: tipo === t.id ? '#5B4BD6' : '#6f6b7d',
                  borderRadius: 20, padding: '5px 13px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t.l}</button>
            ))}
          </div>
          <textarea autoFocus value={texto} onChange={e => setTexto(e.target.value)} rows={4}
            placeholder="Qué se hizo y qué contestó el cliente…"
            style={{ border: '1.5px solid #e4dffb', borderRadius: 10, padding: '10px 12px', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', background: '#fdfcff' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onCerrar} style={{ ...S.btnSmall, padding: '8px 14px' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando || !texto.trim()}
              style={{ ...S.btnSmall, padding: '8px 16px', background: '#9B8CFA', color: '#fff', border: 'none', opacity: (guardando || !texto.trim()) ? 0.5 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  // Menú de acciones de un pago: posición fija con las coordenadas del botón.
  // Un panel `absolute` dentro de la tabla queda recortado por el overflow y
  // solo se ve el de la primera fila — ya pasó en la ficha del cliente.
  const [menuPago, setMenuPago] = useState<{ pago: any; x: number; y: number } | null>(null);
  const [gestionPago, setGestionPago] = useState<any>(null);
  // Las tarjetas de "Por cobrar" son filtros: al hacer clic recortan la lista
  // de abajo. Un número que no se puede abrir es un reporte, no un indicador.
  const [filtroCobrar, setFiltroCobrar] = useState<'' | 'semana' | 'vencido'>('');
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
  const montoVencido = vencidas.reduce((a: number, v: any) => a + (Number(v.monto) || 0), 0);

  // ── Lo que vence en los próximos 7 días ──
  // Contesta la pregunta con la que se abre la pantalla: a quién hay que
  // cobrarle esta semana. Se miran dos meses porque una semana que empieza el
  // 28 termina en el mes siguiente.
  const en7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const cobrosSemana: any[] = [...(summary?.meses?.[0]?.cobros || []), ...(summary?.meses?.[1]?.cobros || [])]
    .filter((c: any) => c.fecha >= today() && c.fecha <= en7);
  const montoSemana = cobrosSemana.reduce((a: number, c: any) => a + (Number(c.monto) || 0), 0);
  const cobrado = summary?.cobrado || null;

  // La lista de abajo obedece a la tarjeta que esté aplicada.
  const idsSemana = new Set(cobrosSemana.map((c: any) => c.subscription_id));
  const vencidasVis = filtroCobrar === 'semana' ? [] : vencidas;
  const proximosVis = filtroCobrar === 'vencido' ? []
    : filtroCobrar === 'semana' ? proximos.filter((c: any) => idsSemana.has(c.subscription_id))
    : proximos;

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
    // ── El mismo contenedor que Cotizaciones ──
    // Pagos se renderizaba a sangre: sin menú, el título quedaba pegado al
    // borde izquierdo y la tabla llegaba hasta la orilla derecha. El resto del
    // CRM usa este marco (máximo 1280, centrado, 24 de aire), y por eso las
    // pantallas se veían de dos anchos distintos según qué pestaña abrieras.
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
      {/* Las cinco tarjetas en rejilla, con los mismos cortes que Cobranza:
          nunca se apachurran ni se salen de la pantalla. */}
      <style>{`
        .pagos-kpis { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:10px; }
        @media (max-width: 1250px) { .pagos-kpis { grid-template-columns:repeat(3, minmax(0,1fr)); } }
        @media (max-width: 780px)  { .pagos-kpis { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 620px)  { .pagos-kpis { grid-template-columns:1fr; } }
      `}</style>
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
        <div className="pagos-kpis" style={{ marginBottom: 16 }}>
          <KpiCard label="ARR activo" franja="#9B8CFA" color="#5B4BD6"
            valor={fmt(summary.kpis.arr_activo || 0)}
            sub={summary.meta?.monto
              ? `${Math.round(100 * (summary.kpis.arr_activo || 0) / Number(summary.meta.monto))}% de la meta ${fmt(Number(summary.meta.monto))}`
              : `${summary.kpis.subs_activas || 0} licencias activas`} />

          {/* El único número que dice cuánto entró DE VERDAD. Todo lo demás en
              esta pantalla es lo que debería entrar. */}
          <KpiCard label="Cobrado este mes" franja="#4FBF95" color="#1E8A63"
            valor={fmt(cobrado?.mes || 0)}
            sub={<>
              {(cobrado?.mes_n || 0)} pago{(cobrado?.mes_n || 0) === 1 ? '' : 's'}
              {cobrado?.variacion_pct != null && (
                <span style={{ color: cobrado.variacion_pct >= 0 ? '#1E8A63' : '#C0554E', fontWeight: 700 }}>
                  {' · '}{cobrado.variacion_pct >= 0 ? '↑' : '↓'} {Math.abs(cobrado.variacion_pct)}% vs mes anterior
                </span>
              )}
            </>}
            onClick={() => setVista('recibidos')} />

          {/* El total. No es un filtro: es contra lo que se comparan los dos de
              la derecha, que sí recortan la lista. */}
          <KpiCard label="Por cobrar" franja="#9B8CFA" color="#5B4BD6"
            valor={fmt(totalPorCobrar)}
            sub={`${vencidas.length + proximos.length} cobros pendientes`} />

          {/* La pregunta con la que se abre la pantalla en lunes. */}
          <KpiCard label="Vence esta semana" franja="#E8A838" color="#1a1a1a"
            valor={fmt(montoSemana)}
            sub={`${cobrosSemana.length} cobro${cobrosSemana.length === 1 ? '' : 's'} en los próximos 7 días`}
            activo={filtroCobrar === 'semana'}
            onClick={() => setFiltroCobrar(filtroCobrar === 'semana' ? '' : 'semana')} />

          <KpiCard label="Vencido" franja="#EF7A72" color={vencidas.length ? '#C0554E' : '#1a1a1a'}
            valor={fmt(montoVencido)}
            sub={vencidas.length
              ? `${vencidas.length} cuenta${vencidas.length === 1 ? '' : 's'} · la más vieja, ${vencidas[0]?.dias_vencida || 0} días`
              : 'nadie debe nada'}
            activo={filtroCobrar === 'vencido'}
            onClick={vencidas.length ? () => setFiltroCobrar(filtroCobrar === 'vencido' ? '' : 'vencido') : undefined} />
        </div>
      )}

      {/* ── Por cobrar (vencidos + próximos) ── */}
      {vista === 'cobrar' && (
      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Por cobrar
          <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}> · {vencidasVis.length + proximosVis.length} cobros · {fmt([...vencidasVis, ...proximosVis].reduce((a, v) => a + (Number(v.monto) || 0), 0))}</span>
          {filtroCobrar && (
            <button onClick={() => setFiltroCobrar('')}
              style={{ ...S.btnSmall, marginLeft: 10, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
              {filtroCobrar === 'semana' ? 'Solo esta semana' : 'Solo vencidos'} ✕
            </button>
          )}
        </div>
        {(vencidasVis.length === 0 && proximosVis.length === 0) ? (
          <div style={{ color: '#16a34a', fontSize: 14 }}>✓ No hay cobros pendientes ni vencidos.</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vencidasVis.map((v: any) => (
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
            {proximosVis.map((c: any) => (
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
              {vencidasVis.map((v: any) => (
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
              {proximosVis.map((c: any) => (
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
              const empresa = nombreEmpresa(p.companies);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', minWidth: 0, flex: 1 }}>
                      {empresa || <span style={{ color: '#c0392b', fontWeight: 600 }}>Sin cliente</span>}
                    </div>
                    <div onClick={e => e.stopPropagation()}><BotonAcciones pago={p} onAbrir={setMenuPago} /></div>
                  </div>
                  <div style={{ marginTop: 3, fontSize: '0.75rem', color: '#888' }}>
                    {p.subscriptions?.nombre_plan || '—'}{p.subscriptions?.ciclo ? ` · ${p.subscriptions.ciclo}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Fecha', 'Empresa', 'Tipo', 'Concepto', 'Monto', ''].map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999', padding: 24 }}>Sin pagos con estos filtros.</td></tr>
            ) : payments.map((p) => {
              const empresa = nombreEmpresa(p.companies);
              const cuenta = p.companies?.sacs_account || '';
              const compId = p.companies?.id;
              return (
                <tr key={p.id} onClick={() => compId && setDrawerCompany(compId)} style={{ cursor: compId ? 'pointer' : 'default' }}>
                  <td style={S.td}>{fmtDate(p.fecha)}</td>
                  {/* La empresa manda: un clic abre su ficha con todo lo demás
                      —contacto, licencias, actividad—, así que no hace falta
                      una columna por dato. */}
                  <td style={S.td}>
                    {empresa ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{empresa}</div>
                        {cuenta && cuenta.toLowerCase() !== empresa.toLowerCase() && (
                          <div style={{ fontSize: '0.72rem', color: '#a3a3ab' }}>{cuenta}</div>
                        )}
                      </>
                    ) : <span style={{ color: '#c0392b', fontSize: '0.78rem' }}>Sin cliente</span>}
                  </td>
                  <td style={S.td}>
                    <span style={{ color: METODO_COLOR[p.metodo] || '#374151', fontWeight: 700, fontSize: 12 }}>{METODO_LABEL[p.metodo] || p.metodo}</span>
                    {/* Se cobró solo: la sub está domiciliada, nadie mandó un link. */}
                    {p.metodo === 'mercadopago' && p.subscriptions?.mp_preapproval_id && (
                      <span style={{ marginLeft: 6, background: 'rgba(0,158,227,0.10)', color: '#0284c7', padding: '1px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 }} title="Cargo automático: el cliente autorizó la domiciliación">🔁 auto</span>
                    )}
                  </td>
                  <td style={S.td}>{p.subscriptions?.nombre_plan || '—'}{p.subscriptions?.ciclo ? <span style={{ color: '#999' }}> · {p.subscriptions.ciclo}</span> : null}</td>
                  <td style={{ ...S.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(p.monto)}</td>
                  <td style={{ ...S.td, width: 44, textAlign: 'right' }}>
                    <BotonAcciones pago={p} onAbrir={setMenuPago} />
                  </td>
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

      {/* ── Más acciones de un pago ── */}
      {menuPago && (() => {
        const p = menuPago.pago;
        const compId = p.companies?.id || p.company_id || null;
        const edoCuenta = compId && typeof window !== 'undefined' ? `${window.location.origin}/estado-cuenta/cliente/${compId}` : '';
        const wa = String(p.contacts?.whatsapp || '').replace(/\D/g, '');
        const cerrar = () => setMenuPago(null);
        const item = (label: string, onClick: () => void, sub?: string, deshabilitado?: boolean) => (
          <button key={label} disabled={deshabilitado} onClick={() => { onClick(); cerrar(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
              padding: '9px 13px', fontSize: '0.8rem', fontFamily: 'inherit', color: deshabilitado ? '#c3c1cb' : '#3f3b4d',
              cursor: deshabilitado ? 'default' : 'pointer', borderRadius: 8,
            }}
            onMouseEnter={e => { if (!deshabilitado) (e.currentTarget as HTMLElement).style.background = '#f6f4fb'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            {label}
            {sub && <div style={{ fontSize: '0.68rem', color: '#a3a3ab', marginTop: 1 }}>{sub}</div>}
          </button>
        );
        return (
          <>
            <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 970 }} />
            <div style={{
              position: 'fixed', top: Math.min(menuPago.y, (typeof window !== 'undefined' ? window.innerHeight : 900) - 250),
              left: Math.max(12, menuPago.x - 232), width: 232, zIndex: 971,
              background: '#fff', border: '1px solid #e9e6f1', borderRadius: 12, padding: 5,
              boxShadow: '0 14px 40px rgba(16,24,40,.16)',
            }}>
              {item('Estado de cuenta', () => {
                window.open(edoCuenta, '_blank', 'noopener');
                try { navigator.clipboard?.writeText(edoCuenta); } catch { /* sin https no hay portapapeles */ }
                setToast('Estado de cuenta abierto · link copiado'); setTimeout(() => setToast(''), 3500);
              }, 'Se abre para ver, imprimir o guardar', !compId)}
              {item('Enviar por WhatsApp', () => {
                window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, te comparto tu estado de cuenta SACS:\n${edoCuenta}`)}`, '_blank', 'noopener');
              }, wa ? undefined : 'El contacto no tiene WhatsApp', !compId || !wa)}
              {item('Ver recibo', () => window.open(`/acuse/${p.id}`, '_blank', 'noopener'),
                p.numero_acuse || 'Este pago no tiene acuse', !p.numero_acuse)}
              <div style={{ height: 1, background: '#f2f0f7', margin: '4px 8px' }} />
              {item('Registrar gestión', () => setGestionPago(p), 'Llamada, WhatsApp, acuerdo…', !compId)}
              {item('Abrir ficha del cliente', () => compId && setDrawerCompany(compId), undefined, !compId)}
            </div>
          </>
        );
      })()}

      {gestionPago && <GestionModal pago={gestionPago} onCerrar={() => setGestionPago(null)}
        onListo={(m) => { setToast(m); setTimeout(() => setToast(''), 4000); }} />}

      {showPago && <RegistrarPagoModal subs={subs as any} prefill={pagoPrefill} onClose={() => { setShowPago(false); setPagoPrefill(null); }} onDone={() => { setShowPago(false); setPagoPrefill(null); loadAll(); }} />}
      {drawerCompany && <ClienteDrawer360 companyId={drawerCompany} onClose={() => setDrawerCompany(null)} onChanged={loadAll} />}
      {toast && <div className="crm-toast-bottom" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>{toast}</div>}
    </div>
  );
}
