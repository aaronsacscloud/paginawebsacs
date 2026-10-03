// Crear un masivo (broadcast de Kapso + su espejo en wa_broadcasts). Vive en lib
// porque lo llaman dos pantallas: el wizard de WhatsApp → Masivos y la invitación
// a citas en el stand de una feria (Eventos). Uno solo: si Kapso cambia la forma
// de crear broadcasts, se arregla aquí.
import { supabase } from '../supabase';
import { crearBroadcast, agregarDestinatarios, resolverTemplateId, sanearParam, KapsoError } from './kapso-api';
import { telefonoWhatsApp } from '../telefono';
import { lineaPara, infoLinea, cupoLinea } from './linea';

export interface DestinatarioCrudo { telefono?: string | null; contact_id?: string | null; company_id?: string | null; params?: string[] }

/** Encabezado de media de un masivo. Meta NO lo toma de la plantilla: cada envío
 *  lleva el link de la imagen/PDF/video; sin él, la plantilla de media se rechaza. */
export interface HeaderMasivo { tipo: 'image' | 'document' | 'video'; url: string; filename?: string | null }

const TIPOS_MEDIA: Record<string, HeaderMasivo['tipo']> = { IMAGE: 'image', DOCUMENT: 'document', VIDEO: 'video' };
const NOMBRE_MEDIA: Record<HeaderMasivo['tipo'], string> = { image: 'imagen', document: 'documento (PDF)', video: 'video' };

/** El tipo de media que pide la plantilla (null si su encabezado es texto o no tiene). */
export const tipoMediaDePlantilla = (headerTipo?: string | null): HeaderMasivo['tipo'] | null =>
  TIPOS_MEDIA[String(headerTipo || '').toUpperCase()] || null;

/** Los `components` de UN destinatario en el formato de Kapso/Meta: encabezado de media (si hay) + cuerpo. */
export function componentesDestinatario(params: string[], header?: HeaderMasivo | null): any[] | null {
  const c: any[] = [];
  if (header?.url) {
    const media: any = { link: header.url };
    if (header.tipo === 'document' && header.filename) media.filename = header.filename;
    c.push({ type: 'header', parameters: [{ type: header.tipo, [header.tipo]: media }] });
  }
  if (params.length) c.push({ type: 'body', parameters: params.map(p => ({ type: 'text', text: p })) });
  return c.length ? c : null;
}

/** Resuelve el encabezado de un masivo: el que mandó quien lo crea o, si no, el
 *  archivo de muestra de la plantilla. Error si la plantilla lo pide y no hay URL. */
export function resolverHeader(plantilla: any, pedido?: Partial<HeaderMasivo> | null): { header: HeaderMasivo | null; error?: string } {
  const tipo = tipoMediaDePlantilla(plantilla?.header_tipo);
  if (!tipo) return { header: null };
  if (pedido?.tipo && pedido.tipo !== tipo) return { header: null, error: `La plantilla lleva encabezado de ${NOMBRE_MEDIA[tipo]}, no de ${NOMBRE_MEDIA[pedido.tipo] || pedido.tipo}` };
  const url = String(pedido?.url || plantilla?.header_media_url || '').trim();
  if (!url) return { header: null, error: `La plantilla «${plantilla?.nombre}» lleva encabezado de ${NOMBRE_MEDIA[tipo]}: falta la URL pública del archivo` };
  if (!/^https:\/\/\S+$/i.test(url)) return { header: null, error: 'La URL del encabezado debe ser pública y empezar con https://' };
  const filename = tipo === 'document'
    ? (String(pedido?.filename || '').trim() || decodeURIComponent(url.split('?')[0].split('/').pop() || '') || 'documento.pdf')
    : null;
  return { header: { tipo, url, filename } };
}

