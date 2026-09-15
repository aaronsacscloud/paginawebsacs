// GET /api/cron/de-ciclo?tipo=diario|semanal|mensual — abre un ciclo del motor.
//
// No ejecuta nada por sí mismo: arma la cadena en la cola y se va. Quien
// trabaja es el worker. Así una corrida larga no depende de que esta función
// sobreviva, y todo lo que va a pasar se puede ver (y aprobar) antes.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { abrirCiclo, armarCadena } from '../../../lib/demanda/ciclo';
import { leerConfig } from '../../../lib/demanda/config';
import { encolar } from '../../../lib/demanda/cola';
import { diaCdmx } from '../../../lib/demanda/fechas';
import '../../../lib/demanda/registro';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const tipo = (url.searchParams.get('tipo') || 'diario') as any;
  if (!['diario', 'semanal', 'mensual', 'manual'].includes(tipo)) return json({ error: 'tipo inválido' }, 400);

  try {
    const cfg = await leerConfig(true);
    if (cfg.kill_switch) return json({ ok: false, frenado: 'kill switch' });

    const { id, nuevo } = await abrirCiclo(tipo, undefined, cfg.modo === 'simulacion');
    const cadena = await armarCadena(id, tipo, cfg);
    // La salud se mide en cada ciclo: si el motor se rompe, tiene que poder
    // decirlo él mismo antes de que alguien lo note por ausencia.
    await encolar({ tipo: 'sistema.salud', clave_idem: `salud:${diaCdmx()}:${tipo}`, prioridad: 90, ciclo_id: id }, cfg);

    return json({ ok: true, ciclo_id: id, nuevo, tipo, ...cadena });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
