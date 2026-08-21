// SOPORTE · Dashboard GLOBAL de soporte (tab del CRM). Volumen por estado/tema,
// SLA (primera respuesta y resolución), sentimiento, quién consume el soporte y
// tendencia. Founder-only (middleware).
//
// Habla el MISMO idioma visual que el dashboard de Cotizaciones: tarjetas con
// franja de color a la izquierda, comparativo contra el periodo anterior, y la
// gama de abajo. No se inventa color aquí — el mostaza que había antes no
// existe en el sistema.
import { useEffect, useState } from 'react';
import { S, Tag, Aviso, Vacio, Cargando, fmtFecha } from '../email/ui';
import ClienteDrawer360 from '../ClienteDrawer360';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

// ─── Gama (la de Cotizaciones) ───
// Morado y azul cielo son los protagonistas y visten todo lo estructural. El
// verde es lo que cierra bien (resuelto), el rojo SOLO la alarma de verdad
// (estancado, urgente) — si el rojo se usa para todo, deja de gritar.
const VERDE = '#4FBF95';        // verde pastel — barras y franjas de lo resuelto
const VERDE_TINTA = '#1E8A63';  // el mismo, legible — para las CANTIDADES
const MORADO = '#9B8CFA';       // morado — estructura, volumen
const MORADO_SUAVE = '#B6ABFC'; // morado claro
const AZUL = '#7DA6F5';         // azul cielo — lo que entra, todavía en juego
const AZUL_AGUA = '#DDE8FC';    // azul aguado — relleno de barras
const ROJO = '#C0554E';         // rojo pastel en tinta — la alarma
const TINTA = '#5B4BD6';        // morado oscuro — texto y énfasis
const GRIS = '#E5E3EA';

const CSS = `
  .sop { width: 100%; min-width: 0; }
  .sop-card { min-width: 0; }
  .sop-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
  .sop-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  @media (max-width: 1250px) { .sop-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .sop-2 { grid-template-columns: 1fr; } }
  @media (max-width: 700px)  { .sop-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const hoyMx = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const hace = (d: number) => new Date(Date.parse(hoyMx() + 'T00:00:00Z') - d * 86400_000).toISOString().slice(0, 10);

// El sentimiento en la gama: urgente y negativo son alarma, positivo es lo que
// cierra bien, neutral no es noticia.
const SENT: Record<string, { bg: string; fg: string }> = {
  urgente: { bg: '#FBECEA', fg: ROJO },
  negativo: { bg: '#FBECEA', fg: ROJO },
  neutral: { bg: '#f4f4f6', fg: '#6B7280' },
  positivo: { bg: '#EAF8F2', fg: VERDE_TINTA },
};

// ─── Piezas del lenguaje de Cotizaciones ───
function Kpi({ t, v, barra, hijo }: { t: string; v: any; barra?: string; hijo?: any }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${barra || MORADO}`, borderRadius: 12, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{v}</div>
      <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6', lineHeight: 1.5 }}>{hijo}</div>
    </div>
  );
}

/** Comparativo contra el periodo anterior. `invertido` para los tiempos: bajar
 *  es mejorar. `neutro` cuando más no es ni bueno ni malo (los que entran): un
 *  color ahí sería una opinión que el dato no sostiene. */
function Delta({ v, a, invertido, neutro }: { v: number | null; a: number | null; invertido?: boolean; neutro?: boolean }) {
  if (v == null || a == null || a === 0) return <span style={{ color: '#b3afbd' }}>sin comparativo</span>;
  const dif = Math.round(((v - a) / Math.abs(a)) * 100);
  if (dif === 0) return <span style={{ color: '#9c99a6' }}>igual que el periodo anterior</span>;
  const color = neutro ? '#7d7a88' : ((invertido ? dif < 0 : dif > 0) ? VERDE_TINTA : TINTA);
  return <span style={{ color, fontWeight: 800 }}>{dif > 0 ? '↑' : '↓'} {Math.abs(dif)}%</span>;
}

