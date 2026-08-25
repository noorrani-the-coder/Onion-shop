import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ENV_FILE } from '../paths';

dotenv.config({ path: ENV_FILE });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    })
  : null;

if (isSupabaseConfigured) {
  console.log('⚡ Connected to Supabase Database:', supabaseUrl);
} else {
  console.log('📁 Supabase credentials not detected in .env. Running on local JSON file database fallback.');
}
