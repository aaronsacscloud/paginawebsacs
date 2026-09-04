// La cadencia de una cuenta: los siete correos, con lo que se va a mandar tal
// cual, para leerlos antes de que salgan.
//
// La regla del módulo: NADA se envía sin que una persona lo apruebe. Por eso
// esto no es un resumen —es el texto completo, editable, correo por correo.
import { useEffect, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import { Pastilla, fecha } from './ui';

const ESTADO: Record<string, { l: string; bg: string; fg: string }> = {
  borrador:   { l: 'Por revisar', bg: '#F4F4F6',     fg: '#6B7280' },
  aprobado:   { l: 'Aprobado',    bg: P.verdeAgua,   fg: P.verdeTinta },
  programado: { l: 'Programado',  bg: P.azulAgua,    fg: P.azulTinta },
  enviado:    { l: 'Enviado',     bg: P.violetaAgua, fg: P.violetaTinta },
  cancelado:  { l: 'Cancelado',   bg: P.rojoAgua,    fg: P.rojoTinta },
  fallido:    { l: 'Falló',       bg: P.rojoAgua,    fg: P.rojoTinta },
};

export default function Cadencia({ cuentaId, onCambio }: { cuentaId: string; onCambio?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [borr, setBorr] = useState<{ asunto: string; cuerpo: string }>({ asunto: '', cuerpo: '' });

  const traer = () => {
    setCargando(true);
    fetch(`/api/crm/abm/cadencias?cuenta_id=${cuentaId}`).then(r => r.json())
      .then(r => { setD(r); setCargando(false); }).catch(() => setCargando(false));
  };
  useEffect(traer, [cuentaId]);

  const pedir = async (body: any) => {
    setTrabajando(true); setAviso(null);
    try {
      const r = await fetch('/api/crm/abm/cadencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) setAviso(j?.error || 'no se pudo');
      else if (j.con_ia === false) setAviso('Se armó con la plantilla del giro: la IA no estaba disponible.');
      traer(); onCambio?.();
    } finally { setTrabajando(false); }
  };

  if (cargando && !d) return <div style={{ padding: 24 }}><Cargando texto="Cargando la cadencia…" /></div>;

  const toques = (d?.toques || []).filter((t: any) => t.canal === 'email');
  const porRevisar = toques.filter((t: any) => t.estado === 'borrador').length;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '.875rem', fontWeight: 700 }}>
            {d?.cadencia ? d.cadencia.nombre : 'Sin cadencia todavía'}
          </div>
          <div style={{ fontSize: '.75rem', color: '#888' }}>
            {toques.length ? `${toques.length} correos · ${porRevisar} por revisar` : 'Se escriben con los datos de esta cuenta, y no sale ninguno sin que lo apruebes.'}
          </div>
        </div>
        {!toques.length ? (
          <button disabled={trabajando} onClick={() => pedir({ accion: 'generar', cuenta_id: cuentaId })}
            style={btn(true)}>{trabajando ? 'Escribiendo…' : 'Escribir la cadencia'}</button>
        ) : porRevisar > 0 ? (
          <button disabled={trabajando} onClick={() => pedir({ accion: 'aprobar_todo', cuenta_id: cuentaId })}
            style={btn(true)}>Aprobar los {porRevisar}</button>
        ) : null}
      </div>

      {aviso && (
        <div style={{ fontSize: '.8125rem', color: P.ambarTinta, background: P.ambarAgua, borderRadius: 8, padding: '8px 12px' }}>{aviso}</div>
      )}

      {toques.map((t: any, i: number) => {
        const est = ESTADO[t.estado] || ESTADO.borrador;
        const abierto = editando === t.id;
        return (
          <div key={t.id} style={{ border: '1px solid #ececec', borderRadius: 10, padding: '13px 15px', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{ fontSize: '.6875rem', fontWeight: 800, color: '#aaa' }}>{i + 1}</span>
              <Pastilla tono={est}>{est.l}</Pastilla>
              <span style={{ fontSize: '.75rem', color: '#888' }}>sale el {fecha(t.programado_at)}</span>
              <span style={{ fontSize: '.75rem', color: '#aaa', marginLeft: 'auto' }}>{t.destino}</span>
            </div>
            {abierto ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <input value={borr.asunto} onChange={e => setBorr({ ...borr, asunto: e.target.value })}
                  style={{ font: 'inherit', fontSize: '.875rem', fontWeight: 700, padding: '8px 11px', borderRadius: 8, border: '1px solid #e0dee8' }} />
                <textarea value={borr.cuerpo} onChange={e => setBorr({ ...borr, cuerpo: e.target.value })} rows={10}
                  style={{ font: 'inherit', fontSize: '.8125rem', lineHeight: 1.6, padding: '10px 12px', borderRadius: 8, border: '1px solid #e0dee8', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => { pedir({ accion: 'editar', toque_id: t.id, ...borr }); setEditando(null); }} style={btn(true)}>Guardar</button>
                  <button onClick={() => setEditando(null)} style={btn(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '.9375rem', fontWeight: 700, marginBottom: 6 }}>{t.asunto}</div>
                <div style={{ fontSize: '.8125rem', color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.cuerpo}</div>
                {t.estado !== 'enviado' && t.estado !== 'cancelado' && (
                  <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                    {t.estado === 'borrador' && (
                      <button disabled={trabajando} onClick={() => pedir({ accion: 'aprobar', toque_id: t.id })} style={btn(true)}>Aprobar</button>
                    )}
                    <button onClick={() => { setEditando(t.id); setBorr({ asunto: t.asunto || '', cuerpo: t.cuerpo || '' }); }} style={btn(false)}>Editar</button>
                    <button disabled={trabajando} onClick={() => pedir({ accion: 'cancelar', toque_id: t.id })} style={btnMal()}>Quitar</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const btn = (primario: boolean) => ({
  font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
  border: primario ? 'none' : '1px solid #e0dee8',
  background: primario ? P.violeta : '#fff', color: primario ? '#fff' : '#666',
});
const btnMal = () => ({
  font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
  border: '1px solid #f0c4bd', background: '#fff', color: P.rojoTinta,
});
