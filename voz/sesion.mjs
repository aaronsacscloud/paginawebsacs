// UNA LLAMADA · lo que pasa desde que Twilio abre el WebSocket hasta que cuelga.
//
// Twilio (ConversationRelay) nos manda lo que el contacto DIJO ya transcrito
// y nosotros le mandamos lo que Fernanda va a DECIR; él pone la voz. Aquí vive
// el turno: prompt → Claude en streaming → frases → Twilio, con interrupciones,
// herramientas (que ejecuta el CRM), silencios y el fin de la llamada.
import { pensar, costoUsd, MODELO_VOZ } from './cerebro.mjs';
import { Partidor, paraVoz, segundosHablando } from './frases.mjs';
import * as crm from './crm.mjs';

const SILENCIO_PREGUNTA_MS = 7000;   // tras hablar Fernanda, si nadie contesta: «¿sigue ahí?»
const SILENCIO_ADIOS_MS = 10000;     // y si sigue el silencio: se despide y cuelga
// Lo que dice la persona cuando ya se va (con o sin «gracias» antes).
const SE_DESPIDE = /(hasta (luego|pronto|mañana)|adi[óo]s|bye|nos vemos|que est[ée] bien|que le vaya bien|(gracias|ok|okay|va|vale|listo)[,.!]?\s*(hasta luego|adi[óo]s|bye|nos vemos))\s*[.!…]*\s*$/i;
const DESPEDIDA = /(hasta (luego|pronto|mañana|entonces)|que (tenga|le vaya|te vaya) (bien|buen|bonito|excelente)|buen(as)? (día|tarde|noche)s?[.!]?\s*$|adi[óo]s|nos vemos|hablamos (luego|después|pronto))\s*[.!…]*\s*$/i;
const MAX_HERRAMIENTAS = 3;          // vueltas de herramienta por turno
const MAX_TURNOS = 60;               // candado: una llamada no dura para siempre
const MAX_MIN = 12;

const log = (...a) => console.log(new Date().toISOString(), ...a);

export class Sesion {
  constructor(ws, { alCerrar } = {}) {
    this.ws = ws;
    this.alCerrar = alCerrar;
    this.item = null;            // id del tel_sesion_item (o `prueba-…`)
    this.callSid = null;
    this.ctx = null;             // lo que el CRM sabe: system, herramientas, nombre…
    this.mensajes = [];          // historial para Claude
    this.generando = null;       // AbortController del turno en curso
    this.hablandoHasta = 0;      // ms: cuándo termina de decirse lo último que mandamos
    this.silenciada = false;     // AMD dijo máquina: no hablar
    this.terminando = false;
    this.cerrada = false;
    this.turnos = 0;
    this.t0 = Date.now();
    this.metricas = { latencias: [], herramientas: [], interrupciones: 0, uso: { input: 0, output: 0, cacheW: 0, cacheR: 0 }, errores: 0 };
    this.timers = {};
    this.transcripcion = [];     // [{t, quien, texto}]
  }

  // ---------- Twilio → nosotros ----------
  async recibir(msg) {
    switch (msg.type) {
      case 'setup': return this.alSetup(msg);
      case 'prompt': return this.alPrompt(msg);
      case 'interrupt': return this.alInterrupcion(msg);
      case 'dtmf': return log(`[${this.item}] dtmf ${msg.digit}`);
      case 'error': this.metricas.errores++; return log(`[${this.item}] error de Twilio:`, msg.description);
      case 'info': return;
      default: return log(`[${this.item}] mensaje desconocido`, msg.type);
    }
  }

