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
import { apuntar, quien, quienPuedeCorrerCrons } from '../../../lib/crm/abm.lib';
import { ABM_FRIO, paramsFrios, GIRO_FRIO, ALIADO_FRIO, paramsAliado } from '../../../lib/crm/abm-wa-plantillas';
import { enviarPlantilla, sanearParam, conLinea } from '../../../lib/whatsapp/kapso-api';
import { lineaPara, infoLinea } from '../../../lib/whatsapp/linea';
import { telefonoWhatsApp } from '../../../lib/telefono';
import { enHorarioDe } from '../../../lib/crm/abm-paises';
import { permitido } from '../../../lib/whatsapp/permisos';
import { puedeMandarWa } from '../../../lib/whatsapp/presion';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

/** Los días de cada toque, contados desde el primero. */
const DIAS = [0, 4, 11];

/** Sábado y domingo no se escribe, y eso sí es igual en todos lados. La HORA,
 *  en cambio, es la de CADA CUENTA: se revisa abajo con `enHorarioDe(pais)`.
 *  Estaba fijo a CDMX, y como el cron corre de 16 a 23 UTC, a un negocio de
 *  Madrid le habría llegado un WhatsApp comercial entre las 6 de la tarde y la
 *  1 de la madrugada. `abm-whatsapp.ts` ya lo hacía bien; este no. */
