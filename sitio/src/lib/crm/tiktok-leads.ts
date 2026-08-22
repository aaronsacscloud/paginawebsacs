import { telefonoWhatsApp } from '../telefono';
// Leads de FORMULARIO INSTANTÁNEO de TikTok (Instant Form) → CRM.
//
// Por qué existe este archivo y no basta con la atribución del sitio:
// el lead de un Instant Form NUNCA toca sacscloud.com. Se llena DENTRO de
// TikTok, así que no hay cookie `sacs_attr`, no hay `ttclid`, no hay landing y
// no hay referrer. Todo lo que se va a saber de ese lead viene en el CSV que
// TikTok deja descargar (o en la Lead Gen API, que entrega los mismos campos).
// Si ese CSV se captura a mano en el CRM, la campaña se pierde — y sin campaña
// no hay costo por lead, que es justo lo que se quiere medir.
//
// Regla de oro del mapeo: NADA se tira. Lo que no reconocemos se guarda en
// `respuestas`, porque las preguntas del formulario las cambia marketing sin
// avisar a nadie, y una pregunta nueva no puede hacer que el lead entre vacío.

/** Un lead ya normalizado, listo para volverse contacto del CRM. */
export interface LeadTikTok {
  /** id del lead en TikTok. Es la llave anti-duplicado. */
  lead_id: string;
  creado: string | null;
  campana: string | null;
  campana_id: string | null;
  grupo: string | null;
  grupo_id: string | null;
  anuncio: string | null;
  anuncio_id: string | null;
  formulario: string | null;
  formulario_id: string | null;
  nombre: string;
  apellido: string | null;
  email: string | null;
  whatsapp: string | null;
  empresa: string | null;
  giro: string | null;
  sucursales: number | null;
  /** Todo lo demás del formulario, tal cual lo preguntó marketing. */
  respuestas: Record<string, string>;
  /** Llave de idempotencia: el lead_id si existe, si no una derivada del contacto. */
  clave: string;
  /** Lead de prueba que manda TikTok al probar el formulario. No es una persona. */
  es_prueba: boolean;
}

/* ── CSV ──────────────────────────────────────────────────────────────────
   Parser propio en vez de una dependencia: el CSV de TikTok trae comas dentro
   de comillas (nombres de campaña como "PDV | CDMX, GDL") y saltos de línea
   dentro de respuestas abiertas. Un split(',') pierde columnas en silencio y
   el lead entra con el teléfono en el campo del correo.                    */

/** Detecta el separador real: TikTok da coma, pero pegar desde Sheets da tab. */
function separador(linea: string): string {
  const fuera = (sep: string) => {
    let n = 0, comillas = false;
    for (const ch of linea) {
      if (ch === '"') comillas = !comillas;
      else if (ch === sep && !comillas) n++;
    }
    return n;
  };
  return fuera('\t') > fuera(',') ? '\t' : ',';
}

/** CSV/TSV → matriz. Respeta comillas dobles y "" como comilla escapada. */
export function parsearCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sep = separador(t.split('\n')[0] || '');
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  fila.push(campo);
  if (fila.some(c => c.trim())) filas.push(fila);
  return filas.filter(f => f.some(c => c.trim()));
}

/** Encabezado → llave comparable: sin acentos, sin mayúsculas, sin adornos. */
export const normalizarLlave = (s: string): string =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/* ── Sinónimos ────────────────────────────────────────────────────────────
   TikTok exporta los encabezados EN EL IDIOMA DE LA CUENTA, y cambia el
   nombre entre versiones del panel. Por eso el mapeo es por lista de alias y
   no por posición: un panel en inglés y otro en español tienen que producir
   el mismo contacto.                                                       */
