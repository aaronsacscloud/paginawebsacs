// DEMAND ENGINE · la demanda que ya tenemos y nadie estaba leyendo.
//
// Esta es la fuente que ninguna herramienta de SEO del mundo puede darnos, y
// por eso es la primera que se conecta. En este CRM ya viven: 16 mil mensajes
// que los leads escribieron con sus propias palabras, 313 conversaciones de
// soporte, 163 mejoras que los clientes pidieron, los motivos por los que se
// perdió cada trato y por los que se fue cada cuenta.
//
// La demanda de retail de moda en México no se expresa en Google: se expresa en
// WhatsApp y en el piso de venta. Empezar por aquí no es un atajo mientras
// llegan los accesos de Google — es empezar por donde está la ventaja.
//
// Dos reglas duras:
//   1. NADA sale de aquí sin pasar por el anonimizador. Estos textos los va a
//      leer un modelo, una pantalla y quizá algún día una página pública.
//   2. La ingesta NO interpreta. Solo recoge con su procedencia; entender qué
//      pide cada texto es trabajo de `normalizar`, que sí cuesta y sí se mide.
import { supabase } from '../../supabase';
import { registrarVarias, type EntradaSenal } from '../senales';
import { marcarOk, marcarFallo } from '../conectores';
import { registrar } from '../handlers';
import type { ResultadoHandler } from '../tipos';

/** Un mensaje suelto de WhatsApp casi nunca es demanda: «ok», «gracias», «ahí
 *  la vemos». Lo que vale es el que pregunta o el que describe un problema.
 *  Este filtro es deliberadamente generoso — descartar de más aquí es perder
 *  señal para siempre; lo que sobre lo tira el paso siguiente, que sí entiende. */
const INTERROGATIVAS = /\b(como|cómo|qué|que tal|cuanto|cuánto|cual|cuál|por que|por qué|puedo|puede|pueden|tienen|manejan|sirve|funciona|necesito|quiero|busco|me interesa|se puede|hay forma|existe|problema|no me deja|no puedo|ayuda)\b/i;

function pareceDemanda(t: string): boolean {
  const s = t.trim();
  if (s.length < 15 || s.length > 900) return false;
  return s.includes('?') || s.includes('¿') || INTERROGATIVAS.test(s);
}

/** Cursor por sub-fuente: cada una avanza a su ritmo y un fallo en una no
 *  obliga a releer las otras desde el principio. */
type Cursores = Record<string, string>;

async function cursores(): Promise<Cursores> {
  const { data } = await supabase.from('de_conectores').select('config').eq('id', 'crm').maybeSingle();
  return (data?.config?.cursores || {}) as Cursores;
}

async function guardarCursores(c: Cursores): Promise<void> {
  const { data } = await supabase.from('de_conectores').select('config').eq('id', 'crm').maybeSingle();
  await supabase.from('de_conectores')
    .update({ config: { ...(data?.config || {}), cursores: c } })
    .eq('id', 'crm');
}

const DESDE_CERO = '2000-01-01T00:00:00Z';
const TOPE = 400;   // por sub-fuente y por corrida: el cron tiene 300 segundos

