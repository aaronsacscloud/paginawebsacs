// POST /api/crm/arr/motivo-baja — captura el motivo de baja de VARIOS exclientes
// de un jalón.
//
// De los 35 exclientes, 17 se fueron sin motivo registrado: se cancelaron antes
// de que el campo se pidiera. Sin motivo, "se fueron 17" no se puede accionar —
// y entre ellos están los tres que más ARR se llevaron. Capturarlos uno por uno,
// abriendo la ficha y cada licencia, es la razón por la que nunca se hace.
//
// Body: { company_ids: string[], razon: string, detalle?: string, sobrescribir?: boolean }
// Escribe `razon_cancelacion` en TODAS las licencias canceladas de esas cuentas.
// Por defecto NO pisa las que ya tienen motivo: un motivo capturado es un dato
// que alguien preguntó, y perderlo por una edición masiva es peor que el hueco.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Mismo catálogo cerrado que el resto del CRM: medir churn por causa exige un
// set fijo, no texto libre.
const RAZONES = ['precio', 'no_implemento', 'no_uso', 'cerro_negocio', 'competencia', 'mal_servicio', 'feature_falta', 'otro'];
const ETIQUETA: Record<string, string> = {
  precio: 'Precio / presupuesto', no_implemento: 'No lo implementó', no_uso: 'Dejó de usarlo',
  cerro_negocio: 'Cerró el negocio', competencia: 'Se fue con la competencia',
  mal_servicio: 'Mal servicio / soporte', feature_falta: 'Le faltó una función', otro: 'Otro',
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const b = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(b?.company_ids) ? b.company_ids.filter((x: any) => typeof x === 'string') : [];
  const razon = String(b?.razon || '');
  const detalle = String(b?.detalle || '').trim().slice(0, 500);
  const sobrescribir = b?.sobrescribir === true;

  if (!ids.length) return json({ error: 'Elige al menos un excliente.' }, 400);
  if (!RAZONES.includes(razon)) return json({ error: 'Motivo no válido.' }, 400);
  if ((razon === 'otro' || razon === 'competencia') && !detalle) {
    return json({ error: razon === 'competencia' ? '¿A qué competidor se fueron?' : 'Agrega el detalle.' }, 400);
  }

  // Mismo formato que ya leen el tablero de bajas y el reporte de churn.
  const texto = detalle ? `${ETIQUETA[razon]} — ${detalle}` : razon;

  const { data: subs, error } = await supabase.from('subscriptions')
    .select('id, company_id, razon_cancelacion')
    .in('company_id', ids).eq('estado', 'cancelada');
  if (error) return json({ error: error.message }, 500);

  const conMotivo = (subs || []).filter((s: any) => s.razon_cancelacion && String(s.razon_cancelacion).trim());
  const objetivo = sobrescribir ? (subs || []) : (subs || []).filter((s: any) => !s.razon_cancelacion || !String(s.razon_cancelacion).trim());
  if (!objetivo.length) {
    return json({ ok: true, actualizadas: 0, respetadas: conMotivo.length, cuentas: 0,
      aviso: 'Todas las licencias de esas cuentas ya tenían motivo. Marca "sobrescribir" si quieres corregirlas.' });
  }

  const { error: e2 } = await supabase.from('subscriptions')
    .update({ razon_cancelacion: texto, updated_at: new Date().toISOString() })
    .in('id', objetivo.map((s: any) => s.id));
  if (e2) return json({ error: e2.message }, 500);

  // Queda en la actividad de cada cuenta: un motivo capturado tres meses
  // después no es lo mismo que uno registrado el día de la baja, y quien lo lea
  // tiene que poder notar la diferencia.
  const cuentas = [...new Set(objetivo.map((s: any) => s.company_id))];
  try {
    await supabase.from('activities').insert(cuentas.map((cid: any) => ({
      tipo: 'sistema', automatico: false, company_id: cid,
      titulo: `Motivo de baja capturado: ${ETIQUETA[razon]}`,
      descripcion: detalle || null,
      metadata: { audit: 'motivo_baja_masivo', razon, por: user.nombre || user.email || 'admin' },
    })));
  } catch { /* el rastro no puede impedir la captura */ }

  return json({
    ok: true,
    actualizadas: objetivo.length,
    respetadas: sobrescribir ? 0 : conMotivo.length,
    cuentas: cuentas.length,
  });
};
