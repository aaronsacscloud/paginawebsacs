/**
 * CRON diario · el reloj de las pruebas gratis.
 *
 * Hace las tres cosas que antes no hacía nadie:
 *
 *   · AVISA ANTES. A 3 días y a 1 día del final deja una notificación en la
 *     campana. No es cortesía: una prueba que llega al último día sin que nadie
 *     haya llamado ya se perdió, y el aviso post-mortem no la recupera.
 *   · CIERRA AL VENCER. Marca la prueba como terminada y le pone a la cuenta el
 *     MISMO aviso que le pondría una persona desde sacs3 —con su botón de
 *     WhatsApp para contratar—, deja la actividad en la ficha (que es la que
 *     pinta el inbox) y avisa por la campana.
 *   · REINTENTA EL BLOQUEO. Si el aviso no se pudo poner —cuenta borrada, API
 *     caída—, la prueba queda `terminada` pero sin `prueba_bloqueada_at`, y la
 *     corrida siguiente lo vuelve a intentar. Sin esto, un timeout de una noche
 *     dejaba una cuenta vencida abierta para siempre y en silencio.
 *
 * Corre a las 9 UTC = 3 am CDMX, después del cron de uso de cuentas: así, si
 * alguien mira la ficha en la mañana, el «usó el sistema hasta ayer» ya está
 * fresco cuando aparece el aviso de que se acabó.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { CAMPOS_PRUEBA, terminarPrueba, avisoEnCuenta, diasRestantes, WHATSAPP_VENTAS } from '../../../lib/crm/prueba';

export const prerender = false;

/** Tope por corrida. Corre a diario, así que 200 es holgado — y si algún día
 *  no lo fuera, es mejor que la corrida termine y el resto caiga mañana a que
 *  se muera a la mitad dejando la mitad de las cuentas sin aviso. */
const MAX = 200;

const nombreDe = (c: any) => [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || c.email || 'un lead';

export const GET: APIRoute = async () => {
  const hechos = { vencidas: 0, avisadas: 0, reintentos: 0, errores: [] as string[] };

  // ── 1. Las que ya vencieron ────────────────────────────────────────────────
  const { data: vencidas } = await supabase.from('contacts')
    .select(CAMPOS_PRUEBA)
    .eq('prueba_estado', 'activa')
    .lt('prueba_fin', new Date().toISOString())
    .is('archived_at', null)
    .limit(MAX);

  for (const c of vencidas || []) {
    const r = await terminarPrueba(c, { motivo: 'vencio' });
    hechos.vencidas++;
    if (!r.bloqueo.ok) hechos.errores.push(`${c.prueba_cuenta || c.id}: ${r.bloqueo.error}`);
  }

  // ── 2. Las que se van a acabar: 3 días y 1 día ─────────────────────────────
  // `clave` distinta por umbral para que la campana avise dos veces, pero solo
  // una por umbral aunque el cron corra de más.
  const { data: porVencer } = await supabase.from('contacts')
    .select(CAMPOS_PRUEBA)
    .eq('prueba_estado', 'activa')
    .gte('prueba_fin', new Date().toISOString())
    .lte('prueba_fin', new Date(Date.now() + 3 * 86400000).toISOString())
    .is('archived_at', null)
    .limit(MAX);

  for (const c of porVencer || []) {
    const restan = diasRestantes(c.prueba_fin);
    if (restan == null) continue;
    const umbral = restan <= 1 ? 1 : restan <= 3 ? 3 : null;
    if (!umbral) continue;

    const nuevo = await notificar({
      clave: `prueba_pv:${c.id}:${umbral}`,
      tipo: 'prueba_por_vencer',
      nivel: umbral === 1 ? 'urgente' : 'alerta',
      titulo: umbral === 1
        ? `Mañana se acaba la prueba de ${nombreDe(c)}`
        : `Quedan ${restan} días de prueba a ${nombreDe(c)}`,
      detalle: c.whatsapp
        ? `Escríbele por WhatsApp antes de que se le cierre la cuenta: wa.me/${String(c.whatsapp).replace(/\D/g, '')}`
        : `Sin WhatsApp en la ficha. Ventas: wa.me/${WHATSAPP_VENTAS}`,
      company_id: c.company_id || null,
      destino: 'leads',
      metadata: { contact_id: c.id, cuenta: c.prueba_cuenta, restan, umbral },
    });
    if (nuevo) hechos.avisadas++;
  }

  // ── 3. Reintento del aviso que no se pudo poner ────────────────────────────
  const { data: pendientes } = await supabase.from('contacts')
    .select(CAMPOS_PRUEBA)
    .in('prueba_estado', ['terminada', 'cancelada'])
    .is('prueba_bloqueada_at', null)
    .not('prueba_cuenta', 'is', null)
    .limit(50);

  for (const c of pendientes || []) {
    const r = await avisoEnCuenta(c.prueba_cuenta!, 'bloquear');
    if (r.ok) {
      await supabase.from('contacts').update({ prueba_bloqueada_at: new Date().toISOString() }).eq('id', c.id);
      hechos.reintentos++;
    } else {
      /* NO_ES_PRUEBA es definitivo, no un fallo pasajero: esa cuenta no nació
         como prueba (se creó a mano en SACS y se ligó después). Reintentarla
         cada noche para siempre es ruido; se anota y se deja de intentar. */
      if (/NO_ES_PRUEBA|no nació como prueba/i.test(r.error || '')) {
        await supabase.from('contacts').update({ prueba_bloqueada_at: new Date().toISOString() }).eq('id', c.id);
        hechos.errores.push(`${c.prueba_cuenta}: la cuenta no es de prueba, no se bloquea (se deja de reintentar)`);
      } else {
        hechos.errores.push(`${c.prueba_cuenta}: ${r.error}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, ...hechos }), { headers: { 'Content-Type': 'application/json' } });
};
