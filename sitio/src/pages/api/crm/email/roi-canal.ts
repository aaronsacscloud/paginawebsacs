// /api/crm/email/roi-canal — cuánto cuesta un cliente por canal.
//
// La única pregunta que decide dónde poner el siguiente peso. El CRM ya tiene
// las dos mitades y nunca las había juntado: la atribución (de qué canal vino
// cada contacto) y el dinero (qué suscripciones se activaron). Faltaba el
// gasto, que se captura a mano porque las APIs de anuncios exigen credenciales
// por plataforma y no vale la pena atarse a eso todavía.
//
// GET   → el reporte
// POST  → registrar lo que se gastó en un canal y periodo
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { roiPorCanal } from '../../../../lib/crm/roi-canal.lib';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => json(await roiPorCanal(Number(url.searchParams.get('dias')) || 180));

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const canal = String(b?.canal || '').trim().toLowerCase();
  const monto = Number(b?.monto);
  if (!canal) return json({ error: '¿De qué canal es el gasto?' }, 400);
  if (!Number.isFinite(monto) || monto <= 0) return json({ error: 'El monto debe ser mayor que cero.' }, 400);
  if (!b?.periodo_inicio || !b?.periodo_fin) return json({ error: 'Faltan las fechas del periodo.' }, 400);
  if (String(b.periodo_fin) < String(b.periodo_inicio)) return json({ error: 'El periodo termina antes de empezar.' }, 400);

  const { data, error } = await supabase.from('marketing_gastos').insert({
    canal, monto, periodo_inicio: b.periodo_inicio, periodo_fin: b.periodo_fin,
    campana: b.campana || null, nota: b.nota || null,
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ gasto: data }, 201);
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta el id.' }, 400);
  await supabase.from('marketing_gastos').delete().eq('id', id);
  return json({ ok: true });
};
