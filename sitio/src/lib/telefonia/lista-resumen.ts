/* ══ LA LISTA COMO TABLERO DE CONTROL (22-sep-2026) ═════════════════════════
 *
 * Pedido del dueño: «que la lista de llamadas sea muy efectiva para llevar el
 * control de las personas a las que les llamo: saber a quién ya se le da
 * seguimiento, quién respondió, el resultado completo de la lista, cuántos
 * siguen sin contestar, las rondas que se llevan; ejecutar ronda 2 o 3 a los
 * que nunca contestaron, y acciones masivas (descalificarlos, etc.)».
 *
 * UNA LISTA = la sesión original + todas sus rondas. Cada ronda es una sesión
 * nueva (así pasa por los mismos candados al armarse: vetados, con acción,
 * repetidos) colgada de la original por `origen.lista_raiz` (y, en las viejas,
 * por `origen.relanzar_de`, que ya apuntaba a la raíz).
 *
 * Por PERSONA (mismo número = misma persona) se junta lo que pasó en cada
 * ronda y se decide en qué quedó, en este orden de fuerza:
 *   acción (cita / seguimiento / oportunidad / cliente) > descalificado >
 *   contestó > buzón > contestadora > nunca contestó > sin marcar > fuera.
 */
import { supabase } from '../supabase';
import { cargarConAccion, accionDe, cargarVetos, vetoDe } from './veto';
import { telefonoWhatsApp } from '../telefono';

export type Grupo = 'accion' | 'descalificado' | 'contesto' | 'buzon' | 'contestadora' | 'nunca' | 'sin_marcar' | 'fuera';
export const GRUPOS: { id: Grupo; label: string; que: string }[] = [
  { id: 'accion', label: 'Con cita o seguimiento', que: 'ya hay un proceso en marcha: se les llama en su fecha' },
  { id: 'contesto', label: 'Contestaron sin acción', que: 'hablaron pero no quedó cita ni seguimiento' },
  { id: 'descalificado', label: 'Descalificados', que: 'no les interesa o se descartaron' },
  { id: 'buzon', label: 'Buzón', que: 'nunca contestó una persona: cayó al buzón' },
  { id: 'contestadora', label: 'Contestadora', que: 'contestó un asistente o filtro de llamadas' },
  { id: 'nunca', label: 'Nunca contestaron', que: 'sólo timbró u ocupado, en todas las rondas' },
  { id: 'sin_marcar', label: 'Sin marcar', que: 'todavía no se les llama' },
  { id: 'fuera', label: 'Fuera de la lista', que: 'quitados, vetados o número inválido' },
];

const tel10 = (t?: string | null) => String(t || '').replace(/\D/g, '').slice(-10);
const HABLO = new Set(['contesto', 'dieron_datos', 'volver_llamar', 'interesado', 'agendado', 'no_interesa']);

/** La raíz de la lista y todas sus sesiones, en orden (ronda 1, 2, 3…). */
export async function sesionesDeLista(sesionId: string): Promise<{ raiz: any; rondas: any[] }> {
  const { data: s } = await supabase.from('tel_sesiones').select('id, nombre, origen, created_at').eq('id', sesionId).maybeSingle();
  if (!s) throw new Error('No existe la sesión');
  const raizId = String((s.origen as any)?.lista_raiz || (s.origen as any)?.relanzar_de || s.id);
  const { data: raiz } = await supabase.from('tel_sesiones').select('id, nombre, origen, created_at, estado').eq('id', raizId).maybeSingle();
  const { data: hijas } = await supabase.from('tel_sesiones').select('id, nombre, origen, created_at, estado')
    .or(`origen->>lista_raiz.eq.${raizId},origen->>relanzar_de.eq.${raizId}`).neq('id', raizId).order('created_at').limit(20);
  return { raiz: raiz || s, rondas: [raiz || s, ...(hijas || [])] };
}

