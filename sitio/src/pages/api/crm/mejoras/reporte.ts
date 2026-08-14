// POST /api/crm/mejoras/reporte  { company_id, desde, hasta, con_ia?: boolean }
//
// Reporte ejecutivo de un periodo: qué se le entregó al cliente, qué módulos
// nuevos arrancó y qué se le capacitó.
//
// Regla que gobierna todo el archivo: la IA REDACTA, no averigua. Los hechos
// —fechas, módulos, montos, quién no llegó— salen de la base y viajan ya
// resueltos en el prompt. Un reporte que se le manda al cliente con un módulo
// inventado cuesta la cuenta, y a esa altura ya nadie se acuerda de que lo
// escribió un modelo.
//
// Por eso la respuesta trae SIEMPRE los hechos aparte del texto: si la IA falla
// o no está configurada, el reporte se muestra igual, sin narrativa.
import type { APIRoute } from 'astro';
import { pedirJSON } from '../../../../lib/ia';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { normalizaEstado } from '../../../../lib/crm/reuniones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const fmtFecha = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  : '';

/** Módulos que el cliente usaba en una foto de uso. */
function modulosDe(snap: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const m of (snap?.uso?.modulos || [])) out[String(m.modulo)] = m;
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const b = await request.json().catch(() => ({} as any));
  const companyId = String(b?.company_id || '');
  const desde = String(b?.desde || '').slice(0, 10);
  const hasta = String(b?.hasta || '').slice(0, 10);
  if (!companyId || !desde || !hasta) return json({ error: 'Falta el cliente o el periodo.' }, 400);

  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, plan, sacs_account').eq('id', companyId).maybeSingle();
  if (!co) return json({ error: 'Ese cliente ya no existe.' }, 404);

  // ── 1. Lo que se entregó en el periodo ──
  const { data: mejoras } = await supabase.from('mejoras')
    .select('*, bookings(fecha, asunto, event_types(nombre, categoria))')
    .eq('company_id', companyId).is('archived_at', null)
    .eq('estado', 'entregada').gte('fecha_entrega', desde).lte('fecha_entrega', hasta)
    .order('fecha_entrega', { ascending: true });

  // ── 2. Lo comprometido que todavía no aterriza ──
  const { data: enCurso } = await supabase.from('mejoras')
    .select('titulo, descripcion, estado, fecha_compromiso, valor')
    .eq('company_id', companyId).is('archived_at', null)
    .in('estado', ['cotizada', 'en_proceso']).order('fecha_compromiso', { ascending: true });

  // ── 3. Reuniones del periodo (capacitación aparte) ──
  const { data: bookings } = await supabase.from('bookings')
    .select('id, fecha, asunto, estado, minuta, company_id, contact_id, invitee_email, event_types(nombre, categoria)')
    .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: true });
  const { data: cts } = await supabase.from('contacts').select('id, email').eq('company_id', companyId).is('archived_at', null);
  const ctIds = new Set((cts || []).map((c: any) => c.id));
  const ctMails = new Set((cts || []).map((c: any) => String(c.email || '').toLowerCase()).filter(Boolean));
  const reuniones = (bookings || []).filter((r: any) => r.company_id === companyId
    || (r.contact_id && ctIds.has(r.contact_id))
    || (r.invitee_email && ctMails.has(String(r.invitee_email).toLowerCase())));
  const capacitaciones = reuniones.filter((r: any) => r.event_types?.categoria === 'capacitacion');
  const asistidas = reuniones.filter((r: any) => normalizaEstado(r.estado) === 'asistio');
  const faltas = reuniones.filter((r: any) => normalizaEstado(r.estado) === 'no_asistio');

  // ── 4. Lo que cambió en la operación, según SACS ──
  // Se compara la foto más cercana al inicio contra la más cercana al fin. Las
  // fotos empiezan el 25-jul-2026: para un periodo anterior no hay con qué
  // comparar y eso se DICE, no se rellena con supuestos.
  const { data: snaps } = await supabase.from('uso_snapshots')
    .select('fecha, uso, usuarios_operando, clientes_total, lealtad_inscritos, ventas_30d, total_30d')
    .eq('company_id', companyId).gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: true });
  const primera = (snaps || [])[0] || null;
  const ultima = (snaps || []).length > 1 ? (snaps as any[])[snaps!.length - 1] : null;

  let modulosNuevos: any[] = [];
  let operacion: any = null;
  if (primera && ultima) {
    const antes = modulosDe(primera), despues = modulosDe(ultima);
    for (const [nombre, m] of Object.entries(despues)) {
      if ((m as any).usa && antes[nombre] && !antes[nombre].usa) {
        // Se amarra con la capacitación PREVIA más cercana del mismo tema. Se
        // reporta como "después de", nunca como "gracias a": la foto dice
        // cuándo empezó a usarlo, no por qué.
        const cap = capacitaciones
          .filter((c: any) => (c.asunto || '').toLowerCase().includes(String(nombre).toLowerCase().split(' ')[0])
            || JSON.stringify(c.minuta || {}).toLowerCase().includes(String(nombre).toLowerCase().split(' ')[0]))
          .sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)))[0] || null;
        modulosNuevos.push({
          modulo: nombre, familia: (m as any).familia || null,
          docs_30d: (m as any).docs_30d || 0, primer_uso: (m as any).ultimo || null,
          capacitacion: cap ? { fecha: cap.fecha, asunto: cap.asunto } : null,
        });
      }
    }
    operacion = {
      usuarios: { antes: primera.usuarios_operando ?? null, despues: ultima.usuarios_operando ?? null },
      lealtad: { antes: primera.lealtad_inscritos ?? null, despues: ultima.lealtad_inscritos ?? null },
      clientes: { antes: primera.clientes_total ?? null, despues: ultima.clientes_total ?? null },
      ventas_30d: { antes: primera.ventas_30d ?? null, despues: ultima.ventas_30d ?? null },
      facturado_30d: { antes: primera.total_30d ?? null, despues: ultima.total_30d ?? null },
    };
  }

  // Las capacitaciones capturadas a mano (una junta donde se enseñó algo, o el
  // video que se le mandó) cuentan igual que las sesiones agendadas: para el
  // cliente son lo mismo, y separarlas por su origen sería contarle nuestra
  // cocina.
  const capsMejora = (mejoras || []).filter((m: any) => m.categoria === 'capacitacion');
  const entregadasReales = (mejoras || []).filter((m: any) => m.categoria !== 'capacitacion');

  const hechos = {
    cliente: co.nombre_comercial || co.nombre, plan: co.plan || null,
    periodo: { desde, hasta, texto: `${fmtFecha(desde)} al ${fmtFecha(hasta)}` },
    entregadas: entregadasReales.map((m: any) => ({
      titulo: m.titulo, descripcion: m.descripcion, fecha: m.fecha_entrega,
      categoria: m.categoria, cortesia: m.cortesia, valor: Number(m.valor || 0),
      surgio_en: m.bookings ? { fecha: m.bookings.fecha, tipo: m.bookings.event_types?.nombre } : null,
      visible_cliente: m.visible_cliente !== false,
    })),
    en_curso: enCurso || [],
    reuniones: {
      total: reuniones.length, asistidas: asistidas.length, inasistencias: faltas.length,
      capacitaciones: [
        ...capacitaciones.map((c: any) => ({
          fecha: c.fecha, asunto: c.asunto, asistio: normalizaEstado(c.estado) === 'asistio',
          minuta: c.minuta || null, modo: 'sesión agendada',
        })),
        ...capsMejora.map((m: any) => ({
          fecha: m.fecha_entrega, asunto: m.titulo, asistio: true, minuta: null,
          modo: m.url ? 'video enviado' : 'en junta', detalle: m.descripcion || null, modulo: m.modulo || null,
        })),
      ].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))),
    },
    modulos_nuevos: modulosNuevos,
    operacion,
    // Sin dos fotos no hay comparación posible. Decirlo es parte del reporte:
    // callarlo haría leer "no hubo cambios" donde en realidad no hubo datos.
    sin_datos_de_uso: !(primera && ultima),
  };

  if (b?.con_ia === false) return json({ hechos, narrativa: null });

  const SYSTEM = `Eres quien escribe el reporte ejecutivo que un cliente de SACS (plataforma de punto de venta y gestión para retail en México) recibe de su consultor.

Te entregan HECHOS ya verificados en JSON. Tu trabajo es redactarlos, no averiguarlos.

REGLAS QUE NO SE ROMPEN:
- NO inventes mejoras, módulos, fechas ni cifras. Si un dato no está en los hechos, no existe.
- NO conviertas correlación en causa. Si el cliente empezó a usar un módulo después de una capacitación, se escribe "después de la capacitación del 9 de julio", nunca "gracias a".
- Si sin_datos_de_uso es true, dilo en una línea: no hay fotos de uso para ese periodo. No lo disimules.
- Si no hubo mejoras entregadas, dilo claro y en corto. Un reporte vacío honesto vale más que uno inflado.
- Nada de emoji. Nada de "¡excelente!" ni felicitaciones. Tono de consultor que reporta a un dueño ocupado.
- Español de México, claro y directo. Tuteo.

Devuelve ÚNICAMENTE este JSON:
{
  "titulo": "una línea que resuma el periodo, máximo 9 palabras",
  "resumen": "2-4 oraciones: lo más importante que pasó en el periodo",
  "entregado": ["una línea por mejora entregada, en lenguaje del dueño, no técnico"],
  "modulos": ["una línea por módulo nuevo, mencionando la capacitación si la hubo"],
  "operacion": "1-2 oraciones sobre cómo cambió el uso. Cadena vacía si no hay datos.",
  "siguiente": ["una línea por cosa comprometida que sigue pendiente"],
  "atencion": "una sola oración si hay algo que el consultor debe atender (inasistencias, módulos que no arrancaron). Cadena vacía si no hay nada."
}`;

  try {
    const narrativa = await pedirJSON({ system: SYSTEM, user: JSON.stringify(hechos) });
    return json({ hechos, narrativa });
  } catch (e: any) {
    // La IA es el adorno, los hechos son el reporte: si falla, el reporte sale.
    return json({ hechos, narrativa: null, ia_error: String(e?.message || e) });
  }
};
