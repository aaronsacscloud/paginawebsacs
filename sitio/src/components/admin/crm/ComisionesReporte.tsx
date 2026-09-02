// Comisiones · Reporte — mes a mes, de dónde salió el dinero y qué falta cobrar.
//
// Los cortes contestan "¿cuánto se paga esta semana?". Esta pestaña contesta la
// otra pregunta, la que no tenía dónde mirarse: "¿cuánto llevo, y de qué".
//
// Cada mes se abre en dos vistas de la MISMA cifra, porque responden cosas
// distintas: por TIPO (de dónde sale el dinero) y por CORTE (en qué pago viajó
// y si ese pago ya salió).
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import Cargando from './ui/Cargando';

const pesos = (n: number) => {
  const v = Math.round(Number(n || 0));
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-MX');
};
const fecha = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')
  : '—';

const E = {
  card: { background: P.papel, border: `1px solid ${P.linea}`, borderRadius: 12, padding: '15px 17px' } as const,
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  th: { textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, whiteSpace: 'nowrap' as const },
  td: { padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, fontSize: '0.82rem', color: P.texto },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, display: 'inline-block' },
};

const TONO_CORTE: Record<string, { bg: string; fg: string; t: string }> = {
  abierto: { bg: P.violetaAgua, fg: P.violetaTinta, t: 'Abierto' },
  cerrado: { bg: P.azulAgua, fg: P.azulTinta, t: 'Enviado' },
  pagado: { bg: P.verdeAgua, fg: P.verdeTinta, t: 'Pagado' },
};

/** Barra de avance: qué parte de lo generado ya se cobró. */
function Avance({ pagado, total }: { pagado: number; total: number }) {
  const pct = total > 0 ? Math.round((pagado / total) * 100) : 0;
  return (
    <div title={`${pct}% cobrado`} style={{ height: 6, borderRadius: 4, background: P.lineaSuave, overflow: 'hidden', minWidth: 90 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: P.verde }} />
    </div>
  );
}

