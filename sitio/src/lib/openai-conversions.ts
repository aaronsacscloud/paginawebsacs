/**
 * Conversions API de OpenAI — eventos de conversión SERVER-SIDE.
 *
 * Complemento del pixel del navegador (ver BaseLayout.astro). Existe porque el
 * pixel se pierde una parte real de las conversiones: bloqueadores de anuncios,
 * pestaña cerrada antes de que dispare, Safari con ITP. En móvil eso puede ser
 * fácilmente 15-30% de lo que de verdad pasó.
 *
 * ⚠️ DEDUPLICACIÓN — lo más importante de este archivo.
 * Si el pixel y esta API mandan la MISMA conversión con ids distintos, OpenAI
 * las cuenta DOS VECES y todas las métricas quedan infladas. Por eso cada evento
 * lleva un `id` estable derivado del hecho de negocio (el id de la reserva, el
 * id de la cuenta creada), no un aleatorio: si el mismo hecho se reporta desde
 * los dos lados, OpenAI ve el mismo id y los une en uno.
 *
 * Regla al agregar un evento nuevo: el id se construye SIEMPRE a partir de algo
 * que ya identifica el hecho en la base. Nunca Date.now() ni Math.random().
 *
 * La credencial vive solo en variable de entorno (OPENAI_CONVERSIONS_KEY) y
 * nunca se expone al navegador: este módulo solo se importa desde rutas /api.
 */

const ENDPOINT = 'https://bzr.openai.com/v1/events';
const PIXEL_ID = '4qhBC3DP4VjKjFCHqmYbsS';

/** Eventos del catálogo de OpenAI que usamos + el custom del sitio. */
export type EventoOai =
  | 'registration_completed'
  | 'appointment_scheduled'
  | 'custom';

interface OpcionesEvento {
  /** Identificador ESTABLE del hecho de negocio. Ver nota de deduplicación. */
  id: string;
  tipo: EventoOai;
  /** URL donde ocurrió la conversión (para atribución). */
  sourceUrl?: string;
  /** Monto de la conversión, en la moneda que se cobra (MXN). */
  amount?: number;
  currency?: string;
  /** Solo para `custom`: el nombre configurado en el panel. */
  customEventName?: string;
  /** true = valida sin registrar. Útil para probar sin ensuciar métricas. */
  validateOnly?: boolean;
}

/**
 * Manda un evento de conversión. NUNCA lanza: una campaña que no mide es un
 * problema, pero una reserva que se cae porque el pixel falló es peor.
 *
 * @returns true si OpenAI lo aceptó.
 */
export async function medirConversion(op: OpcionesEvento): Promise<boolean> {
  const key = import.meta.env.OPENAI_CONVERSIONS_KEY;
  if (!key) {
    // Sin credencial no se mide, pero se avisa: un fallo silencioso aquí
    // significa semanas de campañas sin datos sin que nadie lo note.
    console.warn('[openai-conversions] falta OPENAI_CONVERSIONS_KEY; no se midió', op.tipo);
    return false;
  }
  if (!op.id) {
    console.warn('[openai-conversions] evento sin id estable, se omite', op.tipo);
    return false;
  }

  const evento: Record<string, unknown> = {
    id: op.id,
    type: op.tipo,
    timestamp_ms: Date.now(),
    source_url: op.sourceUrl || 'https://www.sacscloud.com/',
    action_source: 'web',
    data: {
      type: op.tipo === 'custom' ? 'custom' : 'customer_action',
      ...(typeof op.amount === 'number' ? { amount: op.amount } : {}),
      ...(op.currency ? { currency: op.currency } : {}),
    },
  };
  if (op.tipo === 'custom' && op.customEventName) {
    evento.custom_event_name = op.customEventName;
  }

  try {
    const res = await fetch(`${ENDPOINT}?pid=${PIXEL_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        validate_only: op.validateOnly === true,
        events: [evento],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('[openai-conversions] rechazado', res.status, detalle.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[openai-conversions] error de red', e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Dispara sin bloquear la respuesta al usuario.
 *
 * Medir NUNCA debe hacer esperar a quien acaba de reservar o registrarse: si
 * OpenAI tarda, el usuario no tiene por qué pagarlo con una pantalla congelada.
 */
export function medirConversionEnSegundoPlano(op: OpcionesEvento): void {
  void medirConversion(op).catch(() => { /* ya se logueó adentro */ });
}