function Tarjeta({ titulo, cap, extra, children }: { titulo: string; cap?: string; extra?: any; children: any }) {
  return (
    <div className="sop-card" style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '18px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.83rem', margin: 0, fontWeight: 800, flex: 1 }}>{titulo}</h3>
        {extra}
      </div>
      {cap && <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 3, marginBottom: 16 }}>{cap}</div>}
      {!cap && <div style={{ height: 14 }} />}
      {children}
    </div>
  );
}

function Encabezado({ periodo, children }: { periodo?: any; children?: any }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
      <style>{CSS}</style>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Soporte</h2>
        <div style={{ fontSize: '0.74rem', color: '#9c99a6', marginTop: 3 }}>
          {periodo
            ? <>Del {fechaCorta(periodo.desde)} al {fechaCorta(periodo.hasta)} · comparado contra los {periodo.dias} días anteriores</>
            : 'Todo lo que entra por Intercom: qué se pide, qué tan rápido se resuelve y quién lo pide.'}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Selector de periodo: atajos + rango personalizado ──────────────────────
function SelectorPeriodo({ modo, dias, desde, hasta, onDias, onRango, onModo }: any) {
  const chip = (on: boolean) => ({
    border: '1px solid', borderColor: on ? '#cdbdf7' : '#e2e4e9', background: on ? '#EEECFE' : '#fff',
    color: on ? '#6d4bc7' : '#666', borderRadius: 8, padding: '5px 12px', fontSize: '0.74rem',
    fontWeight: on ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit',
  });
  const input = { border: '1px solid #cdbdf7', color: '#6d4bc7', borderRadius: 8, padding: '5px 9px', fontSize: '0.73rem', fontWeight: 700, fontFamily: 'inherit', background: '#fff' };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: '0.72rem', color: '#9c99a6', fontWeight: 700 }}>Periodo:</span>
      {[14, 30, 90].map(n => (
        <button key={n} onClick={() => onDias(n)} style={chip(modo === 'dias' && dias === n)}>{n} días</button>
      ))}
      <button onClick={() => onModo(modo === 'rango' ? 'dias' : 'rango')} style={chip(modo === 'rango')}>Personalizado</button>
      {modo === 'rango' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={desde} max={hasta || hoyMx()} onChange={e => onRango(e.target.value, hasta)} style={input} aria-label="Desde" />
          <span style={{ fontSize: '0.72rem', color: '#9c99a6' }}>al</span>
          <input type="date" value={hasta} min={desde} max={hoyMx()} onChange={e => onRango(desde, e.target.value)} style={input} aria-label="Hasta" />
        </div>
      )}
    </div>
  );
}

