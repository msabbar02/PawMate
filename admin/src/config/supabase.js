/**
 * Cliente de Supabase para el panel de administración.
 *
 * Usa la `anon key` y la sesión del usuario administrador autenticado;
 * RLS se aplica como a cualquier cliente público. Se envuelve `fetch` con
 * un timeout estricto para que las peticiones no queden colgadas
 * indefinidamente (p. ej. al volver de un tab inactivo con la conexión
 * a medio cerrar) y para encadenar correctamente la señal del llamante.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas. Configúralas en Vercel → Settings → Environment Variables.');
}

/** Tiempo máximo en milisegundos antes de abortar una petición HTTP. */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * `fetch` con timeout duro y soporte para encadenar `AbortSignal` externos.
 *
 * @param {RequestInfo|URL} input  URL o `Request` de la llamada.
 * @param {RequestInit}     [init] Opciones de fetch (incluye `signal` opcional).
 * @returns {Promise<Response>}    Respuesta HTTP o aborta tras `REQUEST_TIMEOUT_MS`.
 */
const fetchWithTimeout = (input, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    global: {
      fetch: fetchWithTimeout,
    },
  }
);
