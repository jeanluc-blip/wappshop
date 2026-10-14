/** Adresse publique par défaut : jamais « localhost » dans un lien destiné aux clients. */
const DEFAULT_PUBLIC_URL = "https://wappshop.vercel.app";

const clean = (value: string) => value.replace(/\/+$/, "");
const isLocal = (value: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(value);

/**
 * Adresse publique de l'application, sans « / » final.
 * Ordre : NEXT_PUBLIC_APP_URL (si ce n'est pas une adresse locale), puis l'adresse de production fournie
 * automatiquement par Vercel, puis l'adresse publique par défaut ci-dessus.
 * Ainsi un lien copié et envoyé à un client commence toujours par l'adresse publique, même depuis localhost.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !isLocal(explicit)) return clean(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`.replace(/\/+$/, "");

  return DEFAULT_PUBLIC_URL;
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
