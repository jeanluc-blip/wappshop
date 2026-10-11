// Fabrique, dans le navigateur, l'image à publier (photo, nom, prix, adresse de la boutique).
// Aucune donnée n'est envoyée à un serveur : tout est dessiné sur un canvas, puis partagé ou téléchargé.

export type ShareFormat = "post" | "story";

export const FORMAT_SIZES: Record<ShareFormat, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1350, label: "Publication" },
  story: { width: 1080, height: 1920, label: "Story / TikTok" },
};

export type ShareImageInput = {
  format: ShareFormat;
  shopName: string;
  title: string;
  priceText: string;
  oldPriceText?: string | null;
  promoLabel?: string | null;
  /** Photo du produit (ou logo) : adresse de l'image, chargée via le serveur du site pour éviter tout blocage. */
  imageUrl: string | null;
  /** Adresse affichée en bas de l'image, sans « https:// ». */
  displayLink: string;
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Photo redimensionnée par le site lui-même (même origine : le canvas reste utilisable). */
function optimizedUrl(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth || !current) {
      current = attempt;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s.,;:!?-]+$/, "")}...`;
    return kept;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function makeShareImage(input: ShareImageInput): Promise<Blob> {
  const { width, height } = FORMAT_SIZES[input.format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const margin = 64;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Zone photo : tout le haut de l'image
  const footerHeight = input.format === "story" ? 520 : 440;
  const photoHeight = height - footerHeight;
  const photo = input.imageUrl ? await loadImage(optimizedUrl(input.imageUrl)) : null;
  if (photo) {
    const scale = Math.max(width / photo.width, photoHeight / photo.height);
    const drawW = photo.width * scale;
    const drawH = photo.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, photoHeight);
    ctx.clip();
    ctx.drawImage(photo, (width - drawW) / 2, (photoHeight - drawH) / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, width, photoHeight);
    ctx.fillStyle = "#9ca3af";
    ctx.font = `700 120px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText(input.shopName.slice(0, 1).toUpperCase(), width / 2, photoHeight / 2 + 40);
  }

  // Étiquette de promotion
  if (input.promoLabel) {
    ctx.font = `700 44px ${family}`;
    const textWidth = ctx.measureText(input.promoLabel).width;
    ctx.fillStyle = "#b91c1c";
    roundRect(ctx, margin, margin, textWidth + 64, 84, 42);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(input.promoLabel, margin + 32, margin + 58);
  }

  // Bas : nom, prix, appel à l'action, adresse
  let y = photoHeight + 84;
  ctx.textAlign = "left";
  ctx.fillStyle = "#111827";
  ctx.font = `700 64px ${family}`;
  for (const line of wrapLines(ctx, input.title, width - margin * 2, 2)) {
    ctx.fillText(line, margin, y);
    y += 76;
  }

  y += 8;
  ctx.font = `800 76px ${family}`;
  ctx.fillStyle = input.oldPriceText ? "#b91c1c" : "#111827";
  ctx.fillText(input.priceText, margin, y);
  if (input.oldPriceText) {
    const priceWidth = ctx.measureText(input.priceText).width;
    ctx.font = `500 48px ${family}`;
    ctx.fillStyle = "#6b7280";
    const oldX = margin + priceWidth + 28;
    ctx.fillText(input.oldPriceText, oldX, y);
    const oldWidth = ctx.measureText(input.oldPriceText).width;
    ctx.fillRect(oldX, y - 17, oldWidth, 4);
  }

  // Bandeau vert : appel à l'action
  const bannerY = height - (input.format === "story" ? 250 : 220);
  ctx.fillStyle = "#25d366";
  roundRect(ctx, margin, bannerY, width - margin * 2, 104, 52);
  ctx.fill();
  ctx.fillStyle = "#0b1220";
  ctx.textAlign = "center";
  ctx.font = `700 46px ${family}`;
  ctx.fillText("Commandez sur WhatsApp", width / 2, bannerY + 67);

  ctx.fillStyle = "#374151";
  ctx.font = `600 40px ${family}`;
  const shopLine = wrapLines(ctx, input.shopName, width - margin * 2, 1)[0] ?? input.shopName;
  ctx.fillText(shopLine, width / 2, bannerY + 170);
  ctx.fillStyle = "#6b7280";
  ctx.font = `500 34px ${family}`;
  const linkLine = wrapLines(ctx, input.displayLink, width - margin * 2, 1)[0] ?? input.displayLink;
  ctx.fillText(linkLine, width / 2, bannerY + 218);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image non créée"))), "image/png");
  });
}
