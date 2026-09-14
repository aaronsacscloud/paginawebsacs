/* El editor de una orden del taller, desde la ficha del cliente.
 *
 * Vive aquí y no dentro de una pantalla porque ya son dos las que lo abren —la
 * pestaña Taller de la cuenta y la lista de Consultoría—, y un segundo
 * formulario con otros campos es como se llega a dos verdades sobre la misma
 * orden.
 */
import { useState } from 'react';
import Cargando from '../ui/Cargando';

/* Cómo se lee la etapa del taller desde la ficha del cliente. Vocabulario
   ÚNICO: si cada pantalla lo traduce a su manera, la misma orden se describe
   de dos formas y nadie sabe si son la misma. */
export const ETAPAS_TALLER: Record<string, string> = {
  recibida: 'recibida', analisis: 'en análisis', desarrollo: 'en desarrollo', pruebas: 'en pruebas',
  lista: 'lista, esperando tu OK', entregada: 'entregada', devuelta: 'devuelta',
  espera: 'esperando al cliente', trabada: 'trabada',
};

const S = {
  input: { padding: '8px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.79rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fdfcff', fontFamily: 'inherit' } as const,
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 3, display: 'block' } as const,
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '5px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
};

/* ══ LO DEL TALLER, DESDE LA FICHA ══
   Son los cuatro datos con los que una orden se puede arrancar: para cuándo,
   quién, qué tan urgente y con qué se da por buena. Nada más — el resto del
   taller (rebotes, SLA, bitácora, la conversación técnica) vive allá y no se
   asoma aquí: si el consultor ve que la mejora del cliente rebotó dos veces,
   la conversación con el cliente deja de ser sobre lo que va a recibir.

   Que se editen desde aquí es el punto: mover un día obligaba a salir de la
   ficha, entrar al Taller, buscar el folio y volver. Con ese costo, las fechas
   no se movían — se dejaban vencer. */
export default function OrdenDelTaller({ orden, equipo, onCerrar, onGuardar }: any) {
  const [f, setF] = useState<any>({
    fecha_prometida: orden.fecha_prometida || '',
    asignado_id: orden.asignado_id || '',
    prioridad: orden.prioridad || 'media',
    criterios: orden.criterios || '',
    motivo: '',
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  // Mover una fecha ya prometida pide el porqué: es el dato con el que después
  // se sabe si se recorren por desarrollo o porque el cliente no contestó.
  const movio = !!orden.fecha_prometida && f.fecha_prometida !== orden.fecha_prometida;

  if (orden.cargando) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Cargando texto="Abriendo la orden…" />
      </div>
    );
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 480, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Lo que el taller necesita</h3>
          <span style={{ fontSize: '0.72rem', color: '#7a6fc9', fontFamily: 'ui-monospace, monospace' }}>{orden.folio}</span>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 2 }}>{orden.titulo}</div>
          <div style={{ fontSize: '0.7rem', color: '#a5a2af', marginBottom: 13 }}>
            {orden.tipo === 'falla' ? 'Falla' : 'Mejora'} · {ETAPAS_TALLER[orden.etapa] || orden.etapa}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><div style={S.lbl}>Fecha prometida</div>
              <input type="date" value={f.fecha_prometida} onChange={e => set('fecha_prometida', e.target.value)} style={S.input} /></div>
            <div><div style={S.lbl}>Responsable</div>
              <select value={f.asignado_id} onChange={e => set('asignado_id', e.target.value)} style={S.input}>
                <option value="">Sin asignar</option>
                {equipo.map((q: any) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
              </select></div>
          </div>

          <div style={{ marginBottom: 10 }}><div style={S.lbl}>¿Bloquea la operación?</div>
            <select value={f.prioridad} onChange={e => set('prioridad', e.target.value)} style={S.input}>
              <option value="alta">Sí — hoy no puede vender</option>
              <option value="media">Le estorba</option>
              <option value="baja">Puede esperar</option>
            </select></div>

          <div style={{ marginBottom: 10 }}><div style={S.lbl}>Cómo se sabe que quedó</div>
            <textarea value={f.criterios} onChange={e => set('criterios', e.target.value)} rows={2}
              placeholder="La prueba concreta: «se imprime un ticket y el escáner lo lee al primer intento»"
              style={{ ...S.input, resize: 'vertical' }} />
            <div style={{ fontSize: '0.67rem', color: '#a5a2af', marginTop: 3, lineHeight: 1.45 }}>
              Sin esto la orden no puede pasar a desarrollo: es lo que evita que se entregue algo que no era.
            </div></div>

          {movio && (
            <div style={{ marginBottom: 10 }}><div style={S.lbl}>¿Por qué se mueve la fecha?</div>
              <input value={f.motivo} onChange={e => set('motivo', e.target.value)}
                placeholder="El cliente no mandó el catálogo" style={S.input} />
              <div style={{ fontSize: '0.67rem', color: '#a5a2af', marginTop: 3 }}>
                Queda en la bitácora. La fecha original no se pierde: contra ella se mide el cumplimiento.
              </div></div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <button disabled={guardando} style={{ ...S.btn, opacity: guardando ? .6 : 1 }}
              onClick={async () => {
                setGuardando(true);
                const ok = await onGuardar({
                  fecha_prometida: f.fecha_prometida || null,
                  asignado_id: f.asignado_id || null,
                  prioridad: f.prioridad,
                  criterios: f.criterios,
                  motivo: f.motivo || undefined,
                });
                if (!ok) setGuardando(false);
              }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button style={{ ...S.btnG, color: '#a5a2af' }} onClick={onCerrar}>Cancelar</button>
            <span style={{ fontSize: '0.68rem', color: '#a5a2af', marginLeft: 'auto' }}>El taller lo ve en su tablero</span>
          </div>
        </div>
      </div>
    </div>
  );
}

