import { chromium } from 'playwright';
import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.crm-login', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const SDK = `
class E{constructor(){this._h={}}on(e,f){(this._h[e]=this._h[e]||[]).push(f);return this}emit(e,...a){(this._h[e]||[]).slice().forEach(f=>f(...a))}}
class L extends E{constructor(){super();this.parameters={CallSid:'CA'+'ab12cd34'.repeat(4),From:'+525599887766'}}mute(v){this._m=v}sendDigits(){}disconnect(){this.emit('disconnect')}accept(){this.emit('accept',this)}reject(){this.emit('reject')}}
export class Device extends E{constructor(){super();window.__dev=this}async register(){window.__registros=(window.__registros||0)+1}destroy(){}updateToken(t){window.__tokens=(window.__tokens||0)+1}async connect({params}){const c=new L();window.__call=c;return c}}
export const Call=L; export default {Device,Call:L}; window.__L=L;`;

const nav=await chromium.launch({args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const ctx=await nav.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['microphone']});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*voice-sdk*',r=>r.fulfill({status:200,contentType:'application/javascript',body:SDK}));
await p.route('**/api/crm/telefonia/token*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:'jwt.falso',identity:'crm-qa',numero:'+525593027234'})}));
const paso=(n,ok,d='')=>console.log(`  ${ok?'✓':'✗'} ${n}${d?' — '+d:''}`);
const cuadro=()=>p.locator('[role=alert]').filter({hasText:/conexión|token|Twilio|micrófono|configurada/}).count();

await p.goto('http://localhost:4321/admin/login',{waitUntil:'domcontentloaded'});
await p.fill('input[type=email]',env.CRM_EMAIL); await p.fill('input[type=password]',env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**',{timeout:30000}).catch(()=>{});
await p.goto('http://localhost:4321/admin/crm?tab=whatsapp',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__dev,null,{timeout:20000});
await p.waitForTimeout(1500);

paso('Un solo Device al cargar', (await p.evaluate(()=>window.__registros))===1, `${await p.evaluate(()=>window.__registros)} registro(s)`);

// 1· hipo de conexión SIN llamada → no debe pintar nada
await p.evaluate(()=>window.__dev.emit('error',{code:31005,message:'ConnectionError'}));
await p.waitForTimeout(600);
paso('Un hipo de conexión sin llamada NO molesta', (await cuadro())===0);

// 2· token inválido sin llamada → se renueva en silencio
const antes = await p.evaluate(()=>window.__tokens||0);
await p.evaluate(()=>window.__dev.emit('error',{code:20101,message:'AccessTokenInvalid'}));
await p.waitForTimeout(1200);
paso('Token inválido: se renueva callado', (await cuadro())===0 && (await p.evaluate(()=>window.__tokens||0))>antes, `${await p.evaluate(()=>window.__tokens||0)} renovación(es)`);

// 3· error DURANTE una llamada → sí se enseña
await p.evaluate(()=>document.dispatchEvent(new CustomEvent('tel-llamar',{detail:{telefono:'+525512345678',nombre:'Prueba'}})));
await p.waitForFunction(()=>!!window.__call,null,{timeout:10000}); await p.waitForTimeout(400);
await p.evaluate(()=>window.__dev.emit('error',{code:31005,message:'ConnectionError'}));
await p.waitForTimeout(600);
paso('Con llamada en curso, el error SÍ se enseña', (await cuadro())>0);

// 4· se cierra al toque
// En móvil el aviso vive DENTRO de la pantalla de llamada y cierra al tocarlo.
await p.locator('[role=alert]').filter({hasText:/conexión/}).first().click();
await p.waitForTimeout(400);
paso('Al tocarlo, el aviso se va', (await cuadro())===0);

// 5· al colgar, la pantalla de cierre ocupa TODO (no la tarjeta de escritorio)
await p.evaluate(()=>window.__call.emit('disconnect'));
await p.waitForTimeout(3200);
const panel = await p.locator('[data-tel-panel]').boundingBox();
paso('El cierre ocupa toda la pantalla', !!panel && panel.height>700, panel?`${Math.round(panel.width)}×${Math.round(panel.height)} px`:'no hay panel');
for (const t of ['Llamar otra vez','Listo']) {
  const b = await p.getByRole('button',{name:t}).boundingBox();
  paso(`«${t}» es de pulgar`, !!b && b.height>=44, b?`${Math.round(b.height)} px de alto`:'no existe');
}
await p.screenshot({path:'/tmp/qa-tel-cierre.png'});

console.log(errs.length?`\n  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0,2).join(' | ')}`:'\n  ✓ sin errores de JS');
await nav.close();
