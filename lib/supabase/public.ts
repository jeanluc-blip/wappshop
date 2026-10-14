import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

/**
 * Client « visiteur » sans cookies ni session : la boutique publique ne lit que ce que la sécurité (RLS)
 * autorise pour un anonyme, et la page peut être mise en cache (ISR).
 */
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
