// EVALUADOR DE REGLAS WEB — qué recorrido en el sitio dispara qué embudo.
//
// Corre en el SERVIDOR, nunca en el navegador: una regla evaluada en el
// navegador se puede leer, falsear y se pierde al cerrar la pestaña. Aquí se
// leen las visitas ya guardadas y se decide a quién inscribir.
//
// ── Las tres reglas que evitan que esto se sienta acoso ──
//
// 1. RETRASO. Ningún correo sale en el mismo minuto de la visita. El embudo se
//    inscribe con `next_action_at` a futuro: llegar mientras la persona sigue
//    navegando delata que la estás mirando, y eso espanta más de lo que
//    convierte.
//
// 2. UNO POR RECORRIDO. Si alguien activa tres reglas el mismo día, entra por
//    la de mayor prioridad y las demás se saltan. Sin esto, la visita más
//    entusiasta produce la peor experiencia.
//
// 3. SOLO A QUIEN YA DIO SU CORREO. La regla se activa con la visita, pero el
//    correo solo sale si esa persona ya está en el CRM por su propia voluntad.
//    No es cautela: es lo que exige la LFPDPPP y lo que hace cierto el aviso
//    de privacidad del pie.
import { supabase } from '../supabase';

export type TipoRegla = 'pagina' | 'repeticion' | 'permanencia' | 'ausencia' | 'combinacion' | 'secuencia' | 'intencion';

export interface Regla {
  id: string; tenant_id: string; nombre: string; tipo: TipoRegla;
  config: any; automation_id: string | null;
  retraso_minutos: number; prioridad: number; espera_dias: number;
  estado: string; activado_at: string | null;
}

/** Qué pide cada tipo de regla. La UI pinta sus campos desde aquí. */
export const TIPOS: Record<TipoRegla, { etiqueta: string; explica: string; campos: string[] }> = {
  pagina: { etiqueta: 'Entró a una página', explica: 'Una ruta, un correo. Para páginas donde la intención ya es clara.', campos: ['rutas'] },
  repeticion: { etiqueta: 'Entró varias veces', explica: 'Volver distingue la curiosidad de la evaluación.', campos: ['rutas', 'veces', 'dias'] },
  permanencia: { etiqueta: 'Se quedó leyendo', explica: 'Separa el rebote de la lectura real.', campos: ['rutas', 'segundos'] },
  ausencia: { etiqueta: 'Estuvo y no volvió', explica: 'El disparador por ausencia: vio algo caro y desapareció.', campos: ['rutas', 'dias'] },
  combinacion: { etiqueta: 'Vio varias páginas', explica: 'El recorrido dice más que cualquier página suelta.', campos: ['rutas', 'dias'] },
  secuencia: { etiqueta: 'En este orden', explica: 'El orden revela la intención: producto→precios no es lo mismo que precios→producto.', campos: ['rutas', 'dias'] },
  intencion: { etiqueta: 'Cruzó un puntaje', explica: 'Sin anticipar recorridos: se dispara con el puntaje de intención.', campos: ['umbral'] },
};

const hace = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();
/** ¿La ruta calza con el patrón? `/planes` calza con `/planes?x=1` y `/planes/anual`. */
const calza = (ruta: string, patron: string): boolean => {
  const r = String(ruta || '').toLowerCase().split('?')[0].replace(/\/$/, '');
  const p = String(patron || '').toLowerCase().split('?')[0].replace(/\/$/, '');
  if (!p) return false;
  if (p.endsWith('*')) return r.startsWith(p.slice(0, -1));
  return r === p || r.startsWith(p + '/');
};

interface Visita { contact_id: string; ruta: string; created_at: string; segundos: number | null }

/**
 * Quién cumple esta regla ahora mismo.
 *
 * Solo mira visitas POSTERIORES a la activación de la regla: encenderla no
 * puede disparar correos por lo que la gente navegó el mes pasado — ese es el
 * mismo desastre que el arranque limpio de los embudos evita.
 */
