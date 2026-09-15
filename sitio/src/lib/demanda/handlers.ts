// DEMAND ENGINE · registro de handlers.
//
// Cada tipo de acción tiene aquí su ejecutor. El registro es explícito a
// propósito: el ciclo solo encola tipos que YA tienen handler, así una etapa a
// medio construir no llena la cola de trabajo que nadie puede hacer.
import { supabase } from '../supabase';
import { notificar } from '../crm/notificaciones';
import { leerConfig, presupuesto } from './config';
import { resumenCola } from './cola';
import { diaCdmx } from './fechas';
import type { Handler, ResultadoHandler } from './tipos';

const REGISTRO: Record<string, Handler> = {};

export function registrar(tipo: string, h: Handler) { REGISTRO[tipo] = h; }
export function hayHandler(tipo: string): boolean { return !!REGISTRO[tipo]; }
export function handlerDe(tipo: string): Handler | null { return REGISTRO[tipo] || null; }
export function tiposRegistrados(): string[] { return Object.keys(REGISTRO).sort(); }

// ── sistema.noop ────────────────────────────────────────────────────────────
// Prueba de vida de la cola. Sirve para verificar el carril completo —tomar,
// ejecutar, terminar— sin tocar ningún dato real. `fallar: true` en el payload
// la hace fracasar a propósito: así se prueba el reintento y la cola muerta.
registrar('sistema.noop', async (a): Promise<ResultadoHandler> => {
  if (a.payload?.fallar) throw new Error(a.payload.mensaje || 'fallo de prueba');
  return { ok: true, resumen: a.payload?.eco ? String(a.payload.eco) : 'sin novedad' };
});

// ── sistema.ciclo ───────────────────────────────────────────────────────────
registrar('sistema.ciclo', async (a, ctx): Promise<ResultadoHandler> => {
  const { abrirCiclo, armarCadena } = await import('./ciclo');
  const tipo = (a.payload?.tipo || 'diario') as any;
  const { id, nuevo } = await abrirCiclo(tipo, a.payload?.objetivo, ctx.cfg.modo === 'simulacion');
  const r = await armarCadena(id, tipo, ctx.cfg);
  return {
    ok: true,
    resumen: `ciclo ${tipo} ${nuevo ? 'abierto' : 'ya estaba'} · ${r.nuevas} acciones`,
    datos: { ciclo_id: id, ...r },
  };
});

// ── sistema.cerrar_ciclo ────────────────────────────────────────────────────
// Espera a que el ciclo termine de verdad antes de escribir el resumen. Un
// resumen a medias es peor que no tenerlo: se lee como si fuera el final.
registrar('sistema.cerrar_ciclo', async (a): Promise<ResultadoHandler> => {
  const ciclo_id = a.payload?.ciclo_id;
  if (!ciclo_id) return { ok: false, resumen: 'sin ciclo', definitivo: true };

  const { data: ciclo } = await supabase.from('de_ciclos').select('*').eq('id', ciclo_id).maybeSingle();
  if (!ciclo) return { ok: false, resumen: 'el ciclo ya no existe', definitivo: true };

  const { data: acciones } = await supabase
    .from('de_acciones').select('id, tipo, estado, costo_usd, resultado, error').eq('ciclo_id', ciclo_id);

  const vivas = (acciones || []).filter(x =>
    ['pendiente', 'lista', 'corriendo', 'aprobada'].includes(x.estado) && x.id !== a.id);
  const edadMin = (Date.now() - new Date(ciclo.inicio).getTime()) / 60000;

  // Todavía hay trabajo: vuelve a mirar en diez minutos. Techo de 6 horas para
  // que un atasco no deje el ciclo abierto para siempre.
  if (vivas.length > 0 && edadMin < 360) {
    return { ok: true, resumen: `esperando ${vivas.length} acción(es)`, reprogramar_en_seg: 600 };
  }

  const ok = (acciones || []).filter(x => x.estado === 'terminada').length;
  const mal = (acciones || []).filter(x => ['muerta', 'fallida'].includes(x.estado)).length;
  const esperando = (acciones || []).filter(x => x.estado === 'necesita_aprobacion').length;
  const costo = (acciones || []).reduce((s, x) => s + Number(x.costo_usd || 0), 0);

  // TOP 5: lo que sigue. Mientras no exista el backlog de oportunidades (E1),
  // lo honesto es decir qué falta para que el motor pueda proponer algo.
  const top5 = await proponerTop5();

  const resumen = {
    ...(ciclo.resumen || {}),
    cierre: {
      acciones: (acciones || []).length, ok, fallidas: mal, esperando_aprobacion: esperando,
      costo_usd: Number(costo.toFixed(6)), minutos: Math.round(edadMin),
      colgadas: vivas.length,
    },
  };

  await supabase.from('de_ciclos').update({
    fin: new Date().toISOString(),
    estado: vivas.length > 0 ? 'parcial' : (mal > 0 ? 'parcial' : 'ok'),
    acciones_ok: ok, acciones_fallidas: mal, costo_usd: costo, resumen, top5,
  }).eq('id', ciclo_id);

  await notificar({
    clave: `de_ciclo:${ciclo_id}`, tipo: 'demanda_ciclo', nivel: mal > 0 ? 'alerta' : 'info',
    titulo: `Motor de demanda · ciclo ${ciclo.tipo}`,
    detalle: `${ok} hechas${mal ? `, ${mal} fallidas` : ''}${esperando ? `, ${esperando} esperando tu OK` : ''} · $${costo.toFixed(4)}`,
    destino: 'de-resumen',
  });

  return { ok: true, resumen: `ciclo cerrado: ${ok} ok, ${mal} mal`, datos: resumen.cierre };
});

