/**
 * El ciclo de vida de una prueba gratis, en un solo archivo.
 *
 * POR QUÉ EXISTE
 * La prueba se podía tocar desde cuatro lugares —la ficha del lead, el inbox,
 * el endpoint de alta y el cron de vencimientos— y cada uno escribía lo suyo.
 * El resultado medido antes de esto: 14 correos de onboarding cargados, una
 * etapa dedicada, un trigger que sella la fecha… y CERO leads en prueba. Las
 * piezas existían todas; ninguna estaba conectada con la siguiente.
 *
 * Aquí vive la única definición de qué significa iniciar, extender, terminar,
 * reactivar y convertir una prueba. Cada una hace SIEMPRE las mismas cuatro
 * cosas, y esa es la razón de ser del archivo:
 *
 *   1. mueve el estado en `contacts` (columnas, nunca `propiedades`),
 *   2. deja una ACTIVIDAD en la ficha —que es lo que pinta la línea de tiempo
 *      del inbox, así que el contexto queda en los dos lados con un solo write,
 *   3. avisa por la campana cuando alguien tiene que hacer algo,
 *   4. aplica o quita el aviso en la cuenta de SACS cuando corresponde.
 *
 * LO QUE NO HACE: mandar correos. De eso se encarga la cadencia «Prueba gratis
 * · 14 días», que se cuelga de `prueba_inicio`. Meter aquí un envío sería un
 * segundo emisor sobre la misma persona y ya sabemos cómo termina eso.
 */
import { supabase } from '../supabase';
import { notificar } from './notificaciones';

/** activa → terminada | convertida | cancelada. NULL = nunca tuvo prueba. */
export type EstadoPrueba = 'activa' | 'terminada' | 'convertida' | 'cancelada';

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
/* Los DOS nombres a propósito.
 *
 * En Vercel la variable se llama `REGISTER_API_SECRET` —así se llama también
 * del lado de la API de SACS, que es quien la valida— y este código buscaba
 * `SACS_REGISTER_SECRET`, que no existe en ningún entorno. Resultado: el alta
 * de pruebas devolvía 500 «Falta SACS_REGISTER_SECRET» en producción desde el
 * día uno, y por eso no hay ni una cuenta creada desde el CRM.
 *
 * No se renombra la de Vercel: la tiene puesta desde hace meses y renombrar
 * una variable de entorno para arreglar un typo es cambiar la infraestructura
 * para no tocar el código. Se leen las dos, con la específica primero. */
const SECRETO = (import.meta.env.SACS_REGISTER_SECRET || import.meta.env.REGISTER_API_SECRET || '').trim();

/** Los días de prueba por omisión. Es el largo de la cadencia de onboarding:
 *  si se cambia uno hay que cambiar el otro, o el correo del día 14 llega
 *  cuando la cuenta ya está bloqueada. */
export const DIAS_PRUEBA = 14;

export const WHATSAPP_VENTAS = '12058920417';

/** Días que faltan (negativo = ya venció). Null si no hay fecha de fin. */
export function diasRestantes(fin?: string | null): number | null {
  if (!fin) return null;
  return Math.ceil((Date.parse(fin) - Date.now()) / 86400000);
}

/**
 * Cómo se lee una prueba de un vistazo. Una sola función para que la ficha, la
 * lista y el inbox digan lo mismo — antes cada pantalla lo calculaba por su
 * cuenta y la ficha decía «quedan 2 días» mientras la lista decía «vencida».
 */
export function resumenPrueba(c: any) {
  const estado: EstadoPrueba | null = c?.prueba_estado || null;
  if (!estado && !c?.prueba_inicio) return null;
  const restan = diasRestantes(c?.prueba_fin);
  return {
    estado,
    cuenta: c?.prueba_cuenta || null,
    inicio: c?.prueba_inicio || null,
    fin: c?.prueba_fin || null,
    dias: c?.prueba_dias || null,
    restan,
    /* Vencida ≠ terminada. Vencida es que la FECHA pasó; terminada es que
       alguien (o el cron) ya lo asumió y bloqueó la cuenta. La ventana entre
       las dos es justo la que hay que ver en rojo. */
    vencida: estado === 'activa' && restan != null && restan < 0,
    urge: estado === 'activa' && restan != null && restan >= 0 && restan <= 3,
    bloqueada: !!c?.prueba_bloqueada_at,
  };
}

/** Un renglón en la línea de tiempo de la ficha — y por lo tanto en el inbox. */
async function actividad(c: any, tipo: string, titulo: string, metadata?: any, descripcion?: string) {
  await supabase.from('activities').insert({
    contact_id: c.id,
    company_id: c.company_id || null,
    tipo, titulo,
    descripcion: descripcion || null,
    automatico: !!metadata?.automatico,
    metadata: metadata || null,
  }).then(() => {}, (e: any) => console.error('[prueba] no se pudo dejar la actividad:', e?.message || e));
}

