// OUTBOUND · Catálogos cerrados del módulo de campañas in-app.
//
// Todo lo que una campaña puede "hacer" dentro de SACS3 sale de aquí, y solo
// de aquí. La lección es de sacs-alert (eliminado 2026-07-30): un aviso que
// podía redirigir a cualquier URL o escribir nodos arbitrarios era una vía de
// ataque. Por eso las acciones de botón son de LISTA BLANCA y los destinos de
// módulo se validan contra los `case` reales del router de dashboard-list.
import { MODULOS_SACS } from '../crm/modulos-sacs';

export const FORMATOS = [
  { id: 'banner_superior', etiqueta: 'Banner superior', desc: 'Barra arriba del módulo', interruptivo: true },
  { id: 'banner_cuadrado', etiqueta: 'Banner cuadrado', desc: 'Tarjeta flotante abajo-derecha', interruptivo: true },
  { id: 'modal', etiqueta: 'Modal', desc: 'Centrado, cerrable o bloqueante', interruptivo: true },
  { id: 'chat', etiqueta: 'Abrir chat', desc: 'Intercom con mensaje precargado', interruptivo: true },
  { id: 'tarjeta_inicio', etiqueta: 'Tarjeta en inicio', desc: 'Slot nativo del dashboard', interruptivo: false },
  { id: 'badge_menu', etiqueta: 'Badge en menú', desc: '"NUEVO" junto a un módulo', interruptivo: false },
  { id: 'encuesta', etiqueta: 'Encuesta 1 clic', desc: 'NPS / CSAT con un tap', interruptivo: true },
  { id: 'coachmark', etiqueta: 'Coachmark', desc: 'Al entrar a un módulo', interruptivo: true },
  { id: 'agenda', etiqueta: 'Agendar cita', desc: 'Modal con el calendario para reservar', interruptivo: true },
  { id: 'compra', etiqueta: 'Comprar / upgrade', desc: 'Modal con precio personalizado y pago', interruptivo: true },
] as const;

// Host FIJO del agendador embebible. La campaña solo elige el SLUG de un tipo
// de reunión del catálogo real (event_types) — sin URL configurable no hay
// vector de redirección, que es la razón por la que el iframe puede ir sin
// sandbox (el flujo de reserva necesita scripts y forms, y es first-party).
export const AGENDA_EMBED_BASE = 'https://www.sacscloud.com/agendar/embed/';
export const slugAgendaValido = (s: string) => /^[a-z0-9-]{1,60}$/.test(String(s || ''));

// Destinos de "Ir a módulo": el `destino` es el primer segmento de la ruta de
// sacs3 (/lavidaesparadisfrutar/<cuenta>/<destino>) — nombres EXACTOS de los
// `case` del router en src/views/dashboard/list.html. Uno inventado no da
// error: da una pantalla en blanco, así que la validación es contra esta lista.
export const DESTINOS_MODULO = [
  { id: 'dashboard', etiqueta: 'Inicio (dashboard)' },
  { id: 'puntodeventa', etiqueta: 'Punto de venta' },
  { id: 'articulos', etiqueta: 'Catálogo de productos' },
  { id: 'clientes', etiqueta: 'Catálogo de clientes' },
  { id: 'apartados', etiqueta: 'Apartados' },
  { id: 'pedidos', etiqueta: 'Pedidos / eCommerce' },
  { id: 'cotizaciones', etiqueta: 'Cotizaciones' },
  { id: 'lealtad', etiqueta: 'Programa de lealtad' },
  { id: 'promociones', etiqueta: 'Promociones' },
  { id: 'ordencompra', etiqueta: 'Órdenes de compra' },
  { id: 'recepcion', etiqueta: 'Recepción de mercancía' },
  { id: 'solicitudmercancia', etiqueta: 'Solicitud de mercancía' },
  { id: 'gastos', etiqueta: 'Gastos' },
  { id: 'cuentasefectivo', etiqueta: 'Cuentas de efectivo y bancos' },
  { id: 'reporteventas', etiqueta: 'Reporte de ventas' },
  { id: 'integraciones', etiqueta: 'Integraciones' },
  { id: 'proveedores', etiqueta: 'Proveedores' },
  { id: 'eventos', etiqueta: 'Eventos y salones' },
  { id: 'reparaciones', etiqueta: 'Reparaciones / taller' },
] as const;

