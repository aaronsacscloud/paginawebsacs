/** Viñetas del mega-menú "Tu negocio": cada función de un giro se enseña con
 *  una mini-pantalla dibujada (una matriz, una curva, un ticket…), no con un
 *  ícono genérico. Todas usan currentColor = el color del giro; los rellenos
 *  son tintes de ese mismo color para que el panel tenga UN solo acento. */
const S = (inner: string) =>
  `<svg viewBox="0 0 96 60" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const T = 'fill="currentColor" fill-opacity=".14" stroke="none"';
const F = 'fill="currentColor" stroke="none"';

export const giroVinetas: Record<string, string> = {
  // talla × color: la cuadrícula con celdas llenas, vacías y una agotada
  matriz: S(`<text x="14" y="12" font-size="7" ${F} opacity=".55">XS</text><text x="32" y="12" font-size="7" ${F} opacity=".55">S</text><text x="48" y="12" font-size="7" ${F} opacity=".55">M</text><text x="65" y="12" font-size="7" ${F} opacity=".55">L</text><text x="80" y="12" font-size="7" ${F} opacity=".55">XL</text>
    ${[0,1,2].map(r=>[0,1,2,3,4].map(c=>{const x=12+c*16,y=17+r*13;const full=!(r===1&&c===2)&&!(r===2&&c===4);return full?`<rect x="${x}" y="${y}" width="12" height="9" rx="2" ${T}/>`:`<rect x="${x}" y="${y}" width="12" height="9" rx="2" stroke-dasharray="2 2" opacity=".6"/>`}).join('')).join('')}
    <circle cx="54" cy="34.5" r="1.8" ${F}/><circle cx="6" cy="21" r="2" ${T}/><circle cx="6" cy="34" r="2" ${T}/><circle cx="6" cy="47" r="2" ${T}/>`),
  // la curva: barras S M L XL en proporción real
  curva: S(`${[['S',18,24],['M',34,36],['L',50,28],['XL',66,16]].map(([l,x,h])=>`<rect x="${x}" y="${46-(h as number)}" width="11" height="${h}" rx="2" ${T}/><rect x="${x}" y="${46-(h as number)}" width="11" height="${h}" rx="2"/><text x="${(x as number)+5.5}" y="55" font-size="6.5" text-anchor="middle" ${F} opacity=".6">${l}</text>`).join('')}<path d="M12 46h68" opacity=".4"/>`),
  // temporada / fecha: la tira del mes con el día marcado
  calendario: S(`<rect x="12" y="10" width="72" height="42" rx="5"/><path d="M12 22h72"/><path d="M28 6v8M68 6v8"/>${[0,1,2,3,4,5,6].map(i=>`<circle cx="${20+i*9.5}" cy="31" r="1.6" ${F} opacity=".35"/>`).join('')}${[0,1,2,3,4,5,6].map(i=>`<circle cx="${20+i*9.5}" cy="42" r="1.6" ${F} opacity=".35"/>`).join('')}<rect x="52" y="37" width="12" height="10" rx="3" ${T}/><rect x="52" y="37" width="12" height="10" rx="3"/>`),
  // tablet con catálogo
  tablet: S(`<rect x="22" y="6" width="52" height="48" rx="5"/><rect x="28" y="12" width="18" height="22" rx="2" ${T}/><path d="M50 15h18M50 21h14M50 27h16"/><rect x="28" y="38" width="40" height="8" rx="2" ${T}/><circle cx="48" cy="50" r="1.2" ${F}/>`),
  // ticket con la flecha de cambio
  ticket: S(`<path d="M22 8h40v44l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3z" ${T}/><path d="M22 8h40v44l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3z"/><path d="M29 17h20M29 24h26M29 31h16"/><path d="M68 30l8 6-8 6" /><path d="M52 36h24"/>`),
  // look: tres prendas enlazadas
  look: S(`<rect x="10" y="14" width="20" height="28" rx="3" ${T}/><rect x="10" y="14" width="20" height="28" rx="3"/><rect x="38" y="14" width="20" height="28" rx="3" ${T}/><rect x="38" y="14" width="20" height="28" rx="3"/><rect x="66" y="14" width="20" height="28" rx="3" ${T}/><rect x="66" y="14" width="20" height="28" rx="3"/><text x="34" y="31" font-size="9" text-anchor="middle" ${F}>+</text><text x="62" y="31" font-size="9" text-anchor="middle" ${F}>+</text><rect x="26" y="46" width="44" height="8" rx="4" ${T}/><text x="48" y="52" font-size="6" text-anchor="middle" ${F}>1 ticket</text>`),
  // consigna: lo tuyo y lo del proveedor, separados
  consigna: S(`<rect x="10" y="12" width="34" height="36" rx="4" ${T}/><rect x="10" y="12" width="34" height="36" rx="4"/><rect x="52" y="12" width="34" height="36" rx="4" stroke-dasharray="3 3"/><path d="M16 22h22M16 29h16M58 22h22M58 29h14"/><text x="27" y="43" font-size="6" text-anchor="middle" ${F}>firme</text><text x="69" y="43" font-size="6" text-anchor="middle" ${F} opacity=".7">consigna</text>`),
  // rotación: la que se agota antes
  rotacion: S(`<path d="M12 46h72" opacity=".4"/>${[[14,20],[26,26],[38,18],[50,32],[62,38],[74,10]].map(([x,h])=>`<rect x="${x}" y="${46-h}" width="8" height="${h}" rx="2" ${T}/>`).join('')}<path d="M18 30 30 24 42 30 54 16 66 10" /><circle cx="78" cy="14" r="4" ${F}/><circle cx="78" cy="14" r="7" opacity=".4"/>`),
  // etiqueta con código de barras
  etiqueta: S(`<path d="M20 14h44l12 16-12 16H20z" ${T}/><path d="M20 14h44l12 16-12 16H20z"/>${[26,29,33,35,39,42,44,48,51].map((x,i)=>`<path d="M${x} 22v16" stroke-width="${i%3===0?2.2:1.2}"/>`).join('')}<circle cx="70" cy="30" r="1.8" ${F}/>`),
  // margen por marca
  margen: S(`${[['A',14,30,18],['B',36,24,9],['C',58,34,26]].map(([l,x,h,g])=>`<rect x="${x}" y="${46-(h as number)}" width="14" height="${h}" rx="2" stroke-dasharray="2 2" opacity=".5"/><rect x="${x}" y="${46-(g as number)}" width="14" height="${g}" rx="2" ${T}/><text x="${(x as number)+7}" y="55" font-size="6.5" text-anchor="middle" ${F} opacity=".6">${l}</text>`).join('')}<path d="M12 46h68" opacity=".4"/><text x="82" y="20" font-size="7" ${F}>%</text>`),
  // abonos: el apartado que se va llenando
  abonos: S(`<rect x="12" y="24" width="72" height="12" rx="6"/><rect x="12" y="24" width="46" height="12" rx="6" ${T}/><rect x="12" y="24" width="46" height="12" rx="6"/><path d="M30 24v12M46 24v12" opacity=".5"/><text x="12" y="16" font-size="7" ${F} opacity=".7">anticipo</text><text x="84" y="16" font-size="7" text-anchor="end" ${F} opacity=".7">entrega</text><path d="M66 46l4 4 8-8"/>`),
  // contrato firmado
  contrato: S(`<rect x="24" y="6" width="48" height="48" rx="4" ${T}/><rect x="24" y="6" width="48" height="48" rx="4"/><path d="M32 16h30M32 23h24M32 30h28"/><path d="M32 44c4-6 7 3 11-3s6 4 10-2" stroke-width="1.8"/><circle cx="66" cy="46" r="5" ${F}/><path d="M63.5 46l2 2 3.5-4" stroke="#fff" stroke-width="1.4"/>`),
  // live / canales: el teléfono que vende
  live: S(`<rect x="34" y="6" width="28" height="48" rx="6"/><rect x="38" y="12" width="20" height="26" rx="2" ${T}/><path d="M45 21l8 4-8 4z" ${F}/><circle cx="14" cy="18" r="6" ${T}/><circle cx="14" cy="42" r="6" ${T}/><circle cx="82" cy="18" r="6" ${T}/><circle cx="82" cy="42" r="6" ${T}/><path d="M20 18h14M20 42h14M62 18h14M62 42h14" opacity=".5"/>`),
  // módulos: puntos de venta con semáforo
  modulos: S(`${[[10,'#'],[38,'#'],[66,'#']].map(([x])=>`<rect x="${x}" y="18" width="20" height="22" rx="3" ${T}/><rect x="${x}" y="18" width="20" height="22" rx="3"/>`).join('')}<circle cx="20" cy="13" r="3" ${F}/><circle cx="48" cy="13" r="3" ${F} opacity=".45"/><circle cx="76" cy="13" r="3" ${F}/><path d="M30 29h8M58 29h8"/><path d="M66 29l-4-3M66 29l-4 3" /><text x="48" y="52" font-size="6.5" text-anchor="middle" ${F} opacity=".7">consolidado en vivo</text>`),
  // escáner: QR en el celular y palomita
  escaner: S(`<rect x="30" y="6" width="26" height="48" rx="5"/><rect x="35" y="16" width="16" height="16" rx="1" ${T}/><path d="M38 19h4v4h-4zM46 19h2v2M38 27h2v2M46 27h4v4"/><path d="M62 30h12" /><circle cx="78" cy="30" r="6" ${F}/><path d="M75 30l2 2 4-4" stroke="#fff" stroke-width="1.4"/>`),
  // taller por etapas
  taller: S(`<path d="M12 30h72" opacity=".4"/>${[16,38,60,82].map((x,i)=>`<circle cx="${x}" cy="30" r="5" ${i<2?F:T}/>`).join('')}<text x="16" y="46" font-size="6" text-anchor="middle" ${F} opacity=".7">prueba</text><text x="38" y="46" font-size="6" text-anchor="middle" ${F} opacity=".7">ajuste</text><text x="60" y="46" font-size="6" text-anchor="middle" ${F} opacity=".7">final</text><text x="82" y="46" font-size="6" text-anchor="middle" ${F} opacity=".7">entrega</text>`),
  // perfil de la clienta con sus tallas
  perfil: S(`<circle cx="26" cy="22" r="8" ${T}/><circle cx="26" cy="22" r="8"/><path d="M12 46c2-8 8-12 14-12s12 4 14 12"/><rect x="48" y="14" width="36" height="9" rx="4.5" ${T}/><text x="66" y="21" font-size="6.5" text-anchor="middle" ${F}>talla M · 25</text><rect x="48" y="27" width="36" height="9" rx="4.5" ${T}/><text x="66" y="34" font-size="6.5" text-anchor="middle" ${F}>3 compras</text><rect x="48" y="40" width="36" height="9" rx="4.5" ${T}/><text x="66" y="47" font-size="6.5" text-anchor="middle" ${F}>puntos</text>`),
  // balanza: gramos y precio del día
  balanza: S(`<path d="M48 10v36M22 46h52"/><path d="M28 18h40"/><path d="M28 18l-8 14h16zM68 18l-8 14h16z" ${T}/><path d="M28 18l-8 14h16zM68 18l-8 14h16z"/><rect x="58" y="36" width="30" height="10" rx="3" ${T}/><text x="73" y="43.5" font-size="6.5" text-anchor="middle" ${F}>$ / g hoy</text>`),
  // horma: número y ancho
  horma: S(`<path d="M18 40c0-10 8-14 16-14 6 0 8-6 10-12 2-4 8-4 10 0 3 8 4 14 14 18 8 3 10 8 8 12H20c-2 0-2-2-2-4z" ${T}/><path d="M18 40c0-10 8-14 16-14 6 0 8-6 10-12 2-4 8-4 10 0 3 8 4 14 14 18 8 3 10 8 8 12H20c-2 0-2-2-2-4z"/><path d="M26 52h44" opacity=".5"/><path d="M26 49v6M70 49v6" opacity=".5"/><text x="48" y="58" font-size="6.5" text-anchor="middle" ${F} opacity=".7">25 · ancho</text>`),
  // genérico: una lista limpia
  lista: S(`<rect x="14" y="10" width="68" height="40" rx="4"/><path d="M22 20h30M22 28h40M22 36h24M22 44h34"/><circle cx="76" cy="20" r="2" ${F}/>`),
};
