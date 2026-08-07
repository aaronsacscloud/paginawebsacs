// Caché de los BARRIDOS a sacs_api — los que recorren las ~539 bases de la
// plataforma (`cuentas-activas`, `buscar-por-email`).
//
// Por qué existe: esas dos consultas contestan preguntas que NO se pueden
// responder desde la base del CRM ("¿quién está vendiendo sin suscripción
// registrada?"), así que por fuerza abren todas las bases. Medido por muestreo:
// ~66 ms por cuenta = ~35 s de trabajo de Mongo por barrido.
//
// El problema nunca fue el barrido, sino cuántas veces se repetía: la pantalla
// de Conciliación lo lanzaba al abrirse, otra vez al volver a la pestaña, y otra
// vez COMPLETO después de cada clasificar — cuando clasificar solo mueve una
// etiqueta del CRM y no cambia ni un dato del lado de SACS. Una sesión normal de
// clasificar 10 cuentas eran 11 barridos ×2 endpoints.
//
// ⚠️ Se cachea SOLO la parte cara (la respuesta de sacs_api). Lo que vive en
// Supabase —suscripciones, clasificaciones, ligas— se sigue leyendo fresco en
// cada petición, para que al clasificar la pantalla refleje el cambio al
// instante. Cachear la respuesta completa habría hecho que clasificar "no se
// viera" hasta que venciera el TTL.
//
// Es caché EN MEMORIA del proceso: en Vercel cada instancia tibia tiene la suya.
// Para una pantalla de administración que usan una o dos personas eso alcanza
// (los clics seguidos caen en la misma instancia); y si una instancia fría no
// tiene nada guardado, lo único que pasa es que barre una vez, como antes.

type Entrada = { valor: any; expira: number; calculadoEn: number };

const memoria = new Map<string, Entrada>();

export type Cacheado<T> = {
  valor: T;
  /** true si se sirvió de memoria (no se tocó Mongo) */
  deCache: boolean;
  /** cuándo se calculó de verdad el dato que se está devolviendo */
  calculadoEn: number;
};

/**
 * Devuelve el valor de `clave`, calculándolo solo si no hay uno vigente.
 *
 * `forzar` salta la caché (el botón "Actualizar" de la pantalla).
 *
 * Si el cálculo truena y hay un valor viejo guardado, se devuelve ESE en vez de
 * propagar el error: para esta pantalla un dato de hace un rato es infinitamente
 * más útil que un 502, y la respuesta lleva `calculadoEn` para que la UI diga de
 * cuándo es. Un fallo nunca sobrescribe ni borra lo bueno que ya había.
 */
export async function conCache<T>(
  clave: string,
  ttlMs: number,
  calcular: () => Promise<T>,
  forzar = false
): Promise<Cacheado<T>> {
  const ahora = Date.now();
  const previo = memoria.get(clave);

  if (!forzar && previo && previo.expira > ahora) {
    return { valor: previo.valor as T, deCache: true, calculadoEn: previo.calculadoEn };
  }

  try {
    const valor = await calcular();
    memoria.set(clave, { valor, expira: ahora + ttlMs, calculadoEn: ahora });
    return { valor, deCache: false, calculadoEn: ahora };
  } catch (e) {
    if (previo) return { valor: previo.valor as T, deCache: true, calculadoEn: previo.calculadoEn };
    throw e;
  }
}

/**
 * Lectura suelta de una clave vigente (null si no hay o ya venció).
 *
 * Sirve para el caso "tengo una LISTA y quiero barrer solo lo que falta": si se
 * cachea la lista entera, quitarle un elemento cambia la clave y obliga a
 * recalcular todo. Guardando cada elemento por separado, quitar uno deja a los
 * demás servibles de memoria. Es lo que hace `link-suggestions` con los correos:
 * al ligar una suscripción, los correos restantes ya están en caché y no se
 * vuelve a abrir una sola base.
 */
export function leerCache<T>(clave: string): T | null {
  const e = memoria.get(clave);
  if (!e || e.expira <= Date.now()) return null;
  return e.valor as T;
}

export function guardarCache(clave: string, valor: any, ttlMs: number): void {
  const ahora = Date.now();
  memoria.set(clave, { valor, expira: ahora + ttlMs, calculadoEn: ahora });
}

/** ¿La petición pidió saltarse la caché? (`?refrescar=1`) */
export function pidioRefrescar(url: URL): boolean {
  const v = url.searchParams.get('refrescar');
  return v === '1' || v === 'true';
}

/** 10 minutos: quién vende sin suscripción no cambia de un clic a otro. */
export const TTL_BARRIDO = 10 * 60 * 1000;
