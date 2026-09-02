// Comisiones · el motor configurable.
//
// Dos vistas, porque el trabajo real son dos:
//
//   Cortes       — lo que hay que pagar, y el lugar donde se corrige antes de
//                  enviarlo. Es la pantalla que se abre todos los días.
//   Renovaciones — las dos condiciones anuales. La del 50% se calcula sola;
//                  la de seguimiento la marca una persona.
//
// HUBO una tercera, "Periodo": la misma información en otro corte de tiempo,
// con sus propios botones de aprobar y marcar pagado. Competía con Cortes en
// vez de ayudarlo —dos caminos para pagar lo mismo, con estados que podían
// discrepar— y confundía a quien trabaja por cortes. Lo único suyo que hacía
// falta a diario, el botón de recalcular, se mudó a Cortes.
//
// La configuración (modelo, tarifas, atribución de cuentas y ciclo) vive en
// Configuración › Comisiones: es de otra frecuencia, se toca una vez y no
// todos los días.
//
// La regla que gobierna la pantalla: nada se esconde. Un pago sin dueño, un SKU
// sin tarifa y una comisión revertida después de pagada SE VEN, porque son
// justo los tres casos en los que alguien cobra de menos sin enterarse.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { P, tarjetaKpi } from '../../../lib/crm/paleta';
import { WRAP } from '../../../lib/crm/layout';
import { useIsMobile } from '../../../lib/ui/mobile';
import Cargando, { Chispas } from './ui/Cargando';
import ComisionesCortes from './ComisionesCortes';
import SeguimientoCuenta from './SeguimientoCuenta';

type Vista = 'cortes' | 'renovaciones';

const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (d?: string | null) =>
  d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '') : '—';

const E = {
  card: { background: P.papel, border: `1px solid ${P.linea}`, borderRadius: 12, padding: '15px 17px' } as const,
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' as const },
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff' } as const,
  btn2: { padding: '7px 13px', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta } as const,
  btn3: { padding: '7px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1px solid #ddd', color: '#444' } as const,
  th: { textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', padding: '9px 10px', borderBottom: `1px solid ${P.linea}`, whiteSpace: 'nowrap' as const },
  td: { padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, fontSize: '0.82rem', color: P.texto, verticalAlign: 'top' as const },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, display: 'inline-block' },
};

