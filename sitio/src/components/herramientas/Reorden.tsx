// La puerta WEB del punto de reorden por talla.
//
// Igual que las demás: no calcula, llama a /api/herramientas/punto-de-reorden.
//
// La forma de entrada es la misma que la del auditor de curva de tallas —una
// fila por talla— porque el dato de partida es el mismo (venta por talla) y
// quien ya usó esa herramienta reconoce el patrón sin pensar. La diferencia es
// la pregunta: ahí se corrige lo vendido; aquí se compara contra el tiempo de
// entrega para decir SI YA hay que pedir, no solo cuánto queda.
import { useState } from 'react';

type Fila = { talla: string; vendidas: string; existencia: string };

// El ejemplo deja a la M con 8 piezas — el caso de la nota del archivo fuente:
// las mismas 8 piezas son sobra tranquila con un proveedor rápido y una talla
// ya rota con uno lento. Aquí el proveedor tarda 15 días, así que la M (y la S,
// que vende casi igual con menos colchón) ya deberían haberse pedido; la L, con
// más existencia, todavía no.
const EJEMPLO: Fila[] = [
  { talla: 'S', vendidas: '20', existencia: '6' },
  { talla: 'M', vendidas: '30', existencia: '8' },
  { talla: 'L', vendidas: '18', existencia: '30' },
];

type Salida = {
  tallas: {
    talla: string; consumo_diario: number; punto_reorden: number; existencia_actual: number;
    pedir_ahora: boolean; cantidad_a_pedir: number; dias_para_reordenar: number | null;
  }[];
  urgentes: string[];
  total_piezas_a_pedir: number;
  lectura: string;
};

export default function Reorden() {
  const [filas, setFilas] = useState<Fila[]>(EJEMPLO);
  const [periodo, setPeriodo] = useState('30');
  const [entrega, setEntrega] = useState('15');
  const [seguridad, setSeguridad] = useState('5');
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [r, setR] = useState<Salida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const tocar = (i: number, campo: keyof Fila, v: string) => {
    setEsEjemplo(false);
    setFilas(f => f.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));
  };

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      const tallas = filas
        .filter(f => f.talla.trim() && f.vendidas.trim() !== '' && f.existencia.trim() !== '')
        .map(f => ({
          talla: f.talla.trim(),
          vendidas: Number(f.vendidas),
          existencia_actual: Number(f.existencia),
        }));
      const res = await fetch('/api/herramientas/punto-de-reorden', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_dias: Number(periodo) || 30,
          tiempo_entrega_dias: Number(entrega) || 0,
          dias_seguridad: seguridad.trim() === '' ? undefined : Number(seguridad),
          tallas,
          __puerta: 'web',
        }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error || 'No se pudo calcular.'); setR(null); }
      else setR(d.datos);
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally { setCargando(false); }
  }

  return (
    <div className="curva temporada">
      <form onSubmit={calcular}>
        {esEjemplo && (
          <p className="ejemplo-aviso">
            Estos números son un <strong>ejemplo</strong>: a la M le quedan 8 piezas y un proveedor de
            15 días. Cámbialos por los tuyos.
          </p>
        )}

        <div className="campos">
          <label>
            <span>Días que llevas midiendo la venta</span>
            <input type="number" min="1" max="3650" required value={periodo}
              onChange={e => { setEsEjemplo(false); setPeriodo(e.target.value); }} />
            <em>2 a 4 semanas es lo normal.</em>
          </label>
          <label>
            <span>Días que tarda tu proveedor</span>
            <input type="number" min="0" max="365" required value={entrega}
              onChange={e => { setEsEjemplo(false); setEntrega(e.target.value); }} />
            <em>Desde que levantas el pedido hasta que puedes vender la mercancía.</em>
          </label>
          <label>
            <span>Colchón de seguridad, en días <i>(opcional)</i></span>
            <input type="number" min="0" max="90" value={seguridad}
              onChange={e => { setEsEjemplo(false); setSeguridad(e.target.value); }} />
            <em>Por si el proveedor se atrasa o la talla vende más rápido de lo normal.</em>
          </label>
        </div>

        <table className="entrada">
          <thead>
            <tr>
              <th scope="col">Talla</th>
              <th scope="col">Vendidas en el periodo</th>
              <th scope="col">Existencia de hoy</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td><input aria-label={`Talla ${i + 1}`} value={f.talla}
                  onChange={e => tocar(i, 'talla', e.target.value)} placeholder="M" /></td>
                <td><input aria-label={`Vendidas de la talla ${f.talla || i + 1}`} type="number" min="0"
                  value={f.vendidas} onChange={e => tocar(i, 'vendidas', e.target.value)} /></td>
                <td><input aria-label={`Existencia de la talla ${f.talla || i + 1}`} type="number" min="0"
                  value={f.existencia} onChange={e => tocar(i, 'existencia', e.target.value)} /></td>
                <td>
                  {filas.length > 1 && (
                    <button type="button" className="quitar" aria-label={`Quitar la talla ${f.talla || i + 1}`}
                      onClick={() => { setEsEjemplo(false); setFilas(x => x.filter((_, j) => j !== i)); }}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="acciones">
          <button type="button" className="secundario"
            onClick={() => { setEsEjemplo(false); setFilas(f => [...f, { talla: '', vendidas: '', existencia: '' }]); }}>
            Agregar talla
          </button>
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : '¿Qué pido ya?'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && (
        <section className="resultado" aria-live="polite">
          <div className={`lectura ${r.urgentes.length ? 'rota' : ''}`}>{r.lectura}</div>

          <dl className="cifras">
            <div className={r.urgentes.length ? 'malo' : ''}>
              <dt>Tallas que pedir ya</dt><dd>{r.urgentes.length}</dd>
            </div>
            <div><dt>Piezas a pedir en total</dt><dd>{r.total_piezas_a_pedir}</dd></div>
          </dl>

          <div className="tabla-scroll">
            <table className="salida">
              <thead>
                <tr>
                  <th scope="col">Talla</th>
                  <th scope="col">Consumo</th>
                  <th scope="col">Punto de reorden</th>
                  <th scope="col">Tienes hoy</th>
                  <th scope="col">Pide</th>
                  <th scope="col">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {r.tallas.map(t => (
                  <tr key={t.talla} className={t.pedir_ahora ? 'se-agoto' : ''}>
                    <th scope="row">
                      {t.talla}
                      {t.pedir_ahora && <span className="chip agotado">pedir ya</span>}
                    </th>
                    <td>{t.consumo_diario}<small> pz/día</small></td>
                    <td className="apagado">{t.punto_reorden}</td>
                    <td>{t.existencia_actual}</td>
                    <td className="fuerte">{t.cantidad_a_pedir || '—'}</td>
                    <td>
                      {t.dias_para_reordenar === null
                        ? 'sin venta'
                        : t.dias_para_reordenar < 0
                          ? `atrasado ${Math.abs(t.dias_para_reordenar)} d`
                          : `en ${t.dias_para_reordenar} d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Aquí capturaste la existencia de un modelo, a mano, una vez. Sacs conoce la existencia y
              la venta por talla de <strong>todos</strong> tus modelos en <strong>todas</strong> tus
              tiendas en vivo, así que avisa del punto de reorden de cada talla sin que nadie tenga que
              sentarse a calcularlo.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
