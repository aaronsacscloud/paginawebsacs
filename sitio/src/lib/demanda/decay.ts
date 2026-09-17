// DEMAND ENGINE · qué contenido se está muriendo.
//
// Una página que hace seis meses traía gente y hoy no, es la oportunidad más
// barata que existe: ya está escrita, ya está indexada, ya tiene enlaces. Pero
// nadie la mira, porque una página que baja no rompe nada — simplemente deja de
// aparecer, y eso no tiene síntoma.
//
// LA CORRECCIÓN QUE HACE HONESTO EL NÚMERO, y sin la cual esto sería un
// generador de alarmas falsas:
//
//   Una página que cae 30% mientras TODO el sitio cae 30% no está decayendo:
//   es la temporada, o un cambio del buscador, o que se acabó el mes fuerte del
//   ramo. Comparar cada página contra cero la condena; compararla contra el
//   movimiento del propio sitio aísla lo que de verdad le pasa a ELLA.
//
// En moda esto no es un detalle académico: el tráfico del ramo se mueve con las
// temporadas, y un sistema que no lo descuenta avisaría cada enero de que todo
// se está muriendo.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { traerTodo } from './paginar';
import { diaCdmx } from './fechas';
import type { ResultadoHandler } from './tipos';

/** Ventana de comparación. 28 días y no 30: así siempre son cuatro semanas
 *  completas y el mismo número de fines de semana a cada lado. */
const VENTANA = 28;

/** Debajo de esto no se opina. Una página que pasó de 3 impresiones a 1 cayó
 *  «66%», y eso no es una señal: es ruido con porcentaje. */
const MINIMO_IMPRESIONES = 50;

export type Decaimiento = {
  pagina: string;
  impresiones_antes: number;
  impresiones_ahora: number;
  clics_antes: number;
  clics_ahora: number;
  /** Cambio de la página, en puntos porcentuales. */
  cambio_pct: number;
  /** Cambio del sitio entero en la misma ventana. */
  cambio_sitio_pct: number;
  /** Lo que le pasa a ELLA, descontado el movimiento del sitio. */
  cambio_relativo_pct: number;
  posicion_antes: number | null;
  posicion_ahora: number | null;
};

export async function detectar(): Promise<{ sitio_pct: number; decaen: Decaimiento[]; muestra_desde: string; otros_subdominios: string[] }> {
  // Se parte del último día CON DATOS, no de hoy: Search Console va dos o tres
  // días atrasado, y medir contra hoy mete una ventana medio vacía que hace
  // parecer que todo se cayó.
  const { data: ult } = await supabase.from('de_gsc_diario')
    .select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle();
  if (!ult?.fecha) return { sitio_pct: 0, decaen: [], muestra_desde: '', otros_subdominios: [] };

  const fin = new Date(ult.fecha + 'T12:00:00Z');
  const d = (n: number) => new Date(fin.getTime() - n * 864e5).toISOString().slice(0, 10);
  const inicioAhora = d(VENTANA);
  const inicioAntes = d(VENTANA * 2);

  const filas = await traerTodo<any>('de_gsc_diario', 'fecha, pagina, clics, impresiones, posicion',
    q => q.gte('fecha', inicioAntes).lte('fecha', ult.fecha), 200_000, 'fecha');

  type Acum = { cAntes: number; cAhora: number; iAntes: number; iAhora: number; pAntes: number[]; pAhora: number[] };
  const porPagina = new Map<string, Acum>();
  const sitio: Acum = { cAntes: 0, cAhora: 0, iAntes: 0, iAhora: 0, pAntes: [], pAhora: [] };

  for (const f of filas) {
    const reciente = f.fecha > inicioAhora;
    const a = porPagina.get(f.pagina) || { cAntes: 0, cAhora: 0, iAntes: 0, iAhora: 0, pAntes: [], pAhora: [] };
    const c = Number(f.clics || 0), i = Number(f.impresiones || 0), p = Number(f.posicion || 0);
    if (reciente) { a.cAhora += c; a.iAhora += i; if (p) a.pAhora.push(p); sitio.cAhora += c; sitio.iAhora += i; }
    else          { a.cAntes += c; a.iAntes += i; if (p) a.pAntes.push(p); sitio.cAntes += c; sitio.iAntes += i; }
    porPagina.set(f.pagina, a);
  }

  const cambio = (antes: number, ahora: number) => antes > 0 ? ((ahora - antes) / antes) * 100 : (ahora > 0 ? 100 : 0);
  const media = (xs: number[]) => xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;

  const sitioPct = cambio(sitio.iAntes, sitio.iAhora);

  /* Dos exclusiones que evitan alarmas que ya sabemos que son falsas.

     1. Lo que NOSOTROS sacamos del índice. `/prueba-gratis` pasó de 68
        impresiones a 0 el día que se le puso `noindex` — a propósito, porque
        era un formulario de 34 palabras. Reportarlo como «decaimiento» es
        avisar de una decisión propia, y un aviso así se repite cada mes hasta
        que alguien aprende a ignorar la lista entera.

     2. Otros subdominios. En Search Console aparecen `app.sacscloud.com` y
        `middle.sacscloud.com`, que rankean de verdad —936 y 835 impresiones—
        pero no son contenido que este motor gestione. Se apartan en vez de
        mezclarse: un dato real que no se puede accionar desde aquí ensucia una
        lista cuyo valor es que todo lo que tiene se puede arreglar. */
  const { NO_INDEXABLES } = await import('../../data/no-indexables');
  const fueraDelIndice = (u: string) => {
    let ruta: string; try { ruta = new URL(u).pathname; } catch { return false; }
    return NO_INDEXABLES.some(n => typeof n === 'string' ? ruta.startsWith(n) : n.test(ruta));
  };
  const esNuestro = (u: string) => { try { return new URL(u).hostname === 'www.sacscloud.com'; } catch { return false; } };

  const decaen: Decaimiento[] = [];
  const otrosSubdominios: string[] = [];

  for (const [pagina, a] of porPagina) {
    if (a.iAntes < MINIMO_IMPRESIONES) continue;   // ruido con porcentaje
    if (!esNuestro(pagina)) { if (a.iAntes >= 200) otrosSubdominios.push(pagina); continue; }
    if (fueraDelIndice(pagina)) continue;          // lo sacamos nosotros

    const pct = cambio(a.iAntes, a.iAhora);
    // Descontar el movimiento del sitio es la línea que separa «esta página se
    // está muriendo» de «es enero».
    const relativo = pct - sitioPct;

    // Solo cuenta si cae de verdad Y cae MÁS que el resto. Una página que baja
    // 10% cuando el sitio baja 40% está, en realidad, aguantando.
    if (pct >= -20 || relativo >= -15) continue;

    decaen.push({
      pagina,
      impresiones_antes: a.iAntes, impresiones_ahora: a.iAhora,
      clics_antes: a.cAntes, clics_ahora: a.cAhora,
      cambio_pct: Math.round(pct * 10) / 10,
      cambio_sitio_pct: Math.round(sitioPct * 10) / 10,
      cambio_relativo_pct: Math.round(relativo * 10) / 10,
      posicion_antes: media(a.pAntes), posicion_ahora: media(a.pAhora),
    });
  }

  decaen.sort((a, b) => a.cambio_relativo_pct - b.cambio_relativo_pct);
  return { sitio_pct: Math.round(sitioPct * 10) / 10, decaen, muestra_desde: inicioAntes, otros_subdominios: otrosSubdominios };
}

