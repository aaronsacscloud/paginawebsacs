// DEMAND ENGINE · leer tablas completas sin que Supabase las corte.
//
// PostgREST devuelve **1000 filas como máximo** y no avisa: no hay error, no
// hay bandera, solo un arreglo más corto de lo que pediste. Para código que
// cuenta, promedia o agrupa, eso no es una lectura incompleta: es un resultado
// equivocado con cara de correcto.
//
// Dónde mordió de verdad (17-sep-2026): `puntuarClusters` leía
// `de_queries` para sacar la intención comercial media de cada problema. Había
// 2,762 consultas con intención; entraban 1,000. El 64% de la evidencia no
// contaba, y de ese promedio sale el score que decide QUÉ escribe el motor.
// Nadie lo habría notado nunca: los números salían, solo salían mal.
//
// Este archivo existe para que la forma correcta sea también la más corta de
// escribir. Si leer todo es más incómodo que leer mil, alguien va a leer mil.
import { supabase } from '../supabase';

const PAGINA = 1000;

/**
 * Trae TODAS las filas, paginando de mil en mil.
 *
 * @param tope  freno de seguridad. No es un límite de negocio: es para que una
 *              tabla que creció sin que nadie mirara no se traiga medio millón
 *              de filas a la memoria de una función de Vercel. Si se alcanza,
 *              se avisa por consola — un tope silencioso sería volver a crear
 *              el problema que este archivo resuelve.
 */
export async function traerTodo<T = any>(
  tabla: string,
  columnas: string,
  afinar?: (q: any) => any,
  tope = 50_000,
): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; desde < tope; desde += PAGINA) {
    let q = supabase.from(tabla).select(columnas);
    if (afinar) q = afinar(q);
    // El orden es obligatorio al paginar: sin `order`, Postgres no garantiza
    // que dos páginas consecutivas no repitan o se salten filas.
    const { data, error } = await q.order('id', { ascending: true }).range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`[paginar] ${tabla}: ${error.message}`);
    if (!data?.length) break;
    todo.push(...(data as T[]));
    if (data.length < PAGINA) break;
  }
  if (todo.length >= tope) {
    console.warn(`[paginar] ${tabla}: se alcanzó el tope de ${tope} filas; el resultado está incompleto.`);
  }
  return todo;
}

/** Cuenta sin traerse las filas. */
export async function contar(tabla: string, afinar?: (q: any) => any): Promise<number> {
  let q = supabase.from(tabla).select('id', { count: 'exact', head: true });
  if (afinar) q = afinar(q);
  const { count, error } = await q;
  if (error) throw new Error(`[paginar] al contar ${tabla}: ${error.message}`);
  return count ?? 0;
}