// Acciones de botón — la lista blanca completa. `destino` según el tipo:
//   modulo → id de DESTINOS_MODULO · url_sacs → URL https de *.sacscloud.com
//   chat → texto precargado (opcional) · whatsapp_ventas y cerrar → sin destino
export const ACCIONES_BOTON = [
  { id: 'modulo', etiqueta: 'Ir a módulo' },
  { id: 'url_sacs', etiqueta: 'Abrir URL de sacscloud.com' },
  { id: 'chat', etiqueta: 'Abrir chat' },
  { id: 'whatsapp_ventas', etiqueta: 'WhatsApp de ventas' },
  { id: 'cerrar', etiqueta: 'Cerrar el mensaje' },
] as const;

export function urlSacsValida(u: string): boolean {
  try {
    const url = new URL(String(u || ''));
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'sacscloud.com' || url.hostname.endsWith('.sacscloud.com');
  } catch { return false; }
}

// Metas verificables — lo que el cron puede COMPROBAR contra los datos del
// puente, no promesas. `valor` según tipo: uso_modulo → nombre EXACTO del
// catálogo de módulos del puente; plugin_activo → slug del plugin; plan → slug.
export const METAS = [
  { id: 'uso_modulo', etiqueta: 'Usó el módulo…', necesita: 'modulo' },
  { id: 'plugin_activo', etiqueta: 'Activó el plugin…', necesita: 'texto' },
  { id: 'plan', etiqueta: 'Subió al plan…', necesita: 'texto' },
  { id: 'cita_agendada', etiqueta: 'Agendó una cita', necesita: null },
  { id: 'clic', etiqueta: 'Dio clic (sin meta de negocio)', necesita: null },
] as const;

export const MODULOS_PUENTE = MODULOS_SACS.filter(f =>
  ['Ventas', 'Inventario', 'Clientes', 'Administración'].includes(f.familia)
).flatMap(f => f.modulos);

// Audiencia — DSL propio del Outbound. Mismo espíritu que el de email
// (grupos = O entre ellos, condiciones = Y dentro), pero el sujeto resuelve a
// EMPRESAS con cuenta SACS, no a contactos con correo. La resolución es en JS
// sobre las ~centenas de companies (ver motor.ts) — el mismo trade-off
// documentado en email/segmentos.ts.
export interface CondicionUso {
  campo: string;
  operador: 'es' | 'no_es' | 'mayor_que' | 'menor_que' | 'existe' | 'no_existe';
  valor?: string | number | null;
}
export interface AudienciaDef {
  grupos: Array<{ condiciones: CondicionUso[] }>;
  excluir_cuentas?: string[];
  incluir_cuentas?: string[];   // adiciones manuales (beta testers, pilotos)
  // Supresión por soporte: por defecto se OMITE a la empresa con una queja
  // abierta (ticket estancado o de sentimiento urgente/negativo) — no es momento
  // de venderle. Ponlo en false para campañas que SÍ deben llegar (p.ej. la CSAT
  // post-soporte, o un aviso operativo crítico).
  excluir_con_ticket_abierto?: boolean;
}

