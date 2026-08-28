// Wiki de procesos de ventas — el LECTOR.
//
// Todo el contenido vive en src/lib/crm/wiki-contenido.ts: agregar una página
// es agregar un objeto ahí, nunca tocar este archivo. Aquí solo está el índice
// lateral, la selección y el estilo de lectura.
import { useState, useMemo } from 'react';
import { WIKI, GRUPOS_WIKI, type PaginaWiki } from '../../../lib/crm/wiki-contenido';

const TONO: Record<string, { bg: string; fg: string }> = {
  ok:   { bg: '#EAF8F2', fg: '#1E8A63' },
  warn: { bg: '#FFF4E5', fg: '#9a6a10' },
  bad:  { bg: '#FEF0EF', fg: '#C0554E' },
  mut:  { bg: '#EFEFF3', fg: '#7A7A88' },
};

export default function Wiki() {
  const [activa, setActiva] = useState<string>(() => {
    if (typeof window === 'undefined') return 'modelo';
    return new URLSearchParams(location.search).get('pagina') || 'modelo';
  });
  const pagina: PaginaWiki = useMemo(
    () => WIKI.find(p => p.id === activa) || WIKI[0], [activa]);

  const abrir = (id: string) => {
    setActiva(id);
    const u = new URL(location.href);
    u.searchParams.set('tab', 'wiki'); u.searchParams.set('pagina', id);
    history.replaceState({}, '', u);
    document.getElementById('wiki-cuerpo')?.scrollTo({ top: 0 });
  };

  return (
    <div className="wiki-wrap">
      <style>{`
        .wiki-wrap{display:grid;grid-template-columns:236px 1fr;gap:0;height:calc(100vh - 90px);
          border:1px solid #E4E4EA;border-radius:12px;overflow:hidden;background:#fff}
        .wiki-idx{border-right:1px solid #EFEFF3;overflow-y:auto;padding:14px 0 30px;background:#FCFCFD}
        .wiki-g{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#9A9AA8;
          font-weight:600;padding:15px 18px 5px}
        .wiki-i{display:block;width:100%;text-align:left;border:0;background:none;cursor:pointer;
          padding:7px 18px;font-size:13.5px;color:#4A4A57;border-left:2px solid transparent;line-height:1.35}
        .wiki-i:hover{background:#F4F4F7;color:#1B1B22}
        .wiki-i.on{background:#EEECFE;color:#5B4BD6;border-left-color:#5B4BD6;font-weight:600}
        .wiki-cp{overflow-y:auto;padding:34px 42px 80px}
        .wiki-cp h1{font-size:25px;letter-spacing:-.03em;margin:0 0 5px;font-weight:750;color:#1B1B22}
        .wiki-baj{color:#7A7A88;font-size:14px;margin:0 0 26px}
        .wiki-cp h3{font-size:15px;font-weight:680;margin:26px 0 8px;color:#1B1B22}
        .wiki-cp p{margin:0 0 12px;max-width:72ch;line-height:1.62;font-size:14.5px;color:#33333D}
        .wiki-cp ul{margin:0 0 14px;padding-left:19px;max-width:72ch}
        .wiki-cp li{margin-bottom:6px;font-size:14.5px;line-height:1.6;color:#33333D}
        .wiki-cp code{font-family:ui-monospace,Menlo,monospace;font-size:.87em;background:#EFEFF3;
          padding:1.5px 5px;border-radius:4px}
        .w-tab{border-collapse:collapse;width:100%;font-size:13.2px;margin:0 0 18px;
          border:1px solid #E4E4EA;border-radius:9px;overflow:hidden}
        .w-tab th{text-align:left;padding:9px 13px;background:#FAFAFC;border-bottom:1px solid #E4E4EA;
          font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#8A8A98;font-weight:600}
        .w-tab td{padding:9px 13px;border-bottom:1px solid #F2F2F5;vertical-align:top;line-height:1.55}
        .w-tab tr:last-child td{border-bottom:0}
        .w-caja{border:1px solid #E4E4EA;border-left:3px solid #5B4BD6;background:#FCFCFD;
          border-radius:8px;padding:14px 17px;margin:0 0 17px;max-width:72ch}
        .w-caja.w-ok{border-left-color:#1E8A63} .w-caja.w-warn{border-left-color:#9a6a10}
        .w-caja.w-bad{border-left-color:#C0554E}
        .w-caja p{margin:0 0 9px;font-size:14px} .w-caja p:last-child{margin-bottom:0}
        .w-k{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
          color:#8A8A98;font-weight:600;margin-bottom:6px}
        .w-mut{color:#8A8A98;font-size:.9em}
        .wiki-chip{display:inline-block;font-size:10.5px;font-weight:650;padding:2px 8px;
          border-radius:99px;margin-left:8px;vertical-align:middle}
        @media(max-width:820px){
          .wiki-wrap{grid-template-columns:1fr;height:auto;border:0;border-radius:0}
          .wiki-idx{border-right:0;border-bottom:1px solid #E4E4EA;display:flex;flex-wrap:wrap;
            gap:4px;padding:10px 12px}
          .wiki-g{width:100%;padding:8px 4px 2px}
          .wiki-i{width:auto;border-left:0;border-radius:7px;padding:5px 10px;font-size:12.5px}
          .wiki-i.on{border-left:0}
          .wiki-cp{padding:22px 18px 60px}
        }
      `}</style>

      <nav className="wiki-idx">
        {GRUPOS_WIKI.map(g => {
          const items = WIKI.filter(p => p.grupo === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="wiki-g">{g}</div>
              {items.map(p => (
                <button key={p.id} className={'wiki-i' + (p.id === activa ? ' on' : '')}
                  onClick={() => abrir(p.id)}>{p.titulo}</button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="wiki-cp" id="wiki-cuerpo">
        <h1>{pagina.titulo}
          {pagina.chip && (
            <span className="wiki-chip" style={{ background: TONO[pagina.chip.tono].bg, color: TONO[pagina.chip.tono].fg }}>
              {pagina.chip.texto}
            </span>
          )}
        </h1>
        {pagina.bajada && <p className="wiki-baj">{pagina.bajada}</p>}
        <div dangerouslySetInnerHTML={{ __html: pagina.cuerpo }} />
      </div>
    </div>
  );
}
