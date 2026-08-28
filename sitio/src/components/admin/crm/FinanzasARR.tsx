// Suscripciones como panel financiero.
//
// Esta pantalla NO gestiona cobros: no registra pagos, no manda recordatorios,
// no concilia. Solo mide. Es la vista que se le enseña a un inversionista y la
// que sirve para decidir —dónde crecer, qué se está rompiendo— no para operar.
//
// La regla que la mantiene honesta: cuando un número no se puede calcular con
// los datos que hay, se dice. El bloque "Datos por completar" no es una lista
// de errores, es lo que limita lo que este panel puede afirmar.
import { useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../lib/crm/layout';
import Cargando from './ui/Cargando';
import { P, tarjetaKpi, CINTA } from '../../../lib/crm/paleta';
import { useIsMobile, useCrmDark } from '../../../lib/ui/mobile';

const money = (n: any) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const kMoney = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
/** Corte de eje LEGIBLE: «$2336k» se lee como un número calculado; «$2.3M»,
 *  como uno elegido. Bajo el millón se dice en miles redondos. */
const corteEje = (n: number) => n >= 1_000_000 ? '$' + (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000 ? '$' + Math.round(n / 1_000) + 'k' : '$0';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiquetaMes = (m: string, conAnio = false) => {
  const [y, mm] = m.split('-');
  return MESES[Number(mm) - 1] + (conAnio ? ` ${y.slice(2)}` : '');
};

const S = {
  // El aire de arriba lo pone el contenedor del CRM; aquí solo la separación
  // con la barra de pestañas.
  // Vive DENTRO del contenedor de Suscripciones, que ya pone el aire
  // lateral: aquí solo se iguala el tope para no descuadrarse con él.
  wrap: { maxWidth: WRAP.maxWidth, margin: '0 auto', padding: '14px 0 40px' } as const,
  card: { background: P.papel, border: `1px solid ${P.linea}`, borderRadius: 10, padding: '16px 18px' } as const,
  k: { fontSize: '0.57rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#a5a2af' } as const,
  v: { fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.08, marginTop: 4, letterSpacing: '-.02em' } as const,
  s: { fontSize: '0.75rem', color: '#4a4a52', marginTop: 4 } as const,
  e: { fontSize: '0.7rem', color: '#a5a2af', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f5f4f8', lineHeight: 1.5 } as const,
  tit: { fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#a5a2af', marginBottom: 10 } as const,
  nota: { fontSize: '0.73rem', color: '#8a8590', marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8', lineHeight: 1.55 } as const,
  btn: { border: '1px solid #e2e4e9', background: '#fff', borderRadius: 9, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, color: '#4b4560', padding: '8px 13px', cursor: 'pointer' } as const,
  th: { textAlign: 'left' as const, fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' as const, color: '#b3b1bb', padding: 8, borderBottom: '1px solid #f0eff3' } as const,
  td: { padding: '9px 8px', fontSize: '0.78rem', borderBottom: '1px solid #f7f6fa' } as const,
};
const UP = P.verdeTinta, DOWN = P.rojoTinta, VIO = P.violetaTinta, ROSA = P.rosaTinta;

/**
 * La tarjeta de KPI con su franja de color a la izquierda: el mismo objeto que
 * encabeza Cotizaciones. El color de la franja dice de qué habla el número
 * antes de leerlo — morado el recurrente, verde lo que entra, rosa lo que se va.
 */
function Kpi({ k, v, s: sub, e, color, franja, ancho, onClick }: {
  k: string; v: string; s?: React.ReactNode; e?: React.ReactNode; color?: string; franja: string; ancho?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ ...tarjetaKpi(franja), cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k}</div>
      <div style={{ fontSize: ancho ? '1.55rem' : '1.375rem', fontWeight: 800, color: color || '#1a1a1a', marginTop: 4, letterSpacing: '-.02em' }}>{v}</div>
      {sub && <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
      {e && <div style={{ fontSize: '0.6875rem', color: '#a5a2af', marginTop: 7, paddingTop: 7, borderTop: '1px solid #f5f4f8', lineHeight: 1.5 }}>{e}</div>}
    </div>
  );
}

/** Barra de dos tramos: morado el recurrente, rosa lo que es pago único. */
function BarraDoble({ a, b, max, G }: { a: number; b: number; max: number; G: any }) {
  return (
    <div style={{ height: 7, borderRadius: 9, background: G.track, overflow: 'hidden', display: 'flex', flex: 1 }}>
      <span style={{ width: `${(a / max) * 100}%`, background: G.serie }} />
      <span style={{ width: `${(b / max) * 100}%`, background: G.serie3 }} />
    </div>
  );
}

export default function FinanzasARR({ onCuenta }: { onCuenta?: (id: string) => void }) {
  const esMovilFin = useIsMobile();
  // Paleta de las gráficas: el SVG lleva el color en atributos, así que el tema
  // se resuelve aquí y no en CSS. En oscuro todas las series son el mismo lila
  // separadas por opacidad — cuatro familias de color eran cuatro acentos.
  const oscuroFin = useCrmDark();
  const G = oscuroFin
    ? { grid: '#26262e', eje: '#918fa0', serie: '#A78BFA', serie2: 'rgba(167,139,250,.62)', serie3: 'rgba(167,139,250,.34)', punto: '#1d1d24', banda: 'rgba(167,139,250,.06)', track: '#26262e' }
    : { grid: '#f2f1f7', eje: '#b3b1bb', serie: '#9B8CFA', serie2: '#7DA6F5', serie3: '#D9538E', punto: '#fff', banda: '#FBFAFF', track: '#f2f1f7' };
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pendiente, setPendiente] = useState<string>('');
  // Qué lista de cuentas se está viendo: la del KPI en el que se hizo clic.
  const [detalle, setDetalle] = useState<'' | 'ganadas' | 'perdidas' | 'extras'>('');

  const cargar = (q = '') => {
    setD(null);
    fetch('/api/crm/arr/finanzas' + q).then(r => r.json())
      .then(j => { if (j?.error) setError(j.error); else setD(j); })
      .catch(() => setError('No se pudo cargar.'));
  };
  useEffect(() => { cargar(); }, []);

  const proy = useMemo(() => {
    if (!d?.serie?.length) return null;
    // El ritmo se toma de los últimos 3 meses cerrados, no del histórico
    // completo: lo que importa para proyectar es la velocidad de AHORA.
    const s = d.serie;
    const n = Math.min(4, s.length);
    const ini = s[s.length - n]?.arr || 0;
    const fin = s[s.length - 1]?.arr || 0;
    const ritmo = n > 1 ? (fin - ini) / (n - 1) : 0;
    const esc = (f: number) => Array.from({ length: 13 }, (_, i) => fin + ritmo * i * f);
    return { ritmo, base: fin, alto: esc(1.6), medio: esc(1), bajo: esc(0.45) };
  }, [d]);

  if (error) return <div style={{ ...S.card, color: DOWN, background: '#FEF0EF', border: '1px solid #F6D6D3' }}>{error}</div>;
  if (!d) return <Cargando texto="Cargando el panel financiero…" alto={260} />;

  const t = d.titular, p = d.puente, c = d.calidad;
  const maxSerie = Math.max(1, ...d.serie.map((x: any) => x.arr));
  const maxAlta = Math.max(1, ...d.serie.map((x: any) => Math.max(x.altas, x.bajas)));
  const maxCuenta = Math.max(1, ...d.cuentas.slice(0, 8).map((x: any) => x.total));
  const maxRenov = Math.max(1, ...d.calendario.map((x: any) => x.monto));
  const maxUnico = Math.max(1, ...d.serie.map((x: any) => x.monto_unicos));

  return (
    <div style={S.wrap}>
      {/* ── Periodo ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={S.tit}>Panorama</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          {!esMovilFin && <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8f8d98' }}>Periodo</span>}
          {!esMovilFin && <span style={{ display: 'flex', gap: 7, alignItems: 'center', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0, maxWidth: 340 }}>
            <input type="month" value={desde} onChange={e => setDesde(e.target.value)} title="Desde"
              style={{ ...S.btn, padding: '7px 10px', fontWeight: 500, flex: 1, minWidth: 0 }} />
            <span style={{ fontSize: '0.75rem', color: '#a5a2af' }}>a</span>
            <input type="month" value={hasta} onChange={e => setHasta(e.target.value)} title="Hasta"
              style={{ ...S.btn, padding: '7px 10px', fontWeight: 500, flex: 1, minWidth: 0 }} />
          </span>}
          {!esMovilFin && <button style={{ ...S.btn, background: '#EEECFE', borderColor: '#ddd6fb', color: VIO }}
            onClick={() => cargar(desde || hasta ? `?desde=${desde || ''}&hasta=${hasta || ''}` : '')}>Aplicar</button>}
          {!esMovilFin && (desde || hasta) && <button style={S.btn} onClick={() => { setDesde(''); setHasta(''); cargar(); }}>Últimos 12 meses</button>}
          {/* En el teléfono el periodo son atajos, no dos selectores de mes y un
              botón Aplicar: nadie captura un rango con el pulgar para ver un
              tablero. Los tres cubren lo que de verdad se consulta. */}
          {esMovilFin && (() => {
            const hoyMes = new Date().toISOString().slice(0, 7);
            const haceMeses = (n: number) => { const d2 = new Date(); d2.setMonth(d2.getMonth() - n); return d2.toISOString().slice(0, 7); };
            const opts: [string, string, string][] = [
              ['12 meses', '', ''],
              ['6 meses', haceMeses(5), hoyMes],
              ['Este año', new Date().getFullYear() + '-01', hoyMes],
            ];
            return (
              <span style={{ display: 'flex', gap: 6 }}>
                {opts.map(([l, dd, hh]) => {
                  const act = (desde || '') === dd && (hasta || '') === hh;
                  return (
                    <button key={l} onClick={() => { setDesde(dd); setHasta(hh); cargar(dd || hh ? `?desde=${dd}&hasta=${hh}` : ''); }}
                      style={{ ...S.btn, minHeight: 34, padding: '0 12px', fontSize: '0.74rem',
                        background: act ? '#EEECFE' : '#fff', borderColor: act ? '#ddd6fb' : '#e6e6ea', color: act ? VIO : '#6b6b74' }}>{l}</button>
                  );
                })}
              </span>
            );
          })()}
        </span>
      </div>

      {/* ── TITULAR: lo ganado y lo perdido, cada uno con su número ── */}
      <div className="fin-k5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
        {/* En móvil el ARR activo ya es el número grande de la cabecera de
            Suscripciones: repetirlo aquí era el mismo dato dos veces. */}
        {!esMovilFin && <Kpi franja={P.violeta} color={VIO} ancho
          k="ARR activo" v={money(t.arr_activo)}
          s={<>{t.subs_activas} licencias · {t.clientes} clientes</>}
          e="Lo que factura en 12 meses si nadie más entra ni se va." />}
        <Kpi franja={P.azul} color={(t.crecimiento_12m_pct ?? 0) >= 0 ? UP : DOWN}
          k="Crecimiento 12 meses"
          v={t.crecimiento_12m_pct == null ? '—' : `${t.crecimiento_12m_pct > 0 ? '+' : ''}${t.crecimiento_12m_pct}%`}
          s={<>de {money(t.arr_hace_12m)} a hoy</>}
          e="A qué velocidad crece la base." />
        <Kpi franja={P.verde} color={UP} onClick={() => setDetalle('ganadas')}
          k="ARR ganado este mes" v={`+${money(t.ganado)}`}
          s={<>nuevo {money(p.nuevo)} · expansión {money(p.expansion)}</>}
          e={<>{d.detalle.ganadas.length} cuenta{d.detalle.ganadas.length === 1 ? '' : 's'} nueva{d.detalle.ganadas.length === 1 ? '' : 's'} · <b style={{ color: VIO }}>ver quiénes</b></>} />
        {/* Lo que se fue tiene su propio número: escondido dentro del neto no se
            ve venir, y es la mitad de la historia. */}
        <Kpi franja={P.rojo} color={DOWN} onClick={() => setDetalle('perdidas')}
          k="ARR dado de baja este mes" v={money(t.perdido)}
          s={<>bajas {money(Math.abs(p.baja))} · contracción {money(Math.abs(p.contraccion))}</>}
          e={<>{t.bajas_mes} licencia{t.bajas_mes === 1 ? '' : 's'} cancelada{t.bajas_mes === 1 ? '' : 's'} · <b style={{ color: VIO }}>ver quiénes</b></>} />
        <Kpi franja={t.neto >= 0 ? P.verde : P.rojoTinta} color={t.neto >= 0 ? UP : DOWN}
          k="ARR neto" v={`${t.neto >= 0 ? '+' : ''}${money(t.neto)}`}
          s="ganado menos perdido"
          e={t.churn_come_pct != null
            ? <><b style={{ color: '#4a4a52' }}>El churn se comió el {t.churn_come_pct}%</b> de lo vendido este mes.</>
            : 'Sin movimientos registrados este mes.'} />
      </div>

      {/* ── PROYECCIÓN ── */}
      {proy && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={S.tit}>Cuánto creció el ARR y a dónde va</div>
          <div className="fin-k4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
            {[
              ['ARR al inicio del periodo', money(d.serie[0]?.arr), '#241d43', '#ddd6fb'],
              ['ARR hoy', money(t.arr_activo), VIO, '#9B8CFA'],
              ['Crecimiento del periodo', d.serie[0]?.arr ? `${Math.round(((t.arr_activo - d.serie[0].arr) / d.serie[0].arr) * 1000) / 10}%` : '—', UP, '#4FBF95'],
              ['Ritmo mensual', (proy.ritmo >= 0 ? '+' : '') + money(proy.ritmo), proy.ritmo >= 0 ? UP : DOWN, '#7DA6F5'],
            ].map(([l, v, col, fr]) => (
              <div key={l as string} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${fr}`, borderRadius: 10, padding: '13px 15px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.08em' }}>{l}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 3, color: col as string }}>{v}</div>
              </div>
            ))}
          </div>
          <Proyeccion serie={d.serie} proy={proy} G={G} movil={esMovilFin} />
          <div style={S.nota}>
            La línea sólida es lo que ya pasó; la punteada, tres escenarios a 12 meses según el ritmo de los últimos meses:
            <b> si mejora, si se mantiene y si se enfría</b>. No es una promesa — es la velocidad actual proyectada.
          </div>
        </div>
      )}

      {/* ── PUENTE + CALIDAD ── */}
      <div className="fin-k2" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 13, marginBottom: 14 }}>
        <div style={S.card}>
          <div style={S.tit}>De dónde vino el ARR de este mes</div>
          <Puente p={p} G={G} movil={esMovilFin} />
          <div style={S.nota}>
            El <b>puente de ARR</b>: no basta el total, importa de qué está hecho el cambio. En verde lo que suma y en rojo lo que resta.
            {p.ledger_desde && <> El registro de movimientos empieza en <b>{etiquetaMes(p.ledger_desde, true)}</b>; antes de esa fecha solo hay altas y bajas, no expansiones.</>}
          </div>
        </div>
        <div style={S.card}>
          <div style={S.tit}>Los números de calidad</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Retención neta (NRR)', c.nrr == null ? '—' : `${c.nrr}%`, c.nrr == null ? '#241d43' : c.nrr >= 100 ? UP : '#9a6a10'],
                ['Retención bruta (GRR)', c.grr == null ? '—' : `${c.grr}%`, c.grr == null ? '#241d43' : c.grr >= 90 ? UP : '#9a6a10'],
                ['Quick ratio', c.quick_ratio == null ? '—' : `${c.quick_ratio}×`, '#241d43'],
                ['Churn de clientes (mes)', `${c.churn_clientes}%`, c.churn_clientes > 2 ? DOWN : UP],
                ['Vida media del cliente', c.vida_media_anios == null ? '—' : `${c.vida_media_anios} años`, '#241d43'],
                ['ARPA · mediana', `${money(c.arpa)} · ${money(c.mediana)}`, '#241d43'],
              ].map(([l, v, col]) => (
                <tr key={l as string}>
                  <td style={S.td}>{l}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: col as string }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={S.nota}>
            <b>NRR bajo 100%</b> significa que la base existente encoge y el crecimiento depende de vender nuevo.
            Es la métrica que más pesa en una valuación.
          </div>
        </div>
      </div>

      {/* ── SERIE ── */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.tit}>Licencias nuevas y ARR, mes a mes</div>
        <Serie serie={d.serie} max={maxSerie} maxAlta={maxAlta} G={G} movil={esMovilFin} />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.71rem', color: '#6b7280', marginTop: 8 }}>
          {[[G.serie, 'ARR acumulado'], [G.serie2, 'Licencias nuevas'], [G.serie3, 'Bajas']].map(([c2, l]) => (
            <span key={l}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: c2, marginRight: 5, verticalAlign: -1 }} />{l}</span>
          ))}
        </div>
      </div>

      {/* ── CICLOS + PLANES ── */}
      <div className="fin-k2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
        <div style={S.card}>
          <div style={S.tit}>Anual vs mensual</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={S.th}>Ciclo</th><th style={{ ...S.th, textAlign: 'right' }}>Licencias</th><th style={{ ...S.th, textAlign: 'right' }}>ARR</th><th style={{ ...S.th, textAlign: 'right' }}>Mix</th></tr></thead>
            <tbody>
              {d.ciclos.por_ciclo.map((x: any) => (
                <tr key={x.ciclo}>
                  <td style={{ ...S.td, fontWeight: 800, textTransform: 'capitalize' }}>{x.ciclo}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{x.n}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{money(x.arr)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{t.arr_activo ? Math.round((x.arr / t.arr_activo) * 100) : 0}%</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...S.td, color: '#8a8590' }}>Vitalicia (fuera de ARR)</td>
                <td style={{ ...S.td, textAlign: 'right', color: '#8a8590' }}>{d.ciclos.vitalicias}</td>
                <td style={{ ...S.td, textAlign: 'right', color: '#8a8590' }}>$0</td>
                <td style={{ ...S.td, textAlign: 'right', color: '#c9c4dc' }}>—</td>
              </tr>
            </tbody>
          </table>
          <div style={S.nota}>El recurrente mensual son <b>{money(d.ciclos.mrr_mensual)}/mes</b>. Un negocio con casi todo anual cobra mejor pero concentra el riesgo de renovación en pocos días del año.</div>
        </div>
        <div style={S.card}>
          <div style={S.tit}>Por plan</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={S.th}>Plan</th><th style={{ ...S.th, textAlign: 'right' }}>Subs</th><th style={{ ...S.th, textAlign: 'right' }}>ARR</th><th style={{ ...S.th, textAlign: 'right' }}>Ticket</th></tr></thead>
            <tbody>
              {d.planes.map((x: any) => (
                <tr key={x.plan}>
                  <td style={{ ...S.td, fontWeight: 800, textTransform: 'capitalize' }}>{x.plan === 'otro' ? 'A la medida' : x.plan}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{x.n}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{money(x.arr)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{money(x.ticket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CUENTAS QUE CRECEN ── */}
      <div style={S.tit}>Cómo crece cada cuenta · recurrente + pagos únicos</div>

      {/* El dinero se mide desde los PAGOS registrados, no desde el estado de
          la cotización —que lo pone una persona—. Cuando las dos fuentes no
          cuadran, la cifra de extras sale corta y nadie se entera. */}
      {d.descuadres?.n > 0 && (
        <div style={{ background: P.ambarAgua, border: '1px solid #f6e2c2', borderRadius: 11, padding: '12px 15px', marginBottom: 12, fontSize: '0.79rem', color: P.ambarTinta, lineHeight: 1.6 }}>
          <b>{d.descuadres.n} cotización{d.descuadres.n === 1 ? '' : 'es'} marcada{d.descuadres.n === 1 ? '' : 's'} como pagada{d.descuadres.n === 1 ? '' : 's'} sin el pago capturado</b> — {money(d.descuadres.falta)}.
          Estas cifras cuentan el dinero desde los pagos registrados, así que ese monto <b>no está sumado aquí</b>.
          {' '}{d.descuadres.lista.slice(0, 3).map((q: any, i: number) => (
            <span key={q.id}>{i > 0 ? ' · ' : ''}{q.numero} {q.empresa} ({money(q.total - q.cobrado)})</span>
          ))}
          {d.descuadres.n > 3 && ` y ${d.descuadres.n - 3} más.`}
        </div>
      )}
      <div className="fin-k2" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 13, marginBottom: 14 }}>
        <div style={S.card}>
          {/* En el teléfono esta tabla de cuatro columnas partía los montos a la
              mitad ("$236,48…" y el dígito en otro renglón). Cada cuenta pasa a
              ser una fila: nombre arriba, el total del año a la derecha —que es
              la columna por la que se ordena— y debajo, en una línea de
              metadatos, de dónde sale ese total. */}
          {esMovilFin ? (
            <div>
              {d.cuentas.slice(0, 8).map((x: any) => (
                <div key={x.company_id} onClick={() => onCuenta?.(x.company_id)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0eff3', cursor: onCuenta ? 'pointer' : 'default' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 2 }}>
                      Recurrente {x.arr ? money(x.arr) : '—'} · Único {x.unicos ? money(x.unicos) : '—'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{money(x.total)}</div>
                </div>
              ))}
            </div>
          ) : (<>
          <div className="crm-scroll-x">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead><tr>
              <th style={S.th}>Cuenta</th><th style={{ ...S.th, textAlign: 'right' }}>Recurrente</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Pagos únicos</th><th style={{ ...S.th, width: '32%' }}>Total del año</th>
            </tr></thead>
            <tbody>
              {d.cuentas.slice(0, 8).map((x: any) => (
                <tr key={x.company_id}>
                  <td style={{ ...S.td, fontWeight: 800, cursor: onCuenta ? 'pointer' : 'default' }} onClick={() => onCuenta?.(x.company_id)}>{x.nombre}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{x.arr ? money(x.arr) : '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: x.unicos ? ROSA : '#c9c4dc' }}>
                    {x.unicos ? money(x.unicos) : '—'}{x.n_unicos > 0 && <span style={{ color: '#c9c4dc', fontWeight: 400 }}> · {x.n_unicos}</span>}
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <BarraDoble a={x.arr} b={x.unicos} max={maxCuenta} G={G} />
                      <span style={{ fontWeight: 800, width: 78, textAlign: 'right' }}>{money(x.total)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div></>)}
          <div style={S.nota}>
            Los <b>pagos únicos</b> —plugins, personalizaciones, implementaciones— no son ARR, pero sí son ingreso de la cuenta
            y dicen cuánto vale de verdad un cliente. En la vista de ARR sola, esa parte no existe.
          </div>
        </div>
        <div style={S.card}>
          <div style={S.tit}>Ingreso por pagos únicos, mes a mes</div>
          {/* Doce renglones con diez guiones no son una gráfica: en el teléfono
              solo salen los meses que SÍ tuvieron ingreso (si no hubo ninguno,
              se dice con palabras). El relleno es color plano, no degradado:
              el degradado se apagaba y la barra quedaba vacía con dato. */}
          {(() => {
            const conDato = d.serie.filter((x: any) => x.monto_unicos > 0);
            const filas = esMovilFin ? conDato : d.serie;
            if (esMovilFin && conDato.length === 0) {
              return <div style={{ fontSize: '0.8rem', color: P.tenue, padding: '10px 0' }}>Ningún mes del periodo registró pagos únicos.</div>;
            }
            return filas.map((x: any) => (
              <div key={x.mes} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: '0.76rem' }}>
                <span style={{ width: 42, color: P.tenue }}>{etiquetaMes(x.mes, x.mes.endsWith('-01'))}</span>
                <div style={{ height: 7, borderRadius: 9, background: G.track, overflow: 'hidden', flex: 1 }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 9, width: `${Math.max(x.monto_unicos ? 3 : 0, (x.monto_unicos / maxUnico) * 100)}%`, background: G.serie }} />
                </div>
                <span style={{ width: 74, textAlign: 'right', fontWeight: 800 }}>{x.monto_unicos ? money(x.monto_unicos) : '—'}</span>
                <span style={{ width: 20, textAlign: 'right', color: P.gris }}>{x.unicos || ''}</span>
              </div>
            ));
          })()}
          <div style={S.nota}>
            <b>{money(d.unicos.total)}</b> en {d.unicos.n} pagos no recurrentes
            {d.unicos.vitalicias.monto > 0 && <>, de los cuales <b>{money(d.unicos.vitalicias.monto)}</b> son licencias vitalicias</>}.
            Cuenta lo que <b>no se vuelve a cobrar</b>: plugins, personalizaciones, desarrollos y vitalicias. El primer pago de
            una licencia anual NO entra aquí, aunque venga de una cotización — ese es recurrente.
            {d.unicos.sin_origen?.n > 0 && (
              <> Quedan <b>{d.unicos.sin_origen.n} pagos por {money(d.unicos.sin_origen.monto)}</b> sin cotización ni licencia:
                no se pueden clasificar y por eso no están en ninguna de las dos cifras.</>
            )}
          </div>
        </div>
      </div>

      {/* ── LA CUENTA COMPRA MÁS QUE SU LICENCIA ── */}
      <div style={S.tit}>Quién compra extras · y cuándo se compran</div>
      <div className="fin-k2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
        <div style={S.card}>
          <div style={S.tit}>Cuentas que ya repitieron</div>
          {d.unicos.recurrentes_extra.length === 0
            ? <div style={{ fontSize: '0.8rem', color: P.tenue, padding: '14px 0' }}>Todavía ninguna cuenta ha comprado un extra más de una vez.</div>
            : esMovilFin ? (
              /* Cuatro columnas de dinero en 390 px cortaban el encabezado
                 «Ticket». En el teléfono: cuenta y total arriba, y el detalle
                 (cuántas compras y de a cuánto) en la línea de metadatos. */
              <div>
                {d.unicos.recurrentes_extra.map((x: any) => (
                  <div key={x.company_id} onClick={() => onCuenta?.(x.company_id)}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0eff3', cursor: onCuenta ? 'pointer' : 'default' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8a8590', marginTop: 2 }}>{x.n} compras · ticket {money(x.ticket)}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{money(x.monto)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.th}>Cuenta</th><th style={{ ...S.th, textAlign: 'right' }}>Compras</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Total</th><th style={{ ...S.th, textAlign: 'right' }}>Ticket</th>
                </tr></thead>
                <tbody>
                  {d.unicos.recurrentes_extra.map((x: any) => (
                    <tr key={x.company_id}>
                      <td style={{ ...S.td, fontWeight: 800, cursor: onCuenta ? 'pointer' : 'default' }} onClick={() => onCuenta?.(x.company_id)}>{x.nombre}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{x.n}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: ROSA }}>{money(x.monto)}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{money(x.ticket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <div style={S.nota}>
            <b>Quien ya compró dos veces es quien va a comprar la tercera.</b> Esta lista es a quién ofrecerle el
            siguiente desarrollo, y su ticket dice con cuánto empezar la conversación.
          </div>
        </div>
        <div style={S.card}>
          <div style={S.tit}>En qué mes del año se compran extras</div>
          <Estacionalidad datos={d.unicos.estacionalidad} G={G} />
          <div style={S.nota}>
            Sumando todos los años, no un calendario del último. Los meses altos son cuando el cliente tiene
            presupuesto y dice que sí — ofrecerle en su mes cuesta lo mismo y cierra más.
          </div>
        </div>
      </div>

      {/* ── LO QUE VIENE + CONCENTRACIÓN ── */}
      <div className="fin-k2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 14 }}>
        <div style={S.card}>
          <div style={S.tit}>Calendario de renovaciones · 12 meses</div>
          {d.calendario.map((x: any) => {
            const grande = x.monto / (t.arr_activo || 1) > 0.15;
            return (
              <div key={x.mes} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: '0.76rem' }}>
                <span style={{ width: 42, color: '#8a8590' }}>{etiquetaMes(x.mes, true)}</span>
                <div style={{ height: 7, borderRadius: 9, background: G.track, overflow: 'hidden', flex: 1 }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 9, width: `${Math.max(3, (x.monto / maxRenov) * 100)}%`, background: grande ? DOWN : G.serie }} />
                </div>
                <span style={{ width: 78, textAlign: 'right', fontWeight: 800 }}>{money(x.monto)}</span>
                <span style={{ width: 22, textAlign: 'right', color: '#a5a2af' }}>{x.n}</span>
              </div>
            );
          })}
          <div style={S.nota}>En rojo los meses que concentran más del 15% del ARR: si ese mes sale mal, el año sale mal.</div>
        </div>
        <div style={S.card}>
          <div style={S.tit}>Concentración de clientes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {d.concentracion.top.map((x: any, i: number) => (
                <tr key={x.company_id}>
                  <td style={{ ...S.td, fontWeight: i === 0 ? 800 : 400, cursor: onCuenta ? 'pointer' : 'default' }} onClick={() => onCuenta?.(x.company_id)}>{x.nombre}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{money(x.arr)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: x.pct > 15 ? DOWN : '#241d43' }}>{x.pct}%</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...S.td, fontWeight: 800, color: '#9a6a10' }}>Top 5 juntos</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 800 }}>{money(d.concentracion.top.reduce((a: number, x: any) => a + x.arr, 0))}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: '#9a6a10' }}>{d.concentracion.top5_pct}%</td>
              </tr>
            </tbody>
          </table>
          <div style={S.nota}>Cuánto del recurrente depende de pocas cuentas. Es el riesgo que un inversionista pregunta antes que ningún otro.</div>
        </div>
      </div>

      {/* ── COHORTES ── */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.tit}>Cuántos se quedan · retención por cohorte</div>
        {esMovilFin ? (
          /* La tabla de cuatro columnas sacaba la barra y el badge fuera de la
             tarjeta. En el teléfono el mes manda a la izquierda, el porcentaje
             a la derecha y la barra ocupa el renglón completo debajo. */
          <div>
            {d.cohortes.map((x: any) => {
              const col = x.pct >= 80 ? UP : x.pct >= 50 ? '#9a6a10' : DOWN;
              return (
                <div key={x.mes} style={{ padding: '11px 0', borderBottom: '1px solid #f0eff3' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#241d43', flex: 1, minWidth: 0 }}>{etiquetaMes(x.mes, true)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8a8590' }}>{x.vivos} de {x.n}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: col, minWidth: 44, textAlign: 'right' }}>{x.pct}%</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 9, background: G.track, overflow: 'hidden', marginTop: 7 }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 9, width: `${x.pct}%`, background: col }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={S.th}>Entraron en</th><th style={{ ...S.th, textAlign: 'right' }}>Clientes</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Siguen</th><th style={{ ...S.th, width: '45%' }}>Retención</th>
          </tr></thead>
          <tbody>
            {d.cohortes.map((x: any) => {
              const col = x.pct >= 80 ? UP : x.pct >= 50 ? '#9a6a10' : DOWN;
              const bg = x.pct >= 80 ? '#EAF8F2' : x.pct >= 50 ? '#FFF4E5' : '#FEF0EF';
              return (
                <tr key={x.mes}>
                  <td style={{ ...S.td, fontWeight: 800 }}>{etiquetaMes(x.mes, true)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{x.n}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{x.vivos}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ height: 7, borderRadius: 9, background: G.track, overflow: 'hidden', flex: 1 }}>
                        <span style={{ display: 'block', height: '100%', borderRadius: 9, width: `${x.pct}%`, background: col }} />
                      </div>
                      <span style={{ minWidth: 42, textAlign: 'center', borderRadius: 6, padding: '3px 6px', fontSize: '0.7rem', fontWeight: 700, background: bg, color: col }}>{x.pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
        <div style={S.nota}>Cada renglón es el mes en que entró el cliente y qué porcentaje sigue vivo hoy. Si las cohortes nuevas retienen menos que las viejas, el problema está en qué se promete al vender.</div>
      </div>

      {/* ── DATOS POR COMPLETAR ── */}
      {d.pendientes.length > 0 && (
        <>
          <div style={S.tit}>Datos por completar · cada uno limita lo que este panel puede decir</div>
          {d.pendientes.map((x: any) => {
            const col = x.nivel === 'alto' ? DOWN : x.nivel === 'medio' ? '#9a6a10' : VIO;
            const bg = x.nivel === 'alto' ? '#FEF0EF' : x.nivel === 'medio' ? '#FFF4E5' : '#F3F0FE';
            return (
              /* En el teléfono el badge, el texto y el botón en una fila dejan
                 la columna de texto en ~130 px y parten el párrafo cada tres
                 palabras. Apilado: cuántos + título arriba, la consecuencia a
                 ancho completo y el botón abajo con su target de 44 px. */
              <div key={x.id} style={{ display: 'flex', alignItems: esMovilFin ? 'stretch' : 'center', flexDirection: esMovilFin ? 'column' : 'row', gap: esMovilFin ? 9 : 13, padding: '12px 14px', borderRadius: 11, background: '#fff', border: '1px solid #eeeef1', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, flexShrink: 0, background: bg, color: col }}>{x.n}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{x.titulo}</div>
                    {!esMovilFin && <div style={{ fontSize: '0.74rem', color: '#8a8590', lineHeight: 1.45, marginTop: 2 }}>{x.limita}</div>}
                  </div>
                </div>
                {esMovilFin && <div style={{ fontSize: '0.76rem', color: '#8a8590', lineHeight: 1.5 }}>{x.limita}</div>}
                <span style={{ marginLeft: esMovilFin ? 0 : 'auto', flexShrink: 0 }}>
                  <button style={{ ...S.btn, ...(esMovilFin ? { width: '100%', minHeight: 44 } : {}) }} onClick={() => setPendiente(x.id)}>Ver y completar →</button>
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: '0.73rem', color: '#8a8590', lineHeight: 1.55, marginTop: 4 }}>
            No es una lista de errores: es <b style={{ color: '#4a4a52' }}>trabajo de captura pendiente</b>. Cada renglón abre las cuentas afectadas para arreglarlas.
          </div>
        </>
      )}

      {detalle && (detalle === 'ganadas' || detalle === 'perdidas') &&
        <PanelCuentas tipo={detalle} d={d} onCerrar={() => setDetalle('')} onCuenta={onCuenta} />}

      {pendiente && <PanelPendiente id={pendiente} onCerrar={() => setPendiente('')} onListo={() => { setPendiente(''); cargar(); }} />}

      <style>{`
        @media (max-width: 1080px) {
          .fin-k5 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .fin-k4 { grid-template-columns: repeat(2, 1fr) !important; }
          .fin-k2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── En qué mes del año se compran extras ───
 * Doce barras, una por mes del calendario, sumando todos los años. Con un solo
 * año esto es anécdota; con dos empieza a ser un calendario comercial. */
function Estacionalidad({ datos, G }: { datos: any[]; G: any }) {
  const max = Math.max(1, ...datos.map((x: any) => x.monto));
  const NOM = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, marginTop: 8 }}>
      {datos.map((x: any, i: number) => {
        const h = (x.monto / max) * 100;
        return (
          <div key={x.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
            {x.monto > 0 && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: G.serie, marginBottom: 4, whiteSpace: 'nowrap' }}>{Math.round(x.monto / 1000)}k</div>}
            <div title={`${x.n} pago${x.n === 1 ? '' : 's'} · ${money(x.monto)}`}
              style={{ width: '100%', borderRadius: '5px 5px 0 0', minHeight: 3, height: `${Math.max(2, h)}%`, background: x.monto ? G.serie : G.track }} />
            <div style={{ fontSize: '0.62rem', color: P.tenue, marginTop: 6 }}>{NOM[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── La lista de cuentas detrás de un KPI ───
 * "+$64,012" no se puede verificar ni contar en una junta; los nombres sí. */
function PanelCuentas({ tipo, d, onCerrar, onCuenta }: { tipo: string; d: any; onCerrar: () => void; onCuenta?: (id: string) => void }) {
  const ganadas = tipo === 'ganadas';
  const filas = ganadas ? d.detalle.ganadas : d.detalle.perdidas;
  const suma = filas.reduce((a: number, x: any) => a + x.arr, 0);
  const mes = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,60,.35)', zIndex: 700 }} />
      <div style={{
        position: 'fixed', top: '8vh', left: '50%', transform: 'translateX(-50%)', width: 'min(700px, 94vw)', maxHeight: '82vh',
        background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(30,10,70,.28)', zIndex: 701, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ height: 4, background: CINTA }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: `1px solid ${P.lineaSuave}` }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{ganadas ? 'Cuentas ganadas' : 'Cuentas dadas de baja'} en {mes}</div>
            <div style={{ fontSize: '0.75rem', color: P.tenue }}>
              {filas.length} cuenta{filas.length === 1 ? '' : 's'} · {money(suma)} de ARR
            </div>
          </div>
          <button onClick={onCerrar} style={{ marginLeft: 'auto', ...S.btn, padding: '7px 11px' }}>Cerrar</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 16px' }}>
          {filas.length === 0
            ? <div style={{ padding: 30, textAlign: 'center', color: P.tenue, fontSize: '0.84rem' }}>
                Ninguna {ganadas ? 'alta' : 'baja'} este mes.
              </div>
            : filas.map((x: any) => (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${P.lineaSuave}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, cursor: onCuenta ? 'pointer' : 'default' }}
                    onClick={() => x.company_id && onCuenta?.(x.company_id)}>{x.nombre}</div>
                  <div style={{ fontSize: '0.72rem', color: P.tenue }}>
                    {x.plan || 'sin plan'} · {x.ciclo} · {x.fecha}
                    {!ganadas && <> · {x.motivo ? `motivo: ${x.motivo}` : <b style={{ color: P.ambarTinta }}>sin motivo capturado</b>}</>}
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: ganadas ? UP : DOWN, whiteSpace: 'nowrap' }}>
                  {ganadas ? '+' : '−'}{money(x.arr)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

/* ─── El puente de ARR ─────────────────────────────────────────────────────
 * Las barras de los extremos son totales y las de en medio, movimientos: por
 * eso las primeras van a altura completa y las otras a escala entre ellas. */
function Puente({ p, G, movil }: { p: any; G: any; movil?: boolean }) {
  const pasos = [
    { l: 'ARR inicial', v: p.arr_inicio, t: 'tot' },
    { l: 'Nuevo', v: p.nuevo, t: 'pos' },
    { l: 'Expansión', v: p.expansion, t: 'exp' },
    { l: 'Contracción', v: p.contraccion, t: 'neg' },
    { l: 'Bajas', v: p.baja, t: 'chu' },
    { l: 'ARR final', v: p.arr_fin, t: 'fin' },
  ];
  const maxMov = Math.max(1, ...pasos.filter(x => x.t !== 'tot' && x.t !== 'fin').map(x => Math.abs(x.v)));
  const fondo: Record<string, string> = {
    tot: '#EEECFE', pos: '#9B8CFA', exp: 'rgba(155,140,250,.62)',
    neg: '#EF7A72', chu: '#C0554E',
    fin: '#9B8CFA',
  };
  /* Seis columnas de barra con montos de siete dígitos no caben en 390 px:
     «$1,961,359» y la etiqueta «ARR final» se salían de la pantalla. En el
     teléfono el puente se lee como lista: el concepto a la izquierda y el
     movimiento a la derecha, con su signo y su color. */
  if (movil) return (
    <div style={{ marginTop: 4 }}>
      {pasos.map(x => {
        const total = x.t === 'tot' || x.t === 'fin';
        return (
          <div key={x.l} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid ' + G.grid }}>
            <span style={{ fontSize: '0.84rem', fontWeight: total ? 800 : 600, color: total ? '#241d43' : '#8a8590' }}>{x.l}</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: total ? '#241d43' : x.v >= 0 ? UP : DOWN }}>
              {x.v > 0 && !total ? '+' : ''}{money(x.v)}
            </span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 190, marginTop: 6 }}>
      {pasos.map(x => {
        const total = x.t === 'tot' || x.t === 'fin';
        const h = total ? 100 : Math.max(4, (Math.abs(x.v) / maxMov) * 74);
        return (
          <div key={x.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
            <div style={{ fontSize: '0.71rem', fontWeight: 800, marginBottom: 5, whiteSpace: 'nowrap', color: total ? '#241d43' : x.v >= 0 ? UP : DOWN }}>
              {x.v > 0 && !total ? '+' : ''}{money(x.v)}
            </div>
            <div style={{ width: '100%', borderRadius: '6px 6px 0 0', minHeight: 3, height: `${h}%`, background: fondo[x.t], border: x.t === 'tot' ? '1px solid #ddd6fb' : 'none' }} />
            <div style={{ fontSize: '0.63rem', color: '#8a8590', marginTop: 7, textAlign: 'center', lineHeight: 1.3 }}>{x.l}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Serie: área del ARR + barras de altas y bajas ─── */
function Serie({ serie, max, maxAlta, G, movil }: { serie: any[]; max: number; maxAlta: number; G: any; movil?: boolean }) {
  // El viewBox se estrecha en el teléfono para que la escala sea ~1: con 1100
  // de ancho dentro de una caja de 390, «meet» encogía las etiquetas a 3.5 px
  // y «none» las dejaba condensadas. A 420 el texto sale a tamaño real.
  // El viewBox iguala el ANCHO REAL de la caja (≈324 px dentro de la tarjeta):
  // con 420 la escala caía a 0.75 y el texto de 13 salía en 10.4.
  const W = movil ? 324 : 1100, H = movil ? 172 : 220, P = { t: 10, r: movil ? 16 : 8, b: 26, l: movil ? 54 : 64 };
  const top = max * 1.08;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, serie.length - 1);
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const hb = (n: number) => (n / maxAlta) * (H - P.t - P.b) * 0.42;
  const area = `M${x(0)},${y(0)} ` + serie.map((s, i) => `L${x(i)},${y(s.arr)}`).join(' ') + ` L${x(serie.length - 1)},${y(0)} Z`;
  const linea = serie.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.arr)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: movil ? 176 : 220 }}>
      <defs><linearGradient id="finArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9B8CFA" stopOpacity=".34" /><stop offset="100%" stopColor="#EFA6CA" stopOpacity=".05" />
      </linearGradient></defs>
      {[0, .5, 1].map(f => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(top * f)} y2={y(top * f)} stroke={G.grid} />
          <text x={P.l - 8} y={y(top * f) + 4} textAnchor="end" fontSize="13" fill={G.eje}>{corteEje(top * f)}</text>
        </g>
      ))}
      <path d={area} fill="url(#finArea)" />
      <path d={linea} fill="none" stroke={G.serie} strokeWidth="2.5" />
      {serie.map((s, i) => (
        <g key={s.mes}>
          {s.altas > 0 && <rect x={x(i) - 10} y={H - P.b - hb(s.altas)} width="9" height={hb(s.altas)} rx="2" fill={G.serie2} />}
          {s.bajas > 0 && <rect x={x(i) + 1} y={H - P.b - hb(s.bajas)} width="9" height={hb(s.bajas)} rx="2" fill={G.serie3} />}
          <circle cx={x(i)} cy={y(s.arr)} r="3" fill={G.punto} stroke={G.serie} strokeWidth="2" />
          {/* En el teléfono se rotula uno de cada dos meses: con 27 px de paso
              las doce etiquetas se encimaban hasta volverse una mancha. */}
          {(!movil || i % 2 === 0 || i === serie.length - 1) && (
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="13" fill={G.eje}>{etiquetaMes(s.mes, s.mes.endsWith('-01') || i === 0)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── Proyección a 12 meses ───────────────────────────────────────────────
 * El eje NO arranca en cero: con millones de base, escenarios separados por
 * cientos de miles se verían como la misma raya. Se encuadra a los datos. */
function Proyeccion({ serie, proy, G, movil }: { serie: any[]; proy: any; G: any; movil?: boolean }) {
  const hist = serie.slice(-6).map((s: any) => s.arr);
  const todos = [...hist, ...proy.alto, ...proy.bajo];
  const max = Math.max(...todos), min = Math.min(...todos);
  const pad = (max - min) * 0.18 || max * 0.1;
  const hi = max + pad, lo = Math.max(0, min - pad);
  // Mismo criterio que Serie: en el teléfono el viewBox se estrecha para que
  // el texto del SVG salga a tamaño real y el dibujo llene su caja.
  // El margen izquierdo tiene que caber la etiqueta completa: con 42 el signo
  // de pesos quedaba fuera del viewBox y se recortaba.
  const W = movil ? 324 : 1100, H = movil ? 168 : 210, P = { t: 10, r: movil ? 56 : 78, b: 24, l: movil ? 56 : 64 };
  const N = hist.length + 12 - 1;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / N;
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo || 1)) * (H - P.t - P.b);
  const path = (arr: number[], off: number) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i + off)},${y(v)}`).join(' ');
  const corte = hist.length - 1;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: movil ? 172 : 210 }}>
        {[0, .33, .66, 1].map(f => {
          const v = lo + (hi - lo) * f;
          return (
            <g key={f}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke={G.grid} />
              <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="13" fill={G.eje}>{kMoney(v)}</text>
            </g>
          );
        })}
        <rect x={x(corte)} y={P.t} width={W - P.r - x(corte)} height={H - P.t - P.b} fill={G.banda} />
        <line x1={x(corte)} x2={x(corte)} y1={P.t} y2={H - P.b} stroke={G.grid} strokeDasharray="3 3" />
        <path d={path(proy.alto, corte)} fill="none" stroke={G.serie2} strokeWidth="1.7" strokeDasharray="5 4" />
        <path d={path(proy.bajo, corte)} fill="none" stroke={G.serie3} strokeWidth="1.7" strokeDasharray="5 4" />
        <path d={path(proy.medio, corte)} fill="none" stroke={G.serie} strokeWidth="2.4" strokeDasharray="7 4" />
        <path d={path(hist, 0)} fill="none" stroke={G.serie} strokeWidth="2.6" />
        {hist.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill={G.punto} stroke={G.serie} strokeWidth="2" />)}
        <text x={x(N) + 7} y={y(proy.alto[12]) + 4} fontSize="13" fill={G.serie} fontWeight="800">{kMoney(proy.alto[12])}</text>
        <text x={x(N) + 7} y={y(proy.medio[12]) + 4} fontSize="13" fill={G.serie} fontWeight="800">{kMoney(proy.medio[12])}</text>
        <text x={x(N) + 7} y={y(proy.bajo[12]) + 4} fontSize="13" fill={G.serie} fontWeight="800">{kMoney(proy.bajo[12])}</text>
        <text x={x(corte)} y={H - 8} textAnchor="middle" fontSize="13" fill={G.eje}>hoy</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.71rem', color: '#6b7280', marginTop: 2 }}>
        {[[G.serie2, 'Si el ritmo mejora'], [G.serie, 'Si se mantiene'], [G.serie3, 'Si se enfría']].map(([c, l]) => (
          <span key={l}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: c, marginRight: 5, verticalAlign: -1 }} />{l}</span>
        ))}
      </div>
    </>
  );
}

/* ─── El panel para completar datos ───────────────────────────────────────
 * Cada pendiente abre su lista y se corrige aquí mismo: mandar a la persona a
 * buscar 19 cuentas de a una es la forma segura de que no se haga nunca. */
function PanelPendiente({ id, onCerrar, onListo }: { id: string; onCerrar: () => void; onListo: () => void }) {
  const [filas, setFilas] = useState<any[] | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/arr/pendientes?id=${id}`).then(r => r.json())
      .then(j => setFilas(j.filas || [])).catch(() => setFilas([]));
  }, [id]);

  async function guardar() {
    const cambios = Object.entries(valores).filter(([, v]) => v);
    if (!cambios.length) { onCerrar(); return; }
    setGuardando(true);
    await fetch('/api/crm/arr/pendientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cambios: cambios.map(([k, v]) => ({ id: k, valor: v })) }),
    }).catch(() => {});
    setGuardando(false); onListo();
  }

  const TITULO: Record<string, string> = {
    cotizacion_sin_sub: 'Cotizaciones pagadas sin licencia',
    pagos_sin_origen: 'Pagos sin cotización ni licencia',
    bajas_sin_motivo: 'Bajas sin motivo',
    plan_no_reconocido: 'Licencias fuera del catálogo',
    pagos_sin_cliente: 'Pagos sin cliente',
    sin_fecha_inicio: 'Suscripciones sin fecha de inicio',
    sin_proxima_factura: 'Activas sin próxima factura',
  };

  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,60,.35)', zIndex: 700 }} />
      <div style={{
        position: 'fixed', top: '6vh', left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 94vw)', maxHeight: '86vh',
        background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(30,10,70,.28)', zIndex: 701, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#9B8CFA 0%,#7DA6F5 55%,rgba(244,168,205,.9) 100%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: '1px solid #f0eff3' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{TITULO[id] || 'Completar datos'}</div>
            <div style={{ fontSize: '0.74rem', color: '#8a8590' }}>{filas ? `${filas.length} por completar` : 'Cargando…'}</div>
          </div>
          <button onClick={onCerrar} style={{ marginLeft: 'auto', ...S.btn, padding: '7px 11px' }}>Cerrar</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {!filas ? <Cargando texto="Cargando la lista…" alto={140} /> : filas.length === 0
            ? <div style={{ padding: 30, textAlign: 'center', color: '#8a8590', fontSize: '0.84rem' }}>Nada pendiente. Ya está completo.</div>
            : filas.map((f: any) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f7f6fa', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 190, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{f.titulo}</div>
                  <div style={{ fontSize: '0.72rem', color: '#8a8590' }}>{f.detalle}</div>
                </div>
                {f.opciones
                  ? <select value={valores[f.id] || ''} onChange={e => setValores({ ...valores, [f.id]: e.target.value })}
                      style={{ ...S.btn, fontWeight: 500, minWidth: 210 }}>
                      <option value="">Elige…</option>
                      {f.opciones.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  : <input type={f.tipo === 'fecha' ? 'date' : 'text'} value={valores[f.id] || ''}
                      onChange={e => setValores({ ...valores, [f.id]: e.target.value })}
                      placeholder={f.placeholder || ''} style={{ ...S.btn, fontWeight: 500, minWidth: 210 }} />}
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid #f0eff3', background: '#fcfbfe' }}>
          <span style={{ fontSize: '0.74rem', color: '#8a8590', alignSelf: 'center' }}>
            {Object.values(valores).filter(Boolean).length} cambio{Object.values(valores).filter(Boolean).length === 1 ? '' : 's'} por guardar
          </span>
          <button onClick={guardar} disabled={guardando}
            style={{ marginLeft: 'auto', ...S.btn, background: '#9B8CFA', borderColor: '#9B8CFA', color: '#fff', fontWeight: 800 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}
