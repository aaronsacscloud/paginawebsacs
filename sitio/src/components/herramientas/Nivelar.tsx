// La puerta WEB de «qué mover entre tus tiendas».
//
// El problema de forma de esta herramienta: pide una MATRIZ (tiendas × tallas),
// y una matriz escrita a mano en un formulario es donde la gente abandona. Por
// eso hay dos maneras de meterla y la segunda es la importante:
//
//   · la rejilla, para probar con el ejemplo y para cambiar un número suelto;
//   · **pegar desde Excel**, que es donde el dato ya vive. Nadie tiene la
//     existencia por talla y tienda en la cabeza; la tiene en una hoja, y
//     copiar-pegar es un gesto que ya sabe hacer.
//
// El pegado acepta lo que de verdad sale de una hoja de cálculo: tabuladores o
// comas, con o sin encabezado, y con la primera columna como nombre de tienda.
import { useState } from 'react';

type Salida = {
  nucleo: string[]; nucleo_supuesto: boolean;
  rotas_antes: string[]; rotas_despues: string[];
  movimientos: { de: string; a: string; talla: string; piezas: number; repara: boolean }[];
  piezas_movidas: number;
  faltantes_en_la_cadena: { talla: string; piezas_faltantes: number }[];
  lectura: string;
};

const EJ_TALLAS = ['XS', 'S', 'M', 'L', 'XL'];
const EJ_TIENDAS = [
  { nombre: 'Centro',   ex: ['6', '3', '0', '0', '5'] },
  { nombre: 'Norte',    ex: ['1', '4', '9', '7', '2'] },
  { nombre: 'Galerías', ex: ['0', '2', '5', '6', '1'] },
];

/* Lo que sale de copiar un rango de Excel son líneas con tabuladores. Se acepta
   también la coma y el punto y coma porque la gente pega de todo, y se descarta
   una primera fila cuyas celdas numéricas no sean números: eso es el encabezado
   de tallas, y de ahí se toman las tallas en vez de tirarlas. */
function parsearPegado(texto: string): { tallas: string[]; tiendas: { nombre: string; ex: string[] }[] } | null {
  const lineas = texto.trim().split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return null;
  const celdas = lineas.map(l => l.split(/\t|;|,/).map(c => c.trim()));

  const esNum = (c: string) => c !== '' && !Number.isNaN(Number(c));
  const primera = celdas[0];

  /* Detectar el encabezado por «tiene alguna celda no numérica» falla justo en
     el caso mexicano más común: en calzado las tallas SON números (23, 23.5,
     24), así que la fila de encabezado se leía como una tienda llamada «tienda»
     y las tallas salían T1, T2, T3. Medido pegando una tabla de calzado real.

     Se agrega la señal que sí distingue: cómo se llama la primera celda. Una
     hoja de existencias encabeza esa columna con «tienda», «sucursal», «plaza»
     o la deja vacía. Y si aun así se equivoca, la persona lo ve: el resultado
     del pegado cae en la rejilla, que es editable — el pegado propone, la
     rejilla confirma. */
  const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  /* Solo palabras que NADIE le pone de nombre a una tienda. «Plaza», «Local»,
     «Bodega» y «Almacén» estaban aquí y rompían el caso contrario: una tabla sin
     encabezado cuya primera tienda se llama «Plaza» —que en México son
     cientos— perdía su primera fila, convertida en encabezado. Entre equivocarse
     comiéndose una tienda y equivocarse dejando las tallas sin nombre, lo
     segundo se ve y se corrige en la rejilla; lo primero desaparece sin ruido. */
  const ETIQUETAS = ['', 'tienda', 'tiendas', 'sucursal', 'sucursales',
                     'store', 'pdv', 'punto de venta', 'modelo', 'estilo', 'talla', 'tallas'];
  const primeraEsEncabezado =
    ETIQUETAS.includes(sinAcentos(primera[0] ?? '')) ||
    primera.slice(1).some(c => !esNum(c));

  /* Sin `filter(Boolean)`: una celda de encabezado vacía a media tabla —pasa al
     copiar un rango con una columna separadora— borraba esa talla de la lista y
     recorría TODAS las siguientes una posición. Las cantidades quedaban
     pegadas a la talla equivocada y el resultado salía coherente, con sus
     movimientos y todo, pero mal. Se conserva la posición y se le pone nombre
     provisional, que la persona ve y corrige en la rejilla. */
  const tallas = primeraEsEncabezado
    ? primera.slice(1).map((c, i) => c || `T${i + 1}`)
    : primera.slice(1).map((_, i) => `T${i + 1}`);

  const filas = primeraEsEncabezado ? celdas.slice(1) : celdas;
  const tiendas = filas
    .filter(f => f.length >= 2 && f[0])
    .map(f => ({
      nombre: f[0],
      ex: tallas.map((_, i) => (esNum(f[i + 1]) ? f[i + 1] : '0')),
    }));

  if (!tallas.length || tiendas.length < 2) return null;
  return { tallas, tiendas };
}

