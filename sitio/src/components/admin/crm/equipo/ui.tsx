// Piezas chicas que comparten todas las pantallas de "Equipo": la hoja de
// estilos (una vez), el avatar con su punto de presencia, el texto del mensaje
// con menciones y ligas, y el selector de emojis.
import { useEffect, useMemo, useRef, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';

export const CSS = `
.eq{--eq-tinta:#1e1a33;--eq-gris:#6f6a86;--eq-linea:#ebe8f5;--eq-fondo:#fff;--eq-panel:#f8f7fd;--eq-lila:${P.violetaAgua};--eq-morado:${P.violeta};--eq-morado-tinta:${P.violetaTinta};
  display:flex;height:calc(100dvh - var(--eq-top,44px));min-height:480px;background:var(--eq-fondo);color:var(--eq-tinta);font-size:.875rem;overflow:hidden;border:1px solid var(--eq-linea);border-radius:12px}
.eq *{box-sizing:border-box}
.eq button{font:inherit;cursor:pointer}
.eq-arbol{width:248px;flex:0 0 248px;background:var(--eq-panel);border-right:1px solid var(--eq-linea);display:flex;flex-direction:column;overflow:hidden}
.eq-arbol-scroll{flex:1;overflow-y:auto;padding:6px 0 12px}
.eq-sec{padding:12px 12px 2px;display:flex;align-items:center;justify-content:space-between}
.eq-sec-t{font-size:.6875rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--eq-gris);display:flex;align-items:center;gap:6px;background:none;border:0;padding:0}
.eq-sec-t svg{transition:transform .15s}
.eq-sec-t.cerrada svg{transform:rotate(-90deg)}
.eq-sec-mas{opacity:0;background:none;border:0;color:var(--eq-gris);padding:2px 4px;border-radius:6px;line-height:1}
.eq-sec:hover .eq-sec-mas{opacity:1}
.eq-can{display:flex;align-items:center;gap:8px;width:calc(100% - 12px);margin:1px 6px;padding:6px 8px 6px 10px;border-radius:8px;border:0;background:none;color:var(--eq-gris);text-align:left;min-height:32px}
.eq-can:hover{background:rgba(155,140,250,.10);color:var(--eq-tinta)}
.eq-can.activo{background:#fff;color:var(--eq-morado-tinta);font-weight:700;box-shadow:0 1px 6px rgba(60,30,140,.08)}
.eq-can.nuevo{color:var(--eq-tinta);font-weight:700}
.eq-can .n{opacity:.55;font-weight:600}
.eq-can.activo .n{opacity:.8}
.eq-can .nombre{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--eq-morado);color:#fff;font-size:.6875rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.eq-badge.men{background:${P.rosa}}
.eq-imp{width:6px;height:6px;border-radius:3px;background:${P.ambar};flex:0 0 6px}
.eq-gente{border-top:1px solid var(--eq-linea);padding:10px 12px 12px}
.eq-per{display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:8px;width:100%;border:0;background:none;text-align:left;color:var(--eq-tinta)}
.eq-per:hover{background:rgba(155,140,250,.10)}
.eq-per .est{font-size:.6875rem;color:var(--eq-gris)}
.eq-av{position:relative;flex:0 0 auto;border-radius:50%;background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:800;display:inline-flex;align-items:center;justify-content:center;overflow:visible}
.eq-av img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.eq-av .pt{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;border:2px solid var(--eq-panel);background:#c9c5d8}
.eq-av .pt.activo{background:${P.verde}}
.eq-av .pt.ausente{background:${P.ambar}}
.eq-canal{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--eq-fondo)}
.eq-cab{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--eq-linea);min-height:54px}
.eq-cab h2{margin:0;font-size:1rem;font-weight:800;display:flex;align-items:center;gap:6px}
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
.eq-msg:hover{background:#fbfaff}
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
.eq-cita{display:flex;gap:8px;align-items:center;margin:2px 0 4px;padding:3px 8px;border-left:2px solid var(--eq-morado);background:var(--eq-panel);border-radius:0 6px 6px 0;font-size:.8125rem;color:var(--eq-gris);cursor:pointer;max-width:560px}
.eq-cita b{color:var(--eq-morado-tinta)}
.eq-cita span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-acc{position:absolute;right:16px;top:-14px;display:none;gap:1px;background:#fff;border:1px solid var(--eq-linea);border-radius:9px;padding:2px;box-shadow:0 3px 12px rgba(30,20,60,.10);z-index:2}
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
.eq-hilo .avs .eq-av{margin-right:-6px;border:2px solid #fff}
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
.eq-caja .marco{position:relative;border:1.5px solid var(--eq-linea);border-radius:12px;background:#fff;transition:border-color .12s}
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
.eq-pop{position:absolute;bottom:calc(100% + 6px);left:0;background:#fff;border:1px solid var(--eq-linea);border-radius:12px;box-shadow:0 8px 30px rgba(30,20,60,.14);z-index:5;overflow:hidden}
.eq-pop.der{left:auto;right:0}
.eq-menciones{min-width:240px;padding:4px}
.eq-menciones button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;background:none;border-radius:8px;text-align:left;color:var(--eq-tinta)}
.eq-menciones button.sel,.eq-menciones button:hover{background:var(--eq-lila);color:var(--eq-morado-tinta)}
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
.eq-vacio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--eq-gris);padding:24px;text-align:center}
.eq-vacio b{color:var(--eq-tinta);font-size:1rem}
.eq-btn{border:1.5px solid var(--eq-morado);color:var(--eq-morado-tinta);background:#fff;border-radius:9px;padding:7px 12px;font-weight:700}
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
.eq-modal{background:#fff;border-radius:14px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(20,14,40,.3);overflow:hidden}
.eq-modal h3{margin:0;padding:14px 16px;border-bottom:1px solid var(--eq-linea);font-size:.9375rem}
.eq-luz{position:fixed;inset:0;background:rgba(10,8,20,.9);z-index:980;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.eq-luz img{max-width:96vw;max-height:92vh;border-radius:8px;box-shadow:0 10px 60px rgba(0,0,0,.5)}
.eq-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e1a33;color:#fff;padding:9px 14px;border-radius:10px;font-size:.8125rem;z-index:990;box-shadow:0 6px 24px rgba(0,0,0,.25)}
.eq-conex{font-size:.6875rem;color:var(--eq-gris);display:flex;align-items:center;gap:5px;padding:0 12px 6px}
.eq-conex i{width:7px;height:7px;border-radius:50%;background:#c9c5d8;display:inline-block}
.eq-conex i.on{background:${P.verde}}
.eq-sala{flex:1;overflow-y:auto;padding:12px 14px 20px;display:flex;flex-direction:column;gap:14px}
.eq-bloque{border:1px solid var(--eq-linea);border-radius:12px;background:#fff;overflow:hidden}
.eq-bloque .cab{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--eq-linea);background:var(--eq-panel)}
.eq-bloque .cab b{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--eq-gris)}
.eq-bloque .cab .n{font-size:.75rem;color:var(--eq-gris)}
.eq-punto{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid var(--eq-linea)}
.eq-punto:last-child{border-bottom:0}
.eq-punto .num{width:22px;height:22px;border-radius:7px;background:var(--eq-lila);color:var(--eq-morado-tinta);font-weight:800;font-size:.75rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px}
.eq-punto .tt{flex:1;min-width:0}
.eq-punto .tt b{display:block;font-weight:700}
.eq-punto .tt small{color:var(--eq-gris);font-size:.75rem}
.eq-punto .votos{border:1px solid var(--eq-linea);background:#fff;border-radius:10px;padding:1px 8px;font-size:.75rem;color:var(--eq-gris)}
.eq-punto .votos.mio{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:var(--eq-lila);font-weight:700}
.eq-punto.tratando{background:${P.violetaAgua}}
.eq-punto.acordado .num{background:${P.verdeAgua};color:${P.verdeTinta}}
.eq-punto.pospuesto{opacity:.6}
.eq-acuerdo{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid var(--eq-linea)}
.eq-acuerdo:last-child{border-bottom:0}
.eq-acuerdo .chk{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--eq-morado);background:#fff;flex:0 0 18px;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;color:#fff}
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
.eq-busca input:focus{border-color:var(--eq-morado);background:#fff}
.eq-busca svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--eq-gris)}
.eq-res{padding:4px 0}
.eq-res button{display:block;width:100%;text-align:left;border:0;background:none;padding:8px 14px;border-bottom:1px solid var(--eq-linea);color:var(--eq-tinta)}
.eq-res button:hover{background:var(--eq-panel)}
.eq-res .m{font-size:.6875rem;color:var(--eq-gris);display:flex;gap:6px;margin-bottom:2px}
.eq-res .m b{color:var(--eq-morado-tinta)}
.eq-res .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8125rem}
.eq-punto-acc{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.eq-punto-acc .eq-btn{padding:3px 8px;font-size:.75rem;border-radius:7px}
.eq-punto-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--eq-linea);background:#fff;border-radius:10px;padding:2px 8px 2px 4px;font-size:.75rem;color:var(--eq-gris)}
.eq-punto-chip.on{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:#fff;font-weight:700}
button.eq-punto-chip{cursor:pointer}
.eq-fij{display:inline-flex;align-items:center;gap:3px;font-size:.6875rem;color:var(--eq-morado-tinta);font-weight:700}
.eq-nivel{font-size:.625rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:6px;background:${P.ambarAgua};color:${P.ambarTinta}}
.eq-nivel.urgente{background:${P.rojoAgua};color:${P.rojoTinta}}
.eq-pastillas{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.eq-pastilla{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid var(--eq-linea);background:var(--eq-panel);color:var(--eq-tinta);font-size:.75rem;font-weight:600;text-decoration:none;cursor:pointer}
.eq-pastilla small{font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--eq-gris)}
.eq-pastilla:disabled{cursor:default;opacity:.8}
.eq-pastilla.ir{border-color:var(--eq-morado);color:var(--eq-morado-tinta);background:#fff}
.eq-pastilla:not(:disabled):hover{border-color:var(--eq-morado);color:var(--eq-morado-tinta)}
.eq-quehacer{flex-basis:100%;font-size:.8125rem;color:var(--eq-gris);line-height:1.4}
.eq-quehacer b{color:var(--eq-tinta);font-weight:700}
.eq-fij svg{width:11px;height:11px}
.eq-msg.fijado{border-left:3px solid var(--eq-morado);padding-left:13px;background:#fcfbff}
.eq-mas{display:flex;justify-content:center;padding:8px}
@media (max-width:900px){
  .eq{height:calc(100dvh - var(--crm-bottomnav-h,64px) - env(safe-area-inset-top));border:0;border-radius:0}
  .eq-arbol{width:100%;flex:1 1 100%;border-right:0}
  .eq.en-canal .eq-arbol{display:none}
  .eq:not(.en-canal) .eq-canal{display:none}
  .eq-lado{position:fixed;inset:0;width:100%;flex:none;z-index:900;border-left:0}
  .eq-msg .hora-h{display:none}
  .eq-acc{display:none!important}
  .eq-sec-mas{opacity:1}
  .eq-can{min-height:40px}
  .eq-cab{padding:8px 10px}
  .eq-img img{max-height:240px}
}
`;

let cssPuesto = false;
export function useCss() {
  useEffect(() => {
    if (cssPuesto || typeof document === 'undefined') return;
    const s = document.createElement('style'); s.id = 'eq-css'; s.textContent = CSS;
    document.head.appendChild(s); cssPuesto = true;
  }, []);
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
const RE = /(@\[[^\]]+\]\([0-9a-f-]{36}\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gi;
export function Texto({ t, yo }: { t: string; yo: string }) {
  const partes = useMemo(() => {
    const out: any[] = []; let i = 0; let m: RegExpExecArray | null; let k = 0;
    RE.lastIndex = 0;
    while ((m = RE.exec(t))) {
      if (m.index > i) out.push(t.slice(i, m.index));
      const s = m[0];
      if (m[1]) { const mm = /^@\[([^\]]+)\]\(([^)]+)\)$/.exec(s)!; out.push(<span key={k++} className={'eq-men' + (mm[2] === yo ? ' yo' : '')}>@{mm[1]}</span>); }
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
};