function esFinDeSemana(): boolean {
  const d = new Date().getUTCDay();
  return d === 0 || d === 6;
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = env('CRON_SECRET');
  if (!(secret && auth === `Bearer ${secret}`)) {
    const yo = await quienPuedeCorrerCrons(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const dry = url.searchParams.get('dry') === '1';
  const cuantas = Math.min(50, Number(url.searchParams.get('cuantas') || 10));
  const giroFiltro = url.searchParams.get('giro') || '';

  // ── Las puertas, en orden de qué tan barato es comprobarlas ────────────────

  // 1. La pausa global del motor manda sobre todo lo demás.
  const { data: cfg } = await supabase.from('abm_config').select('clave, valor');
  const conf = Object.fromEntries((cfg || []).map((r: any) => [r.clave, r.valor]));
  /* El disyuntor por rebotes y quejas escribe `pausado = 'auto'`, no `'si'`.
     Comparar solo contra `'si'` dejaba el WhatsApp saliendo el mismo día en
     que el sistema decidió que el correo iba mal. Cualquier valor que no sea
     'no' es una pausa. */
  if (String(conf.pausado ?? 'si') !== 'no') return json({ enviados: 0, motivo: `el motor está pausado (${conf.pausado})` });

  // 2. El apagador de esta automatización en concreto. Si no se puede leer la
  //    tabla, `permitido` devuelve false: en la duda no se le escribe a nadie.
  if (!(await permitido('abm_frio' as any))) return json({ enviados: 0, motivo: 'la automatización abm_frio está apagada' });

  // 3. El día. La hora se revisa por cuenta, más abajo: cada una en su país.
  if (esFinDeSemana()) return json({ enviados: 0, motivo: 'fin de semana' });

  /* 3 bis. LA LÍNEA. `wa-salud` pausa la línea cuando Meta le baja la calidad,
     y el manual promete que entonces no sale nada. No se cumplía: al mandar
     sin `conLinea({contexto:'prospeccion'})`, la resolución caía al contexto
     'sistema', que NO está en la lista que bloquea línea pausada. O sea que el
     WhatsApp en frío era justo el que se saltaba el freno de calidad. */
  const pn = await lineaPara('prospeccion');
  if (!pn) return json({ enviados: 0, motivo: 'no hay línea de WhatsApp para prospección (¿pausada por calidad?)' });
  const linea = await infoLinea(pn);
  if (linea?.pausada) return json({ enviados: 0, motivo: `la línea ${linea.numero} está pausada${linea.pausada_motivo ? `: ${linea.pausada_motivo}` : ''}` });

  /* 3 ter. EL TOPE DEL DÍA, que es de la casa y no de esta corrida. El cron
     está agendado OCHO veces al día con `cuantas=10`: sin leer el tope, el día
     que se encienda salen 80 en vez de los 10 que dice `abm_config`. Y se
     cuentan los dos caminos de WhatsApp juntos, porque la línea es una sola. */
  const topeDia = Math.max(0, Number(conf.wa_tope_dia ?? 10));
  const hoyIso = new Date().toISOString().slice(0, 10);
  const { count: yaHoy } = await supabase.from('abm_toques')
    .select('id', { count: 'exact', head: true })
    .eq('canal', 'whatsapp').eq('estado', 'enviado').gte('enviado_at', hoyIso);
  const restante = topeDia - (yaHoy || 0);
  if (restante <= 0) return json({ enviados: 0, motivo: `ya salieron ${yaHoy} WhatsApp hoy, el tope son ${topeDia}` });

  /* 3 bis. A QUÉ GIROS. `abm_frio` es un apagador de sí o no, y encenderlo
     soltaba el WhatsApp sobre los 24 giros a la vez, ordenados por puntaje:
     no había forma de probar con uno y medir si contestan antes de abrir el
     resto. Y una línea de WhatsApp se quema una sola vez.
     `abm_config.wa_frio_giros` acota sin tocar el cron ni el código: una lista
     separada por comas («renta,boutiques») manda solo a esos; vacía o sin la
     llave, van todos, que es como se comportaba antes. El `?giro=` de la URL
     sigue mandando por encima, para una prueba a mano. */
  const alcance = String(conf.wa_frio_giros || '').trim();
  const permitidos = alcance.toLowerCase() === 'todos' ? [] : alcance.split(',').map(g => g.trim()).filter(Boolean);
  /* SIN ALCANCE NO SALE NADA, y es a propósito. Dejar «vacío = todos» era
     repetir el problema: encender `abm_frio` sin acordarse de acotar suelta el
     WhatsApp sobre los 24 giros, y una línea de WhatsApp se quema una sola vez.
     Quien quiera todos lo escribe: `todos`. Así las dos decisiones —prender y
     a quién— son explícitas, y ninguna se toma por omisión.
     El `?giro=` de la URL sigue funcionando para una prueba a mano. */
  if (!giroFiltro && !permitidos.length && alcance.toLowerCase() !== 'todos') {
    return json({ enviados: 0, motivo: 'falta abm_config.wa_frio_giros: escribe los giros separados por comas, o «todos» si de verdad son todos' });
  }

  // ── A quién le toca ───────────────────────────────────────────────────────
  // Solo números DECLARADOS: los que el propio negocio publicó como WhatsApp.
  /* SOLO MÉXICO, y esto no es una preferencia: las tres plantillas aprobadas
     por Meta son `es_MX` y dicen, literalmente, «estamos armando el mapa de
     {{1}} DE MÉXICO». La vista `v_whatsapp_contactable` no filtra país y trae
     896 cuentas de España, Colombia, Argentina y ocho países más —894 de ellas
     de novias, que sí tiene guion—. A una casa de novias de Madrid le habría
     llegado un WhatsApp en español mexicano diciéndole que salió en el mapa de
     México; y en España, además, el correo comercial en frío está sujeto al
     RGPD y a la LSSI art. 21, que este manual dice revisar con abogado ANTES
     del primer envío (§9.2). Cuando haya plantillas por región, esto se abre
     con una llave de config, no borrando el filtro. */
  let q = supabase.from('v_whatsapp_contactable')
    .select('cuenta_id, valor, giro, cuenta_nombre, puntaje, pais')
    .eq('pais', 'México')
    .order('puntaje', { ascending: false, nullsFirst: false })
    .limit(cuantas * 12);          // se piden de más: muchos se van a filtrar
  if (giroFiltro) q = q.eq('giro', giroFiltro);
  else if (permitidos.length) q = q.in('giro', permitidos);
  const { data: candidatos, error } = await q;
  if (error) return json({ error: error.message }, 500);

  /* La vista de contactables no trae `subgiro`, y el mensaje del aliado se
     arma con él: es lo que decide si se le habla del pedido sin curva de
     tallas o de su cierre de mes. Sin esto `paramsAliado` devolvía null y
     todos los aliados se saltaban en silencio como «sin parámetros». Se pide
     de una vez para todos los candidatos, no uno por uno. */
  const idsAliados = (candidatos || []).filter((c: any) => c.giro === 'aliados').map((c: any) => c.cuenta_id);
  const subgiros = new Map<string, string>();
  if (idsAliados.length) {
    const { data: subs } = await supabase.from('abm_cuentas').select('id, subgiro').in('id', idsAliados);
    for (const x of subs || []) subgiros.set(x.id, x.subgiro || '');
  }

  const hoy = Date.now();
  const salida: any[] = [];
  const saltados: Record<string, number> = {};
  const salta = (k: string) => { saltados[k] = (saltados[k] || 0) + 1; };

  const cupo = Math.min(cuantas, restante);
  for (const c of candidatos || []) {
    if (salida.length >= cupo) break;
    /* Los aliados tienen su propio juego de tres: las de arriba dicen «tenemos
       una versión hecha para casas de novia, ¿le muestro una demo?», y al
       aliado no le vendemos el sistema —le proponemos que sus clientes lo
       tengan—. `aliados` no está en GIRO_FRIO a propósito. */
    const esAliado = c.giro === 'aliados';
    if (!esAliado && !GIRO_FRIO[c.giro]) { salta(`sin guion para ${c.giro}`); continue; }

    /* Si ya contestaron, la cadencia terminó: lo que sigue es una conversación.
       EL NÚMERO SE NORMALIZA ANTES DE COMPARAR. `abm_canales.valor` se guarda
       como «+52 33 1337 0590» o «524951334480», y `wa_conversaciones.telefono`
       siempre en E.164 sin espacios. La comparación exacta no empataba NUNCA:
       de 2,926 números declarados, 0 empates exactos y 15 al normalizar. O sea
       que esta puerta jamás se abrió, y entre esos 15 está quien nos escribió
       «disculpe, ¿quién le pasó mi número?» — le habríamos mandado el toque 2
       y el 3 encima. El otro camino de WhatsApp ya usaba `telefonoWhatsApp()`;
       este no. */
    const tel = telefonoWhatsApp(c.valor);
    if (!tel) { salta('número que no se puede normalizar'); continue; }
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('ultimo_entrante_at').eq('telefono', tel).maybeSingle();
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

    // La hora es la DE ELLOS. Hoy todas son de México, pero el día que se
    // abra a otro país esto ya no manda a nadie a la una de la madrugada.
    if (!enHorarioDe((c as any).pais)) { salta('fuera de horario en su país'); continue; }

    // La presión: no dos mensajes nuestros muy seguidos, venga de donde venga.
    const v = await puedeMandarWa(c.valor);
    if (!v.ok) { salta('escrito hace poco'); continue; }

    const params = esAliado
      ? paramsAliado((hechos + 1) as 1 | 2 | 3, { ...c, nombre: c.cuenta_nombre, subgiro: subgiros.get(c.cuenta_id) })
      : paramsFrios((hechos + 1) as 1 | 2 | 3, { ...c, nombre: c.cuenta_nombre });
    if (!params) { salta('sin parámetros'); continue; }
    const plantilla = (esAliado ? ALIADO_FRIO : ABM_FRIO)[hechos];

    if (dry) {
      salida.push({ cuenta: c.cuenta_nombre, giro: c.giro, paso: hechos + 1, plantilla: plantilla.nombre, params });
      continue;
    }

    try {
      /* Por la línea de prospección, igual que el otro camino de WhatsApp.
         Sin `conLinea` la resolución cae al contexto 'sistema', que no bloquea
         una línea pausada por calidad: el frío se saltaba el freno. */
      await conLinea({ pn, contexto: 'prospeccion' },
        () => enviarPlantilla(c.valor, plantilla.nombre, plantilla.idioma, params.map(sanearParam)));
      // Se guarda el toque DESPUÉS de que Meta lo aceptó. Al revés quedaría
      // registrado un envío que no ocurrió, y la cuenta nunca recibiría ese paso.
      /* Y con `enviado_at`, que faltaba: el tope del día se cuenta con ese
         campo, así que sin él estos envíos eran invisibles para el contador
         —el de aquí y el de abm-whatsapp— y los dos repartían el mismo cupo
         creyendo que iban en cero. */
      const ahoraIso = new Date().toISOString();
      const { error: eIns } = await supabase.from('abm_toques').insert({
        cuenta_id: c.cuenta_id, canal: 'whatsapp', destino: c.valor,
        asunto: plantilla.nombre, cuerpo: params.join(' · '),
        estado: 'enviado', programado_at: ahoraIso, enviado_at: ahoraIso,
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

  /* El alcance viaja en la respuesta. Si no, «salieron 10» no dice si fueron
     10 de un giro de prueba o 10 de los veinticuatro. */
  return json({
    enviados: dry ? 0 : salida.length, dry,
    giros: giroFiltro ? [giroFiltro] : permitidos.length ? permitidos : 'todos',
    detalle: salida, saltados,
  });
};
