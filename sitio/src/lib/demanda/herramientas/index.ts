// DEMAND ENGINE · el registro de las herramientas públicas.
//
// `definirHerramienta` se ejecuta al importar cada archivo, así que el registro
// solo existe si alguien importó los módulos. Este barril es ese «alguien»: las
// tres puertas (web, MCP, API) importan de aquí y ninguna necesita saber qué
// herramientas hay ni en qué archivo viven.
//
// Importar la herramienta DIRECTO desde una puerta es el error que este archivo
// previene: la puerta funcionaría para esa y estaría vacía para las demás.
import './curva';

export { herramientas, herramientaDe, invocar } from '../herramienta';
export type { Herramienta, Puerta, Contexto, Resultado } from '../herramienta';
