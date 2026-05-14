/**
 * Cliente administrador de Supabase para el backend.
 *
 * Usa la `service_role key`, que salta las políticas RLS, por lo que
 * NUNCA debe exponerse al cliente. Sin sesión persistente ni refresco
 * automático de token: el servidor actúa como sistema de confianza.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Fallo rápido en arranque si faltan credenciales: evita errores opacos en runtime.
if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — server cannot start');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

console.log('Supabase Admin initialized successfully');

module.exports = { supabase };