export default function ComisionesReporte({ movil }: { movil: boolean }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [vista, setVista] = useState<'tipo' | 'corte'>('tipo');

  useEffect(() => {
    fetch('/api/crm/comisiones/reporte')
      .then(r => r.json())
      .then(j => j.error ? setError(j.error) : (setD(j), setAbierto(j.meses?.[0]?.mes ?? null)))
      .catch(e => setError(String(e)));
  }, []);

  if (error) return <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>;
  if (!d) return <Cargando texto="Sumando el año…" />;

  const t = d.totales;
  if (!d.meses.length) return (
    <div style={{ ...E.card, color: P.suave, fontSize: '0.85rem' }}>
      Todavía no hay comisiones desde {fecha(d.desde)}. En cuanto entre un pago aparecerá aquí.
    </div>
  );

  return (
    <>
      <div style={{ ...E.card, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Qué mide esta pantalla</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave, maxWidth: '74ch' }}>
          Cada mes agrupa las comisiones por la <b>fecha en que pagó el cliente</b>, no por el corte en que se liquidaron.
          Así el mes cuadra contra los ingresos de ese mismo mes. Por eso un corte a caballo entre dos meses
          aparece en los dos, con la parte que le toca a cada uno.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '175px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.azul)}>
          <span style={E.lbl}>Pagó el cliente</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: P.azulTinta }}>{pesos(t.cobrado)}</div>
          <div style={{ fontSize: '0.68rem', color: '#888' }}>{t.lineas} línea(s) desde {fecha(d.desde)}</div>
        </div>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Comisión generada</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: P.violetaTinta }}>{pesos(t.comision)}</div>
        </div>
        <div style={tarjetaKpi(P.verde)}>
          <span style={E.lbl}>Ya pagado</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: P.verdeTinta }}>{pesos(t.pagado)}</div>
        </div>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Por pagar</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: P.ambarTinta }}>{pesos(t.por_pagar)}</div>
        </div>
      </div>

      {d.meses.map((m: any) => {
        const esta = abierto === m.mes;
        return (
          <div key={m.mes} style={{ ...E.card, marginBottom: 11, padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setAbierto(esta ? null : m.mes)} style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '13px 16px', background: esta ? P.violetaAgua : 'transparent',
              border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left',
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: P.tinta, textTransform: 'capitalize', minWidth: 150 }}>{m.etiqueta}</span>
              <span style={{ fontSize: '0.78rem', color: P.suave }}>{m.lineas} línea(s)</span>
              <div style={{ flex: 1 }} />
              <div style={{ textAlign: 'right' }}>
                <span style={E.lbl}>Cobrado</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: P.azulTinta }}>{pesos(m.cobrado)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={E.lbl}>Comisión</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: P.violetaTinta }}>{pesos(m.comision)}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 96 }}>
                <span style={E.lbl}>Pagado</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: m.pagado > 0 ? P.verdeTinta : '#bbb' }}>{pesos(m.pagado)}</div>
                <Avance pagado={m.pagado} total={m.comision} />
              </div>
              <div style={{ textAlign: 'right', minWidth: 90 }}>
                <span style={E.lbl}>Por pagar</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: m.por_pagar > 0 ? P.ambarTinta : '#bbb' }}>{pesos(m.por_pagar)}</div>
              </div>
              <span style={{ color: P.violetaTinta, fontSize: '0.75rem', fontWeight: 700 }}>{esta ? 'Ocultar' : 'Ver detalle'}</span>
            </button>

            {esta && (
              <div style={{ padding: '4px 16px 16px' }}>
                <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${P.linea}`, margin: '6px 0 10px' }}>
                  {([['tipo', 'Por tipo de venta'], ['corte', 'Por corte']] as const).map(([v, l]) => (
                    <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} style={{
                      padding: '7px 13px', border: 'none', cursor: 'pointer',
                      background: vista === v ? P.violetaAgua : 'transparent',
                      borderRadius: '8px 8px 0 0',
                      borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent',
                      color: vista === v ? P.violetaTinta : '#666',
                      fontWeight: vista === v ? 800 : 500, fontSize: '0.8rem',
                    }}>{l}</button>
                  ))}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                    <thead><tr>
                      <th style={E.th}>{vista === 'tipo' ? 'Concepto' : 'Corte'}</th>
                      <th style={{ ...E.th, textAlign: 'right' }}>Líneas</th>
                      <th style={{ ...E.th, textAlign: 'right' }}>Pagó el cliente</th>
                      <th style={{ ...E.th, textAlign: 'right' }}>Comisión</th>
                      <th style={{ ...E.th, textAlign: 'right' }}>Pagado</th>
                      <th style={{ ...E.th, textAlign: 'right' }}>Por pagar</th>
                    </tr></thead>
                    <tbody>
                      {vista === 'tipo' && m.tipos.map((x: any) => (
                        <tr key={x.clave}>
                          <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>
                            {x.etiqueta}
                            {x.sin_tarifa > 0 && (
                              <span style={{ ...E.chip, background: P.ambarAgua, color: P.ambarTinta, marginLeft: 6 }}>
                                {x.sin_tarifa} sin tarifa
                              </span>
                            )}
                          </td>
                          <td style={{ ...E.td, textAlign: 'right' }}>{x.lineas}</td>
                          <td style={{ ...E.td, textAlign: 'right' }}>{pesos(x.cobrado)}</td>
                          <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(x.comision)}</td>
                          <td style={{ ...E.td, textAlign: 'right', color: x.pagado > 0 ? P.verdeTinta : '#bbb' }}>{pesos(x.pagado)}</td>
                          <td style={{ ...E.td, textAlign: 'right', color: x.por_pagar > 0 ? P.ambarTinta : '#bbb' }}>{pesos(x.por_pagar)}</td>
                        </tr>
                      ))}

                      {vista === 'corte' && m.cortes.map((c: any, i: number) => {
                        const tono = c.estado ? TONO_CORTE[c.estado] : null;
                        return (
                          <tr key={c.id || 'sin-' + i}>
                            <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>
                              {c.periodo
                                ? <>{fecha(c.periodo.split(' → ')[0])} — {fecha(c.periodo.split(' → ')[1])}</>
                                : <span style={{ color: P.suave, fontWeight: 500 }}>Todavía sin corte</span>}
                              {tono && <span style={{ ...E.chip, background: tono.bg, color: tono.fg, marginLeft: 6 }}>{tono.t}</span>}
                              {c.paga_el && <div style={{ fontSize: '0.68rem', color: '#999' }}>paga el {fecha(c.paga_el)}</div>}
                            </td>
                            <td style={{ ...E.td, textAlign: 'right' }}>{c.lineas}</td>
                            <td style={{ ...E.td, textAlign: 'right' }}>{pesos(c.cobrado)}</td>
                            <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta }}>{pesos(c.comision)}</td>
                            <td style={{ ...E.td, textAlign: 'right', color: c.pagado > 0 ? P.verdeTinta : '#bbb' }}>{pesos(c.pagado)}</td>
                            <td style={{ ...E.td, textAlign: 'right', color: c.por_pagar > 0 ? P.ambarTinta : '#bbb' }}>{pesos(c.por_pagar)}</td>
                          </tr>
                        );
                      })}

                      <tr>
                        <td style={{ ...E.td, fontWeight: 800, color: P.tinta, borderTop: `2px solid ${P.linea}` }}>Total del mes</td>
                        <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${P.linea}` }}>{m.lineas}</td>
                        <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${P.linea}` }}>{pesos(m.cobrado)}</td>
                        <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.violetaTinta, borderTop: `2px solid ${P.linea}` }}>{pesos(m.comision)}</td>
                        <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.verdeTinta, borderTop: `2px solid ${P.linea}` }}>{pesos(m.pagado)}</td>
                        <td style={{ ...E.td, textAlign: 'right', fontWeight: 800, color: P.ambarTinta, borderTop: `2px solid ${P.linea}` }}>{pesos(m.por_pagar)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {vista === 'corte' && m.cortes.some((c: any) => !c.id) && (
                  <p style={{ margin: '9px 0 0', fontSize: '0.75rem', color: P.suave }}>
                    «Todavía sin corte» es lo que se está juntando o quedó rezagado: entra al próximo corte.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
