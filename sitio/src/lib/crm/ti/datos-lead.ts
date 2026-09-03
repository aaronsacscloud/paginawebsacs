// TRABAJO INTELIGENTE · LOS DATOS DEL LEAD SE APRENDEN SOLOS.
//
// Decisión del dueño (2026-09-02): si en la conversación —texto, nota de voz
// transcrita, llamada con minuta, nota de una llamada del consultor— aparece un
// dato del contacto (giro, cuántas tiendas, correo, nombre, marca, ciudad, web…),
// se GUARDA en el CRM; y si el lead corrige algo que el CRM tenía mal o viejo,
// se ACTUALIZA. Un solo lugar decide dónde va cada dato y con qué cuidado:
//
//   · vacío → se llena con confianza ≥ 0.7
//   · distinto → se pisa solo si el lead lo dijo con claridad (corrige:true o
//     confianza ≥ 0.9) y el contacto es lead/oportunidad (a un cliente no se le
//     tocan datos de cuenta desde un chat)
//   · todo cambio deja rastro: propiedades.historial_datos + una actividad en la
//     ficha («Datos actualizados desde la conversación: Giro, Sucursales»)
//
// Lo que se lee de la conversación viene del agente (su salida `datos`) o de
// `extraerDatos()` (Haiku) cuando el agente no participó: el consultor contestó
// antes, la llamada trajo minuta, o el consultor dejó nota de la llamada.
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';

export type DatoLead = { campo: string; valor: string; confianza?: number; evidencia?: string; corrige?: boolean };
export type FuenteDato = 'agente' | 'humano_respondio' | 'llamada' | 'llamada_nota' | 'accion' | 'formulario';

export const CAMPOS_LEAD = ['nombre', 'apellido', 'email', 'empresa', 'giro', 'sucursales', 'ciudad', 'estado', 'sitio_web', 'instagram', 'puesto', 'plan_interes', 'sistema_actual', 'dolor', 'mejor_hora', 'canal_preferido', 'cuando_decide', 'tema_reunion', 'otro'] as const;

const ETIQUETA: Record<string, string> = { nombre: 'Nombre', apellido: 'Apellido', email: 'Correo', empresa: 'Marca / tienda', giro: 'Giro', sucursales: 'Sucursales', ciudad: 'Ciudad', estado: 'Estado', sitio_web: 'Sitio web', instagram: 'Instagram', puesto: 'Puesto', plan_interes: 'Plan de interés', sistema_actual: 'Sistema actual', dolor: 'Dolor', mejor_hora: 'Mejor hora', canal_preferido: 'Canal preferido', cuando_decide: 'Cuándo decide', tema_reunion: 'Para la reunión' };

