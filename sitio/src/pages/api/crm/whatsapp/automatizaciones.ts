/**
 * QUÉ ESCRIBE SOLO POR WHATSAPP — leer y cambiar desde el CRM.
 *
 * La lista de permitidos y su configuración tienen que poder tocarse desde la
 * pantalla. Una regla que solo vive en el código no es una regla que el dueño
 * pueda ejecutar: es una que tiene que pedir.
 *
 * GET  → todas las automatizaciones con su estado y su config.
 * PUT  → { clave, activa? , config? }  cambia una.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { olvidarPermisos } from '../../../../lib/whatsapp/permisos';
import { leerHorarioEnvio } from '../../../../lib/scheduling/recordatorios';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const { data, error } = await supabase.from('wa_automatizaciones')
    .select('clave, nombre, categoria, activa, nota, config, updated_at')
    .order('categoria').order('clave');
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [] });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const clave = String(b?.clave || '').trim();
  if (!clave) return json({ error: 'Falta la clave.' }, 400);

  const { data: fila } = await supabase.from('wa_automatizaciones')
    .select('clave, config').eq('clave', clave).maybeSingle();
  /* No se crea una clave nueva desde aquí: una automatización existe porque
     hay código que la pregunta. Inventar la fila daría permiso a algo que no
     existe y escondería el typo. */
  if (!fila) return json({ error: `No existe la automatización «${clave}».` }, 404);

  const cambios: any = { updated_at: new Date().toISOString() };
  if ('activa' in b) cambios.activa = !!b.activa;
  if (b?.config && typeof b.config === 'object') {
    const cfg = { ...(fila.config || {}), ...b.config };
    /* El horario se guarda YA SANEADO: si alguien manda una ventana invertida
       o una hora imposible, se guarda la buena en vez de dejar el disparate
       esperando a la hora del envío. */
    if (cfg.horario) cfg.horario = leerHorarioEnvio(cfg.horario);
    cambios.config = cfg;
  }

  const { error } = await supabase.from('wa_automatizaciones').update(cambios).eq('clave', clave);
  if (error) return json({ error: error.message }, 500);
  olvidarPermisos();   // el caché es de 60 s; que el cambio se sienta ya
  return json({ ok: true });
};