export const CATALOGO_AUDIENCIA: Array<{ id: string; etiqueta: string; tipo: 'opciones' | 'numero' | 'texto' | 'modulo'; operadores: CondicionUso['operador'][]; opciones?: Array<{ v: string; l: string }> }> = [
  { id: 'plan', etiqueta: 'Plan contratado', tipo: 'opciones', operadores: ['es', 'no_es'], opciones: [
    { v: 'vende', l: 'Vende' }, { v: 'controla', l: 'Controla' }, { v: 'fideliza', l: 'Fideliza' },
    { v: 'automatiza', l: 'Automatiza' }, { v: 'personalizada', l: 'Personalizada' }] },
  { id: 'estado_cuenta', etiqueta: 'Estado de la cuenta', tipo: 'opciones', operadores: ['es', 'no_es'], opciones: [
    { v: 'activo', l: 'Activo' }, { v: 'trial', l: 'Trial' }, { v: 'vencido', l: 'Vencido' }] },
  { id: 'dias_sin_venta', etiqueta: 'Días sin venta', tipo: 'numero', operadores: ['mayor_que', 'menor_que'] },
  { id: 'usa_modulo', etiqueta: 'Usa el módulo…', tipo: 'modulo', operadores: ['es', 'no_es'] },
  { id: 'tiene_plugin', etiqueta: 'Tiene el plugin…', tipo: 'texto', operadores: ['es', 'no_es'] },
  { id: 'interes_modulo', etiqueta: 'Mostró interés en…', tipo: 'modulo', operadores: ['es'] },
  { id: 'giro', etiqueta: 'Giro', tipo: 'texto', operadores: ['es'] },
  { id: 'meses_activo', etiqueta: 'Meses como cliente', tipo: 'numero', operadores: ['mayor_que', 'menor_que'] },
  { id: 'renovacion_proxima_dias', etiqueta: 'Renovación en los próximos (días)', tipo: 'numero', operadores: ['menor_que'] },
];

export const GRUPO_SUPER_ADMIN = '-LaRW9St-VNoA6rL27Cs';

// ── Formatos de encuesta (estándares de la industria) ────────────────────────
// Cada escala define cómo se pinta y qué rango de `valor` produce (0 = no
// numérica → usa `respuesta`). `promotorDesde`/`detractorHasta` marcan los
// cortes de sentimiento para el seguimiento condicional y el color.
export const ESCALAS_ENCUESTA = [
  { id: 'nps', etiqueta: 'NPS (0-10)', desc: '¿Qué tan probable es que nos recomiendes?', min: 0, max: 10, detractorHasta: 6, promotorDesde: 9, pie: ['Nada probable', 'Muy probable'] },
  { id: 'ces', etiqueta: 'CES · Esfuerzo (1-7)', desc: 'Qué tan fácil fue — predice retención mejor que CSAT', min: 1, max: 7, detractorHasta: 3, promotorDesde: 6, pie: ['Muy difícil', 'Muy fácil'] },
  { id: '1_5', etiqueta: 'CSAT (1-5)', desc: 'Satisfacción clásica', min: 1, max: 5, detractorHasta: 2, promotorDesde: 5, pie: ['Muy malo', 'Excelente'] },
  { id: 'csat_emoji', etiqueta: 'CSAT con caras', desc: 'Cinco caras — más respuestas en móvil', min: 1, max: 5, detractorHasta: 2, promotorDesde: 5, emojis: ['😞', '😕', '😐', '🙂', '😀'] },
  { id: 'estrellas', etiqueta: 'Estrellas (1-5)', desc: 'Calificar una función puntual', min: 1, max: 5, detractorHasta: 2, promotorDesde: 5 },
  { id: 'pulgar', etiqueta: 'Pulgar arriba / abajo', desc: 'Feedback binario de 1 tap', min: 0, max: 1, detractorHasta: 0, promotorDesde: 1, opciones: [{ v: '0', l: 'No' }, { v: '1', l: 'Sí' }] },
  { id: 'opcion', etiqueta: 'Opción múltiple', desc: 'Una respuesta de una lista', min: 0, max: 0 },
] as const;

// Drivers estándar de CX: convierten el "¿por qué?" de texto libre en dato
// cuantificable. El operador puede editar la lista por campaña.
export const DRIVERS_DEFAULT = ['Soporte', 'Precio', 'Facilidad de uso', 'Funciones', 'Estabilidad', 'Capacitación'];

