import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

// Accueil, confidentialité et toutes les boutiques (l'adresse est une colonne publique).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const { data } = await createPublicClient().from("shops").select("slug, created_at").order("created_at", { ascending: false }).limit(5000);
    for (const shop of data ?? []) {
      entries.push({ url: `${base}/${shop.slug as string}`, lastModified: new Date(shop.created_at as string), changeFrequency: "weekly", priority: 0.7 });
    }
  } catch {
    // Base indisponible au moment de la construction : le plan du site contient au moins les pages fixes.
  }
  return entries;
}
