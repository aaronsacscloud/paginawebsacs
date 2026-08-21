// SOPORTE · Dashboard GLOBAL de soporte (tab del CRM). Vista de pájaro que hoy
// no existía: volumen por estado/tema, SLA (primera respuesta y resolución),
// CSAT, tickets sin ligar, carga por agente, tendencia y QUIÉN consume el
// soporte. Founder-only (middleware).
import { useEffect, useState } from 'react';
import { S, Kpi, Tag, Aviso, Vacio, Cargando, fmtFecha } from '../email/ui';
import ClienteDrawer360 from '../ClienteDrawer360';
import { TEMA_LABEL } from '../../../../lib/soporte/clasificar';

const SENT_TONO: Record<string, string> = { urgente: 'malo', negativo: 'aviso', neutral: 'gris', positivo: 'ok' };

// El contenedor de sección es un ITEM FLEX de la columna principal del CRM y sin
// `width:100%` toma el ancho de su CONTENIDO, no el de la pantalla: en móvil la
// tarjeta más ancha estiraba toda la sección y el resto se cortaba contra el
// `overflow:hidden` del contenedor (el título quedaba partido a media frase).
// Los grids van con minmax(0,1fr) por lo mismo: con minmax(150px,…) una celda
// no puede encoger por debajo de su contenido y desborda.
const CSS = `
  .sop { width: 100%; min-width: 0; }
  .sop-card { min-width: 0; }
  .sop-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .sop-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  @media (max-width: 1250px) { .sop-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .sop-2 { grid-template-columns: 1fr; } }
  @media (max-width: 700px)  { .sop-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

// El encabezado de sección: el mismo de Cobranza y Consultoría. Soporte era el
// único tab sin él y sin el contenedor `S.wrap`, y por eso arrancaba pegado al
// borde mientras el resto del CRM respira 24 px.
function Encabezado({ children }: { children?: any }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
      <style>{CSS}</style>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Soporte</h2>
        <div style={{ fontSize: '0.79rem', color: '#8a8a8a', marginTop: 2 }}>
          Todo lo que entra por Intercom: qué se pide, qué tan rápido se resuelve y quién lo pide.
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Clientes que más piden atención ────────────────────────────────────────
function TopClientes({ filas, dias, onAbrir }: { filas: any[]; dias: number; onAbrir: (id: string) => void }) {
  const [todos, setTodos] = useState(false);
  if (!filas.length) {
    return (
      <div className="sop-card" style={S.card}>
        <div style={{ fontWeight: 800 }}>Clientes que más piden atención</div>
        <div style={{ fontSize: '0.75rem', color: '#9c99a6', marginTop: 6 }}>
          Nadie abrió ni movió un ticket en los últimos {dias} días.
        </div>
      </div>
    );
  }
  const vista = todos ? filas : filas.slice(0, 10);
  const max = Math.max(1, ...filas.map((f: any) => f.n));

  return (
    <div className="sop-card" style={S.card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontWeight: 800 }}>Clientes que más piden atención</div>
        <span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>últimos {dias} días</span>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#9c99a6', marginBottom: 12 }}>
        Quién consume el soporte por este canal. Da clic en un cliente para abrir su ficha.
      </div>

      <div className="crm-scroll-x">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Cliente', 'Tickets', 'Abiertos', 'Estancados', 'Urgentes', 'Lo que más pide', 'Último movimiento'].map(h => (
              <th key={h} style={{ ...S.th, textAlign: h === 'Cliente' || h === 'Lo que más pide' || h === 'Último movimiento' ? 'left' : 'right' }}>{h}</th>
            ))}
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
                      {!ligado && <Tag tono="aviso">sin ligar</Tag>}
                      {f.estado_cuenta === 'cancelado' && <Tag tono="malo">baja</Tag>}
                    </div>
                    {f.total > f.n && (
                      <div style={{ fontSize: '0.66rem', color: '#b3b1bb', marginTop: 2, fontWeight: 600 }}>
                        {f.total} en todo el histórico
                      </div>
                    )}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', minWidth: 96 }}>
                    <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{f.n}</div>
                    <div style={{ height: 5, background: '#f1f0f6', borderRadius: 3, marginTop: 4 }}>
                      <div style={{ width: `${(f.n / max) * 100}%`, height: '100%', background: '#9B8CFA', borderRadius: 3 }} />
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.abiertos ? '#a06600' : '#c9c7d0' }}>{f.abiertos || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.estancados ? '#C0554E' : '#c9c7d0' }}>{f.estancados || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: f.urgentes ? '#C0554E' : '#c9c7d0' }}>{f.urgentes || '—'}</td>
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
    </div>
  );
}

export default function SoporteTab() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [dias, setDias] = useState(30);
  const [cliente, setCliente] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vivo = true; setD(null); setErr('');
    fetch(`/api/crm/soporte/dashboard?dias=${dias}`)
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión — revisa tu internet'); });
    return () => { vivo = false; };
  }, [dias, recarga]);

  if (err) return <div className="sop" style={S.wrap}><Encabezado /><Aviso tono="malo" titulo="No se pudo cargar el dashboard">{err}</Aviso></div>;
  if (!d) return <div className="sop" style={S.wrap}><Encabezado /><Cargando que="el panel de soporte" /></div>;

  const T = d.totales || {}, sla = d.sla || {};
  if (!T.total) return <div className="sop" style={S.wrap}><Encabezado /><Vacio titulo="Sin tickets de soporte todavía" texto="Cuando entren conversaciones de Intercom aparecerán aquí, ligadas a cada cliente." /></div>;

  const maxTema = Math.max(1, ...(d.por_tema || []).map((x: any) => x.n));
  const maxTend = Math.max(1, ...(d.tendencia || []).map((x: any) => Math.max(x.abiertos, x.resueltos)));

  return (
    <div className="sop" style={S.wrap}>
      <Encabezado>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: '#9c99a6', fontWeight: 700 }}>Periodo:</span>
          {[14, 30, 90].map(n => (
            <button key={n} onClick={() => setDias(n)} style={{ border: '1px solid #e2e4e9', borderRadius: 8, padding: '5px 12px', fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit', background: dias === n ? '#EEECFE' : '#fff', color: dias === n ? '#5B4BD6' : '#666', fontWeight: dias === n ? 800 : 500 }}>{n} días</button>
          ))}
        </div>
      </Encabezado>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPIs */}
        <div className="sop-kpis">
          <Kpi etiqueta="Abiertos" valor={T.abiertos} tono={T.abiertos ? 'aviso' : 'ok'} sub={`${T.en_curso} en curso`} />
          <Kpi etiqueta="Estancados" valor={T.estancados} tono={T.estancados ? 'malo' : 'ok'} sub="+48 h sin movimiento" />
          <Kpi etiqueta="Resueltos" valor={T.resueltos} tono="ok" sub={T.reabiertos ? `${T.reabiertos} reabiertos` : undefined} />
          <Kpi etiqueta="1ª respuesta" valor={sla.frt_promedio_horas != null ? `${sla.frt_promedio_horas} h` : '—'} sub="promedio" />
          <Kpi etiqueta="Resolución" valor={sla.resolucion_promedio_horas != null ? `${sla.resolucion_promedio_horas} h` : '—'} sub="promedio" />
          <Kpi etiqueta="CSAT" valor={sla.csat_promedio != null ? `${sla.csat_promedio}/5` : '—'} tono={sla.csat_promedio != null ? (sla.csat_promedio >= 4 ? 'ok' : sla.csat_promedio >= 3 ? 'aviso' : 'malo') : undefined} sub={`${sla.csat_n} respuesta(s)`} />
        </div>

        <TopClientes filas={d.top_clientes || []} dias={d.periodo_dias || dias} onAbrir={(id) => setCliente(id)} />

        <div className="sop-2">
          {/* Tendencia abiertos vs resueltos */}
          <div className="sop-card" style={S.card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Entrada vs. resolución</div>
              <span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>últimos {dias} días</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
              {(d.tendencia || []).map((x: any) => (
                <div key={x.dia} title={`${x.dia}: ${x.abiertos} abiertos, ${x.resueltos} resueltos`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, height: '100%' }}>
                  <div style={{ height: `${(x.abiertos / maxTend) * 50}%`, background: '#E9B949', borderRadius: '2px 2px 0 0', minHeight: x.abiertos ? 2 : 0 }} />
                  <div style={{ height: `${(x.resueltos / maxTend) * 50}%`, background: '#4FBF95', borderRadius: '0 0 2px 2px', minHeight: x.resueltos ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.72rem', color: '#888' }}>
              <span><span style={{ color: '#E9B949' }}>■</span> Abiertos</span>
              <span><span style={{ color: '#4FBF95' }}>■</span> Resueltos</span>
            </div>
          </div>

          {/* Top temas */}
          <div className="sop-card" style={S.card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Temas más frecuentes</div>
            {(d.por_tema || []).slice(0, 8).map((x: any) => (
              <div key={x.tema} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 2 }}>
                  <span>{x.label}</span><span style={{ fontWeight: 700 }}>{x.n}</span>
                </div>
                <div style={{ height: 6, background: '#f1f0f6', borderRadius: 3 }}><div style={{ width: `${(x.n / maxTema) * 100}%`, height: '100%', background: '#9B8CFA', borderRadius: 3 }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="sop-2">
          {/* Sentimiento + sin ligar */}
          <div className="sop-card" style={S.card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Sentimiento de tickets</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(d.por_sentimiento || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]: any) => (
                <Tag key={k} tono={SENT_TONO[k] || 'gris'}>{k}: {n}</Tag>
              ))}
            </div>
            {T.sin_ligar > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f0f6' }}>
                <Tag tono="aviso">{T.sin_ligar} sin ligar a cliente</Tag>
                <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 6 }}>Conversaciones cuyo contacto no se pudo mapear a una cuenta SACS. El cron de backfill reintenta cada 30 min.</div>
              </div>
            )}
          </div>

          {/* Carga por agente */}
          <div className="sop-card" style={S.card}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Carga por agente</div>
            <div className="crm-scroll-x"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Agente', 'Abiertos', 'Total'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{(d.por_agente || []).map((a: any) => (
                <tr key={a.agente}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{a.agente}</td>
                  <td style={{ ...S.td, fontWeight: 800, color: a.abiertos ? '#a06600' : '#999' }}>{a.abiertos}</td>
                  <td style={S.td}>{a.total}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
      </div>

      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={() => setRecarga(r => r + 1)} />}
    </div>
  );
}
