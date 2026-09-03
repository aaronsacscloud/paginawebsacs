// Hilos del brief y los avisos por correo.
//
// Un hilo cuelga de una PREGUNTA (o de la etapa entera, con campo_id null) y
// guarda la conversación completa. La regla que lo hace útil: un hilo está
// pendiente del cliente cuando está `abierto` y el ÚLTIMO mensaje es nuestro.
// De ahí sale, sin interpretar nada, el "qué me falta contestar" que ve el
// cliente arriba de su etapa.
import { supabase } from '../supabase';
import { sendEmail } from '../email';
import { ETAPAS_POR_CLAVE } from './etapas';

export type Mensaje = { de: 'sacs' | 'cliente'; texto: string; at: string };

export type Hilo = {
  id: string;
  etapa_clave: string;
  campo_id: string | null;
  mensajes: Mensaje[];
  estado: 'abierto' | 'resuelto';
  updated_at: string;
};

export async function hilosDe(briefId: string): Promise<Hilo[]> {
  const { data } = await supabase
    .from('proyecto_hilo')
    .select('id, etapa_clave, campo_id, mensajes, estado, updated_at')
    .eq('brief_id', briefId)
    .order('updated_at');
  return (data || []) as Hilo[];
}

/** Pendientes del CLIENTE: abiertos y con la última palabra de Sacs. */
export function pendientesDelCliente(hilos: Hilo[]): Hilo[] {
  return hilos.filter((h) => {
    if (h.estado !== 'abierto') return false;
    const u = h.mensajes[h.mensajes.length - 1];
    return !!u && u.de === 'sacs';
  });
}

/** Añade un mensaje al hilo de (etapa, campo), creándolo si no existía. */
export async function escribir(
  briefId: string,
  etapaClave: string,
  campoId: string | null,
  de: 'sacs' | 'cliente',
  texto: string,
  estado?: 'abierto' | 'resuelto',
): Promise<void> {
  const t = String(texto || '').trim().slice(0, 4000);
  if (!t) return;

  // El hilo de la ETAPA (campo_id null) y el de una PREGUNTA se buscan
  // distinto: en Postgres `= null` no encuentra nada, hay que usar `is null`.
  const base = supabase
    .from('proyecto_hilo')
    .select('id, mensajes')
    .eq('brief_id', briefId)
    .eq('etapa_clave', etapaClave);
  const { data } = campoId === null
    ? await base.is('campo_id', null).maybeSingle()
    : await base.eq('campo_id', campoId).maybeSingle();
  const fila = (data as { id: string; mensajes: Mensaje[] } | null) || null;

  const mensaje: Mensaje = { de, texto: t, at: new Date().toISOString() };

  if (fila) {
    await supabase
      .from('proyecto_hilo')
      .update({
        mensajes: [...(fila.mensajes || []), mensaje],
        estado: estado || 'abierto',
        updated_at: new Date().toISOString(),
      })
      .eq('id', fila.id);
  } else {
    await supabase.from('proyecto_hilo').insert({
      brief_id: briefId,
      etapa_clave: etapaClave,
      campo_id: campoId,
      mensajes: [mensaje],
      estado: estado || 'abierto',
    });
  }
}

export async function resolver(briefId: string, etapaClave: string, campoId: string) {
  await supabase
    .from('proyecto_hilo')
    .update({ estado: 'resuelto', updated_at: new Date().toISOString() })
    .eq('brief_id', briefId)
    .eq('etapa_clave', etapaClave)
    .eq('campo_id', campoId);
}

// ── Avisos ────────────────────────────────────────────────────────────
const BASE = 'https://www.sacscloud.com';

