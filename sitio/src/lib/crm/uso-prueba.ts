/**
 * ¿ESTÁ USANDO EL SISTEMA? — la calificación de una cuenta en prueba.
 *
 * En la lista de "En prueba" el dato que decide todo es si la persona de verdad
 * entró a trabajar o solo abrió la cuenta. Sin eso, la lista son nombres con
 * fechas y hay que abrir cada uno para enterarse — o peor, llamarle a alguien
 * que ya vendió cien tickets como si no hubiera empezado.
 *
 * Se calcula sobre `companies.uso_sacs`, el espejo que ya sincroniza el puente
 * con SACS. NO consulta SACS en vivo: eso sería una petición por lead cada vez
 * que se pinta la lista.
 *
 * LOS CUATRO PEDAZOS, y por qué pesan así:
 *
 *  · VENDER (4 pts) es la prueba de fuego. Alguien que emitió un ticket ya pasó
 *    por producto, precio y cobro: es el único hecho que demuestra que el
 *    sistema le sirve. Se mide en los últimos 7 días, no "alguna vez": una
 *    venta de hace un mes en una prueba de dos semanas no dice nada de hoy.
 *  · CERRAR CAJA (2 pts) es el segundo día. Cortar caja significa que llegó al
 *    final de una jornada real, no que probó una pantalla.
 *  · CARGAR SU OPERACIÓN (2 pts) —clientes, inventario, proveedores— es el
 *    trabajo aburrido que nadie hace "por probar". Quien lo hizo, se está
 *    mudando de verdad.
 *  · AMPLITUD (2 pts): cuántas familias distintas tocó. Uno que solo vende está
 *    probando el POS; uno que además factura y controla inventario está
 *    adoptando el sistema.
 *
 * Devuelve 0 cuando NO tocó nada, y eso es información, no un hueco: es la
 * cuenta a la que hay que llamarle hoy.
 */
export interface Calificacion {
  nota: number;            // 0-10
  motivos: string[];       // qué sumó, en palabras
  vendio7d: number;        // documentos de venta en 7 días
  cortes: boolean;
  ultimoUso: string | null;
}

const FAM_OPERACION = ['Clientes', 'Inventario', 'Administración'];

export function calificarUso(uso: any): Calificacion {
  const mods: any[] = Array.isArray(uso?.modulos) ? uso.modulos : [];
  const vacia: Calificacion = { nota: 0, motivos: [], vendio7d: 0, cortes: false, ultimoUso: null };
  if (!mods.length) return vacia;

  const suma = (f: (m: any) => boolean, campo: string) =>
    mods.filter(f).reduce((a, m) => a + (Number(m[campo]) || 0), 0);

  const ventas7 = suma(m => m.familia === 'Ventas', 'docs_7d');
  const ventas30 = suma(m => m.familia === 'Ventas', 'docs_30d');
  const cortes = mods.some(m => m.familia === 'Cortes' && m.usa);
  const operacion = FAM_OPERACION.filter(f => mods.some(m => m.familia === f && m.usa)).length;
  const familias = [...new Set(mods.filter(m => m.usa).map(m => m.familia))].length;
  const ultimoUso = mods.filter(m => m.ultimo).map(m => String(m.ultimo)).sort().pop() || null;

  let nota = 0;
  const motivos: string[] = [];

  // Vender: la escala sube rápido al principio porque el salto que importa es
  // de CERO a UNA venta; de 40 a 80 tickets ya no cambia la decisión.
  if (ventas7 >= 20) { nota += 4; motivos.push(`${ventas7} ventas esta semana`); }
  else if (ventas7 >= 5) { nota += 3; motivos.push(`${ventas7} ventas esta semana`); }
  else if (ventas7 >= 1) { nota += 2; motivos.push(`${ventas7} ${ventas7 === 1 ? 'venta' : 'ventas'} esta semana`); }
  else if (ventas30 >= 1) { nota += 1; motivos.push(`${ventas30} ventas el mes pasado, ninguna esta semana`); }

  if (cortes) { nota += 2; motivos.push('cerró caja'); }
  if (operacion >= 2) { nota += 2; motivos.push('cargó su operación'); }
  else if (operacion === 1) { nota += 1; motivos.push('empezó a cargar datos'); }

  if (familias >= 4) { nota += 2; motivos.push(`${familias} áreas del sistema`); }
  else if (familias >= 2) { nota += 1; motivos.push(`${familias} áreas del sistema`); }

  return { nota: Math.max(0, Math.min(10, nota)), motivos, vendio7d: ventas7, cortes, ultimoUso };
}

/** El color de la nota: rojo lo que hay que rescatar, verde lo que ya prendió. */
export function colorNota(n: number): string {
  if (n === 0) return '#C0554E';
  if (n <= 3) return '#9a6a10';
  if (n <= 6) return '#2C5FC4';
  return '#1E8A63';
}
