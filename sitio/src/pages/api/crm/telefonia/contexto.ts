// TELEFONÍA · Con quién estás a punto de hablar. GET ?telefono=+52…
//
// Existe para los tres segundos que van entre que marcas y que contestan. En
// el escritorio siempre tienes la ficha al lado; en el teléfono la pantalla la
// ocupa la llamada y no hay dónde mirar. Lo que se devuelve es lo mínimo que
// cambia cómo saludas: quién es, en qué etapa va, y cuántas veces le has
// marcado sin encontrarlo.
import type { APIRoute } from 'astro';
import { ladaDe, zonaDeLada, horaLocal } from '../../../../lib/telefonia/zonas';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const limpio = String(url.searchParams.get('telefono') || '').replace(/\D/g, '').slice(-10);
  if (limpio.length !== 10) return json({ hay: false });

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, contacts(nombre, apellido, lifecycle_stage, proximo_paso), companies(nombre, nombre_comercial)')
    .like('telefono', `%${limpio}`).limit(1).maybeSingle();
  if (!conv) return json({ hay: false });

  const c: any = (conv as any).contacts, e: any = (conv as any).companies;
  const [{ data: cont }, { data: ultima }] = await Promise.all([
    (conv as any).contact_id
      ? supabase.from('v_llamadas_contacto').select('total, contestadas, intentos_fallidos, buzon, ultima_llamada_at, ultima_contestada_at').eq('contact_id', (conv as any).contact_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    // La última llamada y CÓMO acabó: «la anterior cayó al buzón» cambia la
    // primera frase más que cualquier otro dato.
    supabase.from('wa_llamadas').select('estado, direccion, duracion_seg, started_at, payload')
      .eq('conversation_id', (conv as any).id).eq('canal', 'telefono')
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  /* ══ LO QUE LA SALA DE LA LLAMADA NECESITA VER ═══════════════════════════
     Pedido del dueño (17-sep-2026): «cuando el cliente responda, que me
     aparezca un modal bonito y grande con el contexto de lo que se ha hablado,
     las sucursales, la marca en grande, si hemos tenido otras llamadas
     anteriormente, y la parte de agendar viendo los horarios disponibles».

     Todo eso se pide DE UNA VEZ y no en cinco llamadas desde la pantalla: el
     modal se abre en el segundo en que alguien contesta, y cinco viajes a la
     red ahí son cinco huecos en blanco justo cuando hay que hablar. */
  const cid = (conv as any).contact_id;
  const [{ data: ficha }, { data: msjs }, { data: previas }] = await Promise.all([
    cid ? supabase.from('contacts')
      .select('marca, giro, sucursales_interes, puesto, propiedades, companies(nombre_comercial, nombre, sucursales, giro, sitio_web, ciudad)')
      .eq('id', cid).maybeSingle() : Promise.resolve({ data: null as any }),
    // Los últimos mensajes, tal cual: llamar sin saber qué se le acaba de
    // escribir es cómo uno se contradice a los diez segundos.
    supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, created_at')
      .eq('conversation_id', (conv as any).id).order('created_at', { ascending: false }).limit(8),
    // Las llamadas anteriores con su desenlace, no sólo el conteo: «la última
    // cayó al buzón» y «la última habló 6 minutos» piden saludos distintos.
    supabase.from('wa_llamadas').select('estado, direccion, duracion_seg, started_at, minuta, resultado')
      .eq('conversation_id', (conv as any).id).eq('canal', 'telefono')
      .order('started_at', { ascending: false }).limit(6),
  ]);
  const emp: any = (ficha as any)?.companies || null;

  const u: any = ultima;
  return json({
    hay: true,
    contactId: cid || null,
    /* La marca en grande es lo primero que pidió: es lo que dice en voz alta
       quien contesta, y equivocarla en el saludo cuesta la llamada. */
    marca: (ficha as any)?.marca || emp?.nombre_comercial || emp?.nombre || null,
    giro: (ficha as any)?.giro || emp?.giro || null,
    puesto: (ficha as any)?.puesto || null,
    ciudad: emp?.ciudad || null,
    sitio: emp?.sitio_web || null,
    sucursales: emp?.sucursales ?? (ficha as any)?.sucursales_interes ?? null,
    /* SU HORA, NO LA TUYA. Marcar a Tijuana a las 9 de la mañana de CDMX es
       llamar a las 7, y esa llamada no se recupera con una disculpa. Sale de
       la lada, que es lo único que se sabe seguro antes de que contesten. */
    hora_local: (() => {
      const z = zonaDeLada(ladaDe(`+52${limpio}`));
      return z && z !== 'America/Mexico_City' ? { zona: z, hora: horaLocal(z) } : null;
    })(),
    mensajes: (msjs || []).reverse(),
    previas: previas || [],
    conversationId: (conv as any).id,
    nombre: c?.nombre ? `${c.nombre} ${c.apellido || ''}`.trim() : null,
    empresa: e ? (e.nombre_comercial || e.nombre) : null,
    etapa: c?.lifecycle_stage || null,
    proximoPaso: c?.proximo_paso || null,
    llamadas: cont || null,
    ultima: u ? {
      cuando: u.started_at,
      buzon: /^machine_/.test(String(u.payload?.answered_by || '')),
      estado: u.estado, duracion: u.duracion_seg, direccion: u.direccion,
    } : null,
  });
};
