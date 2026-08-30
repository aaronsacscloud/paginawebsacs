/**
 * ESTADO VACÍO — decir qué pasó y ofrecer la salida.
 *
 * Las listas del CRM resolvían el caso "no hay nada" con un renglón gris:
 * «Nada con esa búsqueda.» Eso informa y ahí te deja. En el teléfono duele más
 * que en escritorio: no hay un panel de filtros a la vista para deshacer lo que
 * dejó la lista vacía, así que el camino de vuelta hay que ir a buscarlo.
 *
 * Tres partes, y las tres importan:
 *  · TÍTULO — qué pasó, en una frase. Sin signos de admiración ni disculpas.
 *  · PISTA  — por qué puede estar vacío. Es lo que evita que se lea como error
 *             del sistema cuando en realidad el filtro es de uno.
 *  · SALIDA — un botón que arregla la causa más probable (quitar la búsqueda,
 *             volver a "todos", crear el primero). Opcional a propósito: un
 *             vacío que es BUENA noticia —nadie en riesgo, bandeja limpia— no
 *             lleva botón, porque no hay nada que arreglar.
 */
import type { ReactNode } from 'react';

export default function EstadoVacio({ titulo, pista, accion, onAccion, tono = 'neutro', icono }: {
  titulo: string;
  pista?: ReactNode;
  accion?: string;
  onAccion?: () => void;
  /** 'bien' = el vacío es la buena noticia (nadie vencido, nada pendiente). */
  tono?: 'neutro' | 'bien';
  icono?: ReactNode;
}) {
  const bien = tono === 'bien';
  return (
    <div style={{ padding: '34px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      {icono}
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: bien ? '#0F766E' : '#241d43', lineHeight: 1.35 }}>{titulo}</div>
      {pista && (
        <div style={{ fontSize: '0.8rem', color: '#7c7a86', lineHeight: 1.55, maxWidth: 320 }}>{pista}</div>
      )}
      {accion && onAccion && (
        <button onClick={onAccion}
          style={{ marginTop: 6, minHeight: 44, padding: '0 18px', borderRadius: 11, border: '1px solid #ddd8f7',
            background: '#fff', color: '#5B4BD6', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'inherit', cursor: 'pointer' }}>
          {accion}
        </button>
      )}
    </div>
  );
}
