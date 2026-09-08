// Los estilos del reporte público. Viven aparte del .astro porque son 300 líneas
// y ahí adentro tapaban la estructura del documento, que es lo que se lee.
export default `
:root{
  --violeta:#9B8CFA;--tinta:#5B4BD6;--hondo:#4536BE;--agua:#EEECFE;
  --verde:#4FBF95;--verde-t:#1E8A63;--verde-a:#EAF8F2;
  --rosa:#D9538E;--ambar:#E8A838;--ambar-t:#9a6a10;--ambar-a:#FFF4E5;
  --azul-t:#2C5FC4;--azul-a:#E3EDFD;
  --papel:#fff;--tono:#faf9fe;--borde:#ecebf3;--ink:#231d40;--ink-2:#514c63;--ink-3:#928da4;
}
*{box-sizing:border-box}
body{margin:0;padding:0;background:#eef0f4;color:var(--ink);font-family:"DM Sans",system-ui,sans-serif;line-height:1.62;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.shell{max-width:860px;margin:0 auto;padding:22px 14px 70px}
.bar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.bar b{font-size:.79rem;color:#6b6b74;margin-right:auto}
.btn{border:none;border-radius:9px;padding:9px 16px;background:var(--violeta);color:#fff;font-size:.81rem;font-weight:700;cursor:pointer;font-family:inherit}
.btn:hover{background:var(--hondo)}
.btn2{border:1px solid var(--borde);border-radius:9px;padding:8px 14px;background:#fff;color:var(--ink-2);font-size:.81rem;font-weight:600;cursor:pointer;font-family:inherit}
.doc{background:var(--papel);border-radius:18px;box-shadow:0 22px 54px rgba(20,15,50,.15);overflow:hidden}
.cinta{height:4px;background:linear-gradient(90deg,#9B8CFA,#7DA6F5 55%,rgba(244,168,205,.9))}

/* ── portada ── */
.hero{padding:30px 34px 26px;background:linear-gradient(150deg,#f7f5ff 0%,#fdf6fa 100%);border-bottom:1px solid var(--borde);position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-90px;top:-120px;width:290px;height:290px;border-radius:50%;background:radial-gradient(circle,rgba(155,140,250,.16),transparent 65%)}
.hero .top{display:flex;align-items:flex-start;gap:14px;position:relative;z-index:1}
.wm{font-size:1.3rem;font-weight:800;letter-spacing:-.025em;background:linear-gradient(100deg,#7C6BF0,#8E7DEF 35%,#D9538E);-webkit-background-clip:text;background-clip:text;color:transparent}
.wsub{font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3);margin-top:4px}
.folio{margin-left:auto;text-align:right}
.folio .t{font-size:.53rem;letter-spacing:.17em;text-transform:uppercase;color:var(--ink-3)}
.folio .f{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.76rem;margin-top:5px;color:var(--tinta);font-weight:700}
.hero h1{font-size:clamp(1.5rem,3.4vw,2.05rem);font-weight:800;letter-spacing:-.03em;line-height:1.14;margin:20px 0 0;max-width:22ch;position:relative;z-index:1}
.hero .sub{color:var(--ink-2);font-size:.92rem;margin-top:7px;position:relative;z-index:1}
.hero .quien{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;position:relative;z-index:1}
.hero .quien>div{font-size:.75rem}
.hero .quien .k{font-size:.53rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3)}
.hero .quien .v{font-weight:700;margin-top:2px}

/* ── números ancla, con conteo ── */
.ancla{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--borde);background:var(--papel)}
.ancla>div{padding:18px 12px;text-align:center;border-left:1px solid var(--borde);position:relative}
.ancla>div:first-child{border-left:none}
.ancla .n{font-size:2rem;font-weight:800;letter-spacing:-.04em;color:var(--tinta);line-height:1;font-variant-numeric:tabular-nums}
.ancla .n.v{color:var(--verde-t)}
.ancla .l{font-size:.63rem;color:var(--ink-3);margin-top:5px;font-weight:600;line-height:1.35}

/* ── pestañas ── */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--borde);background:var(--tono);position:sticky;top:0;z-index:20;overflow-x:auto}
.tabs button{flex:none;font-family:inherit;font-size:.78rem;font-weight:700;padding:12px 17px;border:none;background:none;color:var(--ink-3);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tabs button.on{color:var(--tinta);background:var(--agua);border-bottom-color:var(--violeta);border-radius:9px 9px 0 0}
.tabs .cn{font-size:.62rem;font-weight:800;background:rgba(91,75,214,.12);border-radius:20px;padding:1px 6px;margin-left:5px}
.panel{display:none;padding:24px 34px 6px;animation:ent .24s ease}
.panel.on{display:block}
@keyframes ent{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.panel{animation:none}}

.st{display:flex;align-items:center;gap:10px;margin:0 0 12px}
.st .x{font-size:.62rem;font-weight:800;color:var(--tinta);letter-spacing:.14em;text-transform:uppercase}
.st .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--borde),transparent)}
.p{font-size:.86rem;color:var(--ink-2);line-height:1.75}
.p b{color:var(--ink)}

.lila{background:linear-gradient(135deg,#EEECFE,rgba(244,168,205,.24));border-radius:13px;padding:17px 20px}
.lila .t{font-size:.58rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--tinta)}
.lila .c{font-size:1.6rem;font-weight:800;letter-spacing:-.03em;margin-top:3px;font-variant-numeric:tabular-nums}
.lila .d{font-size:.78rem;color:var(--ink-2);margin-top:4px}

/* ── acordeones de entrega ── */
.lista{border:1px solid var(--borde);border-radius:13px;overflow:hidden;margin-top:12px}
.fila{border-top:1px solid #f5f4fa}
.fila:first-child{border-top:none}
.cab{width:100%;display:flex;gap:11px;padding:12px 16px;font-size:.84rem;align-items:center;background:none;border:none;font-family:inherit;color:inherit;text-align:left;cursor:pointer}
.cab:hover{background:var(--tono)}
.cab .ck{color:var(--verde-t);font-weight:800;flex:none}
.cab .tx{flex:1;min-width:0;font-weight:600}
.cab .fe{color:var(--ink-3);font-size:.72rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.cab .mt{font-weight:800;color:var(--tinta);white-space:nowrap;font-variant-numeric:tabular-nums;min-width:70px;text-align:right}
.cab .fl{color:var(--ink-3);font-size:.7rem;transition:transform .2s}
.fila.ab .cab .fl{transform:rotate(180deg)}
.det{display:none;padding:0 16px 13px 43px;font-size:.79rem;color:var(--ink-2);line-height:1.65}
.fila.ab .det{display:block}
.fila.cor{background:var(--verde-a)}
.fila.cor .cab .mt{color:var(--verde-t);font-size:.72rem}
.tot{background:var(--agua);font-weight:800;display:flex;padding:11px 16px;font-size:.85rem}
.tot .mt{margin-left:auto;color:var(--tinta);font-variant-numeric:tabular-nums}

/* ── mini tarjetas ── */
.mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mini>div{border:1px solid var(--borde);border-left:3px solid var(--violeta);border-radius:10px;padding:12px 14px;background:var(--papel)}
.mini .n{font-size:1.2rem;font-weight:800;color:var(--tinta);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.mini .l{font-size:.66rem;color:var(--ink-3);margin-top:2px}
.mini>div.v{border-left-color:var(--verde)}.mini>div.v .n{color:var(--verde-t)}

/* barras de tema */
.tema{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:.79rem}
.tema .nm{width:120px;flex:none;color:var(--ink-2)}
.tema .ba{flex:1;height:8px;border-radius:20px;background:#f2f0f8;overflow:hidden}
.tema .ba i{display:block;height:100%;background:linear-gradient(90deg,var(--violeta),#B6A9FC);border-radius:20px;width:0;transition:width .9s cubic-bezier(.2,.8,.3,1)}
.tema .nn{width:26px;text-align:right;font-weight:700;color:var(--tinta);font-variant-numeric:tabular-nums}

/* aprovechamiento */
.aprov{border:1px solid var(--borde);border-radius:13px;padding:16px 18px;background:var(--tono)}
.aprov .top{display:flex;align-items:baseline;gap:9px}
.aprov .big{font-size:1.5rem;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.aprov .lb{font-size:.78rem;color:var(--ink-3)}
.barra{height:11px;border-radius:20px;background:#eceaf5;overflow:hidden;margin-top:10px;display:flex}
.barra i{display:block;height:100%;width:0;transition:width 1s cubic-bezier(.2,.8,.3,1)}
.barra .usa{background:linear-gradient(90deg,#4FBF95,#7FD4B2)}
.barra .no{background:repeating-linear-gradient(45deg,#E0DCEF,#E0DCEF 5px,#EDEAF7 5px,#EDEAF7 10px)}
.leg{display:flex;gap:16px;margin-top:9px;font-size:.72rem;color:var(--ink-3)}
.leg i{width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:5px}
.fam{margin-top:13px}
.fam .h{font-size:.59rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-3)}
.fam .m{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.fam .m span{font-size:.74rem;background:var(--papel);border:1px solid var(--borde);border-radius:8px;padding:4px 10px}
.fam .m span.reco{border-color:var(--verde);background:var(--verde-a);color:var(--verde-t);font-weight:700}

/* CTA y reacción */
.cta{margin:22px 34px 0;border-radius:15px;padding:20px 24px;background:linear-gradient(135deg,#EEECFE,rgba(244,168,205,.24))}
.cta .k2{font-size:.56rem;font-weight:800;color:var(--tinta);letter-spacing:.17em;text-transform:uppercase}
.cta .f{font-size:1rem;margin-top:7px;line-height:1.55}
.cta .bs{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}
.reac{margin:16px 34px 0;border:1px solid var(--borde);border-radius:13px;padding:15px 18px;text-align:center}
.reac .q{font-size:.83rem;font-weight:700}
.reac .bs{display:flex;gap:9px;justify-content:center;margin-top:11px;flex-wrap:wrap}
.rb{font-family:inherit;font-size:.79rem;font-weight:700;border:1px solid var(--borde);background:#fff;color:var(--ink-2);border-radius:20px;padding:8px 16px;cursor:pointer}
.rb:hover{border-color:var(--violeta);color:var(--tinta)}
.rb.on{background:var(--tinta);border-color:var(--tinta);color:#fff}
.gracias{display:none;color:var(--verde-t);font-weight:700;font-size:.83rem;margin-top:10px}

.firmas{display:flex;gap:40px;padding:26px 34px 4px}
.firmas>div{flex:1}
.fl2{border-top:1px solid var(--borde);padding-top:7px;font-size:.72rem;font-weight:700}
.fl2 small{display:block;font-weight:500;color:var(--ink-3);font-size:.65rem;margin-top:2px}
.pie{margin-top:18px;padding:13px 34px;background:var(--tono);border-top:1px solid var(--borde);display:flex;gap:10px;align-items:center;font-size:.65rem;color:var(--ink-3);flex-wrap:wrap}
.pie b{color:var(--ink-2);font-weight:700}
.pie span{margin-left:auto;font-family:ui-monospace,monospace}

@media(max-width:720px){
  .shell{padding:12px 8px 50px}
  .hero{padding:22px}.folio{margin-left:0;text-align:left;width:100%;margin-top:10px}
  .ancla{grid-template-columns:repeat(2,1fr)}.ancla>div:nth-child(3){border-left:none}
  .panel{padding:20px}.cta,.reac{margin-left:20px;margin-right:20px}
  .firmas{flex-direction:column;gap:16px;padding:22px 20px 4px}.pie{padding:13px 20px}
  .mini{grid-template-columns:1fr}.tema .nm{width:90px}
}
@media print{
  body{background:#fff}.shell{padding:0;max-width:none}
  .bar,.tabs,.reac,.cta .bs{display:none}
  .doc{box-shadow:none;border-radius:0}
  .panel{display:block!important;padding:20px 24px 0;animation:none;break-inside:auto}
  .panel+.panel{border-top:1px solid var(--borde);margin-top:12px;padding-top:18px}
  .det{display:block!important}
  .lista,.aprov,.cta,.lila,.mini{break-inside:avoid}
  @page{margin:12mm}
}
`;
