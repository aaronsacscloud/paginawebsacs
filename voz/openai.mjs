// UNA LLAMADA CON VOZ-A-VOZ DE OPENAI · Twilio Media Streams ↔ OpenAI Realtime/Live.
//
// Aquí Twilio ya no transcribe ni pone la voz: nos manda el AUDIO crudo de la
// llamada (μ-law 8 kHz) y nosotros lo pasamos a OpenAI, que oye y habla en un
// solo modelo. Nada de STT → LLM → TTS: la voz sale con entonación, se puede
// interrumpir y no hay segundos de silencio entre eslabones.
//
// El cerebro sigue siendo el CRM: el system y las herramientas vienen de
// crm.contexto(), las herramientas las ejecuta el CRM, y el fin se reporta igual.
import WebSocket from 'ws';
import * as crm from './crm.mjs';

export const MODELO_OPENAI = process.env.MODELO_OPENAI || 'gpt-realtime-2.1';
export const VOZ_OPENAI = process.env.VOZ_OPENAI || 'marin';
export const hayOpenAI = () => !!process.env.OPENAI_API_KEY;

const SILENCIO_PREGUNTA_MS = 8000;
const SILENCIO_ADIOS_MS = 10000;
const MAX_MIN = 12;
const MAX_TURNOS = 60;
const log = (...a) => console.log(new Date().toISOString(), ...a);

// USD por millón de tokens (developers.openai.com/api/docs/pricing, sep-2026).
const PRECIOS = {
  'gpt-realtime-2.1': { audioIn: 32, audioCache: 0.4, audioOut: 64, textIn: 4, textCache: 0.4, textOut: 24 },
  'gpt-realtime-2.1-mini': { audioIn: 10, audioCache: 0.3, audioOut: 20, textIn: 0.6, textCache: 0.06, textOut: 2.4 },
};
export function costoOpenAI(uso, modelo = MODELO_OPENAI) {
  if (modelo.startsWith('gpt-live')) return (uso.segundos || 0) / 60 * 0.05;
  const p = PRECIOS[modelo] || PRECIOS['gpt-realtime-2.1'];
  return ((uso.audioIn || 0) * p.audioIn + (uso.audioCache || 0) * p.audioCache + (uso.audioOut || 0) * p.audioOut
    + (uso.textIn || 0) * p.textIn + (uso.textCache || 0) * p.textCache + (uso.textOut || 0) * p.textOut) / 1e6;
}

// Cómo decide OpenAI que la persona terminó de hablar. VAD_OPENAI=server|semantic[:low|medium|high].
// El semántico entiende pausas a media frase pero puede tardar segundos en decidirse; el
// de servidor corta a los N ms de silencio, predecible para el teléfono.
const vad = () => {
  const [tipo, nivel] = String(process.env.VAD_OPENAI || 'server').split(':');
  if (tipo === 'semantic') return { type: 'semantic_vad', eagerness: nivel || 'high', create_response: true, interrupt_response: true };
  return { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: Number(process.env.VAD_SILENCIO_MS || 600), create_response: true, interrupt_response: true };
};

/** Las herramientas vienen en el formato de Anthropic; OpenAI quiere `parameters`. */
const aFuncion = (h) => ({ type: 'function', name: h.name, description: h.description, parameters: h.input_schema || { type: 'object', properties: {} } });

/** El system del CRM viene por capas (bloques con cache_control); aquí se junta en un texto. */
const aTexto = (system) => (Array.isArray(system) ? system.map((b) => b.text || '').join('\n\n') : String(system || ''));

const VOZ_EXTRA = [
  'CÓMO SUENAS: eres una mujer mexicana, hablas español de México con acento de la Ciudad de México, natural y cálido, como una persona real al teléfono.',
  'Frases cortas: máximo dos oraciones por turno, y termina con UNA pregunta. Nunca expliques todo de golpe ni leas listas: al teléfono la gente se desespera. Si te interrumpen, te callas y escuchas.',
  'Nunca digas que eres un modelo de OpenAI ni menciones tecnología: si preguntan si eres un robot, responde como te indica el guion.',
].join('\n');

