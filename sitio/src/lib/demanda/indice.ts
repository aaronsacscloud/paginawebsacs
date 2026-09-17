// DEMAND ENGINE · el Índice Sacs de Retail de Moda.
//
// Por qué existe: de todo lo que el motor puede hacer para que una IA nos cite,
// esto es lo único que ningún competidor puede copiar. Un artículo sobre curva
// de tallas lo escribe cualquiera con un buen prompt. «El ticket mediano de las
// tiendas de moda en México es de $X» solo lo puede decir quien tiene las cajas.
//
// Tres reglas que el código hace cumplir, no el buen juicio de quien lo corra:
//
//   1. **Mínimo 20 empresas por cifra.** Debajo de eso la cifra no se publica
//      con una advertencia: no se publica. Con pocas empresas, quien conozca el
//      mercado puede reconstruir de quién se está hablando.
//   2. **Solo operando.** Una cuenta dormida no es una tienda del mercado. Sin
//      este filtro la mediana de días sin venta daba p90 = 271 días, que es una
//      estadística sobre NUESTRA baja de clientes disfrazada de dato del ramo.
//      Publicar eso sería mentir y quedar mal a la vez.
//   3. **Nada identificable sale de aquí.** Ni nombres de cuenta (el jsonb
//      `uso` los trae en `cuentas`), ni cifras de una sola empresa. Solo
//      distribuciones y porcentajes sobre el conjunto.
import { supabase } from '../supabase';

/** Debajo de esto una cifra NO se publica. No es un umbral de significancia
 *  estadística, es uno de anonimato: con pocas empresas, quien conoce el
 *  mercado adivina de quién se habla. */
export const MIN_EMPRESAS = 20;

/** Qué cuenta como tienda operando. Se guarda con cada edición porque si esto
 *  cambia, las ediciones dejan de ser comparables — y esa es de las cosas que se
 *  descubren un año después, comparando manzanas con peras. */
export const OPERANDO = {
  regla: 'ventas_30d > 0 y dias_sin_venta <= 30',
  porque: 'Una cuenta que no ha vendido en un mes no es una tienda del mercado: es una cuenta dormida, y meterla al promedio convierte el índice en un reporte de nuestra propia baja de clientes.',
};

export type Metrica = {
  clave: string;
  titulo: string;
  /** Qué significa, en lenguaje del ramo. Es lo que una IA va a leer y citar. */
  que_es: string;
  valor: number | null;
  unidad: 'pesos' | 'pct' | 'dias' | 'conteo';
  /** Distribución cuando la hay: una mediana sola engaña en un mercado disparejo. */
  p25?: number | null;
  p75?: number | null;
  n: number;
};

export type Edicion = {
  edicion: string;
  corte: string;
  n_empresas: number;
  metricas: { generales: Metrica[]; adopcion: { modulo: string; familia: string; pct: number; n: number }[] };
  definicion: typeof OPERANDO & { min_empresas: number; fuente: string };
};

/* Los percentiles se calculan en JavaScript y no en SQL a propósito. La muestra
   es de decenas de empresas, no de millones de filas, así que no hay nada que
   optimizar — y en cambio se gana lo que importa aquí: las reglas de anonimato
   (el mínimo de empresas, el filtro de «operando», el redondeo) viven en el
   mismo archivo que las explica, en vez de repartidas en cadenas de SQL donde
   nadie las vuelve a leer. */
