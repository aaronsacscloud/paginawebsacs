// La puerta WEB de «¿vas a sacar este estilo a tiempo?».
//
// Como la del auditor de curva: no calcula, llama a la API. El criterio vive en
// un solo lugar y las tres puertas contestan lo mismo.
//
// La diferencia de forma con la otra herramienta es deliberada: aquí la salida
// NO es una tabla, es un veredicto. Un comprador que abre esto tiene una
// pregunta binaria en la cabeza —¿rebajo o no rebajo?— y enterrar la respuesta
// entre seis métricas es hacerle el trabajo más difícil, no más completo. El
// veredicto va arriba y grande; los números que lo sostienen, debajo.
import { useState } from 'react';

type Salida = {
  sell_through: number; ritmo_semanal: number; existencia: number;
  semanas_de_cobertura: number | null; sobrante_proyectado: number;
  dinero_atrapado: number | null; aceleracion_necesaria: number | null;
  semana_limite: number | null;
  veredicto: 'sale_solo' | 'ajustado' | 'no_sale' | 'ya_se_acabo' | 'muy_pronto';
  lectura: string;
};

// El ejemplo no es un caso feliz a propósito: enseñar la herramienta
// contestando «va bien» no deja ver para qué sirve.
const EJEMPLO = { recibidas: '200', vendidas: '60', transcurridas: '6', restantes: '6', costo: '180' };

const TONO: Record<Salida['veredicto'], { etiqueta: string; clase: string }> = {
  sale_solo:   { etiqueta: 'Sale solo',            clase: 'bien' },
  ajustado:    { etiqueta: 'Sale raspando',        clase: 'ojo' },
  no_sale:     { etiqueta: 'No sale al ritmo de hoy', clase: 'mal' },
  ya_se_acabo: { etiqueta: 'Se acabó',             clase: 'bien' },
  muy_pronto:  { etiqueta: 'Todavía es pronto',    clase: 'neutro' },
};