  async alSetup(msg) {
    this.callSid = msg.callSid;
    const p = msg.customParameters || {};
    this.item = p.item || null;
    this.prueba = p.prueba === '1' || p.prueba === 'true';
    this.modoEco = p.modo === 'eco';
    if (!this.item || !crm.tokenValido(this.item, p.token)) {
      log('setup rechazado: token inválido', { item: this.item, callSid: this.callSid });
      return this.enviar({ type: 'end' });
    }
    log(`[${this.item}] setup call=${this.callSid} de ${msg.from} a ${msg.to} prueba=${this.prueba} eco=${this.modoEco}`);
    if (this.modoEco) { this.ctx = { system: [], herramientas: [], saludo: p.saludo || '' }; return; }
    try {
      this.ctx = await crm.contexto(this.item, { prueba: this.prueba, callSid: this.callSid, saludo: p.saludo || '' });
    } catch (e) {
      log(`[${this.item}] sin contexto del CRM:`, e.message);
      this.metricas.errores++;
      // Sin contexto Fernanda no sabe con quién habla: se disculpa y cuelga.
      this.decir('Disculpe, tuve un problema técnico. Le marco en un momento.', { last: true });
      return this.terminar('sin_contexto', segundosHablando('Disculpe, tuve un problema técnico. Le marco en un momento.') * 1000);
    }
    // El saludo ya lo dijo Twilio (welcomeGreeting): entra al historial como primer turno.
    const saludo = this.ctx.saludo || p.saludo;
    if (saludo) { this.mensajes.push({ role: 'assistant', content: saludo }); this.anotar('fernanda', saludo); this.hablandoHasta = Date.now() + segundosHablando(saludo) * 1000; }
    this.armarSilencio();
  }

  async alPrompt(msg) {
    if (msg.last === false) return;           // parciales: no los pedimos, por si acaso
    const dicho = String(msg.voicePrompt || '').trim();
    if (!dicho) return;
    this.cancelarSilencio();
    this.anotar('contacto', dicho);
    if (this.modoEco) return this.eco(dicho);
    if (this.silenciada) return;              // es una máquina: que hable el buzón

    // Lo que dijo va al CRM (reglas de máquina/portero + transcripción viva).
    if (!this.prueba) this.reportarTurno('contacto', dicho).then((r) => this.alVeredicto(r?.veredicto)).catch(() => {});

    // Si veníamos generando y aún no había hablado, se junta con lo nuevo.
    if (this.generando) { this.generando.abort(); this.generando = null; }
    // Si la persona se despide, el modelo no debe retenerla con otra pregunta: se despide y cuelga.
    const seVa = SE_DESPIDE.test(dicho);
    const entrada = seVa ? `${dicho}\n[La persona se está despidiendo: despídete en UNA oración, sin preguntas, y llama a colgar.]` : dicho;
    const ultimo = this.mensajes[this.mensajes.length - 1];
    if (ultimo?.role === 'user' && typeof ultimo.content === 'string') ultimo.content += ' ' + entrada;
    else this.mensajes.push({ role: 'user', content: entrada });

    if (++this.turnos > MAX_TURNOS || Date.now() - this.t0 > MAX_MIN * 60000) {
      return this.despedirse('Le agradezco mucho su tiempo. Le mando la información por WhatsApp y quedamos en contacto. ¡Hasta luego!', 'tope');
    }
    return this.turno();
  }

  alInterrupcion(msg) {
    this.metricas.interrupciones++;
    if (this.generando) { this.generando.abort(); this.generando = null; }
    // Lo que no alcanzó a oír no cuenta: el historial se queda en lo dicho.
    const hasta = String(msg.utteranceUntilInterrupt || '').trim();
    for (let i = this.mensajes.length - 1; i >= 0; i--) {
      const m = this.mensajes[i];
      if (m.role !== 'assistant') continue;
      if (typeof m.content === 'string') m.content = hasta ? hasta + '…' : '(interrumpida antes de decir nada)';
      else if (Array.isArray(m.content)) {
        const t = m.content.find((b) => b.type === 'text');
        if (t) t.text = hasta ? hasta + '…' : '(interrumpida)';
      }
      break;
    }
    this.hablandoHasta = 0;
    log(`[${this.item}] interrumpida en «${hasta.slice(-40)}»`);
  }

