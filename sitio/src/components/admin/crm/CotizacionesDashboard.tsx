// Dashboard de cotizaciones.
//
// Cinco bloques y cuatro KPIs, ni uno más: la versión anterior tenía nueve
// widgets y era ilegible. Lo que se quitó (embudo, cobranza, ranking de
// cuentas) no se borró — vive en OCULTOS y se agrega desde el botón.
//
// Gama: morado sólido = cobrado, morado claro = en proceso, azul = cotizado y
// todavía en juego, gris = fuera. El color dice en qué punto está el dinero.
import { useEffect, useState } from 'react';
import Cargando, { Corazones } from './ui/Cargando';

// ─── Gama ───
// Morado #9B8CFA y azul cielo #7DA6F5 son los protagonistas y visten todo lo
// estructural. Verde y rojo están reservados al dinero: verde un monto que ya
// se pagó, rojo lo vencido. Por eso "por qué se pierden" va en azul — perder
// por precio no es una urgencia de hoy.
// Verde y rojo en pastel: el relleno se suaviza y la cifra conserva su tinta.
const P = '#4FBF95';         // verde pastel — barras y franjas del cobrado
const P_TINTA = '#1E8A63';   // el mismo, legible — para las CANTIDADES
const P_MEDIO = '#9B8CFA';   // morado — estructura, aceptada
const P_SUAVE = '#B6ABFC';   // morado claro
const LILA = '#7DA6F5';      // azul cielo — cotizado, en juego
const LILA_AGUA = '#DDE8FC'; // azul aguado — relleno de barras
const NOCHE = '#C0554E';     // rojo pastel en tinta — vencido (va sobre texto)
const TINTA = '#5B4BD6';     // morado oscuro — texto y énfasis
const GRIS = '#E5E3EA';

const money = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// El acomodo se guarda en el navegador, no en la base: es preferencia de quien
// mira, no dato del CRM. Cada quien tiene el suyo sin migración ni tabla nueva.
const LS_ORDEN = 'crm_dash_cot_orden_v1';
const ORDEN_BASE = ['fuga', 'mensual', 'origenes', 'concentracion', 'aperturas', 'cuando', 'clientes', 'calientes', 'comprometido', 'proximos', 'perdidas'];

/** Arcos de una dona en SVG. Sin librería: son tres o cuatro rebanadas y una
 *  dependencia nueva pesa más que estas doce líneas. */
