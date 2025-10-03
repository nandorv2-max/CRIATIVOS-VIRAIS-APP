import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Chaves hardcoded para funcionar no ambiente de preview do Dyad.
// Em produção, estas chaves devem vir de variáveis de ambiente.
const supabaseUrl = "https://opodtvqjobolbsesmwzx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb2R0dnFqb2JvbGJzZXNtd3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTUyMTYsImV4cCI6MjA3MzUzMTIxNn0.q075i1hF3TmNekWGKpKLbNwIDI2KScEY1hBGZdVFlj8";

// Linha de Diagnóstico: Vamos verificar se as variáveis estão sendo lidas.
console.log("Verificação do Cliente Supabase:", {
  url: supabaseUrl ? 'URL Encontrada' : 'URL AUSENTE!',
  key: supabaseAnonKey ? 'Chave Encontrada' : 'Chave AUSENTE!'
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in .env file");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);