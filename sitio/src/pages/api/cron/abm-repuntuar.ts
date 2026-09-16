// Vuelve a calificar cuentas en lote.
//
// POR QUÉ EXISTE. `abm-barrido` insertaba sin escribir `puntaje`, y la columna
// es NOT NULL DEFAULT 0: 7,105 cuentas quedaron en cero cuando el mínimo que
// puede dar el cálculo es 12. Cero no significaba «no nos sirve», significaba
// «nadie la calificó» — y todo lo que ordena por puntaje (el goteo y el
// WhatsApp en frío) las mandaba al final de la fila. Lo más fresco de la base
// era lo último en salir (16-sep-2026).
//
// El barrido ya califica al entrar. Esto es para las que ya estaban, y para
// cuando cambie la fórmula: entonces hay que repasar TODAS, no solo las nuevas.
//
// Se usa `repuntuar`, que es la misma función que usan la ficha y el vigilante.
// Copiar la fórmula a SQL habría sido más rápido y habría creado una segunda
// verdad que se despega de la primera en cuanto alguien toque los pesos.
//
//   GET /api/cron/abm-repuntuar?cuantas=500          las que están en cero
//   GET /api/cron/abm-repuntuar?cuantas=500&todas=1  todas, para un cambio de fórmula
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { quien, quienPuedeCorrerCrons, repuntuar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  /* FALLA CERRADO. Antes era `if (secret && auth !== ...)`: sin CRON_SECRET
     en el entorno, la condición nunca entraba y el endpoint quedaba ABIERTO a
     internet. Hoy el secreto sí existe, así que estaba tapado — pero el día
     que alguien lo renombre, migre de proyecto o lo borre, esto pasa de
     protegido a «cualquiera dispara la ronda» sin un solo error visible.
     `isAuthorizedCron` acepta el header del scheduler de Vercel o el secreto,
     y niega en cualquier otro caso; es el mismo helper que usan los otros 47
     crons. La sesión del CRM sigue valiendo para dispararlo a mano. */
  if (!isAuthorizedCron(request)) {
    const yo = await quienPuedeCorrerCrons(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const cuantas = Math.min(1000, Math.max(1, Number(url.searchParams.get('cuantas') || 300)));
  const todas = url.searchParams.get('todas') === '1';

  /* CÓMO AVANZA CADA MODO, que es lo único delicado de este endpoint:
     · solo cero → el orden da igual: calificar saca a la cuenta del filtro, así
       que el siguiente lote ya no la ve. Se toman las de más reseñas primero
       para que, si la corrida se corta, lo calificado sea lo que antes salía.
     · todas → no hay filtro que sacar, así que un orden fijo pesca SIEMPRE las
       mismas mil. Se ordena por `updated_at` ASCENDENTE: repuntuar escribe ese
       campo, así que cada cuenta calificada se va al final de la fila y la
       siguiente corrida toma las que llevan más sin revisar. La cola avanza
       sola, sin cursor y sin estado que se pueda perder.
       (Lo escribí mal la primera vez y el lote se repetía en bucle — el mismo
       error que el modo DNS de la verificación de correos.) */
  let q = supabase.from('abm_cuentas').select('id, puntaje').limit(cuantas);
  q = todas
    ? q.order('updated_at', { ascending: true, nullsFirst: true })
    : q.eq('puntaje', 0).order('google_resenas', { ascending: false, nullsFirst: false });
  const { data: cuentas, error } = await q;
  if (error) return json({ error: error.message }, 500);
  if (!cuentas?.length) return json({ repuntuadas: 0, nota: 'no quedan cuentas sin calificar' });

  let cambiadas = 0;
  for (const c of cuentas) {
    await repuntuar(c.id);
    cambiadas++;
  }

  const { count: faltan } = await supabase.from('abm_cuentas')
    .select('id', { count: 'exact', head: true }).eq('puntaje', 0);

  return json({
    repuntuadas: cambiadas, quedan_en_cero: faltan ?? null,
    modo: todas ? 'todas' : 'solo las de cero',
    nota: todas ? 'ordena por updated_at: cada corrida toma las que llevan más sin revisar' : undefined,
  });
};
