/** Compression côté client avant envoi : côté le plus long limité, WebP (JPEG si non supporté). */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export class ImageError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Repli (anciens navigateurs) : <img> applique l'orientation EXIF par défaut.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new ImageError("Format d'image non pris en charge. Essayez une photo JPEG ou PNG.");
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(
  file: File,
  maxSide = 1200,
  quality = 0.8,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  if (!file.type.startsWith("image/")) throw new ImageError("Ce fichier n'est pas une image.");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("Photo trop lourde (5 Mo maximum).");

  const decoded = await decode(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const render = (type: "image/webp" | "image/jpeg") => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageError("Impossible de préparer la photo.");
      if (type === "image/jpeg") {
        ctx.fillStyle = "#ffffff"; // JPEG n'a pas de transparence
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(decoded.source, 0, 0, width, height);
      return toBlob(canvas, type, quality);
    };

    const webp = await render("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };

    const jpeg = await render("image/jpeg");
    if (jpeg) return { blob: jpeg, ext: "jpg" };
    throw new ImageError("Impossible de préparer la photo.");
  } finally {
    decoded.release();
  }
}
