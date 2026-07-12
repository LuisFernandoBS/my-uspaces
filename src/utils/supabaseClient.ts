import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_KEY;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_URL_APP;
const openKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
console.log('supabaseUrl:', supabaseUrl);
console.log('supabaseAnonKey:', supabaseAnonKey);
console.log('openKey:', openKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('supabaseUrl and supabaseAnonKey are required. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);