// Cortes de sentimiento POR ESCALA (no hardcodear los de NPS): un 5 de CSAT es
// promotor, no detractor. `esNps` marca cuáles admiten el score estilo NPS.
export function cortesEscala(escala?: string | null): { det: number; prom: number; esNps: boolean } {
  const e = ESCALAS_ENCUESTA.find(x => x.id === escala);
  if (!e || e.min === e.max) return { det: -1, prom: 999, esNps: false }; // opción/desconocida: sin score
  return { det: (e as any).detractorHasta, prom: (e as any).promotorDesde, esNps: escala === 'nps' };
}

// ── Plantillas de 1 clic ─────────────────────────────────────────────────────
// Recetas destiladas de los casos de uso: elegir una precarga el editor
// completo (audiencia, formato, meta, frecuencia y textos sugeridos). El
// usuario solo ajusta el texto. `valores` es el estado inicial del editor.
const F_DEF = { tipo: 'hasta_interactuar', tope: 5, descanso_dias: 3 };
export const PLANTILLAS: Array<{ id: string; nombre: string; desc: string; fam: string; valores: any }> = [
  { id: 'lanzamiento_modulo', nombre: 'Lanzamiento de módulo', fam: 'Adopción',
    desc: 'Modal a dueños de cuentas que tienen el módulo en su plan y no lo usan.',
    valores: { formato: 'modal', objetivo_texto: 'Adopción del módulo', modo: 'unica', prioridad: 'normal', holdout_pct: 10,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'estado_cuenta', operador: 'es', valor: 'activo' }, { campo: 'usa_modulo', operador: 'no_es', valor: '' }] }] },
      meta: { tipo: 'uso_modulo', valor: '' },
      comportamiento: { trigger: 'al_iniciar', frecuencia: F_DEF, cerrable: true } } },
  { id: 'upsell_plugin', nombre: 'Venta de plugin', fam: 'Adopción',
    desc: 'Banner cuadrado a cuentas que NO tienen el plugin; meta: que lo activen.',
    valores: { formato: 'banner_cuadrado', objetivo_texto: 'Venta de plugin', modo: 'unica', prioridad: 'normal', holdout_pct: 10,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'tiene_plugin', operador: 'no_es', valor: '' }, { campo: 'estado_cuenta', operador: 'es', valor: 'activo' }] }] },
      meta: { tipo: 'plugin_activo', valor: '' },
      comportamiento: { trigger: 'al_iniciar', frecuencia: F_DEF, cerrable: true } } },
  { id: 'rescate_inactivos', nombre: 'Rescate de inactivos', fam: 'Retención',
    desc: 'Campaña CONTINUA a cuentas con 15+ días sin ventas; quien empiece a calificar va entrando.',
    valores: { formato: 'banner_cuadrado', objetivo_texto: 'Rescate de cuentas inactivas', modo: 'continua', reentrada_dias: 30, prioridad: 'alta', holdout_pct: 10,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'dias_sin_venta', operador: 'mayor_que', valor: 15 }, { campo: 'estado_cuenta', operador: 'es', valor: 'activo' }] }] },
      meta: null,
      comportamiento: { trigger: 'al_iniciar', frecuencia: F_DEF, cerrable: true } } },
  { id: 'nps_trimestral', nombre: 'NPS trimestral', fam: 'Medición',
    desc: 'Encuesta 0-10 con comentario a dueños con 6+ meses; se repite sola cada 90 días.',
    valores: { formato: 'encuesta', objetivo_texto: 'Medición NPS', modo: 'continua', reentrada_dias: null, prioridad: 'baja', holdout_pct: 0, recurrencia_dias: 90,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'meses_activo', operador: 'mayor_que', valor: 6 }] }] },
      meta: null, contenido: { titulo: '¿Qué tan probable es que recomiendes SACS a otro negocio?', encuesta: { escala: 'nps' }, botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: '1_vez', tope: 1, descanso_dias: 0 }, cerrable: true } } },
  { id: 'csat_modulo', nombre: 'CSAT de un módulo', fam: 'Medición',
    desc: 'Encuesta 1-5 al entrar a un módulo que empezaron a usar hace poco.',
    valores: { formato: 'encuesta', objetivo_texto: 'CSAT de módulo', modo: 'unica', prioridad: 'baja', holdout_pct: 0,
      nivel: { tipo: 'todos' },
      audiencia: { grupos: [{ condiciones: [{ campo: 'usa_modulo', operador: 'es', valor: '' }] }] },
      meta: null, contenido: { titulo: '¿Qué tal va este módulo?', encuesta: { escala: '1_5' }, botones: [] },
      comportamiento: { trigger: 'al_entrar_modulo', modulo_ancla: '', frecuencia: { tipo: '1_vez', tope: 1, descanso_dias: 0 }, cerrable: true } } },
  { id: 'aviso_mantenimiento', nombre: 'Aviso de mantenimiento', fam: 'Operativo',
    desc: 'Banner superior a TODAS las cuentas con vigencia exacta. Sin botones, sin meta.',
    valores: { formato: 'banner_superior', objetivo_texto: 'Informativo', modo: 'unica', prioridad: 'critica', holdout_pct: 0,
      // Un aviso operativo NO es una venta: debe llegar también a quien tiene una
      // queja abierta (justo los más afectados por una caída).
      nivel: { tipo: 'todos' }, audiencia: { grupos: [], excluir_con_ticket_abierto: false }, meta: null,
      contenido: { botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: 'tope', tope: 99, descanso_dias: 0 }, cerrable: true } } },
  { id: 'upgrade_cita', nombre: 'Upgrade con cita', fam: 'Adopción',
    desc: 'Calendario en modal para agendar 15 min con quien califica a un plan superior.',
    valores: { formato: 'agenda', objetivo_texto: 'Upgrade de plan', modo: 'unica', prioridad: 'normal', holdout_pct: 10,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'plan', operador: 'es', valor: 'vende' }, { campo: 'estado_cuenta', operador: 'es', valor: 'activo' }] }] },
      meta: { tipo: 'cita_agendada', valor: '' }, contenido: { titulo: 'Agenda 15 minutos con nosotros', agenda_slug: 'seguimiento', botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: F_DEF, cerrable: true } } },
  { id: 'badge_lanzamiento', nombre: 'Badge NUEVO en menú', fam: 'Adopción',
    desc: 'Chip persistente que lleva al módulo recién liberado; el clic queda como interés.',
    valores: { formato: 'badge_menu', objetivo_texto: 'Primer uso del módulo', modo: 'unica', prioridad: 'baja', holdout_pct: 0, guardar_campana: true,
      nivel: { tipo: 'todos' }, audiencia: { grupos: [] }, meta: { tipo: 'uso_modulo', valor: '' },
      contenido: { botones: [] },
      comportamiento: { trigger: 'al_iniciar', modulo_ancla: '', frecuencia: { tipo: 'hasta_interactuar', tope: 99, descanso_dias: 0 } } } },
  { id: 'tarjeta_upgrade', nombre: 'Tarjeta en inicio (upgrade)', fam: 'Adopción',
    desc: 'Card nativa en el dashboard, sin interrumpir; meta: subió de plan.',
    valores: { formato: 'tarjeta_inicio', objetivo_texto: 'Upgrade de plan', modo: 'unica', prioridad: 'normal', holdout_pct: 10,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'estado_cuenta', operador: 'es', valor: 'activo' }] }] },
      meta: { tipo: 'plan', valor: '' },
      comportamiento: { trigger: 'al_iniciar', frecuencia: F_DEF, cerrable: true } } },
  { id: 'coachmark_plugin', nombre: 'Coachmark de plugin sin uso', fam: 'Adopción',
    desc: 'Al entrar al módulo: guía a cuentas que activaron el plugin y no lo usan.',
    valores: { formato: 'coachmark', objetivo_texto: 'Activación de plugin', modo: 'continua', reentrada_dias: 30, prioridad: 'normal', holdout_pct: 0,
      nivel: { tipo: 'todos' },
      audiencia: { grupos: [{ condiciones: [{ campo: 'tiene_plugin', operador: 'es', valor: '' }, { campo: 'usa_modulo', operador: 'no_es', valor: '' }] }] },
      meta: { tipo: 'uso_modulo', valor: '' },
      comportamiento: { trigger: 'al_entrar_modulo', modulo_ancla: '', frecuencia: F_DEF, cerrable: true } } },
  { id: 'renovacion', nombre: 'Renovación próxima', fam: 'Retención',
    desc: 'Banner CONTINUO a cuentas con renovación en 15 días; se guarda también en la campana.',
    valores: { formato: 'banner_superior', objetivo_texto: 'Renovación', modo: 'continua', reentrada_dias: 180, prioridad: 'alta', holdout_pct: 0, guardar_campana: true,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'renovacion_proxima_dias', operador: 'menor_que', valor: 15 }] }] },
      meta: null,
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: 'tope', tope: 15, descanso_dias: 1 }, cerrable: true } } },
  { id: 'pedir_resena', nombre: 'Pedir reseña a promotores', fam: 'Medición',
    desc: 'Tarjeta en inicio a quienes calificaron 9-10 en el NPS (interés "Promotor NPS").',
    valores: { formato: 'tarjeta_inicio', objetivo_texto: 'Reseñas y testimonios', modo: 'continua', reentrada_dias: 180, prioridad: 'baja', holdout_pct: 0,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'interes_modulo', operador: 'es', valor: 'Promotor NPS' }] }] },
      meta: null, contenido: { titulo: 'Nos diste un 9 o 10 — ¿nos regalas una reseña?', mensaje: 'Nos ayudaría muchísimo que compartas tu experiencia con SACS. Toma 2 minutos.', botones: [{ texto: 'Dejar mi reseña', accion: 'url_sacs', destino: 'https://www.sacscloud.com/resenas' }] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: 'hasta_interactuar', tope: 4, descanso_dias: 5 }, cerrable: true } } },
  { id: 'chat_cs', nombre: 'CS proactivo por chat', fam: 'Retención',
    desc: 'Abre Intercom con mensaje precargado a cuentas con 30+ días sin ventas.',
    valores: { formato: 'chat', objetivo_texto: 'Contacto proactivo de CS', modo: 'continua', reentrada_dias: 60, prioridad: 'alta', holdout_pct: 0,
      nivel: { tipo: 'grupos', grupos: [GRUPO_SUPER_ADMIN] },
      audiencia: { grupos: [{ condiciones: [{ campo: 'dias_sin_venta', operador: 'mayor_que', valor: 30 }] }] },
      meta: null, contenido: { titulo: 'CS proactivo', mensaje: 'Hola, vimos que llevas unos días sin registrar ventas. ¿Te ayudamos con algo?', botones: [] },
      comportamiento: { trigger: 'al_iniciar', frecuencia: { tipo: '1_vez', tope: 1, descanso_dias: 0 } } } },
];

export function catalogoCompleto() {
  return {
    formatos: FORMATOS,
    destinos_modulo: DESTINOS_MODULO,
    acciones_boton: ACCIONES_BOTON,
    metas: METAS,
    modulos_puente: MODULOS_PUENTE,
    audiencia: CATALOGO_AUDIENCIA,
    grupo_super_admin: GRUPO_SUPER_ADMIN,
    prioridades: ['baja', 'normal', 'alta', 'critica'],
    frecuencias: [
      { id: '1_vez', etiqueta: '1 sola vez' },
      { id: 'hasta_interactuar', etiqueta: 'Hasta que interactúe' },
      { id: 'tope', etiqueta: 'Máximo N veces' },
    ],
    triggers: [
      { id: 'al_iniciar', etiqueta: 'Al entrar a SACS' },
      { id: 'al_entrar_modulo', etiqueta: 'Al entrar a un módulo' },
    ],
    plantillas: PLANTILLAS,
    escalas_encuesta: ESCALAS_ENCUESTA,
    drivers_default: DRIVERS_DEFAULT,
  };
}