export async function resumenLista(sesionId: string) {
  const { raiz, rondas } = await sesionesDeLista(sesionId);
  const ids = rondas.map(r => r.id);
  const items: any[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('tel_sesion_items')
      .select('id, sesion_id, contact_id, nombre, empresa, telefono, estado, resultado, veredicto, duracion_seg, motivo_exclusion, marcado_at')
      .in('sesion_id', ids).order('id').range(desde, desde + 999);
    if (error) throw new Error(error.message);
    items.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  const [conAccion, vetos] = await Promise.all([cargarConAccion(), cargarVetos()]);
  const rondaDe = new Map(rondas.map((r, i) => [r.id, i + 1]));
  const personas = new Map<string, any>();
  for (const it of items) {
    const k = tel10(it.telefono) || it.contact_id || it.id;
    const p = personas.get(k) || { clave: k, contact_id: null, nombre: null, empresa: null, telefono: it.telefono, intentos: [] as any[] };
    p.contact_id = p.contact_id || it.contact_id; p.nombre = p.nombre || it.nombre; p.empresa = p.empresa || it.empresa;
    p.intentos.push({ ronda: rondaDe.get(it.sesion_id) || 1, estado: it.estado, resultado: it.resultado, veredicto: it.veredicto, seg: it.duracion_seg || 0, motivo: it.motivo_exclusion || null });
    personas.set(k, p);
  }
  const salida: any[] = [];
  for (const p of personas.values()) {
    p.intentos.sort((a: any, b: any) => a.ronda - b.ronda);
    const hechos = p.intentos.filter((x: any) => x.estado === 'hecho' || x.estado === 'saltado' || x.estado === 'cierre');
    const hablo = hechos.some((x: any) => HABLO.has(String(x.resultado)) || (x.veredicto === 'persona' && Number(x.seg) > 20));
    const dijoNo = hechos.some((x: any) => x.resultado === 'no_interesa');
    const buzon = hechos.some((x: any) => x.resultado === 'buzon');
    const portero = hechos.some((x: any) => x.resultado === 'portero');
    const timbro = hechos.some((x: any) => ['no_contesto', 'ocupado', 'colgo_rapido'].includes(String(x.resultado)));
    const pendiente = p.intentos.some((x: any) => x.estado === 'pendiente' || x.estado === 'marcando' || x.estado === 'timbrando');
    const accion = accionDe(conAccion, { contact_id: p.contact_id, telefono: p.telefono });
    const veto = vetoDe(vetos, { contact_id: p.contact_id, telefono: p.telefono });
    let grupo: Grupo;
    if (accion && !/descalific|perdido/.test(accion)) grupo = 'accion';
    else if (veto?.motivo === 'descalificado' || dijoNo || (accion && /descalific|perdido/.test(accion))) grupo = 'descalificado';
    else if (hablo) grupo = 'contesto';
    else if (buzon) grupo = 'buzon';
    else if (portero) grupo = 'contestadora';
    else if (timbro) grupo = 'nunca';
    else if (pendiente) grupo = 'sin_marcar';
    else grupo = 'fuera';
    salida.push({
      clave: p.clave, contact_id: p.contact_id, nombre: p.nombre, empresa: p.empresa, telefono: p.telefono, grupo,
      accion: accion || (veto ? veto.texto : null),
      rondas: p.intentos.map((x: any) => ({ ronda: x.ronda, r: x.estado === 'excluido' ? 'fuera' : x.estado === 'pendiente' ? 'pendiente' : (x.resultado || x.estado) })),
      intentos_hechos: hechos.length,
    });
  }
  const conteo = Object.fromEntries(GRUPOS.map(g => [g.id, salida.filter(x => x.grupo === g.id).length]));
  const orden = new Map(GRUPOS.map((g, i) => [g.id, i]));
  salida.sort((a, b) => (orden.get(a.grupo)! - orden.get(b.grupo)!) || String(a.nombre || '').localeCompare(String(b.nombre || '')));
  return {
    raiz: { id: raiz.id, nombre: raiz.nombre },
    rondas: rondas.map((r, i) => ({ id: r.id, n: i + 1, nombre: r.nombre, estado: r.estado, fecha: r.created_at })),
    total: salida.length, conteo, grupos: GRUPOS, personas: salida,
  };
}

/** Ronda N+1 con los grupos elegidos. Es una sesión nueva colgada de la raíz:
 *  así pasa por todos los candados de `crearSesion` (vetados, con acción…). */
export async function nuevaRonda(sesionId: string, ownerId: string | null, grupos: Grupo[], claves?: string[]) {
  const r = await resumenLista(sesionId);
  const { data: s } = await supabase.from('tel_sesiones').select('*').eq('id', sesionId).maybeSingle();
  if (!s) throw new Error('No existe la sesión');
  const elegidos = r.personas.filter((p: any) => claves?.length ? claves.includes(p.clave) : grupos.includes(p.grupo));
  if (!elegidos.length) throw new Error('No hay a quién llamar con esa selección');
  const n = r.rondas.length + 1;
  const { crearSesion } = await import('./marcador');
  const raizOrigen: any = (await supabase.from('tel_sesiones').select('origen').eq('id', r.raiz.id).maybeSingle()).data?.origen || {};
  return crearSesion(ownerId, {
    nombre: `${r.raiz.nombre} · ronda ${n}`,
    origen: { ...raizOrigen, lista_raiz: r.raiz.id, relanzar_de: r.raiz.id, ronda: n, grupos },
    items: elegidos.map((p: any) => ({ contact_id: p.contact_id, nombre: p.nombre, empresa: p.empresa, telefono: p.telefono })),
    presentacion_nombre: s.presentacion_nombre, presentacion_motivo: s.presentacion_motivo, buzon_dejar_mensaje: s.buzon_dejar_mensaje, config: s.config,
    modo: s.modo,
  });
}

/** Acciones masivas sobre personas de la lista. Devuelve cuántas salieron bien y por qué no las demás. */
export async function accionMasiva(o: { accion: 'descalificar' | 'no_llamar' | 'plantilla'; personas: { contact_id?: string | null; telefono?: string | null; nombre?: string | null }[]; plantilla?: string; motivo?: string; autor?: string | null }) {
  const res = { ok: 0, fallas: [] as string[] };
  const lista = o.personas.slice(0, 300);
  if (o.accion === 'descalificar') {
    const { aplicarRechazo } = await import('../crm/ti/agente');
    for (const p of lista) {
      if (!p.contact_id) { res.fallas.push(`${p.nombre || p.telefono}: no es contacto del CRM (viene de prospección)`); continue; }
      try { await aplicarRechazo(p.contact_id, o.motivo || 'descalificado desde la lista de llamadas'); res.ok++; }
      catch (e: any) { res.fallas.push(`${p.nombre || p.telefono}: ${String(e?.message || e).slice(0, 80)}`); }
    }
  } else if (o.accion === 'no_llamar') {
    const ids = lista.map(p => p.contact_id).filter(Boolean) as string[];
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await supabase.from('contacts').update({ no_llamar: true }).in('id', ids.slice(i, i + 150));
      if (!error) res.ok += ids.slice(i, i + 150).length;
    }
    const sinContacto = lista.filter(p => !p.contact_id).length;
    if (sinContacto) res.fallas.push(`${sinContacto} de prospección: no tienen contacto en el CRM`);
  } else if (o.accion === 'plantilla') {
    if (!o.plantilla || !/^[a-z0-9_]{1,80}$/.test(o.plantilla)) throw new Error('Elige la plantilla');
    const { mandarPlantilla } = await import('../whatsapp/plantilla-espejo');
    for (const p of lista) {
      const tel = telefonoWhatsApp(p.telefono);
      if (!tel) { res.fallas.push(`${p.nombre || p.telefono}: teléfono no sirve para WhatsApp`); continue; }
      const primer = String(p.nombre || '').trim().split(/\s+/)[0] || 'qué tal';
      try {
        const r = await mandarPlantilla({ telefono: tel, plantilla: o.plantilla, params: [primer], autor: o.autor || 'Lista de llamadas', metadata: { lista_llamadas: true } });
        if (r.enviado) res.ok++; else res.fallas.push(`${p.nombre || tel}: ${r.motivo || 'no salió'}`);
      } catch (e: any) { res.fallas.push(`${p.nombre || tel}: ${String(e?.message || e).slice(0, 80)}`); }
    }
  }
  return res;
}

/** Plantillas aprobadas de UNA variable (el nombre) que tienen sentido tras llamar. */
export async function plantillasDeLista() {
  const { data } = await supabase.from('wa_plantillas').select('nombre, categoria, cuerpo').eq('status', 'APPROVED').limit(300);
  const vistos = new Set<string>();
  return (data || []).filter((p: any) => /^(llamada_saliente_|seguimiento_vio_info|solicitud_informacion_seguimiento|seguimiento_sigue_buscando|ti_info_utility_v1|pendiente_retomar|contacto_seguimiento)/.test(p.nombre)
    && (String(p.cuerpo || '').match(/\{\{\d+\}\}/g) || []).length <= 1 && !vistos.has(p.nombre) && vistos.add(p.nombre))
    .map((p: any) => ({ nombre: p.nombre, categoria: p.categoria, cuerpo: p.cuerpo }));
}
