// TRABAJO INTELIGENTE · A0 — EL PERFIL VIVO (ti_perfil): lo que el sistema
// RECUERDA de cada lead, recalculado desde la bitácora.
//
// Todo lo de aquí es DETERMINISTA y regenerable: se puede borrar la fila y
// volver a correr. Lo que extrae la IA (objeciones, intenciones, promesas,
// resumen) NO se toca aquí — entra por el registro de campos (A4/A5) y se
// conserva entre recálculos.
//
// Regla de la mejor hora: se aprende de CUALQUIER respuesta del lead por ese
// canal (antes solo de la llamada contestada), con mínimo 2 coincidencias.
import { supabase } from '../../supabase';
import { horaLocal } from './reglas';

const MS_D = 86400e3;
const RESPUESTA_WA = new Set(['wa_entrante']);
const RESPUESTA_CORREO = new Set(['correo_respondido', 'correo_abierto', 'correo_clic']);
const TOQUE = new Set(['wa_saliente', 'correo_enviado', 'llamada', 'ia_mensaje']);
const GIROS_MODA = /moda|ropa|calzado|zapat|joyer|boutique|accesor/i;

function argmaxHora(h: Record<string, number>): number | null {
  let mejor: string | null = null, n = 0;
  for (const [k, v] of Object.entries(h)) if (v > n) { mejor = k; n = v; }
  return n >= 2 && mejor != null ? Number(mejor) : null;
}

