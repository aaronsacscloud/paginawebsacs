// POST /api/crm/demanda/ajustes — lo que el dueño controla del motor.
//
// Dos objetos distintos a propósito: `config` es cómo se comporta el motor
// (autonomía, presupuesto, interruptores) y `conector` es una fuente. Nada de
// esto acepta secretos: las credenciales viven en el entorno del servidor y
// aquí solo se dice si están o no.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { permisosDe, puedeEditar } from '../../../../lib/crm/permisos';
import { guardarConfig } from '../../../../lib/demanda/config';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const CAMPOS_CONFIG = ['autonomia_global', 'presupuesto_mensual_usd', 'kill_switch', 'modo', 'mercados', 'idiomas', 'umbrales', 'dueno_whatsapp'];

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const { data: miembro } = user
    ? await supabase.from('team_members').select('rol, permisos').eq('id', user.id).maybeSingle()
    : { data: null };
  if (!puedeEditar(permisosDe(miembro || { rol: user?.role }), 'demanda'))
    return json({ ok: false, error: 'Sin permiso para configurar el motor' }, 403);

  const body = await request.json().catch(() => ({}));

  if (body.config) {
    const parche: any = {};
    for (const k of CAMPOS_CONFIG) if (k in body.config) parche[k] = body.config[k];
    if ('autonomia_global' in parche) parche.autonomia_global = Math.max(0, Math.min(4, Number(parche.autonomia_global)));
    const cfg = await guardarConfig(parche);
    return json({ ok: true, config: cfg });
  }

  if (body.conector?.id) {
    const { id, activo, cadencia, cuota_dia, config } = body.conector;
    const parche: any = { actualizado_at: new Date().toISOString() };
    if (activo !== undefined) parche.activo = !!activo;
    if (cadencia) parche.cadencia = cadencia;
    if (cuota_dia !== undefined) parche.cuota_dia = cuota_dia === null ? null : Number(cuota_dia);
    if (config) parche.config = config;
    const { error } = await supabase.from('de_conectores').update(parche).eq('id', id);
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
  }

  if (body.politica?.tipo_accion) {
    const { tipo_accion, nivel, tope_dia, requiere_aprobacion } = body.politica;
    // Los guardrails no se mueven desde la aplicación. Es el punto entero de
    // marcarlos inmutables: un motor que puede ampliarse sus propios permisos
    // no tiene permisos.
    const { data: p } = await supabase.from('de_politicas').select('inmutable').eq('tipo_accion', tipo_accion).maybeSingle();
    if (!p) return json({ ok: false, error: 'política inexistente' }, 404);
    if (p.inmutable) return json({ ok: false, error: 'Esta política es un guardrail: no se cambia desde aquí.' }, 403);

    const parche: any = { actualizado_at: new Date().toISOString() };
    if (nivel !== undefined) parche.nivel = Math.max(0, Math.min(4, Number(nivel)));
    if (tope_dia !== undefined) parche.tope_dia = tope_dia === null ? null : Number(tope_dia);
    if (requiere_aprobacion !== undefined) parche.requiere_aprobacion = !!requiere_aprobacion;
    const { error } = await supabase.from('de_politicas').update(parche).eq('tipo_accion', tipo_accion);
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
  }

  /* CONCEDER AUTONOMÍA · el clic del dueño sobre lo que el motor se ganó.
     Se podría hacer con `body.politica` cambiando el nivel a mano, y por eso
     esto existe aparte: aquí la evidencia se vuelve a calcular EN EL SERVIDOR
     antes de conceder. Si el cliente pide subir un tipo que no cumple los
     criterios, se rechaza — aunque la pantalla lo haya enseñado como ganado
     hace diez minutos y el historial haya cambiado desde entonces.

     Un permiso concedido sobre una lista que el cliente mandó es un permiso
     concedido por el cliente. */
  if (body.conceder_autonomia?.tipo_accion) {
    const tipo = String(body.conceder_autonomia.tipo_accion);
    const { evaluar } = await import('../../../../lib/demanda/autonomia');
    const propuestas = await evaluar();
    const p = propuestas.find(x => x.tipo_accion === tipo);

    if (!p) return json({ ok: false, error: `«${tipo}» no es un tipo que pueda subir de nivel.` }, 400);
    if (p.inmutable) return json({ ok: false, error: 'Esta política es un guardrail: no se toca desde aquí.' }, 403);
    if (!p.se_lo_gano) {
      const faltan = p.criterios.filter(c => !c.cumple).map(c => `${c.que} (${c.medido})`);
      return json({ ok: false, error: `Todavía no se lo gana. Falta: ${faltan.join('; ')}.` }, 409);
    }

    const { error } = await supabase.from('de_politicas').update({
      nivel: p.nivel_propuesto,
      notas: `Subió por evidencia el ${new Date().toISOString().slice(0, 10)}: ${p.criterios.map(c => c.medido).join(' · ')}. Concedido por ${user?.email || 'el dueño'}.`,
      actualizado_at: new Date().toISOString(),
    }).eq('tipo_accion', tipo).eq('inmutable', false);

    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, tipo_accion: tipo, nivel: p.nivel_propuesto });
  }

  return json({ ok: false, error: 'nada que guardar' }, 400);
};
