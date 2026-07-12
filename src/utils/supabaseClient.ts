import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('supabaseUrl and supabaseAnonKey are required. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);