/** Devuelve {status, cuerpo}: el endpoint lo responde tal cual; otros llamadores leen cuerpo.ok / cuerpo.id. */
export async function crearMasivo(b: { nombre?: string; plantilla_id?: string; destinatarios?: DestinatarioCrudo[]; origen?: string; phone_number_id?: string | null; contexto?: 'masivo' | 'evento' | 'prospeccion'; forzar_cupo?: boolean; header?: Partial<HeaderMasivo> | null }): Promise<{ status: number; cuerpo: any }> {
  const _V = 'v11.2';   // marcador de despliegue (diagnóstico)
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return { status: 400, cuerpo: { error: 'Falta el nombre del masivo' } };
  const { data: plantilla } = await supabase.from('wa_plantillas')
    .select('*').eq('id', b.plantilla_id || '').maybeSingle();
  if (!plantilla) return { status: 404, cuerpo: { error: 'Plantilla no encontrada' } };
  if (plantilla.status !== 'APPROVED') return { status: 400, cuerpo: { error: `La plantilla está ${plantilla.status}: solo una APPROVED puede salir en masivo` } };
  // Plantilla con encabezado de imagen/PDF/video: sin el link en cada envío, Meta rechaza todo el masivo.
  const { header, error: errHeader } = resolverHeader(plantilla, b.header);
  if (errHeader) return { status: 400, cuerpo: { error: errHeader } };

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

  // ── La línea por la que sale el masivo ──
  // Explícita (el wizard la eligió) o por reglas (contexto masivo/evento → línea). Una línea en pausa
  // (calidad baja o pausa a mano) NO acepta masivos, y el tope diario de la línea se respeta.
  const contexto = b.contexto || 'masivo';
  const pn = b.phone_number_id ? String(b.phone_number_id) : await lineaPara({ contexto, origen: b.origen || null });
  if (!pn) return { status: 400, cuerpo: { error: 'No hay una línea de WhatsApp activa por la que mandar el masivo' } };
  const linea = await infoLinea(pn);
  if (!linea || !linea.activo) return { status: 400, cuerpo: { error: 'Esa línea no está activa' } };
  if (linea.pausada) return { status: 409, cuerpo: { error: `La línea ${linea.numero} está en pausa${linea.pausada_motivo ? ` (${linea.pausada_motivo})` : ''}: elige otra línea o quita la pausa en Ajustes.`, linea_pausada: true } };
  const cupo = await cupoLinea(pn).catch(() => null);
  if (cupo && cupo.tope != null && cupo.libres != null && listos.length > cupo.libres && !b.forzar_cupo) {
    return { status: 409, cuerpo: { error: `La línea ${linea.numero} tiene ${cupo.libres} envíos libres hoy (tope ${cupo.tope}, ya van ${cupo.usados}) y el masivo lleva ${listos.length}. Reduce la lista, programa para mañana o cambia de línea.`, cupo, se_puede_forzar: true } };
  }

  try {
    const templateId = await resolverTemplateId(plantilla.nombre, plantilla.idioma, plantilla.meta_template_id, pn);
    if (!templateId) return { status: 502, cuerpo: { error: 'No pude resolver el id de la plantilla en Kapso' } };

    const creado = await crearBroadcast(nombre, templateId, pn);
    const kapsoId = String(creado?.id || '');
    if (!kapsoId) return { status: 502, cuerpo: { error: 'Kapso no devolvió el id del broadcast' } };

    const espejo: any = {
      kapso_broadcast_id: kapsoId, nombre,
      plantilla_nombre: plantilla.nombre, template_id: templateId,
      status: 'borrador', total: listos.length, phone_number_id: pn,
      ...(header ? { header } : {}),
    };
    let { data: fila, error: errFila } = await supabase.from('wa_broadcasts').insert(espejo).select('id').single();
    // Sin la columna `header` (migration-2026-10-03-masivos-header.sql aún no aplicada) se guarda sin
    // ella: quitar un destinatario después re-arma el encabezado con el archivo de la plantilla.
    if (errFila && header && /header/i.test(errFila.message || '')) {
      const { header: _h, ...sinHeader } = espejo;
      ({ data: fila, error: errFila } = await supabase.from('wa_broadcasts').insert(sinHeader).select('id').single());
    }
    if (errFila || !fila) return { status: 500, cuerpo: { error: `No se pudo guardar el masivo: ${errFila?.message || 'sin fila'}`, _v: _V } };

    const { error: errDest } = await supabase.from('wa_broadcast_destinatarios').insert(listos.map(d => ({
      broadcast_id: fila!.id, telefono: d.telefono,
      contact_id: d.contact_id, company_id: d.company_id,
      params: d.params,
    })));
    if (errDest) return { status: 500, cuerpo: { error: `No se pudieron guardar los destinatarios: ${errDest.message}`, _v: _V } };

    await agregarDestinatarios(kapsoId, listos.map(d => {
      const components = componentesDestinatario(d.params, header);
      return { phone_number: d.telefono, ...(components ? { components } : {}) };
    }));

    return { status: 200, cuerpo: { ok: true, id: fila!.id, total: listos.length, descartados, phone_number_id: pn, header, _v: _V } };
  } catch (e: any) {
    return { status: 502, cuerpo: { error: e instanceof KapsoError ? e.message : String(e), _v: _V } };
  }
}
