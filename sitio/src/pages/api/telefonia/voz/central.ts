// La puerta de la central de voz (voz/server.mjs) al CRM. Bearer VOZ_SECRET.
//   { accion: 'contexto',    item, prueba?, callSid? }
//   { accion: 'turno',       item, quien: 'contacto'|'fernanda', texto, t?, callSid? }
//   { accion: 'herramienta', item, nombre, args }
//   { accion: 'fin',         item, ...resumen }
//   { accion: 'latir',       item }   (después del fin: cierre con IA → siguiente)
import type { APIRoute } from 'astro';
import { secretoValido, contextoVoz, registrarTurno, ejecutarHerramienta, finLlamadaVoz, latirDesdeCentral } from '../../../../lib/telefonia/voz';

export const prerender = false;
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!secretoValido(request.headers.get('authorization'))) return json({ error: 'sin autorización' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }
  const item = String(b?.item || '');
  if (!item || !/^(prueba-[a-z0-9]+|[0-9a-f-]{36})$/.test(item)) return json({ error: 'item inválido' }, 400);
  try {
    switch (b.accion) {
      case 'contexto': return json(await contextoVoz(item, { prueba: !!b.prueba, callSid: b.callSid }));
      case 'turno': return json(await registrarTurno(item, { quien: b.quien === 'fernanda' ? 'fernanda' : 'contacto', texto: String(b.texto || ''), t: b.t, callSid: b.callSid }));
      case 'herramienta': return json(await ejecutarHerramienta(item, String(b.nombre || ''), b.args || {}));
      case 'fin': return json(await finLlamadaVoz(item, b));
      case 'latir': return json(await latirDesdeCentral(item));
      default: return json({ error: 'acción desconocida' }, 400);
    }
  } catch (e: any) {
    console.error('[voz/central]', b.accion, item, e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
};
