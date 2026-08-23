// WHATSAPP · Exportar una conversación como archivo de texto (respaldo /
// cumplimiento). GET ?id=<conversation_id> → descarga .txt con el hilo
// completo, notas internas incluidas y marcadas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { telefonoLegible } from '../../../../lib/telefono';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response('Falta id', { status: 400 });

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('*, contacts(nombre, apellido), companies(nombre, nombre_comercial)')
    .eq('id', id).maybeSingle();
  if (!conv) return new Response('Conversación no encontrada', { status: 404 });

  const [{ data: mensajes }, { data: notas }] = await Promise.all([
    supabase.from('wa_mensajes').select('*').eq('conversation_id', id).order('created_at', { ascending: true }).limit(2000),
    supabase.from('wa_notas').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  ]);

  const nombre = conv.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : null;
  const f = (d: string) => new Date(d).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const lineas: string[] = [
    `Conversación de WhatsApp — ${nombre || telefonoLegible(conv.telefono)}`,
    `Teléfono: ${telefonoLegible(conv.telefono)}`,
    conv.companies ? `Empresa: ${conv.companies.nombre_comercial || conv.companies.nombre}` : '',
    `Exportado: ${f(new Date().toISOString())} (hora CDMX)`,
    ''.padEnd(60, '─'), '',
  ].filter(Boolean);

  const items = [
    ...(mensajes || []).map((m: any) => ({ t: m.enviado_at || m.created_at, tipo: 'msj', m })),
    ...(notas || []).map((n: any) => ({ t: n.created_at, tipo: 'nota', m: n })),
  ].sort((a, b) => String(a.t).localeCompare(String(b.t)));

  for (const it of items) {
    if (it.tipo === 'nota') {
      lineas.push(`[${f(it.t)}] ★ NOTA INTERNA (${it.m.autor}): ${it.m.texto}`);
    } else {
      const quien = it.m.direccion === 'entrante' ? (nombre || 'Cliente') : 'SACS';
      const cuerpo = it.m.transcript ? `[nota de voz] ${it.m.transcript}` : (it.m.cuerpo || `[${it.m.tipo}]`);
      const extra = it.m.media_url ? ` (adjunto: ${it.m.media_url})` : '';
      const st = it.m.direccion === 'saliente' ? ` · ${it.m.status}` : '';
      lineas.push(`[${f(it.t)}] ${quien}: ${cuerpo}${extra}${st}`);
    }
  }

  const archivo = `whatsapp_${(nombre || conv.telefono).replace(/[^\w]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  return new Response(lineas.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${archivo}"`,
    },
  });
};
