/**
 * Contenido de la Suite para Zapaterías.
 *
 * Lo que hace distinto a este giro y no se puede copiar de moda: la unidad de
 * venta es el PAR y el SKU real es MODELO × COLOR × NÚMERO — tres ejes, con
 * medios números. La horma NO es una variante: es propiedad del modelo, la
 * define el fabricante.
 *
 * Numeración mexicana, que es donde se nota si conoces el giro: dama 22–27,
 * caballero 25–30, infantil 14–21, juvenil 22–26. Nadie surte un modelo "del 22
 * al 30": eso cruza dos líneas.
 *
 * El dolor propio: la CORRIDA se rompe. Se venden los números de en medio y
 * quedan los extremos. Ojo con el término: un "par descabalado" es un par
 * disparejo; lo que se rompe aquí es la corrida o el modelo. En piso se dice
 * "ese modelo ya está roto" o "eso ya es saldo".
 *
 * Vocabulario que se usa a propósito: par, número (no "talla"), corrida cerrada,
 * surtido libre, medios números, saldo, saldero, quincena, SAPICA, cambio de
 * número, escolar.
 */
import type { RackPieza } from '../../components/suite/SuiteRack.astro';

/* ── Recorrido de funcionalidades ── */
const est = {
  wrap: 'font-family:Inter,system-ui,sans-serif;',
  h: 'font-size:11px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:#D1FAE5;color:#065F46;',
  lo: 'background:#FEF3C7;color:#92400E;',
  cero: 'background:#F8FAFC;color:#CBD5E1;',
};

export interface SuiteSeccion {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  bullets?: string[];
  visual: string;
  testimonio?: { cita: string; autor: string };
}

