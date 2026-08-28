// ══ Aviso de mensaje entrante (E2.2) ═══════════════════════════════════════
//
// Llega un mensaje de OTRA conversación mientras trabajas. La regla es avisar
// sin interrumpir: aparece en el borde, no roba el foco, no tapa lo que
// escribes y se va solo a los 6 s. Un toque salta a esa conversación.
//
// En el teléfono va arriba (abajo está el composer) y en escritorio abajo a la
// derecha, que es donde el ojo no está leyendo.
import { useEffect, useRef } from 'react';

export default function AvisoNuevo({ conv, mas, movil, onAbrir, onCerrar }: {
  conv: any; mas: number; movil?: boolean; onAbrir: () => void; onCerrar: () => void;
}) {
  // El temporizador cuelga de la conversación, no del callback: `onCerrar`
  // es una función nueva en cada render del inbox (y el inbox re-renderiza
  // con cada poll), así que depender de ella reiniciaba la cuenta y el aviso
  // no se iba nunca.
  const cerrarRef = useRef(onCerrar); cerrarRef.current = onCerrar;
  useEffect(() => {
    const t = setTimeout(() => cerrarRef.current(), 6000);
    return () => clearTimeout(t);
  }, [conv?.id]);

  const nombre = conv?.contacto?.nombre || conv?.telefono || 'Alguien';
  const texto = String(conv?.ultimo_mensaje_texto || '').slice(0, 70);

  return (
    <div className={'wa-aviso' + (movil ? ' wa-aviso-m' : '')} role="status" aria-live="polite">
      <button className="wa-aviso-ir" onClick={onAbrir}>
        <span className="wa-aviso-punto" aria-hidden="true" />
        <span className="wa-aviso-tx">
          <b>{nombre}</b>
          <span>{texto || 'Te escribió'}{mas > 0 ? ` · y ${mas} más` : ''}</span>
        </span>
      </button>
      <button className="wa-aviso-x" onClick={onCerrar} aria-label="Descartar aviso">×</button>
    </div>
  );
}
