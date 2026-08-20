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
] as const;

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
  };
}
