import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bucket } from "@/lib/storage";

/** Envoie une image (déjà compressée) dans le dossier du vendeur et renvoie son adresse publique. */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: Bucket,
  path: string,
  image: { blob: Blob },
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Retire des fichiers envoyés (nettoyage après un échec). Sans erreur, quoi qu'il arrive. */
export async function removeUploaded(supabase: SupabaseClient, bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch {
    // sans conséquence : le fichier restera simplement orphelin
  }
}