export async function ingerirCrm(): Promise<{ nuevas: number; repetidas: number; detalle: Record<string, number> }> {
  const cur = await cursores();
  const senales: EntradaSenal[] = [];
  const detalle: Record<string, number> = {};
  const nuevoCursor: Cursores = { ...cur };

  // ── 1 · Lo que los leads preguntan por WhatsApp ───────────────────────────
  {
    const desde = cur.wa || DESDE_CERO;
    const { data } = await supabase
      .from('wa_mensajes')
      .select('id, cuerpo, transcript, created_at, conversation_id')
      .eq('direccion', 'entrante')
      .gt('created_at', desde)
      .order('created_at')
      .limit(TOPE);

    let n = 0;
    for (const m of data || []) {
      const texto = (m.cuerpo || m.transcript || '').trim();
      if (pareceDemanda(texto)) {
        senales.push({
          clave_idem: `crm:wa:${m.id}`,
          tipo_fuente: 'crm', fuente: 'whatsapp',
          observada_at: m.created_at,
          naturaleza: 'observada', tipo_senal: 'pregunta',
          query_cruda: texto, texto,
          payload: { conversacion: m.conversation_id },
          // Alta: es una persona real del ramo, escribiendo lo que necesita.
          confianza: 0.9, peso: 3,
        });
        n++;
      }
      nuevoCursor.wa = m.created_at;
    }
    detalle.whatsapp = n;
  }

  // ── 2 · Soporte: lo que se rompe o lo que no se encuentra ─────────────────
  {
    const desde = cur.soporte || DESDE_CERO;
    const { data } = await supabase
      .from('crm_soporte_tickets')
      .select('id, asunto, vista_previa, tema, created_at, company_id')
      .gt('created_at', desde)
      .order('created_at')
      .limit(TOPE);

    let n = 0;
    for (const t of data || []) {
      const texto = [t.asunto, t.vista_previa].filter(Boolean).join(' — ').trim();
      if (texto.length > 12) {
        senales.push({
          clave_idem: `crm:soporte:${t.id}`,
          tipo_fuente: 'crm', fuente: 'soporte',
          observada_at: t.created_at,
          naturaleza: 'observada', tipo_senal: 'problema',
          query_cruda: t.asunto || null, texto,
          payload: { tema: t.tema || null },
          confianza: 0.85, peso: 2,
        });
        n++;
      }
      nuevoCursor.soporte = t.created_at;
    }
    detalle.soporte = n;
  }

  // ── 3 · Mejoras pedidas: demanda de PRODUCTO, dicha por quien ya paga ─────
  {
    const desde = cur.mejoras || DESDE_CERO;
    const { data } = await supabase
      .from('mejoras')
      .select('id, titulo, descripcion, categoria, modulo, created_at')
      .gt('created_at', desde)
      .order('created_at')
      .limit(TOPE);

    let n = 0;
    for (const m of data || []) {
      const texto = [m.titulo, m.descripcion].filter(Boolean).join(' — ').trim();
      if (texto.length > 12) {
        senales.push({
          clave_idem: `crm:mejora:${m.id}`,
          tipo_fuente: 'crm', fuente: 'mejoras',
          observada_at: m.created_at,
          naturaleza: 'observada', tipo_senal: 'deseo',
          query_cruda: m.titulo || null, texto,
          payload: { categoria: m.categoria || null, modulo: m.modulo || null },
          // Un cliente que pide algo describe un hueco del producto Y una
          // búsqueda que alguien más hará en Google sin conocernos.
          confianza: 0.9, peso: 4,
        });
        n++;
      }
      nuevoCursor.mejoras = m.created_at;
    }
    detalle.mejoras = n;
  }

  // ── 4 · Por qué se perdió un trato ────────────────────────────────────────
  {
    const desde = cur.perdidas || DESDE_CERO;
    const { data } = await supabase
      .from('deals')
      .select('id, motivo_perdida, descarte_motivo, descartada_at, updated_at')
      .or('motivo_perdida.not.is.null,descarte_motivo.not.is.null')
      .gt('updated_at', desde)
      .order('updated_at')
      .limit(TOPE);

    let n = 0;
    for (const d of data || []) {
      const texto = [d.motivo_perdida, d.descarte_motivo].filter(Boolean).join(' — ').trim();
      if (texto.length > 6) {
        senales.push({
          clave_idem: `crm:perdida:${d.id}`,
          tipo_fuente: 'crm', fuente: 'perdidas',
          observada_at: d.descartada_at || d.updated_at,
          naturaleza: 'observada', tipo_senal: 'objecion',
          texto,
          payload: {},
          confianza: 0.8, peso: 3,
        });
        n++;
      }
      nuevoCursor.perdidas = d.updated_at;
    }
    detalle.perdidas = n;
  }

  // ── 5 · Por qué se fue un cliente ─────────────────────────────────────────
  {
    const desde = cur.churn || DESDE_CERO;
    const { data } = await supabase
      .from('churn_casos')
      .select('id, motivo_categoria, motivo_detalle, motivo_original, created_at')
      .gt('created_at', desde)
      .order('created_at')
      .limit(TOPE);

    let n = 0;
    for (const c of data || []) {
      const texto = [c.motivo_detalle, c.motivo_original].filter(Boolean).join(' — ').trim();
      if (texto.length > 6) {
        senales.push({
          clave_idem: `crm:churn:${c.id}`,
          tipo_fuente: 'crm', fuente: 'churn',
          observada_at: c.created_at,
          naturaleza: 'observada', tipo_senal: 'queja',
          texto,
          payload: { categoria: c.motivo_categoria || null },
          confianza: 0.85, peso: 3,
        });
        n++;
      }
      nuevoCursor.churn = c.created_at;
    }
    detalle.churn = n;
  }

  // ── 6 · Lo que el lead contestó al agendar ────────────────────────────────
  {
    const desde = cur.booking || DESDE_CERO;
    const { data } = await supabase
      .from('booking_answers')
      .select('id, valor, created_at, question_id')
      .gt('created_at', desde)
      .order('created_at')
      .limit(TOPE);

    let n = 0;
    for (const b of data || []) {
      const texto = String(b.valor || '').trim();
      if (texto.length > 15) {
        senales.push({
          clave_idem: `crm:booking:${b.id}`,
          tipo_fuente: 'crm', fuente: 'agenda',
          observada_at: b.created_at,
          naturaleza: 'observada', tipo_senal: 'deseo',
          query_cruda: texto, texto,
          payload: { pregunta: b.question_id },
          confianza: 0.85, peso: 3,
        });
        n++;
      }
      nuevoCursor.booking = b.created_at;
    }
    detalle.agenda = n;
  }

  const r = await registrarVarias(senales);
  await guardarCursores(nuevoCursor);
  return { ...r, detalle };
}

registrar('ingerir.crm', async (): Promise<ResultadoHandler> => {
  try {
    const r = await ingerirCrm();
    await marcarOk('crm', r.nuevas);
    const desglose = Object.entries(r.detalle).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ');
    return {
      ok: true,
      resumen: r.nuevas ? `${r.nuevas} señales nuevas (${desglose})` : 'nada nuevo desde la última vez',
      datos: r,
    };
  } catch (e: any) {
    await marcarFallo('crm', e?.message || String(e));
    throw e;
  }
});
