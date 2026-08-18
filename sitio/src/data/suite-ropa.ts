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
  wrap: 'font-family:Inter,system-ui,sans-serif;',
  h: 'font-size:11px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  celdaOk: 'background:#D1FAE5;color:#065F46;',
  celdaLo: 'background:#FEF3C7;color:#92400E;',
  celdaZero: 'background:#F8FAFC;color:#CBD5E1;',
};

export const seccionesRopa: SuiteSeccion[] = [
  {
    id: 'matriz',
    tag: 'Inventario',
    titulo: 'La matriz de tallas y colores, como la piensas tú',
    texto:
      'Dejas de capturar prenda por prenda. Armas la cuadrícula talla × color de un modelo y el sistema crea los SKU solo. Cada casilla lleva su propia existencia.',
    bullets: [
      'Blusa satinada: 6 tallas × 4 colores = 24 SKU en un solo paso',
      'Ves de un vistazo que el negro XS lleva tres semanas agotado',
      'Y que el vino XXL nunca se vendió — deja de recomprarlo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Blusa satinada · existencia por talla y color</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:#64748B;width:64px;"></th>
        ${['XS','S','M','L','XL','XXL'].map(t=>`<th style="font-size:10.5px;color:#64748B;font-weight:700;">${t}</th>`).join('')}</tr>
        ${[['Negro',[0,8,12,9,4,0]],['Blanco',[3,11,14,7,2,0]],['Vino',[2,5,6,3,1,0]],['Camel',[1,4,7,5,2,0]]]
          .map(([c,v]:any)=>`<tr><td style="font-size:11px;font-weight:700;color:#0F172A;">${c}</td>${v.map((n:number)=>{
            const s = n===0?est.celdaZero:(n<=3?est.celdaLo:est.celdaOk);
            return `<td style="${s}border-radius:7px;height:30px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;">${n}</td>`;
          }).join('')}</tr>`).join('')}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#94A3B8;">Negro XS agotado · Vino XXL sin una sola venta</p>
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
          <span style="width:34px;font-size:11.5px;font-weight:800;color:#0F172A;">${t}</span>
          <div style="flex:1;height:22px;background:#F1F5F9;border-radius:6px;overflow:hidden;">
            <div style="width:${p*3.2}%;height:100%;background:linear-gradient(90deg,#3B82F6,#2563EB);"></div>
          </div>
          <span style="width:56px;text-align:right;font-size:11.5px;font-weight:700;color:#475569;">${n} pz · ${p}%</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">Curva calculada con la venta real de la temporada anterior</p>
    </div>`,
  },
  {
    id: 'consignacion',
    tag: 'Distribución',
    titulo: 'Lo que dejas en Liverpool, bajo control',
    texto:
      'Consigna, venta en firme o distribuidor: registras qué entregaste, el sistema te dice qué se vendió, qué recoges y cuánto te deben. Se acabó el Excel de cada tienda.',
    bullets: [
      'Entregas 40 vestidos a una boutique; sabes cuáles siguen colgados',
      'Liquidación por consignatario con su comisión ya descontada',
      'Lo consignado no se te vende dos veces: sale de tu inventario disponible',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Consignatarios · corte del mes</p>
      ${[['Liverpool Perisur','Departamental',48,31,'$62,000'],['Boutique Ana','Consigna',40,26,'$18,200'],['Distribuidora Norte','Venta en firme',120,120,'$91,400']]
        .map(([n,t,e,v,m]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${t} · entregadas ${e} · vendidas ${v}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:800;color:#065F46;font-variant-numeric:tabular-nums;">${m}</div>
            <div style="font-size:9.5px;color:#94A3B8;font-weight:700;">por liquidar</div>
          </div>
        </div>`).join('')}
    </div>`,
    testimonio: {
      cita:
        'Dejabamos producto en tres departamentales y cada corte era un pleito de Excel. Ahora se que se vendio y cuanto me deben sin llamar a nadie.',
      autor: 'Espacio para testimonial — marca con presencia en departamentales',
    },
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
      'Alerta de prenda que lleva más de 90 días sin moverse',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Inventario por temporada</p>
      ${[['PV 26 · actual',68,'#2563EB','$840,000'],['OI 25',22,'#F59E0B','$270,000'],['PV 25 · rezago',10,'#EF4444','$118,000']]
        .map(([n,p,c,m]:any)=>`<div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:5px;">
            <span>${n}</span><span style="font-variant-numeric:tabular-nums;">${m}</span></div>
          <div style="height:9px;background:#F1F5F9;border-radius:5px;overflow:hidden;">
            <div style="width:${p}%;height:100%;background:${c};"></div></div>
        </div>`).join('')}
      <p style="margin:6px 0 0;font-size:11px;color:#EF4444;font-weight:700;">$118,000 parados en colección de hace un año</p>
    </div>`,
  },
  {
    id: 'cambios',
    tag: 'Mostrador',
    titulo: '"No me quedó la talla"',
    texto:
      'La frase que más escuchas. El cambio se resuelve en segundos, sin ticket físico, aunque lo hayan comprado en otra sucursal y aunque hoy atienda otra vendedora.',
    bullets: [
      'Buscas por teléfono del cliente y aparece lo que se llevó',
      'Cambio de M a L del mismo modelo, con la diferencia si aplica',
      'Si no hay su talla aquí, ves en qué sucursal sí y la apartas',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cambio de talla · sin ticket</p>
      <div style="border:1px solid #EEF1F5;border-radius:11px;padding:12px;margin-bottom:10px;">
        <div style="font-size:11px;color:#94A3B8;font-weight:700;margin-bottom:6px;">SE LLEVÓ (12 mar · Sucursal Centro)</div>
        <div style="font-size:13px;font-weight:700;color:#0F172A;">Playera oversize negra
          <span style="background:#FEE2E2;color:#991B1B;border-radius:5px;padding:2px 7px;font-size:10.5px;margin-left:6px;">M</span></div>
      </div>
      <div style="text-align:center;color:#CBD5E1;font-size:16px;margin:2px 0 8px;">↓</div>
      <div style="border:1.5px solid #10B981;background:#F0FDF9;border-radius:11px;padding:12px;">
        <div style="font-size:11px;color:#047857;font-weight:700;margin-bottom:6px;">SE LLEVA HOY</div>
        <div style="font-size:13px;font-weight:700;color:#0F172A;">Playera oversize negra
          <span style="background:#D1FAE5;color:#065F46;border-radius:5px;padding:2px 7px;font-size:10.5px;margin-left:6px;">L</span></div>
        <div style="font-size:11px;color:#64748B;font-weight:600;margin-top:5px;">Sin diferencia a pagar · 4 disponibles</div>
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
      ${[['Centro','Esta tienda',0,true],['Satélite','Sucursal Norte',3,false],['Polanco','Sucursal Sur',5,false],['Bodega','Almacén central',12,false]]
        .map(([n,s,q,aqui]:any)=>`<div style="border:1px solid ${aqui?'#3B82F6':'#EEF1F5'};background:${aqui?'#F7FBFF':'#fff'};border-radius:11px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${s}</div>
          </div>
          <span style="font-size:14px;font-weight:800;color:${q>0?'#10B981':'#CBD5E1'};font-variant-numeric:tabular-nums;">${q}</span>
          ${aqui?'<span style="background:#3B82F6;color:#fff;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">AQUÍ</span>'
                :(q>0?'<span style="background:#ECFDF5;color:#047857;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">TOMAR</span>':'')}
        </div>`).join('')}
    </div>`,
    testimonio: {
      cita:
        'Antes le hablabamos por WhatsApp a la otra tienda para preguntar si habia la talla. Se perdian ventas nada mas por la flojera de preguntar.',
      autor: 'Espacio para testimonial — boutique con 4 sucursales',
    },
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
      ${[['Blusa satinada negra','$899','en el ticket'],['Pantalón sastre camel','$1,290','sugerido'],['Cinturón piel','$450','sugerido']]
        .map(([n,p,t]:any)=>`<div style="display:flex;align-items:center;gap:11px;border:1px solid #EEF1F5;border-radius:11px;padding:10px 12px;margin-bottom:7px;">
          <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#F1F5F9,#E2E8F0);"></div>
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
          <div style="font-size:10px;color:${t==='sugerido'?'#2563EB':'#94A3B8'};font-weight:700;">${t}</div></div>
          <span style="font-size:12.5px;font-weight:800;color:#0F172A;">${p}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed #E5E7EB;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;color:#047857;">Look completo −15%</span>
        <span style="font-size:14px;font-weight:800;color:#0F172A;">$2,241</span></div>
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
      ${[['Jean recto · M · Azul','se agota en 6 días','#EF4444','Pedir 24'],['Blusa satinada · S · Negro','se agota en 11 días','#F59E0B','Pedir 12'],['Saco lino · XL · Beige','sin venta en 90 días','#94A3B8','No pedir']]
        .map(([n,d,c,a]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
          <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${d}</div></div>
          <span style="font-size:11px;font-weight:800;color:${c==='#94A3B8'?'#94A3B8':'#2563EB'};">${a}</span>
        </div>`).join('')}
    </div>`,
    testimonio: {
      cita:
        'Comprabamos parejo de todas las tallas. Terminabamos con puras XXL colgadas y sin M, que es la que de verdad se vende.',
      autor: 'Espacio para testimonial — marca de moda femenina',
    },
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
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);display:flex;align-items:center;justify-content:center;font-weight:800;color:#2563EB;">MR</div>
        <div><div style="font-size:14px;font-weight:800;color:#0F172A;">Mariana R.</div>
        <div style="font-size:11px;color:#94A3B8;font-weight:600;">14 compras · $38,400 · desde 2024</div></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
        ${['Talla S','Negro','Camel','Blusas','Sastre'].map(t=>`<span style="background:#EFF6FF;color:#2563EB;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;">${t}</span>`).join('')}
      </div>
      <div style="background:#F0FDF9;border:1px solid #A7F3D0;border-radius:11px;padding:11px 13px;">
        <div style="font-size:11.5px;font-weight:800;color:#047857;">Llegó su talla</div>
        <div style="font-size:11.5px;color:#065F46;margin-top:3px;">3 prendas nuevas en S, negro. Avisar por WhatsApp.</div>
      </div>
    </div>`,
  },
];
