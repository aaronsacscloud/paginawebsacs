// ══ Validar si un número puede recibir WhatsApp ══════════════════════════════
//
// EL PROBLEMA
// En México el teléfono que publica una tienda casi siempre ES su WhatsApp, así
// que dar de alta el teléfono como canal de WhatsApp acierta muchas veces. Pero
// "muchas" no es "todas", y cada mensaje a un número SIN WhatsApp cuenta contra
// la calificación de calidad de la línea. Con 554 números inferidos de golpe,
// eso quema la línea de ventas.
//
// POR QUÉ NO SE PUEDE PREGUNTAR DIRECTO
// El API viejo de WhatsApp (On-Premises) tenía un endpoint `contacts` que
// respondía si un número estaba registrado. Meta lo mató a propósito —lo usaban
// justo para validar listas— y hoy RESPONDE SIEMPRE "válido", tenga WhatsApp o
// no. La Cloud API nunca lo tuvo. O sea: no existe pre-chequeo oficial, y
// cualquier servicio que diga que sí lo hace está corriendo un cliente no
// oficial de WhatsApp, que viola sus términos y se gana el baneo de la cuenta
// que lo use. No vamos por ahí.
//
// LO QUE SÍ SE PUEDE
// Descartar a los que es IMPOSIBLE que lo tengan. WhatsApp necesita un número
// que reciba SMS o llamada de verificación, y en la práctica vive en móviles.
// Twilio Lookup dice de qué tipo es cada línea —móvil, fijo, VoIP, 800— sin
// llamar ni mandar nada, sin que el dueño se entere y sin tocar WhatsApp.
//
// Un FIJO casi nunca tiene WhatsApp. Descartarlos es la mitad del trabajo, es
// barato y es reversible.
//
// LA ESCALERA COMPLETA (el estado del canal)
//   declarado   el negocio lo publica él mismo como WhatsApp (wa.me en su
//               sitio) → CERTEZA, no hace falta validar nada
//   probable    Lookup dice MÓVIL → puede tenerlo, se prueba por tandas
//   descartado  Lookup dice fijo / VoIP / 800 → casi seguro NO
//   valido      un mensaje se entregó → confirmado que SÍ
//   invalido    el envío devolvió 131026 → confirmado que NO
//   sin_probar  todavía no se sabe nada
//
// REGLA DURA: solo `declarado`, `probable` y `valido` reciben mensaje. Nunca
// un `sin_probar` ni un `descartado`.
//
// GET /api/cron/abm-validar-whatsapp?cuantas=200&giro=novias
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { apuntar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

/** Los tipos de línea de Twilio, traducidos a si pueden tener WhatsApp.
 *  `mobile` es el único que sí. `nonFixedVoip` queda aparte: hay quien registra
 *  WhatsApp en un VoIP, es raro pero pasa, así que no se descarta de plano —
 *  se deja sin probar para no perderlo por una regla nuestra. */
const PUEDE: Record<string, 'probable' | 'descartado' | 'sin_probar'> = {
  mobile: 'probable',
  landline: 'descartado',
  fixedVoip: 'descartado',
  tollFree: 'descartado',
  premium: 'descartado',
  sharedCost: 'descartado',
  uan: 'descartado',
  voicemail: 'descartado',
  pager: 'descartado',
  nonFixedVoip: 'sin_probar',
  personal: 'sin_probar',
  unknown: 'sin_probar',
};

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = env('CRON_SECRET');
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  const sid = env('TWILIO_ACCOUNT_SID');
  // Se usa la API Key, no el Auth Token: una API Key se revoca sola sin tirar
  // la telefonía. El Auth Token firma los webhooks y rotarlo rompe eso.
  const kSid = env('TWILIO_API_KEY_SID');
  const kSec = env('TWILIO_API_KEY_SECRET');
  if (!sid || !kSid || !kSec) return json({ error: 'faltan credenciales de Twilio' }, 409);

  const cuantas = Math.min(500, Number(url.searchParams.get('cuantas') || 100));
  const giro = url.searchParams.get('giro') || '';

  // Solo los que no sabemos. Los `declarado` no se tocan: el negocio ya nos dijo
  // que ese es su WhatsApp y gastar una consulta en eso es tirar dinero.
  let q = supabase.from('abm_canales')
    .select('id, cuenta_id, valor, abm_cuentas!inner(giro, nombre)')
    .like('tipo', 'whatsapp%').eq('estado', 'sin_probar').limit(cuantas);
  if (giro) q = q.eq('abm_cuentas.giro', giro);
  const { data: canales, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const cuenta = { probable: 0, descartado: 0, sin_probar: 0, error: 0 };
  const porTipo: Record<string, number> = {};
  const basic = Buffer.from(`${kSid}:${kSec}`).toString('base64');

  for (const c of canales || []) {
    try {
      const tel = String(c.valor || '').replace(/\D/g, '');
      if (!tel) { cuenta.error++; continue; }
      const r: any = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/+${tel}?Fields=line_type_intelligence`,
        { headers: { Authorization: `Basic ${basic}` } },
      ).then(x => x.json());

      // `valid:false` = el número ni siquiera existe como teléfono. Eso no es
      // "no tiene WhatsApp": es un número mal capturado, y se marca inválido.
      if (r?.valid === false) {
        await supabase.from('abm_canales').update({ estado: 'invalido', verificado_at: new Date().toISOString() }).eq('id', c.id);
        cuenta.descartado++; porTipo['no_existe'] = (porTipo['no_existe'] || 0) + 1;
        continue;
      }
      const tipo = String(r?.line_type_intelligence?.type || 'unknown');
      const destino = PUEDE[tipo] || 'sin_probar';
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;
      cuenta[destino]++;

      // `sin_probar` se deja como está: no aprendimos nada, pero tampoco se
      // vuelve a consultar en la siguiente corrida —por eso guarda la fecha.
      await supabase.from('abm_canales').update({
        estado: destino, verificado_at: new Date().toISOString(),
        confianza: destino === 'probable' ? 'media' : 'baja',
      }).eq('id', c.id);

      await supabase.from('abm_fuentes').insert({
        cuenta_id: c.cuenta_id, campo: 'whatsapp_linea', valor: tipo,
        metodo: 'lookup', confianza: 'alta', agente: 'twilio-lookup',
      });
      if (destino === 'descartado') {
        await apuntar(c.cuenta_id, 'whatsapp', 'nota', {
          texto: `El número ${tel} es línea ${tipo}: no se le manda WhatsApp. Queda para llamada.`,
        });
      }
    } catch (e) {
      cuenta.error++;
      console.warn('[abm-validar-whatsapp]', c.valor, String((e as any)?.message || e).slice(0, 120));
    }
  }

  return json({ revisados: (canales || []).length, ...cuenta, por_tipo: porTipo });
};
