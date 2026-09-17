// DEMAND ENGINE · el ciclo.
//
// Un ciclo es una corrida completa del motor: abre, arma su cadena de trabajo
// en la cola, y cierra cuando ese trabajo terminó, dejando escrito qué pasó,
// cuánto costó y cuáles son las cinco cosas que siguen.
//
// La cadena NO es una lista fija de pasos. Se arma con lo que hoy existe: los
// conectores que están encendidos y los tipos de acción que ya tienen handler.
// Así el ciclo crece solo conforme avanzan las etapas, en vez de encolar
// trabajo para piezas que todavía no se construyeron.
import { supabase } from '../supabase';
import { encolarVarias } from './cola';
import { leerConfig, presupuesto } from './config';
import { hayHandler } from './handlers';
import { refrescarDisponibilidad } from './conectores';
import { diaCdmx } from './fechas';
import type { Config, EntradaAccion } from './tipos';

export type TipoCiclo = 'diario' | 'semanal' | 'mensual' | 'evento' | 'manual';

export async function abrirCiclo(tipo: TipoCiclo, objetivo?: string, simulacion = false): Promise<{ id: string; nuevo: boolean }> {
  const clave = `ciclo:${tipo}:${diaCdmx()}${simulacion ? ':sim' : ''}`;
  const ya = await supabase.from('de_ciclos').select('id').eq('clave_idem', clave).maybeSingle();
  if (ya.data) return { id: ya.data.id, nuevo: false };

  const { data, error } = await supabase.from('de_ciclos').insert({
    tipo, clave_idem: clave, objetivo: objetivo || null, simulacion, estado: 'corriendo',
  }).select('id').single();
  if (error) {
    const otra = await supabase.from('de_ciclos').select('id').eq('clave_idem', clave).maybeSingle();
    if (otra.data) return { id: otra.data.id, nuevo: false };
    throw new Error(`[ciclo] no se pudo abrir: ${error.message}`);
  }
  return { id: data.id, nuevo: true };
}

/** Las fases del ciclo, en orden, con la prioridad que le toca a cada una.
 *  Prioridad alta = se atiende antes cuando el worker tiene poco tiempo. */
const FASES: { tipo: string; prioridad: number; solo?: TipoCiclo[] }[] = [
  { tipo: 'normalizar',          prioridad: 70 },
  { tipo: 'agrupar',             prioridad: 68 },
  { tipo: 'clasificar',          prioridad: 66 },
  { tipo: 'detectar.seo',        prioridad: 64 },
  { tipo: 'detectar.decay',      prioridad: 62 },
  { tipo: 'detectar.competidor', prioridad: 60 },
  { tipo: 'ingerir.sitio',       prioridad: 76, solo: ['semanal'] },
  { tipo: 'detectar.tecnico',    prioridad: 58 },
  { tipo: 'geo.muestrear',       prioridad: 57 },
  { tipo: 'geo.score',           prioridad: 56 },
  { tipo: 'puntuar',             prioridad: 54 },
  { tipo: 'oportunidad.crear',   prioridad: 53 },
  { tipo: 'metricas.calcular',   prioridad: 52 },
  { tipo: 'atribucion.procesar', prioridad: 50 },
  { tipo: 'aprender.evaluar',    prioridad: 48 },
  /* La revisión de autonomía va al FINAL del ciclo y todos los días, no solo el
     mensual. La parte que baja el nivel es automática: un freno que hay que
     acordarse de pisar no es un freno, y catorce días es demasiado tiempo para
     que un tipo de acción que el dueño viene rechazando siga corriendo solo. */
  { tipo: 'autonomia.revisar',   prioridad: 47 },
  /* Las órdenes de trabajo de repositorio se rehacen SEMANALMENTE, no a diario.
     El operador es una persona (o una sesión) que trabaja por tandas: una cola
     que se reescribe cada mañana convierte «tengo 7 tareas» en «tengo 7 tareas
     distintas cada día», y eso no es una cola, es ruido. */
  { tipo: 'codigo.proponer',     prioridad: 45, solo: ['semanal'] },
  { tipo: 'aprender.recalibrar', prioridad: 46, solo: ['mensual'] },
];

/** ¿A este conector le toca hoy? */
function tocaHoy(cadencia: string, tipo: TipoCiclo): boolean {
  if (tipo === 'manual' || tipo === 'evento') return cadencia === 'diaria';
  if (cadencia === 'diaria') return true;
  if (cadencia === 'semanal') return tipo === 'semanal' || tipo === 'mensual';
  if (cadencia === 'mensual') return tipo === 'mensual';
  return false;
}

/**
 * Arma la cadena del ciclo. Devuelve qué se encoló y qué NO se pudo encolar y
 * por qué — que es la mitad útil: un ciclo que no hizo nada tiene que decir si
 * fue porque no había trabajo o porque le falta una llave.
 */
export async function armarCadena(ciclo_id: string, tipo: TipoCiclo, cfg?: Config) {
  const c = cfg || await leerConfig();
  const dia = diaCdmx();
  const pres = await presupuesto(c);

  // Antes de decidir a quién llamar, comprobar quién PUEDE contestar.
  await refrescarDisponibilidad();
  const { data: conectores } = await supabase
    .from('de_conectores').select('*').order('orden');

  const acciones: EntradaAccion[] = [];
  const omitidos: { id: string; por_que: string }[] = [];

  for (const k of conectores || []) {
    const t = `ingerir.${k.id}`;
    if (!k.activo)      { omitidos.push({ id: k.id, por_que: 'apagado en Ajustes' }); continue; }
    if (!k.disponible)  { omitidos.push({ id: k.id, por_que: k.falta || 'falta credencial' }); continue; }
    if (!hayHandler(t)) { omitidos.push({ id: k.id, por_que: 'todavía no construido' }); continue; }
    if (!tocaHoy(k.cadencia, tipo)) { omitidos.push({ id: k.id, por_que: `cadencia ${k.cadencia}` }); continue; }
    // Con el presupuesto agotado solo entra lo de primera mano: es gratis y es
    // lo que más vale. Apagarse del todo sería peor que ser selectivo.
    if (pres.agotado && k.grupo !== 'first_party') { omitidos.push({ id: k.id, por_que: 'presupuesto del mes agotado' }); continue; }
    acciones.push({ tipo: t, clave_idem: `${t}:${dia}`, prioridad: 80, ciclo_id, payload: { conector: k.id, dia } });
  }

  for (const f of FASES) {
    if (f.solo && !f.solo.includes(tipo)) continue;
    if (!hayHandler(f.tipo)) continue;
    acciones.push({ tipo: f.tipo, clave_idem: `${f.tipo}:${dia}`, prioridad: f.prioridad, ciclo_id, payload: { dia, ciclo: tipo } });
  }

  // El cierre entra siempre y se espera a sí mismo: mientras quede trabajo del
  // ciclo vivo, se reprograma en vez de cerrar un resumen a medias.
  acciones.push({
    tipo: 'sistema.cerrar_ciclo', clave_idem: `cerrar:${tipo}:${dia}`, prioridad: 10, ciclo_id,
    programada_at: new Date(Date.now() + 8 * 60 * 1000), payload: { ciclo_id, tipo, dia },
  });

  const r = await encolarVarias(acciones, c);
  await supabase.from('de_ciclos').update({
    acciones_creadas: r.nuevas,
    resumen: { armado: { encoladas: r.nuevas, repetidas: r.repetidas, frenadas: r.frenadas, omitidos } },
  }).eq('id', ciclo_id);

  return { ...r, omitidos, total: acciones.length };
}