const escapar = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function envoltura(titulo: string, cuerpo: string, url: string, cta: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#F6F4F3;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5DFE1;border-radius:14px;overflow:hidden">
    <div style="padding:26px 28px 4px">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8E2437;font-weight:600">Brief de proyecto</div>
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:25px;line-height:1.2;color:#191518;margin:12px 0 16px">${escapar(titulo)}</h1>
    </div>
    <div style="padding:0 28px 8px;color:#5C545A;font-size:15px;line-height:1.6">${cuerpo}</div>
    <div style="padding:20px 28px 30px">
      <a href="${url}" style="display:inline-block;background:#191518;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:10px">${escapar(cta)}</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E5DFE1;color:#948C91;font-size:12px">
      Sacscloud · este link es privado, no lo compartan fuera del equipo.
    </div>
  </div>
</div>`;
}

type BriefAviso = {
  id: string;
  token: string;
  cliente: string;
  proyecto: string;
  avisos_email: string[] | null;
  avisos_copia: string[] | null;
};

/**
 * Avisa que Sacs ya revisó una etapa. Va al cliente y a la copia interna.
 * Nunca truena hacia arriba: si el correo falla, la revisión ya quedó guardada
 * y perderla por un problema de envío sería peor.
 */
export async function avisarRevision(
  brief: BriefAviso,
  etapaClave: string,
  preguntas: { campo: string; texto: string }[],
  aprobada: boolean,
  siguiente: string | null,
) {
  const def = ETAPAS_POR_CLAVE.get(etapaClave);
  const url = `${BASE}/proyecto/${brief.token}`;
  const nombreEtapa = def?.titulo || etapaClave;

  let cuerpo: string;
  let titulo: string;

  if (aprobada) {
    const sig = siguiente ? ETAPAS_POR_CLAVE.get(siguiente)?.titulo : null;
    titulo = `“${nombreEtapa}” quedó aprobada`;
    cuerpo =
      `<p>Revisamos todo lo que mandaron y está completo. Esa etapa queda cerrada.</p>` +
      (sig
        ? `<p>Ya se abrió la siguiente: <b>${escapar(sig)}</b>.</p>`
        : `<p>Con esta se terminó el brief. Nos ponemos en contacto para arrancar.</p>`);
  } else {
    titulo = `Revisamos “${nombreEtapa}” — quedaron ${preguntas.length} ${preguntas.length === 1 ? 'pregunta' : 'preguntas'}`;
    const lista = preguntas
      .slice(0, 8)
      .map(
        (p) =>
          `<li style="margin-bottom:10px"><b style="color:#191518">${escapar(p.campo)}</b><br>${escapar(p.texto)}</li>`,
      )
      .join('');
    cuerpo =
      `<p>Ya leímos sus respuestas. Casi todo sirve; sobre esto necesitamos un poco más:</p>` +
      `<ul style="padding-left:18px;margin:14px 0">${lista}</ul>` +
      (preguntas.length > 8 ? `<p>…y ${preguntas.length - 8} más en el documento.</p>` : '') +
      `<p>Cada pregunta se contesta ahí mismo, debajo de su respuesta. Cuando terminen, vuelvan a enviar la etapa.</p>`;
  }

  const html = envoltura(titulo, cuerpo, url, aprobada ? 'Ver el brief' : 'Contestar las preguntas');
  const destinos = new Set([...(brief.avisos_email || []), ...(brief.avisos_copia || [])]);
  for (const to of destinos) {
    if (!to || !to.includes('@')) continue;
    await sendEmail({ to, subject: `${brief.cliente} · ${titulo}`, html }).catch(() => null);
  }
}

/** Avisa a la copia interna que el cliente mandó (o volvió a mandar) una etapa. */
export async function avisarEnvioDelCliente(brief: BriefAviso, etapaClave: string, reenvio: boolean) {
  const def = ETAPAS_POR_CLAVE.get(etapaClave);
  const url = `${BASE}/proyecto/${brief.token}`;
  const titulo = reenvio
    ? `${brief.cliente} contestó las preguntas de “${def?.titulo || etapaClave}”`
    : `${brief.cliente} envió “${def?.titulo || etapaClave}”`;
  const html = envoltura(
    titulo,
    `<p>Ya está en revisión. La rutina la mira dentro de las próximas 12 horas, o pueden revisarla ahora.</p>`,
    url,
    'Revisar la etapa',
  );
  for (const to of new Set(brief.avisos_copia || [])) {
    if (!to || !to.includes('@')) continue;
    await sendEmail({ to, subject: titulo, html }).catch(() => null);
  }
}
