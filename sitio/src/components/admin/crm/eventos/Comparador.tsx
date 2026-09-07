// COMPARAR FERIAS · lo que dicen todas juntas (puntos 4, 5 y 9).
//
// Cuatro bloques: cada feria vivida con su costo por cliente; ese costo junto al de
// los otros canales; el plan del año (presupuesto y lo que se espera de vuelta con
// la conversión histórica); y el fit medido contra el fit en papel.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import { Fit, Btn, Seccion, Pastilla, fmt, dinero, rango, post } from './ui';

const pct = (n: number | null | undefined, dec = 1) => n == null ? '–' : `${(n * 100).toFixed(dec)}%`;
const TH = { fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.05em', textAlign: 'right' as const, padding: '6px 8px', whiteSpace: 'nowrap' as const, borderBottom: `1px solid ${P.linea}` };
const TD = { fontSize: '.8125rem', color: '#333', textAlign: 'right' as const, padding: '7px 8px', fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const, borderBottom: `1px solid ${P.lineaSuave}` };

export default function Comparador({ onAbrirEdicion }: { onAbrirEdicion: (id: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [recalc, setRecalc] = useState(false);
  const traer = () => fetch('/api/crm/eventos/comparar').then(r => r.json()).then(j => { if (j.error) setError(j.error); else setD(j); }).catch(e => setError(String(e)));
  useEffect(() => { traer(); }, []);
  if (error) return <div style={{ color: P.rojoTinta }}>{error}</div>;
  if (!d) return <Cargando texto="Sumando todas las ferias…" />;

  const vividas = (d.filas as any[]).filter(f => f.participacion === 'fuimos').sort((a, b) => (a.costo_por_cliente ?? 1e12) - (b.costo_por_cliente ?? 1e12));
  const h = d.historico;
  const feriaCac = h.costo_por_cliente;
  const canales = [...(d.canales as any[])].sort((a, b) => (a.costo_por_cliente ?? 1e12) - (b.costo_por_cliente ?? 1e12));
  const kpi = (label: string, valor: string, sub: string, franja: string, tinta: string) => (
    <div style={tarjetaKpi(franja)}>
      <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 3 }}>{sub}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        {kpi('Ferias vividas', fmt(h.ferias), `${fmt(h.registros)} registros en total`, P.violeta, P.violetaTinta)}
        {kpi('Conversión', pct(h.conversion), 'de registro a cliente', P.azul, P.azulTinta)}
        {kpi('Costo por cliente', feriaCac ? dinero(feriaCac) : '–', 'en ferias, todo sumado', feriaCac ? P.rojo : '#ddd', P.rojoTinta)}
        {kpi('ARR por cliente', h.arr_por_cliente ? dinero(h.arr_por_cliente) : '–', 'lo que deja un cliente de feria', P.verde, P.verdeTinta)}
      </div>

      <Seccion titulo="Cada feria, de la más barata por cliente a la más cara">
        {!vividas.length ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Todavía no hay ferias cerradas con registros. Al marcar «fuimos» y cargar gastos, aquí se comparan.</div> : (
          <div style={{ overflowX: 'auto', border: `1px solid ${P.linea}`, borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead><tr>
                <th style={{ ...TH, textAlign: 'left' }}>Feria</th><th style={TH}>Costó</th><th style={TH}>Registros</th><th style={TH}>Demos</th><th style={TH}>Oportun.</th><th style={TH}>Clientes</th><th style={TH}>Por registro</th><th style={TH}>Por cliente</th><th style={TH}>ARR</th><th style={TH}>Retorno</th>
              </tr></thead>
              <tbody>
                {vividas.map(f => (
                  <tr key={f.edicion_id} style={{ cursor: 'pointer' }} onClick={() => onAbrirEdicion(f.edicion_id)}>
                    <td style={{ ...TD, textAlign: 'left', whiteSpace: 'normal' }}><b style={{ color: '#222' }}>{f.evento}</b><div style={{ fontSize: '.6875rem', color: '#888' }}>{f.edicion} · {rango(f.inicio, f.fin)}</div></td>
                    <td style={TD}>{dinero(f.costo)}</td><td style={TD}>{fmt(f.registros)}</td><td style={TD}>{fmt(f.demos)}</td><td style={TD}>{fmt(f.oportunidades)}</td>
                    <td style={{ ...TD, fontWeight: 800, color: f.clientes ? P.verdeTinta : '#999' }}>{fmt(f.clientes)}</td>
                    <td style={TD}>{f.costo_por_registro ? dinero(f.costo_por_registro) : '–'}</td>
                    <td style={{ ...TD, fontWeight: 800, color: f.costo_por_cliente == null ? '#999' : feriaCac && f.costo_por_cliente <= feriaCac ? P.verdeTinta : P.rojoTinta }}>{f.costo_por_cliente ? dinero(f.costo_por_cliente) : f.costo ? 'sin clientes' : '–'}</td>
                    <td style={TD}>{f.arr ? dinero(f.arr) : '–'}</td>
                    <td style={{ ...TD, color: f.roi == null ? '#999' : f.roi >= 0 ? P.verdeTinta : P.rojoTinta }}>{f.roi == null ? '–' : `${f.roi > 0 ? '+' : ''}${f.roi}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Contra los otros canales · últimos 12 meses">
        {!canales.length && !feriaCac ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Sin gasto por canal capturado. Se llena en Marketing → Gastos.</div> : (
          <div style={{ display: 'grid', gap: 5 }}>
            {[...canales, ...(feriaCac ? [{ canal: 'ferias', nombre: 'Ferias y eventos', clientes: h.clientes, costo_por_cliente: feriaCac, gasto: null, esFeria: true }] : [])].sort((a: any, b: any) => (a.costo_por_cliente ?? 1e12) - (b.costo_por_cliente ?? 1e12)).map((c: any) => {
              const max = Math.max(...[...canales.map(x => x.costo_por_cliente || 0), feriaCac || 0], 1);
              return (
                <div key={c.canal} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: c.esFeria ? P.violetaAgua : '#fff', border: `1px solid ${c.esFeria ? P.violeta : P.linea}` }}>
                  <span style={{ fontSize: '.8125rem', fontWeight: 700, color: c.esFeria ? P.violetaTinta : '#333' }}>{c.nombre}</span>
                  <span style={{ height: 8, borderRadius: 4, background: '#eee', overflow: 'hidden' }}><span style={{ display: 'block', width: `${c.costo_por_cliente ? 100 * c.costo_por_cliente / max : 0}%`, height: '100%', background: c.esFeria ? P.violeta : P.azul }} /></span>
                  <span style={{ fontSize: '.8125rem', fontWeight: 800, color: '#333', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{c.costo_por_cliente ? dinero(c.costo_por_cliente) : '–'} <span style={{ fontWeight: 500, color: '#888' }}>· {fmt(c.clientes)} cl.</span></span>
                </div>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="El plan del año · presupuesto y lo que se espera de vuelta">
        {!(d.plan?.anios || []).length ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Sin ediciones marcadas como «vamos» o «fuimos».</div> : (d.plan.anios as any[]).map(a => (
          <div key={a.anio} style={{ ...tarjetaKpi(P.violeta), marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
              <b style={{ fontSize: '1.0625rem', color: P.violetaTinta }}>{a.anio}</b>
              <span style={{ fontSize: '.8125rem', color: '#666' }}>{a.vamos ? `${a.vamos} por venir` : ''}{a.vamos && a.fuimos ? ' · ' : ''}{a.fuimos ? `${a.fuimos} vividas` : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
              {a.vamos > 0 && <>
                <Dato l="Presupuesto" v={dinero(a.presupuesto)} s="lo que vamos a gastar" />
                <Dato l="Registros esperados" v={fmt(a.registros_esperados)} s="metas o promedio histórico" />
                <Dato l="Clientes esperados" v={String(a.clientes_esperados)} s={h.conversion != null ? `con ${pct(h.conversion)} de conversión` : 'metas de cada edición'} />
                <Dato l="ARR esperado" v={a.arr_esperado ? dinero(a.arr_esperado) : '–'} s={a.roi_esperado != null ? `retorno ${a.roi_esperado > 0 ? '+' : ''}${a.roi_esperado}%` : 'sin base histórica'} tinta={a.roi_esperado != null && a.roi_esperado >= 0 ? P.verdeTinta : P.ambarTinta} />
                <Dato l="Por cliente esperado" v={a.costo_por_cliente_esperado ? dinero(a.costo_por_cliente_esperado) : '–'} s="presupuesto ÷ clientes esperados" />
              </>}
              {a.fuimos > 0 && <>
                <Dato l="Gastado" v={dinero(a.gastado)} s="en las vividas" />
                <Dato l="Clientes reales" v={fmt(a.clientes_reales)} s={a.arr_real ? `${dinero(a.arr_real)} de ARR` : 'todavía sin ARR'} tinta={P.verdeTinta} />
              </>}
            </div>
            {a.filas?.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
                {a.filas.map((f: any) => (
                  <button key={f.edicion_id} onClick={() => onAbrirEdicion(f.edicion_id)} style={{ font: 'inherit', textAlign: 'left', background: 'none', border: 'none', padding: '3px 0', cursor: 'pointer', fontSize: '.75rem', color: '#555', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ color: '#333' }}>{f.evento}</b><span>{rango(f.inicio)}</span><span>· {dinero(f.presupuesto)}</span><span>· {fmt(f.registros_esperados)} reg. → {f.clientes_esperados} cl.</span>{f.arr_esperado ? <span>· {dinero(f.arr_esperado)} ARR</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Fit medido contra el fit en papel" accion={<Btn chico nivel="secundario" disabled={recalc} onClick={async () => { setRecalc(true); try { await post('/api/crm/eventos/comparar', { accion: 'recalcular_fit' }); await traer(); } catch (e: any) { alert(e.message); } finally { setRecalc(false); } }}>{recalc ? 'Midiendo…' : 'Volver a medir'}</Btn>}>
        <p style={{ fontSize: '.75rem', color: '#777', margin: '0 0 8px', lineHeight: 1.5 }}>El fit en papel es lo que se investigó antes de ir. El medido sale de lo que pasó: clientes por registro y costo por cliente contra los otros canales. Dos ediciones sin un solo cliente bajan el evento a 2 con su nota, para que la siguiente decisión no se tome con la opinión vieja.</p>
        {!(d.fit_medido || []).length ? <div style={{ fontSize: '.8125rem', color: '#999' }}>Nada medido todavía: hace falta al menos una edición «fuimos» con registros.</div> : (
          <div style={{ display: 'grid', gap: 5 }}>
            {(d.fit_medido as any[]).map(e => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${P.linea}`, background: '#fff' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#222' }}>{e.nombre}</div>
                  <div style={{ fontSize: '.75rem', color: '#666', lineHeight: 1.4 }}>{e.fit_medido_nota}</div>
                </div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '.5625rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' }}>En papel</div><Fit v={e.fit_puntaje} /></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '.5625rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' }}>Medido</div><Fit v={e.fit_medido} /></div>
              </div>
            ))}
          </div>
        )}
      </Seccion>
      {(d.fit_medido as any[])?.some(e => e.fit_medido < e.fit_puntaje - 2) && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>Hay eventos cuyo fit medido queda muy por debajo del de papel: revísalos antes de apartar stand.</Pastilla>}
    </div>
  );
}

function Dato({ l, v, s, tinta }: { l: string; v: string; s: string; tinta?: string }) {
  return (
    <div>
      <div style={{ fontSize: '.5625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
      <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: tinta || '#333', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: '.6875rem', color: '#888' }}>{s}</div>
    </div>
  );
}
