// Importar leads del formulario instantáneo de TikTok.
//
// Dos pasos a propósito: REVISAR (dry_run) y luego importar. El export de
// TikTok trae los encabezados en el idioma de la cuenta y marketing cambia las
// preguntas del formulario sin avisar; ver el cruce antes de escribir es la
// diferencia entre detectar un mapeo raro y descubrirlo tres semanas después
// con cuarenta leads mal capturados.
import { useEffect, useState } from 'react';

const S = {
  fondo: { position: 'fixed' as const, inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 963, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  caja: { background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 720, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const },
  cab: { padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center', gap: 10 },
  cuerpo: { padding: '15px 17px', overflowY: 'auto' as const },
  pie: { padding: '12px 17px', borderTop: '1px solid #f0eff3', display: 'flex', gap: 8, alignItems: 'center' },
  btnP: { border: 'none', borderRadius: 9, padding: '9px 16px', background: '#9B8CFA', color: '#fff', fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnA: { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '8px 14px', background: '#fff', fontSize: '0.78rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' },
  mini: { border: '1px solid #e2e4e9', borderRadius: 7, padding: '7px 13px', fontSize: '0.76rem', fontWeight: 700, color: '#555', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  area: { width: '100%', minHeight: 150, border: '1.5px solid #e4dffb', borderRadius: 10, padding: 11, fontSize: '0.72rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: '#fdfcff', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  th: { fontSize: '0.56rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase' as const, letterSpacing: '.07em', textAlign: 'left' as const, padding: '7px 9px', borderBottom: '1px solid #f0eff3' },
  td: { padding: '9px', fontSize: '0.75rem', borderBottom: '1px solid #f7f6fa', verticalAlign: 'top' as const },
  nota: { fontSize: '0.72rem', color: '#8a8a8a', lineHeight: 1.5 },
};

const TAG: Record<string, { bg: string; fg: string; l: string }> = {
  creado: { bg: '#EAF8F2', fg: '#1E8A63', l: 'Nuevo' },
  actualizado: { bg: '#E3EDFD', fg: '#2C5FC4', l: 'Se completa' },
  duplicado: { bg: '#f4f4f6', fg: '#6B7280', l: 'Ya estaba' },
  error: { bg: '#FEF0EF', fg: '#C0554E', l: 'Error' },
};

export default function ImportarTikTok({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const [csv, setCsv] = useState('');
  const [prev, setPrev] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);

  useEffect(() => { fetch('/api/crm/leads/tiktok-config').then(r => r.json()).then(setCfg).catch(() => {}); }, []);

  async function llamar(dry_run: boolean) {
    setOcupado(true); setError('');
    try {
      const r = await fetch('/api/crm/leads/tiktok-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dry_run }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'No se pudo procesar el archivo.');
        if (j.encabezados_leidos) setError((j.error || '') + '\n\nColumnas que leí: ' + j.encabezados_leidos.join(' · '));
        return;
      }
      if (dry_run) setPrev(j); else { setHecho(j); onListo(); }
    } catch (e: any) {
      setError('Falló la conexión: ' + (e?.message || e));
    } finally { setOcupado(false); }
  }

  const r = hecho || prev;

  return (
    <div style={S.fondo} onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={S.caja}>
        <div style={S.cab}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Importar leads de TikTok Ads</h3>
            <div style={{ fontSize: '0.72rem', color: '#8a8a8a', marginTop: 2 }}>Carga manual · lo automático corre cada 15 min desde la hoja</div>
          </div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={S.cuerpo}>
          {!hecho && (
            <>
              {cfg && (
                <div style={{ ...S.nota, background: cfg.hoja_configurada ? '#EAF8F2' : '#FFF8EC', border: '1px solid ' + (cfg.hoja_configurada ? '#c5e8d8' : '#f5e3bf'), borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  {cfg.hoja_configurada ? (
                    <>
                      <b>Entrada automática conectada.</b> {cfg.total_leads_tiktok} lead(s) de TikTok en el CRM
                      {cfg.ultimo && <> · el último, {new Date(cfg.ultimo.cuando).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                        {cfg.ultimo.campana ? ` (${cfg.ultimo.campana})` : ''}</>}.
                    </>
                  ) : (
                    <>
                      <b>Falta conectar la hoja.</b> Comparte tu hoja de Google —como <b>editor</b>— con{' '}
                      <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: '0.7rem' }}>{cfg.correo_servicio || 'la cuenta de servicio (sin configurar)'}</code>{' '}
                      y guarda su id en la variable <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: '0.7rem' }}>TIKTOK_LEADS_SHEET_ID</code>. Mientras tanto, puedes cargar los leads aquí a mano.
                    </>
                  )}
                </div>
              )}
              <div style={{ ...S.nota, background: '#faf8ff', border: '1px solid #eee6fd', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                Los leads nuevos entran <b>solos</b> desde la hoja de Google conectada a TikTok (se revisa cada 15 minutos).
                Esto es para el <b>histórico</b> —lo que ya estaba en TikTok antes de conectarla— o para meter algo a mano
                si la hoja falla. En TikTok Ads Manager: <b>Herramientas → Formularios instantáneos → Descargar clientes
                potenciales</b>, y elige la descarga <b>por anuncio</b>: es la que trae campaña, grupo y anuncio, y sin
                esas columnas no se puede saber qué anuncio pagó cada lead.
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 4 }}>Pega el CSV completo (con su primera fila de encabezados)</div>
              <textarea value={csv} onChange={e => { setCsv(e.target.value); setPrev(null); }} style={S.area}
                placeholder={'ID del cliente potencial,Hora de creación,Nombre de la campaña,Nombre del anuncio,nombre,correo electrónico,número de teléfono…'} />
            </>
          )}

          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '9px 11px', fontSize: '0.75rem', color: '#C0554E', marginTop: 10, whiteSpace: 'pre-wrap' }}>{error}</div>}

          {r && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.78rem' }}>
                <span><b style={{ color: '#1E8A63' }}>{r.creados}</b> {hecho ? 'creados' : 'se crearán'}</span>
                <span><b style={{ color: '#2C5FC4' }}>{r.actualizados}</b> {hecho ? 'completados' : 'se completarán'}</span>
                <span><b style={{ color: '#6B7280' }}>{r.duplicados}</b> ya estaban</span>
                {r.errores > 0 && <span><b style={{ color: '#C0554E' }}>{r.errores}</b> con error</span>}
                {r.filas_descartadas > 0 && <span style={{ color: '#a5a2af' }}>{r.filas_descartadas} filas sin correo ni teléfono</span>}
              </div>

              {r.sin_campana > 0 && (
                <div style={{ background: '#FFF8EC', border: '1px solid #f5e3bf', borderRadius: 9, padding: '9px 11px', fontSize: '0.74rem', color: '#8a6d1f', marginBottom: 10 }}>
                  {r.sin_campana} lead(s) vienen <b>sin campaña</b>. Entran igual, pero no se les podrá calcular costo por lead.
                  Suele pasar cuando la descarga fue por formulario y no por anuncio.
                </div>
              )}

              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #f0eff3', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={S.th}>Lead</th><th style={S.th}>Campaña · anuncio</th><th style={S.th}>Qué pasa</th>
                  </tr></thead>
                  <tbody>
                    {(r.reporte || []).map((f: any, i: number) => {
                      const t = TAG[f.accion] || { bg: '#f4f4f6', fg: '#5D6470', l: f.accion || '—' };
                      return (
                        <tr key={i}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 700 }}>{f.nombre || '—'}</div>
                            <div style={{ fontSize: '0.68rem', color: '#8a8a8a' }}>{f.lead}</div>
                          </td>
                          <td style={{ ...S.td, fontSize: '0.71rem', color: '#555' }}>
                            {f.campana || <span style={{ color: '#c0554e' }}>sin campaña</span>}
                            {f.anuncio && <div style={{ color: '#a5a2af' }}>{f.anuncio}</div>}
                          </td>
                          <td style={S.td}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: t.bg, color: t.fg, borderRadius: 20, padding: '3px 9px' }}>{t.l}</span>
                            {f.error && <div style={{ fontSize: '0.66rem', color: '#C0554E', marginTop: 3 }}>{f.error}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div style={S.pie}>
          {hecho ? (
            <button style={S.btnP} onClick={onCerrar}>Listo</button>
          ) : (<>
            <button style={{ ...S.btnA, opacity: ocupado || !csv.trim() ? .5 : 1 }} disabled={ocupado || !csv.trim()} onClick={() => llamar(true)}>
              {ocupado && !prev ? 'Revisando…' : 'Revisar'}
            </button>
            <button style={{ ...S.btnP, opacity: ocupado || !prev ? .45 : 1 }} disabled={ocupado || !prev} onClick={() => llamar(false)}>
              {ocupado && prev ? 'Importando…' : `Importar ${prev ? (prev.creados + prev.actualizados) : ''}`.trim()}
            </button>
            <span style={{ ...S.nota, marginLeft: 'auto' }}>Nada se escribe hasta que le des Importar.</span>
          </>)}
        </div>
      </div>
    </div>
  );
}
