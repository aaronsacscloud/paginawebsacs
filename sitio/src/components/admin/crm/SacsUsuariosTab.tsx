import { useEffect, useMemo, useState } from 'react';
import { Server, RefreshCw, ShieldCheck, User, LogIn } from 'lucide-react';
import TablaEnterprise, { type ColDef, type QuickDef, type VistaDef } from './TablaEnterprise';
import { useIsMobile } from '../../../lib/ui/mobile';

/* ═══ Sección SACS — usuarios reales de cada cuenta SACS ═══
 * Correo, nombre, grupo de usuario y último acceso (día + hora), sobre el
 * datatable estándar. Fuente: /api/crm/sacs-usuarios (proxy a sacs_api →
 * sacsusers + Firebase Auth lastSignInTime). */

const td = { padding: '12px 14px', fontSize: '0.79rem', color: '#333', borderBottom: '1px solid #f1f2f5', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const };
const ell = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } as const;
const sub = { fontSize: '0.7rem', color: '#a7abb3', marginTop: 2 } as const;
const badge = { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const;

// "2026-07-24T18:02:49Z" o "Fri, 24 Jul 2026 18:02:49 GMT" → {dia, hora}
function fmtLogin(iso?: string | null): { dia: string; hora: string; ms: number } {
  if (!iso) return { dia: '', hora: '', ms: 0 };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { dia: '', hora: '', ms: 0 };
  return {
    dia: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, ''),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
    ms: d.getTime(),
  };
}
function haceCuanto(ms: number): string {
  if (!ms) return '';
  const dias = Math.floor((Date.now() - ms) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias}d`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)}m`;
  return `hace ${Math.floor(dias / 365)}a`;
}

