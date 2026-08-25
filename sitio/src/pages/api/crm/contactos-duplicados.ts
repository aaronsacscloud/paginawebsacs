// CRM · Detectar contactos duplicados — A PETICIÓN, nunca automático.
//
// GET → { pares: [{a, b, motivo, confianza}] }
//
// Tres señales, en orden de certeza:
//   1. mismo teléfono (últimos 10 dígitos)  → misma línea, casi seguro misma persona
//   2. mismo correo                          → misma persona
//   3. mismo nombre normalizado + misma empresa → muy probable
// La fusión la decide el usuario par por par (botón en Configuración): fusionar
// solo es seguro con un humano eligiendo cuál ficha sobrevive.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.rpc('detectar_contactos_duplicados');
  if (error) return json({ error: error.message }, 500);
  return json({ pares: data || [] });
};