export async function calcular(corte = new Date()): Promise<Edicion> {
  const fecha = corte.toISOString().slice(0, 10);

  const { data: g, error: e1 } = await supabase
    .from('uso_snapshots')
    .select('company_id, fecha, ventas_30d, total_30d, dias_sin_venta, conteos_7d, transferencias_7d, usuarios_operando')
    .gte('fecha', new Date(corte.getTime() - 7 * 864e5).toISOString().slice(0, 10))
    .order('fecha', { ascending: false });
  if (e1) throw new Error(`[indice] ${e1.message}`);

  // Última foto de cada empresa dentro de la ventana.
  const ultima = new Map<string, any>();
  for (const f of g || []) if (!ultima.has(f.company_id)) ultima.set(f.company_id, f);

  const operando = [...ultima.values()].filter(f => f.ventas_30d > 0 && f.dias_sin_venta <= 30);
  const n = operando.length;

  const pct = (cuantos: number) => Math.round((cuantos / n) * 100);
  const cuantil = (xs: number[], q: number) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const i = (s.length - 1) * q;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  // El ticket se redondea a decenas. No cambia la lectura y quita el último
  // resquicio de reconstrucción a partir de cifras demasiado exactas.
  const aDecena = (x: number | null) => x === null ? null : Math.round(x / 10) * 10;

  const tickets = operando.map(f => Number(f.total_30d) / f.ventas_30d).filter(Number.isFinite);
  const sinVenta = operando.map(f => f.dias_sin_venta);
  const ventas = operando.map(f => f.ventas_30d);

  const generales: Metrica[] = n < MIN_EMPRESAS ? [] : [
    {
      clave: 'ticket', titulo: 'Ticket promedio', unidad: 'pesos',
      que_es: 'Lo que gasta una clienta en una compra. Mediana entre las tiendas que operan, no promedio del mercado: unas cuantas tiendas caras mueven un promedio y no mueven una mediana.',
      valor: aDecena(cuantil(tickets, 0.5)), p25: aDecena(cuantil(tickets, 0.25)), p75: aDecena(cuantil(tickets, 0.75)), n,
    },
    {
      clave: 'tickets_mes', titulo: 'Tickets al mes', unidad: 'conteo',
      que_es: 'Cuántas ventas levanta una tienda en 30 días. La mediana, para que una cadena grande no arrastre la cifra.',
      valor: Math.round(cuantil(ventas, 0.5) ?? 0), p25: Math.round(cuantil(ventas, 0.25) ?? 0), p75: Math.round(cuantil(ventas, 0.75) ?? 0), n,
    },
    {
      clave: 'dias_sin_venta', titulo: 'Días seguidos sin vender', unidad: 'dias',
      que_es: 'Cuántos días lleva una tienda sin registrar una sola venta. Entre las que operan es casi siempre cero: una tienda de moda abierta vende todos los días.',
      valor: cuantil(sinVenta, 0.5), p75: cuantil(sinVenta, 0.75), n,
    },
    {
      clave: 'conteo_fisico', titulo: 'Hizo conteo físico esta semana', unidad: 'pct',
      que_es: 'Porcentaje de tiendas que contó inventario en los últimos 7 días. El inventario de una tienda de moda se descuadra cada semana; contarlo una vez al año es descubrir el faltante cuando ya no se puede hacer nada.',
      valor: pct(operando.filter(f => (f.conteos_7d ?? 0) > 0).length), n,
    },
    {
      clave: 'transferencias', titulo: 'Movió mercancía entre tiendas esta semana', unidad: 'pct',
      que_es: 'Porcentaje de tiendas que traspasó producto a otra sucursal en 7 días. Mover es la mitad del trabajo: la otra mitad es saber QUÉ mover, y ahí es donde casi nadie tiene método.',
      valor: pct(operando.filter(f => (f.transferencias_7d ?? 0) > 0).length), n,
    },
  ];

  // Adopción por módulo: la foto más reciente de cada empresa que traiga `uso`.
  const { data: u, error: e2 } = await supabase
    .from('uso_snapshots')
    .select('company_id, fecha, uso')
    .gte('fecha', new Date(corte.getTime() - 14 * 864e5).toISOString().slice(0, 10))
    .not('uso', 'is', null)
    .order('fecha', { ascending: false });
  if (e2) throw new Error(`[indice] ${e2.message}`);

  /* La adopción se mide SOLO sobre las que operan, igual que todo lo demás.
     La primera versión usaba «toda empresa con datos de uso» y metía cuentas
     dormidas al denominador: bajaba todos los porcentajes y el índice decía que
     el ramo usa menos de lo que usa. Es la misma trampa que la mediana de días
     sin venta, y por eso el filtro vive en una sola constante (`operando`) en
     vez de repetirse en cada consulta. */
  const operan = new Set(operando.map(f => f.company_id));
  const ultimoUso = new Map<string, any>();
  for (const f of u || []) {
    if (!operan.has(f.company_id)) continue;
    if (!ultimoUso.has(f.company_id)) ultimoUso.set(f.company_id, f.uso);
  }

  const cuenta = new Map<string, { familia: string; usan: number; de: number }>();
  for (const [, uso] of ultimoUso) {
    for (const m of (uso?.modulos ?? [])) {
      const k = m.modulo;
      if (!k) continue;
      const c = cuenta.get(k) ?? { familia: m.familia || '—', usan: 0, de: 0 };
      c.de++; if (m.usa) c.usan++;
      cuenta.set(k, c);
    }
  }

  const adopcion = [...cuenta.entries()]
    .filter(([, c]) => c.de >= MIN_EMPRESAS)       // la regla de anonimato, otra vez
    .map(([modulo, c]) => ({ modulo, familia: c.familia, pct: Math.round((c.usan / c.de) * 100), n: c.de }))
    .sort((a, b) => b.pct - a.pct);

  return {
    edicion: fecha.slice(0, 7),
    corte: fecha,
    n_empresas: n,
    metricas: { generales, adopcion },
    definicion: { ...OPERANDO, min_empresas: MIN_EMPRESAS, fuente: 'Operación real de las tiendas que usan Sacs en México. Agregado y anónimo.' },
  };
}

/** Guarda la edición. NUNCA la publica: `publicado` se queda en false y solo el
 *  dueño lo cambia. Si alguna vez alguien agrega aquí un `publicado: true`,
 *  está saltándose la cláusula de confidencialidad de los Términos. */
export async function guardar(e: Edicion) {
  const { error } = await supabase.from('de_indice').upsert({
    edicion: e.edicion, corte: e.corte, n_empresas: e.n_empresas,
    metricas: e.metricas, definicion: e.definicion,
  }, { onConflict: 'edicion' });
  if (error) throw new Error(`[indice] al guardar: ${error.message}`);
}

/** Lo que lee la página pública. Devuelve null mientras nadie haya publicado. */
export async function leerPublicado() {
  const { data } = await supabase.from('de_indice')
    .select('edicion, corte, n_empresas, metricas, definicion, publicado_at')
    .eq('publicado', true).order('corte', { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}
