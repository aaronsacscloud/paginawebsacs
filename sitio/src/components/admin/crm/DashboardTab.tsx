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
import { useEffect, useState } from 'react';
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
const AMBAR = '#C98A12', ORO = '#F0B84E', AZUL = '#2C5FC4', CIELO = '#7DA6F5', ROJO = '#C0554E';

const S = {
  wrap: WRAP,
  card: { background: '#fff', border: '1px solid #ececf1', borderRadius: 14, padding: '19px 21px' } as const,
  titulo: { fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.09em', display: 'flex', alignItems: 'center', gap: 9 } as const,
  der: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  lead: { fontSize: '0.73rem', color: '#8a8590', margin: '5px 0 15px', lineHeight: 1.55 } as const,
  nota: { fontSize: '0.68rem', color: '#8f8c99', marginTop: 11, paddingTop: 11, borderTop: '1px solid #f3f2f6', lineHeight: 1.6 } as const,
  eyebrow: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.09em' } as const,
  pie: { fontSize: '0.73rem', color: '#6f6b78', marginTop: 8, lineHeight: 1.55 } as const,
  mini: { border: '1px solid #ececf1', borderRadius: 11, padding: '13px 15px' } as const,
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
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
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
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [desde, hasta]);

  const alMes = () => { setAMano(false); setDesde(inicioDeMes()); setHasta(iso(new Date())); };

  if (err) return <div style={{ ...S.wrap, color: ROJO, fontSize: '0.85rem' }}>{err}</div>;
  if (!d) return <div style={S.wrap}><Cargando texto="Cargando tablero…" /></div>;

  const p = d.periodo;
  const nomMes = new Date(desde + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long' });
  const mesTit = nomMes.charAt(0).toUpperCase() + nomMes.slice(1);

  return (
    <div style={S.wrap}>
      {/* Las rejillas van por clase y no con auto-fit: con minmax el navegador
          decidía 3 columnas y dejaba un hueco del ancho de una tarjeta. */}
      <style>{`
        .tb { font-variant-numeric: tabular-nums; }
        .tb-clic { cursor:pointer; transition:box-shadow .15s, border-color .15s; }
        .tb-clic:hover { box-shadow:0 3px 14px rgba(91,75,214,.10); border-color:#ddd8f7; }
        .tb-velo { position:fixed; inset:0; background:rgba(23,21,31,.42); display:flex; align-items:center; justify-content:center; padding:28px; z-index:60; }
        .tb-modal { background:#fff; border-radius:16px; width:min(960px,100%); max-height:88vh; overflow:auto; box-shadow:0 24px 70px rgba(23,21,31,.24); }
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
      `}</style>

      <div className="tb">
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-.02em' }}>Tablero</h2>
            <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 3 }}>
              {p.es_mes_actual
                ? `${mesTit} ${new Date().getFullYear()} · del 1 al ${new Date(hasta + 'T12:00:00').getDate()} · quedan ${d.meta_mes.dias_restantes} días`
                : `Del ${fmtDate(desde)} al ${fmtDate(hasta)} · ${p.dias} días`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', border: '1px solid #eae5ef', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
              <button onClick={alMes} style={seg(!aMano)}>Este mes</button>
              <button onClick={() => setAMano(true)} style={seg(aMano)}>Personalizado</button>
            </span>
            {/* Los campos de fecha solo aparecen cuando se piden: ocupaban un
                tercio de la barra para algo que se usa una vez al mes. */}
            {aMano && (<>
              <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={FECHA} />
              <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} style={FECHA} />
            </>)}
          </div>
        </div>

        <Dinero d={d} ver={setDetalle} />
        <Motor d={d} ver={setDetalle} />
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
        <Compromisos d={d} abrir={setAbierto} />
        <Salud d={d} />
      </div>

      {detalle && <Detalle d={d} cual={detalle} cerrar={() => setDetalle(null)} abrir={(id: string) => { setDetalle(null); setAbierto(id); }} />}
      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}

