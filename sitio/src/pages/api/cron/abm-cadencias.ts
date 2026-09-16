// El cartero del motor Account-Based: manda los correos aprobados que ya tocan,
// y trae de vuelta lo que pasó con los anteriores.
//
// Arranca PAUSADO a propósito (abm_config.pausado = 'si'). Un correo en frío
// mal calibrado no cuesta dinero: cuesta el dominio, y con él la comunicación
// con los clientes que ya pagan.
//
// Cuatro frenos, en este orden:
//   1. Pausa manual desde la base, sin desplegar.
//   2. Cupo diario que sube con el calentamiento (empieza en 15, sube ~30% cada
//      tres días hasta el tope). Un dominio nuevo que manda 300 el primer día
//      va directo a spam.
//   3. Nunca dos correos al mismo negocio el mismo día.
//   4. Corte automático si el día viene con demasiados rebotes.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { enHorarioDe, regionDe } from '../../../lib/crm/abm-paises';
// Se manda por el MISMO pipeline que las campañas, no por el atajo de
// sendEmail: el pipeline es el que pone el pie con la liga de baja, las
// cabeceras List-Unsubscribe (el botón nativo de "Cancelar suscripción" de
// Gmail), el Reply-To con el id del envío —para que la respuesta vuelva y
// frene la cadencia— y la medición de clics. Un correo en frío sin forma de
// darse de baja solo deja un botón a la mano: "Reportar como spam".
import { enviarCorreo } from '../../../lib/email/pipeline';
import { apuntar, repuntuar, quien } from '../../../lib/crm/abm.lib';
import { correrGoteos } from '../../../lib/crm/abm-goteo';
import { enviarWhatsApps, respuestasWhatsApp } from '../../../lib/crm/abm-whatsapp';
import { armarCorreo, cierreTexto, AGENDAR_DEMO } from '../../../lib/crm/abm-correo';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

/** La rampa cuenta DÍAS CON ENVÍOS REALES, no días de calendario.
 *
 *  Calentar es enseñarle al proveedor que este dominio manda poquito y bien.
 *  Si la rampa corriera con el reloj, encender el sistema tres semanas después
 *  arrancaría en 90 correos diarios sobre un dominio que nunca mandó uno — que
 *  es exactamente lo que se quería evitar. */
export function cupoDelDia(diasConEnvios: number, cupoInicial: number, tope: number): number {
  const saltos = Math.floor(Math.max(0, diasConEnvios) / 3);
  return Math.min(tope, Math.round(cupoInicial * Math.pow(1.3, saltos)));
}

// El HTML del correo lo arma `lib/crm/abm-correo.ts`: cinta de marca, imagen
// del correo, cuerpo, botón y pie. El cuerpo sigue siendo TEXTO —lo que la IA
// escribe y lo que una persona edita en la pantalla— y el diseño vive en un
// solo lugar, así que cambiarlo no obliga a regenerar ningún correo.

async function config(): Promise<Record<string, string>> {
  const { data } = await supabase.from('abm_config').select('clave, valor');
  return Object.fromEntries((data || []).map((r: any) => [r.clave, r.valor]));
}

