// La puerta WEB del costo de maquila.
//
// Igual que las demás: no calcula, llama a /api/herramientas/costo-de-maquila.
//
// Es la única de las seis con una lista de insumos de tamaño variable (tela,
// forro, cierre...), así que reutiliza la tabla de filas de la curva de tallas
// —agregar y quitar renglón— en vez de inventar un patrón nuevo para un
// problema que ya está resuelto en este mismo directorio.
//
// El ejemplo (tela + forro + cierre, con 45% de margen objetivo) está elegido
// para que se note la lección del archivo fuente: 45% de MARGEN es un markup
// de casi 82% sobre el costo. Son la misma prenda con dos números muy
// distintos, y confundirlos dijo el comentario de `maquila.ts` que es el error
// más común en marcas nuevas.
import { useState } from 'react';

type Insumo = { nombre: string; costo: string };

const EJ_INSUMOS: Insumo[] = [
  { nombre: 'Tela principal', costo: '85' },
  { nombre: 'Forro',          costo: '20' },
  { nombre: 'Cierre e hilo',  costo: '12' },
];
const EJEMPLO = { corte: '15', confeccion: '45', otros: '8', merma: '6', piezas: '200', margen: '45', iva: '16' };

type Salida = {
  costo_insumos: number;
  costo_insumos_con_merma: number;
  costo_corte: number;
  costo_confeccion: number;
  costo_otros: number;
  costo_por_prenda: number;
  costo_del_lote: number;
  desglose_pct: { concepto: string; pct: number }[];
  precio_minimo?: {
    margen_objetivo_pct: number;
    precio_neto: number;
    precio_con_iva: number;
    markup_equivalente_pct: number;
  };
  lectura: string;
};

const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