/** Las cinco cosas que siguen. En la etapa 0 el motor todavía no tiene
 *  oportunidades que ordenar, así que dice la verdad: qué le falta para
 *  poder proponer. Es la misma función que en E1 leerá `de_oportunidades`. */
async function proponerTop5(): Promise<any[]> {
  const { data: faltantes } = await supabase
    .from('de_conectores').select('id, nombre, falta, impacto, activo, disponible')
    .or('activo.eq.false,disponible.eq.false').order('orden').limit(5);
  return (faltantes || []).map((k, i) => ({
    orden: i + 1, tipo: 'conectar_fuente', titulo: `Conectar ${k.nombre}`,
    por_que: k.impacto, falta: k.falta || (k.activo ? 'falta credencial' : 'está apagado en Ajustes'),
  }));
}

// ── sistema.salud ───────────────────────────────────────────────────────────
// El latido. Un motor autónomo que no puede decir «no estoy corriendo» no es
// autónomo: es invisible.
registrar('sistema.salud', async (): Promise<ResultadoHandler> => {
  const cfg = await leerConfig(true);
  const pres = await presupuesto(cfg);
  const cola = await resumenCola();
  const incidencias: { nivel: string; que: string }[] = [];

  const { data: ultimo } = await supabase
    .from('de_ciclos').select('tipo, inicio, estado').eq('tipo', 'diario').order('inicio', { ascending: false }).limit(1).maybeSingle();
  const horas = ultimo ? (Date.now() - new Date(ultimo.inicio).getTime()) / 3600000 : 999;
  if (horas > 30) incidencias.push({ nivel: 'alerta', que: ultimo ? `el ciclo diario no corre desde hace ${Math.round(horas)} h` : 'nunca ha corrido un ciclo diario' });

  const { data: rotos } = await supabase.from('de_conectores').select('id, nombre, fallos_seguidos').gte('fallos_seguidos', 3);
  for (const k of rotos || []) incidencias.push({ nivel: 'alerta', que: `${k.nombre} lleva ${k.fallos_seguidos} fallos seguidos` });

  if ((cola.muerta || 0) > 0) incidencias.push({ nivel: 'alerta', que: `${cola.muerta} acción(es) en la cola muerta` });
  if (pres.agotado) incidencias.push({ nivel: 'urgente', que: `presupuesto del mes agotado ($${pres.gastado.toFixed(2)} de $${pres.tope})` });
  else if (pres.restringido) incidencias.push({ nivel: 'alerta', que: `${pres.pct}% del presupuesto del mes` });
  if (cfg.kill_switch) incidencias.push({ nivel: 'urgente', que: 'el motor está apagado (kill switch)' });

  const score = Math.max(0, 100 - incidencias.reduce((s, i) => s + (i.nivel === 'urgente' ? 40 : 15), 0));
  await supabase.from('de_salud').upsert({
    fecha: diaCdmx(), score,
    detalle: { cola, presupuesto: pres, ultimo_ciclo: ultimo || null, autonomia: cfg.autonomia_global },
    incidencias,
  }, { onConflict: 'fecha' });

  const urgentes = incidencias.filter(i => i.nivel === 'urgente');
  if (urgentes.length) {
    await notificar({
      clave: `de_salud:${diaCdmx()}`, tipo: 'demanda_salud', nivel: 'urgente',
      titulo: 'El motor de demanda necesita atención',
      detalle: urgentes.map(i => i.que).join(' · '), destino: 'de-sistema',
    });
  }
  return { ok: true, resumen: `salud ${score}/100${incidencias.length ? ` · ${incidencias.length} incidencia(s)` : ''}`, datos: { score, incidencias } };
});
