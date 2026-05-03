import { useEffect, useState } from 'react';

interface Submission {
  id: string;
  partner_id: string;
  url: string;
  tipo: string;
  descripcion?: string;
  plataforma?: string;
  estado: 'pending_review' | 'approved' | 'rejected';
  puntos: number;
  mes_acreditado?: string;
  nota_admin?: string;
  created_at: string;
  team_members?: { nombre: string; email: string };
}

const TIPOS_LABEL: Record<string, { label: string; puntos: number }> = {
  story_reel: { label: 'Story / Reel corto', puntos: 10 },
  tutorial: { label: 'Tutorial / Guía', puntos: 15 },
  caso_uso: { label: 'Caso de uso', puntos: 20 },
  tour: { label: 'Tour del sistema', puntos: 20 },
  dia_en_la_vida: { label: 'Un día en la vida', puntos: 25 },
  testimonial: { label: 'Testimonial', puntos: 30 },
  serie_episodio: { label: 'Episodio serie', puntos: 30 },
  webinar: { label: 'Webinar', puntos: 40 },
  mini_documental: { label: 'Mini-documental', puntos: 50 },
  serie_completa: { label: 'Serie completa (10 eps)', puntos: 300 },
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

export default function ContentReviewTab() {
  const [list, setList] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('pending_review');

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/partners/content-review?estado=${filterEstado}`);
    const data = await res.json();
    setList(data.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filterEstado]);

  async function approve(s: Submission) {
    const tipoMeta = TIPOS_LABEL[s.tipo];
    const ptsStr = prompt(`Aprobar contenido de ${s.team_members?.nombre}?\n\nTipo: ${tipoMeta?.label || s.tipo}\nPuntos sugeridos: ${tipoMeta?.puntos || 0}\n\nDeja vacío para usar puntos sugeridos, o escribe un override:`, '');
    if (ptsStr === null) return;
    const pts = ptsStr.trim() ? Number(ptsStr) : undefined;
    if (ptsStr.trim() && (isNaN(pts!) || pts! < 0)) { alert('Puntos inválidos'); return; }
    const nota = prompt('Nota interna (opcional):', '') || undefined;

    const res = await fetch('/api/partners/content-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: s.id, action: 'approve', puntos_override: pts, nota }),
    });
    const data = await res.json();
    if (!res.ok) { alert('Error: ' + data.error); return; }
    alert(`✓ Aprobado · +${data.puntos} pts · email enviado al partner.`);
    load();
  }

  async function reject(s: Submission) {
    const motivo = prompt(`Rechazar contenido de ${s.team_members?.nombre}?\n\nEscribe el motivo (lo verá el partner por email):`, 'No alineado con el manual de marca');
    if (!motivo) return;
    const res = await fetch('/api/partners/content-review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: s.id, action: 'reject', nota: motivo }),
    });
    const data = await res.json();
    if (!res.ok) { alert('Error: ' + data.error); return; }
    alert('Rechazado · email enviado al partner');
    load();
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f6f8' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Contenido de partners</div>
        <h1 style={{ margin: 0, fontFamily: 'Clash Display, sans-serif', fontSize: '1.75rem', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.015em' }}>
          Revisión de contenido
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#666', maxWidth: 600 }}>
          Aprueba o rechaza los videos/posts que los partners suben para validar sus 100 puntos del mes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {(['pending_review', 'approved', 'rejected'] as const).map(e => (
          <button
            key={e}
            onClick={() => setFilterEstado(e)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: filterEstado === e ? '1px solid #1a1a1a' : '1px solid #e0e0e0',
              background: filterEstado === e ? '#1a1a1a' : '#fff',
              color: filterEstado === e ? '#fff' : '#666',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {e === 'pending_review' ? 'Por revisar' : e === 'approved' ? 'Aprobados' : 'Rechazados'}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ececec' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Cargando…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Sin submissions en este estado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {list.map(s => {
              const tipoMeta = TIPOS_LABEL[s.tipo];
              return (
                <div key={s.id} style={{ padding: 18, borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{s.team_members?.nombre || '—'}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{s.team_members?.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ padding: '4px 10px', background: 'rgba(75,123,229,0.10)', color: '#3764c4', fontSize: 11, fontWeight: 700, borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {tipoMeta?.label || s.tipo} · {tipoMeta?.puntos || 0} pts
                      </span>
                      {s.plataforma && <span style={{ fontSize: 11, color: '#999' }}>{s.plataforma}</span>}
                      <span style={{ fontSize: 11, color: '#999' }}>{fmtDate(s.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <a href={s.url} target="_blank" rel="noopener" style={{ color: '#4B7BE5', fontSize: 13, wordBreak: 'break-all' }}>
                      {s.url} ↗
                    </a>
                    {s.descripcion && <div style={{ fontSize: 13, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{s.descripcion}</div>}
                  </div>
                  {s.estado === 'pending_review' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approve(s)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: '#2AB5A0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Aprobar</button>
                      <button onClick={() => reject(s)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#b93333', border: '1px solid rgba(229,75,75,0.3)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Rechazar</button>
                    </div>
                  )}
                  {s.estado === 'approved' && (
                    <div style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(42,181,160,0.12)', color: '#1A8F7A', fontSize: 11, fontWeight: 700, borderRadius: 999 }}>
                      ✓ Aprobado · +{s.puntos} pts · mes {s.mes_acreditado}
                    </div>
                  )}
                  {s.estado === 'rejected' && (
                    <div>
                      <div style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(229,75,75,0.10)', color: '#b93333', fontSize: 11, fontWeight: 700, borderRadius: 999, marginBottom: 6 }}>
                        ✗ Rechazado
                      </div>
                      {s.nota_admin && <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>Motivo: {s.nota_admin}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
