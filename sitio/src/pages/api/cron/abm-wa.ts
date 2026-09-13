// ══ CRON · La cadencia de WhatsApp en frío del ABM ═══════════════════════════
//
// Manda los tres toques de WhatsApp a las cuentas del motor Account-Based. Lo
// que NO hace es tan importante como lo que hace, así que va primero:
//
//   · NO le escribe a un número que el negocio no haya publicado él mismo.
//     Además de filtrarlo aquí, hay un trigger en abm_toques que lo impide
//     aunque alguien se equivoque (§6 bis del manual).
//   · NO sigue insistiendo si ya contestaron. Una respuesta detiene la
//     cadencia: de ahí en adelante es una conversación, y la lleva una persona
//     o la IA dentro de la ventana de 24 h.
//   · NO manda de noche ni en fin de semana. Un mensaje de trabajo a las 9 de
//     la noche molesta de verdad, y en WhatsApp molestar se paga con un reporte.
//   · NO manda todo de golpe. Tandas chicas, con tope por corrida y por día.
//
// EL RITMO
//   toque 1  día 0    apertura
//   toque 2  día 4    seguimiento, con contenido distinto al primero
//   toque 3  día 11   cierre, sin reclamar, con botón para agendar solos
//
// POR QUÉ TRES Y NO SIETE COMO EL CORREO
// Un correo ignorado se archiva; un WhatsApp ignorado se acumula en la pantalla
// de alguien que está trabajando. El cuarto mensaje no consigue una respuesta:
// consigue un reporte.
//
// GET /api/cron/abm-wa?cuantas=&giro=&dry=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { apuntar, quien } from '../../../lib/crm/abm.lib';
import { ABM_FRIO, paramsFrios, GIRO_FRIO } from '../../../lib/crm/abm-wa-plantillas';
import { enviarPlantilla, sanearParam } from '../../../lib/whatsapp/kapso-api';
import { permitido } from '../../../lib/whatsapp/permisos';
import { puedeMandarWa } from '../../../lib/whatsapp/presion';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

/** Los días de cada toque, contados desde el primero. */
const DIAS = [0, 4, 11];

/** Horario en que se puede escribir, hora del centro de México. Fuera de esto
 *  no sale nada: ni temprano, ni tarde, ni sábado o domingo. */
const HORA_ABRE = 10, HORA_CIERRA = 18;

