/**
 * Carga de Three.js bajo demanda, una sola vez por página.
 *
 * Hay dos bloques 3D en la página de giro (el cubo de inventario y el ensamble
 * del cierre). Si cada uno insertara su propio <script>, el navegador se
 * bajaria 590 KB dos veces y quedarian dos objetos THREE peleandose. Aqui la
 * promesa se memoiza: el primero que llama dispara la descarga y el segundo se
 * cuelga de la misma.
 *
 * Se carga desde /lib/ y no desde un CDN a proposito: un tercero mas en la ruta
 * critica es un punto de falla y de latencia que no necesitamos.
 */
let promesa: Promise<any> | null = null;

export function cargarThree(): Promise<any> {
  if ((window as any).THREE) return Promise.resolve((window as any).THREE);
  if (promesa) return promesa;

  promesa = new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = '/lib/three.min.js';
    s.async = true;
    s.onload = () => {
      const T = (window as any).THREE;
      if (T) resolver(T);
      else rechazar(new Error('three cargó pero no expuso THREE'));
    };
    s.onerror = () => rechazar(new Error('no se pudo cargar three'));
    document.head.appendChild(s);
  });

  // Si falla, se limpia para que un segundo bloque pueda reintentar en vez de
  // heredar la promesa rota.
  promesa.catch(() => { promesa = null; });

  return promesa;
}

/** ¿El navegador puede pintar WebGL? Si no, cada bloque muestra su respaldo. */
export function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}
