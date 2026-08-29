/**
 * ESQUELETOS DEL INBOX — lo que se ve mientras llega el contenido.
 *
 * Por qué no un spinner: una chispa girando en medio de un panel vacío dice
 * "espera" pero no dice CUÁNTO ni QUÉ viene, así que la espera se siente más
 * larga de lo que es. Un esqueleto con la forma de lo que va a aparecer hace
 * dos cosas: adelanta la estructura (el ojo ya sabe dónde va a estar el
 * mensaje, el nombre, el composer) y evita el salto de layout cuando el
 * contenido entra, porque ocupa el mismo sitio.
 *
 * Las cuatro reglas que sigue todo esqueleto de este archivo:
 *
 *  1. RETRASO ANTES DE APARECER (120 ms). Desde que el inbox precarga las
 *     conversaciones, abrir una tarda 12-45 ms. Pintar un esqueleto en ese
 *     tiempo es un PARPADEO gris: peor que no mostrar nada. Solo aparece si la
 *     espera de verdad se nota.
 *  2. MISMA CAJA QUE EL CONTENIDO REAL. Mismos paddings y alturas, para que al
 *     llegar los datos nada se mueva de sitio.
 *  3. ANCHOS FIJOS, NO ALEATORIOS. Con Math.random cada repintado cambia las
 *     medidas y el bloque "tiembla". Van de una lista escrita a mano, que
 *     además imita el ritmo real de una conversación (burbujas desiguales,
 *     alternando lados).
 *  4. SILENCIO PARA EL LECTOR DE PANTALLA. El dibujo va `aria-hidden`; quien
 *     navega con lector oye una sola frase por una región `aria-live`, no
 *     veinte divs vacíos.
 *
 * Y conserva lo bueno del cargador viejo: si la espera pasa de 10 s, aparece
 * una línea diciendo que está tardando. Un esqueleto eterno es una pantalla
 * rota que nadie se atreve a recargar.
 */
import { useEffect, useState } from 'react';

const CSS = `
@keyframes wa-sk-brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.wa-sk {
  background: linear-gradient(90deg, #EDECF1 25%, #F7F6FA 50%, #EDECF1 75%);
  background-size: 200% 100%;
  animation: wa-sk-brillo 1.25s linear infinite;
  border-radius: 8px;
}
/* El tema oscuro del CRM se marca con data-crm-dark="1" en la raíz, pero ese
   atributo está SIEMPRE puesto: quien decide es la media query. Sin envolverlo
   igual, el esqueleto salía casi negro sobre la pantalla clara (se vio en la
   primera captura). Se copia la misma condición que usa el resto del tema. */
@media (prefers-color-scheme: dark) and (max-width: 899px) {
  [data-crm-dark="1"] .wa-sk {
    background: linear-gradient(90deg, #1e1e25 25%, #292930 50%, #1e1e25 75%);
    background-size: 200% 100%;
  }
}
/* Quien pide menos movimiento ve el bloque quieto, no un destello constante. */
@media (prefers-reduced-motion: reduce) { .wa-sk { animation: none; } }
.wa-sk-fila { display: flex; align-items: center; gap: 12px; padding: 11px 16px; }
.wa-sk-burb { max-width: 78%; border-radius: 14px; }
`;

function Estilos() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('wa-esqueletos-css')) return;
    const el = document.createElement('style');
    el.id = 'wa-esqueletos-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

/** Regla 1: no aparecer si la espera no se nota. Devuelve false los primeros ms. */
function useTrasRetraso(ms = 120) {
  const [ver, setVer] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVer(true), ms); return () => clearTimeout(t); }, [ms]);
  return ver;
}

/** El aviso de "esto ya tardó" que tenía el cargador viejo. */
function useTarda(seg = 10) {
  const [tarda, setTarda] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTarda(true), seg * 1000); return () => clearTimeout(t); }, [seg]);
  return tarda;
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#8a8590', padding: '10px 16px' }}>{texto}</div>
  );
}

