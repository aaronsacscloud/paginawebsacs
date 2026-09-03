// La renovación de una cuenta, dentro de su ficha.
//
// Vivía en una lista de setenta y un renglones dentro de Comisiones. Se movió
// aquí porque la meta de expansión es una propiedad de LA CUENTA, no del pago:
// se actúa sobre ella mirando al cliente —qué usa, qué le falta, qué se le puede
// vender— y no mirando una tabla de nómina.
//
// Contesta tres preguntas, en el orden en que importan:
//
//   1. ¿Conserva su tasa el año que viene?   → las tres condiciones
//   2. ¿Cuánto le falta vender, y de qué?    → la meta y lo que nunca ha usado
//   3. ¿Cuándo hay que cobrarle?             → la cuenta regresiva
//
// La decisión sigue siendo de una persona: el seguimiento se marca a mano. Lo
// que cambia es que se marca con la evidencia enfrente.
import { useEffect, useState } from 'react';
import { P } from '../../../lib/crm/paleta';
import Cargando from './ui/Cargando';
import SeguimientoCuenta from './SeguimientoCuenta';

const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (d?: string | null) => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—';

const E = {
  caja: { background: '#fff', border: `1px solid ${P.linea}`, borderRadius: 11, padding: '13px 15px' } as const,
  lbl: { fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#999', display: 'block', marginBottom: 4 },
  chip: { fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' as const, display: 'inline-block' },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#fff' },
};

/** Una de las tres condiciones, con su veredicto a la vista. */
function Condicion({ letra, titulo, estado, children }: {
  letra: string; titulo: string; estado: 'ok' | 'no' | 'pendiente'; children: any;
}) {
  const T = {
    ok: { bg: P.verdeAgua, fg: P.verdeTinta, t: 'Cumple', borde: P.verde },
    no: { bg: P.rojoAgua, fg: P.rojoTinta, t: 'No cumple', borde: P.rojo },
    pendiente: { bg: P.lineaSuave, fg: P.suave, t: 'Sin evaluar', borde: P.linea },
  }[estado];
  return (
    <div style={{ ...E.caja, borderLeft: `3px solid ${T.borde}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: P.tinta }}>{letra} · {titulo}</span>
        <div style={{ flex: 1 }} />
        <span style={{ ...E.chip, background: T.bg, color: T.fg }}>{T.t}</span>
      </div>
      {children}
    </div>
  );
}

export default function RenovacionCuenta({ companyId, nombre }: { companyId: string; nombre: string }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const anio = new Date().getFullYear();

  async function cargar() {
    const r = await fetch(`/api/crm/comisiones/renovacion-cuenta?company_id=${companyId}&anio=${anio}`);
    const j = await r.json();
    j.error ? setError(j.error) : setD(j);
  }
  useEffect(() => { setD(null); cargar(); /* eslint-disable-next-line */ }, [companyId]);

  /** Dispara el mismo cálculo del cron, para no tener que esperar a mañana. */
  async function calcular() {
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/renovacion-cuenta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null); await cargar();
    } finally { setGuardando(false); }
  }

  async function marcar(v: string) {
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/comisiones/renovacion-cuenta', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, anio, condicion_a: v === '' ? null : v === 'true' }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Error'); return; }
      setError(null); await cargar();
    } finally { setGuardando(false); }
  }

  if (error) return <div style={{ ...E.caja, borderLeft: `3px solid ${P.rojo}`, color: P.rojoTinta, fontSize: '0.82rem' }}>{error}</div>;
  if (!d) return <Cargando texto="Revisando la renovación…" alto={160} />;

  const ev = d.evaluacion;
  if (!ev) return (
    <div style={{ ...E.caja, color: P.suave, fontSize: '0.84rem' }}>
      <p style={{ margin: '0 0 10px' }}>
        Esta cuenta todavía no tiene evaluación de {anio}. Se genera sola cada madrugada, en cuanto tenga
        una anualidad del año anterior contra la cual medir.
      </p>
      <button onClick={calcular} disabled={guardando} style={{
        padding: '8px 15px', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
        background: '#fff', border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, opacity: guardando ? 0.6 : 1,
      }}>{guardando ? 'Calculando…' : 'Calcular ahora'}</button>
    </div>
  );

  const meta = Number(ev.meta || 0);
  const vendido = Number(ev.vendido || 0);
  const falta = Math.max(0, meta - vendido);
  const pct = meta > 0 ? Math.min(100, Math.round((vendido / meta) * 100)) : 0;
  const prox = d.proxima_anualidad;

  // La urgencia del cobro es una propiedad del calendario, no del criterio de
  // nadie: o quedan días o no quedan.
  const urgente = prox && prox.dias != null && prox.dias <= 15;
  const vencida = prox && prox.dias != null && prox.dias < 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── El veredicto, arriba de todo ── */}
      <div style={{
        ...E.caja,
        background: ev.cumple === false ? P.rojoAgua : ev.cumple ? P.verdeAgua : P.violetaAgua,
        border: 'none',
      }}>
        <span style={E.lbl}>Su tasa en la próxima renovación</span>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: ev.cumple === false ? P.rojoTinta : ev.cumple ? P.verdeTinta : P.violetaTinta }}>
          {ev.cumple === false
            ? `Cobrará tasa reducida (${d.tasa_incumplimiento}%)`
            : ev.cumple
              ? 'Conserva su tasa completa'
              : 'Paga completo mientras no se marque el seguimiento'}
        </div>
        <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: P.texto, maxWidth: '68ch' }}>
          Hacen falta <b>las tres</b> condiciones. Mientras el seguimiento no se marque, <b>no se castiga nada</b>:
          la cuenta cobra su tasa completa.
        </p>
      </div>

      {/* ── A · Seguimiento ── */}
      <Condicion letra="A" titulo="Seguimiento real al cliente"
        estado={ev.condicion_a == null ? 'pendiente' : ev.condicion_a ? 'ok' : 'no'}>
        <p style={{ margin: '0 0 8px', fontSize: '0.79rem', color: P.suave, maxWidth: '68ch' }}>
          Es de criterio y la marcas tú. La evidencia para decidirlo está abajo: qué tanto usa el sistema,
          si nos hemos visto, si contesta y si está sufriendo con soporte.
        </p>
        <select value={ev.condicion_a == null ? '' : String(ev.condicion_a)} disabled={guardando}
          onChange={e => marcar(e.target.value)} style={{ ...E.input, minWidth: 190 }}>
          <option value="">Sin evaluar</option>
          <option value="true">Sí hubo seguimiento</option>
          <option value="false">No hubo seguimiento</option>
        </select>
      </Condicion>

      {/* ── B · Expansión ── */}
      <Condicion letra="B" titulo="Expandir la cuenta un 30%" estado={ev.cumple_b ? 'ok' : 'no'}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 9 }}>
          <div><span style={E.lbl}>Plan anual</span><div style={{ fontWeight: 700 }}>{pesos(ev.base_anterior)}</div></div>
          <div><span style={E.lbl}>Meta (30%)</span><div style={{ fontWeight: 700 }}>{pesos(meta)}</div></div>
          <div><span style={E.lbl}>Vendido</span><div style={{ fontWeight: 800, color: P.violetaTinta }}>{pesos(vendido)}</div></div>
          <div>
            <span style={E.lbl}>Falta</span>
            <div style={{ fontWeight: 800, color: falta > 0 ? P.ambarTinta : P.verdeTinta }}>{falta > 0 ? pesos(falta) : 'Nada'}</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: P.lineaSuave, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: ev.cumple_b ? P.verde : P.ambar }} />
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: P.suave }}>
          Cuenta la <b>expansión</b> —vitalicias, plugins y servicios—, no la renovación de la propia licencia.
        </p>
        {d.expansion.lineas.length > 0 && (
          <div style={{ marginTop: 9, borderTop: `1px solid ${P.lineaSuave}`, paddingTop: 8 }}>
            <span style={E.lbl}>Lo que ya se le vendió</span>
            {d.expansion.lineas.map((l: any, i: number) => (
              <div key={i} style={{ fontSize: '0.79rem', color: P.texto }}>
                · {l.concepto || 'Sin SKU'} <span style={{ color: '#999' }}>{fecha(l.fecha)}</span> — <b>{pesos(l.monto_bruto)}</b>
              </div>
            ))}
          </div>
        )}
      </Condicion>

      {/* ── C · Cobranza ── */}
      <Condicion letra="C" titulo="Cobrar la anualidad a tiempo"
        estado={vencida ? 'no' : prox ? 'pendiente' : 'pendiente'}>
        {prox ? (
          <>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <span style={E.lbl}>Se cobra el</span>
                <div style={{ fontWeight: 800, color: vencida ? P.rojoTinta : urgente ? P.ambarTinta : P.tinta }}>{fecha(prox.fecha)}</div>
              </div>
              <div><span style={E.lbl}>Monto</span><div style={{ fontWeight: 700 }}>{pesos(prox.monto)}</div></div>
              <div>
                <span style={E.lbl}>{vencida ? 'Vencida hace' : 'Faltan'}</span>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: vencida ? P.rojoTinta : urgente ? P.ambarTinta : P.verdeTinta }}>
                  {Math.abs(prox.dias)} día(s)
                </div>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: P.texto, maxWidth: '68ch' }}>
              Hay margen hasta <b>{d.gracia} días naturales</b> después del vencimiento. Pasado eso,
              esa renovación cobra <b>{d.tasa_incumplimiento}%</b> en vez de su tasa.
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8rem', color: P.suave }}>
            Esta cuenta no tiene fecha de próxima factura registrada, así que la puntualidad no se puede medir
            —y por eso no castiga—.
          </p>
        )}
      </Condicion>

      {/* ── La evidencia, que es lo que permite marcar A con fundamento ── */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: P.tinta, marginBottom: 3 }}>La evidencia</div>
        <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: P.suave, maxWidth: '72ch' }}>
          Lo que se puede saber de esta cuenta sin preguntarle a nadie. Los módulos que <b>nunca ha usado</b> son,
          literalmente, la lista de lo que se le puede vender para llegar a la meta.
        </p>
        <SeguimientoCuenta companyId={companyId} nombre={nombre} />
      </div>
    </div>
  );
}