const ALIAS: Record<keyof Omit<LeadTikTok, 'respuestas' | 'clave' | 'es_prueba'>, string[]> = {
  lead_id: ['lead_id', 'id', 'id_del_cliente_potencial', 'id_de_cliente_potencial', 'leadid', 'id_del_lead', 'tiktok_lead_id'],
  // 'timestamp'/'marca_temporal' son los nombres que ponen Zapier y Google
  // Forms cuando ellos crean la columna: es la hora en que llegó el lead.
  creado: ['create_time', 'created_time', 'createtime', 'hora_de_creacion', 'fecha_de_creacion', 'creado', 'fecha', 'timestamp', 'marca_temporal', 'fecha_y_hora', 'fecha_de_envio'],
  campana: ['campaign_name', 'campaign', 'nombre_de_la_campana', 'campana'],
  campana_id: ['campaign_id', 'id_de_la_campana', 'id_de_campana'],
  grupo: ['adgroup_name', 'ad_group_name', 'nombre_del_grupo_de_anuncios', 'grupo_de_anuncios'],
  grupo_id: ['adgroup_id', 'ad_group_id', 'id_del_grupo_de_anuncios'],
  anuncio: ['ad_name', 'nombre_del_anuncio', 'anuncio'],
  anuncio_id: ['ad_id', 'id_del_anuncio', 'creative_id'],
  formulario: ['form_name', 'page_name', 'nombre_del_formulario', 'formulario', 'nombre_de_la_pagina'],
  formulario_id: ['form_id', 'page_id', 'id_del_formulario'],
  nombre: ['name', 'full_name', 'first_name', 'nombre', 'nombre_completo', 'nombre_y_apellido', 'cual_es_tu_nombre'],
  apellido: ['last_name', 'apellido', 'apellidos'],
  email: ['email', 'email_address', 'correo', 'correo_electronico', 'e_mail'],
  whatsapp: ['phone_number', 'phone', 'telephone', 'mobile', 'telefono', 'numero_de_telefono', 'celular', 'whatsapp', 'numero_de_whatsapp'],
  empresa: ['company_name', 'company', 'business_name', 'empresa', 'nombre_de_la_empresa', 'negocio', 'nombre_del_negocio', 'como_se_llama_tu_negocio'],
  giro: ['industry', 'giro', 'industria', 'sector', 'que_vendes', 'tipo_de_negocio'],
  sucursales: ['sucursales', 'branches', 'numero_de_sucursales', 'cuantas_sucursales_tienes'],
};

/** llave normalizada → campo del lead. Se arma una vez. */
const POR_LLAVE: Record<string, string> = {};
for (const [campo, alias] of Object.entries(ALIAS)) for (const a of alias) POR_LLAVE[a] = campo;

/* ── Teléfono ─────────────────────────────────────────────────────────────
   Se delega en el normalizador canónico. Antes esta función era una de DOS
   copias (la otra dentro de Kapso) y ningún otro camino de alta normalizaba,
   así que el 28% de los teléfonos del CRM no abría un chat. Se conserva el
   nombre porque el importador y sus pruebas ya lo usan.               */
export const telefonoMeta = telefonoWhatsApp;

