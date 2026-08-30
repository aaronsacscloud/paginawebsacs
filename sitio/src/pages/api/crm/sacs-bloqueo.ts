/**
 * Revocar o reabrir una cuenta de SACS desde el CRM.
 *
 *   GET  ?cuenta=…                        → cómo está HOY, según SACS
 *   POST { contact_id|company_id|cuenta,
 *          accion, motivo, adeudo }       → apagarla o reabrirla
 *
 * POR QUÉ EXISTE
 * Revocar una cuenta se hacía en sacs3 ▸ Configuración ▸ Cuentas: otro sistema,
 * otra sesión, buscar la cuenta entre 560. Quien está cobrando tiene el hilo de
 * WhatsApp abierto delante y la ficha del cliente al lado — ese es el momento y
 * el lugar de apretar el botón, no quince minutos después en otra pestaña.
 *
 * Es la MISMA operación, no una paralela: mismo motor del lado de la API,
 * mismos textos de `accountBlockConfig`, mismo espejo en la lista de cuentas y
 * misma bitácora. Lo único que cambia es desde dónde se dispara y que en la
 * bitácora queda el correo de quien lo pidió.
 *
 * El estado se LEE de SACS en cada carga y no se cachea en el CRM: basta con
 * que alguien la reabra desde sacs3 para que dos pantallas digan cosas
 * distintas de la misma cuenta, y la que miente es siempre la que recuerda.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { revocarCuenta, estadoCuenta } from '../../../lib/crm/prueba';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

/**
 * De quién es la cuenta. Se acepta el contacto, la empresa o el slug directo
 * porque las tres pantallas que lo usan tienen datos distintos a la mano: el
 * inbox tiene el contacto, la ficha del cliente tiene la empresa, y el buscador
 * tiene el slug.
 */
async function resolverCuenta(b: any): Promise<{ cuenta?: string; contact_id?: string; company_id?: string; error?: string }> {
  if (b.cuenta) return { cuenta: String(b.cuenta).trim().toLowerCase() };

  if (b.contact_id) {
    const { data: c } = await supabase.from('contacts')
      .select('id, company_id, prueba_cuenta').eq('id', b.contact_id).maybeSingle();
    if (!c) return { error: 'No encontré ese contacto' };
    if (c.prueba_cuenta) return { cuenta: c.prueba_cuenta, contact_id: c.id, company_id: c.company_id || undefined };
    if (c.company_id) {
      const cta = await cuentaDeEmpresa(c.company_id);
      if (cta) return { cuenta: cta, contact_id: c.id, company_id: c.company_id };
    }
    return { error: 'Ese contacto no tiene ninguna cuenta de SACS ligada.' };
  }

  if (b.company_id) {
    const cta = await cuentaDeEmpresa(b.company_id);
    if (cta) return { cuenta: cta, company_id: b.company_id };
    return { error: 'Esa empresa no tiene ninguna cuenta de SACS ligada.' };
  }
  return { error: 'Falta decir de qué cuenta se trata.' };
}

/** La principal si está marcada; si no, la primera. Una empresa puede tener varias. */
async function cuentaDeEmpresa(companyId: string): Promise<string | null> {
  const { data } = await supabase.from('company_sacs_accounts')
    .select('cuenta, es_principal').eq('company_id', companyId)
    .order('es_principal', { ascending: false }).limit(1);
  return data?.[0]?.cuenta || null;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 403);

  const r = await resolverCuenta({
    cuenta: url.searchParams.get('cuenta'),
    contact_id: url.searchParams.get('contact_id'),
    company_id: url.searchParams.get('company_id'),
  });
  /* Sin cuenta ligada NO es un error que haya que gritar: es el caso normal de
     un lead que todavía no prueba nada. La pantalla solo esconde el botón. */
  if (r.error || !r.cuenta) return json({ cuenta: null, motivo_sin_cuenta: r.error });

  const est = await estadoCuenta(r.cuenta);
  return json({ cuenta: r.cuenta, ...est });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 403);
  /* Solo el equipo interno: apagar la cuenta de un cliente que paga no es una
     acción de la que uno se arrepienta a tiempo. */
  if (!['founder', 'cs'].includes(String((user as any).role || ''))) {
    return json({ error: 'Esta acción es solo del equipo interno.' }, 403);
  }
  const quien = (user as any).email || (user as any).id || '';
  if (!quien) return json({ error: 'No pude identificar quién lo pide.' }, 403);

  const b = await request.json().catch(() => ({}));
  const accion = b.accion === 'desbloquear' ? 'desbloquear' : 'bloquear';
  const motivo = ['pago', 'prueba', 'terminos'].includes(b.motivo) ? b.motivo : 'pago';
  const adeudo = String(b.adeudo ?? '').trim();

  /* SACS lo exige y con razón: el aviso de adeudo enseña el monto, y uno que
     dice «No especificado» le quita toda la fuerza al mensaje. */
  if (accion === 'bloquear' && motivo === 'pago' && !adeudo) {
    return json({ error: 'Para revocar por falta de pago hay que decir cuánto debe.' }, 400);
  }

  const r = await resolverCuenta(b);
  if (r.error || !r.cuenta) return json({ error: r.error || 'Sin cuenta' }, 409);

  const res = await revocarCuenta({
    cuenta: r.cuenta, accion, quien, motivo,
    adeudo: adeudo || undefined, diasBorrado: Number(b.dias_borrado) || 30,
  });
  if (!res.ok) return json({ error: res.error }, 502);

  /* La actividad va en la ficha, que es la misma línea de tiempo que pinta el
     inbox: un write y el contexto queda en los dos lados. */
  if (r.contact_id || r.company_id) {
    const etiqueta = motivo === 'pago' ? 'falta de pago' : motivo === 'prueba' ? 'fin de prueba' : 'violación de términos';
    await supabase.from('activities').insert({
      contact_id: r.contact_id || null,
      company_id: r.company_id || null,
      tipo: accion === 'bloquear' ? 'cuenta_revocada' : 'cuenta_reabierta',
      automatico: false,
      titulo: accion === 'bloquear'
        ? `Cuenta ${r.cuenta} revocada · ${etiqueta}`
        : `Cuenta ${r.cuenta} reabierta`,
      descripcion: accion === 'bloquear'
        ? `Al entrar ve el aviso a pantalla completa y no puede operar. Lo hizo ${quien}.`
        : `Vuelve a tener acceso. Lo hizo ${quien}.`,
      metadata: { cuenta: r.cuenta, motivo, adeudo: adeudo || null, quien },
    }).then(() => {}, () => {});
  }

  return json({ ok: true, cuenta: r.cuenta, bloqueada: accion === 'bloquear' });
};
