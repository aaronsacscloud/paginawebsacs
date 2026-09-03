// COBRANZA · mandar el recordatorio de pago por WhatsApp, a mano.
//
// ESTO NO ES LA COBRANZA AUTOMÁTICA. El interruptor `cobranza` de
// wa_automatizaciones sigue APAGADO y este endpoint no lo consulta a propósito:
// aquí no hay cron ni disparo por evento, hay una persona que abrió el panel,
// leyó a quién le va a llegar y con cuánto, y apretó enviar. Esa es toda la
// diferencia, y es la que el dueño pidió cuidar cuando apagó los automáticos.
//
// GET  ?tipo=vencidos|proximos → la plantilla, cómo se va a ver ya resuelta
//                                para cada uno, y quién queda fuera y por qué.
// POST { tipo, ids[] }         → lo manda y devuelve resultado por persona.
//
// La plantilla es UTILITY. Cobrar es utilidad pura —le recuerdas a alguien una
// fecha de su propio contrato— y las de MARKETING se bloquean en silencio
// (131049): el peor resultado posible aquí es creer que salió y que no.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { plantillaAprobada, resolverCuerpo, mandarPlantilla } from '../../../../lib/whatsapp/plantilla-espejo';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/* UNA PLANTILLA POR CASO, y no es un detalle de estilo.
 *
 * `renovacion_proxima` dice «tu renovación está programada para el {{2}}»:
 * perfecta para un cobro que viene, absurda para uno que ya se pasó — a un
 * cliente con 8 días de atraso le llegaría hablándole en futuro de una fecha
 * que ya ocurrió, y el que lee eso concluye que el sistema no sabe lo que
 * cobra.
 *
 * Las dos son UTILITY a propósito. Cobrar es utilidad pura —le recuerdas a
 * alguien una fecha de su propio contrato— y las de MARKETING se bloquean en
 * silencio (131049): el peor resultado posible aquí es creer que salió y que
 * no. */
const PLANTILLAS: Record<'vencidos' | 'proximos', string> = {
  proximos: 'renovacion_proxima',
  // Pendiente de aprobación en Meta. Mientras no exista, el panel lo dice y no
  // deja mandar: es mejor que no se pueda cobrar por aquí a que salga un texto
  // que se lee mal.
  vencidos: 'pago_vencido',
};

/* No mandarle dos veces en la misma semana. Perseguir un cobro es legítimo;
   repetirlo cada que alguien abre el panel es acoso y hace que dejen de leer. */
const DIAS_SILENCIO = 5;

const fmtMoneda = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmtFecha = (f: string) => new Date(String(f).slice(0, 10) + 'T12:00:00')
  .toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
const primerNombre = (n: string) => String(n || '').trim().split(/\s+/)[0] || 'hola';

type Fila = {
  subscription_id: string; company_id: string | null; empresa: string; contacto: string | null;
  telefono: string | null; monto: number; fecha: string; dias: number; plan: string;
};

/** Los cobros del tipo pedido, con su gente y su teléfono. */
async function cobros(tipo: 'vencidos' | 'proximos'): Promise<Fila[]> {
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, company_id, contacts(nombre, whatsapp, telefono), companies(id, nombre, nombre_comercial, contacts(nombre, whatsapp, telefono))')
    .in('estado', ['activa', 'pendiente_pago'])
    .not('proxima_factura', 'is', null).limit(2000);

  const dentro = (f: string) => {
    const d = Math.floor((Date.parse(hoy) - Date.parse(String(f).slice(0, 10))) / 86400000);
    // Próximos = los 7 días que vienen. Más allá, avisar hoy de algo de dentro
    // de un mes solo enseña a ignorar el mensaje.
    return tipo === 'vencidos' ? d > 0 : (d <= 0 && d >= -7);
  };

  return (data || []).filter(s => dentro(s.proxima_factura!)).map(s => {
    const c: any = (s as any).contacts || (s as any).companies?.contacts?.[0] || {};
    const co: any = (s as any).companies || {};
    return {
      subscription_id: s.id, company_id: co.id || s.company_id || null,
      empresa: co.nombre_comercial || co.nombre || c.nombre || '—',
      contacto: c.nombre || null,
      telefono: c.whatsapp || c.telefono || null,
      monto: Number(s.monto_proximo ?? s.precio) || 0,
      fecha: String(s.proxima_factura).slice(0, 10),
      dias: Math.floor((Date.parse(hoy) - Date.parse(String(s.proxima_factura).slice(0, 10))) / 86400000),
      plan: s.nombre_plan,
    };
  }).sort((a, b) => b.dias - a.dias);
}

/** A quién ya se le escribió cobranza en los últimos días.
 *  El teléfono no vive en el mensaje sino en su conversación, así que se
 *  resuelve por el join: buscarlo en wa_mensajes devolvería vacío siempre y el
 *  silencio no protegería a nadie. */
