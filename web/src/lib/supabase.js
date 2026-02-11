import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from "$env/static/public";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}
