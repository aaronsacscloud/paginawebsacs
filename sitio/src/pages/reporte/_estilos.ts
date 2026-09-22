// Los estilos del reporte público. Viven aparte del .astro porque son 300 líneas
// y ahí adentro tapaban la estructura del documento, que es lo que se lee.
export default `
:root{
  --violeta:#9B8CFA;--tinta:#5B4BD6;--hondo:#4536BE;--agua:#EEECFE;
  --verde:#4FBF95;--verde-t:#1E8A63;--verde-a:#EAF8F2;
  --rosa:#D9538E;--rosa-s:#EFA6CA;--rosa-t:#9c3d70;--ambar:#E8A838;--ambar-t:#9a6a10;--ambar-a:#FFF4E5;
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
  .hero{padding:22px}.hero .top{flex-wrap:wrap}.folio{margin-left:0;text-align:left;width:100%;margin-top:10px}
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

/* ══ Reporte de ENTREGAS ══════════════════════════════════════════════════
   Comparte portada, cifras ancla y bloque lila con el reporte de trabajo. Lo
   suyo es la lista: sin acordeón en el renglón —lo que se entregó se lee de
   corrido, no se abre uno por uno— y con el botón del video, que es la razón
   de existir del documento. */
.cuerpo{padding:26px 34px 30px}
.ent{border:1px solid var(--borde);border-radius:13px;margin-top:11px;overflow:hidden}
.ent .it{border-top:1px solid #f5f4fa;padding:14px 17px}
.ent .it:first-child{border-top:none}
.ent .enc{display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
.ent .tt{font-size:.9rem;font-weight:700;flex:1;min-width:210px;letter-spacing:-.01em}
.tipo{font-size:.6rem;font-weight:800;border-radius:20px;padding:2px 9px;letter-spacing:.02em;white-space:nowrap}
.t-per{background:var(--agua);color:var(--tinta)}
.t-aju{background:#F1F1F4;color:#5b6270}
.t-cap{background:#FEF6E7;color:var(--ambar-t)}
.t-cor{background:var(--azul-a);color:var(--azul-t)}
.t-plu{background:var(--azul-a);color:var(--azul-t)}
.t-mod{background:var(--verde-a);color:var(--verde-t)}
.ent .fe{font-size:.71rem;color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.ent .sc{font-size:.65rem;font-weight:800;color:var(--verde-t);background:var(--verde-a);border-radius:20px;padding:2px 9px;white-space:nowrap}
.ent .mod{font-size:.65rem;color:var(--ink-3);margin-top:2px}
.ent .dd{font-size:.81rem;color:var(--ink-2);line-height:1.68;margin-top:6px;max-width:76ch}
/* El video y el detalle en el MISMO renglón: son las dos acciones de la
   entrega y apiladas hacían que cada renglón midiera el doble. Al abrir el
   detalle se pasa solo, que es cuando necesita el ancho. */
.pieit{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:9px}
.ent details>summary{cursor:pointer;list-style:none;font-size:.75rem;font-weight:700;color:var(--tinta)}
.ent details>summary::-webkit-details-marker{display:none}
.ent details>summary:before{content:'▸ '}
.ent details[open]{flex-basis:100%}
.ent details[open]>summary:before{content:'▾ '}
.ent .mas{font-size:.81rem;color:var(--ink-2);line-height:1.68;margin-top:6px;white-space:pre-line;max-width:76ch}

/* ── LA PIEL DEL REPORTE DE ENTREGAS ──
   Los dos documentos comparten esqueleto, y en el celular el dueño abría uno
   creyendo que era el otro: la portada, las cifras y la lista se veían iguales.
   Aquí el de ENTREGAS se pinta con más degradado y con el VERDE de la casa
   —el color de lo que ya entró, que es justo lo que este documento cuenta—,
   mientras el de trabajo en curso se queda en el morado del sistema. No es
   adorno: es lo que deja saber cuál tienes abierto antes de leer el título. */
.doc-entregas .cinta{background:linear-gradient(90deg,#4FBF95,#9B8CFA 48%,rgba(244,168,205,.95))}
.doc-entregas .hero{background:linear-gradient(150deg,#EAF8F2 0%,#f7f5ff 46%,#fdf6fa 100%)}
.doc-entregas .hero:after{background:radial-gradient(circle,rgba(79,191,149,.18),transparent 65%)}
.doc-entregas .wm{background:linear-gradient(100deg,#1E8A63,#7C6BF0 52%,#D9538E);-webkit-background-clip:text;background-clip:text;color:transparent}
.doc-entregas .ancla{background:linear-gradient(180deg,#fbfdfc,#fff 70%)}
/* El encabezado de cada módulo deja de ser una línea suelta y pasa a ser una
   banda: es la única estructura del documento y ahora se ve como tal. */
.doc-entregas .gh{background:linear-gradient(100deg,#EAF8F2,rgba(238,236,254,.75) 60%,rgba(244,168,205,.16));
  border:1px solid #e6f1ec;border-radius:11px;padding:8px 13px;margin:0 0 6px}
.doc-entregas .gh .gn{color:#1E8A63}
.doc-entregas .gh .gc{background:#fff;color:#1E8A63}
.doc-entregas .gh .ln{display:none}
.doc-entregas .ent{border-color:#e9eeeb}
.doc-entregas .ent .it:hover{background:linear-gradient(100deg,rgba(234,248,242,.5),transparent 60%)}
.doc-entregas .vid{border-color:#4FBF95;color:#1E8A63}
.doc-entregas .vid:hover{background:#4FBF95;color:#fff}
.doc-entregas .lila{background:linear-gradient(135deg,#EAF8F2,rgba(238,236,254,.7) 55%,rgba(244,168,205,.26))}

/* ── LAS ESTRELLAS DE LA CASA, EN EL DOCUMENTO ──
   La misma chispa del CRM y del menú, llevada a lo que abre el cliente. Van en
   la portada, en la banda de cifras y en el encabezado de cada módulo —la
   opción C—, y toman el color de SU documento: rosa en el de trabajo en curso,
   verde en el de entregas. Son decoración: «aria-hidden» y sin texto.
   Se quedan en los márgenes y nunca encima de una cifra o de un título: una
   chispa sobre un número deja de ser adorno y se vuelve estorbo. */
.chispas{position:absolute;inset:0;pointer-events:none;z-index:0}
.chispas svg{position:absolute;animation:latir 3.6s ease-in-out infinite}
@keyframes latir{0%,100%{opacity:1}50%{opacity:.62}}
@media (prefers-reduced-motion:reduce){.chispas svg{animation:none}}
/* Impresas se quedan quietas y un poco más tenues: en papel el degradado pesa
   más que en pantalla. */
@media print{.chispas svg{animation:none;opacity:.5!important}}
.hero .top,.hero h1,.hero .sub,.hero .quien{position:relative;z-index:1}
/* La capa de chispas de la banda de cifras NO es una columna más. «.ancla>div»
   le estaba imponiendo «position:relative» —se declara después y gana—, así
   que entraba al grid como quinta celda y empujaba la última cifra a otro
   renglón. Aquí se le devuelve el absolute y se le quitan el aire y la raya
   que le tocaban por ser hija de la banda. */
.ancla{position:relative}
.ancla>.chispas{position:absolute;padding:0;border-left:none}
.ancla>div{z-index:1}
.gh{position:relative;overflow:hidden}
.gh .gn,.gh .gc,.gh .ln{position:relative;z-index:1}

/* ── EL SELLO DE LA CASA ──
   «Aquí se pule cada estrella» es la frase del taller, y este documento es
   justo lo que sale de ahí. Va debajo del título, en su propia pastilla y en
   versalitas: no compite con el encabezado y le pone nombre al oficio. */
.sello{display:inline-flex;align-items:center;gap:7px;margin-top:12px;position:relative;z-index:1;
  border-radius:20px;padding:5px 13px;font-size:.58rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.sello svg{flex:none}
.doc-entregas .sello{background:rgba(255,255,255,.72);border:1px solid #d8ece2;color:#1E8A63}
.doc-curso .sello{background:rgba(255,255,255,.72);border:1px solid #f3dbe7;color:#9c3d70}

/* ── EL REPORTE DEL LEAD ──
   El tercero. Entregas va en verde —lo que ya entró—, trabajo en curso en rosa
   —lo que está en camino—, y este los CRUZA: un degradado de verde a rosa, que
   es exactamente lo que cuenta —lo que ya existe y lo que viene—.
   Su pieza es el espejo «hoy → con Sacs», y el cupón del cierre. */
.doc-lead .cinta{background:linear-gradient(90deg,#4FBF95,#EFA6CA 55%,#D9538E)}
.doc-lead .hero{background:linear-gradient(150deg,#EAF8F2 0%,#fdfbfc 52%,rgba(244,168,205,.30) 100%)}
.doc-lead .hero:after{background:radial-gradient(circle,rgba(79,191,149,.22),transparent 65%)}
.doc-lead .wm{background:linear-gradient(100deg,#1E8A63,#4FBF95 32%,#D9538E);-webkit-background-clip:text;background-clip:text;color:transparent}
.doc-lead .folio .f{color:var(--verde-t)}
.doc-lead .sello{background:rgba(255,255,255,.75);border:1px solid #d8ece2;color:var(--verde-t)}
.doc-lead .ancla{background:linear-gradient(180deg,#fbfdfc,#fff 70%)}
.doc-lead .ancla .n{color:var(--verde-t)}
.doc-lead .ancla .n.r{color:var(--rosa-t)}
.doc-lead .st .x{color:var(--verde-t)}

/* El espejo: sus palabras a la izquierda, la respuesta a la derecha. */
.espejo{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch;margin-top:12px}
.espejo.solo{grid-template-columns:1fr}
.espejo .c{border:1px solid var(--borde);border-radius:12px;padding:14px 16px}
.espejo .c.hoy{background:#fbfafc}
.espejo .c.con{background:linear-gradient(135deg,#EAF8F2,rgba(244,168,205,.22));border-color:#d8ece2}
.espejo .k{font-size:.56rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
.espejo .c.con .k{color:var(--verde-t)}
.espejo ul{margin:0;padding-left:16px}
.espejo li{font-size:.83rem;line-height:1.65;color:var(--ink-2);margin-bottom:4px}
.espejo .fl{display:grid;place-items:center;font-size:1.1rem;color:var(--verde)}

/* Lo que pidió, en tarjetas. El «ya existe» es el mejor argumento que tiene
   el documento y por eso se pinta, no se explica. */
.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:11px;margin-top:11px}
.mod{border:1px solid var(--borde);border-radius:12px;padding:13px 15px}
.mod .t{font-size:.86rem;font-weight:800;letter-spacing:-.01em}
.mod .d{font-size:.78rem;color:var(--ink-2);line-height:1.6;margin-top:4px}
.mod .tag{display:inline-block;margin-top:8px;font-size:.6rem;font-weight:800;border-radius:20px;padding:2px 9px;background:var(--verde-a);color:var(--verde-t)}
.mod .tag.nu{background:var(--agua);color:var(--tinta)}

.paso{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid #f5f4fa}
.paso .num{flex:none;width:24px;height:24px;border-radius:8px;background:var(--verde-a);color:var(--verde-t);display:grid;place-items:center;font-size:.7rem;font-weight:800}
.paso .t{font-size:.86rem;font-weight:700}
.paso .d{font-size:.79rem;color:var(--ink-2);line-height:1.6}
.p.decide{margin-top:12px;font-size:.82rem}
/* Cada bloque del reporte del lead necesita aire antes del siguiente título:
   sin esto «Lo que pediste» quedaba pegado a la tabla de arriba. */
.doc-lead .espejo + .st,.doc-lead .mods + .st{margin-top:28px}

/* El cupón, al cierre. Más chico que el título del documento a propósito: es
   lo último que se lee, no lo primero que grita. */
.oferta{margin-top:24px;border-radius:15px;padding:20px 24px;border:1px solid #e8f0ec;
  background:linear-gradient(120deg,#EAF8F2,rgba(255,255,255,.6) 45%,rgba(244,168,205,.30))}
.oferta .k{font-size:.58rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--verde-t)}
.oferta .big{font-size:1.6rem;font-weight:800;letter-spacing:-.03em;margin-top:4px;line-height:1.12}
.oferta .d{font-size:.85rem;color:var(--ink-2);line-height:1.65;margin-top:7px;max-width:62ch}
.oferta .chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.oferta .chip{font-size:.66rem;font-weight:700;border-radius:20px;padding:3px 10px;background:#fff;color:var(--rosa-t);border:1px solid rgba(217,83,142,.2)}
@media(max-width:760px){.espejo{grid-template-columns:1fr}.espejo .fl{transform:rotate(90deg)}}

/* ── LA PIEL DEL REPORTE DE TRABAJO EN CURSO ──
   El tercero en discordia. El de entregas se pintó de verde —lo que ya entró—;
   este va en ROSA, que en la casa es lo que está en camino, y así los dos se
   distinguen de un vistazo en el celular sin leer el título.
   Mismo esqueleto, distinta piel: es la misma casa, no otro producto. */
.doc-curso .cinta{background:linear-gradient(90deg,#D9538E,#9B8CFA 52%,rgba(155,140,250,.65))}
.doc-curso .hero{background:linear-gradient(150deg,rgba(244,168,205,.30) 0%,#f7f5ff 52%,#fdf9fb 100%)}
.doc-curso .hero:after{background:radial-gradient(circle,rgba(217,83,142,.16),transparent 65%)}
.doc-curso .wm{background:linear-gradient(100deg,#9c3d70,#7C6BF0 55%,#9B8CFA);-webkit-background-clip:text;background-clip:text;color:transparent}
.doc-curso .ancla{background:linear-gradient(180deg,#fefbfd,#fff 70%)}
.doc-curso .gh{background:linear-gradient(100deg,rgba(244,168,205,.26),rgba(238,236,254,.8) 62%,rgba(238,236,254,.25));
  border:1px solid #f3e3ec;border-radius:11px;padding:8px 13px;margin:0 0 6px}
.doc-curso .gh .gn{color:#9c3d70}
.doc-curso .gh .gc{background:#fff;color:#9c3d70}
.doc-curso .gh .ln{display:none}
.doc-curso .ent{border-color:#f1e7ed}
.doc-curso .ent .it:hover{background:linear-gradient(100deg,rgba(244,168,205,.12),transparent 60%)}
.doc-curso .vid{border-color:#D9538E;color:#9c3d70}
.doc-curso .vid:hover{background:#D9538E;color:#fff}
.doc-curso .lila{background:linear-gradient(135deg,rgba(244,168,205,.30),rgba(238,236,254,.85) 58%,rgba(238,236,254,.35))}
.doc-curso .lila .t{color:#9c3d70}
/* La etapa, en el renglón. Discreta: el peso lo lleva el trabajo, no su fase. */
.etp{font-size:.6rem;font-weight:800;border-radius:20px;padding:2px 9px;white-space:nowrap;
  background:var(--agua);color:var(--tinta)}
.doc-curso .etp{background:rgba(244,168,205,.22);color:#9c3d70}
.fe.sf{color:#9c3d70;font-weight:700}

/* ── Grupos por módulo ──
   La única estructura real del documento: en qué parte del sistema se trabajó.
   El encabezado es discreto a propósito; el peso lo lleva la entrega. */
.grupo+.grupo{margin-top:22px}
.gh{display:flex;align-items:center;gap:10px;margin:0 0 2px}
.gh .gn{font-size:.82rem;font-weight:800;letter-spacing:-.01em;color:var(--ink)}
.gh .gc{font-size:.66rem;font-weight:700;color:var(--tinta);background:var(--agua);border-radius:20px;padding:2px 9px;white-space:nowrap}
.gh .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--borde),transparent)}
.vid{display:inline-flex;align-items:center;gap:7px;margin-top:9px;text-decoration:none;border:1.5px solid var(--violeta);
  border-radius:9px;padding:6px 13px;font-size:.77rem;font-weight:700;color:var(--tinta);background:#fff}
.vid:hover{background:var(--violeta);color:#fff}
.vid .pl{width:16px;height:16px;border-radius:50%;background:var(--violeta);color:#fff;display:inline-grid;place-items:center;font-size:.5rem}
.vid:hover .pl{background:#fff;color:var(--tinta)}
.sinvid{display:inline-block;margin-top:9px;font-size:.72rem;color:var(--ink-3)}
.pieE{padding:22px 34px 30px;border-top:1px solid var(--borde);background:var(--tono)}
.pieE .fw{font-size:1.05rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(100deg,#7C6BF0,#8E7DEF 35%,#D9538E);-webkit-background-clip:text;background-clip:text;color:transparent}
.pieE p{font-size:.79rem;color:var(--ink-2);margin:6px 0 0;max-width:62ch}
@media(max-width:720px){.cuerpo{padding:22px 20px 26px}.pieE{padding:20px}}
@media print{
  /* En papel la liga no se puede clicar: se imprime al lado, o el video
     desaparece justo del documento que existe para enseñarlo. */
  .vid{border-color:#cfc6f2}
  .vid:after{content:' — ' attr(href);font-weight:400;font-size:.66rem;color:#928da4;word-break:break-all}
  .vid .pl{display:none}
  .ent details{display:block}
  .ent details>summary{display:none}
  .ent .mas{display:block!important}
  .ent .it{break-inside:avoid}
}
`;