export default function Nivelar() {
  const [tallas, setTallas] = useState<string[]>(EJ_TALLAS);
  const [tiendas, setTiendas] = useState(EJ_TIENDAS);
  const [nucleo, setNucleo] = useState<string[]>([]);
  const [minimo, setMinimo] = useState('2');
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [pegando, setPegando] = useState(false);
  const [pegado, setPegado] = useState('');
  const [r, setR] = useState<Salida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const tocar = () => setEsEjemplo(false);

  function aplicarPegado() {
    const p = parsearPegado(pegado);
    if (!p) {
      setError('No pude leer eso. Necesito una fila por tienda: el nombre y luego una columna por talla.');
      return;
    }
    setTallas(p.tallas); setTiendas(p.tiendas); setNucleo([]);
    setEsEjemplo(false); setPegando(false); setPegado(''); setError(null); setR(null);
  }

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      const res = await fetch('/api/herramientas/nivelar-entre-tiendas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tallas,
          tiendas: tiendas.map(t => ({ nombre: t.nombre, existencia: t.ex.map(v => Number(v) || 0) })),
          nucleo: nucleo.length ? nucleo : undefined,
          minimo_por_talla: Number(minimo) || 2,
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

  return (
    <div className="curva nivelar">
      <form onSubmit={calcular}>
        {esEjemplo && (
          <p className="ejemplo-aviso">
            Estos números son un <strong>ejemplo</strong>: a Centro le faltan la M y la L.
            Cámbialos, o pega tu tabla desde Excel.
          </p>
        )}

        <div className="modo">
          <button type="button" className={pegando ? 'secundario' : 'activo'} onClick={() => setPegando(false)}>
            Escribirlo aquí
          </button>
          <button type="button" className={pegando ? 'activo' : 'secundario'} onClick={() => setPegando(true)}>
            Pegar desde Excel
          </button>
        </div>

        {pegando ? (
          <div className="pegar">
            <label htmlFor="nv-pegar">
              Copia el rango de tu hoja y pégalo aquí. Una fila por tienda: el nombre
              en la primera columna y una columna por talla.
            </label>
            <textarea id="nv-pegar" rows={6} value={pegado} placeholder={`tienda\tXS\tS\tM\tL\tXL\nCentro\t6\t3\t0\t0\t5\nNorte\t1\t4\t9\t7\t2`}
              onChange={e => setPegado(e.target.value)} />
            <button type="button" className="secundario" onClick={aplicarPegado}>Leer la tabla</button>
          </div>
        ) : (
          <div className="tabla-scroll">
            <table className="matriz">
              <thead>
                <tr>
                  <th scope="col">Tienda</th>
                  {tallas.map((t, i) => (
                    <th scope="col" key={i}>
                      <input aria-label={`Nombre de la talla ${i + 1}`} value={t}
                        onChange={e => { tocar(); setTallas(x => x.map((v, j) => j === i ? e.target.value : v)); }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiendas.map((s, si) => (
                  <tr key={si}>
                    <th scope="row">
                      <input aria-label={`Nombre de la tienda ${si + 1}`} value={s.nombre}
                        onChange={e => { tocar(); setTiendas(x => x.map((v, j) => j === si ? { ...v, nombre: e.target.value } : v)); }} />
                    </th>
                    {tallas.map((_, ti) => (
                      <td key={ti}>
                        <input type="number" min="0" aria-label={`${s.nombre}, talla ${tallas[ti]}`}
                          value={s.ex[ti] ?? '0'}
                          onChange={e => { tocar(); setTiendas(x => x.map((v, j) => j === si
                            ? { ...v, ex: tallas.map((__, k) => k === ti ? e.target.value : (v.ex[k] ?? '0')) }
                            : v)); }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!pegando && (
          <div className="acciones">
            <button type="button" className="secundario"
              onClick={() => { tocar(); setTiendas(x => [...x, { nombre: '', ex: tallas.map(() => '0') }]); }}>
              Agregar tienda
            </button>
            <button type="button" className="secundario"
              onClick={() => { tocar(); setTallas(x => [...x, '']); setTiendas(x => x.map(s => ({ ...s, ex: [...s.ex, '0'] }))); }}>
              Agregar talla
            </button>
          </div>
        )}

        <fieldset className="nucleo">
          <legend>El centro de tu corrida <em>(opcional)</em></legend>
          <p className="ayuda">
            Las tallas donde haces la mayor parte de tu venta. Si no lo dices, tomo las
            tres de en medio — y eso cambia el resultado por completo.
          </p>
          <div className="chips">
            {tallas.filter(Boolean).map((t, i) => (
              <label key={i} className={nucleo.includes(t) ? 'chip on' : 'chip'}>
                <input type="checkbox" checked={nucleo.includes(t)}
                  onChange={e => { tocar(); setNucleo(x => e.target.checked ? [...x, t] : x.filter(v => v !== t)); }} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="minimo">
          <span>Mínimo por talla en cada tienda</span>
          <input type="number" min="1" max="20" value={minimo}
            onChange={e => { tocar(); setMinimo(e.target.value); }} />
          <em>Con una sola pieza la talla se agota con la primera venta y la corrida se rompe el mismo día.</em>
        </label>

        <div className="acciones">
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : '¿Qué muevo?'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && (
        <section className="resultado" aria-live="polite">
          <div className={`lectura ${r.rotas_despues.length ? 'rota' : ''}`}>{r.lectura}</div>

          {r.movimientos.length > 0 && (
            <>
              <h3>Los movimientos</h3>
              <ul className="movs">
                {r.movimientos.map((m, i) => (
                  <li key={i}>
                    <span className="pz">{m.piezas}</span>
                    <span className="tl">talla {m.talla}</span>
                    <span className="ruta">{m.de} <b>→</b> {m.a}</span>
                  </li>
                ))}
              </ul>
              <p className="total">
                {r.piezas_movidas} {r.piezas_movidas === 1 ? 'pieza' : 'piezas'} en total.
                Cada traspaso de esta lista deja la tienda que lo recibe con la corrida
                <strong> completa</strong>: no se propone mover nada que no termine el trabajo,
                porque media reparación es flete pagado sin venta ganada.
              </p>
            </>
          )}

          {r.faltantes_en_la_cadena.length > 0 && (
            <div className="comprar">
              <h3>Esto no se mueve: se compra</h3>
              <p>Ni juntando toda la cadena alcanza para que cada tienda llegue a su mínimo.</p>
              <ul>
                {r.faltantes_en_la_cadena.map((f, i) => (
                  <li key={i}>Talla <strong>{f.talla}</strong>: faltan {f.piezas_faltantes} piezas</li>
                ))}
              </ul>
            </div>
          )}

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Esto lo corriste con un modelo, copiado a mano. Sacs ve la existencia por talla
              de <strong>todos</strong> tus modelos en <strong>todas</strong> tus tiendas, en vivo,
              y avisa cuando una corrida se rompe — no cuando alguien se acuerda de revisarla.
              Y el centro de la corrida no lo supone: lo sabe, porque también tiene la venta por
              talla de cada tienda.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
