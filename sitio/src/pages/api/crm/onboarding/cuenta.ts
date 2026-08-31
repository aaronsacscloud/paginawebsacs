// ══ La cuenta de SACS del cliente: los tres caminos, un solo endpoint ══════
//
// El proceso obligatorio al ganar un cliente. Según el caso:
//   accion=activar → venía de prueba: la cuenta se vuelve INDEFINIDA
//                    (se apaga la marca en SACS) y se desbloquea.
//   accion=crear   → nunca tuvo cuenta: alta vía /register SIN marca de
//                    prueba, con los datos de la ficha, y liga.
//   accion=ligar   → la cuenta existe en SACS pero nadie la ligó: se valida
//                    que no sea de OTRA empresa y se escribe la liga.
//   GET ?company_id= → en qué estado está (para pintar el botón correcto).
//
// Cada camino termina intentando abrir el caso de ONBOARDING — que solo abre
// si el interruptor está encendido; apagado, la liga queda hecha y el caso no.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { abrirOnboardingSiAplica } from '../../../../lib/crm/onboarding.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const REGISTER_SECRET = (import.meta.env.SACS_REGISTER_SECRET || import.meta.env.REGISTER_API_SECRET || '').trim();
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const SLUG_OK = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;

async function cuentaDe(companyId: string): Promise<string | null> {
  const { data: liga } = await supabase.from('company_sacs_accounts').select('cuenta').eq('company_id', companyId).limit(1);
  if (liga?.[0]?.cuenta) return liga[0].cuenta;
  const { data: co } = await supabase.from('companies').select('sacs_account').eq('id', companyId).maybeSingle();
  return co?.sacs_account || null;
}

/** ¿De quién es esta cuenta en el CRM? Para no pisar ligas ajenas. */
async function duenoDe(cuenta: string): Promise<{ company_id: string; nombre: string } | null> {
  const { data } = await supabase.from('company_sacs_accounts')
    .select('company_id, companies(nombre, nombre_comercial)').eq('cuenta', cuenta).limit(1);
  const r: any = data?.[0];
  return r ? { company_id: r.company_id, nombre: r.companies?.nombre_comercial || r.companies?.nombre || '(sin nombre)' } : null;
}

