/**
 * CONFIRMAR ALGO QUE NO SE PUEDE DESHACER — en hoja, no en alerta del navegador.
 *
 * El CRM usa `confirm()` en 23 archivos. Funciona, pero en el teléfono es una
 * alerta del sistema: no se puede dar énfasis a lo peligroso, el botón de
 * aceptar queda igual de inocente que el de cancelar, y dentro de una PWA se lee
 * como si el navegador hubiera interrumpido — no como si la app estuviera
 * preguntando. En una pantalla donde borrar de más cuesta caro, eso importa.
 *
 * Se mantiene la MISMA forma de usarlo para que migrar un sitio sea una línea:
 *
 *     if (!confirm('¿Borrar?')) return;          // antes
 *     if (!await confirmar('¿Borrar?')) return;  // después
 *
 * Decisiones que no son de estilo:
 *
 *  · El botón peligroso va en ROJO y con su verbo real ("Borrar", "Archivar"),
 *    no un "Aceptar" que no dice qué acepta. Quien lee rápido lee el botón.
 *  · El foco arranca en CANCELAR. Si alguien viene dando Enter, no destruye.
 *  · Escape y el fondo cancelan. Nunca confirman.
 *  · En DOM plano, sin React: esto lo llaman funciones sueltas y handlers que
 *    no siempre están dentro de un árbol montado. Un portal aquí obligaría a
 *    cada sitio a manejar estado, que es justo lo que hace que nadie migre.
 */

export type OpcionesConfirmar = {
  /** El verbo real de lo que va a pasar. "Borrar", no "Aceptar". */
  accion?: string;
  /** Segunda línea, para el detalle de qué se conserva y qué no. */
  detalle?: string;
  /** false cuando no destruye nada (guardar, continuar): el botón va morado. */
  peligro?: boolean;
};

const CSS = `
@keyframes cfm-sube { from { transform: translateY(14px); opacity: .6; } to { transform: none; opacity: 1; } }
.cfm-fondo { position: fixed; inset: 0; background: rgba(16,24,40,.42); z-index: 1400; display: flex; align-items: flex-end; justify-content: center; }
.cfm-hoja { width: 100%; max-width: 520px; background: #fff; border-radius: 16px 16px 0 0; padding: 20px 18px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 34px rgba(0,0,0,.18); animation: cfm-sube 170ms ease; }
.cfm-tit { font-size: 1rem; font-weight: 800; color: #241d43; line-height: 1.35; }
.cfm-det { font-size: 0.84rem; color: #6b6875; line-height: 1.5; margin-top: 7px; white-space: pre-line; }
.cfm-btns { display: flex; gap: 10px; margin-top: 18px; }
.cfm-btns button { flex: 1 1 0; min-height: 48px; border-radius: 11px; font-family: inherit; font-size: 0.9rem; font-weight: 800; cursor: pointer; }
.cfm-no { border: 1px solid #e2e0e8; background: #fff; color: #4a4854; }
.cfm-si { border: none; color: #fff; }
@media (min-width: 900px) {
  .cfm-fondo { align-items: center; }
  .cfm-hoja { border-radius: 16px; max-width: 440px; padding-bottom: 18px; animation: none; }
}
@media (prefers-reduced-motion: reduce) { .cfm-hoja { animation: none; } }
/* Modo oscuro. Sin esto la hoja salía blanca con texto oscuro sobre una
   pantalla negra — el mismo error que dejó la lista del inbox en dos colores.
   Se copia la condición que usa el resto del tema del CRM. */
@media (prefers-color-scheme: dark) and (max-width: 899px) {
  [data-crm-dark="1"] .cfm-hoja { background: #1d1d24; box-shadow: 0 -10px 34px rgba(0,0,0,.5); }
  [data-crm-dark="1"] .cfm-tit { color: #F2F1F7; }
  [data-crm-dark="1"] .cfm-det { color: #b3b1bd; }
  [data-crm-dark="1"] .cfm-no { background: #232329; border-color: #33333d; color: #d7d5de; }
}
`;

function estilos() {
  if (document.getElementById('cfm-css')) return;
  const el = document.createElement('style');
  el.id = 'cfm-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function confirmar(titulo: string, opciones: OpcionesConfirmar = {}): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  estilos();

  const { accion = 'Continuar', detalle = '', peligro = true } = opciones;

  return new Promise<boolean>(resolve => {
    const fondo = document.createElement('div');
    fondo.className = 'cfm-fondo';
    fondo.setAttribute('role', 'dialog');
    fondo.setAttribute('aria-modal', 'true');

    const hoja = document.createElement('div');
    hoja.className = 'cfm-hoja';

    const t = document.createElement('div');
    t.className = 'cfm-tit';
    t.textContent = titulo;
    hoja.appendChild(t);

    if (detalle) {
      const d = document.createElement('div');
      d.className = 'cfm-det';
      d.textContent = detalle;
      hoja.appendChild(d);
    }

    const btns = document.createElement('div');
    btns.className = 'cfm-btns';
    const no = document.createElement('button');
    no.className = 'cfm-no';
    no.textContent = 'Cancelar';
    const si = document.createElement('button');
    si.className = 'cfm-si';
    si.style.background = peligro ? '#C0554E' : '#5B4BD6';
    si.textContent = accion;
    btns.appendChild(no); btns.appendChild(si);
    hoja.appendChild(btns);
    fondo.appendChild(hoja);

    const cerrar = (r: boolean) => {
      document.removeEventListener('keydown', onTecla, true);
      fondo.remove();
      resolve(r);
    };
    const onTecla = (e: KeyboardEvent) => {
      // Escape cancela. Enter NO confirma: el foco vive en Cancelar y quien
      // quiera destruir tiene que ir hasta el botón rojo a propósito.
      if (e.key === 'Escape') { e.preventDefault(); cerrar(false); }
    };

    no.onclick = () => cerrar(false);
    si.onclick = () => cerrar(true);
    fondo.onclick = e => { if (e.target === fondo) cerrar(false); };
    document.addEventListener('keydown', onTecla, true);

    document.body.appendChild(fondo);
    no.focus();
  });
}
