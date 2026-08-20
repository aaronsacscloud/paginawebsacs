// Editor de correos por bloques.
//
// El correo se ve al centro y se edita ahí mismo; el panel derecho es del
// bloque seleccionado. Un formulario a la izquierda con un preview mudo a la
// derecha convierte cada texto en un campo ciego.
//
// El HTML lo compila el SERVIDOR (mismo compilador que el envío), así que lo
// que se ve en la vista previa es literalmente lo que va a salir.
import { useEffect, useRef, useState } from 'react';
import { S, Tag, Vacio, Cargando, Aviso, chip, Elegir, PedirTexto, BotonCopiar } from './ui';

const TIPOS: Array<{ id: string; label: string; base: any }> = [
  { id: 'hero', label: 'Portada', base: { titulo: 'Un titular que importe', subtitulo: '' } },
  { id: 'encabezado', label: 'Título', base: { texto: 'Título de sección', nivel: 2 } },
  { id: 'texto', label: 'Párrafo', base: { texto: 'Escribe aquí.' } },
  { id: 'lista', label: 'Lista', base: { items: ['Primer punto', 'Segundo punto'] } },
  { id: 'boton', label: 'Botón', base: { texto: 'Ver más', href: 'https://www.sacscloud.com', align: 'left' } },
  { id: 'imagen', label: 'Imagen', base: { src: '', alt: '' } },
  { id: 'cita', label: 'Cita', base: { texto: 'Lo que dijo un cliente.', autor: 'Nombre' } },
  { id: 'dos_columnas', label: 'Dos columnas', base: { izquierda: { titulo: '', texto: '' }, derecha: { titulo: '', texto: '' } } },
  { id: 'planes', label: 'Planes', base: { planes: [{ nombre: 'Plan', precio: '$0', detalle: '' }] } },
  { id: 'separador', label: 'Separador', base: {} },
  { id: 'espaciador', label: 'Espacio', base: { alto: 20 } },
  { id: 'firma', label: 'Firma', base: { puesto: '' } },
];

