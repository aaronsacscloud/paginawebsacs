// WHATSAPP · Errores de Kapso y de Meta, explicados en español y ACCIONABLES.
//
// Dos formas llegan al sistema:
//  a) Kapso (capa propia):   { error: "Cannot send non-template…", next_steps: "Send a template…" }  (HTTP 422/401/404)
//  b) Meta (passthrough):    { error: { code: 131047, message: "(#131047) …", error_data: { details }, error_subcode } }
//  c) Estado failed por webhook: kapso.statuses[].errors[] = { code, title, message, error_data, href }
//
// `explicarError()` recibe cualquiera de las tres y devuelve SIEMPRE un título
// corto, qué pasó y qué hacer. El crudo se conserva para soporte. Nada de
// "Kapso HTTP 400: {…}" en pantalla.
export type ErrorLegible = {
  codigo: string | null;
  titulo: string;        // 2-6 palabras, va en rojo bajo la burbuja / en el toast
  que_paso: string;      // una frase
  que_hacer: string;     // la acción concreta
  tipo: 'ventana' | 'plantilla' | 'numero' | 'media' | 'limite' | 'cuenta' | 'permiso' | 'red' | 'otro';
  reintentable: boolean; // ¿tiene sentido el botón "Reintentar" sin cambiar nada?
  crudo: string;
};

type Def = Omit<ErrorLegible, 'codigo' | 'crudo'>;
const D = (titulo: string, que_paso: string, que_hacer: string, tipo: ErrorLegible['tipo'], reintentable = false): Def => ({ titulo, que_paso, que_hacer, tipo, reintentable });

