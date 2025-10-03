import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Linha de Diagnóstico: Vamos verificar se as variáveis estão sendo lidas.
console.log("Verificação do Cliente Supabase:", {
  url: supabaseUrl ? 'URL Encontrada' : 'URL AUSENTE!',
  key: supabaseAnonKey ? 'Chave Encontrada' : 'Chave AUSENTE!'
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in .env file");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);