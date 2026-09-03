// Comisiones · el motor configurable.
//
// Dos vistas, cada una para una pregunta distinta:
//
//   Cortes       — lo que hay que pagar, y el lugar donde se corrige antes de
//                  enviarlo. Es la pantalla que se abre todos los días.
//   Reporte      — mes a mes: de dónde salió el dinero y qué falta cobrar.
//                  Cortes contesta "¿cuánto se paga esta semana?"; Reporte
//                  contesta "¿cuánto llevo, y de qué".
//
// Aquí vivieron otras dos vistas, y las dos se fueron por la misma razón: no
// era su lugar.
//
//   "Periodo" era la misma información en otro corte de tiempo, con sus PROPIOS
//   botones de aprobar y marcar pagado. Dos caminos para pagar lo mismo, con
//   estados que podían discrepar. Lo único suyo que hacía falta a diario —el
//   botón de recalcular— se mudó a Cortes.
//
//   "Renovaciones" era la lista de las 71 cuentas con su meta de expansión y un
//   desplegable para marcar el seguimiento. Se mudó entera a la pestaña
//   RENOVACIÓN de la ficha de cada cliente: la meta es una propiedad de la
//   CUENTA, no del pago, y marcarla desde una lista de setenta y un renglones
//   era decidir a ciegas. La condición B la sigue evaluando sola el cron.
//
// La configuración (modelo, tarifas, atribución de cuentas y ciclo) vive en
// Configuración › Comisiones: es de otra frecuencia, se toca una vez y no
// todos los días.
//
// La regla que gobierna la pantalla: nada se esconde. Un pago sin dueño, un SKU
// sin tarifa y una comisión revertida después de pagada SE VEN, porque son
// justo los tres casos en los que alguien cobra de menos sin enterarse.
import { useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import { WRAP } from '../../../lib/crm/layout';
import { useIsMobile } from '../../../lib/ui/mobile';
import ComisionesCortes from './ComisionesCortes';
import ComisionesReporte from './ComisionesReporte';

type Vista = 'cortes' | 'reporte';

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
        {([['cortes', 'Cortes'], ['reporte', 'Reporte']] as [Vista, string][]).map(([v, l]) => (
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
      {vista === 'reporte' && <ComisionesReporte movil={movil} />}
    </div>
  );
}
