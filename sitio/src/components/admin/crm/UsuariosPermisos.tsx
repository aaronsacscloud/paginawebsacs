// Usuarios del CRM y qué ve cada quien.
//
// Son las personas de ADENTRO: quien entra a trabajar al CRM con su correo y
// su contraseña. No son partners —ellos no entran aquí, tienen su portal— ni
// contactos de un cliente. Se dan de alta desde esta pantalla y desde aquí
// mismo se les bloquea lo que no les toca ver.
//
// El permiso se da por SECCIÓN del sistema —las mismas OCHO zonas del menú— y
// no es una casilla sino un nivel: edita / solo ve / no entra. "Ver sin
// editar" es lo que hace falta para quien consulta cuentas pero no mueve
// precios; con sí/no ese caso no existe.
//
// Al alta se muestra UNA vez la contraseña temporal. No se guarda en claro: si
// se pierde, se genera otra desde aquí.
import { useEffect, useState } from 'react';
import Cargando from './ui/Cargando';
import { SECCIONES, PRESETS, type Nivel } from '../../../lib/crm/permisos';
import { confirmar } from '../../../lib/ui/confirmar';

/* Los roles salen de PRESETS, no de una copia: eran dos listas que había que
   acordarse de mover juntas, y el día que no se movieron el menú ofrecía un
   rol que el servidor no conocía —y esa persona entraba sin permisos—. */
const ROLES = Object.entries(PRESETS).map(([id, r]) => ({ id, label: r.label, desc: r.desc }));

const NIVELES: { v: Nivel; label: string; color: string; fondo: string }[] = [
  { v: 'edit', label: 'Edita', color: '#fff', fondo: '#9B8CFA' },
  { v: 'ver', label: 'Solo ve', color: '#5B4BD6', fondo: '#E4DEFB' },
  { v: 'no', label: 'No entra', color: '#8e88a8', fondo: '#f4f3f8' },
];

/** El encabezado corto de cada sección: con el nombre completo, seis columnas
 *  empujan la tabla fuera del panel y las acciones quedan tras el scroll. */
const CORTO: Record<string, string> = {
  cuentas: 'Cuentas', ventas: 'Ventas', acompanamiento: 'Acompaña',
  marketing: 'Marketing', finanzas: 'Finanzas', trabajo: 'Trabajo IA',
  colaboradores: 'Partners', config: 'Config.',
};

const iniciales = (n?: string | null) => {
  const t = String(n || '').trim();
  if (!t) return '—';
  const p = t.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || t.slice(0, 2).toUpperCase();
};

const btn = { border: '1px solid #e6dff7', background: '#fff', borderRadius: 9, fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 700, color: '#4b4560', padding: '8px 13px', cursor: 'pointer' } as const;
const btnPri = { ...btn, background: '#9B8CFA', borderColor: '#9B8CFA', color: '#fff' } as const;
const input = { border: '1px solid #eae4f8', borderRadius: 9, padding: '9px 11px', fontFamily: 'inherit', fontSize: '0.82rem', color: '#241d43', background: '#FBFAFF', outline: 'none', width: '100%', boxSizing: 'border-box' as const };