async function escritosHace(dias: number): Promise<Set<string>> {
  const desde = new Date(Date.now() - dias * 86400e3).toISOString();
  const { data } = await supabase.from('wa_mensajes')
    .select('metadata, wa_conversaciones!inner(telefono)')
    .eq('direccion', 'saliente').gte('created_at', desde).limit(3000);
  const set = new Set<string>();
  for (const m of data || []) {
    if ((m as any).metadata?.origen !== 'cobranza_manual') continue;
    const tel = (m as any).wa_conversaciones?.telefono;
    if (tel) set.add(String(tel));
  }
  return set;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const tipo = url.searchParams.get('tipo') === 'proximos' ? 'proximos' : 'vencidos';

  const pl = await plantillaAprobada(PLANTILLAS[tipo]);
  const filas = await cobros(tipo);
  const yaEscritos = await escritosHace(DIAS_SILENCIO);

  const destinatarios: any[] = [];
  const omitidos: any[] = [];
  for (const f of filas) {
    const tel = f.telefono ? telefonoWhatsApp(f.telefono) : null;
    if (!tel) { omitidos.push({ ...f, motivo: 'no tiene WhatsApp registrado' }); continue; }
    if (yaEscritos.has(tel)) { omitidos.push({ ...f, motivo: `ya se le escribió hace menos de ${DIAS_SILENCIO} días` }); continue; }
    const params = [primerNombre(f.contacto || f.empresa), fmtFecha(f.fecha)];
    destinatarios.push({
      ...f, telefono: tel, params,
      // El texto EXACTO que va a llegar, resuelto contra la plantilla viva —no
      // una aproximación escrita a mano que se desincroniza el día que alguien
      // edita la plantilla en Meta.
      preview: resolverCuerpo(pl, params, ''),
    });
  }

  return json({
    plantilla: pl ? { nombre: pl.nombre, categoria: (pl as any).categoria || 'UTILITY', cuerpo: (pl as any).cuerpo || null, variables: (pl as any).variables ?? 2 } : null,
    plantilla_falta: !pl ? `La plantilla «${PLANTILLAS[tipo]}» no está aprobada en Meta todavía, así que por aquí no se puede mandar. Mientras tanto, márcales desde la lista.` : null,
    tipo, dias_silencio: DIAS_SILENCIO,
    destinatarios, omitidos,
    total_monto: destinatarios.reduce((s, d) => s + d.monto, 0),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const tipo = b.tipo === 'proximos' ? 'proximos' : 'vencidos';
  const ids: string[] = Array.isArray(b.ids) ? b.ids.filter(Boolean) : [];
  if (!ids.length) return json({ error: 'No hay a quién mandarle.' }, 400);

  const pl = await plantillaAprobada(PLANTILLAS[tipo]);
  if (!pl) return json({ error: `La plantilla «${PLANTILLAS[tipo]}» no está aprobada en Meta: sin ella no sale nada.` }, 400);

  const filas = (await cobros(tipo)).filter(f => ids.includes(f.subscription_id));
  const yaEscritos = await escritosHace(DIAS_SILENCIO);

  const resultados: any[] = [];
  for (const f of filas) {
    const tel = f.telefono ? telefonoWhatsApp(f.telefono) : null;
    if (!tel) { resultados.push({ ...f, ok: false, motivo: 'sin WhatsApp' }); continue; }
    /* El silencio se vuelve a comprobar AQUÍ, no solo al pintar el panel: entre
       abrirlo y apretar enviar pueden pasar minutos, y en ese rato otra persona
       pudo mandarle lo mismo. */
    if (yaEscritos.has(tel)) { resultados.push({ ...f, ok: false, motivo: `ya se le escribió hace menos de ${DIAS_SILENCIO} días` }); continue; }

    const params = [primerNombre(f.contacto || f.empresa), fmtFecha(f.fecha)];
    const r = await mandarPlantilla({
      telefono: tel, plantilla: pl.nombre, pl, params,
      autor: (user as any)?.nombre || (user as any)?.email || 'equipo',
      metadata: {
        origen: 'cobranza_manual', subscription_id: f.subscription_id,
        company_id: f.company_id, monto: f.monto, vence: f.fecha, dias: f.dias,
        enviado_por: (user as any)?.id || null,
      },
    });
    yaEscritos.add(tel);   // dentro del mismo lote tampoco se repite
    resultados.push({ ...f, ok: r.enviado, motivo: r.enviado ? null : (r.motivo || 'no salió'), via: r.via });

    /* Queda en la bitácora de la cuenta. Un cobro que se persiguió y no se
       anotó es un cobro que el siguiente vuelve a perseguir desde cero. */
    if (r.enviado && f.company_id) {
      // El mensaje ya salió: si anotarlo falla, no se deshace. Se traga aquí a
      // propósito, y solo aquí.
      try {
      await supabase.from('activities').insert({
        tipo: 'whatsapp', automatico: false, company_id: f.company_id,
        titulo: `Recordatorio de pago por WhatsApp · ${fmtMoneda(f.monto)}`,
        descripcion: `${f.plan} · vence ${f.fecha}${f.dias > 0 ? ` · ${f.dias} días de atraso` : ''} · plantilla ${pl.nombre}`,
        metadata: { audit: 'cobranza_whatsapp', subscription_id: f.subscription_id, monto: f.monto },
      }).select().maybeSingle();
      } catch (e) { console.error('[cobranza wa] no se pudo anotar:', e); }
    }
  }

  const enviados = resultados.filter(r => r.ok).length;
  return json({
    ok: true, enviados, fallidos: resultados.length - enviados,
    monto: resultados.filter(r => r.ok).reduce((s, r) => s + r.monto, 0),
    resultados,
  });
};