export default function ComisionesTab() {
  const movil = useIsMobile();
  const [vista, setVista] = useState<Vista>('cortes');

  return (
    <div style={WRAP}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: movil ? '1.15rem' : '1.4rem', fontWeight: 800, color: P.tinta }}>Comisiones</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: P.suave, maxWidth: '72ch' }}>
          Se calculan sobre los pagos <b>cobrados</b>, con el porcentaje que le toca a cada SKU según el origen del cliente. Se recalculan solas cada madrugada. <b>Cortes</b> es lo que hay que pagar: cada renglón se puede ajustar antes de enviarlo.
        </p>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${P.linea}`, marginBottom: 16, overflowX: 'auto' }}>
        {([['cortes', 'Cortes'], ['renovaciones', 'Renovaciones']] as [Vista, string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} style={{
            padding: '9px 15px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: vista === v ? P.violetaAgua : 'transparent',
            borderRadius: '9px 9px 0 0',
            borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent',
            color: vista === v ? P.violetaTinta : '#666',
            fontWeight: vista === v ? 800 : 500, fontSize: '0.83rem',
          }}>{l}</button>
        ))}
      </div>

      {vista === 'cortes' && <ComisionesCortes movil={movil} />}
      {vista === 'renovaciones' && <VistaRenovaciones movil={movil} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RENOVACIONES  ·  las dos condiciones de la cláusula 4
   ══════════════════════════════════════════════════════════════════ */
function VistaRenovaciones({ movil }: { movil: boolean }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  // Qué cuenta tiene el expediente abierto. Uno a la vez, a propósito: son
  // cinco consultas por cuenta y el punto es mirar UNA con calma.
  const [expediente, setExpediente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch(`/api/crm/comisiones/renovaciones?anio=${anio}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setD(j);
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio]);

  async function recalcular() {
    setCalculando(true); setError(null);
    try {
      const r = await fetch('/api/crm/comisiones/renovaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setCalculando(false); }
  }

  async function marcarA(company_id: string, valor: boolean | null) {
    const r = await fetch('/api/crm/comisiones/renovaciones', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id, anio, condicion_a: valor }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Error'); return; }
    await cargar();
  }

  if (cargando && !d) return <Cargando texto="Cargando evaluaciones…" />;
  const r = d?.resumen;

  return (
    <>
      {error && <div style={{ ...E.card, borderLeft: `3px solid ${P.rojo}`, marginBottom: 12, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ ...E.card, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>Cómo se conserva la tasa cada año</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave, maxWidth: '70ch' }}>
          Hay que cumplir <b>las tres</b>: seguimiento real al cliente, <b>expandir la cuenta un 30% de su plan anual vigente</b> en vitalicias, plugins o servicios, y <b>cobrarle la anualidad a tiempo</b> —antes del vencimiento, el mismo día, o dentro del margen de días del modelo—. La segunda se calcula sola, la tercera sale de la fecha de cada pago, y la primera la marcas tú. <b>Mientras no la marques no se castiga nada</b>: la cuenta cobra su tasa completa.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <label style={E.lbl}>Año</label>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...E.input, minWidth: 110 }}>
            {[0, 1, 2, 3].map(i => { const a = new Date().getFullYear() - i; return <option key={a} value={a}>{a}</option>; })}
          </select>
        </div>
        <button onClick={recalcular} disabled={calculando} style={{ ...E.btn2, opacity: calculando ? 0.6 : 1 }}>
          {calculando ? <><Chispas size={10} /> Calculando…</> : 'Recalcular el 50%'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? '140px' : '170px'}, 1fr))`, gap: 11, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.violeta)}>
          <span style={E.lbl}>Cuentas evaluadas</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta }}>{r?.total ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.verde)}>
          <span style={E.lbl}>Cumplen el 30%</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.verdeTinta }}>{r?.cumplen_b ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.ambar)}>
          <span style={E.lbl}>Falta marcar seguimiento</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta }}>{r?.sin_marcar_a ?? 0}</div>
        </div>
        <div style={tarjetaKpi(P.rojo)}>
          <span style={E.lbl}>Cobrarán tasa reducida</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.rojoTinta }}>{r?.no_cumplen ?? 0}</div>
        </div>
      </div>

      <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead><tr>
            <th style={E.th}>Empresa</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Plan anual</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Meta (30%)</th>
            <th style={{ ...E.th, textAlign: 'right' }}>Expansión vendida</th>
            <th style={E.th}>Expansión</th>
            <th style={E.th}>Seguimiento</th>
            <th style={E.th}>Resultado</th>
          </tr></thead>
          <tbody>
            {(d?.evaluaciones || []).length === 0 && (
              <tr><td style={{ ...E.td, color: P.suave }} colSpan={7}>Sin evaluaciones de {anio}. Aprieta «Recalcular el 30%».</td></tr>
            )}
            {(d?.evaluaciones || []).map((e: any) => (
              <Fragment key={e.id}>
              <tr style={e.cumple === false ? { background: P.rojoAgua } : undefined}>
                <td style={{ ...E.td, fontWeight: 600, color: P.tinta }}>
                  {e.companies?.nombre_comercial || e.companies?.nombre || '—'}
                </td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(e.base_anterior)}</td>
                <td style={{ ...E.td, textAlign: 'right' }}>{pesos(e.meta)}</td>
                <td style={{ ...E.td, textAlign: 'right', fontWeight: 700 }}>{pesos(e.vendido)}</td>
                <td style={E.td}>
                  <span style={{ ...E.chip, background: e.cumple_b ? P.verdeAgua : P.ambarAgua, color: e.cumple_b ? P.verdeTinta : P.ambarTinta }}>
                    {e.cumple_b ? 'Cumple' : 'No llega'}
                  </span>
                </td>
                <td style={E.td}>
                  <select value={e.condicion_a == null ? '' : String(e.condicion_a)}
                    onChange={ev => marcarA(e.company_id, ev.target.value === '' ? null : ev.target.value === 'true')}
                    style={{ ...E.input, minWidth: 130 }}>
                    <option value="">Sin evaluar</option>
                    <option value="true">Sí hubo</option>
                    <option value="false">No hubo</option>
                  </select>
                  {/* La evidencia no se abre sola: son cinco consultas por
                      cuenta, y setenta y un expedientes que nadie pidió harían
                      la pantalla inservible. */}
                  <button onClick={() => setExpediente(x => x === e.company_id ? null : e.company_id)}
                    style={{ display: 'block', marginTop: 5, background: 'none', border: 'none', padding: 0,
                             cursor: 'pointer', fontSize: '0.72rem', color: P.violetaTinta, fontWeight: 700 }}>
                    {expediente === e.company_id ? 'Ocultar evidencia' : 'Ver evidencia'}
                  </button>
                </td>
                <td style={E.td}>
                  {e.cumple == null
                    ? <span style={{ ...E.chip, background: P.lineaSuave, color: P.suave }}>Paga completo</span>
                    : e.cumple
                      ? <span style={{ ...E.chip, background: P.verdeAgua, color: P.verdeTinta }}>Tasa completa</span>
                      : <span style={{ ...E.chip, background: P.rojoAgua, color: P.rojoTinta }}>Tasa reducida</span>}
                </td>
              </tr>
              {expediente === e.company_id && (
                <tr>
                  <td colSpan={7} style={{ padding: '4px 10px 16px', background: '#fafafa', borderBottom: `1px solid ${P.linea}` }}>
                    <SeguimientoCuenta companyId={e.company_id}
                      nombre={e.companies?.nombre_comercial || e.companies?.nombre || 'la cuenta'} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
