import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas. Configúralas en Vercel → Settings → Environment Variables.');
}

// Custom fetch with a hard timeout so requests never hang forever
// (e.g. after the browser tab has been idle and the connection is half-open).
const REQUEST_TIMEOUT_MS = 12_000;
const fetchWithTimeout = (input, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Respect any caller-provided signal by chaining aborts
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