const FECHA = { border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' } as const;

/* ════════════════ 1 · EL DINERO ════════════════ */
function Dinero({ d, ver }: any) {
  const c = d.cobrado, sm = d.sobre_la_mesa, g = d.generado;
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

        <GraficaCobranza c={c} eje={d.periodo.eje_total} />
        <VerDetalle texto={`Ver los ${c.n} pagos, uno por uno`} />

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
          <div style={{ fontSize: '2.05rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, color: AMBAR, marginTop: 11 }}>{money(sm.total)}</div>
          <div style={S.pie}>{sm.aceptadas.n + sm.enviadas.n} cotizaciones vivas en manos del cliente</div>
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
        <linearGradient id="tb-cash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LILA} stopOpacity=".34" /><stop offset="100%" stopColor={LILA} stopOpacity="0" />
        </linearGradient>
      </defs>
      {marcas.map(v => <g key={v}>
        <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#f1f0f5" />
        <text x={PL + 2} y={Y(v) - 4} fontSize="8.5" fill="#b3b0bd" fontWeight="600">{Math.round(v / 1000)}K</text>
      </g>)}
      {c.meta && <polyline points={`${X(0)},${Y(0)} ${X(total)},${Y(c.meta)}`} fill="none" stroke="#cfcbe0" strokeWidth="1.5" strokeDasharray="5 4" />}
      <polygon points={area} fill="url(#tb-cash)" />
      <polyline points={linea} fill="none" stroke={MORADO} strokeWidth="2.4" strokeLinejoin="round" />
      {c.proyeccion != null && <>
        <polyline points={`${X(ultimo.i)},${Y(ultimo.acum)} ${X(total)},${Y(c.proyeccion)}`} fill="none" stroke={MENTA} strokeWidth="2.2" strokeDasharray="4 4" />
        <circle cx={X(total)} cy={Y(c.proyeccion)} r="3.5" fill={MENTA} />
      </>}
      <circle cx={X(ultimo.i)} cy={Y(ultimo.acum)} r="4.5" fill="#fff" stroke={MORADO} strokeWidth="2.4" />
      {[0, Math.round(total / 4), Math.round(total / 2), Math.round(total * 3 / 4), total].map((i, k) => (
        <text key={k} x={X(i)} y={H - 6} fontSize="8.5" fill="#b3b0bd" fontWeight="600" textAnchor="middle">{i + 1}</text>
      ))}
    </svg>
  );
}

function Historial({ meses }: any) {
  const tope = Math.max(1, ...meses.map((m: any) => m.monto));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      {meses.map((m: any) => (
        <div key={m.mes} style={{ flex: 1, textAlign: 'center' }} title={`${m.etiqueta}: ${money(m.monto)}`}>
          <div style={{ height: 44, display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ width: '100%', height: Math.max(4, (m.monto / tope) * 44), borderRadius: 3, background: m.actual ? MORADO : '#e2dffa' }} />
          </div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, marginTop: 5, color: m.actual ? MORADO : '#a5a2af' }}>{m.etiqueta}</div>
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
function Motor({ d, ver }: any) {
  const r = d.recurrente, k = d.contadores;
  const cortoLedger = d.periodo.desde < r.ledger_desde;
  const sube = (r.pct?.neto ?? 0) >= 0;
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>Cuánto creció el recurrente<span style={S.der}>movimiento de ARR</span></div>
        <div style={S.lead}>No cuánto vendiste: cuánto subió el ingreso que se repite todos los años, y qué proporción del ARR representa cada movimiento.</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, margin: '2px 0 16px', flexWrap: 'wrap' }}>
          <div>
            <div style={S.eyebrow}>ARR hoy</div>
            <div style={{ fontSize: '2.05rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, marginTop: 6 }}>{money(r.arr_hoy)}</div>
          </div>
          <div style={{ paddingBottom: 4 }}>
            {r.pct?.neto != null && (
              <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', background: sube ? '#EEECFE' : '#FEF0EF', color: sube ? MORADO : ROJO }}>
                {sube ? '+' : ''}{r.pct.neto}% en el periodo
              </span>
            )}
            <div style={{ ...S.pie, marginTop: 6 }}>Empezaste en {money(r.arr_base)}</div>
          </div>
        </div>
        <BarrasArr r={r} />
        <div style={S.nota}>
          {cortoLedger
            ? <>El historial de recurrencia arranca el {fmtDate(r.ledger_desde)}: lo anterior no está medido y el neto sale corto.</>
            : r.pct?.entro != null
              ? <>Lo que entró sumó <b style={{ color: VERDE }}>+{r.pct.entro}%</b> y lo que se fue restó <b style={{ color: ROJO }}>{r.pct.salio}%</b>.
                {' '}{Math.abs(r.bajas + r.reducciones) > (r.altas + r.ampliaciones) * 0.5 && (r.altas + r.ampliaciones) > 0
                  ? <>De cada $10 que entraron, <b style={{ color: '#3f3b4d' }}>${(Math.abs(r.bajas + r.reducciones) / (r.altas + r.ampliaciones) * 10).toFixed(0)} se fueron por la puerta de atrás</b>.</>
                  : <>El saldo quedó a favor sin depender de retener.</>}</>
              : <>Sin movimientos de recurrencia en el periodo.</>}
        </div>
      </div>

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
        <div style={S.titulo}>Quién entró y quién se fue</div>
        <div style={S.lead}>Cada tarjeta abre la lista con nombre y monto.</div>
        <div className="tb-cuad" style={{ flex: 1 }}>
          <Contador color={VERDE} label="Clientes nuevos" valor={k.clientes_nuevos} nota="licencias que arrancaron" ver={() => ver('clientes')} />
          <Contador color={CIELO} label="Leads nuevos" valorColor={AZUL} valor={k.leads} nota="entraron y aún no compran" ver={() => ver('leads')} />
          <Contador color={ROJO} label="Bajas" valor={k.bajas} nota={k.bajas ? `se llevaron ${money(k.bajas_arr)} de ARR` : 'nadie se fue'} ver={k.bajas ? () => ver('bajas') : undefined} />
          <Contador color={LILA} label="Ampliaciones" valorColor={MORADO} valor={k.ampliaciones} nota="clientes que compraron más" ver={k.ampliaciones ? () => ver('ampliaciones') : undefined} />
        </div>
        <div style={S.nota}>
          Entraron {k.empresas_nuevas} empresas y {k.clientes_nuevos} {k.clientes_nuevos === 1 ? 'firmó' : 'firmaron'}, mientras {k.bajas} se {k.bajas === 1 ? 'fue' : 'fueron'}.
          {' '}En neto la cartera {k.clientes_nuevos - k.bajas > 0 ? <>creció <b style={{ color: '#3f3b4d' }}>{k.clientes_nuevos - k.bajas} {k.clientes_nuevos - k.bajas === 1 ? 'cuenta' : 'cuentas'}</b></>
            : k.clientes_nuevos - k.bajas < 0 ? <>perdió <b style={{ color: ROJO }}>{k.bajas - k.clientes_nuevos} {k.bajas - k.clientes_nuevos === 1 ? 'cuenta' : 'cuentas'}</b></>
              : <>quedó igual</>}.
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
const COLORES = [LILA, CIELO, MENTA, ORO, ROJO, '#C9C7D0'];
const COHORTE_COL = [CIELO, LILA, ORO, MENTA, VERDE];
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
function Compromisos({ d, abrir }: any) {
  const co = d.consultoria, cb = d.cobrar;
  // La lista del mes vive plegada: es el detalle que se consulta una vez por
  // semana, no algo que haya que tener a la vista todo el tiempo.
  const [verMes, setVerMes] = useState(false);
  const totalCob = Math.max(1, cb.d30.monto + cb.d60.monto + cb.d90.monto);
  return (
    <div className="tb-2" style={{ alignItems: 'start' }}>
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

      <div style={S.card}>
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
        <Metrica rosa titulo="Retención neta (NRR)" valor={s.nrr != null ? `${s.nrr}%` : '—'} color={s.nrr != null && s.nrr >= 100 ? VERDE : AMBAR}
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
const COL_METODO: Record<string, string> = { transferencia: LILA, tarjeta: MENTA, mercadopago: CIELO, efectivo: ORO };
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
