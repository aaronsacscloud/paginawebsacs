// OUTBOUND · CRUD y ciclo de vida de las campañas in-app.
//
// GET    ?id=<uuid>            → una campaña (con pasos)
// GET    [?estado=...]         → lista con resumen
// GET    ?catalogo=1           → catálogos cerrados (la UI pinta sus menús de aquí)
// POST   {campana}             → crear (nace en borrador)
// PUT    ?id= {campos}         → editar (si está activa, re-publica)
// POST   ?id=&accion=revisar   → checks + alcance real (SIN activar)
// POST   ?id=&accion=activar   → valida + materializa + publica a sacs_api
// POST   ?id=&accion=pausar|reanudar|terminar|archivar
// POST   ?id=&accion=aprobar_bloqueante
// POST   ?id=&accion=prueba {cuenta} → publica SOLO a la cuenta interna (pruebasmongo)
//
// Ruta bajo /api/crm/ ⇒ founder-only por el middleware; ni una línea de auth aquí.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { catalogoCompleto } from '../../../../lib/outbound/catalogo';
import { resolverAudiencia, validarCampana, publicarCampana, despublicarCampana, docParaSacs, auditar } from '../../../../lib/outbound/motor';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const CAMPOS_EDITABLES = [
  'nombre', 'objetivo_texto', 'formato', 'canal', 'prioridad', 'modo', 'reentrada_dias',
  'contenido', 'comportamiento', 'guardar_campana', 'audiencia', 'nivel', 'meta',
  'ventana_atribucion_dias', 'holdout_pct', 'vigencia_desde', 'vigencia_hasta',
];

