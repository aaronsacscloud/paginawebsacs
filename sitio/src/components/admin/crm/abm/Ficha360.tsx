// La ficha de una cuenta objetivo. Su razón de ser son dos columnas:
// LO QUE INVESTIGAMOS (fuentes públicas, puede estar viejo) y LO QUE NOS
// DIJERON (gana siempre). Más la bitácora de todo lo que ha pasado.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import Cadencia from './Cadencia';
import Whatsapp from './Whatsapp';
import { ETAPA_TONO, CONFIANZA_TONO, Pastilla, Puntaje, TOPES, fecha, fechaHora, enlaceDe } from './ui';

const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes', novias: 'Novias',
  zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano', joyeria: 'Joyería',
  charro: 'Charro y danza', scrubs: 'Uniformes médicos', telas: 'Telas y mercería',
  tallas: 'Tallas extra, maternidad y bebé', operadores: 'Operadores y concept stores',
  aliados: 'Consultoras y escuelas', canal: 'Canal mayorista',
};
const CANAL_ETIQ: Record<string, string> = {
  email_direccion: 'Correo de dirección', email_generico: 'Correo general',
  whatsapp_tienda: 'WhatsApp de la tienda', whatsapp_dueno: 'WhatsApp del dueño',
  telefono: 'Teléfono', dm_ig: 'Instagram', dm_fb: 'Facebook', linkedin: 'LinkedIn',
};
const METODO_ETIQ: Record<string, string> = {
  sitio_oficial: 'su sitio oficial', aviso_privacidad: 'el aviso de privacidad de su sitio',
  facebook_info: 'la sección Información de su Facebook', google_maps: 'su ficha de Google',
  localizador: 'su localizador de tiendas', instagram: 'su Instagram', prensa: 'una nota de prensa',
  directorio: 'un directorio de terceros', escaner: 'el escaneo de su sitio',
  confirmado_por_el_prospecto: 'el propio prospecto', investigacion: 'la investigación',
};
const ACT_ETIQ: Record<string, string> = {
  envio: 'Correo enviado', entrega: 'Correo entregado', apertura: 'Abrió el correo', clic: 'Hizo clic',
  respuesta: 'Respondió', rebote: 'Rebotó', spam: 'Marcó como spam', baja: 'Pidió baja',
  llamada: 'Llamada', whatsapp: 'WhatsApp', dm: 'Mensaje directo', nota: 'Nota', reunion: 'Reunión',
};
const ACT_COLOR: Record<string, string> = {
  respuesta: P.verdeTinta, clic: P.verdeTinta, apertura: P.azulTinta, reunion: P.verdeTinta,
  rebote: P.rojoTinta, spam: P.rojoTinta, baja: P.rojoTinta, llamada: P.violetaTinta,
};

