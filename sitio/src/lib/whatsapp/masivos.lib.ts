// Crear un masivo (broadcast de Kapso + su espejo en wa_broadcasts). Vive en lib
// porque lo llaman dos pantallas: el wizard de WhatsApp → Masivos y la invitación
// a citas en el stand de una feria (Eventos). Uno solo: si Kapso cambia la forma
// de crear broadcasts, se arregla aquí.
import { supabase } from '../supabase';
import { crearBroadcast, agregarDestinatarios, resolverTemplateId, sanearParam, KapsoError } from './kapso-api';
import { telefonoWhatsApp } from '../telefono';

export interface DestinatarioCrudo { telefono?: string | null; contact_id?: string | null; company_id?: string | null; params?: string[] }

/** Devuelve {status, cuerpo}: el endpoint lo responde tal cual; otros llamadores leen cuerpo.ok / cuerpo.id. */
export async function crearMasivo(b: { nombre?: string; plantilla_id?: string; destinatarios?: DestinatarioCrudo[]; origen?: string }): Promise<{ status: number; cuerpo: any }> {
  const _V = 'v11.1';   // marcador de despliegue (diagnóstico)
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return { status: 400, cuerpo: { error: 'Falta el nombre del masivo' } };
  const { data: plantilla } = await supabase.from('wa_plantillas')
    .select('*').eq('id', b.plantilla_id || '').maybeSingle();
  if (!plantilla) return { status: 404, cuerpo: { error: 'Plantilla no encontrada' } };
  if (plantilla.status !== 'APPROVED') return { status: 400, cuerpo: { error: `La plantilla está ${plantilla.status}: solo una APPROVED puede salir en masivo` } };

  const crudos: any[] = Array.isArray(b.destinatarios) ? b.destinatarios : [];
  const vistos = new Set<string>();
  const listos: Array<{ telefono: string; contact_id: string | null; company_id: string | null; params: string[] }> = [];
  const descartados: string[] = [];
  for (const d of crudos) {
    const tel = telefonoWhatsApp(d.telefono);
    if (!tel) { descartados.push(String(d.telefono || '¿?')); continue; }
    if (vistos.has(tel)) continue;
    vistos.add(tel);
    listos.push({
      telefono: tel, contact_id: d.contact_id || null, company_id: d.company_id || null,
      params: (Array.isArray(d.params) ? d.params : []).map(sanearParam),
    });
  }
  if (!listos.length) return { status: 400, cuerpo: { error: 'Ningún destinatario con teléfono utilizable', descartados } };

  try {
    const templateId = await resolverTemplateId(plantilla.nombre, plantilla.idioma, plantilla.meta_template_id);
    if (!templateId) return { status: 502, cuerpo: { error: 'No pude resolver el id de la plantilla en Kapso' } };

    const creado = await crearBroadcast(nombre, templateId);
    const kapsoId = String(creado?.id || '');
    if (!kapsoId) return { status: 502, cuerpo: { error: 'Kapso no devolvió el id del broadcast' } };

    const { data: fila } = await supabase.from('wa_broadcasts').insert({
      kapso_broadcast_id: kapsoId, nombre,
      plantilla_nombre: plantilla.nombre, template_id: templateId,
      status: 'borrador', total: listos.length,
    }).select('id').single();

    await supabase.from('wa_broadcast_destinatarios').insert(listos.map(d => ({
      broadcast_id: fila!.id, telefono: d.telefono,
      contact_id: d.contact_id, company_id: d.company_id,
      params: d.params,
    })));

    await agregarDestinatarios(kapsoId, listos.map(d => ({
      phone_number: d.telefono,
      ...(d.params.length ? {
        template_components: [{ type: 'body', parameters: d.params.map(p => ({ type: 'text', text: p })) }],
      } : {}),
    })));

    return { status: 200, cuerpo: { ok: true, id: fila!.id, total: listos.length, descartados, _v: _V } };
  } catch (e: any) {
    return { status: 502, cuerpo: { error: e instanceof KapsoError ? e.message : String(e), _v: _V } };
  }
}