export default function Plantillas() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState<any[] | null>(null);
  const [base, setBase] = useState<any>(undefined);   // undefined = nada en curso
  const [error, setError] = useState<string | null>(null);

  const cargar = () => fetch('/api/crm/email/templates').then(r => r.json()).then(j => setLista(j.plantillas || []));
  useEffect(() => { cargar(); }, []);

  async function abrirElector() {
    setError(null);
    const pre = await fetch('/api/crm/email/templates?predisenadas=1').then(r => r.json());
    setEligiendo(pre['prediseñadas'] || pre.predisenadas || []);
  }

  async function crear(nombre: string) {
    const elegida = base;
    setBase(undefined);
    const r = await fetch('/api/crm/email/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, asunto: elegida?.asunto || '', bloques: elegida?.bloques || [] }),
    });
    const j = await r.json();
    if (j.error) { setError(j.error); return; }
    await cargar(); setAbierta(j.plantilla.id);
  }

  if (abierta) return <Editor id={abierta} onCerrar={() => { setAbierta(null); cargar(); }} />;
  if (!lista) return <Cargando que="las plantillas" />;

  return (
    <div style={S.wrap}>
      {eligiendo && (
        <Elegir titulo="¿De dónde partimos?" sub="Puedes cambiar todo después: los bloques, el texto y los colores."
          opciones={[
            { id: 'blanco', nombre: 'En blanco', detalle: 'Empezar sin nada y armarlo bloque por bloque', valor: null },
            ...eligiendo.map((p: any, i: number) => ({
              id: String(i), nombre: p.nombre,
              detalle: p.bloques?.length ? `${p.bloques.length} bloques listos · asunto: "${p.asunto}"` : undefined,
              valor: p,
            })),
          ]}
          onElegir={(v: any) => { setEligiendo(null); setBase(v); }}
          onCancelar={() => setEligiendo(null)} />
      )}
      {base !== undefined && (
        <PedirTexto titulo="Nombre de la plantilla" sub="Solo lo ves tú, para encontrarla después."
          etiqueta="¿Cómo se llama?" valorInicial={base?.nombre || ''} marcador="Ej. Newsletter mensual"
          boton="Crear plantilla" onOk={crear} onCancelar={() => setBase(undefined)} />
      )}
      {error && <Aviso tono="malo" titulo="No se pudo crear">{error}</Aviso>}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Plantillas</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Los correos que reutilizas en campañas y embudos</div>
        </div>
        <button style={{ ...S.btnP, marginLeft: 'auto' }} onClick={abrirElector}>+ Nueva plantilla</button>
      </div>
      {lista.length === 0 ? (
        <Vacio titulo="Sin plantillas todavía" texto="Puedes partir de una prediseñada y cambiarle lo que quieras."
          accion={<button style={S.btnP} onClick={abrirElector}>Crear la primera</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {lista.map(p => (
            <div key={p.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setAbierta(p.id)}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{p.nombre}</div>
              <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 4 }}>{p.asunto || 'sin asunto'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const [p, setP] = useState<any>(null);
  const [bloques, setBloques] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [html, setHtml] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [ancho, setAncho] = useState<'desktop' | 'movil'>('desktop');
  const [estado, setEstado] = useState('');
  const historia = useRef<any[][]>([]);
  const guardado = useRef<any>(null);

  useEffect(() => {
    fetch(`/api/crm/email/templates?id=${id}`).then(r => r.json()).then(j => {
      setP(j.plantilla); setBloques(j.plantilla?.bloques || []);
    });
  }, [id]);

  // Vista previa con el compilador real, no una imitación del navegador.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/crm/email/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: true, bloques }),
      }).then(r => r.json()).then(j => { setHtml(j.html || ''); setAvisos(j.avisos || []); }).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [bloques]);

  // Autosave: perder el correo por cerrar la pestaña es el bug que hace que
  // alguien vuelva a Mailchimp.
  useEffect(() => {
    if (!p) return;
    if (JSON.stringify(bloques) === JSON.stringify(guardado.current)) return;
    const t = setTimeout(async () => {
      setEstado('Guardando…');
      const r = await fetch('/api/crm/email/templates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, bloques }),
      });
      const j = await r.json();
      guardado.current = JSON.parse(JSON.stringify(bloques));
      setAvisos(j.avisos || []);
      setEstado('Guardado');
      setTimeout(() => setEstado(''), 2200);
    }, 1200);
    return () => clearTimeout(t);
  }, [bloques, p]);

  const cambiar = (nuevos: any[]) => { historia.current.push(bloques); setBloques(nuevos); };
  const setB = (i: number, campos: any) => cambiar(bloques.map((b, j) => j === i ? { ...b, ...campos } : b));
  const agregar = (tipo: string) => {
    const t = TIPOS.find(x => x.id === tipo)!;
    cambiar([...bloques, { id: Math.random().toString(36).slice(2, 9), tipo, ...JSON.parse(JSON.stringify(t.base)) }]);
    setSel(bloques.length);
  };
  const mover = (i: number, d: number) => {
    const n = [...bloques]; const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]]; cambiar(n); setSel(j);
  };
  const deshacer = () => { const prev = historia.current.pop(); if (prev) setBloques(prev); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); deshacer(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  if (!p) return <Cargando que="la plantilla" />;
  const b = sel != null ? bloques[sel] : null;
  const inp = { ...S.inp, fontSize: '0.78rem' };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={S.btnG} onClick={onCerrar}>← Plantillas</button>
        <input defaultValue={p.nombre} onBlur={e => fetch('/api/crm/email/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nombre: e.target.value }) })}
          style={{ ...S.inp, maxWidth: 260, fontWeight: 700 }} />
        <input defaultValue={p.asunto ?? ''} placeholder="Asunto"
          onBlur={e => fetch('/api/crm/email/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, asunto: e.target.value }) })}
          style={{ ...S.inp, maxWidth: 300 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: '#8a8a8a' }}>{estado}</span>
          <button style={S.btnG} onClick={deshacer} title="Ctrl+Z">Deshacer</button>
          <button style={chip(ancho === 'desktop')} onClick={() => setAncho('desktop')}>Escritorio</button>
          <button style={chip(ancho === 'movil')} onClick={() => setAncho('movil')}>Móvil</button>
        </div>
      </div>

      {avisos.map((a, i) => <Aviso key={i} tono="aviso">{a}</Aviso>)}

      <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1.5fr) minmax(0,320px)', gap: 12, alignItems: 'start' }}>
        <div style={{ ...S.card, padding: 10 }}>
          <div style={{ ...S.kl, marginBottom: 7 }}>Bloques</div>
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => agregar(t.id)}
              style={{ ...S.btnG, width: '100%', textAlign: 'left', marginBottom: 4, fontSize: '0.73rem', padding: '6px 9px' }}>
              + {t.label}
            </button>
          ))}
        </div>

        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#faf9fc', borderBottom: '1px solid #f0eff3', overflowX: 'auto' }}>
            {bloques.map((x, i) => (
              <button key={x.id} onClick={() => setSel(i)}
                style={{ ...chip(sel === i), fontSize: '0.68rem', padding: '4px 9px', whiteSpace: 'nowrap' }}>
                {TIPOS.find(t => t.id === x.tipo)?.label || x.tipo}
              </button>
            ))}
            {bloques.length === 0 && <span style={{ fontSize: '0.73rem', color: '#a5a2af', padding: '4px' }}>Agrega bloques desde la izquierda →</span>}
          </div>
          <iframe title="Vista previa" srcDoc={html} sandbox=""
            style={{ width: ancho === 'movil' ? 375 : '100%', height: 560, border: 'none', display: 'block', margin: '0 auto', background: '#F4F3F7' }} />
        </div>

        <div style={S.card}>
          {!b ? (
            <div style={{ color: '#a5a2af', fontSize: '0.8rem', lineHeight: 1.6 }}>
              Elige un bloque arriba para editarlo. El pie legal con el link de baja se agrega solo al enviar.
            </div>
          ) : (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Tag tono="acento">{TIPOS.find(t => t.id === b.tipo)?.label}</Tag>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button style={{ ...S.btnG, padding: '3px 8px' }} onClick={() => mover(sel!, -1)}>↑</button>
                <button style={{ ...S.btnG, padding: '3px 8px' }} onClick={() => mover(sel!, 1)}>↓</button>
                <button style={{ ...S.btnG, padding: '3px 8px', color: '#C0554E' }}
                  onClick={() => { cambiar(bloques.filter((_, j) => j !== sel)); setSel(null); }}>Quitar</button>
              </div>
            </div>

            {['titulo', 'subtitulo', 'texto', 'autor', 'href', 'src', 'alt', 'puesto', 'nombre'].map(k => (
              k in b ? (
                <div key={k} style={{ marginBottom: 10 }}>
                  <span style={S.lbl}>{ETIQ_CAMPO[k] || k}</span>
                  {k === 'texto' && b.tipo !== 'cita'
                    ? <textarea value={b[k] ?? ''} onChange={e => setB(sel!, { [k]: e.target.value })} style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
                    : <input value={b[k] ?? ''} onChange={e => setB(sel!, { [k]: e.target.value })} style={inp} />}
                </div>
              ) : null
            ))}

            {Array.isArray(b.items) && (
              <div style={{ marginBottom: 10 }}>
                <span style={S.lbl}>Puntos</span>
                {b.items.map((it: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                    <input value={it} onChange={e => setB(sel!, { items: b.items.map((x: string, j: number) => j === i ? e.target.value : x) })} style={inp} />
                    <button style={{ ...S.btnG, padding: '3px 8px' }} onClick={() => setB(sel!, { items: b.items.filter((_: any, j: number) => j !== i) })}>✕</button>
                  </div>
                ))}
                <button style={{ ...S.btnG, fontSize: '0.72rem' }} onClick={() => setB(sel!, { items: [...b.items, 'Nuevo punto'] })}>+ Agregar punto</button>
              </div>
            )}

            {b.tipo === 'dos_columnas' && (['izquierda', 'derecha'] as const).map(lado => (
              <div key={lado} style={{ marginBottom: 10, borderTop: '1px solid #f5f4f8', paddingTop: 9 }}>
                <span style={S.lbl}>Columna {lado}</span>
                <input placeholder="Título" value={b[lado]?.titulo ?? ''} onChange={e => setB(sel!, { [lado]: { ...b[lado], titulo: e.target.value } })} style={{ ...inp, marginBottom: 5 }} />
                <textarea placeholder="Texto" value={b[lado]?.texto ?? ''} onChange={e => setB(sel!, { [lado]: { ...b[lado], texto: e.target.value } })} style={{ ...inp, minHeight: 56, resize: 'vertical' }} />
              </div>
            ))}

            <div style={{ borderTop: '1px solid #f5f4f8', marginTop: 10, paddingTop: 10 }}>
              <span style={S.lbl}>Variables (arrástralas al texto)</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {['nombre', 'empresa', 'plan'].map(v => (
                  <BotonCopiar key={v} texto={`{{${v}|}}`} etiqueta={`{{${v}}}`}
                    estilo={{ fontSize: '0.68rem', padding: '3px 8px' }} />
                ))}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 6, lineHeight: 1.5 }}>
                Escribe siempre un respaldo tras la barra: <code>{'{{nombre|Hola}}'}</code>. Sin él, a quien no tenga ese dato le llega un hueco.
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

const ETIQ_CAMPO: Record<string, string> = {
  titulo: 'Título', subtitulo: 'Subtítulo', texto: 'Texto', autor: 'Autor',
  href: 'Liga (URL)', src: 'URL de la imagen', alt: 'Texto alternativo',
  puesto: 'Puesto', nombre: 'Nombre',
};
