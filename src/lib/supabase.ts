import { createClient } from '@supabase/supabase-js';

// The publishable key is safe to be public — data is protected by login + database rules
const SUPABASE_URL = 'https://tncbayvoaamosjsdksop.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-N2lX94vpA48mZUf6C7lJA_-baWcvia';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stews-dashboard' },
});

// "stewsview" → "stewsview@pos.local" (same as the app)
export function usernameToEmail(username: string) {
  const u = username.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@pos.local`;
}