import { chromium } from 'playwright';
const OUT='/tmp/claude-1000/-opt-sacs/e8071fcf-1c58-4c2b-95dc-b44579906dcd/scratchpad';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:980,height:1200},deviceScaleFactor:2}); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.goto('file://'+OUT+'/auditoria-cliente.html'); await p.waitForTimeout(1500);
await p.pdf({path:`${OUT}/auditoria-five.pdf`, format:'A4', printBackground:true, margin:{top:'11mm',bottom:'11mm',left:'9mm',right:'9mm'}});
await p.screenshot({path:`${OUT}/aud2-completo.png`, fullPage:true});
console.log(errs.length?'⚠ JS: '+errs.join(' | '):'sin errores de JS'); await b.close();
