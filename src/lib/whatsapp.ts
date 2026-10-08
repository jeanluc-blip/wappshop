/** Numéro WhatsApp : uniquement les chiffres (retire +, espaces, tirets, parenthèses). */
export function waNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Lien WhatsApp réel (<a href>) avec texte pré-rempli, toujours encodé. */
export function waLink(number: string, text: string): string {
  return `https://wa.me/${waNumber(number)}?text=${encodeURIComponent(text)}`;
}

/** Message du bouton flottant « Poser une question » : texte brut, sans emoji. */
export function questionMessage(shopName: string): string {
  return `Bonjour, j'ai une question sur vos produits (${shopName}).`;
}
