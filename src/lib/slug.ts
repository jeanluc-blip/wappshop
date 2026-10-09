// Mots réservés : les 13 premiers sont identiques à la contrainte SQL de la table `shops` (schema.sql).
// Les suivants sont refusés par l'application en plus (pages à venir, fichiers du site).
export const RESERVED_SLUGS = [
  "dashboard", "login", "register", "admin", "api", "app", "www",
  "auth", "avis", "produit", "static", "public", "support",
  "icon", "logo", "favicon", "robots", "sitemap", "legal", "contact", "aide", "faq", "about", "wappshop", "confidentialite", "conditions",
] as const;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 35)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slugError(slug) === null;
}

/** Message d'erreur en français pour une adresse de boutique, ou `null` si elle est valable. */
export function slugError(slug: string): string | null {
  if (slug.length < 3) return "L'adresse doit contenir au moins 3 caractères.";
  if (slug.length > 40) return "L'adresse est limitée à 40 caractères.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Utilisez uniquement des minuscules, des chiffres et des tirets (pas de tiret au début ni à la fin).";
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return "Cette adresse est réservée : choisissez-en une autre.";
  return null;
}

/** Forme attendue d'une adresse (sans tenir compte des mots réservés) : évite d'interroger la base pour n'importe quel chemin. */
export function looksLikeSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 40 && SLUG_PATTERN.test(value);
}

function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Adresse souhaitée d'abord, puis variantes avec un suffixe si elle est déjà prise. */
export function buildSlugCandidates(shopName: string, extraAttempts = 4): string[] {
  const base = isValidSlug(slugify(shopName)) ? slugify(shopName) : "boutique";
  const candidates = [base];
  for (let i = 0; i < extraAttempts; i++) candidates.push(`${base}-${randomSuffix()}`);
  return candidates;
}