async function quien(request: Request): Promise<string | null> {
  try { const u = await getSessionFromRequest(request); return (u as any)?.id || null; } catch { return null; }
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('catalogo')) return json({ catalogo: catalogoCompleto() });
  const id = url.searchParams.get('id');
  if (id) {
    const { data, error } = await supabase.from('inapp_campanas').select('*').eq('id', id).single();
    if (error || !data) return json({ error: 'Campaña no encontrada' }, 404);
    const { data: pasos } = await supabase.from('inapp_pasos').select('*').eq('campana_id', id).order('orden');
    return json({ campana: data, pasos: pasos || [] });
  }
  let q = supabase.from('inapp_campanas').select('*').is('archived_at', null).order('updated_at', { ascending: false }).limit(500);
  const estado = url.searchParams.get('estado');
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  const accion = url.searchParams.get('accion');
  const uid = await quien(request);

  // ── Crear ──
  if (!id && !accion) {
    let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
    const fila: any = { estado: 'borrador', creada_por: uid };
    for (const k of CAMPOS_EDITABLES) if (body[k] !== undefined) fila[k] = body[k];
    if (!fila.nombre) return json({ error: 'Falta el nombre' }, 400);
    const { data, error } = await supabase.from('inapp_campanas').insert(fila).select().single();
    if (error) return json({ error: error.message }, 500);
    await auditar(data.id, 'creo', uid, { nombre: data.nombre });
    return json({ campana: data });
  }

  if (!id) return json({ error: 'Falta id' }, 400);
  const { data: c, error: e0 } = await supabase.from('inapp_campanas').select('*').eq('id', id).single();
  if (e0 || !c) return json({ error: 'Campaña no encontrada' }, 404);

  const setEstado = async (estado: string, extra: any = {}) => {
    const { error } = await supabase.from('inapp_campanas')
      .update({ estado, updated_at: new Date().toISOString(), ...extra }).eq('id', id);
    if (error) throw new Error(error.message);
  };

  try {
    switch (accion) {
      case 'revisar': {
        const errores = validarCampana(c);
        const res = await resolverAudiencia(c.audiencia || {});
        const holdoutEst = Math.round(res.cuentas.length * (c.holdout_pct || 0) / 100);
        return json({
          errores,
          avisos: c.comportamiento?.bloqueante ? ['Es un modal BLOQUEANTE: solo para cobranza/avisos críticos.'] : [],
          alcance: {
            companies: res.companies.length,
            cuentas: res.cuentas.length,
            holdout_estimado: holdoutEst,
            exclusiones: res.exclusiones,
            muestra: res.companies.slice(0, 10).map(x => ({ nombre: x.nombre, cuentas: x.cuentas })),
          },
        });
      }
      case 'activar': {
        const errores = validarCampana(c);
        if (errores.length) return json({ error: 'La campaña no pasa la revisión', errores }, 400);
        const r = await publicarCampana(c);
        await setEstado('activa', { pausa_motivo: null });
        await auditar(id, 'activo', uid, { cuentas: r.cuentas });
        return json({ ok: true, cuentas: r.cuentas });
      }
      case 'pausar': {
        await despublicarCampana(id);
        await setEstado('pausada', { pausa_motivo: 'manual' });
        await auditar(id, 'pauso', uid);
        return json({ ok: true });
      }
      case 'reanudar': {
        const r = await publicarCampana(c);
        await setEstado('activa', { pausa_motivo: null });
        await auditar(id, 'activo', uid, { reanudada: true, cuentas: r.cuentas });
        return json({ ok: true, cuentas: r.cuentas });
      }
      case 'terminar': {
        await despublicarCampana(id);
        await setEstado('terminada');
        await auditar(id, 'termino', uid);
        return json({ ok: true });
      }
      case 'archivar': {
        await despublicarCampana(id);
        await setEstado('archivada', { archived_at: new Date().toISOString() });
        await auditar(id, 'archivo', uid);
        return json({ ok: true });
      }
      case 'aprobar_bloqueante': {
        if (!uid) return json({ error: 'Sesión requerida para aprobar' }, 403);
        await supabase.from('inapp_campanas').update({ bloqueante_aprobada_por: uid, updated_at: new Date().toISOString() }).eq('id', id);
        await auditar(id, 'aprobo_bloqueante', uid);
        return json({ ok: true });
      }
      case 'prueba': {
        // Render REAL en la cuenta interna, sin tocar la audiencia de verdad:
        // se publica una copia efímera "<id>-prueba" dirigida solo a esa cuenta.
        let body: any = {}; try { body = await request.json(); } catch { /* opcional */ }
        const cuenta = String(body.cuenta || 'pruebasmongo').trim().toLowerCase();
        const doc = docParaSacs({ ...c, holdout_pct: 0 }, [cuenta]);
        doc.campana_id = `${id}-prueba`;
        doc.objetivo.grupos = null; doc.objetivo.uids = null;
        const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
        const r = await fetch(SACS_API + '/interno/crm/campanas-publicar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': (import.meta.env.CRM_SYNC_SECRET || '').trim() },
          body: JSON.stringify({ campanas: [doc] }),
        });
        if (!r.ok) return json({ error: 'sacs_api respondió ' + r.status }, 502);
        await auditar(id, 'prueba', uid, { cuenta });
        return json({ ok: true, cuenta, nota: 'Entra a SACS con esa cuenta para ver el render real. La prueba se retira sola al activar o archivar.' });
      }
      default:
        return json({ error: 'Acción desconocida' }, 400);
    }
  } catch (e: any) {
    return json({ error: e?.message || 'Error inesperado' }, 500);
  }
};

export const PUT: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);
  let body: any; try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }
  const upd: any = { updated_at: new Date().toISOString() };
  for (const k of CAMPOS_EDITABLES) if (body[k] !== undefined) upd[k] = body[k];
  const { data, error } = await supabase.from('inapp_campanas').update(upd).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 500);
  const uid = await quien(request);
  await auditar(id, 'edito', uid, { campos: Object.keys(upd).filter(k => k !== 'updated_at') });
  // Editar una campaña VIVA re-publica para que sacs_api sirva lo nuevo.
  if (data.estado === 'activa') {
    try { await publicarCampana(data); } catch (e: any) { return json({ campana: data, aviso: 'Guardada, pero no se pudo re-publicar: ' + (e?.message || '') }); }
  }
  return json({ campana: data });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);
  const { data: c } = await supabase.from('inapp_campanas').select('estado').eq('id', id).single();
  if (c && c.estado === 'activa') return json({ error: 'Pausa o termina la campaña antes de archivarla' }, 400);
  try { await despublicarCampana(id); } catch { /* mejor esfuerzo: puede no estar publicada */ }
  const { error } = await supabase.from('inapp_campanas')
    .update({ estado: 'archivada', archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  await auditar(id, 'archivo', await quien(request));
  return json({ ok: true });
};