// ── Clientes que más piden atención ────────────────────────────────────────
function TopClientes({ filas, etiqueta, onAbrir }: { filas: any[]; etiqueta: string; onAbrir: (id: string) => void }) {
  const [todos, setTodos] = useState(false);
  if (!filas.length) {
    return (
      <Tarjeta titulo="Clientes que más piden atención" cap={`Nadie abrió ni movió un ticket en este periodo (${etiqueta}).`}>
        <div />
      </Tarjeta>
    );
  }
  const vista = todos ? filas : filas.slice(0, 10);
  const max = Math.max(1, ...filas.map((f: any) => f.n));
  const th = (der?: boolean) => ({ ...S.th, textAlign: (der ? 'right' : 'left') as any });

  return (
    <Tarjeta titulo="Clientes que más piden atención"
      cap="Quién consume el soporte por este canal. Da clic en un cliente para abrir su ficha."
      extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
      <div className="crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th()}>Cliente</th>
            <th style={th(true)}>Tickets</th>
            <th style={th(true)}>Abiertos</th>
            <th style={th(true)}>Estancados</th>
            <th style={th(true)}>Urgentes</th>
            <th style={th()}>Lo que más pide</th>
            <th style={th()}>Último movimiento</th>
          </tr></thead>
          <tbody>
            {vista.map((f: any, i: number) => {
              const ligado = !!f.company_id;
              const nombre = f.nombre || f.cuenta || 'Sin identificar';
              return (
                <tr key={f.company_id || `cta-${f.cuenta || i}`}
                  onClick={() => ligado && onAbrir(f.company_id)}
                  style={{ cursor: ligado ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (ligado) e.currentTarget.style.background = '#fafafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ ...S.td, minWidth: 190 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: ligado ? '#1a1a1a' : '#8a8a8a' }}>{nombre}</span>
                      {!ligado && <Tag tono="gris">sin ligar</Tag>}
                      {f.estado_cuenta === 'cancelado' && <Tag tono="malo">baja</Tag>}
                      {f.estado_cuenta === 'vencido' && <Tag tono="malo">vencido</Tag>}
                    </div>
                    {f.plan && <div style={{ fontSize: '0.66rem', color: '#b3b1bb', marginTop: 2, fontWeight: 600 }}>{f.plan}</div>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', minWidth: 96 }}>
                    <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{f.n}</div>
                    <div style={{ height: 5, background: '#f3f2f7', borderRadius: 3, marginTop: 4 }}>
                      <div style={{ width: `${(f.n / max) * 100}%`, height: '100%', background: MORADO, borderRadius: 3 }} />
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.abiertos ? TINTA : '#c9c7d0' }}>{f.abiertos || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.estancados ? ROJO : '#c9c7d0' }}>{f.estancados || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.urgentes ? ROJO : '#c9c7d0' }}>{f.urgentes || '—'}</td>
                  <td style={{ ...S.td, color: '#666' }}>{f.tema_label || '—'}</td>
                  <td style={{ ...S.td, color: '#9c99a6', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtFecha(f.ultimo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filas.length > 10 && (
        <button onClick={() => setTodos(!todos)} style={{ ...S.btnG, marginTop: 12 }}>
          {todos ? 'Ver solo el top 10' : `Ver los ${filas.length}`}
        </button>
      )}
    </Tarjeta>
  );
}

export default function SoporteTab() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [modo, setModo] = useState<'dias' | 'rango'>('dias');
  const [dias, setDias] = useState(30);
  const [desde, setDesde] = useState(hace(29));
  const [hasta, setHasta] = useState(hoyMx());
  const [cliente, setCliente] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const query = modo === 'rango' && desde && hasta && desde <= hasta
    ? `desde=${desde}&hasta=${hasta}` : `dias=${dias}`;

  useEffect(() => {
    let vivo = true; setD(null); setErr('');
    fetch(`/api/crm/soporte/dashboard?${query}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [query, recarga]);

  const selector = (
    <SelectorPeriodo modo={modo} dias={dias} desde={desde} hasta={hasta}
      onDias={(n: number) => { setModo('dias'); setDias(n); }}
      onModo={(m: 'dias' | 'rango') => setModo(m)}
      onRango={(a: string, b: string) => { setDesde(a); setHasta(b); }} />
  );

  if (err) return <div className="sop" style={S.wrap}><Encabezado>{selector}</Encabezado><Aviso tono="malo" titulo="No se pudo cargar el dashboard">{err}</Aviso></div>;
  if (!d) return <div className="sop" style={S.wrap}><Encabezado>{selector}</Encabezado><Cargando que="el panel de soporte" /></div>;

  const T = d.totales || {}, K = d.kpis || {}, per = d.periodo || {};
  if (!T.total) return <div className="sop" style={S.wrap}><Encabezado>{selector}</Encabezado><Vacio titulo="Sin tickets de soporte todavía" texto="Cuando entren conversaciones de Intercom aparecerán aquí, ligadas a cada cliente." /></div>;

  const etiqueta = per.personalizado ? `${fechaCorta(per.desde)} – ${fechaCorta(per.hasta)}` : `últimos ${per.dias} días`;
  const maxTema = Math.max(1, ...(d.por_tema || []).map((x: any) => x.n));
  const tend = d.tendencia || [];
  const maxTend = Math.max(1, ...tend.map((x: any) => Math.max(x.abiertos, x.resueltos)));
  const ALTO = 108;
  const sinResolver = K.sin_resolver || {};
  const hayAlarma = (sinResolver.estancados || 0) > 0;

  return (
    <div className="sop" style={S.wrap}>
      <Encabezado periodo={per}>{selector}</Encabezado>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Cinco KPIs, ni uno más. El CSAT bajó a la tarjeta de sentimiento: hoy
            no tiene una sola respuesta y ocupaba un lugar de los importantes. */}
        <div className="sop-kpis">
          <Kpi barra={AZUL} t="Entraron" v={K.entraron?.valor ?? 0}
            hijo={<><Delta v={K.entraron?.valor} a={K.entraron?.anterior} neutro /> · antes {K.entraron?.anterior ?? 0}</>} />
          <Kpi barra={VERDE} t="Resueltos" v={<span style={{ color: VERDE_TINTA }}>{K.resueltos?.valor ?? 0}</span>}
            hijo={<><Delta v={K.resueltos?.valor} a={K.resueltos?.anterior} /> · antes {K.resueltos?.anterior ?? 0}</>} />
          <Kpi barra={hayAlarma ? ROJO : MORADO} t="Sin resolver" v={sinResolver.valor ?? 0}
            hijo={<>
              {hayAlarma
                ? <span style={{ color: ROJO, fontWeight: 800 }}>{sinResolver.estancados} estancado{sinResolver.estancados === 1 ? '' : 's'} +48 h</span>
                : <span style={{ color: VERDE_TINTA, fontWeight: 800 }}>ninguno estancado</span>}
              {sinResolver.sin_1a_respuesta > 0 && <> · {sinResolver.sin_1a_respuesta} sin 1ª respuesta</>}
            </>} />
          <Kpi barra={MORADO} t="1ª respuesta" v={K.frt?.valor != null ? `${K.frt.valor} h` : '—'}
            hijo={<><Delta v={K.frt?.valor} a={K.frt?.anterior} invertido /> · sobre {K.frt?.n ?? 0} ticket{K.frt?.n === 1 ? '' : 's'}</>} />
          <Kpi barra={MORADO_SUAVE} t="Resolución" v={K.resolucion?.valor != null ? `${K.resolucion.valor} h` : '—'}
            hijo={<><Delta v={K.resolucion?.valor} a={K.resolucion?.anterior} invertido /> · sobre {K.resolucion?.n ?? 0} resuelto{K.resolucion?.n === 1 ? '' : 's'}</>} />
        </div>

        <TopClientes filas={d.top_clientes || []} etiqueta={etiqueta} onAbrir={(id) => setCliente(id)} />

        <div className="sop-2">
          {/* Entraron contra resueltos: dos barras por día, como el mensual de
              Cotizaciones. La distancia entre ellas es la bandeja creciendo. */}
          <Tarjeta titulo="Lo que entra contra lo que se resuelve"
            cap={`La distancia entre las dos barras es lo que se está acumulando. ${per.agrupado === 'semana' ? 'Por semana.' : 'Por día.'}`}
            extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{etiqueta}</span>}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: ALTO + 22 }}>
              {tend.map((x: any) => (
                <div key={x.dia} title={`${fechaCorta(x.dia)}: entraron ${x.abiertos}, se resolvieron ${x.resueltos}`}
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: ALTO, width: '100%', justifyContent: 'center' }}>
                    <div style={{ flex: 1, maxWidth: 11, height: Math.round((x.abiertos / maxTend) * ALTO), minHeight: x.abiertos ? 2 : 0, background: AZUL_AGUA, borderRadius: '3px 3px 0 0' }} />
                    <div style={{ flex: 1, maxWidth: 11, height: Math.round((x.resueltos / maxTend) * ALTO), minHeight: x.resueltos ? 2 : 0, background: VERDE, borderRadius: '3px 3px 0 0' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
              <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: AZUL_AGUA }} />Entraron</span>
              <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: VERDE }} />Se resolvieron</span>
              <span style={{ marginLeft: 'auto' }}>{fechaCorta(per.desde)} → {fechaCorta(per.hasta)}</span>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Temas más frecuentes" cap="De qué se trata lo que entró en el periodo."
            extra={<span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{T.en_periodo} tickets</span>}>
            {(d.por_tema || []).slice(0, 8).map((x: any) => (
              <div key={x.tema} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                  <span style={{ color: x.tema === 'otros' ? '#a5a2af' : '#1a1a1a' }}>{x.label}</span>
                  <span style={{ fontWeight: 800 }}>{x.n}</span>
                </div>
                <div style={{ height: 6, background: '#f3f2f7', borderRadius: 3 }}>
                  <div style={{ width: `${(x.n / maxTema) * 100}%`, height: '100%', background: x.tema === 'otros' ? GRIS : MORADO, borderRadius: 3 }} />
                </div>
              </div>
            ))}
            {(d.por_tema || []).some((x: any) => x.tema === 'otros' && x.n / Math.max(1, T.en_periodo) > 0.3) && (
              <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f4f3f7', lineHeight: 1.55 }}>
                "Otros" en gris a propósito: es el cajón del clasificador, no un tema. Cuando pesa más de un tercio, lo que hace falta son reglas nuevas en <code>lib/soporte/clasificar.ts</code>, no leer esa barra.
              </div>
            )}
          </Tarjeta>
        </div>

        <div className="sop-2">
          <Tarjeta titulo="Cómo llegan los tickets" cap="El tono con el que escribe el cliente, clasificado por reglas sobre el primer mensaje.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(d.por_sentimiento || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]: any) => {
                const c = SENT[k] || SENT.neutral;
                return <span key={k} style={{ fontSize: '0.7rem', fontWeight: 800, background: c.bg, color: c.fg, borderRadius: 20, padding: '5px 12px' }}>{k}: {n}</span>;
              })}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em' }}>CSAT</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 3 }}>
                  {K.csat?.valor != null ? `${K.csat.valor}/5` : '—'}
                  <span style={{ fontSize: '0.7rem', color: '#a5a2af', fontWeight: 600, marginLeft: 6 }}>{K.csat?.n || 0} respuesta(s)</span>
                </div>
              </div>
              {T.reabiertos > 0 && (
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em' }}>Reabiertos</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 3, color: ROJO }}>{T.reabiertos}</div>
                </div>
              )}
            </div>

            {T.sin_ligar > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#f4f4f6', color: '#6B7280', borderRadius: 20, padding: '5px 12px' }}>{T.sin_ligar} sin ligar a cliente</span>
                <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 8, lineHeight: 1.55 }}>Conversaciones cuyo contacto no se pudo mapear a una cuenta SACS. El cron de backfill reintenta cada 30 min.</div>
              </div>
            )}
          </Tarjeta>

          {/* Intercom puede no mandar el admin asignado. Enseñar una tabla de una
              sola fila que dice "Sin asignar 161" simula un dato que no existe. */}
          {T.con_asignado > 0 ? (
            <Tarjeta titulo="Carga por agente" cap="Quién trae los pendientes encima.">
              <div className="crm-scroll-x"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Agente', 'Abiertos', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{(d.por_agente || []).map((a: any) => (
                  <tr key={a.agente}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{a.agente}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: a.abiertos ? TINTA : '#c9c7d0' }}>{a.abiertos}</td>
                    <td style={S.td}>{a.total}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Tarjeta>
          ) : (
            <Tarjeta titulo="Carga por agente">
              <div style={{ fontSize: '0.78rem', color: '#a5a2af', lineHeight: 1.6 }}>
                Ninguno de los <b>{T.total}</b> tickets trae agente asignado: Intercom no está mandando el <code>assignee</code> en el webhook, o nadie se asigna las conversaciones allá.
                Mientras eso no cambie, esta tarjeta no puede decir nada — y una tabla que solo dice "Sin asignar" aparenta un dato que no existe.
              </div>
            </Tarjeta>
          )}
        </div>
      </div>

      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={() => setRecarga(r => r + 1)} />}
    </div>
  );
}
