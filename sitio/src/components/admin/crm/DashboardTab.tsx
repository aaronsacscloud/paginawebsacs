// Tablero del CRM.
//
// Cada número trae una línea que dice QUÉ es y qué hacer con él, con el dato
// propio adentro: no "el NRR mide expansión neta", sino "de cada $100 que te
// pagaban, hoy te pagan $104". Un tablero que hay que saber leer no lo lee
// nadie.
//
// Lo que no se puede calcular se dice. El CAC necesita gasto de marketing y el
// LTV varios meses de bajas: un número inventado en una pantalla que puede ver
// un inversionista es peor que un hueco.
import { useEffect, useMemo, useState } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const corto = (n?: number | null) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 1000000) return (Number(n) / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return Math.round(Number(n) / 1000) + 'K';
  return String(Math.round(Number(n || 0)));
};
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const hace = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const S = {
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 24 } as const,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '18px 20px', marginBottom: 14 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  hd: { fontSize: '0.72rem', color: '#8a8a8a', marginBottom: 13, lineHeight: 1.5 } as const,
  kl: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.06em' } as const,
  kv: { fontSize: '1.85rem', fontWeight: 800, marginTop: 6, letterSpacing: '-.02em', lineHeight: 1 } as const,
  ks: { fontSize: '0.7rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.45 } as const,
  ke: { fontSize: '0.66rem', color: '#b3b1bb', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f5f4f8', lineHeight: 1.45 } as const,
  fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f4f8', fontSize: '0.78rem' } as const,
  btnA: { border: '1.5px solid #7DA6F5', borderRadius: 8, padding: '4px 10px', background: '#fff', fontSize: '0.69rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  btnP: { border: 'none', borderRadius: 8, padding: '5px 11px', background: '#9B8CFA', color: '#fff', fontSize: '0.69rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  pill: (bg: string, fg: string) => ({ fontSize: '0.6rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const }) as const,
};
// El rosa marca lo ELEGIDO, igual que en los filtros del resto del módulo.
const seg = (on: boolean) => ({
  border: 'none', cursor: 'pointer', padding: '6px 14px', fontSize: '0.72rem', fontWeight: 700,
  fontFamily: 'inherit', background: on ? 'rgba(244,168,205,.34)' : 'transparent', color: on ? '#9c3d70' : '#8a8a92',
}) as const;

export default function DashboardTab() {
  const [rango, setRango] = useState<'7' | '30' | '365' | 'custom'>('30');
  const [desde, setDesde] = useState(hace(30));
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

  const preset = (k: '7' | '30' | '365') => { setRango(k); setDesde(hace(Number(k))); setHasta(iso(new Date())); };

  if (err) return <div style={{ ...S.wrap, color: '#C0554E', fontSize: '0.85rem' }}>{err}</div>;
  if (!d) return <div style={{ ...S.wrap, color: '#999', fontSize: '0.85rem' }}>Cargando tablero…</div>;

  const k = d.kpis, sal = d.salud, m = d.metas, cob = d.cobrar;
  const barra = (real: number, meta: number, color: string) => (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.02em' }}>{money(real)}</span>
        <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>de {money(meta)}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 800, color: meta && real / meta >= 0.8 ? '#1E8A63' : '#C0554E' }}>
          {meta > 0 ? Math.round((real / meta) * 100) : 0}%
        </span>
      </div>
      <div style={{ height: 9, background: '#f1f0f5', borderRadius: 9, overflow: 'hidden', margin: '7px 0 5px' }}>
        <span style={{ display: 'block', height: '100%', borderRadius: 9, background: color, width: `${Math.min(100, meta > 0 ? (real / meta) * 100 : 0)}%` }} />
      </div>
    </>
  );

  return (
    <div style={S.wrap}>
      {/* Las rejillas van por clase y no con auto-fit: con minmax el navegador
          decidía 3 columnas y dejaba un hueco del ancho de una tarjeta. */}
      <style>{`
        .tb-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
        .tb-3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:22px; }
        .tb-2 { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; }
        @media (max-width: 1100px) { .tb-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 900px)  { .tb-3, .tb-2 { grid-template-columns:1fr; gap:16px; } }
        @media (max-width: 620px)  { .tb-4 { grid-template-columns:1fr; } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Tablero</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Cómo va el negocio y qué dinero está por entrar</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', border: '1px solid #efe7f1', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
            {([['7', '7 días'], ['30', '30 días'], ['365', '12 meses']] as const).map(([v, l]) => (
              <button key={v} onClick={() => preset(v)} style={seg(rango === v)}>{l}</button>
            ))}
          </span>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setRango('custom'); }}
            style={{ border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' }} />
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setRango('custom'); }}
            style={{ border: '1px solid #e4dffb', background: '#fdfcff', borderRadius: 9, padding: '6px 9px', fontSize: '0.72rem', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* ── Los cuatro de siempre, con lo que se movió EN el periodo: un ARR de
             $1.3M no dice nada; "+$60K este mes" sí. ── */}
      <div className="tb-4" style={{ marginBottom: 14 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>ARR</div>
          <div style={{ ...S.kv, color: '#5B4BD6' }}>{money(k.arr)}</div>
          <div style={S.ks}>
            Ingreso anual recurrente{k.arr_delta ? <> · <b style={{ color: k.arr_delta >= 0 ? '#1E8A63' : '#C0554E' }}>{k.arr_delta >= 0 ? '+' : ''}{money(k.arr_delta)}</b> en el periodo</> : ''}
          </div>
          <div style={S.ke}>Lo que facturarías en 12 meses si nadie se va ni entra nadie.</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Clientes activos</div>
          <div style={S.kv}>{k.clientes}</div>
          <div style={S.ks}>con suscripción activa · <b style={{ color: '#1E8A63' }}>+{k.altas}</b> nuevos{k.bajas ? <>, <b style={{ color: '#C0554E' }}>{k.bajas}</b> baja{k.bajas === 1 ? '' : 's'}</> : ''}</div>
          <div style={S.ke}>Cuentas que pagan hoy. Sin ellas el ARR es una proyección vacía.</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Oportunidades</div>
          <div style={{ ...S.kv, color: '#2C5FC4' }}>{money(k.oportunidades)}</div>
          <div style={S.ks}>{k.oportunidades_n} abiertas · {k.oportunidades_nuevas} creadas en el periodo</div>
          <div style={S.ke}>Dinero en pláticas. Es el combustible del mes que viene.</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Cotizaciones vivas</div>
          <div style={{ ...S.kv, color: '#2C5FC4' }}>{money(k.cotizaciones)}</div>
          <div style={S.ks}>{k.cotizaciones_n} vivas · {k.cotizaciones_nuevas} enviadas en el periodo</div>
          <div style={S.ke}>Ya con precio y en manos del cliente. De aquí sale lo que cierra este mes.</div>
        </div>
      </div>

      {/* ── ARR por cobrar ── */}
      <div style={S.card}>
        <div style={S.h}>ARR por cobrar<span style={S.hr}>próximos 90 días</span></div>
        <div style={S.hd}>Lo que ya está contratado y toca renovar. No es una proyección: son fechas con nombre y monto.</div>
        <div className="tb-4" style={{ marginBottom: 12 }}>
          {[
            ['Vencido', cob.vencido, '#FEF0EF', '#f7c9c5', '#C0554E'],
            ['En 30 días', cob.d30, '#FEF6E7', '#f5e2b8', '#9a6a10'],
            ['En 60 días', cob.d60, '#EEECFE', '#ddd6fb', '#5B4BD6'],
            ['En 90 días', cob.d90, '#E3EDFD', '#cfe0fa', '#2C5FC4'],
          ].map(([t, v, bg, bd, fg]: any) => (
            <div key={t} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 11, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: fg, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: fg, marginTop: 4, letterSpacing: '-.02em' }}>{money(v.monto)}</div>
              <div style={{ fontSize: '0.67rem', color: fg, marginTop: 3 }}>{v.n} {v.n === 1 ? 'renovación' : 'renovaciones'}</div>
            </div>
          ))}
        </div>
        {[...cob.vencido.items, ...cob.d30.items].slice(0, 6).map((r: any) => {
          const venc = r.fecha < iso(new Date());
          return (
            <div key={r.id} style={S.fila}>
              <span style={S.pill(venc ? '#FEF0EF' : '#FEF6E7', venc ? '#C0554E' : '#9a6a10')}>{venc ? 'vencido' : fmtDate(r.fecha)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setAbierto(r.company_id)}>{r.cliente}</div>
                <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{r.plan} · {venc ? `venció el ${fmtDate(r.fecha)}` : `renueva el ${fmtDate(r.fecha)}`}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <b style={{ color: venc ? '#C0554E' : '#1a1a1a' }}>{money(r.monto)}</b>
                <div style={{ marginTop: 4, display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                  <button style={S.btnA} onClick={() => window.open(`/estado-cuenta/cliente/${r.company_id}?subs=${r.id}`, '_blank', 'noopener')}>Estado de cuenta</button>
                  {r.link && <a style={S.btnP} href={r.link} target="_blank" rel="noreferrer">Cobrar</a>}
                </div>
              </div>
            </div>
          );
        })}
        {cob.vencido.n === 0 && cob.d30.n === 0 && <div style={{ padding: '14px 0', color: '#c9c7d0', fontSize: '0.8rem' }}>Nada por cobrar en los próximos 30 días.</div>}
      </div>

      {/* ── Metas ── */}
      <div style={S.card}>
        <div style={S.h}>Meta del mes<span style={S.hr}>quedan {m.dias_restantes} días</span></div>
        <div className="tb-3">
          <div>
            <div style={S.kl}>Ingresos totales</div>
            {barra(m.ingresos.real, m.ingresos.meta, '#9B8CFA')}
            <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Faltan <b style={{ color: '#3f3b4d' }}>{money(Math.max(0, m.ingresos.meta - m.ingresos.real))}</b> · todo lo cobrado en el mes</div>
          </div>
          <div>
            <div style={S.kl}>ARR nuevo</div>
            {barra(m.arr.real, m.arr.meta, '#7DA6F5')}
            <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Pipeline abierto <b style={{ color: '#3f3b4d' }}>{money(m.pipeline)}</b></div>
          </div>
          <div>
            <div style={S.kl}>Pagos únicos</div>
            {barra(m.unicos.real, m.unicos.meta, '#F0B84E')}
            <div style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>Personalizaciones, plugins y extras</div>
          </div>
        </div>
        {/* Recurrente y pago único se venden distinto y valen distinto: una sola
            barra los mezclaba y escondía cuál de los dos va mal. */}
        {m.arr.meta > m.arr.real && (
          <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid #f5f4f8', fontSize: '0.76rem', fontWeight: 700, color: m.pipeline >= (m.arr.meta - m.arr.real) ? '#1E8A63' : '#C0554E' }}>
            {m.pipeline >= (m.arr.meta - m.arr.real)
              ? `El pipeline alcanza: ${money(m.pipeline)} abiertos contra ${money(m.arr.meta - m.arr.real)} que faltan.`
              : `Con el pipeline abierto no alcanzas la meta de ARR: faltarían ${money(m.arr.meta - m.arr.real - m.pipeline)} aun cerrando todo.`}
          </div>
        )}
      </div>

      {/* ── Salud del negocio ── */}
      <div style={S.card}>
        <div style={S.h}>Salud del negocio<span style={S.hr}>lo que preguntan un inversionista y tu equipo</span></div>
        <div style={S.hd}>Cada número dice qué significa. Lo que todavía no se puede calcular con la historia que hay, lo dice.</div>
        <div className="tb-3">
          <Metrica rosa titulo="Retención neta (NRR)" valor={sal.nrr != null ? `${sal.nrr}%` : '—'} color={sal.nrr != null && sal.nrr >= 100 ? '#1E8A63' : '#9a6a10'}
            explica={sal.nrr != null
              ? <>De cada $100 que te pagaban al inicio del periodo, hoy te pagan <b>${sal.nrr}</b> los MISMOS clientes. Arriba de 100 creces sin vender a nadie nuevo.</>
              : <>Hace falta más historia de altas y bajas para calcularla.</>} />
          <Metrica rosa titulo="Bajas (churn)" valor={sal.churn_pct != null ? `${sal.churn_pct}%` : '—'}
            explica={sal.churn_arr ? <>Se fueron <b>{money(sal.churn_arr)} de ARR</b> en el periodo. A ese ritmo, perderías esa proporción del negocio cada mes.</>
              : <>Sin bajas en el periodo. Eso es lo que sostiene el ARR.</>} />
          <Metrica rosa titulo="Ingreso por cuenta" valor={money(sal.arpa)}
            explica={<>ARR entre clientes activos. Sube cuando vendes plugins y personalizaciones, no solo licencias.</>} />
          <Metrica titulo="Tasa de cierre" valor={sal.cierre_pct != null ? `${sal.cierre_pct}%` : '—'} color="#5B4BD6"
            explica={sal.cierre_pct != null
              ? <>De cada 10 cotizaciones resueltas, <b>{Math.round(sal.cierre_pct / 10)} se pagan</b>. Sobre {sal.cierre_n} cotizaciones cerradas.</>
              : <>Todavía no hay cotizaciones resueltas para calcularla.</>} />
          <Metrica titulo="Ciclo de venta" valor={sal.ciclo_dias != null ? `${sal.ciclo_dias} días` : '—'} color="#5B4BD6"
            explica={sal.ciclo_dias != null
              ? <>Lo que pasa entre que mandas la cotización y te pagan. Para cerrar este mes, hay que cotizar con {sal.ciclo_dias} días de anticipación.</>
              : <>Aún no hay cotizaciones pagadas para medirlo.</>} />
          <Metrica rosa titulo="Antigüedad promedio"
            valor={sal.antiguedad_meses != null ? (sal.antiguedad_meses >= 12 ? `${(sal.antiguedad_meses / 12).toFixed(1).replace('.0', '')} años` : `${sal.antiguedad_meses} meses`) : '—'}
            explica={sal.antiguedad_meses != null
              ? <>Lo que llevan tus <b>{sal.antiguedad_n} cuentas activas</b> contigo, desde su primera suscripción. Es lo que separa un negocio que retiene de uno que solo repone.</>
              : <>Faltan fechas de inicio en las suscripciones para calcularla.</>} />
          <Metrica titulo="Concentración" valor={sal.concentracion != null ? `${sal.concentracion}%` : '—'} color={(sal.concentracion || 0) > 30 ? '#9a6a10' : '#1E8A63'}
            explica={<>Tus <b>5 cuentas más grandes</b> son ese porcentaje del ARR. Arriba de 30% un inversionista lo marca como riesgo.</>} />
        </div>
      </div>

      <div className="tb-2">
        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>Ingresos por plan<span style={S.hr}>MRR {money(d.mrr_total)}</span></div>
          {d.planes.length === 0 && <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Sin suscripciones activas.</div>}
          {d.planes.map((p: any, i: number) => {
            const tope = Math.max(1, ...d.planes.map((x: any) => x.mrr));
            const col = ['#9B8CFA', '#7DA6F5', '#4FBF95', '#F0B84E', '#C9C7D0'][i % 5];
            return (
              <div key={p.nombre} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.nombre}</span>
                  <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{p.clientes} {p.clientes === 1 ? 'cliente' : 'clientes'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 800 }}>{money(p.mrr)}</span>
                </div>
                <div style={{ height: 7, background: '#f4f3f7', borderRadius: 9, overflow: 'hidden', marginTop: 3 }}>
                  <span style={{ display: 'block', height: '100%', borderRadius: 9, background: col, width: `${Math.max(2, (p.mrr / tope) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...S.card, margin: 0 }}>
          <div style={S.h}>Reuniones<span style={S.hr}>hoy {d.reuniones.filter((r: any) => r.hoy).length} · esta semana {d.reuniones.length}</span></div>
          {d.reuniones.length === 0 && <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '14px 0' }}>Sin reuniones agendadas esta semana.</div>}
          {d.reuniones.slice(0, 6).map((r: any) => (
            <div key={r.id} style={S.fila}>
              <span style={S.pill(r.hoy ? '#EEECFE' : '#f4f4f6', r.hoy ? '#5B4BD6' : '#6B7280')}>{r.hoy ? 'hoy' : fmtDate(r.fecha)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.asunto || r.tipo || 'Reunión'}</div>
                <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{r.hora}{r.tipo ? ` · ${r.tipo}` : ''}{r.con ? ` · ${r.con}` : ''}</div>
              </div>
              {r.company_id && <button style={{ ...S.btnA, marginLeft: 'auto' }} onClick={() => setAbierto(r.company_id)}>Ver cuenta</button>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 14 }}>
        <div style={S.h}>Atención<span style={S.hr}>{d.atencion.cotizaciones.length} cotizaciones por vencer · {d.atencion.riesgo.length} cuentas en riesgo</span></div>
        {d.atencion.cotizaciones.length === 0 && d.atencion.riesgo.length === 0 && (
          <div style={{ color: '#c9c7d0', fontSize: '0.8rem', padding: '10px 0' }}>Nada urgente. Bien ahí.</div>
        )}
        {d.atencion.cotizaciones.map((q: any) => (
          <div key={q.id} style={S.fila}>
            <span style={S.pill('#FEF6E7', '#9a6a10')}>vence en {q.dias} d</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{q.numero} · {q.empresa}</div>
              <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{money(q.total)} · {q.vistas ? `vista ${q.vistas} ${q.vistas === 1 ? 'vez' : 'veces'}` : 'sin abrir'}</div>
            </div>
            <a style={{ ...S.btnA, marginLeft: 'auto' }} href={`/cotizacion/${q.id}`} target="_blank" rel="noreferrer">Abrir</a>
          </div>
        ))}
        {d.atencion.riesgo.map((c: any) => (
          <div key={c.id} style={S.fila}>
            <span style={S.pill('#FEF0EF', '#C0554E')}>{c.dias} d sin vender</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.nombre}</div>
              <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{money(c.arr)} de ARR en riesgo</div>
            </div>
            <button style={{ ...S.btnA, marginLeft: 'auto' }} onClick={() => setAbierto(c.id)}>Ver cuenta</button>
          </div>
        ))}
      </div>

      {abierto && <ClienteDrawer360 companyId={abierto} onClose={() => setAbierto(null)} onChanged={cargar} />}
    </div>
  );
}

/** Una métrica con su explicación. El rosa marca las de inversionista: son las
 *  que no se tocan a diario, y así se distinguen sin gritar. */
function Metrica({ titulo, valor, explica, color, rosa }: any) {
  return (
    <div style={{
      border: '1px solid', borderColor: rosa ? 'rgba(244,168,205,.45)' : '#f0eff3',
      background: rosa ? 'rgba(244,168,205,.13)' : '#fff', borderRadius: 11, padding: '12px 14px',
    }}>
      <div style={{ fontSize: '0.63rem', fontWeight: 800, color: rosa ? '#9c3d70' : '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.06em' }}>{titulo}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 4, letterSpacing: '-.02em', color: color || '#1a1a1a' }}>{valor}</div>
      <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.5 }}>{explica}</div>
    </div>
  );
}