const H = { fontSize: '.625rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, fontWeight: 800, color: '#999', margin: '0 0 8px' };
const CAJA = { background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '15px 17px' };

export default function Ficha360({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState<{ nombre: string; cargo: string; whatsapp: string; email: string } | null>(null);
  const [seguro, setSeguro] = useState(false);

  const traer = () => {
    setCargando(true);
    fetch(`/api/crm/abm/cuentas?id=${id}`).then(r => r.json()).then(r => { setD(r); setCargando(false); })
      .catch(() => setCargando(false));
  };
  useEffect(traer, [id]);

  const accion = async (body: any) => {
    setGuardando(true);
    try {
      const r = await fetch('/api/crm/abm/cuentas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }),
      });
      if (r.ok) { traer(); onCambio?.(); }
    } finally { setGuardando(false); }
  };

  if (cargando && !d) return <div style={{ padding: 40 }}><Cargando texto="Cargando la cuenta…" /></div>;
  if (!d?.cuenta) return <div style={{ padding: 30, color: '#888' }}>No se encontró la cuenta.</div>;

  const c = d.cuenta;
  const fuentePor = (campo: string) => (d.fuentes || []).find((f: any) => f.campo === campo) || (d.fuentes || [])[0];
  const confirmados = (d.personas || []).filter((p: any) => p.confirmado);

  return (
    <div style={{ padding: '4px 2px 40px', display: 'grid', gap: 13 }}>
      {/* ── Encabezado ── */}
      <div style={{ ...CAJA, borderLeft: `3px solid ${P.violeta}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-.01em' }}>{c.nombre}</h2>
            <p style={{ margin: '5px 0 0', fontSize: '.8125rem', color: '#666' }}>
              {GIROS[c.giro] || c.giro}{c.subgiro ? ` · ${c.subgiro}` : ''} · {c.ciudad || 'México'} · <b>{c.pais}</b> · opera en {c.moneda}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pastilla tono={ETAPA_TONO[c.etapa] || ETAPA_TONO.sin_tocar}>{(ETAPA_TONO[c.etapa] || ETAPA_TONO.sin_tocar).l}</Pastilla>
            {c.ruta === 'diagnostico' && <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>va a diagnóstico</Pastilla>}
            {c.ya_es_cliente && <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }} titulo={`En el CRM como ${c.ya_es_cliente}`}>ya es cliente</Pastilla>}
            <Puntaje v={c.puntaje || 0} ancho={70} />
            <span style={{ fontSize: '.6875rem', color: '#999' }}>de {TOPES.puntaje}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {['sin_tocar', 'en_cadencia', 'respondio', 'reunion', 'diagnostico', 'propuesta', 'ganada', 'perdida'].map(e => (
            <button key={e} disabled={guardando || c.etapa === e} onClick={() => accion({ accion: 'etapa', etapa: e })}
              style={{
                font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: c.etapa === e ? 'default' : 'pointer',
                border: c.etapa === e ? `1.5px solid ${P.violeta}` : '1px solid #e6e4ee',
                background: c.etapa === e ? P.violeta : '#fff', color: c.etapa === e ? '#fff' : '#666',
              }}>{ETAPA_TONO[e].l}</button>
          ))}
          <button onClick={() => setSeguro(true)}
            style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: '1px solid #f0c4bd', background: '#fff', color: P.rojoTinta, marginLeft: 'auto' }}>
            No contactar
          </button>
        </div>
        {/* Lo destructivo NUNCA va relleno, y no comparte renglón con las
            etapas: un botón sólido rojo sería el más llamativo de la ficha, y
            es el que borra. */}
        {seguro && (
          <div style={{ marginTop: 12, background: P.rojoAgua, borderRadius: 9, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.8125rem', color: P.rojoTinta, flex: 1, minWidth: 220 }}>
              Se cancelan sus correos pendientes y se bloquean todos sus canales, para siempre.
            </span>
            <button onClick={() => { accion({ accion: 'no_contactar' }); setSeguro(false); }}
              style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: '1.5px solid #f0c4bd', background: '#fff', color: P.rojoTinta }}>
              Sí, no contactar
            </button>
            <button onClick={() => setSeguro(false)}
              style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: '1px solid #e0dee8', background: '#fff', color: '#666' }}>
              Mejor no
            </button>
          </div>
        )}
      </div>

      {/* ── Las tres cifras del encaje ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 11 }}>
        <div style={tarjetaKpi(P.violeta)}>
          <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>Encaje</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.violetaTinta, lineHeight: 1.1 }}>{c.encaje}<span style={{ fontSize: '.8125rem', color: '#999' }}>/{TOPES.encaje}</span></div>
          <div style={{ fontSize: '.6875rem', color: '#888' }}>{c.sucursales ? `${c.sucursales} sucursales` : 'sin conteo de tiendas'}</div>
        </div>
        <div style={tarjetaKpi(P.ambar)}>
          <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>Dolor</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.ambarTinta, lineHeight: 1.1 }}>{c.dolor}<span style={{ fontSize: '.8125rem', color: '#999' }}>/{TOPES.dolor}</span></div>
          <div style={{ fontSize: '.6875rem', color: '#888' }}>{c.plataforma_web ? `corre en ${c.plataforma_web}` : c.sitio_http === 0 ? 'sitio caído' : 'sin señal técnica'}</div>
        </div>
        {/* La accesibilidad NO suma al puntaje —ordenar por ella era ordenar
            por "a quién le hallamos el correo"—, así que aquí se lee como lo
            que es: por dónde se le entra, no qué tan buen prospecto es. */}
        <div style={tarjetaKpi(P.verde)}>
          <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>Vías de contacto</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.verdeTinta, lineHeight: 1.1 }}>{(d.canales || []).length}</div>
          <div style={{ fontSize: '.6875rem', color: '#888' }}>{c.accesibilidad >= 17 ? 'fácil de alcanzar' : c.accesibilidad >= 8 ? 'se le puede entrar' : 'difícil de alcanzar'}</div>
        </div>
        <div style={tarjetaKpi(P.azul)}>
          <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>En Google</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: P.azulTinta, lineHeight: 1.1 }}>{c.google_rating ? Number(c.google_rating).toFixed(1) : '—'}</div>
          <div style={{ fontSize: '.6875rem', color: '#888' }}>{c.google_resenas ? `${c.google_resenas} reseñas` : 'sin conteo de reseñas'}</div>
        </div>
      </div>

      {/* ── Las dos verdades ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 11 }}>
        <div style={CAJA}>
          <p style={H}>Lo que investigamos</p>
          <Dato etiqueta="Sucursales" valor={c.sucursales ? String(c.sucursales) : 'sin dato'} fuente={fuentePor('general')} extra={c.sucursales_confianza} />
          <Dato etiqueta="Tecnología del sitio" valor={corta(c.plataforma_web, 70) || (c.sitio_http === 0 ? 'el sitio no responde' : 'sin detectar')} titulo={c.plataforma_web} extra={c.sitio_carrito === false ? 'no vende en línea' : undefined} />
          <Dato etiqueta="Redes" valor={[c.instagram, c.tiktok ? 'TikTok' : null, c.facebook ? 'Facebook' : null].filter(Boolean).join(' · ') || 'sin redes'} extra={c.ig_seguidores || undefined} />
          {c.contexto && <p style={{ fontSize: '.8125rem', color: '#555', margin: '10px 0 0', lineHeight: 1.5 }}>{c.contexto}</p>}
          {c.senal_expansion && (
            <p style={{ fontSize: '.8125rem', margin: '10px 0 0', color: '#555', lineHeight: 1.5 }}>
              <b style={{ color: P.verdeTinta }}>Crece:</b> {c.senal_expansion}
            </p>
          )}
          {c.ultima_publicacion && (
            <p style={{ fontSize: '.8125rem', margin: '8px 0 0', color: '#555', lineHeight: 1.5 }}>
              <b>Último post:</b> {c.ultima_publicacion}
            </p>
          )}
        </div>

        <div style={{ ...CAJA, borderLeft: `3px solid ${P.verde}` }}>
          <p style={H}>Lo que nos dijeron</p>
          {confirmados.length === 0 && (
            <p style={{ fontSize: '.8125rem', color: '#888', margin: '0 0 10px', lineHeight: 1.5 }}>
              Nadie ha contestado todavía. En cuanto alguien conteste, aquí se captura su nombre real, su celular
              y cuántas tiendas tiene <b>de verdad</b> — y eso gana sobre lo de la izquierda.
            </p>
          )}
          {confirmados.map((p: any) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '.875rem', fontWeight: 700 }}>{p.nombre} {p.cargo && <span style={{ fontWeight: 400, color: '#777' }}>· {p.cargo}</span>}</div>
              <div style={{ fontSize: '.75rem', color: '#777' }}>
                {[p.whatsapp && `WhatsApp ${p.whatsapp}`, p.email, p.telefono].filter(Boolean).join(' · ') || 'sin datos directos'}
              </div>
              <div style={{ fontSize: '.6875rem', color: '#999' }}>confirmado el {fecha(p.confirmado_at)}</div>
            </div>
          ))}
          {!nueva ? (
            <button onClick={() => setNueva({ nombre: '', cargo: '', whatsapp: '', email: '' })}
              style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${P.violeta}`, background: '#fff', color: P.violetaTinta }}>
              Capturar a quien nos contestó
            </button>
          ) : (
            <div style={{ display: 'grid', gap: 7 }}>
              {(['nombre', 'cargo', 'whatsapp', 'email'] as const).map(k => (
                <input key={k} value={(nueva as any)[k]} placeholder={k === 'nombre' ? 'Nombre de la persona' : k === 'cargo' ? 'Cargo (dueña, gerente…)' : k === 'whatsapp' ? 'Su WhatsApp directo' : 'Su correo directo'}
                  onChange={e => setNueva({ ...nueva, [k]: e.target.value } as any)}
                  style={{ font: 'inherit', fontSize: '.8125rem', padding: '7px 10px', borderRadius: 8, border: '1px solid #e0dee8' }} />
              ))}
              <div style={{ display: 'flex', gap: 7 }}>
                <button disabled={!nueva.nombre.trim() || guardando}
                  onClick={() => { accion({ accion: 'persona', ...nueva, es_dueno: true }); setNueva(null); }}
                  style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${P.violeta}`, background: '#fff', color: P.violetaTinta }}>Guardar</button>
                <button onClick={() => setNueva(null)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: '1px solid #e0dee8', background: '#fff', color: '#666' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Por dónde entrarle ── */}
      <div style={CAJA}>
        <p style={H}>Por dónde entrarle</p>
        {(d.canales || []).length === 0 && (
          <EstadoVacio titulo="Sin ninguna vía verificada"
            pista="Antes de escribirle hay que encontrarle un correo o un teléfono. La cola de llamadas sirve para eso." />
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {(d.canales || []).map((ch: any) => {
            const url = enlaceDe(ch.tipo, ch.valor);
            const tono = CONFIANZA_TONO[ch.confianza] || CONFIANZA_TONO.media;
            return (
              <div key={ch.id} style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 8, borderBottom: '1px solid #f2f1f6' }}>
                <span style={{ fontSize: '.6875rem', fontWeight: 700, color: '#888', minWidth: 148 }}>{CANAL_ETIQ[ch.tipo] || ch.tipo}</span>
                {url ? <a href={url} target="_blank" rel="noopener" style={{ fontSize: '.8125rem', fontWeight: 600, color: P.violetaTinta, textDecoration: 'none' }}>{ch.valor}</a>
                     : <span style={{ fontSize: '.8125rem' }}>{ch.valor}</span>}
                <Pastilla tono={{ bg: tono.bg, fg: tono.fg }}>{tono.l}</Pastilla>
                {ch.es_de_la_tienda && ch.tipo.startsWith('whatsapp') && (
                  <span style={{ fontSize: '.6875rem', color: P.ambarTinta }}>es el de la tienda, no el del dueño</span>
                )}
                {ch.estado !== 'sin_probar' && <span style={{ fontSize: '.6875rem', color: '#999' }}>{ch.estado}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── De dónde salió cada dato ── */}
      <div style={CAJA}>
        <p style={H}>De dónde salió cada dato</p>
        <div style={{ display: 'grid', gap: 7 }}>
          {(d.fuentes || []).slice(0, 8).map((f: any) => (
            <div key={f.id} style={{ fontSize: '.75rem', color: '#666', lineHeight: 1.5 }}>
              <b style={{ color: '#333' }}>{f.campo === 'general' ? 'Los datos de la cuenta' : f.campo}</b>{' '}
              salieron de <b>{METODO_ETIQ[f.metodo] || f.metodo}</b>, el {fecha(f.obtenido_at)} ·{' '}
              <span style={{ color: (CONFIANZA_TONO[f.confianza] || CONFIANZA_TONO.media).fg, fontWeight: 700 }}>{(CONFIANZA_TONO[f.confianza] || CONFIANZA_TONO.media).l}</span>
              {f.url && <> · <a href={f.url} target="_blank" rel="noopener" style={{ color: P.violetaTinta }}>ver fuente</a></>}
            </div>
          ))}
        </div>
      </div>

      {/* ── WhatsApp: lo manda una persona, con el mensaje ya escrito ── */}
      <div style={CAJA}>
        <p style={H}>WhatsApp</p>
        <Whatsapp cuentaId={id} onCambio={() => { traer(); onCambio?.(); }} />
      </div>

      {/* ── La cadencia, con el texto que se va a mandar ── */}
      <div style={CAJA}>
        <p style={H}>Su cadencia</p>
        <Cadencia cuentaId={id} onCambio={() => { traer(); onCambio?.(); }} />
      </div>

      {/* ── Bitácora ── */}
      <div style={CAJA}>
        <p style={H}>Todo lo que ha pasado</p>
        <ToqueManual id={id} onListo={() => { traer(); onCambio?.(); }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Apuntar algo de esta cuenta…"
            onKeyDown={e => { if (e.key === 'Enter' && nota.trim()) { accion({ accion: 'nota', texto: nota }); setNota(''); } }}
            style={{ flex: 1, font: 'inherit', fontSize: '.8125rem', padding: '8px 11px', borderRadius: 8, border: '1px solid #e0dee8' }} />
          <button disabled={!nota.trim() || guardando} onClick={() => { accion({ accion: 'nota', texto: nota }); setNota(''); }}
            style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${P.violeta}`, background: '#fff', color: P.violetaTinta }}>Apuntar</button>
        </div>
        {(d.actividad || []).length === 0 && (
          <EstadoVacio titulo="Todavía no pasa nada con esta cuenta"
            pista="En cuanto salga el primer correo, o alguien llame, aquí queda el rastro." />
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {(d.actividad || []).map((a: any) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: ACT_COLOR[a.tipo] || '#D6D3E0', marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.8125rem', color: '#333' }}>
                  <b style={{ color: ACT_COLOR[a.tipo] || '#444' }}>{ACT_ETIQ[a.tipo] || a.tipo}</b>
                  {a.texto ? <> · {a.texto}</> : null}
                </div>
                {a.transcripcion && (
                  <div style={{ fontSize: '.75rem', color: '#666', background: '#FAFAFC', border: '1px solid #efeef3', borderRadius: 8, padding: '8px 10px', marginTop: 5, whiteSpace: 'pre-wrap' }}>
                    {a.transcripcion}
                  </div>
                )}
                <div style={{ fontSize: '.6875rem', color: '#a0a0a0', marginTop: 2 }}>{fechaHora(a.ocurrio_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lo que no tiene API: la llamada, el mensaje directo, la junta. Si el CRM no
 *  lo guarda, el vendedor cree que tocó una cuenta que nunca tocó — y peor: la
 *  cadencia le sigue escribiendo a quien ya dijo que no. */
function ToqueManual({ id, onListo }: { id: string; onListo: () => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [transcripcion, setTranscripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const TIPOS = [
    { v: 'llamada', canal: 'llamada', l: 'Llamé', ayuda: 'Qué pasó en la llamada. Si la grabaste, pega abajo la transcripción.' },
    { v: 'dm', canal: 'dm_ig', l: 'Mandé un DM', ayuda: 'Instagram o Facebook: no hay API para iniciar, así que se manda a mano y se apunta aquí.' },
    { v: 'respuesta', canal: 'email', l: 'Me contestaron', ayuda: 'Qué contestaron. Esto DETIENE la cadencia.' },
    { v: 'reunion', canal: 'reunion', l: 'Junta agendada', ayuda: 'Cuándo y con quién.' },
  ];
  const t = TIPOS.find(x => x.v === abierto);

  const guardar = async () => {
    if (!t) return;
    setEnviando(true);
    try {
      await fetch('/api/crm/abm/actividad', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuenta_id: id, canal: t.canal, tipo: t.v, texto, transcripcion }),
      });
      setAbierto(null); setTexto(''); setTranscripcion(''); onListo();
    } finally { setEnviando(false); }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS.map(x => (
          <button key={x.v} onClick={() => setAbierto(abierto === x.v ? null : x.v)} style={{
            font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            border: abierto === x.v ? `1.5px solid ${P.violeta}` : '1px solid #e6e4ee',
            background: abierto === x.v ? P.violetaAgua : '#fff', color: abierto === x.v ? P.violetaTinta : '#666',
          }}>{x.l}</button>
        ))}
      </div>
      {t && (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <p style={{ fontSize: '.75rem', color: '#888', margin: 0 }}>{t.ayuda}</p>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder="Qué pasó…"
            style={{ font: 'inherit', fontSize: '.8125rem', padding: '9px 11px', borderRadius: 8, border: '1px solid #e0dee8', resize: 'vertical' }} />
          {t.v === 'llamada' && (
            <textarea value={transcripcion} onChange={e => setTranscripcion(e.target.value)} rows={4}
              placeholder="Transcripción de la llamada, si la tienes. Sirve para escribirle mejor la próxima vez."
              style={{ font: 'inherit', fontSize: '.75rem', padding: '9px 11px', borderRadius: 8, border: '1px solid #e0dee8', resize: 'vertical' }} />
          )}
          <div>
            <button disabled={enviando || !texto.trim()} onClick={guardar} style={{
              font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '8px 14px', borderRadius: 8,
              border: `1.5px solid ${P.violeta}`, background: '#fff', color: P.violetaTinta, cursor: 'pointer', opacity: texto.trim() ? 1 : .5,
            }}>Guardar el toque</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Varias plataformas vienen como párrafo ("desarrollo propio (catálogo con
 *  SKU y filtros por color/talla, HTML server-side…)"): sin recorte se sale de
 *  su caja y se imprime encima de lo de al lado. */
export function corta(v: any, max: number): string {
  const t = String(v || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max).replace(/[\s,(.;:-]+$/, '') + '…';
}

function Dato({ etiqueta, valor, fuente, extra, titulo }: { etiqueta: string; valor: string; fuente?: any; extra?: string; titulo?: string }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: '.6875rem', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
      <div style={{ fontSize: '.875rem', color: '#333' }} title={titulo || undefined}>
        {valor} {extra && <span style={{ fontSize: '.6875rem', color: '#999' }}>({extra})</span>}
      </div>
    </div>
  );
}