function arcos(vals: number[], colores: string[], r = 44, w = 18, cx = 58, cy = 58) {
  const tot = vals.reduce((a, b) => a + b, 0) || 1;
  let ang = -Math.PI / 2;
  return vals.map((v, i) => {
    const a2 = ang + (v / tot) * Math.PI * 2;
    const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = (a2 - ang) > Math.PI ? 1 : 0;
    ang = a2;
    return <path key={i} d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
      stroke={colores[i]} strokeWidth={w} fill="none" />;
  });
}

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
  // Un número sin poder abrirlo obliga a confiar en él. Al tocar Cotizado o
  // Cobrado se ve de qué cotizaciones salió.
  const [detalle, setDetalle] = useState<{ titulo: string; filas: any[] } | null>(null);

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
    return <span style={{ color: bueno ? P_TINTA : TINTA, fontWeight: 800 }}>{dif > 0 ? '↑' : '↓'} {Math.abs(dif)}{pts ? ' pts' : '%'}</span>;
  };

  const Kpi = ({ t, v, hijo, barra, abrir }: any) => (
    <div onClick={abrir} title={abrir ? 'Ver de qué cotizaciones sale' : undefined}
      style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${barra || P_MEDIO}`, borderRadius: 12, padding: '16px 18px', cursor: abrir ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{v}</div>
      <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6' }}>{hijo}</div>
      {abrir && <div style={{ fontSize: '0.63rem', color: '#b9b5c4', marginTop: 6, fontWeight: 700 }}>Ver desglose</div>}
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
    // ── Dónde se queda el dinero ──
    // Cascada: del cotizado del mes bajan las fugas con nombre y monto hasta lo
    // cobrado. Es la única vista que contesta "¿dónde se me está quedando?".
    fuga: () => {
      const f = d.fuga || {};
      const cot = f.cotizado || 0;
      // ── De arriba abajo y de mayor a menor ──
      // La cascada obligaba a leer en zigzag y a sumar de cabeza. Esto se lee
      // como una lista: arriba el total, luego las fugas ordenadas por tamaño
      // —cada una con su tajada del cotizado— y al final lo que entró.
      const fugas = [
        { l: 'Aceptado y sin pagar', v: f.aceptado_sin_pagar || 0, c: '#E8A838', pie: 'Ya dijeron que sí. Es cobranza, no venta.' },
        { l: 'Enviado sin respuesta', v: f.sin_respuesta || 0, c: '#EF7A72', pie: 'La abrieron y no contestaron.' },
        { l: 'Nunca la abrieron', v: f.sin_abrir || 0, c: '#EF7A72', pie: 'No llegó o no la vieron.' },
      ].sort((a, b) => b.v - a.v);
      const pct = (v: number) => (cot > 0 ? Math.round((v / cot) * 100) : 0);
      const Fila = ({ l, v, c, pie, fuerte }: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid #f4f3f7' }}>
          <div style={{ width: 168, flexShrink: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: fuerte ? 800 : 600 }}>{l}</div>
            {pie && <div style={{ fontSize: '0.66rem', color: '#a5a2af', lineHeight: 1.35, marginTop: 1 }}>{pie}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 60, height: 16, background: '#f5f4f8', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(v > 0 ? 2 : 0, pct(v))}%`, background: c, borderRadius: 8 }} />
          </div>
          <div style={{ width: 46, textAlign: 'right', fontSize: '0.72rem', color: '#a5a2af' }}>{pct(v)}%</div>
          <div style={{ width: 96, textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: fuerte ? '#1a1a1a' : '#3f3b4d' }}>{money(v)}</div>
        </div>
      );
      return (
        <W id="fuga" titulo="Dónde se queda el dinero" cap="De lo cotizado este mes: cuánto se quedó en el camino y cuánto entró. De mayor a menor.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 9 }}>
            <div style={{ width: 168, flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.07em' }}>Cotizado del mes</div>
            <div style={{ flex: 1, minWidth: 60, height: 16, background: P_MEDIO, borderRadius: 8 }} />
            <div style={{ width: 46, textAlign: 'right', fontSize: '0.72rem', color: '#a5a2af' }}>100%</div>
            <div style={{ width: 96, textAlign: 'right', fontSize: '0.95rem', fontWeight: 800 }}>{money(cot)}</div>
          </div>
          {fugas.map(x => <Fila key={x.l} {...x} />)}
          <div style={{ borderTop: '2px solid #edecf2', marginTop: 4 }}>
            <Fila l="Entró de verdad" v={f.cobrado || 0} c={P} fuerte pie="Pagos recibidos este mes." />
          </div>
          <Nota>
            {(f.aceptado_sin_pagar || 0) > 0
              ? <>La fuga más grande es lo <b>aceptado y sin pagar</b>: {money(f.aceptado_sin_pagar)}, el {pct(f.aceptado_sin_pagar)}% de lo cotizado. Eso no se arregla vendiendo más, se arregla cobrando.</>
              : <>Este mes no quedó nada aceptado sin cobrar.</>}
          </Nota>
        </W>
      );
    },

    // ── De cuántos clientes depende ──
    concentracion: () => {
      const c = d.concentracion || { top: [], resto: 0 };
      const vals = [...(c.top || []).map((x: any) => x.monto), c.resto || 0].filter((v: number) => v > 0);
      const cols = [P_MEDIO, '#7C6BF0', LILA, P, '#eceaf4'].slice(0, vals.length);
      const alerta = (c.top || [])[0]?.pct >= 30 ? c.top[0] : null;
      return (
        <W id="concentracion" titulo="De cuántos clientes depende el periodo" cap="Los cuatro más grandes contra todos los demás juntos.">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
              <svg width="116" height="116">{arcos(vals, cols)}</svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <b style={{ fontSize: '0.95rem' }}>{c.pct_top || 0}%</b>
                <span style={{ fontSize: '0.55rem', color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em' }}>en {(c.top || []).length}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {(c.top || []).map((x: any, i: number) => (
                <div key={x.cliente} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: '0.77rem', borderTop: i ? '1px solid #f6f5f9' : 'none' }}>
                  <i style={{ width: 9, height: 9, borderRadius: 3, background: cols[i], display: 'block' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.cliente}</span>
                  <span style={{ color: '#a5a2af' }}>{x.pct}%</span>
                  <b>{money(x.monto)}</b>
                </div>
              ))}
              {c.resto > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: '0.77rem', borderTop: '1px solid #f6f5f9' }}>
                  <i style={{ width: 9, height: 9, borderRadius: 3, background: '#eceaf4', display: 'block' }} />
                  <span style={{ flex: 1 }}>Otros {c.resto_n}</span><b>{money(c.resto)}</b>
                </div>
              )}
            </div>
          </div>
          {alerta && (
            <div style={{ background: '#FEF6E7', border: '1px solid #f5e2b8', borderRadius: 9, padding: '9px 11px', fontSize: '0.73rem', color: '#9a6a10', lineHeight: 1.55, marginTop: 12 }}>
              <b>{alerta.cliente} es el {alerta.pct}% de lo cotizado del periodo.</b> Si esa sola cotización no cierra, el periodo se cae en esa proporción. Eso es riesgo, no logro.
            </div>
          )}
        </W>
      );
    },

    // ── Cuándo leen ──
    cuando: () => {
      const h = d.heat || [];
      const mx = Math.max(1, ...h.flat());
      const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const horas = [8, 10, 12, 14, 16, 18, 20];
      const total = h.flat().reduce((a: number, b: number) => a + b, 0);
      return (
        <W id="cuando" titulo="Cuándo leen tus cotizaciones" cap="Cada apertura registrada, por día y hora de México. Ahí conviene mandar y llamar.">
          {total === 0
            ? <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>Todavía no hay aperturas registradas en este periodo.</div>
            : (<>
              <div style={{ display: 'flex', gap: 4, marginLeft: 34, marginBottom: 3 }}>
                {horas.map(x => <div key={x} style={{ flex: 1, fontSize: '0.6rem', color: '#a5a2af', textAlign: 'center' }}>{x}h</div>)}
              </div>
              {dias.map((dd, r) => (
                <div key={dd} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ width: 30, fontSize: '0.63rem', color: '#8a8590' }}>{dd}</div>
                  {horas.map((hh, c) => {
                    const v = (h[r]?.[hh] || 0) + (h[r]?.[hh + 1] || 0);
                    return <div key={c} title={`${dd} ${hh}-${hh + 2}h · ${v} aperturas`}
                      style={{ flex: 1, height: 20, borderRadius: 4, background: `rgba(155,140,250,${(0.08 + (v / mx) * 0.85).toFixed(2)})` }} />;
                  })}
                </div>
              ))}
              <Nota>{total} aperturas registradas. El bloque más oscuro es la hora en que más te leen: mandar ahí sube la probabilidad de que la abran el mismo día.</Nota>
            </>)}
        </W>
      );
    },

    // ── Quién cotiza y quién paga ──
    clientes: () => (
      <W id="clientes" titulo="Quién cotiza y quién paga" cap="Cotizar mucho no es pagar mucho. Las dos columnas juntas lo dicen.">
        {/* M2 · móvil: la tabla de 6 columnas scrolleaba de lado (1,040 px).
            Fila v5 de 3 datos: cliente · cotizado→cobrado · % de avance. */}
        <div className="cotz-lista-movil" style={{ display: 'none' }}>
          {(d.clientes || []).map((c: any, i: number) => {
            const pct = c.cotizado > 0 ? Math.min(100, Math.round((c.cobrado / c.cotizado) * 100)) : (c.cobrado > 0 ? 100 : 0);
            return (
              <div key={'m' + c.cliente + i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #f7f6fa', minHeight: 52 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* El nombre del cliente identifica la cotización: si no cabe,
                      envuelve en vez de cortarse ("Tetetlan | Concept Store /…"). */}
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', overflowWrap: 'anywhere', lineHeight: 1.3 }}>{c.cliente}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8f8d98', marginTop: 2 }}>cotizado {money(c.cotizado)}</div>
                </div>
                <div style={{ flex: 'none', textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', color: c.cobrado > 0 ? P_TINTA : '#c9c7d0' }}>{money(c.cobrado)}</div>
                  <div style={{ fontSize: '0.78rem', color: pct >= 100 ? P_TINTA : '#8f8d98', marginTop: 1 }}>{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
        <style>{`@media (max-width:899px){ .cotz-lista-movil{display:block !important} .cotz-tabla-desk{display:none !important} }`}</style>
        <div className="cotz-tabla-desk" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead><tr>
              {['Cliente', 'Origen', 'Cotizado', 'Cobrado', 'Avance', 'Días a cobro'].map((h, i) => (
                <th key={h} style={{ fontSize: '0.55rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: i >= 2 && i <= 3 ? 'right' : 'left', padding: '6px 6px', borderBottom: '1px solid #f0eff3' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(d.clientes || []).map((c: any, i: number) => {
                const pct = c.cotizado > 0 ? Math.min(100, Math.round((c.cobrado / c.cotizado) * 100)) : (c.cobrado > 0 ? 100 : 0);
                return (
                  <tr key={c.cliente + i}>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa', fontWeight: 700 }}>{c.cliente}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa' }}>
                      <span style={{ fontSize: '0.56rem', fontWeight: 800, borderRadius: 20, padding: '2px 7px', background: c.origen === 'lead' ? '#E3EDFD' : '#EEECFE', color: c.origen === 'lead' ? '#2C5FC4' : TINTA }}>{c.origen}</span>
                    </td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa', textAlign: 'right', fontWeight: 700 }}>{money(c.cotizado)}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa', textAlign: 'right', color: c.cobrado > 0 ? P_TINTA : '#c9c7d0' }}>{money(c.cobrado)}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa', width: 110 }}>
                      <div style={{ height: 6, borderRadius: 99, background: '#f3f2f7' }}>
                        <div style={{ height: '100%', width: Math.max(3, pct) + '%', borderRadius: 99, background: pct >= 100 ? P : pct > 0 ? '#E8A838' : '#EF7A72' }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f7f6fa', textAlign: 'right', color: '#8a8590' }}>{c.dias == null ? '—' : `${c.dias} d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </W>
    ),

    // ── Lo comprometido ──
    comprometido: () => (
      <W id="comprometido" titulo="Lo que ya está comprometido" cap="Parcialidades con fecha pactada, por mes. Es la caja que se puede prometer.">
        {(d.comprometido || []).length === 0
          ? <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>No hay parcialidades con fecha por delante.</div>
          : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(d.comprometido || []).map((m: any) => (
                <div key={m.mes} style={{ flex: '1 1 120px', border: '1px solid #f0eff3', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em' }}>{nombreMes(m.mes + '-01')}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 2 }}>{money(m.monto)}</div>
                  <div style={{ fontSize: '0.66rem', color: '#8a8590' }}>{m.n} exhibici{m.n === 1 ? 'ón' : 'ones'}</div>
                </div>
              ))}
            </div>
          )}
      </W>
    ),

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
                    {r.total > 0 && <><div style={{ height: cerr, background: P_MEDIO }} /><div style={{ height: alto - cerr, background: LILA_AGUA }} /></>}
                  </div>
                  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#7d7a88' }}>{r.rango}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: P_MEDIO }} />Terminó en venta</span>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: LILA_AGUA }} />No cerró</span>
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
                  <div title={`Cotizado ${money(m.cotizado)}`} style={{ width: 20, height: Math.round((m.cotizado / max) * 108), minHeight: m.cotizado ? 2 : 0, background: LILA_AGUA, borderRadius: '3px 3px 0 0' }} />
                  <div title={`Cobrado ${money(m.cobrado)}`} style={{ width: 20, height: Math.round((m.cobrado / max) * 108), minHeight: m.cobrado ? 2 : 0, background: P, borderRadius: '3px 3px 0 0' }} />
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: m.mes === d.mes ? P : '#a5a2af' }}>{MESES[Number(m.mes.slice(5, 7)) - 1].toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: '#a5a2af', marginTop: 12 }}>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: LILA_AGUA }} />Cotizado</span>
            <span><i style={{ width: 9, height: 9, borderRadius: 2, display: 'inline-block', marginRight: 6, background: P }} />Cobrado</span>
          </div>
        </W>
      );
    },

    origenes: () => {
      const o = d.origenes;
      // Todo el bloque habla del MISMO periodo: la dona, las dos columnas y sus
      // renglones. Mezclar "cotizado de siempre" con "cobrado de este mes" era
      // lo que hacía que los números no cuadraran al mirarlos juntos; el
      // histórico se queda como una línea de contexto al final de cada columna.
      const cli = o.cliente.cobrado_periodo || 0, lea = o.lead.cobrado_periodo || 0;
      const tot = cli + lea;
      const pc = (n: number) => (tot > 0 ? Math.round((n / tot) * 100) : 0);
      const Col = ({ t, x, color }: any) => (
        <div style={{ flex: 1, minWidth: 170 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9c99a6' }}>{t}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4, color }}>{money(x.cobrado_periodo || 0)}</div>
          <div style={{ fontSize: '0.66rem', color: '#a5a2af', marginBottom: 8 }}>cobrado en el periodo</div>
          {[['Cotizado', money(x.periodo?.cotizado || 0)],
            ['Cotizaciones', String(x.periodo?.n || 0)],
            ['Ticket', money(x.periodo?.ticket || 0)],
            ['Cierre', x.periodo?.cierre == null ? '—' : `${x.periodo.cierre}%`]].map(([k, v]: any) => (
            <div key={k} style={{ fontSize: '0.73rem', color: '#7d7a88', padding: '5px 0', display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #f6f5f9' }}>
              <span>{k}</span><b style={{ color: '#1a1a1a' }}>{v}</b>
            </div>
          ))}
          <div style={{ fontSize: '0.68rem', color: '#b3b1bb', marginTop: 7 }}>
            Histórico: {money(x.cotizado)} en {x.n} cotizaciones
          </div>
        </div>
      );
      return (
        <W id="origenes" titulo="De dónde salió el dinero" cap="Todo el bloque mira el mismo periodo, y sobre lo COBRADO: cotizar no es cobrar.">
          {tot === 0
            ? <div style={{ fontSize: '0.78rem', color: '#a5a2af' }}>En este periodo no ha entrado dinero de cotizaciones.</div>
            : (
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
                  <svg width="116" height="116">{arcos([cli, lea].filter(v => v > 0), cli > 0 && lea > 0 ? [P_MEDIO, LILA] : [cli > 0 ? P_MEDIO : LILA])}</svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <b style={{ fontSize: '0.9rem' }}>{money(tot)}</b>
                    <span style={{ fontSize: '0.53rem', color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.07em' }}>cobrado</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 190 }}>
                  {[['Clientes', cli, P_MEDIO], ['Leads', lea, LILA]].map(([t, v, c]: any, i: number) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: '0.78rem', borderTop: i ? '1px solid #f6f5f9' : 'none' }}>
                      <i style={{ width: 9, height: 9, borderRadius: 3, background: c, display: 'block' }} />
                      <span style={{ flex: 1 }}>{t}</span>
                      <span style={{ color: '#a5a2af', width: 42, textAlign: 'right' }}>{pc(v)}%</span>
                      <b style={{ width: 92, textAlign: 'right' }}>{money(v)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid #f4f3f7' }}>
            <Col t="De clientes" x={o.cliente} color={P_TINTA} />
            <Col t="De leads" x={o.lead} color={P_TINTA} />
          </div>
          {(d.sin_ligar?.n || 0) > 0 && (
            <Nota>{d.sin_ligar.n} cotizaciones no tienen cliente ni lead ligado ({money(d.sin_ligar.monto)}) y quedan fuera de este bloque: sin dueño no se puede decir de dónde vino el dinero. Ligarlas desde la lista las trae de vuelta.</Nota>
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
                <span style={{ flex: '0 0 58px', fontWeight: 800, fontSize: '0.73rem', color: p.vencida ? NOCHE : dias <= 7 ? TINTA : '#b3afbd' }}>
                  {Number(p.fecha.slice(8, 10))} {MESES[Number(p.fecha.slice(5, 7)) - 1].toUpperCase()}
                  <small style={{ display: 'block', fontWeight: 600, color: p.vencida ? NOCHE : '#b3afbd', fontSize: '0.63rem', marginTop: 1 }}>
                    {p.vencida ? `venció hace ${Math.abs(dias)} d` : dias === 0 ? 'hoy' : `en ${dias} días`}
                  </small>
                </span>
                <span style={{ flex: 1 }}>{p.empresa}<br />
                  <small style={{ color: '#a5a2af', fontSize: '0.69rem' }}>{p.numero} · pago {p.indice} de {p.de}</small></span>
                <b>{money(p.monto)}</b>
              </div>
            );
          })}
        <Nota>
          Aquí solo entran las parcialidades de cotizaciones que <b>ya se están pagando o el cliente confirmó</b>
          ({d.proximos.con_plan} {d.proximos.con_plan === 1 ? 'cotización' : 'cotizaciones'}).
          {d.proximos.propuestas?.length > 0 && (
            <> Hay {d.proximos.propuestas.length} plan{d.proximos.propuestas.length === 1 ? '' : 'es'} más por {money(d.proximos.propuestas_monto)} en
            cotizaciones sin confirmar: son una <b>propuesta</b> de pago, no dinero comprometido, y su monto ya está contado en Cotizado.
            {' '}<span style={{ color: '#a5a2af' }}>({d.proximos.propuestas.map((p: any) => p.numero).join(' · ')})</span></>
          )}
        </Nota>
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
                {/* Reemplazada no es una pérdida real —el dinero se movió a otra
                    cotización—, así que se distingue del resto en rosa. */}
                <i style={{ display: 'block', height: '100%', width: `${Math.round((m.monto / max) * 100)}%`, background: /reempla/i.test(m.motivo) ? P_MEDIO : LILA, borderRadius: 4 }} />
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

  const Desglose = () => !detalle ? null : (
    <div onClick={() => setDetalle(null)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(16,24,40,.22)', width: 520, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 18px 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{detalle.titulo}</h3>
          <button onClick={() => setDetalle(null)} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {detalle.filas.length === 0
            ? <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Nada en este periodo.</div>
            : (<>
              {detalle.filas.map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid #f6f5f9', fontSize: '0.8rem' }}>
                  <span style={{ flex: '0 0 88px', fontWeight: 700, color: '#5B21B6', fontSize: '0.73rem' }}>{f.numero}</span>
                  <span style={{ flex: 1 }}>{f.empresa || '—'}
                    {f.sub && <small style={{ display: 'block', color: '#a5a2af', fontSize: '0.69rem' }}>{f.sub}{f.fecha ? ` · ${f.fecha}` : ''}</small>}
                  </span>
                  <b>{money(f.monto)}</b>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 11, fontSize: '0.85rem', fontWeight: 800 }}>
                <span>{detalle.filas.length} movimiento{detalle.filas.length === 1 ? '' : 's'}</span>
                <span>{money(detalle.filas.reduce((a: number, f: any) => a + Number(f.monto || 0), 0))}</span>
              </div>
            </>)}
        </div>
      </div>
    </div>
  );

  return (
    // Panel dentro del flujo de la página: el ancho lo pone el contenedor de
    // Cotizaciones, así que abrir o cerrar el menú lateral lo reacomoda solo.
    <div style={{ background: '#f7f8fe', border: '1px solid #eeeef7', borderRadius: 14, padding: '22px 24px 26px' }}>
      <Desglose />
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, letterSpacing: '-.015em' }}>Dashboard de cotizaciones</h1>
            <div style={{ fontSize: '0.74rem', color: '#9c99a6', marginTop: 3 }}>
              {d ? <>{nombreMes(d.mes)} · comparado contra {nombreMes(d.mes_anterior)}</> : 'Cargando…'}
            </div>
          </div>
          <button onClick={onCerrar} style={{ padding: '7px 13px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, border: `1px solid ${LILA}`, background: LILA, color: '#fff', cursor: 'pointer' }}>
            Volver a la lista
          </button>
        </div>

        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e8e6ee', borderRadius: 9, overflow: 'hidden' }}>
            {([['todos', 'Todas'], ['cliente', 'De clientes'], ['lead', 'De leads']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setSegmento(k)}
                style={{ padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRight: '1px solid #f3f2f7', cursor: 'pointer', background: segmento === k ? P_MEDIO : '#fff', color: segmento === k ? '#fff' : '#6b7280' }}>
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

        {cargando && !d && <Cargando texto="Armando el tablero…" alto={220} />}

        {d && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 14 }}>
              <Kpi barra={LILA} t="Cotizado" v={money(d.kpis.cotizado.valor)}
                abrir={() => setDetalle({ titulo: `Cotizado en ${nombreMes(d.mes)}`, filas: (d.kpis.cotizado.detalle || []).map((x: any) => ({ ...x, sub: x.estado })) })}
                hijo={<><Delta v={d.kpis.cotizado.valor} a={d.kpis.cotizado.anterior} /> · {nombreMes(d.mes_anterior)} {money(d.kpis.cotizado.anterior)}</>} />
              <Kpi barra={P} t={<span>Cobrado</span>} v={<span style={{ color: P_TINTA }}>{money(d.kpis.cobrado.valor)}</span>}
                abrir={() => setDetalle({ titulo: `Cobrado en ${nombreMes(d.mes)}`, filas: (d.kpis.cobrado.detalle || []).map((x: any) => ({ ...x, sub: [x.tipo, x.metodo, x.referencia].filter(Boolean).join(' · ') })) })}
                hijo={<><Delta v={d.kpis.cobrado.valor} a={d.kpis.cobrado.anterior} /> · {nombreMes(d.mes_anterior)} {money(d.kpis.cobrado.anterior)}</>} />
              <Kpi barra={P_MEDIO} t="Tasa de cierre" v={`${d.kpis.cierre.valor}%`}
                hijo={<><Delta v={d.kpis.cierre.valor} a={d.kpis.cierre.anterior} pts /> · sobre las ya resueltas</>} />
              <Kpi barra={P_SUAVE} t="Días a cobro" v={d.kpis.dias.valor == null ? '—' : `${d.kpis.dias.valor} d`}
                hijo={<><Delta v={d.kpis.dias.valor} a={d.kpis.dias.anterior} invertido /> · envío → pago</>} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 14, alignItems: 'start' }}>
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