/** "Ana María Pérez López" → nombre + apellido, sin perder nada. */
function partirNombre(completo: string): { nombre: string; apellido: string | null } {
  const p = String(completo || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return { nombre: '', apellido: null };
  if (p.length === 1) return { nombre: p[0], apellido: null };
  if (p.length === 2) return { nombre: p[0], apellido: p[1] };
  // Con 3+ palabras se parte a la mitad: en México lo normal son dos nombres
  // y dos apellidos, y cortar solo la última palabra deja "Ana María Pérez"
  // como nombre de pila.
  const corte = Math.ceil(p.length / 2);
  return { nombre: p.slice(0, corte).join(' '), apellido: p.slice(corte).join(' ') };
}

/** Fecha de TikTok → ISO. Acepta epoch en segundos, epoch en ms y texto. */
function aISO(v?: string | null): string | null {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
  if (/^\d{13}$/.test(s)) return new Date(Number(s)).toISOString();
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Una fila del export → lead normalizado.
 * `fila` viene ya como objeto {encabezado_original: valor}.
 */
export function mapearLead(fila: Record<string, string>): LeadTikTok {
  const out: any = { respuestas: {} };
  let nombreCrudo = '', apellidoCrudo = '';

  for (const [encabezado, valor] of Object.entries(fila)) {
    const v = String(valor ?? '').trim();
    if (!v) continue;
    const campo = POR_LLAVE[normalizarLlave(encabezado)];
    if (campo === 'nombre') { nombreCrudo = v; continue; }
    if (campo === 'apellido') { apellidoCrudo = v; continue; }
    if (campo) out[campo] = v;
    // La pregunta que no reconocemos SÍ se guarda: es el dato de calificación
    // que marketing agregó esta semana.
    else out.respuestas[encabezado.trim()] = v;
  }

  // El lead_id es la LLAVE ANTI-DUPLICADO, así que se valida antes de creerle:
  // los de TikTok son numéricos y largos (~19 dígitos). Una hoja con una
  // columna "ID" que en realidad es el número de fila tomaría ese lugar, y al
  // recrear la hoja los contadores volverían a 1 y el lead nuevo se vería como
  // "ya importado". Lo que no pasa el filtro se conserva como respuesta.
  if (out.lead_id && !/^\d{12,}$/.test(String(out.lead_id).trim())) {
    out.respuestas['ID (no es un lead_id de TikTok)'] = String(out.lead_id);
    out.lead_id = '';
  }

  const partido = partirNombre(nombreCrudo);
  out.nombre = apellidoCrudo ? (nombreCrudo || partido.nombre) : partido.nombre;
  out.apellido = apellidoCrudo || partido.apellido;
  out.creado = aISO(out.creado);
  out.whatsapp = telefonoMeta(out.whatsapp);
  out.email = out.email ? String(out.email).toLowerCase().trim() : null;
  // Sucursales: el formulario ofrece RANGOS ("1", "2-3", "3-5"). Quitar todo
  // lo que no sea dígito convertía "3-5" en TREINTA Y CINCO sucursales, y ese
  // número acaba en la cotización. Se toma el primero del rango —el piso, que
  // es lo que se puede afirmar— y el rango textual se conserva como respuesta.
  const crudoSuc = String(out.sucursales || '').trim();
  const primerNum = crudoSuc.match(/\d+/);
  out.sucursales = primerNum ? Number(primerNum[0]) || null : null;
  if (crudoSuc && /\D/.test(crudoSuc.replace(/^\s+|\s+$/g, ''))) out.respuestas['Sucursales (rango)'] = crudoSuc;
  out.lead_id = String(out.lead_id || '').trim();

  for (const k of ['campana', 'campana_id', 'grupo', 'grupo_id', 'anuncio', 'anuncio_id', 'formulario', 'formulario_id', 'empresa', 'giro']) {
    if (!out[k]) out[k] = null;
  }

  // CLAVE de idempotencia. El lead_id es la buena, pero una hoja llenada por
  // Zapier normalmente NO lo trae. Sin una clave estable el cron reprocesaría
  // la hoja entera cada 15 minutos: encontraría al contacto por correo, lo
  // trataría como "vuelve a dejar sus datos" y le clavaría una actividad nueva
  // cada cuarto de hora hasta enterrar su historial.
  out.clave = out.lead_id || (out.email || out.whatsapp ? `hoja:${out.email || out.whatsapp}` : '');

  // Lead de PRUEBA de TikTok: cuando se prueba un formulario, TikTok manda una
  // fila con datos dummy. No es una persona y no puede contaminar el conteo de
  // leads ni el costo por lead de la campaña.
  out.es_prueba = /test lead: dummy data|dummy data for/i.test(
    [out.campana, out.anuncio, out.formulario, out.nombre, out.email].filter(Boolean).join(' '),
  );

  return out as LeadTikTok;
}

/** CSV completo → leads. Ignora filas sin ningún dato de contacto. */
export function leadsDesdeCSV(csv: string): { leads: LeadTikTok[]; encabezados: string[]; descartadas: number; pruebas: number } {
  const filas = parsearCSV(csv);
  if (filas.length < 2) return { leads: [], encabezados: filas[0] || [], descartadas: 0, pruebas: 0 };
  const encabezados = filas[0].map(h => h.trim());
  let descartadas = 0, pruebas = 0;
  const leads: LeadTikTok[] = [];

  for (const f of filas.slice(1)) {
    const obj: Record<string, string> = {};
    encabezados.forEach((h, i) => { obj[h] = f[i] ?? ''; });
    const lead = mapearLead(obj);
    // Sin correo NI teléfono no hay a quién contactar: es ruido del export.
    if (!lead.email && !lead.whatsapp) { descartadas++; continue; }
    if (lead.es_prueba) { pruebas++; continue; }
    leads.push(lead);
  }
  return { leads, encabezados, descartadas, pruebas };
}

/**
 * El bloque de atribución que se guarda en `contacts.propiedades.atribucion`.
 * Misma forma que el de la web (ver lib/atribucion-marketing.ts) para que el
 * CRM lo pinte igual venga de donde venga — con una diferencia honesta:
 * `landing` es null porque el lead nunca visitó el sitio.
 */
export function atribucionDeLead(l: LeadTikTok) {
  const toque = {
    fuente: 'tiktok',
    medio: 'paid_social',
    campana: l.campana,
    contenido: l.anuncio,
    termino: l.grupo,
    landing: null,
    referrer: null,
    click_ids: null,
    cuando: l.creado,
  };
  return {
    primer_toque: toque,
    ultimo_toque: toque,
    visitor_id: null,
    paginas_vistas: null,
    dispositivo: 'App TikTok',
    navegador: null,
  };
}
