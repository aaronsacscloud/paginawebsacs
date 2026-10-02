/**
 * Estado compartido de la temporada simulada (/producto/planeacion-de-demanda): lo que el visitante eligió en la
 * ficha (qué analizar y el modo) y quién tiene la escena en pantalla (para esconder la barra de WhatsApp).
 * Un solo módulo para el acto 0 y la consola: Vite lo empaqueta una vez y ambos ven el mismo objeto.
 */
import type { Modo } from '../../data/planeacion-demo';

export const estado = {
  analiza: new Set(['ventas', 'alza', 'tallas', 'inventario', 'entregas', 'nuevos']),
  modo: 'aprobar' as Modo,
};

type Oyente = () => void;
const oyentes = new Set<Oyente>();
export function escucha(fn: Oyente) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function avisa() { oyentes.forEach((fn) => fn()); }

/** PostHog, como en la portada: medir nunca rompe nada. */
export function ph(evento: string, props?: Record<string, unknown>) {
  try { (window as any).sacsPH?.(evento, props); } catch { /* sin medición */ }
}
const vistos = new Set<string>();
export function phUnaVez(evento: string, props?: Record<string, unknown>) {
  if (vistos.has(evento)) return;
  vistos.add(evento);
  ph(evento, props);
}

/** body.planeacion-activo esconde la barra de WhatsApp mientras la escena o la consola están en pantalla. */
const razones = new Set<string>();
export function activa(razon: string, on: boolean) {
  if (on) razones.add(razon); else razones.delete(razon);
  document.body.classList.toggle('planeacion-activo', razones.size > 0);
}

export const mqMovimiento = () => window.matchMedia('(prefers-reduced-motion: no-preference)');
