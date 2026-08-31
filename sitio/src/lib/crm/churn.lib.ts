/**
 * CHURN · lo que toca la base de datos. SOLO servidor.
 *
 * Las reglas puras viven en churn.reglas.ts para que la UI las use sin
 * arrastrar el cliente de Supabase al navegador.
 */
import { supabase } from '../supabase';
import { ABIERTAS, type Etapa } from './churn.reglas';
export * from './churn.reglas';

/**
 * Los campos hermanos se mueven CON la etapa, en el mismo acto.
 *
 * Esto es el aprendizaje de «descalificado»: mover solo un campo dejaba al
 * cliente contando dos historias distintas —etapa por un lado, pastilla por
 * otro— y todo lo que enruta por el otro campo lo seguía tratando como antes.
 */
export async function sincronizarHermanos(caso: any, destino: Etapa) {
  const empresa = destino === 'recuperado' ? 'activo' : destino === 'irrecuperable' ? 'cancelado' : null;
  if (empresa) {
    await supabase.from('companies').update({ estado_cuenta: empresa }).eq('id', caso.company_id);
    /* Y SE VUELVE A CERRAR EL ACCESO al darlo por perdido. Entrar a gracia lo
       desbloquea; sin esto, «cerrar como perdido» —la única acción
       irreversible del módulo— dejaba al ex-cliente con el sistema abierto
       gratis para siempre. Se reporta el fallo en la historia en vez de tirar
       la transición: son dos hechos distintos, igual que al desbloquear. */
    if (destino === 'irrecuperable') {
      const { data: emp } = await supabase.from('companies').select('sacs_account').eq('id', caso.company_id).single();
      if (emp?.sacs_account) {
        const { avisoEnCuenta } = await import('./prueba');
        const r = await avisoEnCuenta(emp.sacs_account, 'bloquear');
        await anotar(caso, 'nota', r.ok ? 'Acceso cerrado en SACS' : 'No se pudo cerrar el acceso en SACS',
          r.ok ? undefined : r.error, true);
      }
    }
    await supabase.from('contacts')
      .update({ lifecycle_stage: destino === 'recuperado' ? 'cliente' : 'churned' })
      .eq('company_id', caso.company_id)
      .in('lifecycle_stage', destino === 'recuperado' ? ['churned'] : ['cliente', 'churned']);
  }
}

/** Una línea en la historia del caso. Va al MISMO río que la ficha 360. */
export async function anotar(caso: any, tipo: string, titulo: string, descripcion?: string, automatico = true) {
  await supabase.from('activities').insert({
    company_id: caso.company_id, churn_caso_id: caso.id,
    tipo, titulo, descripcion: descripcion || null, automatico,
  }).then(() => {}, () => {});
}

/**
 * ABRIR EL CASO SI APLICA. Idempotente a propósito: la llaman el momento de
 * cancelar (para que el caso exista al instante) y un barrido nocturno (la
 * red por si el primero falló o la baja entró por otro camino). Llamarla dos
 * veces no duplica nada.
 *
 * La regla de entrada salió de medir, no de suponer: es churn quien canceló y
 * NO conserva ninguna sub viva. Quien cancela una y mantiene otra es
 * CONTRACCIÓN — eso ya lo cuenta el ledger y no abre caso.
 */
export async function abrirCasoSiAplica(companyId: string): Promise<{ creado: boolean; caso_id?: string; motivo?: string }> {
  if (!companyId) return { creado: false, motivo: 'sin empresa' };

  const { data: subs } = await supabase.from('subscriptions')
    .select('id, estado, mrr, razon_cancelacion, cancelada_at, updated_at')
    .eq('company_id', companyId);
  const vivas = (subs || []).filter(s => ['activa', 'programada', 'pendiente_pago', 'pausada'].includes(s.estado));
  if (vivas.length) return { creado: false, motivo: 'conserva una suscripción viva: es contracción, no churn' };

  const canceladas = (subs || []).filter(s => s.estado === 'cancelada');
  if (!canceladas.length) return { creado: false, motivo: 'no tiene suscripciones canceladas' };

  // Un solo caso abierto por empresa. Si ya hay uno, se anota ahí: partir la
  // historia en dos casos paralelos es perder el hilo del rescate.
  const { data: vivo } = await supabase.from('churn_casos')
    .select('id').eq('company_id', companyId).in('etapa', ABIERTAS).maybeSingle();
  if (vivo) return { creado: false, caso_id: vivo.id, motivo: 'ya tenía un caso abierto' };

  canceladas.sort((a, b) => String(b.cancelada_at || b.updated_at || '').localeCompare(String(a.cancelada_at || a.updated_at || '')));
  const ultima = canceladas[0];
  const { data: previos } = await supabase.from('churn_casos')
    .select('id, episodio, cerrado_at').eq('company_id', companyId).order('episodio', { ascending: false }).limit(1);
  const previo = previos?.[0];

  /* Solo las bajas de ESTE episodio. Sumar todas las canceladas históricas
     hacía que un cliente que se fue ($700), volvió y se fue otra vez ($900)
     abriera el episodio 2 con $1,600 — dinero que el episodio 1 ya había
     contado. Con reincidentes, que es justo lo que el modelo presume
     soportar, la cifra se descomponía sola. */
  const deEsteEpisodio = previo?.cerrado_at
    ? canceladas.filter(s => String(s.cancelada_at || s.updated_at || '') > String(previo.cerrado_at))
    : canceladas;
  const mrrDelEpisodio = (deEsteEpisodio.length ? deEsteEpisodio : [ultima])
    .reduce((t, s) => t + Number(s.mrr || 0), 0);

  const { data, error } = await supabase.from('churn_casos').insert({
    company_id: companyId,
    subscription_id: ultima.id,
    mrr_perdido: mrrDelEpisodio,
    motivo_original: ultima.razon_cancelacion || null,
    motivo_categoria: categorizarRazon(ultima.razon_cancelacion),
    detectado_at: ultima.cancelada_at || new Date().toISOString(),
    fecha_estimada: !ultima.cancelada_at,
    episodio: (previo?.episodio || 0) + 1,
    caso_previo_id: previo?.id || null,
  }).select('id').single();
  if (error) return { creado: false, motivo: error.message };

  await anotar({ id: data.id, company_id: companyId }, 'nota', 'Caso de churn abierto',
    previo ? `Episodio ${(previo.episodio || 0) + 1}: este cliente ya se había ido antes.` : 'Detectado al cancelar la suscripción.');
  return { creado: true, caso_id: data.id };
}

/** El mismo mapeo del backfill, para que lo viejo y lo nuevo se cuenten igual. */
export function categorizarRazon(razon?: string | null): string | null {
  const r = String(razon || '').toLowerCase();
  if (!r.trim()) return null;
  if (r.includes('competencia')) return 'competencia';
  if (r.includes('implementaci')) return 'implementacion';
  if (r.includes('mal servicio') || r.includes('mal_servicio') || r.includes('soporte')) return 'mal_servicio';
  if (r === 'no_uso' || r.includes('no lo usaba') || (r.includes('nunca') && r.includes('us'))) return 'no_uso';
  if (r.includes('cerr') && r.includes('negocio')) return 'cerro_negocio';
  if (r.includes('precio') || r.includes('caro')) return 'precio';
  if (r.includes('dej') && r.includes('pagar')) return 'dejo_de_pagar';
  return 'otro';
}

