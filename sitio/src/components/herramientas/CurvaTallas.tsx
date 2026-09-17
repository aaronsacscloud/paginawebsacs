// La puerta WEB del auditor de curva de tallas.
//
// Deliberadamente NO calcula nada: llama a /api/herramientas/curva-de-tallas,
// que es la misma función que atiende al MCP. Tener el cálculo también en el
// navegador sería más rápido y sería el principio del fin: dos copias del
// criterio que se separan en el primer ajuste, y el día que alguien compare la
// respuesta de ChatGPT con la del sitio verá dos números distintos.
//
// El formulario arranca CON DATOS. Un retailer que llega de una búsqueda no
// tiene ganas de teclear cinco filas para ver si la herramienta sirve: ve el
// ejemplo resuelto, entiende la idea en diez segundos y entonces mete los
// suyos. Están marcados como ejemplo para que nadie los confunda con los suyos.
import { useState } from 'react';

type Fila = { talla: string; vendidas: string; dias: string };

const EJEMPLO: Fila[] = [
  { talla: 'XS', vendidas: '4',  dias: '60' },
  { talla: 'S',  vendidas: '12', dias: '60' },
  { talla: 'M',  vendidas: '14', dias: '9'  },
  { talla: 'L',  vendidas: '11', dias: '22' },
  { talla: 'XL', vendidas: '5',  dias: '60' },
];

type Salida = {
  tallas: { talla: string; vendidas: number; demanda_real: number; dias_sin_existencia: number;
            se_agoto: boolean; estimacion_topada?: boolean; curva_ingenua: number;
            curva_corregida: number; piezas?: number }[];
  nucleo: string[]; corrida_rota: boolean; diferencia_pct: number; lectura: string;
};

export default function CurvaTallas() {
  const [filas, setFilas] = useState<Fila[]>(EJEMPLO);
  const [periodo, setPeriodo] = useState('60');
  const [compra, setCompra] = useState('60');
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
        .filter(f => f.talla.trim() && f.vendidas.trim() !== '')
        .map(f => ({
          talla: f.talla.trim(),
          vendidas: Number(f.vendidas),
          // Sin días, la herramienta asume que la talla estuvo todo el periodo
          // — que es exactamente la lectura ingenua que venimos a corregir.
          dias_con_existencia: f.dias.trim() === '' ? undefined : Number(f.dias),
        }));
      const res = await fetch('/api/herramientas/curva-de-tallas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_dias: Number(periodo) || 60,
          piezas_a_comprar: compra.trim() === '' ? undefined : Number(compra),
          tallas,
          // El visitante NO se manda desde aquí: lo lee la API de la cookie
          // `sacs_vid`, que viaja sola en cada petición. Antes se mandaba con
          // `localStorage.getItem('sacs_vid')` —que es una cookie, no una clave
          // de localStorage— y siempre iba vacío.
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

  const agotada = (t: Salida['tallas'][0]) => t.se_agoto;

  return (
    <div className="curva">
      <form onSubmit={calcular}>
        {esEjemplo && (
          <p className="ejemplo-aviso">
            Estos números son un <strong>ejemplo</strong> para que veas cómo se lee.
            Cámbialos por los tuyos.
          </p>
        )}

        <div className="periodo">
          <label>
            <span>Días que duró la temporada</span>
            <input type="number" min="1" max="3650" value={periodo}
              onChange={e => { setEsEjemplo(false); setPeriodo(e.target.value); }} required />
          </label>
          <label>
            <span>Piezas que vas a comprar <em>(opcional)</em></span>
            <input type="number" min="0" value={compra}
              onChange={e => { setEsEjemplo(false); setCompra(e.target.value); }} />
          </label>
        </div>

        <table className="entrada">
          <thead>
            <tr>
              <th scope="col">Talla</th>
              <th scope="col">Piezas vendidas</th>
              <th scope="col">Días que tuviste existencia<br /><em>en blanco = todo el periodo</em></th>
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
                <td><input aria-label={`Días con existencia de la talla ${f.talla || i + 1}`} type="number"
                  min="0" value={f.dias} onChange={e => tocar(i, 'dias', e.target.value)}
                  placeholder={periodo} /></td>
                <td>
                  {filas.length > 2 && (
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
            onClick={() => { setEsEjemplo(false); setFilas(f => [...f, { talla: '', vendidas: '', dias: '' }]); }}>
            Agregar talla
          </button>
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : 'Calcular mi curva'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && (
        <section className="resultado" aria-live="polite">
          <h2>Tu curva corregida</h2>

          <div className={`lectura ${r.corrida_rota ? 'rota' : ''}`}>{r.lectura}</div>

          <div className="tabla-scroll">
            <table className="salida">
              <thead>
                <tr>
                  <th scope="col">Talla</th>
                  <th scope="col">Vendiste</th>
                  <th scope="col">Demanda real</th>
                  <th scope="col">Curva ingenua</th>
                  <th scope="col">Curva corregida</th>
                  {r.tallas[0]?.piezas !== undefined && <th scope="col">Compra</th>}
                </tr>
              </thead>
              <tbody>
                {r.tallas.map(t => (
                  <tr key={t.talla} className={agotada(t) ? 'se-agoto' : ''}>
                    <th scope="row">
                      {t.talla}
                      {r.nucleo.includes(t.talla) && <span className="chip nucleo">núcleo</span>}
                      {agotada(t) && <span className="chip agotado">se agotó</span>}
                    </th>
                    <td>{t.vendidas}</td>
                    <td>
                      {t.demanda_real}
                      {t.estimacion_topada && <span className="tope" title="Se agotó tan pronto que proyectar su ritmo daría un número que no se sostiene: la estimación se topó en el triple de lo vendido.">tope</span>}
                    </td>
                    <td className="apagado">{t.curva_ingenua}%</td>
                    <td className="fuerte">{t.curva_corregida}%</td>
                    {t.piezas !== undefined && <td className="fuerte">{t.piezas}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="diferencia">
            Leer los agotamientos cambia tu compra en <strong>{r.diferencia_pct}%</strong> de las piezas.
            {r.diferencia_pct === 0 && ' Ninguna talla se te agotó antes de tiempo: tu lectura de siempre ya era la correcta.'}
          </p>

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Aquí los días de agotamiento los pusiste tú, de memoria o de un reporte.
              Sacs los <strong>registra solos</strong>: sabe desde qué momento cada talla
              de cada tienda estuvo en cero, sin que nadie lo anote. Esa es la diferencia
              entre hacer este cálculo una vez al año y tenerlo en cada orden de compra.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
