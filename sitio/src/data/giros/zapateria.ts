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

/* ── Recorrido de funcionalidades ── */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
  cero: 'background:var(--color-bg-primary);color:#D4D4D4;',
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
      'Los medios números no son un detalle: el 23½ vende igual que el 24 y se agota igual de rápido',
      'Ves que el 23½ y el 24 llevan dos semanas en cero mientras el 27 no se ha movido',
      'Y que ese modelo ya está roto: sin los números de en medio, lo que queda es saldo',
      'El conteo se hace por número y por caja cerrada, desde el celular y sin cerrar la tienda',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Botín dama piel · pares por número</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:var(--color-text-tertiary);width:58px;"></th>
        ${['22','22½','23','23½','24','24½','25','25½','26','26½','27'].map(t=>`<th style="font-size:9.5px;color:var(--color-text-tertiary);font-weight:700;">${t}</th>`).join('')}</tr>
        ${[['Café',[1,2,0,0,0,0,3,4,3,2,2]],['Negro',[1,1,2,0,0,1,4,5,4,2,1]]]
          .map(([c,v]:any)=>`<tr><td style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${c}</td>${v.map((n:number)=>{
            const s = n===0?est.cero:(n<=3?est.lo:est.ok);
            return `<td style="${s}border-radius:8px;height:30px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;">${n}</td>`;
          }).join('')}</tr>`).join('')}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:var(--alerta-texto);font-weight:700;">Café: sin 23, 23½, 24 ni 24½ · quedan 17 pares que ya nadie pide</p>
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
      'Cuánto llevas vendido de lo que compraste, modelo por modelo',
      'Aviso del modelo que se quedó parado y del que está por quedarse sin números (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Modelos con la corrida rota</p>
      ${[['Botín dama café','faltan 23 a 24½','17 pares','$10,200'],['Mocasín caballero negro','faltan 27 a 28½','11 pares','$7,040'],['Sandalia dama tan','faltan 23 y 23½','9 pares','$3,870']]
        .map(([n,f,p,m]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:var(--alerta-texto);flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${f} · ${p}</div>
          </div>
          <span style="font-size:13px;font-weight:800;color:var(--alerta-texto);font-variant-numeric:tabular-nums;">${m}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed var(--color-border-light);margin-top:10px;padding-top:11px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:800;color:var(--color-text-primary);">Parado en modelos rotos, a costo</span>
        <span style="font-size:15px;font-weight:800;color:var(--alerta-texto);">$21,110</span>
      </div>
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
      ${[['Esta tienda','Centro',0,true],['Plaza Norte','a 20 min',2,false],['Galerías','a 35 min',5,false],['Bodega central','entrega mañana',9,false]]
        .map(([n,s,q,aqui]:any)=>`<div style="border:1px solid ${aqui?'var(--color-primary)':'var(--color-border-light)'};background:${aqui?'var(--azul-fondo)':'#fff'};border-radius:8px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${s}</div>
          </div>
          <span style="font-size:14px;font-weight:800;color:${q>0?'var(--ok-texto)':'#D4D4D4'};font-variant-numeric:tabular-nums;">${q}</span>
          ${aqui?'<span style="background:var(--color-primary);color:#fff;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">AQUÍ</span>'
                :(q>0?'<span style="background:var(--ok-fondo);color:var(--ok-texto);border-radius:999px;padding:2px 8px;font-size:9px;font-weight:800;">APARTAR</span>':'')}
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'escolar',
    tag: 'Temporada',
    titulo: 'Agosto se juega en dos quincenas',
    texto:
      'El ciclo arranca la última semana de agosto, así que la venta se concentra del 15 al 30 — con dos crestas, la quincena del 15 y la del 30. Si te quedas sin 19 el 18 de agosto, ese cliente compró en otra parte. Y hay segunda vuelta en enero, cuando el zapato se rompe a medio ciclo escolar.',
    bullets: [
      'Reposición diaria por número mientras dura el pico',
      'El corte de qué sobró, para no repetir la compra el año siguiente',
      'Proyección con la venta de años anteriores (en Automatiza)',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Escolar infantil · agosto, día a día</p>
      <div style="display:flex;align-items:flex-end;gap:5px;height:110px;margin-bottom:12px;">
        ${[8,11,16,22,34,58,88,100,72,58,84,46].map((h,i)=>`<div style="flex:1;height:${h}%;border-radius:8px 8px 0 0;background:${h>70?'var(--color-primary)':(h>35?'#7FA6F5':'var(--azul-fondo)')};"></div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--color-text-tertiary);font-weight:700;margin-bottom:12px;">
        <span>1 ago</span><span>pico: 15 al 30</span><span>31 ago</span>
      </div>
      <div style="background:var(--aviso-fondo);border:1px solid var(--aviso-borde);border-radius:8px;padding:11px 13px;">
        <div style="font-size:11.5px;font-weight:800;color:var(--aviso-texto);">Repón el 18 y el 19 antes de la quincena</div>
        <div style="font-size:11.5px;color:var(--aviso-texto);margin-top:3px;">Al ritmo de hoy se acaban en 2 días, y falta la cresta del 30.</div>
      </div>
    </div>`,
  },
  {
    id: 'cambios',
    tag: 'Posventa',
    titulo: 'Le apretó el 26',
    texto:
      'El cambio de número es la operación posventa que más se repite, y después de Reyes no para. Se resuelve en el mostrador aunque el par lo hayan comprado en otra sucursal, y desde el plan Fideliza también cuando el cliente llega sin ticket.',
    bullets: [
      'Buscas por teléfono del cliente y aparece el par que se llevó',
      'Cambio de 26 a 26½ del mismo modelo, con la diferencia si aplica',
      'Vale a favor por el importe, para cuando entre su número',
      'El par que regresa despegado queda ligado a su marca y a su embarque, para el cargo al proveedor',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cambio de número · sin ticket</p>
      <div style="border:1px solid var(--color-border-light);border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-size:11px;color:var(--color-text-tertiary);font-weight:700;margin-bottom:6px;">SE LLEVÓ (3 ene · Galerías)</div>
        <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);">Botín dama café
          <span style="background:var(--alerta-fondo);color:var(--alerta-texto);border-radius:8px;padding:2px 7px;font-size:10.5px;margin-left:6px;">26</span></div>
      </div>
      <div style="text-align:center;color:#D4D4D4;font-size:16px;margin:2px 0 8px;">↓</div>
      <div style="border:1.5px solid var(--ok-texto);background:var(--ok-fondo);border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:var(--ok-texto);font-weight:700;margin-bottom:6px;">SE LLEVA HOY (Sucursal Centro)</div>
        <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);">Botín dama café
          <span style="background:var(--ok-fondo);color:var(--ok-texto);border-radius:8px;padding:2px 7px;font-size:10.5px;margin-left:6px;">26½</span></div>
        <div style="font-size:11px;color:var(--color-text-tertiary);font-weight:600;margin-top:5px;">Sin diferencia a pagar · 3 pares disponibles</div>
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
      ${[['Ana M.','Botín dama 24½','$1,290','3 de 4 abonos','var(--ok-texto)','al corriente'],['Luis R.','Deportivo 27','$1,450','2 de 4 abonos','var(--aviso-texto)','vence el 15'],['Carmen T.','Zapatilla 23','$980','1 de 4 abonos','var(--alerta-texto)','vencido · 68 días']]
        .map(([c,q,m,a,col,e]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${c} · ${q}</div>
              <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${a}</div>
            </div>
            <span style="font-size:13px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">${m}</span>
          </div>
          <div style="margin-top:7px;font-size:10.5px;font-weight:800;color:${col};">${e}</div>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">El vencido lo liberas de un clic · el par vuelve al piso y su abono queda en vale</p>
    </div>`,
  },
  {
    id: 'embarques',
    tag: 'Compra de temporada',
    titulo: 'El pedido de SAPICA llega en tres embarques',
    texto:
      'La compra se cierra seis meses antes y llega por partes. A media temporada nadie sabe qué números ya entraron, qué sigue debiendo el proveedor y cuánto se le debe por lo que sí llegó.',
    bullets: [
      'Orden de compra por número, no por modelo suelto',
      'Recepción contra la orden: lo que llegó, lo que falta y lo que no pediste',
      'Cuentas por pagar por embarque recibido, con su complemento de pago',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Orden 1042 · proveedor de León</p>
      ${[['1er embarque','12 jun','recibido','96 de 96 pares','var(--ok-texto)'],['2º embarque','28 jun','recibido','72 de 84 pares','var(--aviso-texto)'],['3er embarque','pendiente','sin fecha','0 de 60 pares','var(--alerta-texto)']]
        .map(([r,f,e,p,col]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:8px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${r} · ${f}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${p}</div>
          </div>
          <span style="font-size:11px;font-weight:800;color:${col};">${e}</span>
        </div>`).join('')}
      <div style="border-top:1px dashed var(--color-border-light);margin-top:10px;padding-top:11px;display:flex;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">Te debe 72 pares · le debes</span>
        <span style="font-size:14px;font-weight:800;color:var(--color-text-primary);">$118,400</span>
      </div>
    </div>`,
  },
  {
    id: 'marca',
    tag: 'Marca y proveedor',
    titulo: '"¿Cómo me fue con mi marca principal este mes?"',
    texto:
      'Es la primera pregunta del dueño y casi ningún sistema la contesta. Cada modelo carga su marca y su proveedor, así que la venta, el margen y el desplazamiento se leen por marca — y la junta de compra deja de ser de memoria.',
    bullets: [
      'Venta y margen por marca, por tienda y por temporada — y cuánto llevas vendido de lo que compraste (en Automatiza)',
      'Qué marca te deja el margen y cuál solo te deja inventario',
      'Cuánto le compras a cada proveedor al año, para negociar con el dato en la mano',
      'Y cuántos pares te regresa cada marca por defecto: la que te deja 47% y te devuelve tres de cada cien no te deja 47%',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Tus marcas principales · agosto</p>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="color:var(--color-text-tertiary);font-weight:700;text-align:left;">
          <th style="padding:0 0 7px;font-weight:700;">Marca</th>
          <th style="padding:0 0 7px;text-align:right;font-weight:700;">Venta</th>
          <th style="padding:0 0 7px;text-align:right;font-weight:700;">Margen</th>
          <th style="padding:0 0 7px;text-align:right;font-weight:700;">Desplazamiento</th>
        </tr>
        ${[['Marca principal','$214,800','47%',82,'var(--ok-texto)'],['Segunda marca','$168,300','44%',71,'var(--ok-texto)'],['Marca de entrada','$96,400','41%',48,'var(--aviso-texto)'],['Marca propia','$52,100','58%',31,'var(--alerta-texto)'],['Otras marcas','$702,000','43%',64,'var(--ok-texto)']]
          .map(([m,v,g,d,c]:any)=>`<tr style="border-top:1px solid var(--color-border-light);">
            <td style="padding:9px 0;font-weight:700;color:var(--color-text-primary);">${m}</td>
            <td style="padding:9px 0;text-align:right;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${v}</td>
            <td style="padding:9px 0;text-align:right;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${g}</td>
            <td style="padding:9px 0;text-align:right;">
              <span style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end;">
                <span style="display:inline-block;width:52px;height:5px;border-radius:8px;background:var(--color-border-light);overflow:hidden;">
                  <span style="display:block;width:${d}%;height:100%;background:${c};"></span>
                </span>
                <b style="color:${c};font-variant-numeric:tabular-nums;">${d}%</b>
              </span>
            </td>
          </tr>`).join('')}
      </table>
      <div style="border-top:1px dashed var(--color-border-light);margin-top:12px;padding-top:11px;">
        <p style="${est.h}">Y por proveedor</p>
        ${[['León · Calzado Mtz','3 marcas','$1.4M al año'],['Guanajuato · Distribuidora RG','2 marcas','$610K al año']]
          .map(([n,m,v]:any)=>`<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;margin-bottom:6px;">
            <span style="flex:1;font-weight:700;color:var(--color-text-primary);">${n}</span>
            <span style="color:var(--color-text-tertiary);font-weight:600;">${m}</span>
            <b style="color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${v}</b>
          </div>`).join('')}
      </div>
      <p style="margin:11px 0 0;font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">Desplazamiento: de cada 100 pares que compré de la temporada, cuántos ya vendí.</p>
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
      'Se lo mandas desde la sucursal que sí tiene su número, sin que él sepa de cuál salió',
      'TikTok Shop, Facebook, Instagram y tu tienda, con el mismo catálogo por número',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Botín piel café · número 25 · hoy</p>
      ${[['Piso de venta','Sucursal Centro',12,'var(--color-primary)'],['Tienda en línea','Tu ecommerce',12,'#8B7BE5'],['Redes','TikTok Shop · Instagram',12,'var(--color-accent)'],['WhatsApp','Catálogo y chat',12,'var(--ok-texto)']]
        .map(([n,s,q,c]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${s}</div>
          </div>
          <span style="font-size:13px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">ve ${q} pares</span>
        </div>`).join('')}
      <div style="border:1.5px solid var(--color-primary);background:var(--azul-fondo);border-radius:8px;padding:11px 13px;margin-top:11px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="font-size:11.5px;font-weight:800;color:var(--color-primary);">El mismo 12 · no cuatro inventarios</span>
        <span style="font-size:15px;font-weight:800;color:var(--color-text-primary);">12</span>
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
      'Tú decides si el agente te avisa, si responde o si solo te propone',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Tus agentes · activos</p>
      ${[
        ['Vigía de corridas','Cada mañana, 8:00','Avisa','Botín café: si se va el 25, el modelo se rompe'],
        ['Asesor de WhatsApp','En cuanto escriben','Responde','Dice si hay el número y en qué sucursal está'],
        ['Comprador de temporada','Lunes, 9:00','Solo propone','Corrida escolar sugerida, lista para tu OK'],
      ].map(([n,c,m,r]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:8px;padding:12px 13px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
          <span style="width:26px;height:26px;border-radius:8px;background:var(--azul-fondo);color:var(--color-primary);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">IA</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
            <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${c}</div>
          </div>
          <span style="background:var(--azul-fondo);color:var(--color-primary);border-radius:999px;padding:3px 9px;font-size:9.5px;font-weight:800;white-space:nowrap;">${m}</span>
        </div>
        <div style="font-size:11px;color:var(--color-text-secondary);font-weight:600;line-height:1.45;">${r}</div>
      </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Los configuras tú, con tus reglas y tus límites</p>
    </div>`,
  },
];

/* ── Perchero: aquí son pares por número y horma ── */
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
    { que: 'Botín piel café · 25', donde: 'Plaza Norte', dato: '2' },
    { que: 'Mocasín negro · 27', donde: 'Centro', dato: '5' },
    { que: 'Escolar negro · 23', donde: 'Bodega central', dato: '14' },
  ],
  pieDespues: 'Sabes si existe antes de caminar.',
};

export const sucursalesZapateria = [
  { nombre: 'Centro', venta: '$418,900', llena: 100, ticket: '$1,240', margen: '46%', inventario: '3.1 meses', delta: '+7%' },
  { nombre: 'Plaza Norte', venta: '$352,100', llena: 84, ticket: '$1,410', margen: '48%', inventario: '3.6 meses', delta: '+3%' },
  { nombre: 'Galerías', venta: '$298,400', llena: 71, ticket: '$1,180', margen: '44%', inventario: '4.2 meses', delta: '+1%' },
  {
    nombre: 'Sur', venta: '$164,200', llena: 39, ticket: '$720', margen: '27%', inventario: '6.8 meses', delta: '−15%',
    alerta: true,
    nota: 'Se está vaciando de números medios: el 23½ y el 24 llevan tres semanas en cero, y lo que queda sale con descuento — por eso el margen cayó a 27%.',
  },
];

export const reglasZapateria = [
  { si: 'El descuento pasa de 15%', entonces: 'pide tu autorización', detalle: 'En calzado el remate es la salida fácil: si cualquiera puede darlo, el margen se va sin que nadie lo decida.' },
  { si: 'Se cancela una venta ya cobrada', entonces: 'queda firmada', detalle: 'Quién, cuándo y por qué. Con apartados y anticipos de por medio, es donde más se pierde el rastro.' },
  { si: 'Un par queda descabalado', entonces: 'no se cierra el corte', detalle: 'El pie que se queda en el aparador y el que se quedó en el probador son las dos fuentes de descuadre en calzado. Quedan a nombre de quien cerró, el mismo día — no a fin de mes.' },
];

/* ── Cómo se implementa. Los mismos cinco pasos de siempre, pero contados con
   lo que de verdad se carga y se configura en una zapatería: la corrida con
   medios, las marcas de León, los apartados vivos y el traspaso entre tiendas. */
export const pasosZapateria = [
  {
    cuando: 'Día 1',
    titulo: 'Tus corridas, cargadas',
    texto: 'Nos das tu archivo o tu base actual y lo subimos nosotros. No capturas nada.',
    detalle: 'Modelo, color y número con medios — no una lista de "productos". Y la existencia real de cada tienda y de la bodega.',
    img: '/images/proc-zap-1.webp',
    alt: 'Consultor con laptop y empleada revisando una lista de inventario junto a los anaqueles de cajas',
  },
  {
    cuando: 'Día 2',
    titulo: 'Tu operación, configurada',
    texto: 'Queda como ya trabajas, no como el sistema quiere que trabajes.',
    detalle: 'Tus marcas y tus proveedores de León, la bodega que surte a las tiendas, quién puede dar descuento y hasta cuánto.',
    img: '/images/proc-zap-2.webp',
    alt: 'Dueña de zapatería y consultor revisando documentos de proveedores en la oficina de la tienda',
  },
  {
    cuando: 'Día 3',
    titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Cobrar y consultar un número se aprende en la primera media hora.',
    detalle: 'Y se practica lo que de verdad se usa a diario: el cambio de número, el apartado con abonos y el corte.',
    img: '/images/proc-zap-3.webp',
    alt: 'Equipo de una zapatería en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4',
    titulo: 'Arranca una tienda',
    texto: 'La primera sucursal vende con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con sus apartados vivos ya migrados: nadie llega a liquidar y se encuentra con que su papel no existe.',
    img: '/images/proc-zap-4.webp',
    alt: 'Cajera cobrando en una zapatería con un compañero acompañando el primer día',
  },
  {
    cuando: 'Día 5',
    titulo: 'Arrancan las demás',
    texto: 'Con la primera resuelta, las otras entran el mismo día.',
    detalle: 'Y el traspaso de números entre tiendas ya corre desde el primer sábado, que es cuando se nota.',
    img: '/images/proc-zap-5.webp',
    alt: 'Dueña de una cadena de zapaterías revisando su tablet en el pasillo de una de sus tiendas',
  },
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
    { que: 'Tiempo para arrancar', generico: 'Días', tonoGenerico: 'ok', medida: 'Meses', tonoMedida: 'no', sacs: 'Días' },
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
    titulo: 'Te piden un número y nadie sabe si lo hay',
    texto:
      'La vendedora está hincada junto al probador, con el pie del cliente en la mano. Ahí mismo ve si ese número existe — y si aquí no, en qué tienda sí y lo aparta.',
    remate: 'Cada viaje a la bodega son cinco minutos con otros dos clientes esperando.',
    img: '/images/caso-zap-mostrador.webp',
    alt: 'Vendedora hincada junto al banco del probador calzando a una clienta con calzador, con tres cajas abiertas en el piso',
  },
  {
    id: 'quincena',
    titulo: 'Llega la quincena y todos vienen a liquidar su apartado',
    texto:
      'Se busca al cliente por su teléfono, se cobra lo que falta y sale con su par. Sin buscar el papelito en la carpeta ni preguntarle a quién se lo apartó.',
    remate: 'Es el día que más vendes del mes: el mostrador no puede detenerse.',
    img: '/images/caso-zap-quincena.webp',
    alt: 'Fila de clientes con cajas de zapatos en la caja de una zapatería un viernes por la tarde',
  },
  {
    id: 'recepcion',
    titulo: 'La caja dice 24 y adentro viene 25',
    texto:
      'Se recibe contra la orden de compra, par por par y número por número: lo que falta, lo que llegó de más y lo que viene cambiado, todo antes de firmar.',
    remate: 'León manda en tres embarques. Sin esto, a media temporada nadie sabe qué falta.',
    img: '/images/caso-zap-recepcion.webp',
    alt: 'Empleado abriendo una caja madre con doce cajas de zapatos de canto, con la remisión en la mano',
  },
  {
    id: 'escolar',
    titulo: 'Llega el regreso a clases y el número se agota en horas',
    texto:
      'Aquí no se lleva un par: se lleva el negro de diario y el tenis blanco. Y al niño se le mide el pie antes de traer caja. La reposición diaria por número te dice qué pedir hoy.',
    remate: 'Si no encuentra el número, compra en otra parte y no vuelve hasta el año que entra.',
    img: '/images/caso-zap-escolar.webp',
    alt: 'Vendedora hincada revisando la punta del zapato escolar que el niño ya trae puesto, con la caja abierta y el tenis blanco del segundo par en el piso',
  },
];
/* ── Las cuatro etapas del negocio, con lo que significan en una zapatería.
   No son planes: son las cuatro cosas que la tienda hace todos los días. Cada
   punto existe de verdad en el sistema — la referencia es src/data/plans.ts. */
export const etapasZapateria = [
  {
    id: 'vender',
    nombre: 'Vender',
    resumen: 'El mostrador, la bodega y tus canales cobrando el mismo par, con un solo inventario.',
    puntos: [
      'Venta por número, con medios y por color',

      'Apartados con anticipo, y abonos por quincena (desde Controla)',
      'Ventas a crédito y cotizaciones',
      'Listas de precios y precio por volumen',
      'Tienda en línea con tu mismo inventario',
      'WhatsApp, Instagram, Facebook y TikTok Shop',
      'Ticket por WhatsApp, y la caja cobra sin internet',
    ],
  },
  {
    id: 'controlar',
    nombre: 'Controlar',
    resumen: 'La corrida, lo que compras a León y lo que de verdad te deja cada par.',
    puntos: [
      'Existencia por modelo, color y número en cada tienda',
      'Cambio de número y devoluciones, aunque el par sea de otra sucursal',
      'Traspasos entre sucursales y bodega central',
      'Conteo físico desde el celular y conteos cíclicos',
      'Kardex y trazabilidad de cada par',
      'Órdenes de compra y recepción por embarque',
      'Cuentas por pagar y control de gastos',
      'Costeo y utilidad por par, no solo por venta',
      'Mermas, pérdidas y aviso de existencia baja',
    ],
  },
  {
    id: 'fidelizar',
    nombre: 'Fidelizar',
    resumen: 'El pie de tu cliente ya no crece: sabes su número y le avisas cuando entra.',
    puntos: [
      'Perfil del cliente con lo que compró y en qué número',
      'Segmentación por lo que de verdad se lleva',
      'Monedero, puntos y niveles de recompensa',
      'Tarjetas de regalo físicas y digitales',
      'Campañas por correo y por WhatsApp',
      'Portal de clientes con tu marca',
      'Membresías con cobro recurrente',
      'Portal de autofacturación, sin que nadie capture RFC',
    ],
  },
  {
    id: 'administrar',
    nombre: 'Administrar',
    resumen: 'Tu equipo, tus permisos y los números con los que decides — sin estar en la tienda.',
    puntos: [
      'Metas y comisión por vendedor y por sucursal',
      'Permisos por usuario y por tienda (y por caja en Automatiza)',
      'Auditoría de movimientos: quién, cuándo y qué',
      '50+ reportes y 20+ indicadores de tu operación',
      'CFDI desde la caja y factura global',
      'Complementos de pago y notas de crédito',
      'Multi-sucursal en tiempo real, desde el celular',
      'Conexión con tu ERP y tu despacho por API (en Automatiza)',
    ],
  },
];

/* ── El reparto del lunes: el bloque propio del giro.
   Todo esto salió de la manera en que se nivela de verdad una cadena de
   calzado. Lo que hay que respetar si algún día se toca:

   · Se mueve el par que SOBRA, no el número que falta. Igualar existencias es
     repartir la corrida rota entre las cuatro tiendas.
   · Un cero en un número que esa tienda no vende NO es hueco: es limpieza.
     Por eso `venta` existe: sin ella, la matriz miente.
   · Nunca sale el último par de un número que sí rota en su tienda.
   · El umbral es de seis pares por envío, salvo el viaje de regreso —que no
     paga flete— y el par comprometido con un cliente, que va solo.
   · Las cuentas se hacen a COSTO y contra el saldero, nunca a precio de lista. */
export const nivelacionZapateria = {
  modelo: 'Botín dama piel café',
  semanas: 8,
  precio: 1290,
  costo: 600,
  flete: 17,
  numeros: ['22', '22½', '23', '23½', '24', '24½', '25', '25½', '26', '26½', '27'],
  tiendas: [
    { nombre: 'Centro',      venta: [0, 1, 2, 5, 6, 5, 4, 3, 2, 1, 0], existencia: [1, 2, 3, 2, 1, 2, 5, 4, 3, 2, 2] },
    { nombre: 'Plaza Norte', venta: [0, 0, 1, 1, 1, 2, 4, 5, 4, 2, 1], existencia: [2, 3, 4, 6, 5, 3, 3, 4, 3, 2, 1] },
    { nombre: 'Galerías',    venta: [0, 1, 2, 2, 2, 2, 2, 1, 1, 1, 0], existencia: [1, 2, 3, 7, 8, 4, 2, 1, 1, 2, 3] },
    { nombre: 'Sur',         venta: [0, 0, 2, 5, 4, 3, 2, 1, 0, 0, 0], existencia: [3, 2, 1, 0, 0, 0, 1, 1, 2, 3, 4] },
  ],
  traspasos: [
    {
      de: 'Plaza Norte', a: 'Sur', reparto: 'Reparto del martes',
      motivo: 'Cierra corrida',
      items: [{ n: '23½', pares: 4 }, { n: '24', pares: 3 }, { n: '23', pares: 2 }],
      nota: 'Sur no vende mal: no tiene qué vender. Le faltan tres números seguidos de su núcleo, justo donde hace doce de sus diecisiete pares al mes.',
    },
    {
      de: 'Galerías', a: 'Centro', reparto: 'Mismo reparto',
      motivo: 'Quiebre inminente',
      items: [{ n: '23½', pares: 3 }, { n: '24', pares: 4 }],
      nota: 'A Centro le queda un par del 24 y vende seis al mes: cinco días. Galerías conserva sus cuatro y cuatro, que es su mes completo.',
    },
    {
      de: 'Sur', a: 'Plaza Norte', reparto: 'Regresa en la misma camioneta',
      motivo: 'Excedente muerto',
      items: [{ n: '26', pares: 2 }, { n: '26½', pares: 2 }, { n: '27', pares: 1 }],
      nota: 'Son cinco pares, por debajo del umbral de seis. Se autoriza igual porque es el viaje de regreso del primero: flete cero.',
    },
  ],
  /* Lo que NO se salva. Un bloque que dice que todo se recupera es una
     calculadora de ilusiones, y el dueño lo sabe. */
  saldo: { pares: 21, detalle: '8 del 27, 7 del 22, 5 del 22½ y 1 del 26½' },
  comprar: { pares: 38, detalle: '24½ ×15 · 24 ×12 · 25½ ×11', nota: 'No hay excedente de 24½ en toda la cadena: hay nueve pares y las cuatro tiendas venden doce al mes. Ese hueco se compra o no existe.' },
  pasos: ['Se propone', 'Se autoriza', 'Se surte', 'Va en camino', 'Se recibe', 'Entra a piso'],
};

/**
 * El plano de la zapatería. Sustituye al círculo de las cuatro etapas.
 *
 * Las zonas son las del oficio y no las de una tienda cualquiera: en calzado
 * el piso exhibe UNA muestra por modelo y la corrida vive en la bodega de
 * cajas, así que la bodega es una zona de venta, no un almacén. Y el probador
 * con su banca es donde se decide el par: si el número no está, ahí se pierde.
 */
export const planoZapateria = [
  {
    id: 'piso',
    nombre: 'Piso de venta',
    simbolo: 'exhibidores',
    foto: '/images/plano-zap-piso.webp',
    alt: 'Piso de una zapatería grande con muros de repisas y una muestra por modelo',
    pie: 'En el muro va la muestra; la corrida completa está atrás, en cajas.',
    pregunta: '«¿Este me lo tienes del 25 y medio?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Punto de venta por modelo, color y número, con medios' },
      { t: 'Etiquetas con código de barras' },
      { t: 'Existencia por número en cada tienda y en la bodega', plan: 'Controla' },
      { t: 'Traspaso entre tiendas para cerrar la corrida', plan: 'Controla' },
      { t: 'Conteo desde el celular, sin cerrar la tienda', plan: 'Controla' },
    ],
  },
  {
    id: 'probador',
    nombre: 'Probador',
    ambito: 'En piso, junto a las bancas',
    simbolo: 'bancas',
    foto: '/images/plano-zap-probador.webp',
    alt: 'Zona de bancas de una zapatería, con una vendedora arrodillada y una caja abierta',
    pie: 'Aquí se decide el par: si el número no está, la venta se cae en la banca.',
    pregunta: '«Me aprieta. ¿No tendrás el siguiente número?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Consulta del número en las otras tiendas sin dejar al cliente', plan: 'Controla' },
      { t: 'Apartado con anticipo y abonos por quincena' },
      { t: 'Cambio de número o color, aunque el par venga de otra tienda' },
      { t: 'Vale a favor cuando no está su número' },
      { t: 'Cambio sin ticket físico', plan: 'Fideliza' },
    ],
  },
  {
    id: 'bodega',
    nombre: 'Bodega de cajas',
    ambito: 'Detrás del mostrador',
    simbolo: 'anaqueles',
    foto: '/images/plano-zap-bodega.webp',
    alt: 'Bodega de una zapatería con anaqueles llenos de cajas de calzado ordenadas',
    pie: 'La corrida entera vive aquí: lo que no está en caja, no se vende.',
    pregunta: '«Llegó el embarque y no sé qué números faltan.»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Recepción del embarque contra la orden de compra', plan: 'Controla' },
      { t: 'Reparto a tiendas desde el mismo documento', plan: 'Controla' },
      { t: 'Kardex y trazabilidad de cada par', plan: 'Controla' },
      { t: 'Aviso de existencia baja y de exceso', plan: 'Controla' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-zap-mostrador.webp',
    alt: 'Mostrador de cobro de una zapatería grande, con bolsas de papel y cajas al fondo',
    pie: 'La caja que no se detiene, ni en quincena ni sin internet.',
    pregunta: '«Es quincena, hay fila y se cayó el internet.»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Punto de venta que sigue cobrando sin conexión' },
      { t: 'Corte de caja y arqueo automáticos al cerrar' },
      { t: 'Ticket por WhatsApp' },
      { t: 'Factura desde la caja, sin anotar el RFC en una libreta' },
      { t: 'Corte ciego: el cajero no sabe cuánto debe haber', plan: 'Fideliza' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-zap-linea.webp',
    alt: 'Mesa de empaque de una zapatería con cajas de calzado listas para enviar',
    pie: 'El mismo inventario del piso, empacándose para salir.',
    pregunta: '«Vendí en línea un par que ya estaba apartado.»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el mismo inventario del mostrador' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'Un solo inventario para todos los canales' },
      { t: 'Perfil del cliente con lo que compró y en qué número', plan: 'Fideliza' },
      { t: 'Monedero, puntos y campañas', plan: 'Fideliza' },
    ],
  },
];