export async function candidatos(r: Regla): Promise<Array<{ contactId: string; detalle: any }>> {
  const desdeActivacion = r.activado_at || new Date().toISOString();
  const cfg = r.config || {};
  const rutas: string[] = Array.isArray(cfg.rutas) ? cfg.rutas.filter(Boolean) : [];
  const dias = Math.min(90, Math.max(1, Number(cfg.dias) || 7));

  // Caso aparte: no mira visitas sino el puntaje ya calculado.
  if (r.tipo === 'intencion') {
    const umbral = Number(cfg.umbral) || 40;
    const { data } = await supabase.from('contacts')
      .select('id, intencion, intencion_at')
      .gte('intencion', umbral).not('email', 'is', null).is('archived_at', null)
      .gte('intencion_at', desdeActivacion)
      .limit(500);
    return (data || []).map((c: any) => ({ contactId: c.id, detalle: { puntaje: c.intencion } }));
  }

  const { data: visitas } = await supabase.from('contact_visits')
    .select('contact_id, ruta, created_at, segundos')
    .not('contact_id', 'is', null)
    .gte('created_at', desdeActivacion)
    .gte('created_at', hace(dias))
    .order('created_at', { ascending: true })
    .limit(20000);

  // Agrupar por persona: casi todas las reglas leen un RECORRIDO, no un hecho.
  const porPersona = new Map<string, Visita[]>();
  for (const v of (visitas || []) as Visita[]) {
    if (!porPersona.has(v.contact_id)) porPersona.set(v.contact_id, []);
    porPersona.get(v.contact_id)!.push(v);
  }

  const out: Array<{ contactId: string; detalle: any }> = [];

  for (const [contactId, vs] of porPersona) {
    const deRuta = (patron: string) => vs.filter(v => calza(v.ruta, patron));

    if (r.tipo === 'pagina') {
      const hit = rutas.some(p => deRuta(p).length > 0);
      if (hit) out.push({ contactId, detalle: { rutas: rutas.filter(p => deRuta(p).length) } });
    }

    else if (r.tipo === 'repeticion') {
      const veces = Math.max(2, Number(cfg.veces) || 3);
      for (const p of rutas) {
        // Se cuentan DÍAS distintos, no visitas: cinco recargas en un minuto
        // son una sola sesión, no cinco evaluaciones.
        const dias = new Set(deRuta(p).map(v => v.created_at.slice(0, 10)));
        if (dias.size >= veces) { out.push({ contactId, detalle: { ruta: p, dias: dias.size } }); break; }
      }
    }

    else if (r.tipo === 'permanencia') {
      const min = Math.max(5, Number(cfg.segundos) || 60);
      const larga = vs.find(v => (v.segundos || 0) >= min && rutas.some(p => calza(v.ruta, p)));
      if (larga) out.push({ contactId, detalle: { ruta: larga.ruta, segundos: larga.segundos } });
    }

    else if (r.tipo === 'ausencia') {
      // Vio la página y NO ha vuelto al sitio en N días.
      const vio = vs.filter(v => rutas.some(p => calza(v.ruta, p)));
      if (!vio.length) continue;
      const ultimaVisita = vs[vs.length - 1];
      const diasSin = (Date.now() - Date.parse(ultimaVisita.created_at)) / 86400000;
      if (diasSin >= dias) out.push({ contactId, detalle: { ruta: vio[vio.length - 1].ruta, dias_sin_volver: Math.floor(diasSin) } });
    }

    else if (r.tipo === 'combinacion') {
      // TODAS las rutas, en cualquier orden, dentro de la ventana.
      const todas = rutas.every(p => deRuta(p).length > 0);
      if (todas) out.push({ contactId, detalle: { rutas } });
    }

    else if (r.tipo === 'secuencia') {
      // Las rutas EN ORDEN. El orden importa: producto→precios es alguien que
      // ya se convenció y va a ver el costo; precios→producto es alguien
      // viendo si le alcanza.
      let desde = 0, ok = true;
      const pasos: string[] = [];
      for (const p of rutas) {
        const i = vs.findIndex((v, idx) => idx >= desde && calza(v.ruta, p));
        if (i < 0) { ok = false; break; }
        pasos.push(vs[i].ruta);
        desde = i + 1;
      }
      if (ok && pasos.length === rutas.length) out.push({ contactId, detalle: { orden: pasos } });
    }
  }

  return out;
}

export interface Avance { reglas: number; evaluados: number; inscritos: number; saltados: Record<string, number> }

/**
 * Evalúa todas las reglas activas e inscribe a quien toca.
 * Las de mayor prioridad primero: así el "uno por recorrido" se resuelve solo.
 */
