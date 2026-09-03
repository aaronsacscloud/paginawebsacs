// GET /api/crm/espacio/exportar?canal_id=   → el canal completo en Markdown
//
// Para founders: el historial se queda para siempre en la base, pero un canal
// también tiene que poder salir de aquí —para el consultor, para un cliente,
// para leerlo con calma—. Un archivo por canal, con sus hilos anidados debajo
// del mensaje que los abrió, los audios con su transcripción y las actas tal
// cual. No lleva ligas firmadas de los adjuntos (caducan): pone el nombre.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, canalDe, puedeVerCanal, personasPorId } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const TZ = 'America/Mexico_City';
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dia = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ });
const plano = (t: string) => String(t || '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  if (yo.role !== 'founder') return json({ error: 'Solo los founders exportan canales' }, 403);
  const c = await canalDe(new URL(request.url).searchParams.get('canal_id') || '');
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);

  // Todo el canal, en tandas de 1000 (Supabase corta ahí por default).
  const filas: any[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('espacio_mensajes')
      .select('id, hilo_de, autor_id, texto, responde_a, adjuntos, citas, fijado_at, metadata, borrado_at, created_at')
      .eq('canal_id', c.id).is('borrado_at', null).order('created_at', { ascending: true }).range(desde, desde + 999);
    if (error) return json({ error: error.message }, 500);
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const personas = await personasPorId([...new Set(filas.map(f => f.autor_id))]);
  const nombre = (id: string) => personas[id]?.nombre || 'Alguien';
  const porId = Object.fromEntries(filas.map(f => [f.id, f]));
  const hilos: Record<string, any[]> = {};
  for (const f of filas) if (f.hilo_de) (hilos[f.hilo_de] ||= []).push(f);

  const linea = (f: any, sangria = '') => {
    const partes: string[] = [];
    let cab = `**${nombre(f.autor_id)}** · ${hora(f.created_at)}`;
    if (f.fijado_at) cab += ' · fijado';
    if (f.responde_a && porId[f.responde_a]) cab += ` · en respuesta a ${nombre(porId[f.responde_a].autor_id)}`;
    partes.push(`${sangria}${cab}`);
    const texto = plano(f.texto).split('\n').map(l => `${sangria}${l}`).join('\n');
    if (texto.trim()) partes.push(texto);
    for (const a of f.adjuntos || []) {
      if (a.tipo === 'audio') partes.push(`${sangria}🎙 Audio${a.transcripcion ? `: ${a.transcripcion}` : ' (sin transcripción)'}`);
      else if (a.tipo === 'gif') partes.push(`${sangria}[GIF]`);
      else partes.push(`${sangria}[${a.tipo === 'imagen' ? 'Imagen' : 'Archivo'}: ${a.nombre || a.path || ''}]`);
    }
    for (const q of f.citas || []) if (q?.nombre) partes.push(`${sangria}› ${q.tipo}: ${q.nombre}`);
    return partes.join('\n');
  };

  const out: string[] = [`# #${c.nombre}`, c.descripcion ? `_${c.descripcion}_` : '', (n => `Exportado por ${yo.nombre} el ${fecha(new Date().toISOString())} · ${n} ${n === 1 ? 'mensaje' : 'mensajes'}`)(filas.filter(f => !f.hilo_de).length), ''];
  let diaPrev = '';
  for (const f of filas) {
    if (f.hilo_de) continue;
    const d = dia(f.created_at);
    if (d !== diaPrev) { out.push(`\n## ${fecha(f.created_at)}\n`); diaPrev = d; }
    out.push(linea(f), '');
    const h = hilos[f.id];
    if (h?.length) {
      out.push(`> **Hilo · ${h.length} ${h.length === 1 ? 'respuesta' : 'respuestas'}**`);
      for (const r of h) out.push(linea(r, '> ').replace(/\n/g, '\n'), '>');
      out.push('');
    }
  }
  const md = out.join('\n').replace(/\n{3,}/g, '\n\n');
  const archivo = `equipo-${c.nombre}-${dia(new Date().toISOString())}.md`;
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${archivo}"`, 'Cache-Control': 'no-store' } });
};
