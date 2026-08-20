// GET/POST /api/crm/email/embudos-listos — embudos armados de un clic.
//
// Armar uno a mano son ~12 clics por paso. Estos cuatro cubren lo que de
// verdad se usa y se crean completos —pasos, esperas, ramas y plantillas— en
// una sola llamada. Nacen en BORRADOR a propósito: quien los estrena debe
// leerlos y activarlos, no descubrir que ya están mandando.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import type { Bloque } from '../../../../lib/email/plantillas';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

interface PasoListo { tipo: string; config: any; rama?: 'si' | 'no' }
interface EmbudoListo {
  id: string; nombre: string; descripcion: string; que_hace: string;
  trigger: any; categoria?: 'marketing' | 'relacion';
  plantillas: Array<{ clave: string; nombre: string; asunto: string; preview: string; bloques: Bloque[] }>;
  pasos: PasoListo[];
}

const firma = (): Bloque => ({ id: 'f', tipo: 'firma', puesto: 'SACS Cloud' } as Bloque);

export const CATALOGO: EmbudoListo[] = [
  {
    id: 'bienvenida',
    nombre: 'Bienvenida a lead nuevo',
    descripcion: 'Primer correo al instante y un recordatorio si no agenda.',
    que_hace: 'Entra todo lead nuevo. Le llega el primer correo de inmediato; a los 3 días, si no agendó reunión, recibe un segundo con otro ángulo. Quien agenda sale del embudo.',
    trigger: { type: 'contacto_nuevo' },
    plantillas: [
      { clave: 'a', nombre: 'Bienvenida · primer correo', asunto: 'Gracias por tu interés en SACS',
        preview: 'Te cuento en 30 segundos si te sirve — y si no, te lo digo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: 'Hola {{nombre|}}, gracias por dejarnos tus datos.' },
          { id: '2', tipo: 'texto', texto: 'En dos minutos te digo si SACS te sirve para {{empresa|tu negocio}} — y si no te sirve, también te lo digo.' },
          { id: '3', tipo: 'boton', texto: 'Agendar 15 minutos', href: 'https://www.sacscloud.com/agendar/demo' },
          firma(),
        ] as Bloque[] },
      { clave: 'b', nombre: 'Bienvenida · recordatorio día 3', asunto: '¿Te ayudo a elegir horario?',
        preview: 'Quince minutos, con tus propios números en pantalla.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, te escribo una vez más y ya no insisto.' },
          { id: '2', tipo: 'lista', items: ['Lo vemos con TUS productos, no con una demo genérica', 'Si no te sirve, te lo digo en la misma llamada', 'Quince minutos, ni uno más'] },
          { id: '3', tipo: 'boton', texto: 'Ver horarios', href: 'https://www.sacscloud.com/agendar/demo' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [
      { tipo: 'send_email', config: { plantilla: 'a' } },
      { tipo: 'wait', config: { value: 3, unit: 'days' } },
      { tipo: 'if_then', config: { tipo: 'agendo_reunion', dias: 7 } },
      { tipo: 'goal', config: { tipo: 'agendo_reunion', dias: 7, nombre: 'agendó reunión' }, rama: 'si' },
      { tipo: 'send_email', config: { plantilla: 'b' }, rama: 'no' },
    ],
  },
  {
    id: 'renovacion',
    nombre: 'Renovación 30 / 7 días',
    descripcion: 'Avisa con tiempo antes de que venza la suscripción.',
    que_hace: 'Para cuentas con renovación próxima. Un aviso a 30 días y otro a 7. Va como correo de RELACIÓN: no cuenta para el límite semanal de marketing, porque un tope de cortesía no puede costar una renovación.',
    trigger: { type: 'segmento', segmento_nombre: 'Renovaciones próximas 30 días' },
    categoria: 'relacion',
    plantillas: [
      { clave: 'a', nombre: 'Renovación · aviso 30 días', asunto: 'Tu plan se renueva el mes que entra',
        preview: 'Sin sorpresas: te avisamos con tiempo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: 'Hola {{nombre|}}, tu plan se renueva pronto y preferimos avisarte con tiempo.' },
          { id: '2', tipo: 'cuenta', titulo: 'Tu cuenta' },
          { id: '3', tipo: 'texto', texto: 'Si todo sigue igual no tienes que hacer nada. Si quieres cambiar algo, responde este correo.' },
          firma(),
        ] as Bloque[] },
      { clave: 'b', nombre: 'Renovación · aviso 7 días', asunto: 'Se renueva esta semana',
        preview: 'Último aviso antes del cargo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, esta semana se renueva tu plan.' },
          { id: '2', tipo: 'cuenta', titulo: 'Lo que se renueva' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [
      { tipo: 'send_email', config: { plantilla: 'a' } },
      { tipo: 'wait', config: { value: 23, unit: 'days' } },
      { tipo: 'send_email', config: { plantilla: 'b' } },
    ],
  },
  {
    id: 'post_reunion',
    nombre: 'Después de la reunión',
    descripcion: 'Resumen a las 3 horas y seguimiento si no avanza.',
    que_hace: 'Se dispara al agendar. Tres horas después de la reunión llega el resumen; a los 4 días, si no se volvió cliente, un correo corto de seguimiento.',
    trigger: { type: 'propiedad', conditions: [{ property: 'lifecycle_stage', operator: 'eq', value: 'oportunidad' }] },
    plantillas: [
      { clave: 'a', nombre: 'Post-reunión · resumen', asunto: 'Lo que vimos hoy, en corto',
        preview: 'Tres puntos y el siguiente paso.',
        bloques: [
          { id: '1', tipo: 'texto', texto: 'Gracias por tu tiempo, {{nombre|}}. Te dejo lo que vimos:' },
          { id: '2', tipo: 'lista', items: ['El problema que quieres resolver', 'Cómo lo resuelve SACS', 'Qué sigue'] },
          { id: '3', tipo: 'boton', texto: 'Ver la propuesta', href: 'https://www.sacscloud.com/planes' },
          firma(),
        ] as Bloque[] },
      { clave: 'b', nombre: 'Post-reunión · seguimiento', asunto: '¿Alguna duda que resolver?',
        preview: 'Respóndeme aquí mismo, lo leo yo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, ¿quedó alguna duda de lo que vimos?' },
          { id: '2', tipo: 'texto', texto: 'Responde este correo y te contesto yo.' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [
      { tipo: 'wait', config: { value: 3, unit: 'hours' } },
      { tipo: 'send_email', config: { plantilla: 'a' } },
      { tipo: 'wait', config: { value: 4, unit: 'days' } },
      { tipo: 'if_then', config: { tipo: 'es_cliente', valor: 'cliente' } },
      { tipo: 'goal', config: { tipo: 'es_cliente', valor: 'cliente', nombre: 'se volvió cliente' }, rama: 'si' },
      { tipo: 'send_email', config: { plantilla: 'b' }, rama: 'no' },
    ],
  },
  {
    id: 'cobranza',
    nombre: 'Recuperación de pago',
    descripcion: 'Tres avisos con tono creciente, sin sonar a robot de cobranza.',
    que_hace: 'Para suscripciones con pago pendiente. Día 1 un recordatorio amable, día 7 con la liga de pago, día 14 el aviso de suspensión. Va como RELACIÓN: no lo frena el límite semanal de marketing, porque perder un cobro por un tope de cortesía no tiene sentido.',
    trigger: { type: 'segmento', segmento_nombre: 'Con pago pendiente' },
    categoria: 'relacion',
    plantillas: [
      { clave: 'a', nombre: 'Cobranza · recordatorio', asunto: 'Quedó pendiente tu pago',
        preview: 'Puede ser un tema del banco — te dejamos la liga.',
        bloques: [
          { id: '1', tipo: 'texto', texto: 'Hola {{nombre|}}, nos aparece pendiente el pago de tu suscripción.' },
          { id: '2', tipo: 'cuenta', titulo: 'Tu cuenta' },
          { id: '3', tipo: 'texto', texto: 'Suele ser algo del banco. Si ya lo pagaste, ignora este correo.' },
          firma(),
        ] as Bloque[] },
      { clave: 'b', nombre: 'Cobranza · con liga de pago', asunto: 'Te dejo la liga para ponerte al corriente',
        preview: 'Un clic y queda resuelto.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, sigue pendiente el pago y no queremos que pierdas el servicio.' },
          { id: '2', tipo: 'boton', texto: 'Pagar ahora', href: 'https://www.sacscloud.com/admin' },
          { id: '3', tipo: 'texto', texto: 'Si hay algún problema, responde este correo y lo vemos.' },
          firma(),
        ] as Bloque[] },
      { clave: 'c', nombre: 'Cobranza · aviso de suspensión', asunto: 'Tu cuenta se suspende en unos días',
        preview: 'Todavía estás a tiempo — dinos si necesitas otro plazo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, si el pago no entra en los próximos días tendremos que suspender la cuenta.' },
          { id: '2', tipo: 'texto', texto: 'No queremos llegar ahí. Si necesitas otro plazo, respóndenos y lo acomodamos.' },
          { id: '3', tipo: 'boton', texto: 'Ponerme al corriente', href: 'https://www.sacscloud.com/admin' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [
      { tipo: 'send_email', config: { plantilla: 'a' } },
      { tipo: 'wait', config: { value: 6, unit: 'days' } },
      { tipo: 'send_email', config: { plantilla: 'b' } },
      { tipo: 'wait', config: { value: 7, unit: 'days' } },
      { tipo: 'send_email', config: { plantilla: 'c' } },
    ],
  },
  {
    id: 'expansion',
    nombre: 'Expansión a cliente activo',
    descripcion: 'Le propone el siguiente módulo a quien ya creció.',
    que_hace: 'Para cuentas activas con varias sucursales. Un correo que parte de lo que ya usa —no de un catálogo— y ofrece el siguiente paso. Venderle más a quien ya te compra es lo más barato del funnel.',
    trigger: { type: 'segmento', segmento_nombre: 'Clientes que ya crecieron' },
    plantillas: [
      { clave: 'a', nombre: 'Expansión · siguiente módulo', asunto: 'Con {{sucursales|varias}} sucursales, esto te va a servir',
        preview: 'Lo que sigue cuando el negocio ya creció.',
        bloques: [
          { id: '1', tipo: 'texto', texto: 'Hola {{nombre|}}, vi que {{empresa|tu negocio}} ya opera con más de una sucursal.' },
          { id: '2', tipo: 'cuenta', titulo: 'Lo que tienes hoy' },
          { id: '3', tipo: 'texto', texto: 'Cuando se llega a este punto, lo que más ayuda es automatizar el resurtido entre sucursales.' },
          { id: '4', tipo: 'boton', texto: 'Ver cómo funciona', href: 'https://www.sacscloud.com/planes' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [{ tipo: 'send_email', config: { plantilla: 'a' } }],
  },
  {
    id: 'reactivacion',
    nombre: 'Reactivación de lead frío',
    descripcion: 'Un solo correo honesto, y se cierra.',
    que_hace: 'Para leads sin contacto en mucho tiempo. Manda UN correo —no una secuencia— porque insistirle a quien ya se enfrió es la vía rápida a que te marque como spam. Si hace clic, sale como interesado.',
    trigger: { type: 'segmento', segmento_nombre: 'Leads fríos' },
    plantillas: [
      { clave: 'a', nombre: 'Reactivación · último correo', asunto: '¿Lo dejamos aquí?',
        preview: 'Si no es el momento, lo entiendo — solo dímelo.',
        bloques: [
          { id: '1', tipo: 'texto', texto: '{{nombre|Hola}}, hace tiempo que no hablamos.' },
          { id: '2', tipo: 'texto', texto: 'Si sigue sin ser el momento, no te escribo más y no pasa nada. Si cambió algo, aquí sigo.' },
          { id: '3', tipo: 'boton', texto: 'Sigo interesado', href: 'https://www.sacscloud.com/agendar/demo' },
          firma(),
        ] as Bloque[] },
    ],
    pasos: [
      { tipo: 'send_email', config: { plantilla: 'a' } },
      { tipo: 'wait', config: { value: 5, unit: 'days' } },
      { tipo: 'goal', config: { tipo: 'hizo_clic', dias: 7, nombre: 'volvió a interesarse' } },
    ],
  },
];

export const GET: APIRoute = async () => json({
  embudos: CATALOGO.map(({ id, nombre, descripcion, que_hace, pasos }) => ({
    id, nombre, descripcion, que_hace, pasos: pasos.length,
    correos: pasos.filter(p => p.tipo === 'send_email').length,
  })),
});

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  const listo = CATALOGO.find(e => e.id === body?.id);
  if (!listo) return json({ error: 'No existe ese embudo.' }, 404);

  // Plantillas primero: los pasos las referencian por id.
  const idPorClave: Record<string, string> = {};
  for (const pl of listo.plantillas) {
    const nombre = `${pl.nombre}`;
    const { data: ya } = await supabase.from('email_templates')
      .select('id').eq('tenant_id', t.id).eq('nombre', nombre).is('archived_at', null).maybeSingle();
    if (ya) { idPorClave[pl.clave] = ya.id; continue; }
    const { data, error } = await supabase.from('email_templates').insert({
      tenant_id: t.id, nombre, asunto: pl.asunto, preview_text: pl.preview, bloques: pl.bloques,
    }).select('id').single();
    if (error) return json({ error: 'No se pudo crear la plantilla: ' + error.message }, 500);
    idPorClave[pl.clave] = data!.id;
  }

  const { data: auto, error: errA } = await supabase.from('automations').insert({
    tenant_id: t.id, nombre: listo.nombre, descripcion: listo.descripcion,
    tipo: 'lifecycle', estado: 'borrador',            // nace apagado, a propósito
    categoria: listo.categoria || 'marketing',
    enrollment_triggers: listo.trigger,
  }).select('id').single();
  if (errA || !auto) return json({ error: errA?.message || 'No se pudo crear el embudo.' }, 500);

  // Pasos: los de rama cuelgan del último `if_then` insertado.
  let padre: string | null = null;
  let orden = 0;
  for (const p of listo.pasos) {
    const config = { ...p.config };
    if (config.plantilla) { config.template_id = idPorClave[config.plantilla]; delete config.plantilla; }
    const fila: Record<string, any> = {
      automation_id: auto.id,
      orden: p.rama ? 1 : ++orden,
      parent_step_id: p.rama ? padre : null,
      branch_key: p.rama || null,
      tipo: p.tipo, config, activo: true,
    };
    const res: any = await supabase.from('automation_steps').insert(fila).select('id').single();
    if (p.tipo === 'if_then' && res?.data?.id) padre = String(res.data.id);
  }

  return json({
    ok: true, automation_id: auto.id, nombre: listo.nombre,
    mensaje: 'Creado en borrador. Revísalo y actívalo cuando estés listo — no envía nada mientras tanto.',
  }, 201);
};
