import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

/**
 * Client avec la clé de service (SUPABASE_SECRET_KEY) : contourne la sécurité (RLS).
 * Réservé aux routes serveur qui valident tout elles-mêmes (visites, plus tard commandes et avis).
 * Renvoie null si la clé n'est pas configurée.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const { url } = getSupabaseConfig();
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