  // ---------- el turno ----------
  async turno() {
    const t0 = Date.now();
    const ctl = new AbortController();
    this.generando = ctl;
    let vueltas = 0;
    let primerTokenMs = 0;
    let textoDicho = '';
    try {
      while (vueltas++ < MAX_HERRAMIENTAS + 1) {
        const partidor = new Partidor();
        let frases = 0;
        const soltar = (f) => {
          if (ctl.signal.aborted) return;
          if (!primerTokenMs) { primerTokenMs = Date.now() - t0; }
          const dicho = paraVoz(f);
          textoDicho += (textoDicho ? ' ' : '') + dicho;
          this.enviar({ type: 'text', token: dicho + ' ', last: false, interruptible: true });
          frases++;
        };
        const r = await pensar({
          system: this.ctx.system,
          herramientas: this.ctx.herramientas,
          mensajes: this.mensajes,
          signal: ctl.signal,
          alToken: (tok) => partidor.empujar(tok).forEach(soltar),
        });
        if (ctl.signal.aborted) return;
        partidor.cerrar().forEach(soltar);
        this.sumarUso(r.uso);

        const usos = r.contenido.filter((b) => b.type === 'tool_use');
        // El turno del asistente entra al historial tal cual (texto + tool_use).
        if (r.contenido.length) this.mensajes.push({ role: 'assistant', content: r.contenido });
        // Todo tool_use que quedó en el historial necesita su tool_result (aunque se haya cortado por max_tokens).
        if (!usos.length) break;
        if (vueltas > MAX_HERRAMIENTAS) {
          this.mensajes.push({ role: 'user', content: usos.map((u) => ({ type: 'tool_result', tool_use_id: u.id, content: 'Sin resultado: demasiadas herramientas seguidas. Responde con lo que sabes.' })) });
          continue;
        }
        const resultados = [];
        for (const u of usos) {
          const th = Date.now();
          let res;
          try { res = u.input && typeof u.input === 'object' ? await this.ejecutar(u.name, u.input) : { error: 'llamada incompleta' }; }
          catch (e) { res = { error: e.message }; this.metricas.errores++; }
          this.metricas.herramientas.push({ nombre: u.name, ms: Date.now() - th, ok: !res?.error });
          resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res ?? {}) });
          if (res?.colgar) this.despuesDeHablar = () => this.terminar(res.colgar === true ? 'colgo_fernanda' : String(res.colgar));
          if (res?.pasar) this.despuesDeHablar = () => this.terminar('pasa_a_humano', 0, { handoff: res.pasar });
          if (ctl.signal.aborted) return;
        }
        this.mensajes.push({ role: 'user', content: resultados });
        if (r.stop !== 'tool_use' && r.stop !== 'max_tokens') break;
      }
    } catch (e) {
      if (ctl.signal.aborted) return;
      this.metricas.errores++;
      log(`[${this.item}] error pensando:`, e.message);
      if (!textoDicho) { textoDicho = 'Perdón, se me fue un segundo. ¿Me lo repite, por favor?'; this.enviar({ type: 'text', token: textoDicho, last: false, interruptible: true }); }
    } finally {
      if (this.generando === ctl) this.generando = null;
    }
    if (ctl.signal.aborted) return;
    this.enviar({ type: 'text', token: '', last: true });
    const total = Date.now() - t0;
    this.metricas.latencias.push({ primero: primerTokenMs || total, total, vueltas: vueltas - 1 });
    if (textoDicho) {
      this.anotar('fernanda', textoDicho);
      if (!this.prueba) this.reportarTurno('fernanda', textoDicho).catch(() => {});
    }
    this.hablandoHasta = Date.now() + segundosHablando(textoDicho) * 1000;
    log(`[${this.item}] turno ${this.turnos}: primer token ${primerTokenMs} ms, total ${total} ms, «${textoDicho.slice(0, 80)}»`);
    if (this.despuesDeHablar) {
      const f = this.despuesDeHablar; this.despuesDeHablar = null;
      setTimeout(f, Math.max(0, this.hablandoHasta - Date.now()) + 600);
    } else this.armarSilencio();
  }

  /** Las herramientas las ejecuta el CRM (agenda, datos, envíos). Las de control se resuelven aquí. */
  async ejecutar(nombre, args) {
    if (nombre === 'colgar') return { ok: true, colgar: args?.motivo || true };
    if (nombre === 'pasar_a_humano') {
      if (this.prueba) return { ok: false, motivo: 'En la prueba no hay vendedor en la sala; sigue tú.' };
      const r = await crm.herramienta(this.item, nombre, args);
      return r?.ok && r.handoff ? { ...r, pasar: r.handoff } : r;
    }
    if (this.prueba) return { ok: true, simulado: true, nota: 'Prueba: la herramienta no se ejecutó de verdad. Actúa como si hubiera funcionado.' , ...(nombre === 'consultar_horarios' ? { horarios: ['mañana a las once de la mañana', 'mañana a las cuatro de la tarde', 'pasado mañana a las diez de la mañana'] } : {}) };
    return crm.herramienta(this.item, nombre, args);
  }

  eco(dicho) {
    const t0 = Date.now();
    this.enviar({ type: 'text', token: `Escuché: ${dicho}`, last: true, interruptible: true });
    this.metricas.latencias.push({ primero: Date.now() - t0, total: Date.now() - t0, vueltas: 0 });
    this.anotar('fernanda', `Escuché: ${dicho}`);
    if (/adi[oó]s|cuelga|termina|bye/i.test(dicho)) return this.despedirse('Perfecto, eso fue todo. Hasta luego.', 'eco_fin');
    this.armarSilencio();
  }

  // ---------- eventos desde el CRM ----------
  async evento(ev, datos = {}) {
    log(`[${this.item}] evento ${ev}`, datos.motivo || '');
    switch (ev) {
      case 'maquina':                          // AMD: contestó una grabadora. Callada hasta el bip.
        this.silenciada = true;
        if (this.generando) { this.generando.abort(); this.generando = null; }
        this.cancelarSilencio();
        return;
      case 'buzon': {                          // bip: se deja el mensaje (o nada) y se cuelga
        this.silenciada = true;
        this.cancelarSilencio();
        const texto = datos.mensaje || this.ctx?.mensajeBuzon;
        if (!texto) return this.terminar('buzon_sin_mensaje');
        this.enviar({ type: 'text', token: paraVoz(texto), last: true, interruptible: false });
        this.anotar('fernanda', texto);
        return this.terminar('buzon_mensaje', segundosHablando(texto) * 1000 + 800);
      }
      case 'persona':                          // AMD tardío: sí era persona (por si la habíamos callado)
        this.silenciada = false; return;
      case 'decir':                            // el vendedor le dicta algo desde la cabina
        if (!datos.texto) return;
        this.enviar({ type: 'text', token: paraVoz(datos.texto), last: true, interruptible: true });
        this.anotar('fernanda', datos.texto);
        this.mensajes.push({ role: 'assistant', content: datos.texto });
        return;
      case 'tomar':                            // el vendedor toma la llamada: Fernanda se despide y pasa
        return this.despedirse(datos.texto || 'Le paso con mi compañero, un momento por favor.', 'pasa_a_humano', { handoff: datos.handoff || { tomar: true } });
      case 'colgar':
        return this.despedirse(datos.texto || '', datos.motivo || 'colgo_crm');
      default: return;
    }
  }

  // ---------- silencios ----------
  armarSilencio() {
    this.cancelarSilencio();
    if (this.silenciada || this.terminando || this.modoEco) return;
    const espera = Math.max(0, this.hablandoHasta - Date.now());
    // Si lo último que dijo Fernanda fue una despedida y no llamó a colgar, se cuelga solo (sin «¿sigue ahí?»).
    const ultimo = this.transcripcion.length ? this.transcripcion[this.transcripcion.length - 1] : null;
    if (ultimo?.quien === 'fernanda' && DESPEDIDA.test(ultimo.texto)) {
      this.timers.pregunta = setTimeout(() => { if (!this.generando && !this.terminando) this.terminar('despedida'); }, espera + 2500);
      return;
    }
    this.timers.pregunta = setTimeout(() => {
      if (this.generando || this.terminando) return;
      const t = this.ctx?.nombre ? `¿Sigue ahí, ${this.ctx.nombre}?` : '¿Sigue ahí?';
      this.enviar({ type: 'text', token: t, last: true, interruptible: true });
      this.anotar('fernanda', t);
      this.mensajes.push({ role: 'assistant', content: t });
      this.timers.adios = setTimeout(() => {
        if (this.generando || this.terminando) return;
        this.despedirse('Parece que se cortó. Le marco después. ¡Hasta luego!', 'silencio');
      }, SILENCIO_ADIOS_MS);
    }, espera + SILENCIO_PREGUNTA_MS);
  }
  cancelarSilencio() { clearTimeout(this.timers.pregunta); clearTimeout(this.timers.adios); }

  // ---------- fin ----------
  despedirse(texto, motivo, extra) {
    if (this.terminando) return;
    if (this.generando) { this.generando.abort(); this.generando = null; }
    if (texto) {
      this.enviar({ type: 'text', token: paraVoz(texto), last: true, interruptible: false });
      this.anotar('fernanda', texto);
      this.mensajes.push({ role: 'assistant', content: texto });
    }
    return this.terminar(motivo, texto ? segundosHablando(texto) * 1000 + 800 : 0, extra);
  }

  terminar(motivo, esperaMs = 0, extra = {}) {
    if (this.terminando) return;
    this.terminando = true;
    this.cancelarSilencio();
    this.motivo = motivo;
    setTimeout(() => {
      const fin = { type: 'end' };
      if (extra.handoff) fin.handoffData = JSON.stringify(extra.handoff);
      this.enviar(fin);
      log(`[${this.item}] end (${motivo})`);
    }, esperaMs);
  }

  /** Twilio cerró el socket (por nuestro `end` o porque colgaron). Se reporta al CRM. */
  async cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    this.cancelarSilencio();
    if (this.generando) { this.generando.abort(); this.generando = null; }
    const lat = this.metricas.latencias.map((l) => l.primero).sort((a, b) => a - b);
    const p = (q) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
    const resumen = {
      motivo: this.motivo || 'colgaron',
      duracionS: Math.round((Date.now() - this.t0) / 1000),
      turnos: this.turnos,
      latencia: { n: lat.length, mediana: p(0.5), p95: p(0.95), max: lat[lat.length - 1] || 0 },
      herramientas: this.metricas.herramientas,
      interrupciones: this.metricas.interrupciones,
      errores: this.metricas.errores,
      uso: this.metricas.uso,
      modelo: MODELO_VOZ,
      costoUsd: Number(costoUsd(this.metricas.uso).toFixed(4)),
      transcripcion: this.transcripcion,
    };
    log(`[${this.item}] cerrada: ${resumen.motivo}, ${resumen.duracionS}s, ${resumen.turnos} turnos, latencia mediana ${resumen.latencia.mediana} ms p95 ${resumen.latencia.p95} ms, $${resumen.costoUsd}`);
    this.alCerrar?.(this, resumen);
    if (this.item && !this.modoEco && crm.hayCrm()) {
      try { await crm.fin(this.item, { callSid: this.callSid, prueba: this.prueba, ...resumen }); }
      catch (e) { log(`[${this.item}] no se pudo reportar el fin:`, e.message); }
      // En Vercel nadie late entre llamadas: se empuja la sesión a los 12 y 30 s (el cierre con IA tarda unos segundos).
      if (!this.prueba) for (const t of [12000, 30000]) setTimeout(() => crm.latir(this.item).catch((e) => log(`[${this.item}] latido:`, e.message)), t).unref();
    }
  }

  // ---------- utilería ----------
  enviar(obj) {
    if (this.ws.readyState !== 1) return;
    try { this.ws.send(JSON.stringify(obj)); } catch (e) { log(`[${this.item}] no se pudo enviar`, e.message); }
  }
  anotar(quien, texto) { this.transcripcion.push({ t: Date.now() - this.t0, quien, texto }); }
  sumarUso(u) { for (const k of Object.keys(this.metricas.uso)) this.metricas.uso[k] += u?.[k] || 0; }
  reportarTurno(quien, texto) { return crm.turno(this.item, { quien, texto, callSid: this.callSid, t: Date.now() - this.t0 }); }
  alVeredicto(v) {
    if (!v || this.terminando) return;
    if (v === 'buzon' && !this.silenciada) { log(`[${this.item}] las reglas dicen buzón`); this.silenciada = true; if (this.generando) { this.generando.abort(); this.generando = null; } }
  }
}
