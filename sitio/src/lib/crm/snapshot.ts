// ══ SNAPSHOT del CRM: la primera pintura, sin esperar al servidor ══
//
// Por qué NO es sessionStorage (que era lo que había): sessionStorage muere al
// cerrar la pestaña. En una PWA instalada en la pantalla de inicio, CADA
// arranque es una sesión nueva — así que el snapshot nunca existía justo donde
// más falta hace, y el inbox salía en blanco esperando a la red en cada
// apertura de la app. Es lo que reportó el usuario: "al irme para atrás se pone
// en 0 el inbox y luego carga".
//
// localStorage sobrevive al cierre, así que el teléfono pinta lo último bueno
// al instante y revalida detrás. Con una condición que no se negocia: se BORRA
// al cerrar sesión, porque aquí viven nombres y trozos de conversaciones de
// clientes y el dispositivo puede no ser de quien los leyó.
//
// Es caché, nunca un requisito: si el navegador se queda sin cuota o el JSON
// viene corrupto, se devuelve null y la pantalla carga por el camino normal.

const PREFIJO = 'swr:';

export function leerSnap<T = any>(clave: string, maxEdadMs?: number): T | null {
  try {
    const raw = localStorage.getItem(PREFIJO + clave) ?? sessionStorage.getItem(PREFIJO + clave);
    if (!raw) return null;
    const j = JSON.parse(raw);
    // Formato viejo (sin envoltorio): se acepta para no dejar en blanco a quien
    // ya tenía uno guardado antes de este cambio.
    if (!j || typeof j !== 'object') return null;
    if (j.__v !== 1) return j as T;
    if (maxEdadMs && Date.now() - (j.at || 0) > maxEdadMs) return null;
    return j.d as T;
  } catch { return null; }
}

export function guardarSnap(clave: string, dato: any): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify({ __v: 1, at: Date.now(), d: dato }));
  } catch {
    // Cuota llena: se tira lo del CRM y se reintenta UNA vez. Si tampoco cabe,
    // se sigue sin snapshot — mejor eso que romper la pantalla.
    try {
      limpiarSnaps();
      localStorage.setItem(PREFIJO + clave, JSON.stringify({ __v: 1, at: Date.now(), d: dato }));
    } catch { /* sin snapshot y sin ruido */ }
  }
}

/** Se llama al cerrar sesión: nada de datos de clientes en un aparato ajeno. */
export function limpiarSnaps(): void {
  for (const almacen of [localStorage, sessionStorage]) {
    try {
      const fuera: string[] = [];
      for (let i = 0; i < almacen.length; i++) {
        const k = almacen.key(i);
        if (k && k.startsWith(PREFIJO)) fuera.push(k);
      }
      fuera.forEach(k => almacen.removeItem(k));
    } catch { /* nada */ }
  }
}