export const GET: APIRoute = async ({ request }) => {
  /* FALLA CERRADO. Antes era `if (secret && auth !== ...)`: sin CRON_SECRET
     en el entorno, la condición nunca entraba y el endpoint quedaba ABIERTO a
     internet. Hoy el secreto sí existe, así que estaba tapado — pero el día
     que alguien lo renombre, migre de proyecto o lo borre, esto pasa de
     protegido a «cualquiera dispara la ronda» sin un solo error visible.
     `isAuthorizedCron` acepta el header del scheduler de Vercel o el secreto,
     y niega en cualquier otro caso; es el mismo helper que usan los otros 47
     crons. La sesión del CRM sigue valiendo para dispararlo a mano. */
  if (!isAuthorizedCron(request)) {
    const yo = await quien(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const cfg = await config();
  const hoy = new Date().toISOString().slice(0, 10);
  const espejo = await espejarEventos();

  // La pausa automática se levanta sola al día siguiente. Antes el disyuntor
  // escribía "si" y nadie lo volvía a encender: un tropiezo dejaba la
  // prospección apagada hasta que alguien lo notara a mano.
  let pausado = cfg.pausado || 'si';
  if (pausado === 'auto') {
    const { data: fila } = await supabase.from('abm_config').select('hasta').eq('clave', 'pausado').maybeSingle();
    if (!fila?.hasta || String(fila.hasta) < hoy) {
      await supabase.from('abm_config').update({ valor: 'no', hasta: null, nota: 'reactivado solo tras la pausa automática' }).eq('clave', 'pausado');
      pausado = 'no';
    }
  }
  // Sin EMAIL_REPLY_DOMAIN el Reply-To no lleva el id del envío: quien conteste
  // cae en el respaldo por dirección, que falla justo en el caso más común —le
  // escribes a contacto@ y la dueña contesta desde su gmail—. Sin eso, la
  // cadencia le sigue escribiendo a quien ya respondió. No se manda nada.
  // El correo en frío NO puede salir por el inquilino de casa: es el mismo
  // remitente de las facturas y las confirmaciones de cita, y en SendGrid una
  // queja de spam suprime a nivel de CUENTA, no de campaña. Sin un inquilino
  // propio configurado, no se manda.
  const tenantSlug = (cfg.tenant_slug || '').trim();
  if (!tenantSlug) {
    return json({ pausado: true, motivo: 'falta abm_config.tenant_slug: el correo en frío no sale por el remitente de los clientes', espejo });
  }
  /* DOS REMITENTES, DOS REPUTACIONES (16-sep-2026).
     México sale por su dominio de siempre; España y Latinoamérica por el
     internacional (`abm_config.tenant_slug_intl`). Por qué: el calentamiento
     es POR DOMINIO y es lento —30% cada tres días—, así que un solo remitente
     obliga a los once países a hacer fila detrás de México, que solo ya pide
     tres veces el cupo del día. Y si una base nueva rebota o le marcan spam,
     no arrastra al dominio con el que se le escribe a los clientes. Sin
     `tenant_slug_intl` configurado, todo sale por el de siempre y no cambia
     nada. */
  const slugIntl = (cfg.tenant_slug_intl || '').trim();
  const { data: inquilinos } = await supabase.from('email_tenants').select('id, slug, from_email')
    .in('slug', [tenantSlug, slugIntl].filter(Boolean));
  const inquilino = (inquilinos || []).find((x: any) => x.slug === tenantSlug);
  const inquilinoIntl = slugIntl ? (inquilinos || []).find((x: any) => x.slug === slugIntl) : null;
  if (!inquilino) {
    return json({ pausado: true, motivo: `no existe el inquilino de correo «${tenantSlug}»`, espejo });
  }
  if (slugIntl && !inquilinoIntl) {
    return json({ pausado: true, motivo: `no existe el inquilino internacional «${slugIntl}»`, espejo });
  }
  /** El remitente que le toca a una cuenta por su país. */
  const inquilinoDe = (pais?: string | null) => (inquilinoIntl && regionDe(pais) !== 'mexico') ? inquilinoIntl : inquilino;
  if (!(import.meta.env.EMAIL_REPLY_DOMAIN || '').trim()) {
    return json({ pausado: true, motivo: 'falta EMAIL_REPLY_DOMAIN: sin dominio de respuestas, una contestación no frena la cadencia', espejo });
  }
  if (pausado === 'si') return json({ pausado: true, motivo: 'abm_config.pausado = si', espejo });
  if (pausado === 'auto') return json({ pausado: true, motivo: 'pausa automática por rebotes, se levanta mañana', espejo });

  const tope = Number(cfg.tope_diario || 120);
  /* La rampa se cuenta POR REMITENTE: son días con envíos REALES de ese
     dominio. Un dominio recién autenticado empieza en quince correos aunque
     el otro lleve meses; si compartieran el contador, el nuevo arrancaría en
     trescientos y se quemaría el primer día. */
  const diasDe = async (tenantId: string) => {
    const { data: env } = await supabase.from('email_sends').select('sent_at')
      .eq('tenant_id', tenantId).eq('categoria', 'abm').not('sent_at', 'is', null).limit(5000);
    return new Set((env || []).map((e: any) => String(e.sent_at).slice(0, 10))).size;
  };
  const yaHoyDe = async (tenantId: string) => {
    const { count } = await supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('categoria', 'abm').gte('sent_at', hoy + 'T00:00:00Z');
    return Number(count || 0);
  };
  const dias = await diasDe(inquilino.id);
  const cupo = cupoDelDia(dias, Number(cfg.cupo_inicial || 15), tope);
  // Cada remitente lleva su propia cuenta del día; el bucle de abajo mira la
  // del que le toca a cada cuenta.
  const sobra: Record<string, number> = { [inquilino.id]: Math.max(0, cupo - await yaHoyDe(inquilino.id)) };
  let diasIntl = 0, cupoIntl = 0;
  if (inquilinoIntl) {
    diasIntl = await diasDe(inquilinoIntl.id);
    cupoIntl = cupoDelDia(diasIntl, Number(cfg.cupo_inicial || 15), tope);
    sobra[inquilinoIntl.id] = Math.max(0, cupoIntl - await yaHoyDe(inquilinoIntl.id));
  }

  // El cupo y la rampa son del CORREO: el WhatsApp lleva su propio tope
  // (abm_config.wa_tope_dia) y su propio disyuntor (la calidad de la línea).
  const yaHoy = (cupo - (sobra[inquilino.id] ?? 0)) + (inquilinoIntl ? cupoIntl - (sobra[inquilinoIntl.id] ?? 0) : 0);
  const restante = Object.values(sobra).reduce((a, b) => a + b, 0);

  /* EL DISYUNTOR MIRA TODO EL DOMINIO, NO SOLO EL ABM.
     Antes contaba únicamente los rebotes de abm_actividad, o sea los suyos. Y
     por el mismo dominio salen además las secuencias del CRM —rezagados,
     winback, crecimiento—, que el 14-sep mandaron 80 correos con 5 rebotes
     mientras el ABM mandaba 15 con 3. El ABM veía 3 de 15; la realidad eran
     8 de 95. Dos motores quemando la misma reputación y ninguno viendo lo que
     hacía el otro.
     A Gmail no le importa de qué cadencia salió cada correo: le importa el
     dominio. Así que el conteo sale de email_sends, que es por donde pasan
     TODOS, y el ABM se apaga aunque los rebotes los haya provocado otro.
     Se cuentan REBOTES DE VERDAD (los que reporta el proveedor tras entregar),
     no los fallos por dirección mal escrita: seis direcciones truncadas
     bastaban para apagar el sistema entero el primer día. */
  const desdeHoy = hoy + 'T00:00:00Z';
  const [{ count: rebotesHoy }, { count: quejasHoy }, { count: salidosHoy }] = await Promise.all([
    supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .not('bounced_at', 'is', null).gte('sent_at', desdeHoy),
    supabase.from('abm_actividad').select('id', { count: 'exact', head: true })
      .eq('tipo', 'spam').eq('canal', 'email').gte('ocurrio_at', desdeHoy),
    supabase.from('email_sends').select('id', { count: 'exact', head: true })
      .gte('sent_at', desdeHoy),
  ]);
  // Una queja de spam pesa muchísimo más que un rebote: Gmail corta arriba de
  // 0.3%, que con 120 correos al día es menos de una queja diaria. Por eso el
  // umbral de quejas es UNA, no tres.
  /* El umbral ahora es sobre lo que SALIÓ HOY del dominio, no sobre el cupo del
     ABM: si el otro motor mandó 80 y el ABM 15, medir contra el cupo del ABM
     daría un porcentaje inventado. El piso de 3 se queda, para que un día de
     pocos envíos no se apague por un rebote suelto.
     Una queja de spam pesa muchísimo más que un rebote: Gmail corta arriba de
     0.3%, que con 120 correos al día es menos de una queja diaria. Por eso el
     umbral de quejas es UNA, no tres. */
  const base = Math.max(cupo, salidosHoy || 0);
  const topeRebotes = Math.max(3, Math.round(base * 0.05));
  if ((quejasHoy || 0) >= 1 || (rebotesHoy || 0) >= topeRebotes) {
    const motivo = (quejasHoy || 0) >= 1
      ? `${quejasHoy} queja(s) de spam en el dominio`
      : `${rebotesHoy} rebotes de ${salidosHoy} correos del dominio (tope ${topeRebotes})`;
    await supabase.from('abm_config').update({ valor: 'auto', hasta: hoy, nota: `pausado el ${hoy} por ${motivo}` }).eq('clave', 'pausado');
    return json({ enviados: 0, pausado_por: motivo, rebotes: rebotesHoy, salidos: salidosHoy, espejo });
  }

  // El goteo (envíos progresivos, lib/crm/abm-goteo.ts) va ANTES del reparto
  // y DESPUÉS de las pausas y del disyuntor: enrola a las N cuentas nuevas
  // del día —les escribe su cadencia y la deja aprobada— y el reparto de
  // abajo las manda con el mismo cupo y la misma rampa que todo lo demás. Con
  // el motor pausado o el disyuntor abierto no enrola: nada entra a una fila
  // parada.
  const goteo = await correrGoteos({ hoy, quien: 'El goteo' }).catch((e: any) => [{ error: String(e?.message || e) }] as any);

  // El WhatsApp de la cadencia (lib/crm/abm-whatsapp.ts): primero se recogen
  // las respuestas —quien contestó por WhatsApp sale de la fila entera— y
  // luego salen los del día, por plantilla aprobada de Meta y con su tope.
  const waRespuestas = await respuestasWhatsApp().catch((e: any) => ({ respondieron: 0, error: String(e?.message || e) }));
  const whatsapp = await enviarWhatsApps({ hoy, tope: Number(cfg.wa_tope_dia ?? 10) })
    .catch((e: any) => ({ enviados: 0, saltados: 0, fallidos: 0, linea: null, tope: 0, motivo: String(e?.message || e), errores: [] }));

  if (!restante) return json({ enviados: 0, cupo, dias_calentando: dias, ya_hoy: yaHoy || 0, motivo: 'cupo del día agotado', espejo, goteo, whatsapp: { ...whatsapp, respondieron: waRespuestas.respondieron } });

  const { data: pendientes } = await supabase.from('abm_toques')
    .select('id, cuenta_id, destino, asunto, cuerpo, programado_at, imagen, boton_texto, boton_url')
    .eq('estado', 'aprobado').eq('canal', 'email')
    .lte('programado_at', new Date().toISOString())
    .order('programado_at').limit(3000);   // la cola completa cabe: el programa son 2,639 toques

  // Una cadencia empezada vale más que una por empezar: si el cupo se lo comen
  // los primeros toques de cuentas nuevas, las secuencias en curso se cortan a
  // media conversación. Primero los seguimientos.
  const { data: yaTocadas } = await supabase.from('abm_toques')
    .select('cuenta_id').eq('estado', 'enviado').limit(5000);
  const enCurso = new Set((yaTocadas || []).map((r: any) => r.cuenta_id));
  const toques = (pendientes || []).sort((a: any, b: any) => {
    const ea = enCurso.has(a.cuenta_id) ? 0 : 1, eb = enCurso.has(b.cuenta_id) ? 0 : 1;
    return ea !== eb ? ea - eb : String(a.programado_at).localeCompare(String(b.programado_at));
  });

  const bloqueadas = new Set<string>();
  const { data: no } = await supabase.from('abm_no_contactar').select('valor');
  for (const r of no || []) bloqueadas.add(String(r.valor).toLowerCase());

  // Uno por BUZÓN al día, no por cuenta: diez direcciones están repetidas entre
  // dos negocios distintos, y ese buzón recibía dos correos en frío el mismo día.
  const tocadosHoy = new Set<string>();
  const { data: hoyYa } = await supabase.from('abm_toques').select('destino').eq('estado', 'enviado').gte('enviado_at', hoy + 'T00:00:00Z');
  for (const r of hoyYa || []) tocadosHoy.add(String(r.destino || '').toLowerCase());

  // Diez direcciones pertenecen a DOS negocios distintos: sin esto ese buzón
  // recibiría dos cadencias encimadas —catorce correos en frío en el mes— y
  // marcaría spam con toda la razón. Un buzón, una cadencia a la vez.
  const { data: vivas } = await supabase.from('abm_toques')
    .select('destino, cuenta_id').eq('estado', 'enviado')
    .gte('enviado_at', new Date(Date.now() - 35 * 864e5).toISOString()).limit(5000);
  const duenoDelBuzon = new Map<string, string>();
  for (const r of vivas || []) {
    const d = String(r.destino || '').toLowerCase();
    if (d && !duenoDelBuzon.has(d)) duenoDelBuzon.set(d, r.cuenta_id);
  }

  const CORREO_OK = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
  let enviados = 0, fueraDeHorario = 0; const fallos: string[] = [];

  for (const t of toques || []) {
    if (Object.values(sobra).every(n => n <= 0)) break;
    const destino = String(t.destino || '').toLowerCase();
    if (tocadosHoy.has(destino)) continue;
    const dueno = duenoDelBuzon.get(destino);
    if (dueno && dueno !== t.cuenta_id) {
      // La cadencia entera, no este toque: si no, se cancela uno por corrida y
      // la cuenta se apaga a pedacitos sin que nadie lo note.
      await supabase.from('abm_toques')
        .update({ estado: 'cancelado', resultado: 'ese buzón ya está recibiendo la cadencia de otro negocio' })
        .eq('cuenta_id', t.cuenta_id).in('estado', ['borrador', 'aprobado', 'programado', 'enviando']);
      await apuntar(t.cuenta_id, 'email', 'nota', { texto: `Cadencia cancelada: ${destino} ya está en la cadencia de otro negocio` });
      continue;
    }
    if (!CORREO_OK.test(destino) || bloqueadas.has(destino)) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: CORREO_OK.test(destino) ? 'está en la lista de no contactar' : 'la dirección no tiene forma de dirección' }).eq('id', t.id);
      continue;
    }
    /* Nada sale con las costuras de la plantilla a la vista. Un `{{nombre}}`
       o un `[[si ciudad]]` en el cuerpo significa que el armado falló, y el
       prospecto ve el andamio del sistema en su bandeja.
       No es hipotético: hay ocho plantillas de aliados que llevan la
       instrucción para la IA DENTRO del cuerpo —«[[apertura del expediente:
       el gancho de su tipo…]]»—, y el respaldo de generarCadencia, cuando la
       IA falla, manda la plantilla tal cual. La IA sí falla: 19 cadencias de
       novias salieron sin adaptar el 13-sep porque se acabó el saldo.
       Se cancela, no se limpia: un correo al que le quitas un pedazo deja de
       decir lo que se quería decir, y el borrador queda para arreglarlo. */
    const crudo = String(t.cuerpo || '') + ' ' + String(t.asunto || '');
    /* Dos formas de que el armado falle, y la segunda no se veía.
       a) La marca se quedó: `{{nombre}}`, `[[si ciudad]]`. Se ve a simple vista.
       b) La marca se fue y dejó la CICATRIZ: la variable sí se sustituyó, pero
          por nada, y la frase queda «por algo concreto..» o «Le vende a, y lo
          que pasa es esto:.». El chequeo de (a) no la caza porque ya no hay
          nada que buscar. Es la forma MÁS peligrosa: se ve como un correo
          normal hasta que uno lo lee.
       Lo que delata a (b) es puntuación que ningún redactor escribe: dos
       puntos seguidos, dos puntos y punto, espacio antes de coma, coma pegada
       a una coma. `...` se exceptúa porque sí se usa. */
    const cicatriz = /(?<!\.)\.\.(?!\.)|:\s*\.|,\s*,|\s+,|\(\s*\)|«\s*»/.test(crudo);
    if (/\{\{|\[\[/.test(crudo) || cicatriz) {
      await supabase.from('abm_toques').update({
        estado: 'cancelado',
        resultado: cicatriz
          ? 'el cuerpo salió con una variable vacía: quedó la frase rota («..», «:.», « ,»)'
          : 'el cuerpo salió sin armar: quedó una variable o un bloque de plantilla sin resolver',
      }).eq('id', t.id);
      await apuntar(t.cuenta_id, 'email', 'nota', { texto: `Correo cancelado: el cuerpo conserva marcas de plantilla (${(crudo.match(/\{\{[a-z_]+\}\}|\[\[[^\]]{0,40}/i) || ['?'])[0]}…)` });
      continue;
    }
    const { data: cuenta } = await supabase.from('abm_cuentas').select('etapa, ya_es_cliente, nombre, giro, pais, ruta').eq('id', t.cuenta_id).maybeSingle();
    if (!cuenta || cuenta.ya_es_cliente || ['no_contactar', 'respondio', 'reunion', 'ganada'].includes(cuenta.etapa)) {
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: 'la cuenta ya no está en cadencia' }).eq('id', t.id);
      continue;
    }
    /* La hora es la DE ELLOS (15-sep-2026). El cron corre a las 9, 16 y 19 UTC
       y la misma corrida sirve a Madrid, Bogotá y Santiago: a las 16 UTC en
       España son las 6 de la tarde y en Chile la 1. Un correo de trabajo que
       cae de noche se lee mal o no se lee. No se cancela: espera a la corrida
       que sí caiga entre las 9 y las 6 de su país. */
    if (!enHorarioDe(cuenta.pais)) { fueraDeHorario++; continue; }
    // El remitente —y el cupo del día— son los de SU región.
    const mio = inquilinoDe(cuenta.pais);
    if ((sobra[mio.id] ?? 0) <= 0) continue;

    // Nota: el seguimiento DENTRO del mismo hilo (Re: + In-Reply-To +
    // References) queda pendiente a propósito. Un "Re:" sin las cabeceras de
    // hilo no agrupa la conversación y sí es una heurística de spam conocida:
    // o se hacen las tres piezas, o no se hace ninguna. El pipeline todavía no
    // deja pasar cabeceras propias.
    const asunto = t.asunto || '';

    // La pieza visual del giro va SOLO del cuarto correo en adelante y SOLO si
    // la cuenta ya dio señal de vida. Los primeros van en texto plano a
    // propósito: el correo en frío que parece boletín entrega peor. Cuando ya
    // hubo apertura o clic, la conversación cambia y una pieza que explique el
    // dolor de un vistazo sí ayuda.
    /* CUÁNTOS CORREOS LLEVA, no cuántos toques. Faltaba `.eq('canal','email')`
       y los WhatsApp de la cadencia contaban: en novias y mayoristas el paso
       de WhatsApp cae en el día 2, entre el correo 1 y el correo 2, así que al
       llegar el TERCER correo el contador ya valía 3. Consecuencia: el correo
       3 salía con píxel de apertura y enlaces envueltos —cuando la regla es
       que los tres primeros van limpios, justo para no parecer boletín— y la
       pieza HTML del giro se activaba un correo antes de lo previsto. */
    const { count: orden } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
      .eq('cuenta_id', t.cuenta_id).eq('canal', 'email').eq('estado', 'enviado');
    let pieza = ''; let piezaTitulo = '';
    if ((orden || 0) >= 3) {
      const { count: interes } = await supabase.from('abm_actividad').select('id', { count: 'exact', head: true })
        .eq('cuenta_id', t.cuenta_id).in('tipo', ['apertura', 'clic']);
      if (interes) {
        // .limit(1) y no maybeSingle(): con dos filas, maybeSingle devuelve
        // null y la pieza se apagaría en silencio.
        const { data: pzs } = await supabase.from('abm_plantillas')
          .select('cuerpo, asunto').eq('canal', 'pieza').eq('giro', cuenta.giro || '').limit(1);
        const pz = (pzs || [])[0];
        if (pz?.cuerpo) { pieza = pz.cuerpo; piezaTitulo = pz.asunto || ''; }
      }
    }

    // Se reclama el toque antes de mandarlo. Si el proceso muriera entre el
    // POST a SendGrid y el update, el toque seguiría 'aprobado' y la corrida
    // de las 13:00 lo mandaría OTRA VEZ al mismo negocio.
    const cierre = { giro: cuenta.giro, nombre: cuenta.nombre, pais: cuenta.pais, ruta: cuenta.ruta };
    const { data: reclamado } = await supabase.from('abm_toques')
      .update({ estado: 'enviando', enviado_at: new Date().toISOString() })
      .eq('id', t.id).eq('estado', 'aprobado').select('id').maybeSingle();
    if (!reclamado) continue;

    const r = await enviarCorreo({
      para: t.destino, asunto,
      // Texto plano de verdad: el correo en frío que parece boletín no se lee
      // y además entrega peor. El HTML es el mismo texto con saltos de línea.
      // La versión de texto menciona la pieza: un HTML con una tabla que el
      // texto plano ignora es una discrepancia que los filtros puntúan.
      // La liga del botón se AGREGA a la versión de texto: en HTML es un botón,
      // pero quien lea el correo sin formato no vería ninguna forma de agendar.
      // Y el cierre (demo de 30 minutos + agendar + WhatsApp) va en los dos
      // formatos, con las mismas ligas, porque todo correo lo lleva.
      texto: (t.cuerpo || '')
        + ((t as any).boton_url && (t as any).boton_url !== AGENDAR_DEMO ? `\n\n${(t as any).boton_texto || 'Agendar'}: ${(t as any).boton_url}` : '')
        + (pieza ? `\n\n— ${piezaTitulo || 'Le puse abajo un ejemplo con números de su giro'} (se ve en la versión con formato de este correo).` : '')
        + cierreTexto(cierre),
      html: armarCorreo({
        cuerpo: t.cuerpo || '', imagen: (t as any).imagen, imagenAlt: asunto,
        botonTexto: (t as any).boton_texto, botonUrl: (t as any).boton_url, pieza, cierre,
      }),
      categoria: 'abm', tenantId: mio.id,
      // Los tres primeros van limpios: sin pixel y sin enlaces envueltos.
      sinRastreo: (orden || 0) < 3,
    });
    const ok = r.enviado;
    await supabase.from('abm_toques').update({
      estado: ok ? 'enviado' : 'fallido', enviado_at: new Date().toISOString(),
      send_id: r.sendId || null, asunto,
      resultado: ok ? null : `${r.motivo || 'no salió'}: ${String(r.detalle || '').slice(0, 200)}`,
    }).eq('id', t.id);
    await apuntar(t.cuenta_id, 'email', ok ? 'envio' : 'nota', { toque_id: t.id, texto: ok ? `Salió: ${asunto}` : `No salió (${r.motivo}): ${r.detalle || ''}` });
    if (ok) {
      enviados++; sobra[mio.id] = (sobra[mio.id] ?? 0) - 1; tocadosHoy.add(destino);
      await supabase.from('abm_cuentas').update({ ultimo_toque_at: new Date().toISOString() }).eq('id', t.cuenta_id);
      await supabase.from('abm_cuentas').update({ etapa: 'en_cadencia', updated_at: new Date().toISOString() }).eq('id', t.cuenta_id).eq('etapa', 'sin_tocar');
    } else {
      fallos.push(`${r.motivo}: ${String(r.detalle || '').slice(0, 90)}`);
      /* UNA BAJA DETIENE LA CADENCIA ENTERA, no solo este correo.
         El pipeline ya impide que salga —consulta email_suppressions, incluso
         de otros remitentes nuestros— así que nadie recibía nada. Pero el
         toque se marcaba `fallido` y los SIETE siguientes seguían agendados:
         volvían a intentarlo cada pocos días durante 33 días, y la cuenta se
         quedaba «en cadencia» para siempre en la ficha.
         Peor: `abm_no_contactar` no se enteraba, así que otra cuenta con el
         mismo buzón —una cadena con veinte sucursales— volvía a enrolarlo.
         Cuando alguien se da de baja, se acabó: aquí y en todas partes. */
      if (r.motivo === 'suprimido') {
        await supabase.from('abm_toques')
          .update({ estado: 'cancelado', resultado: `se dio de baja: ${String(r.detalle || '').slice(0, 150)}` })
          .eq('cuenta_id', t.cuenta_id).in('estado', ['borrador', 'aprobado', 'programado', 'enviando']);
        await supabase.from('abm_no_contactar')
          .upsert({ valor: destino, tipo: 'email', motivo: `baja o queja: ${String(r.detalle || 'suprimido').slice(0, 250)}` }, { onConflict: 'valor' });
        await supabase.from('abm_cuentas')
          .update({ etapa: 'no_contactar', updated_at: new Date().toISOString() })
          .eq('id', t.cuenta_id).not('etapa', 'in', '("ganada","reunion","respondio")');
        await apuntar(t.cuenta_id, 'email', 'nota', { texto: `Cadencia detenida: ${destino} está suprimido (${r.detalle || 'baja'}). Queda en la lista de no contactar.` });
      }
    }
  }

  return json({ enviados, fuera_de_horario: fueraDeHorario, cupo, dias_calentando: dias, ya_hoy: yaHoy || 0,
    internacional: inquilinoIntl ? { remitente: inquilinoIntl.slug, cupo: cupoIntl, dias_calentando: diasIntl, sobra: sobra[inquilinoIntl.id] } : null, fallos: fallos.slice(0, 5), espejo, goteo, whatsapp: { ...whatsapp, respondieron: waRespuestas.respondieron } });
};

/** Trae a la bitácora lo que SendGrid ya contó en email_sends. */
async function espejarEventos() {
  const { data: toques } = await supabase.from('abm_toques')
    .select('id, cuenta_id, send_id').eq('estado', 'enviado').not('send_id', 'is', null)
    .gte('enviado_at', new Date(Date.now() - 21 * 864e5).toISOString()).limit(500);
  if (!toques?.length) return { revisados: 0, nuevos: 0 };

  const ids = toques.map(t => t.send_id);
  const { data: sends } = await supabase.from('email_sends')
    .select('id, estado, delivered_at, opened_at, clicked_at, bounced_at').in('id', ids);
  const porId: Record<string, any> = {};
  for (const s of sends || []) porId[s.id] = s;

  // Lo que ya está apuntado, para no duplicar la línea de tiempo.
  const { data: yaHay } = await supabase.from('abm_actividad')
    .select('toque_id, tipo').in('toque_id', toques.map(t => t.id));
  const visto = new Set((yaHay || []).map((a: any) => `${a.toque_id}|${a.tipo}`));

  const nuevos: any[] = [];
  for (const t of toques) {
    const s = porId[t.send_id!]; if (!s) continue;
    const par = (tipo: string, cuando: string | null) => {
      if (!cuando || visto.has(`${t.id}|${tipo}`)) return;
      nuevos.push({ cuenta_id: t.cuenta_id, toque_id: t.id, canal: 'email', tipo, ocurrio_at: cuando });
    };
    par('entrega', s.delivered_at);
    par('apertura', s.opened_at);
    par('clic', s.clicked_at);
    par('rebote', s.bounced_at);
    if (s.estado === 'spam' && !visto.has(`${t.id}|spam`)) nuevos.push({ cuenta_id: t.cuenta_id, toque_id: t.id, canal: 'email', tipo: 'spam', ocurrio_at: new Date().toISOString() });
  }
  if (nuevos.length) await supabase.from('abm_actividad').insert(nuevos);

  // Quien hace clic o rebota cambia de estado: el clic es intención real, y el
  // rebote invalida el canal para que nadie le vuelva a escribir ahí.
  for (const n of nuevos) {
    // Un clic es INTERÉS, no respuesta: sube la prioridad y deja correr la
    // cadencia. Marcarlo como "respondió" y frenar ahí apagaba el seguimiento
    // justo sobre la señal más caliente que hay.
    if (n.tipo === 'clic') {
      // El peso de la fila MANDA sobre la tabla de tipos, así que este insert
      // tiene que traerlo bien; y sin `origen` nacería etiquetado 'estudio'.
      await supabase.from('abm_senales').insert({
        cuenta_id: n.cuenta_id, tipo: 'clic', peso: 6, origen: 'sistema',
        detalle: 'Hizo clic en un correo de la cadencia',
        fecha: new Date().toISOString().slice(0, 10),
        caduca_at: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
      });
      await repuntuar(n.cuenta_id);
    }
    if (n.tipo === 'rebote' || n.tipo === 'spam') {
      const { data: tq } = await supabase.from('abm_toques').select('destino').eq('id', n.toque_id).maybeSingle();
      if (tq?.destino) await supabase.from('abm_canales').update({ estado: n.tipo === 'spam' ? 'opt_out' : 'rebote' }).eq('cuenta_id', n.cuenta_id).eq('valor', tq.destino);
      await supabase.from('abm_toques').update({ estado: 'cancelado', resultado: n.tipo }).eq('cuenta_id', n.cuenta_id).in('estado', ['aprobado', 'programado']);
    }
  }
  return { revisados: toques.length, nuevos: nuevos.length };
}