// Códigos de la Cloud API de Meta (developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
export const META: Record<string, Def> = {
  // Ventana / plantillas
  '131047': D('Ventana de 24 h cerrada', 'Pasaron más de 24 horas desde el último mensaje del cliente y Meta solo permite plantillas.', 'Envía una plantilla aprobada; cuando el cliente conteste se reabre el chat libre.', 'ventana'),
  '131051': D('Tipo de mensaje no soportado', 'El cliente mandó algo que WhatsApp no entrega a la API (p. ej. encuesta o mensaje efímero).', 'Pídele que lo mande como texto, foto o documento.', 'otro'),
  '132000': D('Parámetros de plantilla incorrectos', 'El número de variables que mandaste no coincide con el de la plantilla aprobada.', 'Revisa cuántas {{n}} tiene la plantilla y manda exactamente esas.', 'plantilla'),
  '132001': D('La plantilla no existe', 'No hay una plantilla con ese nombre e idioma en la cuenta de WhatsApp Business.', 'Verifica nombre e idioma (p. ej. es_MX) en Plantillas; si es nueva, espera a que Meta la apruebe.', 'plantilla'),
  '132005': D('Texto de plantilla demasiado largo', 'Alguna variable hace que el mensaje pase el límite de caracteres.', 'Acorta el valor de las variables.', 'plantilla'),
  '132007': D('Formato de plantilla rechazado', 'El contenido viola las políticas de formato de Meta (saltos, espacios o caracteres no permitidos en variables).', 'Quita saltos de línea y espacios dobles de las variables.', 'plantilla'),
  '132012': D('Variables no coinciden con la plantilla', 'El tipo o el formato de un parámetro no es el que espera la plantilla (texto, imagen, documento…).', 'Revisa el encabezado: si la plantilla lleva imagen, manda una URL de imagen válida.', 'plantilla'),
  '132015': D('Plantilla pausada', 'Meta pausó la plantilla por baja calidad (muchos bloqueos o reportes).', 'Usa otra plantilla o crea una versión nueva con mejor redacción.', 'plantilla'),
  '132016': D('Plantilla deshabilitada', 'Meta deshabilitó la plantilla de forma permanente.', 'Crea una plantilla nueva.', 'plantilla'),
  '132068': D('Flow bloqueado', 'El flow de esta plantilla está bloqueado.', 'Revisa el flow en Meta y vuelve a publicarlo.', 'plantilla'),
  '132069': D('Flow limitado', 'El flow está en estado "throttled".', 'Espera o corrige los errores del flow que reporta Meta.', 'plantilla'),
  // Número del cliente
  '131026': D('Número no alcanzable', 'El número no tiene WhatsApp, bloqueó al negocio, o su app es muy antigua.', 'Confirma el número con el cliente o contáctalo por otro canal (correo o llamada).', 'numero'),
  '131030': D('Número no permitido en pruebas', 'La cuenta está en modo sandbox y ese número no está en la lista de prueba.', 'Agrega el número a la lista de prueba en Meta o termina la verificación del negocio.', 'cuenta'),
  '131031': D('Cuenta bloqueada por Meta', 'Meta restringió la cuenta de WhatsApp Business (violación de políticas o integridad).', 'Revisa el estado de la cuenta en Meta Business Manager y apela si procede.', 'cuenta'),
  '131037': D('Display name sin aprobar', 'El nombre visible del número todavía no está aprobado por Meta.', 'Espera la aprobación del display name en Meta Business Manager.', 'cuenta'),
  '131042': D('Problema de pago en Meta', 'No hay método de pago válido o la línea de crédito está vencida en la cuenta de WhatsApp Business.', 'Corrige el método de pago en Meta Business Manager → Facturación.', 'cuenta'),
  '131045': D('Certificado del número pendiente', 'El número no terminó el registro (certificado/verificación).', 'Completa el registro del número desde Kapso o Meta.', 'cuenta'),
  '131048': D('Límite de spam alcanzado', 'Meta frenó los envíos de este número por demasiados mensajes reportados como spam.', 'Reduce el volumen, mejora la redacción y espera a que baje la restricción.', 'limite'),
  '131049': D('Meta limitó el marketing a este número', 'Meta decidió no entregar más mensajes de marketing a este cliente por ahora (experimento de engagement).', 'Escríbele solo si él inicia la conversación, o usa una plantilla de utilidad, no de marketing.', 'limite'),
  '131050': D('El cliente pidió no recibir marketing', 'El cliente eligió "dejar de recibir" mensajes de marketing de este negocio.', 'Respétalo: solo plantillas de utilidad/servicio o responder cuando él escriba.', 'permiso'),
  '131052': D('No se pudo descargar la media', 'WhatsApp no pudo bajar el archivo desde la URL que mandamos.', 'Asegúrate de que la URL sea pública, https y con el tipo de archivo correcto.', 'media', true),
  '131053': D('Archivo no válido para WhatsApp', 'El archivo excede el tamaño o no es un formato que WhatsApp acepte.', 'Imagen ≤5 MB (jpg/png), video ≤16 MB (mp4), audio ≤16 MB, documento ≤100 MB.', 'media'),
  '131056': D('Demasiados mensajes a este número', 'Meta frena el envío por "pair rate limit": mandaste muchos mensajes a esta persona en poco tiempo.', 'Espera unos minutos antes de volver a escribirle.', 'limite', true),
  '131057': D('Cuenta en mantenimiento', 'La cuenta de WhatsApp Business está en mantenimiento por Meta.', 'Intenta más tarde.', 'cuenta', true),
  '130472': D('Experimento de Meta: no recibe marketing', 'Este número está en un experimento de Meta y no recibe plantillas de marketing.', 'Usa una plantilla de utilidad o espera a que el cliente escriba.', 'limite'),
  '130429': D('Límite de envíos por segundo', 'Se superó el throughput permitido del número.', 'Reintenta en unos segundos; en masivos, baja el ritmo.', 'limite', true),
  '131000': D('Error interno de WhatsApp', 'Meta devolvió un error genérico sin detalle.', 'Reintenta; si persiste, revisa el estado del número en Kapso.', 'red', true),
  '131005': D('Sin permiso para esta acción', 'El token/número no tiene permiso para hacer esto.', 'Revisa los permisos del número en Kapso/Meta.', 'permiso'),
  '131008': D('Falta un parámetro obligatorio', 'La petición a Meta no llevó un campo requerido.', 'Es un error del sistema: repórtalo con el detalle.', 'otro'),
  '131009': D('Parámetro inválido', 'Un valor de la petición no tiene el formato que Meta espera (p. ej. el teléfono).', 'Revisa el teléfono en formato internacional sin espacios (52155…).', 'otro'),
  '131016': D('Servicio no disponible', 'Meta no pudo procesar la petición en este momento.', 'Reintenta en un minuto.', 'red', true),
  '131021': D('Mismo número de origen y destino', 'Intentaste escribirle al propio número del negocio.', 'Elige otro destinatario.', 'numero'),
  '133004': D('Servidor de Meta no disponible', 'Caída temporal del lado de Meta.', 'Reintenta más tarde.', 'red', true),
  '133005': D('PIN incorrecto', 'El PIN de verificación en dos pasos del número es incorrecto.', 'Corrige el PIN del número en Kapso → Ajustes del número.', 'cuenta'),
  '133006': D('Reverificación necesaria', 'Meta pide volver a verificar el número.', 'Reverifica el número desde Kapso.', 'cuenta'),
  '133008': D('Demasiados intentos de PIN', 'Se superó el límite de intentos del PIN.', 'Espera y vuelve a intentarlo más tarde.', 'cuenta'),
  '133010': D('Número no registrado', 'El número no está registrado en la Cloud API.', 'Completa el registro del número en Kapso.', 'cuenta'),
  '135000': D('Error genérico del usuario', 'Meta no pudo procesar el mensaje por un error no especificado.', 'Reintenta; si persiste, manda el detalle a soporte.', 'otro', true),
  '368': D('Cuenta bloqueada temporalmente', 'Meta bloqueó la cuenta por violación de políticas.', 'Revisa las notificaciones en Meta Business Manager.', 'cuenta'),
  '190': D('Token de acceso inválido', 'El token de Meta expiró o fue revocado.', 'Reconecta el número en Kapso.', 'cuenta'),
  '100': D('Petición inválida', 'Meta rechazó un parámetro de la petición.', 'Revisa el detalle: suele ser un nombre de plantilla, idioma o formato de media.', 'otro'),
  '80007': D('Límite de la API alcanzado', 'Se superó el límite de llamadas a la API de WhatsApp Business.', 'Espera y reintenta; en masivos, baja el ritmo.', 'limite', true),
  '4': D('Límite de la app alcanzado', 'La app superó su cuota de llamadas a Meta.', 'Espera unos minutos.', 'limite', true),
  '33': D('Número del negocio inválido', 'El phone_number_id no existe o no pertenece a la cuenta.', 'Revisa KAPSO_PHONE_NUMBER_ID en Ajustes.', 'cuenta'),
  // Llamadas (Calling API)
  '131014': D('La llamada ya no existe', 'Meta no reconoce esa llamada: ya terminó, el cliente colgó antes de contestar, o pasaron más de 30 s timbrando.', 'Si el cliente sigue ahí, pídele que vuelva a llamar.', 'otro'),
  '138000': D('Llamadas no activadas', 'La Calling API no está activada para este número.', 'Actívala en Ajustes → Llamadas de WhatsApp.', 'cuenta'),
  '138013': D('Llamadas salientes no disponibles', 'Meta no permite que el negocio inicie llamadas desde este número (país o elegibilidad de la cuenta).', 'El cliente sí puede llamarte; pídele que toque el teléfono en el chat.', 'cuenta'),
  '138001': D('Sin permiso para llamar', 'El cliente no ha dado permiso para recibir llamadas del negocio.', 'Manda la solicitud de permiso (1 por día, 2 por semana).', 'permiso'),
  '138002': D('Límite de llamadas alcanzado', 'Se superó el máximo de llamadas a este cliente (5 por día).', 'Intenta mañana o pídele que te llame.', 'limite'),
  // Subcódigos de Meta al crear plantillas (llegan como error_subcode con code 100)
  'sub:2388293': D('Demasiadas variables para el texto', 'Meta exige cierta proporción de palabras fijas por cada variable: el cuerpo es muy corto para tantas {{n}}.', 'Alarga el texto del cuerpo o quita variables.', 'plantilla'),
  'sub:2388024': D('Ya existe una plantilla con ese nombre', 'Meta no admite dos plantillas con el mismo nombre e idioma.', 'Cambia el nombre (p. ej. agrega _v2).', 'plantilla'),
  'sub:2388023': D('Nombre de plantilla inválido', 'Solo minúsculas, números y guión bajo.', 'Corrige el nombre.', 'plantilla'),
  'sub:2388043': D('Variable al inicio o al final', 'Meta no permite que el cuerpo empiece o termine con una variable.', 'Pon texto antes de la primera {{1}} y después de la última.', 'plantilla'),
  'sub:2388042': D('Variables con saltos de línea', 'Hay una variable pegada a un salto de línea o con formato no permitido.', 'Deja un espacio entre texto y variable; sin saltos dentro del {{n}}.', 'plantilla'),
  'sub:2388295': D('Encabezado de media inválido', 'El archivo de muestra no cumple (tipo/tamaño) o el handle expiró.', 'Sube una imagen jpg/png ≤5 MB, video mp4 ≤16 MB o PDF ≤100 MB y vuelve a crear.', 'plantilla'),
  'sub:2388275': D('Demasiados botones', 'Superaste el máximo de botones que Meta permite para esta combinación.', 'Máximo 10 en total; 2 de link, 1 de llamada, 1 de copiar código.', 'plantilla'),
  '2494010': D('Meta decidió no entregar', 'Meta descartó el mensaje por control de calidad ("healthy ecosystem").', 'No insistas: espera a que el cliente escriba o usa una plantilla de utilidad.', 'limite'),
};

