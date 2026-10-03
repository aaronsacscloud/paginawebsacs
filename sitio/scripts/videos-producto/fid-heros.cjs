// Videos cortos del hero de las páginas de Fidelización (Polanco Boutique).
// Uso: CUENTA=andyaraujoconsultorias node fid-heros.cjs <clientes|lealtad|portal|regalo|correo|whatsapp|membresias>
const { abrir } = require('./rec.cjs'); const f = require('./fid-comun.cjs');
const QUE = process.argv[2];
const mover = async (r, t, o, dy = 0, seg = 0.6, quieto = 0.6) => { try { const [x, y] = await r.punto(t, o); await r.mover(x, y + dy, seg); await r.quieto(quieto); } catch (e) { console.log('⚠', t); } };
const H = {
  async clientes(r) {
    await f.ir(r, 'Clientes', 'Nuevo cliente'); await f.clic(r, 'Lealtad', { ymin: 150, ymax: 500 }); await r.p.waitForTimeout(5000);
    for (const n of f.reales()) await f.ocultarCaja(r, n, { min: 900, alto: 90 });
    await r.iniciar('clientes-hero'); await r.quieto(1.0);
    await mover(r, 'LEALTAD'); await mover(r, 'CASHBACK');
    const [x, y] = await r.punto('Ximena Ochoa'); await r.toque(x, y, { clic: false });
    await r.transicion(async () => { await r.p.mouse.click(x, y); await r.esperaTexto('$24,703', 120000); await r.p.waitForTimeout(9000); if (await r.hayTexto('Error al obtener')) { try { await f.clic(r, 'OK'); } catch (e) { await r.p.keyboard.press('Escape'); } await r.p.waitForTimeout(1500); } }, null, { extra: 1500 });
    if (await r.hayTexto('Error al obtener')) console.log('⚠ sigue el error');
    await r.quieto(1.0); await mover(r, 'TOTAL GASTADO', {}, -20, 0.6, 0.6); await mover(r, 'TICKET PROMEDIO', {}, -20, 0.6, 0.6); await mover(r, 'SALDO MONEDERO', {}, -20, 0.6, 1.2);
    if (await r.hayTexto('Error al obtener')) console.log('⚠ apareció el error al final');
  },
  async lealtad(r) {
    await f.ir(r, 'Programa de Lealtad', 'Cambiar tipo'); await r.p.waitForTimeout(3000); await f.reemplazar(r, [['xxx', 'Club Polanco Boutique: puntos, cashback y beneficios de moda']]);
    await r.iniciar('lealtad-hero'); await r.quieto(1.0);
    await mover(r, 'NIVELES'); await mover(r, 'CASHBACK'); await mover(r, 'RECOMPENSAS');
    await mover(r, 'Inscripción automática de clientes', {}, 0, 0.6, 0.8);
    await r.p.mouse.move(700, 500); await r.scroll(420, 1.5); await r.quieto(1.4);
  },
  async portal(r) {
    await f.ir(r, 'Portal de Clientes', 'Editar Portal'); await f.reemplazar(r, [['andyaraujoconsultorias', 'polancoboutique']]);
    await r.iniciar('portal-hero'); await r.quieto(1.0);
    await mover(r, 'Link de tu portal', {}, 40, 0.6, 0.8); await mover(r, 'Copiar', {}, 0, 0.6, 0.8);
    await mover(r, 'Configuración rápida', {}, 40, 0.6, 0.8); await mover(r, 'COLOR', {}, 10, 0.6, 0.8);
    await r.mover(1060, 330, 0.8); await r.quieto(1.6); await mover(r, 'Ver Portal', {}, 0, 0.6, 1.0);
  },
  async regalo(r) {
    await f.ir(r, 'Tarjetas de regalo', 'Emitir tarjetas');
    await r.iniciar('regalo-hero'); await r.quieto(1.0);
    await mover(r, 'PASIVO VIVO', {}, 20); await mover(r, 'INGRESO RECONOCIDO', {}, 20); await mover(r, 'EMITIDO TOTAL', {}, 20);
    await mover(r, 'SACS-TJX6-W4P2-H35K', {}, 0, 0.6, 0.4); await mover(r, '$1,110.00', {}, 0, 0.5, 0.8);
    await r.p.mouse.move(700, 500); await r.scroll(300, 1.4); await r.quieto(1.2);
  },
  async correo(r) {
    await f.ir(r, 'Embudos y Campañas', 'Nueva campaña'); await f.clic(r, 'Campañas', { ymin: 40, ymax: 200 }); await r.p.waitForTimeout(5000);
    for (const x of ['Collare nuevos', 'Cliente de collares']) await f.ocultarCaja(r, x, { min: 600, alto: 90 });
    await r.iniciar('correo-hero'); await r.quieto(1.0);
    await mover(r, 'Lanzamiento Otoño-Invierno'); await mover(r, '$68,450', {}, 0, 0.6, 0.8);
    const [x, y] = await r.punto('Embudos', { ymin: 40, ymax: 200 }); await r.toque(x, y, { clic: false });
    await r.transicion(async () => { await r.p.mouse.click(x, y); await r.p.waitForTimeout(5000); }, null, { extra: 1200 });
    await mover(r, 'Llegó tu talla'); await mover(r, 'COMPRARON', {}, 30, 0.6, 1.4);
  },
  async whatsapp(r) {
    await r.go('dashboard/list/index', 'Ingresos'); const p = r.p;
    if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, (await p.evaluate(() => innerHeight)) - 25); await p.waitForTimeout(1800); }
    await f.clic(r, 'Configuración', { xmax: 300 }); await r.esperaTexto('Configuración y personalización'); await p.waitForTimeout(4000);
    await f.clic(r, 'Notificaciones', { xmax: 300, ymin: 150, ymax: 500 }); await r.esperaTexto('Notificaciones automáticas', 60000); await p.waitForTimeout(3000);
    try { await f.clic(r, 'Punto de Venta', { xmin: 300 }); } catch (e) {}
    await f.clic(r, 'Lealtad', { xmin: 300 }); await p.waitForTimeout(2500);
    for (const t of ['Suite Joyería', 'Órdenes de servicio', 'Conteo por zona · Accesorios de notificaciones (arquitectura)']) await f.ocultarCaja(r, t, { min: 400, max: 1000, alto: 600 });
    await f.ocultarCaja(r, 'UNKNOWN', { min: 0, max: 120, alto: 30 }); await f.reemplazar(r, [[' (vía Kapso)', '']]); await f.aislar(r, 'Notificaciones automáticas', 600, 700); await p.waitForTimeout(1500);
    await r.iniciar('whatsapp-hero'); await r.quieto(1.0);
    await mover(r, 'WhatsApp', { xmin: 300 }, 0, 0.6, 0.8); await mover(r, 'Enviar prueba', { xmin: 300, n: 1 }, 0, 0.6, 0.6);
    await p.mouse.move(800, 500); await r.scroll(500, 1.6); await r.quieto(1.4);
  },
  async membresias(r) {
    await f.ir(r, 'Membresías', 'Nuevo plan');
    await r.iniciar('membresias-hero'); await r.quieto(1.0);
    await mover(r, 'Club Atelier'); await mover(r, 'Ajuste de bastilla', {}, 0, 0.5, 0.6);
    const [x, y] = await r.punto('Tablero', { ymin: 60, ymax: 200 }); await r.toque(x, y, { clic: false });
    await r.transicion(async () => { await r.p.mouse.click(x, y); await r.p.waitForTimeout(4000); await f.clic(r, 'Este año'); await r.p.waitForTimeout(4000); }, null, { extra: 1200 });
    await mover(r, 'VALOR VENDIDO', {}, 20, 0.7, 1.4);
  },
};
(async () => {
  const r = await abrir(1344, 720);
  await H[QUE](r);
  await r.terminar(QUE + '-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
