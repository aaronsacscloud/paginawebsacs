// WHATSAPP · PRECARGA de las conversaciones recientes, en UN solo viaje.
//
// El problema que resuelve: el inbox precarga el hilo de las conversaciones que
// el usuario podría abrir, para que abrirlas sea instantáneo. La idea es buena;
// la ejecución costaba una petición a /hilo POR conversación, y cada /hilo hace
// media docena de consultas (mensajes, notas, eventos, presencia, lecturas).
// Medido al entrar al inbox: 7 hilos = 5.7 s de red, compitiendo justo con la
// carga de la lista que el usuario está esperando ver.
//
// Aquí se traen los últimos K mensajes de HASTA 50 conversaciones con una sola
// consulta, apoyada en la función `wa_ultimos_mensajes` (window function sobre
// el índice (conversation_id, created_at) que ya existía). Medido en producción:
// 483 mensajes de 50 conversaciones en 11.5 ms.
//
// Lo que NO trae, a propósito: notas, eventos, presencia y estado de envío del
// composer. Esto es para PINTAR el chat de inmediato; /hilo sigue siendo la
// fuente completa y se pide al abrir. Y no marca nada como leído — precargar no
// es leer (ver el candado ?marcar=1 en hilo.ts).
//
// GET ?ids=<uuid,uuid,…>&k=15  →  { mensajes: { [conversation_id]: [...] } }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { conMicroCache } from '../../../../lib/crm/micro-cache';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const MAX_CONV = 50;   // el techo que pidió el usuario: las 50 más recientes
const MAX_K = 30;

const _GET: APIRoute = async ({ request, url }) => {
  const yo = await getCurrentUser(request).catch(() => null);
  if (!yo) return json({ error: 'Sin sesión' }, 401);

  const crudo = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  // Solo UUIDs: lo que llegue distinto se descarta aquí y no en la base.
  const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = [...new Set(crudo.filter(s => RE_UUID.test(s)))];
  if (!ids.length) return json({ mensajes: {} });

  const k = Math.min(Math.max(Number(url.searchParams.get('k') || 15), 1), MAX_K);
  // Se recorta a 50 y se DICE cuántas quedaron fuera: un tope que no se anuncia
  // se lee como "ya está todo precargado" y manda a buscar un bug que no existe.
  const usados = ids.slice(0, MAX_CONV);
  const fuera = ids.length - usados.length;

  const { data, error } = await supabase.rpc('wa_ultimos_mensajes', { ids: usados, k });
  if (error) return json({ error: error.message }, 500);

  // La función devuelve los K más NUEVOS (desc). El chat se pinta del más viejo
  // al más nuevo, así que aquí se invierte una sola vez.
  const porConv: Record<string, any[]> = {};
  for (const m of data || []) {
    const c = String(m.conversation_id);
    (porConv[c] = porConv[c] || []).push(m);
  }
  for (const c of Object.keys(porConv)) porConv[c].reverse();

  return json({ mensajes: porConv, conversaciones: Object.keys(porConv).length, por_conversacion: k, omitidas: fuera });
};

// Lectura pesada founder-only: micro-caché corto como el resto del inbox.
export const GET = conMicroCache('wa/precarga', 10000, _GET as any);