function enHorario(): { ok: boolean; motivo?: string } {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const dia = ahora.getDay();
  if (dia === 0 || dia === 6) return { ok: false, motivo: 'fin de semana' };
  const h = ahora.getHours();
  if (h < HORA_ABRE || h >= HORA_CIERRA) return { ok: false, motivo: `son las ${h}:00 en CDMX, se escribe de ${HORA_ABRE} a ${HORA_CIERRA}` };
  return { ok: true };
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = env('CRON_SECRET');
  if (!(secret && auth === `Bearer ${secret}`)) {
    const yo = await quien(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const dry = url.searchParams.get('dry') === '1';
  const cuantas = Math.min(50, Number(url.searchParams.get('cuantas') || 10));
  const giroFiltro = url.searchParams.get('giro') || '';

  // ── Las puertas, en orden de qué tan barato es comprobarlas ────────────────

  // 1. La pausa global del motor manda sobre todo lo demás.
  const { data: cfg } = await supabase.from('abm_config').select('clave, valor');
  const conf = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r.valor]));
  if (conf.pausado === 'si') return json({ enviados: 0, motivo: 'el motor está pausado' });

  // 2. El apagador de esta automatización en concreto. Si no se puede leer la
  //    tabla, `permitido` devuelve false: en la duda no se le escribe a nadie.
  if (!(await permitido('abm_frio' as any))) return json({ enviados: 0, motivo: 'la automatización abm_frio está apagada' });

  // 3. La hora. Esto no se salta ni con dry.
  const hora = enHorario();
  if (!hora.ok) return json({ enviados: 0, motivo: `fuera de horario: ${hora.motivo}` });

  // ── A quién le toca ───────────────────────────────────────────────────────
  // Solo números DECLARADOS: los que el propio negocio publicó como WhatsApp.
  let q = supabase.from('v_whatsapp_contactable')
    .select('cuenta_id, valor, giro, cuenta_nombre, puntaje')
    .order('puntaje', { ascending: false, nullsFirst: false })
    .limit(cuantas * 12);          // se piden de más: muchos se van a filtrar
  if (giroFiltro) q = q.eq('giro', giroFiltro);
  const { data: candidatos, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const hoy = Date.now();
  const salida: any[] = [];
  const saltados: Record<string, number> = {};
  const salta = (k: string) => { saltados[k] = (saltados[k] || 0) + 1; };

  for (const c of candidatos || []) {
    if (salida.length >= cuantas) break;
    if (!GIRO_FRIO[c.giro]) { salta(`sin guion para ${c.giro}`); continue; }

    // Si ya contestaron, la cadencia terminó: lo que sigue es una conversación.
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('ultimo_entrante_at').eq('telefono', c.valor).maybeSingle();
    if (conv?.ultimo_entrante_at) { salta('ya contestó'); continue; }

    // Qué toques de WhatsApp lleva esta cuenta.
    const { data: previos } = await supabase.from('abm_toques')
      .select('programado_at, estado')
      .eq('cuenta_id', c.cuenta_id).eq('canal', 'whatsapp')
      .in('estado', ['enviado', 'programado'])
      .order('programado_at');
    const hechos = (previos || []).length;
    if (hechos >= DIAS.length) { salta('cadencia terminada'); continue; }

    // ¿Ya le toca el siguiente? Se cuenta desde el PRIMERO, no desde el último,
    // para que un retraso de un día no corra toda la cadencia.
    if (hechos > 0) {
      const primero = new Date((previos as any[])[0].programado_at).getTime();
      const diasDesde = Math.floor((hoy - primero) / 864e5);
      if (diasDesde < DIAS[hechos]) { salta('todavía no le toca'); continue; }
    }

    // La presión: no dos mensajes nuestros muy seguidos, venga de donde venga.
    const v = await puedeMandarWa(c.valor);
    if (!v.ok) { salta('escrito hace poco'); continue; }

    const params = paramsFrios((hechos + 1) as 1 | 2 | 3, { ...c, nombre: c.cuenta_nombre });
    if (!params) { salta('sin parámetros'); continue; }
    const plantilla = ABM_FRIO[hechos];

    if (dry) {
      salida.push({ cuenta: c.cuenta_nombre, giro: c.giro, paso: hechos + 1, plantilla: plantilla.nombre, params });
      continue;
    }

    try {
      await enviarPlantilla(c.valor, plantilla.nombre, plantilla.idioma, params.map(sanearParam));
      // Se guarda el toque DESPUÉS de que Meta lo aceptó. Al revés quedaría
      // registrado un envío que no ocurrió, y la cuenta nunca recibiría ese paso.
      const { error: eIns } = await supabase.from('abm_toques').insert({
        cuenta_id: c.cuenta_id, canal: 'whatsapp', destino: c.valor,
        asunto: plantilla.nombre, cuerpo: params.join(' · '),
        estado: 'enviado', programado_at: new Date().toISOString(),
      });
      if (eIns) console.error('[abm-wa] no se pudo guardar el toque:', eIns.message);
      await apuntar(c.cuenta_id, 'whatsapp', 'salida', {
        texto: `WhatsApp ${hechos + 1}/3 (${plantilla.nombre}) a ${c.valor}`,
      });
      salida.push({ cuenta: c.cuenta_nombre, paso: hechos + 1 });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // 131026 = el número no tiene WhatsApp. Es la única forma de saberlo con
      // certeza, y se aprovecha: se marca inválido y no se vuelve a intentar.
      if (/131026|not a whatsapp|undeliverable/i.test(msg)) {
        await supabase.from('abm_canales').update({ estado: 'invalido', verificado_at: new Date().toISOString() })
          .eq('cuenta_id', c.cuenta_id).eq('valor', c.valor);
        await apuntar(c.cuenta_id, 'whatsapp', 'nota', { texto: `El número ${c.valor} no tiene WhatsApp (131026): queda para llamada.` });
        salta('sin whatsapp (131026)');
      } else {
        console.warn('[abm-wa]', c.cuenta_nombre, msg.slice(0, 160));
        salta('error de envío');
      }
    }
  }

  return json({ enviados: dry ? 0 : salida.length, dry, detalle: salida, saltados });
};
