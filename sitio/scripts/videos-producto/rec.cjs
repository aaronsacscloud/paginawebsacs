// Grabador CUADRO POR CUADRO (stop-motion) para los videos de /producto/* (ver memoria del proyecto).
// Uso: cd sitio/scripts/videos-producto && U=<correo> P=<contraseña> node facturacion-hero.cjs
// Salida: out/<nombre>.mp4 + poster; webm con api.webm(). Las cuentas son de clientes reales: solo lectura.
//
// cada cuadro es un screenshot a 2x; el tiempo del video lo define el guion, no el reloj.
const { chromium } = require('/home/aaron/.claude/skills/crear-video-cliente/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const D = __dirname, B = 'http://localhost:8081/lavidaesparadisfrutar/mibellapandita/', FPS = 30;
const TOUCH = `(()=>{ if(document.getElementById('__t'))return; const t=document.createElement('div'); t.id='__t';
 t.style.cssText='position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(40,40,45,.20);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 10px rgba(0,0,0,.20);pointer-events:none;z-index:2147483647;opacity:0;transition:none;';
 document.documentElement.appendChild(t); })()`;
const ease = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
async function abrir(vw, vh){
  const ctx = await chromium.launchPersistentContext(D+'/perfil', { executablePath: process.env.HOME+'/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args:['--no-sandbox','--hide-scrollbars'], viewport:{width:vw,height:vh}, deviceScaleFactor:2 });
  const fijos = fs.existsSync(D+'/fijos.local.json') ? fs.readFileSync(D+'/fijos.local.json','utf8') : '{}';
  await ctx.addInitScript(`window.__SCRUB_FIJOS = ${fijos};`);
  await ctx.addInitScript({ path: D+'/scrub.js' });
  const p = ctx.pages()[0] || await ctx.newPage(); p.setDefaultTimeout(20000);
  const cdp = await ctx.newCDPSession(p);
  const shot = async f => { const r = await cdp.send('Page.captureScreenshot', { format:'jpeg', quality:92, captureBeyondViewport:false, fromSurface:true, clip:{ x:0, y:0, width:vw, height:vh, scale:2 } }); fs.writeFileSync(f, Buffer.from(r.data,'base64')); };
  const st = { dir:null, n:0, lista:[], x: vw/2, y: vh/2, vis:0, esc:1 };
  const api = {
    ctx, p, st, vw, vh,
    async hayTexto(texto){ return p.evaluate(t=>{ let ok=false; const walk=root=>root.querySelectorAll('*').forEach(el=>{ if(ok) return; if(el.shadowRoot) walk(el.shadowRoot); for(const c of el.childNodes){ if(c.nodeType===3 && c.textContent.toLowerCase().includes(t.toLowerCase())){ const b=el.getBoundingClientRect(); if(b.width>0) ok=true; } } }); walk(document); return ok; }, texto); },
    async esperaTexto(texto, max=150000){ const t0=Date.now(); while(Date.now()-t0<max){ if(await api.hayTexto(texto)) { await p.waitForTimeout(1500); return; } await p.waitForTimeout(400); } await p.screenshot({path:D+'/fail-espera.png'}); throw new Error('No apareció «'+texto+'»'); },
    // primer uso del perfil: inicia sesión con U / P del entorno (nunca escribir credenciales aquí)
    async login(){ await p.waitForTimeout(4000); if (!(await p.$('input[type="password"]'))) return;
      if (!process.env.U || !process.env.P) throw new Error('Perfil sin sesión: corre con U=<correo> P=<contraseña>');
      const e = await p.$('input[type="email"]') || await p.$('input[type="text"]'); await e.fill(process.env.U);
      await (await p.$('input[type="password"]')).fill(process.env.P); await p.keyboard.press('Enter');
      await p.waitForURL('**/lavidaesparadisfrutar/**', { timeout: 90000 }); await p.waitForTimeout(5000);
      if (await p.$('text=Entrar ahora')) await p.click('text=Entrar ahora'); },
    async go(u, texto){ await p.goto(B+u, { waitUntil:'domcontentloaded' }); await api.login(); if (p.url().indexOf(u.split('/')[0]) < 0) await p.goto(B+u, { waitUntil:'domcontentloaded' }); if (texto) await api.esperaTexto(texto); else await p.waitForTimeout(9000); await p.evaluate(TOUCH); },
    async punto(texto, { xmin=0, xmax=1e9, ymin=0, ymax=1e9, n=0 } = {}){
      const r = await p.evaluate(([texto,xmin,xmax,ymin,ymax])=>{ const ex=[], pre=[]; const walk=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) walk(el.shadowRoot);
        const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(!own) return; const b=el.getBoundingClientRect(); const cx=b.x+b.width/2, cy=b.y+b.height/2; if(!(b.width>0&&cx>=xmin&&cx<=xmax&&cy>=ymin&&cy<=ymax)) return;
        if(own===texto) ex.push([cx,cy]); else if(own.startsWith(texto) && own.length < texto.length+8) pre.push([cx,cy]); }); walk(document); return ex.length?ex:pre; },[texto,xmin,xmax,ymin,ymax]);
      if (!r[n]) { await p.screenshot({ path: D+'/fail-'+texto.replace(/\W+/g,'_')+'.png' }); throw new Error('No encontré «'+texto+'»'); } return r[n]; },
    async cursor(){ await p.evaluate(([x,y,v,e])=>{ const t=document.getElementById('__t'); if(!t) return; const z=parseFloat(document.documentElement.style.zoom)||1; t.style.opacity=v; t.style.transform=`translate(${x/z}px,${y/z}px) scale(${e/z})`; t.style.background = e<1 ? 'rgba(40,40,45,.36)' : 'rgba(40,40,45,.20)'; },[st.x,st.y,st.vis,st.esc]); },
    async cuadro(frames=1){ await api.cursor(); const f = path.join(st.dir, String(st.n++).padStart(5,'0')+'.jpg'); await shot(f); st.lista.push([f, frames/FPS]); return f; },
    async quieto(seg){ await api.cuadro(Math.round(seg*FPS)); },
    async iniciar(nombre){ st.nombre=nombre; st.dir = path.join(D,'frames',nombre); fs.rmSync(st.dir,{recursive:true,force:true}); fs.mkdirSync(st.dir,{recursive:true}); st.n=0; st.lista=[]; await p.evaluate(TOUCH); },
    async mover(x, y, seg=0.55){ const x0=st.x, y0=st.y, v0=st.vis; const n=Math.round(seg*FPS);
      for(let i=1;i<=n;i++){ const k=ease(i/n); st.x=x0+(x-x0)*k; st.y=y0+(y-y0)*k; st.vis=Math.min(1, v0 + i/6); await api.cuadro(1); } },
    async toque(x, y, { clic=true, despues } = {}){ await api.mover(x,y);
      for (const e of [0.9,0.8,0.76]) { st.esc=e; await api.cuadro(1); }
      if (clic) await p.mouse.click(x,y);
      for (const e of [0.85,0.95,1]) { st.esc=e; if (!despues) await p.waitForTimeout(40); await api.cuadro(1); } st.esc=1; },
    async ocultar(seg=0.25){ const n=Math.round(seg*FPS); for(let i=1;i<=n;i++){ st.vis=Math.max(0,1-i/n); await api.cuadro(1); } },
    // clic que cambia de pantalla: congela, espera a que la nueva esté lista y hace fundido
    async transicion(accion, texto, { fundido=0.35, extra=1200 } = {}){ st.vis=0; const prev = st.lista[st.lista.length-1][0];
      await accion(); if (texto) await api.esperaTexto(texto); await p.waitForTimeout(extra); await p.evaluate(TOUCH);
      const sig = path.join(st.dir, 'tmp-sig.jpg'); await api.cursor(); await shot(sig);
      const n = Math.round(fundido*FPS);
      for (let i=1;i<=n;i++){ const f = path.join(st.dir, String(st.n++).padStart(5,'0')+'.jpg'); const a=(i/n).toFixed(3);
        execSync(`ffmpeg -v error -y -i "${prev}" -i "${sig}" -filter_complex "[0][1]blend=all_expr='A*(1-${a})+B*${a}'" -q:v 2 "${f}"`); st.lista.push([f, 1/FPS]); } },
    async teclear(texto, { porLetra=2 } = {}){ for (const ch of texto){ await p.keyboard.type(ch); await api.cuadro(porLetra); } },
    async irA(url, texto){ await p.goto(url, { waitUntil:'domcontentloaded' }); if (texto) await api.esperaTexto(texto); await p.evaluate(TOUCH); },
    async scroll(dy, seg=1.2){ const n=Math.round(seg*FPS); let hecho=0; for(let i=1;i<=n;i++){ const obj=Math.round(dy*ease(i/n)); const paso=obj-hecho; hecho=obj; if(paso) await p.mouse.wheel(0,paso); await p.waitForTimeout(35); await api.cuadro(1); } },
    async terminar(nombre, { recorteIzq=0, salida=[1600,900] } = {}){
      let lista=''; for (const [f,d] of st.lista) lista += `file '${f}'\nduration ${d.toFixed(5)}\n`; lista += `file '${st.lista[st.lista.length-1][0]}'\n`;
      const lf = path.join(D,'frames',nombre+'.txt'); fs.writeFileSync(lf, lista);
      const cx = recorteIzq*2; const vf = `crop=iw-${cx}:ih:${cx}:0,scale=${salida[0]}:${salida[1]}:flags=lanczos,fps=${FPS},format=yuv420p`;
      const out = path.join(D,'out',nombre); fs.mkdirSync(path.dirname(out),{recursive:true});
      execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${lf}" -vf "${vf}" -c:v libx264 -crf 18 -preset medium -profile:v high -movflags +faststart -an "${out}.mp4"`);
      execSync(`ffmpeg -v error -y -i "${out}.mp4" -vf "select=eq(n\\,0)" -frames:v 1 -c:v libwebp -quality 82 "${out}-poster.webp"`);
      const info = execSync(`ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 "${out}.mp4"`).toString().trim().replace(/\n/g,' ');
      console.log('LISTO', nombre, info, st.lista.length+' cuadros');
    },
    webm(nombre){ const out = path.join(D,'out',nombre); execSync(`ffmpeg -v error -y -i "${out}.mp4" -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -deadline good -cpu-used 4 -an "${out}.webm"`); },
    async cerrar(){ await ctx.close(); }
  };
  return api;
}
module.exports = { abrir };
