// ─── Nombre comercial a partir de la cuenta SACS ────────────────────────────
//
// Las cuentas se registran pegadas y en minúsculas —"supercarnesriveramx"— y
// eso es lo que se ve en la lista de clientes. Aquí se parte en palabras cuando
// se puede: "Super Carnes Rivera".
//
// Regla de oro: NUNCA inventar. Si no se reconocen las palabras —"meraki",
// "kbiu", "surtex"— se devuelve la cuenta tal cual con la primera letra en
// mayúscula. Un nombre partido mal ("Sup Er Carnes") es peor que el slug.
//
// La partición busca la que use MENOS palabras: tomar la primera que quepa
// produce cortes absurdos, porque casi cualquier cadena empieza con una palabra
// corta del diccionario.

const PALABRAS = `
super carnes rivera alfa alpha omega mens store clothes clothing shop shoes boots
comercial baron trendy cool beyond reality bonita accesorios boom fitness cafe
boutique caps town carrito rojo zaragoza casa adobe cosmetic salamandra dibujo
tecnico disenos diseno para novia doc style dolce corazon don licor acapulco
elena elite collection elsie escultura dress exclusif forja western gorra mania
insade mexico isabella jacket piel joyeria jewelry kids lady linda luna madre
maison mar moda mundo natural nova oro paraiso perla pink plaza premium prendas
ropa rosa salon silver studio sweet tienda vende closet urban vintage zapateria
zapatos bella panda pandita live shows merchandising preloved sale tortilleria
tortillerias progreso sonoritmo queretaro medica sur novedades pets mayoreo jeans
pineda stylo taboo toro loco real serena morena sigue sigueme viaje trend beauty
san charly couture maya mia skin motion motional muse rookies magos west prago
best new my sport fashion glam nails hair spa deco hogar bebe baby toys pet vet
market mercado abarrotes carniceria pollo pescado taco pizza burger coffee bar
restaurante farmacia optica libreria papeleria ferreteria construccion muebles
textil telas hilos oficial official group grupo detalle perfecto dulce bombazo
la las los el amor love ama gym club house home life care green blue red black
white gold pro plus max mini shopp tu mi
`.trim().split(/\s+/);

// Sufijos de cuenta, no del nombre: se quitan solo si NO son la única palabra.
const SUFIJOS = new Set(['mx', 'gdl', 'cdmx', 'mty', 'oficial', 'official']);
// Ordenadas de larga a corta para que la búsqueda pruebe primero lo específico.
const DIC = [...new Set(PALABRAS)].sort((a, b) => b.length - a.length);

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Parte el slug en palabras del diccionario, o null si no se puede entero. */
function partir(slug: string): string[] | null {
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return null;
  const memo = new Map<number, string[] | null>();
  const rec = (i: number): string[] | null => {
    if (i === s.length) return [];
    if (memo.has(i)) return memo.get(i)!;
    let mejor: string[] | null = null;
    for (const w of DIC) {
      if (!s.startsWith(w, i)) continue;
      const resto = rec(i + w.length);
      if (!resto) continue;
      const cand = [w, ...resto];
      if (!mejor || cand.length < mejor.length) mejor = cand;
    }
    memo.set(i, mejor);
    return mejor;
  };
  return rec(0);
}

/**
 * Nombre presentable de una cuenta. Siempre devuelve algo legible.
 * `sugerido` es false cuando solo se capitalizó: sirve para marcar en la UI
 * cuáles conviene escribir a mano.
 */
export function nombreDesdeCuenta(cuenta: string): { nombre: string; sugerido: boolean } {
  const raw = String(cuenta || '').trim();
  if (!raw) return { nombre: '', sugerido: false };
  // Si ya viene con espacios o mayúsculas, alguien lo escribió: no se toca.
  if (/[\s]/.test(raw) || /[A-Z]/.test(raw)) return { nombre: raw, sugerido: false };

  const partes = partir(raw);
  if (partes && partes.length > 1) {
    const utiles = partes.filter((w, i) => !(SUFIJOS.has(w) && i > 0));
    if (utiles.length) return { nombre: utiles.map(capitalizar).join(' '), sugerido: true };
  }
  // No se pudo partir: se deja tal cual, solo con la inicial en mayúscula.
  return { nombre: capitalizar(raw), sugerido: false };
}
