// POST /api/comisiones/recibir — el acuse del consultor sobre su estado de cuenta.
//
// PÚBLICO a propósito: quien firma no entra al CRM. La llave es el UUID del
// corte, que solo tiene quien recibió el enlace — el mismo criterio de la
// cotización y del estado de cuenta del cliente.
//
// Tres candados, y cada uno tapa una forma distinta de ensuciar el registro:
//
//   · un corte ABIERTO no se firma: todavía se está formando y el monto puede
//     cambiar. Firmar algo que va a cambiar no acusa nada;
//   · no se firma dos veces. El primer acuse es el que vale y no se pisa;
//   · el nombre es obligatorio y se guarda tal cual, junto con la fecha, la IP
//     y el navegador. No es una firma legal: es un acuse con rastro, que es lo
//     que hace falta para cerrar la conversación de un pago.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || '');
    const nombre = String(b.nombre || '').trim().slice(0, 120);
    const nota = String(b.nota || '').trim().slice(0, 500);

    if (!UUID.test(id)) return json({ error: 'Enlace no válido.' }, 400);
    if (nombre.length < 3) return json({ error: 'Escribe tu nombre completo para firmar de recibido.' }, 400);

    const { data: corte } = await supabase.from('comision_cortes')
      .select('id, estado, recibido_at').eq('id', id).maybeSingle();
    if (!corte) return json({ error: 'Ese estado de cuenta ya no existe.' }, 404);

    if (corte.estado === 'abierto')
      return json({ error: 'Este corte todavía se está revisando. Podrás firmarlo cuando se te envíe.' }, 409);
    if (corte.recibido_at)
      return json({ error: 'Este estado de cuenta ya estaba firmado de recibido.' }, 409);

    const { error } = await supabase.from('comision_cortes').update({
      recibido_at: new Date().toISOString(),
      recibido_nombre: nombre,
      recibido_nota: nota || null,
      // Rastro mínimo. Si un día hay desacuerdo, se puede decir desde dónde y
      // con qué se firmó, en vez de discutir de memoria.
      recibido_ip: clientAddress || request.headers.get('x-forwarded-for') || null,
      recibido_agente: (request.headers.get('user-agent') || '').slice(0, 300) || null,
    }).eq('id', id).is('recibido_at', null);   // carrera: gana la primera firma
    if (error) throw error;

    return json({ ok: true, nombre });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