/**
 * Pone o quita el aviso de fin de prueba en la cuenta de SACS.
 *
 * Es el MISMO aviso que pone una persona desde sacs3 (título, mensaje, correo,
 * WhatsApp y link a planes salen de la config central `accountBlockConfig`), no
 * una pantalla paralela: si mañana se cambia el texto allá, este también cambia.
 *
 * Devuelve el detalle del fallo en vez de lanzar. Que el bloqueo falle NO debe
 * impedir que la prueba se marque como terminada en el CRM: son dos hechos
 * distintos y `prueba_bloqueada_at` los separa a propósito, para poder
 * reintentar el bloqueo sin volver a mover el estado.
 */
export async function avisoEnCuenta(cuenta: string, accion: 'bloquear' | 'desbloquear'): Promise<{ ok: boolean; error?: string }> {
  if (!SECRETO) return { ok: false, error: 'Falta el secreto de registro en el entorno' };
  if (!cuenta) return { ok: false, error: 'El contacto no tiene cuenta de SACS ligada.' };
  try {
    const r = await fetch(SACS_API + '/interno/prueba/bloqueo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-register-secret': SECRETO },
      body: JSON.stringify({ cuenta, accion }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok || !j?.success) return { ok: false, error: j?.msg || `HTTP ${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Los campos que toda pantalla necesita para pintar una prueba. */
export const CAMPOS_PRUEBA =
  'id, nombre, apellido, email, whatsapp, company_id, lifecycle_stage, prueba_inicio, prueba_fin, prueba_dias, prueba_estado, prueba_cuenta, prueba_bloqueada_at';

/**
 * Arranca la prueba en el CRM: fechas, etapa y estado.
 *
 * La etapa se mueve AQUÍ y no se deja a criterio de quien creó la cuenta. Ese
 * era el hueco exacto que dejaba el flujo anterior: se creaba la cuenta, el
 * lead se quedaba en «oportunidad», y como la cadencia se cuelga de la etapa,
 * el cliente no recibía ni un correo de onboarding. Nadie se enteraba porque
 * no falla nada: simplemente no pasa nada.
 *
 * `fin` se pasa explícito cuando viene de SACS: la cuenta ya grabó su fecha de
 * término y esa es la buena. Recalcularla aquí produciría dos fechas para la
 * misma prueba, con horas de diferencia.
 */
export async function iniciarPrueba(c: any, o: { cuenta: string; dias: number; fin?: string | null; quien?: string }) {
  const fin = o.fin || new Date(Date.now() + o.dias * 86400000).toISOString();
  await supabase.from('contacts').update({
    lifecycle_stage: 'prueba_gratis',
    prueba_inicio: new Date().toISOString(),
    prueba_fin: fin,
    prueba_dias: o.dias,
    prueba_estado: 'activa',
    prueba_cuenta: o.cuenta,
    prueba_bloqueada_at: null,
  }).eq('id', c.id);

  await actividad(c, 'prueba_iniciada', `Prueba gratis de ${o.dias} días · cuenta ${o.cuenta}`,
    { cuenta: o.cuenta, dias: o.dias, fin, quien: o.quien || null },
    `Termina el ${new Date(fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}. Entra a la cadencia de onboarding en la próxima corrida.`);

  return { fin };
}

/**
 * Le da más días. No reabre la cuenta si estaba bloqueada — eso lo hace
 * `reactivarPrueba`, y son cosas distintas: extender una prueba viva es un
 * trámite; revivir una bloqueada es una decisión comercial que alguien tomó.
 */
export async function extenderPrueba(c: any, dias: number, quien?: string) {
  const base = Math.max(Date.now(), Date.parse(c.prueba_fin || '') || Date.now());
  const fin = new Date(base + dias * 86400000).toISOString();
  await supabase.from('contacts').update({
    prueba_fin: fin,
    prueba_dias: (c.prueba_dias || DIAS_PRUEBA) + dias,
    prueba_estado: 'activa',
  }).eq('id', c.id);
  await actividad(c, 'prueba_extendida', `Prueba extendida ${dias} días`,
    { dias, fin, quien: quien || null },
    `Nueva fecha de término: ${new Date(fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.`);
  return { fin };
}

/**
 * La prueba terminó: se marca y se le pone el aviso a la cuenta.
 *
 * `motivo` distingue quién lo decidió, y no es cosmético: una prueba que venció
 * sola es una oportunidad de venta que se enfrió; una que se cerró a mano casi
 * siempre es que el cliente dijo que no. Mezclarlas hace que el reporte de
 * conversión mienta.
 */
export async function terminarPrueba(c: any, o: { motivo: 'vencio' | 'manual' | 'cancelada'; quien?: string; bloquear?: boolean }) {
  const estado: EstadoPrueba = o.motivo === 'cancelada' ? 'cancelada' : 'terminada';
  let bloqueo: { ok: boolean; error?: string } = { ok: false, error: 'no se intentó' };

  if (o.bloquear !== false && c.prueba_cuenta) {
    bloqueo = await avisoEnCuenta(c.prueba_cuenta, 'bloquear');
  }

  await supabase.from('contacts').update({
    prueba_estado: estado,
    prueba_bloqueada_at: bloqueo.ok ? new Date().toISOString() : null,
  }).eq('id', c.id);

  await actividad(c, 'prueba_terminada',
    o.motivo === 'vencio' ? 'La prueba gratis venció' : o.motivo === 'cancelada' ? 'Prueba cancelada' : 'Prueba cerrada a mano',
    { motivo: o.motivo, cuenta: c.prueba_cuenta, bloqueo: bloqueo.ok, error: bloqueo.error || null, quien: o.quien || null, automatico: o.motivo === 'vencio' },
    bloqueo.ok
      ? 'La cuenta ya muestra el aviso de fin de prueba, con el botón de WhatsApp para contratar.'
      : c.prueba_cuenta
        ? `No se pudo poner el aviso en la cuenta: ${bloqueo.error}. La cuenta sigue abierta.`
        : 'Sin cuenta de SACS ligada, así que no hay nada que bloquear.');

  /* La campana solo cuando hay algo que HACER. Una prueba que vence sin que
     nadie llame es la venta que se pierde más callada del embudo. */
  await notificar({
    clave: `prueba_fin:${c.id}`,
    tipo: 'prueba_terminada',
    nivel: 'alerta',
    titulo: `Se acabó la prueba de ${[c.nombre, c.apellido].filter(Boolean).join(' ').trim() || c.email || 'un lead'}`,
    detalle: bloqueo.ok
      ? 'La cuenta ya tiene el aviso de fin de prueba. Es el momento de llamar.'
      : 'Ojo: no se pudo poner el aviso en la cuenta, sigue abierta.',
    company_id: c.company_id || null,
    destino: 'leads',
    metadata: { contact_id: c.id, cuenta: c.prueba_cuenta, bloqueo: bloqueo.ok },
  });

  return { estado, bloqueo };
}

/** Le quita el aviso y la vuelve a abrir con días nuevos. */
export async function reactivarPrueba(c: any, dias: number, quien?: string) {
  const desbloqueo = c.prueba_cuenta ? await avisoEnCuenta(c.prueba_cuenta, 'desbloquear') : { ok: false, error: 'sin cuenta ligada' };
  const fin = new Date(Date.now() + dias * 86400000).toISOString();
  await supabase.from('contacts').update({
    prueba_fin: fin,
    prueba_dias: (c.prueba_dias || 0) + dias,
    prueba_estado: 'activa',
    prueba_bloqueada_at: null,
  }).eq('id', c.id);
  await actividad(c, 'prueba_reactivada', `Prueba reabierta ${dias} días más`,
    { dias, fin, desbloqueo: desbloqueo.ok, error: desbloqueo.error || null, quien: quien || null },
    desbloqueo.ok ? 'Ya se le quitó el aviso a la cuenta: puede volver a entrar.' : `La cuenta puede seguir bloqueada: ${desbloqueo.error}`);
  return { fin, desbloqueo };
}

/**
 * Compró. Se cierra la prueba como CONVERTIDA y se le quita el aviso a la
 * cuenta, que si no, el cliente que acaba de pagar se topa con la pantalla de
 * «tu prueba terminó» — la peor primera impresión posible después de un cobro.
 */
export async function convertirPrueba(c: any, quien?: string) {
  const desbloqueo = c.prueba_cuenta ? await avisoEnCuenta(c.prueba_cuenta, 'desbloquear') : { ok: true };
  await supabase.from('contacts').update({
    prueba_estado: 'convertida',
    prueba_bloqueada_at: null,
  }).eq('id', c.id);
  await actividad(c, 'prueba_convertida', 'La prueba se volvió cliente',
    { desbloqueo: desbloqueo.ok, quien: quien || null },
    desbloqueo.ok ? 'La cuenta quedó abierta y sin avisos.' : 'Revisa la cuenta: puede seguir con el aviso de fin de prueba.');
  return { desbloqueo };
}
