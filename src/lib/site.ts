/** Adresse publique de l'application (NEXT_PUBLIC_APP_URL), sans « / » final. */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Lien complet d'une boutique : https://wappshop.app/{slug}. */
export function shopUrl(slug: string): string {
  return `${getAppUrl()}/${slug}`;
}

/** Forme courte affichée à l'écran : wappshop.app/{slug}. */
export function shopAddress(slug: string): string {
  try {
    return `${new URL(getAppUrl()).host}/${slug}`;
  } catch {
    return `/${slug}`;
  }
}