export default function SacsUsuariosTab() {
  const isMobile = useIsMobile();
  const [cuentas, setCuentas] = useState<{ sacs_account: string; nombre: string }[]>([]);
  const [account, setAccount] = useState('');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/crm/sacs-usuarios').then(r => r.json()).then(j => {
      setCuentas(j.cuentas || []);
      if ((j.cuentas || []).length && !account) setAccount(j.cuentas[0].sacs_account);
    }).catch(() => setError('No se pudo cargar la lista de cuentas.'));
  }, []);

  async function cargar(acc: string) {
    if (!acc) return;
    setLoading(true); setError(''); setUsuarios([]);
    try {
      const j = await fetch('/api/crm/sacs-usuarios?account=' + encodeURIComponent(acc)).then(r => r.json());
      if (j.error) setError(j.error); else setUsuarios(j.usuarios || []);
    } catch (e: any) { setError(e?.message || 'Error'); }
    setLoading(false);
  }
  useEffect(() => { if (account) cargar(account); }, [account]);

  const [entrando, setEntrando] = useState('');
  async function entrar(u: any) {
    if (!confirm(`Vas a ENTRAR a SACS como "${u.nombre}" (cuenta ${account}).\nSe abrirá en una pestaña nueva con acceso completo. ¿Continuar?`)) return;
    setEntrando(u.uid);
    try {
      const j = await fetch('/api/crm/sacs-impersonar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, uid: u.uid }) }).then(r => r.json());
      if (j.error) alert(j.error);
      else window.open(j.url, '_blank', 'noopener');
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
    setEntrando('');
  }

  const activos = usuarios.filter(u => u.activo).length;
  const conLogin = usuarios.filter(u => u.ultimo_login).length;

  const cols: ColDef[] = [
    {
      key: 'usuario', label: 'Usuario', width: '32%', ftype: 'text',
      val: u => (u.nombre || '') + ' ' + (u.email || ''),
      render: u => (
        <td style={{ ...td, ...ell }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 99, background: '#eef2fe', color: '#4B7BE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.72rem' }}>
              {(u.nombre || u.email || '?').trim().charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...ell, fontWeight: 700 }}>{u.nombre}{u.es_admin ? <span style={{ ...badge, background: '#f1effd', color: '#6C5CE7', marginLeft: 6 }}>admin</span> : null}</div>
              <div style={{ ...ell, ...sub }}>{u.email || 'sin correo'}</div>
            </div>
          </div>
        </td>
      ),
    },
    {
      key: 'grupo', label: 'Grupo', width: '16%', ftype: 'select',
      options: useMemo(() => Array.from(new Set(usuarios.map(u => u.grupo_nombre).filter(Boolean))).map(g => ({ v: g, l: g })), [usuarios]),
      val: u => u.grupo_nombre || '',
      render: u => <td style={{ ...td, ...ell }}>{u.grupo_nombre ? <span style={{ ...badge, background: '#eef2f7', color: '#475569' }}>{u.grupo_nombre}</span> : <span style={{ color: '#c4c8cf' }}>—</span>}</td>,
    },
    {
      key: 'estado', label: 'Estado', width: 90, ftype: 'select', options: [{ v: 'activo', l: 'Activo' }, { v: 'inactivo', l: 'Inactivo' }],
      val: u => u.activo ? 'activo' : 'inactivo',
      render: u => <td style={td}>{u.activo ? <span style={{ ...badge, background: '#e6f6f2', color: '#1A8F7A' }}>Activo</span> : <span style={{ ...badge, background: '#f3f4f6', color: '#98999c' }}>Inactivo</span>}</td>,
    },
    {
      key: 'ultimo', label: 'Último acceso', width: '20%', ftype: 'date', val: u => (u.ultimo_login || '').slice(0, 10),
      render: u => { const f = fmtLogin(u.ultimo_login); const dias = f.ms ? Math.floor((Date.now() - f.ms) / 86400000) : 999; return (
        <td style={td}>
          {f.dia ? (
            <div>
              <div style={{ fontWeight: 600 }}>{f.dia} <span style={{ color: '#9aa0a8', fontWeight: 400 }}>· {f.hora}</span></div>
              <div style={{ ...sub, color: dias > 30 ? '#b93333' : dias > 7 ? '#a06600' : '#9aa0a8' }}>{haceCuanto(f.ms)}</div>
            </div>
          ) : <span style={{ color: '#c4c8cf' }}>nunca / sin dato</span>}
        </td>
      ); },
    },
    {
      key: 'sucursales', label: 'Sucursales', width: 90, num: true, ftype: 'number', val: u => Number(u.sucursales || 0),
      render: u => <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.sucursales || 0}</td>,
    },
    {
      key: 'acceso', label: 'Acceso', width: 118, sortable: false,
      render: u => (
        <td style={td} onClick={e => e.stopPropagation()}>
          <button onClick={() => entrar(u)} disabled={entrando === u.uid || !u.activo}
            title={u.activo ? 'Entrar a SACS como este usuario (acceso administrado)' : 'Usuario inactivo'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', border: '1px solid #d7dbe6', borderRadius: 8, background: u.activo ? '#fff' : '#f6f7f9', color: u.activo ? '#1a1a1a' : '#b9bcc2', fontSize: '0.74rem', fontWeight: 700, cursor: u.activo ? 'pointer' : 'not-allowed' }}>
            <LogIn size={13} strokeWidth={2.4} /> {entrando === u.uid ? '…' : 'Entrar'}
          </button>
        </td>
      ),
    },
  ];

  const quick: QuickDef[] = [
    { key: 'estado', label: 'Todos', options: [{ v: 'activo', l: 'Activos' }, { v: 'inactivo', l: 'Inactivos' }, { v: 'admin', l: 'Solo admins' }], apply: (u, v) => v === 'admin' ? !!u.es_admin : v === 'activo' ? u.activo : !u.activo },
  ];
  const vistasBase: VistaDef[] = [
    { key: 'todos', nombre: 'Todos', config: { sort: { key: 'ultimo', dir: -1 } } },
    { key: 'activos', nombre: 'Activos', config: { conds: [{ campo: 'estado', op: 'es', v1: 'activo' }], sort: { key: 'ultimo', dir: -1 } } },
    { key: 'admins', nombre: 'Administradores', config: { conds: [] } },
    { key: 'inactivos_login', nombre: 'Sin acceso reciente', config: { sort: { key: 'ultimo', dir: 1 } } },
  ];

  return (
    <div style={{ padding: '4px 12px 28px' }}>
      <style>{`.ct360 tbody tr:hover td { background: #f7f9fc; } @media (hover: none) { .ct360 tbody tr:active td { background: #f7f9fc; } } .spin { animation: sacsspin 0.8s linear infinite; } @keyframes sacsspin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eef2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Server size={20} color="#4B7BE5" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16181d' }}>Usuarios de SACS</div>
          <div style={{ fontSize: '0.8rem', color: '#8a8f98' }}>Las personas con acceso a cada cuenta SACS, su grupo y último acceso.</div>
        </div>
        <select value={account} onChange={e => setAccount(e.target.value)}
          style={{ height: isMobile ? 44 : 40, padding: '0 12px', border: '1px solid #e2e4e9', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, minWidth: 220, background: '#fff', ...(isMobile ? { width: '100%', flex: '1 1 100%', order: 3 } : {}) }}>
          {!cuentas.length && <option value="">Cargando cuentas…</option>}
          {cuentas.map(c => <option key={c.sacs_account} value={c.sacs_account}>{c.sacs_account}{c.nombre && c.nombre !== c.sacs_account ? ` — ${c.nombre}` : ''}</option>)}
        </select>
        <button onClick={() => cargar(account)} disabled={loading} title="Recargar"
          style={{ height: 40, width: 40, border: '1px solid #e2e4e9', borderRadius: 10, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={16} color="#5b616e" className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        {[
          { icon: <User size={18} color="#4B7BE5" />, bg: '#eef2fe', label: 'Usuarios', v: usuarios.length },
          { icon: <ShieldCheck size={18} color="#1A8F7A" />, bg: '#e6f6f2', label: 'Activos', v: activos },
          { icon: <RefreshCw size={18} color="#6C5CE7" />, bg: '#f1effd', label: 'Con acceso registrado', v: conLogin },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16181d', fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e9eaee', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)' }}>
        {error && <div style={{ background: '#fdecea', color: '#b93333', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.82rem' }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando usuarios de <b>{account}</b>…</div>
        ) : (
          <TablaEnterprise
            tabla={'sacs_usuarios_' + account}
            data={usuarios}
            cols={cols}
            quick={quick}
            vistasBase={vistasBase}
            searchText={u => [u.nombre, u.email, u.grupo_nombre].filter(Boolean).join(' ')}
            searchPlaceholder="Buscar usuario, correo o grupo…"
            minWidth={980}
            mobileCard={(u: any) => { const f = fmtLogin(u.ultimo_login); const dias = f.ms ? Math.floor((Date.now() - f.ms) / 86400000) : 999; return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 99, background: '#eef2fe', color: '#4B7BE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.85rem' }}>
                    {(u.nombre || u.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.nombre || u.email}{u.es_admin ? <span style={{ ...badge, background: '#f1effd', color: '#6C5CE7', marginLeft: 6 }}>admin</span> : null}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#8a8f98', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || 'sin correo'} · <span style={{ color: '#9aa0a8' }}>{account}</span></div>
                  </div>
                  {u.activo ? <span style={{ ...badge, background: '#e6f6f2', color: '#1A8F7A' }}>Activo</span> : <span style={{ ...badge, background: '#f3f4f6', color: '#98999c' }}>Inactivo</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  {u.grupo_nombre && <span style={{ ...badge, background: '#eef2f7', color: '#475569' }}>{u.grupo_nombre}</span>}
                  <span style={{ fontSize: '0.74rem', color: f.dia ? (dias > 30 ? '#b93333' : dias > 7 ? '#a06600' : '#9aa0a8') : '#c4c8cf' }}>
                    {f.dia ? `${f.dia} · ${haceCuanto(f.ms)}` : 'sin acceso registrado'}
                  </span>
                  <span onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
                    <button onClick={() => entrar(u)} disabled={entrando === u.uid || !u.activo}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px', border: '1px solid #d7dbe6', borderRadius: 10, background: u.activo ? '#fff' : '#f6f7f9', color: u.activo ? '#1a1a1a' : '#b9bcc2', fontSize: '0.8rem', fontWeight: 700, cursor: u.activo ? 'pointer' : 'not-allowed' }}>
                      <LogIn size={14} strokeWidth={2.4} /> {entrando === u.uid ? '…' : 'Entrar'}
                    </button>
                  </span>
                </div>
              </div>
            ); }}
            emptyMsg={account ? 'Esta cuenta no tiene usuarios (o SACS no respondió).' : 'Elige una cuenta.'}
          />
        )}
      </div>
    </div>
  );
}
