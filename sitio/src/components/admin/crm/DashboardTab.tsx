// Tablero del CRM.
//
// Razona por MES. Abre en el mes corriente y el otro botón son fechas a mano;
// no hay presets de 7/30/90 días porque el negocio se cierra por mes y un
// rango que cruza dos meses no contesta ninguna pregunta.
//
// Tres preguntas mandan y ocupan la primera pantalla:
//   ¿Cuánto cobré?   ¿Cuánto tengo sobre la mesa?   ¿Cuánto generé?
// Lo cobrado pesa el doble —ancho y gráfica grande— porque es el único de los
// tres que ya es dinero. Debajo, el motor recurrente, el embudo y el tiempo;
// hasta abajo lo que solo se consulta.
//
// Las gráficas son SVG a mano: cuatro formas simples no justifican traer una
// librería de 90 KB a una pantalla que abre en cada sesión. Cada una responde
// una pregunta concreta —ritmo, composición, caída, mezcla— y ninguna está de
// adorno.
//
// Cada número trae una línea que dice QUÉ es, con el dato propio adentro: no
// "el NRR mide expansión neta", sino "de cada $100 que te pagaban, hoy te
// pagan $98". Un tablero que hay que saber leer no lo lee nadie. Y lo que no
// se puede calcular se dice: un número inventado en una pantalla que puede ver
// un inversionista es peor que un hueco.
import { useEffect, useState, Suspense } from 'react';
import { lazySeguro } from '../../../lib/ui/lazySeguro';
const LeadsDashboard = lazySeguro(() => import('./LeadsDashboard'));
import { WRAP } from '../../../lib/crm/layout';
import ClienteDrawer360 from './ClienteDrawer360';
import Cargando from './ui/Cargando';
import { useLeadsActivos, ListaLeadsActivos, FiltrosActivos, DrawerLead, ParaRescatarLista, EmpresasActivas, EfectividadSeguimiento, RangoDias, aplicarFiltro, rutaConversacion, type LeadActivo } from './LeadsActivos';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
// Los millones de la cartera no caben en una tarjeta; los pesos del negocio sí.
const corto = (n?: number | null) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 1000000) return '$' + (Number(n) / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return (Number(n) < 0 ? '−$' : '$') + Math.round(v / 1000) + 'K';
  return (Number(n) < 0 ? '−$' : '$') + Math.round(v);
};
// Con signo delante del peso: toLocaleString deja "$-54,700", que se lee mal.
const conSigno = (n: number) => (n < 0 ? '−' : '+') + '$' + Math.abs(Math.round(n)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const inicioDeMes = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };

const MORADO = '#5B4BD6', LILA = '#9B8CFA', VERDE = '#1E8A63', MENTA = '#4FBF95';
/* El tablero vive entre ROSAS Y MORADOS. El azul era un color de dato
   heredado y aquí no significaba nada, así que se va: donde había cielo ahora
   hay lila y donde había azul tinta hay morado. Verde y rojo se quedan SOLO
   donde el significado no se negocia —dinero que entró, dinero que se perdió—
   y por eso aparecen en muy pocos lugares. */
const AMBAR = '#C98A12', ORO = '#F0B84E', AZUL = '#6B4FD6', CIELO = '#B7A6FB', ROJO = '#C0554E';
const ROSA = '#D9538E', ROSA_S = '#EFA6CA', ROSA_T = '#9c3d70';

