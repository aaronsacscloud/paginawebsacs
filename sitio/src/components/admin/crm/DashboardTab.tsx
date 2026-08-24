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

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
// Los millones de la cartera no caben en una tarjeta; los pesos del negocio sí.
const corto = (n?: number | null) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 1000000) return '$' + (Number(n) / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return (Number(n) < 0 ? '−$' : '$') + Math.round(v / 1000) + 'K';
  return (Number(n) < 0 ? '−$' : '$') + Math.round(v);
};
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
  const [aMano, setAMano] = useState(false);
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

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

        <Dinero d={d} />
        <Motor d={d} />
        <EmbudoYTiempo d={d} />
        <Compromisos d={d} abrir={setAbierto} />
        <Cartera d={d} />
        <Salud d={d} />
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}

const FECHA = { border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' } as const;

/* ════════════════ 1 · EL DINERO ════════════════ */
function Dinero({ d }: any) {
  const c = d.cobrado, sm = d.sobre_la_mesa, g = d.generado;
  const pctMeta = c.meta ? Math.round((c.monto / c.meta) * 100) : null;
  const llega = c.proyeccion != null && c.meta && c.proyeccion >= c.meta;
  const totalMesa = Math.max(1, sm.total);

  return (
    <div className="tb-flujo">
      <div style={S.card}>
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

        <div style={{ ...S.nota, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 250px' }}>
            <div style={{ ...S.eyebrow, marginBottom: 6 }}>Cobranza de los últimos 6 meses</div>
            <Historial meses={d.historial} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>{textoHistorial(d.historial)}</div>
        </div>
      </div>

      <div className="tb-apil">
        <div style={{ ...S.card, borderLeft: `3px solid ${AMBAR}` }}>
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
        </div>

        <div style={{ ...S.card, borderLeft: `3px solid ${MORADO}` }}>
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

/* ════════════════ 2 · EL MOTOR RECURRENTE ════════════════ */
function Motor({ d }: any) {
  const r = d.recurrente, k = d.contadores;
  const cortoLedger = d.periodo.desde < r.ledger_desde;
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>El motor recurrente<span style={S.der}>movimiento de ARR</span></div>
        <div style={S.lead}>Vender no es lo mismo que crecer. Esto es lo que pasó con el ingreso que se repite todos los años.</div>
        <Cascada r={r} />
        <div style={S.nota}>
          {cortoLedger
            ? <>El historial de recurrencia arranca el {fmtDate(r.ledger_desde)}: lo anterior a esa fecha no está medido y el neto sale corto.</>
            : r.neto > 0
              ? <>Vendiste {money(d.generado.monto)} y el recurrente subió <b style={{ color: '#3f3b4d' }}>{money(r.neto)}</b>{Math.abs(r.bajas) > r.altas * 0.5 ? <>: las bajas se comieron casi todo lo que entró. <b style={{ color: ROJO }}>Retener vale más que vender.</b></> : '.'}</>
              : r.neto < 0
                ? <>El recurrente <b style={{ color: ROJO }}>bajó {money(Math.abs(r.neto))}</b>: se fue más de lo que entró.</>
                : <>El recurrente quedó igual que como empezó el periodo.</>}
        </div>
      </div>

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
        <div style={S.titulo}>Quién entró y quién se fue</div>
        <div style={S.lead}>Los cuatro números que explican el motor de al lado.</div>
        <div className="tb-cuad" style={{ flex: 1 }}>
          <Contador color={VERDE} label="Clientes nuevos" valor={k.clientes_nuevos} nota="licencias que arrancaron" />
          <Contador color={CIELO} label="Leads nuevos" valorColor={AZUL} valor={k.leads} nota="empresas que entraron y aún no compran" />
          <Contador color={ROJO} label="Bajas" valor={k.bajas} nota={k.bajas ? `se llevaron ${money(k.bajas_arr)} de ARR` : 'nadie se fue'} />
          <Contador color={LILA} label="Conversión" valorColor={MORADO} valor={k.conversion != null ? `${k.conversion}%` : '—'}
            nota={k.empresas_nuevas ? `${k.clientes_nuevos} clientes de ${k.empresas_nuevas} empresas nuevas` : 'sin empresas nuevas que medir'} />
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

/** Cascada del ARR. Las líneas punteadas entre barras son lo que la vuelve una
 *  suma y no cinco barras sueltas. */
function Cascada({ r }: any) {
  const pasos = [
    { nom: 'Altas', v: r.altas, col: MENTA },
    { nom: 'Ampliaciones', v: r.ampliaciones, col: LILA },
    ...(r.reactivaciones ? [{ nom: 'Reactivaciones', v: r.reactivaciones, col: CIELO }] : []),
    { nom: 'Reducciones', v: r.reducciones, col: ORO },
    { nom: 'Bajas', v: r.bajas, col: ROJO },
  ];
  const W = 500, H = 196, base = H - 36;
  const bw = Math.min(60, (W - 24) / (pasos.length + 1) - 22), gap = 26;
  // El tope se saca del pico del recorrido, no del neto: si las bajas empatan
  // a las altas el neto es cero y todas las barras se aplastarían.
  let acu = 0; const picos = [0];
  pasos.forEach(x => { acu += x.v; picos.push(acu); });
  const tope = Math.max(...picos.map(Math.abs), Math.abs(r.neto), 1) * 1.3;
  const esc = (v: number) => (Math.abs(v) / tope) * (base - 26);
  const Yv = (v: number) => base - (v / tope) * (base - 26);

  const nodos: any[] = []; let run = 0, x = 6;
  pasos.forEach(({ nom, v, col }) => {
    const y0 = Yv(run), y1 = Yv(run + v);
    const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    nodos.push(<rect key={`r${nom}`} x={x} y={ya} width={bw} height={Math.max(3, yb - ya)} rx="3" fill={col} />);
    nodos.push(<text key={`t${nom}`} x={x + bw / 2} y={v >= 0 ? ya - 7 : yb + 15} fontSize="11" fontWeight="800" fill={col} textAnchor="middle">{v >= 0 ? '+' : ''}{corto(v)}</text>);
    nodos.push(<text key={`n${nom}`} x={x + bw / 2} y={base + 16} fontSize="8.5" fill="#b3b0bd" fontWeight="600" textAnchor="middle">{nom}</text>);
    run += v;
    nodos.push(<line key={`c${nom}`} x1={x} y1={Yv(run)} x2={x + bw + gap} y2={Yv(run)} stroke="#d6d3e2" strokeWidth="1.2" strokeDasharray="3 3" />);
    x += bw + gap;
  });
  const yN = Yv(r.neto);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} aria-hidden="true">
      <line x1="0" y1={base} x2={W} y2={base} stroke="#e6e4ee" />
      {nodos}
      <rect x={x} y={Math.min(base, yN)} width={bw} height={Math.max(4, esc(r.neto))} rx="3" fill={MORADO} />
      <text x={x + bw / 2} y={(r.neto >= 0 ? yN : base) - 7} fontSize="11" fontWeight="800" fill={MORADO} textAnchor="middle">{r.neto >= 0 ? '+' : ''}{corto(r.neto)}</text>
      <text x={x + bw / 2} y={base + 16} fontSize="8.5" fill="#8a8590" fontWeight="800" textAnchor="middle">Neto</text>
    </svg>
  );
}

function Contador({ color, label, valor, valorColor, nota }: any) {
  return (
    <div style={{ ...S.mini, borderLeft: `3px solid ${color}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={S.eyebrow}>{label}</div>
      <div style={{ ...S.mv, color: valorColor || color }}>{valor}</div>
      <div style={S.ms}>{nota}</div>
    </div>
  );
}

/* ════════════════ 3 · EMBUDO Y TIEMPO ════════════════ */
function EmbudoYTiempo({ d }: any) {
  const e = d.embudo, r = d.reuniones;
  const cuello = e.slice(0, 3).map((x: any, i: number) => ({ i, caida: e[i + 1] && x.n ? e[i + 1].n / x.n : 1 }))
    .sort((a: any, b: any) => a.caida - b.caida)[0];
  return (
    <div className="tb-2">
      <div style={S.card}>
        <div style={S.titulo}>El embudo<span style={S.der}>del contacto al contrato</span></div>
        <div style={S.lead}>Los saltos entre pasos dicen más que los totales. Aquí se ve dónde se atora.</div>
        <Embudo etapas={e} />
        <div style={S.nota}>
          {e[0].n === 0
            ? <>Sin leads nuevos en el periodo: el embudo arranca vacío.</>
            : cuello && cuello.caida < 0.5
              ? <>El cuello está entre <b style={{ color: '#3f3b4d' }}>{e[cuello.i].nombre.toLowerCase()}</b> y {e[cuello.i + 1].nombre.toLowerCase()}: solo pasa el {Math.round(cuello.caida * 100)}%.</>
              : <>El embudo baja parejo, sin un tapón claro en ningún paso.</>}
        </div>
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
// El embudo va de frío a cálido para que el recorrido se lea como avance.
const EMBUDO_COL = [CIELO, LILA, MENTA, VERDE];
const titulo = (t: string) => { const x = t.replace(/^Reunión de /, ''); return x.charAt(0).toUpperCase() + x.slice(1); };

/** Embudo proporcional. El ancho ES el dato: si de 68 leads solo 9 cotizan,
 *  la caída tiene que verse, no leerse. */
function Embudo({ etapas }: any) {
  const FW = 380, alto = 44, sep = 26, TX = 400;
  const tope = Math.max(1, ...etapas.map((e: any) => e.n));
  const H = etapas.length * (alto + sep) - sep + 10;
  return (
    <svg viewBox={`0 0 630 ${H}`} style={{ width: '100%', height: H, display: 'block' }} aria-hidden="true">
      {etapas.map((e: any, i: number) => {
        const y = 6 + i * (alto + sep);
        const w = Math.max(58, (e.n / tope) * FW);
        const sig = etapas[i + 1];
        return (
          <g key={e.nombre}>
            <rect x={(FW - w) / 2} y={y} width={w} height={alto} rx="8" fill={EMBUDO_COL[i % EMBUDO_COL.length]} />
            <text x={FW / 2} y={y + 27} fontSize="15" fontWeight="800" fill="#fff" textAnchor="middle">{e.n}</text>
            <text x={TX} y={y + 20} fontSize="11.5" fontWeight="700" fill="#3f3b4d">{e.nombre}</text>
            <text x={TX} y={y + 35} fontSize="8.5" fill="#b3b0bd" fontWeight="600">{e.monto != null ? money(e.monto) : e.nota}</text>
            {sig && <>
              <line x1={FW / 2} y1={y + alto + 4} x2={FW / 2} y2={y + alto + sep - 4} stroke="#dedbe8" strokeWidth="1.4" />
              <rect x={FW / 2 + 7} y={y + alto + sep / 2 - 7} width="42" height="17" rx="8" fill="#f3f2f8" />
              <text x={FW / 2 + 28} y={y + alto + sep / 2 + 5.5} fontSize="10" fontWeight="800" fill="#8a8590" textAnchor="middle">
                {e.n ? Math.round((sig.n / e.n) * 100) : 0}%
              </text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}

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
  const totalCob = Math.max(1, cb.d30.monto + cb.d60.monto + cb.d90.monto);
  const proximos = [...cb.vencido.items, ...cb.d30.items].slice(0, 4);
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
        <div style={S.titulo}>ARR por cobrar<span style={S.der}>90 días hacia adelante · no depende del mes</span></div>
        <div style={S.lead}>Ya está contratado y toca renovar. No es proyección: son fechas con nombre y monto.</div>
        <div style={{ display: 'flex', gap: 3, height: 15, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {cb.vencido.monto > 0 && <span style={{ width: `${(cb.vencido.monto / totalCob) * 100}%`, background: ROJO }} />}
          <span style={{ width: `${(cb.d30.monto / totalCob) * 100}%`, background: ORO }} />
          <span style={{ width: `${(cb.d60.monto / totalCob) * 100}%`, background: LILA }} />
          <span style={{ width: `${(cb.d90.monto / totalCob) * 100}%`, background: CIELO }} />
        </div>
        {cb.vencido.n > 0 && <Tramo color={ROJO} label="Vencido" n={cb.vencido.n} monto={cb.vencido.monto} nota="ya pasó la fecha" primero />}
        <Tramo color={ORO} colorTexto={AMBAR} label="En 30 días" n={cb.d30.n} monto={cb.d30.monto}
          nota={d.cobrado.antes_de_fin_de_mes.n ? `${d.cobrado.antes_de_fin_de_mes.n} antes de que acabe el mes` : 'ninguna este mes'} primero={cb.vencido.n === 0} />
        <Tramo color={LILA} colorTexto={MORADO} label="En 60 días" n={cb.d60.n} monto={cb.d60.monto} />
        <Tramo color={CIELO} colorTexto={AZUL} label="En 90 días" n={cb.d90.n} monto={cb.d90.monto} />
        {proximos.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid #f3f2f6' }}>
            <div style={{ ...S.eyebrow, marginBottom: 4 }}>Las que siguen</div>
            {proximos.map((r: any) => {
              const venc = r.fecha < d.hoy_fecha;
              return (
                <div key={r.id} style={S.fila}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap', background: venc ? '#FEF0EF' : '#FEF6E7', color: venc ? ROJO : '#9a6a10' }}>
                    {venc ? 'vencido' : fmtDate(r.fecha)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...S.fl, cursor: 'pointer' }} onClick={() => abrir(r.company_id)}>{r.cliente}</div>
                    <div style={S.fn}>{r.plan}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <b style={{ color: venc ? ROJO : '#1a1a1a', fontSize: '0.9rem' }}>{money(r.monto)}</b>
                    {r.link && <div style={{ marginTop: 4 }}><a style={S.btnP} href={r.link} target="_blank" rel="noreferrer">Cobrar</a></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={S.nota}>
          {cb.vencido.n === 0 ? 'Nada vencido. ' : `Hay ${money(cb.vencido.monto)} vencidos. `}
          {d.cobrado.antes_de_fin_de_mes.n > 0
            ? <>Los <b style={{ color: '#3f3b4d' }}>{money(d.cobrado.antes_de_fin_de_mes.monto)}</b> que caen antes de que acabe el mes son los que deciden si se llega a la meta.</>
            : <>Ya no vence nada más este mes.</>}
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

/* ════════════════ 5 · LA CARTERA ════════════════ */
function Cartera({ d }: any) {
  const c = d.cartera, sinVender = c.cuentas - c.operando;
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.titulo}>Lo que facturan tus clientes<span style={S.der}>últimos 30 días · foto del cron, no depende del mes</span></div>
      <div style={S.lead}>El dinero que ellos mueven dentro de SACS. No es tuyo, pero es el argumento de cada renovación.</div>
      <div className="tb-4">
        <Contador color={MORADO} label="Facturado por la cartera" valor={corto(c.facturacion)} nota={`${c.cuentas} cuentas activas medidas`} />
        <Contador color={MENTA} valorColor={VERDE} label="Ventas capturadas" valor={Number(c.ventas || 0).toLocaleString('es-MX')} nota="tickets en 30 días" />
        <Contador color={LILA} valorColor={MORADO} label="Cuentas operando" valor={<>{c.operando}<span style={{ fontSize: '1rem', color: '#a5a2af' }}> de {c.cuentas}</span></>} nota="con ventas en los últimos 30 días" />
        <Contador color={sinVender ? ROJO : '#c9c7d0'} label="Sin vender" valor={sinVender} nota={sinVender ? 'pagan y no usan: riesgo de baja' : 'todas están vendiendo'} />
      </div>
    </div>
  );
}

/* ════════════════ 6 · SALUD ════════════════ */
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
