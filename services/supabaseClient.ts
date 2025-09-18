import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://opodtvqjobolbsesmwzx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb2R0dnFqb2JvbGJzZXNtd3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTUyMTYsImV4cCI6MjA3MzUzMTIxNn0.q075i1hF3TmNekWGKpKLbNwIDI2KScEY1hBGZdVFlj8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
