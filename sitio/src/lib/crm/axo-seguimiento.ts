// ══ Seguimiento automático por WhatsApp (plan «AXO Gratis: conversión», REQ-35, Aaron 26-oct-2026) ══
//
// Cada mañana, por cliente, se elige UN pendiente —el más importante— y se le escribe una sola vez al día.
// Reglas (C-01..C-12 del plan):
//   · máximo 1 mensaje automático al día por cliente (además, la presión de WhatsApp del CRM manda);
//   · prioridad: ticket/falla > paso del arranque > su negocio > su cuenta (la promo nunca va aquí);
//   · nunca a cuentas internas o de prueba, canceladas, sin WhatsApp o que pidieron baja;
//   · nunca en domingo; una sola acción por mensaje; nada técnico; ninguna cifra inventada.
// Aquí solo la decisión (pura, con pruebas). El envío y el registro viven en /api/cron/axo-seguimiento.

export type MotivoSeguimiento = 'soporte' | 'arranque' | 'riesgo' | 'renovacion';

export interface EmpresaSeguimiento {
  id: string;
  nombre: string;
  nombre_comercial?: string | null;
  estado_cuenta?: string | null;
  tipo_cuenta?: string | null;
  fecha_inicio?: string | null;
  created_at?: string | null;
  fecha_renovacion?: string | null;
  soporte_abiertos?: number | null;
  soporte_estancado?: boolean | null;
  dias_sin_venta?: number | null;
  propiedades?: Record<string, any> | null;
}

export interface Pendiente {
  motivo: MotivoSeguimiento;
  /** Tema corto para la plantilla «quedamos pendientes del tema de {{2}}». */
  tema: string;
  /** Texto libre (dentro de la ventana de 24 h). */
  texto: string;
}

/** Lo que el arranque le pide cada día (día 1 = el de alta). */
export const ARRANQUE_POR_DIA = [
  { tema: 'subir tus productos a SACS', texto: 'mándame el Excel de tu sistema anterior tal como sale (o fotos de tus productos) y yo los subo.' },
  { tema: 'dejar tu punto de venta cobrando', texto: '¿cuántas sucursales y cajas tienes? Con eso te dejo cobrando hoy.' },
  { tema: 'tu página web en SACS', texto: '¿me pasas tu Instagram? Tomo tu logo y tus colores y te propongo el diseño de tu tienda en línea.' },
  { tema: 'invitar a tu equipo', texto: 'dime el nombre y el puesto de cada persona de tu equipo y les dejo sus permisos.' },
  { tema: 'tus clientes e inventario inicial', texto: 'si tienes un Excel de clientes o de existencias, mándamelo y lo cargo.' },
  { tema: 'tus pagos en línea y envíos', texto: '¿con qué cobras hoy en línea y cómo envías? Te ayudo a dejarlo listo.' },
  { tema: 'tu primer resumen en SACS', texto: 'ya puedo mandarte cada mañana lo importante de tu negocio por aquí. ¿Te lo activo?' },
] as const;

const DIA_MS = 86_400_000;

function dias(desde: string | null | undefined, ahora: number): number | null {
  if (!desde) return null;
  const t = Date.parse(desde.length === 10 ? `${desde}T12:00:00Z` : desde);
  return Number.isFinite(t) ? Math.floor((ahora - t) / DIA_MS) : null;
}

export function nombreCorto(e: EmpresaSeguimiento): string {
  return (e.nombre_comercial || e.nombre || '').trim();
}

/** ¿Se le puede escribir hoy a esta empresa? (sin mirar el WhatsApp: eso lo decide el cron con el contacto). */
export function excluida(e: EmpresaSeguimiento): string | null {
  const tipo = (e.tipo_cuenta || '').toLowerCase();
  if (tipo === 'interna' || tipo === 'prueba') return 'cuenta interna o de prueba';
  const est = (e.estado_cuenta || '').toLowerCase();
  const vitalicia = (e.propiedades?.plan_modalidad || '') === 'vitalicio';
  if (est === 'cancelado' || est === 'pausado') return 'cuenta cancelada';
  if (est === 'vencido' && !vitalicia) return 'cuenta vencida';
  if (est === 'prospecto') return 'prospecto (lo lleva ventas)';
  return null;
}

/** El pendiente más importante de hoy, o `null` si no hay nada que decirle. */
export function pendienteDeHoy(e: EmpresaSeguimiento, ahora: number): Pendiente | null {
  if (excluida(e)) return null;
  // 1) Soporte estancado: lo primero, y nunca va con promoción.
  if ((e.soporte_abiertos || 0) > 0 && e.soporte_estancado) {
    return { motivo: 'soporte', tema: 'tu solicitud de soporte', texto: 'sigo pendiente de tu solicitud de soporte. ¿Ya quedó resuelto o lo vemos ahora?' };
  }
  // 2) Arranque: prueba gratis o primeros 30 días.
  // Desde el INICIO del contrato (no desde la alta en el CRM: una cuenta vieja dada de alta hoy no está arrancando).
  const d = dias(e.fecha_inicio, ahora);
  const enArranque = (e.estado_cuenta || '').toLowerCase() === 'trial' || (d !== null && d < 30);
  if (enArranque && d !== null && d >= 0) {
    const paso = ARRANQUE_POR_DIA[Math.min(d, ARRANQUE_POR_DIA.length - 1)];
    // Después del día 7 solo cada 3 días, para no cansar.
    if (d < ARRANQUE_POR_DIA.length || d % 3 === 0) {
      return { motivo: 'arranque', tema: paso.tema, texto: paso.texto };
    }
  }
  // 3) Su negocio: dejó de vender en SACS (en riesgo). Sin promo.
  // El dato de días sin venta puede venir solo del sistema anterior: el mensaje NO afirma la cifra.
  if ((e.dias_sin_venta || 0) >= 21 && (e.estado_cuenta || '').toLowerCase() === 'activo') {
    return { motivo: 'riesgo', tema: 'cómo te va con SACS', texto: '¿cómo te va con SACS? Si algo te está deteniendo, dime y lo resolvemos juntos.' };
  }
  // 4) Su cuenta: renovación en los próximos 7 días.
  const r = dias(e.fecha_renovacion, ahora);
  if (r !== null && r <= 0 && r >= -7) {
    return { motivo: 'renovacion', tema: 'la renovación de tu plan', texto: 'tu plan de SACS se renueva en unos días. ¿Quieres revisar algo antes?' };
  }
  return null;
}

/** El mensaje completo, con el saludo. */
export function mensajeLibre(nombrePersona: string | null | undefined, p: Pendiente): string {
  const n = (nombrePersona || '').trim().split(/\s+/)[0];
  const i = p.texto.startsWith('¿') ? 1 : 0;
  const cuerpo = p.texto.slice(0, i) + p.texto.charAt(i).toUpperCase() + p.texto.slice(i + 1);
  return `Hola${n ? ` ${n}` : ''}, soy AXO de SACS. ${cuerpo}`;
}

/** ¿Es domingo en CDMX? */
export function esDomingoMx(ahora: number): boolean {
  return new Date(ahora - 6 * 3600e3).getUTCDay() === 0;
}
