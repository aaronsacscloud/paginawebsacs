// Configuración → Documentos: la biblioteca de lo que se puede adjuntar al
// correo de una cuenta (presentaciones, PDFs, ligas).
//
// Pedido del dueño (22-sep-2026): los documentos que se crean se guardan aquí
// cuando él dice «guárdalo en el CRM», y al mandar un correo desde la ficha se
// eligen de los ACTIVOS. Uno vencido se apaga solo aunque su casilla diga que
// no: una promoción que venció no puede seguir saliendo.
import { useEffect, useState } from 'react';

const S = {
  in: { width: '100%', border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 10px', fontSize: '0.82rem', background: '#fdfcff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as const,
  lbl: { display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#9c99a6', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 } as const,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnS: { border: '1.5px solid #9B8CFA', borderRadius: 9, padding: '7px 14px', background: '#fff', color: '#5B4BD6', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } as const,
  btnG: { border: '1px solid #dcd8ea', borderRadius: 8, padding: '6px 11px', background: '#fff', color: '#555', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
};
const TIPO_L: Record<string, string> = { presentacion: 'Presentación', pdf: 'PDF', liga: 'Liga' };
const vacio = { titulo: '', url: '', tipo: 'presentacion', descripcion: '', vence: '' };

export default function DocumentosConfig() {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(null);   // null = cerrado; {id?} = editando
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = () => fetch('/api/crm/documentos').then(r => r.json()).then(j => setDocs(j?.documentos || [])).catch(() => setDocs([]));
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setBusy(true); setError('');
    const r = await fetch('/api/crm/documentos', {
      method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo guardar.'); return; }
    setForm(null); cargar();
  }
  async function prender(d: any) {
    await fetch('/api/crm/documentos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, activo: !d.activo }) });
    cargar();
  }
  async function archivar(d: any) {
    if (!confirm(`¿Quitar «${d.titulo}» de la biblioteca? Los correos que ya salieron conservan su liga.`)) return;
    await fetch('/api/crm/documentos?id=' + d.id, { method: 'DELETE' });
    cargar();
  }

  const activos = (docs || []).filter(d => d.activo && !d.vencido).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: '0.8rem', color: '#8a8596' }}>{docs ? `${activos} ${activos === 1 ? 'activo' : 'activos'} · se eligen al mandar un correo desde la ficha de una cuenta` : 'Cargando…'}</div>
        <span style={{ flex: 1 }} />
        {!form && <button style={S.btnS} onClick={() => { setForm({ ...vacio }); setError(''); }}>+ Agregar liga o PDF</button>}
      </div>

      {form && (
        <div style={{ border: '1.5px solid #ddd6fb', borderRadius: 13, padding: 14, marginBottom: 14, background: '#fdfcff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            <label><span style={S.lbl}>Nombre</span><input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} style={S.in} placeholder="Programa de flujos empresariales" /></label>
            <label><span style={S.lbl}>Liga</span><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={S.in} placeholder="https://…" /></label>
            <label><span style={S.lbl}>Tipo</span>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={S.in}>
                <option value="presentacion">Presentación</option><option value="pdf">PDF</option><option value="liga">Liga</option>
              </select></label>
            <label><span style={S.lbl}>Vence (opcional)</span><input type="date" value={form.vence || ''} onChange={e => setForm({ ...form, vence: e.target.value })} style={S.in} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 10 }}><span style={S.lbl}>Una línea que diga qué es (sale en el correo)</span>
            <input value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} style={S.in} placeholder="10 días hábiles para cerrar tus flujos · 35 % hasta el 28 de septiembre" /></label>
          {error && <div style={{ color: '#C0554E', fontSize: '0.78rem', marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1 }} disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar a la biblioteca'}</button>
            <button style={S.btnG} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {docs?.length === 0 && !form && (
        <div style={{ border: '1.5px dashed #e4dffb', borderRadius: 13, padding: '22px 18px', color: '#8a8596', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Todavía no hay documentos. Aquí van las presentaciones, PDFs y ligas que se le mandan a los clientes; los reportes de cada cuenta no viven aquí, se generan al mandar el correo.
        </div>
      )}

      {(docs || []).map(d => {
        const vivo = d.activo && !d.vencido;
        return (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto auto auto', gap: 14, alignItems: 'center', padding: '11px 13px', border: '1px solid #eeecf4', borderRadius: 13, background: '#fff', marginBottom: 8, opacity: vivo ? 1 : .6 }}>
            <div style={{ width: 48, height: 36, borderRadius: 8, background: d.tipo === 'presentacion' ? 'linear-gradient(140deg,#1d1545,#5a2a6a)' : d.tipo === 'pdf' ? 'linear-gradient(140deg,#f7f5ff,#EFA6CA)' : 'linear-gradient(140deg,#EAF8F2,#9B8CFA)' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{d.titulo}</div>
              <div style={{ fontSize: '0.72rem', color: '#8a8596', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {TIPO_L[d.tipo] || 'Liga'} · <a href={d.url} target="_blank" rel="noreferrer" style={{ color: '#5B4BD6' }}>{String(d.url).replace(/^https?:\/\//, '')}</a>
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
              {d.vence
                ? <span style={{ fontWeight: 800, borderRadius: 20, padding: '2px 9px', background: d.vencido ? '#f4f4f6' : '#FFF4E5', color: d.vencido ? '#6B7280' : '#9a6a10' }}>{d.vencido ? 'venció' : 'vence'} {d.vence.slice(8, 10)}/{d.vence.slice(5, 7)}</span>
                : <span style={{ color: '#a5a2af' }}>sin vencimiento</span>}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#555', whiteSpace: 'nowrap' }}>{d.cuentas ? `${d.cuentas} ${d.cuentas === 1 ? 'cuenta' : 'cuentas'} · ${d.abrieron} abrieron` : 'sin enviar'}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => prender(d)} aria-pressed={d.activo} title={d.activo ? 'Apagar' : 'Prender'}
                style={{ width: 34, height: 19, borderRadius: 10, border: 'none', padding: 0, cursor: 'pointer', position: 'relative', background: d.activo ? '#9B8CFA' : '#ddd' }}>
                <span style={{ position: 'absolute', top: 2, left: d.activo ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </button>
              <button style={S.btnG} onClick={() => { setForm({ ...d, vence: d.vence || '' }); setError(''); }}>Editar</button>
              <button style={{ ...S.btnG, color: '#C0554E' }} onClick={() => archivar(d)} title="Quitar de la biblioteca">×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
