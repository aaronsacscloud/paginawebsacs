// CONOCIMIENTO DEL AGENTE · el selector: arma el contexto que el agente lee
// en ESTE turno para ESTE lead. No se le da toda la base: se le da la ficha
// de su giro, los planes (solo licencia), los módulos que tocan su pregunta
// y el caso que le habla. Así el prompt se queda chico y la respuesta,
// específica.
import { GIROS, giroPorId, detectarGiro, fichaGiroTexto, type FichaGiro } from './giros.ts';
import { planesTexto } from './planes.ts';
import { modulosRelevantes, moduloTexto } from './producto.ts';
import { casoPorId, casosParaGiro, casoTexto } from './casos.ts';

export { GIROS, giroPorId, detectarGiro };

export type EntradaContexto = {
  /** Giro ya conocido del CRM (texto libre: «Ropa y moda», «joyería»…) o null. */
  giroCrm?: string | null;
  /** La conversación (o su tramo reciente) para detectar giro y tema. */
  conversacion: string;
  /** El último mensaje del lead: manda sobre qué módulos traer. */
  ultimoMensaje: string;
};

export function resolverGiro(e: EntradaContexto): FichaGiro | null {
  return detectarGiro(e.giroCrm || '') || detectarGiro(e.conversacion) || null;
}

/** El bloque de conocimiento para el prompt del agente. */
export function contextoParaLead(e: EntradaContexto): { texto: string; giro: FichaGiro | null; modulos: string[] } {
  const giro = resolverGiro(e);
  const mods = modulosRelevantes(giro?.id || null, `${e.ultimoMensaje} ${e.conversacion.slice(-600)}`);
  const caso = giro ? (casoPorId(giro.caso) || casosParaGiro(giro.id)[0] || null) : null;
  const partes = [
    giro ? fichaGiroTexto(giro) : `GIRO DEL LEAD: todavía no lo sabemos. Sacs es SOLO para retail de moda (ropa, boutique multimarca, consignación y segunda mano, merch de eventos, novias y fiesta, activewear, zapaterías, joyerías). Tu primera tarea es averiguar qué vende; si no es moda ni calzado ni joyería, dilo con honestidad.`,
    `LO QUE SACS HACE Y LE SIRVE A ESTE LEAD:\n${mods.map(moduloTexto).join('\n')}`,
    caso ? casoTexto(caso) : '',
    `PLANES Y PRECIOS DE LICENCIA:\n${planesTexto()}`,
  ].filter(Boolean);
  return { texto: partes.join('\n\n'), giro, modulos: mods.map(m => m.id) };
}
