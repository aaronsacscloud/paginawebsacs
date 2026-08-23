// El inbox de Kapso, embebido. El chat en vivo (lista, hilo, responder,
// media, realtime) es SUYO; lo nuestro es traer la embed_url sin exponer la
// API key y regenerar el token si un día regresa 401.
import { useEffect, useState } from 'react';
import { S, Aviso } from '../email/ui';
import Cargando from '../ui/Cargando';

export default function InboxEmbed({ buscar }: { buscar?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Un iframe cross-origin no deja ver el 401 desde fuera: si el token
  // guardado murió, el camino es el botón Reintentar, que fuerza uno nuevo.

  const cargar = (force = false) => {
    setError(null);
    fetch(`/api/crm/whatsapp/embed${force ? '?force=1' : ''}`)
      .then(r => r.json())
      .then(j => { if (j.embed_url) setUrl(j.embed_url); else setError(j.error || 'Sin embed_url'); })
      .catch(e => setError(String(e)));
  };
  useEffect(() => { cargar(); }, []);

  if (error) {
    return (
      <div style={S.wrap}>
        <Aviso tono="malo" titulo="El inbox no cargó"
          accion={<button style={S.btnP} onClick={() => cargar(true)}>Reintentar</button>}>
          {error}
        </Aviso>
      </div>
    );
  }
  if (!url) return <Cargando texto="Abriendo el inbox de WhatsApp…" />;

  const src = `${url}${url.includes('?') ? '&' : '?'}language=es${buscar ? `&search=${encodeURIComponent(buscar)}` : ''}`;
  return (
    <iframe
      src={src}
      title="Inbox de WhatsApp"
      style={{ width: '100%', height: 'calc(100dvh - 175px)', minHeight: 420, border: 0, display: 'block', background: '#fff' }}
      allow="clipboard-write; microphone"
    />
  );
}