// Mensajes de la capa de Kapso (no traen código numérico).
const KAPSO: { re: RegExp; def: Def }[] = [
  { re: /outside the 24-hour window|24.?hour/i, def: META['131047'] },
  { re: /template.*(not found|does not exist)/i, def: META['132001'] },
  { re: /failed to download media|could not (download|fetch) (the )?media|media.*(404|403|unreachable)/i, def: D('No se pudo descargar el archivo', 'Kapso/Meta intentaron bajar el archivo de la URL que diste y no estaba disponible (404, privado o caído).', 'Usa una URL pública https que abra en el navegador sin login; si es de tu biblioteca, súbela de nuevo.', 'media') },
  { re: /configuration not found|phone number.*not found/i, def: D('Número no configurado en Kapso', 'Kapso no encuentra el número (phone_number_id) para esta petición.', 'Revisa que el número esté conectado en Kapso y el ID en Ajustes.', 'cuenta') },
  { re: /invalid api key|unauthorized|401/i, def: D('API key de Kapso inválida', 'Kapso rechazó la credencial.', 'Revisa KAPSO_API_KEY en las variables del entorno.', 'cuenta') },
  { re: /rate limit|too many requests|429/i, def: D('Demasiadas peticiones a Kapso', 'Se superó el límite de llamadas por minuto.', 'Espera unos segundos y reintenta.', 'limite', true) },
  { re: /media.*(too large|exceeds)/i, def: META['131053'] },
  { re: /recipient.*(invalid|not.*whatsapp)/i, def: META['131026'] },
  { re: /fetch failed|ECONNRESET|ETIMEDOUT|network/i, def: D('Sin conexión con Kapso', 'La petición no llegó a Kapso (red o caída).', 'Reintenta en un momento.', 'red', true) },
];