async function ligar(companyId: string, cuenta: string) {
  await supabase.from('company_sacs_accounts')
    .upsert({ company_id: companyId, cuenta }, { onConflict: 'cuenta' });
  await supabase.from('companies').update({ sacs_account: cuenta, updated_at: new Date().toISOString() })
    .eq('id', companyId).is('sacs_account', null);
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return json({ error: 'Falta company_id' }, 400);

  const cuenta = await cuentaDe(companyId);
  // ¿Algún contacto de la EMPRESA tuvo prueba? La prueba de un empleado
  // cuenta como prueba de la empresa.
  const { data: pruebas } = await supabase.from('contacts')
    .select('id, nombre, prueba_cuenta, prueba_estado').eq('company_id', companyId)
    .not('prueba_cuenta', 'is', null).limit(5);
  const { data: caso } = await supabase.from('onboarding_casos')
    .select('id, etapa, inicio').eq('company_id', companyId).is('cerrado_at', null).maybeSingle();

  return json({
    cuenta,
    pruebas: pruebas || [],
    caso: caso || null,
    camino: cuenta
      ? ((pruebas || []).some(p => p.prueba_cuenta === cuenta && p.prueba_estado !== 'convertida') ? 'activar' : 'nada')
      : ((pruebas || []).length ? 'activar' : 'crear_o_ligar'),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const companyId = String(b.company_id || '').trim();
  const accion = String(b.accion || '').trim();
  if (!companyId) return json({ error: 'Falta company_id' }, 400);

  const { data: co } = await supabase.from('companies')
    .select('id, nombre, nombre_comercial, giro, sucursales').eq('id', companyId).maybeSingle();
  if (!co) return json({ error: 'No existe esa empresa' }, 404);
  const quien = (user as any).nombre || (user as any).email || 'CRM';

  // ── ACTIVAR: la prueba se vuelve indefinida ──────────────────────────────
  if (accion === 'activar') {
    const cuenta = String(b.cuenta || await cuentaDe(companyId) || '').trim().toLowerCase();
    if (!cuenta) return json({ error: 'No hay cuenta que activar: primero liga o crea una.' }, 400);
    if (!SYNC_SECRET) return json({ error: 'Falta CRM_SYNC_SECRET: el puente con SACS está cerrado y no se puede apagar la marca de prueba. La liga sí queda.' }, 502);

    const r = await fetch(SACS_API + '/interno/prueba/convertir', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ cuenta }),
    }).then(x => x.json()).catch(e => ({ success: false, msg: String(e?.message || e) }));

    if (!r?.success) {
      /* El fallo NO desliga ni esconde el pendiente: se dice y se reintenta
         desde el mismo botón. Nunca «se cobró pero quién sabe qué pasó». */
      await supabase.from('crm_notificaciones').insert({
        tipo: 'onboarding_activar_falla', nivel: 'alerta', destino: 'clientes', company_id: companyId,
        titulo: `No se pudo activar la cuenta de ${co.nombre_comercial || co.nombre}`,
        detalle: `SACS contestó: ${r?.msg || r?.code || 'sin detalle'}. La marca de prueba sigue puesta; reintenta desde la ficha.`,
        metadata: { cuenta },
      });
      return json({ error: `SACS no pudo convertir la prueba: ${r?.msg || r?.code || 'sin detalle'}`, reintentable: true }, 502);
    }

    await ligar(companyId, cuenta);
    // La marca del CRM en los contactos que probaron con ESTA cuenta.
    const { data: cs } = await supabase.from('contacts').select('id, nombre, apellido')
      .eq('company_id', companyId).eq('prueba_cuenta', cuenta);
    for (const c of cs || []) {
      const { convertirPrueba } = await import('../../../../lib/crm/prueba');
      await convertirPrueba(c, quien);
    }
    await supabase.from('activities').insert({
      company_id: companyId, tipo: 'sistema', automatico: false,
      titulo: `Cuenta ${cuenta} activada: dejó de ser prueba y quedó indefinida`,
      metadata: { onboarding: true, cuenta, quien },
    });
    const onb = await abrirOnboardingSiAplica(companyId, { quien });
    return json({ ok: true, cuenta, onboarding: onb });
  }

  // ── LIGAR: la cuenta ya existe en SACS ───────────────────────────────────
  if (accion === 'ligar') {
    const cuenta = String(b.cuenta || '').trim().toLowerCase();
    if (!SLUG_OK.test(cuenta)) return json({ error: 'Ese identificador de cuenta no es válido.' }, 400);
    const dueno = await duenoDe(cuenta);
    if (dueno && dueno.company_id !== companyId) {
      return json({ error: `Esa cuenta ya está ligada a «${dueno.nombre}». Ese conflicto lo resuelve una persona, no este botón.` }, 409);
    }
    await ligar(companyId, cuenta);
    await supabase.from('activities').insert({
      company_id: companyId, tipo: 'sistema', automatico: false,
      titulo: `Cuenta ${cuenta} ligada al cliente`, metadata: { onboarding: true, cuenta, quien },
    });
    const onb = await abrirOnboardingSiAplica(companyId, { quien });
    return json({ ok: true, cuenta, onboarding: onb });
  }

  // ── CREAR: nunca tuvo cuenta ─────────────────────────────────────────────
  if (accion === 'crear') {
    if (!REGISTER_SECRET) return json({ error: 'Falta el secreto de registro: SACS rechazaría el alta.' }, 500);
    const cuenta = String(b.cuenta || '').trim().toLowerCase();
    const email = String(b.email || '').trim().toLowerCase();
    const nombre = String(b.nombre || co.nombre_comercial || co.nombre || '').trim();
    if (!SLUG_OK.test(cuenta)) return json({ error: 'El identificador va en minúsculas, números y guiones (4 a 40).' }, 400);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'SACS pide un correo válido para crear el acceso.' }, 400);
    if (await duenoDe(cuenta)) return json({ error: 'Ese identificador ya está ligado a un cliente del CRM.' }, 409);

    /* SIN marca de prueba: es un cliente que ya pagó. El MISMO /register y el
       MISMO payload de sacs-prueba —account_id/account_name/password—, con
       prueba_gratis apagado. Copiado del que ya funciona, no reinventado. */
    const temporal = 'sacs' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
    const r = await fetch(SACS_API + '/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-register-secret': REGISTER_SECRET },
      body: JSON.stringify({
        account_id: cuenta,
        account_name: nombre,
        nombre: String(b.contacto_nombre || nombre),
        email,
        password: temporal,
        telefono: b.whatsapp || undefined,
        prueba_gratis: false,
      }),
    }).then(x => x.json()).catch(e => ({ success: false, msg: String(e?.message || e) }));

    if (!r?.success) {
      await supabase.from('crm_notificaciones').insert({
        tipo: 'onboarding_alta_falla', nivel: 'alerta', destino: 'clientes', company_id: companyId,
        titulo: `No se pudo crear la cuenta de ${co.nombre_comercial || co.nombre}`,
        detalle: `SACS contestó: ${r?.msg || r?.error || 'sin detalle'}. El pendiente sigue; reintenta desde la ficha.`,
        metadata: { cuenta },
      });
      return json({ error: `SACS no pudo crear la cuenta: ${r?.msg || r?.error || 'sin detalle'}`, reintentable: true }, 502);
    }

    await ligar(companyId, cuenta);
    await supabase.from('activities').insert({
      company_id: companyId, tipo: 'sistema', automatico: false,
      titulo: `Cuenta ${cuenta} creada y ligada (cliente, sin prueba)`,
      metadata: { onboarding: true, cuenta, email, quien },
    });
    const onb = await abrirOnboardingSiAplica(companyId, { quien });
    /* La contraseña temporal se devuelve UNA vez para dársela al cliente;
       no se guarda en ningún lado. */
    return json({ ok: true, cuenta, password_temporal: temporal, onboarding: onb });
  }

  return json({ error: 'Acción desconocida: activar | ligar | crear' }, 400);
};