const S = {
  wrap: WRAP,
  /* La tarjeta FLOTA sobre el papel rosa: borde lila casi transparente,
     esquina de 16 y una sombra larga y suave. El borde gris y la esquina de 14
     eran del tablero viejo, cuando el fondo era blanco y la tarjeta tenía que
     dibujarse sola. */
  /* La tarjeta es una COLUMNA y llena el alto de su renglón. Así dos tarjetas
     lado a lado terminan a la misma altura en vez de dejar un escalón de fondo
     rosa entre una y otra; el aire sobrante se reparte adentro, donde se lee
     como respiro y no como un hueco. */
  card: { background: '#fff', border: '1px solid rgba(155,140,250,.14)', borderRadius: 16, padding: '19px 21px',
          boxShadow: '0 1px 2px rgba(60,30,140,.04), 0 10px 30px rgba(155,140,250,.10)',
          display: 'flex', flexDirection: 'column' as const, height: '100%' } as const,
  titulo: { fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.09em', display: 'flex', alignItems: 'center', gap: 9 } as const,
  der: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  lead: { fontSize: '0.73rem', color: '#8a8590', margin: '5px 0 15px', lineHeight: 1.55 } as const,
  /* La nota explicativa SIEMPRE al pie de su tarjeta: es lo que cierra el
     bloque, y con `auto` el sobrante de altura queda arriba de ella. */
  nota: { fontSize: '0.68rem', color: '#8f8c99', marginTop: 'auto', paddingTop: 13, borderTop: '1px solid #f3f2f6', lineHeight: 1.6 } as const,
  eyebrow: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.09em' } as const,
  pie: { fontSize: '0.73rem', color: '#6f6b78', marginTop: 8, lineHeight: 1.55 } as const,
  /* El contenido que puede crecer: reparte el aire entre sus renglones en vez
     de amontonarlo en un hueco antes de la nota. */
  reparte: { flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-evenly' } as const,
  mini: { border: '1px solid rgba(155,140,250,.16)', borderRadius: 12, padding: '13px 15px', background: '#fff' } as const,
  mv: { fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, marginTop: 7 } as const,
  ms: { fontSize: '0.68rem', color: '#8a8590', marginTop: 6, lineHeight: 1.45 } as const,
  fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid #f4f3f7' } as const,
  fl: { fontSize: '0.79rem', fontWeight: 700 } as const,
  fn: { fontSize: '0.66rem', color: '#a5a2af' } as const,
  dot: (c: string) => ({ width: 9, height: 9, borderRadius: 99, background: c, flex: '0 0 auto' }) as const,
  btnA: { border: '1.5px solid #cdc4fb', borderRadius: 8, padding: '4px 10px', background: '#fff', fontSize: '0.69rem', fontWeight: 700, color: MORADO, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnP: { border: 'none', borderRadius: 8, padding: '5px 11px', background: LILA, color: '#fff', fontSize: '0.69rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
};
// El rosa marca lo ELEGIDO, igual que en los filtros del resto del módulo.
const seg = (on: boolean) => ({
  border: 'none', cursor: 'pointer', padding: '7px 16px', fontSize: '0.72rem', fontWeight: 700,
  fontFamily: 'inherit', background: on ? 'rgba(244,168,205,.34)' : 'transparent', color: on ? '#9c3d70' : '#8a8590',
}) as const;

export default function DashboardTab() {
  // Arranca en HOY: la pregunta de la mañana es «¿quién se movió mientras no
  // miraba?», no «¿qué pasó esta semana».
  const [diasAct, setDiasAct] = useState(1);
  const activos = useLeadsActivos(diasAct);
  const [filtroAct, setFiltroAct] = useState('todos');
  const [leadAbierto, setLeadAbierto] = useState<LeadActivo | null>(null);
  const [aMano, setAMano] = useState(false);
  /* El tablero de LEADS se mudó aquí desde la sección Leads, donde vivía
     detrás de un selector «Lista · Dashboard». Allá uno entra a trabajar la
     lista; aquí, a ver cómo va todo. Se queda con la ruta en la URL para que
     un enlace a esta vista siga cayendo en ella. */
  /* El EMBUDO se vino aquí (3-sep-2026): estaba colgado de «Cuentas» como su
     propia subsección, y no es una cuenta — es la misma pregunta que responde
     este tablero, «cómo voy», vista por etapas. Junto a Leads, que es de donde
     salen sus números. */
  /* Las tres secciones son el CAMINO DEL DINERO, no tres cajones: consultoría
     → leads → clientes (y dentro de clientes, recurrencia y expansión). El
     riel de arriba es a la vez la navegación y la explicación del orden. Un
     «?sub=negocio» viejo cae en Consultoría, que es donde empieza todo. */
  const [sub, setSub] = useState<Sec>(() => {
    if (typeof window === 'undefined') return 'consultoria';
    const v = new URLSearchParams(window.location.search).get('sub');
    return v === 'leads' || v === 'clientes' || v === 'recurrencia' || v === 'expansion' ? v : 'consultoria';
  });
  const irA = (v: Sec) => {
    setSub(v);
    try {
      const u = new URL(window.location.href);
      if (v === 'consultoria') u.searchParams.delete('sub'); else u.searchParams.set('sub', v);
      window.history.replaceState({}, '', u.toString());
    } catch { /* sin URL utilizable, la vista igual cambia */ }
  };
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
  /* Lo que este tablero necesita y no vivía en ningún lado: la cartera de
     consultoría, los canales y la recurrencia. Va aparte a propósito — el
     resto se sigue leyendo de `reports/tablero`, para que dos pantallas no
     terminen diciendo números distintos del mismo mes. */
  const [x, setX] = useState<any>(null);
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  // Qué detalle está abierto. Una cifra que no se puede abrir obliga a irse a
  // otro módulo a comprobarla, y entonces el tablero deja de usarse.
  const [detalle, setDetalle] = useState<string | null>(null);

  const cargar = () => {
    setD(null); setErr('');
    fetch(`/api/crm/reports/tablero?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json()).then(j => { if (j.error) setErr(j.error); else setD(j); })
      .catch(() => setErr('No se pudo cargar el tablero.'));
    /* Si esta falla, el tablero NO se cae: las secciones que dependen de ella
       enseñan su hueco y el resto sigue en pie. */
    setX(null);
    fetch(`/api/crm/reports/tablero-secciones?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json()).then(j => setX(j && !j.error ? j : null)).catch(() => setX(null));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta]);

  const alMes = () => { setAMano(false); setDesde(inicioDeMes()); setHasta(iso(new Date())); };
  /* Los cuatro periodos que de verdad se preguntan. El mes sigue mandando —el
     negocio se cierra por mes— pero «hoy» y «7 días» contestan la pregunta de
     la mañana, y el trimestre es con lo que se mira una tendencia. */
  const haceDias = (n: number) => { const f = new Date(); f.setDate(f.getDate() - n); return iso(f); };
  const iniTrimestre = () => { const f = new Date(); return iso(new Date(f.getFullYear(), f.getMonth() - 2, 1)); };
  const RANGOS: [string, () => [string, string]][] = [
    ['Hoy', () => [iso(new Date()), iso(new Date())]],
    ['7 días', () => [haceDias(6), iso(new Date())]],
    ['Mes', () => [inicioDeMes(), iso(new Date())]],
    ['Trimestre', () => [iniTrimestre(), iso(new Date())]],
  ];
  const ponerRango = (f: () => [string, string]) => { setAMano(false); const [a, b] = f(); setDesde(a); setHasta(b); };
  const rangoActivo = (f: () => [string, string]) => { const [a, b] = f(); return !aMano && desde === a && hasta === b; };

  if (err) return <div style={S.wrap}><div style={{ color: ROJO, fontSize: '0.85rem' }}>{err}</div></div>;
  if (!d) return <div style={S.wrap}><Cargando texto="Cargando tablero…" /></div>;

  const p = d.periodo;
  const nomMes = new Date(desde + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long' });
  const mesTit = nomMes.charAt(0).toUpperCase() + nomMes.slice(1);

  return (
    <div style={S.wrap}>
      {/* Las rejillas van por clase y no con auto-fit: con minmax el navegador
          decidía 3 columnas y dejaba un hueco del ancho de una tarjeta. */}
      <style>{`
        /* ── EL PAPEL ──
           El tablero se pinta sobre papel lila-rosa y las tarjetas flotan
           encima. Sale un poco por los lados del contenido para que se lea
           como una hoja y no como una caja más. */
        .tb { font-variant-numeric: tabular-nums; background:linear-gradient(150deg,#FDF6FB 0%,#F7F2FE 38%,#FCEEF6 100%);
              border-radius:20px; padding:18px 16px 22px; margin:0 -12px; }
        @media (max-width: 700px) { .tb { margin:0 -8px; padding:14px 10px 18px; } }
        .tb-clic { cursor:pointer; transition:transform .13s, box-shadow .13s, border-color .13s; }
        .tb-clic:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(217,83,142,.16); border-color:rgba(217,83,142,.32); }

        /* ── EL CAJÓN ──
           El detalle entra por la derecha en vez de tapar la pantalla: así
           sigues viendo el tablero detrás y entiendes de qué cifra salió. */
        .tb-velo { position:fixed; inset:0; background:rgba(36,29,67,.34); backdrop-filter:blur(2px); z-index:60; }
        .tb-modal { position:fixed; top:0; right:0; bottom:0; background:#fff; width:min(560px,94vw); overflow:auto;
          box-shadow:-20px 0 60px rgba(36,29,67,.20); animation:tbCajon .26s cubic-bezier(.2,.8,.2,1); }
        @keyframes tbCajon { from { transform:translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .tb-modal { animation:none; } }
        .tb-tabla { width:100%; border-collapse:collapse; }
        .tb-tabla th { font-size:.6rem; font-weight:800; color:#a5a2af; text-transform:uppercase; letter-spacing:.08em; text-align:left; padding:9px 8px; border-bottom:1px solid #f1f0f5; }
        .tb-tabla td { padding:10px 8px; border-bottom:1px solid #f7f6fa; font-size:.79rem; }
        .tb-tabla tr.cliqueable { cursor:pointer; }
        .tb-tabla tr.cliqueable:hover td { background:#faf9ff; }
        .tb-flujo { display:grid; grid-template-columns:1.55fr 1fr; gap:16px; margin-bottom:16px; }
        .tb-apil  { display:grid; grid-template-rows:1fr 1fr; gap:16px; }
        .tb-2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:16px; align-items:stretch; }
        .tb-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .tb-4 { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
        .tb-cuad { display:grid; grid-template-columns:1fr 1fr; grid-auto-rows:1fr; gap:14px; }
        @media (max-width: 1180px) { .tb-flujo { grid-template-columns:1fr; } }
        @media (max-width: 1000px) { .tb-4 { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 900px)  { .tb-2, .tb-3 { grid-template-columns:1fr; } }
        @media (max-width: 620px)  { .tb-4, .tb-cuad { grid-template-columns:1fr; } }

        /* ── El encabezado: el sello de la marca y sus destellos ──
           Los destellos son la misma chispa del logo y de la entrada, regados
           SOLO por la banda del título: es la única franja sin cifras, y una
           chispa detrás de un número estorba. */
        .tb-cab { position:relative; }
        .tb-cab > * { position:relative; z-index:1; }
        .tb-chispas { position:absolute; inset:-12px -8px -6px -8px; z-index:0; pointer-events:none; }
        .tb-chispas svg { position:absolute; animation:tbLatir 4.2s ease-in-out infinite; }
        @keyframes tbLatir { 0%,100% { opacity:var(--o,.5); transform:scale(1) rotate(0deg); } 50% { opacity:calc(var(--o,.5) * .4); transform:scale(.84) rotate(8deg); } }
        @media (prefers-reduced-motion: reduce) { .tb-chispas svg { animation:none; } }
        .tb-sello { display:inline-flex; align-items:center; gap:7px; background:#fff; border:1px solid rgba(217,83,142,.3);
          border-radius:999px; padding:5px 13px; font-size:.58rem; font-weight:800; letter-spacing:.11em;
          text-transform:uppercase; color:#9c3d70; white-space:nowrap; }
        @media (max-width: 760px) { .tb-sello { display:none; } }

        /* ── El riel ── */
        .tb-riel { display:flex; background:#fff; border:1px solid #ececf1; border-radius:14px; overflow:hidden; margin-bottom:16px; }
        .tb-paso { flex:1; display:flex; align-items:center; gap:10px; padding:12px 15px; border:none; background:none;
          font-family:inherit; text-align:left; cursor:pointer; position:relative; color:#241d43; transition:background .14s; }
        .tb-paso:hover { background:rgba(217,83,142,.05); }
        .tb-paso + .tb-paso { border-left:1px solid #f1eff8; }
        .tb-paso .n { width:25px; height:25px; border-radius:8px; display:grid; place-items:center; flex:none; font-size:.64rem; font-weight:800; color:#fff; }
        .tb-paso .et { display:block; font-size:.79rem; font-weight:800; letter-spacing:-.01em; line-height:1.1; }
        .tb-paso .ci { display:block; font-size:.65rem; color:#8a8590; margin-top:2px; }
        .tb-paso::after { content:''; position:absolute; left:0; right:0; bottom:0; height:3px; background:transparent; }
        .tb-paso[aria-selected="true"] { background:linear-gradient(180deg,rgba(217,83,142,.07),rgba(155,140,250,.05)); }
        .tb-paso[aria-selected="true"]::after { background:linear-gradient(90deg,#9B8CFA,#D9538E); }
        .tb-paso[aria-selected="true"] .et { color:#9c3d70; }
        @media (max-width: 980px) { .tb-riel { flex-wrap:wrap; } .tb-paso { flex:1 0 45%; } }

        /* ── La tira de KPIs de cada sección ── */
        .tb-kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
        .tb-kpi { background:#fff; border:1px solid rgba(155,140,250,.14); border-radius:14px; padding:14px 16px 14px 18px;
          position:relative; overflow:hidden; box-shadow:0 1px 2px rgba(60,30,140,.04), 0 8px 24px rgba(155,140,250,.09); }

        /* ── El globo de la gráfica ── */
        .tb-globo { position:absolute; pointer-events:none; background:#fff; border:1px solid #F3E3EC; border-radius:10px;
          padding:7px 11px; box-shadow:0 8px 22px rgba(217,83,142,.18); z-index:5; white-space:nowrap; transform:translate(-50%,-100%); }

        /* ── Las lecturas del pie ── */
        .tb-lec { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
        @media (max-width: 900px) { .tb-lec { grid-template-columns:1fr; } }
        @media (max-width: 1180px) { .tb-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width: 680px)  { .tb-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      `}</style>

      <div className="tb">
        <div className="tb-cab" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Chispas />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
              Tablero
              <span className="tb-sello">
                <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d={CHISPA} fill="#D9538E" /></svg>
                Conectando estrellas, creando constelaciones
              </span>
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 3 }}>
              {p.es_mes_actual
                ? `${mesTit} ${new Date().getFullYear()} · del 1 al ${new Date(hasta + 'T12:00:00').getDate()} · quedan ${d.meta_mes.dias_restantes} días`
                : `Del ${fmtDate(desde)} al ${fmtDate(hasta)} · ${p.dias} días`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', border: '1px solid #eae5ef', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
              {RANGOS.map(([et, f]) => (
                <button key={et} onClick={() => ponerRango(f)} style={seg(rangoActivo(f))}>{et}</button>
              ))}
              <button onClick={() => setAMano(true)} style={seg(aMano)}>A mano</button>
            </span>
            {/* Los campos de fecha solo aparecen cuando se piden: ocupaban un
                tercio de la barra para algo que se usa una vez al mes. */}
            {aMano && (<>
              <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={FECHA} />
              <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} style={FECHA} />
            </>)}
          </div>
        </div>

        <Riel sec={sub} irA={irA} d={d} x={x} />

        {sub === 'consultoria' && (<>
          <KpisConsultoria d={d} x={x} ver={setDetalle} />
          <Dinero d={d} x={x} ver={setDetalle} />
          <Parcialidades x={x} abrir={setAbierto} />
          <CarteraYCanales x={x} abrir={setAbierto} tercera={<Compromisos d={d} parte="consultoria" />} />
          <Compromisos d={d} abrir={setAbierto} parte="cobrar" />
          <Sueltos x={x} ver={setAbierto} parte="pagos" />
          <Lecturas d={d} x={x} />
        </>)}

        {sub === 'leads' && (<>
          <Suspense fallback={<Cargando texto="Cargando el tablero de leads…" alto={280} />}><LeadsDashboard /></Suspense>
          <CohorteYTiempo d={d} />
          {/* MISMO dato que el Inicio del teléfono, mismo componente y mismo
              endpoint: si el criterio de qué cuenta como actividad viviera dos
              veces terminarían siendo dos números distintos en dos pantallas. Lo
              único que cambia es el envase: aquí tarjeta, allá hoja. */}
          {!!activos?.total && (
            <div style={S.card}>
              <div style={{ ...S.titulo, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>Leads que se movieron</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={S.der}>{activos.total} · {activos.con_senal} por su cuenta</span>
                  <RangoDias valor={diasAct} onCambiar={setDiasAct} />
                </span>
              </div>
              <div style={S.lead}>
                Quién dio señales esta semana, de lo más reciente a lo más viejo. El punto morado es lo que hizo el lead
                —te escribió, entró al sitio, abrió la cotización—; el gris, lo que hicimos nosotros. Los cambios de etapa
                y las bienvenidas automáticas no cuentan: si contaran, cualquiera tocado por un cron saldría como activo.
              </div>
              <FiltrosActivos datos={activos} valor={filtroAct} onCambiar={setFiltroAct} />
              <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #ececf1', borderRadius: 10 }}>
                <ListaLeadsActivos leads={aplicarFiltro(activos.leads, filtroAct)} onAbrir={setLeadAbierto} />
              </div>
              <EfectividadSeguimiento datos={activos} />
              <EmpresasActivas datos={activos} />
              <ParaRescatarLista datos={activos}
                onAbrirConv={(r) => { location.href = r.wa_conversation_id
                  ? `/admin/crm?tab=whatsapp&wa_conv=${encodeURIComponent(r.wa_conversation_id)}`
                  : `/admin/crm?tab=pipeline&contacto=${r.id}`; }} />
            </div>
          )}
          <DrawerLead lead={leadAbierto} onCerrar={() => setLeadAbierto(null)}
            onWhatsApp={(l) => { const [t, qs] = rutaConversacion(l).split('?'); location.href = `/admin/crm?tab=${t}&${qs || ''}`; }} />
        </>)}

        {sub === 'clientes' && (<>
          <KpisClientes d={d} x={x} />
          <Cartera d={d} x={x} ver={setDetalle} />
          <Salud d={d} />
        </>)}

        {sub === 'recurrencia' && (<>
          <KpisRecurrencia d={d} x={x} />
          <Motor d={d} abrir={setAbierto} />
          <Recurrencia x={x} abrir={setAbierto} parte="vuelve" />
          <NoEntrara x={x} abrir={setAbierto} />
        </>)}

        {sub === 'expansion' && (<>
          <KpisExpansion d={d} x={x} />
          <Recurrencia x={x} abrir={setAbierto} parte="crecer" />
          <Ampliaciones d={d} abrir={setAbierto} />
        </>)}
      </div>

      {detalle && <Detalle d={d} cual={detalle} cerrar={() => setDetalle(null)} abrir={(id: string) => { setDetalle(null); setAbierto(id); }} />}
      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}

const FECHA = { border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' } as const;

/* ════════════════ 1 · EL DINERO ════════════════ */
function Dinero({ d, x, ver }: any) {
  const c = d.cobrado, sm = d.sobre_la_mesa, g = d.generado;
  /* El anticipo de una cotización a plazos ya entró: la mesa enseña el saldo.
     Sin esto, la misma tarjeta decía $469,881 y el KPI de arriba $390,431. */
  const anticipos = x?.dinero?.anticipos || 0;
  const neto = x?.dinero?.por_cobrar?.neto ?? sm.total;
  const pctMeta = c.meta ? Math.round((c.monto / c.meta) * 100) : null;
  const llega = c.proyeccion != null && c.meta && c.proyeccion >= c.meta;
  const totalMesa = Math.max(1, sm.total);

  return (
    <div className="tb-flujo">
      <div style={S.card} className="tb-clic" onClick={() => ver('cobrado')}>
        <div style={S.titulo}>Cobrado{c.meta ? <span style={S.der}>meta {money(c.meta)}</span> : null}</div>
        <div style={S.lead}>
          Lo que de verdad entró a la cuenta.
          {c.meta ? ' La línea punteada gris es el ritmo que hay que llevar para llegar a la meta; la verde, dónde cierras si sigues igual.' : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '2.9rem', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1, color: MORADO }}>{money(c.monto)}</div>
          <div style={{ paddingBottom: 5 }}>
            {pctMeta != null && (
              <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', background: llega ? '#E8F6EF' : '#FEF6E7', color: llega ? VERDE : '#9a6a10' }}>
                van {pctMeta}% de la meta
              </span>
            )}
            <div style={{ ...S.pie, marginTop: 6 }}>
              {c.n} {c.n === 1 ? 'pago' : 'pagos'}
              {c.proyeccion != null && <> · a este ritmo cierras en <b style={{ color: llega ? VERDE : ROJO }}>{money(c.proyeccion)}</b></>}
            </div>
          </div>
        </div>

        {/* La gráfica y su liga reparten el aire de la tarjeta: cuando el
            bloque de al lado es más alto, el sobrante se abre arriba y abajo
            de la curva en vez de quedarse como un hueco antes del historial. */}
        <div style={S.reparte}>
          <GraficaCobranza c={c} eje={d.periodo.eje_total} />
          <VerDetalle texto={`Ver los ${c.n} pagos, uno por uno`} />
        </div>

        <div style={{ ...S.nota, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 250px' }}>
            <div style={{ ...S.eyebrow, marginBottom: 6 }}>Cobranza de los últimos 6 meses</div>
            <Historial meses={d.historial} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>{textoHistorial(d.historial)}</div>
        </div>
      </div>

      <div className="tb-apil">
        <div style={{ ...S.card, borderLeft: `3px solid ${AMBAR}` }} className="tb-clic" onClick={() => ver('mesa')}>
          <div style={S.titulo}>Sobre la mesa hoy</div>
          {/* La cifra grande es lo que FALTA por cobrar, no lo cotizado: si
              dos cotizaciones ya recibieron anticipo, ese dinero está en
              «cobrado» y volver a contarlo aquí lo cuenta dos veces. */}
          <div style={{ fontSize: '2.05rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, color: AMBAR, marginTop: 11 }}>{money(neto)}</div>
          <div style={S.pie}>
            {sm.aceptadas.n + sm.enviadas.n} cotizaciones vivas en manos del cliente
            {anticipos > 0 && <> · de {money(sm.total)} cotizados, <b style={{ color: VERDE }}>{money(anticipos)} ya entraron</b></>}
          </div>
          {sm.total > 0 && (
            <div style={{ display: 'flex', height: 11, borderRadius: 9, overflow: 'hidden', background: '#f2f1f6', marginTop: 13 }}>
              <span style={{ width: `${(sm.aceptadas.monto / totalMesa) * 100}%`, background: ORO }} />
              <span style={{ width: `${(sm.enviadas.monto / totalMesa) * 100}%`, background: '#f6dfae' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.7rem', color: '#6f6b78', marginTop: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={S.dot(ORO)} />{sm.aceptadas.n} aceptada{sm.aceptadas.n === 1 ? '' : 's'} sin pagar · <b>{money(sm.aceptadas.monto)}</b></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={S.dot('#f6dfae')} />{sm.enviadas.n} enviada{sm.enviadas.n === 1 ? '' : 's'} sin respuesta · <b>{money(sm.enviadas.monto)}</b></span>
          </div>
          {/* El pipeline se cuenta aparte a propósito: parte ya está cotizado
              y sumarlo contaría el mismo dinero dos veces. */}
          {sm.oportunidades.n > 0 && (
            <div style={S.nota}>
              Hay además {sm.oportunidades.n} oportunidades en plática por {money(sm.oportunidades.monto)}
              {sm.oportunidades.con_cotizacion > 0
                ? <>, pero {sm.oportunidades.con_cotizacion} ya salieron en estas cotizaciones: no se suman para no contar el mismo dinero dos veces.</>
                : <>. Todavía sin cotización formal.</>}
            </div>
          )}
          <VerDetalle texto="Ver cuáles son y desde cuándo esperan" />
        </div>

        <div style={{ ...S.card, borderLeft: `3px solid ${MORADO}` }} className="tb-clic" onClick={() => ver('generado')}>
          <div style={S.titulo}>Generado</div>
          <div style={{ fontSize: '2.05rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, color: MORADO, marginTop: 11 }}>{money(g.monto)}</div>
          <div style={S.pie}>{g.n} {g.n === 1 ? 'cotización aceptada' : 'cotizaciones aceptadas'}. El cliente ya dijo que sí, se haya cobrado o no.</div>
          {g.mejor_semana && g.monto > 0 && (
            <div style={S.nota}>
              {g.mejor_semana.monto / g.monto >= 0.6
                ? <>Se concentró en una sola semana: del {fmtDate(g.mejor_semana.desde)} al {fmtDate(g.mejor_semana.hasta)} se autorizaron <b style={{ color: '#3f3b4d' }}>{money(g.mejor_semana.monto)}</b> de los {money(g.monto)}.</>
                : <>Repartido a lo largo del periodo. La mejor semana fue del {fmtDate(g.mejor_semana.desde)} al {fmtDate(g.mejor_semana.hasta)} con <b style={{ color: '#3f3b4d' }}>{money(g.mejor_semana.monto)}</b>.</>}
            </div>
          )}
          <VerDetalle texto={`Ver las ${g.n} y quién las autorizó`} />
        </div>
      </div>
    </div>
  );
}

/** Cobranza acumulada. Tres trazos: lo que llevas, el ritmo que exige la meta
 *  y dónde cierras si no cambia nada. Sin la pauta, la curva sola no dice si
 *  vas bien. */
function GraficaCobranza({ c, eje }: any) {
  const W = 640, H = 186, PL = 6, PR = 12, PT = 14, PB = 22;
  const total = Math.max(1, eje - 1);
  const tope = Math.max(c.monto, c.meta || 0, c.proyeccion || 0) * 1.06 || 1;
  const X = (i: number) => PL + (i / total) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - v / tope) * (H - PT - PB);

  const linea = c.serie.map((s: any) => `${X(s.i).toFixed(1)},${Y(s.acum).toFixed(1)}`).join(' ');
  const ultimo = c.serie[c.serie.length - 1] || { i: 0, acum: 0 };
  const area = `${X(0).toFixed(1)},${Y(0).toFixed(1)} ${linea} ${X(ultimo.i).toFixed(1)},${Y(0).toFixed(1)}`;
  const marcas = [tope * 0.33, tope * 0.66, tope * 0.99].map(v => Math.round(v / 100000) * 100000).filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} aria-hidden="true">
      <defs>
        {/* El relleno baja del rosa de la marca al morado y se apaga: es el
            mismo degradado de la cinta de las cotizaciones. */}
        <linearGradient id="tb-cash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9538E" stopOpacity=".30" /><stop offset="100%" stopColor="#9B8CFA" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tb-linea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9B8CFA" /><stop offset="100%" stopColor="#D9538E" />
        </linearGradient>
      </defs>
      {marcas.map(v => <g key={v}>
        <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#f1f0f5" />
        <text x={PL + 2} y={Y(v) - 4} fontSize="8.5" fill="#b3b0bd" fontWeight="600">{Math.round(v / 1000)}K</text>
      </g>)}
      {c.meta && <polyline points={`${X(0)},${Y(0)} ${X(total)},${Y(c.meta)}`} fill="none" stroke="#cfcbe0" strokeWidth="1.5" strokeDasharray="5 4" />}
      <polygon points={area} fill="url(#tb-cash)" />
      <polyline points={linea} fill="none" stroke="url(#tb-linea)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {c.proyeccion != null && <>
        <polyline points={`${X(ultimo.i)},${Y(ultimo.acum)} ${X(total)},${Y(c.proyeccion)}`} fill="none" stroke={MENTA} strokeWidth="2.2" strokeDasharray="4 4" />
        <circle cx={X(total)} cy={Y(c.proyeccion)} r="3.5" fill={MENTA} />
      </>}
      <circle cx={X(ultimo.i)} cy={Y(ultimo.acum)} r="5" fill="#fff" stroke="#D9538E" strokeWidth="2.6" />
      {[0, Math.round(total / 4), Math.round(total / 2), Math.round(total * 3 / 4), total].map((i, k) => (
        <text key={k} x={X(i)} y={H - 6} fontSize="8.5" fill="#b3b0bd" fontWeight="600" textAnchor="middle">{i + 1}</text>
      ))}
    </svg>
  );
}

/* Los seis meses. La barra CONTESTA: al pasar el mouse sale el globo con el
   mes y cuánto entró — la pregunta que uno se hace mirando una barra es
   siempre «¿cuánto fue ese?», y hasta ahora había que adivinarlo por altura. */
function Historial({ meses }: any) {
  const tope = Math.max(1, ...meses.map((m: any) => m.monto));
  const [sobre, setSobre] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', position: 'relative' }}
      onMouseLeave={() => setSobre(null)}>
      {sobre != null && (
        <div className="tb-globo" style={{ left: `${((sobre + 0.5) / meses.length) * 100}%`, top: -6 }}>
          <div style={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a09aae' }}>{meses[sobre].etiqueta}</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9c3d70' }}>{money(meses[sobre].monto)}</div>
        </div>
      )}
      {meses.map((m: any, i: number) => (
        <div key={m.mes} style={{ flex: 1, textAlign: 'center', cursor: 'default' }} onMouseEnter={() => setSobre(i)}>
          <div style={{ height: 44, display: 'flex', alignItems: 'flex-end' }}>
            <span style={{
              width: '100%', height: Math.max(4, (m.monto / tope) * 44), borderRadius: 4,
              background: m.actual ? 'linear-gradient(180deg,#D9538E,#EFA6CA)' : sobre === i ? 'linear-gradient(180deg,#9B8CFA,#C6BCFB)' : '#e6e1fb',
              transition: 'background .15s',
            }} />
          </div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, marginTop: 5, color: m.actual ? '#9c3d70' : sobre === i ? MORADO : '#a5a2af' }}>{m.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}

/** La frase del historial se arma con el dato, no se escribe fija: un mes
 *  bueno y uno malo no se cuentan igual. */
function textoHistorial(meses: any[]) {
  const act = meses[meses.length - 1], prev = meses[meses.length - 2];
  if (!prev || !prev.monto) return <>Es el primer mes con cobranza comparable.</>;
  const dif = Math.round(((act.monto - prev.monto) / prev.monto) * 100);
  const otros = meses.slice(0, -1).filter(m => m.monto > 0);
  const prom = otros.length ? Math.round(otros.reduce((a, m) => a + m.monto, 0) / otros.length) : 0;
  return (
    <>El mes pasado cerró en <b style={{ color: '#3f3b4d' }}>{money(prev.monto)}</b>.
      {' '}{dif >= 0 ? `Vas ${dif}% arriba` : `Vas ${Math.abs(dif)}% abajo`}, con el mes todavía sin terminar.
      {prom > 0 && <> El promedio de los cinco meses anteriores es {money(prom)}.</>}
    </>
  );
}

/* ════════════════ 2 · CUÁNTO CRECIÓ EL RECURRENTE ════════════════
   No cuánto vendiste: cuánto subió el ingreso que se repite. Y en PORCENTAJE,
   porque $47K sobre un ARR de dos millones es 2.4%, y ese es el número que se
   puede comparar contra el mes pasado. */
/* ════════════════ EL DINERO QUE SE REPITE ════════════════
   Antes esto era una tabla de porcentajes —altas, ampliaciones, reducciones,
   bajas, neto, cada una con su %— y el dueño dijo dos cosas: no la entiendo y
   no se ve qué hacer. Las dos son ciertas. Un porcentaje sobre el ARR base no
   se puede actuar: nadie llama a «−0.58%».

   Ahora el bloque contesta tres preguntas en el orden en que se piensan:
   cuánto te pagan al año, cuánto cambió este mes, y —lo importante— QUIÉNES lo
   movieron y qué hacer con cada uno. Los nombres y los pesos ya estaban en el
   dato; solo estaban escondidos detrás de la palabra «ampliaciones». */
function Motor({ d, abrir }: any) {
  const r = d.recurrente, k = d.contadores;
  const cortoLedger = d.periodo.desde < r.ledger_desde;
  const mov = r.movimientos || {};
  const entro = (r.altas || 0) + (r.ampliaciones || 0) + (r.reactivaciones || 0);
  const salio = Math.abs((r.bajas || 0) + (r.reducciones || 0));
  const tope = Math.max(entro, salio, 1);

  /* Las tres tarjetas: quién creció, quién se fue, quién se encogió. Cada una
     termina en la acción que le toca — es la diferencia entre un tablero que
     informa y uno que se usa. */
  const gente = (arr: any[]) => (arr || []).slice(0, 3);
  const tarjetas = [
    {
      /* Morado = el recurrente, que es lo que este bloque mide. */
      k: 'crecio', color: LILA, tinta: MORADO, fondo: '#EEECFE', et: 'Crecieron',
      lista: gente([...(mov.ampliaciones || []), ...(mov.altas || []), ...(mov.reactivaciones || [])]),
      total: entro, vacio: 'Nadie amplió este mes.',
      accion: 'Búscales la siguiente venta: ya te dijeron que sí una vez.',
    },
    {
      /* Rosa = lo que se va. Es la regla de la paleta y además la marca. */
      k: 'fue', color: ROSA, tinta: ROSA_T, fondo: '#FCEFF5', et: 'Se fueron',
      lista: gente(mov.bajas), total: Math.abs(r.bajas || 0), vacio: 'Nadie se fue. Eso es lo que sostiene el ingreso.',
      accion: 'Llamada de rescate esta semana, mientras la cuenta sigue caliente.',
    },
    {
      k: 'encogio', color: ORO, tinta: AMBAR, fondo: '#FFF4E5', et: 'Se encogieron',
      lista: gente(mov.reducciones), total: Math.abs(r.reducciones || 0), vacio: 'Nadie bajó de plan.',
      accion: 'Pregunta qué dejaron de usar: una reducción avisa una baja.',
    },
  ];

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div>
        <div style={S.titulo}>El dinero que se repite cada año<span style={S.der}>lo que ya tienes contratado</span></div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, margin: '4px 0 14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '2.05rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{money(r.arr_hoy)}</div>
            <div style={{ ...S.pie, marginTop: 5 }}>es lo que te pagan al año sin vender nada nuevo</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: r.neto >= 0 ? MORADO : ROSA_T, lineHeight: 1 }}>
              {r.neto >= 0 ? '+' : '−'}{money(Math.abs(r.neto))}
            </div>
            <div style={{ ...S.pie, marginTop: 5 }}>{r.neto >= 0 ? 'más' : 'menos'} que al empezar el periodo</div>
          </div>
        </div>

        {/* Una sola barra: lo que entró contra lo que se fue, en pesos. Sin
            porcentajes — el ojo compara los dos largos y ya está. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 6px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: MORADO, width: 62, flex: 'none' }}>Entró</span>
          <span style={{ flex: 1, height: 13, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${(entro / tope) * 100}%`, background: 'linear-gradient(90deg,#9B8CFA,#C6BCFB)' }} />
          </span>
          <b style={{ fontSize: '0.82rem', color: MORADO, width: 92, textAlign: 'right' }}>{money(entro)}</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ROSA_T, width: 62, flex: 'none' }}>Se fue</span>
          <span style={{ flex: 1, height: 13, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${(salio / tope) * 100}%`, background: 'linear-gradient(90deg,#D9538E,#EFA6CA)' }} />
          </span>
          <b style={{ fontSize: '0.82rem', color: ROSA_T, width: 92, textAlign: 'right' }}>{salio ? '−' + money(salio) : money(0)}</b>
        </div>

        <div className="tb-3" style={{ gap: 10 }}>
          {tarjetas.map(t => (
            <div key={t.k} style={{ background: t.fondo, borderRadius: 13, padding: '12px 13px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...S.eyebrow, color: t.tinta }}>{t.et}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: t.tinta, marginTop: 4, lineHeight: 1 }}>
                {t.total ? (t.k === 'crecio' ? '+' : '−') + money(t.total) : '—'}
              </div>
              <div style={{ marginTop: 9, flex: 1 }}>
                {!t.lista.length
                  ? <div style={{ fontSize: '0.7rem', color: '#8a8590', lineHeight: 1.45 }}>{t.vacio}</div>
                  : t.lista.map((m: any, i: number) => (
                    <div key={i} onClick={m.company_id ? () => abrir(m.company_id) : undefined}
                      style={{ display: 'flex', gap: 6, alignItems: 'baseline', padding: '3px 0', cursor: m.company_id ? 'pointer' : 'default' }}>
                      <span style={{ fontSize: '0.73rem', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.cliente}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: t.tinta, whiteSpace: 'nowrap' }}>{conSigno(m.arr)}</span>
                    </div>
                  ))}
              </div>
              {!!t.lista.length && (
                <div style={{ fontSize: '0.68rem', color: '#6b6b7a', lineHeight: 1.45, marginTop: 9, paddingTop: 9, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                  {t.accion}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={S.nota}>
          {cortoLedger
            ? <>El historial de recurrencia arranca el {fmtDate(r.ledger_desde)}: lo anterior no está medido y el neto sale corto.</>
            : entro || salio
              ? <>Clic en un nombre y se abre su cuenta. {salio > entro
                ? <>Este periodo <b style={{ color: ROSA_T }}>se fue más de lo que entró</b>: el hueco se tapa vendiendo, no esperando.</>
                : <>Lo que entró alcanzó para cubrir lo que se fue.</>}</>
              : <>Sin movimientos de recurrencia en el periodo.</>}
        </div>
      </div>

    </div>
  );
}

/** Barras divergentes desde el cero. Cada una es el peso del movimiento sobre
 *  el ARR con el que se empezó: así un mes se compara contra otro aunque el
 *  ARR haya cambiado de tamaño. */
function BarrasArr({ r }: any) {
  const filas = [
    { nom: 'Altas', v: r.altas, p: r.pct?.altas, col: MENTA },
    { nom: 'Ampliaciones', v: r.ampliaciones, p: r.pct?.ampliaciones, col: LILA },
    ...(r.reactivaciones ? [{ nom: 'Reactivaciones', v: r.reactivaciones, p: r.pct?.reactivaciones, col: CIELO }] : []),
    { nom: 'Reducciones', v: r.reducciones, p: r.pct?.reducciones, col: ORO },
    { nom: 'Bajas', v: r.bajas, p: r.pct?.bajas, col: ROJO },
  ];
  const W = 470, alto = 30, gap = 8, CX = 232, LARGO = CX - 96;
  const tope = Math.max(0.01, ...filas.map(f => Math.abs(f.p || 0))) * 1.18;
  const H = filas.length * (alto + gap) + 34;
  let y = 4;
  const nodos = filas.map(f => {
    const p = f.p || 0, w = Math.max(2, (Math.abs(p) / tope) * LARGO);
    const x = p >= 0 ? CX : CX - w, yy = y; y += alto + gap;
    return (
      <g key={f.nom}>
        <text x="4" y={yy + alto / 2 + 4} fontSize="11.5" fontWeight="700" fill="#3f3b4d">{f.nom}</text>
        <rect x={x} y={yy} width={w} height={alto} rx="4" fill={f.col} />
        <text x={p >= 0 ? x + w + 9 : x - 9} y={yy + alto / 2 + 4} fontSize="12" fontWeight="800" fill={f.col} textAnchor={p >= 0 ? 'start' : 'end'}>
          {p >= 0 ? '+' : ''}{p}%
        </text>
        <text x={W - 4} y={yy + alto / 2 + 4} fontSize="10.5" fontWeight="600" fill="#a5a2af" textAnchor="end">{conSigno(f.v)}</text>
      </g>
    );
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} aria-hidden="true">
      {nodos}
      <line x1={CX} y1="0" x2={CX} y2={y - gap + 4} stroke="#d8d5e4" />
      <line x1="0" y1={y - 2} x2={W} y2={y - 2} stroke="#eceaf2" />
      <text x="4" y={y + 20} fontSize="11.5" fontWeight="800" fill="#3f3b4d">Neto del periodo</text>
      <text x={CX + 8} y={y + 20} fontSize="12" fontWeight="800" fill={MORADO}>{(r.pct?.neto ?? 0) >= 0 ? '+' : ''}{r.pct?.neto ?? 0}%</text>
      <text x={W - 4} y={y + 20} fontSize="10.5" fontWeight="800" fill={MORADO} textAnchor="end">{conSigno(r.neto)}</text>
    </svg>
  );
}

function Contador({ color, label, valor, valorColor, nota, ver }: any) {
  return (
    <div style={{ ...S.mini, borderLeft: `3px solid ${color}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      className={ver ? 'tb-clic' : undefined} onClick={ver}>
      <div style={S.eyebrow}>{label}</div>
      <div style={{ ...S.mv, color: valorColor || color }}>{valor}</div>
      <div style={S.ms}>{nota}</div>
      {ver && <VerDetalle texto="Ver quiénes" chico />}
    </div>
  );
}

function VerDetalle({ texto, chico }: any) {
  return (
    <div style={{ fontSize: chico ? '0.61rem' : '0.63rem', fontWeight: 800, color: MORADO, marginTop: chico ? 7 : 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {texto} <span style={{ fontSize: '0.8em' }}>→</span>
    </div>
  );
}

/* ════════════════ 3 · LA COHORTE Y EL TIEMPO ════════════════ */
function CohorteYTiempo({ d }: any) {
  const co = d.cohorte, r = d.reuniones;
  const clientes = co.pasos[4]?.n || 0;
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>El recorrido de los que entraron<span style={S.der}>cohorte del periodo</span></div>
        <div style={S.lead}>No es el embudo general: son <b>las mismas {co.base} empresas</b> que entraron en el periodo que elegiste, seguidas hasta dónde llegaron.</div>
        {co.base === 0
          ? <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '18px 0' }}>Ninguna empresa nueva en el periodo.</div>
          : <>
            <Cohorte pasos={co.pasos} base={co.base} />
            <div style={S.nota}>
              De las {co.base} que entraron, <b style={{ color: co.pasos[1].n / co.base < 0.1 ? ROJO : '#3f3b4d' }}>{co.pasos[1].n === 1 ? 'solo 1 tuvo' : `${co.pasos[1].n} tuvieron`} reunión</b> y {co.pasos[2].n} {co.pasos[2].n === 1 ? 'recibió' : 'recibieron'} cotización.
              {/* Los pasos no son monótonos a propósito: se cierran ventas sin
                  junta ni cotización, y eso hay que verlo, no taparlo. */}
              {co.sin_rastro > 0 && <> <b style={{ color: '#9a6a10' }}>{co.sin_rastro} de {clientes}</b> que ya son clientes cerraron sin junta ni cotización registrada: o se vende fuera del CRM, o no se está capturando.</>}
            </div>
          </>}
      </div>

      <div style={S.card}>
        <div style={S.titulo}>En qué se fue el tiempo<span style={S.der}>{r.total} {r.total === 1 ? 'reunión' : 'reuniones'} · asistieron {r.fueron}</span></div>
        <div style={S.lead}>Si casi todo es acompañar y poco es vender, el mes que viene no entra nadie.</div>
        {r.total === 0
          ? <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '18px 0' }}>Sin reuniones en el periodo.</div>
          : <>
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dona tipos={r.tipos} total={r.total} />
              <div style={{ flex: 1, minWidth: 200 }}>
                {r.tipos.map((t: any, i: number) => (
                  <div key={t.nombre} style={{ ...S.fila, borderTop: i === 0 ? 'none' : S.fila.borderTop }}>
                    <span style={S.dot(COLORES[i % COLORES.length])} />
                    <div style={S.fl}>{titulo(t.nombre)}</div>
                    <b style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 800 }}>{t.n}</b>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.nota}>
              {r.para_vender === 0
                ? <><b style={{ color: ROJO }}>Ninguna</b> de las {r.total} fue para vender: todas sostienen a los clientes que ya tienes.</>
                : <>Solo <b style={{ color: r.para_vender / r.total < 0.25 ? ROJO : '#3f3b4d' }}>{r.para_vender} de {r.total}</b> fueron para vender (demo y cotización). Las otras {r.total - r.para_vender} sostienen a los clientes que ya tienes.</>}
              {r.sin_marcar > 0 && <> Quedan <b style={{ color: '#9a6a10' }}>{r.sin_marcar}</b> ya pasadas sin marcar asistencia.</>}
            </div>
          </>}
      </div>
    </div>
  );
}
/* La gama del tablero: del morado al rosa, con el ámbar solo al final para lo
   que urge. Antes entraban azul y verde y la pantalla parecía de otro producto. */
const COLORES = [LILA, '#7C6BF0', '#C062A0', ROSA, ROSA_S, '#C9C7D0'];
const COHORTE_COL = ['#C6BCFB', LILA, '#A374D8', '#C062A0', ROSA];
const mesDe = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long' });
const titulo = (t: string) => { const x = t.replace(/^Reunión de /, ''); return x.charAt(0).toUpperCase() + x.slice(1); };

/** El recorrido de la cohorte. Barras alineadas a la izquierda y no un embudo
 *  centrado: los pasos NO son monótonos —hay clientes que nunca pasaron por
 *  cotización— y un embudo dibujaría una mentira ordenada. */
function Cohorte({ pasos, base }: any) {
  const W = 630, FW = 300, alto = 30, gap = 10, X = 180;
  const H = pasos.length * (alto + gap);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} aria-hidden="true">
      {pasos.map((p: any, i: number) => {
        const y = i * (alto + gap), w = Math.max(24, (p.n / Math.max(1, base)) * FW);
        return (
          <g key={p.nombre}>
            <text x="4" y={y + alto / 2 + 4} fontSize="11.5" fontWeight="700" fill="#3f3b4d">{p.nombre}</text>
            <rect x={X} y={y + 5} width={w} height={alto - 10} rx="4" fill={COHORTE_COL[i % COHORTE_COL.length]} />
            <text x={X + w + 9} y={y + alto / 2 + 4} fontSize="12" fontWeight="800" fill={COHORTE_COL[i % COHORTE_COL.length]}>{p.n}</text>
            <text x={X + w + 34} y={y + alto / 2 + 4} fontSize="10.5" fontWeight="600" fill="#a5a2af">{Math.round((p.n / Math.max(1, base)) * 100)}% de {base}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** La dona de reuniones: la mezcla se lee de un vistazo, y el número del
 *  centro evita tener que sumar los renglones de al lado. */
function Dona({ tipos, total }: any) {
  const R = 62, GR = 17;
  let ang = -90;
  return (
    <svg viewBox="0 0 156 156" style={{ width: 156, height: 156, flex: '0 0 auto' }} aria-hidden="true">
      {tipos.map((t: any, i: number) => {
        const da = (t.n / total) * 360;
        const a0 = (ang * Math.PI) / 180, a1 = ((ang + da - (tipos.length > 1 ? 2.4 : 0)) * Math.PI) / 180;
        ang += da;
        const x0 = 78 + R * Math.cos(a0), y0 = 78 + R * Math.sin(a0);
        const x1 = 78 + R * Math.cos(a1), y1 = 78 + R * Math.sin(a1);
        return <path key={t.nombre} d={`M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${da > 182 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
          fill="none" stroke={COLORES[i % COLORES.length]} strokeWidth={GR} />;
      })}
      <text x="78" y="74" fontSize="26" fontWeight="800" fill="#17151f" textAnchor="middle">{total}</text>
      <text x="78" y="92" fontSize="8.5" fill="#b3b0bd" fontWeight="600" textAnchor="middle">reuniones</text>
    </svg>
  );
}

/* ════════════════ 4 · COMPROMISOS Y COBRANZA ════════════════ */
/* Los dos bloques se piden por separado: el de consultoría mide como las dos
   listas de barras y va con ellas; el de ARR por cobrar es una lista larga y
   ocupa el ancho completo. Juntos en dos columnas, uno terminaba mucho antes
   que el otro y dejaba el escalón de fondo que el dueño señaló. */
function Compromisos({ d, abrir, parte }: any) {
  const co = d.consultoria, cb = d.cobrar;
  // La lista del mes vive plegada: es el detalle que se consulta una vez por
  // semana, no algo que haya que tener a la vista todo el tiempo.
  const [verMes, setVerMes] = useState(false);
  const totalCob = Math.max(1, cb.d30.monto + cb.d60.monto + cb.d90.monto);

  if (parte === 'consultoria') return (
      <div style={S.card}>
        <div style={S.titulo}>Consultoría<span style={S.der}>lo que prometiste en las juntas</span></div>
        <div style={S.lead}>Un compromiso vencido cuesta más que una junta perdida.</div>
        <div className="tb-4">
          <Contador color={CIELO} valorColor={AZUL} label="Nuevos" valor={co.nuevas} nota="pactados en el periodo" />
          <Contador color={MENTA} valorColor={VERDE} label="Entregados" valor={co.entregadas} nota="cerrados en total" />
          <Contador color={ORO} valorColor={AMBAR} label="En proceso" valor={co.en_proceso} nota={`+${co.idea} como idea`} />
          <Contador color={ROJO} label="Vencidos" valor={co.vencidas} nota={co.vencidas ? `en ${co.cuentas_vencidas} ${co.cuentas_vencidas === 1 ? 'cuenta' : 'cuentas'}` : 'ninguno pasado de fecha'} />
        </div>
        <div style={S.nota}>
          {co.nuevas > co.entregadas
            ? <>Pactaste {co.nuevas} en el periodo y llevas {co.entregadas} entregados en toda la historia del módulo. La lista crece más rápido de lo que se cierra.</>
            : <>Vas al corriente: entregaste {co.entregadas} y pactaste {co.nuevas} nuevos.</>}
        </div>
      </div>
  );

  return (
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.titulo}>ARR por cobrar<span style={S.der}>{cb.total.n} renovaciones · {money(cb.total.monto)}</span></div>
        <div style={S.lead}>Ya está contratado y toca renovar en los próximos 90 días. No es proyección: son fechas con nombre y monto, y no depende del mes que estés viendo.</div>
        {/* Los anchos ya descuentan las separaciones: sin eso los tres tramos
            sumaban más de 100% y la barra se desbordaba unos píxeles. */}
        <div style={{ display: 'flex', gap: 3, height: 15, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {cb.vencido.monto > 0 && <span style={{ flex: `0 0 calc(${(cb.vencido.monto / totalCob) * 100}% - 3px)`, background: ROJO }} />}
          <span style={{ flex: `0 0 calc(${(cb.d30.monto / totalCob) * 100}% - 3px)`, background: ORO }} />
          <span style={{ flex: `0 0 calc(${(cb.d60.monto / totalCob) * 100}% - 3px)`, background: LILA }} />
          <span style={{ flex: 1, background: CIELO }} />
        </div>
        {cb.vencido.n > 0 && <Tramo color={ROJO} label="Vencido" n={cb.vencido.n} monto={cb.vencido.monto} nota="ya pasó la fecha" primero />}
        <Tramo color={ORO} colorTexto={AMBAR} label="En 30 días" n={cb.d30.n} monto={cb.d30.monto}
          nota={cb.este_mes.n ? `${cb.este_mes.n} antes de que acabe ${mesDe(cb.fin_de_mes)}` : `ninguna en lo que resta de ${mesDe(cb.fin_de_mes)}`} primero={cb.vencido.n === 0} />
        <Tramo color={LILA} colorTexto={MORADO} label="En 60 días" n={cb.d60.n} monto={cb.d60.monto} />
        <Tramo color={CIELO} colorTexto={AZUL} label="En 90 días" n={cb.d90.n} monto={cb.d90.monto} />

        {/* La lista es EXACTAMENTE el subconjunto del que habla el encabezado:
            antes enseñaba 4 de 15 y no cuadraba con ninguna cifra de arriba. */}
        {cb.este_mes.n > 0 && (
          <div style={{ marginTop: 13 }}>
            <button onClick={() => setVerMes(v => !v)}
              style={{ border: '1.5px solid #cdc4fb', borderRadius: 9, padding: '9px 14px', background: '#fff', fontSize: '0.72rem', fontWeight: 800, color: MORADO, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              {verMes ? 'Ocultar' : `Ver las ${cb.este_mes.n} que caen antes de que acabe ${mesDe(cb.fin_de_mes)}`} · {money(cb.este_mes.monto)}
            </button>
            {verMes && cb.este_mes.items.map((r: any) => (
              <div key={r.id} style={S.fila}>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap', background: '#FEF6E7', color: '#9a6a10', flex: '0 0 auto' }}>
                  {fmtDate(r.fecha)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...S.fl, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => abrir(r.company_id)}>{r.cliente}</div>
                  <div style={{ ...S.fn, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.plan}</div>
                </div>
                <b style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{money(r.monto)}</b>
                {r.link && <a style={{ ...S.btnP, flex: '0 0 auto' }} href={r.link} target="_blank" rel="noreferrer">Cobrar</a>}
              </div>
            ))}
          </div>
        )}

        <div style={S.nota}>
          {cb.vencido.n === 0 ? 'Nada vencido. ' : <>Hay <b style={{ color: ROJO }}>{money(cb.vencido.monto)}</b> vencidos. </>}
          {cb.este_mes.n > 0
            ? <>Estos {money(cb.este_mes.monto)} son los que deciden si el mes llega a la meta.</>
            : <>Ya no vence nada más este mes.</>}
          {/* Sin fecha no entran en ningún tramo: el total de arriba se queda
              corto y nadie las va a cobrar. Es captura, no un cero. */}
          {cb.sin_fecha.n > 0 && (
            <> Ojo: <b style={{ color: '#9a6a10' }}>{cb.sin_fecha.n} {cb.sin_fecha.n === 1 ? 'licencia activa' : 'licencias activas'} por {money(cb.sin_fecha.monto)}</b> no tienen fecha de renovación capturada, así que no entran en ningún tramo ni en el total.</>
          )}
        </div>
      </div>
  );
}

function Tramo({ color, colorTexto, label, n, monto, nota, primero }: any) {
  return (
    <div style={{ ...S.fila, borderTop: primero ? 'none' : S.fila.borderTop }}>
      <span style={S.dot(color)} />
      <div style={{ minWidth: 0 }}>
        <div style={S.fl}>{label}</div>
        <div style={S.fn}>{n} {n === 1 ? 'renovación' : 'renovaciones'}{nota ? ` · ${nota}` : ''}</div>
      </div>
      <b style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 800, color: colorTexto || color }}>{money(monto)}</b>
    </div>
  );
}

/* ════════════════ 5 · SALUD ════════════════ */
function Salud({ d }: any) {
  const s = d.salud;
  return (
    <div style={S.card}>
      <div style={S.titulo}>Salud del negocio<span style={S.der}>ARR {money(s.arr)} · {s.clientes} clientes activos</span></div>
      <div style={S.lead}>Lo que preguntan un inversionista y tu equipo. Cada número dice qué significa; lo que no se puede calcular todavía, lo dice.</div>
      <div className="tb-3" style={{ marginBottom: 14 }}>
        <Metrica rosa titulo="Retención neta (NRR)" valor={s.nrr != null ? `${s.nrr}%` : '—'} color={s.nrr != null && s.nrr >= 100 ? MORADO : AMBAR}
          explica={s.nrr != null
            ? <>De cada $100 que te pagaban al empezar el periodo, hoy te pagan <b>${s.nrr}</b> los MISMOS clientes. Arriba de 100 creces sin vender a nadie nuevo.</>
            : <>Hace falta más historia de altas y bajas para calcularla.</>} />
        <Metrica rosa titulo="Bajas (churn)" valor={s.churn_pct != null ? `${s.churn_pct}%` : '—'}
          explica={s.churn_arr ? <>Se fueron <b>{money(s.churn_arr)} de ARR</b>. A ese ritmo perderías esa proporción del negocio cada mes.</>
            : <>Sin bajas en el periodo. Eso es lo que sostiene el ARR.</>} />
        <Metrica rosa titulo="Ingreso por cuenta" valor={money(s.arpa)}
          explica={<>ARR entre clientes activos. Sube cuando vendes plugins y personalizaciones, no solo licencias.</>} />
      </div>
      <div className="tb-3">
        <Metrica titulo="Tasa de cierre" valor={s.cierre_pct != null ? `${s.cierre_pct}%` : '—'} color={MORADO}
          explica={s.cierre_pct != null
            ? <>De cada 10 cotizaciones resueltas, <b>{Math.round(s.cierre_pct / 10)} se pagan</b>. Sobre {s.cierre_n} cerradas.</>
            : <>Todavía no hay cotizaciones resueltas para calcularla.</>} />
        <Metrica titulo="Ciclo de venta" valor={s.ciclo_dias != null ? `${s.ciclo_dias} días` : '—'} color={MORADO}
          explica={s.ciclo_dias != null
            ? <>Entre que mandas la cotización y te pagan. Para cerrar el mes que viene, hay que cotizar con {s.ciclo_dias} días de anticipación.</>
            : <>Aún no hay cotizaciones pagadas para medirlo.</>} />
        <Metrica titulo="Concentración" valor={s.concentracion != null ? `${s.concentracion}%` : '—'} color={(s.concentracion || 0) > 30 ? AMBAR : VERDE}
          explica={<>Tus <b>5 cuentas más grandes</b> son ese porcentaje del ARR. Arriba de 30% un inversionista lo marca como riesgo.</>} />
      </div>
      {s.antiguedad_meses != null && (
        <div style={S.nota}>
          Tus {s.antiguedad_n} cuentas activas llevan en promedio <b style={{ color: '#3f3b4d' }}>
            {s.antiguedad_meses >= 12 ? `${(s.antiguedad_meses / 12).toFixed(1).replace('.0', '')} años` : `${s.antiguedad_meses} meses`}
          </b> contigo, desde su primera suscripción. Es lo que separa un negocio que retiene de uno que solo repone.
        </div>
      )}
    </div>
  );
}

/** Una métrica con su explicación. El rosa marca las de inversionista: son las
 *  que no se tocan a diario, y así se distinguen sin gritar. */
function Metrica({ titulo, valor, explica, color, rosa }: any) {
  return (
    <div style={{
      ...S.mini,
      borderColor: rosa ? 'rgba(244,168,205,.45)' : '#ececf1',
      background: rosa ? 'rgba(244,168,205,.12)' : '#fff',
    }}>
      <div style={{ ...S.eyebrow, color: rosa ? '#9c3d70' : MORADO }}>{titulo}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: 6, letterSpacing: '-.02em', color: color || '#17151f' }}>{valor}</div>
      <div style={S.ms}>{explica}</div>
    </div>
  );
}

/* ════════════════ EL DETALLE ════════════════
   Un solo componente para las seis vistas: todas son "encabezado con la cifra
   + tabla". Seis modales distintos serían seis formas de leer lo mismo. */
function Detalle({ d, cual, cerrar, abrir }: any) {
  const v = vistaDe(d, cual);
  if (!v) return null;
  return (
    <div className="tb-velo" onClick={cerrar} role="dialog" aria-modal="true">
      <div className="tb-modal tb" onClick={(e: any) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f0f5', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={S.eyebrow}>{v.titulo}</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, marginTop: 6, color: v.color }}>{v.cifra}</div>
              <div style={S.pie}>{v.sub}</div>
            </div>
            <button onClick={cerrar} aria-label="Cerrar"
              style={{ marginLeft: 'auto', border: '1px solid #ececf1', background: '#fff', borderRadius: 9, width: 32, height: 32, fontSize: '1rem', color: '#8a8590', cursor: 'pointer', fontFamily: 'inherit', flex: '0 0 auto' }}>×</button>
          </div>
          {v.resumen && v.resumen.length > 0 && (
            <div className="tb-4" style={{ margin: '14px 0 4px' }}>
              {v.resumen.map((r: any) => (
                <div key={r.label} style={{ ...S.mini, borderLeft: `3px solid ${r.color}` }}>
                  <div style={S.eyebrow}>{r.label}</div>
                  <div style={{ ...S.mv, fontSize: '1.15rem', color: r.color }}>{r.valor}</div>
                  <div style={S.ms}>{r.nota}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '8px 24px 22px' }}>
          {v.filas.length === 0
            ? <div style={{ color: '#c9c7d0', fontSize: '0.82rem', padding: '28px 0', textAlign: 'center' }}>Nada que mostrar en este periodo.</div>
            : <table className="tb-tabla">
              <thead><tr>{v.cols.map((c: any, i: number) => (
                <th key={c} style={i === v.cols.length - 1 ? { textAlign: 'right' } : undefined}>{c}</th>
              ))}</tr></thead>
              <tbody>{v.filas.map((f: any, i: number) => (
                <tr key={i} className={f.company_id ? 'cliqueable' : undefined} onClick={f.company_id ? () => abrir(f.company_id) : undefined}>
                  {f.celdas.map((c: any, j: number) => (
                    <td key={j} style={j === f.celdas.length - 1
                      ? { textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }
                      : j === 0 ? { color: '#8a8590', fontSize: '0.72rem', whiteSpace: 'nowrap' } : undefined}>{c}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>}
          {v.nota && <div style={S.nota}>{v.nota}</div>}
        </div>
      </div>
    </div>
  );
}

const CHIP = (txt: string, col: string) => (
  <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', background: col + '1f', color: col, whiteSpace: 'nowrap' }}>{txt}</span>
);
const COL_METODO: Record<string, string> = { transferencia: LILA, tarjeta: '#C062A0', mercadopago: ROSA_S, efectivo: ORO };
const ETIQ_ESTADO: Record<string, [string, string]> = {
  accepted: ['aceptada sin pagar', ORO], sent: ['esperando respuesta', CIELO],
  parcial: ['pagada a medias', AMBAR], paid: ['pagada', VERDE],
};

/** Arma la vista pedida. Vive aparte del componente para que el JSX de arriba
 *  sea una sola forma y no un árbol de condicionales por cada caso. */
function vistaDe(d: any, cual: string): any {
  const nombreMes = mesDe(d.periodo.desde);
  if (cual === 'cobrado') {
    const c = d.cobrado;
    return {
      titulo: `Cobrado en ${nombreMes}`, cifra: money(c.monto), color: MORADO,
      sub: `${c.n} ${c.n === 1 ? 'pago' : 'pagos'}, del ${fmtDate(d.periodo.desde)} al ${fmtDate(d.periodo.hasta)}. Sin reembolsos ni duplicados.`,
      resumen: c.metodos.slice(0, 4).map((m: any) => ({
        label: m.metodo, color: COL_METODO[m.metodo] || '#C9C7D0', valor: money(m.monto),
        nota: `${m.n} ${m.n === 1 ? 'pago' : 'pagos'} · ${Math.round((m.monto / Math.max(1, c.monto)) * 100)}%`,
      })),
      cols: ['Fecha', 'Cliente', 'Concepto', 'Método', 'Monto'],
      filas: c.items.map((p: any) => ({
        company_id: p.company_id,
        celdas: [fmtDate(p.fecha), <b>{p.cliente || '(sin cliente ligado)'}</b>,
          <span style={{ color: '#8a8590', fontSize: '0.73rem' }}>{p.concepto}</span>,
          CHIP(p.metodo, COL_METODO[p.metodo] || '#8a8590'), money(p.monto)],
      })),
      nota: c.sin_cliente.n > 0
        ? <>{c.sin_cliente.n} {c.sin_cliente.n === 1 ? 'pago' : 'pagos'} por <b style={{ color: '#3f3b4d' }}>{money(c.sin_cliente.monto)}</b> no {c.sin_cliente.n === 1 ? 'tiene' : 'tienen'} cliente ligado: conviene asignarlos para que cuenten en la ficha de la cuenta.</>
        : null,
    };
  }
  if (cual === 'mesa') {
    const m = d.sobre_la_mesa;
    return {
      titulo: 'Sobre la mesa hoy', cifra: money(m.total), color: AMBAR,
      sub: `${m.items.length} cotizaciones vivas. No dependen del periodo: una de hace meses sin responder sigue siendo dinero por cerrar.`,
      resumen: [
        { label: 'Aceptadas sin pagar', color: ORO, valor: money(m.aceptadas.monto), nota: `${m.aceptadas.n} · ya dijeron que sí` },
        { label: 'Sin respuesta', color: CIELO, valor: money(m.enviadas.monto), nota: `${m.enviadas.n} · en manos del cliente` },
        { label: 'En plática', color: LILA, valor: money(m.oportunidades.monto), nota: `${m.oportunidades.n} oportunidades · no se suman` },
      ],
      cols: ['Creada', 'Cotización', 'Estado', 'Esperando', 'Total'],
      filas: m.items.map((q: any) => {
        const [txt, col] = ETIQ_ESTADO[q.estado] || [q.estado, '#8a8590'];
        return {
          company_id: q.company_id,
          celdas: [fmtDate(q.creada), <><b>{q.empresa}</b><div style={S.fn}>{q.numero}</div></>, CHIP(txt, col),
            <span style={{ color: q.espera > 14 ? ROJO : '#8a8590', fontSize: '0.73rem', fontWeight: q.espera > 14 ? 700 : 400 }}>{q.espera} días</span>,
            money(q.total)],
        };
      }),
      nota: m.oportunidades.con_cotizacion > 0
        ? <>Las {m.oportunidades.n} oportunidades en plática valen {money(m.oportunidades.monto)}, pero {m.oportunidades.con_cotizacion} ya salieron en estas cotizaciones: por eso no se suman al total de arriba.</>
        : null,
    };
  }
  if (cual === 'generado') {
    const g = d.generado;
    return {
      titulo: `Generado en ${nombreMes}`, cifra: money(g.monto), color: MORADO,
      sub: `${g.n} ${g.n === 1 ? 'cotización aceptada' : 'cotizaciones aceptadas'} en el periodo. El cliente ya dijo que sí, se haya cobrado o no.`,
      cols: ['Aceptada', 'Cotización', 'Estado', 'Total'],
      filas: g.items.map((q: any) => {
        const [txt, col] = ETIQ_ESTADO[q.estado] || [q.estado, '#8a8590'];
        return {
          company_id: q.company_id,
          celdas: [fmtDate(q.aceptada || q.creada), <><b>{q.empresa}</b><div style={S.fn}>{q.numero}</div></>, CHIP(txt, col), money(q.total)],
        };
      }),
    };
  }
  if (cual === 'clientes') {
    const it = d.contadores.items.clientes_nuevos;
    return {
      titulo: `Clientes nuevos en ${nombreMes}`, cifra: String(d.contadores.clientes_nuevos), color: VERDE,
      sub: `Licencias que arrancaron en el periodo, por ${money(it.reduce((a: number, x: any) => a + x.arr, 0))} de ARR.`,
      cols: ['Arrancó', 'Cliente', 'Plan', 'Ciclo', 'ARR'],
      filas: it.map((x: any) => ({
        company_id: x.company_id,
        celdas: [fmtDate(x.fecha), <b>{x.cliente}</b>, <span style={{ color: '#8a8590', fontSize: '0.73rem' }}>{x.plan}</span>, CHIP(x.ciclo, LILA), money(x.arr)],
      })),
    };
  }
  if (cual === 'leads') {
    const it = d.contadores.items.leads;
    return {
      titulo: `Leads nuevos en ${nombreMes}`, cifra: String(d.contadores.leads), color: AZUL,
      sub: 'Empresas que entraron en el periodo y todavía no compran.',
      cols: ['Entró', 'Empresa', 'Estado'],
      filas: it.map((x: any) => ({
        company_id: x.company_id,
        celdas: [fmtDate(x.fecha), <b>{x.cliente}</b>, CHIP(x.estado, CIELO)],
      })),
      nota: <>De estos, {d.cohorte.pasos[1].n} {d.cohorte.pasos[1].n === 1 ? 'tuvo' : 'tuvieron'} reunión y {d.cohorte.pasos[2].n} {d.cohorte.pasos[2].n === 1 ? 'recibió' : 'recibieron'} cotización. Ver el recorrido completo en el tablero.</>,
    };
  }
  if (cual === 'bajas' || cual === 'ampliaciones') {
    const esBaja = cual === 'bajas';
    const it = esBaja ? d.recurrente.movimientos.bajas : d.recurrente.movimientos.ampliaciones;
    const total = it.reduce((a: number, x: any) => a + x.arr, 0);
    return {
      titulo: esBaja ? `Bajas de ${nombreMes}` : `Ampliaciones de ${nombreMes}`,
      cifra: money(Math.abs(total)), color: esBaja ? ROJO : MORADO,
      sub: esBaja
        ? `${it.length} ${it.length === 1 ? 'cancelación' : 'cancelaciones'} de ARR en el periodo. El motivo se captura en la ficha de cada cuenta.`
        : `${it.length} ${it.length === 1 ? 'ampliación' : 'ampliaciones'} de clientes que ya tenías. Es el crecimiento que no cuesta conseguir.`,
      cols: ['Fecha', 'Cliente', 'ARR'],
      filas: it.map((x: any) => ({
        company_id: x.company_id,
        celdas: [fmtDate(x.fecha), <b>{x.cliente}</b>,
          <span style={{ color: esBaja ? ROJO : VERDE }}>{conSigno(x.arr)}</span>],
      })),
    };
  }
  return null;
}

/* ════════════════ LA IDENTIDAD: EL SELLO Y SUS DESTELLOS ════════════════
   La silueta EXACTA del logo, la misma que gira en el cargador y la que se
   dibuja en el cielo de la entrada. Repetirla es lo que hace que una marca se
   reconozca; una estrella aproximada a mano sale romboide y no es nada. */
const CHISPA = 'M12 1.6c.62 6.6 3.18 9.16 9.78 9.78-6.6.62-9.16 3.18-9.78 9.78-.62-6.6-3.18-9.16-9.78-9.78C8.82 10.76 11.38 8.2 12 1.6z';

/* Cinco pasos, CINCO pantallas. Antes los pasos 3, 4 y 5 abrían la misma
   sección y el dueño lo cachó: «me estás dando la misma información tres
   veces». Cada paso tiene ahora su propia pregunta:
     Clientes     · quiénes son y cómo está la cartera
     Recurrencia  · el dinero que vuelve solo, y el que dejó de volver
     Expansión    · dónde está lo que todavía no vendes */
type Sec = 'consultoria' | 'leads' | 'clientes' | 'recurrencia' | 'expansion';

/* Diez destellos, de distinto tamaño y con el latido desfasado para que no
   parpadeen a coro. Son decoración: no llevan texto y van ocultos al lector de
   pantalla. */
const DESTELLOS: [number, string, number, number, number, string][] = [
  [13, '1%', 4, 0.55, 0, '#D9538E'], [8, '7%', 46, 0.4, 1.1, '#9B8CFA'],
  [10, '13%', 14, 0.34, 2.6, '#EFA6CA'], [17, '20%', -6, 0.3, 2.2, '#EFA6CA'],
  [9, '26%', 52, 0.45, 0.6, '#D9538E'], [7, '31%', 22, 0.3, 3.2, '#9B8CFA'],
  [22, '36%', 6, 0.24, 1.7, '#9B8CFA'], [8, '42%', 42, 0.48, 2.8, '#EFA6CA'],
  [11, '48%', -2, 0.3, 0.3, '#D9538E'], [6, '54%', 30, 0.36, 1.9, '#EFA6CA'],
  [9, '60%', 50, 0.42, 1.4, '#9B8CFA'], [15, '66%', 8, 0.22, 2.4, '#EFA6CA'],
  [7, '72%', 36, 0.34, 0.8, '#D9538E'], [12, '78%', 0, 0.26, 3.4, '#9B8CFA'],
  [9, '85%', 44, 0.36, 0.9, '#D9538E'], [10, '93%', 16, 0.28, 2.1, '#EFA6CA'],
];
function Chispas() {
  return (
    <div className="tb-chispas" aria-hidden="true">
      {DESTELLOS.map(([w, x, y, o, dl, c], i) => (
        <svg key={i} width={w} height={w} viewBox="0 0 24 24"
          style={{ left: x, top: y, ['--o' as any]: o, animationDelay: `${dl}s` }}><path d={CHISPA} fill={c} /></svg>
      ))}
    </div>
  );
}

/* ════════════════ EL RIEL ════════════════
   Consultoría → Leads → Clientes → Recurrencia → Expansión. Los cinco pasos son
   el camino del dinero; los tres primeros son secciones y los dos últimos viven
   dentro de Clientes, que es donde se miden. Cada paso trae su cifra puesta
   para que el orden se lea sin entrar. */
function Riel({ sec, irA, d, x }: { sec: Sec; irA: (v: Sec) => void; d: any; x: any }) {
  const co = x?.consultoria, cl = x?.clientes;
  const pasos: { n: number; et: string; ci: string; color: string; va: Sec }[] = [
    { n: 1, et: 'Consultoría', color: '#D9538E', va: 'consultoria',
      ci: co ? `${co.juntas} juntas · ${corto(co.cotizaciones.monto)} cotizados` : `${d.reuniones.total} juntas` },
    { n: 2, et: 'Leads', color: '#9B8CFA', va: 'leads',
      ci: `${d.contadores.leads} nuevos · ${d.contadores.clientes_nuevos} se hicieron clientes` },
    { n: 3, et: 'Clientes', color: '#8E7DEF', va: 'clientes',
      ci: `${d.salud.clientes} activos · ARR ${corto(d.salud.arr)}` },
    { n: 4, et: 'Recurrencia', color: '#C062A0', va: 'recurrencia',
      ci: cl ? `${cl.recompras.n} recompras · ${cl.renovaciones.length} renovaciones` : 'recompras y renovaciones' },
    { n: 5, et: 'Expansión', color: '#E8A838', va: 'expansion',
      ci: cl?.expansion?.length ? `${cl.expansion.length} cuentas con idea sin cotizar` : 'quién puede crecer' },
  ];
  return (
    <div className="tb-riel" role="tablist">
      {pasos.map(ps => (
        <button key={ps.n} className="tb-paso" role="tab"
          aria-selected={sec === ps.va} onClick={() => irA(ps.va)}>
          <span className="n" style={{ background: ps.color }}>{ps.n}</span>
          <span><span className="et">{ps.et}</span><span className="ci">{ps.ci}</span></span>
        </button>
      ))}
    </div>
  );
}

/* ════════════════ LA TARJETA DE CIFRA ════════════════
   Franja de color a la izquierda —dice de qué habla el número antes de
   leerlo—, etiqueta en versalitas, cifra en su tinta y una línea que explica.
   Si trae `ver`, se puede abrir: el cursor y la sombra lo dicen. */
function Kpi({ color, tinta, et, ci, pie, ver }: any) {
  return (
    <div className={'tb-kpi' + (ver ? ' tb-clic' : '')} onClick={ver} style={ver ? { cursor: 'pointer' } : undefined}>
      <span style={{ position: 'absolute', left: 0, top: 13, bottom: 13, width: 4, borderRadius: '0 4px 4px 0', background: color }} />
      <div style={S.eyebrow}>{et}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.03em', marginTop: 5, lineHeight: 1.05, color: tinta }}>{ci}</div>
      <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 4, lineHeight: 1.4 }}>{pie}</div>
    </div>
  );
}
/* El hueco declarado: la cifra que el negocio pide y el sistema todavía no
   sabe calcular. Se enseña en punteado y diciendo qué falta — un número
   inventado es peor que un hueco. */
function KpiFalta({ et, que }: any) {
  return (
    <div className="tb" style={{ border: '1px dashed #cdc4fb', borderRadius: 11, padding: '14px 16px' }}>
      <div style={S.eyebrow}>{et}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#bdb7cc', marginTop: 5 }}>falta conectar</div>
      <div style={{ fontSize: '0.6875rem', color: MORADO, marginTop: 5, lineHeight: 1.45, fontWeight: 600 }}>{que}</div>
    </div>
  );
}

/* ════════════════ 1 · CONSULTORÍA: LAS SEIS CIFRAS ════════════════ */
function KpisConsultoria({ d, x, ver }: any) {
  const co = x?.consultoria;
  const c = d.cobrado, cb = d.cobrar, sm = d.sobre_la_mesa;
  const pc = x?.dinero?.por_cobrar;
  return (
    <div className="tb-kpis">
      <Kpi color="#D9538E" tinta="#9c3d70" et="Juntas que diste" ci={co ? co.juntas : d.reuniones.total}
        pie={co ? `${co.clientes} cuentas distintas` : `${d.reuniones.fueron} asistieron`} />
      <Kpi color="#EFA6CA" tinta="#9c3d70" et="Clientes con consultoría" ci={co ? co.clientes : '—'}
        pie={co ? `de ${co.clientes_activos} activos · ${Math.round((co.clientes / Math.max(1, co.clientes_activos)) * 100)}%` : 'sin datos del periodo'} />
      <Kpi color={LILA} tinta={MORADO} et="Cotizaciones generadas" ci={co ? co.cotizaciones.n : '—'}
        pie={co ? `${money(co.cotizaciones.monto)} en la mesa` : '—'} />
      <Kpi color={MENTA} tinta={VERDE} et="Monto cobrado" ci={money(c.monto)} ver={() => ver('cobrado')}
        pie={`${c.n} ${c.n === 1 ? 'pago' : 'pagos'} · clic para verlos`} />
      {/* Esta cifra estaba MAL hasta hoy por dos razones: contaba renovaciones
          de licencia —que no son consultoría— y contaba completas las
          cotizaciones que ya recibieron anticipo, así que el mismo dinero
          aparecía en «cobrado» y en «por cobrar» al mismo tiempo. */}
      <Kpi color={ORO} tinta={AMBAR} et="Monto por cobrar" ci={money(pc ? pc.neto : sm.total)} ver={() => ver('mesa')}
        pie={pc && pc.con_anticipo
          ? `${pc.n} cotizaciones · ${money(x.dinero.anticipos)} ya entraron de anticipo`
          : `${pc ? pc.n : sm.aceptadas.n + sm.enviadas.n} cotizaciones vivas`} />
      <Kpi color="#D9538E" tinta="#9c3d70" et="Ingreso por cliente" ci={co ? money(co.ticket) : '—'}
        pie="promedio de quien SÍ pagó" />
    </div>
  );
}

/* ════════════════ LA CARTERA Y POR DÓNDE PASÓ ════════════════
   Una línea por cuenta que tuvo junta: lo que pagó, lo que debe y qué sigue.
   Las cuentas con junta y sin cobro se quedan en la lista a propósito — ese
   hueco es justo lo que hay que ver. */
const CHIP_CARTERA: Record<string, { t: string; fondo: string; letra: string }> = {
  al_dia: { t: 'Al día', fondo: '#EAF8F2', letra: VERDE },
  por_cobrar: { t: 'Por cobrar', fondo: '#FFF4E5', letra: '#9a6a10' },
  vencida: { t: 'Vencida', fondo: '#FEF0EF', letra: ROJO },
  idea: { t: 'Idea abierta', fondo: '#EEECFE', letra: MORADO },
};
function CarteraYCanales({ x, abrir, tercera }: any) {
  const [todo, setTodo] = useState(false);
  if (!x) return null;
  const co = x.consultoria;
  const lista = todo ? co.cartera : co.cartera.slice(0, 8);
  const topeCanal = Math.max(co.canales.reuniones, co.canales.whatsapp, co.canales.llamadas, 1);
  const topeServ = Math.max(...co.servicios.map((v: any) => v.monto), 1);
  return (
    <>
      {/* La tabla va a todo el ancho: es el bloque con más contenido y al
          meterlo en media pantalla dejaba media columna de fondo vacío
          debajo. Las dos listas de barras, que miden parecido, van juntas. */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.titulo}>Clientes de consultoría<span style={S.der}>cobrado, pendiente y qué sigue</span></div>
        <div style={S.lead}>
          Las {co.cartera.length} cuentas con junta en el periodo. Las que aparecen sin cobro no son un error:
          diste la junta y todavía no salió dinero de ahí.
        </div>
        {!co.cartera.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Ninguna junta con cuenta en este periodo.</div>
          : (<>
            <table className="tb-tabla">
              <thead><tr>
                <th>Cliente</th><th style={{ textAlign: 'right' }}>Cobrado</th>
                <th style={{ textAlign: 'right' }}>Pendiente</th><th>Estado</th><th>Próxima acción</th>
              </tr></thead>
              <tbody>
                {lista.map((r: any) => {
                  const ch = CHIP_CARTERA[r.estado];
                  return (
                    <tr key={r.company_id} className="cliqueable" onClick={() => abrir(r.company_id)}>
                      <td style={{ fontWeight: 700 }}>{r.nombre}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: r.cobrado ? VERDE : '#c9c5d2' }}>{r.cobrado ? money(r.cobrado) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: r.pendiente ? (r.estado === 'vencida' ? ROJO : '#9a6a10') : '#c9c5d2' }}>{r.pendiente ? money(r.pendiente) : '—'}</td>
                      <td><span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: ch.fondo, color: ch.letra }}>{ch.t}</span></td>
                      <td style={{ color: MORADO, fontWeight: 700, fontSize: '0.74rem' }}>{r.accion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {co.cartera.length > 8 && (
              <button onClick={() => setTodo(!todo)} style={{ ...S.btnA, marginTop: 12 }}>
                {todo ? 'Ver solo las 8 primeras' : `Ver las ${co.cartera.length} cuentas`}
              </button>
            )}
          </>)}
      </div>

      <div className="tb-3" style={{ marginBottom: 16 }}>
        <div style={S.card}>
          <div style={S.titulo}>Por dónde pasó<span style={S.der}>el periodo</span></div>
          <div style={S.reparte}>
          {([['Reuniones', co.canales.reuniones, '#D9538E', '#EFA6CA'],
             ['WhatsApp', co.canales.whatsapp, LILA, '#C6BCFB'],
             ['Llamadas', co.canales.llamadas, '#C9A6E8', '#E4D2F5']] as const).map(([n, v, a, b]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, width: 100, flex: 'none' }}>{n}</span>
              <span style={{ flex: 1, height: 9, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${(v / topeCanal) * 100}%`, background: `linear-gradient(90deg,${a},${b})` }} />
              </span>
              <b style={{ fontSize: '0.76rem', width: 46, textAlign: 'right' }}>{v}</b>
            </div>
          ))}
          </div>
          <div style={S.nota}>
            Reuniones son las juntas que sí pasaron; WhatsApp, las conversaciones con movimiento; llamadas, las del
            marcador del inbox. No se suman: una misma cuenta puede estar en los tres.
          </div>
        </div>

        <div style={S.card}>
          <div style={S.titulo}>De dónde vino el dinero<span style={S.der}>lo cobrado del periodo</span></div>
          <div style={S.reparte}>
          {!co.servicios.length
            ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Sin cobros en el periodo.</div>
            : co.servicios.map((sv: any) => (
              <div key={sv.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, width: 128, flex: 'none' }}>{sv.nombre}</span>
                <span style={{ flex: 1, height: 9, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${(sv.monto / topeServ) * 100}%`, background: 'linear-gradient(90deg,#D9538E,#EFA6CA)' }} />
                </span>
                <b style={{ fontSize: '0.76rem', width: 62, textAlign: 'right' }}>{corto(sv.monto)}</b>
              </div>
            ))}
          </div>
          <div style={S.nota}>
            Sale del plan de la cotización que cubrió cada pago. Lo que cae en <b>«Venta cotizada»</b> son cobros cuya
            cotización no trae plan marcado: para partirlo por servicio hay que capturarlo al cotizar.
          </div>
        </div>

        {tercera}
      </div>
    </>
  );
}

/* ════════════════ 3 · CLIENTES: QUIÉNES SON ════════════════ */
function KpisClientes({ d, x }: any) {
  const s = d.salud, k = d.contadores;
  return (
    <div className="tb-kpis">
      <Kpi color={LILA} tinta={MORADO} et="Clientes activos" ci={s.clientes} pie="con licencia viva hoy" />
      <Kpi color={LILA} tinta={MORADO} et="Lo que pagan al año" ci={corto(s.arr)} pie={money(s.arr)} />
      <Kpi color={LILA} tinta={MORADO} et="Ingreso por cliente" ci={money(s.arpa)} pie="lo que te deja cada cuenta al año" />
      <Kpi color={ROSA_S} tinta={ROSA_T} et="Clientes nuevos" ci={k.clientes_nuevos} pie="licencias que arrancaron en el periodo" />
      <Kpi color={ROSA} tinta={ROSA_T} et="Se dieron de baja" ci={k.bajas} pie={k.bajas ? `se llevaron ${money(k.bajas_arr)}` : 'ninguno en el periodo'} />
      <Kpi color={LILA} tinta={MORADO} et="Llevan contigo" ci={s.antiguedad_meses != null ? `${s.antiguedad_meses} meses` : '—'}
        pie="en promedio, desde su primera licencia" />
    </div>
  );
}

/* ════════════════ 4 · RECURRENCIA: EL DINERO QUE VUELVE SOLO ════════════════ */
function KpisRecurrencia({ d, x }: any) {
  const cl = x?.clientes, ne = x?.dinero?.no_entrara;
  return (
    <div className="tb-kpis">
      <Kpi color={ROSA_S} tinta={ROSA_T} et="Clientes que repiten" ci={cl ? cl.recurrentes : '—'}
        pie={cl ? `${cl.recurrentes_pct}% de los activos pagó más de una vez` : '—'} />
      <Kpi color={ROSA} tinta={ROSA_T} et="Recompras del periodo" ci={cl ? cl.recompras.n : '—'}
        pie={cl ? money(cl.recompras.monto) : '—'} />
      <Kpi color={LILA} tinta={MORADO} et="Cada cuánto vuelven" ci={cl?.frecuencia_meses != null ? (cl.frecuencia_meses === 1 ? 'cada mes' : `${cl.frecuencia_meses} meses`) : '—'}
        pie="la mediana entre un pago y el siguiente" />
      <Kpi color={LILA} tinta={MORADO} et="Renovaciones que vienen" ci={cl ? cl.renovaciones.length : '—'}
        pie="en los próximos 60 días" />
      <Kpi color={ORO} tinta={AMBAR} et="Por renovar" ci={cl ? money(cl.renovaciones_monto) : '—'}
        pie="ya contratado, toca cobrarlo" />
      <Kpi color={ROSA} tinta={ROSA_T} et="Dejó de entrar" ci={ne ? money(ne.anio.arr) : '—'}
        pie={ne ? `${ne.anio.n} cuentas en 12 meses` : '—'} />
    </div>
  );
}

/* ════════════════ 5 · EXPANSIÓN: LO QUE TODAVÍA NO VENDES ════════════════ */
function KpisExpansion({ d, x }: any) {
  const ex = x?.clientes?.expansion_total, op = x?.dinero?.oportunidades, r = d.recurrente, k = d.contadores;
  return (
    <div className="tb-kpis">
      <Kpi color={ROSA} tinta={ROSA_T} et="Cuentas por crecer" ci={ex ? ex.cuentas : '—'}
        pie="te pidieron algo y sigue sin cotizar" />
      <Kpi color={ROSA_S} tinta={ROSA_T} et="Ideas sin cotizar" ci={ex ? ex.ideas : '—'}
        pie="salieron de las juntas" />
      <Kpi color={LILA} tinta={MORADO} et="Oportunidades abiertas" ci={op ? op.abiertas.n : '—'}
        pie={op && op.abiertas.monto ? money(op.abiertas.monto) : 'en plática'} />
      <Kpi color={ORO} tinta={AMBAR} et="Sin precio" ci={op ? op.sin_cotizar.n : '—'}
        pie="abiertas y todavía sin cotización" />
      <Kpi color={LILA} tinta={MORADO} et="Ampliaciones del periodo" ci={k.ampliaciones}
        pie="clientes que compraron más" />
      <Kpi color={LILA} tinta={MORADO} et="Creció el recurrente" ci={r.ampliaciones ? '+' + money(r.ampliaciones) : money(0)}
        pie="lo que sumaron esas ampliaciones al año" />
    </div>
  );
}

/* ════════════════ CÓMO SE REPARTE LA CARTERA ════════════════ */
const NOM_CICLO: Record<string, string> = { anual: 'Anuales', mensual: 'Mensuales', vitalicia: 'Vitalicias', 'sin ciclo': 'Sin ciclo' };
function Cartera({ d, x, ver }: any) {
  const cic = x?.clientes?.por_ciclo || [];
  const k = d.contadores, s = d.salud;
  const tope = Math.max(1, ...cic.map((c: any) => c.n));
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>Cómo se reparte la cartera<span style={S.der}>{s.clientes} cuentas activas</span></div>
        <div style={S.lead}>Una licencia vitalicia, una anual y una mensual ni valen lo mismo ni se cuidan igual.</div>
        <div style={S.reparte}>
          {cic.map((c: any, i: number) => (
            <div key={c.ciclo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, width: 96, flex: 'none' }}>{NOM_CICLO[c.ciclo] || c.ciclo}</span>
              <span style={{ flex: 1, height: 9, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${(c.n / tope) * 100}%`,
                  background: i === 0 ? 'linear-gradient(90deg,#7C6BF0,#C6BCFB)' : 'linear-gradient(90deg,#D9538E,#EFA6CA)' }} />
              </span>
              <b style={{ fontSize: '0.76rem', width: 34, textAlign: 'right' }}>{c.n}</b>
              <span style={{ ...S.fn, width: 62, textAlign: 'right' }}>{c.arr ? corto(c.arr) : '—'}</span>
            </div>
          ))}
        </div>
        <div style={S.nota}>
          Las vitalicias aparecen con cartera en cero porque ya pagaron todo: no suman al ingreso del año que viene,
          pero siguen siendo clientes que usan el sistema y pueden comprarte más.
          {s.concentracion != null && <> Tus 5 cuentas más grandes son el <b>{s.concentracion}%</b> de lo que te pagan.</>}
        </div>
      </div>

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
        <div style={S.titulo}>Quién entró y quién se fue<span style={S.der}>en el periodo</span></div>
        <div style={S.lead}>Cada tarjeta abre la lista con nombre y monto.</div>
        <div className="tb-cuad" style={{ flex: 1 }}>
          <Contador color={LILA} valorColor={MORADO} label="Clientes nuevos" valor={k.clientes_nuevos} nota="licencias que arrancaron" ver={() => ver('clientes')} />
          <Contador color={CIELO} label="Leads nuevos" valorColor={AZUL} valor={k.leads} nota="entraron y aún no compran" ver={() => ver('leads')} />
          <Contador color={ROSA} valorColor={ROSA_T} label="Bajas" valor={k.bajas} nota={k.bajas ? `se llevaron ${money(k.bajas_arr)}` : 'nadie se fue'} ver={k.bajas ? () => ver('bajas') : undefined} />
          <Contador color={ROSA_S} valorColor={ROSA_T} label="Ampliaciones" valor={k.ampliaciones} nota="clientes que compraron más" ver={k.ampliaciones ? () => ver('ampliaciones') : undefined} />
        </div>
        <div style={S.nota}>
          Entraron {k.empresas_nuevas} empresas y {k.clientes_nuevos} {k.clientes_nuevos === 1 ? 'firmó' : 'firmaron'}, mientras {k.bajas} se {k.bajas === 1 ? 'fue' : 'fueron'}.
          {' '}En neto la cartera {k.clientes_nuevos - k.bajas > 0 ? <>creció <b style={{ color: '#3f3b4d' }}>{k.clientes_nuevos - k.bajas} {k.clientes_nuevos - k.bajas === 1 ? 'cuenta' : 'cuentas'}</b></>
            : k.clientes_nuevos - k.bajas < 0 ? <>perdió <b style={{ color: ROSA_T }}>{k.bajas - k.clientes_nuevos} {k.bajas - k.clientes_nuevos === 1 ? 'cuenta' : 'cuentas'}</b></>
              : <>quedó igual</>}.
        </div>
      </div>
    </div>
  );
}

/* ════════════════ QUIÉN AMPLIÓ ════════════════
   El detalle de las ampliaciones del periodo, que es la prueba de que una
   cuenta se puede hacer más grande sin buscar clientes nuevos. */
function Ampliaciones({ d, abrir }: any) {
  const lista = (d.recurrente?.movimientos?.ampliaciones || []);
  const nuevos = (d.recurrente?.movimientos?.altas || []);
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>Quién compró más<span style={S.der}>ampliaciones del periodo</span></div>
        {!lista.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Nadie amplió en este periodo. La expansión de arriba es la que está esperando cotización.</div>
          : <div style={S.reparte}>
            {lista.slice(0, 6).map((m: any, i: number) => (
              <div key={i} className="tb-clic" style={{ ...S.fila, borderTop: i ? S.fila.borderTop : 'none', cursor: 'pointer' }}
                onClick={m.company_id ? () => abrir(m.company_id) : undefined}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.fl}>{m.cliente}</div>
                  <div style={S.fn}>{fmtDate(m.fecha)}</div>
                </div>
                <b style={{ fontSize: '0.82rem', color: MORADO }}>{conSigno(m.arr)}</b>
              </div>
            ))}
          </div>}
        <div style={S.nota}>Una ampliación vale más que un cliente nuevo: no costó adquisición y ya sabes que paga.</div>
      </div>

      <div style={S.card}>
        <div style={S.titulo}>Los que acaban de entrar<span style={S.der}>primeras licencias</span></div>
        {!nuevos.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Ninguna licencia nueva arrancó en el periodo.</div>
          : <div style={S.reparte}>
            {nuevos.slice(0, 6).map((m: any, i: number) => (
              <div key={i} className="tb-clic" style={{ ...S.fila, borderTop: i ? S.fila.borderTop : 'none', cursor: 'pointer' }}
                onClick={m.company_id ? () => abrir(m.company_id) : undefined}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.fl}>{m.cliente}</div>
                  <div style={S.fn}>{fmtDate(m.fecha)}</div>
                </div>
                <b style={{ fontSize: '0.82rem', color: MORADO }}>{conSigno(m.arr)}</b>
              </div>
            ))}
          </div>}
        <div style={S.nota}>Los primeros 90 días deciden si se quedan: agenda la junta de arranque mientras están calientes.</div>
      </div>
    </div>
  );
}

/* ════════════════ RECURRENCIA Y EXPANSIÓN ════════════════ */
function Recurrencia({ x, abrir, parte }: any) {
  if (!x) return null;
  const cl = x.clientes;
  const hoy = new Date().toISOString().slice(0, 10);

  /* «Listos para crecer» es la única lista que habla de vender, así que vive en
     Expansión; las otras dos hablan de sostener y viven en Recurrencia. Antes
     las tres estaban juntas y las tres secciones enseñaban lo mismo. */
  if (parte === 'crecer') return (
    <div className="tb-2" style={{ marginBottom: 16 }}>
      <div style={S.card}>
        <div style={S.titulo}>Listos para crecer<span style={S.der}>te lo pidieron en una junta</span></div>
        <div style={S.lead}>Cuentas con ideas de sus juntas que <b>nadie ha cotizado</b>. No es una corazonada del sistema: te lo pidieron.</div>
        {!cl.expansion.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Ninguna idea abierta sin cotizar.</div>
          : <div style={S.reparte}>
            {cl.expansion.slice(0, 8).map((e: any) => (
              <div key={e.company_id} className="tb-clic" style={{ ...S.fila, cursor: 'pointer' }} onClick={() => abrir(e.company_id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.fl}>{e.nombre}</div>
                  <div style={{ ...S.fn, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titulo || 'idea de la junta'}</div>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: '#EEECFE', color: MORADO, whiteSpace: 'nowrap' }}>
                  {e.ideas} {e.ideas === 1 ? 'idea' : 'ideas'}
                </span>
              </div>
            ))}
          </div>}
        <div style={S.nota}>Cotizar una idea que ya te pidieron cierra más rápido que cualquier prospecto nuevo.</div>
      </div>
      <Sueltos x={x} ver={abrir} parte="oportunidades" />
    </div>
  );

  return (
    <div className="tb-2" style={{ marginBottom: 16 }}>
      <div style={S.card}>
        <div style={S.titulo}>Renovaciones que vienen<span style={S.der}>próximos 60 días</span></div>
        {!cl.renovaciones.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Ninguna renovación en la ventana.</div>
          : cl.renovaciones.slice(0, 6).map((r: any, i: number) => {
            const dias = Math.round((Date.parse(r.fecha) - Date.parse(hoy)) / 86400000);
            return (
              <div key={i} style={{ ...S.fila, borderTop: i ? '1px solid #f4f3f7' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={S.fl}>{r.nombre}</div>
                  <div style={S.fn}>{fmtDate(r.fecha)} · {r.plan || 'licencia'}</div>
                </div>
                <b style={{ fontSize: '0.78rem', color: dias <= 7 ? '#9a6a10' : '#241d43' }}>{money(r.monto)}</b>
              </div>
            );
          })}
        <div style={S.nota}>Es la próxima factura de cada licencia activa. Lo que no se cobre aquí sale del ARR el mes siguiente.</div>
      </div>

      <div style={S.card}>
        <div style={S.titulo}>Se están yendo callados<span style={S.der}>sin vender hace rato</span></div>
        {!cl.sin_movimiento.length
          ? <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Ninguna cuenta activa lleva 60 días sin vender.</div>
          : cl.sin_movimiento.slice(0, 6).map((r: any) => (
            <div key={r.company_id} className="tb-clic" style={{ ...S.fila, cursor: 'pointer' }} onClick={() => abrir(r.company_id)}>
              <div style={{ flex: 1 }}>
                <div style={S.fl}>{r.nombre}</div>
                <div style={S.fn}>{r.dias} días sin una venta · ARR {money(r.arr)}</div>
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: '#FEF0EF', color: ROJO }}>Rescatar</span>
            </div>
          ))}
        <div style={S.nota}>
          Sale del puente con SACS: días desde su última venta capturada. Solo aparecen las cuentas activas — una cuenta
          cancelada ya no es un rescate, es una baja.
          {cl.frecuencia_meses != null && <> Tus clientes vuelven a pagar cada <b>{cl.frecuencia_meses === 1 ? 'mes' : `${cl.frecuencia_meses} meses`}</b> en la mediana.</>}
        </div>
      </div>
    </div>
  );
}

/* ════════════════ LAS TRES LECTURAS ════════════════
   Lo que uno diría en voz alta al ver la pantalla, ya dicho y con el número
   adentro. No son frases de adorno: se calculan del periodo que estás viendo y
   si el dato no da para decir algo, la tarjeta no aparece. */
function Lecturas({ d, x }: any) {
  const co = x?.consultoria;
  const cb = d.cobrar;
  const porCobrar = cb.total.monto + cb.vencido.monto;
  const tarjetas: { tinte: string; color: string; icono: any; titulo: string; texto: any }[] = [];

  if (co && co.juntas > 0) {
    const sin = Math.max(0, co.juntas - co.cotizaciones.n);
    tarjetas.push({
      tinte: '#FCEFF5', color: '#D9538E', icono: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
      titulo: 'De la junta al dinero',
      texto: sin > 0
        ? <>De las <b>{co.juntas} juntas</b> salieron {co.cotizaciones.n} cotizaciones. Las <b>{sin} juntas sin cotizar</b> son el pozo más grande que tienes.</>
        : <>Las <b>{co.juntas} juntas</b> del periodo produjeron {co.cotizaciones.n} cotizaciones. Ninguna se quedó sin precio.</>,
    });
  }
  if (cb.vencido.n > 0) {
    tarjetas.push({
      tinte: '#FFF4E5', color: '#E8A838', icono: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
      titulo: 'Lo que se está enfriando',
      texto: <><b>{money(cb.vencido.monto)}</b> ya pasaron su fecha en {cb.vencido.n} {cb.vencido.n === 1 ? 'renovación' : 'renovaciones'}.
        {' '}{(() => { const q = (cb.vencido.monto / Math.max(1, porCobrar)) * 100;
          return q < 1 ? <>Es <b>menos del 1%</b> de todo lo que tienes por cobrar.</>
                       : <>Es el <b>{Math.round(q)}%</b> de todo lo que tienes por cobrar.</>; })()}</>,
    });
  }
  if (co && co.cartera.length && co.cobrado.monto > 0) {
    const top = co.cartera[0];
    const pctTop = Math.round((top.cobrado / co.cobrado.monto) * 100);
    if (top.cobrado > 0) tarjetas.push({
      tinte: '#EEECFE', color: '#9B8CFA', icono: <path d="M4 18V9M10 18V5M16 18v-6M22 18V3" />,
      titulo: 'Quién sostiene el periodo',
      texto: <><b>{top.nombre}</b> puso {money(top.cobrado)}: el <b>{pctTop}%</b> de todo lo cobrado.
        {pctTop >= 40 ? ' Un mes que depende de una cuenta es un mes prestado.' : ' El resto está bien repartido.'}</>,
    });
  }
  if (!tarjetas.length) return null;

  return (
    <div className="tb-lec">
      {tarjetas.map(t => (
        <div key={t.titulo} style={{ background: t.tinte, border: '1px solid rgba(155,140,250,.14)', borderRadius: 16, padding: '15px 17px', display: 'flex', gap: 12 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="2" strokeLinecap="round" aria-hidden="true">{t.icono}</svg>
          </span>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '-.01em' }}>{t.titulo}</h4>
            <p style={{ margin: 0, fontSize: '0.73rem', lineHeight: 1.5, color: '#6b6b7a' }}>{t.texto}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════ LO QUE SE ESTÁ PAGANDO A PLAZOS ════════════════
   Una cotización a la que ya le entró dinero pero no está saldada. El sistema
   tiene el estado «parcial» en el catálogo y NADIE lo usa —cero filas—, así
   que la parcialidad no se lee de un campo: se deduce sumando los pagos.

   Importa por dos razones. La primera es que estaba mal contado: esos
   anticipos aparecían a la vez en «cobrado» y completos en «por cobrar», el
   mismo dinero dos veces. La segunda es que es lo más fácil de cobrar que
   tienes — el cliente ya dijo que sí y ya pagó una parte. */
function Parcialidades({ x, abrir }: any) {
  if (!x?.dinero?.parcialidades?.length) return null;
  const ps = x.dinero.parcialidades;
  const pr = x.dinero.proximas_parcialidades;
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.titulo}>Se está pagando a plazos
        <span style={S.der}>{ps.length} {ps.length === 1 ? 'cotización' : 'cotizaciones'} · faltan {money(ps.reduce((a: number, p: any) => a + p.saldo, 0))}</span>
      </div>
      <div style={S.lead}>
        Ya te dieron un anticipo y falta el resto. Es el dinero más fácil de cobrar que tienes: el cliente ya dijo que sí.
      </div>
      <div className="tb-3" style={{ gap: 12 }}>
        {ps.map((p: any) => {
          const avance = Math.min(100, Math.round((p.pagado / Math.max(1, p.total)) * 100));
          const frio = (p.dias_sin_pagar ?? 0) > 30;
          return (
            <div key={p.quote_id} className="tb-clic"
              style={{ border: '1px solid rgba(155,140,250,.18)', borderRadius: 14, padding: '14px 15px', cursor: p.company_id ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}
              onClick={p.company_id ? () => abrir(p.company_id) : undefined}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.empresa}</div>
                <span style={{ ...S.fn, whiteSpace: 'nowrap' }}>{p.numero}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, margin: '10px 0 8px' }}>
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: AMBAR, letterSpacing: '-.03em', lineHeight: 1 }}>{money(p.saldo)}</div>
                  <div style={{ ...S.fn, marginTop: 4 }}>le faltan por pagar</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: MORADO }}>{money(p.pagado)}</div>
                  <div style={S.fn}>ya entraron</div>
                </div>
              </div>

              {/* La barra dice de un vistazo cuánto del trato ya está cobrado. */}
              <div style={{ height: 10, borderRadius: 99, background: '#F4F1FB', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${avance}%`, borderRadius: 99, background: 'linear-gradient(90deg,#9B8CFA,#D9538E)' }} />
              </div>
              <div style={{ ...S.fn, marginTop: 6 }}>{avance}% del total de {money(p.total)}</div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f2f6', flex: 1 }}>
                {p.proximo
                  ? <div style={{ fontSize: '0.74rem' }}>
                      <b style={{ color: p.proximo.fecha < new Date().toISOString().slice(0, 10) ? ROSA_T : MORADO }}>
                        Sigue {money(p.proximo.monto)} el {fmtDate(p.proximo.fecha)}
                      </b>
                      {p.vencidas > 0 && <div style={{ ...S.fn, color: ROJO, marginTop: 3 }}>{p.vencidas} {p.vencidas === 1 ? 'parcialidad vencida' : 'parcialidades vencidas'}</div>}
                    </div>
                  : <div style={{ fontSize: '0.72rem', color: '#8a8590', lineHeight: 1.45 }}>
                      Sin plan de pagos capturado. <b style={{ color: MORADO }}>Captúralo</b> y el tablero sabrá cuándo entra cada parte.
                    </div>}
                <div style={{ fontSize: '0.7rem', color: frio ? ROJO : '#6b6b7a', marginTop: 7, lineHeight: 1.45 }}>
                  {p.ultimo_pago
                    ? frio
                      ? <>Último pago hace <b>{p.dias_sin_pagar} días</b>. Ya se enfrió: háblale.</>
                      : <>Último pago hace {p.dias_sin_pagar} {p.dias_sin_pagar === 1 ? 'día' : 'días'}.</>
                    : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {pr && pr.n > 0 && (
        <div style={S.nota}>
          De esos planes entran <b style={{ color: VERDE }}>{money(pr.monto)}</b> en los próximos 90 días,
          repartidos en {pr.n} {pr.n === 1 ? 'pago' : 'pagos'} con fecha.
        </div>
      )}
      {(!pr || !pr.n) && (
        <div style={S.nota}>
          Ninguna de estas cotizaciones tiene su calendario de pagos capturado, así que <b>el tablero no puede
          decir cuándo entra el resto</b>. Con el plan cargado, esos pesos se suman a lo que viene.
        </div>
      )}
    </div>
  );
}

/* ════════════════ EL DINERO QUE NO ESTÁ ATADO A NADIE ════════════════ */
function Sueltos({ x, ver, parte }: any) {
  const dn = x?.dinero;
  if (!dn) return null;
  const sd = dn.sin_dueno, op = dn.oportunidades;

  /* Dos cosas distintas que antes compartían renglón: el dinero cobrado que no
     tiene dueño es un problema de Consultoría —ahí se cobra—, y la oportunidad
     sin precio es de Expansión, que es donde se decide qué vender. */
  if (parte === 'oportunidades') {
    if (!op.sin_cotizar.n) return (
      <div style={S.card}>
        <div style={S.titulo}>Oportunidades sin precio</div>
        <div style={{ fontSize: '0.78rem', color: '#8a8590' }}>Todas las oportunidades abiertas ya tienen su cotización.</div>
      </div>
    );
    return (
      <div style={S.card}>
        <div style={S.titulo}>Oportunidades sin precio<span style={S.der}>{op.abiertas.n} abiertas en total</span></div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: MORADO, letterSpacing: '-.03em', margin: '2px 0 4px' }}>{op.sin_cotizar.n}</div>
        <div style={S.lead}>
          Tratos abiertos que todavía no tienen una cotización. Mientras no tengan precio no se pueden cerrar ni sumar
          a lo que viene: son intención, no pipeline.
        </div>
        <div style={S.reparte}>
          {op.sin_cotizar.items.map((o: any) => (
            <div key={o.id} className={o.company_id ? 'tb-clic' : undefined}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', cursor: o.company_id ? 'pointer' : 'default' }}
              onClick={o.company_id ? () => ver(o.company_id) : undefined}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nombre || o.titulo}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: o.monto ? MORADO : '#bdb7cc' }}>{o.monto ? money(o.monto) : 'sin valor'}</span>
            </div>
          ))}
        </div>
        <div style={S.nota}>
          {op.sin_cotizar.monto === 0
            ? <>Ninguna trae valor capturado, así que <b>ni siquiera se sabe cuánto valen</b>. Ponles precio al cotizar.</>
            : <>Suman {money(op.sin_cotizar.monto)} de intención sin precio en la mano.</>}
        </div>
      </div>
    );
  }

  if (!sd.n) return null;
  return (
    <div className="tb-2">
      {sd.n > 0 && (
        <div style={S.card}>
          <div style={S.titulo}>Pagos que no son de nadie<span style={S.der}>{sd.n} {sd.n === 1 ? 'pago' : 'pagos'}</span></div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: AMBAR, letterSpacing: '-.03em', margin: '2px 0 4px' }}>{money(sd.monto)}</div>
          <div style={S.lead}>
            Entraron a la cuenta y suman en lo cobrado, pero no están atados a ningún cliente: no aparecen en la
            cartera de nadie, nadie los agradece y no cuentan para la recompra de esa cuenta.
          </div>
          <div style={S.reparte}>
            {sd.items.slice(0, 5).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0' }}>
                <span style={{ ...S.fn, width: 62, flex: 'none' }}>{fmtDate(p.fecha)}</span>
                <span style={{ flex: 1 }} />
                <b style={{ fontSize: '0.78rem' }}>{money(p.monto)}</b>
              </div>
            ))}
          </div>
          <div style={S.nota}>Asígnalos a su cuenta desde Pagos y el historial de esos clientes queda completo.</div>
        </div>
      )}

    </div>
  );
}

/* ════════════════ LO QUE YA NO VA A ENTRAR ════════════════
   El ARR perdido no se puede leer de la empresa: al cancelar una cuenta su
   `arr` se pone en CERO, así que las 36 canceladas suman $0 y el dinero
   perdido se vuelve invisible. La verdad sobrevive en la suscripción. */
function NoEntrara({ x, abrir }: any) {
  const ne = x?.dinero?.no_entrara;
  if (!ne || !ne.historico.n) return null;
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.titulo}>Lo que ya no va a entrar<span style={S.der}>cuentas que se fueron</span></div>
      <div className="tb-2" style={{ marginBottom: 0, gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: ROSA_T, letterSpacing: '-.03em', lineHeight: 1 }}>{money(ne.anio.arr)}</div>
              <div style={{ ...S.pie, marginTop: 5 }}>dejaron de pagarte en los últimos 12 meses<br />· {ne.anio.n} {ne.anio.n === 1 ? 'cuenta' : 'cuentas'}</div>
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#8a8590', letterSpacing: '-.03em', lineHeight: 1 }}>{money(ne.historico.arr)}</div>
              <div style={{ ...S.pie, marginTop: 5 }}>en toda la historia<br />· {ne.historico.n} cuentas</div>
            </div>
          </div>
          <div style={S.nota}>
            {ne.sin_fecha.n > 0
              ? <><b style={{ color: '#9a6a10' }}>{ne.sin_fecha.n} de esas cancelaciones ({money(ne.sin_fecha.arr)}) no tienen fecha capturada</b>, así que no se puede decir cuándo se perdieron ni comparar un año contra otro. Capturarla es lo que vuelve confiable este número.</>
              : <>Cada baja tiene fecha, así que el histórico se puede comparar año contra año.</>}
          </div>
        </div>
        <div style={S.reparte}>
          {ne.items.map((b: any, i: number) => (
            <div key={i} className="tb-clic" style={{ ...S.fila, borderTop: i ? S.fila.borderTop : 'none', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.fl}>{b.nombre}</div>
                <div style={{ ...S.fn, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={b.razon || b.plan || ''}>
                  {fmtDate(b.fecha)}{b.razon ? ` · ${String(b.razon).replace(/\s+/g, ' ').slice(0, 70)}${String(b.razon).length > 70 ? '…' : ''}` : b.plan ? ` · ${b.plan}` : ''}
                </div>
              </div>
              <b style={{ fontSize: '0.82rem', color: ROSA_T, whiteSpace: 'nowrap' }}>−{money(b.arr)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

