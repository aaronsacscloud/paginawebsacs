// Las líneas de WhatsApp (números) que el CRM tiene activas, para el composer, la
// lista y el chat nuevo. Se piden UNA vez por pestaña y se comparten: tres
// componentes pidiendo lo mismo al abrir cada hilo eran tres viajes de más.
import { useEffect, useState } from 'react';

export interface LineaUI { id: string; numero: string; nombre: string; es_default: boolean; pausada?: boolean; activo?: boolean }
let cache: { lineas: LineaUI[]; def: string } | null = null;
let enVuelo: Promise<{ lineas: LineaUI[]; def: string }> | null = null;

export function cargarLineas(): Promise<{ lineas: LineaUI[]; def: string }> {
  if (cache) return Promise.resolve(cache);
  if (!enVuelo) enVuelo = fetch('/api/crm/whatsapp/linea').then(r => r.json())
    .then(j => { cache = { lineas: j.lineas || [], def: j.default || j.lineas?.[0]?.id || '' }; return cache; })
    .catch(() => ({ lineas: [], def: '' }))
    .finally(() => { enVuelo = null; });
  return enVuelo;
}
export const olvidarLineas = () => { cache = null; };

/** Etiqueta corta para chips: «+52 ···8733». */
export function numeroCorto(n: string): string {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length <= 6) return n;
  const pais = d.startsWith('52') ? '+52' : d.startsWith('1') && d.length === 11 ? '+1' : `+${d.slice(0, Math.max(1, d.length - 10))}`;
  return `${pais} ···${d.slice(-4)}`;
}

export function useLineas() {
  const [st, setSt] = useState<{ lineas: LineaUI[]; def: string }>(cache || { lineas: [], def: '' });
  useEffect(() => { let vivo = true; cargarLineas().then(v => { if (vivo) setSt(v); }); return () => { vivo = false; }; }, []);
  return st;
}
