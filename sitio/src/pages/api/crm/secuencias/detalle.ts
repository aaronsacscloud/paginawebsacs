/**
 * QUÉ ES ESTA SECUENCIA, QUÉ MANDA Y QUÉ SIGUE — para el drawer del inbox.
 *
 * Cuando un lead entra a una secuencia, en su conversación aparece un
 * comentario interno que lo dice. Pero decir el NOMBRE no sirve de nada: quien
 * lo lee no sabe qué le vamos a mandar ni cuándo. Y salir del inbox a buscarlo
 * es el paso que hace que no se mire.
 *
 * Devuelve la secuencia con sus pasos y, si se pasa un contacto, cuáles YA
 * salieron y cuál sigue con su fecha.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const CANAL: Record<string, string> = { correo: 'Correo', wa: 'WhatsApp', inapp: 'Mensaje dentro de Sacs' };

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const id = url.searchParams.get('id');
  const nombre = url.searchParams.get('nombre');
  const contacto = url.searchParams.get('contacto');
  if (!id && !nombre) return json({ error: 'Falta el id o el nombre de la secuencia.' }, 400);

  /* Por id cuando se tiene (las notas nuevas lo guardan). Por nombre para las
     viejas, que solo lo traen en el texto. */
  let q = supabase.from('crm_secuencias')
    .select('id, nombre, descripcion, objetivo, activa, dias_envio, hora_inicio, hora_fin, corte_dias, modo, entrada');
  q = id ? q.eq('id', id) : q.eq('nombre', nombre!);
  const { data: sec } = await q.limit(1).maybeSingle();
  if (!sec) return json({ error: 'Esa secuencia ya no existe.' }, 404);

  /* Ordenado por `orden` y nada más, igual que el cron: en una secuencia
     permanente el paso que toca es «el siguiente de su carril que no haya
     visto», y ese índice lo define este orden. Ordenar por `dia` primero no
     cambiaba nada mientras todos los pasos fueran del día 1, pero el día que
     alguien ponga otro día, la lista que se enseña y la que manda dejarían de
     ser la misma. */
  const { data: pasos } = await supabase.from('crm_secuencia_pasos')
    .select('id, orden, dia, dia_semana, vigente_hasta, canal, wa_plantilla, email_template_id, inapp_campana_id, activo')
    .eq('secuencia_id', sec.id).order('orden');

  /* El nombre humano de lo que manda cada paso. Sin esto el drawer diría
     «correo · plantilla 42», que no le dice nada a nadie. */
  const idsEmail = [...new Set((pasos || []).map((p: any) => p.email_template_id).filter(Boolean))];
  const nombresEmail = new Map<string, string>();
  if (idsEmail.length) {
    const { data: ts } = await supabase.from('email_templates').select('id, nombre, asunto').in('id', idsEmail);
    for (const t of ts || []) nombresEmail.set(String(t.id), String((t as any).asunto || (t as any).nombre || ''));
  }

  let miembro: any = null;
  if (contacto) {
    const { data } = await supabase.from('crm_secuencia_miembros')
      .select('inicio, enviados, detenida_at, motivo, canales_detenidos')
      .eq('secuencia_id', sec.id).eq('contact_id', contacto).maybeSingle();
    miembro = data || null;
  }

  const enviados: Record<string, string> = (miembro?.enviados as any) || {};
  const inicio = miembro?.inicio ? new Date(miembro.inicio) : null;

  /* ══ DOS RITMOS DISTINTOS, Y SE VEÍAN IGUAL ═══════════════════════════════
     Una secuencia NORMAL tiene pasos con día: 1, 3, 7… y se cuentan desde que
     el lead entró. Una PERMANENTE no: es un goteo sin final, sus pasos viven
     todos en el «día 1» y lo que manda hoy se decide por dos cosas —el carril
     del día de la semana (`dia_semana`) y cuántos de ESE carril ya vio—, con
     un mínimo de `cada_dias` entre mensaje y mensaje.

     Esta pantalla no sabía nada de eso: tomaba el `dia` de cada paso y le
     sumaba esos días a la fecha de entrada. Con 33 pasos en el día 1, el
     resultado era una lista que decía que hoy salen treinta y tres correos.
     No es lo que hace el cron —manda UNO— pero es lo que se leía, y con esa
     lista enfrente lo correcto es asustarse. */
  const esPermanente = (sec as any).modo === 'permanente';
  const cadaDias = Math.max(1, Number(((sec as any).entrada || {}).cada_dias) || 14);
  const cdmx = new Date(Date.now() - 6 * 3600e3);
  const hoyISO = cdmx.toISOString().slice(0, 10);
  const diasEnvio: number[] = Array.isArray(sec.dias_envio) && sec.dias_envio.length ? sec.dias_envio : [1, 2, 3, 4, 5];

  // Mismo filtro que el cron: un paso vencido ya no cuenta ni para el orden.
  const activos = (pasos || []).filter((p: any) => p.activo !== false
    && (!p.vigente_hasta || String(p.vigente_hasta) >= hoyISO));
  const conCarril = esPermanente && activos.some((p: any) => p.dia_semana);

  /* Las fechas del goteo. Se proyectan carril por carril: el primer pendiente
     de cada carril cae en la próxima vez que toque ese día de la semana, y los
     siguientes, una semana después cada uno. El piso es `cada_dias` desde el
     último mensaje que sí salió: ese es el candado que de verdad impide dos
     seguidos. */
  const estimados = new Map<string, string>();
  if (conCarril) {
    const ultimo = Object.values(enviados).map(x => Date.parse(String(x))).filter(Boolean).sort().pop() || 0;
    const piso = new Date(Math.max(cdmx.getTime(), ultimo ? ultimo + cadaDias * 86400e3 : 0));
    const pisoDia = new Date(`${piso.toISOString().slice(0, 10)}T12:00:00Z`);
    const carriles = [...new Set(activos.map((p: any) => Number(p.dia_semana)).filter(Boolean))];
    for (const dsem of carriles) {
      if (!diasEnvio.includes(dsem)) continue;   // ese día la secuencia no manda: no hay fecha que prometer
      const delCarril = activos.filter((p: any) => Number(p.dia_semana) === dsem);
      const yaVistos = delCarril.filter((p: any) => enviados[p.id]).length;
      const pendientes = delCarril.filter((p: any) => !enviados[p.id]).slice(0, 60);
      // La primera vez que toca ese día, a partir del piso (hoy incluido).
      const d = new Date(pisoDia);
      const actual = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      d.setUTCDate(d.getUTCDate() + ((dsem - actual + 7) % 7));
      for (let i = 0; i < pendientes.length; i++) {
        estimados.set(pendientes[i].id, new Date(d.getTime() + i * 7 * 86400e3).toISOString().slice(0, 10));
      }
      void yaVistos;
    }
  }

  const lista = activos.map((p: any) => {
    const ya = enviados[p.id] || null;
    /* Secuencia normal: el día 1 es el día que entró. No es una promesa —la
       ventana horaria y los candados pueden correrla— y por eso se marca como
       estimada en la pantalla. */
    const cuando = !conCarril && inicio ? new Date(inicio.getTime() + (Number(p.dia) - 1) * 86400000) : null;
    return {
      id: p.id, dia: p.dia, orden: p.orden, dia_semana: p.dia_semana || null,
      canal: CANAL[p.canal] || p.canal,
      que: p.canal === 'wa' ? (p.wa_plantilla || 'plantilla sin asignar')
        : p.canal === 'correo' ? (nombresEmail.get(String(p.email_template_id)) || 'correo sin asignar')
        : (p.inapp_campana_id ? 'campaña dentro de Sacs' : 'campaña sin asignar'),
      enviado_at: ya,
      estimado: ya ? null : (conCarril ? (estimados.get(p.id) || null) : cuando ? cuando.toISOString().slice(0, 10) : null),
      /* Un paso SIN día de la semana dentro de una secuencia que sí los usa
         NUNCA sale: el cron se queda solo con los del carril de hoy y este no
         está en ninguno. No es un pendiente, es un paso muerto, y hay que
         decirlo — si no, la pantalla promete un mensaje que no va a salir. */
      sin_carril: conCarril && !p.dia_semana && !ya,
    };
  });

  /* «Qué sigue» en un goteo NO es el primero de la lista: es el pendiente que
     cae antes en el calendario, que puede ser de otro carril. */
  const pendientes = lista.filter(p => !p.enviado_at);
  const siguiente = conCarril
    ? (pendientes.filter(p => p.estimado).sort((a, b) => String(a.estimado).localeCompare(String(b.estimado)))[0] || null)
    : (pendientes[0] || null);

  return json({
    secuencia: {
      id: sec.id, nombre: sec.nombre, descripcion: sec.descripcion || null,
      objetivo: sec.objetivo || null, activa: sec.activa === true,
      dias_envio: sec.dias_envio || null, hora_inicio: sec.hora_inicio, hora_fin: sec.hora_fin,
      corte_dias: sec.corte_dias || null,
    },
    /* El ritmo, dicho con todas sus letras: sin esto la pantalla enseña una
       lista de 33 renglones y deja que quien la lea suponga el resto. */
    ritmo: esPermanente ? {
      permanente: true, cada_dias: cadaDias,
      carriles: conCarril ? [...new Set(activos.map((p: any) => Number(p.dia_semana)).filter(Boolean))].sort() : [],
      pendientes: lista.filter(p => !p.enviado_at && p.estimado).length,
      // Los que están configurados de forma que no pueden salir nunca.
      muertos: lista.filter(p => (p as any).sin_carril).length,
    } : null,
    pasos: lista,
    siguiente,
    /* Detenida NO es lo mismo que terminada: quien la lee necesita saber si
       todavía le va a llegar algo o no. */
    estado: !miembro ? 'no_esta'
      : miembro.detenida_at ? 'detenida'
      : siguiente ? 'en_curso' : 'terminada',
    motivo: miembro?.motivo || null,
    canales_detenidos: miembro?.canales_detenidos || null,
    inicio: miembro?.inicio || null,
  });
};