const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export default function Temporada() {
  const [f, setF] = useState(EJEMPLO);
  const [acel, setAcel] = useState('2');
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [r, setR] = useState<Salida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const set = (k: keyof typeof EJEMPLO, v: string) => { setEsEjemplo(false); setF(x => ({ ...x, [k]: v })); };

  async function calcular(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      const res = await fetch('/api/herramientas/sale-o-no-sale', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recibidas: Number(f.recibidas), vendidas: Number(f.vendidas),
          semanas_transcurridas: Number(f.transcurridas), semanas_restantes: Number(f.restantes),
          costo_unitario: f.costo.trim() === '' ? undefined : Number(f.costo),
          aceleracion_max: Number(acel) || 2,
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

  const t = r ? TONO[r.veredicto] : null;

  return (
    <div className="curva temporada">
      <form onSubmit={calcular}>
        {esEjemplo && (
          <p className="ejemplo-aviso">
            Estos números son un <strong>ejemplo</strong> de un estilo que va atrasado.
            Cámbialos por los tuyos.
          </p>
        )}

        <div className="campos">
          <label>
            <span>Piezas que recibiste</span>
            <input type="number" min="1" required value={f.recibidas}
              onChange={e => set('recibidas', e.target.value)} />
            <em>De ese estilo, todas las tallas juntas.</em>
          </label>
          <label>
            <span>Piezas vendidas</span>
            <input type="number" min="0" required value={f.vendidas}
              onChange={e => set('vendidas', e.target.value)} />
            <em>Hasta hoy.</em>
          </label>
          <label>
            <span>Semanas en piso</span>
            <input type="number" min="0.5" step="0.5" required value={f.transcurridas}
              onChange={e => set('transcurridas', e.target.value)} />
            <em>Las que lleva a la venta.</em>
          </label>
          <label>
            <span>Semanas que quedan</span>
            <input type="number" min="0" required value={f.restantes}
              onChange={e => set('restantes', e.target.value)} />
            <em>Hasta que deje de venderse a precio normal.</em>
          </label>
          <label>
            <span>Costo por pieza <i>(opcional)</i></span>
            <input type="number" min="0" value={f.costo}
              onChange={e => set('costo', e.target.value)} />
            <em>Para decirte cuánto dinero queda parado.</em>
          </label>
          <label>
            <span>Qué tanto puedes acelerar</span>
            <select value={acel} onChange={e => { setEsEjemplo(false); setAcel(e.target.value); }}>
              <option value="1.5">1.5× — mi mercado responde poco</option>
              <option value="2">2× — lo normal con una rebaja</option>
              <option value="3">3× — respondo fuerte a promociones</option>
            </select>
            <em>Es un supuesto tuyo, no un dato: cambia cuál es tu última semana útil.</em>
          </label>
        </div>

        <div className="acciones">
          <button type="submit" className="primario" disabled={cargando}>
            {cargando ? 'Calculando…' : '¿Sale o no sale?'}
          </button>
        </div>
        <p className="privacidad">Tus números no se guardan. El cálculo se hace y se olvida.</p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {r && t && (
        <section className="resultado" aria-live="polite">
          <div className={`veredicto ${t.clase}`}>
            <p className="etiqueta">{t.etiqueta}</p>
            <p className="frase">{r.lectura}</p>
          </div>

          <dl className="cifras">
            <div><dt>Sell-through</dt><dd>{r.sell_through}%</dd></div>
            <div><dt>Ritmo</dt><dd>{r.ritmo_semanal}<small> pz/sem</small></dd></div>
            <div><dt>Te quedan</dt><dd>{r.existencia}<small> pz</small></dd></div>
            {r.semanas_de_cobertura !== null && (
              <div><dt>Cobertura</dt><dd>{r.semanas_de_cobertura}<small> sem</small></dd></div>
            )}
            {r.sobrante_proyectado > 0 && (
              <div className="malo"><dt>Sobrante mínimo</dt><dd>{r.sobrante_proyectado}<small> pz</small></dd></div>
            )}
            {r.dinero_atrapado ? (
              <div className="malo"><dt>Dinero parado</dt><dd>{pesos(r.dinero_atrapado)}</dd></div>
            ) : null}
            {r.aceleracion_necesaria !== null && r.aceleracion_necesaria > 1 && (
              // La etiqueta carga la explicación y la cifra queda de una línea:
              // con «2.3× más rápido» dentro del dd, la última tarjeta rompía en
              // dos renglones y se quedaba sola en su fila.
              <div><dt>Vender más rápido</dt><dd>{r.aceleracion_necesaria}×</dd></div>
            )}
            {r.semana_limite !== null && (
              <div><dt>Actúa antes de</dt><dd>{r.semana_limite}<small> sem</small></dd></div>
            )}
          </dl>

          <p className="piso">
            El sobrante es un <strong>piso</strong>, no un techo: la cuenta supone que sigues
            vendiendo al mismo ritmo, y en moda el ritmo baja conforme avanza la temporada.
            Lo normal es que sobre más, no menos.
          </p>

          {(r.veredicto === 'no_sale' || r.veredicto === 'ya_se_acabo') && (
            <p className="cruce">
              Antes de rebajar: revisa <a href="/herramientas/curva-de-tallas">qué tallas son las que te
              quedan</a>. Un estilo «al 30%» puede ser centro agotado y extremos intactos — y ahí una
              rebaja no arregla nada, porque lo que sobra no lo iba a comprar nadie a ningún precio.
            </p>
          )}

          <aside className="con-sacs">
            <h3>Qué hace Sacs que esta herramienta no puede</h3>
            <p>
              Aquí escribiste un estilo. Sacs lleva esta cuenta de <strong>todos</strong> tus estilos
              al mismo tiempo, con los recibos y las ventas reales de cada tienda, y te avisa cuando
              uno cruza su semana límite — que es el único momento en que el dato sirve. Un cálculo
              que hay que acordarse de hacer es un cálculo que no se hace.
            </p>
            <a className="primario" href="/prueba-gratis">Probar Sacs gratis</a>
          </aside>
        </section>
      )}
    </div>
  );
}
