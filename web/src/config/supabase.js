/**
 * Cliente de Supabase para la web pública.
 *
 * Solo se usa para flujos sin sesión persistente (confirmación de email
 * y restablecimiento de contraseña). La URL y la clave anónima vienen de
 * variables de entorno Vite (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
 * Si faltan, se usan valores placeholder para evitar que `createClient`
 * lance una excepción durante el build.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
