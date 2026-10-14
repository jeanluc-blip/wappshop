import { getSupabaseConfig } from "@/lib/supabase/env";

export type Bucket = "logos" | "product-images";

function publicBase(): string {
  return `${getSupabaseConfig().url.replace(/\/+$/, "")}/storage/v1/object/public`;
}

/**
 * Chemin d'un fichier Storage à partir de son adresse publique, uniquement s'il appartient au dossier
 * `{userId}/` du vendeur dans le bucket attendu. Sinon `null` : une adresse venant du navigateur
 * n'est jamais acceptée telle quelle.
 */
export function ownedObjectPath(url: string | null | undefined, bucket: Bucket, userId: string): string | null {
  if (!url) return null;
  const prefix = `${publicBase()}/${bucket}/${userId}/`;
  if (!url.startsWith(prefix)) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.slice(`${publicBase()}/${bucket}/`.length).split("?")[0]);
  } catch {
    return null;
  }
  if (path.split("/").some((part) => part === ".." || part === "")) return null;
  return path;
}