/** Región que sí lee el lector de pantalla (regla 4). */
function Voz({ texto }: { texto: string }) {
  return (
    <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{texto}</span>
  );
}

// ── La conversación ────────────────────────────────────────────────────────
// Alterna lados y anchos como una charla real: si todas las burbujas midieran
// lo mismo y del mismo lado, se lee como una tabla, no como un chat.
const BURBUJAS: Array<[lado: 'ellos' | 'nosotros', ancho: number, alto: number]> = [
  ['ellos', 62, 44], ['nosotros', 48, 32], ['ellos', 74, 60],
  ['nosotros', 55, 44], ['ellos', 40, 32], ['nosotros', 68, 52],
];

export function EsqueletoChat({ mobile = false }: { mobile?: boolean }) {
  const ver = useTrasRetraso();
  const tarda = useTarda();
  if (!ver) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: mobile ? '60dvh' : 320 }}>
      <Estilos />
      <Voz texto="Cargando la conversación" />
      <div aria-hidden="true" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: mobile ? '18px 14px' : '20px 22px', overflow: 'hidden' }}>
        {/* La pastilla del día, que siempre encabeza el hilo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="wa-sk" style={{ width: 62, height: 20, borderRadius: 99 }} />
        </div>
        {BURBUJAS.map(([lado, ancho, alto], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: lado === 'nosotros' ? 'flex-end' : 'flex-start' }}>
            <div className="wa-sk wa-sk-burb" style={{ width: `${ancho}%`, height: alto }} />
          </div>
        ))}
      </div>
      {tarda && <Aviso texto="Está tardando más de lo normal…" />}
      {/* El composer: ocupa su sitio desde el principio para que al llegar el
          hilo la caja de escribir no empuje los mensajes hacia arriba. */}
      <div aria-hidden="true" style={{ padding: mobile ? '10px 14px 16px' : '12px 22px 18px' }}>
        <div className="wa-sk" style={{ height: mobile ? 46 : 52, borderRadius: 12 }} />
      </div>
    </div>
  );
}

// ── La lista de conversaciones ─────────────────────────────────────────────
const ANCHOS = [58, 72, 45, 66, 52, 78, 61, 49];

export function EsqueletoLista({ filas = 7, mobile = false }: { filas?: number; mobile?: boolean }) {
  const ver = useTrasRetraso();
  if (!ver) return null;
  return (
    <div>
      <Estilos />
      <Voz texto="Cargando las conversaciones" />
      <div aria-hidden="true">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="wa-sk-fila" style={{ padding: mobile ? '13px 16px' : '11px 14px' }}>
            <div className="wa-sk" style={{ width: mobile ? 44 : 38, height: mobile ? 44 : 38, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="wa-sk" style={{ height: 12, width: `${ANCHOS[i % ANCHOS.length]}%` }} />
              <div className="wa-sk" style={{ height: 10, width: `${ANCHOS[(i + 3) % ANCHOS.length]}%`, opacity: 0.72 }} />
            </div>
            <div className="wa-sk" style={{ width: 30, height: 9, flexShrink: 0, opacity: 0.6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── El panel del cliente (la columna derecha) ──────────────────────────────
export function EsqueletoPanel() {
  const ver = useTrasRetraso();
  if (!ver) return null;
  return (
    <div style={{ padding: '18px 16px' }}>
      <Estilos />
      <Voz texto="Cargando la ficha del cliente" />
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="wa-sk" style={{ width: 58, height: 20, borderRadius: 99 }} />
          <div className="wa-sk" style={{ width: 82, height: 20, borderRadius: 99 }} />
        </div>
        {[3, 4].map((n, b) => (
          <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div className="wa-sk" style={{ height: 9, width: 74, opacity: 0.7 }} />
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div className="wa-sk" style={{ height: 11, width: 68, opacity: 0.75 }} />
                <div className="wa-sk" style={{ height: 11, flex: 1, maxWidth: `${[110, 84, 132, 96][i % 4]}px` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
