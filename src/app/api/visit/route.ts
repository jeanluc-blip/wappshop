import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { looksLikeSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

// Comptage anonyme des visites : aucun cookie, aucune donnée personnelle (ni IP, ni identité).
// Un identifiant de session aléatoire, propre à l'onglet du visiteur, évite de compter deux fois la même visite.

const bodySchema = z.object({
  slug: z.string().refine(looksLikeSlug),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|httpclient/i;
const DEDUPE_MINUTES = 30;
const LIMIT_PER_MINUTE = 60;

// Limitation de débit simple, en mémoire (suffisante contre un script naïf ; à renforcer plus tard si besoin).
const hits = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_PER_MINUTE;
}

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) return noContent();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return new NextResponse(null, { status: 429 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024) return new NextResponse(null, { status: 413 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { slug, sessionId } = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    console.warn("Visites non comptées : SUPABASE_SECRET_KEY n'est pas configurée.");
    return noContent();
  }

  const { data: shop } = await admin.from("shops").select("id, user_id").eq("slug", slug).maybeSingle();
  if (!shop) return noContent();

  // Le propriétaire connecté qui consulte sa propre boutique n'est pas un visiteur.
  const user = await getCurrentUser();
  if (user?.id === shop.user_id) return noContent();

  const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await admin
    .from("events")
    .select("id")
    .eq("shop_id", shop.id)
    .eq("type", "visit")
    .eq("session_id", sessionId)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) return noContent();

  const { error } = await admin.from("events").insert({ shop_id: shop.id, type: "visit", session_id: sessionId });
  if (error) console.error("Enregistrement de la visite impossible", error.message);
  return noContent();
}
