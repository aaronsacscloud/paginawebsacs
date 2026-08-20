/**
 * El freno de emergencia.
 *
 * Los topes de presión cuidan a cada persona: cuántos correos le caen a UNA
 * en una semana. No cuidan al dominio. Si una campaña sale mal a las dos de la
 * mañana —una lista vieja, una plantilla que dispara filtros, un segmento
 * equivocado— nadie está despierto para pararla, y para las ocho ya se
 * quemaron la reputación y, con ella, TODO el correo del inquilino.
 *
 * Este freno mira la tasa de quejas y de rebotes de las últimas 24 horas y,
 * si cruza el umbral, apaga el marketing. Solo el marketing: el correo de
 * relación —renovaciones, avisos de cobro— tiene que seguir llegando, y de
 * hecho es lo primero que hay que proteger.
 *
 * El umbral por omisión es 0.3% de quejas, que es el límite que publican
 * Gmail y Yahoo: pasado eso empiezan a mandarte a spam de oficio.
 *
 * Se levanta A MANO. Un freno que se quita solo a la media hora vuelve a
 * disparar la misma campaña que lo activó.
 */
import { supabase } from '../supabase';

export interface EstadoFreno {
  frenado: boolean;
  desde?: string;
  motivo?: string;
  quejas_pct: number;
  rebotes_pct: number;
  muestra: number;
  umbral_quejas: number;
  umbral_rebotes: number;
}

/** ¿Está frenado ahora? Lectura barata para el camino de envío. */
export async function frenado(tenantId: string): Promise<{ si: boolean; motivo?: string }> {
  const { data } = await supabase.from('email_tenants')
    .select('freno_at, freno_motivo').eq('id', tenantId).maybeSingle();
  return data?.freno_at ? { si: true, motivo: data.freno_motivo || 'Freno de emergencia activo' } : { si: false };
}

/**
 * Mide y, si hace falta, frena. Devuelve el estado para mostrarlo en Salud.
 *
 * Se llama después de cada queja o rebote (reacción inmediata) y desde el cron
 * (red de seguridad, por si el webhook se cae justo cuando más importa).
 */
export async function revisarFreno(tenantId: string): Promise<EstadoFreno> {
  const { data: t } = await supabase.from('email_tenants')
    .select('freno_at, freno_motivo, freno_umbral_quejas, freno_umbral_rebotes, freno_muestra_minima')
    .eq('id', tenantId).maybeSingle();

  const umbralQuejas = Number(t?.freno_umbral_quejas ?? 0.3);
  const umbralRebotes = Number(t?.freno_umbral_rebotes ?? 5);
  const minima = Number(t?.freno_muestra_minima ?? 50);
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Solo cuenta el marketing: un rebote de un aviso de cobro a un correo mal
  // escrito por el propio cliente no dice nada de la reputación de la lista.
  const base = () => supabase.from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('categoria', 'marketing').gte('created_at', desde);

  const [{ count: enviados }, { count: quejas }, { count: rebotes }] = await Promise.all([
    base().in('estado', ['sent', 'delivered', 'opened', 'clicked', 'spam', 'bounced']),
    base().eq('estado', 'spam'),
    base().eq('estado', 'bounced'),
  ]);

  const n = enviados || 0;
  const qp = n ? ((quejas || 0) / n) * 100 : 0;
  const rp = n ? ((rebotes || 0) / n) * 100 : 0;

  const estado: EstadoFreno = {
    frenado: !!t?.freno_at, desde: t?.freno_at || undefined, motivo: t?.freno_motivo || undefined,
    quejas_pct: Math.round(qp * 100) / 100, rebotes_pct: Math.round(rp * 100) / 100,
    muestra: n, umbral_quejas: umbralQuejas, umbral_rebotes: umbralRebotes,
  };

  // Una muestra chica da porcentajes absurdos: dos rebotes de tres envíos son
  // 66% y no significan nada. Sin este piso, el freno se dispara en cuanto
  // alguien manda una prueba a un correo inventado.
  if (n < minima || t?.freno_at) return estado;

  let motivo = '';
  if (qp >= umbralQuejas) motivo = `Quejas de spam en ${qp.toFixed(2)}% de ${n} envíos (límite ${umbralQuejas}%)`;
  else if (rp >= umbralRebotes) motivo = `Rebotes en ${rp.toFixed(2)}% de ${n} envíos (límite ${umbralRebotes}%)`;
  if (!motivo) return estado;

  await supabase.from('email_tenants')
    .update({ freno_at: new Date().toISOString(), freno_motivo: motivo }).eq('id', tenantId);

  // Y se pausan las campañas en vuelo: dejar el freno puesto pero la campaña
  // "enviando" hace que cada intento se registre como fallo y el reporte
  // acabe mintiendo sobre lo que pasó.
  await supabase.from('email_campanas')
    .update({ estado: 'pausada' }).eq('tenant_id', tenantId).in('estado', ['enviando', 'programada']);

  console.error(`[freno] MARKETING DETENIDO para ${tenantId}: ${motivo}`);
  return { ...estado, frenado: true, motivo, desde: new Date().toISOString() };
}

/** Levantar el freno. Deliberado y con nombre: queda en la bitácora. */
export async function soltarFreno(tenantId: string, quien: string): Promise<void> {
  await supabase.from('email_tenants').update({
    freno_at: null,
    freno_motivo: `Levantado por ${quien} el ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  }).eq('id', tenantId);
}