const GENERICO: Def = D('No se pudo enviar', 'WhatsApp devolvió un error que no tenemos catalogado.', 'Reintenta; si vuelve a fallar, manda el detalle técnico a soporte.', 'otro', true);

/** Saca código + mensaje de cualquiera de las tres formas. */
function desarmar(x: any): { codigo: string | null; mensaje: string; detalle: string; next: string } {
  if (x == null) return { codigo: null, mensaje: '', detalle: '', next: '' };
  if (typeof x === 'string') {
    // "131047 Más de 24h…" (espejo) | "Kapso HTTP 422: {…}" | texto suelto
    const j = x.match(/\{[\s\S]*\}$/);
    if (j) { try { return desarmar(JSON.parse(j[0])); } catch { /* sigue */ } }
    const m = x.match(/(?:^|#|\()(\d{3,7})\)?/);
    return { codigo: m ? m[1] : null, mensaje: x, detalle: '', next: '' };
  }
  if (x instanceof Error) return desarmar((x as any).detalle ?? x.message);
  const e = x.error ?? x;
  if (typeof e === 'string') return { codigo: null, mensaje: e, detalle: '', next: String(x.next_steps || '') };
  const errs = Array.isArray(x.errors) ? x.errors : Array.isArray(e?.errors) ? e.errors : null;
  if (errs?.length) return desarmar(errs[0]);
  // Meta a veces explica en error_user_title/msg (p. ej. al crear plantillas); el subcode afina el caso.
  const sub = e?.error_subcode != null ? String(e.error_subcode) : null;
  return {
    codigo: sub && META[`sub:${sub}`] ? `sub:${sub}` : (e?.code != null ? String(e.code) : null),
    mensaje: String(e?.message || e?.title || ''),
    detalle: String(e?.error_data?.details || e?.details || e?.error_user_msg || ''),
    next: String(x.next_steps || ''),
  };
}

export function explicarError(raw: any, httpStatus?: number): ErrorLegible {
  const { codigo, mensaje, detalle, next } = desarmar(raw);
  const crudo = [codigo, mensaje, detalle].filter(Boolean).join(' · ') || (typeof raw === 'string' ? raw : JSON.stringify(raw));
  let def: Def | null = codigo ? META[codigo] || null : null;
  if (!def) for (const k of KAPSO) if (k.re.test(mensaje) || k.re.test(detalle) || k.re.test(next)) { def = k.def; break; }
  if (!def && httpStatus === 422) def = /window|24/i.test(mensaje + next) ? META['131047'] : D('Datos rechazados por Kapso', mensaje || 'Kapso no aceptó la petición.', 'Revisa el detalle técnico: suele ser un campo obligatorio o un valor inválido.', 'otro');
  if (!def && httpStatus === 401) def = KAPSO[3].def;
  if (!def && httpStatus === 404 && /config|phone/i.test(mensaje)) def = KAPSO.find(k => /configuration/.test(k.re.source))!.def;
  if (!def && httpStatus === 429) def = KAPSO[4].def;
  if (!def) def = GENERICO;
  // Si Meta dio un detalle concreto (p. ej. "template name (x) does not exist in es_MX"), se añade.
  const que_paso = detalle && !def.que_paso.includes(detalle) ? `${def.que_paso} Detalle de Meta: ${detalle}` : def.que_paso;
  return { codigo, ...def, que_paso, crudo };
}

/** Texto corto para guardar en wa_mensajes.error y mostrar bajo la burbuja. */
export const errorCorto = (raw: any, httpStatus?: number) => {
  const e = explicarError(raw, httpStatus);
  return `${e.codigo ? e.codigo + ' ' : ''}${e.titulo}`;
};