export async function evaluar(tenantId?: string): Promise<Avance> {
  const av: Avance = { reglas: 0, evaluados: 0, inscritos: 0, saltados: {} };
  const salta = (m: string) => { av.saltados[m] = (av.saltados[m] || 0) + 1; };

  let q = supabase.from('web_reglas').select('*').eq('estado', 'activa')
    .not('automation_id', 'is', null).order('prioridad', { ascending: false });
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data: reglas } = await q;
  if (!reglas?.length) return av;

  // Quién ya recibió algo hoy por ESTE camino: el "uno por recorrido".
  const hoyISO = new Date().toISOString().slice(0, 10);
  const { data: disparosHoy } = await supabase.from('web_disparos')
    .select('contact_id').eq('dia', hoyISO).limit(5000);
  const yaHoy = new Set((disparosHoy || []).map((d: any) => d.contact_id));

  for (const r of reglas as Regla[]) {
    av.reglas++;
    const lista = await candidatos(r);
    av.evaluados += lista.length;

    for (const { contactId, detalle } of lista) {
      if (yaHoy.has(contactId)) { salta('ya recibió hoy'); continue; }

      // Solo a quien está en el CRM con correo — regla 3 de la cabecera.
      const { data: c } = await supabase.from('contacts')
        .select('id, email, archived_at').eq('id', contactId).maybeSingle();
      if (!c?.email || c.archived_at) { salta('sin correo o archivado'); continue; }

      // Suprimido: no se le escribe ni aunque navegue el sitio entero.
      const { data: sup } = await supabase.from('email_suppressions')
        .select('id').eq('tenant_id', r.tenant_id).eq('email', c.email.toLowerCase())
        .is('restaurado_at', null).limit(1).maybeSingle();
      if (sup) { salta('dado de baja'); continue; }

      // Periodo de espera de ESTA regla para ESTA persona.
      const { data: previo } = await supabase.from('web_disparos')
        .select('created_at').eq('regla_id', r.id).eq('contact_id', contactId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (previo && (Date.now() - Date.parse(previo.created_at)) < r.espera_dias * 86400000) {
        salta('aún en periodo de espera'); continue;
      }

      // Ya va en camino en ese mismo embudo: no se le mete dos veces.
      const { data: yaEn } = await supabase.from('automation_enrollments')
        .select('id').eq('automation_id', r.automation_id!).eq('contact_id', contactId)
        .eq('estado', 'activo').limit(1).maybeSingle();
      if (yaEn) { salta('ya va en ese embudo'); continue; }

      const { data: primer } = await supabase.from('automation_steps')
        .select('id').eq('automation_id', r.automation_id!).is('parent_step_id', null)
        .eq('activo', true).order('orden').limit(1).maybeSingle();
      if (!primer) { salta('el embudo no tiene pasos'); continue; }

      // EL RETRASO: el correo no sale ahora, sale en N minutos.
      const cuando = new Date(Date.now() + Math.max(1, r.retraso_minutos) * 60000).toISOString();
      const { data: ins, error } = await supabase.from('automation_enrollments').insert({
        automation_id: r.automation_id, contact_id: contactId,
        current_step_id: primer.id, estado: 'activo', next_action_at: cuando,
        enrollment_trigger: { type: 'web', regla: r.nombre, regla_id: r.id, detalle },
      }).select('id').single();
      if (error) { salta('no se pudo inscribir'); continue; }

      // El disparo queda registrado ANTES de dar por bueno el ciclo: es el
      // candado anti-repetición, no solo el reporte.
      await supabase.from('web_disparos').insert({
        regla_id: r.id, contact_id: contactId, enrollment_id: ins?.id || null, detalle,
      }).then(() => {}, () => {});

      await supabase.from('web_reglas').update({ total_disparos: (r as any).total_disparos + 1 }).eq('id', r.id);
      yaHoy.add(contactId);
      av.inscritos++;
    }
  }
  return av;
}

/**
 * A cuánta gente habría alcanzado esta regla en los últimos N días.
 * Se usa ANTES de encenderla: un número por adelantado evita la regla que
 * dispara a todo el mundo.
 */
export async function simular(r: Omit<Regla, 'id' | 'activado_at'> & { activado_at?: string | null }, dias = 30): Promise<{ total: number; muestra: any[] }> {
  const fake = { ...r, id: '00000000-0000-0000-0000-000000000000', activado_at: hace(dias) } as Regla;
  const lista = await candidatos(fake);
  const ids = lista.slice(0, 12).map(x => x.contactId);
  const { data } = ids.length
    ? await supabase.from('contacts').select('id, nombre, apellido, email').in('id', ids)
    : { data: [] as any[] };
  return {
    total: lista.length,
    muestra: (data || []).map((c: any) => ({
      nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email,
      detalle: lista.find(x => x.contactId === c.id)?.detalle,
    })),
  };
}
