// Dashboard de cotizaciones.
//
// Cinco bloques y cuatro KPIs, ni uno más: la versión anterior tenía nueve
// widgets y era ilegible. Lo que se quitó (embudo, cobranza, ranking de
// cuentas) no se borró — vive en OCULTOS y se agrega desde el botón.
//
// Gama: morado sólido = cobrado, morado claro = en proceso, azul = cotizado y
// todavía en juego, gris = fuera. El color dice en qué punto está el dinero.
import { useEffect, useState } from 'react';

const P = '#7C3AED';        // morado — cerrado, cobrado
const P_SUAVE = '#b9a0f0';  // morado claro — en proceso
const AZUL = '#cfe0fa';     // azul — cotizado, en juego
const GRIS = '#dedbe6';

const money = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// El acomodo se guarda en el navegador, no en la base: es preferencia de quien
// mira, no dato del CRM. Cada quien tiene el suyo sin migración ni tabla nueva.
const LS_ORDEN = 'crm_dash_cot_orden_v1';
const ORDEN_BASE = ['aperturas', 'calientes', 'mensual', 'origenes', 'proximos', 'perdidas'];

export default function CotizacionesDashboard({ onCerrar }: { onCerrar: () => void }) {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);
  const [segmento, setSegmento] = useState('todos');
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [orden, setOrden] = useState<string[]>(() => {
    try {
      const g = JSON.parse(localStorage.getItem(LS_ORDEN) || 'null');
      // Si se agregó un bloque nuevo después de que el usuario guardó su orden,
      // se añade al final en vez de desaparecer.
      if (Array.isArray(g)) return [...g.filter((k: string) => ORDEN_BASE.includes(k)), ...ORDEN_BASE.filter(k => !g.includes(k))];
    } catch { /* preferencia corrupta: se usa el orden de fábrica */ }
    return ORDEN_BASE;
  });
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/revenue/quotes/dashboard?mes=${mes}&segmento=${segmento}`)
      .then(r => r.json()).then(j => { setD(j); setCargando(false); })
      .catch(() => setCargando(false));
  }, [mes, segmento]);

  const guardarOrden = (nuevo: string[]) => { setOrden(nuevo); try { localStorage.setItem(LS_ORDEN, JSON.stringify(nuevo)); } catch { /* sin localStorage: el orden dura la sesión */ } };
  const soltar = (destino: string) => {
    if (!arrastrando || arrastrando === destino) return;
    const sin = orden.filter(k => k !== arrastrando);
    const i = sin.indexOf(destino);
    guardarOrden([...sin.slice(0, i), arrastrando, ...sin.slice(i)]);
    setArrastrando(null);
  };

  const meses: string[] = [];
  for (let i = 0; i < 12; i++) {
    const x = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }

  const Delta = ({ v, a, pts, invertido }: { v: number | null; a: number | null; pts?: boolean; invertido?: boolean }) => {
    if (v == null || a == null || a === 0) return <span style={{ color: '#b3afbd' }}>sin comparativo</span>;
    const dif = pts ? v - a : Math.round(((v - a) / Math.abs(a)) * 100);
    if (dif === 0) return <span style={{ color: '#9c99a6' }}>igual que {nombreMes(d.mes_anterior)}</span>;
    // "Días a cobro" mejora cuando BAJA: el color no puede leer solo el signo.
    const bueno = invertido ? dif < 0 : dif > 0;
    return <span style={{ color: bueno ? P : '#8a5cc4', fontWeight: 800 }}>{dif > 0 ? '↑' : '↓'} {Math.abs(dif)}{pts ? ' pts' : '%'}</span>;
  };

  const Kpi = ({ t, v, hijo, azul }: any) => (
    <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${azul ? '#7EA6F0' : '#8B5CF6'}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{v}</div>
      <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6' }}>{hijo}</div>
    </div>
  );

  const W = ({ id, titulo, cap, children }: any) => (
    <div draggable onDragStart={() => setArrastrando(id)} onDragOver={e => e.preventDefault()} onDrop={() => soltar(id)}
      style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '18px 20px 20px', marginBottom: 14, opacity: arrastrando === id ? 0.45 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 3 }}>
        <span style={{ color: '#dedbe6', cursor: 'grab', letterSpacing: -2, fontSize: '0.8rem' }}>⣿</span>
        <h3 style={{ fontSize: '0.83rem', margin: 0, fontWeight: 800, flex: 1 }}>{titulo}</h3>
      </div>
      {cap && <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginBottom: 16 }}>{cap}</div>}
      {children}
    </div>
  );
  const Nota = ({ children }: any) => (
    <div style={{ fontSize: '0.72rem', color: '#7d7a88', marginTop: 14, lineHeight: 1.55, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>{children}</div>
  );

  const bloques: Record<string, () => any> = {
    aperturas: () => {
      const a = d.aperturas;
      const alto = 84;
      return (
        <W id="aperturas" titulo="Cuántas veces la abren antes de comprar" cap="Cada barra es el 100% de las cotizaciones de ese rango.">
          <div style={{ display: 'flex', gap: 26, marginBottom: 18 }}>
            {[['Las que se pagan', a.pagadas, P], ['Las que se pierden', a.perdidas, '#a5a2af'], ['Tu umbral', `${a.umbral} aperturas`, '#1a1a1a']].map(([t, v, c]: any) => (
              <div key={t}>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9c99a6', marginBottom: 3 }}>{t}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 108 }}>
            {a.rangos.map((r: any) => {
              const cerr = r.total ? Math.round((r.cerradas / r.total) * alto) : 0;
              return (
                <div key={r.rango} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div title={`${r.total} cotizaciones · ${r.cerradas} cerraron`}
                    style={{ width: '100%', maxWidth: 52, height: alto, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '5px 5px 0 0', overflow: 'hidden', background: '#f5f4f8' }}>
                    {r.total > 0 && <><div style={{ height: cerr, background: P }} /><div style={{ height: alto - cerr, background: AZUL }} /></>}
                  </div>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#7d7a88' }}>{r.rango}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: P }} />Terminó en venta</span>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: AZUL }} />No cerró</span>
          </div>
          <Nota>
            <b>Debajo de {a.umbral} aperturas casi nadie compra.</b> Pasando ese punto se empareja y de ahí sube. Ese es el momento de llamar.
            {a.cerradas_sin_abrir > 0 && <> · <span style={{ color: '#8a6212' }}>Las {a.cerradas_sin_abrir} ventas con 0 aperturas se cerraron fuera del sistema y se marcaron a mano: no es gente que compró sin leer.</span></>}
          </Nota>
        </W>
      );
    },

    calientes: () => (
      <W id="calientes" titulo="Ya cruzaron el umbral y siguen vivas" cap="Están leyendo. Hoy es el día.">
        {d.aperturas.calientes.length === 0
          ? <div style={{ fontSize: '0.77rem', color: '#a5a2af' }}>Ninguna cotización viva pasa de {d.aperturas.umbral} aperturas ahora mismo.</div>
          : d.aperturas.calientes.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.79rem', padding: '9px 0', borderBottom: '1px solid #f6f5f9' }}>
              <span>{c.empresa || c.numero}</span>
              <span><b style={{ color: P, fontSize: '0.73rem' }}>{c.vistas} aperturas</b> &nbsp; {money(c.total)}</span>
            </div>
          ))}
      </W>
    ),

    mensual: () => {
      const max = Math.max(1, ...d.mensual.map((m: any) => Math.max(m.cotizado, m.cobrado)));
      return (
        <W id="mensual" titulo="Cotizado contra cobrado, mes a mes" cap="La distancia entre las dos barras es lo que se quedó en el camino.">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, height: 132 }}>
            {d.mensual.map((m: any) => (
              <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 108 }}>
                  <div title={`Cotizado ${money(m.cotizado)}`} style={{ width: 20, height: Math.round((m.cotizado / max) * 108), minHeight: m.cotizado ? 2 : 0, background: AZUL, borderRadius: '3px 3px 0 0' }} />
                  <div title={`Cobrado ${money(m.cobrado)}`} style={{ width: 20, height: Math.round((m.cobrado / max) * 108), minHeight: m.cobrado ? 2 : 0, background: P, borderRadius: '3px 3px 0 0' }} />
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: m.mes === d.mes ? P : '#a5a2af' }}>{MESES[Number(m.mes.slice(5, 7)) - 1].toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: AZUL }} />Cotizado</span>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: P }} />Cobrado</span>
          </div>
        </W>
      );
    },

    origenes: () => {
      const o = d.origenes;
      const tot = Math.max(1, o.cliente.cotizado + o.lead.cotizado + o.excliente.cotizado + o.sin_ligar.cotizado);
      const pc = (n: number) => Math.round((n / tot) * 100);
      const Col = ({ t, x, color }: any) => (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9c99a6' }}>{t}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4 }}>{money(x.cotizado)}</div>
          {[['Cobrado', money(x.cobrado), color], ['Cierre', `${x.cierre}%`, null], ['Ticket', money(x.ticket), null]].map(([k, v, c]: any) => (
            <div key={k} style={{ fontSize: '0.72rem', color: '#7d7a88', marginTop: 7, display: 'flex', justifyContent: 'space-between' }}>
              <span>{k}</span><b style={{ color: c || '#1a1a1a' }}>{v}</b>
            </div>
          ))}
        </div>
      );
      return (
        <W id="origenes" titulo="Clientes contra leads" cap="De dónde sale el dinero: de tu base o de gente nueva.">
          <div style={{ display: 'flex', height: 38, borderRadius: 9, overflow: 'hidden', marginBottom: 16 }}>
            {([['Clientes', o.cliente.cotizado, P, '#fff'], ['Leads', o.lead.cotizado, P_SUAVE, '#fff'],
               ['Exclientes', o.excliente.cotizado, '#a9b8d8', '#fff'], ['Sin ligar', o.sin_ligar.cotizado, GRIS, '#5a5766']] as const)
              .filter(([, v]) => v > 0)
              .map(([t, v, bg, fg]) => (
                <div key={t} style={{ width: `${pc(v as number)}%`, background: bg as string, color: fg as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.71rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {pc(v as number) >= 12 ? `${t} · ${pc(v as number)}%` : ''}
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <Col t="De clientes" x={o.cliente} color={P} />
            <Col t="De leads" x={o.lead} color={P_SUAVE} />
          </div>
          {o.sin_ligar.n > 0 && (
            <Nota><b>{o.sin_ligar.n} cotizaciones no tienen cliente ligado.</b> La franja gris es lo que este bloque todavía no puede explicar: {money(o.sin_ligar.cotizado)}.</Nota>
          )}
          {(o.cliente.estimados + o.lead.estimados) > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginTop: 8 }}>
              {o.cliente.estimados + o.lead.estimados} son anteriores a que se guardara el origen: se deducen del estado que tiene el cliente hoy, no del que tenía al cotizar.
            </div>
          )}
        </W>
      );
    },

    proximos: () => (
      <W id="proximos" titulo="Lo próximo en cobrar" cap="Parcialidades pactadas dentro de las cotizaciones.">
        <div style={{ display: 'flex', gap: 26, marginBottom: 14 }}>
          {[['Este mes', money(d.proximos.este_mes), '#1a1a1a'], ['Comprometido', money(d.proximos.comprometido), P]].map(([t, v, c]: any) => (
            <div key={t}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9c99a6', marginBottom: 3 }}>{t}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em', color: c }}>{v}</div>
            </div>
          ))}
        </div>
        {d.proximos.filas.length === 0
          ? <div style={{ fontSize: '0.77rem', color: '#a5a2af' }}>No hay parcialidades pendientes.</div>
          : d.proximos.filas.map((p: any, i: number) => {
            const dias = Math.round((new Date(p.fecha + 'T00:00:00').getTime() - Date.now()) / 86400000);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid #f6f5f9', fontSize: '0.79rem' }}>
                <span style={{ flex: '0 0 58px', fontWeight: 800, fontSize: '0.73rem', color: p.vencida ? '#b4302f' : dias <= 7 ? '#5B21B6' : '#b3afbd' }}>
                  {Number(p.fecha.slice(8, 10))} {MESES[Number(p.fecha.slice(5, 7)) - 1].toUpperCase()}
                  <small style={{ display: 'block', fontWeight: 600, color: p.vencida ? '#b4302f' : '#b3afbd', fontSize: '0.63rem', marginTop: 1 }}>
                    {p.vencida ? `venció hace ${Math.abs(dias)} d` : dias === 0 ? 'hoy' : `en ${dias} días`}
                  </small>
                </span>
                <span style={{ flex: 1 }}>{p.empresa}<br />
                  <small style={{ color: '#a5a2af', fontSize: '0.69rem' }}>{p.numero} · pago {p.indice} de {p.de}</small></span>
                <b>{money(p.monto)}</b>
              </div>
            );
          })}
        <Nota>Solo {d.proximos.con_plan} cotización{d.proximos.con_plan === 1 ? '' : 'es'} tiene{d.proximos.con_plan === 1 ? '' : 'n'} plan de parcialidades cargado. Si alguna se pactó en pagos y no se capturó, aquí no aparece.</Nota>
      </W>
    ),

    perdidas: () => {
      const max = Math.max(1, ...d.perdidas.motivos.map((m: any) => m.monto));
      return (
        <W id="perdidas" titulo="Por qué se pierden" cap={`${d.perdidas.n} cotizaciones · ${money(d.perdidas.total)} que no entraron.`}>
          {d.perdidas.motivos.map((m: any) => (
            <div key={m.motivo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', fontSize: '0.78rem' }}>
              <span style={{ flex: '0 0 170px', color: '#4a4753' }}>{m.motivo}</span>
              <span style={{ flex: 1, height: 7, background: '#f5f4f8', borderRadius: 4, overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${Math.round((m.monto / max) * 100)}%`, background: P_SUAVE, borderRadius: 4 }} />
              </span>
              <span style={{ width: 88, textAlign: 'right', fontWeight: 700, color: '#7d7a88' }}>{money(m.monto)}</span>
            </div>
          ))}
          {d.perdidas.n > 0 && (
            <Nota><b>{Math.round((d.perdidas.silencio_n / d.perdidas.n) * 100)}% de las pérdidas son silencio, no un “no”.</b> {money(d.perdidas.silencio_monto)} se murieron sin que nadie dijera que no le interesaba.</Nota>
          )}
        </W>
      );
    },
  };

  const izq = orden.filter((_, i) => i % 2 === 0);
  const der = orden.filter((_, i) => i % 2 === 1);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fafafc', zIndex: 60, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '26px 30px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, letterSpacing: '-.015em' }}>Dashboard de cotizaciones</h1>
            <div style={{ fontSize: '0.74rem', color: '#9c99a6', marginTop: 3 }}>
              {d ? <>{nombreMes(d.mes)} · comparado contra {nombreMes(d.mes_anterior)}</> : 'Cargando…'}
            </div>
          </div>
          <button onClick={onCerrar} style={{ padding: '7px 13px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, border: '1px solid #3B2A6B', background: '#3B2A6B', color: '#fff', cursor: 'pointer' }}>
            Volver a la lista
          </button>
        </div>

        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e8e6ee', borderRadius: 9, overflow: 'hidden' }}>
            {([['todos', 'Todas'], ['cliente', 'De clientes'], ['lead', 'De leads'], ['sin_ligar', 'Sin ligar']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setSegmento(k)}
                style={{ padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRight: '1px solid #f3f2f7', cursor: 'pointer', background: segmento === k ? P : '#fff', color: segmento === k ? '#fff' : '#6b7280' }}>
                {t} <span style={{ opacity: 0.5, marginLeft: 4 }}>{d?.conteos?.[k] ?? ''}</span>
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <select value={mes} onChange={e => setMes(e.target.value)}
            style={{ background: '#fff', border: '1px solid #cdbdf7', color: '#6d4bc7', borderRadius: 8, padding: '7px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
        </div>

        {cargando && !d && <div style={{ color: '#9c99a6', fontSize: '0.85rem', padding: 40, textAlign: 'center' }}>Cargando…</div>}

        {d && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
              <Kpi azul t="Cotizado" v={money(d.kpis.cotizado.valor)}
                hijo={<><Delta v={d.kpis.cotizado.valor} a={d.kpis.cotizado.anterior} /> · {nombreMes(d.mes_anterior)} {money(d.kpis.cotizado.anterior)}</>} />
              <Kpi t={<span>Cobrado</span>} v={<span style={{ color: P }}>{money(d.kpis.cobrado.valor)}</span>}
                hijo={<><Delta v={d.kpis.cobrado.valor} a={d.kpis.cobrado.anterior} /> · {nombreMes(d.mes_anterior)} {money(d.kpis.cobrado.anterior)}</>} />
              <Kpi t="Tasa de cierre" v={`${d.kpis.cierre.valor}%`}
                hijo={<><Delta v={d.kpis.cierre.valor} a={d.kpis.cierre.anterior} pts /> · sobre las ya resueltas</>} />
              <Kpi azul t="Días a cobro" v={d.kpis.dias.valor == null ? '—' : `${d.kpis.dias.valor} d`}
                hijo={<><Delta v={d.kpis.dias.valor} a={d.kpis.dias.anterior} invertido /> · envío → pago</>} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              <div>{izq.map(k => <div key={k}>{bloques[k]?.()}</div>)}</div>
              <div>{der.map(k => <div key={k}>{bloques[k]?.()}</div>)}</div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.71rem', color: '#b3afbd' }}>
              Arrastra cualquier bloque por su agarradera para reacomodarlo. El orden se guarda en este navegador.
              {orden.join() !== ORDEN_BASE.join() && (
                <> · <button onClick={() => guardarOrden(ORDEN_BASE)} style={{ border: 'none', background: 'none', color: '#6d4bc7', cursor: 'pointer', fontSize: '0.71rem', fontWeight: 700, padding: 0 }}>Volver al orden original</button></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
