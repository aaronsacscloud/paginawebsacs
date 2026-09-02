/**
 * QUÉ ES ESTA SECUENCIA — sin salir de la conversación.
 *
 * El comentario interno decía «Entró a la secuencia "qa-83d873ef"» y ahí
 * terminaba: quien lo leía no sabía qué le vamos a mandar al cliente, ni
 * cuándo, ni qué sigue. Ir a buscarlo a otra pestaña es el paso que hace que
 * no se mire — y entonces se contesta sin ese contexto.
 *
 * Esto lo abre aquí mismo: qué es, qué ya salió, qué sigue y cuándo.
 */
import { useEffect, useState } from 'react';
import { C } from './estilo';
import Sheet from '../ui/Sheet';

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const fechaCorta = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s.length <= 10 ? `${s}T12:00:00` : s);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

export default function DrawerSecuencia({ abierto, onCerrar, secuenciaId, nombre, contactId }: {
  abierto: boolean; onCerrar: () => void;
  secuenciaId?: string | null; nombre?: string | null; contactId?: string | null;
}) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setD(null); setError('');
    const p = new URLSearchParams();
    if (secuenciaId) p.set('id', secuenciaId); else if (nombre) p.set('nombre', nombre);
    if (contactId) p.set('contacto', contactId);
    fetch(`/api/crm/secuencias/detalle?${p}`)
      .then(r => r.json())
      .then(j => (j?.error ? setError(j.error) : setD(j)))
      .catch(() => setError('No se pudo cargar la secuencia.'));
  }, [abierto, secuenciaId, nombre, contactId]);

  const s = d?.secuencia;
  const ESTADO: Record<string, { t: string; c: string; f: string }> = {
    en_curso: { t: 'En curso', c: '#0F766E', f: '#EAF8F2' },
    terminada: { t: 'Terminada — ya recibió todo', c: C.g500, f: C.g100 },
    detenida: { t: 'Detenida', c: C.ambar700, f: C.ambar50 },
    no_esta: { t: 'Este contacto ya no está en ella', c: C.g500, f: C.g100 },
  };
  const est = ESTADO[d?.estado] || null;

  return (
    <Sheet open={abierto} onClose={onCerrar} title="La secuencia" width={520}>
      {error && <div style={{ padding: 18, fontSize: 13, color: C.g500 }}>{error}</div>}
      {!d && !error && <div style={{ padding: 18, fontSize: 13, color: C.g400 }}>Cargando…</div>}
      {d && s && (
        <div style={{ padding: '4px 2px 24px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#241f3d', lineHeight: 1.3 }}>{s.nombre}</div>
          {s.descripcion && <p style={{ margin: '6px 0 0', fontSize: 13, color: C.g500, lineHeight: 1.55 }}>{s.descripcion}</p>}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 0' }}>
            {est && <span style={{ fontSize: 11, fontWeight: 700, background: est.f, color: est.c, borderRadius: 999, padding: '3px 10px' }}>{est.t}</span>}
            {!s.activa && <span style={{ fontSize: 11, fontWeight: 700, background: C.ambar50, color: C.ambar700, borderRadius: 999, padding: '3px 10px' }}>Apagada: no está mandando nada</span>}
            {d.motivo && <span style={{ fontSize: 11, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, padding: '3px 10px' }}>Motivo: {d.motivo}</span>}
          </div>

          {/* Lo que de verdad se quiere saber al abrir esto. */}
          <div style={{ margin: '16px 0 0', padding: '12px 14px', borderRadius: 10, background: C.moradoSuave, border: `1px solid ${C.moradoAgua}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.moradoTinta }}>Qué sigue</div>
            <div style={{ fontSize: 13.5, color: '#2f2a4a', marginTop: 4, lineHeight: 1.5 }}>
              {d.siguiente
                ? <>Día {d.siguiente.dia} · <b>{d.siguiente.canal}</b>: {d.siguiente.que}
                    {d.siguiente.estimado && <span style={{ color: C.g500 }}> — alrededor del {fechaCorta(d.siguiente.estimado)}</span>}</>
                : d.estado === 'terminada' ? 'Nada: ya recibió todos los pasos.'
                : d.estado === 'detenida' ? 'Nada mientras siga detenida.'
                : 'Nada: este contacto no está en la secuencia.'}
            </div>
            {d.estado === 'en_curso' && (
              <div style={{ fontSize: 11, color: C.g500, marginTop: 6, lineHeight: 1.5 }}>
                La fecha es estimada: la ventana horaria y el tope de un mensaje al día pueden correrla.
              </div>
            )}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.g400, margin: '18px 0 8px' }}>
            Todo lo que manda
          </div>
          {(d.pasos || []).length === 0 && <div style={{ fontSize: 13, color: C.g400 }}>No tiene pasos configurados: no manda nada.</div>}
          {(d.pasos || []).map((p: any) => {
            const salio = !!p.enviado_at;
            const esSiguiente = d.siguiente && p.id === d.siguiente.id;
            return (
              <div key={p.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.g100}`, opacity: salio ? 0.6 : 1 }}>
                <span style={{ flexShrink: 0, width: 46, fontSize: 11, fontWeight: 800, color: esSiguiente ? C.moradoTinta : C.g400, paddingTop: 1 }}>Día {p.dia}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: '#2f2a4a', lineHeight: 1.45 }}>
                    <b>{p.canal}</b> · {p.que}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: salio ? '#0F766E' : C.g400, marginTop: 2 }}>
                    {salio ? `Salió el ${fechaCorta(p.enviado_at)}` : esSiguiente ? 'Es el que sigue' : p.estimado ? `Alrededor del ${fechaCorta(p.estimado)}` : 'Pendiente'}
                  </span>
                </span>
              </div>
            );
          })}

          {(s.dias_envio || s.hora_inicio != null) && (
            <div style={{ fontSize: 11.5, color: C.g500, marginTop: 14, lineHeight: 1.6 }}>
              Solo manda {s.dias_envio?.length ? `en ${s.dias_envio.map((n: number) => DIAS[n]).filter(Boolean).join(', ')}` : 'entre semana'}
              {s.hora_inicio != null && s.hora_fin != null ? `, de ${s.hora_inicio}:00 a ${s.hora_fin}:00` : ''}.
              {s.corte_dias ? ` Se corta sola a los ${s.corte_dias} días.` : ''}
            </div>
          )}

          <a href={`/admin/crm?tab=secuencias`} style={{ display: 'inline-block', marginTop: 16, fontSize: 12.5, fontWeight: 700, color: C.moradoTinta }}>
            Abrir Secuencias para editarla →
          </a>
        </div>
      )}
    </Sheet>
  );
}
