import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null; hasCode: boolean };

/** Utilisateur connecté (signature du jeton vérifiée), ou null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const metadata = claims.user_metadata as Record<string, unknown> | undefined;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    // « has_code » est posé quand le vendeur a créé son code secret (voir createCode).
    hasCode: metadata?.has_code === true,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
