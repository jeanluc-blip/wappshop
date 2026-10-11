// Partage de la boutique ou d'un produit sur les réseaux sociaux.
// Chaque lien partagé porte une origine (?src=whatsapp, facebook...) : l'onglet Statistiques montre ainsi
// d'où viennent les visiteurs. Aucune donnée personnelle : seulement le nom du réseau.

export const SHARE_SOURCES = ["whatsapp", "facebook", "instagram", "tiktok", "telegram", "x", "snapchat", "qr", "lien"] as const;
export type ShareSource = (typeof SHARE_SOURCES)[number];

export const SOURCE_LABELS: Record<ShareSource, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  x: "X (Twitter)",
  snapchat: "Snapchat",
  qr: "QR code / affiche",
  lien: "Lien copié",
};

/** Origine reçue dans l'adresse (?src=...) : acceptée seulement si elle est dans la liste. */
export function parseSource(value: string | null | undefined): ShareSource | null {
  return SHARE_SOURCES.find((source) => source === value) ?? null;
}

/** Adresse de la boutique ou du produit, avec l'origine du partage. */
export function shareLink(origin: string, slug: string, productId: string | null, source: ShareSource): string {
  const path = productId ? `/${slug}/${productId}` : `/${slug}`;
  return `${origin.replace(/\/$/, "")}${path}?src=${source}`;
}

/** Texte accompagnant le partage (sans emoji, lisible partout). */
export function shareText(input: { shopName: string; productName?: string; priceText?: string; link: string }): string {
  const lines: string[] = [];
  if (input.productName) {
    lines.push(input.productName + (input.priceText ? ` - ${input.priceText}` : ""));
    lines.push(`Chez ${input.shopName}`);
  } else {
    lines.push(`${input.shopName} : découvrez ma boutique en ligne`);
  }
  lines.push(`Commandez directement sur WhatsApp : ${input.link}`);
  return lines.join("\n");
}

export type NetworkLink = { source: ShareSource; label: string; href: string };

/**
 * Boutons de partage par lien. Instagram, TikTok et Snapchat n'offrent pas de bouton de partage pour un site web :
 * pour eux, on télécharge l'image et on colle le lien dans la publication ou la bio.
 */
export function networkLinks(build: (source: ShareSource) => { link: string; text: string }): NetworkLink[] {
  const whatsapp = build("whatsapp");
  const facebook = build("facebook");
  const telegram = build("telegram");
  const x = build("x");
  return [
    { source: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(whatsapp.text)}` },
    { source: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(facebook.link)}` },
    { source: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(telegram.link)}&text=${encodeURIComponent(telegram.text.split("\n")[0] ?? "")}` },
    { source: "x", label: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(x.text)}` },
  ];
}
