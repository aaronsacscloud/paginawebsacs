import { useRef, useState } from 'react';

/* Sube un CSV externo (respond.io / HubSpot con Name, Email, Phone, "Nombre de la
 * empresa") y enriquece el WhatsApp de los contactos del CRM. Corre primero en
 * modo ANÁLISIS (dry-run, no escribe) para mostrar el cruce, y solo escribe al
 * dar "Aplicar". La sesión founder va sola por cookie (endpoint bajo middleware). */

const KEY = 'sacs-arr-2026';
const ENDPOINT = '/api/crm/arr/enriquecer-whatsapp?key=' + KEY;

const box: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: 10, padding: 14, background: '#fff' };
const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' };
const btnDark: React.CSSProperties = { ...btn, background: '#1a1a1a', color: '#fff', border: 'none' };
const pill = (bg: string, color: string): React.CSSProperties => ({ background: bg, color, borderRadius: 8, padding: '10px 12px', minWidth: 92, textAlign: 'center' });

export default function EnriquecerWhatsApp({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [rep, setRep] = useState<any>(null);
  const [loading, setLoading] = useState<'' | 'dry' | 'apply'>('');
  const [applied, setApplied] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); setCsv(''); setFileName(''); setRep(null); setApplied(null); setLoading(''); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name); setRep(null); setApplied(null);
    setCsv(await f.text());
  }

  async function run(dry: boolean) {
    if (!csv) return;
    setLoading(dry ? 'dry' : 'apply');
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv, dry_run: dry }) });
      const j = await r.json();
      if (j.error) { alert(j.error); }
      else if (dry) { setRep(j); setApplied(null); }
      else { setApplied(j); setRep(j); onDone?.(); }
    } catch (e: any) { alert('Error de red: ' + (e?.message || e)); }
    setLoading('');
  }

  const s = rep?.resumen || {};
  const ap = rep?.aplicables || {};
  const totalAplicar = (ap.actualizar || 0) + (ap.crear_contacto || 0);

  return (
    <>
      <button style={btn} title="Subir un CSV (respond.io/HubSpot) y llenar el WhatsApp de los contactos" onClick={() => setOpen(true)}>📲 Enriquecer WhatsApp</button>
      <a href="/api/crm/arr/export-clientes" style={{ ...btn, textDecoration: 'none', color: '#333', display: 'inline-block' }} title="Descargar clientes con su contacto (CSV para Excel)">📥 Exportar clientes</a>

      {open && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflow: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...box, width: 'min(760px, 100%)', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Enriquecer WhatsApp de clientes</h3>
              <button style={{ ...btn, border: 'none' }} onClick={close}>✕</button>
            </div>
            <p style={{ color: '#666', fontSize: '0.82rem', margin: '0 0 14px', lineHeight: 1.5 }}>
              Sube el CSV exportado de respond.io/HubSpot. Se cruza con el CRM por <b>email → empresa → nombre</b>,
              el número se normaliza a formato Meta (<code>+52…</code>) y <b>nunca</b> se pisa un WhatsApp distinto sin tu visto bueno.
              Primero <b>analiza</b> (no escribe); luego decides aplicar.
            </p>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
              <button style={btn} onClick={() => fileRef.current?.click()}>Elegir archivo CSV…</button>
              {fileName && <span style={{ fontSize: '0.8rem', color: '#333' }}>📄 {fileName}</span>}
              {csv && <button style={btnDark} disabled={loading !== ''} onClick={() => run(true)}>{loading === 'dry' ? 'Analizando…' : 'Analizar (sin escribir)'}</button>}
            </div>

            {rep && (
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={pill('#e8f5e9', '#1b5e20')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{ap.actualizar || 0}</div><div style={{ fontSize: '0.7rem' }}>a actualizar</div></div>
                  <div style={pill('#e3f2fd', '#0d47a1')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{ap.crear_contacto || 0}</div><div style={{ fontSize: '0.7rem' }}>contactos nuevos</div></div>
                  <div style={pill('#f3f4f6', '#555')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.ya_tiene || 0}</div><div style={{ fontSize: '0.7rem' }}>ya tenían</div></div>
                  <div style={pill('#fff3e0', '#a06600')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{(rep.conflictos || []).length}</div><div style={{ fontSize: '0.7rem' }}>conflictos</div></div>
                  <div style={pill('#fdecea', '#b93333')}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{(rep.no_encontrados || []).length}</div><div style={{ fontSize: '0.7rem' }}>no encontrados</div></div>
                </div>

                {rep.conflictos?.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#a06600', fontSize: '0.82rem' }}>⚠ {rep.conflictos.length} conflictos (el contacto ya tenía OTRO número — no se tocan)</summary>
                    <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 6, fontSize: '0.75rem' }}>
                      {rep.conflictos.map((c: any, i: number) => (
                        <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <b>{c.nombre_crm || c.csv_nombre || '—'}</b> · tenía <code>{c.tenia}</code> → CSV trae <code>{c.nuevo}</code>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {rep.no_encontrados?.length > 0 && (
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#b93333', fontSize: '0.82rem' }}>{rep.no_encontrados.length} no encontrados (no cruzaron con ningún cliente)</summary>
                    <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 6, fontSize: '0.75rem' }}>
                      {rep.no_encontrados.map((c: any, i: number) => (
                        <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>{c.nombre || '(sin nombre)'} {c.email ? `· ${c.email}` : ''} {c.empresa ? `· ${c.empresa}` : ''} · <code>{c.whatsapp}</code></div>
                      ))}
                    </div>
                  </details>
                )}

                {!applied && totalAplicar > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <button style={btnDark} disabled={loading !== ''} onClick={() => run(false)}>{loading === 'apply' ? 'Aplicando…' : `✅ Aplicar ${totalAplicar} cambios`}</button>
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>Actualiza {ap.actualizar || 0} WhatsApp y crea {ap.crear_contacto || 0} contactos.</span>
                  </div>
                )}
                {!applied && totalAplicar === 0 && <div style={{ fontSize: '0.82rem', color: '#666' }}>No hay cambios que aplicar de este archivo.</div>}

                {applied && (
                  <div style={{ background: '#e8f5e9', color: '#1b5e20', borderRadius: 8, padding: 12, fontSize: '0.85rem', fontWeight: 600 }}>
                    ✅ Listo · {applied.aplicados} WhatsApp actualizados · {applied.creados} contactos creados
                    {applied.errores?.length ? <div style={{ color: '#b93333', marginTop: 6, fontWeight: 400 }}>{applied.errores.length} errores: {applied.errores.slice(0, 3).join(' · ')}</div> : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