export class SesionOpenAI {
  constructor(ws, { alCerrar } = {}) {
    this.ws = ws;                 // Twilio Media Streams
    this.ai = null;               // OpenAI Realtime
    this.alCerrar = alCerrar;
    this.item = null; this.callSid = null; this.streamSid = null;
    this.ctx = null;
    this.prueba = false;
    this.silenciada = false;      // AMD dijo máquina: no se le manda audio a Twilio
    this.sorda = false;           // no se le manda a OpenAI lo que entra (buzón grabando)
    this.terminando = false; this.cerrada = false;
    this.turnos = 0; this.t0 = Date.now();
    this.transcripcion = [];
    this.metricas = { latencias: [], herramientas: [], interrupciones: 0, errores: 0, uso: { audioIn: 0, audioCache: 0, audioOut: 0, textIn: 0, textCache: 0, textOut: 0 } };
    this.timers = {};
    // Para truncar lo que no alcanzó a oírse al interrumpir.
    this.tsTwilio = 0;            // último timestamp (ms) del audio entrante
    this.respuesta = null;        // { id, itemId, tsInicio, bytes, marcada }
    this.marcasPendientes = new Set();
    this.despuesDeHablar = null;
    this.tHablaDesde = 0;         // cuándo dejó de hablar la persona (para medir latencia)
    this.abiertaAi = false;
    this.listaAi = false;
  }

  // ---------- Twilio Media Streams → nosotros ----------
  async recibir(msg) {
    switch (msg.event) {
      case 'connected': return;
      case 'start': return this.alStart(msg);
      case 'media':
        this.tsTwilio = Number(msg.media?.timestamp || this.tsTwilio);
        if (this.listaAi && !this.silenciada && !this.sorda && msg.media?.payload) this.aAi({ type: 'input_audio_buffer.append', audio: msg.media.payload });
        return;
      case 'mark': return this.alMarca(msg.mark?.name);
      case 'dtmf': return log(`[${this.item}] dtmf ${msg.dtmf?.digit}`);
      case 'stop': return this.cerrar();
      default: return;
    }
  }

  async alStart(msg) {
    this.streamSid = msg.streamSid || msg.start?.streamSid;
    this.callSid = msg.start?.callSid;
    const p = msg.start?.customParameters || {};
    this.item = p.item || null;
    this.prueba = p.prueba === '1' || p.prueba === 'true';
    if (!this.item || !crm.tokenValido(this.item, p.token)) {
      log('start rechazado: token inválido', { item: this.item, callSid: this.callSid });
      return this.terminar('token', 0);
    }
    log(`[${this.item}] start call=${this.callSid} stream=${this.streamSid} prueba=${this.prueba} motor=${MODELO_OPENAI}/${p.voz || VOZ_OPENAI}`);
    try {
      this.ctx = await crm.contexto(this.item, { prueba: this.prueba, callSid: this.callSid, saludo: p.saludo || '' });
    } catch (e) {
      log(`[${this.item}] sin contexto del CRM:`, e.message);
      this.metricas.errores++;
      return this.terminar('sin_contexto', 0);
    }
    this.saludo = this.ctx.saludo || p.saludo || '';
    this.voz = p.voz || VOZ_OPENAI;
    this.abrirAi();
  }

