/**
 * Contenido de la Suite para Tiendas de Ropa.
 *
 * Regla de esta pagina: NADA generico. Cada ejemplo se escribe con prendas,
 * tallas y colores reales — "playera oversize negra M" y no "producto A". Es lo
 * que separa una landing de giro de un folleto: el dueño de la boutique tiene
 * que reconocer su propio inventario en la pantalla.
 */
export interface SuiteSeccion {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  bullets?: string[];
  visual: string;
  testimonio?: { cita: string; autor: string };
}

/* Helpers de los mocks: se arman con HTML/CSS inline para que no dependan de
   imagenes (pesan menos, se ven nitidos en cualquier pantalla y no hay que
   rehacer capturas cada que cambia la UI). */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  celdaOk: 'background:var(--ok-fondo);color:var(--ok-texto);',
  celdaLo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
  celdaZero: 'background:var(--color-bg-primary);color:#D4D4D4;',
};

export const seccionesRopa: SuiteSeccion[] = [
  {
    id: 'matriz',
    tag: 'Inventario',
    titulo: 'La matriz de tallas y colores, como la piensas tú',
    texto:
      'Dejas de capturar prenda por prenda. Armas la cuadrícula talla × color del estilo y el sistema abre cada casilla solo. Cada una lleva su propia existencia.',
    bullets: [
      'Blusa satinada: 6 tallas × 4 colores = 24 piezas distintas, en un solo paso',
      'Ves de un vistazo que el negro XS lleva tres semanas agotado',
      'Y que el vino XXL nunca se vendió — deja de recomprarlo',
    ],
    visual: `<div style="${est.wrap}position:relative;">
      <svg class="mk-cursor" viewBox="0 0 24 24" fill="var(--color-text-primary)" stroke="#fff" stroke-width="1.6"><path d="M4 2l7 18 2.5-7.5L21 10z"/></svg>
      <p style="${est.h}">Blusa satinada · existencia por talla y color</p>
      <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
        ${[['Negro','mk-chip-1'],['Talla M','mk-chip-2'],['Con existencia','mk-chip-3']]
          .map(([t,c]:any)=>`<span class="mk-chip ${c}" style="font-size:10.5px;font-weight:700;border:1px solid #DFE3EA;border-radius:999px;padding:4px 10px;color:var(--color-text-secondary);background:#fff;">${t}</span>`).join('')}
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:var(--color-text-tertiary);width:64px;"></th>
        ${['XS','S','M','L','XL','XXL'].map(t=>`<th style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:700;">${t}</th>`).join('')}</tr>
        ${[['Negro',[0,8,12,9,4,0]],['Blanco',[3,11,14,7,2,0]],['Vino',[2,5,6,3,1,0]],['Camel',[1,4,7,5,2,0]]]
          .map(([c,v]:any)=>`<tr><td style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${c}</td>${v.map((n:number,i:number)=>{
            const st = n===0?est.celdaZero:(n<=3?est.celdaLo:est.celdaOk);
            const marca = (c==='Negro'&&i===2)?'box-shadow:0 0 0 2px var(--color-primary);':'';
            return `<td style="${st}${marca}border-radius:8px;height:30px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;">${n}</td>`;
          }).join('')}</tr>`).join('')}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">Negro M · 12 disponibles en esta sucursal</p>
    </div>`,
  },
  {
    id: 'curvas',
    tag: 'Compras',
    titulo: 'Compra por curva, no por corazonada',
    texto:
      'Pides 60 piezas de un modelo y el sistema te dice cómo repartirlas: no en partes iguales, sino en la proporción que de verdad vende tu tienda.',
    bullets: [
      'Curva sugerida a partir de lo que se vendió la temporada pasada',
      'Cada sucursal con su curva: en Polanco sale la S, en León la XL',
      'Aviso cuando el proveedor te manda un surtido que no es tu curva',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Pedido a proveedor · 60 piezas</p>
      ${[['XS',6,10],['S',15,25],['M',18,30],['L',12,20],['XL',7,12],['XXL',2,3]]
        .map(([t,n,p]:any)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
          <span style="width:34px;font-size:11.5px;font-weight:800;color:var(--color-text-primary);">${t}</span>
          <div style="flex:1;height:22px;background:var(--color-bg-primary);border-radius:8px;overflow:hidden;">
            <div style="width:${p*3.2}%;height:100%;background:linear-gradient(90deg,var(--color-primary),var(--color-primary));"></div>
          </div>
          <span style="width:56px;text-align:right;font-size:11.5px;font-weight:700;color:var(--color-text-secondary);">${n} pz · ${p}%</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Curva calculada con la venta real de la temporada anterior</p>
    </div>`,
  },
  {
    id: 'consignacion',
    tag: 'Distribución',
    titulo: 'Lo que dejas en la departamental, bajo control',
    texto:
      'Consigna, venta en firme o distribuidor: registras qué entregaste, el sistema te dice qué se vendió, qué recoges y cuánto te deben. Se acabó el Excel de cada tienda.',
    bullets: [
      'Entregas 40 vestidos a una boutique; sabes cuáles siguen colgados',
      'Liquidación por consignatario con su comisión ya descontada',
      'Lo consignado no se te vende dos veces: sale de tu inventario disponible',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Consignatarios · corte del mes</p>
      ${[['Departamental · centro','Departamental',48,31,'$62,000'],['Boutique Ana','Consigna',40,26,'$18,200'],['Distribuidora Norte','Venta en firme',120,120,'$91,400']]
        .map(([n,t,e,v,m]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${t} · entregadas ${e} · vendidas ${v}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:800;color:var(--ok-texto);font-variant-numeric:tabular-nums;">${m}</div>
            <div style="font-size:9.5px;color:var(--color-text-tertiary);font-weight:700;">por liquidar</div>
          </div>
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'temporadas',
    tag: 'Colecciones',
    titulo: 'Temporadas, colecciones y drops',
    texto:
      'Cada prenda sabe a qué temporada pertenece. Cuando entra la nueva colección, la anterior se marca sola y sabes exactamente cuánto dinero tienes parado en ropa de hace dos temporadas.',
    bullets: [
      'Primavera-Verano 26 vs. Otoño-Invierno 25, separados en todo reporte',
      'Rebajas programadas por colección, sin tocar el catálogo nuevo',
      'Alerta de la prenda que va abajo de su meta con temporada por delante (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Lo que tienes colgado, por antigüedad</p>
      <div class="mk-env">
        ${[['PV 26','12 días','linear-gradient(160deg,#4B7BE5,#2D4EA8)'],
           ['OI 25','210 días','linear-gradient(160deg,#C58B5C,#8A5A38)'],
           ['PV 25','400 días','linear-gradient(160deg,#6FB98F,#3E7A5C)'],
           ['OI 24','580 días','linear-gradient(160deg,#B26B7A,#7A3F4E)']]
          .map(([t,d,bg]:any)=>`<div class="mk-env-p"><div class="mk-env-tela" style="background:${bg}"></div><small>${t} · ${d}</small></div>`).join('')}
      </div>
      <div class="mk-env-barra"><i></i></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;">
        <span style="color:var(--color-text-tertiary);">Recién llegado</span>
        <span style="color:var(--alerta-texto);">$118,000 parados</span>
      </div>
      <p style="margin:14px 0 0;font-size:11px;color:var(--color-text-tertiary);">La colección vieja pierde color en el tablero: se ve el rezago sin abrir un reporte</p>
    </div>`,
  },
  {
    id: 'cambios',
    tag: 'Mostrador',
    titulo: '"No me quedó la talla"',
    texto:
      'La frase que más escuchas. El cambio se resuelve en segundos, sin ticket físico, aunque lo haya comprado en otra sucursal, aunque lo haya pedido en línea y aunque hoy atienda otra vendedora.',
    bullets: [
      'Buscas por teléfono de la clienta y aparece lo que se llevó, del canal que sea',
      'Cambio de M a L del mismo modelo, con la diferencia si aplica',
      'Si no hay su talla aquí, ves en qué sucursal sí y la apartas',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cambio de talla · sin ticket</p>
      <div style="border:1px solid var(--color-border-light);border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-size:11px;color:var(--color-text-tertiary);font-weight:700;margin-bottom:6px;">SE LLEVÓ (12 mar · Sucursal Centro)</div>
        <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);">Playera oversize negra
          <span style="background:var(--alerta-fondo);color:var(--alerta-texto);border-radius:8px;padding:2px 7px;font-size:10.5px;margin-left:6px;">M</span></div>
      </div>
      <div style="text-align:center;color:#D4D4D4;font-size:16px;margin:2px 0 8px;">↓</div>
      <div style="border:1.5px solid var(--ok-texto);background:var(--ok-fondo);border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:var(--ok-texto);font-weight:700;margin-bottom:6px;">SE LLEVA HOY</div>
        <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);">Playera oversize negra
          <span style="background:var(--ok-fondo);color:var(--ok-texto);border-radius:8px;padding:2px 7px;font-size:10.5px;margin-left:6px;">L</span></div>
        <div style="font-size:11px;color:var(--color-text-tertiary);font-weight:600;margin-top:5px;">Sin diferencia a pagar · 4 disponibles</div>
      </div>
    </div>`,
  },
  {
    id: 'sucursales',
    tag: 'Multisucursal',
    titulo: 'Toda tu ropa, en una sola pantalla',
    texto:
      'Dejas de llamarle a la otra tienda para preguntar si hay. Ves el inventario de todas tus sucursales desde el punto de venta, y decides de dónde sale la prenda.',
    bullets: [
      'La clienta quiere el vestido en S y aquí se acabó: en Satélite hay 3',
      'Se lo apartas o pides el traspaso sin salir de la venta',
      'Cada sucursal con su existencia real, descontando lo ya apartado',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Vestido midi verde · talla S</p>
      <div class="mk-mapa">
        <svg viewBox="0 0 400 234" preserveAspectRatio="none">
          <path class="mk-linea" d="M300 62 C 240 40, 180 120, 120 140" />
        </svg>
        <div class="mk-pin viva" style="left:75%;top:26%"><i></i><b>Satélite</b><small>3 disponibles</small></div>
        <div class="mk-pin aqui" style="left:30%;top:60%"><i></i><b>Centro · aquí</b><small>agotada</small></div>
        <div class="mk-pin" style="left:60%;top:80%"><i></i><b>Polanco</b><small>5 disponibles</small></div>
        <div class="mk-pin" style="left:18%;top:20%"><i></i><b>CEDIS</b><small>12 disponibles</small></div>
      </div>
      <div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;display:flex;align-items:center;gap:10px;">
        <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">Tomar de Satélite</div>
        <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">Sale de su inventario, entra al tuyo</div></div>
        <span style="background:var(--ok-fondo);color:var(--ok-texto);border-radius:999px;padding:3px 10px;font-size:10px;font-weight:800;">TOMAR</span>
      </div>
    </div>`,
  },
  {
    id: 'omnicanal',
    tag: 'Omnicanalidad',
    titulo: 'Un solo inventario: piso, en línea y WhatsApp',
    texto:
      'Tu tienda física y tu tienda en línea dejan de ser dos negocios distintos. La misma prenda, la misma talla y la misma existencia en el mostrador, en tu ecommerce, en los marketplaces y en el chat. Se vende donde se venda, y se descuenta una sola vez.',
    bullets: [
      'Se va la última S en el mostrador y desaparece del ecommerce en ese momento',
      'Compra en línea y recoge en tienda, o se la mandas desde la sucursal que sí la tiene',
      'Mercado Libre, Shopify, TikTok Shop y tu propia tienda, con un mismo catálogo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Blusa satinada negra · talla S · hoy</p>
      ${[['Piso de venta','Sucursal Centro',12,'var(--color-primary)'],['Tienda en línea','Tu ecommerce',7,'#8B7BE5'],['Marketplaces','ML · TikTok Shop',5,'var(--color-accent)'],['WhatsApp','Catálogo y chat',3,'var(--ok-texto)']]
        .map(([n,s,q,c]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${s}</div>
          </div>
          <span style="font-size:13px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">${q} pz</span>
        </div>`).join('')}
      <div style="border:1.5px solid var(--color-primary);background:var(--azul-fondo);border-radius:8px;padding:11px 13px;margin-top:11px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="font-size:11.5px;font-weight:800;color:var(--color-primary);">Existencia única · los 4 canales</span>
        <span style="font-size:15px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">4</span>
      </div>
    </div>`,
  },
  {
    id: 'looks',
    tag: 'Ticket promedio',
    titulo: 'Vende el look completo, no la prenda suelta',
    texto:
      'Armas conjuntos y el punto de venta los sugiere solo. La vendedora no tiene que acordarse de qué combina con qué: lo tiene en pantalla mientras cobra.',
    bullets: [
      'Blusa + pantalón + cinturón con 15% por llevarse el look',
      'Sugerencia automática al escanear la prenda principal',
      'Reporte de qué combinaciones sí levantan el ticket',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Look sugerido al cobrar</p>
      ${[['Blusa satinada negra','$899','en el ticket','/images/prod-blusa-negra.webp'],
         ['Pantalón sastre camel','$1,290','sugerido','/images/prod-pantalon-camel.webp'],
         ['Cinturón piel','$450','sugerido','/images/prod-cinturon-piel.webp']]
        .map(([n,p,t,img]:any)=>`<div style="display:flex;align-items:center;gap:13px;border:1px solid ${t==='sugerido'?'#DBE7FB':'var(--color-border-light)'};background:${t==='sugerido'?'#FAFCFF':'#fff'};border-radius:8px;padding:10px 13px;margin-bottom:9px;">
          <span style="width:58px;height:58px;border-radius:8px;overflow:hidden;flex-shrink:0;background:linear-gradient(160deg,#F1F3F8,var(--color-border-light));box-shadow:inset 0 0 0 1px rgba(15,23,42,.06);">
            <img src="${img}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
          </span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);line-height:1.3;">${n}</div>
            <div style="font-size:10.5px;color:${t==='sugerido'?'var(--color-primary)':'var(--color-text-tertiary)'};font-weight:700;margin-top:3px;">${t==='sugerido'?'+ SUGERIDO POR EL SISTEMA':'EN EL TICKET'}</div>
          </div>
          <span style="font-size:13.5px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">${p}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed var(--color-border-light);margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:800;color:var(--ok-texto);">Look completo −15%</span>
        <span style="font-size:16px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">$2,241</span>
      </div>
    </div>`,
  },
  {
    id: 'reabasto',
    tag: 'Reposición',
    titulo: 'Te avisa antes de quedarte sin la talla que sí vende',
    texto:
      'No todas las prendas rotan igual. El sistema detecta cuál se está agotando más rápido de lo normal y te sugiere reponer antes de que la clienta se vaya con las manos vacías.',
    bullets: [
      'La M del jean recto se va al doble de velocidad que las demás',
      'Sugerencia de resurtido por talla, color y sucursal',
      'Y la lista de lo que NO hay que volver a pedir',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Sugerencias de resurtido</p>
      ${[['Jean recto · M · Azul','se agota en 6 días','var(--alerta-texto)','Pedir 24'],['Blusa satinada · S · Negro','se agota en 11 días','var(--color-accent)','Pedir 12'],['Saco lino · XL · Beige','sin venta en 90 días','var(--color-text-tertiary)','No pedir']]
        .map(([n,d,c,a]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${d}</div></div>
          <span style="font-size:11px;font-weight:800;color:${c==='var(--color-text-tertiary)'?'var(--color-text-tertiary)':'var(--color-primary)'};">${a}</span>
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'clientas',
    tag: 'Fidelización',
    titulo: 'Sabes qué talla usa cada clienta',
    texto:
      'El historial no es solo cuánto gastó: es qué talla, qué colores y qué marcas se lleva. Con eso le avisas cuando llega algo de su talla, no un mensaje genérico a toda tu base.',
    bullets: [
      'Perfil con su talla habitual y sus colores recurrentes',
      'Aviso por WhatsApp cuando entra su talla en la colección nueva',
      'Puntos y cashback que la traen de vuelta la próxima temporada',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Ficha de clienta</p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--azul-fondo),#BFDBFE);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--color-primary);">MR</div>
        <div><div style="font-size:14px;font-weight:800;color:var(--color-text-primary);">Mariana R.</div>
        <div style="font-size:11px;color:var(--color-text-tertiary);font-weight:600;">14 compras · $38,400 · desde 2024</div></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
        ${['Talla S','Negro','Camel','Blusas','Sastre'].map(t=>`<span style="background:var(--azul-fondo);color:var(--color-primary);border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;">${t}</span>`).join('')}
      </div>
      <div style="background:var(--ok-fondo);border:1px solid #A7F3D0;border-radius:8px;padding:12px 13px;display:flex;align-items:center;gap:12px;">
        <span style="width:52px;height:52px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--color-border-light);">
          <img src="/images/prod-blusa-negra.webp" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
        </span>
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--ok-texto);">Llegó su talla</div>
          <div style="font-size:11.5px;color:var(--ok-texto);margin-top:3px;">3 prendas nuevas en S, negro. Avisar por WhatsApp.</div>
        </div>
      </div>
    </div>`,
  },
  {
    id: 'agentes',
    tag: 'Agentes de IA',
    titulo: 'Agentes de IA que tú programas',
    texto:
      'No es un chatbot cerrado que te vendemos ya hecho. Tú defines qué vigila cada agente, cada cuándo lo hace y hasta dónde puede actuar: revisar las tallas críticas cada mañana, contestar el WhatsApp de la clienta, armar el pedido al proveedor o avisarte cuando una colección se está quedando parada.',
    bullets: [
      'La instrucción se escribe en español; no hay que programar nada',
      'Trabajan sobre tus datos reales: tu inventario, tus ventas, tus clientas',
      'Tú decides si el agente solo te avisa o si ya ejecuta la acción',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Asesora de WhatsApp · en vivo</p>
      <div class="mk-chat">
        <div class="mk-burb mk-burb-cli"><div class="mk-rot">Clienta</div>Hola, vi el vestido verde en su historia. ¿Lo tienen en chica?</div>
        <div class="mk-burb mk-burb-ia"><div class="mk-rot">Agente de IA</div><span class="mk-txt-ia">Sí, nos queda una en chica. Está en Satélite y ya te la aparté aquí en Centro</span><span class="mk-teclea"></span></div>
      </div>
      <div class="mk-accion" style="margin-top:10px;">
        <b>EJECUTÓ</b><span>Apartado #4471 creado en Centro · pieza tomada de Satélite</span>
      </div>
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">Tú decides si el agente solo avisa o si ya ejecuta</p>
    </div>`,
  },
];