registrar('detectar.decay', async (): Promise<ResultadoHandler> => {
  const { sitio_pct, decaen, muestra_desde, otros_subdominios } = await detectar();
  if (!muestra_desde) return { ok: true, resumen: 'sin datos de Search Console todavía' };

  const ahora = new Date().toISOString();
  let nuevos = 0;

  for (const x of decaen.slice(0, 20)) {
    /* La clave lleva el mes, no el día: una página que decae lo hace durante
       semanas, y un hallazgo nuevo cada mañana por lo mismo convierte la lista
       en ruido. Una vez al mes es cuando de verdad hay algo nuevo que decir. */
    const { error } = await supabase.from('de_issues').upsert({
      clave_idem: `decay:${x.pagina}:${diaCdmx().slice(0, 7)}`,
      tipo: 'decaimiento',
      severidad: x.cambio_relativo_pct < -50 ? 'alta' : 'media',
      url: x.pagina,
      detalle: x,
      estado: 'abierto',
      visto_ultima: ahora,
    }, { onConflict: 'clave_idem' });
    if (!error) nuevos++;
    else console.error(`[decay] no se pudo guardar ${x.pagina}: ${error.message}`);
  }

  /* Los subdominios que rankean y no gestionamos se registran como hallazgo.
     No es decaimiento, pero es lo mismo de fondo: tráfico nuestro que nadie
     está mirando. Y aquí salieron dos cosas que valía la pena encontrar —un
     entorno de desarrollo abierto a Google y un dominio con una letra de menos
     llevándose clics—, así que la comprobación se queda. */
  for (const host of new Set(otros_subdominios.map(u => { try { return new URL(u).hostname; } catch { return u; } }))) {
    const { error } = await supabase.from('de_issues').upsert({
      clave_idem: `subdominio:${host}:${diaCdmx().slice(0, 7)}`,
      tipo: 'subdominio_indexado',
      // Alta si es de desarrollo o un typo del dominio: lo primero puede filtrar
      // estado interno, lo segundo se lleva clics que eran del sitio bueno.
      severidad: /^(dev|test|staging)\.|^ww\./.test(host) ? 'alta' : 'baja',
      url: `https://${host}/`,
      detalle: { host, nota: 'Aparece en Search Console y no es contenido que el motor gestione. Revisar si debe estar indexado.' },
      estado: 'abierto',
      visto_ultima: ahora,
    }, { onConflict: 'clave_idem' });
    if (error) console.error(`[decay] no se pudo anotar el subdominio ${host}: ${error.message}`);
  }

  return {
    ok: true,
    resumen: decaen.length
      ? `${decaen.length} página(s) cayendo más que el sitio (el sitio ${sitio_pct >= 0 ? '+' : ''}${sitio_pct}%) · ${nuevos} anotadas`
      : `ninguna página cae más que el sitio (el sitio ${sitio_pct >= 0 ? '+' : ''}${sitio_pct}% en ${VENTANA} días)`,
    datos: { sitio_pct, cuantas: decaen.length, top: decaen.slice(0, 5), otros_subdominios },
  };
});
