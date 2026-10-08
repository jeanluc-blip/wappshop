import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Uniquement les pages liées à la session : la boutique publique reste sans appel Supabase ici.
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