const limpio = (v: any, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const esPlaceholderNombre = (n?: string | null) => { const s = limpio(n).toLowerCase(); return !s || s === 'lead' || /^\+?\d[\d\s-]{6,}$/.test(s) || s === 'desconocido' || s === 'sin nombre'; };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Cambio = { campo: string; antes: any; despues: any; evidencia?: string; tabla: 'contacts' | 'companies' | 'perfil' };

/** Aplica al CRM los datos dichos por el lead. Devuelve lo que de verdad cambió. */
export async function aplicarDatos(contactId: string, datos: DatoLead[], ctx: { fuente: FuenteDato; conversation_id?: string | null }): Promise<{ cambios: Cambio[] }> {
  const lista = (datos || []).filter(d => d && d.campo && limpio(d.valor)).map(d => ({ ...d, campo: String(d.campo).toLowerCase().trim(), valor: limpio(d.valor), confianza: Number(d.confianza ?? 0.8) }));
  if (!lista.length) return { cambios: [] };
  const { data: c } = await supabase.from('contacts').select('id, nombre, apellido, email, puesto, giro, sucursales_interes, plan_interes, company_id, lifecycle_stage, propiedades, archived_at, nombre_confianza').eq('id', contactId).maybeSingle();
  if (!c || c.archived_at) return { cambios: [] };
  const esLead = ['lead', 'oportunidad'].includes(c.lifecycle_stage);
  const puedePisar = (d: DatoLead) => esLead && (d.corrige === true || Number(d.confianza) >= 0.9);
  const puedeLlenar = (d: DatoLead) => Number(d.confianza) >= 0.7;
  const cambios: Cambio[] = [];
  const upC: Record<string, any> = {};
  const props: any = (c.propiedades && typeof c.propiedades === 'object') ? { ...(c.propiedades as any) } : {};
  const datosLead: Record<string, string> = { ...(props.datos_lead || {}) };

  // Empresa: se resuelve primero porque giro/sucursales/web/ciudad viven ahí también.
  let companyId: string | null = c.company_id || null;
  let enlazadaExistente = false;   // si se acaba de enlazar a una empresa que ya existía, NO se le pisan campos
  const dEmpresa = lista.find(d => d.campo === 'empresa');
  if (dEmpresa && puedeLlenar(dEmpresa) && dEmpresa.valor.length >= 2) {
    if (!companyId) {
      // Coincidencia EXACTA normalizada (sin comodines ni texto crudo en el filtro): un nombre genérico no debe enganchar la empresa de otro.
      const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const buscado = norm(dEmpresa.valor);
      const { data: cands } = buscado.length >= 4 ? await supabase.from('companies').select('id, nombre, nombre_comercial').is('archived_at', null).ilike('nombre', `%${buscado.split(' ')[0].replace(/[%_]/g, '')}%`).limit(20) : { data: [] as any[] };
      const ex = (cands || []).find((k: any) => norm(k.nombre) === buscado || norm(k.nombre_comercial) === buscado);
      if (ex) { companyId = ex.id; enlazadaExistente = true; }
      else {
        const dG = lista.find(d => d.campo === 'giro'), dS = lista.find(d => d.campo === 'sucursales');
        const { data: nueva } = await supabase.from('companies').insert({ nombre: dEmpresa.valor.slice(0, 80), giro: dG ? dG.valor.slice(0, 60) : (c.giro || null), sucursales: dS && /^\d+$/.test(dS.valor) ? Number(dS.valor) : (c.sucursales_interes || null), tipo_cuenta: 'prospecto' }).select('id').maybeSingle();
        if (nueva) companyId = nueva.id;
        else {
          const { data: nueva2 } = await supabase.from('companies').insert({ nombre: dEmpresa.valor.slice(0, 80) }).select('id').maybeSingle();
          if (nueva2) companyId = nueva2.id;
        }
      }
      if (companyId) { upC.company_id = companyId; cambios.push({ campo: 'empresa', antes: null, despues: dEmpresa.valor, evidencia: dEmpresa.evidencia, tabla: 'contacts' }); }
    } else {
      const { data: co } = await supabase.from('companies').select('nombre, nombre_comercial').eq('id', companyId).maybeSingle();
      if (co && !co.nombre_comercial && limpio(co.nombre).toLowerCase() !== dEmpresa.valor.toLowerCase()) {
        await supabase.from('companies').update({ nombre_comercial: dEmpresa.valor.slice(0, 80) }).eq('id', companyId);
        cambios.push({ campo: 'empresa', antes: co.nombre, despues: dEmpresa.valor, evidencia: dEmpresa.evidencia, tabla: 'companies' });
      }
    }
    datosLead.empresa = dEmpresa.valor;
  }

  const upCo: Record<string, any> = {};
  let temasCambiaron = false;
  let co: any = null;
  if (companyId) { const r = await supabase.from('companies').select('giro, sucursales, sitio_web, ciudad, estado_geo, propiedades').eq('id', companyId).maybeSingle(); co = r.data; }

  for (const d of lista) {
    const v = d.valor;
    switch (d.campo) {
      case 'nombre': {
        const actual = limpio(c.nombre);
        const nuevo = v.replace(/^(soy|me llamo|mi nombre es)\s+/i, '').trim();
        if (!nuevo || nuevo.length < 2 || nuevo.length > 60) break;
        if (esPlaceholderNombre(actual) ? puedeLlenar(d) : (puedePisar(d) && actual.toLowerCase() !== nuevo.toLowerCase() && c.nombre_confianza !== 'humano')) {
          upC.nombre = nuevo; upC.nombre_confianza = 'dicho_por_el_lead'; cambios.push({ campo: 'nombre', antes: c.nombre, despues: nuevo, evidencia: d.evidencia, tabla: 'contacts' });
        }
        break;
      }
      case 'apellido': if (!c.apellido ? puedeLlenar(d) : puedePisar(d) && limpio(c.apellido).toLowerCase() !== v.toLowerCase()) { upC.apellido = v.slice(0, 60); cambios.push({ campo: 'apellido', antes: c.apellido, despues: v, evidencia: d.evidencia, tabla: 'contacts' }); } break;
      case 'email': {
        const e = v.toLowerCase().replace(/[<>,;]/g, '');
        if (!EMAIL_RE.test(e)) break;
        if (!c.email ? puedeLlenar(d) : puedePisar(d) && c.email.toLowerCase() !== e) {
          const { data: otro } = await supabase.from('contacts').select('id').eq('email', e).neq('id', contactId).limit(1).maybeSingle();
          if (!otro) { upC.email = e; cambios.push({ campo: 'email', antes: c.email, despues: e, evidencia: d.evidencia, tabla: 'contacts' }); }
        }
        break;
      }
      case 'puesto': if (!c.puesto ? puedeLlenar(d) : puedePisar(d) && limpio(c.puesto).toLowerCase() !== v.toLowerCase()) { upC.puesto = v.slice(0, 60); cambios.push({ campo: 'puesto', antes: c.puesto, despues: v, evidencia: d.evidencia, tabla: 'contacts' }); } break;
      case 'plan_interes': if (!c.plan_interes ? puedeLlenar(d) : puedePisar(d) && limpio(c.plan_interes).toLowerCase() !== v.toLowerCase()) { upC.plan_interes = v.slice(0, 40); cambios.push({ campo: 'plan_interes', antes: c.plan_interes, despues: v, evidencia: d.evidencia, tabla: 'contacts' }); } break;
      case 'giro': {
        const g = v.slice(0, 60);
        if (!c.giro ? puedeLlenar(d) : puedePisar(d) && limpio(c.giro).toLowerCase() !== g.toLowerCase()) { upC.giro = g; cambios.push({ campo: 'giro', antes: c.giro, despues: g, evidencia: d.evidencia, tabla: 'contacts' }); }
        if (co && (!co.giro ? puedeLlenar(d) : puedePisar(d) && limpio(co.giro).toLowerCase() !== g.toLowerCase())) { Object.assign(upCo, { giro: g, giro_confianza: d.confianza, giro_evidencia: (d.evidencia || '').slice(0, 200) || null, giro_at: new Date().toISOString() }); if (co.giro) cambios.push({ campo: 'giro', antes: co.giro, despues: g, evidencia: d.evidencia, tabla: 'companies' }); }
        break;
      }
      case 'sucursales': {
        const m = v.match(/\d+/); if (!m) break; const n = Number(m[0]); if (!(n >= 1 && n <= 500)) break;
        if (c.sucursales_interes == null ? puedeLlenar(d) : puedePisar(d) && Number(c.sucursales_interes) !== n) { upC.sucursales_interes = n; cambios.push({ campo: 'sucursales', antes: c.sucursales_interes, despues: n, evidencia: d.evidencia, tabla: 'contacts' }); }
        if (co && (co.sucursales == null ? puedeLlenar(d) : puedePisar(d) && Number(co.sucursales) !== n)) { upCo.sucursales = n; if (co.sucursales != null) cambios.push({ campo: 'sucursales', antes: co.sucursales, despues: n, evidencia: d.evidencia, tabla: 'companies' }); }
        break;
      }
      case 'ciudad': case 'estado': case 'sitio_web': case 'instagram': {
        datosLead[d.campo] = v;
        if (!co) break;
        const col = d.campo === 'estado' ? 'estado_geo' : d.campo === 'instagram' ? null : d.campo;
        if (col) { const actual = co[col]; if (!actual ? puedeLlenar(d) : puedePisar(d) && limpio(actual).toLowerCase() !== v.toLowerCase()) { upCo[col] = v.slice(0, 120); cambios.push({ campo: d.campo, antes: actual, despues: v, evidencia: d.evidencia, tabla: 'companies' }); } }
        else { const pp = { ...((co.propiedades as any) || {}) }; if (!pp.instagram) { pp.instagram = v.slice(0, 80); upCo.propiedades = pp; cambios.push({ campo: 'instagram', antes: null, despues: v, evidencia: d.evidencia, tabla: 'companies' }); } }
        break;
      }
      case 'tema_reunion': {
        // Lo que quiere VER en la demo. Lista viva en propiedades.temas_reunion; el consultor la ve en el inbox y en el evento del calendario.
        const tema = v.slice(0, 140); if (tema.length < 3) break;
        const lista: any[] = Array.isArray(props.temas_reunion) ? [...props.temas_reunion] : [];
        if (lista.some(t => limpio(t.tema).toLowerCase() === tema.toLowerCase())) break;
        lista.push({ tema, fuente: ctx.fuente === 'agente' || ctx.fuente === 'humano_respondio' ? 'lead' : ctx.fuente, evidencia: (d.evidencia || '').slice(0, 160) || null, cuando: new Date().toISOString() });
        props.temas_reunion = lista.slice(-30); temasCambiaron = true;
        cambios.push({ campo: 'tema_reunion', antes: null, despues: tema, evidencia: d.evidencia, tabla: 'contacts' });
        break;
      }
      default: {
        // sistema_actual, dolor, mejor_hora, canal_preferido, cuando_decide, otro: contexto de venta; se guarda en propiedades.datos_lead.
        if (d.campo !== 'otro' && (datosLead[d.campo] !== v) && (datosLead[d.campo] ? puedePisar(d) : puedeLlenar(d))) { cambios.push({ campo: d.campo, antes: datosLead[d.campo] || null, despues: v, evidencia: d.evidencia, tabla: 'perfil' }); datosLead[d.campo] = v; }
      }
    }
  }

  if (!cambios.length) return { cambios };
  const ahora = new Date().toISOString();
  const historial = [...(Array.isArray(props.historial_datos) ? props.historial_datos : []), ...cambios.map(x => ({ campo: x.campo, antes: x.antes ?? null, despues: x.despues, fuente: ctx.fuente, evidencia: (x.evidencia || '').slice(0, 160) || null, cuando: ahora }))].slice(-40);
  upC.propiedades = { ...props, datos_lead: datosLead, historial_datos: historial };
  if (temasCambiaron) setTimeout(() => { sincronizarTemasReunion(contactId).catch(() => {}); }, 0);
  upC.updated_at = ahora;
  const { error } = await supabase.from('contacts').update(upC).eq('id', contactId);
  if (error) {
    // Si una columna nueva no existe todavía (nombre_confianza con valor nuevo, etc.), se reintenta sin ella.
    delete upC.nombre_confianza;
    await supabase.from('contacts').update(upC).eq('id', contactId);
  }
  if (companyId && Object.keys(upCo).length && !enlazadaExistente) await supabase.from('companies').update({ ...upCo, updated_at: ahora }).eq('id', companyId);
  const visibles = cambios.filter(x => x.tabla !== 'perfil' || ['sistema_actual', 'dolor'].includes(x.campo));
  const temas = visibles.filter(x => x.campo === 'tema_reunion');
  if (temas.length) await supabase.from('activities').insert({ contact_id: contactId, company_id: companyId, tipo: 'tema_reunion', titulo: `Quiere ver en la reunión: ${temas.map(t => t.despues).join(' · ')}`, descripcion: temas.map(t => `${t.despues}${t.evidencia ? ` · dijo: «${limpio(t.evidencia, 120)}»` : ''}`).join('\n'), automatico: true, metadata: { fuente: ctx.fuente, conversation_id: ctx.conversation_id || null } }).then(() => {}, () => {});
  if (visibles.length) {
    const otros = visibles.filter(x => x.campo !== 'tema_reunion');
    if (!otros.length) return { cambios };
    const titulo = `Datos actualizados desde la conversación: ${[...new Set(otros.map(x => ETIQUETA[x.campo] || x.campo))].join(', ')}`;
    const descripcion = otros.map(x => `${ETIQUETA[x.campo] || x.campo}: ${x.antes == null || x.antes === '' ? '(vacío)' : x.antes} → ${x.despues}${x.evidencia ? ` · dijo: «${limpio(x.evidencia, 120)}»` : ''}`).join('\n');
    await supabase.from('activities').insert({ contact_id: contactId, company_id: companyId, tipo: 'datos_actualizados', titulo, descripcion, automatico: true, metadata: { fuente: ctx.fuente, conversation_id: ctx.conversation_id || null, cambios: visibles.map(({ campo, antes, despues }) => ({ campo, antes, despues })) } }).then(() => {}, () => {});
  }
  return { cambios };
}

/** Lee un texto (mensajes del lead, transcripción, nota) y saca los datos del contacto. Haiku: barato y suficiente. */
export async function extraerDatos(texto: string, crm: { nombre?: string | null; email?: string | null; giro?: string | null; sucursales?: number | null; empresa?: string | null }): Promise<{ datos: DatoLead[]; costo: number }> {
  const t = limpio(texto, 6000);
  if (!hasApiKey() || t.length < 8) return { datos: [], costo: 0 };
  const prompt = `Eres el asistente de datos de un CRM de Sacs (software para tiendas de moda en México). Del TEXTO de abajo saca SOLO datos del prospecto que estén dichos de forma explícita: nada de suposiciones.
Campos posibles: ${CAMPOS_LEAD.join(', ')}. «sucursales» es un número; «empresa» es el nombre de su marca o tienda; «giro» describe qué vende (ej. «ropa de dama», «zapatería», «joyería fina», «ropa (venta a mayoreo)»); «email» solo si aparece un correo.
LO QUE EL CRM YA TIENE: nombre «${crm.nombre || '?'}», correo ${crm.email || 'ninguno'}, giro ${crm.giro || 'desconocido'}, tiendas ${crm.sucursales ?? 'desconocido'}, empresa ${crm.empresa || 'desconocida'}.
Si el texto CONTRADICE algo que el CRM tiene (por ejemplo dice que ahora son 4 tiendas y el CRM dice 3), inclúyelo con "corrige": true. Si coincide con lo que ya hay, no lo repitas.
Devuelve SOLO un arreglo JSON: [{"campo":"…","valor":"…","confianza":0.0-1.0,"evidencia":"cita textual corta","corrige":true|false}] (o [] si no hay nada).

TEXTO:
${t}`;
  try {
    const r = await anthropic.messages.create({ model: MODELS.haiku, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
    const out = (r.content[0] as any)?.text || '';
    const m = out.match(/\[[\s\S]*\]/);
    const arr = m ? JSON.parse(m[0]) : [];
    const costo = calculateCost(MODELS.haiku, { input_tokens: r.usage?.input_tokens || 0, output_tokens: r.usage?.output_tokens || 0 } as any)?.cost_usd || 0;
    return { datos: Array.isArray(arr) ? arr.filter((d: any) => d && (CAMPOS_LEAD as readonly string[]).includes(String(d.campo))) : [], costo };
  } catch { return { datos: [], costo: 0 }; }
}

/** Texto reciente del lead (lo que escribió + transcripciones de sus audios) desde una fecha. */
export async function textoDelLead(contactId: string, desdeIso: string, max = 12): Promise<{ texto: string; conversation_id: string | null }> {
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(2);
  const ids = (convs || []).map(x => x.id);
  if (!ids.length) return { texto: '', conversation_id: null };
  const { data: ms } = await supabase.from('wa_mensajes').select('cuerpo, transcript, created_at, conversation_id').in('conversation_id', ids).eq('direccion', 'entrante').is('borrado_at', null).gt('created_at', desdeIso).order('created_at', { ascending: true }).limit(max);
  const texto = (ms || []).map(m => limpio(m.transcript || m.cuerpo, 800)).filter(Boolean).join('\n');
  return { texto, conversation_id: (ms || [])[0]?.conversation_id || ids[0] };
}

/** Extrae y aplica en un paso (para las fuentes donde el agente no participó). */
export async function extraerYAplicar(contactId: string, texto: string, fuente: FuenteDato, conversation_id?: string | null): Promise<{ cambios: Cambio[]; datos: DatoLead[]; costo: number }> {
  const { data: c } = await supabase.from('contacts').select('nombre, email, giro, sucursales_interes, companies(nombre)').eq('id', contactId).maybeSingle();
  if (!c) return { cambios: [], datos: [], costo: 0 };
  const { datos, costo } = await extraerDatos(texto, { nombre: c.nombre, email: c.email, giro: c.giro, sucursales: c.sucursales_interes, empresa: (c as any).companies?.nombre || null });
  if (!datos.length) return { cambios: [], datos, costo };
  const { cambios } = await aplicarDatos(contactId, datos, { fuente, conversation_id });
  // Rastro en el perfil (misma bitácora que usa el agente).
  const { data: p } = await supabase.from('ti_perfil').select('intenciones').eq('contact_id', contactId).maybeSingle();
  const prev: any[] = Array.isArray(p?.intenciones) ? p!.intenciones : [];
  await supabase.from('ti_perfil').upsert({ contact_id: contactId, intenciones: [...prev, ...datos.map(d => ({ ...d, cuando: new Date().toISOString(), fuente }))].slice(-60), updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
  if (cambios.length) await supabase.from('ia_log').insert({ accion: 'datos_lead', contact_id: contactId, razon: fuente, costo_usd: costo, detalle: { cambios: cambios.map(({ campo, antes, despues }) => ({ campo, antes, despues })) } }).then(() => {}, () => {});
  return { cambios, datos, costo };
}

/** Los temas de la reunión, escritos en el evento del calendario de la próxima cita (si la hay). Idempotente. */
export async function sincronizarTemasReunion(contactId: string): Promise<boolean> {
  const { data: c } = await supabase.from('contacts').select('propiedades').eq('id', contactId).maybeSingle();
  const temas: any[] = Array.isArray((c?.propiedades as any)?.temas_reunion) ? (c!.propiedades as any).temas_reunion : [];
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data: b } = await supabase.from('bookings').select('id, host_id, google_event_id').eq('contact_id', contactId).gte('fecha', hoy).in('estado', ['agendada', 'confirmada']).not('google_event_id', 'is', null).order('fecha').order('hora_inicio').limit(1).maybeSingle();
  if (!b?.google_event_id || !b.host_id) return false;
  const { escribirBloqueEnEvento } = await import('../../google-calendar');
  return escribirBloqueEnEvento(b.host_id, b.google_event_id, 'Para la reunión', temas.filter(t => !t.hecho).map(t => `${t.tema}${t.fuente === 'consultor' ? ' (consultor)' : ''}`));
}