export async function recalcularPerfil(contactId: string) {
  const [{ data: evs }, { data: c }] = await Promise.all([
    supabase.from('ti_eventos').select('tipo, canal, actor, payload, ocurrio_at')
      .eq('contact_id', contactId).order('ocurrio_at', { ascending: true }).limit(3000),
    supabase.from('contacts').select('id, company_id, giro, sucursales_interes, referrer_partner_id, wa_optout, lifecycle_stage').eq('id', contactId).maybeSingle(),
  ]);
  if (!c) return null;
  const lista = evs || [];

  const horas: Record<string, Record<string, number>> = { wa: {}, llamada: {}, correo: {} };
  const canales: any = {
    wa: { enviados: 0, respondidos: 0, fallidos: 0, leidos: 0, marketing_limite: 0 },
    correo: { enviados: 0, abiertos: 0, clics: 0, respondidos: 0, rebotes: 0 },
    llamada: { intentos: 0, contestadas: 0 },
  };
  const senales: Record<string, number> = {};
  let ultimaRespuesta: string | null = null, ultimoToque: string | null = null;
  let primer: string | null = null, ultimo: string | null = null, ultimoTipo: string | null = null;
  let cotVista = 0, cotEnviada = 0, citas = 0, pagada = false, aceptada = false;

  for (const e of lista) {
    const t = e.tipo, h = String(horaLocal(new Date(e.ocurrio_at)));
    senales[t] = (senales[t] || 0) + 1;
    primer = primer || e.ocurrio_at; ultimo = e.ocurrio_at; ultimoTipo = t;
    if (e.actor === 'lead') ultimaRespuesta = e.ocurrio_at;
    if (TOQUE.has(t)) ultimoToque = e.ocurrio_at;
    if (RESPUESTA_WA.has(t)) { horas.wa[h] = (horas.wa[h] || 0) + 1; canales.wa.respondidos++; }
    if (t === 'wa_saliente') canales.wa.enviados++;
    if (t === 'wa_fallido') { canales.wa.fallidos++; if ((e.payload as any)?.clase === 'marketing_limite') canales.wa.marketing_limite++; }
    if (t === 'wa_leido') canales.wa.leidos++;
    if (t === 'correo_enviado') canales.correo.enviados++;
    if (t === 'correo_abierto') { canales.correo.abiertos++; horas.correo[h] = (horas.correo[h] || 0) + 1; }
    if (t === 'correo_clic') canales.correo.clics++;
    if (t === 'correo_respondido') { canales.correo.respondidos++; horas.correo[h] = (horas.correo[h] || 0) + 1; }
    if (t === 'correo_rebote') canales.correo.rebotes++;
    if (t === 'llamada') { canales.llamada.intentos++; if ((e.payload as any)?.contesto) { canales.llamada.contestadas++; horas.llamada[h] = (horas.llamada[h] || 0) + 1; } }
    if (t === 'cotizacion_vista') cotVista++;
    if (t === 'cotizacion_enviada') cotEnviada++;
    if (t === 'cotizacion_aceptada') aceptada = true;
    if (t === 'cotizacion_pagada' || t === 'suscripcion_activa') pagada = true;
    if (t === 'cita_creada') citas++;
  }

  // ¿Por dónde responde? El canal con más respuestas reales (no aperturas).
  const resp = { wa: canales.wa.respondidos, correo: canales.correo.respondidos, llamada: canales.llamada.contestadas };
  const canalQueResponde = (Object.entries(resp).sort((a, b) => b[1] - a[1])[0] || ['ninguno', 0]);
  const canal_que_responde = canalQueResponde[1] > 0 ? canalQueResponde[0] : 'ninguno';

  // Etapa de interés (heurística v0; la IA la afinará con la conversación).
  const etapa_interes = pagada ? 'cliente'
    : (aceptada || cotVista > 0 || citas > 0 || cotEnviada > 0) ? 'decidiendo'
    : (canales.wa.respondidos + canales.correo.respondidos + canales.llamada.contestadas) >= 2 ? 'evaluando'
    : 'curioso';

  // Valor v0: tamaño + giro + partner. Probabilidad v0: frescura de la última respuesta.
  const suc = Number(c.sucursales_interes) || 0;
  const score_valor = Math.min(5, 1 + (suc >= 3 ? 2 : suc >= 2 ? 1 : 0) + (GIROS_MODA.test(String(c.giro || '')) ? 1 : 0) + (c.referrer_partner_id ? 1 : 0));
  const diasResp = ultimaRespuesta ? (Date.now() - Date.parse(ultimaRespuesta)) / MS_D : null;
  const score_probabilidad = diasResp == null ? 0.05 : diasResp <= 1 ? 0.9 : diasResp <= 3 ? 0.7 : diasResp <= 7 ? 0.5 : diasResp <= 21 ? 0.3 : diasResp <= 60 ? 0.15 : 0.08;

  const fila = {
    contact_id: contactId, company_id: c.company_id || null,
    mejor_hora_wa: argmaxHora(horas.wa), mejor_hora_llamada: argmaxHora(horas.llamada), mejor_hora_correo: argmaxHora(horas.correo),
    horas_respuesta: horas, canales, canal_que_responde,
    etapa_interes, score_valor, score_probabilidad,
    partner_id: c.referrer_partner_id || null,
    do_not_contact_hasta: c.wa_optout ? '2999-01-01T00:00:00Z' : null,
    primer_evento_at: primer, ultimo_evento_at: ultimo, ultimo_evento_tipo: ultimoTipo,
    ultima_respuesta_at: ultimaRespuesta, ultimo_toque_at: ultimoToque,
    eventos_total: lista.length, senales, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('ti_perfil').upsert(fila, { onConflict: 'contact_id' });
  if (error) throw new Error(`ti_perfil: ${error.message}`);

  // Write-through a la cadencia: el motor de hoy lee ti_cadencias.mejor_hora
  // (solo la aprendía de la llamada). Ahora la hereda de cualquier respuesta.
  const mejor = fila.mejor_hora_llamada ?? fila.mejor_hora_wa;
  if (mejor != null) {
    await supabase.from('ti_cadencias').update({ mejor_hora: mejor }).eq('contact_id', contactId).is('mejor_hora', null);
  }
  return fila;
}

export async function recalcularPerfiles(ids: string[]) {
  let ok = 0; const errores: string[] = [];
  for (const id of [...new Set(ids)]) {
    try { if (await recalcularPerfil(id)) ok++; } catch (e: any) { errores.push(`${id}: ${e?.message || e}`); }
  }
  return { perfiles: ok, perfil_errores: errores.slice(0, 5) };
}