  // ---------- OpenAI ----------
  abrirAi() {
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODELO_OPENAI)}`;
    this.ai = new WebSocket(url, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
    this.ai.on('open', () => {
      this.abiertaAi = true;
      this.aAi({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: MODELO_OPENAI,
          output_modalities: ['audio'],
          instructions: `${aTexto(this.ctx.system)}\n\n${VOZ_EXTRA}`,
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              transcription: { model: process.env.MODELO_TRANSCRIBE || 'gpt-4o-mini-transcribe', language: 'es' },
              turn_detection: vad(),
            },
            output: { format: { type: 'audio/pcmu' }, voice: this.voz, speed: 1.05 },
          },
          tools: (this.ctx.herramientas || []).map(aFuncion),
          tool_choice: 'auto',
          max_output_tokens: 600,
        },
      });
    });
    this.ai.on('message', (raw) => { let e; try { e = JSON.parse(raw.toString()); } catch { return; } try { this.deAi(e); } catch (err) { log(`[${this.item}] error con ${e.type}:`, err.message); } });
    this.ai.on('close', (code, reason) => { log(`[${this.item}] OpenAI cerró ${code} ${reason}`); if (!this.terminando) this.terminar('openai_cerro', 0); });
    this.ai.on('error', (e) => { this.metricas.errores++; log(`[${this.item}] OpenAI error:`, e.message); });
    this.ai.on('unexpected-response', (_, res) => { let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => { log(`[${this.item}] OpenAI rechazó: HTTP ${res.statusCode} ${s.slice(0, 200)}`); this.terminar('openai_rechazo', 0); }); });
  }

  deAi(e) {
    if (process.env.DEBUG_OPENAI && !/delta$/.test(e.type)) log(`[${this.item}] <- ${e.type}${e.type === 'error' ? ' ' + JSON.stringify(e.error) : ''}`);
    switch (e.type) {
      case 'session.created': return;
      case 'session.updated':
        if (this.listaAi) return;
        this.listaAi = true;
        log(`[${this.item}] OpenAI lista: voz ${e.session?.audio?.output?.voice}, vad ${e.session?.audio?.input?.turn_detection?.type}`);
        // El saludo lo dice ella (Twilio ya no tiene welcomeGreeting): se le pide como primera respuesta.
        if (this.saludo && !this.silenciada) {
          this.aAi({ type: 'response.create', response: { instructions: `Di exactamente esto, con naturalidad, y luego espera la respuesta: «${this.saludo}»` } });
          this.anotar('fernanda', this.saludo);
          this.mensajeSaludo = true;
        }
        return;
      case 'input_audio_buffer.speech_started':
        this.cancelarSilencio();
        if (this.respuesta && !this.respuesta.terminada) this.interrumpir();
        return;
      case 'input_audio_buffer.speech_stopped':
        this.tHablaDesde = Date.now();
        return;
      case 'conversation.item.input_audio_transcription.completed': {
        const dicho = String(e.transcript || '').trim();
        if (!dicho) return;
        this.turnos++;
        this.anotar('contacto', dicho);
        if (!this.prueba) this.reportarTurno('contacto', dicho).then((r) => this.alVeredicto(r?.veredicto)).catch(() => {});
        if (this.turnos > MAX_TURNOS || Date.now() - this.t0 > MAX_MIN * 60000) this.despedirse('Le agradezco mucho su tiempo. Le mando la información por WhatsApp y quedamos en contacto. ¡Hasta luego!', 'tope');
        return;
      }
      case 'conversation.item.input_audio_transcription.failed':
        this.metricas.errores++; return log(`[${this.item}] transcripción falló:`, e.error?.message);
      case 'response.created':
        this.respuesta = { id: e.response?.id, itemId: null, tsInicio: 0, bytes: 0, terminada: false, primerAudio: 0 };
        return;
      case 'response.output_audio.delta': {
        if (this.silenciada) return;
        const r = this.respuesta;
        if (r && !r.primerAudio) {
          r.primerAudio = Date.now(); r.tsInicio = this.tsTwilio; r.itemId = e.item_id;
          if (this.tHablaDesde) { this.metricas.latencias.push({ primero: r.primerAudio - this.tHablaDesde, total: r.primerAudio - this.tHablaDesde, vueltas: 0 }); this.tHablaDesde = 0; }
        }
        if (r) r.bytes += Buffer.byteLength(e.delta, 'base64');
        this.aTwilio({ event: 'media', streamSid: this.streamSid, media: { payload: e.delta } });
        return;
      }
      case 'response.output_audio_transcript.done': {
        const t = String(e.transcript || '').trim();
        if (t && !(this.mensajeSaludo && t === this.saludo)) { this.anotar('fernanda', t); if (!this.prueba) this.reportarTurno('fernanda', t).catch(() => {}); }
        this.mensajeSaludo = false;
        return;
      }
      case 'response.output_item.done':
        if (e.item?.type === 'function_call') this.herramienta(e.item);
        return;
      case 'response.done': {
        const r = e.response || {};
        this.sumarUso(r.usage);
        if (this.respuesta) {
          this.respuesta.terminada = true;
          // Marca al final del audio: cuando Twilio la devuelve, ya se oyó todo.
          if (this.respuesta.bytes) { const m = `fin-${this.respuesta.id}`; this.marcasPendientes.add(m); this.aTwilio({ event: 'mark', streamSid: this.streamSid, mark: { name: m } }); }
          else this.alMarca(null);
        }
        if (r.status === 'failed') { this.metricas.errores++; log(`[${this.item}] respuesta falló:`, JSON.stringify(r.status_details).slice(0, 200)); }
        return;
      }
      case 'error':
        this.metricas.errores++;
        if (e.error?.code === 'response_cancel_not_active' || e.error?.code === 'item_truncate_invalid') return;
        return log(`[${this.item}] OpenAI dijo:`, e.error?.code, e.error?.message);
      default: return;
    }
  }

  /** La persona habló encima: se limpia lo que Twilio aún no reprodujo y se recorta el historial a lo que sí oyó. */
  interrumpir() {
    const r = this.respuesta;
    this.metricas.interrupciones++;
    this.aTwilio({ event: 'clear', streamSid: this.streamSid });
    if (r?.itemId && r.tsInicio) {
      const oidoMs = Math.max(0, Math.min(this.tsTwilio - r.tsInicio, r.bytes / 8));   // μ-law: 8 bytes por ms
      this.aAi({ type: 'conversation.item.truncate', item_id: r.itemId, content_index: 0, audio_end_ms: Math.round(oidoMs) });
      log(`[${this.item}] interrumpida a los ${Math.round(oidoMs)} ms de ${Math.round(r.bytes / 8)}`);
    }
    for (const m of this.marcasPendientes) this.marcasPendientes.delete(m);
    r && (r.terminada = true);
  }

  /** Twilio devolvió la marca: lo último que dijo Fernanda ya se oyó completo. */
  alMarca(nombre) {
    if (nombre) { if (!this.marcasPendientes.has(nombre)) return; this.marcasPendientes.delete(nombre); }
    if (this.despuesDeHablar) { const f = this.despuesDeHablar; this.despuesDeHablar = null; return f(); }
    this.armarSilencio();
  }

  async herramienta(item) {
    let args = {};
    try { args = item.arguments ? JSON.parse(item.arguments) : {}; } catch { args = {}; }
    const th = Date.now();
    let res;
    try { res = await this.ejecutar(item.name, args); } catch (e) { res = { error: e.message }; this.metricas.errores++; }
    this.metricas.herramientas.push({ nombre: item.name, ms: Date.now() - th, ok: !res?.error });
    log(`[${this.item}] herramienta ${item.name}(${item.arguments}) → ${JSON.stringify(res).slice(0, 120)}`);
    if (res?.colgar) { this.despuesDeHablar = () => this.terminar(res.colgar === true ? 'colgo_fernanda' : String(res.colgar)); }
    if (res?.pasar) { this.despuesDeHablar = () => this.terminar('pasa_a_humano', 0, { handoff: res.pasar }); }
    this.aAi({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(res ?? {}) } });
    // Tras colgar/pasar no hay nada más que decir; con las demás, que siga con el resultado.
    if (!res?.colgar && !res?.pasar) this.aAi({ type: 'response.create' });
    else if (!this.respuesta || this.respuesta.terminada) { const f = this.despuesDeHablar; this.despuesDeHablar = null; f?.(); }
  }

  async ejecutar(nombre, args) {
    if (nombre === 'colgar') return { ok: true, colgar: args?.motivo || true };
    if (nombre === 'pasar_a_humano') {
      if (this.prueba) return { ok: false, motivo: 'En la prueba no hay vendedor en la sala; sigue tú.' };
      const r = await crm.herramienta(this.item, nombre, args);
      return r?.ok && r.handoff ? { ...r, pasar: r.handoff } : r;
    }
    if (this.prueba) return { ok: true, simulado: true, nota: 'Prueba: la herramienta no se ejecutó de verdad. Actúa como si hubiera funcionado.', ...(nombre === 'consultar_horarios' ? { horarios: ['mañana a las once de la mañana', 'mañana a las cuatro de la tarde', 'pasado mañana a las diez de la mañana'] } : {}) };
    return crm.herramienta(this.item, nombre, args);
  }

  // ---------- eventos desde el CRM (mismos que la sesión de ConversationRelay) ----------
  async evento(ev, datos = {}) {
    log(`[${this.item}] evento ${ev}`, datos.motivo || '');
    switch (ev) {
      case 'maquina': this.silenciada = true; this.sorda = true; this.aTwilio({ event: 'clear', streamSid: this.streamSid }); this.cancelarSilencio(); return;
      case 'buzon': {
        const texto = datos.mensaje || this.ctx?.mensajeBuzon;
        if (!texto) return this.terminar('buzon_sin_mensaje');
        this.silenciada = false; this.sorda = true;   // habla ella; la grabadora no cuenta como voz
        this.despuesDeHablar = () => this.terminar('buzon_mensaje');
        this.aAi({ type: 'response.create', response: { instructions: `Di exactamente esto y nada más: «${texto}»` } });
        this.anotar('fernanda', texto);
        return;
      }
      case 'persona': this.silenciada = false; this.sorda = false; return;
      case 'decir':
        if (!datos.texto) return;
        this.aAi({ type: 'response.create', response: { instructions: `Di exactamente esto, con naturalidad: «${datos.texto}»` } });
        return;
      case 'tomar': return this.despedirse(datos.texto || 'Le paso con mi compañero, un momento por favor.', 'pasa_a_humano', { handoff: datos.handoff || { tomar: true } });
      case 'colgar': return this.despedirse(datos.texto || '', datos.motivo || 'colgo_crm');
      default: return;
    }
  }

  // ---------- silencios ----------
  armarSilencio() {
    this.cancelarSilencio();
    if (this.silenciada || this.terminando) return;
    this.timers.pregunta = setTimeout(() => {
      if (this.terminando) return;
      this.aAi({ type: 'response.create', response: { instructions: `La persona lleva un rato callada. Pregunta brevemente si sigue ahí${this.ctx?.nombre ? ` (se llama ${this.ctx.nombre})` : ''}.` } });
      this.timers.adios = setTimeout(() => { if (!this.terminando) this.despedirse('Parece que se cortó. Le marco después. ¡Hasta luego!', 'silencio'); }, SILENCIO_ADIOS_MS);
    }, SILENCIO_PREGUNTA_MS);
  }
  cancelarSilencio() { clearTimeout(this.timers.pregunta); clearTimeout(this.timers.adios); }

  // ---------- fin ----------
  despedirse(texto, motivo, extra) {
    if (this.terminando) return;
    this.cancelarSilencio();
    if (!texto || !this.listaAi) return this.terminar(motivo, 0, extra);
    this.despuesDeHablar = () => this.terminar(motivo, 0, extra);
    this.aAi({ type: 'response.cancel' });
    this.aAi({ type: 'response.create', response: { instructions: `Di exactamente esto y nada más: «${texto}»` } });
    this.anotar('fernanda', texto);
    // Por si OpenAI nunca contesta: se cuelga de todos modos.
    this.timers.despedida = setTimeout(() => this.terminar(motivo, 0, extra), 12000);
  }

  terminar(motivo, esperaMs = 0, extra = {}) {
    if (this.terminando && this.motivo) return;
    this.terminando = true;
    this.motivo = motivo;
    this.handoff = extra.handoff || null;
    this.cancelarSilencio(); clearTimeout(this.timers.despedida);
    setTimeout(() => {
      log(`[${this.item}] fin (${motivo})`);
      // Cerrar nuestro lado del stream hace que Twilio siga con el TwiML (Hangup o el action del Connect).
      try { this.ws.close(1000, motivo); } catch { /* ya cerrado */ }
      this.cerrar();
    }, esperaMs);
  }

  async cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    this.cancelarSilencio(); clearTimeout(this.timers.despedida);
    try { this.ai?.close(); } catch { /* nada */ }
    const lat = this.metricas.latencias.map((l) => l.primero).sort((a, b) => a - b);
    const p = (q) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
    const uso = { ...this.metricas.uso, segundos: Math.round((Date.now() - this.t0) / 1000) };
    const resumen = {
      motivo: this.motivo || 'colgaron',
      duracionS: uso.segundos,
      turnos: this.turnos,
      latencia: { n: lat.length, mediana: p(0.5), p95: p(0.95), max: lat[lat.length - 1] || 0 },
      herramientas: this.metricas.herramientas,
      interrupciones: this.metricas.interrupciones,
      errores: this.metricas.errores,
      uso,
      modelo: `${MODELO_OPENAI}/${this.voz || VOZ_OPENAI}`,
      costoUsd: Number(costoOpenAI(uso).toFixed(4)),
      transcripcion: this.transcripcion,
      handoff: this.handoff || undefined,
    };
    log(`[${this.item}] cerrada: ${resumen.motivo}, ${resumen.duracionS}s, ${resumen.turnos} turnos, latencia mediana ${resumen.latencia.mediana} ms p95 ${resumen.latencia.p95} ms, $${resumen.costoUsd}`);
    this.alCerrar?.(this, resumen);
    if (this.item && crm.hayCrm()) {
      try { await crm.fin(this.item, { callSid: this.callSid, prueba: this.prueba, ...resumen }); }
      catch (e) { log(`[${this.item}] no se pudo reportar el fin:`, e.message); }
      if (!this.prueba) for (const t of [12000, 30000]) setTimeout(() => crm.latir(this.item).catch((e) => log(`[${this.item}] latido:`, e.message)), t).unref();
    }
  }

  // ---------- utilería ----------
  aTwilio(obj) { if (this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(obj)); } catch (e) { log(`[${this.item}] Twilio no recibió`, e.message); } } }
  aAi(obj) { if (this.ai?.readyState === 1) { try { this.ai.send(JSON.stringify(obj)); } catch (e) { log(`[${this.item}] OpenAI no recibió`, e.message); } } }
  anotar(quien, texto) { this.transcripcion.push({ t: Date.now() - this.t0, quien, texto }); }
  sumarUso(u) {
    if (!u) return;
    const m = this.metricas.uso;
    // Los tokens cacheados vienen incluidos en el total de entrada: se cobran aparte, más baratos.
    const ca = u.input_token_details?.cached_tokens_details?.audio_tokens || 0;
    const ct = u.input_token_details?.cached_tokens_details?.text_tokens || 0;
    m.audioIn += Math.max(0, (u.input_token_details?.audio_tokens || 0) - ca);
    m.textIn += Math.max(0, (u.input_token_details?.text_tokens || 0) - ct);
    m.audioCache += ca; m.textCache += ct;
    m.audioOut += u.output_token_details?.audio_tokens || 0;
    m.textOut += u.output_token_details?.text_tokens || 0;
  }
  reportarTurno(quien, texto) { return crm.turno(this.item, { quien, texto, callSid: this.callSid, t: Date.now() - this.t0 }); }
  alVeredicto(v) { if (v === 'buzon' && !this.silenciada && !this.terminando) { log(`[${this.item}] las reglas dicen buzón`); this.silenciada = true; this.aTwilio({ event: 'clear', streamSid: this.streamSid }); } }
}
