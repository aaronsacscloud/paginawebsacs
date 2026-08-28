// ══ Carga diferida a prueba de deploys ══════════════════════════════════════
//
// Síntoma: «Failed to fetch dynamically imported module» / «importing module
// script failed» al abrir la ficha del contacto, el chat nuevo o cualquier
// pieza diferida — sobre todo en el teléfono con la PWA instalada.
//
// Causa: el service worker del CRM sirve el HTML de /admin/crm en
// stale-while-revalidate (es LA palanca de velocidad, no se toca). Tras un
// deploy, el teléfono sigue corriendo el HTML viejo, que apunta a chunks con
// hash viejo. Los que ya estaban en caché siguen vivos; los que NUNCA se
// abrieron no existen en el servidor nuevo → 404 → la importación truena y la
// pantalla se queda muerta.
//
// Cura: si una importación diferida falla, se tira el caché y se recarga UNA
// vez. La segunda vez ya viene el HTML nuevo con los hashes correctos. El
// candado de tiempo evita el bucle si el fallo fuera por otra razón (sin red).
import { lazy, type ComponentType } from 'react';

const CLAVE = 'crm:recarga-chunk';
const ESPERA_MS = 60_000;

async function limpiarYRecargar(): Promise<never> {
  try {
    if (typeof caches !== 'undefined') {
      for (const k of await caches.keys()) await caches.delete(k);
    }
  } catch { /* el caché es un lujo, no un requisito */ }
  location.reload();
  // La página se está recargando: esta promesa nunca resuelve a propósito, así
  // React no pinta un error a medio camino.
  return new Promise<never>(() => {});
}

export function lazySeguro<T extends ComponentType<any>>(carga: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await carga();
    } catch (e) {
      const ahora = Date.now();
      let ultima = 0;
      try { ultima = Number(sessionStorage.getItem(CLAVE) || 0); } catch { /* modo privado */ }
      if (ahora - ultima > ESPERA_MS) {
        try { sessionStorage.setItem(CLAVE, String(ahora)); } catch { /* idem */ }
        return limpiarYRecargar();
      }
      throw e;
    }
  });
}
