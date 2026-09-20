/**
 * AURA Frontend Supabase Client
 * Identity provider client for email/password, Google OAuth, and GitHub OAuth.
 * Supabase handles authentication only — Neon PostgreSQL stores all app data.
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Guard: fail gracefully if Supabase is not yet configured
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type { Session, User };
export { isSupabaseConfigured };
