// Piezas chicas que comparten todas las pantallas de "Equipo": la hoja de
// estilos (una vez), el avatar con su punto de presencia, el texto del mensaje
// con menciones y ligas, y el selector de emojis.
import { useEffect, useMemo, useRef, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';

export const CSS = `
.eq{--eq-tinta:#1e1a33;--eq-gris:#6f6a86;--eq-linea:#ebe8f5;--eq-fondo:#fff;--eq-panel:#f8f7fd;--eq-alza:#fff;--eq-apagado:#c9c5d8;--eq-toast-fondo:#1e1a33;--eq-toast-tinta:#fff;--eq-realce:rgba(155,140,250,.10);--eq-sombra:rgba(60,30,140,.08);--rol-founder:#2E9E78;--rol-partner:#A76A12;--rol-soporte:#2C5FC4;--rol-admin:#9c3d70;--eq-lila:${P.violetaAgua};--eq-morado:${P.violeta};--eq-morado-tinta:${P.violetaTinta};
  display:flex;height:calc(100dvh - var(--eq-top,44px));min-height:480px;background:var(--eq-fondo);color:var(--eq-tinta);font-size:.875rem;overflow:hidden;border:1px solid var(--eq-linea);border-radius:12px}
.eq *{box-sizing:border-box}
.eq button{font:inherit;cursor:pointer}
.eq-arbol{width:248px;flex:0 0 248px;background:var(--eq-panel);border-right:1px solid var(--eq-linea);display:flex;flex-direction:column;overflow:hidden}
.eq-arbol-scroll{flex:1;overflow-y:auto;padding:6px 0 12px}
.eq-sec{padding:12px 12px 2px;display:flex;align-items:center;justify-content:space-between}
.eq-sec-t{font-size:.6875rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--eq-gris);display:flex;align-items:center;gap:6px;background:none;border:0;padding:0}
.eq-sec-t svg{transition:transform .15s}
.eq-sec-t.cerrada svg{transform:rotate(-90deg)}
.eq-sec-mas{opacity:0;background:none;border:0;color:var(--eq-gris);padding:2px 4px;border-radius:6px;line-height:1;display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px}
.eq-sec-mas:hover{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-sec:hover .eq-sec-mas,.eq-sec:focus-within .eq-sec-mas{opacity:1}
.eq-sec-acc{display:inline-flex;gap:2px}
/* El ⋯ de cada canal: aparece al pasar el puntero (siempre en móvil) y abre el menú de administrar. */
.eq-can-fila{position:relative;display:flex;align-items:center}
.eq-can-fila .eq-can{flex:1}
.eq-can-mas{position:absolute;right:10px;top:50%;transform:translateY(-50%);opacity:0;width:24px;height:24px;border:0;border-radius:6px;background:none;color:var(--eq-gris);display:inline-flex;align-items:center;justify-content:center;padding:0}
.eq-can-fila:hover .eq-can-mas,.eq-can-fila:focus-within .eq-can-mas,.eq-can-fila.activo .eq-can-mas{opacity:1}
.eq-can-mas:hover{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-can-fila:hover .eq-can .eq-badge,.eq-can-fila:hover .eq-can .eq-imp{visibility:hidden}
.eq-arch .eq-can{color:var(--eq-gris);font-style:italic}
.eq-peligro{display:flex;gap:8px;justify-content:flex-end;padding-top:10px;margin-top:2px;border-top:1px dashed var(--eq-linea)}
.eq-peligro .eq-btn{display:inline-flex;align-items:center;gap:6px;font-size:.8125rem;padding:6px 10px}
.eq-can{display:flex;align-items:center;gap:8px;width:calc(100% - 12px);margin:1px 6px;padding:6px 8px 6px 10px;border-radius:8px;border:0;background:none;color:var(--eq-gris);text-align:left;min-height:32px}
.eq-can:hover{background:var(--eq-realce);color:var(--eq-tinta)}
.eq-can.activo{background:var(--eq-alza);color:var(--eq-morado-tinta);font-weight:700;box-shadow:0 1px 6px var(--eq-sombra)}
.eq-can.nuevo{color:var(--eq-tinta);font-weight:700}
.eq-can .n{opacity:.55;font-weight:600}
.eq-can.activo .n{opacity:.8}
.eq-can .nombre{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--eq-morado);color:#fff;font-size:.6875rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.eq-badge.men{background:${P.rosa}}
.eq-imp{width:6px;height:6px;border-radius:3px;background:${P.ambar};flex:0 0 6px}
.eq-gente{border-top:1px solid var(--eq-linea);padding:6px 10px 8px}
.eq-per{display:flex;align-items:center;gap:7px;padding:3px 4px;border-radius:7px;width:100%;border:0;background:none;text-align:left;color:var(--eq-tinta);font-size:.8125rem}
.eq-per .nom{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px}
.eq-per .nom b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-per:hover{background:var(--eq-realce)}
.eq-per .est{font-size:.625rem;color:var(--eq-gris);white-space:nowrap;flex:0 0 auto}
.eq-av{position:relative;flex:0 0 auto;border-radius:50%;background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:800;display:inline-flex;align-items:center;justify-content:center;overflow:visible}
.eq-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.eq-av .pt{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;border:2px solid var(--eq-panel);background:var(--eq-apagado)}
.eq-av .pt.activo{background:${P.verde}}
.eq-av .pt.ausente{background:${P.ambar}}
.eq-canal{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--eq-fondo)}
.eq-cab{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--eq-linea);min-height:54px}
.eq-cab h2{margin:0;font-size:1rem;font-weight:800;display:flex;align-items:center;gap:6px;color:var(--eq-tinta)}
.eq-cab h2 .n{color:var(--eq-gris);font-weight:600}
.eq-cab .desc{color:var(--eq-gris);font-size:.8125rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.eq-ib{width:34px;height:34px;border-radius:9px;border:0;background:none;color:var(--eq-gris);text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.eq-ib:hover{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-ib.on{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-lista{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 0 12px;overscroll-behavior:contain}
.eq-dia{display:flex;align-items:center;gap:10px;margin:14px 16px 6px;color:var(--eq-gris);font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.eq-dia:before,.eq-dia:after{content:'';flex:1;height:1px;background:var(--eq-linea)}
.eq-nuevo{display:flex;align-items:center;gap:10px;margin:8px 16px;color:${P.rosaTinta};font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.eq-nuevo:after{content:'';flex:1;height:1px;background:${P.rosaSuave}}
.eq-msg{position:relative;display:flex;gap:10px;padding:2px 16px 2px 16px}
.eq-msg.inicio{margin-top:10px;padding-top:4px}
.eq-msg:hover{background:var(--eq-alza)}
.eq-msg.resaltado{background:${P.violetaAgua};animation:eq-fl 2.4s ease-out forwards}
@keyframes eq-fl{0%{background:${P.violetaAgua}}100%{background:transparent}}
.eq-msg .col{flex:1;min-width:0}
.eq-msg .gutter{width:36px;flex:0 0 36px;display:flex;justify-content:center;align-items:flex-start}
.eq-msg .hora-h{opacity:0;font-size:.625rem;color:var(--eq-gris);padding-top:4px;font-variant-numeric:tabular-nums}
.eq-msg:hover .hora-h{opacity:1}
.eq-msg .quien{display:flex;align-items:baseline;gap:8px;margin-bottom:1px}
.eq-msg .quien b{font-weight:800}
.eq-msg .quien time{font-size:.6875rem;color:var(--eq-gris);font-variant-numeric:tabular-nums}
.eq-msg .texto{white-space:pre-wrap;word-break:break-word;line-height:1.45}
.eq-msg .texto a{color:var(--eq-morado-tinta);text-decoration:underline;text-underline-offset:2px}
.eq-msg .texto code{background:var(--eq-panel);border:1px solid var(--eq-linea);border-radius:4px;padding:0 4px;font-size:.8125em}
.eq-msg .borrado{color:var(--eq-gris);font-style:italic}
.eq-men{background:var(--eq-lila);color:var(--eq-morado-tinta);border-radius:5px;padding:0 4px;font-weight:700}
.eq-men.yo{background:rgba(244,168,205,.35);color:${P.rosaTinta}}
.eq-ref{display:inline-flex;align-items:center;gap:5px;max-width:100%;margin:0 1px;padding:1px 8px 1px 4px;border:1px solid rgba(155,140,250,.45);border-radius:999px;background:var(--eq-alza);color:var(--eq-morado-tinta);font:inherit;font-weight:700;line-height:1.35;cursor:pointer;vertical-align:baseline;white-space:nowrap}
.eq-ref span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-ref small{flex:0 0 auto;font-size:.625rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:0 5px;border-radius:999px;background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-ref.cliente small{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-ref.lead small{background:${P.azulAgua};color:${P.azulTinta}}
.eq-ref.pago small{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-ref.cobranza small{background:${P.ambarAgua};color:${P.ambarTinta}}
.eq-ref:hover{background:var(--eq-lila);border-color:var(--eq-morado)}
.eq-cita{display:flex;gap:8px;align-items:center;margin:2px 0 4px;padding:3px 8px;border-left:2px solid var(--eq-morado);background:var(--eq-panel);border-radius:0 6px 6px 0;font-size:.8125rem;color:var(--eq-gris);cursor:pointer;max-width:560px}
.eq-cita b{color:var(--eq-morado-tinta)}
.eq-cita span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-acc{position:absolute;right:16px;top:-14px;display:none;gap:1px;background:var(--eq-alza);border:1px solid var(--eq-linea);border-radius:9px;padding:2px;box-shadow:0 3px 12px rgba(30,20,60,.10);z-index:2}
.eq-msg:hover .eq-acc,.eq-msg.menu .eq-acc{display:flex}
.eq-acc button{width:30px;height:28px;border:0;background:none;border-radius:6px;color:var(--eq-gris);display:inline-flex;align-items:center;justify-content:center;font-size:.9375rem}
.eq-acc button:hover,.eq-acc button.on{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-rx{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.eq-rx button{border:1px solid var(--eq-linea);background:var(--eq-panel);border-radius:12px;padding:1px 8px;font-size:.8125rem;display:inline-flex;gap:4px;align-items:center;color:var(--eq-tinta)}
.eq-rx button.mia{border-color:var(--eq-morado);background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:700}
.eq-rx button.mas{color:var(--eq-gris)}
.eq-hilo{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:3px 8px 3px 4px;border-radius:8px;border:0;background:none;color:var(--eq-morado-tinta);font-weight:700;font-size:.8125rem}
.eq-hilo:hover{background:var(--eq-lila)}
.eq-hilo .avs{display:flex}
.eq-hilo .avs .eq-av{margin-right:-6px;border:2px solid var(--eq-panel)}
.eq-hilo .cuando{color:var(--eq-gris);font-weight:500}
.eq-adj{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.eq-img{border-radius:10px;border:1px solid var(--eq-linea);background:var(--eq-panel);overflow:hidden;cursor:zoom-in;display:block;max-width:100%}
.eq-img img{display:block;max-width:100%;height:auto;max-height:320px;object-fit:cover}
.eq-audio{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;border:1px solid var(--eq-linea);background:var(--eq-panel);max-width:520px;width:100%}
.eq-audio audio{width:100%;height:36px}
.eq-audio .tr{font-size:.8125rem;color:var(--eq-tinta);line-height:1.4}
.eq-audio .tr.pend{color:var(--eq-gris);font-style:italic}
.eq-audio .tr b{color:var(--eq-gris);font-weight:700;font-size:.6875rem;text-transform:uppercase;letter-spacing:.05em;margin-right:6px}
.eq-caja{padding:8px 14px 12px;border-top:1px solid var(--eq-linea);background:var(--eq-fondo)}
.eq-caja .marco{position:relative;border:1.5px solid var(--eq-linea);border-radius:12px;background:var(--eq-alza);transition:border-color .12s}
.eq-caja .marco:focus-within{border-color:var(--eq-morado);box-shadow:0 0 0 3px rgba(155,140,250,.15)}
.eq-caja textarea{width:100%;border:0;outline:0;resize:none;background:transparent;padding:10px 12px 4px;font:inherit;line-height:1.45;max-height:200px;min-height:42px;color:var(--eq-tinta)}
.eq-caja .barra{display:flex;align-items:center;gap:2px;padding:2px 6px 6px}
.eq-caja .barra .esp{flex:1}
.eq-caja .enviar{width:34px;height:34px;border-radius:9px;border:0;background:var(--eq-morado);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.eq-caja .enviar:disabled{background:#d9d4f3;cursor:default}
.eq-caja .enviar:not(:disabled):hover{background:${P.violetaHondo}}
.eq-resp{display:flex;align-items:center;gap:8px;padding:6px 12px 0;font-size:.8125rem;color:var(--eq-gris)}
.eq-resp b{color:var(--eq-morado-tinta)}
.eq-resp span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-resp button{border:0;background:none;color:var(--eq-gris);font-size:1rem;line-height:1;padding:2px 6px}
.eq-pre{display:flex;flex-wrap:wrap;gap:8px;padding:8px 12px 0}
.eq-pre .it{position:relative;border:1px solid var(--eq-linea);border-radius:8px;overflow:hidden;background:var(--eq-panel);min-width:64px;min-height:48px;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:var(--eq-gris);padding:4px 8px}
.eq-pre .it img{height:64px;width:auto;display:block}
.eq-pre .it .x{position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(30,20,60,.75);color:#fff;font-size:.75rem;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.eq-pop{position:absolute;bottom:calc(100% + 6px);left:0;background:var(--eq-alza);border:1px solid var(--eq-linea);border-radius:12px;box-shadow:0 8px 30px rgba(30,20,60,.14);z-index:5;overflow:hidden}
.eq-pop.der{left:auto;right:0}
.eq-menciones{min-width:240px;padding:4px}
.eq-menciones button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;background:none;border-radius:8px;text-align:left;color:var(--eq-tinta)}
.eq-menciones button.sel,.eq-menciones button:hover{background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-menciones{min-width:320px;max-width:min(460px,calc(100vw - 32px));max-height:min(380px,60vh);overflow-y:auto}
.eq-menciones .grupo{font-size:.625rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--eq-gris);padding:8px 8px 3px}
.eq-menciones button.it{align-items:flex-start;gap:9px;padding:6px 8px}
.eq-menciones .tip{flex:0 0 auto;margin-top:2px;font-size:.625rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:999px;background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-menciones .tip.cliente,.eq-menciones .tip.pago{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-menciones .tip.lead{background:${P.azulAgua};color:${P.azulTinta}}
.eq-menciones .tip.cobranza{background:${P.ambarAgua};color:${P.ambarTinta}}
.eq-menciones .dos{display:flex;flex-direction:column;min-width:0}
.eq-menciones .dos b{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-menciones .dos small{font-size:.6875rem;color:var(--eq-gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-menciones button.sel .dos small,.eq-menciones button:hover .dos small{color:var(--eq-morado-tinta)}
.eq-menciones .vacio{padding:10px 8px;font-size:.8125rem;color:var(--eq-gris)}
.eq-menciones .pista{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px 4px;border-top:1px solid var(--eq-linea)}
.eq-menciones .pista button{width:auto;padding:2px 8px;border:1px solid var(--eq-linea);border-radius:999px;font-size:.75rem;font-weight:700;color:var(--eq-gris)}
.eq-emojis{width:320px;max-width:calc(100vw - 32px)}
.eq-emojis .rapidos{display:flex;gap:2px;padding:6px 8px;border-bottom:1px solid var(--eq-linea)}
.eq-emojis .rapidos button,.eq-emojis .grid button{width:34px;height:34px;border:0;background:none;border-radius:8px;font-size:1.25rem;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.eq-emojis .rapidos button:hover,.eq-emojis .grid button:hover{background:var(--eq-lila)}
.eq-emojis .grid{display:grid;grid-template-columns:repeat(8,1fr);padding:6px 8px;max-height:220px;overflow-y:auto}
.eq-emojis .cat{grid-column:1/-1;font-size:.625rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--eq-gris);padding:6px 4px 2px}
.eq-gifs{width:380px;max-width:calc(100vw - 32px)}
.eq-gifs input{width:100%;border:0;border-bottom:1px solid var(--eq-linea);padding:10px 12px;font:inherit;outline:0}
.eq-gifs .grid{columns:2;gap:4px;padding:6px;max-height:300px;overflow-y:auto}
.eq-gifs .grid button{display:block;width:100%;border:0;padding:0;margin:0 0 4px;border-radius:8px;overflow:hidden;background:var(--eq-panel);break-inside:avoid}
.eq-gifs .grid img{display:block;width:100%}
.eq-gifs .vacio{padding:18px 12px;color:var(--eq-gris);font-size:.8125rem;text-align:center}
.eq-grab{display:flex;align-items:center;gap:10px;padding:8px 12px;flex:1}
.eq-grab .pt{width:10px;height:10px;border-radius:50%;background:${P.rojo};animation:eq-pulso 1s infinite}
@keyframes eq-pulso{50%{opacity:.35}}
.eq-grab .t{font-variant-numeric:tabular-nums;font-weight:700}
.eq-grab .onda{flex:1;height:26px;display:flex;align-items:center;gap:2px}
.eq-grab .onda i{display:block;width:3px;border-radius:2px;background:var(--eq-morado);min-height:3px}
.eq-lado{width:380px;flex:0 0 380px;border-left:1px solid var(--eq-linea);display:flex;flex-direction:column;background:var(--eq-fondo);min-width:0}
.eq-lado .eq-cab h2{font-size:.9375rem}
.eq-lado.ficha{width:min(760px,58%);flex-basis:min(760px,58%)}
.eq-lado.ficha .eq-cab h2{flex:1;min-width:0;gap:8px}
.eq-lado.ficha .eq-cab .eq-btn{font-size:.75rem;padding:5px 10px;white-space:nowrap}
.eq-ficha-tipo{flex:0 0 auto;font-size:.625rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-ficha-tipo.cliente,.eq-ficha-tipo.pago{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-ficha-tipo.lead{background:${P.azulAgua};color:${P.azulTinta}}
.eq-ficha-tipo.cobranza{background:${P.ambarAgua};color:${P.ambarTinta}}
.eq-ficha-nombre{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-ficha{padding:14px 18px 24px;display:flex;flex-direction:column;gap:12px}
.eq-ficha-cifra{background:linear-gradient(135deg,var(--eq-lila),rgba(244,168,205,.22));border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.eq-ficha-cifra small{font-size:.625rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--eq-gris)}
.eq-ficha-cifra b{font-size:1.6rem;font-weight:800;color:${P.verdeTinta};letter-spacing:-.01em}
.eq-ficha-cifra.mal b{color:${P.rojoTinta}}
.eq-ficha-cifra.aviso b{color:${P.ambarTinta}}
.eq-ficha-cifra.bien b{font-size:1.2rem}
.eq-ficha-cifra span{font-size:.8125rem;color:var(--eq-gris)}
.eq-datos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 14px}
.eq-dato{display:flex;flex-direction:column;gap:1px;min-width:0}
.eq-dato small{font-size:.625rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--eq-gris)}
.eq-dato span{font-size:.875rem;overflow-wrap:anywhere}
.eq-ficha-liga{display:flex;flex-direction:column;gap:1px;text-align:left;border:1px solid var(--eq-linea);border-radius:10px;padding:10px 12px;background:var(--eq-alza);font:inherit;color:inherit;cursor:pointer;border-left:3px solid var(--eq-morado)}
.eq-ficha-liga:hover{background:var(--eq-lila)}
.eq-ficha-liga.quieto{cursor:default}
.eq-ficha-liga.quieto:hover{background:var(--eq-alza)}
.eq-ficha-liga small{font-size:.625rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--eq-gris)}
.eq-ficha-liga b{font-weight:700}
.eq-ficha-liga span{font-size:.75rem;color:var(--eq-gris)}
.eq-ficha-acciones{display:flex;flex-wrap:wrap;gap:8px}
.eq-ficha-acciones .eq-btn{font-size:.8125rem;text-decoration:none;display:inline-flex;align-items:center}
.eq-vacio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--eq-gris);padding:24px;text-align:center}
.eq-vacio b{color:var(--eq-tinta);font-size:1rem}
.eq-btn{border:1.5px solid var(--eq-morado);color:var(--eq-morado-tinta);background:var(--eq-alza);border-radius:9px;padding:7px 12px;font-weight:700}
.eq-btn.p{background:var(--eq-morado);color:#fff;border-color:var(--eq-morado)}
.eq-btn.p:hover{background:${P.violetaHondo}}
.eq-btn.t{border-color:var(--eq-linea);color:var(--eq-gris)}
.eq-btn.d{border-color:#f0c4bd;color:${P.rojoTinta}}
.eq-btn:disabled{opacity:.5;cursor:default}
.eq-form{display:flex;flex-direction:column;gap:10px;padding:16px}
.eq-form label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;font-weight:700;color:var(--eq-gris)}
.eq-form input,.eq-form select,.eq-form textarea{font:inherit;border:1.5px solid var(--eq-linea);border-radius:9px;padding:8px 10px;color:var(--eq-tinta);outline:0}
.eq-form input:focus,.eq-form select:focus,.eq-form textarea:focus{border-color:var(--eq-morado)}
.eq-form .fila{display:flex;gap:8px;align-items:center}
.eq-form .err{color:${P.rojoTinta};font-size:.8125rem}
.eq-modal-f{position:fixed;inset:0;background:rgba(20,14,40,.45);z-index:960;display:flex;align-items:center;justify-content:center;padding:16px}
.eq-modal{background:var(--eq-alza);border-radius:14px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(20,14,40,.3);overflow:hidden}
.eq-modal h3{margin:0;padding:14px 16px;border-bottom:1px solid var(--eq-linea);font-size:.9375rem}
.eq-luz{position:fixed;inset:0;background:rgba(10,8,20,.9);z-index:980;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.eq-luz img{max-width:96vw;max-height:92vh;border-radius:8px;box-shadow:0 10px 60px rgba(0,0,0,.5)}
.eq-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--eq-toast-fondo);color:var(--eq-toast-tinta);padding:9px 14px;border-radius:10px;font-size:.8125rem;z-index:990;box-shadow:0 6px 24px rgba(0,0,0,.25)}
.eq-conex{font-size:.6875rem;color:var(--eq-gris);display:flex;align-items:center;gap:5px;padding:0 12px 6px}
.eq-conex i{width:7px;height:7px;border-radius:50%;background:var(--eq-apagado);display:inline-block}
.eq-conex i.on{background:${P.verde}}
.eq-sala{flex:1;overflow-y:auto;padding:12px 14px 20px;display:flex;flex-direction:column;gap:14px}
/* EL GUION de la junta: lo fijo, lo que se lee en voz alta cada semana.
   Se ve distinto de la agenda a propósito —fondo, no tarjetas— porque no es
   una lista de pendientes que se palomea: es el orden del día. */
.eq-guion{display:flex;flex-direction:column;gap:12px}
.eq-guion-int{margin:0 0 2px;font-size:12.5px;line-height:1.5;color:var(--eq-gris)}
.eq-guion-b{border:1px solid var(--eq-linea);border-radius:12px;overflow:hidden;background:var(--eq-panel)}
.eq-guion-h{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--eq-lila);border-bottom:1px solid var(--eq-linea)}
.eq-guion-h b{font-size:13px;line-height:1.3;color:var(--eq-tinta)}
/* Quién presenta va PRIMERO y en pastilla: en una junta de dos, saber a quién
   le toca hablar es la mitad de la información. */
.eq-guion-h .q{flex-shrink:0;font-size:10.5px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;
  color:var(--eq-morado-tinta);background:var(--eq-alza);border:1px solid var(--eq-linea);border-radius:999px;padding:2px 8px}
.eq-guion-b ol{margin:0;padding:10px 14px 12px 30px;display:flex;flex-direction:column;gap:7px}
.eq-guion-b li{font-size:13px;line-height:1.5;color:var(--eq-tinta)}
.eq-guion-b li::marker{color:var(--eq-gris);font-size:11.5px}
/* Los minutos del bloque, a la derecha del título: la junta tiene forma antes
   de empezar, no a la mitad. */
.eq-guion-h .m{margin-left:auto;flex-shrink:0;font-size:11px;font-weight:700;color:var(--eq-gris);font-variant-numeric:tabular-nums}
/* La fuente del dato, debajo del punto: dónde se saca ese número. Va en otra
   línea y en gris porque es instrucción, no contenido de la junta. */
.eq-guion-b li .f{display:block;margin-top:3px;font-size:11px;font-weight:600;color:var(--eq-morado-tinta);
  background:var(--eq-lila);border-radius:6px;padding:2px 7px;width:fit-content;max-width:100%}

/* ══ La sala, rediseñada (5-sep-2026) ══════════════════════════════════════ */

/* LO QUE VIENE DE LA JUNTA PASADA. Va arriba y se ve distinto: es lo único de
   la sala que YA se prometió una vez. En ámbar, no en rojo — es un pendiente,
   no un error. */
.eq-antes{border-color:#f0dfae;background:#fffdf7}
.eq-antes>.cab{background:#fff8e8;border-bottom-color:#f0dfae}
.eq-antes>.cab b{color:#7a5c14}
.eq-antes>.cab .n{background:#f7ecd0;color:#7a5c14}
/* «Pasar a hoy»: el clic que cierra el ciclo. Va a la derecha de la fila, en su
   propia columna, para que nunca compita con la palomita de «hecho». */
.eq-acuerdo .pasa{flex-shrink:0;align-self:center;white-space:nowrap;border-color:#e3c98f;color:#7a5c14}
.eq-acuerdo .pasa:hover:not(:disabled){background:#fff8e8}
.eq-acuerdo .veces{color:#9a6a10;font-weight:700}

/* La cuenta regresiva cuando la junta está cerca: deja de ser dato y pasa a ser
   aviso. */
.eq-ya{color:var(--eq-morado-tinta);background:var(--eq-lila);border-radius:6px;padding:1px 6px}

/* De quién son los puntos. Una tira delgada, no una tarjeta: separa sin robar
   el espacio que necesitan los puntos. */
.eq-quien{display:flex;align-items:center;gap:6px;padding:7px 12px 3px;font-size:11.5px;font-weight:800;
  color:var(--eq-gris);text-transform:uppercase;letter-spacing:.02em}
.eq-quien .c{margin-left:auto;text-transform:none;letter-spacing:0;font-weight:700;color:var(--eq-gris)}

/* Un vacío que dice QUÉ HACER. «Vacía» no le sirve a nadie. */
.eq-nota{padding:10px 12px;font-size:12.5px;line-height:1.5;color:var(--eq-gris)}

/* Confirmar en el mismo botón, sin diálogo del sistema. */
.eq-btn.peligro{border-color:#f7c9c5;background:#fef0ef;color:#c0554e;font-weight:700}

/* ── ESPACIO ──────────────────────────────────────────────────────────────
   La sala se lee de arriba abajo y lo importante está arriba, así que lo que
   sobra es el aire ENTRE bloques, no dentro de ellos. */
.eq-sala{gap:10px;padding:10px 12px 24px}
@media (max-width:760px){
  /* En el teléfono, cada bloque pega con el siguiente y el texto baja un punto:
     entran dos bloques más por pantalla sin que nada se apretuje. */
  .eq-sala{gap:8px;padding:8px 10px 28px}
  .eq-guion-b ol{padding:9px 12px 10px 26px;gap:6px}
  .eq-guion-b li{font-size:12.5px}
  .eq-guion-h{padding:8px 10px}
  .eq-quien{padding:6px 10px 2px}
  /* El botón de «Pasar a hoy» baja a su propia línea: en 390 px, al lado del
     texto lo dejaba en dos palabras por renglón. */
  .eq-acuerdo{flex-wrap:wrap}
  .eq-acuerdo .pasa{margin-left:26px}
}
.eq-bloque{border:1px solid var(--eq-linea);border-radius:12px;background:var(--eq-alza);overflow:hidden}
.eq-bloque .cab{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--eq-linea);background:var(--eq-panel)}
.eq-bloque .cab b{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--eq-gris)}
.eq-bloque .cab .n{font-size:.75rem;color:var(--eq-gris)}
.eq-punto{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid var(--eq-linea)}
.eq-punto:last-child{border-bottom:0}
.eq-punto .num{width:22px;height:22px;border-radius:7px;background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:800;font-size:.75rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px}
.eq-punto .tt{flex:1;min-width:0}
.eq-punto .tt b{display:block;font-weight:700}
.eq-punto .tt small{color:var(--eq-gris);font-size:.75rem}
.eq-punto .votos{border:1px solid var(--eq-linea);background:var(--eq-alza);border-radius:10px;padding:1px 8px;font-size:.75rem;color:var(--eq-gris)}
.eq-punto .votos.mio{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:var(--eq-lila);font-weight:700}
.eq-punto.tratando{background:${P.violetaAgua}}
.eq-punto.acordado .num{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-punto.pospuesto{opacity:.6}
.eq-acuerdo{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid var(--eq-linea)}
.eq-acuerdo:last-child{border-bottom:0}
.eq-acuerdo .chk{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--eq-morado);background:var(--eq-alza);flex:0 0 18px;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;color:#fff}
.eq-acuerdo.hecho .chk{background:${P.verde};border-color:${P.verde}}
.eq-acuerdo.hecho .tt b{text-decoration:line-through;color:var(--eq-gris)}
.eq-acuerdo .tt{flex:1;min-width:0}
.eq-acuerdo .tt b{display:block;font-weight:600}
.eq-acuerdo .tt small{color:var(--eq-gris);font-size:.75rem}
.eq-acuerdo .tt small.vencido{color:${P.rojoTinta};font-weight:700}
.eq-sesion-viva{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:linear-gradient(92deg,${P.violetaAgua},rgba(244,168,205,.18));border:1px solid ${P.violetaBorde}}
.eq-sesion-viva b{color:var(--eq-morado-tinta)}
.eq-sesion-viva .t{font-variant-numeric:tabular-nums;color:var(--eq-gris);font-size:.8125rem}
.eq-pasadas details{border-bottom:1px solid var(--eq-linea)}
.eq-pasadas details:last-child{border-bottom:0}
.eq-pasadas summary{padding:9px 12px;cursor:pointer;font-weight:700;display:flex;justify-content:space-between;gap:8px;list-style:none}
.eq-pasadas summary::-webkit-details-marker{display:none}
.eq-pasadas summary small{color:var(--eq-gris);font-weight:500}
.eq-pasadas .cuerpo{padding:0 12px 10px;color:var(--eq-tinta);font-size:.8125rem;line-height:1.45}
.eq-pasadas .cuerpo h5{margin:8px 0 3px;font-size:.6875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--eq-gris)}
.eq-pasadas .cuerpo ul{margin:0;padding-left:18px}
.eq-tabs{display:flex;gap:2px;padding:8px 12px 0;border-bottom:1px solid var(--eq-linea)}
.eq-tabs button{border:0;background:none;padding:7px 12px;border-radius:9px 9px 0 0;color:var(--eq-gris);font-weight:600;border-bottom:2px solid transparent}
.eq-tabs button.on{background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:800;border-bottom-color:var(--eq-morado)}
.eq-busca{position:relative;flex:1;max-width:280px}
.eq-busca input{width:100%;border:1.5px solid var(--eq-linea);border-radius:9px;padding:6px 10px 6px 30px;font:inherit;outline:0;background:var(--eq-panel)}
.eq-busca input:focus{border-color:var(--eq-morado);background:var(--eq-alza)}
.eq-busca svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--eq-gris)}
.eq-res{padding:4px 0}
.eq-res button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 14px;border-bottom:1px solid var(--eq-linea);color:var(--eq-tinta)}
.eq-res button:hover{background:var(--eq-panel)}
.eq-res .m{font-size:.6875rem;color:var(--eq-gris);display:flex;gap:6px;margin-bottom:2px}
.eq-res .m b{color:var(--eq-morado-tinta)}
.eq-res .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8125rem}
.eq-punto-acc{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.eq-punto-acc .eq-btn{padding:3px 8px;font-size:.75rem;border-radius:7px}
.eq-punto-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--eq-linea);background:var(--eq-alza);border-radius:10px;padding:2px 8px 2px 4px;font-size:.75rem;color:var(--eq-gris)}
.eq-punto-chip.on{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:var(--eq-alza);font-weight:700}
button.eq-punto-chip{cursor:pointer}
.eq-fij{display:inline-flex;align-items:center;gap:3px;font-size:.6875rem;color:var(--eq-morado-tinta);font-weight:700}
.eq-nivel{font-size:.625rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:6px;background:${P.ambarAgua};color:${P.ambarTinta}}
.eq-nivel.urgente{background:${P.rojoAgua};color:${P.rojoTinta}}
.eq-pastillas{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.eq-pastilla{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid var(--eq-linea);background:var(--eq-panel);color:var(--eq-tinta);font-size:.75rem;font-weight:600;text-decoration:none;cursor:pointer}
.eq-pastilla small{font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--eq-gris)}
.eq-pastilla:disabled{cursor:default;opacity:.8}
.eq-pastilla.ir{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:var(--eq-alza)}
.eq-pastilla:not(:disabled):hover{border-color:var(--eq-morado);color:var(--eq-morado-tinta)}
.eq-quehacer{flex-basis:100%;font-size:.8125rem;color:var(--eq-gris);line-height:1.4}
.eq-quehacer b{color:var(--eq-tinta);font-weight:700}
.eq-fij svg{width:11px;height:11px}
.eq-msg.fijado{border-left:3px solid var(--eq-morado);padding-left:13px;background:var(--eq-alza)}
.eq-mas{display:flex;justify-content:center;padding:8px}
/* ── Publicaciones (notas, checklists y proyectos del canal) ── */
.eq-pub-nueva{display:flex;gap:6px;padding:10px 12px 2px;flex-wrap:wrap}
.eq-pub-nueva .eq-btn{display:inline-flex;align-items:center;gap:4px;font-size:.75rem;padding:5px 9px}
.eq-pubs{flex:1;overflow-y:auto;padding:10px 12px 20px;display:flex;flex-direction:column;gap:8px}
.eq-pub{display:flex;flex-direction:column;gap:7px;text-align:left;border:1px solid var(--eq-linea);border-radius:12px;background:var(--eq-alza);padding:10px 12px;cursor:pointer;font:inherit;color:var(--eq-tinta);width:100%}
.eq-pub:hover{border-color:var(--eq-morado);background:var(--eq-panel)}
.eq-pub.cerrada{opacity:.7}
.eq-pub.cerrada .fila b{text-decoration:line-through;color:var(--eq-gris)}
.eq-pub.tarjeta{max-width:420px;margin-top:4px}
.eq-pub .fila{display:flex;align-items:center;gap:7px;min-width:0}
.eq-pub .fila b{font-weight:800;font-size:.875rem;line-height:1.25;min-width:0}
.eq-pub-tipo{flex:0 0 auto;font-size:.625rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:6px;background:var(--eq-lila);color:var(--eq-morado-tinta)}
.eq-pub-tipo.checklist{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-pub-tipo.proyecto{background:${P.azulAgua};color:${P.azulTinta}}
.eq-pub-pin{color:var(--eq-morado);display:inline-flex;flex:0 0 auto}
.eq-pub-barra{height:5px;border-radius:3px;background:var(--eq-linea);overflow:hidden}
.eq-pub-barra i{display:block;height:100%;background:var(--eq-morado);border-radius:3px;transition:width .25s}
.eq-pub .meta{display:flex;align-items:center;gap:10px;font-size:.6875rem;color:var(--eq-gris);flex-wrap:wrap}
.eq-pub .meta .ok{color:${P.verdeTinta};font-weight:800}
.eq-pub .meta .quien{display:inline-flex;align-items:center;gap:4px}
.eq-pub .meta .fecha{display:inline-flex;align-items:center;gap:3px}
.eq-pub .meta .fecha.vencido{color:${P.rojoTinta};font-weight:700}
.eq-pub .meta .fecha.hoy{color:${P.ambarTinta};font-weight:700}
.eq-pub .meta .t{margin-left:auto}
.eq-pub-ver{flex:1;overflow-y:auto;padding:14px 14px 24px;display:flex;flex-direction:column;gap:12px}
.eq-pub-ver > *{flex-shrink:0}
.eq-pub-ver .eq-btn{display:inline-flex;align-items:center;gap:4px}
.eq-pub-ver h3{margin:0;font-size:1.125rem;line-height:1.3;font-weight:800}
.eq-pub-meta{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.eq-pub-meta .dato{display:inline-flex;align-items:center;gap:5px;font-size:.75rem;color:var(--eq-tinta)}
.eq-pub-meta .dato small,.eq-pub-sel small{font-size:.625rem;text-transform:uppercase;letter-spacing:.05em;color:var(--eq-gris);font-weight:700}
.eq-pub-sel{position:relative;display:inline-flex;align-items:center;gap:5px;font-size:.75rem;padding:3px 8px;border-radius:8px;border:1px solid var(--eq-linea);background:var(--eq-alza);cursor:pointer;color:var(--eq-tinta)}
.eq-pub-sel:hover{border-color:var(--eq-morado)}
.eq-pub-sel.vacio{color:var(--eq-gris);border-style:dashed}
.eq-pub-sel.chico{padding:1px 6px;font-size:.6875rem;border-color:transparent;background:none}
.eq-pub-sel.chico:hover{border-color:var(--eq-linea);background:var(--eq-alza)}
.eq-pub-sel.chico.vacio{opacity:0;}
.eq-renglon:hover .eq-pub-sel.chico.vacio,.eq-renglon.editando .eq-pub-sel.chico.vacio{opacity:.7}
.eq-pub-sel.vencido{color:${P.rojoTinta};font-weight:700}
.eq-pub-sel.hoy{color:${P.ambarTinta};font-weight:700}
.eq-pub-sel select,.eq-pub-sel input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font:inherit}
.eq-pub-avance{display:flex;align-items:center;gap:10px}
.eq-pub-avance .eq-pub-barra{flex:1;height:7px}
.eq-pub-avance b{font-size:.8125rem;color:var(--eq-gris);font-variant-numeric:tabular-nums}
.eq-pub-avance b.ok{color:${P.verdeTinta}}
.eq-pub-cuerpo{white-space:pre-wrap;line-height:1.5;font-size:.875rem;padding:10px 12px;border-radius:10px;background:var(--eq-panel)}
.eq-renglon{display:flex;gap:10px;align-items:flex-start;padding:8px 10px 8px 12px;border-bottom:1px solid var(--eq-linea)}
.eq-renglon:last-of-type{border-bottom:0}
.eq-renglon .caja,.eq-pub-agregar .caja{flex:0 0 auto;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--eq-morado);background:var(--eq-alza);display:inline-flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;margin-top:1px;padding:0}
.eq-renglon .caja.on{background:var(--eq-morado);border-color:var(--eq-morado)}
.eq-renglon .caja:disabled{opacity:.5;cursor:default}
.eq-pub-agregar .caja{border-style:dashed;border-color:#cfcae6;cursor:default}
.eq-renglon .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.eq-renglon .texto{line-height:1.4;cursor:text;word-break:break-word}
.eq-renglon.hecho .texto{text-decoration:line-through;color:var(--eq-gris)}
.eq-renglon.vencido .texto{color:${P.rojoTinta}}
.eq-renglon .tt > input{font:inherit;border:1.5px solid var(--eq-morado);border-radius:7px;padding:3px 6px;outline:0;width:100%}
.eq-renglon .sub{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:18px}
.eq-renglon .sub .ok{font-size:.6875rem;color:${P.verdeTinta};margin-right:4px}
.eq-renglon .acc{display:flex;gap:0;opacity:0;flex:0 0 auto}
.eq-renglon:hover .acc{opacity:1}
.eq-renglon .acc .eq-ib{width:26px;height:26px}
.eq-pub-agregar{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 12px}
.eq-pub-agregar.solo{padding:4px 0}
.eq-pub-agregar input{flex:1;min-width:0;font:inherit;border:0;outline:0;background:none;padding:2px 0;color:var(--eq-tinta)}
.eq-pub-agregar input::placeholder{color:#a8a3c0}
.eq-pub-agregar .eq-btn{padding:3px 9px;font-size:.75rem}
.eq-pub-acciones{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--eq-linea);margin-top:auto}
.eq-pub-acciones .eq-btn{display:inline-flex;align-items:center;gap:5px;font-size:.8125rem}
.eq-pub-editor{overflow-y:auto;flex:1}
.eq-pub-tipos{display:flex;gap:6px}
.eq-pub-tipos .eq-btn{flex:1;font-size:.8125rem;padding:6px 8px}
.eq-pub-editor .pista{font-size:.75rem;color:var(--eq-gris);font-weight:500}
.eq-pub-etiq{display:flex;flex-direction:column;gap:6px;border:1.5px solid var(--eq-morado);border-radius:9px;padding:8px;background:var(--eq-alza);font-weight:500}
.eq-pub-etiq input{border:0!important;border-bottom:1px solid var(--eq-linea)!important;border-radius:0!important;padding:4px 2px!important}
.eq-pub-etiq .grupo{display:flex;flex-direction:column}
.eq-pub-etiq .grupo small{font-size:.625rem;text-transform:uppercase;letter-spacing:.06em;color:var(--eq-gris);padding:4px 2px}
.eq-pub-etiq .grupo button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border:0;background:none;padding:5px 6px;border-radius:7px;font:inherit;color:var(--eq-tinta);cursor:pointer}
.eq-pub-etiq .grupo button:hover{background:var(--eq-lila)}
.eq-pub-etiq .grupo button b{font-weight:700;font-size:.8125rem}
.eq-pub-etiq .grupo button span{font-size:.6875rem;color:var(--eq-gris)}
.eq-pub-etiq .vacio{color:var(--eq-gris);font-size:.75rem;padding:2px}
@media (max-width:900px){
  .eq{height:calc(100dvh - var(--crm-bottomnav-h,64px) - env(safe-area-inset-top));border:0;border-radius:0}
  .eq-arbol{width:100%;flex:1 1 100%;border-right:0}
  .eq.en-canal .eq-arbol{display:none}
  .eq:not(.en-canal) .eq-canal{display:none}
  .eq-lado{position:fixed;inset:0;width:100%;flex:none;z-index:900;border-left:0}
  .eq-renglon .acc,.eq-pub-sel.chico.vacio{opacity:1}
  .eq-pub-sel.chico.vacio{opacity:.6}
  .eq-lado.ficha{width:100%;flex-basis:auto}
  .eq-ficha{padding:12px 14px 24px}
  .eq-msg .hora-h{display:none}
  .eq-acc{display:none!important}
  .eq-sec-mas{opacity:1}
  .eq-can-mas{opacity:1;width:34px;height:34px;right:8px}
  .eq-can-fila .eq-can{padding-right:44px}
  .eq-can-fila .eq-can .eq-badge,.eq-can-fila .eq-can .eq-imp{visibility:visible}
  .eq-can{min-height:40px}
  .eq-cab{padding:8px 10px}
  .eq-img img{max-height:240px}
}

/* ── OSCURO ────────────────────────────────────────────────────────────────
   El CRM corre con [data-crm-dark="1"] y Equipo nacía siempre claro: abrir el
   chat encima del CRM oscuro era un fogonazo blanco. Se resuelve SOLO con los
   tokens de la raíz —por eso arriba no quedó ni un "background:#fff" suelto—;
   los "color:#fff" que quedan son texto SOBRE color (badge, botón morado,
   enviar) y esos no cambian en ningún tema.

   La jerarquía es la de Discord y no es capricho: la barra lateral va MÁS
   OSCURA que el río de mensajes, para que el ojo entienda que el contenido
   está al frente y la navegación atrás. En claro pasa al revés (panel gris,
   río blanco), que es la misma idea con los valores invertidos.
   Los valores son los del CRM (#131318, #1d1d24, #26262e, #F2F1F7…) para que
   el chat no se lea como otro producto. */
[data-crm-dark="1"] .eq{
  --eq-tinta:#F2F1F7;--eq-gris:#918fa0;--eq-linea:#2c2c36;
  --eq-panel:#17171d;        /* barra lateral: lo más hondo */
  --eq-fondo:#1d1d24;        /* río de mensajes: un escalón arriba */
  --eq-alza:#26262e;         /* lo que flota: modales, popover, caja de texto */
  --eq-lila:#362c55;--eq-morado:#A78BFA;--eq-morado-tinta:#B7A8F7;
  --eq-apagado:#4a4a57;--eq-toast-fondo:#F2F1F7;--eq-toast-tinta:#131318;
  --eq-realce:rgba(167,139,250,.14);--eq-sombra:rgba(0,0,0,.5);--rol-founder:#5FD3A6;--rol-partner:#E8B04B;--rol-soporte:#8FB4F7;--rol-admin:#EFA6CA}
[data-crm-dark="1"] .eq-modal-fondo{background:rgba(0,0,0,.66)}
/* Las imágenes y los adjuntos no llevan fondo claro detrás. */
[data-crm-dark="1"] .eq-img img,[data-crm-dark="1"] .eq-pre .it{background:var(--eq-alza)}
/* El widget flotante comparte la misma raíz. */
[data-crm-dark="1"] .eqf{--eq-tinta:#F2F1F7;--eq-gris:#918fa0;--eq-linea:#2c2c36;--eq-panel:#1d1d24}
[data-crm-dark="1"] .eqf-bur{background:#1d1d24;color:#F2F1F7;border-color:#33304a}
[data-crm-dark="1"] .eqf-bur .q{color:#918fa0}
[data-crm-dark="1"] .eqf-bur .q b{color:#F2F1F7}
[data-crm-dark="1"] .eqf-bur .x{color:#918fa0}
[data-crm-dark="1"] .eqf-gente{background:rgba(35,35,41,.94);border-color:#33304a;color:#E6E4F0}
[data-crm-dark="1"] .eqf-gente .pila .eq-av,[data-crm-dark="1"] .eqf-gente .eq-av .pt{border-color:#1d1d24}
[data-crm-dark="1"] .eqf-n{border-color:#131318}

/* ── MÓVIL · densidad y remates ────────────────────────────────────────────
   Lo que se veía mal al entrar por el widget, en orden de qué tan molesto era. */
@media (max-width:900px){
  /* 1. El nombre del canal partía en DOS renglones ("preguntas-\nimportantes")
        y empujaba la cabecera al doble de alto. Discord nunca parte el título:
        lo corta. El min-width:0 es obligatorio — sin él, flex se niega a
        encoger el h2 y el ellipsis no aparece nunca. */
  /* El color va explícito y no heredado: el sitio trae una regla GLOBAL
     "h1,h2,h3,h4{color:var(--color-text-primary)}", y un selector de ELEMENTO le
     gana siempre a la herencia (heredar tiene especificidad cero). Sin esto el
     título del canal salía en el negro del sitio público, invisible sobre el
     oscuro. En claro nadie lo notaba porque negro sobre blanco se lee bien. */
  .eq-cab h2{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;font-size:.9375rem;line-height:1.3;color:var(--eq-tinta)}
  .eq-cab h2 .n{display:inline-flex;vertical-align:-2px;margin-right:2px}
  .eq-cab .desc{display:none}          /* no cabe junto al título; en móvil estorba */
  .eq-cab{min-height:48px;gap:4px}
  .eq-ib{width:36px;height:36px}       /* 36 y no 34: piso táctil */
  /* 2. El ⋯ de cada canal estaba a opacidad 1 en TODOS los renglones: veinte
        puntos suspensivos compitiendo con los nombres. Se queda accesible
        (sigue siendo un botón de 34px) pero deja de gritar. */
  .eq-can-mas{opacity:.38}
  .eq-can-fila.activo .eq-can-mas{opacity:.7}
  /* 3. Secciones más apretadas: se ganan ~2 canales de alto por pantalla. */
  .eq-sec{padding:10px 12px 1px}
  .eq-can{min-height:42px;margin:1px 8px;width:calc(100% - 16px)}
  /* 4. La caja de escribir se comía 200px. Discord la deja en una sola fila. */
  .eq-caja{padding:8px 10px calc(8px + env(safe-area-inset-bottom))}
  .eq-caja .marco{border-radius:14px}
  .eq-caja .enviar{width:36px;height:36px}
}

/* ── ROLES · la lógica de Discord ──────────────────────────────────────────
   En Discord el rol no es un dato escondido en un perfil: se ve en el color
   del nombre y en la lista de gente agrupada por rol con su conteo. Eso es lo
   que deja leer una conversación sin conocer al equipo — de un vistazo sabes
   quién manda, quién da soporte y quién es de fuera.
   El color va por TOKEN y no en línea porque tiene que cambiar con el tema:
   el verde que se lee sobre blanco se apaga sobre #1d1d24, y al revés. */
.eq-rol.founder{color:var(--rol-founder)}
.eq-rol.partner{color:var(--rol-partner)}
.eq-rol.soporte{color:var(--rol-soporte)}
.eq-rol.admin{color:var(--rol-admin)}
.eq-gente-grupo{display:flex;align-items:center;gap:6px;padding:9px 6px 3px;font-size:.6875rem;font-weight:800;
  letter-spacing:.06em;text-transform:uppercase;color:var(--eq-gris)}
.eq-gente-grupo .n{font-weight:700;opacity:.75}
/* Insignia junto al nombre (el "DEV"/"APP" de Discord). Va en el mensaje, no
   en la lista: ahí es donde hace falta saber quién habla. */
.eq-insignia{flex:0 0 auto;font-size:.5625rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  padding:1px 5px;border-radius:4px;border:1px solid currentColor;opacity:.85;line-height:1.5}
`;

let cssPuesto = false;
export function useCss() {
  useEffect(() => {
    if (cssPuesto || typeof document === 'undefined') return;
    const s = document.createElement('style'); s.id = 'eq-css'; s.textContent = CSS;
    document.head.appendChild(s); cssPuesto = true;
  }, []);
}

// ── Roles ───────────────────────────────────────────────────────────────────
// Los cuatro roles REALES de `team_members` (medidos en la base: founder,
// partner, soporte, admin). Si aparece uno nuevo, `rolDe` devuelve null y todo
// sigue funcionando en el color neutro — nunca se pinta un rol inventado.
export const ROLES: Record<string, { etiqueta: string; corta: string }> = {
  founder: { etiqueta: 'Dirección', corta: 'DIR' },
  partner: { etiqueta: 'Partners', corta: 'PAR' },
  soporte: { etiqueta: 'Soporte', corta: 'SOP' },
  admin: { etiqueta: 'Administración', corta: 'ADM' },
};
export function rolDe(rol?: string | null) {
  const k = String(rol || '').toLowerCase();
  return ROLES[k] ? { clave: k, ...ROLES[k] } : null;
}

// ── Avatar ──────────────────────────────────────────────────────────────────
export function iniciales(nombre: string) {
  const p = String(nombre || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}
export function Avatar({ p, size = 32, estado, borde }: { p: { nombre: string; foto_url?: string | null }; size?: number; estado?: string | null; borde?: string }) {
  return (
    <span className="eq-av" style={{ width: size, height: size, fontSize: size * 0.38, borderColor: borde }} title={p.nombre}>
      {p.foto_url ? <img src={p.foto_url} alt="" loading="lazy" /> : iniciales(p.nombre)}
      {estado ? <i className={`pt ${estado}`} /> : null}
    </span>
  );
}

// ── El texto de un mensaje ──────────────────────────────────────────────────
// Menciones guardadas como @[Nombre](uuid); ligas; `código`; **negrita**.
// Las citas (@[Nombre](cotizacion:uuid)) se pintan como chip: al tocarlo se
// abre la ficha a un lado del chat (evento crm:ficha, lo escucha Equipo).
const RE = /(@\[[^\]]+\]\((?:[a-z]+:)?[0-9a-f-]{36}\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gi;
export const CITA_ETIQ: Record<string, string> = { cotizacion: 'Cotización', cliente: 'Cliente', lead: 'Lead', pago: 'Pago', cobranza: 'Cobranza' };
export function abrirFicha(tipo: string, id: string, nombre?: string) {
  window.dispatchEvent(new CustomEvent('crm:ficha', { detail: { tipo, id, nombre } }));
}
export function Texto({ t, yo }: { t: string; yo: string }) {
  const partes = useMemo(() => {
    const out: any[] = []; let i = 0; let m: RegExpExecArray | null; let k = 0;
    RE.lastIndex = 0;
    while ((m = RE.exec(t))) {
      if (m.index > i) out.push(t.slice(i, m.index));
      const s = m[0];
      if (m[1]) {
        const mm = /^@\[([^\]]+)\]\((?:([a-z]+):)?([^)]+)\)$/i.exec(s)!;
        if (mm[2]) out.push(<button key={k++} type="button" className={'eq-ref ' + mm[2]} onClick={() => abrirFicha(mm[2], mm[3], mm[1])} title={`Ver ${CITA_ETIQ[mm[2]] || mm[2]}`}><small>{CITA_ETIQ[mm[2]] || mm[2]}</small><span>{mm[1]}</span></button>);
        else out.push(<span key={k++} className={'eq-men' + (mm[3] === yo ? ' yo' : '')}>@{mm[1]}</span>);
      }
      else if (m[2]) out.push(<a key={k++} href={s} target="_blank" rel="noopener noreferrer">{s.length > 60 ? s.slice(0, 57) + '…' : s}</a>);
      else if (m[3]) out.push(<code key={k++}>{s.slice(1, -1)}</code>);
      else if (m[4]) out.push(<b key={k++}>{s.slice(2, -2)}</b>);
      i = m.index + s.length;
    }
    if (i < t.length) out.push(t.slice(i));
    return out;
  }, [t, yo]);
  return <div className="texto">{partes}</div>;
}

export function textoPlano(t: string) { return t.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1'); }

// ── Emojis ──────────────────────────────────────────────────────────────────
export const RAPIDOS = ['👍', '❤️', '😂', '🎉', '👀', '✅', '🙏', '🔥'];
const CATS: [string, string][] = [
  ['Caras', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 💀 💩 🤡 👻 👽 🤖'],
  ['Gestos', '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💪 🫡 👀 👁️ 🧠 🫀'],
  ['Cosas', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💯 💢 💥 💫 💦 💤 🔥 ⭐ 🌟 ✨ ⚡ ☀️ 🌈 🎉 🎊 🎁 🏆 🥇 🎯 🚀 💡 📌 📎 📝 📊 📈 📉 💰 💵 💳 🧾 📦 🛒 🛍️ 👗 👠 👜 💎 🔔 🔕 ⏰ 📅 ✅ ❌ ⚠️ ❓ ❗ 🆗 🆕 🔒 🔑 🧩 🧪 🛠️ ⚙️ 🧹 ☕ 🍕 🌮 🍺 🎂'],
];
export function Emojis({ onPick, der }: { onPick: (e: string) => void; der?: boolean }) {
  return (
    <div className={'eq-pop eq-emojis' + (der ? ' der' : '')} onMouseDown={e => e.preventDefault()}>
      <div className="rapidos">{RAPIDOS.map(e => <button key={e} type="button" onClick={() => onPick(e)}>{e}</button>)}</div>
      <div className="grid">
        {CATS.map(([c, lista]) => [
          <div key={'c' + c} className="cat">{c}</div>,
          ...lista.split(' ').map((e, i) => <button key={c + i} type="button" onClick={() => onPick(e)}>{e}</button>),
        ])}
      </div>
    </div>
  );
}

// ── Cerrar al hacer click fuera ─────────────────────────────────────────────
export function useFuera(ref: React.RefObject<HTMLElement | null>, onFuera: () => void, activo = true) {
  useEffect(() => {
    if (!activo) return;
    const h = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFuera(); };
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [ref, onFuera, activo]);
}

// ── Aviso breve ─────────────────────────────────────────────────────────────
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<any>(null);
  const toast = (m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2600); };
  const nodo = msg ? <div className="eq-toast">{msg}</div> : null;
  return { toast, nodo };
}

export const Ic = {
  descargar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M4 19h16" /></svg>,
  hash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" /></svg>,
  sala: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  sistema: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>,
  mas: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  atras: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>,
  cerrar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  enviar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  emoji: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 10h.01M15 10h.01" /></svg>,
  gif: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M9 10H7.5a1 1 0 00-1 1v2a1 1 0 001 1H9v-2h-1M12 10v4M15 14v-4h2.5M15 12h2" /></svg>,
  imagen: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></svg>,
  mic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>,
  responder: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-2" /></svg>,
  hilo: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>,
  puntos: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  campana: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></svg>,
  campanaOff: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0110-4.5M18 13v3l2 2H4z" /><path d="M10 20a2 2 0 004 0M3 3l18 18" /></svg>,
  lupa: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>,
  gente: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4.5-6.2" /></svg>,
  editar: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M12 8l4 4" /></svg>,
  basura: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  liga: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>,
  reloj: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>,
  play: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>,
  stop: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z" /></svg>,
  info: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  engrane: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>,
  caja: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18v3H3zM5 10v10h14V10M10 14h4" /></svg>,
  restaurar: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>,
  nota: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2 2 4-4" /><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 16h8" /></svg>,
  arriba: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  abajo: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
};
