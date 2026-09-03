// El estado de una conversación (un canal o un hilo): la lista, paginar hacia
// atrás, meter lo nuevo cuando llega la señal, mandar con optimismo y
// reconciliar por `cid`.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Adjunto, Mensaje } from './api';
import { api, cid as nuevoCid } from './api';
import type { Senal } from './useRealtime';

export function useMensajes(canalId: string | null, hiloDe: string | null, yo: { id: string; nombre: string; foto_url: string | null } | null) {
  const [lista, setLista] = useState<Mensaje[]>([]);
  const [raiz, setRaiz] = useState<Mensaje | null>(null);
  const [cargando, setCargando] = useState(false);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clave = `${canalId}|${hiloDe}`;
  const claveRef = useRef(clave); claveRef.current = clave;
  const cargandoMas = useRef(false);

  const cargar = useCallback(async (alrededor?: string) => {
    if (!canalId) { setLista([]); setRaiz(null); return; }
    setCargando(true); setError(null);
    const k = claveRef.current;
    try {
      const r = await api.mensajes({ canal_id: canalId, hilo_de: hiloDe || undefined, alrededor });
      if (claveRef.current !== k) return;
      setLista(r.mensajes); setRaiz(r.raiz || null); setHayMas(!!r.hay_mas);
    } catch (e: any) { if (claveRef.current === k) setError(e.message); }
    finally { if (claveRef.current === k) setCargando(false); }
  }, [canalId, hiloDe]);

  useEffect(() => { setLista([]); setRaiz(null); cargar(); }, [cargar]);

  const masAntiguos = useCallback(async () => {
    if (!canalId || hiloDe || cargandoMas.current || !hayMas || !lista.length) return;
    cargandoMas.current = true;
    try {
      const r = await api.mensajes({ canal_id: canalId, antes: lista[0].created_at });
      setLista(v => [...r.mensajes.filter(m => !v.some(x => x.id === m.id)), ...v]);
      setHayMas(!!r.hay_mas);
    } catch { /* se reintenta al volver a subir */ }
    finally { cargandoMas.current = false; }
  }, [canalId, hiloDe, hayMas, lista]);

  /** Lo nuevo desde el último que tengo (señal de mensaje, poll, reconexión). */
  const traerNuevos = useCallback(async () => {
    if (!canalId) return;
    const k = claveRef.current;
    if (hiloDe) {
      const r = await api.mensajes({ canal_id: canalId, hilo_de: hiloDe });
      if (claveRef.current !== k) return;
      setLista(v => {
        const pend = v.filter(m => m.pendiente);
        return [...r.mensajes, ...pend.filter(p => !r.mensajes.some(m => m.cid && m.cid === p.cid))];
      });
      if (r.raiz) setRaiz(r.raiz);
      return;
    }
    const ultimo = [...lista].reverse().find(m => !m.pendiente);
    const r = await api.mensajes(ultimo ? { canal_id: canalId, desde: ultimo.created_at } : { canal_id: canalId });
    if (claveRef.current !== k) return;
    setLista(v => {
      const nuevos = r.mensajes.filter(m => !v.some(x => x.id === m.id));
      if (!nuevos.length) return v;
      // Un mensaje mío que llega por señal reemplaza su versión optimista.
      const sinOpt = v.filter(x => !(x.pendiente && nuevos.some(n => n.cid && n.cid === x.cid)));
      return [...sinOpt, ...nuevos].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, [canalId, hiloDe, lista]);

  const refrescarUno = useCallback(async (id: string) => {
    try {
      const { mensaje } = await api.uno(id);
      if (!mensaje) return;
      setLista(v => v.map(m => m.id === id ? mensaje : m));
      setRaiz(r => r && r.id === id ? mensaje : r);
    } catch { /* nada */ }
  }, []);

  const alSenal = useCallback((s: Senal) => {
    if (!canalId) return;
    if (s.tipo === 'poll') { traerNuevos().catch(() => null); return; }
    if (!('canal_id' in s) || s.canal_id !== canalId) return;
    if (s.tipo === 'msg') {
      const esDeEsteHilo = (s.hilo_de || null) === (hiloDe || null);
      if (esDeEsteHilo) traerNuevos().catch(() => null);
      else if (!hiloDe && s.hilo_de) refrescarUno(s.hilo_de); // el contador del hilo en la raíz
    } else if (s.tipo === 'msg_upd' || s.tipo === 'reaccion') {
      refrescarUno(s.id);
    }
  }, [canalId, hiloDe, traerNuevos, refrescarUno]);

  const enviar = useCallback(async (texto: string, adjuntos: Adjunto[], respondeA: Mensaje | null, extra?: { sesion_id?: string | null; punto_id?: string | null }) => {
    if (!canalId || !yo) return;
    const cid = nuevoCid();
    const opt: Mensaje = {
      id: 'opt-' + cid, canal_id: canalId, hilo_de: hiloDe, created_at: new Date().toISOString(),
      autor: yo, texto, borrado: false, editado_at: null,
      responde_a: respondeA ? { id: respondeA.id, autor: { id: respondeA.autor.id, nombre: respondeA.autor.nombre }, texto: respondeA.texto } : null,
      menciones: [], adjuntos: adjuntos.map(a => ({ ...a, url: a.url || undefined })), citas: [], sesion_id: null, punto_id: null,
      reacciones: [], hilo: null, cid, mio: true, pendiente: true,
    };
    setLista(v => [...v, opt]);
    try {
      const r = await api.enviar({ canal_id: canalId, texto, adjuntos, responde_a: respondeA?.id || null, hilo_de: hiloDe, cid, ...extra });
      setLista(v => v.some(m => m.id === r.mensaje.id) ? v.filter(m => m.id !== opt.id) : v.map(m => m.id === opt.id ? r.mensaje : m));
    } catch (e: any) {
      setLista(v => v.map(m => m.id === opt.id ? { ...m, fallo: e.message } : m));
      throw e;
    }
  }, [canalId, hiloDe, yo]);

  const editar = useCallback(async (id: string, texto: string) => {
    const r = await api.editar(id, texto);
    setLista(v => v.map(m => m.id === id ? r.mensaje : m));
    setRaiz(x => x && x.id === id ? r.mensaje : x);
  }, []);

  const borrar = useCallback(async (id: string) => {
    await api.borrar(id);
    setLista(v => v.map(m => m.id === id ? { ...m, borrado: true, texto: '', adjuntos: [], reacciones: [] } : m));
  }, []);

  const reaccionar = useCallback(async (m: Mensaje, emoji: string) => {
    // Optimista: la reacción aparece al toque y la señal la confirma.
    const aplicar = (x: Mensaje): Mensaje => {
      const ya = x.reacciones.find(r => r.emoji === emoji);
      let rs = x.reacciones;
      if (ya?.mia) rs = ya.n === 1 ? rs.filter(r => r.emoji !== emoji) : rs.map(r => r.emoji === emoji ? { ...r, n: r.n - 1, mia: false } : r);
      else if (ya) rs = rs.map(r => r.emoji === emoji ? { ...r, n: r.n + 1, mia: true } : r);
      else rs = [...rs, { emoji, n: 1, mia: true, quienes: ['tú'] }];
      return { ...x, reacciones: rs };
    };
    setLista(v => v.map(x => x.id === m.id ? aplicar(x) : x));
    setRaiz(x => x && x.id === m.id ? aplicar(x) : x);
    try { await api.reaccionar(m.id, emoji); } catch { refrescarUno(m.id); }
  }, [refrescarUno]);

  return { lista, raiz, cargando, hayMas, error, masAntiguos, traerNuevos, alSenal, enviar, editar, borrar, reaccionar, cargar, refrescarUno, setLista };
}