export default function Maquila() {
  const [insumos, setInsumos] = useState<Insumo[]>(EJ_INSUMOS);
  const [f, setF] = useState(EJEMPLO);
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [r, setR] = useState<Salida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const set = (k: keyof typeof EJEMPLO, v: string) => { setEsEjemplo(false); setF(x => ({ ...x, [k]: v })); };
  const tocarInsumo = (i: number, campo: keyof Insumo, v: string) => {
    setEsEjemplo(false);
    setInsumos(x => x.map((s, j) => (j === i ? { ...s, [campo]: v } : s)));
  };

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      const cuerpoInsumos = insumos
        .filter(s => s.nombre.trim() && s.costo.trim() !== '')
        .map(s => ({ nombre: s.nombre.trim(), costo_por_prenda: Number(s.costo) }));
      const res = await fetch('/api/herramientas/costo-de-maquila', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumos: cuerpoInsumos,
          corte_por_prenda: Number(f.corte) || 0,
          confeccion_por_prenda: Number(f.confeccion) || 0,
          merma_pct: f.merma.trim() === '' ? undefined : Number(f.merma),
          otros_costos_por_prenda: f.otros.trim() === '' ? undefined : Number(f.otros),
          piezas_del_lote: Number(f.piezas) || 1,
          margen_objetivo_pct: f.margen.trim() === '' ? undefined : Number(f.margen),
          iva_pct: Number(f.iva) || 16,
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
            Estos números son un <strong>ejemplo</strong> de una prenda sencilla, con forro y cierre.
            Cámbialos por los tuyos.
          </p>
        )}

        <table className="entrada">
          <thead>
            <tr>
              <th scope="col">Tela o insumo</th>
              <th scope="col">Costo por prenda<br /><em>ya en la cantidad que lleva una pieza</em></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {insumos.map((s, i) => (
              <tr key={i}>
                <td><input aria-label={`Insumo ${i + 1}`} value={s.nombre}
                  onChange={e => tocarInsumo(i, 'nombre', e.target.value)} placeholder="tela principal" /></td>
                <td><input aria-label={`Costo del insumo ${s.nombre || i + 1}`} type="number" min="0" step="0.01"
                  value={s.costo} onChange={e => tocarInsumo(i, 'costo', e.target.value)} /></td>
                <td>
                  {insumos.length > 1 && (
                    <button type="button" className="quitar" aria-label={`Quitar ${s.nombre || 'insumo ' + (i + 1)}`}
                      onClick={() => { setEsEjemplo(false); setInsumos(x => x.filter((_, j) => j !== i)); }}>×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="acciones">
          <button type="button" className="secundario"
            onClick={() => { setEsEjemplo(false); setInsumos(x => [...x, { nombre: '', costo: '' }]); }}>
            Agregar insumo
          </button>
        </div>

        <div className="campos">
          <label>
            <span>Corte por prenda</span>
            <input type="number" min="0" step="0.01" required value={f.corte}
              onChange={e => set('corte', e.target.value)} />
            <em>Lo que cobra quien corta, por pieza.</em>
          </label>
          <label>
            <span>Confección por prenda</span>
            <input type="number" min="0" step="0.01" required value={f.confeccion}
              onChange={e => set('confeccion', e.target.value)} />
            <em>Lo que cobra el taller por coser y armar una pieza.</em>
          </label>
          <label>
            <span>Merma</span>
            <input type="number" min="0" max="50" value={f.merma}
              onChange={e => set('merma', e.target.value)} />
            <em>% de tela e insumos que se pierde por trazo y retazo. Entre 3 y 10 es lo normal.</em>
          </label>
          <label>
            <span>Otros costos por prenda <i>(opcional)</i></span>
            <input type="number" min="0" step="0.01" value={f.otros}
              onChange={e => set('otros', e.target.value)} />
            <em>Bordado, estampado, lavado, empaque, talla y etiquetado.</em>
          </label>
          <label>
            <span>Piezas del lote</span>
            <input type="number" min="1" value={f.piezas}
              onChange={e => set('piezas', e.target.value)} />
            <em>Cuántas vas a mandar hacer en esta corrida.</em>
          </label>
          <label>
            <span>Margen que quieres ganar <i>(opcional)</i></span>
            <input type="number" min="0" max="95" value={f.margen}
              onChange={e => set('margen', e.target.value)} placeholder="45" />
            <em>Sobre el precio de venta, no sobre el costo. Si lo das, calculo tu precio mínimo.</em>
          </label>
          <label>
            <span>IVA</span>
            <select value={f.iva} onChange={e => set('iva', e.target.value)}>
              <option value="16">16% — resto del país</option>
              <option value="8">8% — franja fronteriza</option>
            </select>
          </label>
        </div>

        <div className="acciones">
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : 'Calcular mi costo'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && (
        <section className="resultado" aria-live="polite">
          <div className="lectura">{r.lectura}</div>

          <dl className="cifras">
            <div><dt>Costo por prenda</dt><dd>{pesos(r.costo_por_prenda)}</dd></div>
            <div><dt>Costo del lote</dt><dd>{pesos(r.costo_del_lote)}</dd></div>
            {r.precio_minimo && (
              <>
                <div><dt>Véndela en al menos</dt><dd>{pesos(r.precio_minimo.precio_con_iva)}</dd></div>
                <div className="malo">
                  <dt>Eso es de markup, no de margen</dt>
                  <dd>{r.precio_minimo.markup_equivalente_pct}<small>%</small></dd>
                </div>
              </>
            )}
          </dl>

          <p className="diferencia">
            Se reparte así: {r.desglose_pct.map(d => `${d.concepto} ${d.pct}%`).join(' · ')}.
          </p>

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Este costo lo calculaste una vez, a mano, para un modelo. Sacs lo guarda por modelo y por
              lote, así que el costo real de fabricación —con su merma incluida— entra al inventario en
              el momento en que se recibe la corrida, y el margen que ves en reportes ya está sacado
              sobre el costo verdadero, no sobre uno aproximado en una hoja aparte.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