export default function UsuariosPermisos() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [alta, setAlta] = useState(false);
  const [nuevo, setNuevo] = useState<any>({ nombre: '', email: '', rol: 'cs' });
  const [temporal, setTemporal] = useState<{ email: string; pass: string } | null>(null);
  const [guardando, setGuardando] = useState('');

  const cargar = () => {
    fetch('/api/crm/usuarios').then(r => r.json()).then(j => {
      if (j?.error) { setError(j.error); setLista([]); return; }
      setLista(j.usuarios || []);
    }).catch(() => setError('No se pudo cargar.'));
  };
  useEffect(cargar, []);

  async function cambiar(u: any, patch: any) {
    setGuardando(u.id);
    const r = await fetch('/api/crm/usuarios', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, ...patch }),
    });
    const j = await r.json().catch(() => ({}));
    setGuardando('');
    if (!r.ok) { alert(j?.error || 'No se pudo guardar.'); return; }
    if (j.password_temporal) setTemporal({ email: u.email, pass: j.password_temporal });
    cargar();
  }

  async function crear() {
    const r = await fetch('/api/crm/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert(j?.error || 'No se pudo crear.'); return; }
    setTemporal({ email: nuevo.email, pass: j.password_temporal });
    setAlta(false); setNuevo({ nombre: '', email: '', rol: 'cs' });
    cargar();
  }

  if (error) return <div style={{ fontSize: '0.8rem', color: '#C0554E', background: '#FEF0EF', border: '1px solid #F6D6D3', borderRadius: 11, padding: '12px 14px' }}>{error}</div>;
  if (!lista) return <Cargando texto="Cargando usuarios…" alto={140} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setAlta(!alta)} style={btnPri}>{alta ? 'Cancelar' : '+ Agregar usuario'}</button>
        {/* Quién entra por aquí y quién no. Sin decirlo, el alta de un partner
            se intenta en esta pantalla y el acceso queda donde no sirve. */}
        <span style={{ fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.5 }}>
          Gente de <b>adentro</b>: entra al CRM con su correo y ve solo las zonas que le dejes.
          Los <b>partners</b> no se dan de alta aquí — tienen su propio portal.
        </span>
      </div>

      {alta && (
        <div style={{ background: '#fff', border: '1px solid #efedf6', borderRadius: 14, padding: 16, marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, alignItems: 'end' }}>
          <label><span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a49dbd' }}>Nombre completo</span>
            <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre y apellido" style={{ ...input, marginTop: 5 }} /></label>
          <label><span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a49dbd' }}>Correo</span>
            <input value={nuevo.email} onChange={e => setNuevo({ ...nuevo, email: e.target.value })} placeholder="persona@correo.com" style={{ ...input, marginTop: 5 }} /></label>
          <label><span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a49dbd' }}>Rol</span>
            <select value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })} style={{ ...input, marginTop: 5 }}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>)}
            </select></label>
          <button onClick={crear} style={btnPri}>Crear usuario</button>
          <div style={{ gridColumn: '1 / -1', fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.55 }}>
            El rol define los permisos de arranque; después se ajusta sección por sección en la tabla.
            Al crearlo se genera una <b>contraseña temporal</b> que se muestra una sola vez — pásala por un medio seguro y
            que la persona la cambie al entrar.
          </div>
        </div>
      )}

      {temporal && (
        <div style={{ background: '#EAF8F2', border: '1px solid #cdeadd', borderRadius: 12, padding: '12px 14px', marginBottom: 14, fontSize: '0.79rem', color: '#1E8A63', lineHeight: 1.6 }}>
          <b>Contraseña temporal de {temporal.email}:</b>{' '}
          <code style={{ background: '#fff', padding: '3px 8px', borderRadius: 6, fontWeight: 800, letterSpacing: '.03em' }}>{temporal.pass}</code>
          <div style={{ marginTop: 4, color: '#3f6b58' }}>No se vuelve a mostrar. Si se pierde, genera otra desde el menú del usuario.</div>
          <button onClick={() => setTemporal(null)} style={{ ...btn, marginTop: 8, borderColor: '#cdeadd' }}>Entendido</button>
        </div>
      )}

      {/* Con OCHO zonas y las acciones, la tabla no cabe en pantallas
          medianas: se desplaza dentro de su propio marco en vez de estirar la
          pantalla. */}
      <div className="crm-scroll-x" style={{ overflowX: 'auto', border: '1px solid #efedf6', borderRadius: 14 }}>
        <table style={{ width: '100%', minWidth: 1120, borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              <th style={th}>Usuario</th>
              <th style={th}>Rol</th>
              <th style={{ ...th, textAlign: 'center' }} title="Si las llamadas entrantes le suenan en el CRM">Entrantes</th>
              {SECCIONES.map(s => <th key={s.id} style={{ ...th, textAlign: 'center', padding: '11px 6px' }} title={`${s.label}: ${s.desc}`}>{CORTO[s.id] || s.label}</th>)}
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {lista.map(u => {
              const esFounder = u.rol === 'founder';
              return (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: u.foto_url ? `#fff url(${u.foto_url}) center/cover no-repeat` : '#F3F0FE',
                        color: '#5B4BD6', fontSize: '0.7rem', fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{!u.foto_url && iniciales(u.nombre || u.email)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.81rem' }}>{u.nombre || '—'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#a49dbd' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    {/* Si la persona trae un rol que ya no está en la lista
                        —el «Agente IA» es 'soporte', de antes de los presets—,
                        el selector no lo encontraba y pintaba la PRIMERA
                        opción: la fila decía «Founder» sobre un usuario que no
                        entra a nada, y un clic distraído se lo daba de verdad.
                        Se agrega su rol real, marcado como lo que es. */}
                    <select value={u.rol} disabled={guardando === u.id}
                      onChange={e => cambiar(u, { rol: e.target.value, permisos: null })}
                      style={{ ...input, width: 'auto', minWidth: 104, fontSize: '0.72rem', padding: '6px 6px' }}>
                      {!ROLES.some(r => r.id === u.rol) && <option value={u.rol}>{u.rol} (rol antiguo)</option>}
                      {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </td>
                  {/* ══ QUIÉN ESTÁ EN LA COLA DEL TELÉFONO (20-sep-2026) ══════
                      No es un permiso de sección —el founder se los salta
                      todos— sino un turno: si las llamadas ENTRANTES le suenan
                      o no. Sale aquí, junto al rol, porque es de la misma
                      familia: quién hace qué. Las salientes y la cabina no se
                      tocan: cualquiera puede marcar. */}
                  <td style={{ ...td, textAlign: 'center' }}>
                    <label title="Si las llamadas entrantes le suenan en el CRM. No afecta a marcar ni a la cabina."
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: guardando === u.id ? 'wait' : 'pointer', fontSize: '0.72rem', color: '#6B7280' }}>
                      <input type="checkbox" checked={u.recibe_entrantes !== false} disabled={guardando === u.id}
                        onChange={e => cambiar(u, { recibe_entrantes: e.target.checked })} />
                      {u.recibe_entrantes !== false ? 'Sí' : 'No'}
                    </label>
                  </td>
                  {SECCIONES.map(s => {
                    const nivel: Nivel = (u.permisos_efectivos?.[s.id] || 'no') as Nivel;
                    return (
                      <td key={s.id} style={{ ...td, textAlign: 'center', padding: '10px 6px' }}>
                        <select
                          value={nivel}
                          disabled={esFounder || guardando === u.id}
                          title={esFounder ? 'El founder tiene todo, siempre' : `${s.label}: ${s.desc}`}
                          onChange={e => cambiar(u, { permisos: { ...(u.permisos_efectivos || {}), [s.id]: e.target.value } })}
                          style={{
                            border: 'none', borderRadius: 7, padding: '5px 7px', fontFamily: 'inherit',
                            fontSize: '0.68rem', fontWeight: 800, cursor: esFounder ? 'default' : 'pointer',
                            background: NIVELES.find(n => n.v === nivel)?.fondo,
                            color: NIVELES.find(n => n.v === nivel)?.color,
                            appearance: 'none' as const, WebkitAppearance: 'none' as const, textAlign: 'center' as const,
                          }}>
                          {NIVELES.map(n => <option key={n.v} value={n.v} style={{ background: '#fff', color: '#241d43' }}>{n.label}</option>)}
                        </select>
                      </td>
                    );
                  })}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={async () => { if (await confirmar(`Se genera una contraseña nueva para ${u.email} y la anterior deja de servir.\n\n¿Continuar?`)) cambiar(u, { resetear_password: true }); }}
                      style={{ ...btn, padding: '5px 9px', fontSize: '0.68rem' }}>Nueva contraseña</button>
                    {u.activo
                      ? <button onClick={async () => { if (await confirmar(`${u.nombre || u.email} dejará de poder entrar y se le cierran las sesiones abiertas.\n\nSu actividad pasada se conserva.`)) cambiar(u, { activo: false }); }}
                          style={{ ...btn, padding: '5px 9px', fontSize: '0.68rem', marginLeft: 6, color: '#C0554E', borderColor: '#f3dedd' }}>Desactivar</button>
                      : <button onClick={() => cambiar(u, { activo: true })} style={{ ...btn, padding: '5px 9px', fontSize: '0.68rem', marginLeft: 6, color: '#1E8A63', borderColor: '#cdeadd' }}>Reactivar</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.74rem', color: '#6b7280', lineHeight: 1.6, background: '#FBFAFF', border: '1px solid #f0edfa', borderRadius: 11, padding: '12px 14px' }}>
        <b>El permiso se revisa en el servidor, no solo en el menú.</b> «No entra» esconde la sección y además la API la
        rechaza; «Solo ve» deja leer pero devuelve error al intentar guardar. Sin eso, esconder un renglón sería decorativo:
        bastaría escribir la URL.<br /><br />
        <b>El founder no se puede limitar</b> —tendría todo igual— y nadie puede quitarse a sí mismo el rol ni desactivarse:
        es la forma más rápida de quedarse sin quien pueda arreglarlo.<br /><br />
        <b>El rol es el punto de partida, no una jaula.</b> Elegirlo llena las ocho zonas de golpe con lo típico de ese
        puesto; después cada una se sube o se baja en su columna y lo que quede ahí manda sobre el rol.
      </div>
    </div>
  );
}

const th = { textAlign: 'left' as const, fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#b0a8c9', padding: '11px 12px', borderBottom: '1px solid #f3f1fa' };
const td = { padding: '10px 12px', fontSize: '0.79rem', borderBottom: '1px solid #f7f6fb', verticalAlign: 'middle' as const };
