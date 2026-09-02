/**
 * QUÉ ES ESTA SECUENCIA, QUÉ MANDA Y QUÉ SIGUE — para el drawer del inbox.
 *
 * Cuando un lead entra a una secuencia, en su conversación aparece un
 * comentario interno que lo dice. Pero decir el NOMBRE no sirve de nada: quien
 * lo lee no sabe qué le vamos a mandar ni cuándo. Y salir del inbox a buscarlo
 * es el paso que hace que no se mire.
 *
 * Devuelve la secuencia con sus pasos y, si se pasa un contacto, cuáles YA
 * salieron y cuál sigue con su fecha.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const CANAL: Record<string, string> = { correo: 'Correo', wa: 'WhatsApp', inapp: 'Mensaje dentro de Sacs' };

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const id = url.searchParams.get('id');
  const nombre = url.searchParams.get('nombre');
  const contacto = url.searchParams.get('contacto');
  if (!id && !nombre) return json({ error: 'Falta el id o el nombre de la secuencia.' }, 400);

  /* Por id cuando se tiene (las notas nuevas lo guardan). Por nombre para las
     viejas, que solo lo traen en el texto. */
  let q = supabase.from('crm_secuencias')
    .select('id, nombre, descripcion, objetivo, activa, dias_envio, hora_inicio, hora_fin, corte_dias');
  q = id ? q.eq('id', id) : q.eq('nombre', nombre!);
  const { data: sec } = await q.limit(1).maybeSingle();
  if (!sec) return json({ error: 'Esa secuencia ya no existe.' }, 404);

  const { data: pasos } = await supabase.from('crm_secuencia_pasos')
    .select('id, orden, dia, canal, wa_plantilla, email_template_id, inapp_campana_id, activo')
    .eq('secuencia_id', sec.id).order('dia').order('orden');

  /* El nombre humano de lo que manda cada paso. Sin esto el drawer diría
     «correo · plantilla 42», que no le dice nada a nadie. */
  const idsEmail = [...new Set((pasos || []).map((p: any) => p.email_template_id).filter(Boolean))];
  const nombresEmail = new Map<string, string>();
  if (idsEmail.length) {
    const { data: ts } = await supabase.from('email_templates').select('id, nombre, asunto').in('id', idsEmail);
    for (const t of ts || []) nombresEmail.set(String(t.id), String((t as any).asunto || (t as any).nombre || ''));
  }

  let miembro: any = null;
  if (contacto) {
    const { data } = await supabase.from('crm_secuencia_miembros')
      .select('inicio, enviados, detenida_at, motivo, canales_detenidos')
      .eq('secuencia_id', sec.id).eq('contact_id', contacto).maybeSingle();
    miembro = data || null;
  }

  const enviados: Record<string, string> = (miembro?.enviados as any) || {};
  const inicio = miembro?.inicio ? new Date(miembro.inicio) : null;

  const lista = (pasos || []).filter((p: any) => p.activo !== false).map((p: any) => {
    const ya = enviados[p.id] || null;
    /* La fecha estimada del paso: el día 1 es el día que entró. No es una
       promesa —la ventana horaria y los candados pueden correrla— y por eso
       se marca como estimada en la pantalla. */
    const cuando = inicio ? new Date(inicio.getTime() + (Number(p.dia) - 1) * 86400000) : null;
    return {
      id: p.id, dia: p.dia, orden: p.orden,
      canal: CANAL[p.canal] || p.canal,
      que: p.canal === 'wa' ? (p.wa_plantilla || 'plantilla sin asignar')
        : p.canal === 'correo' ? (nombresEmail.get(String(p.email_template_id)) || 'correo sin asignar')
        : (p.inapp_campana_id ? 'campaña dentro de Sacs' : 'campaña sin asignar'),
      enviado_at: ya,
      estimado: !ya && cuando ? cuando.toISOString().slice(0, 10) : null,
    };
  });

  const siguiente = lista.find(p => !p.enviado_at) || null;

  return json({
    secuencia: {
      id: sec.id, nombre: sec.nombre, descripcion: sec.descripcion || null,
      objetivo: sec.objetivo || null, activa: sec.activa === true,
      dias_envio: sec.dias_envio || null, hora_inicio: sec.hora_inicio, hora_fin: sec.hora_fin,
      corte_dias: sec.corte_dias || null,
    },
    pasos: lista,
    siguiente,
    /* Detenida NO es lo mismo que terminada: quien la lee necesita saber si
       todavía le va a llegar algo o no. */
    estado: !miembro ? 'no_esta'
      : miembro.detenida_at ? 'detenida'
      : siguiente ? 'en_curso' : 'terminada',
    motivo: miembro?.motivo || null,
    canales_detenidos: miembro?.canales_detenidos || null,
    inicio: miembro?.inicio || null,
  });
};
