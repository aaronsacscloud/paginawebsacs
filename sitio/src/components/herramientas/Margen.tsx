// La puerta WEB de margen y markup.
//
// Mismo principio que las otras tres: no calcula, llama a /api/herramientas/margen.
//
// De estilo NO reutiliza .curva sola: reutiliza también la rejilla de campos, el
// veredicto y las tarjetas de cifras que ya trae `.temporada` en el CSS global
// de la página. Ninguna herramienta de esta puerta pinta su propia hoja de
// estilos — la de aquí ya tiene formulario, campos, veredicto y tarjetas
// resueltos, y una calculadora de margen no necesita nada que esas tres formas
// no cubran ya.
//
// El ejemplo (costo $200, venta $400) es el mismo de la nota del archivo
// fuente: 50% de MARGEN, no 50% de MARKUP — la confusión que esta calculadora
// existe para evitar.
import { useState } from 'react';

type Salida = {
  precio_neto: number;
  margen_pct: number;
  markup_pct: number;
  precio_equilibrio: number;
  descuento_equilibrio_pct: number;
  ya_pierde_a_precio_lista: boolean;
  descuento?: {
    descuento_pct: number;
    precio_con_descuento: number;
    precio_neto_con_descuento: number;
    margen_pct: number;
    markup_pct: number;
    conviene: boolean;
    ganancia_o_perdida_por_pieza: number;
  };
  lectura: string;
};

const EJEMPLO = { costo: '200', precio_venta: '400', iva_pct: '16', descuento_pct: '30' };

const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

export default function Margen() {
  const [f, setF] = useState(EJEMPLO);
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [r, setR] = useState<Salida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const set = (k: keyof typeof EJEMPLO, v: string) => { setEsEjemplo(false); setF(x => ({ ...x, [k]: v })); };

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      const res = await fetch('/api/herramientas/margen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costo: Number(f.costo),
          precio_venta: Number(f.precio_venta),
          iva_pct: Number(f.iva_pct) || 16,
          descuento_pct: f.descuento_pct.trim() === '' ? undefined : Number(f.descuento_pct),
          // El visitante NO se manda desde aquí: lo lee la API de la cookie
          // `sacs_vid`, que viaja sola en cada petición.
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

  const tono = !r ? null
    : r.ya_pierde_a_precio_lista ? 'mal'
    : (r.descuento && !r.descuento.conviene) ? 'ojo'
    : 'bien';
  const etiqueta = !r ? '' : r.ya_pierde_a_precio_lista ? 'Ya vendes bajo costo'
    : (r.descuento && !r.descuento.conviene) ? 'Ese descuento ya no conviene'
    : 'Ganas margen';

  return (
    <div className="curva temporada">
      <form onSubmit={calcular}>
        {esEjemplo && (
          <p className="ejemplo-aviso">
            Estos números son un <strong>ejemplo</strong>: una prenda de $200 de costo vendida en $400.
            Cámbialos por los tuyos.
          </p>
        )}

        <div className="campos">
          <label>
            <span>Costo por prenda</span>
            <input type="number" min="0.01" step="0.01" required value={f.costo}
              onChange={e => set('costo', e.target.value)} />
            <em>Sin IVA: lo que le pagas a tu proveedor o taller por una pieza.</em>
          </label>
          <label>
            <span>Precio de venta</span>
            <input type="number" min="0.01" step="0.01" required value={f.precio_venta}
              onChange={e => set('precio_venta', e.target.value)} />
            <em>Con IVA incluido: el que va en la etiqueta o el ticket.</em>
          </label>
          <label>
            <span>IVA</span>
            <select value={f.iva_pct} onChange={e => set('iva_pct', e.target.value)}>
              <option value="16">16% — resto del país</option>
              <option value="8">8% — franja fronteriza</option>
            </select>
          </label>
          <label>
            <span>Descuento que piensas dar <i>(opcional)</i></span>
            <input type="number" min="0" max="95" value={f.descuento_pct}
              onChange={e => set('descuento_pct', e.target.value)} placeholder="30" />
            <em>Para saber si a ese % de rebaja todavía ganas o ya pierdes.</em>
          </label>
        </div>

        <div className="acciones">
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : 'Calcular mi margen'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && tono && (
        <section className="resultado" aria-live="polite">
          <div className={`veredicto ${tono}`}>
            <p className="etiqueta">{etiqueta}</p>
            <p className="frase">{r.lectura}</p>
          </div>

          <dl className="cifras">
            <div><dt>Margen</dt><dd>{r.margen_pct}<small>%</small></dd></div>
            <div><dt>Markup</dt><dd>{r.markup_pct}<small>%</small></dd></div>
            <div><dt>Precio sin IVA</dt><dd>{pesos(r.precio_neto)}</dd></div>
            <div className={r.ya_pierde_a_precio_lista ? 'malo' : ''}>
              <dt>Precio de equilibrio</dt><dd>{pesos(r.precio_equilibrio)}</dd>
            </div>
            <div><dt>Puedes rebajar hasta</dt><dd>{r.descuento_equilibrio_pct}<small>%</small></dd></div>
            {r.descuento && (
              <>
                <div className={r.descuento.conviene ? '' : 'malo'}>
                  <dt>Precio con {r.descuento.descuento_pct}% off</dt>
                  <dd>{pesos(r.descuento.precio_con_descuento)}</dd>
                </div>
                <div className={r.descuento.conviene ? '' : 'malo'}>
                  <dt>{r.descuento.conviene ? 'Ganas por pieza' : 'Pierdes por pieza'}</dt>
                  <dd>{pesos(Math.abs(r.descuento.ganancia_o_perdida_por_pieza))}</dd>
                </div>
              </>
            )}
          </dl>

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Aquí capturaste una prenda a mano. Sacs calcula margen y markup de <strong>todo</strong> tu
              catálogo en automático desde el costo y el precio que ya tienes cargados, y avisa solo
              cuando una promoción o un descuento por sucursal deja una prenda vendiéndose bajo costo
              — antes de que se autorice, no después del corte de caja.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