export const seccionesZapateria: SuiteSeccion[] = [
  {
    id: 'corrida',
    tag: 'Inventario',
    titulo: 'La corrida completa, número por número',
    texto:
      'Das de alta el modelo una vez y armas su corrida completa, con medios números. Dama del 22 al 27, caballero del 25 al 30, infantil del 14 al 21 — cada número con su propia existencia, y el color como tercer eje.',
    bullets: [
      'Botín dama del 22 al 27 con medios, en dos colores = 22 existencias de un solo modelo',
      'Ves que el 23½ y el 24 llevan dos semanas en cero mientras el 27 no se ha movido',
      'Y que ese modelo ya está roto: sin los números de en medio, lo que queda es saldo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Botín dama piel · pares por número</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:#64748B;width:58px;"></th>
        ${['22','22½','23','23½','24','24½','25','25½','26','26½','27'].map(t=>`<th style="font-size:9.5px;color:#64748B;font-weight:700;">${t}</th>`).join('')}</tr>
        ${[['Café',[1,2,0,0,0,0,3,4,3,2,2]],['Negro',[1,1,2,0,0,1,4,5,4,2,1]]]
          .map(([c,v]:any)=>`<tr><td style="font-size:11px;font-weight:700;color:#0F172A;">${c}</td>${v.map((n:number)=>{
            const s = n===0?est.cero:(n<=3?est.lo:est.ok);
            return `<td style="${s}border-radius:7px;height:30px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;">${n}</td>`;
          }).join('')}</tr>`).join('')}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#EF4444;font-weight:700;">Café: sin 23, 23½, 24 ni 24½ · quedan 17 pares que ya nadie pide</p>
    </div>`,
  },
  {
    id: 'descabalado',
    tag: 'Corrida rota',
    titulo: 'Lo que ya es saldo, aunque el reporte diga que hay inventario',
    texto:
      'El modelo se rompió: salieron los números de en medio y quedaron los extremos. Eso ya no se vende a precio — sale al saldero por menos de la mitad, sin importar el modelo. Con la existencia por número a la vista lo ves antes de que pase.',
    bullets: [
      'Existencia por número: los huecos de la corrida se ven en la cuadrícula',
      'Cuánto ya vendiste de lo que compraste, modelo por modelo',
      'Alertas de producto estancado y riesgo de quiebre (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Modelos con la corrida rota</p>
      ${[['Botín dama café','faltan 23 a 24½','17 pares','$21,930'],['Mocasín caballero negro','faltan 27 a 28½','11 pares','$13,090'],['Sandalia dama tan','faltan 23 y 23½','9 pares','$7,110']]
        .map(([n,f,p,m]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#EF4444;flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${f} · ${p}</div>
          </div>
          <span style="font-size:13px;font-weight:800;color:#B91C1C;font-variant-numeric:tabular-nums;">${m}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed #E5E7EB;margin-top:10px;padding-top:11px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:800;color:#0F172A;">Parado en modelos rotos</span>
        <span style="font-size:15px;font-weight:800;color:#B91C1C;">$42,130</span>
      </div>
    </div>`,
  },
  {
    id: 'compra',
    tag: 'Compras',
    titulo: 'Compra la curva de tu tienda, no la del proveedor',
    texto:
      'La corrida cerrada del proveedor viene 1-2-3-3-2-1 por docena, igual para todos. Tu tienda no vende así. Cuando te dan surtido libre, la pregunta es qué pedir — y ahí sirve tener tu venta por número a la mano.',
    bullets: [
      'Tu venta real por número, para pedir surtido libre con datos y no de memoria',
      'Cada sucursal con la suya: en el centro sale el 23½, en la del norte el 25',
      'Planificador de compra por número (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Surtido libre · 48 pares de dama</p>
      ${[['22',1,2],['22½',2,4],['23',5,10],['23½',7,15],['24',8,17],['24½',8,17],['25',7,15],['25½',5,10],['26',3,6],['26½',1,2],['27',1,2]]
        .map(([t,n,p]:any)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
          <span style="width:34px;font-size:11px;font-weight:800;color:#0F172A;">${t}</span>
          <div style="flex:1;height:18px;background:#F1F5F9;border-radius:5px;overflow:hidden;">
            <div style="width:${p*4}%;height:100%;background:linear-gradient(90deg,#3B82F6,#2563EB);"></div>
          </div>
          <span style="width:58px;text-align:right;font-size:11.5px;font-weight:700;color:#475569;">${n} pares</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">Tu venta real · del 23½ al 24½ sale la mitad de tus pares</p>
    </div>`,
  },
  {
    id: 'caja',
    tag: 'Mostrador',
    titulo: '“¿Me lo trae en el 24?”',
    texto:
      'La frase que define el día. No se trata de no caminar a la bodega: se trata de saber antes de caminar si el par existe, y si no, en qué tienda sí — sin dejar al cliente parado mientras alguien busca.',
    bullets: [
      'Sabes si existe antes de ir por él, y en qué sucursal está si aquí no',
      'Cambio de número en el mostrador, aunque lo haya comprado en otra tienda',
      'Apartado con abonos por quincena, sin que el par se le venda a nadie más',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Botín piel café · número 25</p>
      ${[['Esta tienda','Centro',0,true],['Sucursal Norte','a 20 min',2,false],['Sucursal Plaza','a 35 min',5,false],['Bodega','entrega mañana',9,false]]
        .map(([n,s,q,aqui]:any)=>`<div style="border:1px solid ${aqui?'#3B82F6':'#EEF1F5'};background:${aqui?'#F7FBFF':'#fff'};border-radius:11px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${s}</div>
          </div>
          <span style="font-size:14px;font-weight:800;color:${q>0?'#10B981':'#CBD5E1'};font-variant-numeric:tabular-nums;">${q}</span>
          ${aqui?'<span style="background:#3B82F6;color:#fff;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">AQUÍ</span>'
                :(q>0?'<span style="background:#ECFDF5;color:#047857;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">APARTAR</span>':'')}
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'escolar',
    tag: 'Temporada',
    titulo: 'Agosto se juega en dos quincenas',
    texto:
      'El ciclo arranca la última semana de agosto, así que la venta se concentra del 15 al 25 — con dos crestas: la quincena del 15 y la del 30. Si te quedas sin 19 el 18 de agosto, ese cliente compró en otra parte y no vuelve hasta el año que entra.',
    bullets: [
      'Reposición diaria por número mientras dura el pico',
      'El corte de qué sobró, para no repetir la compra el año siguiente',
      'Proyección con la venta de años anteriores (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Escolar infantil · agosto, día a día</p>
      <div style="display:flex;align-items:flex-end;gap:5px;height:110px;margin-bottom:12px;">
        ${[8,11,16,22,34,58,88,100,72,58,84,46].map((h,i)=>`<div style="flex:1;height:${h}%;border-radius:4px 4px 0 0;background:${h>70?'#2563EB':(h>35?'#7FA6F5':'#DBEAFE')};"></div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#94A3B8;font-weight:700;margin-bottom:12px;">
        <span>1 ago</span><span>pico: 15 al 25</span><span>31 ago</span>
      </div>
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:11px;padding:11px 13px;">
        <div style="font-size:11.5px;font-weight:800;color:#9A3412;">Repón el 18 y el 19 antes de la quincena</div>
        <div style="font-size:11.5px;color:#9A3412;margin-top:3px;">Al ritmo de hoy se acaban en 2 días, y falta la cresta del 30.</div>
      </div>
    </div>`,
  },
  {
    id: 'cambios',
    tag: 'Posventa',
    titulo: 'Le apretó el 26',
    texto:
      'El cambio de número es la operación posventa que más se repite, y después de Reyes no para. Se resuelve en el mostrador aunque el par lo hayan comprado en otra sucursal y aunque el cliente llegue sin ticket.',
    bullets: [
      'Buscas por teléfono del cliente y aparece el par que se llevó',
      'Cambio de 26 a 26½ del mismo modelo, con la diferencia si aplica',
      'Nota de crédito automática cuando no hay su número y prefiere el saldo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cambio de número · sin ticket</p>
      <div style="border:1px solid #EEF1F5;border-radius:11px;padding:12px;margin-bottom:10px;">
        <div style="font-size:11px;color:#94A3B8;font-weight:700;margin-bottom:6px;">SE LLEVÓ (3 ene · Sucursal Plaza)</div>
        <div style="font-size:13px;font-weight:700;color:#0F172A;">Botín dama café
          <span style="background:#FEE2E2;color:#991B1B;border-radius:5px;padding:2px 7px;font-size:10.5px;margin-left:6px;">26</span></div>
      </div>
      <div style="text-align:center;color:#CBD5E1;font-size:16px;margin:2px 0 8px;">↓</div>
      <div style="border:1.5px solid #10B981;background:#F0FDF9;border-radius:11px;padding:12px;">
        <div style="font-size:11px;color:#047857;font-weight:700;margin-bottom:6px;">SE LLEVA HOY (Sucursal Centro)</div>
        <div style="font-size:13px;font-weight:700;color:#0F172A;">Botín dama café
          <span style="background:#D1FAE5;color:#065F46;border-radius:5px;padding:2px 7px;font-size:10.5px;margin-left:6px;">26½</span></div>
        <div style="font-size:11px;color:#64748B;font-weight:600;margin-top:5px;">Sin diferencia a pagar · 3 pares disponibles</div>
      </div>
    </div>`,
  },
  {
    id: 'apartados',
    tag: 'Apartados',
    titulo: 'El par apartado que nadie liquidó',
    texto:
      'Aquí el apartado no es un anticipo: son cuatro abonos por quincena. Y el par que nadie terminó de pagar lleva más de dos meses fuera de venta — en su número bueno, el que sí se vendía.',
    bullets: [
      'Qué apartados se liquidan esta quincena y cuáles ya vencieron',
      'Recordatorio de pago automático por WhatsApp antes de que tú lo persigas (Fideliza)',
      'El par apartado no se le vende a nadie más, y el vencido regresa al piso',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Apartados · corte de la quincena</p>
      ${[['Ana M.','Botín dama 24½','$1,290','3 de 4 abonos','#047857','al corriente'],['Luis R.','Deportivo 27','$1,450','2 de 4 abonos','#B45309','vence el 15'],['Carmen T.','Zapatilla 23','$980','1 de 4 abonos','#B91C1C','vencido · 68 días']]
        .map(([c,q,m,a,col,e]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${c} · ${q}</div>
              <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${a}</div>
            </div>
            <span style="font-size:13px;font-weight:800;color:#0F172A;font-variant-numeric:tabular-nums;">${m}</span>
          </div>
          <div style="margin-top:7px;font-size:10.5px;font-weight:800;color:${col};">${e}</div>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">El vencido regresa al piso solo · su 23 vuelve a estar en venta</p>
    </div>`,
  },
  {
    id: 'remesas',
    tag: 'Compra de temporada',
    titulo: 'El pedido de SAPICA llega en tres remesas',
    texto:
      'La compra se cierra seis meses antes y llega por partes. A media temporada nadie sabe qué números ya entraron, qué sigue debiendo el proveedor y cuánto se le debe por lo que sí llegó.',
    bullets: [
      'Orden de compra por número, no por modelo suelto',
      'Recepción contra la orden: lo que llegó, lo que falta y lo que no pediste',
      'Cuentas por pagar por remesa recibida, con su complemento de pago',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Orden 1042 · proveedor de León</p>
      ${[['1ª remesa','12 jun','recibida','96 de 96 pares','#047857'],['2ª remesa','28 jun','recibida','72 de 84 pares','#B45309'],['3ª remesa','pendiente','sin fecha','0 de 60 pares','#B91C1C']]
        .map(([r,f,e,p,col]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${r} · ${f}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${p}</div>
          </div>
          <span style="font-size:11px;font-weight:800;color:${col};">${e}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed #E5E7EB;margin-top:10px;padding-top:11px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;color:#0F172A;">Te debe 72 pares · le debes</span>
        <span style="font-size:14px;font-weight:800;color:#0F172A;">$118,400</span>
      </div>
    </div>`,
  },
  {
    id: 'complemento',
    tag: 'Ticket promedio',
    titulo: 'El par ya está vendido; el ticket no',
    texto:
      'Lo que sube el ticket es lo que va con el par: calcetín, plantilla, agujeta, grasa. El sistema se lo pone al vendedor en la pantalla de cobro, cuando el cliente ya dijo que sí.',
    bullets: [
      'Sugerencia automática al cobrar el par (Fideliza)',
      'Promociones combinadas: par + calcetín + plantilla',
      'Y el reporte de qué combinaciones sí levantan el ticket',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Sugerido al cobrar</p>
      ${[['Botín dama café · 24½','$1,290','en el ticket','#94A3B8'],['Calcetín invisible · 3 pzas','$120','sugerido','#2563EB'],['Plantilla de gel','$180','sugerido','#2563EB'],['Impermeabilizante','$140','sugerido','#2563EB']]
        .map(([n,p,t,c]:any)=>`<div style="display:flex;align-items:center;gap:11px;border:1px solid ${t==='sugerido'?'#DBE7FB':'#EEF1F5'};background:${t==='sugerido'?'#FAFCFF':'#fff'};border-radius:11px;padding:10px 12px;margin-bottom:7px;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
          <div style="font-size:10px;color:${c};font-weight:700;">${t==='sugerido'?'+ SUGERIDO':'EN EL TICKET'}</div></div>
          <span style="font-size:12.5px;font-weight:800;color:#0F172A;">${p}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed #E5E7EB;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;color:#047857;">Ticket del par solo: $1,290 · con complementos: $1,730</span>
      </div>
    </div>`,
  },
  {
    id: 'sucursales',
    tag: 'Multisucursal',
    titulo: 'Un par en la otra tienda vale más que en remate',
    texto:
      'Antes de mandar un modelo roto al saldero, revisa si la otra sucursal necesita justo esos números. Mover un par cuesta un traspaso; saldarlo cuesta la mitad del precio o más.',
    bullets: [
      'Ves qué números le faltan a cada tienda y quién los tiene de sobra',
      'Nivelación entre tiendas para completar corridas en vez de saldar (en Automatiza)',
      'Cada sucursal con su existencia real, descontando lo apartado',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Traspaso sugerido · esta semana</p>
      ${[['Centro → Norte','Botín café 26, 27','4 pares','completa corrida'],['Norte → Centro','Mocasín caballero 26, 26½','3 pares','completa corrida'],['Plaza → Centro','Sandalia tan 23','2 pares','se vende 3× más rápido']]
        .map(([r,q,p,m]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#0F172A;">${r}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${q}</div></div>
            <span style="font-size:12px;font-weight:800;color:#2563EB;">${p}</span>
          </div>
          <div style="margin-top:7px;font-size:10.5px;color:#047857;font-weight:700;">${m}</div>
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'omnicanal',
    tag: 'Omnicanalidad',
    titulo: 'Un solo inventario: piso, en línea y WhatsApp',
    texto:
      'El calzado se compra mirando y se confirma preguntando. Tu tienda en línea, tu WhatsApp y tu mostrador tienen que ver el mismo par disponible, o vendes dos veces el último 25.',
    bullets: [
      'Se va el último 25 en el mostrador y sale del ecommerce en el momento',
      'Compra en línea y recoge en tienda, o se lo mandas desde la sucursal que lo tiene',
      'TikTok Shop, Facebook, Instagram y tu tienda, con el mismo catálogo por número',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Botín piel café · número 25 · hoy</p>
      ${[['Piso de venta','Sucursal Centro',6,'#2563EB'],['Tienda en línea','Tu ecommerce',3,'#7C3AED'],['Redes','TikTok Shop · Instagram',2,'#EA580C'],['WhatsApp','Catálogo y chat',1,'#059669']]
        .map(([n,s,q,c]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:11px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${s}</div>
          </div>
          <span style="font-size:13px;font-weight:800;color:#0F172A;font-variant-numeric:tabular-nums;">${q} pares</span>
        </div>`).join('')}
      <div style="border:1.5px solid #3B82F6;background:#F7FBFF;border-radius:11px;padding:11px 13px;margin-top:11px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="font-size:11.5px;font-weight:800;color:#1D4ED8;">Existencia única · los 4 canales</span>
        <span style="font-size:15px;font-weight:800;color:#0F172A;">12</span>
      </div>
    </div>`,
  },
  {
    id: 'clientes',
    tag: 'Fidelización',
    titulo: 'Sabes qué número calza cada cliente',
    texto:
      'En calzado el número no cambia. Saber que tu cliente usa 26 y compra botín cada temporada vale más que cualquier campaña masiva: le avisas cuando entra su número, no cuando entra la colección.',
    bullets: [
      'Ficha con su número, su horma y las marcas que se lleva',
      'Aviso por WhatsApp cuando entra su número, con campañas segmentadas (Fideliza) o disparado solo (Automatiza)',
      'Y la familia completa: los números de los niños, que cambian cada año',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Ficha de cliente</p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);display:flex;align-items:center;justify-content:center;font-weight:800;color:#2563EB;">JC</div>
        <div><div style="font-size:14px;font-weight:800;color:#0F172A;">Jorge C.</div>
        <div style="font-size:11px;color:#94A3B8;font-weight:600;">9 compras · $21,300 · desde 2023</div></div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;">
        ${['Número 26','Horma ancha','Piel','Casual','2 hijos'].map(t=>`<span style="background:#EFF6FF;color:#2563EB;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;">${t}</span>`).join('')}
      </div>
      <div style="background:#F0FDF9;border:1px solid #A7F3D0;border-radius:11px;padding:11px 13px;">
        <div style="font-size:11.5px;font-weight:800;color:#047857;">Llegó su número</div>
        <div style="font-size:11.5px;color:#065F46;margin-top:3px;">Botín café en 26, horma ancha. Y el escolar del niño ya le queda chico.</div>
      </div>
    </div>`,
  },
  {
    id: 'agentes',
    tag: 'Agentes de IA',
    titulo: 'Agentes de IA que tú programas',
    texto:
      'Van en el plan Automatiza. Tú defines qué vigila cada agente y hasta dónde puede actuar: avisar cuando un modelo se está descabalando, contestar el WhatsApp de quien pregunta por un número, o armar el pedido de temporada.',
    bullets: [
      'La instrucción se escribe en español; no hay que programar nada (en Automatiza)',
      'Trabajan sobre tus datos: tus corridas, tu venta por número, tus clientes',
      'Tú decides si el agente solo te avisa o si ya ejecuta',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Tus agentes · activos</p>
      ${[
        ['Vigía de corridas','Cada mañana, 8:00','Avisa','Botín café: si se va el 25, el modelo se rompe'],
        ['Asesor de WhatsApp','En cuanto escriben','Ejecuta','Respondió 31 mensajes · 9 apartados creados'],
        ['Comprador de temporada','Lunes, 9:00','Solo propone','Corrida escolar sugerida, lista para tu OK'],
      ].map(([n,c,m,r]:any)=>`<div style="border:1px solid #EEF1F5;border-radius:12px;padding:12px 13px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
          <span style="width:26px;height:26px;border-radius:8px;background:#EFF6FF;color:#2563EB;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">IA</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#0F172A;">${n}</div>
            <div style="font-size:10.5px;color:#94A3B8;font-weight:600;">${c}</div>
          </div>
          <span style="background:${m==='Ejecuta'?'#ECFDF5':'#EFF6FF'};color:${m==='Ejecuta'?'#047857':'#2563EB'};border-radius:999px;padding:3px 9px;font-size:9.5px;font-weight:800;white-space:nowrap;">${m}</span>
        </div>
        <div style="font-size:11px;color:#475569;font-weight:600;line-height:1.45;">${r}</div>
      </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">Los configuras tú, con tus reglas y tus límites</p>
    </div>`,
  },
];

/* ── Perchero: aquí son pares por número y horma ── */
export const rackZapateria: RackPieza[] = [
  { n: 'Botín piel', img: '/images/rack-zap-bota.webp', tallas: 9, colores: 2 },
  { n: 'Tenis casual', img: '/images/rack-zap-tenis.webp', tallas: 10, colores: 3 },
  { n: 'Mocasín caballero', img: '/images/rack-zap-mocasin.webp', tallas: 8, colores: 2 },
  { n: 'Sandalia dama', img: '/images/rack-zap-sandalia.webp', tallas: 7, colores: 4 },
  { n: 'Tacón vestir', img: '/images/rack-zap-tacon.webp', tallas: 7, colores: 3 },
  { n: 'Escolar niño', img: '/images/rack-zap-escolar.webp', tallas: 11, colores: 1 },
];

export const cortinaZapateria = {
  eyebrow: 'La misma pregunta, dos veces',
  titulo: '“¿Me lo trae en el 25?”',
  sub: 'Arrastra la línea. A la izquierda, cómo se responde hoy. A la derecha, sin ir a la bodega.',
  fotoAntes: '/images/suite-zap-hoy.webp',
  fotoDespues: '/images/suite-zap-resuelto.webp',
  altAntes: 'Vendedor buscando entre cajas el número que le piden',
  altDespues: 'Vendedor atendiendo tranquilo con el sistema en la tablet',
  libreta: ['Botín café 25 — ¿queda?', '¿pedir a Norte?'],
  pieAntes: 'Diez minutos entre cajas<br />y el cliente se fue.',
  filas: [
    { que: 'Botín piel café · 25', donde: 'Norte', dato: '2' },
    { que: 'Mocasín negro · 27', donde: 'Centro', dato: '5' },
    { que: 'Escolar negro · 23', donde: 'Bodega', dato: '14' },
  ],
  pieDespues: 'Sabes si existe antes de caminar.',
};

export const sucursalesZapateria = [
  { nombre: 'Centro', venta: '$418,900', llena: 100, ticket: '$1,240', margen: '38%', delta: '+7%' },
  { nombre: 'Plaza Norte', venta: '$352,100', llena: 84, ticket: '$1,410', margen: '41%', delta: '+3%' },
  { nombre: 'Galerías', venta: '$298,400', llena: 71, ticket: '$1,180', margen: '36%', delta: '+1%' },
  {
    nombre: 'Sur', venta: '$164,200', llena: 39, ticket: '$720', margen: '27%', delta: '−15%',
    alerta: true,
    nota: 'Se está vaciando de números medios: el 23½ y el 24 llevan tres semanas en cero, y lo que queda sale con descuento — por eso el margen cayó a 27%.',
  },
];

export const reglasZapateria = [
  { si: 'El descuento pasa de 15%', entonces: 'pide tu autorización', detalle: 'En calzado el remate es la salida fácil: si cualquiera puede darlo, el margen se va sin que nadie lo decida.' },
  { si: 'Se cancela una venta ya cobrada', entonces: 'queda firmada', detalle: 'Quién, cuándo y por qué. Con apartados y anticipos de por medio, es donde más se pierde el rastro.' },
  { si: 'El corte de caja no cuadra', entonces: 'no cierra', detalle: 'El faltante se registra a nombre de quien cerró, y tú lo ves el mismo día — no a fin de mes.' },
];

export const diasZapateria = [
  { dia: 'Día 1', titulo: 'Tus corridas, cargadas', detalle: 'Nos das tu archivo o tu base actual y lo subimos nosotros: modelo, color, número y existencia, con medios.' },
  { dia: 'Día 2', titulo: 'Tu operación, configurada', detalle: 'Sucursales, bodega, cajas, usuarios, permisos y formas de pago quedan como ya trabajas.' },
  { dia: 'Día 3', titulo: 'Capacitación', detalle: 'Dos horas con tu equipo. Cobrar y consultar un número se aprende en veinte minutos.' },
  { dia: 'Día 4', titulo: 'Arranca una tienda', detalle: 'La primera sucursal vende con SACS. El sistema viejo sigue en pie por si acaso.' },
  { dia: 'Día 5', titulo: 'Arrancan las demás', detalle: 'Con la primera resuelta, las otras entran el mismo día. Tu histórico se conserva y se consulta.' },
];

export const cajaZapateria = {
  lineas: [
    { n: 'Botín dama café · 24½', p: '$1,290.00' },
    { n: 'Escolar infantil · 19', p: '$650.00' },
  ],
  total: '$1,940.00',
};

/* ── Expediente: los dos caminos, con documentos de zapatería ── */
export const documentosZapateria = {
  titulo: 'Ya lo intentaste<br />de las dos formas.',
  entrada:
    'Casi toda zapatería que llega con nosotros trae uno de estos dos documentos en el cajón. Ninguno de los dos fue una tontería. Los dos fallan — por motivos distintos.',
  doc1: {
    membrete: 'Sistema genérico',
    sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'ART-2210', b: 'BOTÍN PIEL CAFÉ', c: '17' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿de qué números?', '¿sirve para vender?'],
    sello: 'NO APLICA<br />A CALZADO',
    notas: [
      'Diecisiete pares en una fila. <b>No dice de qué números</b>, que es lo único que importa.',
      'Para saber si hay 25 alguien camina a la bodega y <b>cuenta cajas a mano</b>.',
      'Te dice cuánto vendiste, <b>no qué modelos se te rompieron</b>.',
      'Abres la segunda tienda y empiezas de cero.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida',
    sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'ENTREGA COMPROMETIDA', b: '3 MESES' },
      { a: 'ENTREGA REAL', b: '9 MESES', tachado: true },
      { a: 'SOPORTE VIGENTE', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'no contesta'],
    sello: 'SIN<br />SOPORTE',
    notas: [
      'Costó <b>más de lo cotizado</b> y llegó pasada la temporada escolar.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>.',
      'Cada cambio chico es <b>una cotización nueva</b>.',
      'No trae app, ni tienda en línea, ni quién lo actualice. El día que falla, <b>para la tienda</b>.',
    ],
  },
  filas: [
    { que: 'Corrida completa por número', generico: 'No existe', tonoGenerico: 'no', medida: 'Si la pagaste', tonoMedida: 'medio', sacs: 'Incluida' },
    { que: 'Existencia y rotación por número', generico: 'No existe', tonoGenerico: 'no', medida: 'No existe', tonoMedida: 'no', sacs: 'Incluida' },
    { que: 'Curva de compra por sucursal', generico: 'No existe', tonoGenerico: 'no', medida: 'Casi nunca', tonoMedida: 'no', sacs: 'Incluida' },
    { que: 'Un inventario para piso, línea y WhatsApp', generico: 'A medias', tonoGenerico: 'medio', medida: 'Rara vez', tonoMedida: 'no', sacs: 'Uno solo' },
    { que: 'Agentes de IA que tú programas', generico: 'No existe', tonoGenerico: 'no', medida: 'No existe', tonoMedida: 'no', sacs: 'En Automatiza' },
    { que: 'Tiempo para arrancar', generico: 'Días', tonoGenerico: 'ok', medida: '4 a 9 meses', tonoMedida: 'no', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', tonoGenerico: 'medio', medida: 'Tú, si lo encuentras', tonoMedida: 'no', sacs: 'Nosotros, a diario' },
  ],
};

/* ── Momentos reales del giro, con su escena ──
   Sustituye al perchero de producto: aquí no importa qué vendes, importa
   cuándo te sirve el sistema. Cada caso es una hora concreta de un día
   concreto, no una funcionalidad. */
export const casosZapateria = [
  {
    id: 'mostrador',
    titulo: 'Sábado, 1 p.m.: te piden el 24 y hay tres personas esperando',
    texto:
      'El vendedor consulta desde el mostrador si ese número existe, sin caminar a la bodega ni dejar al cliente parado. Si aquí no está, ve en qué sucursal sí y lo aparta en el momento.',
    remate: 'Saber antes de caminar es lo que evita la venta perdida, no caminar más rápido.',
    img: '/images/caso-zap-mostrador.webp',
    alt: 'Vendedor consultando en una tablet mientras atiende a una clienta con un botín en la mano',
  },
  {
    id: 'conteo',
    titulo: 'Contar la bodega sin cerrar la tienda',
    texto:
      'El conteo se hace desde el celular, por estante y en cualquier momento, mientras la tienda vende. Los conteos cíclicos se programan y lo que no cuadra queda con nombre y fecha.',
    remate: 'En calzado el faltante casi nunca es un robo: es un par que quedó en otra caja.',
    img: '/images/caso-zap-conteo.webp',
    alt: 'Empleada contando cajas de zapatos en la bodega con el celular en la mano',
  },
  {
    id: 'recepcion',
    titulo: 'Llegó la segunda remesa y trae menos de lo que dice la factura',
    texto:
      'La recepción se hace contra la orden de compra, par por par y número por número. Lo que llegó de más, lo que falta y lo que no pediste queda a la vista antes de firmar.',
    remate: 'El proveedor de León manda en tres remesas: sin esto, a media temporada nadie sabe qué falta.',
    img: '/images/caso-zap-recepcion.webp',
    alt: 'Dos empleados recibiendo una caja de zapatos y verificando contra una tablet',
  },
  {
    id: 'escolar',
    titulo: 'Del 15 al 25 de agosto se juega el año',
    texto:
      'Durante el pico escolar el número se agota en horas. La reposición diaria por número te dice qué pedir hoy para no quedarte sin el 19 el día de la quincena.',
    remate: 'Si el cliente no encuentra el número, compra en otra parte y no vuelve hasta el año que entra.',
    img: '/images/caso-zap-escolar.webp',
    alt: 'Madre e hijo probándose calzado escolar con la ayuda de una vendedora',
  },
];
